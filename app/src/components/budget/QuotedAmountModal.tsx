import { type FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { setQuotedAmount } from "@/lib/budget/sections";
import { formatCzk, parseCzk } from "@/lib/budget/format";
import type { BudgetSection } from "@/types";

interface Props {
  open: boolean;
  section: BudgetSection;
  onClose: () => void;
  onSaved?: () => void;
}

export default function QuotedAmountModal({
  open,
  section,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const backdropRef = useRef<HTMLDivElement>(null);

  const [castkaInput, setCastkaInput] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCastkaInput(
        section.quotedAmountCzk ? String(section.quotedAmountCzk) : "",
      );
      setSupplier(section.quotedSupplier ?? "");
      setNote("");
      setError(null);
      setSubmitting(false);
      setShowHistory(false);
    }
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  // Body scroll lock — když je modal otevřený, zablokuj scroll pozadí
  // (jinak by se dalo scrollovat skrz overlay, což působí "volně").
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const castka = parseCzk(castkaInput);
    if (!Number.isFinite(castka) || castka < 0) {
      setError(t("budget.quoted.errorAmount"));
      return;
    }
    if (!note.trim() || note.trim().length < 3) {
      setError(t("budget.quoted.errorNote"));
      return;
    }

    setSubmitting(true);
    try {
      await setQuotedAmount(
        section.id,
        castka,
        supplier || undefined,
        note,
        user.uid,
      );
      onSaved?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const history = section.quotedHistory ?? [];

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={t("budget.quoted.title")}
    >
      <div className="w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line">
        <div className="shrink-0 flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {t("budget.quoted.title")}
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-sm text-ink-muted">
            {t("budget.quoted.intro")}
          </p>

          <label className="block text-sm font-medium text-ink">
            {t("budget.quoted.amountLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={castkaInput}
              onChange={(e) => setCastkaInput(e.target.value)}
              disabled={submitting}
              placeholder="750 000"
              className="money-input mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.quoted.supplierLabel")}
            <input
              type="text"
              maxLength={120}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              disabled={submitting}
              placeholder={t("budget.quoted.supplierPlaceholder")}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.quoted.noteLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <textarea
              rows={2}
              required
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              placeholder={t("budget.quoted.notePlaceholder")}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-accent focus:outline-none"
            />
          </label>

          {history.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="inline-flex items-center gap-1 text-sm text-ink-link hover:text-ink-link-hover"
              >
                {showHistory ? (
                  <ChevronDown aria-hidden size={16} />
                ) : (
                  <ChevronRight aria-hidden size={16} />
                )}
                {t("budget.expected.historyToggle", { n: history.length })}
              </button>
              {showHistory ? (
                <ul className="mt-2 space-y-2 rounded-md border border-line bg-surface-raised p-3 text-xs">
                  {[...history].reverse().map((entry, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-1 border-b border-line pb-2 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink tabular-nums">
                          {formatCzk(entry.amountCzk)}
                        </span>
                        <span className="text-ink-subtle">
                          {formatDateTimeCs(entry.changedAt)}
                        </span>
                      </div>
                      {entry.note ? (
                        <p className="text-ink-muted">{entry.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            >
              {error}
            </p>
          ) : null}

          </div>
          <div className="shrink-0 border-t border-line bg-bg px-4 py-3 flex justify-end gap-3">
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
              {submitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDateTimeCs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
