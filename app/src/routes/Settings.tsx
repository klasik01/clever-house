import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Clock, Copy, FileDown, LogOut, MapPin, RefreshCw, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { signOut } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import InstallHelper from "@/components/InstallHelper";
import NotificationPrefsForm from "@/components/NotificationPrefsForm";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { useT } from "@/i18n/useT";
import { updateUserContactEmail, updateUserDisplayName } from "@/lib/userProfile";
import { useBusy } from "@/components/BusyOverlay";
import {
  buildCalendarUrl,
  ensureCalendarToken,
  rotateCalendarToken,
} from "@/lib/calendarToken";

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
        {user && (
          <ContactEmailRow
            uid={user.uid}
            initialValue={
              roleState.status === "ready"
                ? roleState.profile.contactEmail ?? ""
                : ""
            }
            authEmail={user.email ?? ""}
          />
        )}
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

      <SettingsGroup
        title={t("settings.calendarSectionTitle")}
        collapsible
        defaultOpen={false}
      >
        {user && <CalendarSection uid={user.uid} />}
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

/**
 * V18-S24 — kontakt email pro Apple Calendar Contacts matching.
 * User vyplní svůj iCloud / preferovaný email. ICS pak v ATTENDEE
 * mailto: použije tento email — Apple Calendar v iCloud Contacts najde
 * vizitku a zobrazí ji při kliknutí na účastníka.
 *
 * Commit on blur stejně jako NicknameRow. Light validation: musí obsahovat
 * @ a aspoň jeden tečku, jinak `setSavedVisible(false)` + UI toast.
 */
function ContactEmailRow({
  uid,
  initialValue,
  authEmail,
}: {
  uid: string;
  initialValue: string;
  authEmail: string;
}) {
  const t = useT();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCommittedRef = useRef(initialValue);

  useEffect(() => {
    if (!saving) {
      setValue(initialValue);
      lastCommittedRef.current = initialValue;
    }
  }, [initialValue, saving]);

  function isValidEmail(s: string): boolean {
    if (s.length === 0) return true; // empty = clear, OK
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  async function commit() {
    const next = value.trim();
    if (next === lastCommittedRef.current.trim()) return;
    if (!isValidEmail(next)) {
      setError(t("settings.contactEmailInvalid"));
      setValue(lastCommittedRef.current);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateUserContactEmail(uid, next);
      lastCommittedRef.current = next;
      setSavedVisible(true);
      window.setTimeout(() => setSavedVisible(false), 1500);
    } catch (e) {
      console.error("contactEmail save failed", e);
      setValue(lastCommittedRef.current);
      setError(t("settings.contactEmailFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="settings-contact-email" className="text-sm text-ink">
          {t("settings.contactEmailLabel")}
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
        id="settings-contact-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder={authEmail || "kontakt@example.cz"}
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
      />
      {error ? (
        <p
          role="alert"
          className="text-xs text-[color:var(--color-status-danger-fg)]"
        >
          {error}
        </p>
      ) : (
        <p className="text-xs text-ink-subtle">
          {t("settings.contactEmailHint")}
        </p>
      )}
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

/**
 * V18-S12 — Settings sekce "Kalendář". Lazy-generuje calendarToken při
 * prvním otevření, zobrazí "Připojit do Apple Calendar" webcal:// link,
 * collapsible detail s HTTPS URL copy, a [Resetovat] button.
 *
 * Reset → rotateCalendarToken(uid) zapíše nový token; trigger
 * `onUserUpdated` v CF to detekuje a pošle self-notifikaci
 * `event_calendar_token_reset` (push + inbox na všech zařízeních).
 */
function CalendarSection({ uid }: { uid: string }) {
  const t = useT();
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    ensureCalendarToken(uid)
      .then((tok) => {
        if (!alive) return;
        setToken(tok);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        console.error("ensureCalendarToken failed", e);
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  const httpsUrl = token ? buildCalendarUrl(uid, token, "https") : "";
  const webcalUrl = token ? buildCalendarUrl(uid, token, "webcal") : "";

  async function handleCopy() {
    if (!httpsUrl) return;
    try {
      await navigator.clipboard.writeText(httpsUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  }

  const busy = useBusy();

  async function handleReset() {
    if (!window.confirm(t("settings.calendarResetConfirm"))) return;
    setResetting(true);
    try {
      const next = await busy.run(
        () => rotateCalendarToken(uid),
        t("busy.saving"),
      );
      setToken(next);
    } catch (e) {
      console.error("rotateCalendarToken failed", e);
      window.alert(t("settings.calendarResetFailed"));
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <p className="px-4 py-3 text-sm text-ink-subtle">
        {t("settings.calendarLoading")}
      </p>
    );
  }
  if (error) {
    return (
      <p className="px-4 py-3 text-sm text-[color:var(--color-status-danger-fg)]">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 pt-3 pb-1 text-xs text-ink-subtle">
        {t("settings.calendarIntro")}
      </p>
      <div className="px-4 py-3">
        <a
          href={webcalUrl}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover transition-colors"
        >
          <Calendar aria-hidden size={16} />
          {t("settings.calendarConnectCta")}
        </a>
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        aria-expanded={detailsOpen}
        className="flex items-center justify-between gap-2 px-4 py-3 text-left text-sm text-ink hover:bg-bg-subtle transition-colors"
      >
        <span>{t("settings.calendarDetailsToggle")}</span>
        <ChevronDown
          aria-hidden
          size={16}
          className={`text-ink-subtle transition-transform duration-200 ${
            detailsOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {detailsOpen && (
        <div className="flex flex-col gap-3 px-4 pb-3">
          <div>
            <p className="mb-1 text-xs text-ink-subtle">
              {t("settings.calendarUrlLabel")}
            </p>
            <div className="flex items-start gap-2">
              <code
                className="flex-1 min-w-0 break-all rounded-md bg-bg-subtle px-2 py-1.5 text-xs text-ink"
                aria-label={t("settings.calendarUrlLabel")}
              >
                {httpsUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={t("settings.calendarCopy")}
                className="inline-flex items-center gap-1 rounded-md ring-1 ring-line bg-surface px-2 py-1.5 text-xs text-ink-muted hover:bg-bg-subtle transition-colors"
              >
                <Copy aria-hidden size={14} />
                {copied ? t("settings.calendarCopied") : t("settings.calendarCopy")}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center justify-center gap-2 rounded-md ring-1 ring-line bg-surface px-3 py-2 text-sm font-medium text-ink-muted hover:bg-bg-subtle transition-colors disabled:opacity-60"
          >
            <RefreshCw aria-hidden size={14} className={resetting ? "animate-spin" : ""} />
            {resetting
              ? t("settings.calendarResetting")
              : t("settings.calendarResetCta")}
          </button>
          <p className="text-xs text-ink-subtle">
            {t("settings.calendarResetHint")}
          </p>
        </div>
      )}
    </div>
  );
}
