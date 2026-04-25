import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("firebase/firestore", () => import("@/test/firestoreMock"));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { __firestoreState } from "@/test/firestoreMock";
import {
  buildCalendarUrl,
  ensureCalendarToken,
  generateCalendarToken,
  rotateCalendarToken,
} from "./calendarToken";

beforeEach(() => __firestoreState.reset());

describe("generateCalendarToken (pure)", () => {
  it("vrátí URL-safe string délky aspoň 20 znaků", () => {
    const tok = generateCalendarToken();
    expect(typeof tok).toBe("string");
    expect(tok.length).toBeGreaterThanOrEqual(20);
    // URL-safe — žádné pomlčky, lomítka, plus, equals
    expect(tok).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("dva po sobě generované tokeny se liší (entropie)", () => {
    const a = generateCalendarToken();
    const b = generateCalendarToken();
    expect(a).not.toBe(b);
  });
});

describe("ensureCalendarToken", () => {
  it("vygeneruje nový token když user doc token nemá", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      email: "u1@x.cz",
      role: "OWNER",
    });
    const tok = await ensureCalendarToken("u1");
    expect(typeof tok).toBe("string");
    expect(tok.length).toBeGreaterThanOrEqual(20);
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.calendarToken).toBe(tok);
    expect(typeof stored.calendarTokenRotatedAt).toBe("string");
  });

  it("idempotentní — druhé volání vrátí existující token bez přepisu", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      email: "u1@x.cz",
      role: "OWNER",
      calendarToken: "abcdefghijklmnopqrstuvwxyz",
      calendarTokenRotatedAt: "2026-04-25T10:00:00.000Z",
    });
    const tok = await ensureCalendarToken("u1");
    expect(tok).toBe("abcdefghijklmnopqrstuvwxyz");
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.calendarTokenRotatedAt).toBe("2026-04-25T10:00:00.000Z");
  });

  it("regeneruje pokud existing token je příliš krátký", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      email: "u1@x.cz",
      role: "OWNER",
      calendarToken: "short",
    });
    const tok = await ensureCalendarToken("u1");
    expect(tok).not.toBe("short");
    expect(tok.length).toBeGreaterThanOrEqual(20);
  });
});

describe("rotateCalendarToken", () => {
  it("přepíše existující token novým + bumps rotatedAt", async () => {
    __firestoreState.store.set("users/u1", {
      uid: "u1",
      email: "u1@x.cz",
      role: "OWNER",
      calendarToken: "old_token_aaaaaaaaaaaaaaaaaa",
      calendarTokenRotatedAt: "2026-04-01T00:00:00.000Z",
    });
    const next = await rotateCalendarToken("u1");
    expect(next).not.toBe("old_token_aaaaaaaaaaaaaaaaaa");
    expect(next.length).toBeGreaterThanOrEqual(20);
    const stored = __firestoreState.store.get("users/u1") as Record<string, unknown>;
    expect(stored.calendarToken).toBe(next);
    expect(stored.calendarTokenRotatedAt).not.toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("buildCalendarUrl", () => {
  it("vrátí HTTPS URL s region default europe-west1", () => {
    // VITE_FIREBASE_PROJECT_ID je v env.test = "test-project"
    const url = buildCalendarUrl("u1", "tok123", "https");
    expect(url).toBe(
      "https://europe-west1-test-project.cloudfunctions.net/calendarSubscription/u1/tok123.ics",
    );
  });

  it("default scheme = https", () => {
    expect(buildCalendarUrl("u1", "tok")).toMatch(/^https:\/\//);
  });

  it("webcal scheme přepíná na webcal://", () => {
    expect(buildCalendarUrl("u1", "tok123", "webcal")).toMatch(/^webcal:\/\//);
  });

  it("URL končí .ics suffixem", () => {
    expect(buildCalendarUrl("u1", "tok")).toMatch(/\.ics$/);
  });

  it("URL obsahuje uid + token v path", () => {
    const url = buildCalendarUrl("alice", "secret-xyz", "https");
    expect(url).toContain("/calendarSubscription/alice/secret-xyz.ics");
  });
});
