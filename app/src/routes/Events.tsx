import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";
import { subscribeEvents } from "@/lib/events";
import type { Event } from "@/types";

/**
 * V18-S01 — Events list route.
 *
 * Chronologický list events kde jsem creator nebo invitee. V S01 jen
 * list + empty state; filter upcoming/past a RSVP status badges přijdou
 * v S05+.
 *
 * Server-side rules povolují read všem signedIn; filtr "kde jsem
 * zapojený" je klientský. Pro pár events per user je to OK.
 */

type Filter = "upcoming" | "past";

export default function Events() {
  const t = useT();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // S01 — filter je teď jen placeholder; efektivně všechny events.
  // V Phase 2 přidáme aktivní toggle.
  const [filter] = useState<Filter>("upcoming");

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeEvents(
      (list) => {
        setEvents(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  const visible = useMemo(() => {
    if (!user) return [];
    return events
      .filter((e) => e.inviteeUids.includes(user.uid) || e.createdBy === user.uid)
      .filter((e) => {
        // V18-S09 — AWAITING_CONFIRMATION patří mezi upcoming (vyžaduje
        // akci). HAPPENED a CANCELLED jsou finální → past. UPCOMING
        // s prošlým endAt je přechodný stav (scheduled CF ho do hodiny
        // flipne), necháme v upcoming listu.
        const isPast = e.status === "HAPPENED" || e.status === "CANCELLED";
        return filter === "past" ? isPast : !isPast;
      });
  }, [events, user, filter]);

  const upcomingCount = useMemo(() => {
    if (!user) return 0;
    const now = Date.now();
    return events.filter(
      (e) =>
        (e.inviteeUids.includes(user.uid) || e.createdBy === user.uid) &&
        e.status === "UPCOMING" &&
        Date.parse(e.endAt) >= now,
    ).length;
  }, [events, user]);

  // V18-S09 — autor vidí banner "N událostí čeká na potvrzení" nahoře
  // v listu. Jen pro events kde JÁ jsem autor (potvrzení dělá autor,
  // pozvaný to už zaživa potvrdil/odmítl přes RSVP). Cross-OWNER edit
  // platí i pro S10 retro confirm — proto bereme i eventy co jsem
  // mohl upravit (authorRole=OWNER + já jsem OWNER), ne jen přesně mé.
  const awaitingMineCount = useMemo(() => {
    if (!user) return 0;
    return events.filter(
      (e) =>
        e.status === "AWAITING_CONFIRMATION" &&
        e.createdBy === user.uid,
    ).length;
  }, [events, user]);

  return (
    <section aria-label={t("events.title")} className="mx-auto max-w-xl px-4 py-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("events.title")}</h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {t("events.subtitle", { n: upcomingCount })}
          </p>
        </div>
      </header>

      {awaitingMineCount > 0 && (
        <div
          role="note"
          className="mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm"
          style={{
            background: "var(--color-priority-p1-bg)",
            color: "var(--color-status-danger-fg)",
          }}
        >
          <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0" />
          <p>
            {t("events.awaitingBanner", { n: awaitingMineCount })}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm text-[color:var(--color-status-danger-fg)]">
          {t("events.loadFailed")}
        </p>
      )}

      {loading && <EventListSkeleton />}

      {!loading && !error && visible.length === 0 && <EventEmpty />}

      {!loading && !error && visible.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visible.map((ev) => (
            <li key={ev.id}>
              <EventCard event={ev} />
            </li>
          ))}
        </ul>
      )}

      {/* FAB — composer route /events/new přijde v S02. Zatím je button
          disabled placeholder, aby byl vidět ale neblokoval. */}
      <div className="pointer-events-none fixed bottom-20 right-0 left-0 z-10 mx-auto max-w-xl px-4">
        <div className="flex justify-end">
          <Link
            to="/events/new"
            aria-label={t("events.addCta")}
            className="pointer-events-auto inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-on shadow-lg hover:bg-accent-hover transition-colors"
          >
            <Plus aria-hidden size={24} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function EventCard({ event }: { event: Event }) {
  const t = useT();
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const dateLabel = Number.isNaN(start.getTime())
    ? "—"
    : start.toLocaleDateString("cs-CZ", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
      });
  const timeLabel = event.isAllDay
    ? "celý den"
    : `${start.toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
      })}–${end.toLocaleTimeString("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

  // Status badge — jen pokud ne-UPCOMING (neutrální default je čistší).
  const statusKey: Record<string, string> = {
    AWAITING_CONFIRMATION: t("events.status.awaiting"),
    HAPPENED: t("events.status.happened"),
    CANCELLED: t("events.status.cancelled"),
  };
  const statusLabel = statusKey[event.status];

  return (
    <Link
      to={`/event/${event.id}`}
      className="flex items-start gap-3 rounded-md bg-surface ring-1 ring-line px-3 py-3 hover:bg-bg-subtle transition-colors"
    >
      <div className="w-20 shrink-0 text-xs">
        <p className="flex items-center gap-1.5 font-semibold uppercase text-ink-subtle">
          {event.status === "AWAITING_CONFIRMATION" && (
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-full"
              style={{ background: "var(--color-status-danger-fg)" }}
            />
          )}
          <span>{dateLabel}</span>
        </p>
        <p className="mt-0.5 text-ink-muted">{timeLabel}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium truncate ${
            event.status === "CANCELLED" ? "line-through text-ink-subtle" : "text-ink"
          }`}
        >
          {event.title || "—"}
        </p>
        {event.address && (
          <p className="mt-0.5 text-xs text-ink-subtle truncate">{event.address}</p>
        )}
        {statusLabel && (
          <p
            className="mt-1 inline-flex items-center gap-1 text-xs"
            style={{
              color:
                event.status === "AWAITING_CONFIRMATION"
                  ? "var(--color-status-danger-fg)"
                  : event.status === "HAPPENED"
                  ? "var(--color-status-success-fg)"
                  : "var(--color-ink-subtle)",
            }}
          >
            {statusLabel}
          </p>
        )}
      </div>
    </Link>
  );
}

function EventEmpty() {
  const t = useT();
  return (
    <div className="mt-12 text-center">
      <p className="text-sm font-medium text-ink">{t("events.emptyTitle")}</p>
      <p className="mt-1 text-xs text-ink-subtle">{t("events.emptyBody")}</p>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-16 rounded-md bg-surface ring-1 ring-line animate-pulse"
        />
      ))}
    </ul>
  );
}
