import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import StatusSelect from "./StatusSelect";

describe("StatusSelect (V10)", () => {
  it("shows the 4 canonical otazka statuses (OPEN/BLOCKED/CANCELED/DONE)", () => {
    renderWithProviders(
      <StatusSelect value="OPEN" type="otazka" onChange={() => {}} />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(4);
  });

  it("V23 — shows canonical statuses for napad (same as otázka)", () => {
    renderWithProviders(
      <StatusSelect value="OPEN" type="napad" onChange={() => {}} />,
    );
    expect(screen.getAllByRole("radio").length).toBe(4);
    expect(screen.getByText("Otevřený")).toBeInTheDocument();
  });

  it("normalises legacy ON_PM_SITE → OPEN aria-checked", () => {
    renderWithProviders(
      <StatusSelect value="ON_PM_SITE" type="otazka" onChange={() => {}} />,
    );
    const open = screen.getByText("Otevřený").closest("button");
    expect(open).toHaveAttribute("aria-checked", "true");
  });

  it("fires onChange with the clicked status value", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <StatusSelect value="OPEN" type="otazka" onChange={fn} />,
    );
    await userEvent.click(screen.getByText("Blokováno"));
    expect(fn).toHaveBeenCalledWith("BLOCKED");
  });
});
