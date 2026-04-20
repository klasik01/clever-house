import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/i18n/useT";

/**
 * Shown when a new service worker version is ready to activate.
 * Hooks into vite-plugin-pwa's registerSW virtual module (lazy-loaded).
 */
export default function UpdateBanner() {
  const t = useT();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updater, setUpdater] = useState<{ updateSW: (reload: boolean) => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("virtual:pwa-register");
        const updateSW = mod.registerSW({
          onNeedRefresh() {
            if (!cancelled) setNeedRefresh(true);
          },
        });
        if (!cancelled) setUpdater({ updateSW });
      } catch (e) {
        // Dev mode or plugin disabled — fail silently
        console.debug("PWA register unavailable", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!needRefresh || !updater) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-[max(env(safe-area-inset-top,0px),0.5rem)] z-40 -translate-x-1/2 max-w-sm rounded-md bg-accent text-accent-on shadow-lg ring-1 ring-black/10"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <p className="text-sm">
          <strong className="font-semibold">{t("update.title")}</strong> — {t("update.body")}
        </p>
        <button
          type="button"
          onClick={() => updater.updateSW(true)}
          className="inline-flex items-center gap-1 rounded-md bg-black/20 px-3 py-1 text-sm font-medium"
        >
          <RefreshCw aria-hidden size={14} />
          {t("update.reload")}
        </button>
      </div>
    </div>
  );
}
