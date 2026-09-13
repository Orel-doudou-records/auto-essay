import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchScopeConversation,
  sendScopeConversationMessage,
} from "@/api/scopeConversation";
import { ScopeConversation } from "./ScopeConversation";

vi.mock("@/api/scopeConversation", () => ({
  fetchScopeConversation: vi.fn(),
  sendScopeConversationMessage: vi.fn(),
}));

const fetchConversation = vi.mocked(fetchScopeConversation);
const sendMessage = vi.mocked(sendScopeConversationMessage);

const message = (id: string, role: "author" | "autoessay", content: string) => ({
  id,
  role,
  content,
  createdAt: "2026-09-14T10:00:00.000Z",
});

describe("ScopeConversation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchConversation.mockImplementation(async (_projectId, scope) => {
      if (scope.id === "scope-a") return [message("a-1", "autoessay", "Fil du scope A")];
      return [message("b-1", "autoessay", "Fil du scope B")];
    });
  });

  it("reloads only the conversation bound to the active scope when navigating away and back", async () => {
    const { rerender } = render(
      <ScopeConversation projectId="project-1" scope={{ kind: "node", id: "scope-a" }} />
    );
    expect(await screen.findByText("Fil du scope A")).toBeInTheDocument();

    rerender(<ScopeConversation projectId="project-1" scope={{ kind: "node", id: "scope-b" }} />);
    expect(await screen.findByText("Fil du scope B")).toBeInTheDocument();
    expect(screen.queryByText("Fil du scope A")).not.toBeInTheDocument();

    rerender(<ScopeConversation projectId="project-1" scope={{ kind: "node", id: "scope-a" }} />);
    expect(await screen.findByText("Fil du scope A")).toBeInTheDocument();
    expect(screen.queryByText("Fil du scope B")).not.toBeInTheDocument();
    expect(fetchConversation).toHaveBeenNthCalledWith(1, "project-1", { kind: "node", id: "scope-a" });
    expect(fetchConversation).toHaveBeenNthCalledWith(2, "project-1", { kind: "node", id: "scope-b" });
    expect(fetchConversation).toHaveBeenNthCalledWith(3, "project-1", { kind: "node", id: "scope-a" });
  });

  it("sends a message only to the current scope and renders the returned journal", async () => {
    sendMessage.mockResolvedValue([
      message("u-1", "author", "Que manque-t-il ?"),
      message("u-2", "autoessay", "Une transition plus nette."),
    ]);
    render(<ScopeConversation projectId="project-1" scope={{ kind: "unit", id: "unit-1" }} />);
    await screen.findByText("Fil du scope B");

    fireEvent.change(screen.getByRole("textbox", { name: "Message à AutoEssay pour ce scope" }), {
      target: { value: "Que manque-t-il ?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith(
      "project-1",
      { kind: "unit", id: "unit-1" },
      "Que manque-t-il ?"
    ));
    expect(await screen.findByText("Une transition plus nette.")).toBeInTheDocument();
    expect(screen.getByText("Vous")).toBeInTheDocument();
    expect(screen.getByText("AutoEssay")).toBeInTheDocument();
  });
});
