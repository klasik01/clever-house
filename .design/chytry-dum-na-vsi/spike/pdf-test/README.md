# PDF test — jsPDF vs pdfmake

## Cíl
Zjistit, která knihovna vygeneruje PDF s **CZ diakritikou** (háčky, čárky) a vloženým **obrázkem**, bez mazání znaků nebo zobrazení krabiček.

## Kritéria hodnocení
- ✅ Diakritika čitelná bez náhrady (čřžšč ěíéáů)
- ✅ Obrázek vložený a viditelný
- ✅ Velikost výsledného souboru ≤ 500 KB pro 3 otázky s 1 obrázkem
- ✅ Rychlost generování ≤ 1 s pro 10 záznamů
- ✅ Dá se portovat do React bundler + browser runtime (ne jen Node)
- ✅ Rozumný developer experience (deklarativní API, dokumentace)

## Spuštění

```bash
cd pdf-test
npm install
npm run test
# Vygeneruje: out/jspdf.pdf, out/pdfmake.pdf
# Otevři oba, vizuálně porovnej.
```

## Rozhodnutí
Zapiš do `../DECISIONS.md` v rootu spike/ nebo do `.design/chytry-dum-na-vsi/DECISIONS.md`.

## Fallback
Pokud obě knihovny selžou, zkus **`@react-pdf/renderer`** (vyžaduje React runtime → zkoušet přes Vite sandbox, ne čistý Node).
