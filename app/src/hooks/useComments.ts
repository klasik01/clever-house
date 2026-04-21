import { useEffect, useState } from "react";
import { subscribeComments } from "@/lib/comments";
import type { Comment } from "@/types";

interface CommentsState {
  comments: Comment[];
  loading: boolean;
  error: Error | null;
}

/** Realtime comments subscription for one task. Cleans up on unmount or :id change. */
export function useComments(taskId: string | undefined): CommentsState {
  const [state, setState] = useState<CommentsState>({
    comments: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!taskId) {
      setState({ comments: [], loading: false, error: null });
      return;
    }
    setState({ comments: [], loading: true, error: null });
    const unsub = subscribeComments(
      taskId,
      (comments) => setState({ comments, loading: false, error: null }),
      (error) => setState((prev) => ({ ...prev, loading: false, error }))
    );
    return unsub;
  }, [taskId]);

  return state;
}
