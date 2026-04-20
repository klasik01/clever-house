import { Link } from "react-router-dom";
import { HelpCircle, Image as ImageIcon, Link as LinkIcon, MapPin, Notebook, Paperclip, Tag } from "lucide-react";
import type { Category, Task } from "@/types";
import { useT, formatRelative } from "@/i18n/useT";
import StatusBadge from "./StatusBadge";
import { getLocation } from "@/lib/locations";

interface Props {
  task: Task;
  categories?: Category[];
}

export default function NapadCard({ task, categories }: Props) {
  const t = useT();
  const created = new Date(task.createdAt);
  const TypeIcon = task.type === "otazka" ? HelpCircle : Notebook;
  const category = task.categoryId
    ? categories?.find((c) => c.id === task.categoryId)
    : undefined;
  const location = getLocation(task.locationId);

  // Title prominent; fallback to body first line, then placeholder
  const titleDisplay =
    task.title?.trim() ||
    task.body?.split("\n")[0]?.trim().slice(0, 80) ||
    t("detail.noTitle");

  const hasImage = Boolean(task.attachmentImageUrl);
  const hasLink = Boolean(task.attachmentLinkUrl);

  return (
    <Link
      to={`/t/${task.id}`}
      aria-label={`${task.type === "otazka" ? t("aria.typeOtazka") : t("aria.typeNapad")} · ${titleDisplay}`}
      className="block rounded-md bg-surface px-4 py-3 shadow-sm ring-1 ring-line transition-colors hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <article>
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-1">
            <span className="sr-only">
              {task.type === "otazka" ? t("aria.typeOtazka") : t("aria.typeNapad")}
            </span>
            <TypeIcon
              aria-hidden
              size={18}
              className={
                task.type === "otazka"
                  ? "text-accent-visual"
                  : "text-ink-subtle"
              }
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium leading-snug text-ink truncate">
              {titleDisplay}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              {category && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                  <Tag aria-hidden size={11} />
                  {category.label}
                </span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted">
                  <MapPin aria-hidden size={11} />
                  {location.label}
                </span>
              )}
              {/* Binary attachment indicators — presence only, no count */}
              {hasImage && (
                <span
                  className="inline-flex items-center rounded-pill bg-bg-subtle px-1.5 py-0.5 text-ink-subtle"
                  aria-label={t("aria.hasImage")}
                  title={t("aria.hasImage")}
                >
                  <ImageIcon aria-hidden size={12} />
                </span>
              )}
              {hasLink && (
                <span
                  className="inline-flex items-center rounded-pill bg-bg-subtle px-1.5 py-0.5 text-ink-subtle"
                  aria-label={t("aria.hasLink")}
                  title={t("aria.hasLink")}
                >
                  <LinkIcon aria-hidden size={12} />
                </span>
              )}
              <span className="text-xs text-ink-subtle">
                {formatRelative(t, created)}
              </span>
            </div>
          </div>
          {/* Attachments hint via paperclip when one or both present */}
          {(hasImage || hasLink) && (
            <Paperclip aria-hidden size={14} className="mt-1 shrink-0 text-ink-subtle" />
          )}
        </div>
      </article>
    </Link>
  );
}
