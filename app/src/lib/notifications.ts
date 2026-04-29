import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  NotificationDevice,
  NotificationEventKey,
  NotificationPrefs,
} from "@/types";

/**
 * V15 — push notifications data layer.
 *
 * Lives on `users/{uid}.notificationPrefs` (per-user preferences) +
 * `users/{uid}/devices/{deviceId}` (per-device FCM tokens). Registration
 * of the token itself happens in slice N-2; this file just owns the CRUD
 * around the schema.
 */

// ---------- Events + defaults ----------

/** Canonical order of event keys. Also serves as the dedupe priority:
 *  when a single actor action triggers multiple events for the same
 *  recipient, the earlier-listed event wins. */
export const NOTIFICATION_EVENTS: NotificationEventKey[] = [
  "mention",
  "assigned",
  "comment_on_mine",
  "comment_on_thread",
  "shared_with_pm",
  "priority_changed",    // V16.4
  "deadline_changed",    // V16.4
  "task_deleted",        // V16.6
  "assigned_with_comment", // V17.5
  "event_invitation",    // V18-S04
  "event_rsvp_response", // V18-S05
  "event_update",        // V18-S07
  "event_uninvited",     // V18-S07
  "event_cancelled",     // V18-S08
  "event_calendar_token_reset", // V18-S12
  "event_rsvp_reminder", // V18-S13
  "document_uploaded",   // V20
  "task_completed",      // V25
  "task_blocked",        // V25
  "task_unblocked",      // V25
  "task_canceled",       // V25
  "task_reopened",       // V25
  "site_report_created", // V26
];

/** Everything on by default — matches the "gentle opt-out" model. Users
 *  who dislike a specific event can flip it in Settings; we don't nag them
 *  into granular configuration before they've even seen what's useful.
 *
 *  V16.7 — pořadí klíčů v `events` matchuje NOTIFICATION_CATALOG server-side.
 *  Když přidáš nový eventType, doplň ho tady i v types.ts (union) i v CF
 *  katalogu — všechny tři musí držet spolu. */
export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  events: {
    mention: true,
    assigned: true,
    comment_on_mine: true,
    comment_on_thread: true,
    shared_with_pm: true,
    priority_changed: true,
    deadline_changed: true,
    task_deleted: true,
    assigned_with_comment: true,
    event_invitation: true,
    event_rsvp_response: true,
    event_update: true,
    event_uninvited: true,
    event_cancelled: true,
    event_calendar_token_reset: true,
    event_rsvp_reminder: true,
    document_uploaded: true,
    task_completed: true,
    task_blocked: true,
    task_unblocked: true,
    task_canceled: true,
    task_reopened: true,
    site_report_created: true,
  },
};

/**
 * Merge a raw pref value (from Firestore, or undefined for legacy users)
 * against the defaults. Pure — safe to import anywhere, unit-testable.
 * Unknown event keys in the input are ignored; missing keys fall back to
 * the default. Enforces shape so render paths don't crash on stale data.
 */
export function mergePrefsWithDefaults(raw: unknown): NotificationPrefs {
  const defaults = DEFAULT_PREFS;
  if (!raw || typeof raw !== "object") return clonePrefs(defaults);

  const r = raw as { enabled?: unknown; events?: unknown };
  const enabled = typeof r.enabled === "boolean" ? r.enabled : defaults.enabled;

  const rawEvents = (r.events && typeof r.events === "object") ? (r.events as Record<string, unknown>) : {};
  const events = { ...defaults.events };
  for (const key of NOTIFICATION_EVENTS) {
    const v = rawEvents[key];
    if (typeof v === "boolean") events[key] = v;
  }

  return { enabled, events };
}

function clonePrefs(p: NotificationPrefs): NotificationPrefs {
  return { enabled: p.enabled, events: { ...p.events } };
}

// ---------- Preferences — read + write on the user doc ----------

/** Patch a subset of the user's notificationPrefs. Missing fields stay
 *  untouched on Firestore side. Master toggle and per-event toggles can
 *  both be flipped via this helper. */
export async function updateUserPrefs(
  uid: string,
  patch: {
    enabled?: boolean;
    events?: Partial<Record<NotificationEventKey, boolean>>;
  },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") {
    updates["notificationPrefs.enabled"] = patch.enabled;
  }
  if (patch.events) {
    for (const [key, val] of Object.entries(patch.events)) {
      if (typeof val === "boolean") {
        updates[`notificationPrefs.events.${key}`] = val;
      }
    }
  }
  if (Object.keys(updates).length === 0) return;
  await updateDoc(doc(db, "users", uid), updates);
}

// ---------- Device registration (FCM tokens live here) ----------

import { LOCAL_STORAGE } from "./storageKeys";

const DEVICE_ID_STORAGE_KEY = LOCAL_STORAGE.notifDeviceId;

/**
 * Return a stable per-browser-profile device id. Persisted in
 * localStorage so reloads don't spawn duplicate device docs. If the user
 * clears site data or opens an incognito window, a new id is minted —
 * that's fine, the old one will be cleaned up when its token starts
 * returning 410/404 from FCM (slice N-10).
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && typeof existing === "string" && existing.length >= 8) {
      return existing;
    }
  } catch {
    /* no storage — fall through and mint ephemeral id */
  }
  const id = mintDeviceId();
  try {
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  } catch {
    /* best effort */
  }
  return id;
}

function mintDeviceId(): string {
  // crypto.randomUUID is on jsdom + all modern browsers; fall back to
  // Math.random for ancient contexts (not really expected here).
  const cryptoObj = (typeof globalThis !== "undefined" ? (globalThis as unknown as { crypto?: Crypto }).crypto : undefined);
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Register (or refresh) this browser's FCM token against the user. Idempotent —
 * writes to the same {deviceId} doc every call. `lastSeen` bumps on each
 * invocation so stale devices can be identified.
 */
export async function registerDevice(args: {
  uid: string;
  deviceId: string;
  token: string;
  platform: NotificationDevice["platform"];
  userAgent: string;
}): Promise<void> {
  const { uid, deviceId, token, platform, userAgent } = args;
  const ref = doc(db, "users", uid, "devices", deviceId);
  await setDoc(
    ref,
    {
      token,
      platform,
      userAgent,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Remove a device registration (logout, "sign out everywhere", or after
 *  the FCM delivery handler detected a dead token). */
export async function unregisterDevice(args: {
  uid: string;
  deviceId: string;
}): Promise<void> {
  const { uid, deviceId } = args;
  await deleteDoc(doc(db, "users", uid, "devices", deviceId));
}

/** Bump `lastSeen` on the device doc — cheap way to know what's still
 *  active without tracking per-event delivery receipts. */
export async function touchDevice(args: {
  uid: string;
  deviceId: string;
}): Promise<void> {
  const { uid, deviceId } = args;
  await updateDoc(doc(db, "users", uid, "devices", deviceId), {
    lastSeen: serverTimestamp(),
  });
}

/** Subscribe to all devices registered for a user. Useful in Settings so
 *  the user can see (and revoke) devices they've forgotten about. */
export function subscribeDevices(
  uid: string,
  onChange: (devices: NotificationDevice[]) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "users", uid, "devices"),
    (snap) => {
      const devices: NotificationDevice[] = snap.docs.map(fromDeviceSnap);
      onChange(devices);
    },
    (err) => onError(err),
  );
}

function fromDeviceSnap(d: DocumentSnapshot<DocumentData>): NotificationDevice {
  const data = d.data() ?? {};
  return {
    id: d.id,
    token: typeof data.token === "string" ? data.token : "",
    platform: isPlatform(data.platform) ? data.platform : "desktop",
    userAgent: typeof data.userAgent === "string" ? data.userAgent : "",
    createdAt: toIso(data.createdAt),
    lastSeen: toIso(data.lastSeen),
  };
}

function isPlatform(v: unknown): v is NotificationDevice["platform"] {
  return v === "ios" || v === "android" || v === "desktop";
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return "";
}
