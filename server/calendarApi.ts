const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export interface CreateEventInput {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  description?: string;
  location?: string;
  attendees?: string[];
  addGoogleMeet?: boolean;
}

export interface UpdateEventInput {
  summary?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  description?: string;
  location?: string;
}

async function googleCalendarFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return { success: true };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errMsg =
      data?.error?.message || `Google Calendar API error (${response.status})`;
    const err = new Error(errMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function getCalendarProfile(accessToken: string) {
  return googleCalendarFetch(accessToken, '/calendars/primary');
}

export async function listCalendarEvents(
  accessToken: string,
  params: {
    timeMin: string;
    timeMax: string;
    q?: string;
    maxResults?: number;
  }
) {
  const qs = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    maxResults: String(params.maxResults ?? 50),
  });
  if (params.q) {
    qs.set('q', params.q);
  }
  return googleCalendarFetch(accessToken, `/calendars/primary/events?${qs.toString()}`);
}

export async function getCalendarEvent(accessToken: string, eventId: string) {
  return googleCalendarFetch(
    accessToken,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`
  );
}

export async function checkCalendarFreeBusy(
  accessToken: string,
  params: {
    timeMin: string;
    timeMax: string;
    timeZone: string;
  }
) {
  const [freeBusy, eventsList] = await Promise.all([
    googleCalendarFetch(accessToken, '/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        timeZone: params.timeZone,
        items: [{ id: 'primary' }],
      }),
    }),
    listCalendarEvents(accessToken, {
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      maxResults: 25,
    }),
  ]);

  const busy = freeBusy?.calendars?.primary?.busy ?? [];
  const items = (eventsList?.items ?? []).map((ev: any) => ({
    id: ev.id,
    summary: ev.summary || '(Untitled event)',
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    location: ev.location,
  }));

  return {
    timeZone: params.timeZone,
    windowStart: params.timeMin,
    windowEnd: params.timeMax,
    isAvailable: busy.length === 0,
    busySlots: busy,
    overlappingEvents: items,
  };
}

export async function createCalendarEvent(
  accessToken: string,
  input: CreateEventInput
) {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.startDateTime,
      timeZone: input.timeZone,
    },
    end: {
      dateTime: input.endDateTime,
      timeZone: input.timeZone,
    },
  };

  if (input.attendees && input.attendees.length > 0) {
    body.attendees = input.attendees
      .map((email) => email.trim())
      .filter(Boolean)
      .map((email) => ({ email }));
  }

  let query = '';
  if (input.addGoogleMeet) {
    query = '?conferenceDataVersion=1';
    body.conferenceData = {
      createRequest: {
        requestId: `prabhat-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  return googleCalendarFetch(accessToken, `/calendars/primary/events${query}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  input: UpdateEventInput
) {
  const patch: Record<string, unknown> = {};
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.description !== undefined) patch.description = input.description;
  if (input.location !== undefined) patch.location = input.location;
  if (input.startDateTime) {
    patch.start = {
      dateTime: input.startDateTime,
      timeZone: input.timeZone || 'Asia/Kolkata',
    };
  }
  if (input.endDateTime) {
    patch.end = {
      dateTime: input.endDateTime,
      timeZone: input.timeZone || 'Asia/Kolkata',
    };
  }

  return googleCalendarFetch(
    accessToken,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
}

export async function deleteCalendarEvent(accessToken: string, eventId: string) {
  return googleCalendarFetch(
    accessToken,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
    }
  );
}
