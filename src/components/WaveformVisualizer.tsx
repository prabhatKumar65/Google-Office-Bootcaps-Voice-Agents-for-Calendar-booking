import React, { useEffect, useRef } from 'react';
import type { AgentConnectionState, VadActivityState } from '../types/calendar';

interface WaveformVisualizerProps {
  connectionState: AgentConnectionState;
  vadState: VadActivityState;
  getDbLevel: () => number;
  isMuted: boolean;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  connectionState,
  vadState,
  getDbLevel,
  isMuted,
  inputAnalyser,
  outputAnalyser,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dbSpanRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastDbUpdateMs = 0;
    const barCount = 44;
    const smoothed = new Float32Array(barCount);
    const freqBuf = new Uint8Array(128);

    const draw = (nowMs: number) => {
      if (dbSpanRef.current && nowMs - lastDbUpdateMs >= 160) {
        lastDbUpdateMs = nowMs;
        dbSpanRef.current.textContent =
          connectionState === 'connected' && !isMuted
            ? `${getDbLevel().toFixed(0)} dBFS`
            : '— dBFS';
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const activeAnalyser =
        vadState === 'agent_speaking'
          ? outputAnalyser
          : !isMuted && connectionState === 'connected'
            ? inputAnalyser
            : null;

      if (activeAnalyser) {
        activeAnalyser.getByteFrequencyData(freqBuf);
      } else {
        freqBuf.fill(0);
      }

      const gap = 4;
      const totalGap = gap * (barCount - 1);
      const barWidth = Math.max(2, (width - totalGap) / barCount);
      const centerY = height / 2;

      for (let i = 0; i < barCount; i++) {
        const distFromCenter = Math.abs(i - (barCount - 1) / 2) / (barCount / 2);
        const binIdx = Math.min(
          freqBuf.length - 1,
          Math.floor(distFromCenter * 34) + 1
        );
        const rawEnergy = activeAnalyser ? freqBuf[binIdx] / 255 : 0;
        const envelope = 1 - distFromCenter * 0.45;
        const target =
          connectionState === 'connected'
            ? Math.max(0.06, rawEnergy * envelope)
            : 0.05;

        smoothed[i] = smoothed[i] * 0.72 + target * 0.28;
        const barH = Math.max(4, smoothed[i] * (height - 16));

        const x = i * (barWidth + gap);
        const y = centerY - barH / 2;

        if (vadState === 'agent_speaking') {
          ctx.fillStyle = '#1D4ED8';
        } else if (vadState === 'speech' && !isMuted) {
          ctx.fillStyle = '#16A34A';
        } else if (vadState === 'tool_running') {
          ctx.fillStyle = '#D97706';
        } else if (connectionState === 'connected' && !isMuted) {
          ctx.fillStyle = '#94A3B8';
        } else {
          ctx.fillStyle = '#CBD5E1';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
        ctx.fill();
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [connectionState, vadState, isMuted, inputAnalyser, outputAnalyser, getDbLevel]);

  const statusText =
    connectionState !== 'connected'
      ? connectionState === 'connecting'
        ? 'Establishing live voice link'
        : 'Voice session idle'
      : isMuted
        ? 'Microphone muted'
        : vadState === 'agent_speaking'
          ? 'Agent speaking (speak anytime to interrupt)'
          : vadState === 'tool_running'
            ? 'Syncing with Google Calendar'
            : vadState === 'speech'
              ? 'VAD speech detected'
              : 'VAD listening for speech';

  const statusTone =
    connectionState !== 'connected'
      ? 'text-slate-500'
      : isMuted
        ? 'text-amber-700'
        : vadState === 'agent_speaking'
          ? 'text-blue-700'
          : vadState === 'tool_running'
            ? 'text-amber-700'
            : vadState === 'speech'
              ? 'text-emerald-700'
              : 'text-slate-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className={`text-xs font-medium ${statusTone}`}>{statusText}</span>
        <span
          ref={dbSpanRef}
          className="font-mono text-xs text-slate-500 tabular-nums"
        >
          — dBFS
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="h-20 w-full block"
        aria-label="Live voice activity waveform"
      />
    </div>
  );
};
