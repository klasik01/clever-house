/** Minimal, collision-resistant ID generator for local tasks.
 *  In S02 Firestore will auto-generate IDs; we keep this for offline drafts. */
export function newId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}
