/** Extract a user-friendly domain (without "www.") from a URL.
 *  Returns null if the string is not a parseable URL. */
export function parseDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

/** Normalize user input: add https:// if missing, trim whitespace. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProto);
    // Must have a TLD-like hostname
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}
