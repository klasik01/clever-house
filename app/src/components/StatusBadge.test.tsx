import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import StatusBadge from "./StatusBadge";

describe("StatusBadge (V10)", () => {
  it("renders OPEN label for active úkoly", () => {
    renderWithProviders(<StatusBadge status="OPEN" type="otazka" />);
    expect(screen.getByText("Otevřený")).toBeInTheDocument();
  });

  it("BLOCKED label", () => {
    renderWithProviders(<StatusBadge status="BLOCKED" type="otazka" />);
    expect(screen.getByText("Blokováno")).toBeInTheDocument();
  });

  it("CANCELED label", () => {
    renderWithProviders(<StatusBadge status="CANCELED" type="otazka" />);
    expect(screen.getByText("Zrušeno")).toBeInTheDocument();
  });

  it("DONE label", () => {
    renderWithProviders(<StatusBadge status="DONE" type="otazka" />);
    expect(screen.getByText("Hotovo")).toBeInTheDocument();
  });

  it("normalises legacy V5 ON_PM_SITE → OPEN label", () => {
    renderWithProviders(<StatusBadge status="ON_PM_SITE" type="otazka" />);
    expect(screen.getByText("Otevřený")).toBeInTheDocument();
  });

  it("V23 — téma status maps legacy Nápad → OPEN (Otevřený)", () => {
    renderWithProviders(<StatusBadge status="Nápad" type="napad" />);
    expect(screen.getByText("Otevřený")).toBeInTheDocument();
  });

  it("V23 — téma with canonical OPEN shows Otevřený", () => {
    renderWithProviders(<StatusBadge status="OPEN" type="napad" />);
    expect(screen.getByText("Otevřený")).toBeInTheDocument();
  });
});
