import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useBudgetSettings } from "@/hooks/useBudgetSettings";
import { useBankDrawdowns } from "@/hooks/useBankDrawdowns";
import { computeMortgageStatus } from "@/lib/budget/totals";
import { formatCzk } from "@/lib/budget/format";
import { deleteDrawdown } from "@/lib/budget/drawdowns";
import DrawdownModal from "@/components/budget/DrawdownModal";
import ConfirmDialog from "@/components/budget/ConfirmDialog";
import { ROUTES } from "@/lib/routes";
import type { BankDrawdown } from "@/types";

export default function RozpocetHypoteka() {
  const t = useT();
  const settingsState = useBudgetSettings();
  const drawdownsState = useBankDrawdowns();

  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "edit"; drawdown: BankDrawdown }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BankDrawdown | null>(null);

  const status = useMemo(
    () =>
      computeMortgageStatus(
        settingsState.status === "ready" ? settingsState.settings : null,
        drawdownsState.status === "ready" ? drawdownsState.drawdowns : [],
      ),
    [settingsState, drawdownsState],
  );

  const settingsLoaded = settingsState.status === "ready";
  const drawdownsLoaded = drawdownsState.status === "ready";
  const isLoading = !settingsLoaded || !drawdownsLoaded;
  const hasSettings = status.limit !== null;
  const drawdowns = drawdownsState.status === "ready" ? drawdownsState.drawdowns : [];
  const defaultBank =
    settingsState.status === "ready"
      ? settingsState.settings.mortgageBank ?? undefined
      : undefined;

  async function handleDelete(d: BankDrawdown) {
    try {
      await deleteDrawdown(d.id);
    } catch (err) {
      console.error("delete drawdown failed", err);
      alert(t("budget.drawdown.errorDelete"));
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <section
      aria-labelledby="rozpocet-hypoteka-heading"
      className="mx-auto max-w-xl space-y-4 px-4 py-6"
    >
      <header className="flex items-center justify-between gap-3">
        <h2
          id="rozpocet-hypoteka-heading"
          className="text-xl font-semibold tracking-tight text-ink"
        >
          {t("budget.hypoteka.title")}
        </h2>
      </header>

      {/* Status panel */}
      {isLoading ? (
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.hypoteka.loading")}
        </p>
      ) : !hasSettings ? (
        <SettingsMissingBanner />
      ) : (
        <StatusPanel status={status} />
      )}

      {/* Drawdowns list */}
      <header className="flex items-center justify-between gap-3 mt-2">
        <h3 className="text-base font-semibold text-ink">
          {t("budget.hypoteka.listTitle")}
        </h3>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          disabled={!hasSettings}
          className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60"
        >
          <Plus aria-hidden size={16} />
          {t("budget.drawdown.addCta")}
        </button>
      </header>

      {drawdownsState.status === "loading" ? (
        <p aria-busy className="text-sm text-ink-muted">
          {t("budget.hypoteka.loading")}
        </p>
      ) : drawdownsState.status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
        >
          {t("budget.hypoteka.errorLoad")}
        </p>
      ) : drawdowns.length === 0 ? (
        <EmptyDrawdowns
          hasSettings={hasSettings}
          onAdd={() => setModal({ mode: "create" })}
        />
      ) : (
        <ul className="space-y-2">
          {drawdowns.map((d) => (
            <li key={d.id}>
              <div className="flex items-stretch rounded-md border border-line bg-surface pr-1">
                <button
                  type="button"
                  onClick={() => setModal({ mode: "edit", drawdown: d })}
                  className="flex flex-1 min-h-tap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-subtle rounded-l-md min-w-0"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink">
                        {formatDateCs(d.datum)}
                      </span>
                      {d.banka ? (
                        <span className="text-xs text-ink-muted whitespace-nowrap">
                          {d.banka}
                        </span>
                      ) : null}
                    </div>
                    {d.note ? (
                      <span className="text-xs text-ink-muted truncate" title={d.note}>
                        {d.note}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-base font-semibold text-ink tabular-nums shrink-0">
                    {formatCzk(d.castka)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(d)}
                  aria-label={t("budget.drawdown.deleteAria", {
                    amount: formatCzk(d.castka),
                  })}
                  title={t("common.delete")}
                  className="grid h-tap w-9 place-items-center text-ink-muted hover:bg-bg-subtle rounded-md self-stretch my-auto"
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <DrawdownModal
          open
          mode={modal.mode}
          drawdown={modal.mode === "edit" ? modal.drawdown : null}
          defaultBank={defaultBank}
          onClose={() => setModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("budget.drawdown.deleteConfirmTitle")}
        message={
          deleteTarget
            ? t("budget.drawdown.deleteConfirmBody", {
                amount: formatCzk(deleteTarget.castka),
              })
            : ""
        }
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function StatusPanel({
  status,
}: {
  status: ReturnType<typeof computeMortgageStatus>;
}) {
  const t = useT();
  return (
    <div className="rounded-md border border-line bg-surface-raised p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark aria-hidden size={18} className="text-ink-muted" />
        <span className="text-xs uppercase tracking-wide text-ink-muted">
          {t("budget.hypoteka.statusTitle")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t("budget.settings.statusLimit")}
          value={status.limit !== null ? formatCzk(status.limit) : "—"}
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
              style={{ width: `${Math.min(100, status.percentage)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-ink-muted tabular-nums">
            {status.percentage}%
          </p>
        </div>
      ) : null}
    </div>
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
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-xs uppercase tracking-wide text-ink-muted truncate">
        {label}
      </span>
      <span
        className={`text-base font-semibold tabular-nums break-words ${valueClass}`}
      >
        {value}
      </span>
    </div>
  );
}

function SettingsMissingBanner() {
  const t = useT();
  return (
    <div className="rounded-md border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg space-y-2">
      <p className="font-semibold">{t("budget.hypoteka.settingsMissingTitle")}</p>
      <p className="text-status-warning-fg/90">
        {t("budget.hypoteka.settingsMissingBody")}
      </p>
      <Link
        to={ROUTES.nastaveniRozpocetHypoteka}
        className="inline-flex min-h-tap items-center gap-1.5 rounded-md bg-status-warning-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90"
      >
        {t("budget.hypoteka.settingsMissingCta")}
      </Link>
    </div>
  );
}

function EmptyDrawdowns({
  hasSettings,
  onAdd,
}: {
  hasSettings: boolean;
  onAdd: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center space-y-3">
      <p className="text-3xl" aria-hidden>🏦</p>
      <p className="text-base font-semibold text-ink">
        {t("budget.hypoteka.emptyTitle")}
      </p>
      <p className="mx-auto max-w-md text-sm text-ink-muted leading-relaxed">
        {t("budget.hypoteka.emptyDesc")}
      </p>
      <button
        type="button"
        onClick={onAdd}
        disabled={!hasSettings}
        className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60"
      >
        <Plus aria-hidden size={16} />
        {t("budget.drawdown.addCta")}
      </button>
    </div>
  );
}

function formatDateCs(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("cs-CZ");
  } catch {
    return iso;
  }
}
