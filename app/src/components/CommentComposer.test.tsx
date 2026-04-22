import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import CommentComposer from "./CommentComposer";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { uid: "u1" }, loading: false }),
}));
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({ users: [], byUid: new Map(), loading: false }),
}));

describe("CommentComposer (V10)", () => {
  it("disables primary Send when the body is empty", () => {
    renderWithProviders(<CommentComposer onSubmit={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Odeslat|Poslat/i });
    expect(btn).toBeDisabled();
  });

  it("calls onSubmit(input, null, null) for plain comment (no workflow)", async () => {
    const fn = vi.fn();
    renderWithProviders(<CommentComposer onSubmit={fn} />);
    await userEvent.type(
      screen.getByPlaceholderText(/komentář/i),
      "Jen plain",
    );
    await userEvent.click(screen.getByRole("button", { name: /Odeslat|Poslat/i }));
    expect(fn).toHaveBeenCalledTimes(1);
    const [input, action, targetUid] = fn.mock.calls[0];
    expect(input.body).toBe("Jen plain");
    expect(action).toBeNull();
    expect(targetUid).toBeNull();
  });

  it("workflow: primary button calls onSubmit with flip + defaultPeerUid", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CommentComposer
        onSubmit={fn}
        workflow={{
          closeLabel: "Uzavřít",
          peers: [{ uid: "u-peer", displayName: "Anna" }],
          defaultPeerUid: "u-peer",
        }}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/komentář/i), "handing off");
    await userEvent.click(screen.getByRole("button", { name: /Poslat Anna/ }));
    const [, action, targetUid] = fn.mock.calls[0];
    expect(action).toBe("flip");
    expect(targetUid).toBe("u-peer");
  });

  it("workflow: close button calls onSubmit with close", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CommentComposer
        onSubmit={fn}
        workflow={{
          closeLabel: "Uzavřít",
          peers: [{ uid: "u-peer", displayName: "Anna" }],
          defaultPeerUid: "u-peer",
        }}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/komentář/i), "done");
    await userEvent.click(screen.getByRole("button", { name: "Uzavřít" }));
    const [, action] = fn.mock.calls[0];
    expect(action).toBe("close");
  });
});
