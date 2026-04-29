import { useEffect, useRef, useState } from "react";
import { ChevronDown, UserMinus } from "lucide-react";
import AvatarCircle from "./AvatarCircle";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";
import type { UserRole } from "@/types";

interface Props {
  value: string | null | undefined;
  onChange: (nextUid: string | null) => void | Promise<void>;
  disabled?: boolean;
  /** When true, shows a compact read-only display (for non-authors). */
  readOnly?: boolean;
  /**
   * V24 — vyfiltrovat uživatele s danými rolemi z dropdownu. Použité hlavně
   * v napad context — `["CONSTRUCTION_MANAGER"]` zabrání přiřazení nápadu
   * stavbyvedoucímu (defense in depth, server rules taky odmítnou).
   * Aktuální `value` (i kdyby byl ve filtrované roli) se v read-only chip
   * stále zobrazí, jen v dropdownu nelze takovou volbu vybrat — preventivní
   * pro nové výběry.
   */
  excludeRoles?: UserRole[];
}

/**
 * AssigneeSelect — dropdown of workspace users.
 * - Current selection rendered as AvatarCircle + displayName + "Změnit" chevron.
 * - Dropdown lists all workspace members + "Nikdo" (unassigned) option.
 * - Own user flagged with "(já)" for quick identification.
 * - Read-only mode for non-authors: just the avatar + name, no dropdown.
 */
export default function AssigneeSelect({
  value,
  onChange,
  disabled,
  readOnly,
  excludeRoles,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const { users: rawUsers, byUid } = useUsers(Boolean(user));
  // V24 — pre-filter dropdown options dle excludeRoles. Aktuální value
  //   (i v excluded roli) zůstává viditelná v chip; user ji jen nemůže
  //   nově vybrat ze seznamu.
  const users =
    excludeRoles && excludeRoles.length > 0
      ? rawUsers.filter((u) => !excludeRoles.includes(u.role))
      : rawUsers;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = value ? byUid.get(value) : undefined;
  const currentName = current?.displayName || current?.email?.split("@")[0] || null;

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handlePick(uid: string | null) {
    setOpen(false);
    if (uid === (value ?? null)) return;
    try {
      await onChange(uid);
    } catch (e) {
      console.error("assignee change failed", e);
    }
  }

  // Read-only: just the chip
  if (readOnly) {
    return (
      <div className="flex w-full items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm">
        {current ? (
          <>
            <AvatarCircle uid={current.uid} displayName={current.displayName} email={current.email} size="sm" />
            <span className="min-w-0 flex-1 truncate text-ink">{currentName}</span>
          </>
        ) : (
          <span className="text-ink-subtle">{t("detail.assigneeNone")}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative block w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("detail.assigneeChange")}
        className="flex w-full items-center justify-between gap-2 min-h-tap rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg-subtle focus-visible:border-line-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-40 transition-colors"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {current ? (
            <>
              <AvatarCircle uid={current.uid} displayName={current.displayName} email={current.email} size="sm" />
              <span className="min-w-0 flex-1 truncate text-left text-ink">{currentName}</span>
            </>
          ) : (
            <span className="text-ink-subtle">{t("detail.assigneeNone")}</span>
          )}
        </span>
        <ChevronDown aria-hidden size={14} className="shrink-0 text-ink-subtle" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 max-h-72 min-w-full sm:min-w-[18rem] overflow-y-auto rounded-md border border-line bg-surface shadow-sm"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => handlePick(null)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-subtle hover:bg-bg-subtle"
            >
              <span className="grid size-6 place-items-center rounded-full bg-bg-muted text-ink-muted">
                <UserMinus aria-hidden size={12} />
              </span>
              <span>{t("detail.assigneeNone")}</span>
            </button>
          </li>
          {users.map((u) => {
            const isSelf = user?.uid === u.uid;
            const isSelected = value === u.uid;
            const name = u.displayName || u.email?.split("@")[0] || u.uid;
            return (
              <li key={u.uid}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handlePick(u.uid)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    isSelected ? "bg-bg-subtle" : "hover:bg-bg-subtle"
                  }`}
                >
                  <AvatarCircle uid={u.uid} displayName={u.displayName} email={u.email} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <span className="truncate">{name}</span>
                      {isSelf && <span className="text-xs font-normal text-ink-subtle">{t("detail.assigneeSelf")}</span>}
                    </span>
                    {u.email && u.email !== name && (
                      <span className="block truncate text-xs text-ink-subtle">{u.email}</span>
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
