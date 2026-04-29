import { useState } from "react";
import { Check, FileText, Search, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import type { Task } from "@/types";

interface Props {
  /** All dokumentace tasks available for linking. */
  documents: Task[];
  /** Already linked doc IDs — shown as checked. */
  alreadyLinked: string[];
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
}

export default function DocumentPickerModal({ documents, alreadyLinked, onConfirm, onClose }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(alreadyLinked));
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? documents.filter((d) =>
        (d.title ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (d.body ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : documents;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm([...selected]);
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={t("dokumentace.linkPickerTitle")}
    >
      <div className="flex w-full max-w-[min(28rem,calc(100dvw-2rem))] flex-col overflow-hidden rounded-xl bg-bg shadow-xl ring-1 ring-line" style={{ maxHeight: "80dvh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{t("dokumentace.linkPickerTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-line px-4 py-2">
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
            <Search aria-hidden size={14} className="text-ink-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("dokumentace.linkSearchPlaceholder")}
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              {documents.length === 0
                ? t("dokumentace.linkEmpty")
                : t("dokumentace.linkNoResults")}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((doc) => {
                const isSelected = selected.has(doc.id);
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => toggle(doc.id)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-accent/10 ring-1 ring-accent"
                          : "hover:bg-bg-subtle"
                      }`}
                    >
                      <FileText aria-hidden size={18} className={isSelected ? "text-accent" : "text-ink-subtle"} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {doc.title?.trim() || t("detail.noTitle")}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {(doc.documents?.length ?? 0)} {t("dokumentace.linkDocCount")}
                        </p>
                      </div>
                      {isSelected && (
                        <Check aria-hidden size={16} className="shrink-0 text-accent" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap rounded-md border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-bg-subtle transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover transition-colors"
          >
            {t("dokumentace.linkConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
