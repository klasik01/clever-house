import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";

export default function Settings() {
  const t = useT();
  const { user } = useAuth();

  async function handleSignOut() {
    await signOut();
    // Redirect handled by auth state listener via ProtectedRoute.
  }

  return (
    <section
      aria-label={t("settings.title")}
      className="mx-auto max-w-xl px-4 py-4"
    >
      <h1 className="sr-only">{t("settings.title")}</h1>

      <SettingsGroup title={t("settings.account")}>
        <Row label={t("settings.email")} value={user?.email ?? "—"} />
      </SettingsGroup>

      <SettingsGroup title={t("settings.themeLabel")}>
        <Row label={t("settings.themeSystem")} value={t("settings.comingSoon")} />
      </SettingsGroup>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full min-h-tap items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm font-medium text-ink hover:bg-bg-subtle transition-colors"
        >
          <LogOut aria-hidden size={18} />
          {t("settings.signOut")}
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-ink-subtle">
        {t("settings.version")}: 0.2.0 (S02)
      </p>
    </section>
  );
}

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {title}
      </h2>
      <div className="rounded-md bg-surface ring-1 ring-line divide-y divide-line">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-ink">{label}</span>
      <span className="truncate text-sm text-ink-muted">{value}</span>
    </div>
  );
}
