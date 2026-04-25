import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  Timestamp,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Rsvp, RsvpAnswer } from "@/types";

/**
 * V18-S05 — RSVP CRUD (response per invitee per event).
 *
 * Doc layout: /events/{eventId}/rsvps/{uid} — doc id = uid, takže
 * guaranteed max jeden záznam per pozvaný. Rules: self-write, read
 * kdokoliv signed-in.
 */

const EVENTS = "events";
const RSVPS = "rsvps";

export function subscribeRsvps(
  eventId: string,
  onChange: (rsvps: Rsvp[]) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, EVENTS, eventId, RSVPS),
    (snap) => onChange(snap.docs.map(fromDocSnap)),
    (err) => onError(err),
  );
}

/**
 * Upsert RSVP pro aktuálního uživatele. Vyžaduje že `uid` == auth.uid
 * (rules enforce). `setDoc` s merge=false → overwrite starou hodnotu.
 */
export async function setRsvp(
  eventId: string,
  uid: string,
  response: RsvpAnswer,
): Promise<void> {
  await setDoc(doc(db, EVENTS, eventId, RSVPS, uid), {
    response,
    respondedAt: serverTimestamp(),
  });
}

/** Smazat RSVP (změna zpátky na "neodpověděno"). Dnes UI to nenabízí, ale
 *  hodí se pro testy a future polish. */
export async function clearRsvp(eventId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, EVENTS, eventId, RSVPS, uid));
}

function fromDocSnap(d: DocumentSnapshot): Rsvp {
  const data = d.data() ?? {};
  return {
    uid: d.id,
    response: data.response === "no" ? "no" : "yes",
    respondedAt: toIso(data.respondedAt),
  };
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}
