import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/useT";
import { formatCzk } from "@/lib/budget/format";
import { rozpocetSekceDetail } from "@/lib/routes";
import {
  DONUT_OTHER_ID,
  type DonutSlice,
} from "@/lib/budget/charts";

interface Props {
  slices: DonutSlice[];
  totalCzk: number;
}

const CHART_COLORS = [
  "var(--chart-c1)",
  "var(--chart-c2)",
  "var(--chart-c3)",
  "var(--chart-c4)",
  "var(--chart-c5)",
  "var(--chart-c6)",
  "var(--chart-c7)",
];

export default function CostStructureDonut({ slices, totalCzk }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const [showTable, setShowTable] = useState(false);

  if (slices.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
        {t("budget.charts.donutEmpty")}
      </p>
    );
  }

  const VIEWBOX = 120;
  const CENTER = VIEWBOX / 2;
  const RADIUS = 50;
  const INNER_RADIUS = 32;
  const CIRC = 2 * Math.PI * RADIUS;

  // Compute stroke offsets — render as concentric arc segments via stroke-dasharray.
  // Each slice is a circle with stroke=color, dasharray=[len, total-len], dashoffset accumulating.
  let cumulativePercent = 0;
  const segments = slices.map((s, idx) => {
    const len = (s.percent / 100) * CIRC;
    const offset = -((cumulativePercent / 100) * CIRC);
    cumulativePercent += s.percent;
    return {
      slice: s,
      len,
      offset,
      color: CHART_COLORS[s.colorIndex] ?? CHART_COLORS[0]!,
      idx,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          role="img"
          aria-label={t("budget.charts.donutAria")}
          className="w-40 h-40 shrink-0 -rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-bg-subtle)"
            strokeWidth={RADIUS - INNER_RADIUS}
          />
          {segments.map(({ slice, len, offset, color }) => (
            <circle
              key={slice.id}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={RADIUS - INNER_RADIUS}
              strokeDasharray={`${len.toFixed(2)} ${(CIRC - len).toFixed(2)}`}
              strokeDashoffset={offset.toFixed(2)}
              opacity={0.92}
            >
              <title>
                {slice.title}: {formatCzk(slice.amountCzk)} ({slice.percent.toFixed(1)}%)
              </title>
            </circle>
          ))}
        </svg>

        {/* Legend */}
        <ul className="flex-1 space-y-1.5 w-full">
          {segments.map(({ slice, color }) => (
            <li key={slice.id}>
              <button
                type="button"
                disabled={slice.id === DONUT_OTHER_ID}
                onClick={() => {
                  if (slice.id !== DONUT_OTHER_ID) {
                    navigate(rozpocetSekceDetail(slice.id));
                  }
                }}
                className={[
                  "w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  slice.id !== DONUT_OTHER_ID
                    ? "hover:bg-bg-subtle cursor-pointer"
                    : "cursor-default",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-3 w-3 rounded shrink-0"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <span className="text-sm text-ink truncate">{slice.title}</span>
                </span>
                <span className="flex items-baseline gap-2 shrink-0 tabular-nums">
                  <span className="text-sm font-semibold text-ink">
                    {formatCzk(slice.amountCzk)}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {slice.percent.toFixed(1)} %
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-ink-subtle text-center sm:text-left">
        {t("budget.charts.donutTotal", { value: formatCzk(totalCzk) })}
      </p>

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

      {showTable ? <DonutTable slices={slices} totalCzk={totalCzk} /> : null}
    </div>
  );
}

function DonutTable({
  slices,
  totalCzk,
}: {
  slices: DonutSlice[];
  totalCzk: number;
}) {
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
              {t("budget.charts.colActual")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-ink-muted">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.id} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2 text-ink truncate max-w-[10rem]">{s.title}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">
                {formatCzk(s.amountCzk)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">
                {s.percent.toFixed(1)} %
              </td>
            </tr>
          ))}
          <tr className="border-t border-line bg-bg-subtle font-semibold">
            <td className="px-3 py-2 text-ink">{t("budget.charts.colTotal")}</td>
            <td className="px-3 py-2 text-right tabular-nums text-ink">
              {formatCzk(totalCzk)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-ink">100 %</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
