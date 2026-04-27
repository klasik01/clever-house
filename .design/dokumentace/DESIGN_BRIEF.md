# Dokumentace — Design Brief

**Date**: 2026-04-27
**Author**: Stanislav Kasika
**Status**: Draft

## 1. Problem Statement

Stavební dokumenty (smlouvy, cenové nabídky, projektová dokumentace, faktury,
protokoly) žijí rozházené mezi Google Drive a WhatsApp konverzacemi. OWNER i PM
tráví čas hledáním správného souboru a nemají jistotu, že pracují s aktuální
verzí. S postupem stavby dokumentů přibývá a problém se zhoršuje. Řešení:
centrální úložiště dokumentů s role-based přístupem, audit trailem a přímým
propojením na existující nápady/otázky/úkoly v appce.

## 2. Primary User

OWNER (Stáňa + manželka) — primární uploader. Typický scénář: OWNER dostane
emailem cenovou nabídku od elektrikáře jako PDF, otevře appku na mobilu, vytvoří
záznam Dokumentace „Elektroinstalace", nahraje PDF s typem „Cenová nabídka" a
názvem „Nabídka Elektro Novák", nastaví viditelnost pro PM, a pak v existující
otázce „Kdo bude dělat elektro?" přilinkuje tento dokument. PM druhý den otevře
otázku, vidí sekci „Přiložená dokumentace", proklikne se a otevře PDF přímo
v prohlížeči telefonu.

## 3. Success Metrics

- **Primary**: 100 % stavebních dokumentů nahráno v appce — cíl do 90 dnů od launche
- **Secondary**: PM i OWNER vidí jen dokumenty sdílené pro jejich roli — zero leaks
- **Guardrail**: Upload flow na mobilu nesmí trvat > 30 s (výběr souboru → uloženo)

## 4. Scope

### In scope (v1)

- Nový task type `dokumentace` — CRUD záznamů v existujícím Task modelu
- Upload dokumentů (PDF + obrázky) s admin-spravovatelným typem a zobrazovaným názvem
- Replace dokumentu (potvrzovací modal, pre-fill z předchozího)
- Delete dokumentu s audit záznamem
- Role-based visibility (`sharedWithRoles` pattern, editovatelné po vytvoření)
- Audit trail: kdo nahrál, kdy, kdo smazal, kdo změnil metadata, kdo přehrál
- Linkování z nápadu/otázky/úkolu — `linkedDocIds: string[]` na Task entitě
- Sekce „Přiložená dokumentace" v detailu tasku
- Push notifikace při nahrání dokumentu (protistrana)
- Admin-spravovatelné typy dokumentů (vzor: kategorie)
- Výchozí sada typů: Smlouva, Cenová nabídka, Projektová dokumentace, Stavební povolení, Faktura, Protokol, Zápis
- Detail záznamu: dokumenty jako karty/dlaždičky (PDF ikonka + název + typ)
- Hlavní přehled: stejný card layout jako nápady/úkoly

### Out of scope

- Verzování dokumentů — jen replace (smaž starý, nahraj nový)
- Fulltextové hledání v obsahu PDF (OCR)
- Online editace dokumentů v appce
- Komentáře na záznamu Dokumentace (možná V2)
- Tagging dokumentů cross-záznam (dokument patří vždy do jednoho záznamu)

### Explicit non-goals

- Nejsme file manager — dokumenty mají kontext (typ, název, kategorie, vazba na tasky), ne stromovou strukturu složek.
- Neřešíme collaboration — žádné simultánní editace, žádné komentáře k jednotlivým dokumentům.
- Neřešíme expiraci/archivaci — dokumenty žijí napořád.

## 5. Constraints

- **Timeline**: **[TBD]** — záleží na V19 release scope
- **Budget**: Zero — interní projekt, vlastní dev čas
- **Tech stack**: React 19 + Vite + TypeScript + Tailwind + Firebase (Firestore + Storage). Task entita rozšířená o `type: "dokumentace"`. Storage rules: existující `files/` path pro PDF (10 MB limit), `images/` pro obrázky (WebP komprese)
- **Accessibility**: WCAG AA (stávající baseline)
- **Brand / legal**: Žádné specifické — interní nástroj pro 2–3 uživatele
- **Team**: 1 developer (Stáňa + Claude)

## 6. Tone & Aesthetic

- **Feel**: Přehledný, rychlý, důvěryhodný
- **Reference products**: Stavební deník appky (BulldozAIR, PlanRadar) — dokumenty vázané ke stavbě s kontextem, ne generický cloud storage
- **Anti-references**: Google Drive (příliš generický, žádný stavební kontext), Dropbox (file manager mindset, ne document record mindset)
- **Named aesthetic philosophy**: Sdílí existující design language appky — inline badge combobox pattern, pill chips, mobile-first touch-friendly (min-h-tap), rounded-pill bg-bg-subtle token system

## 7. Content & Data

- **Co existuje**: PDF dokumenty na Google Drive + v WhatsApp konverzacích. Nepřesný počet, odhadem desítky.
- **Co chybí**: Strukturovaná metadata (typ, název, audit trail). Admin seznam typů dokumentů (nutno vytvořit Firestore kolekci + UI).
- **Kdo vlastní**: OWNER vlastní většinu dokumentů. PM má přístup k těm, které OWNER sdílí.

## 8. Competitors & References

| Product | Co převzít | Čemu se vyhnout |
|---------|-----------|-----------------|
| BulldozAIR / PlanRadar | Dokumenty vázané na stavbu s kontextem | Enterprise složitost, feature bloat |
| Google Drive | Jednoduchý upload, náhled PDF | Generický file manager bez kontextu |
| WhatsApp přílohy | Zero-friction sdílení | Žádná organizace, nelze dohledat |

## 9. Risks & Unknowns

1. **Dokumenty se nepropojí s workflow** — Likelihood: střední / Impact: vysoký / Mitigation: linkování z tasků je V1, sekce „Přiložená dokumentace" viditelná v detailu tasku
2. **Upload modal na mobilu je těžkopádný** — Likelihood: střední / Impact: střední / Mitigation: prototypovat a testovat upload flow na reálném telefonu před finalizací UI
3. **PDF otevření v externí appce nespolehlivé** — Likelihood: nízká / Impact: střední / Mitigation: testovat na iOS (Safari) + Android (Chrome) — fallback na download pokud `window.open` selže

## 10. Open Questions

- [ ] Kolik typů dokumentů bude ve výchozí sadě? (navrženo 7 — stačí?)
- [ ] Bude záznam Dokumentace mít komentáře? (zatím ne, ale stojí za zvážení pro V2)
- [ ] Jak se budou dokumenty řadit v přehledu? (podle data vytvoření? podle kategorie?)
- [ ] Má audit trail vlastní subkolekci, nebo stačí pole na dokumentu?
- [ ] Limit na celkovou velikost storage per projekt?

## 11. Definition of Done

- [ ] OWNER může vytvořit záznam Dokumentace s title, kategorií a sharedWithRoles
- [ ] OWNER/PM může nahrát PDF nebo obrázek s typem (z admin seznamu) a názvem
- [ ] Nahrané dokumenty se zobrazují jako karty s PDF ikonkou, názvem a typem
- [ ] Kliknutí na PDF kartu otevře dokument v externí appce (ne lightbox)
- [ ] Kliknutí na obrázek kartu otevře lightbox
- [ ] Dokument lze nahradit (replace) s potvrzovacím modalem a pre-fillem
- [ ] Dokument lze smazat (jen autor záznamu + cross-OWNER)
- [ ] sharedWithRoles funguje — PM nevidí dokumenty, které OWNER nesdílel
- [ ] Z detailu nápadu/otázky/úkolu lze přilinkovat existující dokumentaci
- [ ] Sekce „Přiložená dokumentace" se zobrazuje v detailu tasku s prokliky
- [ ] Push notifikace při nahrání dokumentu (protistrana dostane push)
- [ ] Admin UI pro správu typů dokumentů (přidat, editovat, smazat)
- [ ] Audit trail: u každého dokumentu viditelné kdo/kdy nahrál, nahradil, smazal
- [ ] Upload flow na mobilu funguje plynule (< 30 s)
- [ ] PDF + obrázky do 10 MB, storage rules enforce
- [ ] Hlavní přehled zobrazuje Dokumentace karty konzistentně s ostatními typy
