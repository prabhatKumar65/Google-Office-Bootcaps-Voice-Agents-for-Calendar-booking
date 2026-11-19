import React from 'react';
import {
  Cpu,
  LogOut,
  Mic,
  Sliders,
  Volume2,
} from 'lucide-react';
import type { AuthUser } from '../lib/firebaseAuth';
import { LANGUAGE_OPTIONS } from '../lib/languages';
import type {
  AgentConnectionState,
  LanguageCode,
  PortalView,
  VadActivityState,
  VadSensitivity,
  VoiceName,
} from '../types/calendar';
import { AgentAvatar } from './AgentAvatar';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SidebarProps {
  activeView: PortalView;
  onViewChange: (view: PortalView) => void;
  customAvatar: string | null;
  user: AuthUser | null;
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
  vadSensitivity: VadSensitivity;
  connectionState: AgentConnectionState;
  vadState: VadActivityState;
  onRestartSession: () => void;
}

const NAV_ITEMS: Array<{
  id: PortalView;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'voice-desk',
    label: 'Live Voice Desk',
    description: 'Voice agent & Calendar sync',
    icon: Mic,
  },
  {
    id: 'python-pipeline',
    label: 'Python NLP & Pipeline',
    description: 'Intent engine & slot optimizer',
    icon: Cpu,
  },
  {
    id: 'agent-settings',
    label: 'Voice & Agent Settings',
    description: 'Avatar PNG, VAD & dialects',
    icon: Sliders,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  customAvatar,
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
  vadSensitivity,
  connectionState,
  vadState,
  onRestartSession,
}) => {
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-[290px] lg:border-b-0 lg:border-r">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <AgentAvatar
          customSrc={customAvatar}
          size="sm"
          active={connectionState === 'connected'}
          speaking={vadState === 'agent_speaking'}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-bold tracking-tight text-slate-900">
            Prabhat Personal AI Agent
          </div>
          <div className="truncate font-mono text-[11px] text-slate-500 tabular-nums">
            {calendarTimeZone}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {/* Enterprise Portal Navigation */}
        <nav aria-label="Portal workspace views" className="space-y-1">
          <div className="mb-2 text-xs font-semibold text-slate-500">
            Workspace Modules
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-blue-700 bg-blue-50/70 text-blue-900'
                    : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-blue-700' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{item.label}</div>
                  <div className="truncate text-[11px] text-slate-500">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Google Calendar Account */}
        <section
          aria-label="Google Calendar connection"
          className="border-t border-slate-200 pt-5"
        >
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
                    className="space-y-1.5 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-relaxed text-red-700"
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
                  Connect Google Calendar for live availability checks and voice scheduling.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-900">
                    {user.displayName || 'Connected Account'}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {user.email || 'Primary calendar synced'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Quick Spoken Language Selector */}
        <section
          aria-label="Spoken language selector"
          className="border-t border-slate-200 pt-5"
        >
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
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50/70 font-semibold text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{opt.nativeLabel}</span>
                  <span className="ml-2 text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Active Acoustic Profile Summary */}
        <section className="border-t border-slate-200 pt-4 text-xs text-slate-500 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Voice Persona</span>
            </span>
            <span className="font-mono text-[11px] font-medium text-slate-700">
              {voiceName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>VAD Sensitivity</span>
            <span className="font-mono text-[11px] font-medium capitalize text-slate-700">
              {vadSensitivity}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onViewChange('agent-settings')}
            className="mt-1 text-[11px] font-medium text-blue-700 hover:underline"
          >
            Configure PNG avatar &amp; VAD settings
          </button>
        </section>
      </div>
    </aside>
  );
};
