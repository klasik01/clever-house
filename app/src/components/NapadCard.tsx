import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  FileText,
  Flag,
  HelpCircle,
  Image as ImageIcon,
  Link as LinkIcon,
  MapPin,
  Milestone,
  Notebook,
  Paperclip,
  Target,
} from "lucide-react";
import type { Task } from "@/types";
import { useT, formatRelative } from "@/i18n/useT";
import { statusColors } from "./StatusBadge";
import AvatarCircle from "./AvatarCircle";
import PriorityBadge from "./PriorityBadge";
import DeadlineChip from "./DeadlineChip";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePhases } from "@/hooks/usePhases";
import { getLocation } from "@/lib/locations";
import { mapLegacyOtazkaStatus } from "@/lib/status";
import { canViewTask } from "@/lib/permissions";
import { taskDetail } from "@/lib/routes";
import { TYPE_COLORS } from "@/lib/typeColors";

interface Props {
  task: Task;
  /** Full task list — needed to resolve linkedTaskIds into titles. */
  allTasks?: Task[];
}

export default function NapadCard({ task, allTasks = [] }: Props) {
  const t = useT();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const currentUserRole = roleState.status === "ready" ? roleState.profile.role : null;
  const { phases } = usePhases(Boolean(user));
  const [expanded, setExpanded] = useState(false);

  // V23 — resolve status for left border color
  const resolvedStatus = (task.type === "otazka" || task.type === "ukol" || task.type === "napad")
    ? mapLegacyOtazkaStatus(task.status)
    : task.status;

  const { byUid } = useUsers(Boolean(user));
  const assignee = task.assigneeUid ? byUid.get(task.assigneeUid) : undefined;
  const created = new Date(task.createdAt);
  const TypeIcon =
    task.type === "otazka"
      ? HelpCircle
      : task.type === "ukol"
      ? Target
      : task.type === "dokumentace"
      ? FileText
      : Notebook;

  const location = getLocation(task.locationId);

  // Title prominent; fallback to body first line, then placeholder
  const titleDisplay =
    task.title?.trim() ||
    task.body?.split("\n")[0]?.trim().slice(0, 80) ||
    t("detail.noTitle");

  const hasImage = (task.attachmentImages?.length ?? 0) > 0 || Boolean(task.attachmentImageUrl);
  const hasLink = (task.attachmentLinks?.length ?? 0) > 0 || Boolean(task.attachmentLinkUrl);
  const docCount = task.documents?.length ?? 0;

  // V23 — linked otázky/úkoly for nápady (replaces výstup peek)
  const linkedTasks = task.type === "napad" && (task.linkedTaskIds?.length ?? 0) > 0
    ? (task.linkedTaskIds ?? [])
        .map((lid) => allTasks.find((x) => x.id === lid))
        .filter((x): x is Task => Boolean(x))
        .filter((x) => canViewTask({ task: x, currentUserUid: user?.uid, currentUserRole }))
    : [];

  return (
    <div
      className="rounded-md bg-surface shadow-sm ring-1 ring-line transition-colors hover:ring-line-strong focus-within:ring-2 focus-within:ring-line-focus border-l-4"
      style={{ borderLeftColor: statusColors(resolvedStatus).border }}
    >
      <Link
        to={taskDetail(task.id)}
        aria-label={`${
          task.type === "otazka"
            ? t("aria.typeOtazka")
            : task.type === "ukol"
            ? t("aria.typeUkol")
            : task.type === "dokumentace"
            ? t("aria.typeDokumentace")
            : t("aria.typeNapad")
        } · ${titleDisplay}`}
        className="block px-4 py-3 focus:outline-none"
      >
        <article>
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-1">
              <span className="sr-only">
                {task.type === "otazka"
                  ? t("aria.typeOtazka")
                  : task.type === "ukol"
                  ? t("aria.typeUkol")
                  : task.type === "dokumentace"
                  ? t("aria.typeDokumentace")
                  : t("aria.typeNapad")}
              </span>
              <TypeIcon
                aria-hidden
                size={18}
                style={{ color: TYPE_COLORS[task.type] }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium leading-snug text-ink truncate">
                {titleDisplay}
              </p>
              {task.type === "dokumentace" ? (
                <p className="mt-1 text-sm text-ink-muted">
                  {docCount === 0
                    ? t("dokumentacePage.noDocuments")
                    : docCount === 1
                    ? t("dokumentace.docsCountOne")
                    : t("dokumentace.docsCount", { n: docCount })}
                </p>
              ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(task.type === "otazka" || task.type === "ukol") && task.priority && (
                  <PriorityBadge priority={task.priority} />
                )}
                {(task.type === "otazka" || task.type === "ukol") && task.deadline && (
                  <DeadlineChip deadline={task.deadline} />
                )}
                {task.type === "ukol" && task.dependencyText && task.dependencyText.trim() && (
                  <span
                    className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted"
                    title={task.dependencyText}
                  >
                    <Flag aria-hidden size={11} />
                    <span className="truncate max-w-[9rem]">{task.dependencyText}</span>
                  </span>
                )}
                {(() => {
                  const phase = task.phaseId ? phases.find((p) => p.id === task.phaseId) : undefined;
                  return phase ? (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                      <Milestone aria-hidden size={11} />
                      {phase.label}
                    </span>
                  ) : null;
                })()}
                {location && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                    <MapPin aria-hidden size={11} />
                    {location.label}
                  </span>
                )}
                {docCount > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-pill bg-bg-subtle px-1.5 py-0.5 text-xs text-ink-subtle"
                    aria-label={`${docCount} ${docCount === 1 ? "dokument" : "dokumenty"}`}
                  >
                    <FileText aria-hidden size={12} />
                    {docCount}
                  </span>
                )}
                <span className="text-xs text-ink-subtle">
                  {formatRelative(t, created)}
                </span>
              </div>
              )}
            </div>
            {/* Right side: attachment indicators + assignee (not for dokumentace) */}
            <div className="flex shrink-0 items-center gap-1.5 mt-1">
              {task.type !== "dokumentace" && hasImage && (
                <span title={t("aria.hasImage")}><ImageIcon aria-hidden size={14} className="text-ink-subtle" /></span>
              )}
              {task.type !== "dokumentace" && hasLink && (
                <span title={t("aria.hasLink")}><LinkIcon aria-hidden size={14} className="text-ink-subtle" /></span>
              )}
              {task.type !== "dokumentace" && (hasImage || hasLink) && (
                <Paperclip aria-hidden size={14} className="text-ink-subtle" />
              )}
              {assignee && (
                <AvatarCircle
                  uid={assignee.uid}
                  displayName={assignee.displayName}
                  email={assignee.email}
                  size="sm"
                />
              )}
            </div>
          </div>
        </article>
      </Link>

      {/* V23 — expandable linked otázky/úkoly panel */}
      {linkedTasks.length > 0 && (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v); }}
            className="flex w-full items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-bg-subtle transition-colors"
            aria-expanded={expanded}
          >
            <ChevronRight
              aria-hidden
              size={11}
              className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            />
            <span>
              {linkedTasks.length === 1
                ? t("card.linkedOne")
                : t("card.linkedCount", { n: linkedTasks.length })}
            </span>
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-200"
            style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <ul className="flex flex-col gap-1 px-4 pb-2">
                {linkedTasks.map((lt) => {
                  const ltTitle = lt.title?.trim() || lt.body?.split("\n")[0]?.trim().slice(0, 60) || t("detail.noTitle");
                  const LtIcon = lt.type === "ukol" ? Target : HelpCircle;
                  const ltStatus = mapLegacyOtazkaStatus(lt.status);
                  const ltColors = statusColors(ltStatus);
                  return (
                    <li key={lt.id}>
                      <Link
                        to={taskDetail(lt.id)}
                        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-ink-muted hover:text-ink hover:bg-bg-subtle transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className="inline-block size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ltColors.dot }}
                          aria-hidden
                        />
                        <LtIcon aria-hidden size={12} style={{ color: TYPE_COLORS[lt.type] }} className="shrink-0" />
                        <span className="truncate">{ltTitle}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
