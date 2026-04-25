import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import {
  slugifyLocation,
  createLocation,
  renameLocation,
  setLocationGroup,
  deleteLocation,
  seedLocationsIfEmpty,
  getLocation,
  _setLocationsRuntimeCache,
  locationsByGroup,
  DEFAULT_LOCATIONS,
} from "./locations";

beforeEach(() => {
  __firestoreState.reset();
  // Clear runtime cache between tests by installing an empty list.
  _setLocationsRuntimeCache([]);
});

describe("slugifyLocation", () => {
  it("normalises Czech diacritics", () => {
    expect(slugifyLocation("Ložnice")).toBe("loznice");
    expect(slugifyLocation("Kuchyň")).toBe("kuchyn");
    expect(slugifyLocation("Venkovní posezení")).toBe("venkovni-posezeni");
  });

  it("collapses punctuation + spaces into hyphens", () => {
    expect(slugifyLocation("Kuchyň & Koupelna")).toBe("kuchyn-koupelna");
    expect(slugifyLocation("   extra   spaces  ")).toBe("extra-spaces");
  });

  it("returns a non-empty fallback for edge cases", () => {
    const id = slugifyLocation("!!!");
    expect(id.startsWith("loc-")).toBe(true);
  });
});

describe("createLocation", () => {
  it("writes a doc with slug id + group + createdBy", async () => {
    const id = await createLocation("Komora", "dum", "owner");
    expect(id).toBe("komora");
    const doc = __firestoreState.store.get("locations/komora") as Record<string, unknown>;
    expect(doc.label).toBe("Komora");
    expect(doc.group).toBe("dum");
    expect(doc.createdBy).toBe("owner");
  });

  it("appends a suffix when the slug already exists in cache (collision)", async () => {
    _setLocationsRuntimeCache([
      { id: "komora", label: "Komora", group: "dum" },
    ]);
    const id = await createLocation("Komora", "dum", "owner");
    expect(id).not.toBe("komora");
    expect(id.startsWith("komora-")).toBe(true);
  });

  it("rejects empty label", async () => {
    await expect(createLocation("   ", "dum", "owner")).rejects.toThrow();
  });
});

describe("renameLocation / setLocationGroup / deleteLocation", () => {
  beforeEach(() => {
    __firestoreState.store.set("locations/kuchyn", {
      label: "Kuchyň",
      group: "dum",
      createdBy: "u",
    });
  });

  it("renameLocation updates the label (trimmed)", async () => {
    await renameLocation("kuchyn", "  Velká kuchyň  ");
    const d = __firestoreState.store.get("locations/kuchyn") as Record<string, unknown>;
    expect(d.label).toBe("Velká kuchyň");
    expect(d.group).toBe("dum");
  });

  it("renameLocation rejects empty label", async () => {
    await expect(renameLocation("kuchyn", "  ")).rejects.toThrow();
  });

  it("setLocationGroup moves the record between groups", async () => {
    await setLocationGroup("kuchyn", "site");
    const d = __firestoreState.store.get("locations/kuchyn") as Record<string, unknown>;
    expect(d.group).toBe("site");
    // Label untouched
    expect(d.label).toBe("Kuchyň");
  });

  it("deleteLocation removes the doc", async () => {
    await deleteLocation("kuchyn");
    expect(__firestoreState.store.has("locations/kuchyn")).toBe(false);
  });
});

describe("seedLocationsIfEmpty", () => {
  it("seeds DEFAULT_LOCATIONS when empty — same slug IDs", async () => {
    await seedLocationsIfEmpty("owner");
    for (const def of DEFAULT_LOCATIONS) {
      const d = __firestoreState.store.get(`locations/${def.id}`) as Record<string, unknown>;
      expect(d).toBeTruthy();
      expect(d.label).toBe(def.label);
      expect(d.group).toBe(def.group);
    }
  });

  it("is idempotent — no re-seed when any doc already exists", async () => {
    __firestoreState.store.set("locations/custom", {
      label: "Moje místo",
      group: "dum",
    });
    await seedLocationsIfEmpty("owner");
    const locDocs = Array.from(__firestoreState.store.keys()).filter((k) =>
      k.startsWith("locations/"),
    );
    expect(locDocs).toEqual(["locations/custom"]);
  });
});

describe("getLocation + runtime cache", () => {
  it("returns the cached Location when present", () => {
    _setLocationsRuntimeCache([
      { id: "my-place", label: "Moje místo", group: "site" },
    ]);
    expect(getLocation("my-place")?.label).toBe("Moje místo");
  });

  it("V18-S29 — vrátí undefined když cache nemapuje id (no DEFAULT fallback)", () => {
    _setLocationsRuntimeCache([]);
    expect(getLocation("kuchyn")).toBeUndefined();
  });

  it("returns undefined for null/undefined id", () => {
    expect(getLocation(null)).toBeUndefined();
    expect(getLocation(undefined)).toBeUndefined();
  });
});

describe("locationsByGroup", () => {
  it("returns the three V7 groups in order, each sorted by label (cs locale)", () => {
    const out = locationsByGroup([
      { id: "a", label: "Žula", group: "pozemek" },
      { id: "b", label: "Čekárna", group: "pozemek" },
      { id: "c", label: "Altán", group: "pozemek" },
    ]);
    expect(out.map((g) => g.group)).toEqual(["pozemek", "dum", "site"]);
    expect(out[0].items.map((i) => i.label)).toEqual(["Altán", "Čekárna", "Žula"]);
    expect(out[1].items).toEqual([]); // dum empty in this fixture
  });
});
