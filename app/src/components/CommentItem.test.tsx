import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import CommentItem from "./CommentItem";
import type { Comment } from "@/types";

// AvatarCircle is fine; no external deps. ReactionBar renders nothing when reactions is empty.

const baseComment: Comment = {
  id: "c1",
  authorUid: "u1",
  body: "Ahoj, tady je komentář",
  createdAt: "2026-04-20T10:00:00.000Z",
};

describe("CommentItem — workflow badges", () => {
  it("renders plain comment body", () => {
    renderWithProviders(
      <CommentItem comment={baseComment} isAuthor={false} isTaskOwner={false} />,
    );
    expect(screen.getByText(/Ahoj, tady je komentář/)).toBeInTheDocument();
  });

  it("flip + statusAfter=ON_CLIENT_SITE shows 'Přehozeno klientovi'", () => {
    const c: Comment = {
      ...baseComment,
      workflowAction: "flip",
      statusAfter: "ON_CLIENT_SITE",
    };
    renderWithProviders(
      <CommentItem comment={c} isAuthor={false} isTaskOwner={false} />,
    );
    expect(screen.getByText(/Přehozeno klientovi/)).toBeInTheDocument();
  });

  it("flip + statusAfter=ON_PM_SITE shows 'Přehozeno architektovi'", () => {
    const c: Comment = {
      ...baseComment,
      workflowAction: "flip",
      statusAfter: "ON_PM_SITE",
    };
    renderWithProviders(
      <CommentItem comment={c} isAuthor={false} isTaskOwner={false} />,
    );
    expect(screen.getByText(/Přehozeno projektantovi/)).toBeInTheDocument();
  });

  it("legacy flip (assigneeAfter) uses resolveName for the badge", () => {
    const c: Comment = {
      ...baseComment,
      workflowAction: "flip",
      statusAfter: "Otázka",  // legacy value → mapped
      assigneeAfter: "u-peer",
    };
    renderWithProviders(
      <CommentItem
        comment={c}
        isAuthor={false}
        isTaskOwner={false}
        resolveName={(uid) => (uid === "u-peer" ? "Bob" : "?")}
      />,
    );
    expect(screen.getByText(/Přehozeno na Bob/)).toBeInTheDocument();
  });

  it("close action shows the 'Uzavřeno' badge", () => {
    const c: Comment = {
      ...baseComment,
      workflowAction: "close",
      statusAfter: "DONE",
    };
    renderWithProviders(
      <CommentItem comment={c} isAuthor={false} isTaskOwner={false} />,
    );
    expect(screen.getByText(/Uzavřeno/)).toBeInTheDocument();
  });
});

describe("CommentItem — author actions", () => {
  it("author sees Edit + Delete buttons", () => {
    renderWithProviders(
      <CommentItem
        comment={baseComment}
        isAuthor={true}
        isTaskOwner={false}
        onEdit={async () => {}}
        onDelete={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Upravit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Smazat/i })).toBeInTheDocument();
  });

  it("non-author does NOT see Edit/Delete", () => {
    renderWithProviders(
      <CommentItem comment={baseComment} isAuthor={false} isTaskOwner={false} />,
    );
    expect(screen.queryByRole("button", { name: /Upravit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Smazat/i })).not.toBeInTheDocument();
  });
});
