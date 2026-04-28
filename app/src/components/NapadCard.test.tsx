import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import NapadCard from "./NapadCard";
import type { Task } from "@/types";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "owner-1" }, loading: false }),
}));
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({ users: [], byUid: new Map(), loading: false }),
}));

const base: Task = {
  id: "t1",
  type: "otazka",
  title: "Jak zapojit rozvaděč?",
  body: "",
  status: "OPEN",
  assigneeUid: "owner-1",
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
  createdBy: "owner-1",
} as Task;

describe("NapadCard (V10)", () => {
  it("renders the title", () => {
    renderWithProviders(<NapadCard task={base} />);
    expect(screen.getByText(/Jak zapojit rozvaděč/)).toBeInTheDocument();
  });

  it("applies border-l-4 with status color via inline style", () => {
    const { container } = renderWithProviders(<NapadCard task={base} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toMatch(/border-l-4/);
    // Color is set via inline style from statusColors, not a CSS class
    expect(outer.getAttribute("style") ?? "").toContain("border-left-color");
  });

  it("renders border-l-4 for all actionable types", () => {
    const ukol = { ...base, type: "ukol" } as Task;
    const { container } = renderWithProviders(<NapadCard task={ukol} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toMatch(/border-l-4/);
    expect(outer.getAttribute("style") ?? "").toContain("border-left-color");
  });

  it("uses status-otazka border color for OPEN status", () => {
    const { container } = renderWithProviders(<NapadCard task={base} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.getAttribute("style") ?? "").toContain("color-status-otazka-border");
  });

  it("renders border-l-4 for napad type too", () => {
    const napad = { ...base, type: "napad", status: "OPEN" } as Task;
    const { container } = renderWithProviders(<NapadCard task={napad} />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toMatch(/border-l-4/);
  });
});
