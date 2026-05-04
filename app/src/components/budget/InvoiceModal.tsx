import { type FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { createInvoice, updateInvoice } from "@/lib/budget/invoices";
import { parseCzk } from "@/lib/budget/format";
import type { BudgetInvoice, InvoiceStatus } from "@/types";

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
  const [castkaInput, setCastkaInput] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("OPEN");
  const [datumPlatby, setDatumPlatby] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCastkaInput(invoice ? String(invoice.castka) : "");
      setStatus(invoice?.status ?? "OPEN");
      setDatumPlatby(
        invoice?.datumPlatby ?? (mode === "create" ? todayIso() : ""),
      );
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

    setSubmitting(true);
    try {
      const input = {
        castka,
        status,
        datumPlatby: status === "PAID" ? datumPlatby : null,
      };
      if (mode === "create") {
        const id = await createInvoice(sectionId, input, user.uid);
        onSaved?.(id);
      } else if (invoice) {
        await updateInvoice(sectionId, invoice.id, input);
        onSaved?.(invoice.id);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

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

          {status === "PAID" ? (
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
          ) : null}

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
                ? t("common.saving")
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
