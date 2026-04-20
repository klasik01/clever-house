import { useEffect, useState } from "react";
import {
  canInstall,
  detectPlatform,
  isStandalone,
  subscribeInstallState,
} from "@/lib/installPrompt";

export function useInstallState(): {
  standalone: boolean;
  installable: boolean;
  platform: "ios" | "android" | "desktop";
} {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return subscribeInstallState(() => setTick((t) => t + 1));
  }, []);

  // `tick` is only a cache-busting dependency; values re-read on each render.
  void tick;
  return {
    standalone: isStandalone(),
    installable: canInstall(),
    platform: detectPlatform(),
  };
}
