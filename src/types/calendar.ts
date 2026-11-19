export type LanguageCode =
  | 'auto'
  | 'hi'
  | 'bho'
  | 'ta'
  | 'mr'
  | 'te'
  | 'en';

export type VoiceName = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';

export type VadSensitivity = 'low' | 'balanced' | 'high';

export type AgentConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type VadActivityState = 'idle' | 'listening' | 'speech' | 'agent_speaking' | 'tool_running';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  hint: string;
  samples: {
    phrase: string;
    translation: string;
  }[];
}

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
}

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: CalendarEventAttendee[];
}

export interface CalendarProfile {
  id: string;
  summary: string;
  timeZone: string;
}

export type PortalView = 'voice-desk' | 'python-pipeline' | 'agent-settings';

export interface PythonNlpAnalysis {
  text: string;
  intent: string;
  confidence: number;
  language: string;
  languageCode: string;
  script: string;
  entities: {
    resolvedDate: string | null;
    dateLabel: string | null;
    dayPeriod: string | null;
    time24h: string | null;
    durationMinutes: number;
    wantsGoogleMeet: boolean;
    matchedCues: string[];
  };
  latencyMs: number;
}

export interface PythonSlotSuggestion {
  startIso: string;
  endIso: string;
  label: string;
  rationale: string;
  rank: number;
}

export interface PythonSlotResponse {
  date: string;
  timeZone: string;
  durationMinutes: number;
  suggestions: PythonSlotSuggestion[];
  totalFreeFound: number;
  latencyMs: number;
}

export interface PythonEngineStatus {
  status: string;
  pythonVersion: string;
  pid: number | null;
  uptimeSeconds: number;
  totalUtterancesAnalyzed: number;
  averageLatencyMs: number;
  slotOptimizationsRun: number;
  intentCounts: Record<string, number>;
  languageCounts: Record<string, number>;
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'agent' | 'tool' | 'system';
  text: string;
  interim?: boolean;
  timestamp: string;
  toolName?: string;
  toolStatus?: 'running' | 'completed' | 'cancelled' | 'error';
  meta?: string;
  nlpAnalysis?: PythonNlpAnalysis;
}

export interface PendingConfirmation {
  id: string;
  source: 'voice' | 'ui';
  operation: 'reschedule' | 'cancel' | 'book';
  eventId?: string;
  title: string;
  currentStart?: string;
  currentEnd?: string;
  proposedStart?: string;
  proposedEnd?: string;
  proposedSummary?: string;
  proposedLocation?: string;
  proposedDescription?: string;
  attendees?: string[];
  reason?: string;
}
