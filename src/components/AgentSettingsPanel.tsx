import React, { useRef, useState } from 'react';
import { ImagePlus, RotateCcw, ShieldCheck, Sliders, Volume2 } from 'lucide-react';
import { LANGUAGE_OPTIONS, VOICE_OPTIONS } from '../lib/languages';
import type {
  AgentConnectionState,
  LanguageCode,
  VadSensitivity,
  VoiceName,
} from '../types/calendar';
import { AgentAvatar } from './AgentAvatar';

interface AgentSettingsPanelProps {
  customAvatar: string | null;
  onCustomAvatarChange: (dataUrl: string | null) => void;
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

export const AgentSettingsPanel: React.FC<AgentSettingsPanelProps> = ({
  customAvatar,
  onCustomAvatarChange,
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a PNG, JPG, or WebP image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image file must be under 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCustomAvatarChange(reader.result);
      }
    };
    reader.onerror = () => {
      setUploadError('Unable to read the selected image.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Agent Identity & Custom PNG Portrait */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Agent Visual Identity
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Upload your own PNG portrait for Prabhat Personal AI Agent or use the default enterprise studio emblem.
        </p>

        <div className="mt-5 flex items-center gap-4 border-t border-b border-slate-200 py-5">
          <AgentAvatar
            customSrc={customAvatar}
            size="lg"
            active
            alt="Prabhat Personal AI Agent custom avatar"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">
              Prabhat Personal AI Agent
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Built by Prabhat Kumar · Indian AI Developer
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Upload Agent PNG</span>
              </button>
              {customAvatar && (
                <button
                  type="button"
                  onClick={() => onCustomAvatarChange(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Default</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {uploadError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {uploadError}
          </p>
        )}

        {/* Voice Persona Selection */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Gemini Live Voice Persona</span>
            </div>
            {connectionState === 'connected' && (
              <button
                type="button"
                onClick={onRestartSession}
                className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
              >
                Apply live
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VOICE_OPTIONS.map((v) => {
              const active = voiceName === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onVoiceChange(v.id)}
                  className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50/70 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold">{v.label}</div>
                  <div className="text-[11px] text-slate-500">{v.note}</div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Regional Language & Acoustic VAD Pipeline */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-7">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-blue-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Regional Languages &amp; Real-Time VAD Pipeline
            </h2>
          </div>
          {connectionState === 'connected' && (
            <button
              type="button"
              onClick={onRestartSession}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
            >
              Reconnect with Changes
            </button>
          )}
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold text-slate-500">
            Active Spoken Language Mode
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onLanguageChange(opt.code)}
                  className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
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
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-700">VAD Endpointing Sensitivity</span>
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
                  className={`rounded-md py-2 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={bargeInEnabled}
                onChange={(e) => onBargeInChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>
                <span className="font-semibold text-slate-900 block">
                  Barge-in interruption
                </span>
                <span className="mt-0.5 block text-slate-500">
                  Immediately halt agent speech when you start talking
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={noiseGateEnabled}
                onChange={(e) => onNoiseGateChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span>
                <span className="font-semibold text-slate-900 block">
                  Client VAD noise gate
                </span>
                <span className="mt-0.5 block text-slate-500">
                  Stream PCM only on detected speech with 320 ms pre-roll
                </span>
              </span>
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={requireBookConfirm}
              onChange={(e) => onRequireBookConfirmChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              <span className="font-semibold text-slate-900 block">
                Require explicit modal approval for new voice bookings
              </span>
              <span className="mt-0.5 block text-slate-500">
                Reschedules and cancellations always prompt for click approval before modifying Google Calendar
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              16 kHz mono PCM input · 24 kHz low-latency output · OAuth access tokens stored strictly in memory
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
