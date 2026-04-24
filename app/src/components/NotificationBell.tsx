import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInbox } from "@/hooks/useInbox";
import { useT } from "@/i18n/useT";
import NotificationList from "./NotificationList";

/**
 * V15.1 — header bell icon with unread badge + dropdown showing the
 * inbox. Click outside or Escape closes. Uses a real <button> so
 * keyboard users get focus rings from the global CSS.
 */
export default function NotificationBell() {
  const t = useT();
  const { user } = useAuth();
  const { items, unreadCount, loading, error } = useInbox(user?.uid ?? null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on click-outside + Escape. Classic dropdown dismissal.
  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("inbox.ariaBellLabel")}
        aria-expanded={open}
        className="relative grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
      >
        <Bell aria-hidden size={20} />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-pill px-1 text-[10px] font-semibold text-white"
            style={{
              background: "var(--color-status-danger-fg)",
              lineHeight: "1rem",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2"
          style={{ minWidth: "20rem" }}
        >
          <NotificationList
            uid={user.uid}
            items={items}
            loading={loading}
            error={error}
            onItemClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
