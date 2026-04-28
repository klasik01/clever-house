import { useMemo } from "react";
import { useTasks } from "./useTasks";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";
import { canViewTask } from "@/lib/permissions";

/**
 * V23 — wraps useTasks with client-side visibility filter.
 *
 * OWNER sees all tasks. PM sees only tasks where:
 *   - sharedWithRoles includes "PROJECT_MANAGER", or
 *   - they are the author, or
 *   - they are the assignee.
 *
 * Returns the same shape as useTasks plus `allTasks` (unfiltered)
 * for cross-type linked task resolution (NapadCard).
 */
export function useVisibleTasks(enabled: boolean) {
  const { user } = useAuth();
  const roleState = useUserRole(user?.uid);
  const { tasks: raw, loading, error } = useTasks(enabled);

  const currentRole = roleState.status === "ready" ? roleState.profile.role : null;

  const tasks = useMemo(() => {
    if (!currentRole) return raw; // still loading role — show all, will re-filter
    return raw.filter((task) =>
      canViewTask({ task, currentUserUid: user?.uid, currentUserRole: currentRole }),
    );
  }, [raw, currentRole, user?.uid]);

  return {
    /** Filtered tasks — respects sharedWithRoles visibility. */
    tasks,
    /** Unfiltered tasks — for linked task resolution across types. */
    allTasks: raw,
    loading: loading || roleState.status === "loading",
    error,
  };
}
