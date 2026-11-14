import React from 'react';
import { AlertTriangle, CalendarCheck, CalendarX, Clock } from 'lucide-react';
import type { PendingConfirmation } from '../types/calendar';

interface ConfirmationModalProps {
  confirmation: PendingConfirmation | null;
  timeZone: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatDateTimeRange(
  startIso: string | undefined,
  endIso: string | undefined,
  timeZone: string
): string {
  if (!startIso) return 'Not specified';
  try {
    const start = new Date(startIso);
    const datePart = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(start);
    const startTime = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(start);

    if (!endIso) return `${datePart}, ${startTime}`;
    const end = new Date(endIso);
    const endTime = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(end);
    return `${datePart} · ${startTime} – ${endTime}`;
  } catch {
    return startIso;
  }
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  confirmation,
  timeZone,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => {
  if (!confirmation) return null;

  const isCancel = confirmation.operation === 'cancel';
  const isReschedule = confirmation.operation === 'reschedule';

  const titleText = isCancel
    ? 'Confirm Event Cancellation'
    : isReschedule
      ? 'Confirm Event Reschedule'
      : 'Confirm New Calendar Booking';

  const descriptionText = isCancel
    ? 'This will permanently delete the event from your Google Calendar.'
    : isReschedule
      ? 'Review the updated schedule below before modifying your Google Calendar.'
      : 'Review the appointment details before adding this event to your Google Calendar.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isCancel
                ? 'bg-red-50 text-red-600'
                : isReschedule
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isCancel ? (
              <CalendarX className="h-5 w-5" />
            ) : isReschedule ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <CalendarCheck className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {titleText}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{descriptionText}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-500">Event Title</div>
            <div className="mt-0.5 font-semibold text-slate-900">
              {confirmation.proposedSummary || confirmation.title}
            </div>
          </div>

          {confirmation.currentStart && (
            <div>
              <div className="text-xs font-medium text-slate-500">
                {isReschedule ? 'Current Time' : 'Scheduled Time'}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-700 tabular-nums">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  {formatDateTimeRange(
                    confirmation.currentStart,
                    confirmation.currentEnd,
                    timeZone
                  )}
                </span>
              </div>
            </div>
          )}

          {confirmation.proposedStart && (
            <div>
              <div className="text-xs font-medium text-slate-500">
                {isReschedule ? 'New Proposed Time' : 'Appointment Time'}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-medium text-blue-700 tabular-nums">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  {formatDateTimeRange(
                    confirmation.proposedStart,
                    confirmation.proposedEnd,
                    timeZone
                  )}
                </span>
              </div>
            </div>
          )}

          {confirmation.proposedLocation && (
            <div>
              <div className="text-xs font-medium text-slate-500">Location</div>
              <div className="mt-0.5 text-slate-800">{confirmation.proposedLocation}</div>
            </div>
          )}

          {confirmation.attendees && confirmation.attendees.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500">Attendees</div>
              <div className="mt-0.5 text-slate-800">
                {confirmation.attendees.join(', ')}
              </div>
            </div>
          )}

          {confirmation.reason && (
            <div>
              <div className="text-xs font-medium text-slate-500">Note</div>
              <div className="mt-0.5 text-slate-700">{confirmation.reason}</div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
              isCancel
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {isSubmitting
              ? 'Syncing...'
              : isCancel
                ? 'Confirm Cancellation'
                : isReschedule
                  ? 'Confirm Reschedule'
                  : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  );
};
