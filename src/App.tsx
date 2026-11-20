import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AgentSettingsPanel } from './components/AgentSettingsPanel';
import { BookingModal } from './components/BookingModal';
import { CalendarPanel, type DateRangeFilter } from './components/CalendarPanel';
import { ConfirmationModal } from './components/ConfirmationModal';
import { PythonPipelinePanel } from './components/PythonPipelinePanel';
import { Sidebar } from './components/Sidebar';
import { SpeakingAgentStage } from './components/SpeakingAgentStage';
import { VoiceAgentConsole } from './components/VoiceAgentConsole';
import { VoiceAudioEngine } from './lib/audioEngine';
import {
  type AuthUser,
  clearAccessToken,
  formatFirebaseAuthError,
  getAccessToken,
  googleSignIn,
  googleSignInRedirect,
  initAuth,
  logout,
} from './lib/firebaseAuth';
import type {
  AgentConnectionState,
  CalendarEventItem,
  LanguageCode,
  PendingConfirmation,
  PortalView,
  PythonNlpAnalysis,
  PythonSlotSuggestion,
  TranscriptEntry,
  VadActivityState,
  VadSensitivity,
  VoiceName,
} from './types/calendar';

const AVATAR_STORAGE_KEY = 'prabhat_agent_custom_avatar';

function nowTimeLabel(): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

function getDateWindow(range: DateRangeFilter): { timeMin: string; timeMax: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (range === 'today') {
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (range === 'tomorrow') {
    const tStart = new Date(start);
    tStart.setDate(tStart.getDate() + 1);
    const tEnd = new Date(tStart);
    tEnd.setHours(23, 59, 59, 999);
    return { timeMin: tStart.toISOString(), timeMax: tEnd.toISOString() };
  }
  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: weekEnd.toISOString() };
}

function loadSavedAvatar(): string | null {
  try {
    return window.localStorage.getItem(AVATAR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const browserTz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  // Portal Navigation & Custom Agent PNG
  const [activeView, setActiveView] = useState<PortalView>('voice-desk');
  const [customAvatar, setCustomAvatar] = useState<string | null>(() => loadSavedAvatar());

  // Auth & Calendar state
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<{
    message: string;
    suggestNewTab?: boolean;
    suggestRedirect?: boolean;
  } | null>(null);
  const [calendarTimeZone, setCalendarTimeZone] = useState<string>(browserTz);

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('week');
  const [searchQuery, setSearchQuery] = useState('');

  // Voice AI, VAD & Python NLP state
  const [language, setLanguage] = useState<LanguageCode>('auto');
  const [voiceName, setVoiceName] = useState<VoiceName>('Zephyr');
  const [vadSensitivity, setVadSensitivity] = useState<VadSensitivity>('balanced');
  const [bargeInEnabled, setBargeInEnabled] = useState(true);
  const [noiseGateEnabled, setNoiseGateEnabled] = useState(false);
  const [requireBookConfirm, setRequireBookConfirm] = useState(false);

  const [connectionState, setConnectionState] =
    useState<AgentConnectionState>('disconnected');
  const [vadState, setVadState] = useState<VadActivityState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [nlpHistory, setNlpHistory] = useState<PythonNlpAnalysis[]>([]);

  // Modals
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(
    null
  );
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [prefillSlot, setPrefillSlot] = useState<PythonSlotSuggestion | null>(null);

  // Refs to prevent stale closures inside WebSocket & AudioWorklet callbacks
  const wsRef = useRef<WebSocket | null>(null);
  const audioEngineRef = useRef<VoiceAudioEngine | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isSessionReadyRef = useRef(false);
  const activeUserBubbleIdRef = useRef<string | null>(null);
  const activeAgentBubbleIdRef = useRef<string | null>(null);
  const pendingTextQueueRef = useRef<string[]>([]);
  const isAgentSpeakingRef = useRef(false);
  const isToolRunningRef = useRef(false);

  const getDbLevel = useCallback(() => {
    return audioEngineRef.current?.getCurrentDbLevel() ?? -60;
  }, []);

  const handleCustomAvatarChange = (dataUrl: string | null) => {
    setCustomAvatar(dataUrl);
    try {
      if (dataUrl) {
        window.localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
      } else {
        window.localStorage.removeItem(AVATAR_STORAGE_KEY);
      }
    } catch {
      // Non-fatal if storage quota is reached
    }
  };

  useEffect(() => {
    tokenRef.current = accessToken;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_token', accessToken }));
    }
  }, [accessToken]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'update_settings', requireBookConfirm })
      );
    }
  }, [requireBookConfirm]);

  useEffect(() => {
    audioEngineRef.current?.updateOptions({
      sensitivity: vadSensitivity,
      bargeInEnabled,
      noiseGateEnabled,
    });
  }, [vadSensitivity, bargeInEnabled, noiseGateEnabled]);

  const fetchCalendarData = useCallback(
    async (overrideToken?: string | null) => {
      const tok = overrideToken ?? tokenRef.current ?? getAccessToken();
      if (!tok) return;

      setEventsLoading(true);
      setEventsError(null);
      try {
        const { timeMin, timeMax } = getDateWindow(dateRange);
        const [profileRes, eventsRes] = await Promise.all([
          fetch('/api/calendar/profile', {
            headers: { Authorization: `Bearer ${tok}` },
          }),
          fetch(
            `/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
            {
              headers: { Authorization: `Bearer ${tok}` },
            }
          ),
        ]);

        if (profileRes.status === 401 || eventsRes.status === 401) {
          clearAccessToken();
          setAccessToken(null);
          setNeedsAuth(true);
          setEventsError('Your Google Calendar session expired. Please sign in again.');
          return;
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile?.timeZone) {
            setCalendarTimeZone(profile.timeZone);
          }
          if (profile?.id || profile?.summary) {
            setUser((prev) => ({
              email: prev?.email || (typeof profile.id === 'string' ? profile.id : null),
              displayName:
                prev?.displayName && prev.displayName !== 'Google Calendar'
                  ? prev.displayName
                  : typeof profile.summary === 'string' && profile.summary !== profile.id
                    ? profile.summary
                    : prev?.displayName || 'Google Calendar',
            }));
          }
        }

        if (!eventsRes.ok) {
          const errBody = await eventsRes.json().catch(() => ({}));
          throw new Error(errBody?.error || 'Failed to load calendar events.');
        }

        const data = await eventsRes.json();
        setEvents(data.items ?? []);
      } catch (err: any) {
        setEventsError(err?.message || 'Unable to sync Google Calendar.');
      } finally {
        setEventsLoading(false);
      }
    },
    [dateRange]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (signedUser, tok) => {
        setUser(signedUser);
        setAccessToken(tok);
        setNeedsAuth(false);
      },
      () => {
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (accessToken && !needsAuth) {
      void fetchCalendarData(accessToken);
    }
  }, [accessToken, needsAuth, dateRange, fetchCalendarData]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    setEventsError(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setAccessToken(res.accessToken);
      setNeedsAuth(false);
      void fetchCalendarData(res.accessToken);
    } catch (err: any) {
      const formatted = formatFirebaseAuthError(err);
      setAuthError({
        message: formatted.message,
        suggestNewTab: formatted.suggestNewTab,
        suggestRedirect: formatted.suggestRedirect,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRedirectLogin = async () => {
    setAuthError(null);
    try {
      await googleSignInRedirect();
    } catch (err: any) {
      const formatted = formatFirebaseAuthError(err);
      setAuthError({
        message: formatted.message,
        suggestNewTab: formatted.suggestNewTab,
        suggestRedirect: formatted.suggestRedirect,
      });
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setEvents([]);
  };

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscripts((prev) => [...prev, entry]);
  }, []);

  const recordPythonAnalysis = useCallback((analysis: PythonNlpAnalysis) => {
    setNlpHistory((prev) => [analysis, ...prev].slice(0, 50));
    setTranscripts((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'user' && !prev[i].nlpAnalysis) {
          const next = [...prev];
          next[i] = { ...next[i], nlpAnalysis: analysis };
          return next;
        }
      }
      return prev;
    });
  }, []);

  const upsertStreamBubble = useCallback(
    (role: 'user' | 'agent', chunk: string, interim = false) => {
      const ref =
        role === 'user' ? activeUserBubbleIdRef : activeAgentBubbleIdRef;
      const otherRef =
        role === 'user' ? activeAgentBubbleIdRef : activeUserBubbleIdRef;
      otherRef.current = null;

      if (!chunk) return;

      setTranscripts((prev) => {
        const existingId = ref.current;
        if (existingId) {
          const idx = prev.findIndex((t) => t.id === existingId);
          if (idx !== -1) {
            const updated = [...prev];
            const current = updated[idx];
            updated[idx] = {
              ...current,
              text: interim ? chunk : `${current.text}${chunk}`,
              interim,
            };
            return updated;
          }
        }
        const newId = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        ref.current = newId;
        return [
          ...prev,
          {
            id: newId,
            role,
            text: chunk,
            interim,
            timestamp: nowTimeLabel(),
          },
        ];
      });
    },
    []
  );

  const stopVoiceSession = useCallback(async () => {
    isSessionReadyRef.current = false;
    pendingTextQueueRef.current = [];
    activeUserBubbleIdRef.current = null;
    activeAgentBubbleIdRef.current = null;
    isAgentSpeakingRef.current = false;
    isToolRunningRef.current = false;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }

    if (audioEngineRef.current) {
      await audioEngineRef.current.stop();
      audioEngineRef.current = null;
    }

    setConnectionState('disconnected');
    setVadState('idle');
    setIsMuted(false);
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (
      connectionState === 'connecting' ||
      connectionState === 'connected'
    ) {
      return;
    }

    setVoiceError(null);
    setConnectionState('connecting');
    setIsMuted(false);

    const engine = new VoiceAudioEngine(
      {
        onAudioChunk: (base64Pcm16k) => {
          const sock = wsRef.current;
          // Only stream after Gemini Live setup completes and avoid WebSocket backlog during network dips
          if (
            isSessionReadyRef.current &&
            sock &&
            sock.readyState === WebSocket.OPEN &&
            sock.bufferedAmount < 65536
          ) {
            sock.send(JSON.stringify({ type: 'audio', data: base64Pcm16k }));
          }
        },
        onVadChange: (speaking) => {
          if (!isAgentSpeakingRef.current && !isToolRunningRef.current) {
            setVadState((prev) => {
              const next: VadActivityState = speaking ? 'speech' : 'listening';
              return prev === next ? prev : next;
            });
          }
        },
        onBargeIn: () => {
          activeAgentBubbleIdRef.current = null;
          isAgentSpeakingRef.current = false;
          setVadState('speech');
        },
        onOutputStateChange: (playing) => {
          isAgentSpeakingRef.current = playing;
          if (!isToolRunningRef.current) {
            setVadState(playing ? 'agent_speaking' : 'listening');
          }
        },
      },
      {
        sensitivity: vadSensitivity,
        bargeInEnabled,
        noiseGateEnabled,
      }
    );

    audioEngineRef.current = engine;

    try {
      await engine.start();
    } catch (err: any) {
      await engine.stop();
      audioEngineRef.current = null;
      setConnectionState('error');
      setVoiceError(
        err?.message ||
          'Microphone permission is required for live voice interaction.'
      );
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'init',
          accessToken: tokenRef.current,
          timeZone: calendarTimeZone,
          language,
          voiceName,
          vadSensitivity,
          bargeIn: bargeInEnabled,
          requireBookConfirm,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'ready') {
          isSessionReadyRef.current = true;
          setConnectionState('connected');
          setVadState('listening');
          appendTranscript({
            id: `sys-${Date.now()}`,
            role: 'system',
            text: 'Voice session connected. Speak in Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English.',
            timestamp: nowTimeLabel(),
          });

          while (pendingTextQueueRef.current.length > 0) {
            const text = pendingTextQueueRef.current.shift()!;
            ws.send(JSON.stringify({ type: 'text', text }));
            appendTranscript({
              id: `user-txt-${Date.now()}`,
              role: 'user',
              text,
              timestamp: nowTimeLabel(),
            });
          }
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          audioEngineRef.current?.playOutputChunk(msg.data);
          return;
        }

        if (msg.type === 'python_nlp' && msg.analysis) {
          recordPythonAnalysis(msg.analysis as PythonNlpAnalysis);
          return;
        }

        if (msg.type === 'interim_input_transcript' && msg.text) {
          upsertStreamBubble('user', msg.text, true);
          return;
        }

        if (msg.type === 'input_transcript' && msg.text) {
          setTranscripts((prev) => {
            const existingId = activeUserBubbleIdRef.current;
            if (existingId) {
              const idx = prev.findIndex((t) => t.id === existingId);
              if (idx !== -1 && prev[idx].interim) {
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  text: msg.text,
                  interim: false,
                };
                return updated;
              }
            }
            return prev;
          });
          if (!activeUserBubbleIdRef.current) {
            upsertStreamBubble('user', msg.text, false);
          } else {
            setTranscripts((prev) => {
              const existingId = activeUserBubbleIdRef.current;
              const idx = prev.findIndex((t) => t.id === existingId);
              if (idx !== -1 && prev[idx].text !== msg.text && !prev[idx].interim) {
                const updated = [...prev];
                updated[idx] = {
                  ...updated[idx],
                  text: `${updated[idx].text}${msg.text}`,
                };
                return updated;
              }
              return prev;
            });
          }
          return;
        }

        if (msg.type === 'output_transcript' && msg.text) {
          activeUserBubbleIdRef.current = null;
          upsertStreamBubble('agent', msg.text, false);
          return;
        }

        if (msg.type === 'interrupted') {
          audioEngineRef.current?.stopOutputPlayback();
          activeAgentBubbleIdRef.current = null;
          isAgentSpeakingRef.current = false;
          setVadState('listening');
          return;
        }

        if (msg.type === 'turn_complete') {
          activeUserBubbleIdRef.current = null;
          activeAgentBubbleIdRef.current = null;
          return;
        }

        if (msg.type === 'tool_event') {
          if (msg.status === 'running') {
            isToolRunningRef.current = true;
            setVadState('tool_running');
            const summaryMeta =
              msg.args?.summary || msg.args?.eventId || undefined;
            appendTranscript({
              id: `tool-${msg.id}`,
              role: 'tool',
              text: msg.name,
              toolName: msg.name,
              toolStatus: 'running',
              meta: summaryMeta ? String(summaryMeta) : undefined,
              timestamp: nowTimeLabel(),
            });
          } else {
            isToolRunningRef.current = false;
            setVadState(
              isAgentSpeakingRef.current ? 'agent_speaking' : 'listening'
            );
            setTranscripts((prev) =>
              prev.map((item) =>
                item.id === `tool-${msg.id}`
                  ? {
                      ...item,
                      toolStatus: msg.status,
                      meta:
                        msg.result?.summary ||
                        (typeof msg.result?.count === 'number'
                          ? `${msg.result.count} events`
                          : msg.result?.isAvailable === true
                            ? 'Slot free'
                            : msg.result?.isAvailable === false
                              ? 'Conflict detected'
                              : item.meta),
                    }
                  : item
              )
            );
          }
          return;
        }

        if (msg.type === 'confirmation_required' && msg.confirmation) {
          setPendingConfirm(msg.confirmation as PendingConfirmation);
          return;
        }

        if (msg.type === 'confirmation_cancelled') {
          setPendingConfirm((curr) => (curr?.id === msg.id ? null : curr));
          return;
        }

        if (msg.type === 'calendar_updated') {
          void fetchCalendarData();
          return;
        }

        if (msg.type === 'error') {
          setVoiceError(msg.message || 'Voice AI session encountered an error.');
          if (audioEngineRef.current) {
            void audioEngineRef.current.stop();
            audioEngineRef.current = null;
          }
          setConnectionState('error');
          setVadState('idle');
          return;
        }

        if (msg.type === 'session_closed') {
          void stopVoiceSession();
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      setVoiceError('WebSocket connection to voice pipeline failed.');
      void stopVoiceSession();
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        void stopVoiceSession();
      }
    };
  }, [
    connectionState,
    vadSensitivity,
    bargeInEnabled,
    noiseGateEnabled,
    calendarTimeZone,
    language,
    voiceName,
    requireBookConfirm,
    appendTranscript,
    recordPythonAnalysis,
    upsertStreamBubble,
    fetchCalendarData,
    stopVoiceSession,
  ]);

  useEffect(() => {
    return () => {
      void stopVoiceSession();
    };
  }, [stopVoiceSession]);

  const handleRestartSession = async () => {
    await stopVoiceSession();
    setTimeout(() => {
      void startVoiceSession();
    }, 120);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngineRef.current?.setMuted(next);
  };

  const handleManualInterrupt = () => {
    audioEngineRef.current?.stopOutputPlayback();
    activeAgentBubbleIdRef.current = null;
    isAgentSpeakingRef.current = false;
    setVadState('listening');
  };

  const handleSendText = (text: string) => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      connectionState === 'connected'
    ) {
      activeAgentBubbleIdRef.current = null;
      activeUserBubbleIdRef.current = null;
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
      appendTranscript({
        id: `user-txt-${Date.now()}`,
        role: 'user',
        text,
        timestamp: nowTimeLabel(),
      });
    } else {
      pendingTextQueueRef.current.push(text);
      void startVoiceSession();
    }
  };

  const handleCreateManualEvent = async (payload: {
    summary: string;
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
    location?: string;
    description?: string;
    attendees?: string[];
    addGoogleMeet?: boolean;
  }) => {
    const tok = tokenRef.current ?? getAccessToken();
    if (!tok) throw new Error('Please sign in with Google Calendar first.');
    const res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to book event.');
    }
    await fetchCalendarData(tok);
  };

  const handleConfirmMutation = async () => {
    if (!pendingConfirm) return;

    if (pendingConfirm.source === 'voice') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'tool_confirmation',
            id: pendingConfirm.id,
            approved: true,
          })
        );
      }
      setPendingConfirm(null);
      return;
    }

    const tok = tokenRef.current ?? getAccessToken();
    if (!tok || !pendingConfirm.eventId) {
      setPendingConfirm(null);
      return;
    }

    setIsConfirmSubmitting(true);
    try {
      if (pendingConfirm.operation === 'cancel') {
        const res = await fetch(
          `/api/calendar/events/${encodeURIComponent(pendingConfirm.eventId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tok}` },
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to cancel event.');
        }
      } else if (pendingConfirm.operation === 'reschedule') {
        const res = await fetch(
          `/api/calendar/events/${encodeURIComponent(pendingConfirm.eventId)}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${tok}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary: pendingConfirm.proposedSummary,
              startDateTime: pendingConfirm.proposedStart,
              endDateTime: pendingConfirm.proposedEnd,
              timeZone: calendarTimeZone,
              location: pendingConfirm.proposedLocation,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to reschedule event.');
        }
      }
      setPendingConfirm(null);
      await fetchCalendarData(tok);
    } catch (err: any) {
      setEventsError(err?.message || 'Calendar update failed.');
      setPendingConfirm(null);
    } finally {
      setIsConfirmSubmitting(false);
    }
  };

  const handleDeclineMutation = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.source === 'voice') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'tool_confirmation',
            id: pendingConfirm.id,
            approved: false,
          })
        );
      }
    }
    setPendingConfirm(null);
  };

  const latestAgentCaption = (() => {
    for (let i = transcripts.length - 1; i >= 0; i--) {
      if (transcripts[i].role === 'agent' && transcripts[i].text.trim()) {
        return transcripts[i].text.trim();
      }
    }
    return null;
  })();

  const viewBreadcrumb =
    activeView === 'voice-desk'
      ? 'Enterprise Portal / Live Voice Desk'
      : activeView === 'python-pipeline'
        ? 'Enterprise Portal / Python NLP & Pipeline'
        : 'Enterprise Portal / Voice & Agent Settings';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 lg:flex-row">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        customAvatar={customAvatar}
        user={user}
        needsAuth={needsAuth}
        isLoggingIn={isLoggingIn}
        authError={authError}
        calendarTimeZone={calendarTimeZone}
        onLogin={handleLogin}
        onRedirectLogin={handleRedirectLogin}
        onLogout={handleLogout}
        language={language}
        onLanguageChange={setLanguage}
        voiceName={voiceName}
        vadSensitivity={vadSensitivity}
        connectionState={connectionState}
        vadState={vadState}
        onRestartSession={handleRestartSession}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Enterprise Header */}
        <header className="flex h-16 items-center justify-between gap-8 border-b border-slate-200 bg-white px-6">
          <span className="truncate text-sm font-medium text-slate-600">
            {viewBreadcrumb}
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
              {needsAuth ? 'Calendar disconnected' : 'Google Calendar synced'}
            </span>
          </div>
        </header>

        {/* Main Enterprise Portal Viewport */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-5 lg:p-6">
          {activeView === 'voice-desk' && (
            <div className="space-y-6">
              {/* Main Center-Top Speaking AI Agent Stage */}
              <SpeakingAgentStage
                customAvatar={customAvatar}
                connectionState={connectionState}
                vadState={vadState}
                isMuted={isMuted}
                language={language}
                inputAnalyser={audioEngineRef.current?.getInputAnalyser() ?? null}
                outputAnalyser={
                  audioEngineRef.current?.getOutputAnalyser() ?? null
                }
                latestAgentCaption={latestAgentCaption}
                onStartSession={startVoiceSession}
                onStopSession={stopVoiceSession}
                onToggleMute={handleToggleMute}
                onManualInterrupt={handleManualInterrupt}
                onOpenAvatarSettings={() => setActiveView('agent-settings')}
              />

              <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
                <div className="xl:col-span-7 flex flex-col">
                  <VoiceAgentConsole
                    customAvatar={customAvatar}
                    onOpenAvatarSettings={() => setActiveView('agent-settings')}
                    connectionState={connectionState}
                    vadState={vadState}
                    getDbLevel={getDbLevel}
                    isMuted={isMuted}
                    language={language}
                    inputAnalyser={audioEngineRef.current?.getInputAnalyser() ?? null}
                    outputAnalyser={
                      audioEngineRef.current?.getOutputAnalyser() ?? null
                    }
                    transcripts={transcripts}
                    errorMessage={voiceError}
                    onStartSession={startVoiceSession}
                    onStopSession={stopVoiceSession}
                    onToggleMute={handleToggleMute}
                    onManualInterrupt={handleManualInterrupt}
                    onSendText={handleSendText}
                    onClearTranscript={() => setTranscripts([])}
                  />
                </div>

                <div className="xl:col-span-5 flex flex-col">
                  <CalendarPanel
                    isAuthenticated={!needsAuth && Boolean(accessToken)}
                    isLoggingIn={isLoggingIn}
                    authError={authError}
                    onLogin={handleLogin}
                    onRedirectLogin={handleRedirectLogin}
                    events={events}
                    loading={eventsLoading}
                    error={eventsError}
                    timeZone={calendarTimeZone}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    onRefresh={() => void fetchCalendarData()}
                    onNewBooking={() => {
                      setEditingEvent(null);
                      setPrefillSlot(null);
                      setBookingModalOpen(true);
                    }}
                    onEditEvent={(ev) => {
                      setEditingEvent(ev);
                      setPrefillSlot(null);
                      setBookingModalOpen(true);
                    }}
                    onCancelEvent={(ev) => {
                      setPendingConfirm({
                        id: `ui-cancel-${ev.id}`,
                        source: 'ui',
                        operation: 'cancel',
                        eventId: ev.id,
                        title: ev.summary || '(Untitled event)',
                        currentStart: ev.start.dateTime || ev.start.date,
                        currentEnd: ev.end.dateTime || ev.end.date,
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === 'python-pipeline' && (
            <PythonPipelinePanel
              timeZone={calendarTimeZone}
              language={language}
              isAuthenticated={!needsAuth && Boolean(accessToken)}
              accessToken={accessToken}
              recentAnalyses={nlpHistory}
              onRecordAnalysis={recordPythonAnalysis}
              onSelectSlotToBook={(slot) => {
                setEditingEvent(null);
                setPrefillSlot(slot);
                setBookingModalOpen(true);
              }}
            />
          )}

          {activeView === 'agent-settings' && (
            <AgentSettingsPanel
              customAvatar={customAvatar}
              onCustomAvatarChange={handleCustomAvatarChange}
              language={language}
              onLanguageChange={setLanguage}
              voiceName={voiceName}
              onVoiceChange={setVoiceName}
              vadSensitivity={vadSensitivity}
              onVadSensitivityChange={setVadSensitivity}
              bargeInEnabled={bargeInEnabled}
              onBargeInChange={setBargeInEnabled}
              noiseGateEnabled={noiseGateEnabled}
              onNoiseGateChange={setNoiseGateEnabled}
              requireBookConfirm={requireBookConfirm}
              onRequireBookConfirmChange={setRequireBookConfirm}
              connectionState={connectionState}
              onRestartSession={handleRestartSession}
            />
          )}
        </main>
      </div>

      <BookingModal
        isOpen={bookingModalOpen}
        editingEvent={editingEvent}
        prefillSlot={prefillSlot}
        timeZone={calendarTimeZone}
        onClose={() => {
          setBookingModalOpen(false);
          setEditingEvent(null);
          setPrefillSlot(null);
        }}
        onSubmitNew={handleCreateManualEvent}
        onRequestUpdateConfirmation={(ev, proposed) => {
          setPendingConfirm({
            id: `ui-reschedule-${ev.id}`,
            source: 'ui',
            operation: 'reschedule',
            eventId: ev.id,
            title: ev.summary || '(Untitled event)',
            currentStart: ev.start.dateTime || ev.start.date,
            currentEnd: ev.end.dateTime || ev.end.date,
            proposedSummary: proposed.summary,
            proposedStart: proposed.startDateTime,
            proposedEnd: proposed.endDateTime,
            proposedLocation: proposed.location,
          });
        }}
      />

      <ConfirmationModal
        confirmation={pendingConfirm}
        timeZone={calendarTimeZone}
        isSubmitting={isConfirmSubmitting}
        onConfirm={() => void handleConfirmMutation()}
        onCancel={handleDeclineMutation}
      />
    </div>
  );
}
