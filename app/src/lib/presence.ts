/**
 * V16.9 — presence-aware suppression helpers.
 *
 * "Presence" = user má otevřený tab a aktivně kouká. Dva kousky logiky:
 *
 *   1) Extrahovat z path zda jsem na detailu tasku a jaký je to taskId.
 *      Pattern: /t/{id} nebo /t/{id}#comment-{cid}. Pure funkce, testovatelná.
 *
 *   2) Rozhodnout, zda pro daný inbox item v unread sadě má smysl ho
 *      auto-mark-readnout při aktuálním view. Pravidlo: je na /t/{id}
 *      a item.taskId === id. Ostatní (listing, jiný task, settings) ne.
 *
 * SW post-message handler žije v useInboxAutoRead hook; tenhle soubor je
 * pure logika, aby testy nevyžadovaly jsdom + service worker.
 */

/** Vrátí taskId pokud je pathname ve tvaru /t/{id} (s případným # suffixem),
 *  jinak null. */
export function taskIdFromPath(pathname: string): string | null {
  // Očekávané tvary:
  //   /t/abc123
  //   /t/abc123/
  //   /t/abc123#comment-x
  // Také akceptuj prefixovaný base path (GitHub Pages): /clever-house/t/abc123
  const m = pathname.match(/\/t\/([^/#?]+)/);
  return m ? m[1] : null;
}

/**
 * Rozhodne, zda se má inbox item pro konkrétní task auto-readnout, když
 * jsem aktuálně na určité cestě. Pure — žádný DOM, žádný router.
 */
export function shouldAutoReadOnPath(
  pathname: string,
  itemTaskId: string,
): boolean {
  return taskIdFromPath(pathname) === itemTaskId;
}
