# PWA install test

## Cíl
Ověřit, že:
1. Čistá PWA z Netlify lze přidat na plochu iPhone (Safari) + Android (Chrome).
2. Po tapu ikony se otevře ve **standalone módu** (bez browser UI).
3. `start_url: "/"` vede správně na capture screen.
4. `theme_color` a `background_color` působí hezky při splash screenu.

## Deploy

1. Nahraj obsah této složky do nového GitHub repa `clever-house-pwa-spike/`.
2. Netlify → New site → Import from Git → vyber repo → Publish directory `/` → Deploy.
3. Vezmeš dostanou URL jako `https://xyz.netlify.app/`.

## Test na iPhone (Safari)
1. Otevři URL v Safari.
2. Share button → "Přidat na plochu" → potvrď.
3. Ikona se objeví na home-screen s názvem *"Chytrý dům"*.
4. Tap → otevře se **bez address baru** (fullscreen standalone).
5. Obrazovka zobrazuje *"PWA install test — works!"* s timestampem.

**Známý iOS limit:** iOS Safari **neukáže automatický install prompt** jako Android. Uživatel musí manuálně tapnout Share → Add to Home Screen. Na to v MVP mysli (onboarding instrukce).

## Test na Android (Chrome)
1. Otevři URL v Chrome.
2. Mělo by se zobrazit "Install app" banner nebo v menu "Install app".
3. Tap → instalace → ikona v launcheru.
4. Tap ikony → standalone.

## Co k tomu budeš potřebovat
- Ikona 192×192 a 512×512 jako PNG (tady je placeholder SVG). Nahraď za skutečné produkční ikony.
- Zelené/beige barvy z design tokens jsou přednastavené v manifestu.

## Výsledek
Zaznamenej do `../DECISIONS.md`:
- iOS verze zařízení + Safari verze, install OK/FAIL, screenshot splash
- Android verze + Chrome verze, install OK/FAIL
- Známé caveats pro onboarding instrukce v MVP
