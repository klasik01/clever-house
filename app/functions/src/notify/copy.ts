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

/** Build FCM title + body + deep-link for a given event.
 *  V18 — deepLink je teď součástí výstupu (z katalogu), abychom ho
 *  nemuseli hardcodovat v send.ts. */
export function renderPayload(input: NotifyInput): {
  title: string;
  body: string;
  deepLink: string;
} {
  return renderNotification(input);
}
