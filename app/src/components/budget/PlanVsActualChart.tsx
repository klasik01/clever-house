import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/useT";
import { formatCzk } from "@/lib/budget/format";
import { rozpocetSekceDetail } from "@/lib/routes";
import type { ChartSectionDatum } from "@/lib/budget/charts";

interface Props {
  data: ChartSectionDatum[];
}

export default function PlanVsActualChart({ data }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
        {t("budget.charts.planVsActualEmpty")}
      </p>
    );
  }

  // Max value pro scale — větší z plan/actual napříč všemi sekcemi.
  const maxValue = data.reduce((max, d) => {
    return Math.max(max, d.actualCzk, d.plannedCzk ?? 0);
  }, 1);

  return (
    <div className="space-y-3">
      <p
        id="plan-vs-actual-summary"
        className="text-xs text-ink-subtle leading-relaxed"
      >
        {t("budget.charts.planVsActualSummary", { n: data.length })}
      </p>

      <ul
        aria-describedby="plan-vs-actual-summary"
        className="space-y-3"
      >
        {data.map((d) => (
          <SectionBar
            key={d.sectionId}
            datum={d}
            maxValue={maxValue}
            onClick={() => navigate(rozpocetSekceDetail(d.sectionId))}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        className="inline-flex items-center gap-1 text-xs text-ink-link hover:text-ink-link-hover"
      >
        {showTable ? (
          <ChevronDown aria-hidden size={14} />
        ) : (
          <ChevronRight aria-hidden size={14} />
        )}
        {t("budget.charts.tableFallback")}
      </button>

      {showTable ? <TableFallback data={data} /> : null}
    </div>
  );
}

function SectionBar({
  datum,
  maxValue,
  onClick,
}: {
  datum: ChartSectionDatum;
  maxValue: number;
  onClick: () => void;
}) {
  const t = useT();
  const planPct = datum.plannedCzk ? (datum.plannedCzk / maxValue) * 100 : 0;
  const actualPct = (datum.actualCzk / maxValue) * 100;

  // Color: actual oproti planu — under = success-ish, over = warning, at = neutral.
  const actualColor =
    datum.state === "over"
      ? "var(--chart-c5)"
      : datum.state === "under"
      ? "var(--chart-c4)"
      : datum.state === "at"
      ? "var(--chart-c1)"
      : "var(--chart-c1)";
  const planColor = "var(--chart-c2)"; // oak — plan reference

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded-md hover:bg-bg-subtle transition-colors p-2 -mx-2"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-ink truncate">{datum.title}</span>
          <span className="text-xs text-ink-muted tabular-nums whitespace-nowrap">
            {formatCzk(datum.actualCzk)}
            {datum.plannedCzk !== null
              ? ` / ${formatCzk(datum.plannedCzk)}`
              : ` (${t("budget.variance.noPlan")})`}
          </span>
        </div>

        <div
          className="relative h-5 rounded bg-bg-subtle overflow-hidden"
          role="img"
          aria-label={t("budget.charts.barAria", {
            title: datum.title,
            actual: formatCzk(datum.actualCzk),
            planned:
              datum.plannedCzk !== null
                ? formatCzk(datum.plannedCzk)
                : t("budget.variance.noPlan"),
          })}
        >
          {/* Plan reference line/bar — pod actual barem */}
          {datum.plannedCzk !== null ? (
            <div
              className="absolute inset-y-0 left-0 border-r-2"
              style={{
                width: `${Math.min(100, planPct)}%`,
                background: planColor,
                opacity: 0.25,
                borderColor: planColor,
              }}
              aria-hidden
            />
          ) : null}
          {/* Actual bar */}
          <div
            className="absolute inset-y-0 left-0 transition-all"
            style={{
              width: `${Math.min(100, actualPct)}%`,
              background: actualColor,
            }}
            aria-hidden
          />
        </div>
      </button>
    </li>
  );
}

function TableFallback({ data }: { data: ChartSectionDatum[] }) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line bg-bg-subtle">
            <th className="px-3 py-2 text-left font-semibold text-ink-muted">
              {t("budget.charts.colSection")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-ink-muted">
              {t("budget.charts.colPlan")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-ink-muted">
              {t("budget.charts.colActual")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-ink-muted">
              {t("budget.charts.colVariance")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.sectionId} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2 text-ink truncate max-w-[10rem]">{d.title}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">
                {d.plannedCzk !== null ? formatCzk(d.plannedCzk) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">
                {formatCzk(d.actualCzk)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {d.plannedCzk !== null ? (
                  <span
                    className={
                      d.state === "over"
                        ? "text-status-warning-fg"
                        : d.state === "under"
                        ? "text-status-success-fg"
                        : "text-ink"
                    }
                  >
                    {d.variance > 0 ? "+ " : d.variance < 0 ? "− " : ""}
                    {formatCzk(Math.abs(d.variance))}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
