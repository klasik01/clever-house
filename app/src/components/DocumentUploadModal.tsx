import { useEffect, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useDocumentTypes } from "@/hooks/useDocumentTypes";
import type { DocumentType } from "@/types";

export interface DocumentUploadResult {
  file: File;
  docType: string;
  displayName: string;
}

interface Props {
  /** Pre-fill values when replacing an existing document. */
  prefill?: { docType: string; displayName: string };
  onConfirm: (result: DocumentUploadResult) => void;
  onClose: () => void;
}

export default function DocumentUploadModal({ prefill, onConfirm, onClose }: Props) {
  const t = useT();
  const { documentTypes, loading } = useDocumentTypes(true);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(prefill?.docType ?? "");
  const [displayName, setDisplayName] = useState(prefill?.displayName ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // When document types load and we have no selection, pick first
  useEffect(() => {
    if (!docType && documentTypes.length > 0) {
      setDocType(documentTypes[0].label);
    }
  }, [documentTypes, docType]);

  // Auto-fill displayName from filename if empty
  useEffect(() => {
    if (file && !displayName && !prefill?.displayName) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      setDisplayName(nameWithoutExt);
    }
  }, [file, displayName, prefill?.displayName]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  function handleConfirm() {
    if (!file || !docType.trim()) return;
    onConfirm({
      file,
      docType: docType.trim(),
      displayName: displayName.trim() || file.name.replace(/\.[^.]+$/, ""),
    });
  }

  const isValid = file && docType.trim();

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 pt-safe pb-safe"
      role="dialog"
      aria-modal="true"
      aria-label={t("dokumentace.uploadModalTitle")}
    >
      <div className="w-full max-w-md rounded-xl bg-bg shadow-xl ring-1 ring-line">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">
            {prefill ? t("dokumentace.replaceDocument") : t("dokumentace.uploadModalTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-bg-subtle"
          >
            <X aria-hidden size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {/* File picker */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("dokumentace.uploadFile")}
            </label>
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <FileText aria-hidden size={16} className="shrink-0 text-ink-subtle" />
                <span className="flex-1 truncate text-sm text-ink">{file.name}</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="grid size-7 place-items-center rounded text-ink-muted hover:text-ink"
                  aria-label={t("common.delete")}
                >
                  <X aria-hidden size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-line px-4 py-6 text-sm text-ink-muted hover:border-line-strong hover:text-ink transition-colors"
              >
                <Upload aria-hidden size={18} />
                {t("dokumentace.uploadPickFile")}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </div>

          {/* Document type dropdown */}
          <div>
            <label htmlFor="doc-type-select" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("dokumentace.uploadDocType")}
            </label>
            {loading ? (
              <div className="h-11 rounded-md bg-surface ring-1 ring-line animate-pulse" />
            ) : (
              <select
                id="doc-type-select"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="min-h-tap w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink focus:border-line-focus focus:outline-none"
              >
                {documentTypes.map((dt: DocumentType) => (
                  <option key={dt.id} value={dt.label}>{dt.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Display name */}
          <div>
            <label htmlFor="doc-display-name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("dokumentace.uploadDisplayName")}
            </label>
            <input
              id="doc-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("dokumentace.uploadDisplayNamePlaceholder")}
              className="min-h-tap w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-line-focus focus:outline-none"
            />
          </div>
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
            disabled={!isValid}
            className="min-h-tap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            {prefill ? t("dokumentace.replaceDocument") : t("dokumentace.addDocument")}
          </button>
        </div>
      </div>
    </div>
  );
}
