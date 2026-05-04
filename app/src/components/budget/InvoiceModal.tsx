import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import {
  createInvoice,
  setInvoicePdfPath,
  updateInvoice,
} from "@/lib/budget/invoices";
import {
  deleteInvoicePdf,
  MAX_PDF_SIZE_BYTES,
  uploadInvoicePdf,
} from "@/lib/budget/storage";
import { parseCzk } from "@/lib/budget/format";
import type { BudgetInvoice, InvoiceStatus } from "@/types";
import AccountPicker from "@/components/budget/AccountPicker";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  sectionId: string;
  invoice?: BudgetInvoice | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSplatnost(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function InvoiceModal({
  open,
  mode,
  sectionId,
  invoice,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [castkaInput, setCastkaInput] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("OPEN");
  const [datumPlatby, setDatumPlatby] = useState("");
  const [splatnost, setSplatnost] = useState("");
  // PDF state — soubor připravený k uploadu (jen v paměti). Existující pdfPath
  // (= z databáze) je v `invoice?.pdfPath`. Stav `removeExistingPdf` říká, že
  // při uložení smažeme starý PDF i bez nahrazení.
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [removeExistingPdf, setRemoveExistingPdf] = useState(false);
  const [ucetId, setUcetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCastkaInput(invoice ? String(invoice.castka) : "");
      setStatus(invoice?.status ?? "OPEN");
      setDatumPlatby(
        invoice?.datumPlatby ?? (mode === "create" ? todayIso() : ""),
      );
      setSplatnost(
        invoice?.splatnost ?? (mode === "create" ? defaultSplatnost() : ""),
      );
      setPickedFile(null);
      setRemoveExistingPdf(false);
      setUcetId(invoice?.ucetId ?? null);
      setError(null);
      setSubmitting(false);
    }
  }, [open, invoice, mode]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setPickedFile(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setError(t("budget.invoice.errorPdfType"));
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setError(
        t("budget.invoice.errorPdfSize", {
          mb: Math.round((file.size / 1024 / 1024) * 10) / 10,
        }),
      );
      e.target.value = "";
      return;
    }
    setPickedFile(file);
    setRemoveExistingPdf(false); // pokud user vybral nový, nahradíme = neoznačujeme remove
  }

  function handleRemoveExistingPdf() {
    if (!invoice?.pdfPath) return;
    setRemoveExistingPdf(true);
    setPickedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClearPickedFile() {
    setPickedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const castka = parseCzk(castkaInput);
    if (!Number.isFinite(castka) || castka <= 0) {
      setError(t("budget.invoice.errorAmount"));
      return;
    }
    if (status === "PAID" && !datumPlatby) {
      setError(t("budget.invoice.errorDatumPlatby"));
      return;
    }
    if (status === "OPEN" && !splatnost) {
      setError(t("budget.invoice.errorSplatnost"));
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        castka,
        status,
        datumPlatby: status === "PAID" ? datumPlatby : null,
        splatnost: splatnost || null,
        ucetId,
      };

      let invoiceId: string;
      if (mode === "create") {
        invoiceId = await createInvoice(sectionId, input, user.uid);
      } else if (invoice) {
        await updateInvoice(sectionId, invoice.id, input);
        invoiceId = invoice.id;
      } else {
        throw new Error("Invalid state");
      }

      // PDF flow — postupně:
      //  1. Pokud user explicitně označil "remove" a ne nahradil → smaž starý.
      //  2. Pokud picked file → smaž starý (pokud byl) + uploadni nový + ulož path.
      const oldPdfPath = invoice?.pdfPath ?? null;

      if (pickedFile) {
        // Replace flow: pokud existuje starý, nejdřív ho smaž.
        if (oldPdfPath) {
          try {
            await deleteInvoicePdf(oldPdfPath);
          } catch (err) {
            console.warn("Failed to delete old PDF (continuing)", err);
          }
        }
        const newPath = await uploadInvoicePdf(invoiceId, pickedFile);
        await setInvoicePdfPath(sectionId, invoiceId, newPath);
      } else if (removeExistingPdf && oldPdfPath) {
        try {
          await deleteInvoicePdf(oldPdfPath);
        } catch (err) {
          console.warn("Failed to delete PDF (continuing)", err);
        }
        await setInvoicePdfPath(sectionId, invoiceId, null);
      }

      onSaved?.(invoiceId);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const hasExistingPdf = !!(invoice?.pdfPath && !removeExistingPdf);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "create" ? t("budget.invoice.newTitle") : t("budget.invoice.editTitle")
      }
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {mode === "create"
              ? t("budget.invoice.newTitle")
              : t("budget.invoice.editTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
          <label className="block text-sm font-medium text-ink">
            {t("budget.invoice.amountLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={castkaInput}
              onChange={(e) => setCastkaInput(e.target.value)}
              disabled={submitting}
              placeholder="50 000"
              className="money-input mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <fieldset
            className="rounded-md border border-line px-4 py-3"
            disabled={submitting}
          >
            <legend className="px-2 text-sm font-medium text-ink">
              {t("budget.invoice.statusLabel")}
            </legend>
            <label className="flex min-h-tap items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="status"
                value="OPEN"
                checked={status === "OPEN"}
                onChange={() => setStatus("OPEN")}
              />
              <span>{t("budget.invoice.statusOpen")}</span>
            </label>
            <label className="flex min-h-tap items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="radio"
                name="status"
                value="PAID"
                checked={status === "PAID"}
                onChange={() => setStatus("PAID")}
              />
              <span>{t("budget.invoice.statusPaid")}</span>
            </label>
          </fieldset>

          {status === "OPEN" ? (
            <label className="block text-sm font-medium text-ink">
              {t("budget.invoice.splatnostLabel")}
              <span className="text-status-danger-fg" aria-hidden> *</span>
              <input
                type="date"
                required
                value={splatnost}
                onChange={(e) => setSplatnost(e.target.value)}
                disabled={submitting}
                className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
              />
            </label>
          ) : (
            <label className="block text-sm font-medium text-ink">
              {t("budget.invoice.datumPlatbyLabel")}
              <span className="text-status-danger-fg" aria-hidden> *</span>
              <input
                type="date"
                required
                value={datumPlatby}
                onChange={(e) => setDatumPlatby(e.target.value)}
                disabled={submitting}
                max={todayIso()}
                className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
              />
            </label>
          )}

          <label className="block text-sm font-medium text-ink">
            {t("budget.account.pickerLabel")}
            <AccountPicker
              value={ucetId}
              onChange={setUcetId}
              disabled={submitting}
            />
          </label>

          {/* PDF příloha */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">
              {t("budget.invoice.pdfLabel")}
              <span className="ml-1 text-xs font-normal text-ink-subtle">
                {t("budget.invoice.pdfHint")}
              </span>
            </p>

            {hasExistingPdf ? (
              <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                <FileText aria-hidden size={16} className="text-status-info-fg shrink-0" />
                <span className="flex-1 truncate text-ink">
                  {t("budget.invoice.pdfExisting")}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveExistingPdf}
                  disabled={submitting}
                  className="text-xs font-medium text-status-danger-fg hover:underline"
                >
                  {t("common.delete")}
                </button>
              </div>
            ) : null}

            {pickedFile ? (
              <div className="flex items-center gap-2 rounded-md border border-status-info-border bg-status-info-bg px-3 py-2 text-sm text-status-info-fg">
                <Paperclip aria-hidden size={16} className="shrink-0" />
                <span className="flex-1 truncate" title={pickedFile.name}>
                  {pickedFile.name}
                </span>
                <button
                  type="button"
                  onClick={handleClearPickedFile}
                  disabled={submitting}
                  className="text-xs font-medium text-status-danger-fg hover:underline"
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : null}

            <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-bg-subtle">
              <Paperclip aria-hidden size={16} />
              <span>
                {hasExistingPdf || pickedFile
                  ? t("budget.invoice.pdfReplace")
                  : t("budget.invoice.pdfAdd")}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={submitting}
                className="sr-only"
              />
            </label>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting
                ? pickedFile
                  ? t("budget.invoice.uploading")
                  : t("common.saving")
                : mode === "create"
                ? t("budget.invoice.add")
                : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
