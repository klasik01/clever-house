import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useT } from "@/i18n/useT";
import { SESSION_STORAGE } from "@/lib/storageKeys";

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

  // Wire SW listener (primary signal). V18-S43 — `updateSW` funkci dál
  // neukládáme: vlastní handleReload pipeline (skipWaiting + cache cleanup
  // + URL cache buster) je robustnější než updateSW(true) auto-reload,
  // který hangoval pokud nebyl waiting SW.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("virtual:pwa-register");
        mod.registerSW({
          onNeedRefresh() {
            // V18-S43 — anti-loop: pokud user klikl za posledních 30s,
            // suppressujeme i SW signál.
            try {
              const clickedAt = Number(
                sessionStorage.getItem(SESSION_STORAGE.updateClickedAt) ?? 0,
              );
              if (clickedAt && Date.now() - clickedAt < 30_000) return;
            } catch { /* ignore */ }
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
  //
  // V18-S22 — anti-loop guards:
  //   1. Po reloadu (?__update= flag v URL) **2 minuty** polling neodjede.
  //      Dá to SW a browser cache čas se srovnat. Bez toho jsme měli loop:
  //      reload → polling spustí ihned → vidí stale version (ETag cache 304)
  //      → modal znovu → reload → ad infinitum.
  //   2. Pokud detekujeme `latest === mine` po předchozí refresh, vyhodíme
  //      sessionStorage flag co označí "update už proběhl" — další polling
  //      cyklus do session-end nepustí modal.
  useEffect(() => {
    const mine = import.meta.env.VITE_APP_VERSION;
    if (!mine) return; // no version embedded (dev mode) — skip the poll

    const url = new URL(window.location.href);
    const isPostUpdate = url.searchParams.has("__update");
    const initialDelay = isPostUpdate ? 2 * 60 * 1000 : 0;

    // Already-updated guard: jakmile detekujeme že náš bundle == latest po
    // refresh, sessionStorage zapamatuje to do dalšího session reset.
    const STORAGE_KEY = SESSION_STORAGE.updateSettledVersion;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === mine) {
        // Předchozí cyklus skončil OK — neukazujeme modal dokud session žije.
        return;
      }
    } catch {
      /* private mode — fall through */
    }

    // V18-S43 — anti-loop guard: pokud user klikl na update za posledních 30s,
    // suppressujeme polling úplně. Dá to čas SW lifecycle dokončit a chrání
    // proti scénářům kdy reload neaktualizuje bundle (cached SW, network glitch,
    // server ještě nestihl propagovat). User po 30s může kliknout znovu pokud
    // se modal vrátí.
    try {
      const clickedAt = Number(
        sessionStorage.getItem(SESSION_STORAGE.updateClickedAt) ?? 0,
      );
      if (clickedAt && Date.now() - clickedAt < 30_000) {
        // Stále v anti-loop window — neukazuj modal.
        return;
      }
    } catch {
      /* ignore */
    }

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
        if (!data.version) return;
        if (data.version === mine) {
          // V souladu — uložíme a od teď ignorujeme polling result do
          // další session.
          try {
            sessionStorage.setItem(STORAGE_KEY, mine);
          } catch {
            /* ignore */
          }
          return;
        }
        // Mismatch → modal.
        setLatestVersion(data.version);
        setNeedRefresh(true);
      } catch {
        // Offline / 404 — silent
      }
    }
    const startTimer = window.setTimeout(() => {
      void check();
    }, initialDelay);
    const id = window.setInterval(check, VERSION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearInterval(id);
    };
  }, []);

  if (!needRefresh) return null;

  async function handleReload() {
    setReloading(true);

    // V18-S43 — robust flow proti loop bugu (nahrazuje V18-S41 updateSW(true)
    // přístup, který občas hangoval bez waiting SW). Vždy projde stejným
    // pipeline:
    //
    //   1. Anti-loop marker — set hned, použije se po reload abychom modal
    //      nezobrazili znova hned (30s grace period).
    //   2. SW skipWaiting (best-effort) — pokud existuje waiting SW, aktivuj.
    //   3. Cache cleanup — workbox runtime + precache.
    //   4. Reset settled marker — nový bundle si nastaví sám až polling
    //      po reload uvidí match.
    //   5. Hard-reload přes URL change (?__update=<ts>) — bypass HTTP cache.
    try {
      sessionStorage.setItem(
        SESSION_STORAGE.updateClickedAt,
        Date.now().toString(),
      );
    } catch { /* private mode — fall through, anti-loop nebude fungovat */ }

    // SW skipWaiting (best-effort, max 1.5s).
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
      console.warn("[update] skipWaiting failed:", err);
    }

    // Cache cleanup.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn("[update] cache cleanup failed:", err);
    }

    // Reset settled marker.
    try { sessionStorage.removeItem(SESSION_STORAGE.updateSettledVersion); }
    catch { /* ignore */ }

    // Hard-reload přes URL change.
    const next = new URL(window.location.href);
    next.searchParams.set("__update", Date.now().toString());
    window.location.replace(next.toString());
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
