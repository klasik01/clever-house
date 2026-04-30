import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/useT";
import { Share2, X } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  /** V26 — image (default) or video. Video gets <video controls>. */
  kind?: "image" | "video";
  /** V26 — povolit Share button (Web Share API). Default false — sharing
   *  jen tam, kde to dává smysl (např. hlášení), ne dokumenty. */
  shareable?: boolean;
  /** Volitelný file name pro Web Share. Default odvodí ze src. */
  shareFilename?: string;
  /** Volitelný title pro Share sheet. */
  shareTitle?: string;
  onClose: () => void;
}

/**
 * V26 — Minimal fullscreen media viewer (image / video).
 * Close on backdrop click, Esc key, or X button.
 *
 * Renders přes React portal do document.body — escape z containing-block
 * (např. backdrop-blur ancestor v navigaci nebo jiný popup).
 *
 * V26-fix — volitelné share přes Web Share API (`navigator.share({ files })`).
 * Funguje na iOS Safari 16.4+, Chrome 90+, modern Edge. Pokud browser
 * nepodporuje, button se nezobrazí (graceful degradation).
 */
export default function Lightbox({
  src,
  alt,
  kind = "image",
  shareable = false,
  shareFilename,
  shareTitle,
  onClose,
}: Props) {
  const t = useT();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // V26-fix — share button zobrazený jen pokud caller povolil + browser
  //   podporuje navigator.share s file payload.
  const canShare =
    shareable
    && typeof navigator !== "undefined"
    && typeof navigator.share === "function";

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      // V26-fix — fetch URL → Blob. Firebase Storage CORS default je
      //   povoleno všemi origin, takže fetch() funguje bez další konfigurace.
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let blob = await res.blob();
      let filename = shareFilename ?? deriveFilename(src, kind, blob.type);

      // V26-fix — iOS share sheet nepodporuje WebP. Converti na JPEG přes
      //   canvas pokud je image WebP. Video (mp4/mov) nech as-is.
      if (kind === "image" && blob.type === "image/webp") {
        try {
          blob = await convertWebPToJpeg(blob);
          filename = filename.replace(/\.webp$/i, ".jpg");
        } catch (convErr) {
          console.warn("webp→jpeg convert failed, fallback to original", convErr);
        }
      }

      const file = new File([blob], filename, { type: blob.type });

      const data: ShareData = {
        files: [file],
        title: shareTitle,
      };
      // canShare check — pokud false, throw s detailem.
      if (
        typeof navigator.canShare === "function"
        && !navigator.canShare(data)
      ) {
        throw new Error(`canShare=false (mime ${blob.type})`);
      }
      await navigator.share(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // user zavřel share sheet — silent
        return;
      }
      // V26-fix — fallback: otevři v novém tabu pokud share fail. iOS Safari
      //   pak long-press → standardní share menu z webu.
      console.warn("share failed, fallback open in new tab", err);
      const detail = err instanceof Error ? err.message : String(err);
      setShareError(`${t("lightbox.shareFailed")}: ${detail}`);
      window.open(src, "_blank", "noopener");
      setTimeout(() => setShareError(null), 4000);
    } finally {
      setSharing(false);
    }
  }

  /** WebP → JPEG via canvas. iOS share sheet podporuje JPEG univerzálně. */
  async function convertWebPToJpeg(webpBlob: Blob): Promise<Blob> {
    const url = URL.createObjectURL(webpBlob);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context missing");
      ctx.drawImage(img, 0, 0);
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
          "image/jpeg",
          0.9,
        );
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("aria.imagePreview")}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 pt-safe pb-safe"
    >
      <div
        className="absolute top-[max(env(safe-area-inset-top,0px),1rem)] right-4 z-10 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            aria-label={t("lightbox.share")}
            className="grid min-h-tap min-w-tap place-items-center rounded-pill bg-black/60 text-white hover:bg-black/80 disabled:opacity-40 transition-colors"
          >
            <Share2 aria-hidden size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid min-h-tap min-w-tap place-items-center rounded-pill bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <X aria-hidden size={20} />
        </button>
      </div>
      {shareError && (
        <div
          role="alert"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-[max(env(safe-area-inset-top,0px),4rem)] left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-3 py-1.5 text-xs text-white"
        >
          {shareError}
        </div>
      )}
      {kind === "video" ? (
        <video
          src={src}
          controls
          autoPlay
          playsInline
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-md bg-black"
        />
      ) : (
        <img
          src={src}
          alt={alt ?? ""}
          loading="eager"
          decoding="async"
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-md object-contain"
        />
      )}
    </div>,
    document.body,
  );
}

function deriveFilename(src: string, kind: "image" | "video", mime: string): string {
  // Try to extract from URL path; strip query string.
  try {
    const u = new URL(src);
    const last = u.pathname.split("/").pop() ?? "";
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  // Fallback by mime type
  const ext = mime.split("/")[1]?.split(";")[0] ?? (kind === "video" ? "mp4" : "jpg");
  return `${kind}.${ext}`;
}
