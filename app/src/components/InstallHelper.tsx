import { Download, Info, Share } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useInstallState } from "@/hooks/useInstallState";
import { promptInstall } from "@/lib/installPrompt";

/**
 * Shows platform-aware "Add to home screen" help.
 * - iOS: manual instructions (Safari doesn't expose programmatic prompt)
 * - Android/Chromium: trigger `beforeinstallprompt` if available
 * - Standalone mode: success hint only
 */
export default function InstallHelper() {
  const t = useT();
  const { standalone, installable, platform } = useInstallState();

  if (standalone) {
    return (
      <div className="rounded-md bg-[color:var(--color-status-success-bg)] px-4 py-3 text-sm text-[color:var(--color-status-success-fg)]">
        <span className="inline-flex items-center gap-2">
          <Info aria-hidden size={16} />
          {t("install.statusInstalled")}
        </span>
      </div>
    );
  }

  const instructions =
    platform === "ios"
      ? t("install.iosInstructions")
      : platform === "android"
      ? t("install.androidInstructions")
      : t("install.desktopInstructions");

  return (
    <div className="rounded-md bg-surface ring-1 ring-line px-4 py-3">
      <p className="text-sm text-ink">{t("install.statusBrowser")}</p>
      <p className="mt-2 text-sm text-ink-muted inline-flex items-start gap-2">
        <Share aria-hidden size={14} className="mt-0.5 shrink-0" />
        <span>{instructions}</span>
      </p>
      {installable && (
        <button
          type="button"
          onClick={() => promptInstall()}
          className="mt-3 inline-flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
        >
          <Download aria-hidden size={16} />
          {t("install.installNow")}
        </button>
      )}
    </div>
  );
}
