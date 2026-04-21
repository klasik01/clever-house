import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { UserProfile, UserRole } from "@/types";

/** Subscribe to /users/{uid} — source of truth for role. */
export function subscribeUserProfile(
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data();
      const role = (data.role as UserRole | undefined) ?? "OWNER";
      onChange({
        uid,
        email: data.email ?? "",
        role,
        displayName: data.displayName ?? null,
      });
    },
    (err) => onError(err)
  );
}


/**
 * Subscribe to /users collection — realtime list of all workspace members.
 * Used by V3 mention autocomplete + assignee dropdown + comment author render.
 */
export function subscribeUsers(
  onChange: (users: UserProfile[]) => void,
  onError: (err: Error) => void
): () => void {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const users: UserProfile[] = snap.docs.map((d) => {
        const data = d.data();
        const role = (data.role as UserRole | undefined) ?? "OWNER";
        return {
          uid: d.id,
          email: data.email ?? "",
          role,
          displayName: data.displayName ?? null,
        };
      });
      onChange(users);
    },
    (err) => onError(err)
  );
}
