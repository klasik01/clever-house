import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";
import { useUserRole } from "@/hooks/useUserRole";
import { useUsers } from "@/hooks/useUsers";
import { useEvent } from "@/hooks/useEvent";
import { useTasks } from "@/hooks/useTasks";
import { createEvent, updateEvent } from "@/lib/events";
import { canEditEvent } from "@/lib/permissions";
import { useBusy } from "@/components/BusyOverlay";
import { resolveUserName } from "@/lib/names";
import {
  isoToLocalInput,
  localInputToIso,
  roundToNextHalfHour,
  toLocalInput,
} from "@/lib/eventDateInput";

/**
 * V18-S02 — Event composer `/events/new`.
 *
 * Formulář pro vytvoření eventu. Draft se drží v localStorage, restore
 * při refreshi. Validace klientská (title non-empty, endAt > startAt,
 * min. 1 invitee). Rules server-side vynutí totéž.
 *
 * S02 záměrně vynechává:
 *   - linkedTaskId picker (S16 přidá autocomplete z tasks)
 *   - notifikace invitees (S04 přidá CF trigger onEventCreate)
 *   - detail redirect po save — S03 přidá /event/:id; zatím redirect /events
 */

import { LOCAL_STORAGE } from "@/lib/storageKeys";
import { ROUTES, eventDetail } from "@/lib/routes";

const DRAFT_KEY = LOCAL_STORAGE.eventDraft;
const HOUR_MS = 60 * 60 * 1000;

interface DraftState {
  title: string;
  startAt: string;       // `YYYY-MM-DDTHH:MM` (datetime-local format)
  endAt: string;
  isAllDay: boolean;
  address: string;
  description: string;
  inviteeUids: string[];
  /** V18-S15 — volitelné propojení s existujícím úkolem. null = žádný link. */
  linkedTaskId: string | null;
}

function emptyDraft(now: Date): DraftState {
  const start = roundToNextHalfHour(now);
  const end = new Date(start.getTime() + HOUR_MS);
  return {
    title: "",
    startAt: toLocalInput(start),
    endAt: toLocalInput(end),
    isAllDay: false,
    address: "",
    description: "",
    inviteeUids: [],
    linkedTaskId: null,
  };
}

// Date helpers extrahované do `@/lib/eventDateInput` (V18-S33).
// Importováno na vrcholu souboru.

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      startAt: typeof parsed.startAt === "string" ? parsed.startAt : "",
      endAt: typeof parsed.endAt === "string" ? parsed.endAt : "",
      isAllDay: parsed.isAllDay === true,
      address: typeof parsed.address === "string" ? parsed.address : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      inviteeUids: Array.isArray(parsed.inviteeUids)
        ? parsed.inviteeUids.filter((u: unknown): u is string => typeof u === "string")
        : [],
      linkedTaskId:
        typeof parsed.linkedTaskId === "string" && parsed.linkedTaskId
          ? parsed.linkedTaskId
          : null,
    };
  } catch {
    return null;
  }
}

function saveDraft(d: DraftState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* quota / private mode — ignore */
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function EventComposer() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const { users, loading: usersLoading } = useUsers(Boolean(user));
  const params = useParams<{ id?: string }>();
  const editId = params.id ?? null;
  const isEditMode = Boolean(editId);
  const editState = useEvent(editId ?? undefined);

  // Draft init — lazy. Edit mode začíná prázdně (pre-fill z Firestore
  //   přes effect níž); new mode restore z localStorage nebo default.
  const [draft, setDraft] = useState<DraftState>(() => {
    if (isEditMode) return emptyDraft(new Date()); // placeholder, effect přepíše
    const restored = loadDraft();
    return restored ?? emptyDraft(new Date());
  });

  // Edit mode — pre-fill z načteného eventu. Loading state se dotýká
  //   jen prvního snapshotu; další úpravy (uživatel edituje) pull-from-
  //   server neblokují.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!isEditMode) return;
    if (prefilled) return;
    if (editState.status !== "ready") return;
    const ev = editState.event;
    setDraft({
      title: ev.title,
      startAt: isoToLocalInput(ev.startAt, ev.isAllDay),
      endAt: isoToLocalInput(ev.endAt, ev.isAllDay),
      isAllDay: ev.isAllDay,
      address: ev.address,
      description: ev.description,
      inviteeUids: [...ev.inviteeUids],
      linkedTaskId: ev.linkedTaskId ?? null,
    });
    setPrefilled(true);
  }, [isEditMode, editState, prefilled]);

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const busy = useBusy();

  // Debounce draft save — jen v new mode, v edit nechceme míchat draft
  //   s live Firestore daty.
  useEffect(() => {
    if (isEditMode) return;
    saveDraft(draft);
  }, [draft, isEditMode]);

  // Auto-fix: pokud user změní startAt tak, že endAt je před ním, posuň endAt
  // na start+1h. V18-S36 — pro all-day skipnout: localInputToIso s isAllDay
  // ignoruje time, takže start === end pro single-day = nekonečný re-render
  // loop (oprava posune endAt o 1h, nový loop, …). All-day default je
  // single-day a multi-day se řeší jinou cestou (date input ne datetime-local).
  useEffect(() => {
    if (draft.isAllDay) return;
    if (!draft.startAt || !draft.endAt) return;
    const startMs = Date.parse(localInputToIso(draft.startAt, false));
    const endMs = Date.parse(localInputToIso(draft.endAt, false));
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;
    if (endMs <= startMs) {
      const fixed = new Date(startMs + HOUR_MS);
      setDraft((d) => ({ ...d, endAt: toLocalInput(fixed) }));
    }
  }, [draft.startAt, draft.endAt, draft.isAllDay]);

  // V18-S15 — tasks pro linkedTaskId picker. Moje nebo assignuté mi.
  // Top 20 podle updatedAt DESC aby picker nebyl přetížený.
  const tasksState = useTasks(Boolean(user));
  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasksState.tasks
      .filter(
        (task) =>
          task.createdBy === user.uid || task.assigneeUid === user.uid,
      )
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 20);
  }, [tasksState.tasks, user]);

  // Peers = všichni users aplikace kromě mě (do invitee picker).
  const peers = useMemo(() => {
    if (!user) return [];
    return users
      .filter((u) => u.uid !== user.uid)
      .map((u) => ({
        uid: u.uid,
        label: resolveUserName({
          profileDisplayName: u.displayName,
          email: u.email,
          uid: u.uid,
        }),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "cs"));
  }, [users, user]);

  // Validace — message nebo null pokud OK.
  const validationError = useMemo<string | null>(() => {
    if (!draft.title.trim()) return t("events.composer.errorTitleRequired");
    if (draft.inviteeUids.length === 0)
      return t("events.composer.errorNoInvitees");
    const startIso = localInputToIso(draft.startAt, draft.isAllDay);
    const endIso = localInputToIso(draft.endAt, draft.isAllDay);
    if (!startIso || !endIso) return t("events.composer.errorEndBeforeStart");
    // V18-S36 — pro all-day povolit start === end (single-day event).
    // Pro timed events platí strict less-than (event musí mít trvání).
    if (draft.isAllDay) {
      if (Date.parse(endIso) < Date.parse(startIso)) {
        return t("events.composer.errorEndBeforeStart");
      }
    } else if (Date.parse(endIso) <= Date.parse(startIso)) {
      return t("events.composer.errorEndBeforeStart");
    }
    return null;
  }, [draft, t]);

  const canSubmit = !saving && validationError === null && user !== null;

  async function handleSave() {
    if (!user || saving) return;
    if (validationError) return;
    setSubmitError(null);
    setSaving(true);
    try {
      await busy.run(async () => {
        if (isEditMode && editId) {
          await updateEvent(editId, {
            title: draft.title.trim(),
            description: draft.description.trim(),
            startAt: localInputToIso(draft.startAt, draft.isAllDay),
            endAt: localInputToIso(draft.endAt, draft.isAllDay),
            isAllDay: draft.isAllDay,
            address: draft.address.trim(),
            inviteeUids: draft.inviteeUids,
            linkedTaskId: draft.linkedTaskId,
          });
          navigate(eventDetail(editId), { replace: true });
        } else {
          const authorRole =
            roleState.status === "ready" ? roleState.profile.role : "OWNER";
          const newId = await createEvent(
            {
              title: draft.title.trim(),
              description: draft.description.trim(),
              startAt: localInputToIso(draft.startAt, draft.isAllDay),
              endAt: localInputToIso(draft.endAt, draft.isAllDay),
              isAllDay: draft.isAllDay,
              address: draft.address.trim(),
              inviteeUids: draft.inviteeUids,
              linkedTaskId: draft.linkedTaskId,
            },
            user.uid,
            authorRole,
          );
          clearDraft();
          navigate(eventDetail(newId), { replace: true });
        }
      }, t("busy.saving"));
    } catch (e) {
      console.error("save event failed", e);
      setSubmitError(t("events.composer.saveFailed"));
      setSaving(false);
    }
  }

  function handleClose() {
    if (isEditMode) {
      // V edit mode close = zahoď změny, vrať na detail (nebo zpět).
      navigate(editId ? eventDetail(editId) : ROUTES.events);
      return;
    }
    const hasContent =
      draft.title.trim().length > 0 ||
      draft.description.trim().length > 0 ||
      draft.address.trim().length > 0 ||
      draft.inviteeUids.length > 0;
    if (hasContent) {
      if (!window.confirm(t("events.composer.closeConfirm"))) return;
    }
    clearDraft();
    navigate(ROUTES.events);
  }

  function toggleInvitee(uid: string) {
    setDraft((d) => {
      const exists = d.inviteeUids.includes(uid);
      return {
        ...d,
        inviteeUids: exists
          ? d.inviteeUids.filter((u) => u !== uid)
          : [...d.inviteeUids, uid],
      };
    });
  }

  // V edit režimu: pokud user nemá edit práva (rules rejectnou stejně,
  //   ale UX je hezčí když se do composeru vůbec nedostane), redirect.
  const canEdit = isEditMode && editState.status === "ready"
    ? canEditEvent({
        event: editState.event,
        currentUserUid: user?.uid,
        currentUserRole: roleState.status === "ready" ? roleState.profile.role : null,
      })
    : true;

  if (isEditMode && editState.status === "ready" && !canEdit && editId) {
    navigate(eventDetail(editId), { replace: true });
    return null;
  }
  if (isEditMode && editState.status === "missing") {
    navigate(ROUTES.events, { replace: true });
    return null;
  }

  return (
    <section
      aria-labelledby="event-composer-heading"
      className="mx-auto max-w-xl px-4 py-4"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleClose}
          aria-label={t("events.composer.close")}
          className="-ml-2 grid min-h-tap min-w-tap place-items-center rounded-md text-ink hover:bg-bg-subtle"
        >
          <X aria-hidden size={20} />
        </button>
        <h1
          id="event-composer-heading"
          className="flex-1 text-center text-base font-semibold text-ink"
        >
          {t(isEditMode ? "events.composer.titleEdit" : "events.composer.title")}
        </h1>
        <span className="w-10" aria-hidden />
      </header>

      <div className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label htmlFor="event-title" className="sr-only">
            {t("events.composer.titleLabel")}
          </label>
          <input
            id="event-title"
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={t("events.composer.titlePlaceholder")}
            autoCapitalize="sentences"
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
          />
        </div>

        {/* All-day toggle */}
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle">
          <input
            type="checkbox"
            checked={draft.isAllDay}
            onChange={(e) =>
              setDraft((d) => ({ ...d, isAllDay: e.target.checked }))
            }
            className="size-4 rounded border-line focus:ring-2 focus:ring-line-focus"
            style={{ accentColor: "var(--color-accent-visual)" }}
          />
          <span className="flex-1">{t("events.composer.allDayLabel")}</span>
        </label>

        {/* Datetime pickers */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="event-startAt"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle"
            >
              {t("events.composer.startAtLabel")}
            </label>
            <input
              id="event-startAt"
              type={draft.isAllDay ? "date" : "datetime-local"}
              value={
                draft.isAllDay ? draft.startAt.slice(0, 10) : draft.startAt
              }
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({
                  ...d,
                  startAt: draft.isAllDay ? `${v}T00:00` : v,
                }));
              }}
              className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
            />
          </div>
          <div>
            <label
              htmlFor="event-endAt"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle"
            >
              {t("events.composer.endAtLabel")}
            </label>
            <input
              id="event-endAt"
              type={draft.isAllDay ? "date" : "datetime-local"}
              value={draft.isAllDay ? draft.endAt.slice(0, 10) : draft.endAt}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) => ({
                  ...d,
                  endAt: draft.isAllDay ? `${v}T23:59` : v,
                }));
              }}
              className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label
            htmlFor="event-address"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("events.composer.addressLabel")}
          </label>
          <input
            id="event-address"
            type="text"
            value={draft.address}
            onChange={(e) =>
              setDraft((d) => ({ ...d, address: e.target.value }))
            }
            placeholder={t("events.composer.addressPlaceholder")}
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="event-description"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("events.composer.descriptionLabel")}
          </label>
          <textarea
            id="event-description"
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
            placeholder={t("events.composer.descriptionPlaceholder")}
            rows={3}
            className="block w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
          />
        </div>

        {/* V18-S15 — Link to task (optional) */}
        <div>
          <label
            htmlFor="event-linked-task"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("events.composer.linkedTaskLabel")}
          </label>
          <select
            id="event-linked-task"
            value={draft.linkedTaskId ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                linkedTaskId: e.target.value ? e.target.value : null,
              }))
            }
            className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-line-focus focus:outline-none focus:ring-1 focus:ring-line-focus"
          >
            <option value="">
              {t("events.composer.linkedTaskNone")}
            </option>
            {myTasks.map((task) => {
              const label =
                (task.title || "").trim() ||
                (task.body || "").split("\n")[0].slice(0, 60) ||
                `#${task.id.slice(0, 6)}`;
              return (
                <option key={task.id} value={task.id}>
                  {label}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-xs text-ink-subtle">
            {t("events.composer.linkedTaskHint")}
          </p>
        </div>

        {/* Invitees */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            {t("events.composer.inviteesLabel")}
          </p>
          {usersLoading ? (
            <p className="text-sm text-ink-subtle">
              {t("events.composer.inviteesLoading")}
            </p>
          ) : peers.length === 0 ? (
            <p className="text-sm text-ink-subtle">
              {t("events.composer.inviteesEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col rounded-md ring-1 ring-line bg-surface divide-y divide-line">
              {peers.map((peer) => {
                const checked = draft.inviteeUids.includes(peer.uid);
                return (
                  <li key={peer.uid}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-bg-subtle">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleInvitee(peer.uid)}
                        className="size-4 rounded border-line focus:ring-2 focus:ring-line-focus"
                        style={{ accentColor: "var(--color-accent-visual)" }}
                      />
                      <span className="flex-1 truncate">{peer.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {draft.inviteeUids.length === 0 && peers.length > 0 && (
            <p className="mt-1 text-xs text-ink-subtle">
              {t("events.composer.inviteesHint")}
            </p>
          )}
        </div>

        {/* Validation / submit error */}
        {(submitError || validationError) && (
          <p
            role="alert"
            className="text-xs text-[color:var(--color-status-danger-fg)]"
          >
            {submitError ?? validationError}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit}
          className="inline-flex min-h-tap items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          {saving
            ? t("events.composer.saving")
            : t(isEditMode ? "events.composer.saveEdit" : "events.composer.save")}
        </button>
      </div>
    </section>
  );
}
