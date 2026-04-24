import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { mergePrefsWithDefaults } from "./notifications";
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
        notificationPrefs: mergePrefsWithDefaults(data.notificationPrefs),
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
          notificationPrefs: mergePrefsWithDefaults(data.notificationPrefs),
        };
      });
      onChange(users);
    },
    (err) => onError(err)
  );
}


/**
 * V16.1 — self-update displayName ("Přezdívka"). Píše do /users/{uid}.
 * Rules povolují tento field v diff.affectedKeys vedle notificationPrefs,
 * ostatní fieldy (role, email) jsou Admin-SDK only.
 *
 * Prázdný string → null (vrátí uživatele zpátky na auth/email fallback).
 */
export async function updateUserDisplayName(
  uid: string,
  displayName: string,
): Promise<void> {
  const next = displayName.trim();
  await updateDoc(doc(db, "users", uid), {
    displayName: next.length ? next : null,
  });
}
