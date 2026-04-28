import type { ReactNode } from "react";
import { Calendar, FileText, Notebook, Ellipsis, ListChecks } from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { useT } from "@/i18n/useT";
import { useVisibleTasks } from "@/hooks/useVisibleTasks";
import { useEventsActionCount } from "@/hooks/useEventsActionCount";
import { useAuth } from "@/hooks/useAuth";
import { isBallOnMe as isBallOnMeV10 } from "@/lib/status";
import OfflineBanner from "./OfflineBanner";
import NotificationPermissionBanner from "./NotificationPermissionBanner";
import NotificationBell from "./NotificationBell";
import OnboardingModal from "./OnboardingModal";
import { ROUTES } from "@/lib/routes";
import FabRadial from "./FabRadial";

interface Props {
  children: ReactNode;
}

export default function Shell({ children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <OfflineBanner />
      <NotificationPermissionBanner />
      <OnboardingModal />
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
  const { user } = useAuth();
  const eventsActionCount = useEventsActionCount(user?.uid);
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
            to={ROUTES.events}
            aria-label={t("events.ariaCalendarLabel")}
            className="relative grid size-10 place-items-center rounded-md text-ink-muted hover:text-ink hover:bg-bg-subtle transition-colors"
          >
            <Calendar aria-hidden size={20} />
            {eventsActionCount > 0 && (
              <span
                aria-hidden
                className="absolute top-1 right-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-pill px-1 text-[10px] font-semibold text-white"
                style={{
                  background: "var(--color-status-danger-fg)",
                  lineHeight: "1rem",
                }}
              >
                {eventsActionCount > 99 ? "99+" : eventsActionCount}
              </span>
            )}
            <span className="sr-only">
              {eventsActionCount > 0
                ? t("events.actionsBadgeAria", { n: eventsActionCount })
                : ""}
            </span>
          </Link>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

function BottomTabs() {
  const t = useT();
  const { user } = useAuth();
  const { tasks } = useVisibleTasks(Boolean(user));
  // V10 — ball-on-me is assignee-driven across all roles. The badge counts
  // every OPEN úkol where assigneeUid points at the current viewer.
  const ballOnMe = tasks.filter((tk) => isBallOnMeV10(tk, user?.uid)).length;

  return (
    <nav
      aria-label={t("aria.mainNav")}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur pb-safe"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {/* Unified nav: Dokumentace / Záznamy · FAB · Úkoly / Nastavení */}
        <Tab
          to={ROUTES.dokumentace}
          icon={<FileText aria-hidden size={20} />}
          label={t("tabs.dokumentace")}
        />
        <Tab
          to={ROUTES.zaznamy}
          icon={<Notebook aria-hidden size={20} />}
          label={t("tabs.zaznamy")}
        />
        <FabRadialCell />
        <Tab
          to={ROUTES.ukoly}
          icon={<ListChecks aria-hidden size={20} />}
          label={t("tabs.ukoly")}
          badge={ballOnMe}
        />
        <Tab
          to={ROUTES.nastaveni}
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


function FabRadialCell() {
  return (
    <li className="relative -my-2 flex w-14 justify-center">
      <FabRadial />
    </li>
  );
}
