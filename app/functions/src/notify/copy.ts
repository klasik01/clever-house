/**
 * V16.7 — tenký wrapper nad NOTIFICATION_CATALOG v catalog.ts.
 *
 * Dřív obsahoval hardkódovaný switch per event — teď jen deleguje do katalogu.
 * Helpery (truncate, taskTitleOrFallback, commentPreview) re-exportujeme z
 * catalog.ts, aby existující importy (send.ts apod.) nepraskly.
 *
 * Když potřebuješ přidat/upravit copy pro existující event, dělej to v
 * catalog.ts — tam jsou všechny renderery pohromadě.
 */

import type { NotifyInput } from "./types";
import {
  renderNotification,
  truncate as truncateFromCatalog,
  taskTitleOrFallback as taskTitleOrFallbackFromCatalog,
  commentPreview as commentPreviewFromCatalog,
} from "./catalog";

export const truncate = truncateFromCatalog;
export const taskTitleOrFallback = taskTitleOrFallbackFromCatalog;
export const commentPreview = commentPreviewFromCatalog;

/** Build FCM title + body strings for a given event. */
export function renderPayload(input: NotifyInput): { title: string; body: string } {
  const { title, body } = renderNotification(input);
  return { title, body };
}
