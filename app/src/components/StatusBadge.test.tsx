import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the OWNER label for ON_CLIENT_SITE", () => {
    renderWithProviders(
      <StatusBadge status="ON_CLIENT_SITE" type="otazka" isPm={false} />,
    );
    // Matches the i18n key value from cs.json
    expect(screen.getByText("K vyjádření")).toBeInTheDocument();
  });

  it("renders the PM label for ON_CLIENT_SITE", () => {
    renderWithProviders(
      <StatusBadge status="ON_CLIENT_SITE" type="otazka" isPm={true} />,
    );
    expect(screen.getByText("Čeká na klienta")).toBeInTheDocument();
  });

  it("role-agnostic BLOCKED label", () => {
    renderWithProviders(<StatusBadge status="BLOCKED" type="otazka" />);
    expect(screen.getByText("Blokováno")).toBeInTheDocument();
  });

  it("normalises legacy Otázka → ON_PM_SITE label", () => {
    renderWithProviders(
      <StatusBadge status="Otázka" type="otazka" isPm={false} />,
    );
    expect(screen.getByText("Na projektantovi")).toBeInTheDocument();
  });

  it("nápad status falls back to flat key", () => {
    renderWithProviders(<StatusBadge status="Nápad" type="napad" />);
    expect(screen.getByText("Nápad")).toBeInTheDocument();
  });
});
