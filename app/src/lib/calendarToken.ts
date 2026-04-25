import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * V18-S12 — per-user webcal subscription token.
 *
 * Token je URL-safe secret uložený v `users/{uid}.calendarToken`. Slouží
 * k ověření v CF `calendarSubscription` HTTP endpointu (S11) — URL
 * obsahuje uid + token a server ho matchuje proti user docu.
 *
 * Lifecycle:
 *   - Při prvním otevření Settings "Kalendář" (nebo při přihlášení) se
 *     `ensureCalendarToken` zavolá. Pokud user doc token nemá, vygeneruje
 *     se a zapíše atomicky.
 *   - Migrace `2026-04-25-V18-S12-calendar-tokens.mjs` backfillne tokeny
 *     pro všechny existující users deploy-time.
 *   - Reset (`rotateCalendarToken`) invalidizuje všechny subskripce na
 *     všech zařízeních — Apple Calendar refresh stáhne 401 a přestane
 *     fetchovat. User musí přepojit subscription s novou URL.
 *
 * Token entropie: 128 bit (crypto.randomUUID → 36 znaků, odstraníme
 * pomlčky → 32 hex). Dost velké že guessing je nemožný.
 */

const TOKEN_LEN_MIN = 20;

/**
 * Vrátí nový URL-safe token. 32 hex znaků z UUID, žádné pomlčky.
 * Pure funkce — žádný Firestore side effect.
 */
export function generateCalendarToken(): string {
  const cryptoObj = (typeof globalThis !== "undefined"
    ? (globalThis as unknown as { crypto?: Crypto }).crypto
    : undefined);
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID().replace(/-/g, "");
  }
  // Fallback — ancient browsery. Ne kryptograficky silné, ale nepředpokládá se.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Zajistí, že user doc má `calendarToken`. Pokud ho nemá, vygeneruje
 * a zapíše (idempotentní — druhé volání nic nepřepíše).
 *
 * Vrací aktuální/nově vygenerovaný token. Volatelné z klienta —
 * rules povolují self-update pole `calendarToken` + `calendarTokenRotatedAt`.
 */
export async function ensureCalendarToken(uid: string): Promise<string> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const existing = typeof data?.calendarToken === "string" ? data.calendarToken : "";
  if (existing.length >= TOKEN_LEN_MIN) return existing;

  const token = generateCalendarToken();
  await setDoc(
    ref,
    {
      calendarToken: token,
      calendarTokenRotatedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

/**
 * Vygeneruje nový token a přepíše starý. Apple Calendar subscribers se
 * při dalším fetchu dostanou 401 a refresh failne — user musí v Settings
 * zkopírovat novou URL a nahradit subscription.
 *
 * Trigger `onUserUpdated` (V18-S12) detekuje změnu `calendarTokenRotatedAt`
 * a pošle push+inbox `event_calendar_token_reset` userovi — na druhém
 * zařízení se objeví upozornění.
 */
export async function rotateCalendarToken(uid: string): Promise<string> {
  const ref = doc(db, "users", uid);
  const token = generateCalendarToken();
  await setDoc(
    ref,
    {
      calendarToken: token,
      calendarTokenRotatedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return token;
}

/**
 * Složí absolutní URL pro webcal subscription. Base URL záleží na
 * deployu — v dev směřujeme na dev CF, v prod na prod CF. Env vars:
 *   - VITE_FIREBASE_PROJECT_ID (povinná — z firebase config)
 *   - VITE_CF_REGION (optional — default "europe-west1")
 *
 * `scheme` = "webcal" pro iOS prompt subscribe / "https" pro copy/curl.
 */
export function buildCalendarUrl(
  uid: string,
  token: string,
  scheme: "webcal" | "https" = "https",
): string {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "";
  const region = import.meta.env.VITE_CF_REGION ?? "europe-west1";
  const host = `${region}-${projectId}.cloudfunctions.net`;
  const path = `/calendarSubscription/${uid}/${token}.ics`;
  return `${scheme}://${host}${path}`;
}
