import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Hand,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
} from 'lucide-react';
import { LANGUAGE_OPTIONS } from '../lib/languages';
import type {
  AgentConnectionState,
  LanguageCode,
  VadActivityState,
} from '../types/calendar';
import { DEFAULT_AGENT_PORTRAIT } from './AgentAvatar';

interface SpeakingAgentStageProps {
  customAvatar: string | null;
  connectionState: AgentConnectionState;
  vadState: VadActivityState;
  isMuted: boolean;
  language: LanguageCode;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  latestAgentCaption: string | null;
  onStartSession: () => void;
  onStopSession: () => void;
  onToggleMute: () => void;
  onManualInterrupt: () => void;
  onOpenAvatarSettings: () => void;
}

const BAR_COUNT = 11;

export const SpeakingAgentStage: React.FC<SpeakingAgentStageProps> = ({
  customAvatar,
  connectionState,
  vadState,
  isMuted,
  language,
  inputAnalyser,
  outputAnalyser,
  latestAgentCaption,
  onStartSession,
  onStopSession,
  onToggleMute,
  onManualInterrupt,
  onOpenAvatarSettings,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const portraitWrapRef = useRef<HTMLDivElement | null>(null);
  const outerRingRef = useRef<HTMLDivElement | null>(null);
  const innerRingRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const activeLang =
    LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];
  const src = !imgFailed ? customAvatar || DEFAULT_AGENT_PORTRAIT : null;

  useEffect(() => {
    setImgFailed(false);
  }, [customAvatar]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const freqBuf = new Uint8Array(64);
    const timeBuf = new Uint8Array(128);
    let smoothedEnergy = 0;
    const barSmooth = new Float32Array(BAR_COUNT);

    const animate = (nowMs: number) => {
      const t = nowMs / 1000;
      const isSpeaking = vadState === 'agent_speaking';
      const isUserSpeaking =
        connectionState === 'connected' && vadState === 'speech' && !isMuted;

      const analyser = isSpeaking
        ? outputAnalyser
        : isUserSpeaking
          ? inputAnalyser
          : null;

      let rawEnergy = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(timeBuf);
        analyser.getByteFrequencyData(freqBuf);
        let sumSq = 0;
        for (let i = 0; i < timeBuf.length; i++) {
          const centered = (timeBuf[i] - 128) / 128;
          sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / timeBuf.length);
        rawEnergy = Math.min(1, rms * 4.2);
      } else if (isSpeaking) {
        // Fallback cadence if analyser is settling while speaking
        rawEnergy = 0.28 + 0.18 * Math.abs(Math.sin(t * 9.5));
      } else if (isUserSpeaking) {
        rawEnergy = 0.22 + 0.12 * Math.abs(Math.sin(t * 7.0));
      }

      smoothedEnergy = smoothedEnergy * 0.65 + rawEnergy * 0.35;

      // Animate portrait wrapper with real speaking cadence & breathing
      if (portraitWrapRef.current && !prefersReducedMotion) {
        if (isSpeaking) {
          const liftY = -(smoothedEnergy * 4.5);
          const scale = 1 + smoothedEnergy * 0.036;
          const tiltDeg = Math.sin(t * 7.2) * smoothedEnergy * 1.15;
          portraitWrapRef.current.style.transform = `translate3d(0, ${liftY.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${tiltDeg.toFixed(2)}deg)`;
        } else if (isUserSpeaking) {
          const scale = 1 + smoothedEnergy * 0.02;
          portraitWrapRef.current.style.transform = `translate3d(0, -1px, 0) scale(${scale.toFixed(4)})`;
        } else if (connectionState === 'connected') {
          const breath = 1 + Math.sin(t * 2.1) * 0.009;
          portraitWrapRef.current.style.transform = `translate3d(0, 0, 0) scale(${breath.toFixed(4)})`;
        } else {
          portraitWrapRef.current.style.transform = 'translate3d(0, 0, 0) scale(1)';
        }
      }

      // Animate concentric acoustic aura rings
      if (innerRingRef.current && !prefersReducedMotion) {
        if (isSpeaking || isUserSpeaking) {
          const ringScale = 1.04 + smoothedEnergy * 0.13;
          const ringOpacity = 0.35 + smoothedEnergy * 0.55;
          innerRingRef.current.style.transform = `scale(${ringScale.toFixed(3)})`;
          innerRingRef.current.style.opacity = ringOpacity.toFixed(2);
        } else if (connectionState === 'connected') {
          const pulse = 1.02 + Math.sin(t * 2.4) * 0.015;
          innerRingRef.current.style.transform = `scale(${pulse.toFixed(3)})`;
          innerRingRef.current.style.opacity = '0.28';
        } else {
          innerRingRef.current.style.transform = 'scale(1)';
          innerRingRef.current.style.opacity = '0';
        }
      }

      if (outerRingRef.current && !prefersReducedMotion) {
        if (isSpeaking || isUserSpeaking) {
          const outerScale = 1.09 + smoothedEnergy * 0.24;
          const outerOpacity = 0.14 + smoothedEnergy * 0.42;
          outerRingRef.current.style.transform = `scale(${outerScale.toFixed(3)})`;
          outerRingRef.current.style.opacity = outerOpacity.toFixed(2);
        } else {
          outerRingRef.current.style.transform = 'scale(1)';
          outerRingRef.current.style.opacity = '0';
        }
      }

      // Animate centered 11-bar vocal cadence equalizer
      const center = (BAR_COUNT - 1) / 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        const dist = Math.abs(i - center) / center;
        const bin = Math.min(freqBuf.length - 1, Math.floor(dist * 18) + 2);
        let target = 0.15;
        if (analyser && (isSpeaking || isUserSpeaking)) {
          const freqNorm = freqBuf[bin] / 255;
          target = Math.max(0.2, Math.min(1, freqNorm * (1.15 - dist * 0.4) + smoothedEnergy * 0.35));
        } else if (isSpeaking || isUserSpeaking) {
          target = 0.25 + (1 - dist * 0.55) * smoothedEnergy * Math.abs(Math.sin(t * 10 + i * 0.8));
        } else if (connectionState === 'connected') {
          target = 0.18 + 0.08 * Math.abs(Math.sin(t * 2.5 + i * 0.5));
        }
        barSmooth[i] = barSmooth[i] * 0.6 + target * 0.4;
        const scaleY = prefersReducedMotion ? (isSpeaking ? 0.55 : 0.2) : barSmooth[i];
        el.style.transform = `scaleY(${scaleY.toFixed(3)})`;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [connectionState, vadState, isMuted, inputAnalyser, outputAnalyser]);

  const isSpeaking = vadState === 'agent_speaking';
  const isUserSpeaking =
    connectionState === 'connected' && vadState === 'speech' && !isMuted;
  const isToolRunning = vadState === 'tool_running';

  const ringColorClass = isSpeaking
    ? 'border-blue-600'
    : isUserSpeaking
      ? 'border-emerald-600'
      : isToolRunning
        ? 'border-amber-500'
        : 'border-slate-400';

  const barColorClass = isSpeaking
    ? 'bg-blue-700'
    : isUserSpeaking
      ? 'bg-emerald-600'
      : isToolRunning
        ? 'bg-amber-600'
        : connectionState === 'connected'
          ? 'bg-slate-400'
          : 'bg-slate-300';

  const liveActivityLabel =
    connectionState === 'connecting'
      ? 'Connecting live voice pipeline...'
      : connectionState !== 'connected'
        ? 'Ready for voice conversation'
        : isMuted
          ? 'Microphone muted'
          : isSpeaking
            ? 'Speaking with you (speak anytime to interrupt)'
            : isToolRunning
              ? 'Checking Google Calendar...'
              : isUserSpeaking
                ? 'Listening to your voice...'
                : 'Listening and ready';

  return (
    <section
      aria-label="Speaking AI Agent Stage"
      className="relative flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-5 text-center"
    >
      {/* Top-right PNG customizer action */}
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={onOpenAvatarSettings}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span>Change Image</span>
        </button>
      </div>

      {/* Centered Speaking Agent Portrait + Acoustic Rings */}
      <div className="relative mt-1 flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40">
        <div
          ref={outerRingRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 rounded-full border-2 transition-colors duration-200 ${ringColorClass}`}
          style={{ opacity: 0 }}
        />
        <div
          ref={innerRingRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-1.5 rounded-full border-2 transition-colors duration-200 ${ringColorClass}`}
          style={{ opacity: 0 }}
        />
        <div
          ref={portraitWrapRef}
          className={`relative h-32 w-32 overflow-hidden rounded-full border-2 bg-white shadow-sm transition-colors duration-200 sm:h-36 sm:w-36 ${
            isSpeaking
              ? 'border-blue-700'
              : isUserSpeaking
                ? 'border-emerald-600'
                : isToolRunning
                  ? 'border-amber-500'
                  : 'border-slate-200'
          }`}
        >
          {src ? (
            <img
              src={src}
              alt="Prabhat Personal AI Agent"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-600">
              <Bot className="h-12 w-12" />
            </div>
          )}
        </div>
      </div>

      {/* Live Vocal Cadence Bars */}
      <div
        className="mt-3 flex h-6 items-center justify-center gap-1"
        aria-hidden="true"
      >
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className={`block h-5 w-1 origin-center rounded-full transition-colors duration-150 ${barColorClass}`}
            style={{ transform: 'scaleY(0.18)' }}
          />
        ))}
      </div>

      {/* Agent Identity & Spoken Status */}
      <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        Prabhat Personal AI Agent
      </h1>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
        <span
          className={`font-medium ${
            isSpeaking
              ? 'text-blue-700'
              : isUserSpeaking
                ? 'text-emerald-700'
                : isToolRunning
                  ? 'text-amber-700'
                  : 'text-slate-600'
          }`}
        >
          {liveActivityLabel}
        </span>
        <span aria-hidden="true">·</span>
        <span>{activeLang.nativeLabel}</span>
        <span aria-hidden="true">·</span>
        <span>All Indian Languages</span>
      </div>

      {/* Live Spoken Caption */}
      {latestAgentCaption && (
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-700">
          “{latestAgentCaption}”
        </p>
      )}

      {/* Centered Primary Voice Session Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        {connectionState === 'connected' ? (
          <>
            <button
              type="button"
              onClick={onToggleMute}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isMuted
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isMuted ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  <span>Unmute Mic</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  <span>Mute Mic</span>
                </>
              )}
            </button>

            {isSpeaking && (
              <button
                type="button"
                onClick={onManualInterrupt}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Hand className="h-3.5 w-3.5" />
                <span>Interrupt</span>
              </button>
            )}

            <button
              type="button"
              onClick={onStopSession}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>End Voice Call</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onStartSession}
            disabled={connectionState === 'connecting'}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {connectionState === 'connecting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Connecting Voice Agent...</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                <span>Talk to Prabhat Personal AI Agent</span>
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
};
