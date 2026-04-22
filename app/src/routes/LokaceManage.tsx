import { useEffect, useRef, useState } from "react";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocations } from "@/hooks/useLocations";
import {
  LOCATION_GROUPS,
  createLocation,
  deleteLocation,
  renameLocation,
  seedLocationsIfEmpty,
  setLocationGroup,
} from "@/lib/locations";
import { useT } from "@/i18n/useT";
import { useToast } from "@/components/Toast";
import type { Location, LocationGroup } from "@/types";

/**
 * V7 — /nastaveni/lokace: owner-only management page.
 * Structure mirrors /kategorie but with three fixed groups: Pozemek / Dům / Sítě.
 * Each group gets its own add-input so new locations land in the right bucket.
 */
export default function Lokace_Manage() {
  const t = useT();
  const { user } = useAuth();
  const { locations, loading, error } = useLocations(Boolean(user));
  const { show: showToast } = useToast();

  // V7.1 — simple cross-group drag/drop. We track the dragging location’s
  // id + the currently hovered target group so the UI can render visual
  // feedback (dashed ring + faded row).
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverGroup, setHoverGroup] = useState<LocationGroup | null>(null);

  // Seed defaults on first visit (idempotent guard inside).
  useEffect(() => {
    if (!user) return;
    seedLocationsIfEmpty(user.uid).catch((e) => console.error("seed failed", e));
  }, [user]);

  async function handleDrop(targetGroup: LocationGroup, locId: string) {
    setDraggingId(null);
    setHoverGroup(null);
    const loc = locations.find((l) => l.id === locId);
    if (!loc || loc.group === targetGroup) return;
    try {
      await setLocationGroup(locId, targetGroup);
      showToast(t("toast.saved"), "success");
    } catch (e) {
      console.error("setLocationGroup failed", e);
      showToast(t("toast.genericError"), "error");
    }
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-4" aria-labelledby="loc-manage-heading">
      <h2 id="loc-manage-heading" className="mb-2 text-xl font-semibold tracking-tight text-ink">
        {t("locations.manage.pageTitle")}
      </h2>
      <p className="mb-4 text-sm text-ink-muted">{t("locations.manage.pageHint")}</p>

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <p role="alert" className="text-sm text-[color:var(--color-status-danger-fg)]">
          {t("locations.manage.loadFailed")}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {LOCATION_GROUPS.map((g) => (
            <GroupSection
              key={g.id}
              group={g.id}
              i18nKey={g.i18nKey}
              items={locations
                .filter((l) => l.group === g.id)
                .sort((a, b) => a.label.localeCompare(b.label, "cs"))}
              draggingId={draggingId}
              isHoverTarget={hoverGroup === g.id}
              onDragStartRow={setDraggingId}
              onDragEnterGroup={setHoverGroup}
              onDragLeaveGroup={() => setHoverGroup(null)}
              onDropGroup={handleDrop}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GroupSection({
  group,
  i18nKey,
  items,
  draggingId,
  isHoverTarget,
  onDragStartRow,
  onDragEnterGroup,
  onDragLeaveGroup,
  onDropGroup,
}: {
  group: LocationGroup;
  i18nKey: string;
  items: Location[];
  draggingId: string | null;
  isHoverTarget: boolean;
  onDragStartRow: (id: string | null) => void;
  onDragEnterGroup: (g: LocationGroup) => void;
  onDragLeaveGroup: () => void;
  onDropGroup: (g: LocationGroup, id: string) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!user || !newLabel.trim() || busy) return;
    setBusy(true);
    try {
      await createLocation(newLabel, group, user.uid);
      setNewLabel("");
      showToast(t("toast.saved"), "success");
    } catch (e) {
      console.error(e);
      showToast(t("toast.genericError"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(loc: Location) {
    const ok = window.confirm(t("locations.manage.confirmDelete", { name: loc.label }));
    if (!ok) return;
    try {
      await deleteLocation(loc.id);
    } catch (e) {
      console.error(e);
      showToast(t("toast.genericError"), "error");
    }
  }

  return (
    <section aria-labelledby={`loc-group-${group}`}>
      <h3
        id={`loc-group-${group}`}
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
      >
        {t(i18nKey)}
      </h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("locations.manage.addPlaceholder")}
          className="min-h-tap flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newLabel.trim() || busy}
          aria-label={t("locations.manage.add")}
          className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          <Plus aria-hidden size={18} />
        </button>
      </div>

      <div
        className={[
          "mt-3 rounded-md transition-colors",
          isHoverTarget ? "ring-2 ring-dashed ring-accent bg-accent/5" : "",
        ].join(" ")}
        // V7.1 — whole list region is a drop target. preventDefault on
        // dragover is required by the HTML DnD spec to allow drop.
        onDragOver={(e) => {
          if (draggingId) {
            e.preventDefault();
            onDragEnterGroup(group);
          }
        }}
        onDragLeave={(e) => {
          // Fires when leaving any child too — only clear when the event
          // bubbles out of the wrapper itself.
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          onDragLeaveGroup();
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/plain");
          if (id) onDropGroup(group, id);
        }}
      >
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-3 text-center text-xs text-ink-subtle">
            {t("locations.manage.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-md bg-surface ring-1 ring-line">
            {items.map((loc) => (
              <LocationRow
                key={loc.id}
                location={loc}
                onDelete={() => handleDelete(loc)}
                isDragging={draggingId === loc.id}
                onDragStart={() => onDragStartRow(loc.id)}
                onDragEnd={() => onDragStartRow(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LocationRow({
  location,
  onDelete,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  location: Location;
  onDelete: () => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(location.label);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(location.label);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, location.label]);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === location.label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await renameLocation(location.id, trimmed);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(location.label);
    setEditing(false);
  }

  return (
    <li
      draggable={!editing}
      onDragStart={(e) => {
        if (editing) return;
        e.dataTransfer.setData("text/plain", location.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={[
        "flex items-center gap-2 px-4 py-2 transition-opacity",
        isDragging ? "opacity-40" : "",
      ].join(" ")}>
      {editing ? (
        <>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            disabled={saving}
            className="min-h-tap flex-1 rounded-sm bg-transparent px-1 py-1 text-base text-ink focus:outline-none focus:bg-bg-subtle/60"
          />
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            aria-label={t("locations.manage.save")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-accent hover:bg-bg-subtle"
          >
            <Check aria-hidden size={18} />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label={t("locations.manage.cancel")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </>
      ) : (
        <>
          <span
            aria-hidden
            title={t("locations.manage.dragHint")}
            className="grid size-6 shrink-0 cursor-grab place-items-center text-ink-subtle active:cursor-grabbing"
          >
            <GripVertical aria-hidden size={16} />
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left min-h-tap text-base text-ink hover:text-accent"
            aria-label={`${t("locations.manage.rename")}: ${location.label}`}
          >
            {location.label}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("locations.manage.rename")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink"
          >
            <Pencil aria-hidden size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("locations.manage.delete")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-[color:var(--color-status-danger-fg)]"
          >
            <Trash2 aria-hidden size={16} />
          </button>
        </>
      )}
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="h-12 rounded-md bg-surface ring-1 ring-line animate-pulse" />
      ))}
    </ul>
  );
}
