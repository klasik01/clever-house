import { useNavigate, useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Ban, CalendarCheck, CalendarPlus, CalendarX, Check, MapPin, Pencil, Trash2, X as XIcon } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useEvent } from "@/hooks/useEvent";
import { useTask } from "@/hooks/useTask";
import { subscriptionStatus } from "@/lib/subscriptionStatus";
import {
  formatEventDateLong,
  formatEventTimeRange,
  statusBadgeTokens,
} from "@/lib/eventFormatting";
import { canEditEvent } from "@/lib/permissions";
import { useRsvps } from "@/hooks/useRsvps";
import { useUsers } from "@/hooks/useUsers";
import { useBusy } from "@/components/BusyOverlay";
import { cancelEvent, confirmEventHappened, deleteEvent } from "@/lib/events";
import { buildEventIcs } from "@/lib/ics";
import { setRsvp } from "@/lib/rsvp";
import { resolveUserName } from "@/lib/names";
import AvatarCircle from "@/components/AvatarCircle";
import type { Event, Rsvp, RsvpAnswer, UserProfile } from "@/types";

/**
 * V18-S03 — Event detail (read-only).
 *
 * Layout dědí pattern z TaskDetail (back header, delete ikona, velký
 * datetime display, title, chips, body, meta).
 *
 * Akce (RSVP, edit, cancel, confirm) přijdou v S05/S07/S08/S10.
 * Teď jen čisté read-only zobrazení + delete pro autora (pro testing).
 */

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const state = useEvent(id);
  const { user } = useAuth();
  const { byUid } = useUsers(Boolean(user));
  const roleState = useUserRole(user?.uid);
  const busy = useBusy();

  // Loading / missing / error render. Detail render pod.
  if (state.status === "loading") {
    return <SkeletonDetail />;
  }
  if (state.status === "error") {
    return (
      <NotFound
        title={t("events.detail.loadFailed")}
        body={state.error.message}
        backLabel={t("events.detail.back")}
        onBack={() => navigate(-1)}
      />
    );
  }
  if (state.status === "missing") {
    return (
      <NotFound
        title={t("events.detail.notFoundTitle")}
        body={t("events.detail.notFoundBody")}
        backLabel={t("events.detail.back")}
        onBack={() => navigate("/events")}
      />
    );
  }

  const event = state.event;
  const isAuthor = event.createdBy === user?.uid;
  const isInvitee = Boolean(user && event.inviteeUids.includes(user.uid));
  const canEdit = canEditEvent({
    event,
    currentUserUid: user?.uid,
    currentUserRole:
      roleState.status === "ready" ? roleState.profile.role : null,
  });

  async function handleDelete() {
    if (!window.confirm(t("events.detail.deleteConfirm"))) return;
    try {
      await busy.run(async () => {
        await deleteEvent(event.id);
        navigate("/events");
      }, t("busy.deleting"));
    } catch (e) {
      console.error("deleteEvent failed", e);
      window.alert(t("events.detail.deleteFailed"));
    }
  }

  async function handleCancel() {
    if (!window.confirm(t("events.detail.cancelConfirm"))) return;
    try {
      await busy.run(
        () => cancelEvent(event.id),
        t("busy.cancelling"),
      );
    } catch (e) {
      console.error("cancelEvent failed", e);
      window.alert(t("events.detail.cancelFailed"));
    }
  }

  async function handleConfirmHappened() {
    try {
      await busy.run(
        () => confirmEventHappened(event.id),
        t("busy.saving"),
      );
    } catch (e) {
      console.error("confirmEventHappened failed", e);
      window.alert(t("events.detail.retroFailed"));
    }
  }

  async function handleRetroCancel() {
    if (!window.confirm(t("events.detail.retroCancelConfirm"))) return;
    try {
      await busy.run(
        () => cancelEvent(event.id),
        t("busy.cancelling"),
      );
    } catch (e) {
      console.error("retro cancel failed", e);
      window.alert(t("events.detail.retroFailed"));
    }
  }

  return (
    <article
      className="mx-auto max-w-xl px-4 py-4"
      aria-labelledby="event-detail-heading"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("events.detail.back")}
          className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
        >
          <ArrowLeft aria-hidden size={20} />
        </button>
        <StatusBadge status={event.status} />
        <div className="-mr-2 flex items-center">
          {canEdit && event.status !== "CANCELLED" && (
            <Link
              to={`/event/${event.id}/edit`}
              aria-label={t("events.detail.edit")}
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:text-ink hover:bg-bg-subtle"
            >
              <Pencil aria-hidden size={18} />
            </Link>
          )}
          {canEdit && event.status !== "CANCELLED" && (
            <button
              type="button"
              onClick={handleCancel}
              aria-label={t("events.detail.cancel")}
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle"
            >
              <Ban aria-hidden size={18} />
            </button>
          )}
          {isAuthor && (
            <button
              type="button"
              onClick={handleDelete}
              aria-label={t("events.detail.delete")}
              className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:text-[color:var(--color-status-danger-fg)] hover:bg-bg-subtle"
            >
              <Trash2 aria-hidden size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Big datetime display */}
      <DateTimeDisplay event={event} />

      {/* Title */}
      <h1
        id="event-detail-heading"
        className={`mt-3 text-xl font-bold leading-tight ${
          event.status === "CANCELLED" ? "line-through text-ink-subtle" : "text-ink"
        }`}
      >
        {event.title}
      </h1>

      {/* Address */}
      {event.address && (
        <p className="mt-2 flex items-start gap-2 text-sm text-ink-muted">
          <MapPin aria-hidden size={16} className="mt-0.5 shrink-0 text-ink-subtle" />
          <span>{event.address}</span>
        </p>
      )}

      {/* Invitees section */}
      <InviteesSectionWithRsvp event={event} byUid={byUid} />

      {/* V18-S10 — Retro confirm (author + AWAITING_CONFIRMATION) */}
      {isAuthor && event.status === "AWAITING_CONFIRMATION" && (
        <section className="mt-6" aria-labelledby="event-retro-heading">
          <h2
            id="event-retro-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("events.detail.retroTitle")}
          </h2>
          <p className="mb-3 text-sm text-ink-muted">
            {t("events.detail.retroHint")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirmHappened}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: "var(--color-status-success-bg)",
                color: "var(--color-status-success-fg)",
              }}
            >
              <CalendarCheck aria-hidden size={16} />
              {t("events.detail.retroHappened")}
            </button>
            <button
              type="button"
              onClick={handleRetroCancel}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ring-1 ring-line bg-surface text-ink-muted hover:bg-bg-subtle transition-colors"
            >
              <CalendarX aria-hidden size={16} />
              {t("events.detail.retroCancelled")}
            </button>
          </div>
        </section>
      )}

      {/* RSVP actions (invitee + UPCOMING) */}
      {isInvitee && event.status === "UPCOMING" && (
        <RsvpActions event={event} />
      )}

      {/* Description */}
      {event.description && (
        <section className="mt-6" aria-labelledby="event-desc-heading">
          <h2
            id="event-desc-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("events.detail.descriptionTitle")}
          </h2>
          <p className="whitespace-pre-wrap break-words text-sm text-ink">
            {event.description}
          </p>
        </section>
      )}

      {/* Linked task — V18-S15 chip s title */}
      {event.linkedTaskId && (
        <section className="mt-6">
          <LinkedTaskChip taskId={event.linkedTaskId} />
        </section>
      )}

      {/* V18-S25 — Přidat do kalendáře: heuristic detection.
          Pokud user má aktivní webcal subscription (CF zaznamenala fetch
          ≤25h zpátky), event už je v jeho kalendáři automaticky → jen
          drobný hint. Jinak nabídneme manuální ICS download. */}
      <AddToCalendarSection event={event} byUid={byUid} subscriptionInfo={
        subscriptionStatus(
          roleState.status === "ready"
            ? roleState.profile.calendarLastFetchedAt
            : undefined,
        )
      } />

      {/* Meta footer */}
      <MetaFooter event={event} byUid={byUid} />
    </article>
  );
}

// ---------- Sub-components ----------

/**
 * V18-S15 — chip s title linked tasku. Subscribuje se na task přes
 * useTask; dokud se načítá, zobrazí label "Propojeno s úkolem" bez
 * titulu. Klik naviguje na /t/:id přes react-router Link.
 */
function LinkedTaskChip({ taskId }: { taskId: string }) {
  const t = useT();
  const state = useTask(taskId);
  const title =
    state.status === "ready" && state.task
      ? (state.task.title || "").trim() ||
        (state.task.body || "").split("\n")[0].slice(0, 60) ||
        `#${taskId.slice(0, 6)}`
      : t("events.detail.linkedTaskLoading");
  return (
    <Link
      to={`/t/${taskId}`}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle transition-colors"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-subtle shrink-0">
        {t("events.detail.linkedTaskLabel")}
      </span>
      <span className="truncate">{title}</span>
      <span aria-hidden className="shrink-0 text-ink-subtle">→</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: Event["status"] }) {
  const t = useT();
  // V18-S35 — token mapping extrakcí do lib/eventFormatting.
  // UPCOMING vrátí null → render prázdný spacer (zachová layout v top baru).
  const tokens = statusBadgeTokens(status);
  if (!tokens) return <span className="w-10" aria-hidden />;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium"
      style={{ color: tokens.color, background: tokens.background }}
    >
      {t(tokens.i18nKey)}
    </span>
  );
}

function DateTimeDisplay({ event }: { event: Event }) {
  const t = useT();
  // V18-S35 — formátování delegováno do lib/eventFormatting.
  // Helpery defenzivně handlují invalid ISO (vrátí prázdný string).
  const dateStr = formatEventDateLong(event);
  if (!dateStr) return null;
  const timeStr = formatEventTimeRange(event, t("events.detail.allDayLabel"));

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent-visual">
        {dateStr}
      </p>
      <p className="mt-1 text-2xl font-bold text-ink">{timeStr}</p>
    </div>
  );
}

function InviteesSectionWithRsvp({
  event,
  byUid,
}: {
  event: Event;
  byUid: Map<string, UserProfile>;
}) {
  const { byUid: rsvpByUid } = useRsvps(event.id);
  return (
    <InviteesList event={event} byUid={byUid} rsvpByUid={rsvpByUid} />
  );
}

function InviteesList({
  event,
  byUid,
  rsvpByUid,
}: {
  event: Event;
  byUid: Map<string, UserProfile>;
  rsvpByUid: Map<string, Rsvp>;
}) {
  const t = useT();
  // V18-S36 — sjednocené UI: autor je vždy první v listu, pak invitees
  // (deduped pokud autor sám sebe pozval). Autor má badge "Autor"
  // místo RSVP indikátoru — implicitně potvrzeno, není potřeba RSVPnout.
  const seenUids = new Set<string>();
  const orderedUids: string[] = [];
  if (event.createdBy) {
    orderedUids.push(event.createdBy);
    seenUids.add(event.createdBy);
  }
  for (const uid of event.inviteeUids) {
    if (seenUids.has(uid)) continue;
    orderedUids.push(uid);
    seenUids.add(uid);
  }

  // Yes count — autor counts implicitně (jeho akce = vytvoření = potvrzení),
  // plus kdokoliv s rsvp "yes". Total = unique participants.
  const total = orderedUids.length;
  const yesCount = orderedUids.reduce((acc, uid) => {
    if (uid === event.createdBy) return acc + 1;
    return rsvpByUid.get(uid)?.response === "yes" ? acc + 1 : acc;
  }, 0);

  return (
    <section className="mt-6" aria-labelledby="event-invitees-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="event-invitees-heading"
          className="text-xs font-semibold uppercase tracking-wide text-ink-subtle"
        >
          {t("events.detail.inviteesTitle")}
        </h2>
        <span className="text-xs text-ink-subtle">
          {t("events.detail.inviteesCount", { yes: yesCount, total })}
        </span>
      </div>
      <ul className="flex flex-col rounded-md ring-1 ring-line bg-surface divide-y divide-line">
        {orderedUids.map((uid) => {
          const profile = byUid.get(uid);
          const name = resolveUserName({
            profileDisplayName: profile?.displayName,
            email: profile?.email,
            uid,
          });
          const rsvp = rsvpByUid.get(uid);
          const isAuthor = uid === event.createdBy;
          return (
            <li
              key={uid}
              className="flex items-center gap-3 px-3 py-2 text-sm text-ink"
            >
              <AvatarCircle
                uid={uid}
                displayName={profile?.displayName ?? null}
                email={profile?.email ?? null}
                size="sm"
              />
              <span className="flex-1 truncate">{name}</span>
              {isAuthor ? (
                <span
                  className="rounded-pill bg-bg-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle"
                  aria-label={t("events.detail.authorBadge")}
                >
                  {t("events.detail.authorBadge")}
                </span>
              ) : (
                <RsvpIndicator response={rsvp?.response} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Barevný indikátor RSVP response. Zelená ✓ "yes", červená ✗ "no",
 * šedá "?" pending.
 */
function RsvpIndicator({ response }: { response?: RsvpAnswer | null }) {
  const t = useT();
  if (response === "yes") {
    return (
      <span
        aria-label={t("events.detail.rsvpYesShort")}
        title={t("events.detail.rsvpYesShort")}
        className="grid size-6 place-items-center rounded-full"
        style={{
          background: "var(--color-status-success-bg)",
          color: "var(--color-status-success-fg)",
        }}
      >
        <Check aria-hidden size={14} />
      </span>
    );
  }
  if (response === "no") {
    return (
      <span
        aria-label={t("events.detail.rsvpNoShort")}
        title={t("events.detail.rsvpNoShort")}
        className="grid size-6 place-items-center rounded-full"
        style={{
          background: "var(--color-priority-p1-bg)",
          color: "var(--color-status-danger-fg)",
        }}
      >
        <XIcon aria-hidden size={14} />
      </span>
    );
  }
  return (
    <span
      aria-label={t("events.detail.rsvpPending")}
      title={t("events.detail.rsvpPending")}
      className="grid size-6 place-items-center rounded-full bg-bg-subtle text-ink-subtle text-xs"
    >
      ?
    </span>
  );
}

/**
 * RSVP akční tlačítka pro pozvaného. Optimistic save (Firestore
 * subscription invalidne + obnoví). Při chybě se uloží v catch a
 * propíše do submitError inline.
 */
function RsvpActions({ event }: { event: Event }) {
  const t = useT();
  const { user } = useAuth();
  const { byUid } = useRsvps(event.id);
  const [pending, setPending] = useState<RsvpAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useBusy();

  const myRsvp = user ? byUid.get(user.uid) : undefined;

  async function handleResponse(response: RsvpAnswer) {
    if (!user || pending) return;
    setPending(response);
    setError(null);
    try {
      await busy.run(
        () => setRsvp(event.id, user.uid, response),
        t("busy.saving"),
      );
    } catch (e) {
      console.error("setRsvp failed", e);
      setError(t("events.composer.saveFailed"));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="mt-6" aria-labelledby="event-rsvp-heading">
      <h2
        id="event-rsvp-heading"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
      >
        {t("events.detail.rsvpTitle")}
      </h2>
      <p className="mb-2 text-xs text-ink-subtle">
        {t("events.detail.rsvpHint")}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleResponse("yes")}
          disabled={pending !== null}
          aria-pressed={myRsvp?.response === "yes"}
          className={`inline-flex flex-1 min-h-tap items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            myRsvp?.response === "yes"
              ? "bg-accent text-accent-on hover:bg-accent-hover"
              : "border border-line bg-surface text-ink hover:bg-bg-subtle"
          }`}
        >
          <Check aria-hidden size={16} />
          {pending === "yes"
            ? t("events.detail.rsvpUpdating")
            : t("events.detail.rsvpYes")}
        </button>
        <button
          type="button"
          onClick={() => handleResponse("no")}
          disabled={pending !== null}
          aria-pressed={myRsvp?.response === "no"}
          className={`inline-flex flex-1 min-h-tap items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            myRsvp?.response === "no"
              ? "bg-[color:var(--color-status-danger-fg)] text-white"
              : "border border-line bg-surface text-ink hover:bg-bg-subtle"
          }`}
        >
          <XIcon aria-hidden size={16} />
          {pending === "no"
            ? t("events.detail.rsvpUpdating")
            : t("events.detail.rsvpNo")}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-[color:var(--color-status-danger-fg)]">
          {error}
        </p>
      )}
    </section>
  );
}

function MetaFooter({
  event,
  byUid,
}: {
  event: Event;
  byUid: Map<string, UserProfile>;
}) {
  const t = useT();
  const creatorProfile = byUid.get(event.createdBy);
  const creatorName = resolveUserName({
    profileDisplayName: creatorProfile?.displayName,
    email: creatorProfile?.email,
    uid: event.createdBy,
  });
  const created = new Date(event.createdAt);
  const relTime = !Number.isNaN(created.getTime())
    ? formatRelative(t, created)
    : "—";
  return (
    <section className="mt-8 border-t border-line pt-4 text-sm text-ink-muted">
      <p>
        {t("events.detail.metaCreatedBy", { name: creatorName })}{" "}
        <span className="text-ink-subtle">· {relTime}</span>
      </p>
    </section>
  );
}

/**
 * V18-S25 — wrapper kolem AddToCalendarButton. Heuristicky detekuje
 * jestli má user aktivní webcal subscription a podle toho rozhoduje:
 *   - active → jen text "Tato událost je v tvém kalendáři" + collapse
 *     pro fallback download (kdyby user chtěl manuálně)
 *   - stale/unknown → původní viditelný [Přidat do kalendáře] button
 *     (s odkazem na Settings pro automatické připojení)
 */
function AddToCalendarSection({
  event,
  byUid,
  subscriptionInfo,
}: {
  event: Event;
  byUid: Map<string, UserProfile>;
  subscriptionInfo: ReturnType<typeof subscriptionStatus>;
}) {
  const t = useT();
  const [showManual, setShowManual] = useState(false);

  if (subscriptionInfo.status === "active") {
    const mins = subscriptionInfo.staleMinutes ?? 0;
    const syncLabel =
      mins < 60
        ? t("events.detail.syncedMinutesAgo", { n: mins })
        : t("events.detail.syncedHoursAgo", {
            n: Math.floor(mins / 60),
          });
    return (
      <section className="mt-6">
        <div className="flex items-start gap-2 rounded-md bg-surface ring-1 ring-line px-3 py-2 text-sm">
          <CalendarPlus
            aria-hidden
            size={16}
            className="mt-0.5 shrink-0 text-[color:var(--color-status-success-fg)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-ink">{t("events.detail.alreadyInCalendar")}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">{syncLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          aria-expanded={showManual}
          className="mt-2 text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
        >
          {showManual
            ? t("events.detail.manualHide")
            : t("events.detail.manualShow")}
        </button>
        {showManual && (
          <div className="mt-2">
            <AddToCalendarButton event={event} byUid={byUid} />
          </div>
        )}
      </section>
    );
  }

  // unknown / stale → původní visible button + tip na automatické připojení
  return (
    <section className="mt-6 flex flex-col gap-2">
      <AddToCalendarButton event={event} byUid={byUid} />
      <p className="text-xs text-ink-subtle">
        {t("events.detail.connectHint")}{" "}
        <Link
          to="/nastaveni#kalendar"
          className="underline underline-offset-2 hover:text-ink"
        >
          {t("events.detail.connectCta")}
        </Link>
      </p>
    </section>
  );
}

/**
 * V18-S06 — "Přidat do kalendáře" button.
 *
 * Klik → generuje ICS blob → <a download> trigger. Na iOS Safari PWA
 * standalone mode může <a download> nefungovat; fallback pattern:
 *   - Vytvoříme anchor přímo v handleru a kliknem na něj (imperativní
 *     programmatic click). To Safari stále dovoluje.
 *   - Alternativně bychom mohli otevřít data:text/calendar;... URL
 *     přes window.location, ale to iOS často odmítá (security).
 *   - Pokud by failnul, zobrazí se error toast; user si to může
 *     stáhnout později v normální Safari tabu.
 */
function AddToCalendarButton({
  event,
  byUid,
}: {
  event: Event;
  byUid: Map<string, UserProfile>;
}) {
  const t = useT();
  const [error, setError] = useState(false);

  function handleClick() {
    try {
      const ics = buildEventIcs({
        event,
        inviteeUsers: byUid,
        creator: byUid.get(event.createdBy),
      });
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const safeName = (event.title || t("events.detail.addToCalendarFilename"))
        .replace(/[^\w\- .]/g, "_")
        .slice(0, 40);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke po chvíli — iOS chvíli potřebuje držet URL pro prompt.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setError(false);
    } catch (e) {
      console.error("buildEventIcs failed", e);
      setError(true);
    }
  }

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex min-h-tap items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle transition-colors"
      >
        <CalendarPlus aria-hidden size={16} />
        {t("events.detail.addToCalendarCta")}
      </button>
      {error && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-line bg-bg-subtle px-3 py-2 text-xs text-ink-muted"
        >
          <p className="font-medium text-ink">
            {t("events.detail.addToCalendarFallbackTitle")}
          </p>
          <p className="mt-0.5">
            {t("events.detail.addToCalendarFallbackBody")}
          </p>
        </div>
      )}
    </section>
  );
}

function SkeletonDetail() {
  return (
    <section className="mx-auto max-w-xl px-4 py-4" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="size-10 rounded-md bg-surface ring-1 ring-line animate-pulse" />
        <div className="h-6 w-20 rounded-pill bg-surface ring-1 ring-line animate-pulse" />
        <div className="size-10" />
      </div>
      <div className="mt-6 h-4 w-40 rounded bg-surface ring-1 ring-line animate-pulse" />
      <div className="mt-3 h-10 w-48 rounded bg-surface ring-1 ring-line animate-pulse" />
      <div className="mt-4 h-8 rounded-md bg-surface ring-1 ring-line animate-pulse" />
      <div className="mt-6 h-32 rounded-md bg-surface ring-1 ring-line animate-pulse" />
    </section>
  );
}

function NotFound({
  title,
  body,
  backLabel,
  onBack,
}: {
  title: string;
  body: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12 text-center" role="alert">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover"
      >
        {backLabel}
      </button>
    </section>
  );
}
