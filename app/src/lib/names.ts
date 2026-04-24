/**
 * V16.1 — sjednocený fallback pro lidská jména napříč UI.
 *
 * Prioritní pořadí (shora dolů):
 *   1) profile.displayName (Firestore — "Přezdívka" editovatelná v Settings)
 *   2) auth.displayName    (Firebase Auth — co přišlo z Googlu při prvním loginu)
 *   3) email local-part    (cokoliv před @)
 *   4) uid (zkrácený)      — poslední záchrana, ať UI nerozbije ""
 *
 * Proč helper: dřív každá komponenta skládala fallback ručně a rozjížděly se
 * (MentionPicker ořezával jinak než CommentItem apod.). Cloud Function
 * `resolveActorName` je konzistentní variantou bez auth fallbacku (CF nemá
 * Firebase Auth), ale pořadí je stejné — profile → email → uid.
 */
export interface NameInput {
  profileDisplayName?: string | null;
  authDisplayName?: string | null;
  email?: string | null;
  uid?: string | null;
}

export function resolveUserName(input: NameInput): string {
  const p = input.profileDisplayName?.trim();
  if (p) return p;
  const a = input.authDisplayName?.trim();
  if (a) return a;
  const e = input.email?.trim();
  if (e) {
    const local = e.split("@")[0];
    if (local) return local;
  }
  const u = input.uid?.trim();
  if (u) return u.slice(0, 6);
  return "—";
}
