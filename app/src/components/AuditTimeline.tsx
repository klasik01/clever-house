import { useState } from "react";
import { ChevronDown, FileText, Trash2, RefreshCw, Pencil } from "lucide-react";
import { useT, formatRelative } from "@/i18n/useT";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import type { AuditEntry } from "@/types";

interface Props {
  entries: AuditEntry[];
}

const ACTION_ICON: Record<AuditEntry["action"], typeof FileText> = {
  uploaded: FileText,
  replaced: RefreshCw,
  deleted: Trash2,
  metadata_changed: Pencil,
};

export default function AuditTimeline({ entries }: Props) {
  const t = useT();
  const { user } = useAuth();
  const { byUid } = useUsers(Boolean(user));
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  // Show most recent first
  const sorted = [...entries].reverse();

  return (
    <section className="mt-6" aria-labelledby="audit-heading">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="audit-content"
        className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left hover:bg-bg-subtle transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            id="audit-heading"
            className="text-xs font-semibold uppercase tracking-wide text-ink-subtle"
          >
            {t("dokumentace.auditTitle")}
          </span>
          <span className="text-xs text-ink-subtle">
            ({entries.length})
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-xs text-ink-subtle">
          <ChevronDown
            size={14}
            className={`transition-transform duration-fast ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {expanded && (
        <ol id="audit-content" className="mt-2 space-y-2 pl-2">
          {sorted.map((entry, i) => {
            const Icon = ACTION_ICON[entry.action] ?? FileText;
            const actorName =
              byUid.get(entry.actorUid)?.displayName ??
              byUid.get(entry.actorUid)?.email ??
              entry.actorUid;
            const ts = new Date(entry.timestamp);

            return (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-bg-subtle text-ink-subtle">
                  <Icon aria-hidden size={12} />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-ink">
                    <span className="font-medium">{actorName}</span>
                    {" "}
                    <span className="text-ink-muted">{t(`dokumentace.audit.${entry.action}`)}</span>
                    {entry.details && (
                      <span className="text-ink-muted"> — {entry.details}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-subtle">
                    {formatRelative(t, ts)}
                    <span className="ml-1 opacity-60">
                      {ts.toLocaleString("cs-CZ")}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
