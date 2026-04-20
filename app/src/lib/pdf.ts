import type { Category, Task } from "@/types";
import { pdfColors, pdfLayout, pdfTypography } from "./pdfTokens";
import { getLocation } from "./locations";

/**
 * Generate a PDF blob for a list of tasks.
 * Lazy-loads pdfmake + vfs_fonts to keep main bundle lean (~1.5 MB saved).
 * CZ diacritics work out-of-box via Roboto bundled in vfs_fonts.
 *
 * Images are fetched, base64-encoded and embedded. If any image fails
 * (CORS, 404, timeout) the task renders without it and a URL note is shown.
 */
export async function generateTasksPdfBlob(params: {
  tasks: Task[];
  categories: Category[];
  title: string;
  subtitle: string;
}): Promise<Blob> {
  const { tasks, categories, title, subtitle } = params;

  // Lazy-load pdfmake
  const pdfmakeModule = (await import("pdfmake/build/pdfmake")) as unknown as {
    default: Pdfmake;
    vfs?: Record<string, string>;
  };
  const vfsFontsModule = (await import("pdfmake/build/vfs_fonts")) as unknown as {
    default?: { pdfMake?: { vfs: Record<string, string> } };
    pdfMake?: { vfs: Record<string, string> };
  };

  const pdfmake = pdfmakeModule.default ?? (pdfmakeModule as unknown as Pdfmake);
  const vfs =
    vfsFontsModule.default?.pdfMake?.vfs ??
    vfsFontsModule.pdfMake?.vfs ??
    (vfsFontsModule as unknown as { vfs: Record<string, string> }).vfs;
  if (vfs) pdfmake.vfs = vfs;

  // Convert images to data URIs (best-effort)
  const imageCache: Record<string, string | null> = {};
  for (const t of tasks) {
    if (t.attachmentImageUrl && !(t.attachmentImageUrl in imageCache)) {
      imageCache[t.attachmentImageUrl] = await fetchAsDataUri(t.attachmentImageUrl).catch(
        () => null
      );
    }
  }

  const docDefinition: PdfDocDefinition = {
    pageSize: pdfLayout.pageSize,
    pageMargins: pdfLayout.pageMargins,
    defaultStyle: { font: "Roboto", fontSize: pdfTypography.fontBody, lineHeight: pdfTypography.lineHeight },
    content: [
      { text: title, style: "title" },
      { text: subtitle, style: "subtitle" },
      {
        text: `Vygenerováno: ${new Date().toLocaleString("cs-CZ")}`,
        style: "meta",
        margin: [0, 0, 0, 16],
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: pdfLayout.contentWidth,
            y2: 0,
            lineWidth: 0.5,
            lineColor: pdfColors.ruleLine,
          },
        ],
        margin: [0, 0, 0, 14],
      },
      ...tasks.flatMap((task, i) => renderTaskBlock(task, i, categories, imageCache)),
      tasks.length === 0
        ? { text: "(žádné záznamy)", style: "meta", alignment: "center" }
        : null,
    ].filter(Boolean) as PdfContent[],
    styles: {
      title: { fontSize: pdfTypography.fontTitle, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: pdfTypography.fontSubtitle, color: pdfColors.textSubtle },
      meta: { fontSize: pdfTypography.fontMeta, color: pdfColors.textSubtle },
      taskHeader: { fontSize: pdfTypography.fontSubtitle, bold: true, margin: [0, 8, 0, 2] },
      taskBody: { fontSize: pdfTypography.fontBody, margin: [0, 2, 0, 4] },
      tag: { fontSize: pdfTypography.fontTag, color: pdfColors.tag },
      answer: { fontSize: pdfTypography.fontBody, italics: true, color: pdfColors.successFg, margin: [12, 4, 0, 0] },
    },
  };

  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfmake.createPdf(docDefinition).getBlob((blob: Blob) => resolve(blob));
    } catch (e) {
      reject(e);
    }
  });
}

function renderTaskBlock(
  task: Task,
  index: number,
  categories: Category[],
  imageCache: Record<string, string | null>
): PdfContent[] {
  const category = task.categoryId
    ? categories.find((c) => c.id === task.categoryId)?.label
    : null;
  const location = getLocation(task.locationId)?.label ?? null;

  const meta: string[] = [`Stav: ${task.status}`];
  if (category) meta.push(`Kategorie: ${category}`);
  if (location) meta.push(`Lokace: ${location}`);

  const blocks: PdfContent[] = [
    {
      text: `${index + 1}. ${task.body.trim() || task.title.trim() || "(bez textu)"}`,
      style: "taskHeader",
    },
    { text: meta.join(" · "), style: "tag" },
  ];

  const allImages = task.attachmentImages?.length
    ? task.attachmentImages.map((i) => i.url)
    : task.attachmentImageUrl
    ? [task.attachmentImageUrl]
    : [];
  for (const imgUrl of allImages) {
    const dataUri = imageCache[imgUrl];
    if (dataUri) {
      blocks.push({
        image: dataUri,
        fit: [200, 150],
        margin: [0, 6, 0, 2],
      } as PdfContent);
    } else {
      blocks.push({
        text: `Obrázek (nelze embeddovat): ${imgUrl}`,
        style: "meta",
        margin: [0, 4, 0, 2],
      });
    }
  }

  const allLinks = task.attachmentLinks?.length
    ? task.attachmentLinks
    : task.attachmentLinkUrl
    ? [task.attachmentLinkUrl]
    : [];
  for (const link of allLinks) {
    blocks.push({
      text: `Odkaz: ${link}`,
      link,
      style: "meta",
      color: pdfColors.accent,
      decoration: "underline",
      margin: [0, 2, 0, 2],
    } as PdfContent);
  }

  if (task.projektantAnswer) {
    blocks.push({
      text: `Odpověď Projektanta: ${task.projektantAnswer}`,
      style: "answer",
    });
  }

  blocks.push({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: pdfLayout.contentWidth,
        y2: 0,
        lineWidth: 0.25,
        lineColor: pdfColors.ruleLineThin,
      },
    ],
    margin: [0, 10, 0, 0],
  });

  return blocks;
}

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ---------- Minimal pdfmake types (avoids pulling @types everywhere) ----------

type PdfContent = Record<string, unknown>;
interface PdfDocDefinition {
  pageSize?: string;
  pageMargins?: number[] | [number, number, number, number];
  defaultStyle?: Record<string, unknown>;
  content: PdfContent[];
  styles?: Record<string, Record<string, unknown>>;
}
interface Pdfmake {
  vfs?: Record<string, string>;
  createPdf: (doc: PdfDocDefinition) => {
    getBlob: (cb: (blob: Blob) => void) => void;
    download: (name?: string) => void;
    open: () => void;
  };
}
