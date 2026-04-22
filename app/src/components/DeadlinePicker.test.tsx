import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import DeadlinePicker from "./DeadlinePicker";
import { dateInputToEpochMs } from "@/lib/deadline";

describe("DeadlinePicker", () => {
  it("fires onChange(null) when clear button is clicked", async () => {
    const fn = vi.fn();
    const ms = dateInputToEpochMs("2026-05-10")!;
    renderWithProviders(<DeadlinePicker value={ms} onChange={fn} />);
    const clearBtn = screen.getByLabelText(/Bez termínu|None/i);
    fireEvent.click(clearBtn);
    expect(fn).toHaveBeenCalledWith(null);
  });

  it("hides the clear button when value is null", () => {
    renderWithProviders(<DeadlinePicker value={null} onChange={() => {}} />);
    expect(screen.queryByLabelText(/Bez termínu|None/i)).not.toBeInTheDocument();
  });

  it("forwards date input change to onChange(epochMs)", () => {
    const fn = vi.fn();
    renderWithProviders(<DeadlinePicker value={null} onChange={fn} />);
    const input = screen.getByLabelText(/Termín/);
    fireEvent.change(input, { target: { value: "2026-06-15" } });
    expect(fn).toHaveBeenCalled();
    const arg = fn.mock.calls[0][0];
    expect(arg).toBe(dateInputToEpochMs("2026-06-15"));
  });
});
