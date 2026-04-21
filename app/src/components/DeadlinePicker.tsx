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
    <div className="flex w-full items-center gap-2">
      <input
        type="date"
        value={dateStr}
        disabled={disabled}
        onChange={(e) => {
          const next = dateInputToEpochMs(e.target.value);
          void onChange(next);
        }}
        aria-label={t("deadline.label")}
        className="min-w-0 flex-1 min-h-tap rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-line-focus focus:outline-none focus:ring-2 focus:ring-line-focus disabled:opacity-40"
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => void onChange(null)}
          aria-label={t("deadline.none")}
          className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink hover:bg-bg-subtle"
        >
          <X aria-hidden size={16} />
        </button>
      )}
    </div>
  );
}
