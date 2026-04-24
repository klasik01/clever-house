# scripts/archive/

Jednorázové migrační skripty, které **už se nesmí znovu spustit**.
Co tady leží, patří do historie — typicky šlo o backfill schematického
pole, reshapování kolekce, nebo one-off cleanup po incidentu.

## Jak se sem skripty dostanou

Automaticky, přes orchestrátor:

```
cd app/functions
npm run deploy:dev       # nejdřív dev, ověř
npm run deploy:ope       # pak prod
```

Orchestrátor `scripts/deploy.mjs`:

1. Vezme všechno z `scripts/pending/` (seřazeno abecedně — díky
   `YYYY-MM-DD-...` prefixu to je chronologicky).
2. Pro každý skript spustí `node <script> <env>`.
3. Po úspěšném exit 0 ho přesune sem + přidá řádek do tabulky níž
   (parsuje se JSDoc header `@migration`, `@date`, `@description`).

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
