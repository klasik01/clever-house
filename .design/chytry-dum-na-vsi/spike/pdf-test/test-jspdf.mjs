// Test: jsPDF s ručním embed Roboto fontu pro CZ diakritiku
// Bez font embedu: háčky a čárky se mazají nebo nahrazují "?".
// POZN.: pro true solid test stáhni Roboto Regular TTF a base64-encoduj:
//   https://fonts.google.com/specimen/Roboto → Download family
//   Pak base64: `base64 -w0 Roboto-Regular.ttf > roboto.base64`
//   a nastav const ROBOTO_BASE64 níže.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  fs.readFileSync(path.join(__dirname, "sample.json"), "utf8")
);
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

// ---- Volitelné font embed (místo '???' pro diakritiku) ----
const ROBOTO_BASE64 = ""; // ← paste base64 TTF obsah tady

const doc = new jsPDF({ unit: "pt", format: "a4" });

if (ROBOTO_BASE64) {
  doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_BASE64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.setFont("Roboto", "normal");
} else {
  console.warn(
    "[jspdf] Bez ROBOTO_BASE64 — diakritika se pravděpodobně rozpadne. " +
    "Stáhni Roboto Regular TTF a nastav konstantu."
  );
}

const pageWidth = doc.internal.pageSize.getWidth();
const margin = 48;
let y = margin;

// Title
doc.setFontSize(20);
doc.text(sample.title, margin, y);
y += 24;
doc.setFontSize(11);
doc.text(sample.subtitle, margin, y);
y += 16;
doc.setTextColor(120, 120, 120);
doc.text(`Vygenerováno: ${sample.generatedAt}`, margin, y);
doc.setTextColor(0, 0, 0);
y += 28;

// Rule
doc.setDrawColor(200, 200, 200);
doc.line(margin, y, pageWidth - margin, y);
y += 20;

// Questions
doc.setFontSize(12);
sample.questions.forEach((q, i) => {
  const meta = `${q.category} · ${q.location} · Status: ${q.status}`;
  doc.setFontSize(10);
  doc.setTextColor(130, 130, 130);
  doc.text(meta, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 14;

  doc.setFontSize(12);
  const lines = doc.splitTextToSize(q.text, pageWidth - 2 * margin);
  doc.text(lines, margin, y);
  y += lines.length * 16 + 20;

  if (y > 780) {
    doc.addPage();
    y = margin;
  }
});

const outPath = path.join(outDir, "jspdf.pdf");
fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("[jspdf] Zapsáno:", outPath);
console.log(
  "[jspdf] Otevři a zkontroluj: diakritika, layout, velikost souboru."
);
