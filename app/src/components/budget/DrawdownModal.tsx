import { type FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { createDrawdown, updateDrawdown } from "@/lib/budget/drawdowns";
import { parseCzk } from "@/lib/budget/format";
import type { BankDrawdown } from "@/types";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  drawdown?: BankDrawdown | null;
  defaultBank?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DrawdownModal({
  open,
  mode,
  drawdown,
  defaultBank,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const backdropRef = useRef<HTMLDivElement>(null);

  const [castkaInput, setCastkaInput] = useState("");
  const [datum, setDatum] = useState("");
  const [banka, setBanka] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCastkaInput(drawdown ? String(drawdown.castka) : "");
      setDatum(drawdown?.datum ?? (mode === "create" ? todayIso() : ""));
      setBanka(drawdown?.banka ?? defaultBank ?? "");
      setNote(drawdown?.note ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [open, drawdown, mode, defaultBank]);

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
      setError(t("budget.drawdown.errorAmount"));
      return;
    }
    if (!datum) {
      setError(t("budget.drawdown.errorDatum"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const id = await createDrawdown(
          { castka, datum, banka, note },
          user.uid,
        );
        onSaved?.(id);
      } else if (drawdown) {
        await updateDrawdown(drawdown.id, { castka, datum, banka, note });
        onSaved?.(drawdown.id);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "create"
          ? t("budget.drawdown.newTitle")
          : t("budget.drawdown.editTitle")
      }
    >
      <div className="w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line">
        <div className="shrink-0 flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {mode === "create"
              ? t("budget.drawdown.newTitle")
              : t("budget.drawdown.editTitle")}
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
          <label className="block text-sm font-medium text-ink">
            {t("budget.drawdown.amountLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <input
              type="text"
              inputMode="decimal"
              required
              autoFocus
              value={castkaInput}
              onChange={(e) => setCastkaInput(e.target.value)}
              disabled={submitting}
              placeholder="500 000"
              className="money-input mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.drawdown.datumLabel")}
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
            {t("budget.drawdown.bankaLabel")}
            <input
              type="text"
              value={banka}
              onChange={(e) => setBanka(e.target.value)}
              disabled={submitting}
              placeholder={defaultBank || t("budget.drawdown.bankaPlaceholder")}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            {t("budget.drawdown.noteLabel")}
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting}
              placeholder={t("budget.drawdown.notePlaceholder")}
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
              {submitting
                ? t("common.saving")
                : mode === "create"
                ? t("budget.drawdown.add")
                : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
