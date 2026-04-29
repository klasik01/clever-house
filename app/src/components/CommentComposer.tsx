import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CornerDownLeft, Image as ImageIcon, Link as LinkIcon, Send, X } from "lucide-react";
import { isSupportedFile } from "@/lib/attachments";
import { normalizeUrl, parseDomain } from "@/lib/links";
import LinkFavicon from "./LinkFavicon";
import { useT } from "@/i18n/useT";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { detectActiveMention, extractMentionedUids, filterUsersForMention, insertMention } from "@/lib/mentions";
import MentionPicker from "./MentionPicker";
import type { UserProfile } from "@/types";

const MAX_IMAGES = 3;
const MAX_LINKS = 10;

export interface StagedImage {
  file: File;
  previewUrl: string;
}

interface Peer {
  uid: string;
  displayName: string;
}

interface Props {
  disabled?: boolean;
  submitting?: boolean;
  offline?: boolean;
  /**
   * V10 — onSubmit may carry an optional `targetUid` when `action === "flip"`,
   * to route the ball to a specific workspace user.
   */
  onSubmit: (
    input: {
      body: string;
      imageFiles: File[];
      linkUrls: string[];
      mentionedUids: string[];
    },
    action?: "flip" | "close" | "complete" | "block" | "reopen" | "cancel" | null,
    targetUid?: string | null,
  ) => Promise<void> | void;
  /**
   * V10 — workflow now needs the peer list so the primary flip button can
   * render "Poslat {name}" and open a picker to switch target. The
   * `defaultPeerUid` seeds the initial selection (recommended: the person who
   * last handed the task to the current user).
   */
  workflow?: {
    closeLabel: string;
    peers: Peer[];
    defaultPeerUid: string | null;
    /**
     * V24 — `completeOnly` schová flip section úplně. Použité pro CM-as-assignee:
     * smí jen "Hotovo" (close → DONE), ne reassign.
     * V25 — režimy:
     *   - "full"           — close + flip + block + cancel (autor) — OPEN status
     *   - "completeOnly"   — jen close (CM-as-assignee, V24 legacy)
     *   - "blocked"        — odblokovat (reopen) + complete (Hotovo)
     *   - "terminal"       — DONE/CANCELED → znovu otevřít (reopen)
     * Default `full`.
     */
    mode?: "full" | "completeOnly" | "blocked" | "terminal";
    /** V25 — Author-only actions: Zrušit. Když true, render dropdown s "Více". */
    canCancel?: boolean;
  };
}

/**
 * CommentComposer — plain markdown textarea + attach pickers.
 * No Tiptap here, per V2 B3 decision (rich text only in task body, not composers).
 *
 * - Textarea auto-grows up to 280px then scrolls
 * - Attach image: native file picker, max 3, client-side previews
 * - Attach link: window.prompt (simple, mobile-friendly)
 * - Send button disabled when body empty or submitting/offline
 */
export default function CommentComposer({
  disabled = false,
  submitting = false,
  offline = false,
  onSubmit,
  workflow,
}: Props) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  // V25-fix — mentionedUids tracking. Composer pamatuje uidy vybrané z
  //   pickeru (insertMention již nepřipisuje uid do body, jen `@Name`).
  //   On submit se pole spojí s legacy `extractMentionedUids(body)` pro
  //   backward compat (kdyby user přepisoval starší draft s legacy tokeny).
  const [selectedMentionUids, setSelectedMentionUids] = useState<string[]>([]);
  // V10 — which peer the user is about to send to. Seeded from workflow and
  // updated when they pick someone else from the dropdown.
  const [selectedPeerUid, setSelectedPeerUid] = useState<string | null>(
    workflow?.defaultPeerUid ?? null,
  );
  // Re-sync if the task changes (e.g. parent remounts).
  useEffect(() => {
    setSelectedPeerUid(workflow?.defaultPeerUid ?? null);
  }, [workflow?.defaultPeerUid]);
  const [peerMenuOpen, setPeerMenuOpen] = useState(false);

  const { user } = useAuth();
  const { users } = useUsers(Boolean(user));

  // Detect active @mention query at caret.
  const activeQuery = detectActiveMention(body, cursor);
  // Filter users excluding yourself — you can mention other workspace members.
  const pickerUsers = activeQuery
    ? filterUsersForMention(
        users.filter((u) => u.uid !== user?.uid),
        activeQuery.text
      )
    : null;


  const trulyDisabled = disabled || offline;
  const canSend = body.trim().length > 0 && !submitting && !trulyDisabled;

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const next: StagedImage[] = [];
    for (const file of files) {
      if (!isSupportedFile(file)) {
        setError(t("detail.attachmentUnsupported"));
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length === 0) return;
    setStagedImages((prev) => {
      const combined = [...prev, ...next];
      if (combined.length > MAX_IMAGES) {
        combined.slice(MAX_IMAGES).forEach((s) => URL.revokeObjectURL(s.previewUrl));
        setError(t("comments.maxImages"));
        return combined.slice(0, MAX_IMAGES);
      }
      setError(null);
      return combined;
    });
  }

  function removeImage(index: number) {
    setStagedImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  function handleAddLink() {
    if (links.length >= MAX_LINKS) {
      setError(t("comments.maxLinks"));
      return;
    }
    const input = window.prompt(t("composer.linkPromptTitle"), "");
    if (!input) return;
    const normalized = normalizeUrl(input);
    if (!normalized) {
      setError(t("composer.linkInvalid"));
      return;
    }
    setLinks((prev) => [...prev, normalized]);
    setError(null);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(
    action: "flip" | "close" | "complete" | "block" | "reopen" | "cancel" | null = null,
  ) {
    if (!canSend) return;
    try {
      const trimmed = body.trim();
      // V25 — flip i reopen oba routují k peer (assigneeAfter).
      const targetUid =
        action === "flip" || action === "reopen" ? selectedPeerUid : null;
      // V25-fix — combine legacy `@[Name](uid)` parser results s nově trackováným
      //   selectedMentionUids state. Set odstraní duplicity. Filter na uidy,
      //   které ještě reálně jsou v body — pokud user smazal `@Name` text,
      //   uid se nepošle (defensive).
      const legacyUids = extractMentionedUids(trimmed);
      const mentionedUids = Array.from(
        new Set([
          ...legacyUids,
          ...(trimmed.includes("@") ? selectedMentionUids : []),
        ]),
      );
      await onSubmit({
        body: trimmed,
        imageFiles: stagedImages.map((s) => s.file),
        linkUrls: links,
        mentionedUids,
      }, action, targetUid);
      // Reset
      stagedImages.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      setStagedImages([]);
      setLinks([]);
      setBody("");
      setSelectedMentionUids([]);
      setError(null);
      if (textareaRef.current) autoResize(textareaRef.current);
    } catch (e) {
      console.error("comment submit failed", e);
      setError(t("composer.saveFailed"));
    }
  }

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <label htmlFor="comment-composer-body" className="sr-only">
        {t("comments.composerPlaceholder")}
      </label>
      <textarea
        id="comment-composer-body"
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setCursor(e.target.selectionStart ?? e.target.value.length);
          autoResize(e.target);
        }}
        onKeyUp={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
        onClick={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={(e) => {
          // If mention picker is active, skip Cmd/Ctrl+Enter — picker owns Enter
          // for selection (see MentionPicker). Otherwise fire submit.
          if (pickerUsers && pickerUsers.length > 0 && e.key === "Enter") {
            return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            // When workflow is active, the primary action is "flip" — so
            // Cmd/Ctrl+Enter mirrors clicking the primary Send button.
            if (canSend) void handleSubmit(workflow ? "flip" : null);
          }
        }}
        disabled={trulyDisabled || submitting}
        placeholder={t("comments.composerPlaceholder")}
        rows={2}
        className="block w-full resize-none bg-transparent text-base leading-relaxed text-ink placeholder:text-ink-subtle rounded-sm px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-line-focus disabled:opacity-60"
      />

      <MentionPicker
        users={pickerUsers}
        query={activeQuery?.text ?? ""}
        onSelect={(u: UserProfile) => {
          if (!activeQuery) return;
          const { body: nextBody, cursor: nextCursor } = insertMention(body, activeQuery, u);
          setBody(nextBody);
          setCursor(nextCursor);
          // V25-fix — track uid for clean storage (body má jen `@Name`).
          setSelectedMentionUids((prev) => Array.from(new Set([...prev, u.uid])));
          // Restore focus + caret in next tick
          requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (el) {
              el.focus();
              el.setSelectionRange(nextCursor, nextCursor);
              autoResize(el);
            }
          });
        }}
        onClose={() => {
          // Collapse the picker by clearing the query — easiest path is to shift
          // cursor past the "@" so detectActiveMention returns null next render.
          const el = textareaRef.current;
          if (el && activeQuery) {
            el.setSelectionRange(activeQuery.end, activeQuery.end);
          }
        }}
      />

      {stagedImages.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 border-t border-line pt-2">
          {stagedImages.map((s, i) => (
            <li key={i} className="relative">
              <img
                src={s.previewUrl}
                alt=""
                className="size-16 rounded-md object-cover ring-1 ring-line"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={t("composer.removeAttachment")}
                className="absolute -right-2 -top-2 grid min-h-tap min-w-tap size-8 place-items-center rounded-full bg-black/75 text-white shadow hover:bg-black focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                <X aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-2">
          {links.map((url, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <LinkFavicon url={url} size={14} className="text-accent-visual" />
              <span className="truncate flex-1 text-ink">{parseDomain(url) ?? url}</span>
              <button
                type="button"
                onClick={() => removeLink(i)}
                aria-label={t("composer.removeAttachment")}
                className="grid size-6 place-items-center rounded-md text-ink-subtle hover:text-ink"
              >
                <X aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(offline || error) && (
        <p role={error ? "alert" : undefined} className="mt-2 text-xs text-[color:var(--color-status-danger-fg)]">
          {offline ? t("comments.offline") : error}
        </p>
      )}

      {/* V7.2 — single row: attachments pinned left, send actions right.
          V7.3 — divider above so the action bar reads as a footer distinct
          from the textarea + staged attachments. */}
      <div className="mt-3 pt-2 border-t border-line flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={trulyDisabled || submitting || stagedImages.length >= MAX_IMAGES}
            aria-label={t("composer.attachPhoto")}
            className="grid size-8 place-items-center rounded-md text-ink-muted hover:text-ink disabled:opacity-40"
          >
            <ImageIcon aria-hidden size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFilePick}
          />
          <button
            type="button"
            onClick={handleAddLink}
            disabled={trulyDisabled || submitting || links.length >= MAX_LINKS}
            aria-label={t("composer.attachLink")}
            className="grid size-8 place-items-center rounded-md text-ink-muted hover:text-ink disabled:opacity-40"
          >
            <LinkIcon aria-hidden size={18} />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {workflow ? (
            <V25WorkflowActions
              t={t}
              workflow={workflow}
              canSend={canSend}
              submitting={submitting}
              selectedPeerUid={selectedPeerUid}
              setSelectedPeerUid={setSelectedPeerUid}
              peerMenuOpen={peerMenuOpen}
              setPeerMenuOpen={setPeerMenuOpen}
              handleSubmit={handleSubmit}
            />
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit(null)}
              disabled={!canSend}
              aria-label={t("comments.send")}
              className="inline-flex items-center gap-1 h-8 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              <Send aria-hidden size={12} />
              {submitting ? t("composer.saving") : t("comments.send")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- V25 — kontextové akční tlačítka ----------

interface V25Props {
  t: (k: string, vars?: Record<string, string | number>) => string;
  workflow: NonNullable<Props["workflow"]>;
  canSend: boolean;
  submitting: boolean;
  selectedPeerUid: string | null;
  setSelectedPeerUid: (uid: string | null) => void;
  peerMenuOpen: boolean;
  setPeerMenuOpen: (next: boolean | ((p: boolean) => boolean)) => void;
  handleSubmit: (
    action: "flip" | "close" | "complete" | "block" | "reopen" | "cancel" | null,
  ) => void;
}

/**
 * V25 — kontextové akční tlačítka pro CommentComposer.
 *
 * Render závisí na `workflow.mode`:
 *
 *   "completeOnly" (V24)  — jen "Hotovo" jako primary CTA. Backwards compat
 *                            pro CM-as-assignee dle V24-S07.
 *
 *   "full" (OPEN)          — Hotovo + Předat (s peer dropdownem) + Blokováno.
 *                            Author-only "Více ▼" s Zrušit.
 *
 *   "blocked"              — Odblokovat (reopen → OPEN) + Hotovo.
 *
 *   "terminal" (DONE/CANCELED) — Znovu otevřít (reopen, vyžaduje peer pick).
 *
 * Send tlačítko (bez akce) zůstává primary v `else` větvi rodiče (CommentComposer).
 */
function V25WorkflowActions({
  t,
  workflow,
  canSend,
  submitting,
  selectedPeerUid,
  setSelectedPeerUid,
  peerMenuOpen,
  setPeerMenuOpen,
  handleSubmit,
}: V25Props): React.ReactElement {
  const mode = workflow.mode ?? "full";
  const peerName =
    workflow.peers.find((p) => p.uid === selectedPeerUid)?.displayName ?? "?";

  const cancelButton = workflow.canCancel ? (
    <button
      type="button"
      onClick={() => handleSubmit("cancel")}
      disabled={!canSend}
      className="inline-flex items-center gap-1 h-8 rounded-md border border-line bg-transparent px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-bg-subtle disabled:opacity-40 transition-colors"
    >
      <X aria-hidden size={12} />
      {t("comments.actionCancel")}
    </button>
  ) : null;

  if (mode === "completeOnly") {
    return (
      <>
        <button
          type="button"
          onClick={() => handleSubmit("complete")}
          disabled={!canSend}
          className="inline-flex items-center gap-1 h-8 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          <Check aria-hidden size={12} />
          {workflow.closeLabel}
        </button>
        {cancelButton}
      </>
    );
  }

  if (mode === "blocked") {
    return (
      <>
        <button
          type="button"
          onClick={() => handleSubmit("complete")}
          disabled={!canSend}
          className="inline-flex items-center gap-1 h-8 rounded-md border border-line bg-transparent px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
        >
          <Check aria-hidden size={12} />
          {t("comments.actionComplete")}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit("reopen")}
          disabled={!canSend || !selectedPeerUid}
          className="inline-flex items-center gap-1 h-8 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          <CornerDownLeft aria-hidden size={12} />
          {submitting ? t("composer.saving") : `${t("comments.actionReopen")} → ${peerName}`}
        </button>
        {cancelButton}
      </>
    );
  }

  if (mode === "terminal") {
    return (
      <>
        <div className="relative inline-flex">
          <button
            type="button"
            onClick={() => handleSubmit("reopen")}
            disabled={!canSend || !selectedPeerUid}
            className="inline-flex items-center gap-1 h-8 rounded-l-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            <CornerDownLeft aria-hidden size={12} />
            {submitting ? t("composer.saving") : `${t("comments.actionReopen")} → ${peerName}`}
          </button>
          <button
            type="button"
            onClick={() => setPeerMenuOpen((v) => !v)}
            disabled={workflow.peers.length === 0}
            aria-label={t("comments.pickPeer")}
            aria-expanded={peerMenuOpen}
            aria-haspopup="listbox"
            className="inline-flex items-center justify-center h-8 w-7 rounded-r-md bg-accent text-accent-on hover:bg-accent-hover border-l border-accent-on/30 disabled:opacity-40"
          >
            <ChevronDown aria-hidden size={12} />
          </button>
          {peerMenuOpen && (
            <ul
              role="listbox"
              className="absolute right-0 top-full z-20 mt-1 max-h-60 min-w-[12rem] overflow-y-auto rounded-md border border-line bg-surface shadow-lg"
            >
              {workflow.peers.map((peer) => (
                <li key={peer.uid}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedPeerUid === peer.uid}
                    onClick={() => {
                      setSelectedPeerUid(peer.uid);
                      setPeerMenuOpen(false);
                    }}
                    className={[
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle",
                      selectedPeerUid === peer.uid ? "bg-bg-subtle font-medium" : "",
                    ].join(" ")}
                  >
                    {peer.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {cancelButton}
      </>
    );
  }

  // mode === "full" — OPEN status, plný 6-akční set
  return (
    <>
      <button
        type="button"
        onClick={() => handleSubmit("block")}
        disabled={!canSend}
        title={t("comments.blockReasonRequired")}
        className="inline-flex items-center gap-1 h-8 rounded-md border border-line bg-transparent px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-bg-subtle disabled:opacity-40 transition-colors"
      >
        {t("comments.actionBlock")}
      </button>
      <button
        type="button"
        onClick={() => handleSubmit("complete")}
        disabled={!canSend}
        className="inline-flex items-center gap-1 h-8 rounded-md border border-line bg-transparent px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg-subtle disabled:opacity-40 transition-colors"
      >
        <Check aria-hidden size={12} />
        {t("comments.actionComplete")}
      </button>
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={() => handleSubmit("flip")}
          disabled={!canSend || !selectedPeerUid}
          className="inline-flex items-center gap-1 h-8 rounded-l-md bg-accent px-2.5 py-1 text-xs font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          <CornerDownLeft aria-hidden size={12} />
          {submitting
            ? t("composer.saving")
            : t("comments.flipTo", { name: peerName })}
        </button>
        <button
          type="button"
          onClick={() => setPeerMenuOpen((v) => !v)}
          disabled={workflow.peers.length === 0}
          aria-label={t("comments.pickPeer")}
          aria-expanded={peerMenuOpen}
          aria-haspopup="listbox"
          className="inline-flex items-center justify-center h-8 w-7 rounded-r-md bg-accent text-accent-on hover:bg-accent-hover border-l border-accent-on/30 disabled:opacity-40"
        >
          <ChevronDown aria-hidden size={12} />
        </button>
        {peerMenuOpen && (
          <ul
            role="listbox"
            className="absolute right-0 top-full z-20 mt-1 max-h-60 min-w-[12rem] overflow-y-auto rounded-md border border-line bg-surface shadow-lg"
          >
            {workflow.peers.map((peer) => (
              <li key={peer.uid}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedPeerUid === peer.uid}
                  onClick={() => {
                    setSelectedPeerUid(peer.uid);
                    setPeerMenuOpen(false);
                  }}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-bg-subtle",
                    selectedPeerUid === peer.uid ? "bg-bg-subtle font-medium" : "",
                  ].join(" ")}
                >
                  {peer.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {cancelButton}
    </>
  );
}
