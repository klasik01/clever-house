import type { UserProfile } from "@/types";

/**
 * Mention storage format: `@[Display Name](uid)` — parseable, copy-friendly,
 * works as plain markdown (renderers without mention support just show the name).
 *
 * Mention regex — matches a completed mention token in body:
 *   capture 1: display name
 *   capture 2: uid
 */
export const MENTION_RE = /@\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export interface MentionMatch {
  fullMatch: string;       // literal slice "@[Name](uid)"
  displayName: string;
  uid: string;
  start: number;           // index in body
  end: number;             // exclusive
}

/** Extract all completed mentions from a body string. */
export function parseMentions(body: string): MentionMatch[] {
  const out: MentionMatch[] = [];
  const re = new RegExp(MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push({
      fullMatch: m[0],
      displayName: m[1],
      uid: m[2],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/** Unique UIDs mentioned in body — use for `mentionedUids` field on save. */
export function extractMentionedUids(body: string): string[] {
  const mentions = parseMentions(body);
  return Array.from(new Set(mentions.map((m) => m.uid)));
}

/**
 * Active-query detection at the caret:
 * returns the token being typed iff the caret is inside an `@word` at word-start.
 *
 * Examples (| = caret):
 *   "hi @ja|" → { text: "ja", start: 3, end: 6 }
 *   "foo@ja|" → null (not preceded by whitespace/start)
 *   "@|"      → { text: "", start: 0, end: 1 } — shows all users
 *   "@john |" → null (caret past word end)
 */
export function detectActiveMention(
  body: string,
  cursor: number
): { text: string; start: number; end: number } | null {
  if (cursor < 0 || cursor > body.length) return null;
  // Walk backwards from cursor looking for "@" preceded by start/whitespace.
  let i = cursor - 1;
  while (i >= 0) {
    const ch = body[i];
    if (ch === "@") {
      const before = i === 0 ? "" : body[i - 1];
      if (i === 0 || /\s/.test(before)) {
        const text = body.slice(i + 1, cursor);
        // Accept only if query chars are word-like (letters, digits, _ -)
        if (/^[\p{L}\p{N}_-]*$/u.test(text)) {
          return { text, start: i, end: cursor };
        }
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

/** Insert `@[displayName](uid)` into body, replacing the active query range. */
export function insertMention(
  body: string,
  query: { start: number; end: number },
  user: UserProfile
): { body: string; cursor: number } {
  const label =
    (user.displayName ?? "").trim() ||
    (user.email ?? "").split("@")[0] ||
    "user";
  const token = `@[${label}](${user.uid}) `;
  const next = body.slice(0, query.start) + token + body.slice(query.end);
  const cursor = query.start + token.length;
  return { body: next, cursor };
}

/**
 * Filter workspace users by the active query text — case-insensitive substring
 * match on displayName or email local part.
 */
export function filterUsersForMention(
  users: UserProfile[],
  query: string,
  limit = 8
): UserProfile[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return users.slice(0, limit);
  return users
    .filter((u) => {
      const name = (u.displayName ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      const local = email.split("@")[0];
      return name.includes(needle) || email.includes(needle) || local.includes(needle);
    })
    .slice(0, limit);
}

/**
 * Split body into parts: alternating strings and mentions, in document order.
 * Used by the comment renderer to intersperse <MentionChip> nodes.
 */
export type BodyPart =
  | { kind: "text"; text: string }
  | { kind: "mention"; uid: string; displayName: string };

export function splitBodyByMentions(body: string): BodyPart[] {
  const mentions = parseMentions(body);
  if (mentions.length === 0) return [{ kind: "text", text: body }];
  const parts: BodyPart[] = [];
  let cursor = 0;
  for (const m of mentions) {
    if (m.start > cursor) {
      parts.push({ kind: "text", text: body.slice(cursor, m.start) });
    }
    parts.push({ kind: "mention", uid: m.uid, displayName: m.displayName });
    cursor = m.end;
  }
  if (cursor < body.length) {
    parts.push({ kind: "text", text: body.slice(cursor) });
  }
  return parts;
}
