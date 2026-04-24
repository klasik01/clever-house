# scripts/archive/

Jednorázové migrační skripty, které **už se nesmí znovu spustit**.
Co tady leží, patří do historie — typicky šlo o backfill schematického
pole, reshapování kolekce, nebo one-off cleanup po incidentu.

## Jak se sem skripty dostanou

Automaticky, přes orchestrátor — ale **až po `ope` deployi**:

```
cd app/functions
npm run deploy:dev       # 1. dev: skripty se spustí proti dev DB, pending zůstává
# ... ověř že vše OK na dev ...
npm run deploy:ope       # 2. ope: spustí proti prod DB, úspěch → archive sem + řádek níž
```

Orchestrátor `scripts/deploy.mjs`:

1. Vezme všechno z `scripts/pending/` (seřazeno abecedně — díky
   `YYYY-MM-DD-...` prefixu to je chronologicky).
2. Pro každý skript spustí `node <script> <env>`.
3. Pokud env=`ope` a exit 0 → přesune sem + přidá řádek do tabulky
   (parsuje se JSDoc header `@migration`, `@date`, `@description`).
4. Pokud env=`dev` → pending zůstává. Idempotence skriptů zajistí, že
   opakované dev spuštění nic nezapíše podruhé.

## Postup když chceš přidat novou migraci

1. Vytvoř skript v `scripts/pending/YYYY-MM-DD-V{verze}-{popis}.mjs`.
2. Header musí obsahovat JSDoc tagy:
   ```
   @migration V17.8
   @date 2026-04-24
   @description Krátký popis co to dělá
   ```
3. Skript musí být **idempotentní** (druhé spuštění nic neudělá) a
   brát `<dev|ope>` jako první positional arg.
4. Na konci successful runu exitovat `0` — orchestrátor to detekuje a
   skript přesune sem.

## Proč archivovat, a ne smazat

Historie je cenná:

- **audit trail** — když za rok přijde data otázka ("proč má tenhle task
  authorRole 'OWNER' ale je z roku 2025?"), odpověď je tady v README.
- **template pro další migrace** — příští backfill bude mít podobný tvar
  (Admin SDK + batch + `--dry-run`), takže se z něho dá zkopírovat scaffold.
- **bezpečnost** — kdyby se někdy obnovovala stará záloha dat, skript
  možná zas bude potřeba (a ručně ho odkomentovat guard).

## Jak poznat, že skript už je archivovaný

- Fyzicky je v tomhle adresáři (`scripts/archive/`).
- Skript má na vrchu guard co detekuje `basename(dirname(__filename)) === "archive"` —
  když ho pustíš přímo z archivu, vypíše varování a odmítne start.
  Kdybys ho opravdu potřeboval rerunnout (disaster recovery), odkomentuj guard.

## Archiv

<!-- Nové řádky přidává deploy.mjs automaticky. Formát:
     | YYYY-MM-DD | V-verze | `script.mjs` | Popis |
-->

| Datum | Verze | Skript | Popis |
|-------|-------|--------|-------|
| 2026-04-24 | V17.8 | `2026-04-24-V17.8-authorRole.mjs` | Backfill authorRole do historických tasků (před V17.1 deploy) |
