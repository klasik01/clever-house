# Chytrý dům na vsi — V3 Design Tokens (delta)

**Date**: 2026-04-20
**Status**: Draft

Additivní vrstva nad stávajícím `tokens.css` (V1/V2). Žádné V2 tokeny nerušíme — V3 jen přidává sémantické aliasy pro **priority, deadline, avatar, komentáře, /prehled**.

Output: `tokens-v3.css` (cca 176 řádků, injektovaný po hlavním `tokens.css` v `globals.css`).

## 1. Rationale

V2 palette má kompletní funkční pokrytí: stone (neutral), olive (accent), oak (warm), status quartet (success/warning/danger/info). V3 nepotřebuje nové primitive hues — pouze **sémantické aliasy** které mapují nové koncepty (priorita, deadline, avatar seeds) na stávající primitives.

Výhoda: žádný nový hue conflict, žádná nová kontrast-verifikace pro body text (body zůstává stone-900 on stone-50 = 15.3:1, AAA). Jen nové badge-styly v známé paletě.

## 2. Priority tokens

Priorita existuje **jen na otázce**, ne na nápadu. 3 stupně.

| Token | Light | Dark | Použití |
|---|---|---|---|
| `--color-priority-p1-bg` | `danger-50` | `danger-900` | Badge background — urgentní otázka |
| `--color-priority-p1-fg` | `danger-700` | `danger-300` | Text + ikona v P1 badge (4.89:1 AA) |
| `--color-priority-p1-border` | `danger-300` | `danger-700` | Border v P1 badge |
| `--color-priority-p1-dot` | `danger-500` | `danger-500` | Dot indikátor v listu karet |
| `--color-priority-p2-bg` | `stone-100` | `stone-800` | Normální — tlumený neutrál |
| `--color-priority-p2-fg` | `stone-700` | `stone-200` | (7.2:1 AAA) |
| `--color-priority-p2-border` | `stone-300` | `stone-700` | |
| `--color-priority-p2-dot` | `olive-600` | `olive-400` | Earth-olive pro neutrální prioritu |
| `--color-priority-p3-bg` | `transparent` | `transparent` | Low — žádné pozadí, jen outline |
| `--color-priority-p3-fg` | `stone-600` | `stone-400` | (5.1:1 AA) |
| `--color-priority-p3-border` | `stone-200` | `stone-700` | |
| `--color-priority-p3-dot` | `stone-400` | `stone-600` | |

**Rozhodnutí:** žádná "neon red" pro P1. Danger-700 je sytá zemitá červená, ne alarm. To koreluje s non-goal „neneuroti­zovat OWNERa".

**A11y**: priorita není sdělena **jen barvou** — každá badge má i textový label "P1" / "P2" / "P3". WCAG 1.4.1.

## 3. Deadline tokens

Deadline má 3 stavy podle vzdálenosti od dnešního dne.

| State | Condition | `bg` | `fg` | WCAG |
|---|---|---|---|---|
| **ok** | deadline > 2 dny | `stone-100` | `stone-700` | 7.2:1 AAA |
| **soon** | 0 ≤ deadline ≤ 2 dny | `warning-50` | `warning-700` | 5.1:1 AA |
| **overdue** | deadline < now | `danger-50` | `danger-700` | 4.89:1 AA |

Rendering v listu karet: chip s relativním časem (`za 3 dny`, `za 6 hodin`, `po termínu 2 dny`). Ikona clock (Lucide) vlevo.

**Proč 2denní threshold?** Korespond­uje s Q3.2 metrikou `median response lag ≤ 2 dny`. Když deadline je ≤2 dny, je to stejná urgence jako „za tebou zaskře­chtá PM".

## 4. Avatar gradient seeds

UI identity: initials na kruhovém avataru s gradientem — 8 deterministických seedů podle `hash(uid) % 8`. 

| Seed | From (L=0.52) | To (L=0.55) | Dojem |
|---|---|---|---|
| 0 | rust (30°) | amber-rust (50°) | zemitý |
| 1 | amber (75°) | gold (100°) | teplý kov |
| 2 | moss (135°) | fern (160°) | rostlinný |
| 3 | teal (195°) | peacock (215°) | voda |
| 4 | sky (235°) | cobalt (255°) | chladný |
| 5 | lavender (275°) | plum (295°) | květina |
| 6 | rose (315°) | magenta (340°) | jahoda |
| 7 | terracotta (20°) | clay (45°) | stavbařský |

Všechny seedy mají OKLCH `L=0.52-0.55`, `C=0.06-0.12`. To zaručuje **white initials text** (4.5:1+) proti libovolnému bodu gradientu. Seed 7 úmyslně kotví na stavbařské terracotě — aby výsledky ladily s warm earth paletou, ne vypadaly jako Slack avatar.

### Hash algoritmus (TS)

```ts
function avatarSeed(uid: string): number {
  let h = 0;
  for (const ch of uid) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 8;
}
```

### Rendering

```tsx
<div
  className="grid size-8 place-items-center rounded-full text-xs font-semibold text-white"
  style={{
    background: `linear-gradient(135deg, var(--avatar-${seed}-from), var(--avatar-${seed}-to))`,
  }}
>
  {initials(displayName).slice(0, 2).toUpperCase()}
</div>
```

## 5. Comment thread tokens

| Token | Light | Dark | Použití |
|---|---|---|---|
| `--color-comment-author-bg` | `olive-50` | `olive-950` | Komentář autora tasku (odlišuje od ostatních) |
| `--color-comment-other-bg` | `surface-default` | `surface-default` | Komentáře ostatních |
| `--color-comment-mention-bg` | `info-50` | `info-900` | @mention inline chip pozadí |
| `--color-comment-mention-fg` | `info-700` | `info-300` | @mention text |
| `--color-comment-reaction-bg` | `stone-100` | `stone-800` | Emoji reaction pill (nezvolená) |
| `--color-comment-reaction-active-bg` | `olive-100` | `olive-900` | Emoji reaction pill (user zvolil) |
| `--color-comment-reaction-active-fg` | `olive-800` | `olive-200` | Emoji reaction text + count když active |

**Rozhodnutí:** vlastní komentář autora tasku má `olive-50` (lehce zabarvený) aby se hned vizuálně poznal od ostatních. Ne-autor komentáře mají neutrální `surface-default`.

## 6. /prehled tokens

| Token | Light | Dark | Použití |
|---|---|---|---|
| `--color-prehled-m2-ok-bg` | `success-50` | `success-900` | M2 cíl splněn banner (≤3 uvízlých) |
| `--color-prehled-m2-ok-fg` | `success-700` | `success-300` | M2 OK text (5.5:1 AA) |
| `--color-prehled-m2-bad-bg` | `danger-50` | `danger-900` | M2 překročen banner |
| `--color-prehled-m2-bad-fg` | `danger-700` | `danger-300` | M2 BAD text (4.89:1 AA) |

## 7. Typografie, spacing, motion — beze změny

V3 **nepřidává** žádné nové tokeny pro typografii, spacing, radii, shadows, motion, focus ring, breakpoints. Všechny už V2 pokrývá.

## 8. Contrast verification table

| Pair | Light L:L' ratio | Dark L:L' ratio | WCAG |
|---|---|---|---|
| priority-p1 fg/bg | 4.89:1 | 5.7:1 | AA ✓ |
| priority-p2 fg/bg | 7.2:1 | 7.8:1 | AAA ✓ |
| priority-p3 fg/bg | 5.1:1 | 4.7:1 | AA ✓ |
| deadline-ok fg/bg | 7.2:1 | 7.8:1 | AAA ✓ |
| deadline-soon fg/bg | 5.1:1 | 5.5:1 | AA ✓ |
| deadline-overdue fg/bg | 4.89:1 | 5.7:1 | AA ✓ |
| comment-mention fg/bg | 4.6:1 | 4.8:1 | AA ✓ |
| reaction-active fg/bg | 6.2:1 | 5.9:1 | AA ✓ |
| prehled-m2-ok fg/bg | 5.5:1 | 5.2:1 | AA ✓ |
| prehled-m2-bad fg/bg | 4.89:1 | 5.7:1 | AA ✓ |
| avatar white text on seed (worst) | 4.6:1 | 4.6:1 | AA ✓ |

Všechny páry **procházejí WCAG AA** (body 4.5:1). Čtyři páry jdou na AAA (7:1+).

## 9. How to wire

1. V `src/styles/globals.css` po stávajícím `@import "./tokens.css";` přidej:
   ```css
   @import "./tokens-v3.css";
   ```
2. Zkopíruj `/.design/chytry-dum-na-vsi/tokens-v3.css` do `app/src/styles/tokens-v3.css`.
3. Tailwind nebude potřebovat přegenerovat — nové tokeny se použí­vají přes `[color:var(--color-priority-p1-fg)]` style nebo inline `style={{ color: "var(--color-priority-p1-fg)" }}`. Pokud časem dojde k častému opakování, lze přidat do `tailwind.config.ts` alias.

## 10. Open questions

- [ ] Chceme přidat `--color-priority-*` aliasy do `tailwind.config.ts` (jako `bg-priority-p1` utility class)? Default: **ne** pro V3 — inline style stačí na max 20 use-sites. Přehodnotit pokud V4 přidá víc priority komponent.
- [ ] Avatar seed má spadat na 8 hues, ale workspace má typicky 2-3 lidi — bude vypadat repetitivně? **Očekáváno:** 2 users = 2 různé barvy (prakticky vždy s hash). Pokud collision, user si toho nevšimne, protože initials jsou čitelné. Nikdy nebude 20 users se stejnou barvou.
- [ ] /prehled M2 banner má ještě intermediate stav (mezi "ok" a "bad")? Třeba 4–5 uvízlých = žlutý warning? Default: **binární ok/bad**, cíl je 3 nebo less, jinak je špatně. Složitost ladění N stupňů nestojí.
