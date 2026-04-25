/**
 * V18-S39 — single source of truth pro localStorage / sessionStorage klíče.
 *
 * Důvod existence: typo v key stringu je tichý bug — žádný error, jen
 * prázdný read / orphan write. Centralizace + konstanty + grep na jedno
 * místo eliminuje class of bugs.
 *
 * Naming convention: `<feature>:<purpose>[:<version>]` (lowercase,
 * dvojtečky jako separator, version suffix až když měníš shape dat
 * a chceš invalidovat staré cache).
 *
 * Když přidáváš nový klíč:
 *   1. Přidej entry sem (podle storage type — local nebo session).
 *   2. Pokud měníš shape existujícího klíče (např. JSON schema), zvedni
 *      verzi v suffixu — uživatelé s old cache pak prostě dostanou
 *      cache miss místo runtime exception.
 *   3. Zvaž, jestli klíč nepatří do dynamických helperů (např. filtery
 *      jsou keyed per-route → `FILTER_PREFIX` + suffix).
 */

// ---------- localStorage (persistent across sessions) ----------

export const LOCAL_STORAGE = {
  /** V18-S29 — cache user listu (přezdívky) pro instant render po reload. */
  usersCache: "users:cache:v1",
  /** V15.1 — kdy user naposledy zavřel notification permission banner. */
  notifBannerDismissedAt: "notif:bannerDismissedAt",
  /** V15 — stable client-generated device ID pro FCM registraci. */
  notifDeviceId: "notif:deviceId",
  /** V14.5 — autosave draft pro task composer. */
  taskDraft: "chytry-dum:capture-draft",
  /** V18-S02 — autosave draft pro event composer. */
  eventDraft: "draft:event:new",
  /** Theme preference (system/light/dark). */
  themePreference: "theme-preference",
} as const;

// ---------- sessionStorage (cleared on tab close) ----------

export const SESSION_STORAGE = {
  /** V18-S22 — version string aktuálního "settled" (post-update) state pro
   *  detekci dokončeného force-reload cyklu. */
  updateSettledVersion: "update:settledVersion",
} as const;

// ---------- Dynamic filter keys (sessionStorage, keyed per-route) ----------

/**
 * Filter klíče se skládají dynamicky — `filter:<routeKey>[:<facet>]`.
 * Helpery v `lib/filters.ts` to kompozují, ale pojmenování prefixu zde,
 * ať je v jednom souboru viditelné.
 *
 * Příklady reálných klíčů:
 *   filter:ukoly                     — open/closed state
 *   filter:ukoly:q                   — search query
 *   filter:ukoly:state               — ukol-specific state filter
 *   filter:ukoly:type                — type filter (otazka/ukol)
 *   filter:ukoly:owner               — moje/vsechny filter
 *   filter:ukoly:category            — category id
 *   filter:ukoly:location            — location id
 *   filter:napady:q                  — search query na záznamy
 *   filter:napady:category, :location, ...
 */
export const FILTER_KEY_PREFIX = "filter:";

/** Skládá `filter:<routeKey>[:<facet>]` — užívají call sites mimo lib/filters.ts. */
export function filterKey(routeKey: string, facet?: string): string {
  return facet
    ? `${FILTER_KEY_PREFIX}${routeKey}:${facet}`
    : `${FILTER_KEY_PREFIX}${routeKey}`;
}
