import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Landmark, Lock, Pencil } from "lucide-react";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { useBankDrawdowns } from "@/hooks/useBankDrawdowns";
import { updateMortgageSettings } from "@/lib/budget/settings";
import { computeMortgageStatus } from "@/lib/budget/totals";
import { formatCzk, parseCzk } from "@/lib/budget/format";
import { ROUTES } from "@/lib/routes";

export default function SettingsHypoteka() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settingsState = useBudgetSettings();
  const drawdownsState = useBankDrawdowns();

  const [castkaInput, setCastkaInput] = useState("");
  const [banka, setBanka] = useState("");
  const [datum, setDatum] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // Hydrate form from current settings
  useEffect(() => {
    if (settingsState.status === "ready") {
      const s = settingsState.settings;
      setCastkaInput(
        s.mortgageApprovedAmountCzk ? String(s.mortgageApprovedAmountCzk) : "",
      );
      setBanka(s.mortgageBank ?? "");
      setDatum(s.mortgageApprovedAt ?? "");
    }
  }, [settingsState]);

  const status = computeMortgageStatus(
    settingsState.status === "ready" ? settingsState.settings : null,
    drawdownsState.status === "ready" ? drawdownsState.drawdowns : [],
  );

  const isInitialized = status.limit !== null && status.limit > 0;
  const editable = !isInitialized || unlocked;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const castka = parseCzk(castkaInput);
    if (!Number.isFinite(castka) || castka < 0) {
      setError(t("budget.settings.errorAmount"));
      return;
    }

    setSubmitting(true);
    try {
      await updateMortgageSettings(
        {
          mortgageApprovedAmountCzk: castka,
          mortgageBank: banka,
          mortgageApprovedAt: datum,
        },
        user.uid,
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="settings-hypoteka-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <button
        type="button"
        onClick={() => navigate(ROUTES.nastaveni)}
        className="inline-flex items-center gap-1 -ml-2 px-2 py-1 text-sm text-ink-link hover:text-ink-link-hover"
      >
        <ArrowLeft aria-hidden size={16} />
        {t("settings.title")}
      </button>

      <header className="flex items-center gap-3">
        <Landmark aria-hidden size={24} className="text-ink-muted" />
        <h2
          id="settings-hypoteka-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.settings.hypotekaTitle")}
        </h2>
      </header>

      {/* Aktuální status */}
      {status.limit !== null ? (
        <div className="rounded-md border border-line bg-surface-raised px-4 py-3 text-sm">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label={t("budget.settings.statusLimit")}
              value={formatCzk(status.limit)}
            />
            <Stat
              label={t("budget.settings.statusDrawn")}
              value={formatCzk(status.drawn)}
              tone={status.overLimit ? "danger" : "neutral"}
            />
            <Stat
              label={t("budget.settings.statusRemaining")}
              value={status.remaining !== null ? formatCzk(status.remaining) : "—"}
              tone={status.overLimit ? "danger" : "success"}
            />
          </div>
          {status.percentage !== null ? (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-pill bg-bg-muted">
                <div
                  className={[
                    "h-full transition-all",
                    status.overLimit ? "bg-status-danger-fg" : "bg-accent",
                  ].join(" ")}
                  style={{
                    width: `${Math.min(100, status.percentage)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-right text-xs text-ink-muted tabular-nums">
                {status.percentage}%
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-ink">
          {t("budget.settings.amountLabel")}
          <span className="text-status-danger-fg" aria-hidden> *</span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={castkaInput}
            onChange={(e) => setCastkaInput(e.target.value)}
            disabled={!editable || submitting || settingsState.status !== "ready"}
            placeholder="4 000 000"
            className="money-input mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none disabled:bg-bg-subtle disabled:text-ink-muted"
          />
          <span className="mt-1 block text-xs text-ink-subtle">
            {t("budget.settings.amountHint")}
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          {t("budget.settings.bankaLabel")}
          <input
            type="text"
            value={banka}
            onChange={(e) => setBanka(e.target.value)}
            disabled={!editable || submitting || settingsState.status !== "ready"}
            placeholder={t("budget.settings.bankaPlaceholder")}
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none disabled:bg-bg-subtle disabled:text-ink-muted"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          {t("budget.settings.datumLabel")}
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            disabled={!editable || submitting || settingsState.status !== "ready"}
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none disabled:bg-bg-subtle disabled:text-ink-muted"
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

        {savedFlash ? (
          <p className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2 text-sm text-status-success-fg">
            {t("budget.settings.saved")}
          </p>
        ) : null}

        <div className="flex justify-end pt-2">
          {!editable ? (
            <div className="flex flex-col items-end gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <Lock aria-hidden size={12} />
                {t("budget.settings.lockedHint")}
              </p>
              <button
                type="button"
                onClick={() => setConfirmEditOpen(true)}
                className="inline-flex items-center gap-1.5 min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle"
              >
                <Pencil aria-hidden size={14} />
                {t("budget.settings.editCta")}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting || settingsState.status !== "ready"}
              className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? t("common.saving") : t("common.save")}
            </button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmEditOpen}
        title={t("budget.settings.confirmEditTitle")}
        message={t("budget.settings.confirmEditBody")}
        confirmLabel={t("budget.settings.confirmEditBtn")}
        destructive
        onConfirm={() => {
          setUnlocked(true);
          setConfirmEditOpen(false);
        }}
        onClose={() => setConfirmEditOpen(false)}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const valueClass =
    tone === "success"
      ? "text-status-success-fg"
      : tone === "danger"
      ? "text-status-danger-fg"
      : "text-ink";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={`text-base font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
