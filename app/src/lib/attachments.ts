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

export async function deleteTaskImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    // Missing object is fine — treat delete as idempotent.
    console.warn("deleteTaskImage: object missing or not deletable", e);
  }
}

/** Quick client-side sanity check for allowed files before upload. */
export function isSupportedImage(file: File): boolean {
  if (!file.type.startsWith("image/")) return false;
  const bad = ["image/svg+xml"]; // potential XSS vector when rendered inline
  return !bad.includes(file.type);
}
