import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck,
  Clock,
  Cpu,
  Play,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type {
  LanguageCode,
  PythonEngineStatus,
  PythonNlpAnalysis,
  PythonSlotResponse,
  PythonSlotSuggestion,
} from '../types/calendar';

interface PythonPipelinePanelProps {
  timeZone: string;
  language: LanguageCode;
  isAuthenticated: boolean;
  accessToken: string | null;
  recentAnalyses: PythonNlpAnalysis[];
  onRecordAnalysis: (analysis: PythonNlpAnalysis) => void;
  onSelectSlotToBook: (slot: PythonSlotSuggestion) => void;
}

const SAMPLE_UTTERANCES: Array<{ label: string; lang: LanguageCode; text: string }> = [
  {
    label: 'Hindi',
    lang: 'hi',
    text: 'कल सुबह 11 बजे क्लाइंट डेमो मीटिंग Google Meet पर बुक करो',
  },
  {
    label: 'Bhojpuri',
    lang: 'bho',
    text: 'बिहान भोर में 10 बजे एगो डॉक्टर अपॉइंटमेंट बुक कर द',
  },
  {
    label: 'Tamil',
    lang: 'ta',
    text: 'நாளைக்கு காலை 11 மணிக்கு மீட்டிங் பதிவு செய்',
  },
  {
    label: 'Marathi',
    lang: 'mr',
    text: 'उद्या संध्याकाळी 5 वाजता प्रोजेक्ट मीटिंग बुक करा',
  },
  {
    label: 'Telugu',
    lang: 'te',
    text: 'రేపు ఉదయం 10 గంటలకు క్లయింట్ కాల్ బుక్ చేయి',
  },
];

export const PythonPipelinePanel: React.FC<PythonPipelinePanelProps> = ({
  timeZone,
  language,
  isAuthenticated,
  accessToken,
  recentAnalyses,
  onRecordAnalysis,
  onSelectSlotToBook,
}) => {
  const [status, setStatus] = useState<PythonEngineStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [sandboxText, setSandboxText] = useState(
    'कल सुबह 11 बजे क्लाइंट मीटिंग Google Meet के साथ बुक करो'
  );
  const [sandboxResult, setSandboxResult] = useState<PythonNlpAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slotDuration, setSlotDuration] = useState(30);
  const [slotResponse, setSlotResponse] = useState<PythonSlotResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/python/status');
      if (res.ok) {
        const data = (await res.json()) as PythonEngineStatus;
        setStatus(data);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus, recentAnalyses.length]);

  const handleAnalyze = async (overrideText?: string, overrideLang?: LanguageCode) => {
    const targetText = (overrideText ?? sandboxText).trim();
    if (!targetText) return;

    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch('/api/python/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: targetText,
          languageHint: overrideLang ?? language,
          timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Python NLP analysis failed.');
      }
      const data = (await res.json()) as PythonNlpAnalysis;
      setSandboxResult(data);
      onRecordAnalysis(data);
      void refreshStatus();
    } catch (err: any) {
      setAnalyzeError(err?.message || 'Unable to run Python analyzer.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleComputeSlots = async () => {
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch('/api/python/suggest-slots', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          targetDate: slotDate,
          durationMinutes: slotDuration,
          timeZone,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Slot optimization failed.');
      }
      const data = (await res.json()) as PythonSlotResponse;
      setSlotResponse(data);
      void refreshStatus();
    } catch (err: any) {
      setSlotsError(err?.message || 'Unable to compute optimal slots.');
    } finally {
      setSlotsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Python Runtime Overview Strip */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Python AI &amp; Multilingual NLP Runtime
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Live Python inference worker for Indian regional intent classification, temporal entity parsing, and ergonomic slot optimization
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={statusLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Runtime</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="border-r border-slate-200 pr-4 last:border-r-0">
            <div className="text-xs text-slate-500">Python Runtime</div>
            <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {status?.pythonVersion ? `Python ${status.pythonVersion}` : 'Checking...'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {status?.status === 'ready'
                ? `Active · PID ${status.pid ?? '—'}`
                : 'Connecting'}
            </div>
          </div>

          <div className="border-r border-slate-200 pr-4 last:border-r-0">
            <div className="text-xs text-slate-500">Utterances Analyzed</div>
            <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {status?.totalUtterancesAnalyzed ?? 0}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Session inference count
            </div>
          </div>

          <div className="border-r border-slate-200 pr-4 last:border-r-0">
            <div className="text-xs text-slate-500">Avg Python Latency</div>
            <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {status ? `${status.averageLatencyMs.toFixed(2)} ms` : '0.00 ms'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Zero-overhead IPC worker
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Slot Optimizations</div>
            <div className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {status?.slotOptimizationsRun ?? 0}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Calendar conflict checks
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Interactive Multilingual Python NLP Sandbox */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-7">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Terminal className="h-4 w-4 text-blue-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Python Regional Intent &amp; Entity Parser
            </h3>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {SAMPLE_UTTERANCES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setSandboxText(sample.text);
                  void handleAnalyze(sample.text, sample.lang);
                }}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:bg-blue-50 hover:text-blue-800 whitespace-nowrap"
              >
                Test {sample.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAnalyze();
            }}
            className="mt-3 flex flex-col gap-2.5 sm:flex-row"
          >
            <input
              type="text"
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              placeholder="Enter any Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English scheduling command..."
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
            <button
              type="submit"
              disabled={analyzing || !sandboxText.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{analyzing ? 'Running...' : 'Run Python NLP'}</span>
            </button>
          </form>

          {analyzeError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {analyzeError}
            </p>
          )}

          {sandboxResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-900">
                  Intent: <span className="font-mono text-blue-700">{sandboxResult.intent}</span>
                </span>
                <span className="font-mono tabular-nums">
                  Confidence {(sandboxResult.confidence * 100).toFixed(0)}% · {sandboxResult.latencyMs} ms
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-slate-500 block">Language &amp; Script</span>
                  <span className="font-medium text-slate-900">
                    {sandboxResult.language} ({sandboxResult.script})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Resolved Date</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {sandboxResult.entities.resolvedDate || 'Unspecified'}
                    {sandboxResult.entities.dateLabel ? ` (${sandboxResult.entities.dateLabel})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Extracted Time</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {sandboxResult.entities.time24h || 'Unspecified'}
                    {sandboxResult.entities.dayPeriod ? ` · ${sandboxResult.entities.dayPeriod}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Duration</span>
                  <span className="font-mono text-slate-900 tabular-nums">
                    {sandboxResult.entities.durationMinutes} min
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Google Meet</span>
                  <span className="font-medium text-slate-900">
                    {sandboxResult.entities.wantsGoogleMeet ? 'Requested' : 'Optional'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Matched Cues</span>
                  <span className="font-mono text-slate-700 truncate block">
                    {sandboxResult.entities.matchedCues.length > 0
                      ? sandboxResult.entities.matchedCues.join(', ')
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Real Session Inference Log */}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-500">
              Live Session NLP Log
            </h4>
            {recentAnalyses.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Speak or send a message in Live Voice Desk or test an utterance above to record Python NLP inference metrics.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto border-t border-b border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-medium">Utterance</th>
                      <th className="py-2 pr-3 font-medium">Language</th>
                      <th className="py-2 pr-3 font-medium">Intent</th>
                      <th className="py-2 text-right font-medium">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentAnalyses.slice(0, 8).map((item, idx) => (
                      <tr key={`${item.text}-${idx}`} className="hover:bg-slate-50/70">
                        <td className="max-w-[220px] truncate py-2 pr-3 text-slate-900">
                          {item.text}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-600">
                          {item.language}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 font-mono text-blue-700">
                          {item.intent}
                        </td>
                        <td className="whitespace-nowrap py-2 text-right font-mono text-slate-600 tabular-nums">
                          {item.latencyMs} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Python Smart Slot Optimizer */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-5">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Cpu className="h-4 w-4 text-blue-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Python Slot Conflict &amp; Availability Optimizer
            </h3>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {isAuthenticated
              ? 'Queries your live Google Calendar free/busy intervals and ranks conflict-free slots in Python.'
              : 'Sign in with Google Calendar to check live busy windows, or run baseline workday optimization.'}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Target Date</label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Duration</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleComputeSlots()}
            disabled={slotsLoading}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{slotsLoading ? 'Optimizing with Python...' : 'Find Optimal Free Slots'}</span>
          </button>

          {slotsError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {slotsError}
            </p>
          )}

          {slotResponse && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Top {slotResponse.suggestions.length} of {slotResponse.totalFreeFound} open slots
                </span>
                <span className="font-mono tabular-nums">{slotResponse.latencyMs} ms</span>
              </div>

              {slotResponse.suggestions.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  No conflict-free slots available on {slotResponse.date}.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                  {slotResponse.suggestions.map((slot) => (
                    <div
                      key={slot.startIso}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {slot.label}
                        </div>
                        <div className="text-[11px] text-slate-500">{slot.rationale}</div>
                      </div>
                      <button
                        type="button"
                        disabled={!isAuthenticated}
                        onClick={() => onSelectSlotToBook(slot)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
                      >
                        <CalendarCheck className="h-3 w-3" />
                        <span>Book</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            <div className="font-semibold text-slate-900">Standalone FastAPI Mode (VS Code)</div>
            <p className="mt-1 leading-relaxed">
              Run the Python FastAPI backend directly on your workstation with{' '}
              <code className="font-mono text-[11px] text-slate-800">
                uvicorn python_backend.fastapi_server:app --port 8000
              </code>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
