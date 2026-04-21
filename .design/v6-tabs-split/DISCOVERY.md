# V6 — Tabs Split (Záznamy = nápady, Úkoly = otázky)

## Problem statement
Po testech V3.1 se ukázalo, že sloučený tab **Záznamy** (nápady + otázky dohromady)
je přeplácaný — odznáček ball-on-me a filtry pro dvě různé entity v jednom
seznamu je zbytečná kognitivní zátěž. V6 revertuje merge a rozdělí obsah zpět
do dvou samostatných tabů, kde každý má vlastní filtrovací sadu a vlastní
logiku zvýraznění.

## Primary user
Stanislav (OWNER) + Projektant (PM). Cíl: dostat každý typ obsahu do svého
tabu s odpovídajícími filtry.

## Success metric
Ball-on-me odznáček a highlight se zobrazí **pouze** nad otázkami (na tabu
Úkoly), a Záznamy zůstanou čistě nápady. Uživatel si ušetří cca 1–2 kliknutí
při filtrování, protože filtry v každém tabu dávají smysl pro daný typ.

## Top 3 risks
1. **PM flow** — PM dnes má jen `/zaznamy?type=otazka`; musíme ho přesměrovat
   na `/ukoly`, jinak mu zmizí přehled.
2. **Terminologická nesrovnalost** — uživatel akceptoval, že "úkol = otázka"
   a *data* zůstanou `type: "otazka"`. Label tabu ale bude "Úkoly". Riziko:
   někde v UI pořád bude stát "Otázka" (detail, karta) a může to mást.
   Mitigace: ponechat "Otázka" v detailu a kartičkách — užívá se i v češtině
   stejně a user to vědomě akceptoval ("chyba v zadání").
3. **Úkoly s P1 + ball-on-me pořadí** — priorita + ball-on-me mohou chtít
   jiné řazení. Řešení: ball-on-me první, pak dle priority, pak dle
   `updatedAt DESC`.

---

## 1. Scope & non-goals

### In scope
- Tab **Záznamy** zobrazí **jen nápady** (`type === "napad"`).
- Záznamy má filtry: **Lokace**, **Kategorie**, **Stav (nápadový set)**.
- Nový tab **Úkoly** (přejmenovaný z Přehled) zobrazí **jen otázky**
  (`type === "otazka"`).
- Úkoly má filtry: **Lokace**, **Kategorie**, **Stav (V5 canonical)**,
  **Priorita (P1/P2/P3)**.
- Ball-on-me odznáček se přesouvá z Záznamy na Úkoly.
- Ball-on-me položky v seznamu Úkoly mají `border-l-4` accent + jsou
  řazené nahoře.
- Autor v TaskDetail metadata zobrazuje **email** (resolved přes useUsers)
  místo uid.

### Out of scope
- Globální přejmenování "otázka" → "úkol" v celém UI. Tab label je "Úkoly",
  detail + karty zůstávají s "Otázka".
- FAB/Composer nezmění default type podle aktivního tabu (další iterace).
- Email v seznamu karet (nápad/otázka) — zůstane title-only; email je jen
  v detailu a v author headeru u komentářů (ty už to mají).
- Stávající `/prehled` dashboard (M2 banner, counts) se sklidí — nahradí
  ho plný seznam filtrovaných úkolů.

### Co bys zrušil při půlce času?
- Řazení P1 → P2 → P3 — ponech jen ball-on-me first + updatedAt desc.
- Priority filter — zůstane jen stav + lokace + kategorie.

## 2. Decisions (z AskUserQuestion)

| Otázka | Rozhodnutí |
|---|---|
| Terminologie | Úkol = otázka (data + texty zůstávají "Otázka", tab je "Úkoly") |
| Filtry Úkoly | Lokace, Kategorie, Stav (V5), Priorita |
| Highlight ball-on-me | Border-l-4 + řadit nahoře |
| Email autora | Pouze v detail metadata |

## 3. Implementation checklist (slice-by-slice)

- [ ] **S1 Routing** — `/ukoly` route + redirect `/prehled` → `/ukoly`.
      PM: `/zaznamy?type=otazka` → `/ukoly`.
- [ ] **S2 Záznamy** — strip type filter + otazka type toggle; hard-wire
      `type === "napad"`. Odstranit otázka-specifické filtry (priority,
      assignee).
- [ ] **S3 Úkoly route** — nová stránka /ukoly. Filtry: lokace, kategorie,
      stav (OtazkaStatusCanonical), priorita. Řazení: ball-on-me first, pak
      updatedAt desc. Highlight border-l-4 accent na ball-on-me.
- [ ] **S4 Shell** — badge se ukazuje u tabu "Úkoly" místo "Záznamy".
      Změnit label tabu "Přehled" → "Úkoly", icon ze Gauge na ListChecks
      (nebo zachovat Gauge, user se nevyjádřil — default ponech Gauge).
- [ ] **S5 Detail metadata** — `{t("detail.author")}` row ukazuje
      `byUid.get(createdBy)?.email ?? createdBy` místo hashe.
- [ ] **S6 i18n** — klíč `tabs.prehled` → `tabs.ukoly` (zároveň zachovat
      zpětnou kompat na starý klíč).

## 4. Risks & unknowns

- **Filter persistence**: dnešní Záznamy si pamatuje filtry přes URL
  query. Úkoly by měly dodržovat stejný vzor. Otevřená otázka: sdílet
  state mezi taby nebo každý svoje URL params? Default = každý svoje.
- **Co když je ball-on-me více než celá obrazovka?** Pak by uživatel
  neviděl ostatní úkoly. Mitigace: žádná — user s tím počítá, highlight
  se má propagovat do řazení.
- **PM migrace**: starý bookmark `/zaznamy?type=otazka` musí redirectnout
  na `/ukoly`, jinak PM příště najde prázdný seznam nápadů (nemá k nim
  přístup).

