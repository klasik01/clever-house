import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Clock, FileDown, LogOut, MapPin, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { signOut } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import InstallHelper from "@/components/InstallHelper";
import NotificationPrefsForm from "@/components/NotificationPrefsForm";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { useT } from "@/i18n/useT";
import { updateUserDisplayName } from "@/lib/userProfile";

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

  // V16.3 — Notifikace sekce se sbaluje, aby nezabírala tolik místa. Když
  // push nejsou povolené (default/denied/unsupported), otevřeme ji rovnou —
  // tam user potřebuje kliknout. Když je granted, default collapsed; user
  // si ji otevře jen když chce měnit per-event toggles.
  const notifPermission = useNotificationPermission();
  const notifDefaultOpen = notifPermission !== "granted";

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
        {user && (
          <NicknameRow
            uid={user.uid}
            initialValue={profileName ?? ""}
            fallback={displayName}
          />
        )}
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

      <SettingsGroup
        title={t("notifikace.sectionTitle")}
        collapsible
        defaultOpen={notifDefaultOpen}
      >
        <NotificationPrefsForm />
      </SettingsGroup>

      <SettingsGroup title={t("settings.todoTitle")}>
        <p className="px-4 py-3 text-xs text-ink-subtle">
          {t("settings.todoHint")}
        </p>
        <TodoRow label={t("settings.todoRozpocet")} />
        <TodoRow label={t("settings.todoHarmonogram")} />
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
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  /** V16.3 — pokud true, render hlavičku jako klikatelný řádek + schovatelný
   *  obsah. Animace jede přes grid-template-rows trick (plynulé 0fr↔1fr). */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // Když defaultOpen změní svou hodnotu dynamicky (např. permission-driven
  // sekce notifikací), sesynchronizuj. Ale jen nahoru-dolů; už vybrané
  // preferenční overrides ignorujeme — pokud uživatel zavře manuálně,
  // příští načtení stránky ho zase otevře podle permission, což je OK.
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  if (!collapsible) {
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

  const sectionId = `settings-group-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={sectionId}
        className="mb-2 flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          {title}
        </h2>
        <ChevronDown
          aria-hidden
          size={16}
          className={`text-ink-subtle transition-transform duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      <div
        id={sectionId}
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease",
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div className="rounded-md bg-surface ring-1 ring-line divide-y divide-line">
            {children}
          </div>
        </div>
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

/**
 * V16.1 — editovatelná přezdívka. Commit on blur (nebo Enter), stejná UX jako
 * TaskDetail title — uživatel nevidí explicitní "Uložit" tlačítko, jen
 * "Ukládám…" / "Uloženo" blikne vedle labelu. Prázdný string uloží null
 * (zpátky na auth/email fallback).
 */
function NicknameRow({
  uid,
  initialValue,
  fallback,
}: {
  uid: string;
  initialValue: string;
  fallback: string;
}) {
  const t = useT();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const lastCommittedRef = useRef(initialValue);

  // Re-sync when the profile snapshot catches up (e.g. login flow).
  useEffect(() => {
    if (!saving) {
      setValue(initialValue);
      lastCommittedRef.current = initialValue;
    }
    // `saving` guard: pokud zrovna ukládám, nech user input netknutý, ať
    // snapshot z Firestore neodsune rozepsanou hodnotu.
  }, [initialValue, saving]);

  async function commit() {
    const next = value.trim();
    if (next === lastCommittedRef.current.trim()) return;
    setSaving(true);
    try {
      await updateUserDisplayName(uid, next);
      lastCommittedRef.current = next;
      setSavedVisible(true);
      window.setTimeout(() => setSavedVisible(false), 1500);
    } catch (e) {
      console.error("nickname save failed", e);
      // Vrátit UI na poslední známou hodnotu — user aspoň uvidí že se nepovedlo.
      setValue(lastCommittedRef.current);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="settings-nickname" className="text-sm text-ink">
          {t("settings.nameLabel")}
        </label>
        <span className="text-xs text-ink-subtle" aria-live="polite">
          {saving
            ? t("settings.nameSaving")
            : savedVisible
            ? t("settings.nameSaved")
            : ""}
        </span>
      </div>
      <input
        id="settings-nickname"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder={fallback !== "—" ? fallback : t("settings.namePlaceholder")}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
      />
      <p className="text-xs text-ink-subtle">{t("settings.nameHint")}</p>
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
