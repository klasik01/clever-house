import { AlertTriangle, ChevronRight, Clock, FileDown, LogOut, Tag, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { signOut } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import InstallHelper from "@/components/InstallHelper";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { computePrehledGroups } from "@/lib/prehled";
import { useT } from "@/i18n/useT";

export default function Settings() {
  const t = useT();
  const { user } = useAuth();
  const { tasks } = useTasks(Boolean(user));
  const groups = computePrehledGroups(tasks, user?.uid ?? "");
  const miniCounts = {
    waitingMe: groups["waiting-me"].length,
    overdue: groups.overdue.length,
    stuck: groups.stuck.length,
  };

  async function handleSignOut() {
    await signOut();
  }

  return (
    <section
      aria-label={t("settings.title")}
      className="mx-auto max-w-xl px-4 py-4"
    >
      <h1 className="sr-only">{t("settings.title")}</h1>

      <Link
        to="/prehled"
        className="mt-2 flex items-center justify-between gap-3 rounded-md bg-surface p-4 ring-1 ring-line transition-colors hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-line-focus"
        aria-label={t("settings.prehledCard.title")}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t("settings.prehledCard.title")}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{t("settings.prehledCard.hint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-ink">
              <UserCheck aria-hidden size={14} className="text-accent-visual" />
              <span className="font-semibold tabular-nums">{miniCounts.waitingMe}</span>
              <span className="text-ink-subtle">{t("prehled.waitingMe")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink">
              <AlertTriangle aria-hidden size={14} className="text-[color:var(--color-status-danger-fg)]" />
              <span className="font-semibold tabular-nums">{miniCounts.overdue}</span>
              <span className="text-ink-subtle">{t("prehled.overdue")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink">
              <Clock aria-hidden size={14} className="text-[color:var(--color-status-warning-fg)]" />
              <span className="font-semibold tabular-nums">{miniCounts.stuck}</span>
              <span className="text-ink-subtle">{t("prehled.stuck")}</span>
            </span>
          </div>
        </div>
        <ChevronRight aria-hidden size={18} className="shrink-0 text-ink-subtle" />
      </Link>

      <SettingsGroup title={t("settings.account")}>
        <Row label={t("settings.email")} value={user?.email ?? "—"} />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <LinkRow to="/kategorie" icon={<Tag size={18} aria-hidden />} label={t("settings.categories")} />
        <LinkRow to="/export" icon={<FileDown size={18} aria-hidden />} label={t("settings.export")} />
      </SettingsGroup>

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
        {t("settings.version")}: 0.14.0 (S14)
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
