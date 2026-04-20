import { useEffect, useState } from "react";
import { subscribeUserProfile } from "@/lib/userProfile";
import type { UserProfile } from "@/types";

type State =
  | { status: "loading"; profile: null }
  | { status: "ready"; profile: UserProfile }
  | { status: "missing"; profile: null }
  | { status: "error"; profile: null };

export function useUserRole(uid: string | undefined): State {
  const [state, setState] = useState<State>({ status: "loading", profile: null });

  useEffect(() => {
    if (!uid) {
      setState({ status: "loading", profile: null });
      return;
    }
    const unsub = subscribeUserProfile(
      uid,
      (profile) =>
        profile
          ? setState({ status: "ready", profile })
          : setState({ status: "missing", profile: null }),
      () => setState({ status: "error", profile: null })
    );
    return unsub;
  }, [uid]);

  return state;
}
