import type { ReactNode } from "react";
import { Notebook, HelpCircle, Ellipsis, MapPin } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useT } from "@/i18n/useT";
import type { UserRole } from "@/types";

interface Props {
  children: ReactNode;
  role: UserRole;
}

export default function Shell({ children, role }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <Header />
      <main
        id="main"
        className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]"
      >
        {children}
      </main>
      <BottomTabs role={role} />
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

function BottomTabs({ role }: { role: UserRole }) {
  const t = useT();
  const isPm = role === "PROJECT_MANAGER";
  return (
    <nav
      aria-label={t("aria.mainNav")}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {!isPm && (
          <Tab to="/" end icon={<MapPin aria-hidden size={20} />} label={t("tabs.locations")} />
        )}
        {!isPm && (
          <Tab
            to="/napady"
            icon={<Notebook aria-hidden size={20} />}
            label={t("tabs.napady")}
          />
        )}
        <Tab
          to="/otazky"
          end={isPm}
          icon={<HelpCircle aria-hidden size={20} />}
          label={t("tabs.questions")}
        />
        <Tab
          to="/nastaveni"
          icon={<Ellipsis aria-hidden size={20} />}
          label={t("tabs.more")}
        />
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
