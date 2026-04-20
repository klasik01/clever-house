# V2 DISCOVERY — Chytrý dům na vsi

**Date:** 2026-04-20
**Prerequisite:** MVP (S01–S22 + polish) shipped.

## Scope summary

Uživatel požádal o rozšíření MVP. Po grillu identifikováno 6 featur ve 3 skupinách:

### Group A — Multi-everything + List rewrite
- Nápad emituje **N otázek** (ne 1) — zavlažování → 3 otázky pro Projektanta: trasa hadic, přípojka, typ čerpadla
- Nápad má **N linků** (pinterest/IG inspirace — typicky 2-4, max ~10)
- Nápad má **N obrázků** (typicky 1-3, max ~10)
- **Title jako first-class** pole (Notion-style = první řádek editoru je auto-title)
- **NapadCard v listu:** title prominent, binární ikony pro "obsahuje image/link", **žádný thumbnail**

### Group B — Rich text editor
- **Tiptap** (MIT, free, battle-tested Linear/GitLab/Substack)
- Formátování: **Bold, Italic, BulletList, Headings** (to 80 % případů)
- Storage: **Markdown** (čitelné v clipboard exportu, snadný PDF)
- **Jen v detail**, ne v quick capture (capture zůstává <5 s textarea)

### Group C — Browse by Location (původně user napsal "kategorie", korigováno)
- Fáze 1: `/lokace` **grid** (2-col mobile), group by LOCATION_GROUPS (Venkovní/Dům/Obytné/Hygiena)
- Fáze 1: `/lokace/:id` s **tabs Nápady / Otázky** (žádné další chips)
- Fáze 2 (budoucí): SVG plánek s klikacími regiony → drill-down na stejný detail

## Decisions

| # | Decision |
|---|---|
| Title UX | **Notion-style** — první řádek editoru je auto h1/title, extrahuje se do `task.title` při save |
| Attachments limit | Array ~10 each, žádná virtualizace, žádný drag-reorder |
| Icons v listu | **Binární** (1+ attachments = ikona, bez počtu) |
| Rich text storage | **Markdown** |
| Rich text scope | Jen `/t/:id` detail, composer zůstává plain textarea |
| Editor lib | **Tiptap** (+ StarterKit, Heading, Markdown serializer) |
| Composer → multi | Quick capture zachycuje 1× text. Pro multi-image/link uživatel otevře detail. |
| Migration | **Breaking change** — produkční data 0, risk je 0 |
| Location browse UX | Grid + tab switch. Žádné status/category chips uvnitř. |

## V2 slice ordering

1. **S23** — Title first-class + list rewrite (~4h)
2. **S24** — Multi-images (array + gallery) (~4h)
3. **S25** — Multi-links (array + chip list) (~2h)
4. **S26** — Multi-otázky from nápad (linkedTaskIds[]) (~3h)
5. **S27** — Tiptap rich text editor (Markdown) (~5h)
6. **S28** — Browse by Location (grid + tabs) (~4h)

**Total estimate:** ~22h V2 work.

## Risks

- **Skupina A biggest risk:** Data migration = 0 risk (žádná produkční data).
- **Skupina B biggest risk:** Tiptap bundle ~110 KB gzipped lazy-loaded na `/t/:id` = +300 ms na 3G. Acceptable.
- **Skupina C biggest risk:** Mrtvá feature pokud user nepoužívá. User potvrdil "základní využití" — ne primary workflow.

## Close

*User ready for implementation. Starting S23.*
