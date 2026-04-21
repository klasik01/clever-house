# Chytrý dům na vsi — V3.0 Design Review

**Date**: 2026-04-21
**Reviewer**: design-review skill (static code audit — no running server / Playwright in this session)
**Scope**: Slices S29 (Schema + AvatarCircle), S30 (Comment data layer + rules), S31 (Comment thread UI) — V3.0 milestone
**Aesthetic philosophy**: Apple-HIG inspired, warm earth variant (pokračuje z V1/V2)

## Summary

V3.0 core flow (OWNER ↔ PM diskuse) je funkčně kompletní a postavený čistě. **Token discipline je 100%** — žádný raw hex, žádný `rgb()`, žádný tvrdý px literál v nových souborech (AvatarCircle, Comment*). Sémantické elementy (`<section>`, `<article>`, `<header>`, `<h2>`), aria-label na ikonových buttonech, htmlFor + sr-only labels na formech. Firestore rules mají čistou role separation s V3 author-based edit model.

**Největší issue:** `Send` tlačítko v CommentComposeru nelze ovládat klávesnicí standardně (žádný `<form onSubmit>` wrapper, žádný `Cmd/Ctrl+Enter` handler). Na mobile není nejhorší, ale desktop user frustrace je zaručena. Fix je 5 řádků — viz High 1.

Druhé kritické: **`navigator.onLine` není reaktivní** — pokud user ztratí signál *po* otevření detail page, composer neoznačí offline, protože stav je snapshot z render momentu, ne live listener. Reliable S43 slice (offline guards) už má v TASKS.md, ale tento konkrétní bug doporučuji přetáhnout ven.

## Findings

### Critical

Žádné — nic neblokuje ship.

### High

**H1 — Send button není keyboard-operable** — `src/components/CommentComposer.tsx:225–233`
- Evidence: Send je `<button type="button">` mimo form wrapperu; nemá onKeyDown listener na textarea pro Cmd/Ctrl+Enter.
- Důsledek: Desktop user musí sáhnout na myš pokaždé. Porušuje WCAG 2.1.1 (Keyboard).
- Fix: wrap composer do `<form onSubmit={handleSubmit}>`, change Send na `type="submit"`. Alternativa: onKeyDown na textarea — `if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit()`.
- Follow-up slice: **S31a — keyboard shortcuts pro composer**

**H2 — Image remove button touch target 20px** — `src/components/CommentComposer.tsx:162–169`
- Evidence: `size-5` (20×20px) na removal X button v staged image grid. WCAG 2.5.5 doporučuje 44×44px pro mobile.
- Důsledek: OWNER na mobilu nedokáže přesně tapnout — riziko náhodného tapnutí na sousedí preview.
- Fix: zvětšit na `size-8` (32px) plus `p-1` pro extended hit area, nebo posunout X mimo obrázek do chipu pod ním.
- Follow-up slice: **S31b — mobile touch target audit composer**

**H3 — `navigator.onLine` not reactive** — `src/components/CommentThread.tsx:30`
- Evidence: `const offline = typeof navigator \!== "undefined" && navigator.onLine === false;` — computed once per render, ale nevolá se znovu, když se stav změní (žádný event listener).
- Důsledek: User ztratí signál during composition → composer zůstává `enabled`, klik Send vyvolá failed write (který Firestore SDK ztiší ale comment se nikdy neuloží bez zpětné vazby).
- Fix: `useOnline()` hook s `window.addEventListener("online"/"offline")` — už plánovaný v S43, ale doporučuji ho přetáhnout do S31 hot-fix.
- Follow-up slice: **S43a (předtáhnout)** — `useOnline` hook + wire

### Medium

**M1 — Textarea focus není explicitně visible** — `src/components/CommentComposer.tsx:148`
- Evidence: `focus:outline-none` odstraňuje outline bez náhrady (žádný `focus:border-line-focus` jako má CommentItem edit textarea na line 95).
- Důsledek: Keyboard user neví, zda je textarea focusovaná — porušuje WCAG 2.4.7.
- Fix: přidat `focus:border-line-focus` + `focus:ring-2 focus:ring-line-focus` (anebo wrap do diváckého wrapperu s `focus-within:`).

**M2 — Edit button text "Uloženo"** — `src/components/CommentItem.tsx:114`
- Evidence: `{saving ? t("composer.saving") : t("kategorie.saveHint")}` — `kategorie.saveHint` je *past-tense* „Uloženo", nevhodné pro action button.
- Důsledek: User čte „Uloženo" a není si jistý, zda už je uloženo nebo má kliknout pro uložení.
- Fix: přidat i18n klíč `comments.saveEdit` = „Uložit změny" a použít tu.

**M3 — Cancel edit button label** — `src/components/CommentItem.tsx:122`
- Evidence: `{t("detail.back")}` = „Zpět" — sémanticky Cancel, ne Back. Porušuje princip „word match the user's expectation".
- Fix: použít nový klíč `comments.cancel` = „Zrušit".

**M4 — Plural forms nezachyceny** — `src/i18n/cs.json` `comments.count` = "Diskuse ({n})"
- Evidence: Aktuálně sidestepped formát „Diskuse (3)" bez plurálu. Sémanticky fungující, ale neextendable pokud i18n evolve (např. „3 komentáře" vs. „1 komentář" vs. „5 komentářů" v češtině).
- Důsledek: Pouze pokud později chceš přirozenější text — pro V3 OK jak je.
- Fix: později zaměnit na ICU plural `{n, plural, one {# komentář} few {# komentáře} other {# komentářů}}` (wait na i18n library upgrade).

### Low

**L1 — AvatarCircle fallback na email local part** — `src/components/AvatarCircle.tsx:82`
- Evidence: `src = (displayName ?? "").trim() || (email ?? "").split("@")[0]` — pokud user nemá displayName, aria-label říká jen část emailu (např. „Uživatel foo"). Přijatelné, ale méně vstřícné než čekat na displayName.
- Fix: nutit displayName při user profile seed (existing users potřebují manual update v Firestore).

**L2 — CommentItem plain pre-wrap rendering** — `src/components/CommentItem.tsx:108`
- Evidence: `<p className="whitespace-pre-wrap break-words text-sm text-ink">{comment.body}</p>` — markdown marks (`**bold**`) renderují doslovně.
- Důsledek: Intentional per S31 scope (plain markdown). V4+ může přidat markdown render. **Note only.**

**L3 — Body staging URL leak edge case** — `src/components/CommentComposer.tsx:111–116`
- Evidence: Pokud `onSubmit` throwne, `setStagedImages([])` se nevolá, ale `URL.revokeObjectURL` v reset bloku se už přeskočil. Blob URLs leak do unmountu.
- Důsledek: Memory leak pouze v error scenario. Minor.
- Fix: wrap `URL.revokeObjectURL` do cleanup useEffect + always-revoke on unmount loop (jako má `Composer.tsx`).

**L4 — Dark mode token duplication** — `src/styles/tokens-v3.css:73–119` (force-dark) + `:root[data-theme="dark"]` identical body
- Evidence: Standard pattern s vite-plugin-pwa theming — obě sekce musí duplikovat values pro `@media (prefers-color-scheme: dark)` + explicit `data-theme="dark"` override.
- Note only: tech debt acceptable, matches V2 approach.

### Notes

**N1 — Firestore rules defensive `body.size() > 0` check** — `app/firestore.rules:57–58`
- Observation: Create rule checks `request.resource.data.body is string` ale neblokuje empty string. UI ochrana přes `canSend = body.trim().length > 0`. Defense-in-depth by přidala `request.resource.data.body.size() > 0` do rules.
- Risk: Low — UI je primary gate, empty comments nepoškodí data.

**N2 — useComments bez pagination** — `src/hooks/useComments.ts:18`
- Observation: Celá subcollection loadovaná najednou. Per S45 plán pagination při >50.
- OK pro V3.0.

**N3 — useUsers subscribe cost** — `src/hooks/useUsers.ts:15`
- Observation: Listener na `/users` collection pořád aktivní napříč celým app-em přes CommentThread. S 2-3 users zanedbatelné; skaluje lineárně.
- OK.

**N4 — Image CLS prevention** — `CommentItem.tsx:135`
- Positive: `width={120} height={120}` + `loading="lazy"` + `decoding="async"` — správně nastaveno.

**N5 — Semantic landmarks** — CommentThread má `<section>`, CommentItem má `<article>` — struktura čitelná pro SR.

## Checklist status

- [x] Brief alignment — S29/S30/S31 acceptance criteria 100% pokryté
- [x] Aesthetic consistency — warm earth palette, Apple-HIG density, no foreign styles
- [x] Token discipline — 0 raw hex, 0 raw px, 100% tokens
- [x] Dark mode — tokens-v3.css má light/dark pairs, `@media` + `[data-theme]` dual gates
- [ ] **Accessibility — 4 failings: H1 (keyboard), H2 (touch target), M1 (focus ring), M2/M3 (button labels)**
- [x] Responsive — 320px OK (3-col image grid = 90px each, textarea auto-grow), no overflow
- [x] States — loading (3 skeletons), empty (copy + tone), error (role="alert")
- [x] Performance & polish — lazy chunk (Suspense), image lazy+CLS, minimal bundle adds

## Proposed follow-up slices

Append tyto do `TASKS.md` před pokračováním na S32:

### S31a — Composer keyboard shortcuts
- **Goal**: Cmd/Ctrl+Enter send z textarea.
- **Scope:** `CommentComposer.tsx` — onKeyDown handler, Send button → `type="submit"` s form wrapper.
- **Size**: XS (~30min)

### S31b — Composer mobile touch targets
- **Goal**: Remove X buttons na staged images mají 44×44 hit area.
- **Scope:** `size-8 + p-1` nebo absolute `after:inset-[-12px]` pro extended touch.
- **Size**: XS (~20min)

### S31c — Focus-visible borders na comment composer textarea
- **Goal**: Keyboard user vidí focus.
- **Scope:** `focus:border-line-focus focus:ring-2 focus:ring-line-focus` nebo wrapper.
- **Size**: XS (~10min)

### S31d — Comment edit button labels i18n
- **Goal**: „Uložit změny" / „Zrušit" jako správné akční verby.
- **Scope:** cs.json nové klíče, CommentItem.tsx dvě lines change.
- **Size**: XS (~15min)

### S43a — `useOnline` hook (přetáhnout ze S43)
- **Goal**: Reaktivní offline detection přes `navigator.onLine` + event listeners.
- **Scope:** `src/hooks/useOnline.ts`, wire do CommentThread + CommentComposer.
- **Size**: S (~1h)

**Total follow-up ≈ 2h** před pokračováním na S32 @mention.

## What works well (praise section)

- **AvatarCircle** je elegantní primitive: 20 řádků funkce, deterministický hash, dark-mode auto via CSS vars.
- **`toggleReaction` transaction** v `lib/comments.ts` je race-safe. Rare to see correctly implemented.
- **`bridgePriority` bridge** — default `"P2"` jen pro otázky, `undefined` pro nápady — elegantní encoded invariant v types.
- **Firestore rules separation** — `isTaskAuthor()` helper + mixed `pmAllowedFields()` override zachovává V2 PM flow.
- **Comment subcollection cascade delete** — Storage cleanup před Firestore delete = žádné orphan obrázky. Textbook.
