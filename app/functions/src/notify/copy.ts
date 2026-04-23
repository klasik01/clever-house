import type { NotifyInput } from "./types";

/**
 * V15 — notification copy helpers. Czech, "style 2" (direct conversational)
 * per discovery decision: title carries actor + context, body carries the
 * actual content (first sentence of the comment or task body) so the user
 * doesn't need to open the app for quick reads.
 *
 * Body is truncated at ~120 chars with ellipsis. iOS lockscreen wraps to
 * ~2 lines at typical font sizes; over-long bodies get mid-word cut and
 * look terrible.
 */

const BODY_MAX = 120;

/** Fallback title when task has none — uses first line of body, or "[bez názvu]". */
export function taskTitleOrFallback(
  title?: string | null,
  body?: string | null,
): string {
  const t = (title ?? "").trim();
  if (t) return t;
  const firstLine = (body ?? "").split("\n")[0]?.trim();
  if (firstLine) return truncate(firstLine, 60);
  return "[bez názvu]";
}

/** First sentence (or first line), truncated to BODY_MAX. */
export function commentPreview(commentBody: string): string {
  const first = commentBody.split(/\n|\. |\? |! /)[0] ?? "";
  return truncate(first.trim(), BODY_MAX);
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

/** Build FCM title + body strings for a given event. */
export function renderPayload(input: NotifyInput): { title: string; body: string } {
  const taskTitle = taskTitleOrFallback(input.task.title, input.task.body);
  const actor = input.actorName || "Někdo";

  switch (input.eventType) {
    case "assigned":
      return {
        title: `${actor} ti přiřadil úkol`,
        body: `${taskTitle} — otevři a pojď do toho`,
      };
    case "comment_on_mine":
      return {
        title: `${actor} komentoval: ${truncate(taskTitle, 50)}`,
        body: commentPreview(input.comment?.body ?? ""),
      };
    case "comment_on_thread":
      return {
        title: `${actor} v diskuzi: ${truncate(taskTitle, 50)}`,
        body: commentPreview(input.comment?.body ?? ""),
      };
    case "mention":
      return {
        title: `${actor} tě zmínil: ${truncate(taskTitle, 50)}`,
        body: commentPreview(input.comment?.body ?? ""),
      };
    case "shared_with_pm":
      return {
        title: `Nový sdílený nápad: ${truncate(taskTitle, 60)}`,
        body: commentPreview(input.task.body ?? ""),
      };
  }
}
