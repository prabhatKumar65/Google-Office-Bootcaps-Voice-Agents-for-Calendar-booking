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

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'agent' | 'tool' | 'system';
  text: string;
  interim?: boolean;
  timestamp: string;
  toolName?: string;
  toolStatus?: 'running' | 'completed' | 'cancelled' | 'error';
  meta?: string;
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
