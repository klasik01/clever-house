import { describe, it, expect } from "vitest";
import { PATH_RE } from "./calendarSubscription";

/**
 * V18-S11 — testy pro path regex pure helper.
 * Nemockujeme Firestore admin SDK — ten testují integration testy
 * v Phase 4 (S14). Tady jen ověřujeme URL parsing logic.
 */

describe("PATH_RE", () => {
  describe("matchuje", () => {
    it("nativní CF URL: /{uid}/{token}.ics", () => {
      const m = "/alice/abc123def456.ics".match(PATH_RE);
      expect(m).not.toBeNull();
      expect(m![1]).toBe("alice");
      expect(m![2]).toBe("abc123def456");
    });

    it("Firebase Hosting rewrite: /cal/{uid}/{token}.ics", () => {
      const m = "/cal/alice/abc123def456.ics".match(PATH_RE);
      expect(m).not.toBeNull();
      expect(m![1]).toBe("alice");
      expect(m![2]).toBe("abc123def456");
    });

    it("uid s pomlčkou + underscore", () => {
      const m = "/user_id-abc/tok-xyz_123.ics".match(PATH_RE);
      expect(m).not.toBeNull();
      expect(m![1]).toBe("user_id-abc");
      expect(m![2]).toBe("tok-xyz_123");
    });

    it("dlouhý token (32 hex)", () => {
      const m = "/u1/a1b2c3d4e5f60718293a4b5c6d7e8f90.ics".match(PATH_RE);
      expect(m).not.toBeNull();
      expect(m![2]).toBe("a1b2c3d4e5f60718293a4b5c6d7e8f90");
    });
  });

  describe("nematchuje", () => {
    it("bez .ics suffixu", () => {
      expect("/alice/abc".match(PATH_RE)).toBeNull();
    });

    it("s extra path segments", () => {
      expect("/alice/sub/abc.ics".match(PATH_RE)).toBeNull();
    });

    it("uid s ne-alphanumerickými znaky (mezera, diakritika)", () => {
      expect("/alice s mezerou/abc.ics".match(PATH_RE)).toBeNull();
      expect("/áčď/abc.ics".match(PATH_RE)).toBeNull();
    });

    it("token s tečkou nebo lomítkem", () => {
      expect("/alice/ab.cd.ics".match(PATH_RE)).toBeNull();
      expect("/alice/ab/cd.ics".match(PATH_RE)).toBeNull();
    });

    it("query string (matchuje až po query striplu — caller filtruje)", () => {
      // Query striping je v handleru (req.url.split("?")[0]).
      // Regex sám query nepřijme.
      expect("/alice/abc.ics?foo=bar".match(PATH_RE)).toBeNull();
    });

    it("prázdný path", () => {
      expect("".match(PATH_RE)).toBeNull();
      expect("/".match(PATH_RE)).toBeNull();
    });

    it("jiný prefix než /cal", () => {
      expect("/api/alice/abc.ics".match(PATH_RE)).toBeNull();
    });

    it("prázdný uid nebo token", () => {
      expect("//abc.ics".match(PATH_RE)).toBeNull();
      expect("/alice/.ics".match(PATH_RE)).toBeNull();
    });
  });
});
