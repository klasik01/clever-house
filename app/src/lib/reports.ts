/**
 * V26 — Hlášení ze stavby (broadcast reports).
 *
 * Mimo workflow tasků — žádné komentáře, status, assignee. Pouze:
 *   message + importance + media + readBy[].
 *
 * Storage:
 *   - Firestore: `/reports/{id}` (V26 — samostatná kolekce, brief Mezera A=a)
 *   - Files:     `reports/{uid}/{reportId}/{filename}` (image 10MB / video 50MB)
 */
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ReportImportance,
  ReportMedia,
  SiteReport,
  UserRole,
} from "@/types";

const REPORTS = "reports";

// ---------- Subscribe / read ----------

export function subscribeReports(
  onChange: (reports: SiteReport[]) => void,
  onError: (err: Error) => void,
): () => void {
  const q = query(collection(db, REPORTS), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map(fromQueryDoc)),
    (err) => onError(err),
  );
}

export function subscribeReport(
  id: string,
  onChange: (report: SiteReport | null) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, REPORTS, id),
    (snap) => onChange(snap.exists() ? fromDocSnap(snap) : null),
    (err) => onError(err),
  );
}

// ---------- Create / mutate ----------

export async function createReport(
  data: {
    message: string;
    importance: ReportImportance;
    media?: ReportMedia[];
  },
  uid: string,
  authorRole: UserRole,
): Promise<string> {
  const ref = await addDoc(collection(db, REPORTS), {
    message: data.message.trim(),
    importance: data.importance,
    media: data.media ?? [],
    createdBy: uid,
    authorRole,
    readBy: [uid], // V26 — autor je default přečtený
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * V26 — auto-mark on detail open. Idempotentní (arrayUnion dedupluje).
 * Server rule (firestore.rules) povoluje update kohokoli, ale jen na
 * pole `readBy + updatedAt`.
 */
export async function markReportRead(
  reportId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, REPORTS, reportId), {
    readBy: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

/**
 * V26 — delete report. Server rules povolí jen autorovi.
 * MVP UI mažbu nesí — ponecháno pro housekeeping přes Admin SDK / future.
 */
export async function deleteReport(reportId: string): Promise<void> {
  await deleteDoc(doc(db, REPORTS, reportId));
}

// ---------- Serialization ----------

function fromQueryDoc(d: QueryDocumentSnapshot): SiteReport {
  return fromDocSnap(d);
}

function fromDocSnap(d: DocumentSnapshot): SiteReport {
  const data = d.data() ?? {};
  return {
    id: d.id,
    message: typeof data.message === "string" ? data.message : "",
    importance: bridgeImportance(data.importance),
    media: Array.isArray(data.media)
      ? (data.media as ReportMedia[]).filter(
          (m) => m && typeof m.url === "string" && typeof m.path === "string",
        )
      : [],
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    authorRole:
      data.authorRole === "OWNER"
      || data.authorRole === "PROJECT_MANAGER"
      || data.authorRole === "CONSTRUCTION_MANAGER"
        ? data.authorRole
        : undefined,
    readBy: Array.isArray(data.readBy)
      ? data.readBy.filter((x): x is string => typeof x === "string")
      : [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function bridgeImportance(v: unknown): ReportImportance {
  if (v === "important" || v === "critical") return v;
  return "normal";
}

function toIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

// ---------- Pure helpers ----------

/**
 * V26 — počet nepřečtených pro daného uživatele.
 * Pure helper — uses pre-loaded reports list (z useReports subscription).
 */
export function countUnreadReports(
  reports: SiteReport[],
  uid: string | undefined,
): number {
  if (!uid) return 0;
  return reports.filter((r) => !(r.readBy ?? []).includes(uid)).length;
}

/**
 * V26 — je hlášení nepřečtené pro daného uživatele?
 */
export function isReportUnread(
  report: SiteReport,
  uid: string | undefined,
): boolean {
  if (!uid) return false;
  return !(report.readBy ?? []).includes(uid);
}
