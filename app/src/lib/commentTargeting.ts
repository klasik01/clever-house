import type { Comment, Task } from "@/types";

/**
 * V17.3 — logika výchozího "Komu" pickeru v comment composeru.
 *
 * Priorita (first-wins):
 *   1. task.assigneeUid, pokud je to někdo jiný než já (default = ten kdo má míč).
 *   2. Poslední user co na mě flipnul (prior comment.workflowAction="flip"
 *      s assigneeAfter===me, autor !== me).
 *   3. task.createdBy (pokud není to já — hodí míček zpátky autorovi).
 *   4. První peer z abecedně seřazeného seznamu.
 *   5. null (žádný peer, prázdný workspace / jen já).
 *
 * Pure — žádný React, žádný Firestore. Stejný algoritmus co běží v
 * CommentThread.tsx:defaultPeerUid (testovaný zde).
 */

export interface PeerOption {
  uid: string;
  displayName: string;
}

export interface PickDefaultPeerInput {
  task: Pick<Task, "assigneeUid" | "createdBy">;
  currentUserUid: string | null | undefined;
  /** Thread komentáře seřazené newest-first. */
  comments: Pick<Comment, "workflowAction" | "assigneeAfter" | "authorUid">[];
  /** Peers bez aktuálního uživatele, seřazení alfabeticky. */
  peers: PeerOption[];
}

export function pickDefaultPeer(input: PickDefaultPeerInput): string | null {
  const { task, currentUserUid, comments, peers } = input;
  if (!currentUserUid) return null;

  // 1) Current assignee (komu je aktuálně přiřazené) — primární default.
  if (task.assigneeUid && task.assigneeUid !== currentUserUid) {
    return task.assigneeUid;
  }

  // 2) Poslední flipper na mě.
  const prior = comments.find(
    (c) =>
      c.workflowAction === "flip" &&
      c.assigneeAfter === currentUserUid &&
      c.authorUid !== currentUserUid,
  );
  if (prior?.authorUid) return prior.authorUid;

  // 3) Autor tasku, pokud to nejsem já.
  if (task.createdBy && task.createdBy !== currentUserUid) {
    return task.createdBy;
  }

  // 4) Cokoli z seznamu peerů.
  return peers[0]?.uid ?? null;
}

/**
 * V17.3 — detekuje, zda "flip" akce v composer je reálný přehod assignee,
 * nebo jen plain komentář se selectorem na current assignee (no-op).
 *
 * Real flip = workflow enabled + user zvolil jiný peer než current assignee.
 */
export interface IsRealFlipInput {
  action: "flip" | "close" | null | undefined;
  workflowEnabled: boolean;
  targetUid: string | null | undefined;
  currentAssigneeUid: string | null | undefined;
}

export function isRealFlip(input: IsRealFlipInput): boolean {
  if (input.action !== "flip") return false;
  if (!input.workflowEnabled) return false;
  if (!input.targetUid) return false;
  return input.targetUid !== (input.currentAssigneeUid ?? null);
}
