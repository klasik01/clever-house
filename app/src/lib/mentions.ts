import type { UserProfile } from "@/types";

/**
 * V25-fix — mention storage formát.
 *
 * NEW (V25-fix): plain `@Name ` v body. Composer si pamatuje vybraná uidy
 *                v separátní `mentionedUids` state a posílá je s commentem.
 *                Render lookuje displayName proti `mentionedUids[]` přes
 *                `byUid` mapu.
 *
 * LEGACY (V3): `@[Display Name](uid)` token. Parser stále podporuje pro
 *              čtení starých komentářů. Nové komenty se píšou v novém
 *              formátu (insertMention produkuje plain `@Name`).
 *
 * Edge case — názvové kolize: pokud workspace má dva uživatele se stejným
 *   displayName, mention mapuje k prvnímu z `mentionedUids[]`. V 5-user
 *   household to není reálný scénář; pokud nastane, OWNER si přidělí
 *   unikátnější displayName v Settings.
 */

// ---------- LEGACY format parser (`@[Name](uid)`) ----------

export const MENTION_RE = /@\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export interface MentionMatch {
  fullMatch: string;       // literal slice "@[Name](uid)"
  displayName: string;
  uid: string;
  start: number;
  end: number;
}

/** Extract all completed legacy `@[Name](uid)` mentions. */
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

/** Unique UIDs from legacy `@[Name](uid)` tokens in body. */
export function extractMentionedUids(body: string): string[] {
  const mentions = parseMentions(body);
  return Array.from(new Set(mentions.map((m) => m.uid)));
}

// ---------- Active query detection (composer typing) ----------

export function detectActiveMention(
  body: string,
  cursor: number
): { text: string; start: number; end: number } | null {
  if (cursor < 0 || cursor > body.length) return null;
  let i = cursor - 1;
  while (i >= 0) {
    const ch = body[i];
    if (ch === "@") {
      const before = i === 0 ? "" : body[i - 1];
      if (i === 0 || /\s/.test(before)) {
        const text = body.slice(i + 1, cursor);
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

// ---------- V25-fix — clean `@Name` insertion ----------

/**
 * Insert clean `@Name ` token. Composer caller MUST track selected uids
 * separately (via `selectedMentionUids` state) — body alone neuchovává uid.
 */
export function insertMention(
  body: string,
  query: { start: number; end: number },
  user: UserProfile
): { body: string; cursor: number } {
  const label = displayNameFor(user);
  // V25-fix — clean format: just `@Name `. uid se posílá v separate
  //   mentionedUids field, ne v body.
  const token = `@${label} `;
  const next = body.slice(0, query.start) + token + body.slice(query.end);
  const cursor = query.start + token.length;
  return { body: next, cursor };
}

function displayNameFor(user: UserProfile): string {
  return (
    (user.displayName ?? "").trim() ||
    (user.email ?? "").split("@")[0] ||
    "user"
  );
}

/** Filter users for picker — case-insensitive substring na displayName/email. */
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

// ---------- Render — split body to text + mention parts ----------

export type BodyPart =
  | { kind: "text"; text: string }
  | { kind: "mention"; uid: string; displayName: string };

/**
 * V25-fix — splits body into text + mention parts.
 *
 * Algoritmus:
 *   1. Najdi všechny LEGACY `@[Name](uid)` tokeny (zachovává backward compat).
 *   2. Pro každý uid v `mentionedUids[]` najdi `@displayName` v body, kde
 *      displayName přijde z `byUid.get(uid).displayName` (nebo email-local
 *      fallback). Skipni rozsahy již pokryté legacy matches.
 *   3. Posortuj všechny matches podle position, postav alternující seznam
 *      text/mention částí.
 *
 * Parametry:
 *   - body: surový text komentáře (mix legacy + V25-fix tokeny)
 *   - mentionedUids: pole uidů z comment.mentionedUids field (V25-fix)
 *   - byUid: mapa uid → UserProfile pro displayName lookup
 *
 * Pokud `mentionedUids` nebo `byUid` chybí, použije se jen legacy parser
 * (backward compat pro starší volání z testů).
 */
export function splitBodyByMentions(
  body: string,
  mentionedUids?: string[],
  byUid?: Map<string, UserProfile>,
): BodyPart[] {
  // 1) Legacy `@[Name](uid)` matches.
  const legacy = parseMentions(body);

  // 2) V25-fix `@Name` matches against mentionedUids + byUid lookup.
  const v25: { start: number; end: number; uid: string; displayName: string }[] = [];
  if (mentionedUids && byUid) {
    for (const uid of mentionedUids) {
      const profile = byUid.get(uid);
      if (!profile) continue;
      const name = displayNameFor(profile);
      if (!name) continue;
      // Match `@${name}` at word boundary. Special chars in name are escaped.
      const re = new RegExp(`@${escapeRegex(name)}(?=\\b|\\s|$|[.,;!?])`, "gu");
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const start = m.index;
        const end = m.index + m[0].length;
        // Skip if overlaps with a legacy match (legacy wins for substring conflicts).
        const overlap = legacy.some((l) => start < l.end && end > l.start);
        if (!overlap) {
          v25.push({ start, end, uid, displayName: name });
        }
      }
    }
  }

  // 3) Combine + sort by start.
  const all = [
    ...legacy.map((l) => ({
      start: l.start,
      end: l.end,
      uid: l.uid,
      displayName: l.displayName,
    })),
    ...v25,
  ].sort((a, b) => a.start - b.start);

  if (all.length === 0) return [{ kind: "text", text: body }];

  const parts: BodyPart[] = [];
  let cursor = 0;
  for (const m of all) {
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
