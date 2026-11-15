import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Hand,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { LANGUAGE_OPTIONS } from '../lib/languages';
import type {
  AgentConnectionState,
  LanguageCode,
  TranscriptEntry,
  VadActivityState,
} from '../types/calendar';
import { WaveformVisualizer } from './WaveformVisualizer';

interface VoiceAgentConsoleProps {
  connectionState: AgentConnectionState;
  vadState: VadActivityState;
  dbLevel: number;
  isMuted: boolean;
  language: LanguageCode;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  transcripts: TranscriptEntry[];
  errorMessage: string | null;
  onStartSession: () => void;
  onStopSession: () => void;
  onToggleMute: () => void;
  onManualInterrupt: () => void;
  onSendText: (text: string) => void;
  onClearTranscript: () => void;
}

function formatToolLabel(name?: string): string {
  switch (name) {
    case 'get_current_datetime':
      return 'Resolved current date & timezone';
    case 'list_events':
      return 'Fetched Google Calendar events';
    case 'check_availability':
      return 'Checked Google Calendar availability';
    case 'book_appointment':
      return 'Booked Google Calendar event';
    case 'reschedule_appointment':
      return 'Rescheduled Google Calendar event';
    case 'cancel_appointment':
      return 'Cancelled Google Calendar event';
    default:
      return name || 'Calendar action';
  }
}

export const VoiceAgentConsole: React.FC<VoiceAgentConsoleProps> = ({
  connectionState,
  vadState,
  dbLevel,
  isMuted,
  language,
  inputAnalyser,
  outputAnalyser,
  transcripts,
  errorMessage,
  onStartSession,
  onStopSession,
  onToggleMute,
  onManualInterrupt,
  onSendText,
  onClearTranscript,
}) => {
  const [textInput, setTextInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeLang =
    LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcripts]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setTextInput('');
  };

  return (
    <section className="flex min-h-[540px] flex-col rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Voice Booking Console
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Gemini Live</span>
            <span aria-hidden="true">·</span>
            <span>{activeLang.nativeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Real-time VAD</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connectionState === 'connected' ? (
            <>
              <button
                type="button"
                onClick={onToggleMute}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isMuted
                    ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>Unmute</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    <span>Mute</span>
                  </>
                )}
              </button>

              {vadState === 'agent_speaking' && (
                <button
                  type="button"
                  onClick={onManualInterrupt}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Hand className="h-3.5 w-3.5" />
                  <span>Interrupt</span>
                </button>
              )}

              <button
                type="button"
                onClick={onStopSession}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                <span>End Call</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartSession}
              disabled={connectionState === 'connecting'}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {connectionState === 'connecting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  <span>Start Voice Session</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Waveform & Error Banner */}
      <div className="space-y-3 border-b border-slate-200 px-5 py-4">
        <WaveformVisualizer
          connectionState={connectionState}
          vadState={vadState}
          dbLevel={dbLevel}
          isMuted={isMuted}
          inputAnalyser={inputAnalyser}
          outputAnalyser={outputAnalyser}
        />

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
          >
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Regional Sample Prompts */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500">
            Sample phrases ({activeLang.label}) — click to send or say aloud:
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {activeLang.samples.map((sample) => (
              <button
                key={sample.phrase}
                type="button"
                onClick={() => onSendText(sample.phrase)}
                className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="line-clamp-2 text-xs font-medium text-slate-900">
                  “{sample.phrase}”
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-500">
                  {sample.translation}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Conversation Transcript */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
        <span className="text-xs font-semibold text-slate-600">
          Live Transcript &amp; Calendar Actions
        </span>
        {transcripts.length > 0 && (
          <button
            type="button"
            onClick={onClearTranscript}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 whitespace-nowrap shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4 min-h-[240px] max-h-[420px]"
      >
        {transcripts.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-700">
              Ready to speak in Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
              Start a voice session above and speak naturally, or click a sample phrase to test live intent parsing and Google Calendar sync.
            </p>
          </div>
        ) : (
          transcripts.map((entry) => {
            if (entry.role === 'tool') {
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {entry.toolStatus === 'running' ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-600" />
                    ) : entry.toolStatus === 'error' ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                    ) : entry.toolStatus === 'cancelled' ? (
                      <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    )}
                    <Wrench className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate font-medium text-slate-800">
                      {formatToolLabel(entry.toolName)}
                    </span>
                    {entry.meta && (
                      <span className="truncate text-slate-500">
                        · {entry.meta}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                    {entry.timestamp}
                  </span>
                </div>
              );
            }

            if (entry.role === 'system') {
              return (
                <div
                  key={entry.id}
                  className="text-center text-xs text-slate-500 py-1"
                >
                  {entry.text}
                </div>
              );
            }

            const isUser = entry.role === 'user';
            return (
              <div
                key={entry.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">
                    {isUser ? 'Client / You' : 'Prabhat Personal AI Agent'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{entry.timestamp}</span>
                </div>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-700 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-900'
                  } ${entry.interim ? 'opacity-75' : ''}`}
                >
                  {entry.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Text Fallback Composer */}
      <form
        onSubmit={handleFormSubmit}
        className="flex items-center gap-2 border-t border-slate-200 px-4 py-3"
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type a request in Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English..."
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        />
        <button
          type="submit"
          disabled={!textInput.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Send className="h-4 w-4" />
          <span>Send</span>
        </button>
      </form>
    </section>
  );
};
