import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import PrioritySelect from "./PrioritySelect";

describe("PrioritySelect", () => {
  it("renders three radios", () => {
    renderWithProviders(<PrioritySelect value="P2" onChange={() => {}} />);
    expect(screen.getAllByRole("radio").length).toBe(3);
  });

  it("marks the current value as checked", () => {
    renderWithProviders(<PrioritySelect value="P1" onChange={() => {}} />);
    const active = screen
      .getAllByRole("radio")
      .find((r) => r.getAttribute("aria-checked") === "true");
    expect(active?.textContent).toMatch(/P1/);
  });

  it("fires onChange when a different option is clicked", async () => {
    const fn = vi.fn();
    renderWithProviders(<PrioritySelect value="P2" onChange={fn} />);
    await userEvent.click(screen.getAllByRole("radio")[2]); // P3
    expect(fn).toHaveBeenCalledWith("P3");
  });
});
