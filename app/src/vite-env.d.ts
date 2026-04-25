/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** Web Push VAPID public key — Firebase Console → Cloud Messaging → Web
   *  Push certificates → Key pair. ~88 znaků, B-prefix. Bez něj FCM
   *  registrace v messaging.ts vrátí status "unsupported". */
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  /** Cloud Functions region — default "europe-west1". Override jen pokud
   *  děláš multi-region setup (S12 webcal URL hostname). */
  readonly VITE_CF_REGION?: string;
  /** Injected at build time from package.json — see vite.config.ts. */
  readonly VITE_APP_VERSION?: string;
  /** True when running under Vitest. */
  readonly VITEST?: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
