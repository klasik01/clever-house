import { describe, it, expect } from "vitest";
import {
  ROUTES,
  ROUTE_PATTERNS,
  taskDetail,
  eventDetail,
  eventEdit,
  kategorieDetail,
  lokaceDetail,
} from "./routes";

describe("route builders", () => {
  it("taskDetail builds /t/{id}", () => {
    expect(taskDetail("abc")).toBe("/t/abc");
  });

  it("eventDetail builds /event/{id}", () => {
    expect(eventDetail("ev1")).toBe("/event/ev1");
  });

  it("eventEdit builds /event/{id}/edit", () => {
    expect(eventEdit("ev1")).toBe("/event/ev1/edit");
  });

  it("kategorieDetail builds /kategorie/{id}", () => {
    expect(kategorieDetail("cat1")).toBe("/kategorie/cat1");
  });

  it("lokaceDetail builds /lokace/{id}", () => {
    expect(lokaceDetail("loc1")).toBe("/lokace/loc1");
  });
});

describe("ROUTES constants", () => {
  it("home is /", () => {
    expect(ROUTES.home).toBe("/");
  });

  it("zaznamy starts with /", () => {
    expect(ROUTES.zaznamy).toMatch(/^\//);
  });

  it("dokumentace route exists", () => {
    expect(ROUTES.dokumentace).toBe("/dokumentace");
  });

  it("all static routes are unique", () => {
    const values = Object.values(ROUTES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("ROUTE_PATTERNS", () => {
  it("taskDetail pattern has :id param", () => {
    expect(ROUTE_PATTERNS.taskDetail).toContain(":id");
  });

  it("eventDetail pattern has :id param", () => {
    expect(ROUTE_PATTERNS.eventDetail).toContain(":id");
  });
});
