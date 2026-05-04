import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { updateCurrentBalance } from "@/lib/budget/settings";
import { formatCzk, parseCzk } from "@/lib/budget/format";
import { ROUTES } from "@/lib/routes";

export default function SettingsZustatek() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settingsState = useBudgetSettings();

  const [castkaInput, setCastkaInput] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (settingsState.status === "ready") {
      const s = settingsState.settings;
      setCastkaInput(
        s.currentAccountBalanceCzk ? String(s.currentAccountBalanceCzk) : "",
      );
    }
  }, [settingsState]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);

    const castka = parseCzk(castkaInput);
    if (!Number.isFinite(castka) || castka < 0) {
      setError(t("budget.balance.errorAmount"));
      return;
    }

    setSubmitting(true);
    try {
      await updateCurrentBalance(castka, note || undefined, user.uid);
      setNote("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const settings =
    settingsState.status === "ready" ? settingsState.settings : null;
  const lastUpdate = settings?.currentAccountBalanceUpdatedAt;
  const history = settings?.balanceUpdateHistory ?? [];

  return (
    <section
      aria-labelledby="settings-zustatek-heading"
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
        <Wallet aria-hidden size={24} className="text-ink-muted" />
        <h2
          id="settings-zustatek-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.balance.title")}
        </h2>
      </header>

      <p className="text-sm text-ink-muted leading-relaxed">
        {t("budget.balance.intro")}
      </p>

      {settings?.currentAccountBalanceCzk !== null &&
      settings?.currentAccountBalanceCzk !== undefined ? (
        <div className="rounded-md border border-line bg-surface-raised px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-ink-muted">
              {t("budget.balance.currentLabel")}
            </span>
            <span className="text-base font-semibold text-ink tabular-nums">
              {formatCzk(settings.currentAccountBalanceCzk!)}
            </span>
          </div>
          {lastUpdate ? (
            <p className="mt-1 text-xs text-ink-subtle">
              {t("budget.balance.lastUpdate", {
                when: formatDateTimeCs(lastUpdate),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-ink">
          {t("budget.balance.amountLabel")}
          <span className="text-status-danger-fg" aria-hidden> *</span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={castkaInput}
            onChange={(e) => setCastkaInput(e.target.value)}
            disabled={submitting || settingsState.status !== "ready"}
            placeholder="240 000"
            className="money-input mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink min-h-tap focus:border-accent focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink-subtle">
            {t("budget.balance.amountHint")}
          </span>
        </label>

        <label className="block text-sm font-medium text-ink">
          {t("budget.balance.noteLabel")}
          <textarea
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting || settingsState.status !== "ready"}
            placeholder={t("budget.balance.notePlaceholder")}
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

        {savedFlash ? (
          <p className="rounded-md border border-status-success-border bg-status-success-bg px-3 py-2 text-sm text-status-success-fg">
            {t("budget.balance.saved")}
          </p>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting || settingsState.status !== "ready"}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>

      {history.length > 0 ? (
        <div>
          <h3 className="mt-4 text-sm font-semibold text-ink">
            {t("budget.balance.historyTitle")}
          </h3>
          <ul className="mt-2 space-y-2">
            {[...history].reverse().slice(0, 10).map((entry, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs text-ink-subtle">
                    {formatDateTimeCs(entry.updatedAt)}
                  </span>
                  {entry.note ? (
                    <span className="text-xs text-ink-muted truncate">
                      {entry.note}
                    </span>
                  ) : null}
                </div>
                <span className="text-base font-semibold text-ink tabular-nums">
                  {formatCzk(entry.amountCzk)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
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
