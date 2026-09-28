import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import type { ScopeContextRef } from "@/api/scopeContext";
import { ContextInspector } from "./ContextInspector";
import {
  findScopePath,
  ProjectAssets,
  ProjectNavigation,
} from "./ProjectNavigation";
import { workspaceStyles as s } from "./workspaceStyles";

export function scopeFromQuery(
  query: URLSearchParams,
): ScopeContextRef | undefined {
  const unitId = query.get("unitId");
  const nodeId = query.get("nodeId") ?? query.get("chapterId");
  return unitId
    ? { kind: "unit", id: unitId }
    : nodeId
      ? { kind: "node", id: nodeId }
      : undefined;
}

export function ProjectWorkspace({
  projectId,
  children,
  scope: providedScope,
  revision = 0,
}: {
  projectId: string;
  children: React.ReactNode;
  scope?: ScopeContextRef | null;
  revision?: number;
}) {
  const [query] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { entries, loading, error, reload } =
    useManuscriptNavigation(projectId);
  const { units } = useUnits(projectId);
  const manuscriptScope = scopeFromQuery(query);
  const scope =
    providedScope === undefined
      ? manuscriptScope
      : (providedScope ?? undefined);
  const path = manuscriptScope
    ? findScopePath(entries, manuscriptScope.id)
    : [];
  const [compact, setCompact] = useState(
    () => window.matchMedia?.("(max-width: 68rem)").matches ?? false,
  );
  const [panel, setPanel] = useState<"navigation" | "context">();
  const [desktopNavigation, setDesktopNavigation] = useState(true);
  const [desktopContext, setDesktopContext] = useState(true);
  const navigationOpen = compact ? panel === "navigation" : desktopNavigation;
  const contextOpen = compact ? panel === "context" : desktopContext;
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 68rem)");
    const change = () => {
      setCompact(media?.matches ?? false);
      setPanel(undefined);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(undefined);
    };
    media?.addEventListener?.("change", change);
    window.addEventListener("keydown", escape);
    return () => {
      media?.removeEventListener?.("change", change);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (revision > 0) void reload();
  }, [revision, reload]);
  function choose(kind: "node" | "unit", id: string) {
    const next = new URLSearchParams(query);
    next.delete("unitId");
    next.delete("nodeId");
    next.set(kind === "unit" ? "unitId" : "nodeId", id);
    const path = findScopePath(entries, id);
    const planScope = kind === "node" ? id : path.at(-2)?.id;
    if (planScope) next.set("chapterId", planScope);
    else next.delete("chapterId");
    navigate(`${location.pathname}?${next}`);
    setPanel(undefined);
  }
  return (
    <AppShell projectId={projectId}>
      <div {...stylex.props(s.mobileBar)}>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={navigationOpen}
          onClick={() =>
            compact
              ? setPanel(panel === "navigation" ? undefined : "navigation")
              : setDesktopNavigation(!desktopNavigation)
          }
        >
          Manuscrit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={contextOpen}
          onClick={() =>
            compact
              ? setPanel(panel === "context" ? undefined : "context")
              : setDesktopContext(!desktopContext)
          }
        >
          Agent et contexte
        </Button>
      </div>
      <div {...stylex.props(s.body)}>
        {navigationOpen && (
          <aside {...stylex.props(s.sidebar)}>
            <nav aria-label="Structure du manuscrit">
              <div {...stylex.props(s.row)}>
                <h2 {...stylex.props(s.label)}>▣ Manuscrit</h2>
                <Link
                  {...stylex.props(s.link)}
                  to={`/projects/${projectId}/editor?new=1`}
                  aria-label="Ajouter une section"
                >
                  ＋
                </Link>
              </div>
              {loading && <p {...stylex.props(s.meta)}>Chargement…</p>}
              {error && (
                <p role="status" {...stylex.props(s.meta)}>
                  La structure du manuscrit n’est pas disponible.
                </p>
              )}
              <ProjectNavigation
                entries={entries}
                units={units}
                selectedNodeId={
                  manuscriptScope?.kind === "node"
                    ? manuscriptScope.id
                    : undefined
                }
                selectedUnitId={
                  manuscriptScope?.kind === "unit"
                    ? manuscriptScope.id
                    : undefined
                }
                onSelectNode={(node) => choose("node", node.id)}
                onSelectUnit={(unit) => choose("unit", unit.id)}
              />
            </nav>
            <ProjectAssets projectId={projectId} revision={revision} />
          </aside>
        )}
        <main {...stylex.props(s.center)}>
          <nav aria-label="Fil d’Ariane" {...stylex.props(s.breadcrumb)}>
            <Link
              {...stylex.props(s.link)}
              to={`/projects/${projectId}/editor`}
            >
              Manuscrit
            </Link>
            {path.map((node) => (
              <span key={node.id}>
                ›{" "}
                {node.title === "Passage"
                  ? units.find((unit) => unit.id === node.id)?.thesis ||
                    "Passage"
                  : node.title}
              </span>
            ))}
          </nav>
          {children}
        </main>
        {contextOpen && (
          <aside
            aria-label="Inspecteur éditorial"
            {...stylex.props(s.inspector)}
          >
            <ContextInspector
              key={`${scope?.kind}:${scope?.id}`}
              projectId={projectId}
              scope={scope}
            />
          </aside>
        )}
      </div>
    </AppShell>
  );
}
