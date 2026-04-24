import { describe, it, expect } from "vitest";
import { protistrana } from "./protistrana";

describe("protistrana — V16.4 scalar change recipient picker", () => {
  it("autor edituje vlastní task → pošle assignee", () => {
    const r = protistrana({
      actorUid: "owner",
      createdBy: "owner",
      assigneeUid: "pm",
    });
    expect(r).toBe("pm");
  });

  it("assignee edituje svůj task → pošle autorovi", () => {
    const r = protistrana({
      actorUid: "pm",
      createdBy: "owner",
      assigneeUid: "pm",
    });
    expect(r).toBe("owner");
  });

  it("assignee == autor (self-assigned), edituje sám → nikomu (null)", () => {
    const r = protistrana({
      actorUid: "owner",
      createdBy: "owner",
      assigneeUid: "owner",
    });
    expect(r).toBeNull();
  });

  it("task bez assignee → nikomu (null)", () => {
    const r = protistrana({
      actorUid: "owner",
      createdBy: "owner",
      assigneeUid: null,
    });
    expect(r).toBeNull();
  });

  it("task s assignee=undefined → nikomu", () => {
    const r = protistrana({
      actorUid: "owner",
      createdBy: "owner",
      assigneeUid: undefined,
    });
    expect(r).toBeNull();
  });

  it("třetí strana (ani autor ani assignee) edituje → pošle assignee (ten má míč)", () => {
    const r = protistrana({
      actorUid: "admin",
      createdBy: "owner",
      assigneeUid: "pm",
    });
    expect(r).toBe("pm");
  });

  it("když je assignee = actor a autor = assignee — nic nepošle", () => {
    // Nemožný výraz v kódu (actor = assignee a zároveň assignee = author):
    // pokud actor=assignee a author=assignee, pak actor=author. Takže self-loop.
    const r = protistrana({
      actorUid: "me",
      createdBy: "me",
      assigneeUid: "me",
    });
    expect(r).toBeNull();
  });

  it("actor nikdy není v návratu (základní self-filter)", () => {
    // Pokrývám case že když protistrana vrátí hodnotu, není to actor.
    const cases = [
      { actorUid: "a", createdBy: "a", assigneeUid: "b" }, // → b
      { actorUid: "a", createdBy: "b", assigneeUid: "a" }, // → b
      { actorUid: "c", createdBy: "a", assigneeUid: "b" }, // → b
    ];
    for (const c of cases) {
      const r = protistrana(c);
      if (r !== null) {
        expect(r).not.toBe(c.actorUid);
      }
    }
  });
});
