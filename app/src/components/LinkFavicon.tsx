import {
  Facebook,
  Github,
  Instagram,
  Link as LinkIcon,
  Linkedin,
  Map,
  Music,
  Twitter,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * V14.11 — Detect a well-known service from a URL's hostname and render its
 * branded lucide icon. Falls back to the generic Link glyph for anything we
 * don't recognise.
 *
 * Why hardcoded: browser favicon fetches require network + CORS-friendly
 * hosts, and third-party favicon services (Google s2) leak user URLs to
 * those providers on every render. A short hand-maintained map covers the
 * sites that actually show up in house-build planning (social, maps,
 * pricelists-as-photos, referenced GitHub issues, …) without either.
 *
 * Add a new entry by appending to BRAND_MAP — match is tested against the
 * *hostname* only (not path / query), so pin with end-anchors:
 *   /(?:^|\.)example\.com$/i
 * The leading `(?:^|\.)` lets www.example.com and subdomain.example.com
 * match the same rule.
 */
const BRAND_MAP: Array<{ match: RegExp; icon: LucideIcon; label: string }> = [
  { match: /(?:^|\.)instagram\.com$/i, icon: Instagram, label: "Instagram" },
  { match: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i, icon: Youtube, label: "YouTube" },
  { match: /(?:^|\.)(?:facebook\.com|fb\.com|m\.facebook\.com)$/i, icon: Facebook, label: "Facebook" },
  { match: /(?:^|\.)(?:twitter\.com|x\.com|t\.co)$/i, icon: Twitter, label: "X" },
  { match: /(?:^|\.)linkedin\.com$/i, icon: Linkedin, label: "LinkedIn" },
  { match: /(?:^|\.)github\.com$/i, icon: Github, label: "GitHub" },
  // Maps: Czech Mapy.cz + Google Maps + OpenStreetMap + Apple Maps
  {
    match: /(?:^|\.)(?:mapy\.cz|maps\.google\.com|goo\.gl|openstreetmap\.org|maps\.apple\.com)$/i,
    icon: Map,
    label: "Mapy",
  },
  // Audio / music
  { match: /(?:^|\.)(?:spotify\.com|open\.spotify\.com|soundcloud\.com)$/i, icon: Music, label: "Audio" },
];

interface Props {
  url: string;
  size?: number;
  className?: string;
}

/**
 * Returns a lucide icon component matching the URL's hostname, plus a label
 * suitable for aria-label / tooltip. Public API kept small on purpose.
 */
export function linkBrand(url: string): { Icon: LucideIcon; label: string } {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = "";
  }
  if (host.startsWith("www.")) host = host.slice(4);
  const entry = BRAND_MAP.find((b) => b.match.test(host));
  if (entry) return { Icon: entry.icon, label: entry.label };
  return { Icon: LinkIcon, label: "Odkaz" };
}

export default function LinkFavicon({ url, size = 14, className }: Props) {
  const { Icon, label } = linkBrand(url);
  return <Icon aria-label={label} size={size} className={className} />;
}
