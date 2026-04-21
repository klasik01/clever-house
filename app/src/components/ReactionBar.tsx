import { useState, useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { ReactionMap } from "@/types";

/**
 * Fixed emoji set — V3 keeps it minimal (5 choices, no full Unicode picker).
 * Ordering is stable across the picker so muscle memory can build.
 */
export const REACTION_EMOJI = ["👍", "❤️", "😄", "🎉", "😕"] as const;

interface Props {
  reactions: ReactionMap | undefined;
  currentUid?: string;
  onToggle: (emoji: string) => void | Promise<void>;
  /** Disable all interactions (e.g. offline). */
  disabled?: boolean;
}

/**
 * Row of reaction pills + "+" picker button.
 * - Pills rendered only for emoji with > 0 reactors.
 * - Current-user pill shows active style (--color-comment-reaction-active-bg).
 * - Click pill toggles (add/remove current user from that emoji's list).
 */
export default function ReactionBar({ reactions, currentUid, onToggle, disabled }: Props) {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRootRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click or Escape
  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e: MouseEvent) {
      if (!pickerRootRef.current) return;
      if (!pickerRootRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const entries = Object.entries(reactions ?? {}).filter(
    ([, uids]) => Array.isArray(uids) && uids.length > 0
  );

  async function handleToggle(emoji: string) {
    if (disabled) return;
    setPickerOpen(false);
    try {
      await onToggle(emoji);
    } catch (e) {
      console.error("toggleReaction failed", e);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {entries.map(([emoji, uids]) => {
        const isActive = Boolean(currentUid && uids.includes(currentUid));
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleToggle(emoji)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={isActive ? t("reactions.remove") : t("reactions.add")}
            className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            style={{
              background: isActive
                ? "var(--color-comment-reaction-active-bg)"
                : "var(--color-comment-reaction-bg)",
              color: isActive
                ? "var(--color-comment-reaction-active-fg)"
                : "var(--color-text-muted)",
            }}
          >
            <span aria-hidden className="text-sm leading-none">{emoji}</span>
            <span className="tabular-nums">{uids.length}</span>
          </button>
        );
      })}

      <div ref={pickerRootRef} className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={disabled}
          aria-label={t("reactions.add")}
          aria-expanded={pickerOpen}
          className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs text-ink-subtle hover:text-ink hover:bg-bg-subtle disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <SmilePlus aria-hidden size={14} />
        </button>
        {pickerOpen && (
          <div
            role="menu"
            aria-labelledby="reaction-picker-trigger"
            className="absolute left-0 top-full z-10 mt-1 flex items-center gap-0.5 rounded-md border border-line bg-surface px-1.5 py-1 shadow-sm"
          >
            {REACTION_EMOJI.map((emoji) => {
              const uids = reactions?.[emoji] ?? [];
              const isActive = Boolean(currentUid && uids.includes(currentUid));
              return (
                <button
                  key={emoji}
                  type="button"
                  role="menuitem"
                  onClick={() => handleToggle(emoji)}
                  aria-label={isActive ? t("reactions.remove") : t("reactions.add")}
                  aria-pressed={isActive}
                  className={`grid size-8 place-items-center rounded-md text-base transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                    isActive ? "bg-[color:var(--color-comment-reaction-active-bg)]" : ""
                  }`}
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
