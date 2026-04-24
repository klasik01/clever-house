import { describe, it, expect } from "vitest";
import {
  isRealFlip,
  pickDefaultPeer,
  type PeerOption,
} from "./commentTargeting";

const peers: PeerOption[] = [
  { uid: "alice", displayName: "Alice" },
  { uid: "bob", displayName: "Bob" },
];

describe("pickDefaultPeer — V17.3", () => {
  it("pokud je task assignutý na někoho jiného než já, default = assignee", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "bob", createdBy: "alice" },
      currentUserUid: "me",
      comments: [],
      peers,
    });
    expect(r).toBe("bob");
  });

  it("když je assignee=já, spadne na posledního flippera na mě", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "me", createdBy: "alice" },
      currentUserUid: "me",
      comments: [
        // newest first
        {
          workflowAction: "flip",
          assigneeAfter: "me",
          authorUid: "bob",
        },
      ],
      peers,
    });
    expect(r).toBe("bob");
  });

  it("bez prior flipu → autor tasku pokud není to já", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: null, createdBy: "alice" },
      currentUserUid: "me",
      comments: [],
      peers,
    });
    expect(r).toBe("alice");
  });

  it("assignee=já + autor=já → první peer", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "me", createdBy: "me" },
      currentUserUid: "me",
      comments: [],
      peers,
    });
    expect(r).toBe("alice");
  });

  it("prázdný workspace (peers=[]) a nic z výše → null", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "me", createdBy: "me" },
      currentUserUid: "me",
      comments: [],
      peers: [],
    });
    expect(r).toBeNull();
  });

  it("ignoruje flipy kde jsem sám autor komentáře", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "me", createdBy: "alice" },
      currentUserUid: "me",
      comments: [
        {
          workflowAction: "flip",
          assigneeAfter: "me",
          // self-flip je nesmysl, ale obrana proti divným datům
          authorUid: "me",
        },
      ],
      peers,
    });
    // Protože flip je odfiltrovaný (authorUid === me), padne na task.createdBy
    expect(r).toBe("alice");
  });

  it("null currentUserUid → null (unauthorized)", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "bob", createdBy: "alice" },
      currentUserUid: null,
      comments: [],
      peers,
    });
    expect(r).toBeNull();
  });

  it("preferuje assignee před prior flipperem", () => {
    const r = pickDefaultPeer({
      task: { assigneeUid: "bob", createdBy: "alice" },
      currentUserUid: "me",
      comments: [
        { workflowAction: "flip", assigneeAfter: "me", authorUid: "alice" },
      ],
      peers,
    });
    // Bob má aktuálně míč → bob wins nad alicí-flipperem
    expect(r).toBe("bob");
  });
});

describe("isRealFlip — V17.3", () => {
  it("reálný flip když se assignee mění", () => {
    expect(
      isRealFlip({
        action: "flip",
        workflowEnabled: true,
        targetUid: "bob",
        currentAssigneeUid: "alice",
      }),
    ).toBe(true);
  });

  it("no-op když target === current", () => {
    expect(
      isRealFlip({
        action: "flip",
        workflowEnabled: true,
        targetUid: "bob",
        currentAssigneeUid: "bob",
      }),
    ).toBe(false);
  });

  it("no-op když action není 'flip'", () => {
    expect(
      isRealFlip({
        action: "close",
        workflowEnabled: true,
        targetUid: "bob",
        currentAssigneeUid: "alice",
      }),
    ).toBe(false);
    expect(
      isRealFlip({
        action: null,
        workflowEnabled: true,
        targetUid: "bob",
        currentAssigneeUid: "alice",
      }),
    ).toBe(false);
  });

  it("workflow disabled (napad, closed task) → vždy false", () => {
    expect(
      isRealFlip({
        action: "flip",
        workflowEnabled: false,
        targetUid: "bob",
        currentAssigneeUid: "alice",
      }),
    ).toBe(false);
  });

  it("target=null → false (nelze flipovat na nic)", () => {
    expect(
      isRealFlip({
        action: "flip",
        workflowEnabled: true,
        targetUid: null,
        currentAssigneeUid: "alice",
      }),
    ).toBe(false);
  });

  it("current=null + target=bob → skutečný flip (přiřazuju prvně)", () => {
    expect(
      isRealFlip({
        action: "flip",
        workflowEnabled: true,
        targetUid: "bob",
        currentAssigneeUid: null,
      }),
    ).toBe(true);
  });
});
