import React from 'react';
import {
  Calendar,
  CalendarPlus,
  ExternalLink,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import type { CalendarEventItem } from '../types/calendar';
import { GoogleSignInButton } from './GoogleSignInButton';

export type DateRangeFilter = 'today' | 'tomorrow' | 'week';

interface CalendarPanelProps {
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  authError?: {
    message: string;
    suggestNewTab?: boolean;
    suggestRedirect?: boolean;
  } | null;
  onLogin: () => void;
  onRedirectLogin: () => void;
  events: CalendarEventItem[];
  loading: boolean;
  error: string | null;
  timeZone: string;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onRefresh: () => void;
  onNewBooking: () => void;
  onEditEvent: (event: CalendarEventItem) => void;
  onCancelEvent: (event: CalendarEventItem) => void;
}

function formatEventTime(
  event: CalendarEventItem,
  timeZone: string
): { dateLabel: string; timeRange: string } {
  const startRaw = event.start.dateTime || event.start.date;
  const endRaw = event.end.dateTime || event.end.date;
  if (!startRaw) return { dateLabel: '—', timeRange: 'All day' };

  if (!event.start.dateTime) {
    const d = new Date(`${startRaw}T00:00:00`);
    const dateLabel = new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
    return { dateLabel, timeRange: 'All day' };
  }

  const start = new Date(startRaw);
  const end = endRaw ? new Date(endRaw) : null;

  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(start);

  const fmtTime = (d: Date) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

  return {
    dateLabel,
    timeRange: end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start),
  };
}

export const CalendarPanel: React.FC<CalendarPanelProps> = ({
  isAuthenticated,
  isLoggingIn,
  authError,
  onLogin,
  onRedirectLogin,
  events,
  loading,
  error,
  timeZone,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchQueryChange,
  onRefresh,
  onNewBooking,
  onEditEvent,
  onCancelEvent,
}) => {
  const filtered = events.filter((ev) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (ev.summary || '').toLowerCase().includes(q) ||
      (ev.location || '').toLowerCase().includes(q) ||
      (ev.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <section className="flex min-h-[540px] flex-col rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Google Calendar Schedule
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span>Primary Calendar</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{timeZone}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={!isAuthenticated || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={onNewBooking}
            disabled={!isAuthenticated}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'tomorrow', label: 'Tomorrow' },
              { id: 'week', label: 'Next 7 Days' },
            ] as { id: DateRangeFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onDateRangeChange(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                dateRange === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filter events..."
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {!isAuthenticated ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              Connect Google Calendar
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
              Sign in with your Google account to view live availability, sync voice bookings, and manage appointments.
            </p>
            <div className="mt-5 w-60">
              <GoogleSignInButton onClick={onLogin} disabled={isLoggingIn} />
            </div>
            {authError && (
              <div
                role="alert"
                className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-xs leading-relaxed text-red-700 space-y-1.5"
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
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-medium">Unable to load Google Calendar</div>
            <p className="mt-1 text-xs">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Retry Sync
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-3" aria-label="Loading calendar events">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="flex animate-pulse items-center justify-between gap-4 rounded-lg border border-slate-200 p-3.5"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 rounded bg-slate-200" />
                  <div className="h-3 w-32 rounded bg-slate-100" />
                </div>
                <div className="h-8 w-20 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-700">
              {searchQuery
                ? 'No matching events in this range'
                : 'No scheduled events in this window'}
            </p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Speak to the voice agent in Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English to book a slot, or create one manually.
            </p>
            <button
              type="button"
              onClick={onNewBooking}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Book First Appointment</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
            {filtered.map((event) => {
              const { dateLabel, timeRange } = formatEventTime(event, timeZone);
              const attendeeCount = event.attendees?.length || 0;
              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 py-3.5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between px-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{dateLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {timeRange}
                      </span>
                    </div>

                    <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {event.summary || '(Untitled event)'}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {event.location && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </span>
                      )}
                      {attendeeCount > 0 && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Users className="h-3 w-3 shrink-0" />
                          <span>
                            {attendeeCount} {attendeeCount === 1 ? 'guest' : 'guests'}
                          </span>
                        </span>
                      )}
                      {event.hangoutLink && (
                        <a
                          href={event.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                        >
                          <Video className="h-3 w-3 shrink-0" />
                          <span>Google Meet</span>
                        </a>
                      )}
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span>Open</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditEvent(event)}
                      title="Reschedule event"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancelEvent(event)}
                      title="Cancel event"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 whitespace-nowrap"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
