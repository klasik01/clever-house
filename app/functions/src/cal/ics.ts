/**
 * V18-S11 — Multi-event ICS builder pro webcal subscription.
 *
 * Paralelí s `app/src/lib/ics.ts` (single-event download z S06) — logika
 * VEVENT rendering je stejná, ale tady pracujeme s N events a bez
 * closure na React types (CF je separate Node balíček bez `@/types`
 * aliasu). Code duplication je pragmatická volba — RFC 5545 je stabilní,
 * drift risk je malý.
 *
 * Pure funkce, žádný Firestore IO. Caller si načte events + users a
 * předá je jako pole + Map.
 */

/** Lehký Event tvar — jen co potřebujeme k renderu. */
export interface IcsEvent {
  id: string;
  title: string;
  description?: string;
  startAt: string; // ISO
  endAt: string;   // ISO
  isAllDay: boolean;
  address?: string;
  inviteeUids: string[];
  createdBy: string;
  status: "UPCOMING" | "AWAITING_CONFIRMATION" | "HAPPENED" | "CANCELLED";
}

/** Lehký user tvar pro resolve name + email v ORGANIZER/ATTENDEE.
 *  V18-S24 — `contactEmail` je preferovaný mailto: pro Apple Contacts
 *  matchování. Pokud není, fallback na `email` (auth). */
export interface IcsUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  contactEmail?: string | null;
}

export interface BuildCalendarIcsInput {
  events: IcsEvent[];
  usersByUid: Map<string, IcsUser>;
  /** Název kalendáře v klientu (Apple Calendar name). */
  calendarName?: string;
}

const PRODID = "-//Chytrý dům na vsi//Events//CS";
const DEFAULT_CAL_NAME = "Chytrý dům";

/**
 * Vrátí ICS string s N events ve VCALENDAR wrapperu. Caller filtruje
 * CANCELLED eventy před voláním (subscription má být čistý feed).
 *
 * Line endings CRLF per RFC 5545 §3.1.
 */
export function buildCalendarIcs(input: BuildCalendarIcsInput): string {
  const { events, usersByUid, calendarName } = input;
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${PRODID}`);
  lines.push("METHOD:PUBLISH");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`X-WR-CALNAME:${escapeIcsText(calendarName ?? DEFAULT_CAL_NAME)}`);

  for (const ev of events) {
    for (const line of renderVevent(ev, usersByUid)) {
      lines.push(line);
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function renderVevent(
  event: IcsEvent,
  usersByUid: Map<string, IcsUser>,
): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${event.id}@chytrydum`);
  lines.push(`DTSTAMP:${formatDateTimeUtc(new Date())}`);
  lines.push(`SUMMARY:${escapeIcsText(event.title || "Událost")}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.address) {
    lines.push(`LOCATION:${escapeIcsText(event.address)}`);
  }

  if (event.isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startAt)}`);
    lines.push(
      `DTEND;VALUE=DATE:${formatDateOnlyPlusOneDay(event.endAt)}`,
    );
  } else {
    lines.push(
      `DTSTART;TZID=Europe/Prague:${formatDateTimeLocal(event.startAt)}`,
    );
    lines.push(
      `DTEND;TZID=Europe/Prague:${formatDateTimeLocal(event.endAt)}`,
    );
  }

  const creator = usersByUid.get(event.createdBy);
  if (creator) {
    const { name, email } = nameAndEmail(creator);
    lines.push(
      `ORGANIZER;CN=${escapeIcsText(name)}:mailto:${email}`,
    );
  }

  for (const uid of event.inviteeUids) {
    const profile = usersByUid.get(uid);
    const { name, email } = nameAndEmail(profile ?? { uid });
    lines.push(
      `ATTENDEE;CN=${escapeIcsText(name)}:mailto:${email}`,
    );
  }

  // AWAITING_CONFIRMATION se promítá jako CONFIRMED (kalendář neví
  // o retro stavech). CANCELLED by tu neměl být vůbec (caller filtruje),
  // ale defensive fallback.
  lines.push(
    event.status === "CANCELLED" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
  );

  lines.push("END:VEVENT");
  return lines;
}

// ---------- helpers (pure) ----------

function nameAndEmail(u: IcsUser): { name: string; email: string } {
  // V18-S24 — mailto: bere `contactEmail` (iCloud kontakt z Settings)
  // pokud existuje, jinak `email` (auth z Google), jinak synth fallback.
  // CN je friendly přezdívka pro Apple Calendar zobrazení vedle emailu —
  // Apple pak v Contacts vyhledá podle email a ukáže vizitku.
  const contact = u.contactEmail?.trim();
  const auth = u.email?.trim();
  const email = contact || auth || `${u.uid}@chytrydum.local`;
  const displayName = u.displayName?.trim();
  const name =
    displayName ||
    (auth && auth.split("@")[0]) ||
    u.uid.slice(0, 6) ||
    "—";
  return { name, email };
}

/**
 * RFC 5545 §3.3.11 text escaping:
 *   backslash, semicolon, comma, and newlines MUST be escaped.
 */
export function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatYyyymmddThhmmss(d);
}

export function formatDateTimeUtc(d: Date): string {
  const s = d.toISOString();
  return s.replace(/[-:.]/g, "").replace(/\.\d{3}/, "").slice(0, 15) + "Z";
}

export function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

export function formatDateOnlyPlusOneDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

function formatYyyymmddThhmmss(d: Date): string {
  return (
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
