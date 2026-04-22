import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import StatusSelect from "./StatusSelect";

describe("StatusSelect", () => {
  it("shows only V5 canonical otazka statuses when type=otazka", () => {
    renderWithProviders(
      <StatusSelect value="ON_PM_SITE" type="otazka" onChange={() => {}} />,
    );
    // The role="radio" options should cover the 5 canonical statuses.
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(5);
  });

  it("shows napad statuses when type=napad", () => {
    renderWithProviders(
      <StatusSelect value="Nápad" type="napad" onChange={() => {}} />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(4);
    expect(screen.getByText("Nápad")).toBeInTheDocument();
    expect(screen.getByText("Rozhodnuto")).toBeInTheDocument();
  });

  it("normalises legacy otazka value when rendering", () => {
    renderWithProviders(
      <StatusSelect value="Otázka" type="otazka" onChange={() => {}} isPm={false} />,
    );
    // "Otázka" maps to ON_PM_SITE which for OWNER reads "Na projektantovi".
    const label = screen.getByText("Na projektantovi");
    const active = label.closest("button");
    expect(active).toHaveAttribute("aria-checked", "true");
  });

  it("fires onChange with the clicked status value", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <StatusSelect value="ON_PM_SITE" type="otazka" onChange={fn} isPm={false} />,
    );
    await userEvent.click(screen.getByText("Blokováno"));
    expect(fn).toHaveBeenCalledWith("BLOCKED");
  });
});
