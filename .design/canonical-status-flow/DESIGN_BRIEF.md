# V25 — Canonical Status & Action Flow

**Date**: 2026-04-29
**Author**: Stanislav Kasika (proposal: Codequ)
**Status**: Draft → Implementing

---

## 1. Problem

Workflow otázka/úkol je matoucí — uživatelé (manželka, PM) se opakovaně
ptají, "kdo je na tahu" a "co znamená Rozhodnuto vs Hotovo". Status set
má 12 hodnot (V10 + 8 legacy), polovina dvojí význam. Magické auto-flips
v komentářích způsobují, že stav se mění bez vědomé akce.

## 2. Primary User

OWNER manželka + PROJECT_MANAGER + CONSTRUCTION_MANAGER. Stáňa už
workflow chápe; cíl je odstranit jeho interní mentor role.

## 3. Success Metric (90 days)

> **PM a OWNER manželka se nikdy nezeptají Stáňy "kdo je na tahu" — vidí
> z assignee chip + status badge přímo.**

## 4. Scope

### In scope (V25)

- `TaskStatus` union zúžit na **4 canonical**: `OPEN | BLOCKED | CANCELED | DONE`.
- `Comment.workflowAction` enum **rozšířit na 6**: `null | "flip" | "complete" | "block" | "reopen" | "cancel"`.
- Hard migrace všech tasků v dev + ope (`pending/V25-canonical-status.mjs`):
  - `Čekám | Ve stavbě | Otázka | Nápad | ON_CLIENT_SITE | ON_PM_SITE` → `OPEN`
  - `Rozhodnuto | Hotovo` → `DONE`
  - Existing `OPEN | BLOCKED | CANCELED | DONE` → kept
- `lib/status.ts` simplify — mapLegacyOtazkaStatus returns canonical (defense in depth pro latent reads).
- `CommentComposer` redesign — multi-action picker (6 actions) místo 2-button (flip/close).
- `StatusPickerInline`, `StatusBadge`, `StatusFilterChip` ukazují 4 hodnoty.
- 5 nových notifikačních eventů + catalog entries + recipient logic + i18n.
- BLOCKED rule: "vyžaduje komentář s důvodem" (klient validace, server jen typecheck).
- Reopen flow: vybírá nového assigneeho (může být sám reopener).
- CM akce: stejné jako PM (revert V24 "jen Hotovo" omezení) — full 6-action komentář.
- i18n cs.json — odstranit legacy klíče (Čekám, Rozhodnuto, Ve stavbě), přidat nové akce + statusy.

### Out of scope

- napad workflow (B=C — napad zůstává s vlastním lifecyclem; jen status field se přemapuje na canonical při migraci, ale UI flow napadu stays).
- dokumentace (žádný status workflow, V19).
- Rozdělení komentářů na "obyčejné vs akční" jako schema diff. Workflow action je optional field na komentu (pre-existing pattern).
- Auto-reminder pro stale tasky.
- `Stuck` / `Overdue` analytics (mrtvé `Prehled` route už smazané).

## 5. Constraints

- Soft deadline.
- Claude komplet.
- Hot deploy přes git push.
- Žádný nový npm dependency.
- Migrace přes existující deploy orchestrator (`pending/` workflow).
- Zachovat backward read-compat: `fromDocSnap` mapuje legacy hodnoty na canonical pro případ unmigrovaných tasků (paranoia).

## 6. Tone & Aesthetic

Žádná změna brand. Action buttons použijí existující `accent` color +
neutral. Důraz na "vědomou akci" — žádné magické flips.

## 7. Content & Data

- Existing tasks: ~100. Migrace přepíše `status` field na canonical.
- Existing comments: ~200. workflowAction zůstává neporušená — stávající
  hodnoty `"flip"` / `"close"` mapujeme: `"close"` → `"complete"` (clearer).
- i18n: ~40 stringů přidat/změnit/smazat.
- Notification inbox: existující záznamy nezměníme (immutable). Nové eventy
  jen pro nově vznikající.

## 8. Definition of Done

- [ ] `TaskStatus` union v `types.ts` má jen 4 hodnoty.
- [ ] `Comment.workflowAction` enum má 6 hodnot.
- [ ] Migrace nasazena na dev + ověřena: 0 tasků s legacy statusem.
- [ ] CommentComposer ukáže 6 akcí kontextově (per current status).
- [ ] StatusPickerInline + StatusBadge + StatusFilterChip ukazují 4 statusy.
- [ ] BLOCKED přechod vyžaduje neprázdný comment body.
- [ ] Reopen flow otevírá assignee picker.
- [ ] 5 nových notifikačních eventů funguje (push + inbox + i18n).
- [ ] Pure-helper test pro každou novou akci.
- [ ] OWNER + PM smoke test bez regresí.
- [ ] CM smí Předat / Hotovo / Blokováno / Reopen — verified UI.
- [ ] `npm test` projde.

## 9. Risks

1. **Migrace** — přepsat 100+ tasků v ostrém. Riziko bug v mapping table. Mitigace: dry-run flag, audit.
2. **CommentComposer redesign** — UX rozhodnutí (button row vs dropdown vs context-aware). Riziko nadbytečné UI.
3. **Notification recipient logic** — 5 nových eventů × dedupe priority. Catalog drift risk.
4. **Tests breaking** — ~40 testů odkazuje legacy statusy. Hard refactor.
5. **CM revert** — V24 S07 měla CM jen Hotovo. Teď extending — risk regrese pokud někde jsou hardcoded jen-Hotovo gates.
