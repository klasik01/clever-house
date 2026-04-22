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

describe("CommentComposer — peer picker (V10)", () => {
  const peers = [
    { uid: "u-anna", displayName: "Anna" },
    { uid: "u-bob",  displayName: "Bob" },
    { uid: "u-cili", displayName: "Cilla" },
  ];

  it("disables the primary flip button when no peer is selected", () => {
    renderWithProviders(
      <CommentComposer
        onSubmit={vi.fn()}
        workflow={{ closeLabel: "Uzavřít", peers, defaultPeerUid: null }}
      />,
    );
    const primary = screen.getByRole("button", { name: /Poslat/ });
    expect(primary).toBeDisabled();
  });

  it("opens the peer dropdown on chevron click + lists every peer", async () => {
    renderWithProviders(
      <CommentComposer
        onSubmit={vi.fn()}
        workflow={{ closeLabel: "Uzavřít", peers, defaultPeerUid: "u-anna" }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Vybrat příjemce/i }));
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(3);
    expect(options[0]).toHaveTextContent("Anna");
    expect(options[2]).toHaveTextContent("Cilla");
  });

  it("selecting a peer updates the primary button label + routes the next flip to that uid", async () => {
    const fn = vi.fn();
    renderWithProviders(
      <CommentComposer
        onSubmit={fn}
        workflow={{ closeLabel: "Uzavřít", peers, defaultPeerUid: "u-anna" }}
      />,
    );
    // Open dropdown, pick Bob.
    await userEvent.click(screen.getByRole("button", { name: /Vybrat příjemce/i }));
    await userEvent.click(screen.getByRole("option", { name: "Bob" }));
    // Primary label now reflects Bob.
    expect(screen.getByRole("button", { name: /Poslat Bob/ })).toBeInTheDocument();
    // Type + fire flip.
    await userEvent.type(screen.getByPlaceholderText(/komentář/i), "ok");
    await userEvent.click(screen.getByRole("button", { name: /Poslat Bob/ }));
    const [, action, targetUid] = fn.mock.calls[0];
    expect(action).toBe("flip");
    expect(targetUid).toBe("u-bob");
  });

  it("updates seed when the defaultPeerUid prop changes (e.g. task switch)", () => {
    const { rerender } = renderWithProviders(
      <CommentComposer
        onSubmit={vi.fn()}
        workflow={{ closeLabel: "Uzavřít", peers, defaultPeerUid: "u-anna" }}
      />,
    );
    expect(screen.getByRole("button", { name: /Poslat Anna/ })).toBeInTheDocument();
    rerender(
      <CommentComposer
        onSubmit={vi.fn()}
        workflow={{ closeLabel: "Uzavřít", peers, defaultPeerUid: "u-cili" }}
      />,
    );
    expect(screen.getByRole("button", { name: /Poslat Cilla/ })).toBeInTheDocument();
  });
});

