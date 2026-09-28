import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { PlanningStructuralChange } from "@auto-essay/core";
import type { ManuscriptNavigationEntry } from "@/api";
import { applyPlanningStructuralDiff } from "@/api/planning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { workspaceStyles as s } from "@/components/workspace/workspaceStyles";

type Node = Extract<ManuscriptNavigationEntry, { kind: "node" }>;
export function findPlanNode(
  entries: ManuscriptNavigationEntry[],
  id: string,
): Node | undefined {
  for (const entry of entries) {
    if (entry.kind !== "node") continue;
    if (entry.id === id) return entry;
    const nested = findPlanNode(entry.children, id);
    if (nested) return nested;
  }
  return undefined;
}

export function PlanStructureEditor({
  projectId,
  node,
  onApplied,
}: {
  projectId: string;
  node: Node;
  onApplied: () => Promise<void>;
}) {
  const [selection, setSelection] = useState(node.id);
  const [title, setTitle] = useState(node.title);
  const [preview, setPreview] = useState<{
    change: PlanningStructuralChange;
    description: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const index = node.children.findIndex(
    (entry) => entry.kind === "node" && entry.id === selection,
  );
  const base = () => ({
    id: crypto.randomUUID(),
    reason: "Modification demandée par l’auteur dans le plan.",
    consequences: [],
  });
  function choose(id: string) {
    setSelection(id);
    setPreview(undefined);
    setMessage(undefined);
    setTitle(
      id === node.id
        ? node.title
        : (findPlanNode(node.children, id)?.title ?? ""),
    );
  }
  async function apply() {
    if (!preview || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await applyPlanningStructuralDiff(projectId, [preview.change]);
      setPreview(undefined);
      setMessage("Structure enregistrée.");
      await onApplied();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Le changement n’a pas pu être appliqué.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Modifier la structure" {...stylex.props(s.stack)}>
      <label>
        Élément à modifier{" "}
        <select
          aria-label="Élément du plan"
          value={selection}
          disabled={busy}
          onChange={(event) => choose(event.target.value)}
        >
          <option value={node.id}>{node.title}</option>
          {node.children.map(
            (entry) =>
              entry.kind === "node" && (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ),
          )}
          <option value="new">Nouvelle section</option>
        </select>
      </label>
      <Input
        aria-label="Titre de l’élément du plan"
        value={title}
        disabled={busy}
        onChange={(event) => {
          setTitle(event.target.value);
          setPreview(undefined);
        }}
      />
      <div {...stylex.props(s.row)}>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !title.trim()}
          onClick={() =>
            setPreview(
              selection === "new"
                ? {
                    change: {
                      ...base(),
                      kind: "create_node",
                      parentNodeId: node.id,
                      index: node.children.length,
                      node: { id: crypto.randomUUID(), title: title.trim() },
                    },
                    description: `Ajouter « ${title.trim()} » à la fin de « ${node.title} ».`,
                  }
                : {
                    change: {
                      ...base(),
                      kind: "rename_node",
                      nodeId: selection,
                      title: title.trim(),
                    },
                    description: `Renommer l’élément en « ${title.trim()} ».`,
                  },
            )
          }
        >
          Préparer {selection === "new" ? "l’ajout" : "le renommage"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || index <= 0}
          onClick={() =>
            setPreview({
              change: {
                ...base(),
                kind: "move_node",
                nodeId: selection,
                parentNodeId: node.id,
                index: index - 1,
              },
              description: `Monter « ${title} » d’une position.`,
            })
          }
        >
          Monter
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || index < 0 || index >= node.children.length - 1}
          onClick={() =>
            setPreview({
              change: {
                ...base(),
                kind: "move_node",
                nodeId: selection,
                parentNodeId: node.id,
                index: index + 1,
              },
              description: `Descendre « ${title} » d’une position.`,
            })
          }
        >
          Descendre
        </Button>
      </div>
      {preview && (
        <div {...stylex.props(s.card)}>
          <p>{preview.description}</p>
          <p {...stylex.props(s.meta)}>
            Le texte rédigé est conservé. Vérifiez ce changement avant de
            l’appliquer.
          </p>
          <Button disabled={busy} onClick={() => void apply()}>
            {busy ? "Enregistrement…" : "Appliquer le changement"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setPreview(undefined)}
          >
            Annuler
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" {...stylex.props(s.error)}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
