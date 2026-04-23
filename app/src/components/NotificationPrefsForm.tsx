import { useState } from "react";
import { AtSign, Bell, BellOff, CheckCircle2, MessageCircle, MessagesSquare, Share2, UserPlus } from "lucide-react";
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
};

export default function NotificationPrefsForm() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const permission = useNotificationPermission();
  const [busy, setBusy] = useState<"enabling" | null>(null);

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
