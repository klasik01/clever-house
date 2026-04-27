import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import {
  createDocumentType,
  deleteDocumentType,
  renameDocumentType,
  seedDocumentTypesIfEmpty,
} from "@/lib/documentTypes";
import { useT } from "@/i18n/useT";
import { useToast } from "@/components/Toast";
import type { DocumentType } from "@/types";

export default function DocumentTypesManage() {
  const t = useT();
  const { user } = useAuth();
  const { documentTypes, loading, error } = useDocumentTypes(Boolean(user));
  const { show: showToast } = useToast();
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  // Seed defaults on first visit (idempotent guard inside).
  useEffect(() => {
    if (!user) return;
    seedDocumentTypesIfEmpty(user.uid).catch((e) => console.error("seed docTypes failed", e));
  }, [user]);

  async function handleAdd() {
    if (!user || !newLabel.trim() || busy) return;
    setBusy(true);
    try {
      await createDocumentType(newLabel, user.uid);
      setNewLabel("");
      showToast(t("toast.saved"), "success");
    } catch (e) {
      console.error(e);
      showToast(t("toast.genericError"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(dt: DocumentType) {
    const ok = window.confirm(t("docTypes.confirmDelete"));
    if (!ok) return;
    await deleteDocumentType(dt.id);
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-4" aria-labelledby="dt-heading">
      <h2 id="dt-heading" className="mb-2 text-xl font-semibold tracking-tight text-ink">
        {t("docTypes.pageTitle")}
      </h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={t("docTypes.labelPlaceholder")}
          className="min-h-tap flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newLabel.trim() || busy}
          className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
          aria-label={t("docTypes.addCta")}
        >
          <Plus aria-hidden size={18} />
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <p role="alert" className="text-sm text-[color:var(--color-status-danger-fg)]">
            {t("toast.genericError")}
          </p>
        ) : documentTypes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-6 py-10 text-center text-sm text-ink-muted">
            {t("docTypes.emptyState")}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-md bg-surface ring-1 ring-line">
            {documentTypes.map((dt) => (
              <DocTypeRow key={dt.id} docType={dt} onDelete={() => handleDelete(dt)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DocTypeRow({ docType, onDelete }: { docType: DocumentType; onDelete: () => void }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(docType.label);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(docType.label);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, docType.label]);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === docType.label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await renameDocumentType(docType.id, trimmed);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(docType.label);
    setEditing(false);
  }

  return (
    <li className="flex items-center gap-2 px-4 py-2">
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
            aria-label={t("common.save")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-accent hover:bg-bg-subtle"
          >
            <Check aria-hidden size={18} />
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label={t("common.cancel")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 text-left min-h-tap text-base text-ink hover:text-accent"
            aria-label={`${docType.label}`}
          >
            {docType.label}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={t("common.edit")}
            className="grid min-h-tap min-w-tap place-items-center rounded-md text-ink-subtle hover:text-ink"
          >
            <Pencil aria-hidden size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("common.delete")}
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
