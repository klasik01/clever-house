import { newId } from "@/lib/id";
import { createTask, updateTask } from "@/lib/tasks";
import { uploadTaskImage } from "@/lib/attachments";
import type { ImageAttachment, TaskType } from "@/types";

/**
 * Shared Composer → Firestore save flow.
 * Used by Home (Zachyt) and Lokace. Notion-style title split:
 * first line → title (max 120 chars), rest → body.
 *
 * Throws on fatal create error; image upload failures are logged and
 * reported via the optional `onImageUploadError` callback.
 */
export async function createTaskFromComposerInput(opts: {
  text: string;
  type: TaskType;
  imageFiles: File[];
  linkUrls: string[];
  uid: string;
  onImageUploadError?: () => void;
}): Promise<string> {
  const { text, type, imageFiles, linkUrls, uid, onImageUploadError } = opts;

  const lines = text.split("\n");
  const firstLine = lines[0].trim();
  const rest = lines.slice(1).join("\n").trim();
  const parsedTitle = firstLine.slice(0, 120);
  const parsedBody = rest || (firstLine.length > 120 ? firstLine : "");

  // V14 — seed status by type.
  //   nápad  → "Nápad" (legacy label, still canonical for this type)
  //   otázka → "OPEN"  (V10 canonical)
  //   úkol   → "OPEN"  (V14 canonical, same set as otázka)
  const seedStatus =
    type === "napad" ? "Nápad" : "OPEN";
  const taskId = await createTask(
    {
      type,
      title: parsedTitle,
      body: parsedBody,
      status: seedStatus,
    },
    uid
  );

  if (imageFiles.length > 0) {
    const uploaded: ImageAttachment[] = [];
    for (const file of imageFiles) {
      try {
        const { url, path } = await uploadTaskImage({ file, uid, taskId });
        uploaded.push({ id: newId(), url, path });
      } catch (e) {
        console.error("image upload failed", e);
        onImageUploadError?.();
      }
    }
    if (uploaded.length > 0) {
      await updateTask(taskId, { attachmentImages: uploaded });
    }
  }

  if (linkUrls.length > 0) {
    await updateTask(taskId, { attachmentLinks: linkUrls });
  }

  return taskId;
}
