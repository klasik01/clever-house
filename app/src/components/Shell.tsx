import type { ReactNode } from "react";
import { Notebook, HelpCircle, Ellipsis } from "lucide-react";
import { useT } from "@/i18n/useT";

interface Props {
  children: ReactNode;
}

/**
 * App shell: top header (brand) + scrollable content + bottom tab bar.
 * In S01 only the "Zachyt" tab is active; others are disabled placeholders.
 * Safe-area padding via custom utilities .pt-safe / .pb-safe (see globals.css).
 */
export default function Shell({ children }: Props) {
  const t = useT();

  return (
    <div className="flex min-h-full flex-col bg-bg text-ink">
      <Header />

      {/* Main scroll region; bottom padding reserves space for tab bar + safe-area */}
      <main
        id="main"
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]"
      >
        {children}
      </main>

      <nav
        aria-label="Hlavní navigace"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur pb-safe"
      >
        <ul className="mx-auto flex max-w-xl items-stretch justify-around">
          <TabButton
            icon={<Notebook aria-hidden size={20} />}
            label={t("tabs.capture")}
            active
          />
          <TabButton
            icon={<HelpCircle aria-hidden size={20} />}
            label={t("tabs.questions")}
            disabled
          />
          <TabButton
            icon={<Ellipsis aria-hidden size={20} />}
            label={t("tabs.more")}
            disabled
          />
        </ul>
      </nav>
    </div>
  );
}

function Header() {
  const t = useT();
  return (
    <header
      className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur pt-safe"
      role="banner"
    >
      <div className="mx-auto flex max-w-xl items-baseline justify-between px-4 py-3">
        <h1 className="font-sans text-lg font-semibold tracking-tight">
          {t("app.title")}
        </h1>
        <span className="font-sans text-xs text-ink-subtle">
          {t("app.subtitle")}
        </span>
      </div>
    </header>
  );
}

function TabButton({
  icon,
  label,
  active,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <li className="flex-1">
      <button
        type="button"
        disabled={disabled}
        aria-current={active ? "page" : undefined}
        className={[
          "flex w-full min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium",
          active ? "text-accent" : "text-ink-subtle",
          disabled ? "opacity-40" : "hover:text-ink",
          "transition-colors duration-fast",
        ].join(" ")}
      >
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </button>
    </li>
  );
}
