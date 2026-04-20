import { useT } from "@/i18n/useT";

/**
 * Visible only on keyboard focus (Tab from address bar). Jumps focus
 * past header/nav straight to the main content. WCAG 2.4.1 "Bypass Blocks".
 */
export default function SkipLink() {
  const t = useT();
  return (
    <a
      href="#main"
      className={[
        "fixed left-4 z-50",
        // Hidden off-screen until focused; then becomes visible at top-left
        "top-[max(env(safe-area-inset-top,0px),0.5rem)]",
        "-translate-y-full focus:translate-y-0",
        "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on shadow-lg",
        "transition-transform duration-fast",
      ].join(" ")}
    >
      {t("aria.skipToContent")}
    </a>
  );
}
