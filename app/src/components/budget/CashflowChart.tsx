import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/useT";
import { formatCzk } from "@/lib/budget/format";
import type { CumulativeBucket } from "@/lib/budget/charts";

interface Props {
  buckets: CumulativeBucket[];
}

export default function CashflowChart({ buckets }: Props) {
  const t = useT();
  const [showTable, setShowTable] = useState(false);

  if (buckets.length === 0 || buckets.every((b) => b.cumulativeDrawnCzk === 0 && b.cumulativePaidCzk === 0)) {
    return (
      <p className="rounded-md border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted">
        {t("budget.charts.cashflowEmpty")}
      </p>
    );
  }

  // Find max for Y-axis scale.
  const maxValue = buckets.reduce((max, b) => {
    return Math.max(max, b.cumulativeDrawnCzk, b.cumulativePaidCzk);
  }, 1);

  // Compute SVG paths.
  const VIEWBOX_W = 600;
  const VIEWBOX_H = 200;
  const PAD_LEFT = 50;
  const PAD_RIGHT = 16;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 28;
  const plotW = VIEWBOX_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEWBOX_H - PAD_TOP - PAD_BOTTOM;

  const xStep = buckets.length > 1 ? plotW / (buckets.length - 1) : 0;

  function pointFor(index: number, value: number): { x: number; y: number } {
    return {
      x: PAD_LEFT + index * xStep,
      y: PAD_TOP + plotH - (value / maxValue) * plotH,
    };
  }

  const drawnPoints = buckets.map((b, i) => pointFor(i, b.cumulativeDrawnCzk));
  const paidPoints = buckets.map((b, i) => pointFor(i, b.cumulativePaidCzk));

  const drawnPath = drawnPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const paidPath = paidPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  // Y-axis tick labels (3 stops: 0, max/2, max).
  const ticks = [0, maxValue / 2, maxValue];

  const lastDrawn = buckets[buckets.length - 1]?.cumulativeDrawnCzk ?? 0;
  const lastPaid = buckets[buckets.length - 1]?.cumulativePaidCzk ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <LegendItem
          color="var(--chart-c2)"
          label={t("budget.charts.legendDrawn", { value: formatCzk(lastDrawn) })}
        />
        <LegendItem
          color="var(--chart-c1)"
          label={t("budget.charts.legendPaid", { value: formatCzk(lastPaid) })}
        />
      </div>

      <div className="rounded-md border border-line bg-surface p-2">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          role="img"
          aria-label={t("budget.charts.cashflowAria")}
          className="w-full h-auto"
        >
          {/* Y-axis grid + labels */}
          {ticks.map((tick, i) => {
            const y = PAD_TOP + plotH - (tick / maxValue) * plotH;
            return (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  x2={VIEWBOX_W - PAD_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border-default)"
                  strokeWidth="0.5"
                  strokeDasharray={i === 0 ? "" : "2,2"}
                />
                <text
                  x={PAD_LEFT - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="var(--color-text-subtle)"
                  fontFamily="var(--font-sans)"
                >
                  {formatCompact(tick)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {buckets.map((b, i) => (
            <text
              key={b.key}
              x={PAD_LEFT + i * xStep}
              y={VIEWBOX_H - 8}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-text-subtle)"
              fontFamily="var(--font-sans)"
            >
              {b.label}
            </text>
          ))}

          {/* Drawn line (oak) */}
          <path
            d={drawnPath}
            fill="none"
            stroke="var(--chart-c2)"
            strokeWidth="2"
          />
          {drawnPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="var(--chart-c2)"
            />
          ))}

          {/* Paid line (olive) */}
          <path
            d={paidPath}
            fill="none"
            stroke="var(--chart-c1)"
            strokeWidth="2"
          />
          {paidPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2.5"
              fill="var(--chart-c1)"
            />
          ))}
        </svg>
      </div>

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

      {showTable ? <CashflowTable buckets={buckets} /> : null}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-4 rounded"
        style={{ background: color }}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}

function CashflowTable({ buckets }: { buckets: CumulativeBucket[] }) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-line bg-bg-subtle">
            <th className="px-3 py-2 text-left font-semibold text-ink-muted">
              {t("budget.charts.colMonth")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-ink-muted">
              {t("budget.charts.colDrawn")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-ink-muted">
              {t("budget.charts.colPaid")}
            </th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.key} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2 text-ink">{b.label}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">
                {formatCzk(b.cumulativeDrawnCzk)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">
                {formatCzk(b.cumulativePaidCzk)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}
