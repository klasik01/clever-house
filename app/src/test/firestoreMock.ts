/**
 * In-memory Firestore stand-in for unit tests.
 *
 * Usage in a test file:
 *
 *   import { vi } from "vitest";
 *   vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
 *   vi.mock("@/lib/firebase", () => ({ db: {} }));
 *
 *   import { __firestoreState } from "@/test/firestoreMock";
 *   beforeEach(() => __firestoreState.reset());
 *
 * Each operation (setDoc, updateDoc, deleteDoc, batch.set/update/delete) is
 * both applied to an in-memory Map *and* pushed onto a `calls` log so tests
 * can assert the exact write shape (useful for V4 workflow batch writes).
 */

interface Call {
  op: string;
  path: string;
  data?: unknown;
}

const state = {
  store: new Map<string, Record<string, unknown>>(),
  calls: [] as Call[],
  // Registered onSnapshot listeners so tests can trigger emissions manually.
  listeners: new Map<string, Array<(docs: Array<{ id: string; data: () => unknown }>) => void>>(),
};

export const __firestoreState = {
  get store() {
    return state.store;
  },
  get calls() {
    return state.calls;
  },
  reset() {
    state.store.clear();
    state.calls.length = 0;
    state.listeners.clear();
  },
  /** Force-emit a snapshot for a collection path (e.g. "locations"). */
  emit(colPath: string): void {
    const prefix = colPath + "/";
    const docs: Array<{ id: string; data: () => unknown }> = [];
    for (const [k, v] of state.store.entries()) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes("/")) {
        docs.push({ id: k.slice(prefix.length), data: () => v });
      }
    }
    const subs = state.listeners.get(colPath) ?? [];
    for (const s of subs) s(docs);
  },
};

type DocRef = { __path: string; id: string; parent: { __path: string } };
type CollectionRef = { __path: string; __type: "collection" };

function pathOf(ref: DocRef | CollectionRef): string {
  return ref.__path;
}

// ---------------- doc / collection ----------------

export function collection(_db: unknown, ...parts: string[]): CollectionRef {
  return { __path: parts.join("/"), __type: "collection" };
}

export function doc(...args: unknown[]): DocRef {
  // doc(collectionRef) → auto id (for addDoc-style usage)
  if (args.length === 1) {
    const col = args[0] as CollectionRef;
    const id = `auto-${state.calls.length}-${Math.random().toString(36).slice(2, 10)}`;
    return { __path: `${col.__path}/${id}`, id, parent: { __path: col.__path } };
  }
  // doc(db, "collection", "id")
  const [, colName, id] = args as [unknown, string, string];
  return {
    __path: `${colName}/${id}`,
    id,
    parent: { __path: colName },
  };
}

// ---------------- single-doc ops ----------------

export async function setDoc(ref: DocRef, data: Record<string, unknown>): Promise<void> {
  state.store.set(pathOf(ref), { ...data });
  state.calls.push({ op: "setDoc", path: pathOf(ref), data });
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>): Promise<void> {
  const cur = state.store.get(pathOf(ref)) ?? {};
  state.store.set(pathOf(ref), applyMerge(cur, data));
  state.calls.push({ op: "updateDoc", path: pathOf(ref), data });
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  state.store.delete(pathOf(ref));
  state.calls.push({ op: "deleteDoc", path: pathOf(ref) });
}

export async function getDoc(ref: DocRef) {
  const data = state.store.get(pathOf(ref));
  return {
    exists: () => data !== undefined,
    data: () => data,
    id: ref.id,
  };
}

export async function addDoc(col: CollectionRef, data: Record<string, unknown>) {
  const ref = doc(col);
  await setDoc(ref, data);
  return ref;
}

export async function getDocs(q: CollectionRef | DocRef) {
  const prefix = pathOf(q) + "/";
  const docs: Array<{ id: string; data: () => unknown }> = [];
  for (const [k, v] of state.store.entries()) {
    if (k.startsWith(prefix) && !k.slice(prefix.length).includes("/")) {
      docs.push({ id: k.slice(prefix.length), data: () => v });
    }
  }
  return { empty: docs.length === 0, docs, size: docs.length };
}

// ---------------- query / modifiers (no-ops for unit tests) ----------------

export function query<T extends CollectionRef>(col: T, ..._mods: unknown[]): T {
  return col;
}
export function orderBy(..._args: unknown[]): unknown {
  return { __type: "orderBy" };
}
export function where(..._args: unknown[]): unknown {
  return { __type: "where" };
}
export function limit(_n: number): unknown {
  return { __type: "limit" };
}

// ---------------- realtime ----------------

export function onSnapshot(
  q: CollectionRef | DocRef,
  next: (snap: unknown) => void,
  _err?: (err: Error) => void,
): () => void {
  const path = pathOf(q);
  const emit = (docs: Array<{ id: string; data: () => unknown }>) =>
    next({ empty: docs.length === 0, docs, size: docs.length });
  const subs = state.listeners.get(path) ?? [];
  subs.push(emit);
  state.listeners.set(path, subs);
  // Emit current snapshot synchronously so subscribers get an initial value.
  __firestoreState.emit(path);
  return () => {
    const arr = state.listeners.get(path);
    if (arr) state.listeners.set(path, arr.filter((f) => f !== emit));
  };
}

// ---------------- sentinel helpers ----------------

export function serverTimestamp(): unknown {
  return { __sentinel: "serverTimestamp" };
}

export function increment(n: number): unknown {
  return { __sentinel: "increment", by: n };
}

export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }
  static now(): Timestamp {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
  static fromDate(d: Date): Timestamp {
    return new Timestamp(Math.floor(d.getTime() / 1000), 0);
  }
}

// ---------------- batch ----------------

interface BatchOp {
  op: "set" | "update" | "delete";
  path: string;
  data?: Record<string, unknown>;
}

export function writeBatch(_db: unknown) {
  const ops: BatchOp[] = [];
  return {
    set(ref: DocRef, data: Record<string, unknown>) {
      ops.push({ op: "set", path: pathOf(ref), data: { ...data } });
    },
    update(ref: DocRef, data: Record<string, unknown>) {
      ops.push({ op: "update", path: pathOf(ref), data: { ...data } });
    },
    delete(ref: DocRef) {
      ops.push({ op: "delete", path: pathOf(ref) });
    },
    async commit() {
      for (const o of ops) {
        if (o.op === "set") {
          state.store.set(o.path, { ...(o.data ?? {}) });
        } else if (o.op === "update" && o.data) {
          const cur = state.store.get(o.path) ?? {};
          state.store.set(o.path, applyMerge(cur, o.data));
        } else if (o.op === "delete") {
          state.store.delete(o.path);
        }
        state.calls.push({ op: `batch.${o.op}`, path: o.path, data: o.data });
      }
    },
    /** Non-standard handle for tests — inspect the pending op list. */
    __ops: ops,
  };
}

// ---------------- helpers ----------------

/**
 * Apply an update patch. Resolves `increment` sentinels against the current
 * value, leaves `serverTimestamp` as-is (tests assert on the sentinel).
 */
function applyMerge(
  cur: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && (v as { __sentinel?: string }).__sentinel === "increment") {
      const by = (v as { by: number }).by;
      const prev = typeof cur[k] === "number" ? (cur[k] as number) : 0;
      next[k] = prev + by;
    } else {
      next[k] = v;
    }
  }
  return next;
}
