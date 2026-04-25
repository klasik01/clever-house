import { useState } from "react";
import { ArrowRight, Check, User } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  updateUserContactEmail,
  updateUserDisplayName,
} from "@/lib/userProfile";

/**
 * V18-S24 — onboarding modal pro nově přihlášené users co nemají vyplněné
 * základní fieldy (`displayName`, `contactEmail`). Renderuje se v Shell
 * jakmile je `useUserRole` ready a oba fieldy jsou null/empty. Po
 * dokončení (nebo "Přeskočit") modal zmizí — nabídne se pak až další
 * sign-in nebo když user manuálně klikne v Settings.
 *
 * Dva kroky:
 *   1. Přezdívka (jak tě budou ostatní oslovovat v appce)
 *   2. Kontakt email (pro Apple Calendar Contacts vizitku)
 *
 * Skip cestou: user může každý krok preskočit pomocí "Později" — fields
 * zůstanou null. Default values forwardujeme z auth (email, displayName
 * z Google profilu) aby user jen kliknul "Hotovo" pokud nechce nic měnit.
 */
export default function OnboardingModal() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  if (dismissed) return null;
  if (roleState.status !== "ready") return null;

  const profile = roleState.profile;
  const hasNickname = Boolean(profile.displayName?.trim());
  const hasContactEmail = Boolean(profile.contactEmail?.trim());

  // Pokud user má oba fieldy, modal se nezobrazí.
  if (hasNickname && hasContactEmail) return null;

  // Default hodnoty z auth (Google sign-in) aby user jen potvrdil.
  if (!nickname && user.displayName && step === 1) {
    setNickname(user.displayName);
  }
  if (!contactEmail && user.email && step === 2) {
    setContactEmail(user.email);
  }

  function isValidEmail(s: string): boolean {
    if (s.length === 0) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  async function handleStep1Next() {
    setError(null);
    const trimmed = nickname.trim();
    if (!trimmed) {
      // Skip = ponecháme null, přejdeme na krok 2
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      await updateUserDisplayName(user!.uid, trimmed);
      setStep(2);
    } catch (e) {
      console.error("nickname save in onboarding failed", e);
      setError(t("onboarding.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2Done() {
    setError(null);
    const trimmed = contactEmail.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setError(t("settings.contactEmailInvalid"));
      return;
    }
    setSaving(true);
    try {
      if (trimmed) {
        await updateUserContactEmail(user!.uid, trimmed);
      }
      setDismissed(true);
    } catch (e) {
      console.error("contactEmail save in onboarding failed", e);
      setError(t("onboarding.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleSkipAll() {
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-surface shadow-xl ring-1 ring-line p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"
          >
            <User size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="onboarding-title" className="text-base font-semibold text-ink">
              {t("onboarding.welcomeTitle")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t("onboarding.welcomeBody")}
            </p>
          </div>
        </div>

        {/* Progress indikátor */}
        <div className="mt-4 flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{
              background:
                step >= 1 ? "var(--color-accent)" : "var(--color-line)",
            }}
            aria-hidden
          />
          <span
            className="size-2 rounded-full"
            style={{
              background:
                step >= 2 ? "var(--color-accent)" : "var(--color-line)",
            }}
            aria-hidden
          />
          <span className="ml-1 text-xs text-ink-subtle">
            {t("onboarding.stepOf", { current: step, total: 2 })}
          </span>
        </div>

        {/* Step 1 — Přezdívka */}
        {step === 1 && (
          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="onboarding-nickname"
              className="text-sm font-medium text-ink"
            >
              {t("onboarding.nicknameLabel")}
            </label>
            <input
              id="onboarding-nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("onboarding.nicknamePlaceholder")}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
              autoFocus
            />
            <p className="text-xs text-ink-subtle">
              {t("onboarding.nicknameHint")}
            </p>
          </div>
        )}

        {/* Step 2 — Contact email */}
        {step === 2 && (
          <div className="mt-4 flex flex-col gap-2">
            <label
              htmlFor="onboarding-contact-email"
              className="text-sm font-medium text-ink"
            >
              {t("onboarding.contactEmailLabel")}
            </label>
            <input
              id="onboarding-contact-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder={user.email ?? "kontakt@example.cz"}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
            />
            <p className="text-xs text-ink-subtle">
              {t("onboarding.contactEmailHint")}
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 text-xs text-[color:var(--color-status-danger-fg)]"
          >
            {error}
          </p>
        )}

        {/* Akce */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSkipAll}
            disabled={saving}
            className="min-h-tap rounded-md ring-1 ring-line bg-surface px-4 py-2.5 text-sm text-ink-muted hover:bg-bg-subtle disabled:opacity-60 transition-colors"
          >
            {t("onboarding.skipAll")}
          </button>
          {step === 1 && (
            <button
              type="button"
              onClick={handleStep1Next}
              disabled={saving}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 transition-colors"
            >
              {t("onboarding.next")}
              <ArrowRight aria-hidden size={16} />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={handleStep2Done}
              disabled={saving}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 transition-colors"
            >
              <Check aria-hidden size={16} />
              {saving ? t("onboarding.saving") : t("onboarding.done")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
