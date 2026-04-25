import type { Event, UserProfile } from "@/types";
import { resolveUserName } from "./names";

/**
 * V18-S06 — ICS (RFC 5545) generator pro jednorázové download eventu
 * ("Přidat do kalendáře" button v detailu).
 *
 * Pure funkce, žádný DOM / Firestore. Output je string s CRLF line
 * endings ready pro blob download.
 *
 * Klíčová designová rozhodnutí:
 *   - `METHOD:PUBLISH` (ne REQUEST) — Apple Calendar to vezme jako
 *     informační, NEnabídne RSVP prompt (mitigace R1 z DESIGN_BRIEF)
 *   - ATTENDEE **bez PARTSTAT** — druhý kus R1 mitigace. Apple teoreticky
 *     ATTENDEE s PARTSTAT=NEEDS-ACTION interpretuje jako RSVP required;
 *     náš katalog v appce to ale řeší v aplikaci, ne v kalendáři
 *   - `TZID:Europe/Prague` fixní (per DESIGN_BRIEF §4 timezone constraint)
 *   - All-day: `DTSTART;VALUE=DATE:YYYYMMDD` místo datetime
 *   - Line folding (RFC 5545 §3.1) záměrně vynechán pro jednoduchost;
 *     Apple + Google Calendar long lines snesou
 *
 * Žádný npm balík — RFC je dost jednoduchý, vlastní string template
 * udrží závislosti štíhlé (viz CLAUDE.md sekce "Co NEDĚLAT" pattern).
 */

export interface BuildEventIcsInput {
  event: Event;
  /** Users v inviteeUids — name resolution z useUsers.byUid. */
  inviteeUsers?: Map<string, UserProfile>;
  /** Tvůrce eventu (ORGANIZER v ICS). */
  creator?: UserProfile;
}

const PRODID = "-//Chytrý dům na vsi//Events//CS";
const CAL_NAME = "Chytrý dům";

/**
 * Hlavní builder — vrátí ICS string připravený pro blob download.
 */
export function buildEventIcs(input: BuildEventIcsInput): string {
  const { event, inviteeUsers, creator } = input;
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${PRODID}`);
  lines.push("METHOD:PUBLISH");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`X-WR-CALNAME:${escapeIcsText(CAL_NAME)}`);

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

  // DTSTART/DTEND — datetime s TZID nebo VALUE=DATE pro all-day.
  if (event.isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.startAt)}`);
    // Pro all-day se DTEND typicky nastaví na `+1 den` (exclusive end).
    // Ale event.endAt už by měl být konec posledního dne; použijeme ho
    // a přidáme 1 den pro exclusive semantics.
    lines.push(
      `DTEND;VALUE=DATE:${formatDateOnlyPlusOneDay(event.endAt)}`,
    );
  } else {
    // V18-S42 — datetime jako UTC s 'Z' suffix. Stejné jako server-side
    // builder (functions/src/cal/ics.ts). Předtím TZID=Europe/Prague +
    // local time bylo problematické na CF (UTC environment) → user viděl
    // -2h posun. UTC + Z suffix je host-TZ independent.
    lines.push(`DTSTART:${formatDateTimeUtcFromIso(event.startAt)}`);
    lines.push(`DTEND:${formatDateTimeUtcFromIso(event.endAt)}`);
  }

  if (creator) {
    // V18-S24 — mailto = contactEmail (iCloud kontakt) || email (auth)
    // || synthesized fallback. CN = přezdívka pro friendly view; Apple
    // Calendar ji zobrazí vedle email matchovaným kontaktem v Contacts.
    const creatorEmail =
      creator.contactEmail || creator.email || `${creator.uid}@chytrydum.local`;
    const creatorCn = resolveUserName({
      profileDisplayName: creator.displayName,
      email: creator.email,
      uid: creator.uid,
    });
    lines.push(
      `ORGANIZER;CN=${escapeIcsText(creatorCn)}:mailto:${creatorEmail}`,
    );
    // V18-S37 — autor také jako ATTENDEE (s ROLE=CHAIR per RFC 5545).
    // Důvod: Apple Calendar zobrazí ORGANIZER odděleně, ale v "All
    // Invitees" listu autor mizí. Konzistentní s UI v appce (S36) kde je
    // autor první mezi účastníky. ROLE=CHAIR semantic = "host/moderator".
    lines.push(
      `ATTENDEE;CN=${escapeIcsText(creatorCn)};ROLE=CHAIR:mailto:${creatorEmail}`,
    );
  }

  // ATTENDEE per invitee. Bez PARTSTAT — viz R1 mitigation.
  // V18-S24 — mailto bere contactEmail (pokud user v Settings nastavil
  // svůj iCloud email) jinak fallback na auth email. CN = přezdívka pro
  // friendly view — Apple Calendar pak zobrazí "Stáňa <stana@icloud.com>"
  // a klik na účastníka najde vizitku v iCloud Contacts.
  // V18-S37 — skip autor (už přidán výše s ROLE=CHAIR), aby se nezobrazil
  // dvakrát kdyby byl v inviteeUids zařazen i sám.
  const creatorUid = creator?.uid;
  for (const uid of event.inviteeUids) {
    if (creatorUid && uid === creatorUid) continue;
    const profile = inviteeUsers?.get(uid);
    const email =
      profile?.contactEmail || profile?.email || `${uid}@chytrydum.local`;
    const cn = resolveUserName({
      profileDisplayName: profile?.displayName,
      email: profile?.email,
      uid,
    });
    lines.push(
      `ATTENDEE;CN=${escapeIcsText(cn)}:mailto:${email}`,
    );
  }

  // STATUS: CONFIRMED (upcoming / happened), CANCELLED (zrušený).
  // AWAITING_CONFIRMATION je pořád CONFIRMED pro kalendář — user ho
  // viděl naplánovaně, retrospektivní "zrušeno" v appce se do kalendáře
  // nepropíše (calendar ICS je tak moc statický, webcal subscription
  // řeší updates — viz S11).
  lines.push(
    event.status === "CANCELLED" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
  );

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  // RFC 5545 §3.1 — line endings jsou CRLF.
  return lines.join("\r\n") + "\r\n";
}

// ---------- helpers (pure) ----------

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

/**
 * Format date (libovolný Date/ISO) do RFC 5545 "floating" datetime
 * YYYYMMDDTHHMMSS — bez timezone suffix (TZID je v property parameteru).
 */
export function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Local v Europe/Prague — použijeme getter components v "local" Date
  // (Node/iOS Safari v daném lokálním TZ). Pro user app předpokládáme
  // CZ TZ na klientu. Pokud user má v iOS jinou TZ, ICS obsahuje
  // TZID=Europe/Prague + hodnotu "čas v té TZ", což je RFC 5545 správně —
  // kalendář převede dle TZID.
  //
  // POZNÁMKA: pokud user.tz != Europe/Prague, tohle by vrátilo local
  // v jeho TZ a labelled jako Europe/Prague (wrong). Pro MVP to beru
  // — dle DESIGN_BRIEF §4 všichni uživatelé v Europe/Prague.
  return formatYyyymmddThhmmss(d);
}

/** Same for UTC datetime (DTSTAMP format YYYYMMDDTHHMMSSZ). */
export function formatDateTimeUtc(d: Date): string {
  const s = d.toISOString();
  // "2026-05-14T12:00:00.000Z" → "20260514T120000Z"
  return s.replace(/[-:.]/g, "").replace(/\.\d{3}/, "").slice(0, 15) + "Z";
}

/**
 * V18-S42 — ISO string → YYYYMMDDTHHMMSSZ (UTC).
 * Pro DTSTART/DTEND. Pomocný wrapper nad formatDateTimeUtc.
 */
export function formatDateTimeUtcFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDateTimeUtc(d);
}

/**
 * YYYYMMDD pro all-day. Bere date část z ISO stringu v UTC, aby se
 * nezpočítával do druhého dne při lokální TZ shift (např. vstup
 * `2026-06-01T23:59Z` by v CZ vyšlo jako `06-02`). All-day events jsou
 * floating dates — den je den, bez ohledu na TZ.
 */
export function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/**
 * All-day DTEND — RFC 5545 vyžaduje exclusive end (den PO posledním
 * dni). Vezmeme event.endAt, přičteme 1 den, vrátíme YYYYMMDD.
 */
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
