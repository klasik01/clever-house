import { type FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { createPayment, updatePayment } from "@/lib/budget/payments";
import { parseCzk } from "@/lib/budget/format";
import type { BudgetPayment } from "@/types";
import AccountPicker from "@/components/budget/AccountPicker";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  sectionId: string;
  payment?: BudgetPayment | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PaymentModal({
  open,
  mode,
  sectionId,
  payment,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const backdropRef = useRef<HTMLDivElement>(null);

  const [castkaInput, setCastkaInput] = useState("");
  const [datum, setDatum] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [ucetId, setUcetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCastkaInput(payment ? String(payment.castka) : "");
      setDatum(payment?.datum ?? (mode === "create" ? todayIso() : ""));
      setSupplier(payment?.supplier ?? "");
      setNote(payment?.note ?? "");
      setUcetId(payment?.ucetId ?? null);
      setError(null);
      setSubmitting(false);
    }
  }, [open, payment, mode]);

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
      setError(t("budget.payment.errorAmount"));
      return;
    }
    if (!datum) {
      setError(t("budget.payment.errorDatum"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const id = await createPayment(
          sectionId,
          { castka, datum, supplier, note, ucetId },
          user.uid,
        );
        onSaved?.(id);
      } else if (payment) {
        await updatePayment(sectionId, payment.id, {
          castka,
          datum,
          supplier,
          note,
          ucetId,
        });
        onSaved?.(payment.id);
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
      aria-label={mode === "create" ? t("budget.payment.newTitle") : t("budget.payment.editTitle")}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {mode === "create"
              ? t("budget.payment.newTitle")
              : t("budget.payment.editTitle")}
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
          <p className="text-xs text-ink-muted">{t("budget.payment.intro")}</p>

          <label className="block text-sm font-medium text-ink">
            {t("budget.payment.amountLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={castkaInput}
              onChange={(e) => setCastkaInput(e.target.value)}
              disabled={submitting}
              placeholder="320"
              className="money-input mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.payment.datumLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <input
              type="date"
              required
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              disabled={submitting}
              max={todayIso()}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.payment.supplierLabel")}
            <input
              type="text"
              maxLength={120}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              disabled={submitting}
              placeholder={t("budget.payment.supplierPlaceholder")}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.account.pickerLabel")}
            <AccountPicker
              value={ucetId}
              onChange={setUcetId}
              disabled={submitting}
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.payment.noteLabel")}
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              placeholder={t("budget.payment.notePlaceholder")}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-accent focus:outline-none"
            />
          </label>

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
                ? t("budget.payment.add")
                : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
