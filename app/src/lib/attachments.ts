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
