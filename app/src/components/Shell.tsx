import type { ReactNode } from "react";
import { Notebook, HelpCircle, Ellipsis } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useT } from "@/i18n/useT";

interface Props {
  children: ReactNode;
}

export default function Shell({ children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <Header />
      <main
        id="main"
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]"
      >
        {children}
      </main>
      <BottomTabs />
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

function BottomTabs() {
  const t = useT();
  return (
    <nav
      aria-label="Hlavní navigace"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        <Tab to="/" end icon={<Notebook aria-hidden size={20} />} label={t("tabs.capture")} />
        <Tab to="/otazky" icon={<HelpCircle aria-hidden size={20} />} label={t("tabs.questions")} />
        <Tab to="/nastaveni" icon={<Ellipsis aria-hidden size={20} />} label={t("tabs.more")} />
      </ul>
    </nav>
  );
}

function Tab({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          [
            "flex w-full min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors duration-fast",
            isActive ? "text-accent" : "text-ink-subtle hover:text-ink",
          ].join(" ")
        }
      >
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </NavLink>
    </li>
  );
}
