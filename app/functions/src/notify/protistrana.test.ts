import { describe, it, expect } from "vitest";
import { protistrana } from "./protistrana";

/**
 * V16.4 + V20 — protistrana pure helper testy.
 */

describe("protistrana", () => {
  it("assignee mění → pošli autorovi", () => {
    expect(
      protistrana({ actorUid: "assignee", createdBy: "author", assigneeUid: "assignee" }),
    ).toBe("author");
  });

  it("autor mění → pošli assignee", () => {
    expect(
      protistrana({ actorUid: "author", createdBy: "author", assigneeUid: "bob" }),
    ).toBe("bob");
  });

  it("třetí strana mění → pošli assignee (má míč)", () => {
    expect(
      protistrana({ actorUid: "pm", createdBy: "author", assigneeUid: "bob" }),
    ).toBe("bob");
  });

  it("self-loop (autor = assignee, sám mění) → null", () => {
    expect(
      protistrana({ actorUid: "me", createdBy: "me", assigneeUid: "me" }),
    ).toBeNull();
  });

  it("bez assignee → null (nikdo nemá míč)", () => {
    expect(
      protistrana({ actorUid: "author", createdBy: "author", assigneeUid: null }),
    ).toBeNull();
  });

  it("undefined assignee → null", () => {
    expect(
      protistrana({ actorUid: "author", createdBy: "author", assigneeUid: undefined }),
    ).toBeNull();
  });

  // V20 — dokumentace tasky typicky nemají assignee
  it("dokumentace bez assignee (typický V20 scénář) → null", () => {
    // Dokumentace nemá přiřazeného — protistrana nemá komu poslat.
    expect(
      protistrana({ actorUid: "owner", createdBy: "owner", assigneeUid: null }),
    ).toBeNull();
    expect(
      protistrana({ actorUid: "pm", createdBy: "owner", assigneeUid: undefined }),
    ).toBeNull();
  });
});
