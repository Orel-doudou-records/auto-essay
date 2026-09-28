import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import type { DraftUnit } from "@auto-essay/core";
import type { ManuscriptNavigationEntry } from "@/api";
import {
  useSourceOverview,
  sourceStateLabels,
} from "@/hooks/useSourceOverview";
import { workspaceStyles as s } from "./workspaceStyles";

export type NodeScope = { id: string; title: string; depth: number };
export function findScopePath(
  entries: ManuscriptNavigationEntry[],
  id: string,
): Array<{ id: string; title: string }> {
  for (const entry of entries) {
    if (entry.kind === "leaf") {
      if (entry.unitId === id) return [{ id, title: "Passage" }];
    } else {
      if (entry.id === id) return [{ id, title: entry.title }];
      const path = findScopePath(entry.children, id);
      if (path.length) return [{ id: entry.id, title: entry.title }, ...path];
    }
  }
  return [];
}

export function ProjectNavigation({
  entries,
  units,
  selectedNodeId,
  selectedUnitId,
  onSelectNode,
  onSelectUnit,
}: {
  entries: ManuscriptNavigationEntry[];
  units: DraftUnit[];
  selectedNodeId?: string;
  selectedUnitId?: string;
  onSelectNode: (scope: NodeScope) => void;
  onSelectUnit: (unit: DraftUnit) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function renderEntry(
    entry: ManuscriptNavigationEntry,
    depth: number,
    index: number,
  ): React.ReactNode {
    if (entry.kind === "leaf") {
      const unit = units.find((item) => item.id === entry.unitId);
      if (!unit) return null;
      return (
        <li key={entry.unitId}>
          <button
            type="button"
            {...stylex.props(
              s.treeButton,
              selectedUnitId === unit.id && s.active,
            )}
            aria-current={selectedUnitId === unit.id ? "location" : undefined}
            onClick={() => onSelectUnit(unit)}
          >
            {entry.granularity === "paragraph"
              ? `Paragraphe ${index + 1}`
              : unit.thesis || unit.contextInPlan?.section || "Section"}
          </button>
        </li>
      );
    }
    const open = !collapsed.has(entry.id);
    return (
      <li key={entry.id}>
        <div
          {...stylex.props(s.treeRow, selectedNodeId === entry.id && s.active)}
        >
          {entry.children.length > 0 && (
            <button
              type="button"
              {...stylex.props(s.collapse)}
              aria-label={`${open ? "Replier" : "Déplier"} ${entry.title}`}
              aria-expanded={open}
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (open) next.add(entry.id);
                  else next.delete(entry.id);
                  return next;
                })
              }
            >
              {open ? "⌄" : "›"}
            </button>
          )}
          <button
            type="button"
            {...stylex.props(s.treeButton)}
            aria-current={selectedNodeId === entry.id ? "location" : undefined}
            onClick={() =>
              onSelectNode({ id: entry.id, title: entry.title, depth })
            }
          >
            {entry.title}
          </button>
        </div>
        {open && entry.children.length > 0 && (
          <ul {...stylex.props(s.tree, s.nested)}>
            {entry.children.map((child, i) => renderEntry(child, depth + 1, i))}
          </ul>
        )}
      </li>
    );
  }
  // Standalone units can exist before a hierarchical plan has been imported.
  const placed = new Set<string>();
  function collect(items: ManuscriptNavigationEntry[]) {
    for (const entry of items) {
      if (entry.kind === "leaf") placed.add(entry.unitId);
      else collect(entry.children);
    }
  }
  collect(entries);
  return (
    <ul {...stylex.props(s.tree)}>
      {entries.map((entry, i) => renderEntry(entry, 0, i))}
      {units
        .filter((unit) => !placed.has(unit.id))
        .map((unit, i) =>
          renderEntry(
            {
              kind: "leaf",
              unitId: unit.id,
              version: unit.version,
              status: unit.status,
              granularity:
                unit.granularity === "paragraph" ? "paragraph" : "section",
            },
            0,
            i,
          ),
        )}
    </ul>
  );
}

export function ProjectAssets({
  projectId,
  revision = 0,
}: {
  projectId: string;
  revision?: number;
}) {
  const { sources, error } = useSourceOverview(projectId, revision);
  const [query] = useSearchParams();
  function sourceHref(sourceId?: string) {
    const next = new URLSearchParams(query);
    next.delete("sourceId");
    next.delete("new");
    if (sourceId) next.set("sourceId", sourceId);
    return `/projects/${projectId}/sources${next.size ? `?${next}` : ""}`;
  }
  const base = `/projects/${projectId}`;
  return (
    <>
      <section {...stylex.props(s.assets)} aria-label="Documents">
        <h2 {...stylex.props(s.label)}>▤ Documents</h2>
        <Link {...stylex.props(s.link)} to={`${base}/import`}>
          Importer un manuscrit
        </Link>
        <Link {...stylex.props(s.link)} to={`${base}/plan-import`}>
          Importer ou générer un plan
        </Link>
        <Link {...stylex.props(s.link)} to={`${base}/reimport`}>
          Comparer un nouveau fichier
        </Link>
      </section>
      <section {...stylex.props(s.assets)} aria-label="Bibliographie">
        <h2 {...stylex.props(s.label)}>▦ Bibliographie</h2>
        {error ? (
          <p role="status" {...stylex.props(s.meta)}>
            {error}
          </p>
        ) : (
          <>
            <span {...stylex.props(s.meta)}>
              {sources.filter((source) => source.state === "explored").length} /{" "}
              {sources.length} sources explorées
            </span>
            {sources.slice(0, 4).map((source) => (
              <Link
                key={source.id}
                {...stylex.props(s.source)}
                to={sourceHref(source.id)}
              >
                <span
                  {...stylex.props(s.dot)}
                  aria-label={sourceStateLabels[source.state]}
                >
                  ●
                </span>
                <span>{source.title}</span>
              </Link>
            ))}
          </>
        )}
        <Link {...stylex.props(s.link)} to={sourceHref()}>
          Voir toutes les sources
        </Link>
      </section>
    </>
  );
}
