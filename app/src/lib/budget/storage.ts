import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/firebase";

const PDF_PATH_PREFIX = "budget_invoices";

/** Maximální velikost PDF (10 MB, drží Storage rule). */
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Uploadne PDF k faktuře. Vrací storage path k uložení do Firestore
 * (`pdfPath`). Path formát: `budget_invoices/{invoiceId}`.
 */
export async function uploadInvoicePdf(
  invoiceId: string,
  file: File,
): Promise<string> {
  if (!file) throw new Error("Nebyl vybrán žádný soubor.");
  if (file.type !== "application/pdf") {
    throw new Error("Příloha musí být PDF.");
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error(
      `PDF je moc velké (${formatMb(file.size)} MB). Limit je ${formatMb(MAX_PDF_SIZE_BYTES)} MB.`,
    );
  }

  const path = `${PDF_PATH_PREFIX}/${invoiceId}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, {
    contentType: "application/pdf",
    customMetadata: {
      originalFileName: file.name,
    },
  });
  return path;
}

/** Smaže PDF z Storage. Idempotentní (pokud neexistuje, projde tiše). */
export async function deleteInvoicePdf(pdfPath: string): Promise<void> {
  if (!pdfPath) return;
  try {
    const ref = storageRef(storage, pdfPath);
    await deleteObject(ref);
  } catch (err) {
    // 'storage/object-not-found' = už smazaný (idempotence). Neházej.
    const code = (err as { code?: string })?.code;
    if (code === "storage/object-not-found") return;
    throw err;
  }
}

/** Vrátí jednorázové download URL k PDF (signed token, dlouhá platnost). */
export async function getInvoicePdfUrl(pdfPath: string): Promise<string> {
  const ref = storageRef(storage, pdfPath);
  return getDownloadURL(ref);
}

function formatMb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}
