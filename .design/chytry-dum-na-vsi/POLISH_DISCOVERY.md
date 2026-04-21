# V3-polish — Visual Harmony Discovery

**Date:** 2026-04-21
**Scope:** Post-V3 polish pass — harmonizace barev s warm-earth palette, odstranění „divné" bílé, tone-down priority/status chipů.

## Problem Statement

Po dodání V3 features (priorita, deadline, assignee, komentáře) cítí OWNER detail nápadu/otázky jako **skokový a laboratorní**. Bílá inputů (`#ffffff`) se nepříjemně vybíjí z béžového page pozadí. Priority/Status chipy používají cross-palette barvy (sytá červená, modrá, žlutá), které dnes nesednou do celkového „klidného stavařského" tonu. Cíl: zůstat v paletě stone + olive + oak, pracovat s odstíny, ne přidat další barvy.

## Primary User

Stanislav (OWNER) — subjektivní vnímání při 2-3× denní práci s detailem.

## Success Metric

Binární „líbí/nelíbí" — když user po aplikaci říká „teď to sedí", done. Žádná tvrdá metrika.

## Answers (from focused interview)

### Q1 — Konkrétní pain points
- Detail otázky/nápadu: bílá inputů (title, body, category chips) působí odtrženě od bg
- Priority a Status chipy: sytá červená/modrá/žlutá působí cizorodě
- Seznam (home grid): bloky jsou nepřehledné (pravděpodobně moc ostrých hran + plochých border)

### Q2 — Direction
- Držet se warm-earth palety (stone, olive, oak)
- Pracovat s **odstíny jedné palety**, nepřidávat další barvy
- Ostrá bílá je cizí — chce se více **tone-on-tone**

### Q3 — Priority/Status chipy
- Zvoleno varianta A/C hybrid: všechno zremapovat na **shades of olive/oak/stone**. Žádná cross-palette vivid barva.

### Q4 — Pozadí
- **X — `bg-surface` → `stone-50`** (off-white, tone-on-tone s page background).
- Ztráta 1 hierarchy layer je přijatelná (user odsouhlasil).

### Q5 — Scope
| Screen | Status |
|---|---|
| `/` Seznam grid | **fix** |
| `/zaznamy` List | **fix** |
| `/prehled` Dashboard | **OK, nedotýkat** |
| `/t/:id` Detail | **fix** (hlavní) |
| Ostatní (Nastavení, auth) | implicitně nedotčené, ale poletí s nimi po úpravě tokens automaticky |

## Top 3 Risks

1. **Ztráta scannability** — pokud priority/status chipy budou všechny olive-tone, user už neuvidí na prvý pohled rozdíl P1 vs P3. Mitigace: přidat dot intensity (P1 = olive-700 dot + border, P3 = stone-400 dot, bez bg) + ikonku.
2. **Kontrast AA** — přechod na tone-on-tone může porušit WCAG na některých text-on-bg párech. Nutné ověřit po změně každého páru.
3. **Regrese Přehled** — user ho označil za OK, takže M2 banner red/green **zůstává** jako semantic signal. Musím je tam nechat i když zbytek potlumím.

## Proposed token changes (V3-polish patch)

### Surface layer
- `--color-bg-default`: `stone-50` → `stone-100` (page bg *zvýšit* kontrast vůči surface)
- `--color-surface-default`: `#ffffff` → `stone-50` (tone-on-tone s bg)
- `--color-surface-raised`: `stone-50` → `stone-100` (kontinuita)

### Priority — tone-down
| State | Current | New |
|---|---|---|
| P1 | danger-red bg + fg | `oak-100` bg, `oak-800` fg, `oak-600` dot, `oak-400` border (warm urgence) |
| P2 | stone + olive dot | `stone-100` bg, `stone-700` fg, `olive-600` dot (unchanged — už OK) |
| P3 | transparent + gray | `transparent` bg, `stone-500` fg, `stone-300` dot (subtle) |

### Status — tone-down
| Status | Current | New |
|---|---|---|
| Nápad | info (blue) | `stone-100` bg, `stone-700` fg |
| Otázka | info (blue) | `oak-50` bg, `oak-700` fg |
| Čekám | warning (yellow) | `oak-100` bg, `oak-800` fg (urgent oak) |
| Rozhodnuto | success (green) | `olive-100` bg, `olive-800` fg |
| Ve stavbě | orange/oak | `oak-200` bg, `oak-900` fg |
| Hotovo | success-700 bg | `olive-700` bg, `stone-50` fg (strongest — done = emphatic) |

### Přehled M2 banner — **unchanged**
User výslovně povolil — success-green (OK) / danger-red (BAD) zůstává jako kritický signal.

### Seznam grid cards
- Border: `border-line` → `border-line/60` (lehce méně výrazné)
- Bg: `surface-default` (teď stone-50) — automaticky se podlehne
- Hover: `bg-bg-subtle` → `bg-olive-50/60` (tone-on-tone hover)

---

## Next step

`design-tokens` pass: rewrite relevant tokens in `tokens.css` + `tokens-v3.css`, verify WCAG AA na všech párech, apply.
