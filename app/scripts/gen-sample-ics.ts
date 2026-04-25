/**
 * V18-S46 — Lokální testovací skript pro ICS výstup.
 *
 * Spuštění:
 *   npm run gen:ics
 *
 * Output: app/sample-event.ics + app/sample-calendar.ics
 *   - sample-event.ics — single-event download (lib/ics.ts buildEventIcs)
 *   - sample-calendar.ics — multi-event webcal feed (functions/.../buildCalendarIcs)
 *
 * Otevři dvojklik v Finderu / iPhone → Apple Calendar otevře a ukáže.
 * Změnu v `lib/ics.ts` ověříš okamžitě bez deploye.
 *
 * Smazat soubory: jsou v .gitignore (sample-*.ics).
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildEventIcs } from "../src/lib/ics";
import type { Event, UserProfile } from "../src/types";
import { buildCalendarIcs } from "../functions/src/cal/ics";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

// ---------- Sample data ----------

// Pět dní dopředu, 14:00 Praha (12:00 UTC v CEST období).
function inDays(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setUTCHours(hour - 2, minute, 0, 0); // -2 = převod na UTC v CEST (květen)
  return d.toISOString();
}

const author: UserProfile = {
  uid: "owner-1",
  email: "stana.work@gmail.com",
  contactEmail: "stana@icloud.com",
  role: "OWNER",
  displayName: "Stáňa",
};

const wife: UserProfile = {
  uid: "owner-2",
  email: "marie.kasikova@gmail.com",
  contactEmail: "marie@icloud.com",
  role: "OWNER",
  displayName: "Marie",
};

const pm: UserProfile = {
  uid: "pm-1",
  email: "projektant@example.cz",
  role: "PROJECT_MANAGER",
  displayName: "Honza Projektant",
};

const sampleEvent: Event = {
  id: "sample-event-001",
  title: "Schůzka s elektrikářem — rozvaděč",
  description: "Diskuse umístění hlavního rozvaděče + počet okruhů.",
  startAt: inDays(5, 14, 0),
  endAt: inDays(5, 15, 30),
  isAllDay: false,
  address: "Stavba Vsetín, Hlavní 123",
  inviteeUids: ["owner-2", "pm-1"], // manželka + PM (autor není v invitees)
  createdBy: author.uid,
  authorRole: "OWNER",
  status: "UPCOMING",
  linkedTaskId: null,
  happenedConfirmedAt: null,
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// All-day event pro variant test (volitelný)
const sampleAllDayEvent: Event = {
  ...sampleEvent,
  id: "sample-event-002",
  title: "Předání stavby",
  description: "",
  isAllDay: true,
  startAt: inDays(10, 0),
  endAt: inDays(10, 23, 59),
};

// ---------- Build single-event ICS (klient flow) ----------

const inviteeUsersMap = new Map<string, UserProfile>([
  [wife.uid, wife],
  [pm.uid, pm],
]);

const singleEventIcs = buildEventIcs({
  event: sampleEvent,
  inviteeUsers: inviteeUsersMap,
  creator: author,
});

const singlePath = resolve(APP_ROOT, "sample-event.ics");
writeFileSync(singlePath, singleEventIcs, "utf-8");
console.log(`✅ ${singlePath}`);

// ---------- Build multi-event calendar ICS (server webcal flow) ----------

const calendarIcs = buildCalendarIcs({
  events: [
    {
      id: sampleEvent.id,
      title: sampleEvent.title,
      description: sampleEvent.description,
      startAt: sampleEvent.startAt,
      endAt: sampleEvent.endAt,
      isAllDay: sampleEvent.isAllDay,
      address: sampleEvent.address,
      inviteeUids: sampleEvent.inviteeUids,
      createdBy: sampleEvent.createdBy,
      status: sampleEvent.status,
    },
    {
      id: sampleAllDayEvent.id,
      title: sampleAllDayEvent.title,
      description: sampleAllDayEvent.description,
      startAt: sampleAllDayEvent.startAt,
      endAt: sampleAllDayEvent.endAt,
      isAllDay: sampleAllDayEvent.isAllDay,
      inviteeUids: sampleAllDayEvent.inviteeUids,
      createdBy: sampleAllDayEvent.createdBy,
      status: sampleAllDayEvent.status,
    },
  ],
  usersByUid: new Map([
    [author.uid, author],
    [wife.uid, wife],
    [pm.uid, pm],
  ]),
});

const calendarPath = resolve(APP_ROOT, "sample-calendar.ics");
writeFileSync(calendarPath, calendarIcs, "utf-8");
console.log(`✅ ${calendarPath}`);

// ---------- Print obsah obou na stdout ----------

console.log("\n========== sample-event.ics ==========");
console.log(singleEventIcs);
console.log("\n========== sample-calendar.ics ==========");
console.log(calendarIcs);

console.log("\n💡 Otevři dvojklik v Finderu → Apple Calendar.");
console.log("   Pro iPhone: AirDrop / email / share, nebo umísti soubor do iCloud Drive a otevři z Files app.");
