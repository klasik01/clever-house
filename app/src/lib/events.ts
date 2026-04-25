import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Event, EventStatus, UserRole } from "@/types";

/**
 * V18 — Events CRUD. Paralelí s `tasks.ts` patternem.
 *
 * Kolekce `/events/{eventId}` (top-level). Subkolekce pro RSVP se přidá
 * v S05; tady jen základ (CRUD + subscription).
 *
 * Konvence: kód anglicky, UI texty si řeší callers přes t().
 */

const EVENTS = "events";

/**
 * Subscribe to all events ordered chronologically (nejbližší termín
 * nahoře pro `upcoming` view). Caller filters past/upcoming podle
 * potřeby (UI filter).
 */
export function subscribeEvents(
  onChange: (events: Event[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(collection(db, EVENTS), orderBy("startAt", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromQueryDoc)),
    (err) => onError(err),
  );
}

/** Subscribe to one event by ID. onChange(null) = deleted / no rights. */
export function subscribeEvent(
  id: string,
  onChange: (event: Event | null) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, EVENTS, id),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(fromDocSnap(snap));
    },
    (err) => onError(err),
  );
}

export async function getEvent(id: string): Promise<Event | null> {
  const snap = await getDoc(doc(db, EVENTS, id));
  return snap.exists() ? fromDocSnap(snap) : null;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startAt: string; // ISO
  endAt: string; // ISO
  isAllDay: boolean;
  address?: string;
  inviteeUids: string[];
  linkedTaskId?: string | null;
}

/**
 * Create new event. Creator je autor (uid), authorRole snapshot per
 * V17.1. Status vždy `UPCOMING` při create — lifecycle transitions
 * řeší S09/S10 a scheduled CF.
 */
export async function createEvent(
  input: CreateEventInput,
  uid: string,
  authorRole: UserRole,
): Promise<string> {
  const ref = await addDoc(collection(db, EVENTS), {
    title: input.title,
    description: input.description ?? "",
    startAt: input.startAt,
    endAt: input.endAt,
    isAllDay: input.isAllDay,
    address: input.address ?? "",
    inviteeUids: input.inviteeUids,
    createdBy: uid,
    authorRole,
    status: "UPCOMING" as EventStatus,
    linkedTaskId: input.linkedTaskId ?? null,
    happenedConfirmedAt: null,
    cancelledAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Patch event fields. Autor + cross-OWNER smí (rules enforce).
 * Updatuje `updatedAt` automaticky.
 */
export async function updateEvent(
  id: string,
  patch: Partial<
    Pick<
      Event,
      | "title"
      | "description"
      | "startAt"
      | "endAt"
      | "isAllDay"
      | "address"
      | "inviteeUids"
      | "linkedTaskId"
      | "status"
      | "happenedConfirmedAt"
      | "cancelledAt"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, EVENTS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Delete event. Rules: pouze autor. */
export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, EVENTS, id));
}

/**
 * V18-S08 — cancel event. Status → CANCELLED, cancelledAt = now,
 * updatedAt auto. Rules: autor nebo cross-OWNER (stejné jak edit).
 *
 * Je to obalený updateEvent, aby trigger `onEventUpdated` zachytil
 * status flip a poslal `event_cancelled` push + inbox všem invitees.
 */
export async function cancelEvent(id: string): Promise<void> {
  await updateDoc(doc(db, EVENTS, id), {
    status: "CANCELLED" as EventStatus,
    cancelledAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * V18-S10 — retro confirm že event proběhl. Pouze pro eventy ve stavu
 * AWAITING_CONFIRMATION (automaticky flipnuté scheduled CF po endAt).
 * Status → HAPPENED, happenedConfirmedAt = now, updatedAt auto.
 *
 * Žádná notifikace — invitees už to vědí (event byl naplánovaný, teď
 * je to jen audit pro autora "ano, doopravdy to proběhlo"). Trigger
 * `onEventUpdated` to pozná jako ne-notifiable status lifecycle a
 * skipne.
 */
export async function confirmEventHappened(id: string): Promise<void> {
  await updateDoc(doc(db, EVENTS, id), {
    status: "HAPPENED" as EventStatus,
    happenedConfirmedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

// ---------- deserialization ----------

function fromQueryDoc(d: QueryDocumentSnapshot): Event {
  return fromDocSnap(d);
}

function fromDocSnap(d: DocumentSnapshot): Event {
  const data = d.data() ?? {};
  return {
    id: d.id,
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    startAt: toIso(data.startAt),
    endAt: toIso(data.endAt),
    isAllDay: data.isAllDay === true,
    address: typeof data.address === "string" ? data.address : "",
    inviteeUids: Array.isArray(data.inviteeUids)
      ? data.inviteeUids.filter((u: unknown): u is string => typeof u === "string")
      : [],
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    authorRole:
      data.authorRole === "OWNER" || data.authorRole === "PROJECT_MANAGER"
        ? data.authorRole
        : undefined,
    status: isValidStatus(data.status) ? data.status : "UPCOMING",
    linkedTaskId: typeof data.linkedTaskId === "string" ? data.linkedTaskId : null,
    happenedConfirmedAt: toIsoOrNull(data.happenedConfirmedAt),
    cancelledAt: toIsoOrNull(data.cancelledAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function isValidStatus(v: unknown): v is EventStatus {
  return (
    v === "UPCOMING" ||
    v === "AWAITING_CONFIRMATION" ||
    v === "HAPPENED" ||
    v === "CANCELLED"
  );
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return null;
}
