# Dokumentace — Discovery

## Problem Statement

Stavební dokumenty (smlouvy, cenové nabídky, projektová dokumentace, faktury…)
žijí rozházené mezi Google Drive a WhatsApp konverzacemi. Když OWNER nebo PM
potřebuje konkrétní dokument, tráví čas hledáním a není jisté, že má aktuální
verzi. Chybí centrální místo s role-based přístupem, audit trailem a propojením
na existující nápady/otázky/úkoly.

## Primary User

OWNER (Stáňa + manželka) — primární uploader dokumentů; PM přistupuje a občas
nahrává.

## Success Metric

100 % stavebních dokumentů nahráno v appce do 90 dnů od launche — žádné hledání
jinde (Drive, WhatsApp).

## Top 3 Risks

1. **Dokumenty se nepropojí s workflow** — izolované dokumenty, které nikdo
   nenajde, protože nejsou navázané na úkoly/otázky kde se řeší.
2. **Upload flow na mobilu je těžkopádný** — modal s typem + názvem při každém
   uploadu může odrazovat od používání.
3. **PDF náhled na mobilu nespolehlivý** — "otevřít v externí appce" musí
   fungovat konzistentně na iOS i Android.

---

## 1. Problem & outcome

**Q: Jednou větou — jaký problém to řeší?**
Centrální místo pro stavební dokumenty s role-based přístupem, namísto
rozházených souborů na Drive a WhatsAppu.

**Q: Pro koho?**
OWNER (primárně nahrává), PM (přistupuje, občas nahrává).

**Q: Co je metrika úspěchu za 90 dní?**
- Všechny dokumenty na jednom místě (100 % v appce)
- PM i OWNER vidí jen to své (role-based přístup funguje)

**Q: Co se stane, když to NEpostavíme?**
Obtěžující — dokumenty existují, ale najít správný zabere čas a nervy. Nikdo
neví kde co je. Není kritické (nic se neztratilo), ale s přibývajícími
dokumenty se bude zhoršovat.

---

## 2. Users & jobs-to-be-done

**Q: Kdo je primární uživatel?**
OWNER — hlavně nahrává dokumenty.

**Q: Co dělá uživatel TĚSNĚ PŘED tím?**
- Z detailu úkolu/otázky — řeší konkrétní task a potřebuje přiložit nebo najít
  relevantní dokument.
- Z hlavního přehledu — jde cíleně do sekce Dokumentace hledat konkrétní
  smlouvu nebo nabídku.

**Q: Jak to řeší DNES?**
- Google Drive — sdílená složka bez struktury a audit trailu
- Email / WhatsApp — dokumenty létají v konverzacích, hledá se scrollováním

---

## 3. Scope & non-goals

### V1 scope

- CRUD záznamů Dokumentace (nový task type `dokumentace`)
- Upload dokumentů (PDF + obrázky) s typem a názvem
- Replace dokumentů (s potvrzením, pre-fill z předchozího)
- Role-based visibility (sharedWithRoles pattern)
- Audit trail (kdo nahrál, kdy, kdo smazal, změnil, přehrál)
- Linkování dokumentů z nápadu/otázky/úkolu (`linkedDocIds`)
- Základní notifikace při nahrání dokumentu
- Admin-spravovatelné typy dokumentů (jako kategorie)

### Explicitně MIMO scope (non-goals)

1. **Verzování dokumentů** — žádná historie verzí, jen nahrazení (replace)
2. **Fulltextové hledání v PDF** — žádné OCR ani prohledávání obsahu;
   hledá se jen podle názvu/typu
3. **Online editor** — žádná editace dokumentů v appce; jen nahrát,
   prohlédnout, stáhnout

### Při zkrácení timeline vyloučit

- Audit trail (stačí vědět kdo nahrál, historie změn až později)

---

## 4. Constraints

**Typy souborů:** PDF + obrázky (fotky vyfocených dokumentů).

**Max velikost souboru:** 10 MB (stávající limit).

**Max počet dokumentů na záznam:** Bez limitu.

**Tech stack:** Existující — React 19 + Vite + Firebase. Task entita rozšířená
o type `dokumentace`. Storage rules pro PDF path (`files/`).

**Permissions:**
- Vytvářet: OWNER + PM (a v budoucnu další role)
- Editovat: autor záznamu (createdBy) + cross-OWNER (jako u tasků)
- Delete: autor záznamu
- Linkovat z tasků: kdo smí editovat daný task
- Sharing (sharedWithRoles): nastavitelné při vytvoření + editovatelné později

---

## 5. Content & data

**Typy dokumentů:** Admin-spravovatelné (jako kategorie). Výchozí sada:
Smlouva, Cenová nabídka, Projektová dokumentace, Stavební povolení, Faktura,
Protokol, Zápis.

**Upload modal:** Fixní dropdown z admin-spravovaného seznamu typů + pole pro
zobrazovaný název.

**Replace flow:** Potvrzovací modal s pre-fill názvu a typu z předchozího
dokumentu.

**Data model (záznamu):**
- Title — udává o jaké dokumenty se jedná
- Description — má, ale ve view skryté (prozatím nemá smysl zobrazovat)
- Kategorie — ano (stejný pattern jako u nápadu)
- Priorita — ne (null)
- Fáze — ne (null)
- Deadline — ne (null)
- Assignee — ne (null)
- Status — ne (dokumentace je daná, nemá workflow stav)
- sharedWithRoles — ano

**Data model (jednotlivého dokumentu):**
- Soubor (URL + contentType + size)
- Typ dokumentu (z admin seznamu)
- Zobrazovaný název
- Upload metadata: uploadedBy, uploadedAt
- Audit events: kdo nahrál, smazal, změnil zadání, přehrál

**Link model:**
- Task (nápad/otázka/úkol) má `linkedDocIds: string[]`
- V detailu tasku sekce "Přiložená dokumentace" (podobně jako "Vzniklo z
  nápadu") s odkazy na záznamy Dokumentace

---

## 6. Context of use

**Zařízení:** Hlavně mobil (80 %+). Nahrávání i prohlížení primárně z telefonu.

**Náhled:**
- Obrázky → lightbox v appce (stejně jako u tasků)
- PDF → otevření v defaultní appce zařízení (ne lightbox, ne download)
- **Důležité:** PDF se NESMÍ dávat do lightboxu — musí se ošetřit routing

**Accessibility:** Stávající WCAG AA baseline.

---

## 7. Tone, brand, aesthetic

Sdílí design language celé appky:
- Inline badge combobox pattern (pill chips, priority tokens)
- Mobile-first, touch-friendly (min-h-tap)

**Seznam dokumentů uvnitř záznamu:** Karty / dlaždičky — každý dokument jako
malá karta s PDF ikonkou, názvem a typem.

**V hlavním přehledu (seznam Dokumentací):** Stejný layout jako nápady/úkoly
v seznamu Záznamů — konzistentní card UI.

**Inspirace:** Stavební deník appky (BulldozAIR, PlanRadar) — dokumenty
vázané ke stavbě s kontextem.

---

## 8. Competitors & references

**Inspirace:** Stavební deník appky (BulldozAIR, PlanRadar) — dokumenty
přímo vázané na stavbu, ne generický file manager.

**Co z nich vzít:** Propojení dokumentů s kontextem (úkoly, fáze stavby).

**Co nereplikovat:** Složitost enterprise nástrojů — tohle musí být
jednoduché pro 2–3 uživatele.

---

## 9. Risks & unknowns

**Největší riziko:** Dokumenty se nepropojí s workflow — budou izolované a
nikdo je nenajde. Proto je linkování z tasků V1 requirement.

**Nejistější předpoklad:** Že upload modal s typem + názvem nebude obtěžující
na mobilu. Může se ukázat, že je potřeba quick-upload bez modalu.

**Co prototypovat/ověřit first:**
1. Upload flow na mobilu — PDF z Files app / fotoaparátu musí být bezbolestné
2. PDF náhled v mobilu — "otevřít v externí appce" spolehlivě na iOS + Android
3. Linkování z tasků UX — picker "připoj dokument" nesmí být těžkopádný
