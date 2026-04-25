/**
 * V18-S39 — magic numbers s business meaning na jednom místě.
 *
 * Čeho se to týká:
 *   - Konstanty, které mají sémantický význam (image size limit,
 *     cache TTL, "considered active" window) a opakují se nebo by se
 *     měly mirrorovat v jiných vrstvách (Firestore rules, server CF).
 *   - NE technické konstanty bez business významu (např. setTimeout
 *     pro animaci, debounce ms — ty zůstávají u call site jako lokální
 *     `const`, jejich globalizace je over-engineering).
 *
 * Pravidlo palce: **pokud konstanta má cross-file význam nebo musí
 * být v sync s jiným systémem (rules, CF, ICS spec), patří sem.**
 *
 * Při změně:
 *   - `imageMaxBytes` → updatuj i `app/deploy/storage.rules`!
 *   - `calendarSubscriptionActiveWindowMs` → coordinuj s tím, co server
 *     CF pro `calendarLastFetchedAt` zapisuje (throttling).
 */

// ---------- Time units (helpers, ne sami konstanty) ----------

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------- Storage / upload limits ----------

/**
 * Max velikost uploadovaného image přílohy. **Mirror se storage.rules:**
 *   match /images/{uid}/{taskId}/{filename} {
 *     allow write: ... && request.resource.size < <THIS VALUE>;
 *   }
 * Klient pre-checkuje, server tvrdě enforces. Pokud zvýšíš tady, **musíš**
 * zvednout i v rules — jinak rules zamítnou upload.
 */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------- Cache TTLs ----------

/**
 * V18-S29 — TTL pro localStorage cache user listu (přezdívky). Po této
 * době se cache invaliduje a komponenty zobrazí loading state, dokud
 * nedorazí Firestore snapshot. Dostatečně dlouhé na typický usage cyklus
 * (otevři aplikaci za den, ne za týden).
 */
export const USERS_CACHE_TTL_MS = 1 * HOUR;

/**
 * V15.1 — jak dlouho po dismiss banneru ho neukazujeme. 7 dní = user
 * měl klid, ale neztratíme upozornění natrvalo (browser permission se
 * občas resetne, banner zase dává smysl).
 */
export const NOTIF_BANNER_DISMISS_COOLDOWN_MS = 7 * DAY;

// ---------- Subscription / activity windows ----------

/**
 * V18-S25 — kalendář subscription detekce. CF zapisuje
 * `users/{uid}.calendarLastFetchedAt` při každém fetch (throttled na 1× za
 * hodinu). Pokud `now - lastFetchedAt < 25h`, považujeme subscription za
 * aktivní. 25h = 24h + tolerance pro jeden missed fetch (network glitch,
 * iCloud sync delay).
 */
export const CALENDAR_SUBSCRIPTION_ACTIVE_WINDOW_MS = 25 * HOUR;

/**
 * Threshold pro "uvízlý" task v Přehled dashboardu. Task bez aktivity (žádný
 * komentář, žádný edit) déle než tento limit se ukáže v "Stuck" pillu.
 *
 * 5 dní (V10/V14 origin) — kratší by spamoval, delší by zapomněl
 * na opravdu zaseknuté nápady.
 */
export const STUCK_TASK_THRESHOLD_DAYS = 5;
export const STUCK_TASK_THRESHOLD_MS = STUCK_TASK_THRESHOLD_DAYS * DAY;

// ---------- Re-exports time units pro callers ----------
// Pokud lokálně potřebuješ jen "1 hodina v ms", importuj `MS_PER_HOUR`
// místo psaní `60 * 60 * 1000`. Šetří boilerplate i čitelnost.

export const MS_PER_SECOND = SEC;
export const MS_PER_MINUTE = MIN;
export const MS_PER_HOUR = HOUR;
export const MS_PER_DAY = DAY;
