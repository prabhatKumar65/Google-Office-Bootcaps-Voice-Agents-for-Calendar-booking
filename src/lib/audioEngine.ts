import type { VadSensitivity } from '../types/calendar';

export interface AudioEngineCallbacks {
  onAudioChunk: (base64Pcm16k: string) => void;
  onVadChange: (speaking: boolean, dbLevel: number) => void;
  onBargeIn: () => void;
  onOutputStateChange: (playing: boolean) => void;
}

export interface AudioEngineOptions {
  sensitivity: VadSensitivity;
  bargeInEnabled: boolean;
  noiseGateEnabled: boolean;
}

const SENSITIVITY_THRESHOLDS: Record<
  VadSensitivity,
  { rms: number; hangoverMs: number; bargeInRms: number; bargeInFrames: number }
> = {
  high: { rms: 0.007, hangoverMs: 360, bargeInRms: 0.022, bargeInFrames: 2 },
  balanced: { rms: 0.012, hangoverMs: 420, bargeInRms: 0.028, bargeInFrames: 2 },
  low: { rms: 0.024, hangoverMs: 520, bargeInRms: 0.045, bargeInFrames: 3 },
};

// Snappy 45ms lead-in absorbs WebSocket jitter without delaying response start
const PLAYBACK_JITTER_BUFFER_SEC = 0.045;
const OUTPUT_IDLE_DEBOUNCE_MS = 160;
// Brief 180ms startup skip avoids initial mic hardware click without missing early speech
const MIC_WARMUP_MS = 180;

const WORKLET_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

function resampleTo16k(samples: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === 16000) return samples;
  const ratio = sourceRate / 16000;
  const targetLength = Math.max(1, Math.round(samples.length / ratio));
  const result = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(samples.length - 1, idx0 + 1);
    const frac = srcIdx - idx0;
    result[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
  }
  return result;
}

function float32ToBase64Pcm16(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export class VoiceAudioEngine {
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private outputIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private isOutputReportingPlaying = false;

  private isMuted = false;
  private isSpeechActive = false;
  private lastSpeechTime = 0;
  private startedAtMs = 0;
  private noiseFloorRms = 0.004;
  private currentDbLevel = -60;
  private consecutiveBargeInFrames = 0;
  private preRollQueue: string[] = [];
  private readonly maxPreRollFrames = 8;

  // Gentle ~60Hz high-pass filter preserves full human vocal clarity while stripping DC rumble
  private hpPrevIn = 0;
  private hpPrevOut = 0;

  private options: AudioEngineOptions;
  private callbacks: AudioEngineCallbacks;

  constructor(callbacks: AudioEngineCallbacks, options: AudioEngineOptions) {
    this.callbacks = callbacks;
    this.options = options;
  }

  public updateOptions(options: Partial<AudioEngineOptions>) {
    this.options = { ...this.options, ...options };
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.consecutiveBargeInFrames = 0;
    if (muted) {
      this.currentDbLevel = -60;
      if (this.isSpeechActive) {
        this.isSpeechActive = false;
        this.callbacks.onVadChange(false, -60);
      }
    }
  }

  public getCurrentDbLevel(): number {
    return this.currentDbLevel;
  }

  public getInputAnalyser(): AnalyserNode | null {
    return this.inputAnalyser;
  }

  public getOutputAnalyser(): AnalyserNode | null {
    return this.outputAnalyser;
  }

  public isAgentSpeaking(): boolean {
    return this.activeSources.size > 0 || this.isOutputReportingPlaying;
  }

  public async start(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.inputCtx = new AudioContext({ sampleRate: 16000 });
    this.outputCtx = new AudioContext({ sampleRate: 24000 });
    await this.inputCtx.resume();
    await this.outputCtx.resume();

    this.startedAtMs = performance.now();
    this.noiseFloorRms = 0.004;
    this.hpPrevIn = 0;
    this.hpPrevOut = 0;
    this.consecutiveBargeInFrames = 0;

    this.inputAnalyser = this.inputCtx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputAnalyser.smoothingTimeConstant = 0.72;

    this.outputAnalyser = this.outputCtx.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.72;
    this.outputAnalyser.connect(this.outputCtx.destination);

    this.sourceNode = this.inputCtx.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.inputAnalyser);

    const silentGain = this.inputCtx.createGain();
    silentGain.gain.value = 0;
    silentGain.connect(this.inputCtx.destination);

    // 512 samples at 16kHz (32ms) for fast voice onset and low-latency streaming
    let pending16k = new Float32Array(0);
    const frameTarget = 512;

    const handleRawFloatFrame = (rawFrame: Float32Array) => {
      if (this.isMuted || !this.inputCtx) return;

      const resampled = resampleTo16k(rawFrame, this.inputCtx.sampleRate);
      const merged = new Float32Array(pending16k.length + resampled.length);
      merged.set(pending16k, 0);
      merged.set(resampled, pending16k.length);
      pending16k = merged;

      while (pending16k.length >= frameTarget) {
        const chunk = pending16k.subarray(0, frameTarget);
        pending16k = pending16k.subarray(frameTarget);
        this.processVadAndEmit(chunk);
      }
    };

    try {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.inputCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      this.workletNode = new AudioWorkletNode(this.inputCtx, 'pcm-capture-processor');
      this.workletNode.port.onmessage = (event) => {
        if (event.data instanceof Float32Array) {
          handleRawFloatFrame(event.data);
        }
      };
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(silentGain);
    } catch {
      this.scriptNode = this.inputCtx.createScriptProcessor(1024, 1, 1);
      this.scriptNode.onaudioprocess = (e) => {
        handleRawFloatFrame(e.inputBuffer.getChannelData(0));
      };
      this.sourceNode.connect(this.scriptNode);
      this.scriptNode.connect(silentGain);
    }
  }

  private applyHighPassFilter(input: Float32Array): Float32Array {
    // Gentle ~60Hz high-pass filter (alpha=0.976 at 16kHz)
    const alpha = 0.976;
    const out = new Float32Array(input.length);
    let prevIn = this.hpPrevIn;
    let prevOut = this.hpPrevOut;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = alpha * (prevOut + x - prevIn);
      out[i] = y;
      prevIn = x;
      prevOut = y;
    }
    this.hpPrevIn = prevIn;
    this.hpPrevOut = prevOut;
    return out;
  }

  private processVadAndEmit(rawChunk: Float32Array) {
    const chunk = this.applyHighPassFilter(rawChunk);
    let sumSq = 0;
    for (let i = 0; i < chunk.length; i++) {
      sumSq += chunk[i] * chunk[i];
    }
    const rms = Math.sqrt(sumSq / chunk.length);
    const db = Math.max(-60, Math.min(0, 20 * Math.log10(rms + 1e-6)));
    this.currentDbLevel = db;

    const now = performance.now();

    if (now - this.startedAtMs < MIC_WARMUP_MS) {
      this.noiseFloorRms = this.noiseFloorRms * 0.75 + Math.min(rms, 0.03) * 0.25;
      return;
    }

    const config = SENSITIVITY_THRESHOLDS[this.options.sensitivity];
    const dynamicThreshold = Math.max(config.rms, this.noiseFloorRms * 2.2);
    const agentSpeakingNow = this.isAgentSpeaking();

    if (agentSpeakingNow) {
      const bargeThreshold = Math.max(config.bargeInRms, dynamicThreshold * 2.0);
      if (rms >= bargeThreshold) {
        this.consecutiveBargeInFrames += 1;
        if (
          this.options.bargeInEnabled &&
          this.consecutiveBargeInFrames >= config.bargeInFrames
        ) {
          this.consecutiveBargeInFrames = 0;
          this.isSpeechActive = true;
          this.lastSpeechTime = now;
          this.stopOutputPlayback();
          this.callbacks.onBargeIn();
          this.callbacks.onVadChange(true, db);
        }
      } else {
        this.consecutiveBargeInFrames = 0;
      }
    } else {
      this.consecutiveBargeInFrames = 0;
      const prevSpeechState = this.isSpeechActive;

      if (rms >= dynamicThreshold) {
        this.isSpeechActive = true;
        this.lastSpeechTime = now;
      } else {
        this.noiseFloorRms = this.noiseFloorRms * 0.96 + Math.min(rms, 0.025) * 0.04;
        if (this.isSpeechActive && now - this.lastSpeechTime > config.hangoverMs) {
          this.isSpeechActive = false;
        }
      }

      if (this.isSpeechActive !== prevSpeechState) {
        this.callbacks.onVadChange(this.isSpeechActive, db);
      }
    }

    const base64 = float32ToBase64Pcm16(chunk);

    if (this.options.noiseGateEnabled) {
      if (this.isSpeechActive || this.consecutiveBargeInFrames > 0) {
        while (this.preRollQueue.length > 0) {
          const pre = this.preRollQueue.shift()!;
          this.callbacks.onAudioChunk(pre);
        }
        this.callbacks.onAudioChunk(base64);
      } else {
        this.preRollQueue.push(base64);
        if (this.preRollQueue.length > this.maxPreRollFrames) {
          this.preRollQueue.shift();
        }
      }
    } else {
      this.callbacks.onAudioChunk(base64);
    }
  }

  public playOutputChunk(base64Pcm24k: string) {
    if (!this.outputCtx || !this.outputAnalyser) return;
    if (this.outputCtx.state === 'suspended') {
      void this.outputCtx.resume();
    }

    const float32 = base64Pcm16ToFloat32(base64Pcm24k);
    if (float32.length === 0) return;

    const now = this.outputCtx.currentTime;
    const isFreshBurst = this.nextStartTime < now + 0.005;

    if (isFreshBurst) {
      // Smooth 1.5ms ramp-in prevents startup click without muting any audio
      const fadeSamples = Math.min(36, float32.length);
      for (let i = 0; i < fadeSamples; i++) {
        float32[i] *= i / fadeSamples;
      }
      this.nextStartTime = now + PLAYBACK_JITTER_BUFFER_SEC;
    }

    const buffer = this.outputCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.outputCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAnalyser);

    if (this.outputIdleTimer) {
      clearTimeout(this.outputIdleTimer);
      this.outputIdleTimer = null;
    }

    this.activeSources.add(source);
    if (!this.isOutputReportingPlaying) {
      this.isOutputReportingPlaying = true;
      this.callbacks.onOutputStateChange(true);
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.outputIdleTimer = setTimeout(() => {
          this.outputIdleTimer = null;
          if (this.activeSources.size === 0 && this.isOutputReportingPlaying) {
            this.isOutputReportingPlaying = false;
            this.callbacks.onOutputStateChange(false);
          }
        }, OUTPUT_IDLE_DEBOUNCE_MS);
      }
    };

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  public stopOutputPlayback() {
    if (this.outputIdleTimer) {
      clearTimeout(this.outputIdleTimer);
      this.outputIdleTimer = null;
    }

    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already-stopped sources
      }
    }
    this.activeSources.clear();
    this.nextStartTime = this.outputCtx ? this.outputCtx.currentTime : 0;

    if (this.isOutputReportingPlaying) {
      this.isOutputReportingPlaying = false;
      this.callbacks.onOutputStateChange(false);
    }
  }

  public async stop(): Promise<void> {
    this.stopOutputPlayback();
    this.preRollQueue = [];
    this.isSpeechActive = false;
    this.consecutiveBargeInFrames = 0;
    this.currentDbLevel = -60;

    try {
      this.workletNode?.disconnect();
      this.scriptNode?.disconnect();
      this.sourceNode?.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.inputCtx) {
      await this.inputCtx.close();
      this.inputCtx = null;
    }
    if (this.outputCtx) {
      await this.outputCtx.close();
      this.outputCtx = null;
    }
    this.inputAnalyser = null;
    this.outputAnalyser = null;
  }
}
