import React from 'react';
import { LogOut, Mic, ShieldCheck, Sliders, Volume2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { LANGUAGE_OPTIONS, VOICE_OPTIONS } from '../lib/languages';
import type {
  AgentConnectionState,
  LanguageCode,
  VadSensitivity,
  VoiceName,
} from '../types/calendar';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SidebarProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  authError?: {
    message: string;
    suggestNewTab?: boolean;
    suggestRedirect?: boolean;
  } | null;
  calendarTimeZone: string;
  onLogin: () => void;
  onRedirectLogin: () => void;
  onLogout: () => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  voiceName: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  vadSensitivity: VadSensitivity;
  onVadSensitivityChange: (sens: VadSensitivity) => void;
  bargeInEnabled: boolean;
  onBargeInChange: (enabled: boolean) => void;
  noiseGateEnabled: boolean;
  onNoiseGateChange: (enabled: boolean) => void;
  requireBookConfirm: boolean;
  onRequireBookConfirmChange: (enabled: boolean) => void;
  connectionState: AgentConnectionState;
  onRestartSession: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  needsAuth,
  isLoggingIn,
  authError,
  calendarTimeZone,
  onLogin,
  onRedirectLogin,
  onLogout,
  language,
  onLanguageChange,
  voiceName,
  onVoiceChange,
  vadSensitivity,
  onVadSensitivityChange,
  bargeInEnabled,
  onBargeInChange,
  noiseGateEnabled,
  onNoiseGateChange,
  requireBookConfirm,
  onRequireBookConfirmChange,
  connectionState,
  onRestartSession,
}) => {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-[300px] lg:border-b-0 lg:border-r">
      {/* Brand Zone */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          VaaniCal
        </span>
        <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {calendarTimeZone}
        </span>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {/* Google Calendar Account */}
        <section aria-label="Google Calendar connection">
          <h2 className="text-xs font-semibold text-slate-500">
            Google Calendar Sync
          </h2>
          <div className="mt-2.5">
            {needsAuth || !user ? (
              <div className="space-y-2.5">
                <GoogleSignInButton
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  label={isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                />
                {authError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-relaxed text-red-700 space-y-1.5"
                  >
                    <p>{authError.message}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {authError.suggestNewTab && typeof window !== 'undefined' && (
                        <a
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-red-800 underline"
                        >
                          Open app in a new tab
                        </a>
                      )}
                      {authError.suggestRedirect && (
                        <button
                          type="button"
                          onClick={onRedirectLogin}
                          className="font-semibold text-red-800 underline"
                        >
                          Use redirect sign-in instead
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs leading-relaxed text-slate-500">
                  Connect your Google Calendar so the voice agent can check availability and book appointments.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {user.displayName || 'Connected Account'}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {user.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Regional Language Selector */}
        <section aria-label="Language selection">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500">
              Spoken Language
            </h2>
            {connectionState === 'connected' && (
              <button
                type="button"
                onClick={onRestartSession}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
              >
                Apply live
              </button>
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-1.5">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onLanguageChange(opt.code)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50/70 text-blue-900 font-medium'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{opt.nativeLabel}</span>
                  <span className="ml-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Voice Persona */}
        <section aria-label="Voice persona">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Volume2 className="h-3.5 w-3.5" />
            <span>Agent Voice</span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {VOICE_OPTIONS.map((v) => {
              const active = voiceName === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onVoiceChange(v.id)}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50/70 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold">{v.label}</div>
                  <div className="truncate text-[11px] text-slate-500">{v.note}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* VAD & Real-time Processing Controls */}
        <section aria-label="Voice activity detection controls" className="space-y-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Sliders className="h-3.5 w-3.5" />
            <span>VAD &amp; Low-Latency Controls</span>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
              <span>VAD Sensitivity</span>
              <span className="font-mono text-[11px] text-slate-500">
                {vadSensitivity}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {(['low', 'balanced', 'high'] as VadSensitivity[]).map((sens) => (
                <button
                  key={sens}
                  type="button"
                  onClick={() => onVadSensitivityChange(sens)}
                  className={`rounded-md py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                    vadSensitivity === sens
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sens}
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={bargeInEnabled}
              onChange={(e) => onBargeInChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              <span className="font-medium text-slate-900">Barge-in interruption</span>
              <span className="block text-slate-500">
                Stop agent audio immediately when you start speaking
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={noiseGateEnabled}
              onChange={(e) => onNoiseGateChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              <span className="font-medium text-slate-900">Client VAD noise gate</span>
              <span className="block text-slate-500">
                Stream audio only during speech with 320ms pre-roll
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={requireBookConfirm}
              onChange={(e) => onRequireBookConfirmChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="flex items-start gap-1">
              <span>
                <span className="font-medium text-slate-900">
                  Confirm new voice bookings
                </span>
                <span className="block text-slate-500">
                  Reschedules &amp; cancellations always require click approval
                </span>
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>16 kHz PCM capture · 24 kHz playback</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Mic className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>Supports Hindi, Bhojpuri, Tamil, Marathi, Telugu</span>
          </div>
        </section>
      </div>
    </aside>
  );
};
