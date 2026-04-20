import { useEffect } from "react";
import { useT } from "@/i18n/useT";
import { X } from "lucide-react";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** Minimal fullscreen image viewer. Close on backdrop click, Esc key, or X button. */
export default function Lightbox({ src, alt, onClose }: Props) {
  const t = useT();
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("aria.imagePreview")}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 pt-safe pb-safe"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="absolute top-[max(env(safe-area-inset-top,0px),1rem)] right-4 z-10 grid min-h-tap min-w-tap place-items-center rounded-pill bg-black/60 text-white"
      >
        <X aria-hidden size={20} />
      </button>
      <img
        src={src}
        alt={alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain"
      />
    </div>
  );
}
