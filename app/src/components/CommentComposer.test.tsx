import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import CommentComposer from "./CommentComposer";

// Users/auth hooks feeding MentionPicker. Mock them to something innocuous.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "u1" }, loading: false }),
}));
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({ users: [], byUid: new Map(), loading: false }),
}));

describe("CommentComposer", () => {
  it("disables primary Send when the body is empty", () => {
    renderWithProviders(<CommentComposer onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Odeslat|Poslat/i });
    expect(btn).toBeDisabled();
  });

  it("calls onSubmit(input, null) for plain comment", async () => {
    const fn = vi.fn();
    renderWithProviders(<CommentComposer onSubmit={fn} />);
    await userEvent.type(
      screen.getByPlaceholderText(/napsat|napiš|komentář/i),
      "Jen plain",
    );
    await userEvent.click(screen.getByRole("button", { name: /Odeslat|Poslat/i }));
    expect(fn).toHaveBeenCalledTimes(1);
    const [input, action] = fn.mock.calls[0];
    expect(input.body).toBe("Jen plain");
    expect(action).toBeNull();
  });

  it("workflow: primary button calls onSubmit(_, \"flip\")", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CommentComposer
        onSubmit={fn}
        workflow={{ flipLabel: "Poslat architektovi", closeLabel: "Uzavřít" }}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText(/napsat|napiš|komentář/i),
      "handing off",
    );
    await userEvent.click(screen.getByRole("button", { name: "Poslat architektovi" }));
    const [, action] = fn.mock.calls[0];
    expect(action).toBe("flip");
  });

  it("workflow: close button calls onSubmit(_, \"close\")", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CommentComposer
        onSubmit={fn}
        workflow={{ flipLabel: "Poslat klientovi", closeLabel: "Uzavřít" }}
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText(/napsat|napiš|komentář/i),
      "done",
    );
    await userEvent.click(screen.getByRole("button", { name: "Uzavřít" }));
    const [, action] = fn.mock.calls[0];
    expect(action).toBe("close");
  });
});
