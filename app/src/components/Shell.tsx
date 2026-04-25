import type { ReactNode } from "react";
import { Calendar, Notebook, Ellipsis, MapPin, Plus, ListChecks, CalendarDays } from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { useT } from "@/i18n/useT";
import type { UserRole } from "@/types";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { isBallOnMe as isBallOnMeV10 } from "@/lib/status";
import OfflineBanner from "./OfflineBanner";
import NotificationPermissionBanner from "./NotificationPermissionBanner";
import NotificationBell from "./NotificationBell";

interface Props {
  children: ReactNode;
  role: UserRole;
}

export default function Shell({ children, role }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <OfflineBanner />
      <NotificationPermissionBanner />
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
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-sans text-lg font-semibold tracking-tight truncate">
            {t("app.title")}
          </h1>
          <p className="mt-0.5 font-sans text-xs text-ink-subtle truncate">
            {t("app.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/events"
            aria-label={t("events.ariaCalendarLabel")}
            className="grid size-10 place-items-center rounded-md text-ink-muted hover:text-ink hover:bg-bg-subtle transition-colors"
          >
            <Calendar aria-hidden size={20} />
          </Link>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

function BottomTabs({ role }: { role: UserRole }) {
  const t = useT();
  const isPm = role === "PROJECT_MANAGER";
  const { user } = useAuth();
  const { tasks } = useTasks(Boolean(user));
  // V10 — ball-on-me is assignee-driven across all roles. The badge counts
  // every OPEN úkol where assigneeUid points at the current viewer.
  const ballOnMe = tasks.filter((tk) => isBallOnMeV10(tk, user?.uid)).length;

  return (
    <nav
      aria-label={t("aria.mainNav")}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {!isPm ? (
          <>
            {/* OWNER nav: Seznam / Záznamy · FAB · Úkoly / Nastavení */}
            <Tab to="/" end icon={<MapPin aria-hidden size={20} />} label={t("tabs.seznam")} />
            <Tab
              to="/zaznamy"
              icon={<Notebook aria-hidden size={20} />}
              label={t("tabs.zaznamy")}
            />
            <FabCell />
            <Tab
              to="/ukoly"
              icon={<ListChecks aria-hidden size={20} />}
              label={t("tabs.ukoly")}
              badge={ballOnMe}
            />
          </>
        ) : (
          <>
            {/* PM nav: Rozpočet · Záznamy · FAB · Úkoly / Nastavení.
                Layout: [Rozpočet] [Záznamy] [⊕] [Úkoly] · [Nastavení]. */}
            <Tab
              to="/harmonogram"
              icon={<CalendarDays aria-hidden size={20} />}
              label={t("tabs.harmonogram")}
            />
            <Tab
              to="/zaznamy"
              icon={<Notebook aria-hidden size={20} />}
              label={t("tabs.zaznamy")}
            />
            <FabCell />
            <Tab
              to="/ukoly"
              icon={<ListChecks aria-hidden size={20} />}
              label={t("tabs.ukoly")}
              badge={ballOnMe}
            />
          </>
        )}
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
  badge,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  label: string;
  badge?: number;
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
        <span aria-hidden className="relative">
          {icon}
          {badge && badge > 0 ? (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-2 grid min-w-[1.1rem] h-[1.1rem] place-items-center rounded-full bg-accent px-1 text-[0.65rem] font-semibold leading-none text-accent-on"
            >
              {badge > 9 ? "9+" : badge}
            </span>
          ) : null}
        </span>
        <span>{label}</span>
      </NavLink>
    </li>
  );
}


function FabCell() {
  const t = useT();
  return (
    <li className="relative -my-2 flex w-14 justify-center">
      <NavLink
        to="/novy"
        aria-label={t("tabs.newTask")}
        className={({ isActive }) =>
          [
            "grid size-14 place-items-center rounded-full bg-accent text-accent-on shadow-md ring-1 ring-line/40 transition-transform duration-fast hover:bg-accent-hover hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
            isActive ? "ring-2 ring-line-focus" : "",
          ].join(" ")
        }
      >
        <Plus aria-hidden size={24} />
      </NavLink>
    </li>
  );
}
