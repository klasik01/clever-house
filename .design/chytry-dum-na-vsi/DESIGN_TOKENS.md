# Chytrý dům na vsi — Design Tokens

**Date**: 2026-04-20
**Status**: Draft
**Reference**: tokens.css

Translates the brand reference (RAL 6013 olive + Kronospan K680 Stone Beige + dub flooring) into a full OKLCH-based token system. Light and dark palettes generated together. Every semantic text/background pair is verified against **WCAG AA** (≥ 4.5:1 for body, ≥ 3:1 for large text).

---

## 1. Palette overview

### Three hue families

| Role | Family | Hue (°) | Brand anchor |
|---|---|---|---|
| **Olive** — primary accent | yellow-green | 105 | Kuchyňský ostrůvek RAL 6013 |
| **Stone** — neutral (warm gray) | warm | 80 | Kronospan K680 Stone Beige |
| **Oak** — secondary warm accent | warm brown | 65 | Dubová podlaha |

### Status hues

| Role | Hue (°) | Note |
|---|---|---|
| Success | 145 (green) | Desaturated — *natural* not neon |
| Warning | 75 (amber) | Matches earth palette warmth |
| Danger | 30 (terracotta) | Warm red, not cool crimson |
| Info | 240 (muted blue) | Desaturated to sit beside warm hues |

---

## 2. Primitive swatches

### Olive (RAL 6013-inspired)

| Token | OKLCH | Hex ≈ | Usage |
|---|---|---|---|
| `--olive-50`  | `0.97 0.010 105` | `#F6F5EB` | Subtle olive tint bg |
| `--olive-100` | `0.93 0.020 105` | `#E9E8D2` | Olive chip bg |
| `--olive-200` | `0.87 0.035 105` | `#D7D5AE` | — |
| `--olive-300` | `0.78 0.055 105` | `#BDBA7F` | **Dark-mode text.link** |
| `--olive-400` | `0.67 0.070 105` | `#9C9851` | **Dark-mode accent** |
| `--olive-500` | `0.58 0.065 105` | `#84814A` | Decorative visual accent |
| `--olive-600` | `0.52 0.055 105` | `#727045` | ≈ **RAL 6013** (visual only) |
| `--olive-700` | `0.44 0.050 105` | `#5E5D3F` | **Light-mode accent** (AA) |
| `--olive-800` | `0.36 0.040 105` | `#4B4A36` | Accent hover |
| `--olive-900` | `0.28 0.030 105` | `#39382B` | Accent active |
| `--olive-950` | `0.18 0.020 105` | `#25241C` | Edge case |

### Stone (K680 Stone Beige-inspired)

| Token | OKLCH | Hex ≈ | Usage |
|---|---|---|---|
| `--stone-50`  | `0.98 0.005 80` | `#F9F7F3` | Page bg (light) |
| `--stone-100` | `0.95 0.008 80` | `#F0EDE6` | Subtle bg |
| `--stone-200` | `0.90 0.012 80` | `#E2DED3` | Muted bg / borders |
| `--stone-300` | `0.82 0.015 80` | `#CBC5B4` | ≈ **Stone Beige K680** |
| `--stone-400` | `0.70 0.015 80` | `#A9A494` | — |
| `--stone-500` | `0.58 0.014 80` | `#85806E` | — |
| `--stone-600` | `0.48 0.012 80` | `#666258` | Text subtle (light) |
| `--stone-700` | `0.38 0.010 80` | `#4B483F` | Text muted (light) |
| `--stone-800` | `0.28 0.008 80` | `#33312A` | — |
| `--stone-900` | `0.20 0.007 80` | `#25231E` | Text default (light) |
| `--stone-950` | `0.14 0.005 80` | `#1A1914` | Page bg (dark) |

### Oak (dub-inspired)

| Token | OKLCH | Hex ≈ | Usage |
|---|---|---|---|
| `--oak-300` | `0.82 0.060 65` | `#DAC39C` | Warm highlight (dark mode) |
| `--oak-600` | `0.55 0.080 65` | `#896B44` | Warm accent (light mode) |
| `--oak-900` | `0.30 0.050 65` | `#433321` | Warm bg (dark mode) |

*Full scale in `tokens.css`, only key stops shown here.*

---

## 3. Semantic tokens — LIGHT theme

### Background / Surface

| Token | Value | Hex ≈ |
|---|---|---|
| `--color-bg-default` | `--stone-50` | `#F9F7F3` |
| `--color-bg-subtle` | `--stone-100` | `#F0EDE6` |
| `--color-bg-muted` | `--stone-200` | `#E2DED3` |
| `--color-bg-inverse` | `--stone-900` | `#25231E` |
| `--color-surface-default` | `#ffffff` | `#FFFFFF` |
| `--color-surface-raised` | `--stone-50` | `#F9F7F3` |
| `--color-surface-overlay` | `rgba(255,255,255,0.92)` | — |

### Text — with contrast verification

| Token | Value | Hex ≈ | Contrast on `bg-default` | Pass |
|---|---|---|---|---|
| `--color-text-default` | `--stone-900` | `#25231E` | **14.1:1** | AAA body |
| `--color-text-muted` | `--stone-700` | `#4B483F` | **7.8:1** | AAA body |
| `--color-text-subtle` | `--stone-600` | `#666258` | **5.4:1** | AA body |
| `--color-text-link` | `--olive-700` | `#5E5D3F` | **5.9:1** | AA body |

### Border

| Token | Value | Hex ≈ | Usage |
|---|---|---|---|
| `--color-border-default` | `--stone-200` | `#E2DED3` | Card / divider |
| `--color-border-strong` | `--stone-300` | `#CBC5B4` | Input / emphasis |
| `--color-border-focus` | `--olive-700` | `#5E5D3F` | **Focus ring** |

### Accent (interactive)

| Token | Value | Hex ≈ | Contrast | Pass |
|---|---|---|---|---|
| `--color-accent-default` | `--olive-700` | `#5E5D3F` | on-accent `--stone-50` ⇒ **5.7:1** | AA body (button text OK) |
| `--color-accent-hover` | `--olive-800` | `#4B4A36` | **7.6:1** | AAA body |
| `--color-accent-active` | `--olive-900` | `#39382B` | **10.1:1** | AAA |
| `--color-accent-on-accent` | `--stone-50` | `#F9F7F3` | — | Text on accent buttons |

> **Brand vs. interactive split:** `--color-accent-visual` (`--olive-600`, ≈ RAL 6013) is reserved for **decorative surfaces without text on them** (logo mark, active tab indicator stripe, brand watermarks). For **anything with text on top** (buttons, links, focus ring) we use `--color-accent-default` = `--olive-700`, which is the darkest olive that stays recognizable and passes AA.

### Status (light)

| Token | bg ⇒ fg ratio | Pass |
|---|---|---|
| `status-success` (green) | `#DAF0DC` ⇒ `#2B5A34` = **8.1:1** | AAA |
| `status-warning` (amber) | `#F6EED8` ⇒ `#5D4B25` = **8.6:1** | AAA |
| `status-danger` (terracotta) | `#F8E1D8` ⇒ `#7A3322` = **6.9:1** | AA+ |
| `status-info` (blue) | `#E2E7F3` ⇒ `#2F4080` = **8.2:1** | AAA |

---

## 4. Semantic tokens — DARK theme

### Background / Surface

| Token | Value | Hex ≈ |
|---|---|---|
| `--color-bg-default` | `--stone-950` | `#1A1914` |
| `--color-bg-subtle` | `--stone-900` | `#25231E` |
| `--color-bg-muted` | `--stone-800` | `#33312A` |
| `--color-surface-default` | `--stone-900` | `#25231E` (raised is lighter, not darker) |
| `--color-surface-raised` | `--stone-800` | `#33312A` |
| `--color-surface-overlay` | `rgba(20,18,14,0.88)` | — |

### Text (dark) — with contrast

| Token | Value | Hex ≈ | Contrast on `bg-default` | Pass |
|---|---|---|---|---|
| `--color-text-default` | `--stone-100` | `#F0EDE6` | **14.4:1** | AAA |
| `--color-text-muted` | `--stone-300` | `#CBC5B4` | **9.8:1** | AAA |
| `--color-text-subtle` | `--stone-400` | `#A9A494` | **6.1:1** | AA body |
| `--color-text-link` | `--olive-300` | `#BDBA7F` | **7.9:1** | AAA |

### Accent (dark)

| Token | Value | Hex ≈ | Contrast | Pass |
|---|---|---|---|---|
| `--color-accent-default` | `--olive-400` | `#9C9851` | on `bg-default` **5.6:1** | AA body |
| — | — | — | on-accent `--stone-950` **7.4:1** | AAA |
| `--color-accent-on-accent` | `--stone-950` | `#1A1914` | dark text on light-olive button | — |

> **Hue shift between modes:** light mode uses **darker olive** (700) for accent readability; dark mode uses **lighter olive** (400) for the same reason. Both anchor back to RAL 6013 visually but optimize for contrast in each theme.

### Status (dark)

| Token | bg ⇒ fg ratio | Pass |
|---|---|---|
| `status-success` | `#19331F` ⇒ `#8FC59F` = **8.9:1** | AAA |
| `status-warning` | `#3F3418` ⇒ `#DCCA9B` = **10.4:1** | AAA |
| `status-danger` | `#3B1E12` ⇒ `#E3A899` = **8.1:1** | AAA |
| `status-info` | `#1D253B` ⇒ `#A3B3D9` = **8.4:1** | AAA |

---

## 5. Status mapping to task stavy

| Stav záznamu | Semantic token group | Reason |
|---|---|---|
| **Nápad** | neutral (`stone-600` on `stone-100`) | Neutrální, žádná akce vyžadována |
| **Otázka** | `status-info` (blue) | Nový úkol, adresovaný PM |
| **Čekám** | `status-warning` (amber) | Aktivní čekání, vyžaduje pozornost před schůzkou |
| **Rozhodnuto** | `status-success` light variant | Posun vpřed, ale ještě ne hotovo |
| **Ve stavbě** | `color-warm-default` (oak) | Warm "v práci" barva, odlišená od Rozhodnuto |
| **Hotovo** | `status-success` full (green) | Uzavřeno |

---

## 6. Typography

### Font stack
- **Sans (primární):** `Inter`, s HIG-stylovým fallbackem (`-apple-system`, `BlinkMacSystemFont`). Inter má výborný CZ diacritic support a je dobře hinted pro UI sizes (≥ 12 px).
- **Mono:** system monospace (`ui-monospace`, `SF Mono`, `Menlo`). Použito jen pro kódové / ID hodnoty (pokud vůbec).

> **Alternativa:** Pokud chceš "domáctější" teplotu, zvaž **IBM Plex Sans** (free, o chlup humanističtější kresba). Rozhodne se ve `design-review` podle reálného dojmu.

### Type scale (1.25 modular ratio, base 16 px)

| Token | Size | Rem | Line-height | Usage |
|---|---|---|---|---|
| `font-size-xs` | 12 px | `0.75rem` | 1.0rem | Meta timestamps |
| `font-size-sm` | 14 px | `0.875rem` | 1.25rem | Secondary labels, chips |
| `font-size-base` | 16 px | `1rem` | 1.5rem | **Body text (default)** |
| `font-size-md` | 18 px | `1.125rem` | 1.625rem | Task title on card |
| `font-size-lg` | 20 px | `1.25rem` | 1.75rem | Section headings |
| `font-size-xl` | 24 px | `1.5rem` | 2rem | Page title |
| `font-size-2xl` | 30 px | `1.875rem` | 2.25rem | Hero / empty state |
| `font-size-3xl` | 36 px | `2.25rem` | 2.5rem | — |
| `font-size-4xl` | 48 px | `3rem` | 1.0 | Display |
| `font-size-5xl` | 60 px | `3.75rem` | 1.0 | Display |

### Weights (max 4)
- `font-weight-regular` = 400 (body)
- `font-weight-medium` = 500 (labels, emphasis)
- `font-weight-semibold` = 600 (titles)
- `font-weight-bold` = 700 (sparingly — hero, button labels)

### Line-heights
- `line-height-tight` = 1.15 (headings)
- `line-height-snug` = 1.35 (card titles)
- `line-height-normal` = 1.5 (body)
- `line-height-relaxed` = 1.65 (multiline body pro čitelnost na mobilu)

---

## 7. Spacing (8pt base)

| Token | px | Usage |
|---|---|---|
| `space-0` | 0 | — |
| `space-1` | 4 | Chip padding vertical |
| `space-2` | 8 | Tight inline spacing |
| `space-3` | 12 | Button vertical padding |
| `space-4` | 16 | **Gutter default, card padding** |
| `space-6` | 24 | Card-to-card spacing |
| `space-8` | 32 | **Section spacing** |
| `space-12` | 48 | — |
| `space-16` | 64 | — |
| `space-24` | 96 | — |
| `space-32` | 128 | — |

Alias pro čitelnost: `space-gutter`, `space-gutter-compact`, `space-section`.

---

## 8. Radii

| Token | px | Usage |
|---|---|---|
| `radius-none` | 0 | Plain edges |
| `radius-sm` | 4 | Chips, inline elements |
| `radius-md` | 8 | **Default cards, inputs, buttons** |
| `radius-lg` | 12 | Emphasized cards, bottom sheets |
| `radius-xl` | 20 | Large surface, modal corners |
| `radius-pill` | 9999 | Status badges, tags |

> **Philosophy:** HIG-style mírně zaoblené rohy (`md`=8). Nic ostrého jak v Material 3 (12 px), nic extra měkkého (20 px běžných karet). Osmička je "klidná, promyšlená".

---

## 9. Shadows

**Light** — jemné, teplé (RGB tint místo čistě černé):
- `shadow-sm`: 1 px ambient
- `shadow-md`: 4 px blur + 2 px ambient (default card elevation)
- `shadow-lg`: 12 px blur + sekundární (popovers, sheets)
- `shadow-xl`: 24 px blur (modal)

**Dark** — větší blur, nižší "černota" (kvůli lower perceived contrast):
- hodnoty v `tokens.css` automatiky v dark theme override

> Žádný neon glow, žádné vysoce nasycené stíny. Stín = náznak elevace, ne drama.

---

## 10. Motion

| Token | Value | Usage |
|---|---|---|
| `duration-instant` | 0 ms | Okamžité změny stavu |
| `duration-fast` | 120 ms | Hover, tap feedback |
| `duration-base` | 200 ms | **Default transition** |
| `duration-slow` | 320 ms | Page transitions, modal enter |

Easings:
- `easing-ease-out` — Apple-like, natural entrance
- `easing-ease-in-out` — symmetric (tab switching)
- `easing-spring` — pro delight moments (capture save success), **sparingly**

**Reduced motion:** `@media (prefers-reduced-motion: reduce)` overrides všechny durations na `0.01ms`. Toto je povinné a je v `tokens.css`.

---

## 11. Focus ring

```css
outline: var(--ring-width) solid var(--ring-color);
outline-offset: var(--ring-offset);
```

- `--ring-width` = 2 px
- `--ring-offset` = 2 px
- `--ring-color` = `--color-border-focus` (olive-700 light, olive-400 dark)

**Never `outline: none`.** Všechny interaktivní prvky mají viditelný focus. Pro custom focus styles vždy fallback na native `:focus-visible`.

---

## 12. Breakpoints & hit targets

- `sm` 640 px, `md` 768 px, `lg` 1024 px, `xl` 1280 px, `2xl` 1536 px.
- Mobile-first: začíná se bez media query, nadstavby přes `min-width`.
- **`--tap-target-min` = 44 px** (iOS HIG baseline). Každý tappable prvek má min 44×44 px hit area, i když vizuálně menší.

---

## 13. Accessibility summary

- Všechny **body text / background pairs** procházejí **WCAG AA** (≥ 4.5:1), většina AAA (≥ 7:1).
- **Accent default** na primary bg ≥ 5.6:1 v obou themech.
- **Focus ring** je viditelný na všech defined background tokens.
- **Reduced motion** respektován.
- **Color-scheme** property nastavena pro native iOS/Android tint (scrollbars, form elements).
- **WCAG 2.1 AA compliance** potvrzeno jako baseline napříč tokeny.

---

## 14. Usage rules

1. **Nikdy nepoužívat primitivy přímo** (např. `var(--olive-600)`) v komponentách. Vždy semantic token (např. `var(--color-accent-visual)`).
2. **Status color pro stavy tasků** — konzistentní mapa v sekci 5. Neodchylovat se.
3. **Brand olive má dvě tváře:** `accent-visual` (olive-600, ≈ RAL 6013) pro dekoraci, `accent-default` (olive-700) pro cokoli s textem. Rozdíl je pro AA, ne stylistický — obojí "olive".
4. **Dark mode je první třída**, ne dodatek. Každá komponenta se musí testovat v obou theme variant.
5. **Typ se osvětluje skrz weight a size, ne barvou.** Primárně používat `text-default`; jen labels / meta smí jít do `text-muted` / `text-subtle`.

---

## 15. Open questions

- [ ] **Font:** Inter (safe default) vs. IBM Plex Sans (teplejší). Rozhodne se v `design-review` po prvním prototypu.
- [ ] **Oak accent:** kdy ho reálně použít? Kandidáti: *Ve stavbě* status, "domov" ikony, onboarding UI. Možná odloženo pro future polish.
- [ ] **P3 display optimalizace:** OKLCH hodnoty jsou P3-safe; sRGB fallback je auto-downmixing browserem. Nevyžaduje akce, jen potvrzuji.
- [ ] **Font loading strategie:** Inter self-host přes `/fonts/` s `font-display: swap` vs. Google Fonts CDN. Pro Netlify ideál self-host (žádné externí požadavky, rychlejší first paint).

---

*IA odkaz: [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)*
*Brief odkaz: [DESIGN_BRIEF.md](./DESIGN_BRIEF.md)*
