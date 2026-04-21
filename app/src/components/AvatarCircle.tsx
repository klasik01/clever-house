import { useT } from "@/i18n/useT";

type Size = "sm" | "md" | "lg";

interface Props {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  size?: Size;
  /** Optional className for caller layout tweaks. */
  className?: string;
}

/**
 * AvatarCircle — deterministic 8-seed gradient + initials.
 * Uses tokens-v3.css --avatar-<N>-from/to CSS variables so the gradient
 * respects light/dark mode automatically.
 *
 * Seed selection: hash(uid) % 8. Same UID always yields same gradient.
 * White initials on all 8 seeds verified for WCAG AA (>=4.5:1).
 */
export default function AvatarCircle({
  uid,
  displayName,
  email,
  size = "md",
  className,
}: Props) {
  const t = useT();
  const seed = avatarSeed(uid || email || "");
  const initials = computeInitials(displayName, email);

  const dims: Record<Size, string> = {
    sm: "size-6 text-[0.6rem]",
    md: "size-8 text-xs",
    lg: "size-12 text-sm",
  };

  const aria = displayName || email || t("avatar.ariaLabel");

  return (
    <span
      role="img"
      aria-label={aria}
      title={aria}
      className={[
        "inline-grid place-items-center rounded-full font-semibold text-white select-none shrink-0",
        dims[size],
        className ?? "",
      ].join(" ")}
      style={{
        background: `linear-gradient(135deg, var(--avatar-${seed}-from), var(--avatar-${seed}-to))`,
      }}
    >
      {initials}
    </span>
  );
}

/** Deterministic hash → 0..7 seed index. */
export function avatarSeed(input: string): number {
  if (!input) return 0;
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 8;
}

function computeInitials(displayName?: string | null, email?: string | null): string {
  const src = (displayName ?? "").trim() || (email ?? "").split("@")[0] || "";
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}
