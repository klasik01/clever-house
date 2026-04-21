import { useEffect, useRef, useState } from "react";
import AvatarCircle from "./AvatarCircle";
import { useT } from "@/i18n/useT";
import type { UserProfile } from "@/types";

interface Props {
  /** Filtered user list to show. If empty array, shows "no results". If null, picker is closed. */
  users: UserProfile[] | null;
  /** Raw query text (for "no results" hint). */
  query: string;
  onSelect: (user: UserProfile) => void;
  onClose: () => void;
}

/**
 * Mention autocomplete popover. Rendered below the textarea (not floating near
 * caret) — simpler on mobile, predictable focus behavior.
 *
 * Keyboard model:
 *   - ArrowUp / ArrowDown cycle through users
 *   - Enter picks highlighted
 *   - Escape calls onClose
 *   - Click also picks
 *
 * Caller owns when the picker is open (passes null users to close).
 */
export default function MentionPicker({ users, query, onSelect, onClose }: Props) {
  const t = useT();
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reset active index whenever the list changes (new query).
  useEffect(() => {
    setActive(0);
  }, [users]);

  // Keyboard navigation handled globally while open — lightweight, single picker.
  useEffect(() => {
    if (!users) return;
    function onKey(e: KeyboardEvent) {
      if (!users || users.length === 0) {
        if (e.key === "Escape") onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % users.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + users.length) % users.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const u = users[active];
        if (u) onSelect(u);
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [users, active, onSelect, onClose]);

  const activeId =
    users && users[active]
      ? `mp-option-${users[active].uid}`
      : undefined;

  if (!users) return null;

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label={t("mentions.typeToSearch")}
      aria-activedescendant={activeId}
      className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line bg-surface shadow-sm"
    >
      {users.length === 0 ? (
        <p className="px-3 py-2 text-sm text-ink-subtle">
          {query ? t("mentions.noResults") : t("mentions.typeToSearch")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {users.map((u, i) => {
            const isActive = i === active;
            const name = u.displayName || u.email?.split("@")[0] || u.uid;
            return (
              <li key={u.uid}>
                <button
                  type="button"
                  id={`mp-option-${u.uid}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    // Prevent textarea blur on picker click.
                    e.preventDefault();
                  }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onSelect(u)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    isActive ? "bg-bg-subtle" : "hover:bg-bg-subtle"
                  }`}
                >
                  <AvatarCircle
                    uid={u.uid}
                    displayName={u.displayName}
                    email={u.email}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{name}</span>
                    {u.email && (
                      <span className="ml-2 text-xs text-ink-subtle">{u.email}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
