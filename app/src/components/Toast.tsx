import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useT } from "@/i18n/useT";

export type ToastVariant = "info" | "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", durationMs = DEFAULT_DURATION) => {
      const id = Math.random().toString(36).slice(2, 10);
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((h) => window.clearTimeout(h));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const t = useT();
  return (
    <div
      role="region"
      aria-label={t("aria.toastRegion")}
      className="pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top,0px),1rem)] z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastBubble key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastBubble({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const t = useT();
  const { bg, fg, Icon } = variantStyles(toast.variant);
  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className="pointer-events-auto flex items-start gap-3 rounded-md px-4 py-2.5 shadow-lg ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2"
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon aria-hidden size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.close")}
        className="-mr-1 grid size-6 place-items-center rounded-md opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1"
        style={{ outlineColor: fg }}
      >
        <X aria-hidden size={14} />
      </button>
    </div>
  );
}

function variantStyles(v: ToastVariant) {
  switch (v) {
    case "success":
      return {
        bg: "var(--color-status-success-bg)",
        fg: "var(--color-status-success-fg)",
        Icon: CheckCircle2,
      };
    case "error":
      return {
        bg: "var(--color-status-danger-bg)",
        fg: "var(--color-status-danger-fg)",
        Icon: AlertCircle,
      };
    case "info":
    default:
      return {
        bg: "var(--color-status-info-bg)",
        fg: "var(--color-status-info-fg)",
        Icon: Info,
      };
  }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
