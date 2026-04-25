import { useEffect, useState } from "react";
import { ArrowRight, Bell, Calendar, Check, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  markOnboardingCompleted,
  updateUserContactEmail,
  updateUserDisplayName,
} from "@/lib/userProfile";
import { requestPermissionAndRegister } from "@/lib/messaging";
import { useBusy } from "./BusyOverlay";
import { ROUTES } from "@/lib/routes";

/**
 * V18-S30 — onboarding modal pro nové users.
 *
 * Triggeruje se podle `users/{uid}.onboardingCompletedAt`:
 *   - undefined / null → modal aktivní, projdou se kroky
 *   - jakákoliv ISO hodnota → modal už nikdy (V1 nemá reset)
 *
 * Čtyři kroky:
 *   1. Přezdívka (pre-fill auth displayName, skip = nech null)
 *   2. Kontakt email (pre-fill auth email, skip = nech null)
 *   3. Notifikace — pokud `Notification.permission === "granted"` step
 *      úplně přeskočíme (neukážeme). Jinak tlačítko "Povolit" zavolá
 *      requestPermissionAndRegister. Skip nech permission "default".
 *   4. Kalendář — jen info že existuje webcal subscription. CTA odkáže
 *      na Settings → Kalendář (uložit krok proběhne v markCompleted).
 *
 * Skip / Hotovo na posledním kroku → markOnboardingCompleted = ISO now.
 * Modal se po refreshi/další session už neukáže.
 *
 * Skip celého onboarding (X / Přeskočit) → také mark completed (user
 * dal najevo že o onboarding nemá zájem; respektujeme).
 */
export default function OnboardingModal() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const busy = useBusy();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nickname, setNickname] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Notifikační permission state (live — sleduje requestPermission výsledek).
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  // Pre-fill nickname z auth při vstupu na step 1.
  useEffect(() => {
    if (step === 1 && !nickname && user?.displayName) {
      setNickname(user.displayName);
    }
  }, [step, nickname, user]);

  // Pre-fill contactEmail z auth při vstupu na step 2.
  useEffect(() => {
    if (step === 2 && !contactEmail && user?.email) {
      setContactEmail(user.email);
    }
  }, [step, contactEmail, user]);

  if (!user) return null;
  if (roleState.status !== "ready") return null;

  // V18-S30 — gate na DB flag místo na splnění individuálních fieldů.
  if (roleState.profile.onboardingCompletedAt) return null;

  function isValidEmail(s: string): boolean {
    if (s.length === 0) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  // V18-S30 — step 3 (notifikace) zobrazíme vždy: i když user permission
  // už granted, chceme aby viděl info o granular ovládání. Tlačítko
  // "Povolit" se renderuje jen pro "default" permission, jinak rovnou
  // "Další".
  function nextStepFrom(current: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
    if (current === 1) return 2;
    if (current === 2) return 3;
    if (current === 3) return 4;
    return 4;
  }

  async function finishOnboarding() {
    if (!user) return;
    try {
      await busy.run(
        () => markOnboardingCompleted(user.uid),
        t("busy.saving"),
      );
    } catch (e) {
      console.error("markOnboardingCompleted failed", e);
      setError(t("onboarding.saveFailed"));
    }
  }

  async function handleStep1Next() {
    setError(null);
    const trimmed = nickname.trim();
    try {
      if (trimmed) {
        await busy.run(
          () => updateUserDisplayName(user!.uid, trimmed),
          t("busy.saving"),
        );
      }
      setStep(nextStepFrom(1));
    } catch (e) {
      console.error("nickname save in onboarding failed", e);
      setError(t("onboarding.saveFailed"));
    }
  }

  async function handleStep2Next() {
    setError(null);
    const trimmed = contactEmail.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setError(t("settings.contactEmailInvalid"));
      return;
    }
    try {
      if (trimmed) {
        await busy.run(
          () => updateUserContactEmail(user!.uid, trimmed),
          t("busy.saving"),
        );
      }
      setStep(nextStepFrom(2));
    } catch (e) {
      console.error("contactEmail save in onboarding failed", e);
      setError(t("onboarding.saveFailed"));
    }
  }

  async function handleEnableNotif() {
    setError(null);
    try {
      const result = await busy.run(
        () => requestPermissionAndRegister(user!.uid),
        t("onboarding.notifWaiting"),
      );
      // Refresh permission state z výsledku.
      if (result.status === "granted") {
        setNotifPermission("granted");
      } else if (result.status === "denied") {
        setNotifPermission("denied");
        setError(t("onboarding.notifDenied"));
      }
      // V každém případě posun na další krok — user uvidí stav a může jít dál.
      setStep(4);
    } catch (e) {
      console.error("requestPermissionAndRegister in onboarding failed", e);
      setError(t("onboarding.saveFailed"));
    }
  }

  async function handleSkipStep() {
    setError(null);
    if (step === 1) {
      setStep(nextStepFrom(1));
      return;
    }
    if (step === 2) {
      setStep(nextStepFrom(2));
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
    // step 4 → finish
    await finishOnboarding();
  }

  async function handleFinish() {
    await finishOnboarding();
  }

  async function handleSkipAll() {
    // I při skip all uložíme completed — user explicitně řekl že o
    // onboarding nestojí; nechceme ho otravovat při dalším otevření.
    await finishOnboarding();
  }

  // V18-S30 — onboarding má vždy 4 kroky (přezdívka, email, notifikace,
  // kalendář). Krok 3 zobrazuje info o notifikacích bez ohledu na to,
  // jestli má user permission — granular note tam je vždy.
  const totalSteps = 4;
  const visualStepIndex = step;

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
            {step === 1 && <User size={20} />}
            {step === 2 && <User size={20} />}
            {step === 3 && <Bell size={20} />}
            {step === 4 && <Calendar size={20} />}
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

        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className="size-2 rounded-full"
              style={{
                background:
                  visualStepIndex - 1 >= i
                    ? "var(--color-accent)"
                    : "var(--color-line)",
              }}
              aria-hidden
            />
          ))}
          <span className="ml-1 text-xs text-ink-subtle">
            {t("onboarding.stepOf", {
              current: visualStepIndex,
              total: totalSteps,
            })}
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

        {/* Step 3 — Notifikace (vždy zobrazené, větví se podle permission) */}
        {step === 3 && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-ink">{t("onboarding.notifTitle")}</p>
            {notifPermission === "default" && (
              <p className="text-xs text-ink-subtle">
                {t("onboarding.notifHint")}
              </p>
            )}
            {notifPermission === "granted" && (
              <p
                className="text-xs text-[color:var(--color-status-success-fg)]"
                role="status"
              >
                {t("onboarding.notifGranted")}
              </p>
            )}
            {notifPermission === "denied" && (
              <p
                className="text-xs text-[color:var(--color-status-danger-fg)]"
                role="status"
              >
                {t("onboarding.notifDeniedHint")}
              </p>
            )}
            {notifPermission === "unsupported" && (
              <p className="text-xs text-ink-subtle">
                {t("onboarding.notifUnsupported")}
              </p>
            )}
            {/* Granular note — vždy viditelná */}
            <p className="rounded-md bg-bg-subtle px-3 py-2 text-xs text-ink-muted leading-relaxed">
              {t("onboarding.notifGranularNote")}
            </p>
          </div>
        )}

        {/* Step 4 — Kalendář */}
        {step === 4 && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-ink">{t("onboarding.calendarTitle")}</p>
            <p className="text-xs text-ink-subtle">
              {t("onboarding.calendarHint")}
            </p>
            <Link
              to={`${ROUTES.nastaveni}#kalendar`}
              className="inline-flex items-center gap-2 self-start rounded-md ring-1 ring-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle transition-colors"
              onClick={() => {
                // Klik na link → mark completed na pozadí, modal zavře
                // přirozeně po navigaci.
                void finishOnboarding();
              }}
            >
              <Calendar aria-hidden size={16} />
              {t("onboarding.calendarOpenSettings")}
            </Link>
          </div>
        )}

        {error && step !== 3 && (
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
            onClick={step === 4 ? handleSkipAll : handleSkipStep}
            className="min-h-tap rounded-md ring-1 ring-line bg-surface px-4 py-2.5 text-sm text-ink-muted hover:bg-bg-subtle transition-colors"
          >
            {step === 4 ? t("onboarding.skipAll") : t("onboarding.skipStep")}
          </button>

          {step === 1 && (
            <button
              type="button"
              onClick={handleStep1Next}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover transition-colors"
            >
              {t("onboarding.next")}
              <ArrowRight aria-hidden size={16} />
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={handleStep2Next}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover transition-colors"
            >
              {t("onboarding.next")}
              <ArrowRight aria-hidden size={16} />
            </button>
          )}
          {step === 3 && notifPermission === "default" && (
            <button
              type="button"
              onClick={handleEnableNotif}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover transition-colors"
            >
              <Bell aria-hidden size={16} />
              {t("onboarding.notifEnableCta")}
            </button>
          )}
          {step === 3 && notifPermission !== "default" && (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover transition-colors"
            >
              {t("onboarding.next")}
              <ArrowRight aria-hidden size={16} />
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              onClick={handleFinish}
              className="ml-auto flex items-center gap-2 min-h-tap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on hover:bg-accent-hover transition-colors"
            >
              <Check aria-hidden size={16} />
              {t("onboarding.done")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
