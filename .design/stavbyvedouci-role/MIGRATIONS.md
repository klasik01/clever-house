# V24 Migrations — Decision Record

## Date: 2026-04-29

## Otázka

V24 zavádí nový read scope pro CM přes `sharedWithRoles` array-contains.
Existují historické tasky, které stále nesou legacy `sharedWithPm: true`
field bez moderního `sharedWithRoles` arraye. Vyžadují migraci?

## Odpověď: NE, bridge stačí

V `app/src/lib/tasks.ts` řádek 285 (`fromDocSnap`) je read-time bridge:

```ts
sharedWithRoles: Array.isArray(data.sharedWithRoles)
  ? data.sharedWithRoles
  : data.sharedWithPm === true
  ? ["PROJECT_MANAGER"]
  : [],
```

Mapování:

- Modern doc `{sharedWithRoles: [...]}` — pass-through, CM v arrayi pokud
  byl explicitně přidán (V24 sharing UI).
- Legacy doc `{sharedWithPm: true}` (bez `sharedWithRoles`) — bridge → 
  `["PROJECT_MANAGER"]`. CM **NENÍ** v arrayi → CM nevidí → ✅ správné chování.
- Legacy doc bez obou polí — bridge → `[]`. CM nevidí → ✅.

Žádný scenario nedává CM omylem read access na legacy data. Žádný migrační
skript nepotřebujeme.

## Server-side rules

`firestore.rules` v V24 čte `resource.data.sharedWithRoles` přímo
(`'CONSTRUCTION_MANAGER' in resource.data.sharedWithRoles`). Pokud doc
má jen legacy `sharedWithPm: true`, `sharedWithRoles` neexistuje a CM read
gate vrátí false → ✅ stejné chování jako bridge.

## Per CLAUDE.md § 7

> **NEPSAT skript, když runtime bridge ve `fromDocSnap` / `bridge*` funkce
> stačí**

Tento scenario je přesně ten případ — bridge řeší legacy reads, žádný
backfill není potřebný.

## Audit checkliist (Stáňa pro deploy)

- [ ] Po nasazení do dev: spusť app jako CM, ověř že nevidíš žádnou legacy
      sdílenou dokumentaci.
- [ ] Sample test 5 random dokumentace tasků: některý by měl mít legacy
      `sharedWithPm: true`, jiný moderní `sharedWithRoles`. Bridge oba
      handluje.
- [ ] Pokud CM uvidí něco, co neměl (defekt v bridge), throw do issue
      tracker; necháme audit a případně dopíšeme migrační skript pro
      problémové tasky.

## Souvisejcí změny v tomto V24 PR

- `app/deploy/firestore.rules` — read rule pro CM (S02)
- `app/src/lib/tasks.ts` — `subscribeTasksForCm` 4-query approach (S03)
- `app/src/lib/permissions.ts` — `canViewTask` rozšířený o CM (S03)
- `app/src/lib/permissionsConfig.ts` — CM column v PERMISSIONS (S04)
- `app/functions/src/notify/canRead.ts` — server-side recipient gate (S08)

Žádné z těchto změn nevyžaduje data migration.
