import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  FileText,
  HelpCircle,
  Notebook,
  Plus,
  Target,
} from "lucide-react";
import { useT } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { roleHas } from "@/lib/permissionsConfig";
import { ROUTES } from "@/lib/routes";
import type { TaskType } from "@/types";
import { TYPE_COLORS, EVENT_COLOR } from "@/lib/typeColors";

interface FabItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  /** For task types — created via createTask. */
  taskType?: TaskType;
  /** For non-task items (events) — direct route. */
  route?: string;

}

/**
 * V20 — Radial FAB menu. Replaces the old single-link FAB.
 *
 * On tap the + rotates to × and 5 items fan out in a semicircle above.
 * Each item creates a minimal task (title-first flow) or redirects to
 * the event composer.
 */
export default function FabRadial() {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const role =
    roleState.status === "ready" ? roleState.profile.role : null;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const canNapad = roleHas("task.create.napad", role);
  // V24 — CM nesmí vytvořit dokumentaci (jen ji čte). Stejný pattern jako napad.
  const canDokumentace = roleHas("task.create.dokumentace", role);

  const items: FabItem[] = [
    ...(canNapad
      ? [
          {
            key: "napad",
            icon: <Notebook size={20} />,
            label: t("fab.napad"),
            taskType: "napad" as TaskType,
          },
        ]
      : []),
    ...(canDokumentace
      ? [
          {
            key: "dokumentace",
            icon: <FileText size={20} />,
            label: t("fab.dokumentace"),
            taskType: "dokumentace" as TaskType,
          },
        ]
      : []),
    {
      key: "ukol",
      icon: <Target size={20} />,
      label: t("fab.ukol"),
      taskType: "ukol" as TaskType,

    },
    {
      key: "otazka",
      icon: <HelpCircle size={20} />,
      label: t("fab.otazka"),
      taskType: "otazka" as TaskType,

    },
    {
      key: "event",
      icon: <Calendar size={20} />,
      label: t("fab.udalost"),
      route: ROUTES.eventsNew,

    },
  ];

  function handlePick(item: FabItem) {
    setOpen(false);

    if (item.route) {
      navigate(item.route);
      return;
    }

    if (!item.taskType) return;

    // V20 fix — don't create task yet, just navigate to title-first screen.
    // Task will be created in Firestore only after user confirms a title.
    navigate("/t/new", { state: { createType: item.taskType } });
  }

  // Fan layout: items spread in a semicircle above the FAB.
  // Angles go from 180° (left) to 0° (right) evenly spaced.
  const RADIUS = 90; // px from center of FAB
  const count = items.length;
  // Spread from ~200° to ~340° (arc above, slight spread)
  const startAngle = 180 + 15; // degrees
  const endAngle = 360 - 15;
  const step = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;

  return (
    <div ref={containerRef} className="relative -my-2 flex w-14 justify-center">
      {/* Backdrop overlay when open */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 transition-opacity"
          aria-hidden
        />
      )}

      {/* Fan items */}
      {items.map((item, i) => {
        const angle = startAngle + step * i;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * RADIUS;
        const y = Math.sin(rad) * RADIUS;
        const itemColor = item.taskType ? TYPE_COLORS[item.taskType] : EVENT_COLOR;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => handlePick(item)}
            aria-label={item.label}
            className="group absolute z-30 grid size-12 place-items-center rounded-full text-white shadow-lg transition-all duration-300 ease-out hover:scale-125 active:scale-95 disabled:opacity-40"
            style={{
              backgroundColor: itemColor,
              boxShadow: `0 4px 14px ${itemColor}50`,
              transform: open
                ? `translate(${x}px, ${y}px) scale(1)`
                : "translate(0, 0) scale(0)",
              opacity: open ? 1 : 0,
              transitionDelay: open ? `${i * 40}ms` : "0ms",
              bottom: "50%",
              left: "50%",
              marginLeft: "-1.5rem",
              marginBottom: "-1.5rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 8px 28px ${itemColor}90`;
              e.currentTarget.style.filter = "brightness(1.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 4px 14px ${itemColor}50`;
              e.currentTarget.style.filter = "";
            }}
          >
            {item.icon}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-surface opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* FAB button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("fab.close") : t("tabs.newTask")}
        aria-expanded={open}
        className={[
          "relative z-30 grid size-14 place-items-center rounded-full shadow-md ring-1 ring-line/40 transition-all duration-300 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus",
          "hover:scale-105 active:scale-95 disabled:opacity-60",
          open
            ? "bg-ink text-surface rotate-0"
            : "bg-accent text-accent-on",
        ].join(" ")}
      >
        <span
          className="transition-transform duration-300"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0)" }}
        >
          <Plus aria-hidden size={24} />
        </span>
      </button>
    </div>
  );
}
