import { Link } from "react-router-dom";
import { HelpCircle, Link as LinkIcon, MapPin, Notebook, Tag } from "lucide-react";
import type { Category, Task } from "@/types";
import { useT, formatRelative } from "@/i18n/useT";
import StatusBadge from "./StatusBadge";
import { getLocation } from "@/lib/locations";
import { parseDomain } from "@/lib/links";

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
  const linkDomain = task.attachmentLinkUrl ? parseDomain(task.attachmentLinkUrl) : null;

  return (
    <Link
      to={`/t/${task.id}`}
      aria-label={`${task.type === "otazka" ? t("aria.typeOtazka") : t("aria.typeNapad")} · ${task.body.slice(0, 80) || task.title || ""}`}
      className="block rounded-md bg-surface px-4 py-3 shadow-sm ring-1 ring-line transition-colors hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <article>
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5">
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
            <p className="text-base leading-snug text-ink whitespace-pre-wrap break-words">
              {task.body || task.title || t("detail.titlePlaceholder")}
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
              {linkDomain && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-bg-subtle px-2 py-0.5 text-xs text-ink-muted truncate max-w-[10rem]">
                  <LinkIcon aria-hidden size={11} />
                  {linkDomain}
                </span>
              )}
              <span className="text-xs text-ink-subtle">
                {formatRelative(t, created)}
              </span>
            </div>
          </div>
          {task.attachmentImageUrl && (
            <img
              src={task.attachmentImageUrl}
              alt=""
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-line"
            />
          )}
        </div>
      </article>
    </Link>
  );
}
