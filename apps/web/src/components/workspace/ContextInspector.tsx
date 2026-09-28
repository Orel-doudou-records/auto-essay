import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { ScopeContext } from "@/components/editor/ScopeContext";
import { ScopeConversation } from "@/components/editor/ScopeConversation";
import type { ScopeContextRef } from "@/api/scopeContext";
import { workspaceStyles as s } from "./workspaceStyles";

export function ContextInspector({
  projectId,
  scope,
  children,
}: {
  projectId: string;
  scope?: ScopeContextRef;
  children?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"agent" | "sources" | "context" | "decisions">(
    "agent",
  );
  return (
    <>
      <div {...stylex.props(s.tabs)} aria-label="Panneau contextuel">
        {(
          [
            ["agent", "Agent"],
            ["sources", "Sources"],
            ["context", "Contexte"],
            ["decisions", "Décisions"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={tab === id}
            {...stylex.props(s.tab, tab === id && s.tabActive)}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {!scope ? (
        <p {...stylex.props(s.meta)}>
          Sélectionnez un chapitre, un passage ou une source pour retrouver son
          contexte.
        </p>
      ) : (
        <>
          <div hidden={tab !== "agent"}>
            <ScopeConversation
              key={`${scope.kind}:${scope.id}`}
              projectId={projectId}
              scope={scope}
              showContext={false}
            />
            {children}
          </div>
          {tab !== "agent" && (
            <ScopeContext
              key={`${scope.kind}:${scope.id}`}
              projectId={projectId}
              scope={scope}
              view={tab}
            />
          )}
        </>
      )}
    </>
  );
}
