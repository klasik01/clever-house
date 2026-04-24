import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/i18n/useT";

/**
 * V12.2 — force-update modal. Shown when the service worker has fetched a new
 * bundle (vite-plugin-pwa’s onNeedRefresh). Backdrop blocks all clicks — the
 * user has to click "Obnovit aplikaci" which reloads with the new SW active.
 *
 * Backup: polls /version.json every 5 min against the build-time
 * VITE_APP_VERSION. If the server file reports a newer version (string
 * inequality) and the SW hasn’t yet triggered onNeedRefresh (e.g. user kept
 * the tab open across a deploy, SW cache hasn’t rotated yet), the modal shows
 * anyway. Latest is shown in the copy when available.
 */
const VERSION_POLL_MS = 5 * 60 * 1000;

export default function UpdateBanner() {
  const t = useT();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  // Wire SW listener (primary signal).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("virtual:pwa-register");
        mod.registerSW({
          onNeedRefresh() {
            if (!cancelled) setNeedRefresh(true);
          },
        });
      } catch (e) {
        console.debug("PWA register unavailable", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Backup: poll /version.json and compare with build-time VITE_APP_VERSION.
  // Covers the case where the SW cache hasn’t yet picked up a new deploy
  // (e.g. long-lived tab on a slow network). We only use this to *suggest* a
  // reload — actual reload uses location.reload() regardless of SW state.
  useEffect(() => {
    const mine = import.meta.env.VITE_APP_VERSION;
    if (!mine) return; // no version embedded (dev mode) — skip the poll
    let cancelled = false;
    async function check() {
      try {
        // Cache-busting query + no-store — we want the absolute latest.
        const base = import.meta.env.BASE_URL ?? "/";
        const res = await fetch(`${base}version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (cancelled) return;
        if (data.version && data.version !== mine) {
          setLatestVersion(data.version);
          setNeedRefresh(true);
        }
      } catch {
        // Offline / 404 — silent
      }
    }
    void check();
    const id = window.setInterval(check, VERSION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!needRefresh) return null;

  async function handleReload() {
    setReloading(true);

    // Iteration history:
    //   V12.2 — volali jsme updater.updateSW(true) (workbox-coordinated
    //   skip-wait + reload). Na iOS PWA ale interní waiter občas
    //   nedostane controllerchange event a tlačítko "Obnovit" se točí
    //   donekonečna. Uživatel musel forcequitnout PWA.
    //
    // V15 fix: obejít workbox helper, poslat SKIP_WAITING ručně a dát
    // tvrdý 1.5s timeout. Když controllerchange přijde, super; když ne,
    // stejně pokračujeme na location.reload() — browser si nové SW a
    // bundle stáhne na dalším navigation cyklu.
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        await Promise.race([
          new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => resolve(),
              { once: true },
            );
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 1500)),
        ]);
      }
    } catch (err) {
      console.warn("[update] skipWaiting path failed, falling back to plain reload:", err);
    }

    window.location.reload();
  }

  const mine = import.meta.env.VITE_APP_VERSION;
  const bodyText =
    mine && latestVersion
      ? t("update.bodyWithVersion", { mine, latest: latestVersion })
      : t("update.body");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      aria-describedby="update-body"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-surface shadow-xl ring-1 ring-line p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"
          >
            <RefreshCw size={20} aria-hidden className={reloading ? "animate-spin" : undefined} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="update-title" className="text-base font-semibold text-ink">
              {t("update.title")}
            </h2>
            <p id="update-body" className="mt-1 text-sm text-ink-muted">
              {bodyText}
            </p>
            <p className="mt-2 text-xs text-ink-subtle">
              {t("update.unsavedHint")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReload}
          disabled={reloading}
          className="mt-5 flex w-full items-center justify-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          <RefreshCw aria-hidden size={16} className={reloading ? "animate-spin" : undefined} />
          {reloading ? t("update.reloading") : t("update.reload")}
        </button>
      </div>
    </div>
  );
}
