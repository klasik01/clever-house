import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import LocationPicker from "./LocationPicker";

// LocationPicker depends on useLocations + useAuth. Mock both to return a
// small, deterministic list that spans all three groups.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "u1" }, loading: false }),
}));
vi.mock("@/hooks/useLocations", () => ({
  useLocations: () => ({
    locations: [
      { id: "zahrada", label: "Zahrada", group: "pozemek" },
      { id: "kuchyn", label: "Kuchyň", group: "dum" },
      { id: "rozvadec", label: "Rozvaděč", group: "site" },
    ],
    loading: false,
    error: null,
  }),
}));

describe("LocationPicker", () => {
  it("renders three optgroups (one per V7 group) with their locations", () => {
    renderWithProviders(
      <LocationPicker value={null} onChange={() => {}} />,
    );
    const select = screen.getByRole("combobox");
    const optgroups = select.querySelectorAll("optgroup");
    expect(optgroups.length).toBe(3);
    // Options show up by label
    expect(screen.getByText("Zahrada")).toBeInTheDocument();
    expect(screen.getByText("Kuchyň")).toBeInTheDocument();
    expect(screen.getByText("Rozvaděč")).toBeInTheDocument();
  });

  it("selecting a location fires onChange with the id", () => {
    const fn = vi.fn();
    renderWithProviders(
      <LocationPicker value={null} onChange={fn} />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kuchyn" } });
    expect(fn).toHaveBeenCalledWith("kuchyn");
  });

  it("clearing (empty value) fires onChange(null)", () => {
    const fn = vi.fn();
    renderWithProviders(
      <LocationPicker value="kuchyn" onChange={fn} />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(fn).toHaveBeenCalledWith(null);
  });
});
