/**
 * V18-S40 — single source of truth pro app routes.
 *
 * Centralizace všech URL paths. Pro statické routy `ROUTES.foo`, pro
 * parametrizované helper funkce (`taskDetail("xyz")` → `"/t/xyz"`).
 *
 * Důvody existence:
 *   - Typo-safe odkazy. `ROUTES.zaznamy` se neuhodne; `"/zaznamy"` ano.
 *   - Renaming je atomic — změň hodnotu zde, IDE find-references na
 *     konstantu zachytí všechny použití.
 *   - "Co všechno za routy aplikace má?" — odpovídá zde, ne grep všech `<Route path=...>`.
 *
 * Konvence: lowercase Czech URL paths zachované (legacy + uživatelům
 * to dává smysl — `/zaznamy`, `/ukoly`, `/nastaveni`). Anglické jen
 * tam, kde je to product-driven (`/events`, `/event/:id`).
 *
 * **Při přidání nové routy**:
 *   1. Přidej entry do `ROUTES` (statické) nebo helper funkci (parametrizované).
 *   2. Updatuj `<Route path="..." />` v `App.tsx`.
 *   3. Pokud je routa role-gated, přidej guard wrapper v `App.tsx` jako
 *      ostatní (`HarmonogramForPm`, `LokaceManageForOwner` etc.).
 */

// ---------- Static routes (no params) ----------

export const ROUTES = {
  /** Home — pro OWNER zobrazí Lokace grid; PM rovnou redirect na /ukoly. */
  home: "/",

  /** Login route. */
  login: "/auth/prihlaseni",

  /** Záznamy — list nápadů (V3+ rename z /napady). */
  zaznamy: "/zaznamy",

  /** Úkoly — list otázek + úkolů (V14 merged). */
  ukoly: "/ukoly",

  /** Composer pro nový task (nápad/otázka/úkol). */
  novyTask: "/novy",

  /** Settings — top-level. */
  nastaveni: "/nastaveni",

  /** Settings → manage lokace (OWNER-only). */
  nastaveniLokace: "/nastaveni/lokace",

  /** Settings → manage document types (OWNER-only). */
  nastaveniTypyDokumentu: "/nastaveni/typy-dokumentu",

  /** Top-level kategorie list (OWNER-only). */
  kategorie: "/kategorie",

  /** Top-level lokace list (OWNER home root variant). */
  lokace: "/lokace",

  /** Export ZIP (OWNER-only). */
  export: "/export",

  /** PM-only views. */
  rozpocet: "/rozpocet",
  harmonogram: "/harmonogram",

  /** Events list. */
  events: "/events",

  /** Events composer (nový event). */
  eventsNew: "/events/new",

  // ---- Legacy redirects (kept for inbound links) ----
  /** Legacy → /zaznamy. */
  legacyNapady: "/napady",
  /** Legacy → /ukoly. */
  legacyOtazky: "/otazky",
  /** Legacy → /ukoly. */
  legacyPrehled: "/prehled",
} as const;

// ---------- Parametrized route builders ----------

/** Detail jednoho tasku. */
export function taskDetail(taskId: string): string {
  return `/t/${taskId}`;
}

/** Detail jednoho eventu. */
export function eventDetail(eventId: string): string {
  return `/event/${eventId}`;
}

/** Editace eventu — composer v edit mode. */
export function eventEdit(eventId: string): string {
  return `/event/${eventId}/edit`;
}

/** Detail kategorie (lista tasků s tou kategorií). */
export function kategorieDetail(categoryId: string): string {
  return `/kategorie/${categoryId}`;
}

/** Detail lokace (lista tasků s tou lokací). */
export function lokaceDetail(locationId: string): string {
  return `/lokace/${locationId}`;
}

// ---------- Pattern templates (pro <Route path={...}>) ----------

/**
 * `<Route path={ROUTE_PATTERNS.taskDetail}>` ↔ matched URL: `/t/abc`.
 * V routeru používáme tyto šablony; v `<Link to={...}>` a navigate()
 * voláme builder funkce.
 */
export const ROUTE_PATTERNS = {
  taskDetail: "/t/:id",
  eventDetail: "/event/:id",
  eventEdit: "/event/:id/edit",
  kategorieDetail: "/kategorie/:id",
  lokaceDetail: "/lokace/:id",
  catchAll: "*",
} as const;
