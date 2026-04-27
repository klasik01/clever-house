import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import Composer from "./Composer";

/**
 * Composer is the /novy quick-capture widget. V11 added `lockedType` — used
 * by PM's NewTask page so the user cannot create a napad. These tests verify
 * the toggle visibility + enforced save payload.
 */
describe("Composer (V11 lockedType)", () => {
  beforeEach(() => {
    // storage.loadDraft reads from localStorage — wipe between runs.
    try { localStorage.clear(); } catch { /* jsdom */ }
  });

  it("shows the type toggle by default (OWNER)", () => {
    renderWithProviders(<Composer onSave={vi.fn()} />);
    expect(screen.getByText("Téma")).toBeInTheDocument();
    expect(screen.getByText("Úkol")).toBeInTheDocument();
  });

  it("hides the type toggle entirely when lockedType is set", () => {
    renderWithProviders(<Composer onSave={vi.fn()} lockedType="otazka" />);
    expect(screen.queryByText("Téma")).not.toBeInTheDocument();
    expect(screen.queryByText("Úkol")).not.toBeInTheDocument();
  });

  it("forces type=otazka on save when lockedType=\"otazka\"", async () => {
    const fn = vi.fn();
    renderWithProviders(<Composer onSave={fn} lockedType="otazka" />);
    await userEvent.type(screen.getByRole("textbox"), "Něco k vyřešení");
    await userEvent.click(screen.getByRole("button", { name: /Uložit/i }));
    const [, type] = fn.mock.calls[0];
    expect(type).toBe("otazka");
  });

  it("passes text + type + empty attachments through onSave", async () => {
    const fn = vi.fn();
    renderWithProviders(<Composer onSave={fn} />);
    await userEvent.type(screen.getByRole("textbox"), "Nová myšlenka");
    await userEvent.click(screen.getByRole("button", { name: /Uložit/i }));
    const [text, type, images, links] = fn.mock.calls[0];
    expect(text).toBe("Nová myšlenka");
    expect(type).toBe("napad");
    expect(images).toEqual([]);
    expect(links).toEqual([]);
  });

  it("disables Save when the body is empty", () => {
    renderWithProviders(<Composer onSave={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Uložit/i });
    expect(btn).toBeDisabled();
  });
});

describe("Composer (V14 allowedTypes + 3-way toggle)", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* jsdom */ }
  });

  it("renders all three pills by default (Téma + Otázka + Úkol)", () => {
    renderWithProviders(<Composer onSave={vi.fn()} />);
    expect(screen.getByText("Téma")).toBeInTheDocument();
    expect(screen.getByText("Otázka")).toBeInTheDocument();
    expect(screen.getByText("Úkol")).toBeInTheDocument();
  });

  it("allowedTypes restricts the pill set — PM gets Otázka + Úkol, no Téma", () => {
    renderWithProviders(<Composer onSave={vi.fn()} allowedTypes={["otazka", "ukol"]} />);
    expect(screen.queryByText("Téma")).not.toBeInTheDocument();
    expect(screen.getByText("Otázka")).toBeInTheDocument();
    expect(screen.getByText("Úkol")).toBeInTheDocument();
  });

  it("default active type is the first allowedTypes entry", async () => {
    const fn = vi.fn();
    renderWithProviders(<Composer onSave={fn} allowedTypes={["ukol", "otazka"]} />);
    await userEvent.type(screen.getByRole("textbox"), "něco");
    await userEvent.click(screen.getByRole("button", { name: /Uložit/i }));
    expect(fn.mock.calls[0][1]).toBe("ukol");
  });

  it("hides the toggle when allowedTypes has a single entry", () => {
    renderWithProviders(<Composer onSave={vi.fn()} allowedTypes={["ukol"]} />);
    expect(screen.queryByText("Téma")).not.toBeInTheDocument();
    expect(screen.queryByText("Otázka")).not.toBeInTheDocument();
    expect(screen.queryByText("Úkol")).not.toBeInTheDocument();
  });
});

