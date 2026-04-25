import { useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useToast } from "@/components/Toast";
import { useT } from "@/i18n/useT";
import { requestPermissionAndRegister } from "@/lib/messaging";

/**
 * V15 — global nudge banner. Rendered inside the authed Shell; hides
 * itself unless:
 *   - the user is signed in,
 *   - the browser supports push,
 *   - permission is still "default" (neither granted nor denied),
 *   - the user hasn't dismissed the banner in the last DISMISS_COOLDOWN_MS.
 *
 * "Později" starts the cooldown so we don't nag. "Povolit" calls the full
 * registration flow which triggers the OS prompt (must be under a user
 * gesture — the button click satisfies that requirement).
 */

import { LOCAL_STORAGE } from "@/lib/storageKeys";
import { NOTIF_BANNER_DISMISS_COOLDOWN_MS } from "@/lib/limits";

const DISMISS_STORAGE_KEY = LOCAL_STORAGE.notifBannerDismissedAt;
const DISMISS_COOLDOWN_MS = NOTIF_BANNER_DISMISS_COOLDOWN_MS;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    /* best-effort */
  }
}

export default function NotificationPermissionBanner() {
  const t = useT();
  const { user } = useAuth();
  const permission = useNotificationPermission();
  const { show: showToast } = useToast();
  const [dismissed, setDismissed] = useState<boolean>(() => wasRecentlyDismissed());
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  if (permission !== "default") return null;
  if (dismissed) return null;

  async function handleEnable() {
    if (!user) return;
    setBusy(true);
    try {
      const result = await requestPermissionAndRegister(user.uid);
      console.debug("[FCM] registration result:", result);
      // Visible feedback — user jinak neví, jestli to prošlo nebo padlo.
      if (result.status === "granted") {
        showToast("Notifikace zapnuté", "success");
        setDismissed(true);
      } else if (result.status === "denied") {
        showToast("Povolení zamítnuto — zapni v iOS Nastavení", "error");
        setDismissed(true);
      } else if (result.status === "no_token") {
        showToast("FCM token se nezískal — zkus to znovu", "error");
      } else if (result.status === "unsupported") {
        showToast("Tento prohlížeč push notifikace nepodporuje", "error");
      } else if (result.status === "error") {
        showToast("Registrace selhala — viz konzole", "error");
      }
    } catch (err) {
      console.error("[FCM] handleEnable threw:", err);
      showToast("Něco se pokazilo při zapínání notifikací", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    markDismissed();
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label={t("notifikace.banner.title")}
      className="border-b border-line bg-bg-subtle"
    >
      <div className="mx-auto flex max-w-xl items-start gap-3 px-4 py-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-visual"
        >
          <Bell size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {t("notifikace.banner.title")}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t("notifikace.banner.body")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="inline-flex items-center gap-1.5 min-h-tap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 transition-colors"
            >
              <Bell aria-hidden size={14} />
              {busy ? t("notifikace.enableLoading") : t("notifikace.banner.cta")}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="min-h-tap rounded-md px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              {t("notifikace.banner.dismiss")}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("notifikace.banner.dismiss")}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-subtle hover:text-ink hover:bg-bg-muted transition-colors"
        >
          <X aria-hidden size={16} />
        </button>
      </div>
    </div>
  );
}
