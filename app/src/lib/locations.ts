import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Location, LocationGroup, Task } from "@/types";

/**
 * V7 — 3 fixed groups. Groups themselves stay hard-coded; only the locations
 * inside them are user-editable. i18n keys resolve the display label.
 */
export const LOCATION_GROUPS: { id: LocationGroup; i18nKey: string }[] = [
  { id: "pozemek", i18nKey: "locations.groupPozemek" },
  { id: "dum", i18nKey: "locations.groupDum" },
  { id: "site", i18nKey: "locations.groupSite" },
];

/**
 * V7 default location set. IDs are **stable slugs** — they MUST NOT change,
 * because existing `task.locationId` values point at them. Changing a slug
 * would silently orphan old tasks.
 *
 * Group remap from V3 → V7:
 *   outdoor → pozemek
 *   general → dum            (technicka-mistnost moves to site)
 *   living  → dum
 *   hygiene → dum
 *
 * These are also used as the seed for the Firestore /locations collection
 * on first login (see seedLocationsIfEmpty) and as an offline fallback when
 * the runtime cache is still hydrating.
 */
export const DEFAULT_LOCATIONS: Location[] = [
  // Pozemek
  { id: "pozemek-zahrada",    label: "Pozemek / zahrada",           group: "pozemek" },
  { id: "okoli-domu",         label: "Okolí domu",                  group: "pozemek" },
  { id: "dvorek-pred-domem",  label: "Dvorek před domem",           group: "pozemek" },
  { id: "zahradni-domek",     label: "Zahradní domek",              group: "pozemek" },
  { id: "terasa",             label: "Terasa / venkovní posezení",  group: "pozemek" },
  // Dům
  { id: "dum-obecne",         label: "Dům (obecně)",                group: "dum" },
  { id: "zadveri",            label: "Zádveří",                     group: "dum" },
  { id: "chodba",             label: "Chodba",                      group: "dum" },
  { id: "garaz",              label: "Garáž",                       group: "dum" },
  { id: "dilna",              label: "Dílna",                       group: "dum" },
  { id: "obyvaci-pokoj",      label: "Obývací pokoj",               group: "dum" },
  { id: "kuchyn",             label: "Kuchyň",                      group: "dum" },
  { id: "loznice",            label: "Ložnice",                     group: "dum" },
  { id: "detsky-pokoj",       label: "Dětský pokoj",                group: "dum" },
  { id: "pokoj-pro-hosty",    label: "Pokoj pro hosty",             group: "dum" },
  { id: "pracovna",           label: "Pracovna",                    group: "dum" },
  { id: "koupelna",           label: "Koupelna",                    group: "dum" },
  { id: "wc",                 label: "WC",                          group: "dum" },
  { id: "wellness",           label: "Wellness",                    group: "dum" },
  // Sítě
  { id: "technicka-mistnost", label: "Technická místnost",          group: "site" },
];

// Back-compat alias — consumers importing `LOCATIONS` still work unchanged.
export const LOCATIONS: Location[] = DEFAULT_LOCATIONS;

const COL = "locations";

/**
 * Runtime cache hydrated by the first useLocations() snapshot. Keeps
 * getLocation() synchronous for places (PDF export, text export, list
 * card rendering) that can’t easily thread a hook.
 */
let runtimeCache: Map<string, Location> | null = null;

export function _setLocationsRuntimeCache(locations: Location[]): void {
  const m = new Map<string, Location>();
  for (const l of locations) m.set(l.id, l);
  runtimeCache = m;
}

export function getLocation(id: string | null | undefined): Location | undefined {
  if (!id) return undefined;
  if (runtimeCache) {
    const hit = runtimeCache.get(id);
    if (hit) return hit;
  }
  // Fallback: defaults. Covers boot before first snapshot + offline.
  return DEFAULT_LOCATIONS.find((l) => l.id === id);
}

/** Group the given list of locations into LOCATION_GROUPS-ordered sections. */
export function locationsByGroup(
  source: Location[] = runtimeCache ? Array.from(runtimeCache.values()) : DEFAULT_LOCATIONS,
): {
  group: LocationGroup;
  i18nKey: string;
  items: Location[];
}[] {
  return LOCATION_GROUPS.map((g) => ({
    group: g.id,
    i18nKey: g.i18nKey,
    items: source
      .filter((l) => l.group === g.id)
      .sort((a, b) => a.label.localeCompare(b.label, "cs")),
  }));
}

export function applyLocation(tasks: Task[], locationId: string | null): Task[] {
  if (!locationId) return tasks;
  return tasks.filter((t) => t.locationId === locationId);
}

// ---------- Firestore CRUD ----------

export function subscribeLocations(
  onChange: (locations: Location[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(collection(db, COL), orderBy("label", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromDoc)),
    (err) => onError(err as Error),
  );
}

/** Build a URL-safe slug for a label. Keeps ASCII letters/digits + hyphens. */
export function slugifyLocation(label: string): string {
  const lower = label
    .trim()
    .toLocaleLowerCase("cs")
    // Decompose accents then strip them
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return lower || `loc-${Date.now()}`;
}

/** Create (or upsert) a location. Uses slugified label as doc id so IDs
 *  stay stable across re-seeding. */
export async function createLocation(
  label: string,
  group: LocationGroup,
  uid: string,
): Promise<string> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Empty label");
  let id = slugifyLocation(trimmed);
  // Collision guard: if slug already exists, append a short suffix.
  if (runtimeCache?.has(id)) {
    id = `${id}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const ref = doc(db, COL, id);
  await setDoc(ref, {
    label: trimmed,
    group,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function renameLocation(id: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Empty label");
  await updateDoc(doc(db, COL, id), { label: trimmed });
}

export async function setLocationGroup(id: string, group: LocationGroup): Promise<void> {
  await updateDoc(doc(db, COL, id), { group });
}

export async function deleteLocation(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/**
 * Seed DEFAULT_LOCATIONS into Firestore on first OWNER login. Idempotent:
 * skips if any /locations doc already exists. Uses the stable slug IDs so
 * historical task.locationId values resolve to the seeded docs.
 */
export async function seedLocationsIfEmpty(uid: string): Promise<void> {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  for (const l of DEFAULT_LOCATIONS) {
    const ref = doc(db, COL, l.id);
    batch.set(ref, {
      label: l.label,
      group: l.group,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

function fromDoc(d: QueryDocumentSnapshot): Location {
  const data = d.data();
  return {
    id: d.id,
    label: typeof data.label === "string" ? data.label : "",
    group: (data.group as LocationGroup) ?? "dum",
    createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
    createdAt: toIso(data.createdAt),
  };
}

function toIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return undefined;
}
