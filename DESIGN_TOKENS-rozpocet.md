# Rozpočet — Design Tokens (additions)

**Date**: 2026-05-04
**Status**: Implementováno (`app/src/styles/tokens-rozpocet.css`)
**Strategy**: Extends clever-house base (`tokens.css` + `tokens-v3.css`).

## 1. Strategie

Žádné nové primitives. Všechno staví na existujících scales `olive`, `stone`, `oak`, `success`, `warning`, `danger`, `info` z clever-house. Budget-specific tokeny jsou jen sémantické aliasy + KPI typografie.

`tokens-rozpocet.css` je importovaný v `globals.css` po `tokens-v3.css`. Light + dark + reduced-motion logika dědí z base.

## 2. Token groups (8)

### Money typography

```css
--font-feature-money: "tnum" 1, "lnum" 1;
--font-size-kpi-sm: 1.5rem;   /* 24 px */
--font-size-kpi-md: 2.25rem;  /* 36 px — primary KPI mobile */
--font-size-kpi-lg: 3rem;     /* 48 px — primary KPI desktop */
```

Helper class `.kpi-number` aplikuje vše. `.tabular-nums` pro inline.

### Money sémantické (positive/negative/neutral)

- `--color-money-positive` = success-700 (light) / success-300 (dark) — under budget = good.
- `--color-money-negative` = danger-700 / danger-300 — over budget = bad.
- `--color-money-neutral` = `--color-text-default`.

> Vždy color + znaménko / ikona. Barva nikdy jako jediný kanál.

### Variance (under/at/over plan)

- `--color-variance-under-{bg,fg,border}` → success aliasy.
- `--color-variance-at-{bg,fg,border}` → stone neutrál (±5 %).
- `--color-variance-over-{bg,fg,border}` → warning aliasy.

### Cash runway thresholds

- `--color-runway-safe-*` → success (>6 mo).
- `--color-runway-caution-*` → warning (3-6 mo).
- `--color-runway-critical-*` → danger (<3 mo).

### Faktura overdue

- `--color-overdue-{bg,fg,border}` → danger, ale `border-500` (silnější).

### Account badges

- `--color-account-bezny-*` → info (modré).
- `--color-account-hypotecni-*` → olive (brand).
- `--color-account-hotovost-*` → oak (warm).
- `--color-account-custom-*` → stone (neutrál).

### Chart palette (3 grafy)

- `--chart-c1` až `--chart-c7` → primitive scale 700 (light) / 300 (dark).
- Konvence: c1 = "skutečnost / zaplaceno", c2 = "plán / uvolněno".

### KPI tile sizing

- `--kpi-tile-padding`, `--kpi-tile-gap`, `--kpi-tile-radius`, `--kpi-tile-min-height` (96px mobile, 120px desktop).

## 3. Contrast verification

Všechny pairs (např. `success-700` na `success-50`) jsou verifikované v base `DESIGN_TOKENS.md` clever-house. Inherit AA / AAA.

## 4. Open token decisions (out of scope v1)

- Donut "Ostatní" prahový % → patří do `lib/charts.ts` config (S17), ne do tokenu.
- KPI flash při změně → nice-to-have, neimplementováno.
- Custom account barvy → slice 13 přidá OWNER-managed seznam, výchozí stone neutrál.
