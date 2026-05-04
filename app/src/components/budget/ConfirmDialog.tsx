import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/useT";

interface Props {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  busy,
  onConfirm,
  onClose,
}: Props) {
  const t = useT();
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

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
      aria-label={title}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </div>
        <div className="px-4 py-4 text-sm text-ink leading-relaxed">{message}</div>
        <div className="flex justify-end gap-3 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-tap rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle"
          >
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              "min-h-tap rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60",
              destructive
                ? "bg-status-danger-fg text-white hover:opacity-90"
                : "bg-accent text-accent-on hover:bg-accent-hover",
            ].join(" ")}
          >
            {busy ? t("common.deleting") : confirmLabel ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
