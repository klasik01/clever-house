# Pre-spike — Chytrý dům na vsi

Tři kritické věci ověřit, **než začneme stavět MVP**. Všechny tři mají vlastní podsložku s runnable kódem.

## Cíl

Do konce tohoto pre-spiku (budget ~8 h) máme:

1. ✅ **Rozhodnutí:** která PDF knihovna se používá v S12. Se CZ diakritikou a obrázkem.
2. ✅ **Potvrzení:** PWA lze nainstalovat na iPhone + Android a otevírá se rovnou do `start_url`.
3. ✅ **Draft:** Firestore Security Rules pro dvě role (OWNER, PROJECT_MANAGER), procházející Emulator testy.

Pokud něco z těchto tří selže, **pozastavíme MVP start** a vyřešíme to nejdřív (před S01).

## Pořadí spouštění

1. **`firestore-rules/`** — nejjednodušší, ověří že rules-unit-testing funguje. ~1 h.
2. **`pwa-test/`** — deploy na Netlify + install na mobilu. ~2 h (půl hodiny coding, zbytek dotyk s reálným Netlify projektem + iPhone).
3. **`pdf-test/`** — porovnat 2 knihovny (jsPDF + pdfmake) s CZ diakritikou a obrázkem. ~3-4 h. **Risk block** — pokud obě selžou, padá fallback na `@react-pdf/renderer` (dalších ~2 h).

## Deliverables

Po ukončení spike uložit rozhodnutí do souboru `DECISIONS.md` v rootu feature folderu:

```markdown
# Decisions — Chytrý dům na vsi

## PDF library (S12)
- **Chosen:** pdfmake (příklad)
- **Rejected:** jsPDF (diacritic issues bez ruční font embed)
- **Reason:** ...
- **Date:** 2026-04-...

## PWA install
- ✅ iPhone iOS 17 Safari → "Přidat na plochu" works, opens standalone on /
- ✅ Android Chrome → Install prompt appeared, opens standalone
- **Known issue:** iOS Safari doesn't auto-prompt, user must manually tap Share → Add to Home Screen.

## Firestore rules
- ✅ Emulator tests pass for OWNER / PM scenarios
- rules file preserved in `firestore.rules` ready to copy to S02 project
```

---

## Složky

- [`pdf-test/`](./pdf-test/README.md) — Node skript, test jsPDF + pdfmake s CZ daty.
- [`pwa-test/`](./pwa-test/README.md) — minimální statická PWA k deployi na Netlify.
- [`firestore-rules/`](./firestore-rules/README.md) — rules + unit testy přes `@firebase/rules-unit-testing`.
