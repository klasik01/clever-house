# V7 — Editable locations + 3 new groups

## Problem statement
Lokace (místnosti + okolí domu) jsou dnes hardcoded v `src/lib/locations.ts`.
Uživatel chce vlastní seznam — přejmenovat, přidat, smazat — a novou strukturu
skupin: **Pozemek / Dům / Sítě** místo dosavadních Venkovní / Dům obecně /
Obytné / Hygiena.

## Primary user
OWNER (Stanislav). PM lokace jen čte.

## Success metric
Stanislav si sám zvládne v /nastavení/lokace pojmenovat každou místnost a
přidat chybějící (např. „Komora", „Rozvaděč", „Kotelna") bez zásahu do kódu.

## Top 3 risks
1. **Existující task.locationId** mapují na staré IDs. Seed musí být
   idempotentní a zachovat stejné ID řetězce (`pozemek-zahrada`, `kuchyn`, …),
   jinak ztratíme asociaci na starých záznamech. → Seed = default 19 entries,
   IDs beze změny, jen `group` se přemapuje na nový `LocationGroup`.
2. **Runtime cache vs Firestore latency**: `getLocation(id)` je synchronní a
   volá se z `NapadCard`, `TaskDetail` metadata, PDF/text export. Cache musí
   být hydratovaná před prvním vykreslením karet. → Fallback na DEFAULTS když
   cache prázdná; cache se hydratuje přes `useLocations()` hook.
3. **Skupiny jsou nové** — uživatel si nemůže přidávat vlastní skupiny ve V7
   (zůstávají 3 fixní). Pokud někdy bude chtít 4. kategorii, bude to další
   iterace.

## Rozhodnutí

| Aspekt | Rozhodnutí |
|---|---|
| Skupiny | Pozemek / Dům / Sítě (fixní, 3 ks) |
| Migrace | Seed 19 defaults s původními IDs, groups přemapovány |
| Editor | Pouze OWNER |
| Rozvržení | Nová route `/nastaveni/lokace` (Kategorie-like), odkazovaná z Settings |
| Runtime cache | Modulová `locationsCache` hydratovaná přes `useLocations()`, `getLocation()` padá na DEFAULTS |

## Default → nová skupina

Pozemek (původně outdoor):
- pozemek-zahrada, okoli-domu, dvorek-pred-domem, zahradni-domek, terasa

Dům (původně general + living + hygiene, kromě technicka-mistnost):
- dum-obecne, zadveri, chodba, garaz, dilna
- obyvaci-pokoj, kuchyn, loznice, detsky-pokoj, pokoj-pro-hosty, pracovna
- koupelna, wc, wellness

Sítě (nová — infrastruktura, rozvody):
- technicka-mistnost

Uživatel si do Sítě sám přidá `Elektroinstalace`, `Voda`, `Topení`, `Internet`, `Rozvaděč` atd.

## Implementation checklist

- [ ] **S1 types** — `LocationGroup = "pozemek" | "dum" | "site"`. Update `LOCATION_GROUPS` + remap `DEFAULT_LOCATIONS`.
- [ ] **S2 backend** — Firestore collection `locations`. `subscribeLocations`, `createLocation`, `renameLocation`, `deleteLocation`, `seedLocationsIfEmpty`. Module runtime cache + `getLocation` falls back to DEFAULTS.
- [ ] **S3 hook** — `useLocations()` → updates runtime cache + returns `{ locations, byId, byGroup, loading, error }`.
- [ ] **S4 route** — `/nastaveni/lokace` component mirroring `Kategorie.tsx` pattern, grouped UI.
- [ ] **S5 settings link** — add `LinkRow` in Settings.tsx below the Kategorie link.
- [ ] **S6 consumers** — `LocationPicker` + `LocationFilterChip` + `Lokace.tsx` home + `TaskGroupedView` read from hook; `NapadCard`, `TaskDetail`, `Export`, `pdf.ts`, `textExport.ts` keep sync `getLocation`.
- [ ] **S7 rules** — `/locations/{id}` collection: `read: isSignedIn()`, `write: isOwner()`.
- [ ] **S8 i18n** — `locations.groupPozemek`, `groupDum`, `groupSite` + page title + empty state.

