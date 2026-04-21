import { useEffect, useState } from "react";

/**
 * Reactive `navigator.onLine` subscription.
 * Updates on \`online\` / \`offline\` window events.
 * SSR-safe: returns `true` when `navigator` is unavailable.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Refresh in case the mount-time value was stale (some PWA launch edge cases).
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
