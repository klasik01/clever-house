// Test: pdfmake — má vestavěné Unicode fonty (Roboto built-in!)
// Pro CZ diakritiku by měl fungovat out-of-the-box.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PdfPrinter from "pdfmake";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  fs.readFileSync(path.join(__dirname, "sample.json"), "utf8")
);
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

// pdfmake v Node potřebuje font descriptor s cestami k TTF.
// Minimálně pro test: stáhni Roboto z https://fonts.google.com/specimen/Roboto
// a uloz do ./fonts/
const fonts = {
  Roboto: {
    normal: "fonts/Roboto-Regular.ttf",
    bold: "fonts/Roboto-Medium.ttf",
    italics: "fonts/Roboto-Italic.ttf",
    bolditalics: "fonts/Roboto-MediumItalic.ttf",
  },
};

const printer = new PdfPrinter(fonts);

const docDefinition = {
  pageSize: "A4",
  pageMargins: [48, 48, 48, 48],
  defaultStyle: { font: "Roboto", fontSize: 11 },
  content: [
    { text: sample.title, style: "title" },
    { text: sample.subtitle, style: "subtitle", margin: [0, 4, 0, 4] },
    {
      text: `Vygenerováno: ${sample.generatedAt}`,
      style: "meta",
      margin: [0, 0, 0, 16],
    },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 0.5, lineColor: "#c8c8c8" }] },
    { text: "", margin: [0, 0, 0, 16] },
    ...sample.questions.flatMap((q) => [
      {
        text: `${q.category} · ${q.location} · Status: ${q.status}`,
        style: "meta",
      },
      { text: q.text, margin: [0, 4, 0, 16] },
    ]),
  ],
  styles: {
    title: { fontSize: 20, bold: true },
    subtitle: { fontSize: 11 },
    meta: { fontSize: 10, color: "#828282" },
  },
};

const pdfDoc = printer.createPdfKitDocument(docDefinition);
const outPath = path.join(outDir, "pdfmake.pdf");
pdfDoc.pipe(fs.createWriteStream(outPath));
pdfDoc.end();
console.log("[pdfmake] Zapisuje:", outPath);
console.log(
  "[pdfmake] Stáhni fonty Roboto do ./fonts/, pokud jsou tam, diakritika funguje out-of-the-box."
);
