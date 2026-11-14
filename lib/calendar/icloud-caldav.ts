import { createDAVClient, type DAVCalendar } from "tsdav";

type DavClient = Awaited<ReturnType<typeof createDAVClient>>;

export const ICLOUD_CALDAV_SERVER = "https://caldav.icloud.com";

export type IcloudCalDavCredentials = {
  readonly appleId: string;
  readonly appSpecificPassword: string;
};

export type IcloudCalendarSummary = {
  readonly url: string;
  readonly displayName: string;
  readonly ctag: string | null;
  readonly description: string | null;
};

export type IcloudCalendarEvent = {
  readonly url: string;
  readonly etag: string | null;
  readonly uid: string | null;
  readonly summary: string | null;
  readonly description: string | null;
  readonly location: string | null;
  readonly start: string | null;
  readonly end: string | null;
  readonly raw: string;
};

export class IcloudCalDavError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcloudCalDavError";
  }
}

async function createClient(
  credentials: IcloudCalDavCredentials,
): Promise<DavClient> {
  try {
    return await createDAVClient({
      serverUrl: ICLOUD_CALDAV_SERVER,
      credentials: {
        username: credentials.appleId.trim(),
        password: credentials.appSpecificPassword,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
  } catch (cause) {
    throw new IcloudCalDavError(
      cause instanceof Error
        ? `Could not connect to iCloud CalDAV: ${cause.message}`
        : "Could not connect to iCloud CalDAV.",
    );
  }
}

function calendarDisplayName(calendar: DAVCalendar): string {
  const raw = calendar.displayName;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (raw && typeof raw === "object" && "_cdata" in raw) {
    const cdata = (raw as { _cdata?: unknown })._cdata;
    if (typeof cdata === "string" && cdata.trim()) return cdata.trim();
  }
  const url = typeof calendar.url === "string" ? calendar.url : "";
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "Calendar";
}

/**
 * Validate Apple ID + app-specific password by discovering calendars.
 * Returns the calendar-home URL when discovery succeeds.
 */
export async function verifyIcloudCalDavCredentials(
  credentials: IcloudCalDavCredentials,
): Promise<{ calendarHomeUrl: string | null }> {
  const client = await createClient(credentials);
  try {
    const account = await client.createAccount({
      account: {
        serverUrl: ICLOUD_CALDAV_SERVER,
        accountType: "caldav",
        credentials: {
          username: credentials.appleId.trim(),
          password: credentials.appSpecificPassword,
        },
      },
      loadCollections: false,
      loadObjects: false,
    });
    const calendars = await client.fetchCalendars({ account });
    if (!Array.isArray(calendars) || calendars.length === 0) {
      // Some accounts expose zero calendars briefly; auth still succeeded if
      // createAccount did not throw.
      return {
        calendarHomeUrl:
          typeof account.homeUrl === "string" ? account.homeUrl : null,
      };
    }
    return {
      calendarHomeUrl:
        typeof account.homeUrl === "string" ? account.homeUrl : null,
    };
  } catch (cause) {
    if (cause instanceof IcloudCalDavError) throw cause;
    throw new IcloudCalDavError(
      cause instanceof Error
        ? `iCloud CalDAV authorization failed: ${cause.message}`
        : "iCloud CalDAV authorization failed.",
    );
  }
}

export async function listIcloudCalendars(
  credentials: IcloudCalDavCredentials,
): Promise<readonly IcloudCalendarSummary[]> {
  const client = await createClient(credentials);
  const calendars = await client.fetchCalendars();
  return calendars.map((calendar) => ({
    url: calendar.url,
    displayName: calendarDisplayName(calendar),
    ctag: typeof calendar.ctag === "string" ? calendar.ctag : null,
    description:
      typeof calendar.description === "string" ? calendar.description : null,
  }));
}

function parseIcalProperty(raw: string, name: string): string | null {
  const pattern = new RegExp(`^${name}[;:](.*)$`, "im");
  const match = raw.match(pattern);
  if (!match?.[1]) return null;
  const value = match[1].trim();
  // Strip inline params after a second colon for DATE-TIME lines like
  // DTSTART;TZID=America/Los_Angeles:20240101T090000
  const colon = value.lastIndexOf(":");
  if (colon >= 0 && value.includes("=")) {
    return value.slice(colon + 1).trim() || null;
  }
  return value || null;
}

function parseEventFromIcal(url: string, etag: string | null, data: string) {
  return {
    url,
    etag,
    uid: parseIcalProperty(data, "UID"),
    summary: parseIcalProperty(data, "SUMMARY"),
    description: parseIcalProperty(data, "DESCRIPTION"),
    location: parseIcalProperty(data, "LOCATION"),
    start:
      parseIcalProperty(data, "DTSTART") ??
      parseIcalProperty(data, "DTSTART;VALUE=DATE"),
    end:
      parseIcalProperty(data, "DTEND") ??
      parseIcalProperty(data, "DTEND;VALUE=DATE"),
    raw: data,
  } satisfies IcloudCalendarEvent;
}

export async function listIcloudEvents(params: {
  readonly credentials: IcloudCalDavCredentials;
  readonly calendarUrl: string;
  readonly start: string;
  readonly end: string;
}): Promise<readonly IcloudCalendarEvent[]> {
  const client = await createClient(params.credentials);
  const objects = await client.fetchCalendarObjects({
    calendar: { url: params.calendarUrl },
    timeRange: { start: params.start, end: params.end },
  });
  return objects
    .filter((object) => typeof object.data === "string" && object.data)
    .map((object) =>
      parseEventFromIcal(
        object.url,
        typeof object.etag === "string" ? object.etag : null,
        object.data as string,
      ),
    );
}

export async function searchIcloudEvents(params: {
  readonly credentials: IcloudCalDavCredentials;
  readonly calendarUrl: string;
  readonly start: string;
  readonly end: string;
  readonly query: string;
}): Promise<readonly IcloudCalendarEvent[]> {
  const needle = params.query.trim().toLowerCase();
  const events = await listIcloudEvents(params);
  if (!needle) return events;
  return events.filter((event) => {
    const haystack = [
      event.summary,
      event.description,
      event.location,
      event.uid,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export async function getIcloudEvent(params: {
  readonly credentials: IcloudCalDavCredentials;
  readonly calendarUrl: string;
  readonly eventUrl: string;
  readonly start?: string;
  readonly end?: string;
}): Promise<IcloudCalendarEvent | null> {
  const now = new Date();
  const start =
    params.start ??
    new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365).toISOString();
  const end =
    params.end ??
    new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365).toISOString();
  const events = await listIcloudEvents({
    credentials: params.credentials,
    calendarUrl: params.calendarUrl,
    start,
    end,
  });
  return (
    events.find(
      (event) =>
        event.url === params.eventUrl ||
        event.url.replace(/\/$/, "") === params.eventUrl.replace(/\/$/, ""),
    ) ?? null
  );
}
