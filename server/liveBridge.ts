import {
  ActivityHandling,
  EndSensitivity,
  Modality,
  StartSensitivity,
  Type,
  type FunctionDeclaration,
  type LiveServerMessage,
} from '@google/genai';
import type { WebSocket } from 'ws';
import {
  checkCalendarFreeBusy,
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from './calendarApi.ts';
import { getGeminiLiveClient } from './geminiClient.ts';

interface InitPayload {
  type: 'init';
  accessToken: string | null;
  timeZone: string;
  language: string;
  voiceName: string;
  vadSensitivity: 'low' | 'balanced' | 'high';
  bargeIn: boolean;
  requireBookConfirm?: boolean;
}

interface PendingConfirmResolver {
  resolve: (approved: boolean) => void;
  reject: (err: Error) => void;
}

const LANGUAGE_GUIDANCE: Record<string, string> = {
  auto: 'Automatically detect the caller’s spoken language—including Hindi, Bhojpuri, Tamil, Marathi, Telugu, or English—as well as natural code-switching (Hinglish, Tanglish, Tenglish, etc.). Always reply in the exact language and dialect the caller uses.',
  hi: 'The caller prefers Hindi (हिन्दी). Understand pure Hindi and Hinglish effortlessly. Respond warmly and concisely in natural conversational Hindi.',
  bho: 'The caller prefers Bhojpuri (भोजपुरी). Understand authentic Bhojpuri vocabulary and time idioms (e.g., "बिहान" for tomorrow, "भोर" for morning, "सांझ/सँझिया" for evening, "एगो" for one, "केतना बजे"). Respond naturally in polite, warm Bhojpuri.',
  ta: 'The caller prefers Tamil (தமிழ்). Understand spoken Tamil and Tanglish seamlessly (e.g., "நாளைக்கு", "மதியம்", "சாயங்காலம்"). Respond naturally in conversational Tamil.',
  mr: 'The caller prefers Marathi (मराठी). Understand spoken Marathi and mixed Marathi-English effortlessly (e.g., "उद्या", "सकाळी", "संध्याकाळी", "रद्द करा"). Respond naturally in polite conversational Marathi.',
  te: 'The caller prefers Telugu (తెలుగు). Understand spoken Telugu and Tenglish seamlessly (e.g., "రేపు", "ఉదయం", "సాయంత్రం", "మధ్యాహ్నం"). Respond naturally in warm conversational Telugu.',
  en: 'The caller prefers English (Indian & international). Respond concisely and naturally in clear English.',
};

function buildSystemInstruction(timeZone: string, language: string): string {
  const now = new Date();
  const formattedNow = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now);

  const langNote = LANGUAGE_GUIDANCE[language] || LANGUAGE_GUIDANCE.auto;

  return `You are VaaniCal, a real-time multilingual voice AI calendar booking agent connected directly to the user's Google Calendar.

Current Local Date & Time: ${formattedNow}
ISO Timestamp: ${now.toISOString()}
User Time Zone: ${timeZone}

Language & Dialect Fluency:
${langNote}
- Understand Indian regional time/date idioms across Hindi, Bhojpuri, Tamil, Marathi, Telugu, and Indian English.
- Keep spoken replies concise, warm, and natural for voice conversation (1–3 sentences unless listing multiple events). Never read out raw ISO timestamps or technical IDs aloud—speak human times like "tomorrow at 11 AM" in the caller's language.

Google Calendar Tool Rules:
1. Always call \`get_current_datetime\` if you need to double-check relative dates ("kal", "parso", "bihaan", "naalaiku", "udya", "repu", "next Friday").
2. Before booking a slot, ALWAYS call \`check_availability\` for the requested time window to ensure there are no conflicts. If there is a conflict, tell the caller what is already scheduled and suggest the nearest free slot.
3. Before calling \`book_appointment\`, make sure you know: event title/purpose, date, start time, and duration (default to 30 minutes if the user didn't specify duration). If the user asks for a Google Meet link, set \`addGoogleMeet: true\`.
4. To reschedule or cancel an existing appointment, FIRST call \`list_events\` to look up the exact \`eventId\`, then call \`reschedule_appointment\` or \`cancel_appointment\`. Those two tools present a visual confirmation prompt to the user—let the user know briefly while waiting, and once the tool result returns, confirm the final status naturally.
5. Format all \`startDateTimeIso\` and \`endDateTimeIso\` arguments as RFC3339 timestamps with offset or local ISO (e.g. \`2026-11-15T11:00:00+05:30\`) matching the user's timezone \`${timeZone}\`.
6. If a tool returns \`AUTH_REQUIRED\`, politely tell the caller in their language to sign in with Google Calendar on the screen first.`;
}

function normalizeDateTimeForCalendar(isoInput: string, timeZone: string): string {
  const trimmed = isoInput.trim();
  // If already has Z or +/-HH:MM offset, keep as is
  if (/(Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) {
    return trimmed;
  }
  // Compute current offset for target timezone as fallback
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+05:30';
    const match = tzPart.match(/GMT([+-]\d{2}:\d{2})/);
    const offset = match ? match[1] : '+05:30';
    return `${trimmed}${offset}`;
  } catch {
    return `${trimmed}+05:30`;
  }
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_current_datetime',
    description:
      'Returns the exact current date, day of week, and time in the user timezone to resolve relative terms like today, tomorrow, kal, bihaan, naalaiku, udya, repu.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'list_events',
    description:
      'Lists Google Calendar events within a date/time window. Use this to inspect the schedule or find an eventId before rescheduling or canceling.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startDateIso: {
          type: Type.STRING,
          description: 'Start of search window in RFC3339 ISO format (e.g., 2026-11-15T00:00:00+05:30).',
        },
        endDateIso: {
          type: Type.STRING,
          description: 'End of search window in RFC3339 ISO format (e.g., 2026-11-15T23:59:59+05:30).',
        },
        query: {
          type: Type.STRING,
          description: 'Optional text search filter matching event title or description.',
        },
      },
      required: ['startDateIso', 'endDateIso'],
    },
  },
  {
    name: 'check_availability',
    description:
      'Checks whether a proposed time slot is free on Google Calendar and returns any overlapping events.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        startDateIso: {
          type: Type.STRING,
          description: 'Proposed slot start in RFC3339 ISO format.',
        },
        endDateIso: {
          type: Type.STRING,
          description: 'Proposed slot end in RFC3339 ISO format.',
        },
      },
      required: ['startDateIso', 'endDateIso'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Books a new event on Google Calendar after verifying availability and event details.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Title or subject of the meeting/appointment.',
        },
        startDateTimeIso: {
          type: Type.STRING,
          description: 'Event start timestamp in RFC3339 ISO format.',
        },
        endDateTimeIso: {
          type: Type.STRING,
          description: 'Event end timestamp in RFC3339 ISO format.',
        },
        description: {
          type: Type.STRING,
          description: 'Optional notes or agenda for the event.',
        },
        location: {
          type: Type.STRING,
          description: 'Optional physical location or clinic/office address.',
        },
        attendeeEmails: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional list of guest email addresses to invite.',
        },
        addGoogleMeet: {
          type: Type.BOOLEAN,
          description: 'Set true if the caller wants a Google Meet video link.',
        },
      },
      required: ['summary', 'startDateTimeIso', 'endDateTimeIso'],
    },
  },
  {
    name: 'reschedule_appointment',
    description:
      'Reschedules or updates an existing Google Calendar event. Always call list_events first to get the exact eventId.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: {
          type: Type.STRING,
          description: 'Exact Google Calendar event ID from list_events.',
        },
        newStartDateTimeIso: {
          type: Type.STRING,
          description: 'New start timestamp in RFC3339 ISO format.',
        },
        newEndDateTimeIso: {
          type: Type.STRING,
          description: 'New end timestamp in RFC3339 ISO format.',
        },
        newSummary: {
          type: Type.STRING,
          description: 'Optional updated event title.',
        },
        newLocation: {
          type: Type.STRING,
          description: 'Optional updated location.',
        },
        reason: {
          type: Type.STRING,
          description: 'Short explanation of the change.',
        },
      },
      required: ['eventId', 'newStartDateTimeIso', 'newEndDateTimeIso'],
    },
  },
  {
    name: 'cancel_appointment',
    description:
      'Cancels and deletes an existing Google Calendar event. Always call list_events first to get the exact eventId.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: {
          type: Type.STRING,
          description: 'Exact Google Calendar event ID from list_events.',
        },
        reason: {
          type: Type.STRING,
          description: 'Optional reason for cancellation.',
        },
      },
      required: ['eventId'],
    },
  },
];

export function attachLiveWebSocketHandler(clientWs: WebSocket) {
  let session: any = null;
  let accessToken: string | null = null;
  let userTimeZone = 'Asia/Kolkata';
  let requireBookConfirm = false;
  let isClosed = false;

  const pendingConfirmations = new Map<string, PendingConfirmResolver>();

  const safeSend = (payload: unknown) => {
    if (!isClosed && clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  const requestUserConfirmation = (confirmPayload: Record<string, unknown>) => {
    const confirmationId = String(confirmPayload.id);
    return new Promise<boolean>((resolve, reject) => {
      pendingConfirmations.set(confirmationId, { resolve, reject });
      safeSend({
        type: 'confirmation_required',
        confirmation: confirmPayload,
      });
    });
  };

  const handleToolCall = async (call: any) => {
    const callId = call.id || `call-${Date.now()}`;
    const name = call.name;
    const args = (call.args || {}) as Record<string, any>;

    safeSend({
      type: 'tool_event',
      id: callId,
      name,
      status: 'running',
      args,
    });

    const sendResult = (responsePayload: Record<string, unknown>, status: 'completed' | 'cancelled' | 'error' = 'completed') => {
      safeSend({
        type: 'tool_event',
        id: callId,
        name,
        status,
        result: responsePayload,
      });

      if (session && !isClosed) {
        try {
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name,
                response: responsePayload,
              },
            ],
          });
        } catch (err) {
          console.error('Failed to send tool response to Gemini Live:', err);
        }
      }
    };

    try {
      if (name === 'get_current_datetime') {
        const now = new Date();
        sendResult({
          iso: now.toISOString(),
          timeZone: userTimeZone,
          formattedLocal: new Intl.DateTimeFormat('en-IN', {
            timeZone: userTimeZone,
            dateStyle: 'full',
            timeStyle: 'medium',
          }).format(now),
        });
        return;
      }

      if (!accessToken) {
        sendResult(
          {
            error: 'AUTH_REQUIRED',
            message:
              'User has not connected Google Calendar yet. Ask them to sign in with Google Calendar.',
          },
          'error'
        );
        return;
      }

      if (name === 'list_events') {
        const startIso = normalizeDateTimeForCalendar(String(args.startDateIso), userTimeZone);
        const endIso = normalizeDateTimeForCalendar(String(args.endDateIso), userTimeZone);
        const data = await listCalendarEvents(accessToken, {
          timeMin: startIso,
          timeMax: endIso,
          q: args.query ? String(args.query) : undefined,
        });
        const events = (data.items ?? []).map((ev: any) => ({
          id: ev.id,
          summary: ev.summary || '(Untitled event)',
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          location: ev.location || null,
          attendees: (ev.attendees ?? []).map((a: any) => a.email),
        }));
        sendResult({ count: events.length, timeZone: userTimeZone, events });
        return;
      }

      if (name === 'check_availability') {
        const startIso = normalizeDateTimeForCalendar(String(args.startDateIso), userTimeZone);
        const endIso = normalizeDateTimeForCalendar(String(args.endDateIso), userTimeZone);
        const result = await checkCalendarFreeBusy(accessToken, {
          timeMin: startIso,
          timeMax: endIso,
          timeZone: userTimeZone,
        });
        sendResult(result);
        return;
      }

      if (name === 'book_appointment') {
        const startIso = normalizeDateTimeForCalendar(
          String(args.startDateTimeIso),
          userTimeZone
        );
        const endIso = normalizeDateTimeForCalendar(
          String(args.endDateTimeIso),
          userTimeZone
        );

        if (requireBookConfirm) {
          const approved = await requestUserConfirmation({
            id: callId,
            source: 'voice',
            operation: 'book',
            title: String(args.summary),
            proposedStart: startIso,
            proposedEnd: endIso,
            proposedSummary: String(args.summary),
            proposedLocation: args.location ? String(args.location) : undefined,
            proposedDescription: args.description ? String(args.description) : undefined,
            attendees: Array.isArray(args.attendeeEmails)
              ? args.attendeeEmails.map(String)
              : undefined,
          });
          if (!approved) {
            sendResult(
              {
                cancelledByUser: true,
                message: 'The user declined creating this booking in the confirmation dialog.',
              },
              'cancelled'
            );
            return;
          }
        }

        const created = await createCalendarEvent(accessToken, {
          summary: String(args.summary),
          startDateTime: startIso,
          endDateTime: endIso,
          timeZone: userTimeZone,
          description: args.description ? String(args.description) : undefined,
          location: args.location ? String(args.location) : undefined,
          attendees: Array.isArray(args.attendeeEmails)
            ? args.attendeeEmails.map(String)
            : undefined,
          addGoogleMeet: Boolean(args.addGoogleMeet),
        });

        safeSend({ type: 'calendar_updated', action: 'created', event: created });
        sendResult({
          booked: true,
          eventId: created.id,
          summary: created.summary,
          start: created.start?.dateTime || created.start?.date,
          end: created.end?.dateTime || created.end?.date,
          hangoutLink: created.hangoutLink || null,
          htmlLink: created.htmlLink || null,
        });
        return;
      }

      if (name === 'reschedule_appointment') {
        const eventId = String(args.eventId);
        const existing = await getCalendarEvent(accessToken, eventId);
        const newStart = normalizeDateTimeForCalendar(
          String(args.newStartDateTimeIso),
          userTimeZone
        );
        const newEnd = normalizeDateTimeForCalendar(
          String(args.newEndDateTimeIso),
          userTimeZone
        );

        const approved = await requestUserConfirmation({
          id: callId,
          source: 'voice',
          operation: 'reschedule',
          eventId,
          title: existing.summary || '(Untitled event)',
          currentStart: existing.start?.dateTime || existing.start?.date,
          currentEnd: existing.end?.dateTime || existing.end?.date,
          proposedStart: newStart,
          proposedEnd: newEnd,
          proposedSummary: args.newSummary ? String(args.newSummary) : existing.summary,
          proposedLocation: args.newLocation ? String(args.newLocation) : existing.location,
          reason: args.reason ? String(args.reason) : undefined,
        });

        if (!approved) {
          sendResult(
            {
              cancelledByUser: true,
              message: 'The user declined the reschedule in the confirmation dialog.',
            },
            'cancelled'
          );
          return;
        }

        const updated = await updateCalendarEvent(accessToken, eventId, {
          startDateTime: newStart,
          endDateTime: newEnd,
          timeZone: userTimeZone,
          summary: args.newSummary ? String(args.newSummary) : undefined,
          location: args.newLocation ? String(args.newLocation) : undefined,
        });

        safeSend({ type: 'calendar_updated', action: 'updated', event: updated });
        sendResult({
          rescheduled: true,
          eventId: updated.id,
          summary: updated.summary,
          start: updated.start?.dateTime || updated.start?.date,
          end: updated.end?.dateTime || updated.end?.date,
        });
        return;
      }

      if (name === 'cancel_appointment') {
        const eventId = String(args.eventId);
        const existing = await getCalendarEvent(accessToken, eventId);

        const approved = await requestUserConfirmation({
          id: callId,
          source: 'voice',
          operation: 'cancel',
          eventId,
          title: existing.summary || '(Untitled event)',
          currentStart: existing.start?.dateTime || existing.start?.date,
          currentEnd: existing.end?.dateTime || existing.end?.date,
          reason: args.reason ? String(args.reason) : undefined,
        });

        if (!approved) {
          sendResult(
            {
              cancelledByUser: true,
              message: 'The user decided to keep this event and declined cancellation.',
            },
            'cancelled'
          );
          return;
        }

        await deleteCalendarEvent(accessToken, eventId);
        safeSend({ type: 'calendar_updated', action: 'deleted', eventId });
        sendResult({
          cancelled: true,
          eventId,
          summary: existing.summary,
        });
        return;
      }

      sendResult({ error: `Unknown tool: ${name}` }, 'error');
    } catch (err: any) {
      const message = err?.message || 'Calendar operation failed';
      sendResult({ error: message }, 'error');
    }
  };

  clientWs.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'init') {
        const init = msg as InitPayload;
        accessToken = init.accessToken || null;
        userTimeZone = init.timeZone || 'Asia/Kolkata';
        requireBookConfirm = Boolean(init.requireBookConfirm);

        const ai = getGeminiLiveClient();

        const vadConfig =
          init.vadSensitivity === 'high'
            ? {
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
                prefixPaddingMs: 120,
                silenceDurationMs: 360,
              }
            : init.vadSensitivity === 'low'
              ? {
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 240,
                  silenceDurationMs: 750,
                }
              : {
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 180,
                  silenceDurationMs: 520,
                };

        session = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: init.voiceName || 'Zephyr',
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                ...vadConfig,
              },
              activityHandling: init.bargeIn
                ? ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
                : ActivityHandling.NO_INTERRUPTION,
            },
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            systemInstruction: buildSystemInstruction(
              userTimeZone,
              init.language || 'auto'
            ),
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;

              if (content?.interimInputTranscription?.text) {
                safeSend({
                  type: 'interim_input_transcript',
                  text: content.interimInputTranscription.text,
                });
              }

              if (content?.inputTranscription?.text) {
                safeSend({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                });
              }

              if (content?.outputTranscription?.text) {
                safeSend({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                });
              }

              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  safeSend({
                    type: 'audio',
                    data: part.inlineData.data,
                  });
                }
              }

              if (content?.interrupted) {
                safeSend({ type: 'interrupted' });
              }

              if (content?.turnComplete) {
                safeSend({ type: 'turn_complete' });
              }

              if (message.toolCall?.functionCalls) {
                for (const call of message.toolCall.functionCalls) {
                  void handleToolCall(call);
                }
              }

              if (message.toolCallCancellation?.ids) {
                for (const cancelId of message.toolCallCancellation.ids) {
                  const pending = pendingConfirmations.get(cancelId);
                  if (pending) {
                    pendingConfirmations.delete(cancelId);
                    pending.resolve(false);
                    safeSend({ type: 'confirmation_cancelled', id: cancelId });
                  }
                }
              }
            },
            onerror: (event: any) => {
              safeSend({
                type: 'error',
                message: event?.message || 'Gemini Live connection error',
              });
            },
            onclose: (event: any) => {
              safeSend({
                type: 'session_closed',
                reason: event?.reason || 'Session ended',
              });
            },
          },
        });
        safeSend({ type: 'ready' });
        return;
      }

      if (msg.type === 'update_token') {
        accessToken = msg.accessToken || null;
        return;
      }

      if (msg.type === 'update_settings') {
        if (typeof msg.requireBookConfirm === 'boolean') {
          requireBookConfirm = msg.requireBookConfirm;
        }
        return;
      }

      if (msg.type === 'audio' && session && !isClosed) {
        session.sendRealtimeInput({
          audio: {
            data: msg.data,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
        return;
      }

      if (msg.type === 'text' && session && !isClosed && msg.text) {
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: String(msg.text) }] }],
          turnComplete: true,
        });
        return;
      }

      if (msg.type === 'tool_confirmation') {
        const resolver = pendingConfirmations.get(String(msg.id));
        if (resolver) {
          pendingConfirmations.delete(String(msg.id));
          resolver.resolve(Boolean(msg.approved));
        }
      }
    } catch (err: any) {
      console.error('WebSocket message error:', err);
      safeSend({
        type: 'error',
        message: err?.message || 'Failed to process live voice message',
      });
    }
  });

  clientWs.on('close', () => {
    isClosed = true;
    for (const [, pending] of pendingConfirmations) {
      pending.resolve(false);
    }
    pendingConfirmations.clear();
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore close errors
      }
      session = null;
    }
  });
}
