import { X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { dateInputToEpochMs, epochMsToDateInput } from "@/lib/deadline";

interface Props {
  value: number | null | undefined;
  onChange: (nextMs: number | null) => void | Promise<void>;
  disabled?: boolean;
}

/** Native date input + clear button. Stores end-of-day epoch ms. */
export default function DeadlinePicker({ value, onChange, disabled }: Props) {
  const t = useT();
  const dateStr = epochMsToDateInput(value);

  return (
    <div
      className={[
        "flex w-full items-center rounded-md border bg-surface transition-colors",
        disabled
          ? "border-line opacity-40"
          : "border-line focus-within:border-line-focus focus-within:ring-2 focus-within:ring-line-focus",
      ].join(" ")}
    >
      <input
        type="date"
        value={dateStr}
        disabled={disabled}
        onChange={(e) => {
          const next = dateInputToEpochMs(e.target.value);
          void onChange(next);
        }}
        aria-label={t("deadline.label")}
        className="min-w-0 flex-1 min-h-tap rounded-md bg-transparent px-3 py-1.5 text-sm text-ink focus:outline-none"
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => void onChange(null)}
          aria-label={t("deadline.none")}
          className="mr-1 grid size-8 shrink-0 place-items-center rounded-md text-ink-subtle hover:text-ink hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <X aria-hidden size={14} />
        </button>
      )}
    </div>
  );
}
