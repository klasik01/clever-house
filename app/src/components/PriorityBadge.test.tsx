import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import PriorityBadge from "./PriorityBadge";

describe("PriorityBadge", () => {
  it("renders P1 label", () => {
    renderWithProviders(<PriorityBadge priority="P1" />);
    expect(screen.getByText("P1")).toBeInTheDocument();
  });

  it("uses priority-specific CSS custom properties", () => {
    const { container } = renderWithProviders(<PriorityBadge priority="P2" />);
    const span = container.querySelector("span");
    expect(span?.getAttribute("style") ?? "").toContain("color-priority-p2");
  });

  it("aria-label includes long-form priority", () => {
    renderWithProviders(<PriorityBadge priority="P3" />);
    expect(screen.getByLabelText(/Priorita:/)).toBeInTheDocument();
  });
});
