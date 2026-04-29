import imageCompression from "browser-image-compression";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

const MAX_WIDTH_OR_HEIGHT = 1920;
const MAX_SIZE_MB = 1.0;
/** V19 — unified upload limit for all file types (images + PDF). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Compress image on the client (webp), then upload to Firebase Storage. */
export async function uploadTaskImage(params: {
  file: File;
  uid: string;
  taskId: string;
}): Promise<{ url: string; path: string }> {
  const { file, uid, taskId } = params;

  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.8,
  });

  const unique =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  const path = `images/${uid}/${taskId}/${unique}.webp`;
  const objectRef = ref(storage, path);

  await uploadBytes(objectRef, compressed, {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });

  const url = await getDownloadURL(objectRef);
  return { url, path };
}

/** V19 — Upload a file (PDF) without compression. Stored as-is. */
export async function uploadTaskFile(params: {
  file: File;
  uid: string;
  taskId: string;
}): Promise<{ url: string; path: string }> {
  const { file, uid, taskId } = params;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 10 MB)`);
  }

  const unique =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `files/${uid}/${taskId}/${unique}.${ext}`;
  const objectRef = ref(storage, path);

  await uploadBytes(objectRef, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "public, max-age=31536000, immutable",
  });

  const url = await getDownloadURL(objectRef);
  return { url, path };
}

export async function deleteTaskImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    // Missing object is fine — treat delete as idempotent.
    console.warn("deleteTaskImage: object missing or not deletable", e);
  }
}

/** V19 — accepts images (except SVG) and PDF. */
export function isSupportedFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  if (!file.type.startsWith("image/")) return false;
  const bad = ["image/svg+xml"]; // potential XSS vector when rendered inline
  return !bad.includes(file.type);
}

/** @deprecated Use isSupportedFile instead. Kept for backward compat. */
export const isSupportedImage = isSupportedFile;

/** Check if a file is an image (not PDF). Used to decide compress vs raw upload. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/svg+xml";
}

// ---------- V26 — Hlášení media upload ----------

const REPORT_VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * V26 — upload foto/video pro hlášení.
 *
 *   - image: client-side compress jako uploadTaskImage (cache busting)
 *   - video: as-is, žádná komprese, max 50 MB (per V26 Mezera G=b)
 *
 * Storage path: `reports/{uid}/{reportId}/{filename}` (per storage.rules block).
 */
export async function uploadReportMedia(params: {
  file: File;
  uid: string;
  reportId: string;
}): Promise<{ url: string; path: string; contentType: string; kind: "image" | "video" }> {
  const { file, uid, reportId } = params;

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error(`Unsupported media type: ${file.type}`);
  }

  if (isVideo && file.size > REPORT_VIDEO_MAX_BYTES) {
    throw new Error(
      `Video too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 50 MB)`,
    );
  }

  let payload: Blob = file;
  let contentType = file.type;
  let extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";

  if (isImage) {
    payload = await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.8,
    });
    contentType = "image/webp";
    extension = "webp";
  }

  const unique =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  const path = `reports/${uid}/${reportId}/${unique}.${extension}`;
  const objectRef = ref(storage, path);

  await uploadBytes(objectRef, payload, {
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
  });

  const url = await getDownloadURL(objectRef);
  return { url, path, contentType, kind: isVideo ? "video" : "image" };
}

export async function deleteReportMedia(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn("deleteReportMedia: failed (continuing)", e);
  }
}
