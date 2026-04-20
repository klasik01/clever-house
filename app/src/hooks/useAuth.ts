import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
}

/** Subscribes to Firebase auth state; returns loading=true until first event. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
  }, []);
  return state;
}
