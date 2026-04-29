import { useState } from "react";
import { HelpCircle, Lightbulb, Search, Target, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { Task, UserProfile, UserRole } from "@/types";
import { canLinkTasks, canViewTask } from "@/lib/permissions";
import { resolveAuthorRole } from "@/lib/authorRole";

/**
 * V18-S40 — Picker pro propojení otázky/úkolu s tématem (nápadem) — many-to-many.
 *
 * Když je `me` typu `napad`, modal nabídne všechny otázky/úkoly, které ještě
 * nejsou propojené.
 * Když je `me` typu `otazka` nebo `ukol`, modal nabídne všechny nápady (témata),
 * které ještě nejsou propojené.
 *
 * Per-row gating přes canLinkTasks — položka je vyšedlá pokud user nemá edit
 * právo na obě strany.
 */
interface Props {
  /** Aktivní task, ze kterého picker spouštíme. */
  me: Task;
  /** Resolved authorRole pro `me` (caller předává z resolveAuthorRole). */
  meAuthorRole: UserRole | undefined;
  /** Všechny tasky v workspace. */
  allTasks: Task[];
  /** Map uid → user profile pro authorRole resolver fallback. */
  usersByUid: Map<string, Pick<UserProfile, "role">>;
  currentUserUid: string | null | undefined;
  currentUserRole: UserRole | null | undefined;
  /** Handler — vyvolán s ID jednotlivé položky. Picker očekává, že caller
   *  modal zavře po úspěchu (nebo nechá otevřený pro pickování dalších). */
  onPick: (id: string) => Promise<void>;
  onClose: () => void;
  /** Když je picker uprostřed link/unlink akce, ukáže ID v progress stavu. */
  busyId?: string | null;
}

export default function TaskLinkPickerModal({
  me,
  meAuthorRole,
  allTasks,
  usersByUid,
  currentUserUid,
  currentUserRole,
  onPick,
  onClose,
  busyId,
}: Props) {
  const t = useT();
  const [query, setQuery] = useState("");

  const isNapad = me.type === "napad";
  const alreadyLinked = new Set(me.linkedTaskIds ?? []);

  // Kandidáti: protilehlý typ. Z napadu lovíme otazka+ukol; z otazka/ukol lovíme napad.
  // V24 — gate přes canViewTask aby CM neviděl nápady (Hide entirely policy):
  //   pro CM se modal otevře jen z otazka/ukol kontextu, a candidates by hledali
  //   napady (které CM nikdy nevidí) → seznam zůstane prázdný. Z napad kontextu
  //   se modal pro CM neotevře vůbec (TaskDetail napad je pro CM blokovaný).
  const candidates = allTasks
    .filter((cand) => {
      if (cand.id === me.id) return false;
      if (alreadyLinked.has(cand.id)) return false;
      if (isNapad) return cand.type === "otazka" || cand.type === "ukol";
      return cand.type === "napad";
    })
    .filter((cand) =>
      canViewTask({ task: cand, currentUserUid, currentUserRole }),
    );

  const filtered = query.trim()
    ? candidates.filter((c) => {
        const q = query.toLowerCase();
        return (
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.body ?? "").toLowerCase().includes(q)
        );
      })
    : candidates;

  function iconFor(task: Task) {
    if (task.type === "napad") return Lightbulb;
    if (task.type === "ukol") return Target;
    return HelpCircle;
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={t(isNapad ? "detail.linkPickerTitleFromNapad" : "detail.linkPickerTitleFromTask")}
    >
      <div
        className="flex w-full max-w-[min(28rem,calc(100dvw-2rem))] flex-col overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line"
        style={{ maxHeight: "80dvh" }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">
            {t(
              isNapad
                ? "detail.linkPickerTitleFromNapad"
                : "detail.linkPickerTitleFromTask",
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        <div className="border-b border-line px-4 py-2">
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
            <Search aria-hidden size={14} className="shrink-0 text-ink-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("detail.linkPickerSearchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              {candidates.length === 0
                ? t("detail.linkPickerEmpty")
                : t("detail.linkPickerNoResults")}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((cand) => {
                const Icon = iconFor(cand);
                const candAuthorRole = resolveAuthorRole({ task: cand, usersByUid });
                const allowed = canLinkTasks({
                  task: me,
                  taskAuthorRole: meAuthorRole,
                  other: cand,
                  otherAuthorRole: candAuthorRole,
                  currentUserUid,
                  currentUserRole,
                });
                const title =
                  cand.title?.trim() ||
                  cand.body?.split("\n")[0]?.trim().slice(0, 80) ||
                  t("detail.noTitle");
                const isBusy = busyId === cand.id;
                return (
                  <li key={cand.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!allowed || isBusy) return;
                        void onPick(cand.id);
                      }}
                      disabled={!allowed || !!busyId}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                        !allowed
                          ? "opacity-40 cursor-not-allowed"
                          : isBusy
                            ? "bg-accent/10 ring-1 ring-accent"
                            : "hover:bg-bg-subtle"
                      }`}
                    >
                      <Icon
                        aria-hidden
                        size={18}
                        className={isBusy ? "text-accent" : "text-ink-subtle"}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{title}</p>
                        {!allowed && (
                          <p className="text-xs text-ink-subtle">
                            {t("detail.linkPickerNoPermission")}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
