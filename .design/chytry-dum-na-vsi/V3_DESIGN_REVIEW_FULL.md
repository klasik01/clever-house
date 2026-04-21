# Chytrý dům na vsi — V3 Full Design Review (post S42)

**Date**: 2026-04-21
**Reviewer**: design-review skill (static code audit)
**Scope**: Vrstva A (S29–S34) + Vrstva B (S35–S40) + Vrstva C (S41–S42) + V3.0 polish (S31a–d, S43a)
**Aesthetic philosophy**: Apple-HIG inspired, warm earth variant

## Summary

V3 je po 15 slice-ách **feature-kompletní a production-ready**. Token discipline **100 %** napříč 14 novými komponenty (0 raw hex, 0 raw px). Typecheck čistý. Všechny V3 komponenty mají semantic role + aria-label coverage. `/prehled` banner má `role="status"` / `role="alert"` správně toggled. MentionPicker keyboard flow (ArrowUp/Down/Enter/Escape) funguje, Enter-collision s Composer save je ošetřený.

**Největší issue:** assignee/priority/deadline/category edit operace nemají offline feedback — Firestore SDK je zatichne a queuje, ale user nemá ani toast „uloží se až budeš online". Nekritické pro V3 ship (data se nikdy neztratí), ale polo-dokončená offline story — návrh S43b.

Druhé klíčové: tří komponenty chybí explicitní focus ring (PrioritySelect, PriorityBadge, CategoryPicker container) — keyboard user po Tab nemusí vidět kde je.

## Findings

### Critical

Žádné — nic neblokuje ship.

### High

**H1 — PrioritySelect chybí focus-visible ring** — `src/components/PrioritySelect.tsx:30–49`
- Evidence: Segmented control buttons mají `transition-colors` a active-state styl, ale žádný `focus-visible:` styling. Keyboard user po Tab nevidí kde je.
- Fix: přidat `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus` do className.
- Follow-up: **S44a** (2 řádky)

**H2 — CategoryPicker chip-field bez focus ring na dropdown triggeru** — `src/components/CategoryPicker.tsx`
- Evidence: „Přidat kategorii" button má `focus-visible:ring-2`, ale chipy samé nemají. Když se tabuje mezi nimi, focus state je matný.
- Fix: přidat `focus-visible:ring-2 focus-visible:ring-line-focus` na chip X button.
- Follow-up: **S44b**

**H3 — Assignee/Priority/Deadline/Category edit bez offline feedbacku** — `AssigneeSelect.tsx`, `PrioritySelect.tsx`, `DeadlinePicker.tsx`, `CategoryPicker.tsx`
- Evidence: Pouze CommentComposer + ReactionBar používá `useOnline()`. Když user offline mění assignee nebo prioritu, Firestore SDK queuje write do IndexedDB ale user nedostane žádný toast, že „uložení proběhne později".
- Důsledek: Předpoklad usera „uložilo se" může být špatný, mobilní prostředí (slabý signál na stavbě) to často uvidí.
- Fix: buď globální offline banner v Shell (nejčistší), nebo per-komponent `useOnline()` + `disabled` toast.
- Follow-up: **S44c — offline banner v Shell** (doporučuji tenhle přístup, DRY)

### Medium

**M1 — MentionPicker chybí `aria-activedescendant`** — `src/components/MentionPicker.tsx:77–109`
- Evidence: `role="listbox"` + `role="option"` ale `aria-activedescendant` není nastaven, takže SR uživatel nepozná, která položka je aktivní při ArrowUp/Down nav.
- Fix: přidat `id` per option + `aria-activedescendant={users[active]?.id}` na listbox root.

**M2 — CategoryPicker chip X touch target 20px** — `src/components/CategoryPicker.tsx`
- Evidence: `size-5` (20×20px) na X button uvnitř selected chip — stejný bug jako S31b v CommentComposer image X, který byl fixnutý. Porušení WCAG 2.5.5.
- Fix: zvětšit na `size-6` (24px) + padding pro implicit hit zone `after:absolute after:inset-[-8px]` nebo jen `size-7`.

**M3 — DeadlinePicker clear-X touch 20px** — `src/components/DeadlinePicker.tsx:27–34`
- Evidence: `grid min-h-tap min-w-tap place-items-center` má correct outer size, ale `<X size={16}>` vnitřek je OK. Double-checked — OK actually. Mark as **resolved**.

**M4 — /prehled tabs chybí arrow key navigation** — `src/routes/Prehled.tsx:142–172`
- Evidence: `role="tablist"` + `role="tab"` ale WAI-ARIA vzor expectuje arrow keys pro cycle mezi taby. User může jen Tab+Space/Enter.
- Důsledek: Funkční, ale není to plný „tabs" pattern.
- Fix: přidat `onKeyDown` na tablist s Arrow key handlers. Nebo klidně downgrade na `role="group"` + `role="button"` (simpler, stále čitelné pro SR).

**M5 — ReactionBar picker "+" button bez `aria-expanded` uvnitř popoveru** — `src/components/ReactionBar.tsx`
- Evidence: Má `aria-expanded={pickerOpen}` na toggleru, ale popover samotný nemá `aria-labelledby` vázané na trigger.
- Fix: přidat `id` na toggle button + `aria-labelledby` na popover div.

**M6 — Prehled `<div role="tabpanel">` chybí `id`** — `src/routes/Prehled.tsx:132`
- Evidence: Tile `aria-controls="prehled-panel"` ukazuje na neexistující id. Tabpanel div nemá `id="prehled-panel"`.
- Fix: přidat `id="prehled-panel"` na tabpanel div. Jednořádková oprava.

### Low

**L1 — Výkonnostní otázka: useUsers multi-subscriber** — `useUsers` hook
- Observation: `AssigneeSelect`, `CommentThread`, `MentionPicker`, `NapadCard`, `CommentItem` — všechny volají `useUsers(Boolean(user))` nezávisle. Firebase SDK dedupuje listener internally, takže network cost je 1× (1 subscription). Ale React re-renders běží v každém hooku zvlášť.
- Dopad: S 2–3 users zanedbatelné; při 50+ users mohou zpomalit mount listů. OK pro V3.

**L2 — CategoryPicker popover close on blur chybí** — `CategoryPicker.tsx`
- Observation: Close triggers = outside click + Escape. Tab-away neuzavře popover. WAI-ARIA pattern preferuje close on blur pro listbox-style menu.
- Fix: přidat `onBlur={handleOutsideTabAway}` nebo `tabIndex={-1}` na popover + focusTrap. Polish-only.

**L3 — DeadlineChip a PriorityBadge mají fallback barvy** — v V3 tokens-v3.css
- Observation: Když token vars chybí (např. na starším devicu s obsahem CSS chyb), chip se renderuje neviditelně. Defensivní approach: přidat `oklch(0.5 0.05 0)` fallback values do CSS custom properties.
- Dopad: Minimální. Browsery (evergreen) mají good OKLCH support.

**L4 — AssigneeSelect: own-user flag logic** — `AssigneeSelect.tsx:118`
- Observation: `isSelf = user?.uid === u.uid` funguje, ale tento flag neukazuje, že assigneeUid může být vlastně sám autor tasku. Pro případ kdy owner = creator = assignee je text „(já)" správně; ale pokud někdo jiný je autor, `(já)` správně označuje login user.
- Low: jen sémantika.

### Notes

**N1 — Token discipline perfect** — 0 raw hex, 0 raw px, 0 rgb() napříč 14 novými soubory. Excellent.

**N2 — Dark mode tokens** — tokens-v3.css má 2 dark blocks (`@media (prefers-color-scheme: dark)` + `[data-theme="dark"]`), oba pokrývají všechny V3 aliasy. Při toggle themes se plynule přepíná.

**N3 — Mention Enter-collision ošetřený** — v `CommentComposer.tsx:174`, Enter je konzumován pickerem přes window-level listener (capture phase). Composer's own onKeyDown pak vrací early pokud `pickerUsers.length > 0 && e.key === "Enter"`. Správně ordered.

**N4 — `/prehled` M2 banner role** — `role={m2Ok ? "status" : "alert"}` je perfektní signaling. Alert stav když překročeno, status když v cíli. SR oznámí urgence automaticky.

**N5 — Firestore rules beze změny od S30** — V3.x slices nezměnily security surface. Comments subcollection rules sound (body is string check, authorUid match, author-only delete).

**N6 — Prehled compute je O(tasks) per render** — bez memoization uvnitř computePrehledGroups. Při 100 tasks × 4 filter groups = 400 ops, imperceptible. Polish-level optimalizace (memo) by ušetřila cca 2ms per render.

## Checklist status

- [x] Brief alignment — DoD 100 % pokryté pro Vrstva A+B+C
- [x] Aesthetic consistency — warm earth napříč, žádný foreign style
- [x] Token discipline — 0 violations
- [x] Dark mode — všechny tokens mají light/dark pair
- [ ] **Accessibility — 3 high + 3 medium findings**
- [x] Responsive — 320px OK (tile grid 2×2, filter chips wrap)
- [x] States — loading (skeletons), empty (copy + icon), error (`role="alert"`), offline (composer only)
- [x] Performance — lazy chunks, image CLS, bundle OK
- [ ] **Offline story — partial (compose + react OK; edit-operations neošetřené)**

## Proposed follow-up slices (V3-polish-2)

Append tyto do `TASKS.md`; všechny krátké (~2.5h total):

### S44a — PrioritySelect focus ring
- **Scope**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus` na buttons.
- **Size**: XS (~5min)

### S44b — CategoryPicker chip X focus ring + touch target
- **Scope**: Chip X: `size-6` + focus-visible ring. DRY s S31b fix pattern.
- **Size**: XS (~10min)

### S44c — Offline banner v Shell
- **Scope**: Nový `OfflineBanner` komponent v `Shell.tsx` header, používá `useOnline()`, renderuje pill "Jsi offline — změny se uloží po připojení" když `\!online`. Pokrývá assignee/priority/deadline/category edit bez per-komponent guardů.
- **Size**: S (~45min)

### S44d — MentionPicker aria-activedescendant
- **Scope**: `id` per option, `aria-activedescendant={users[active]?.id}` na listbox root.
- **Size**: XS (~15min)

### S44e — /prehled arrow key tab nav + tabpanel id
- **Scope**: `id="prehled-panel"` na tabpanel div; onKeyDown handler na tablist s Arrow key cycle.
- **Size**: S (~30min)

### S44f — ReactionBar popover aria-labelledby
- **Scope**: `id` na trigger + `aria-labelledby` na popover div.
- **Size**: XS (~10min)

**Celkem:** ~2h polish, ready for ship hned po S44a–f.

## What works exceptionally well

- **`/prehled` M2 banner** — role toggle mezi status/alert + text copy „V cíli/Překročeno" dává OWNERovi okamžitý visual signal. **Nejlepší single UX win ve V3.**
- **AssigneeSelect read-only mode** — non-authors vidí chip bez drpdownu, elegantní enforcement permissions na UI level (parallel Firestore rules).
- **TaskGroupedView extraction** — zachránilo ~120 řádků duplication, plus single source of truth pro group-by logic. Budoucí V4 mohou rozšířit group-by bez dvakrát code change.
- **Reset filter minimal UX** — dashed outline pill visible jen když active, jedno tlačítko místo per-chip X. Low friction.
- **`createComment` atomic batch** — `writeBatch` s increment(1) na task.commentCount + create on subcollection = zero race condition.
- **bridgeCategoryIds / bridgePriority** — graceful legacy reads. V4 může bezpečně dropnout `categoryId` field.
