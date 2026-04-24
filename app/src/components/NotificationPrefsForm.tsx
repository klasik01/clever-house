import { useState } from "react";
import { AtSign, Bell, BellOff, Calendar, CheckCircle2, Flag, MessageCircle, MessagesSquare, Share2, Trash2, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useT } from "@/i18n/useT";
import { requestPermissionAndRegister } from "@/lib/messaging";
import {
  DEFAULT_PREFS,
  NOTIFICATION_EVENTS,
  mergePrefsWithDefaults,
  updateUserPrefs,
} from "@/lib/notifications";
import type { NotificationEventKey } from "@/types";

/**
 * V15 — Settings → Notifikace section.
 *
 * Three-state UI driven by Notification.permission:
 *   default     → intro + "Povolit notifikace" CTA; toggles hidden.
 *   granted     → master switch + per-event toggles visible.
 *   denied      → help copy pointing at iOS Settings; toggles hidden.
 *   unsupported → explanation, nothing actionable.
 *
 * Granted-state writes hit Firestore via updateUserPrefs (dot-path merge —
 * flipping a single event doesn't resubmit the whole object).
 */

const EVENT_ICONS: Record<NotificationEventKey, LucideIcon> = {
  mention: AtSign,
  assigned: UserPlus,
  comment_on_mine: MessageCircle,
  comment_on_thread: MessagesSquare,
  shared_with_pm: Share2,
  priority_changed: Flag,
  deadline_changed: Calendar,
  task_deleted: Trash2,
};

export default function NotificationPrefsForm() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const permission = useNotificationPermission();
  const [busy, setBusy] = useState<"enabling" | "retrying" | null>(null);
  const [retryFailed, setRetryFailed] = useState(false);

  const prefs = roleState.status === "ready"
    ? mergePrefsWithDefaults(roleState.profile.notificationPrefs)
    : DEFAULT_PREFS;

  async function handleEnable() {
    if (!user) return;
    setBusy("enabling");
    try {
      await requestPermissionAndRegister(user.uid);
    } finally {
      setBusy(null);
    }
  }

  /**
   * V16.2 — re-trigger z denied větve. Chrome / Edge někdy prompt zobrazí
   * znovu pokud user dříve jen "dismiss"nul bez denyování; jindy (a na iOS
   * po ručním odmítnutí) ne. Pokud request vrátí opět "denied", zobraz
   * ručně-povolit návod (skrytý toggle s postupy per-platform).
   */
  async function handleRetry() {
    if (!user) return;
    setBusy("retrying");
    setRetryFailed(false);
    try {
      const result = await requestPermissionAndRegister(user.uid);
      if (result.status !== "granted") {
        // permission hook useNotificationPermission se přepne sám přes
        // PermissionStatus.onchange; pokud to zůstane denied, flag zobrazí
        // hlášku "browser still blocks" vedle existujícího návodu.
        setRetryFailed(true);
      }
    } catch (e) {
      console.error("permission retry failed", e);
      setRetryFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function handleMasterToggle(next: boolean) {
    if (!user) return;
    await updateUserPrefs(user.uid, { enabled: next });
  }

  async function handleEventToggle(
    key: NotificationEventKey,
    next: boolean,
  ) {
    if (!user) return;
    await updateUserPrefs(user.uid, { events: { [key]: next } });
  }

  // -------- Render --------

  if (permission === "unsupported") {
    return (
      <div className="px-4 py-3">
        <p className="text-sm text-ink-muted">
          {t("notifikace.sectionHintUnsupported")}
        </p>
      </div>
    );
  }

  if (permission === "default") {
    return (
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm text-ink-muted">
          {t("notifikace.sectionHintDefault")}
        </p>
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy === "enabling"}
          className="inline-flex items-center justify-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          <Bell aria-hidden size={16} />
          {busy === "enabling" ? t("notifikace.enableLoading") : t("notifikace.enableCta")}
        </button>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <BellOff aria-hidden size={16} className="text-ink-subtle" />
          {t("notifikace.banner.deniedTitle")}
        </p>
        <p className="text-sm text-ink-muted">
          {t("notifikace.sectionHintDenied")}
        </p>

        <button
          type="button"
          onClick={handleRetry}
          disabled={busy === "retrying"}
          className="inline-flex items-center justify-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 transition-colors self-start"
        >
          <Bell aria-hidden size={16} />
          {busy === "retrying"
            ? t("notifikace.deniedRetryLoading")
            : t("notifikace.deniedRetryCta")}
        </button>

        {retryFailed && (
          <p
            role="status"
            className="rounded-md border px-3 py-2 text-xs"
            style={{
              background: "var(--color-priority-p1-bg)",
              color: "var(--color-priority-p1-fg)",
              borderColor: "var(--color-priority-p1-border)",
            }}
          >
            {t("notifikace.deniedStillDenied")}
          </p>
        )}

        <details className="rounded-md border border-line bg-surface">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm text-ink hover:bg-bg-subtle">
            {t("notifikace.deniedHelpToggle")}
          </summary>
          <div className="flex flex-col gap-2 border-t border-line px-3 py-2 text-xs text-ink-muted">
            <p>{t("notifikace.deniedHelpIOS")}</p>
            <p>{t("notifikace.deniedHelpChrome")}</p>
            <p>{t("notifikace.deniedHelpAndroid")}</p>
          </div>
        </details>
      </div>
    );
  }

  // granted — show preferences.
  return (
    <div className="flex flex-col">
      <div className="px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <CheckCircle2 aria-hidden size={16} className="text-accent-visual" />
          {t("notifikace.sectionHintGranted")}
        </p>
      </div>

      <PrefToggle
        label={t("notifikace.master")}
        hint={t("notifikace.masterHint")}
        checked={prefs.enabled}
        onChange={handleMasterToggle}
      />

      <div className="px-4 pt-4 pb-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {t("notifikace.events.heading")}
        </p>
      </div>

      {NOTIFICATION_EVENTS.map((key) => {
        const Icon = EVENT_ICONS[key];
        return (
          <PrefToggle
            key={key}
            label={t(`notifikace.events.${key}`)}
            hint={t(`notifikace.events.${key}Hint`)}
            icon={Icon}
            checked={prefs.events[key]}
            onChange={(next) => handleEventToggle(key, next)}
            disabled={!prefs.enabled}
          />
        );
      })}
    </div>
  );
}

function PrefToggle({
  label,
  hint,
  icon: Icon,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  checked: boolean;
  onChange: (next: boolean) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (disabled || pending) return;
    setPending(true);
    try {
      await onChange(!checked);
    } finally {
      setPending(false);
    }
  }

  return (
    <label
      className={`flex items-start justify-between gap-3 border-t border-line px-4 py-3 transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-bg-subtle"
      }`}
    >
      <span className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span aria-hidden className="mt-0.5 text-ink-subtle">
            <Icon size={16} />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="text-sm text-ink">{label}</span>
          {hint && (
            <span className="mt-0.5 text-xs text-ink-subtle">{hint}</span>
          )}
        </span>
      </span>

      {/* Native checkbox — accessible, respects focus ring, cheap. iOS
          styling is overridden by accent-color on the input. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={handleClick}
        disabled={disabled || pending}
        aria-label={label}
        className="mt-1 size-5 shrink-0 rounded border-line focus:ring-2 focus:ring-line-focus disabled:cursor-not-allowed"
        style={{ accentColor: "var(--color-accent-visual)" }}
      />
    </label>
  );
}
