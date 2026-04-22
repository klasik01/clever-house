import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import DeadlineChip from "./DeadlineChip";

const day = 24 * 60 * 60 * 1000;

describe("DeadlineChip", () => {
  it("returns null when deadline is missing", () => {
    const { container } = renderWithProviders(<DeadlineChip deadline={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders ok state ≥ 2 days ahead (no border utility class)", () => {
    const { container } = renderWithProviders(
      <DeadlineChip deadline={Date.now() + 5 * day} />,
    );
    const span = container.querySelector("span");
    expect(span?.className).not.toMatch(/\bborder\b/);
  });

  it("renders overdue state with border when in the past", () => {
    const { container } = renderWithProviders(
      <DeadlineChip deadline={Date.now() - 2 * day} />,
    );
    const span = container.querySelector("span");
    expect(span?.className).toMatch(/\bborder\b/);
  });

  it("sets an aria-label like 'Termín: ...'", () => {
    renderWithProviders(<DeadlineChip deadline={Date.now() + 3 * day} />);
    // We can't assert the exact countdown copy without hard-coding the i18n
    // resolver, but aria-label must begin with the "Termín" prefix.
    const el = screen.getByLabelText(/Termín/);
    expect(el).toBeInTheDocument();
  });
});
