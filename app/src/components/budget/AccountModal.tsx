import { type FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { createAccount, updateAccount } from "@/lib/budget/accounts";
import type { BudgetAccount, BudgetAccountKind } from "@/types";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  account?: BudgetAccount | null;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

const KINDS: BudgetAccountKind[] = ["BEZNY", "HYPOTECNI", "HOTOVOST", "CUSTOM"];

export default function AccountModal({
  open,
  mode,
  account,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const backdropRef = useRef<HTMLDivElement>(null);

  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<BudgetAccountKind>("CUSTOM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel(account?.label ?? "");
      setKind(account?.kind ?? "CUSTOM");
      setError(null);
      setSubmitting(false);
    }
  }, [open, account]);

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
    setSubmitting(true);
    try {
      if (mode === "create") {
        const id = await createAccount({ label, kind }, user.uid);
        onSaved?.(id);
      } else if (account) {
        await updateAccount(account.id, { label, kind });
        onSaved?.(account.id);
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
      aria-label={mode === "create" ? t("budget.account.newTitle") : t("budget.account.editTitle")}
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {mode === "create" ? t("budget.account.newTitle") : t("budget.account.editTitle")}
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
            {t("budget.account.labelLabel")}
            <span className="text-status-danger-fg" aria-hidden> *</span>
            <input
              type="text"
              required
              maxLength={80}
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={submitting}
              placeholder={t("budget.account.labelPlaceholder")}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
            />
          </label>

          <fieldset
            className="rounded-md border border-line px-4 py-3"
            disabled={submitting}
          >
            <legend className="px-2 text-sm font-medium text-ink">
              {t("budget.account.kindLabel")}
            </legend>
            <div className="space-y-1">
              {KINDS.map((k) => (
                <label
                  key={k}
                  className="flex min-h-tap items-center gap-2 text-sm text-ink cursor-pointer"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    checked={kind === k}
                    onChange={() => setKind(k)}
                  />
                  <span>{t(`budget.account.kind.${k}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

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
                ? t("common.create")
                : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
