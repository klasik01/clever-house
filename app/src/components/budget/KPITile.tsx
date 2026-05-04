import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  subText?: ReactNode;
  onClick?: () => void;
  ariaDescribedBy?: string;
}

export default function KPITile({ label, value, subText, onClick, ariaDescribedBy }: Props) {
  const className =
    "flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-left min-h-[6rem] md:min-h-[7.5rem]";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-describedby={ariaDescribedBy}
        className={className + " hover:bg-bg-subtle transition-colors duration-fast cursor-pointer"}
      >
        <KpiContent label={label} value={value} subText={subText} />
      </button>
    );
  }
  return (
    <div className={className} aria-describedby={ariaDescribedBy}>
      <KpiContent label={label} value={value} subText={subText} />
    </div>
  );
}

function KpiContent({
  label,
  value,
  subText,
}: {
  label: string;
  value: string;
  subText?: ReactNode;
}) {
  return (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="kpi-number">{value}</span>
      {subText ? (
        <span className="text-xs text-ink-subtle">{subText}</span>
      ) : null}
    </>
  );
}
