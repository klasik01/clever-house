import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { useT } from "@/i18n/useT";

/**
 * OfflineBanner — global indicator in Shell header.
 * Renders nothing when online. When offline, fixed pill under the app bar
 * informing user that writes are queued until reconnection.
 */
export default function OfflineBanner() {
  const t = useT();
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-20 w-full border-b border-[color:var(--color-deadline-overdue-border)] px-4 py-1.5 text-center text-xs font-medium"
      style={{
        background: "var(--color-deadline-overdue-bg)",
        color: "var(--color-deadline-overdue-fg)",
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff aria-hidden size={12} />
        {t("offline.banner")}
      </span>
    </div>
  );
}
