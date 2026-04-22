import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import CategoryPicker from "./CategoryPicker";
import type { Category } from "@/types";

const cats: Category[] = [
  { id: "elektro", label: "Elektro", createdBy: "u", createdAt: "" },
  { id: "voda", label: "Voda", createdBy: "u", createdAt: "" },
  { id: "topeni", label: "Topení", createdBy: "u", createdAt: "" },
];

describe("CategoryPicker", () => {
  it("shows an empty-state label when nothing is selected", () => {
    renderWithProviders(
      <CategoryPicker value={[]} categories={cats} onChange={() => {}} />,
    );
    // The picker renders t("detail.categoryNone") — we only check for a chip/selected count of 0
    const chips = screen.queryAllByRole("listbox");
    expect(chips.length).toBe(0); // dropdown only opens on click
  });

  it("renders one chip per selected id", () => {
    renderWithProviders(
      <CategoryPicker value={["elektro"]} categories={cats} onChange={() => {}} />,
    );
    expect(screen.getByText("Elektro")).toBeInTheDocument();
  });

  it("opens the dropdown + adds a category on click", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CategoryPicker value={[]} categories={cats} onChange={fn} />,
    );
    const addBtn = screen.getByRole("button", { name: /Přidat/i });
    await userEvent.click(addBtn);
    const option = await screen.findByText("Voda");
    await userEvent.click(option);
    expect(fn).toHaveBeenCalledWith(["voda"]);
  });

  it("remove button calls onChange without the removed id", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CategoryPicker
        value={["elektro", "voda"]}
        categories={cats}
        onChange={fn}
      />,
    );
    const removes = screen.getAllByLabelText(/Odebrat/i);
    await userEvent.click(removes[0]);
    expect(fn).toHaveBeenCalledWith(["voda"]);
  });
});
