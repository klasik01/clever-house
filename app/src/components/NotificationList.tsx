import { Link } from "react-router-dom";
import { AtSign, Ban, Bell, BellOff, BellRing, Calendar, CalendarX, Check, Flag, Link as LinkIcon, MessageCircle, MessagesSquare, Pencil, Share2, Trash2, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { markAllRead, markRead } from "@/lib/inbox";
import type { NotificationEventKey, NotificationItem } from "@/types";

interface Props {
  uid: string;
  items: NotificationItem[];
  loading: boolean;
  error: Error | null;
  /** Called after user clicks an item — parent can close the dropdown. */
  onItemClick?: () => void;
}

const EVENT_ICON: Record<NotificationEventKey, LucideIcon> = {
  mention: AtSign,
  assigned: UserPlus,
  comment_on_mine: MessageCircle,
  comment_on_thread: MessagesSquare,
  shared_with_pm: Share2,
  priority_changed: Flag,
  deadline_changed: Calendar,
  task_deleted: Trash2,
  assigned_with_comment: UserPlus,
  event_invitation: Calendar,
  event_rsvp_response: Check,
  event_update: Pencil,
  event_uninvited: CalendarX,
  event_cancelled: Ban,
  event_calendar_token_reset: LinkIcon,
  event_rsvp_reminder: BellRing,
};

/**
 * V15.1 — list of inbox items rendered inside the NotificationBell dropdown.
 * Kept as a dedicated component so its height / overflow scroll can be
 * controlled at parent level (dropdown vs future full-page view).
 */
export default function NotificationList({
  uid,
  items,
  loading,
  error,
  onItemClick,
}: Props) {
  const t = useT();
  // Show ONLY unread — the list is "your inbox", not a history log. When
  // user clicks an item we mark it read → Firestore snapshot → item drops
  // out of this filtered array → it animates/vanishes from the dropdown.
  // Old read items still exist in Firestore (for debugging + audit), just
  // aren't rendered.
  const unread = items.filter((it) => !it.readAt);

  async function handleClickItem(it: NotificationItem) {
    if (!it.readAt) {
      // Fire-and-forget — visual state updates via Firestore snapshot.
      void markRead(uid, it.id);
    }
    onItemClick?.();
  }

  async function handleMarkAll() {
    await markAllRead(uid, items);
  }

  return (
    <div className="flex max-h-[70vh] min-w-[20rem] flex-col overflow-hidden rounded-md bg-surface shadow-lg ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <p className="text-sm font-semibold text-ink">{t("inbox.title")}</p>
        {unread.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            className="text-xs text-accent hover:underline"
          >
            {t("inbox.markAllRead")}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-3 py-6 text-center text-sm text-ink-subtle">
            …
          </div>
        )}
        {!loading && error && (
          <div
            role="alert"
            className="px-3 py-6 text-center text-sm"
            style={{ color: "var(--color-status-danger-fg)" }}
          >
            {t("inbox.loadFailed")}
          </div>
        )}
        {!loading && !error && unread.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
            <BellOff aria-hidden size={24} className="text-ink-subtle" />
            <p className="text-sm text-ink-subtle">{t("inbox.empty")}</p>
          </div>
        )}
        {!loading && !error && unread.length > 0 && (
          <ul className="divide-y divide-line">
            {unread.map((it) => (
              <li key={it.id}>
                <NotificationRow
                  item={it}
                  onClick={() => handleClickItem(it)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onClick,
}: {
  item: NotificationItem;
  onClick: () => void;
}) {
  const t = useT();
  const Icon = EVENT_ICON[item.eventType] ?? Bell;
  const isUnread = !item.readAt;
  const created = new Date(item.createdAt);
  // V18-S26 — preferuj pre-rendered deepLink z katalogu. Fallback path:
  //   1. event-scope event types (`event_*`) → /event/{eventId} pokud je
  //      eventId přítomný — i kdyby item měl i taskId (linkedTaskId
  //      reference), prioritou je vždy event detail.
  //   2. comment-scope → /t/{taskId}#comment-{commentId}
  //   3. task-scope → /t/{taskId}
  //   4. event-scope bez deepLink → /event/{eventId}
  //   5. nic → /
  const isEventScope = item.eventType.startsWith("event_");
  const url =
    item.deepLink ??
    (isEventScope && item.eventId
      ? `/event/${item.eventId}`
      : item.commentId
        ? `/t/${item.taskId ?? ""}#comment-${item.commentId}`
        : item.taskId
          ? `/t/${item.taskId}`
          : item.eventId
            ? `/event/${item.eventId}`
            : "/");

  return (
    <Link
      to={url}
      onClick={onClick}
      className={`flex gap-3 px-3 py-3 transition-colors hover:bg-bg-subtle ${
        isUnread ? "bg-bg-subtle/60" : ""
      }`}
    >
      <span className="relative mt-0.5 shrink-0">
        <span className="grid size-8 place-items-center rounded-full bg-accent/10 text-accent-visual">
          <Icon aria-hidden size={16} />
        </span>
        {isUnread && (
          <span
            aria-label={t("inbox.ariaUnread")}
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-surface"
            style={{ background: "var(--color-status-danger-fg)" }}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-ink" : "text-ink"}`}>
          {item.title}
        </p>
        {item.body && (
          <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">
            {item.body}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-subtle">
          {formatRelative(t, created)}
        </p>
      </div>
    </Link>
  );
}
