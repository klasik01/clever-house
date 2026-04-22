import { ChevronRight, Clock, FileDown, LogOut, MapPin, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { signOut } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import InstallHelper from "@/components/InstallHelper";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useT } from "@/i18n/useT";

export default function Settings() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const isPm = roleState.status === "ready" && roleState.profile.role === "PROJECT_MANAGER";
  // Prefer the Firestore profile.displayName (user-editable in future); fall
  // back to the Firebase Auth displayName; finally to "—".
  const profileName =
    roleState.status === "ready" ? roleState.profile.displayName ?? null : null;
  const displayName = profileName?.trim() || user?.displayName?.trim() || "—";
  // Resolve role → localised label (Klient / Projektant).
  const roleLabel =
    roleState.status === "ready" ? t(`role.${roleState.profile.role}`) : "—";

  async function handleSignOut() {
    await signOut();
  }

  return (
    <section
      aria-label={t("settings.title")}
      className="mx-auto max-w-xl px-4 py-4"
    >
      <h1 className="sr-only">{t("settings.title")}</h1>

      <SettingsGroup title={t("settings.account")}>
        <Row label={t("settings.name")} value={displayName} />
        <Row label={t("settings.email")} value={user?.email ?? "—"} />
        <Row label={t("settings.role")} value={roleLabel} />
      </SettingsGroup>

      {!isPm && (
        <SettingsGroup title="Data">
          <LinkRow to="/kategorie" icon={<Tag size={18} aria-hidden />} label={t("settings.categories")} />
          <LinkRow to="/nastaveni/lokace" icon={<MapPin size={18} aria-hidden />} label={t("settings.locationsManage")} />
          <LinkRow to="/export" icon={<FileDown size={18} aria-hidden />} label={t("settings.export")} />
        </SettingsGroup>
      )}

      <SettingsGroup title={t("settings.themeLabel")}>
        <div className="px-4 py-3">
          <ThemeToggle />
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settings.install")}>
        <div className="px-4 py-3">
          <InstallHelper />
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settings.todoTitle")}>
        <p className="px-4 py-3 text-xs text-ink-subtle">
          {t("settings.todoHint")}
        </p>
        <TodoRow label={t("settings.todoRozpocet")} />
        <TodoRow label={t("settings.todoHarmonogram")} />
        <TodoRow label={t("settings.todoNotifikace")} />
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
        {t("settings.version")}: {import.meta.env.VITE_APP_VERSION ?? "dev"}
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

function LinkRow({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-4 px-4 py-3 min-h-tap text-sm text-ink hover:bg-bg-subtle transition-colors"
    >
      <span className="flex items-center gap-3">
        <span aria-hidden className="text-ink-subtle">{icon}</span>
        {label}
      </span>
      <ChevronRight aria-hidden size={16} className="text-ink-subtle" />
    </Link>
  );
}

/**
 * V11.2 — read-only row for features in active development. Shows the feature
 * name + a spinning-ish clock icon. Not a link; the page doesn't exist yet.
 */
function TodoRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 min-h-tap text-sm text-ink">
      <span className="flex items-center gap-3">
        <span aria-hidden className="text-ink-subtle">
          <Clock size={18} aria-hidden />
        </span>
        {label}
      </span>
      <span className="text-xs text-ink-subtle uppercase tracking-wide">WIP</span>
    </div>
  );
}
