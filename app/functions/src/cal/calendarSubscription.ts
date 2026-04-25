/**
 * V18-S11 — webcal subscription HTTP endpoint.
 *
 * URL: `/cal/:uid/:token.ics` — server-side ICS feed pro konkrétního
 * uživatele. Apple Calendar si URL přidá jako subscription a pravidelně
 * fetche (~15min) aby měl aktuální eventy.
 *
 * Token-based auth: URL obsahuje per-user secret token co matchuje
 * `users/{uid}.calendarToken`. Pokud nematchuje → 401. Resetovat token
 * uživatel může v Settings (S12) — invalidizuje předchozí subscription
 * na všech zařízeních.
 *
 * Filter: events kde user je autor (`createdBy == uid`) nebo invitee
 * (`uid in inviteeUids`). CANCELLED se odfiltruje (clean feed bez šumu).
 *
 * Route mapping: Firebase hosting rewrite `/cal/**` → tato CF. Viz
 * `firebase.json`. Díky tomu má URL "pretty" formát bez
 * cloudfunctions.net subdomény.
 */
import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { buildCalendarIcs, type IcsEvent, type IcsUser } from "./ics";

const REGION = "europe-west1";

// Path pattern: /{uid}/{token}.ics — uid i token jsou URL-safe
// alphanumerické + hyphen/underscore. Delimiter je ".ics" suffix.
//
// Funguje ve dvou módech:
//   - Nativní CF URL: `https://<region>-<project>.cloudfunctions.net/
//       calendarSubscription/{uid}/{token}.ics` → req.path =
//       "/{uid}/{token}.ics"
//   - Firebase Hosting rewrite (optional, future): `/cal/**` → CF,
//     req.path obsahuje `/cal/{uid}/{token}.ics`
//
// Oba formáty regex pokryje díky optional `/cal` prefixu.
// Exported pro unit testy — pure regex, bez side effectu.
export const PATH_RE = /^(?:\/cal)?\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\.ics$/;

export const calendarSubscription = onRequest(
  { region: REGION, cors: false },
  async (req, res) => {
    // Jen GET + HEAD. Ostatní metody 405. Apple Calendar dělá oboje.
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.set("Allow", "GET, HEAD");
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Firebase hosting nám pošle původní path (`/cal/{uid}/{token}.ics`)
    // v `req.path`. Defensive: některé emulátor setupy posílají jen
    // zbytek za rewrite prefixem — obě varianty pokryjeme přes match.
    const path = req.path || req.url.split("?")[0] || "";
    const match = path.match(PATH_RE);
    if (!match) {
      logger.debug("calendarSubscription — malformed URL", { path });
      res.status(400).send("Bad Request");
      return;
    }
    const [, uid, token] = match;

    const db = admin.firestore();

    // 1. Ověř token na user doc
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      logger.debug("calendarSubscription — user not found", { uid });
      res.status(401).send("Unauthorized");
      return;
    }
    const storedToken = userSnap.get("calendarToken");
    if (typeof storedToken !== "string" || storedToken.length === 0) {
      logger.debug("calendarSubscription — user has no calendarToken", { uid });
      res.status(401).send("Unauthorized");
      return;
    }
    if (storedToken !== token) {
      logger.debug("calendarSubscription — token mismatch", { uid });
      res.status(401).send("Unauthorized");
      return;
    }

    // 2. Fetch events — 2 queries (created by me + invited to) s dedupe.
    // Firestore nepodporuje OR cross-field, takže union post-fetch.
    const [createdSnap, invitedSnap] = await Promise.all([
      db.collection("events").where("createdBy", "==", uid).get(),
      db
        .collection("events")
        .where("inviteeUids", "array-contains", uid)
        .get(),
    ]);
    const byId = new Map<string, IcsEvent>();
    for (const d of [...createdSnap.docs, ...invitedSnap.docs]) {
      if (byId.has(d.id)) continue;
      const data = d.data() ?? {};
      const status = data.status as IcsEvent["status"];
      // Clean feed: CANCELLED se do subscription nepromítá (invitees už
      // o tom vědí + ikdyby ne, Apple Calendar "zrušený event"
      // na subscription se projeví jako silently-missing, což je OK UX).
      if (status === "CANCELLED") continue;
      byId.set(d.id, {
        id: d.id,
        title: typeof data.title === "string" ? data.title : "",
        description:
          typeof data.description === "string" ? data.description : undefined,
        startAt: typeof data.startAt === "string" ? data.startAt : "",
        endAt: typeof data.endAt === "string" ? data.endAt : "",
        isAllDay: data.isAllDay === true,
        address:
          typeof data.address === "string" && data.address
            ? data.address
            : undefined,
        inviteeUids: Array.isArray(data.inviteeUids)
          ? data.inviteeUids.filter((x: unknown): x is string => typeof x === "string")
          : [],
        createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
        status,
      });
    }
    const events = Array.from(byId.values());

    // 3. Resolve users — potřebujeme jméno + email pro ORGANIZER/ATTENDEE.
    // Sesbíráme všechny relevantní uid (creators + invitees) do setu
    // a fetchnem je v jednom `getAll()`.
    const userUids = new Set<string>();
    for (const ev of events) {
      userUids.add(ev.createdBy);
      for (const u of ev.inviteeUids) userUids.add(u);
    }
    const usersByUid = new Map<string, IcsUser>();
    if (userUids.size > 0) {
      // getAll chain takes DocumentReference[]. Batch <=500 per call.
      const refs = Array.from(userUids).map((u) =>
        db.collection("users").doc(u),
      );
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const d = snap.data() ?? {};
        usersByUid.set(snap.id, {
          uid: snap.id,
          displayName:
            typeof d.displayName === "string" ? d.displayName : null,
          email: typeof d.email === "string" ? d.email : null,
          contactEmail:
            typeof d.contactEmail === "string" ? d.contactEmail : null,
        });
      }
    }

    // 4. Build ICS
    const body = buildCalendarIcs({ events, usersByUid });

    logger.info("calendarSubscription — served", {
      uid,
      events: events.length,
      method: req.method,
    });

    res.set("Content-Type", "text/calendar; charset=utf-8");
    // Apple Calendar checks ETag/Last-Modified, ale stačí no-cache
    // direktiva — Apple respektuje TTL (refresh každých ~15min-1h).
    res.set("Cache-Control", "max-age=0, must-revalidate");
    // HEAD vrací prázdné tělo ale stejné hlavičky (status 200).
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    res.status(200).send(body);
  },
);
