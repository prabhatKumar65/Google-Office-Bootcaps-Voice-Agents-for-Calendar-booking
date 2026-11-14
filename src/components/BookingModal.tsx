import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { CalendarEventItem } from '../types/calendar';

interface BookingModalProps {
  isOpen: boolean;
  editingEvent: CalendarEventItem | null;
  timeZone: string;
  onClose: () => void;
  onSubmitNew: (payload: {
    summary: string;
    startDateTime: string;
    endDateTime: string;
    timeZone: string;
    location?: string;
    description?: string;
    attendees?: string[];
    addGoogleMeet?: boolean;
  }) => Promise<void>;
  onRequestUpdateConfirmation: (
    event: CalendarEventItem,
    proposed: {
      summary: string;
      startDateTime: string;
      endDateTime: string;
      location?: string;
    }
  ) => void;
}

function toLocalDateInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(iso?: string, addMinutes = 0): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  const adjusted = new Date(d.getTime() + addMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(adjusted.getHours())}:${pad(adjusted.getMinutes())}`;
}

function buildOffsetIso(dateStr: string, timeStr: string): string {
  const local = new Date(`${dateStr}T${timeStr}:00`);
  const offsetMin = -local.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  editingEvent,
  timeZone,
  onClose,
  onSubmitNew,
  onRequestUpdateConfirmation,
}) => {
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:30');
  const [location, setLocation] = useState('');
  const [attendeesText, setAttendeesText] = useState('');
  const [description, setDescription] = useState('');
  const [addMeet, setAddMeet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingEvent) {
      setSummary(editingEvent.summary || '');
      const sIso = editingEvent.start.dateTime || editingEvent.start.date;
      const eIso = editingEvent.end.dateTime || editingEvent.end.date;
      setDate(toLocalDateInput(sIso));
      setStartTime(toLocalTimeInput(sIso, 0));
      setEndTime(toLocalTimeInput(eIso || sIso, eIso ? 0 : 30));
      setLocation(editingEvent.location || '');
      setAttendeesText(
        (editingEvent.attendees || []).map((a) => a.email).join(', ')
      );
      setDescription(editingEvent.description || '');
      setAddMeet(false);
    } else {
      setSummary('');
      setDate(toLocalDateInput());
      setStartTime('11:00');
      setEndTime('11:30');
      setLocation('');
      setAttendeesText('');
      setDescription('');
      setAddMeet(true);
    }
  }, [isOpen, editingEvent]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Please enter an appointment title.');
      return;
    }

    const startDateTime = buildOffsetIso(date, startTime);
    const endDateTime = buildOffsetIso(date, endTime);
    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setError('End time must be after start time.');
      return;
    }

    if (editingEvent) {
      onRequestUpdateConfirmation(editingEvent, {
        summary: summary.trim(),
        startDateTime,
        endDateTime,
        location: location.trim() || undefined,
      });
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const attendees = attendeesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await onSubmitNew({
        summary: summary.trim(),
        startDateTime,
        endDateTime,
        timeZone,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        attendees: attendees.length > 0 ? attendees : undefined,
        addGoogleMeet: addMeet,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not create calendar event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {editingEvent ? 'Reschedule Appointment' : 'Book Calendar Appointment'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Appointment Title
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="e.g., Client Consultation or Product Demo"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Office, Clinic, or Video Call"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>

          {!editingEvent && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Guest Emails (Optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={attendeesText}
                  onChange={(e) => setAttendeesText(e.target.value)}
                  placeholder="client@example.com, team@example.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Agenda / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief agenda for the meeting..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={addMeet}
                  onChange={(e) => setAddMeet(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Attach Google Meet video conferencing link</span>
              </label>
            </>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting
                ? 'Booking...'
                : editingEvent
                  ? 'Review Reschedule'
                  : 'Book Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
