import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import type { DraftUnit, RevisionProposal } from "@auto-essay/core";
import { exportProject, type ManuscriptNavigationEntry } from "@/api";
import {
  acceptCollaborativeRevisionWork,
  isCollaborativeRevisionSuggestion,
  rejectCollaborativeRevisionWork,
  type CollaborativeRevisionCommandResult,
  type PublicCollaborativeRevisionWork,
  type RevisionSuggestionPayload,
} from "@/api/revisionWork";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { themeVars } from "../styles/tokens.stylex";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type NodeScope = { id: string; title: string; depth: number };

const SAVE_DELAY_MS = 600;

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { units, loading, error, add, update, generate, reviseChat, split, mergeNext } = useUnits(projectId);
  const {
    entries: navigationEntries,
    loading: navigationLoading,
    error: navigationError,
    reload: reloadNavigation,
  } = useManuscriptNavigation(projectId);
  const [selectedUnit, setSelectedUnit] = useState<DraftUnit | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeScope | null>(null);
  const [newSection, setNewSection] = useState("");
  const [isCreating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [isNavigationOpen, setNavigationOpen] = useState(true);
  const requestedUnitId = searchParams.get("unitId");
  const [isInspectorOpen, setInspectorOpen] = useState(Boolean(requestedUnitId));
  const [draftContent, setDraftContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [granularityBusy, setGranularityBusy] = useState(false);
  const [granularityError, setGranularityError] = useState<string>();
  const saveTimer = useRef<number>();
  const saveSequence = useRef(0);
  const selectedUnitId = useRef<string | null>(null);
  const requestedNewUnit = searchParams.get("new") === "1";

  function clearPendingSave() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }

  function selectUnit(unit: DraftUnit) {
    clearPendingSave();
    saveSequence.current += 1;
    selectedUnitId.current = unit.id;
    setSelectedNode(null);
    setSelectedUnit(unit);
    setDraftContent(unit.content);
    setSaveStatus("saved");
    setInspectorOpen(true);
  }

  function selectNode(scope: NodeScope) {
    clearPendingSave();
    saveSequence.current += 1;
    selectedUnitId.current = null;
    setSelectedUnit(null);
    setSelectedNode(scope);
    setDraftContent("");
    setSaveStatus("idle");
    setInspectorOpen(true);
  }

  useEffect(() => {
    if (!requestedUnitId) return;
    const requestedUnit = units.find((unit) => unit.id === requestedUnitId);
    if (requestedUnit) selectUnit(requestedUnit);
  }, [requestedUnitId, units]);

  useEffect(() => () => clearPendingSave(), []);

  async function handleAddUnit(event: React.FormEvent) {
    event.preventDefault();
    if (!newSection.trim() || isCreating) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      const unit = await add(newSection);
      if (unit) {
        setNewSection("");
        selectUnit(unit);
        void reloadNavigation();
      }
    } catch {
      setCreateError("La section n’a pas pu être créée. Réessayez.");
    } finally {
      setCreating(false);
    }
  }

  async function handleExport() {
    if (!projectId) return;
    const { markdown } = await exportProject(projectId);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "export.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function queueSave(content: string) {
    if (!selectedUnit) return;
    clearPendingSave();
    setDraftContent(content);
    setSaveStatus("dirty");
    const unitId = selectedUnit.id;
    const sequence = saveSequence.current + 1;
    saveSequence.current = sequence;
    saveTimer.current = window.setTimeout(() => void saveUnit(unitId, content, sequence), SAVE_DELAY_MS);
  }

  async function saveUnit(unitId: string, content: string, sequence: number) {
    const isCurrentSave = () => selectedUnitId.current === unitId && saveSequence.current === sequence;
    if (isCurrentSave()) setSaveStatus("saving");
    try {
      const savedUnit = await update(unitId, { content });
      if (savedUnit && isCurrentSave()) setSelectedUnit(savedUnit);
      if (isCurrentSave()) setSaveStatus("saved");
    } catch {
      if (isCurrentSave()) setSaveStatus("error");
    }
  }

  async function applyRevisionProposal(proposal: RevisionProposal, content: string) {
    if (!selectedUnit || selectedUnit.id !== proposal.unitId || selectedUnit.version !== proposal.sourceVersion) return;
    const applied = await update(proposal.unitId, { content, version: selectedUnit.version + 1 });
    if (applied) selectUnit(applied);
  }

  async function applyCollaborativeRevision(
    work: PublicCollaborativeRevisionWork,
    content: string
  ): Promise<CollaborativeRevisionCommandResult | undefined> {
    if (!projectId || !selectedUnit || selectedUnit.id !== work.unitId) return;
    const result = await acceptCollaborativeRevisionWork(projectId, work.unitId, work.id, content);
    if (result.status === "integrated") selectUnit(result.unit);
    return result;
  }

  async function rejectCollaborativeRevision(
    work: PublicCollaborativeRevisionWork
  ): Promise<CollaborativeRevisionCommandResult | undefined> {
    if (!projectId || !selectedUnit || selectedUnit.id !== work.unitId) return;
    return rejectCollaborativeRevisionWork(projectId, work.unitId, work.id);
  }

  async function handleGenerate() {
    if (!selectedUnit) return;
    const generated = await generate(selectedUnit.id);
    if (generated) selectUnit(generated);
  }

  async function changeGranularity(action: (unitId: string) => ReturnType<typeof split>) {
    if (!selectedUnit || granularityBusy || saveStatus !== "saved") return;
    setGranularityBusy(true);
    setGranularityError(undefined);
    try {
      const result = await action(selectedUnit.id);
      const nextUnit = result && result.units.find((unit) => unit.id === result.unitIds[0]);
      if (nextUnit) selectUnit(nextUnit);
      void reloadNavigation();
    } catch (reason) {
      setGranularityError(reason instanceof Error ? reason.message : "La granularité ne peut pas être modifiée.");
    } finally {
      setGranularityBusy(false);
    }
  }

  const activeScopeTitle = selectedUnit
    ? selectedUnit.thesis || selectedUnit.contextInPlan?.section || "Sans titre"
    : selectedNode?.title;

  return (
    <AppShell projectId={projectId}>
      <section {...stylex.props(styles.workspace)} aria-label="Espace d’écriture">
        <header {...stylex.props(styles.toolbar)}>
          <div {...stylex.props(styles.toolbarCluster)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setNavigationOpen((open) => !open)}
              aria-expanded={isNavigationOpen}
              aria-controls="manuscript-navigation"
            >
              {isNavigationOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
            </Button>
            <p {...stylex.props(styles.eyebrow)}>Manuscrit</p>
            {activeScopeTitle && <span {...stylex.props(styles.scopeName)}>· {activeScopeTitle}</span>}
          </div>
          <div {...stylex.props(styles.toolbarCluster)}>
            <Link to={`/projects/${projectId}/reimport`} {...stylex.props(styles.toolbarLink)}>Comparer un nouveau fichier</Link>
            <Button type="button" variant="ghost" size="sm" onClick={handleExport}>Exporter</Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInspectorOpen((open) => !open)}
              aria-expanded={isInspectorOpen}
              aria-controls="editorial-inspector"
            >
              {isInspectorOpen ? "Fermer les outils" : "Ouvrir les outils"}
            </Button>
          </div>
        </header>

        <div {...stylex.props(styles.body)}>
          {isNavigationOpen && (
            <aside {...stylex.props(styles.navigationPanel)}>
              <nav id="manuscript-navigation" aria-label="Structure du manuscrit">
                <div {...stylex.props(styles.panelHeader)}>
                  <div>
                    <p {...stylex.props(styles.eyebrow)}>Livre</p>
                    <h2 {...stylex.props(styles.panelTitle)}>Structure</h2>
                  </div>
                </div>
                <form {...stylex.props(styles.createForm)} onSubmit={handleAddUnit}>
                  <Input
                    value={newSection}
                    onChange={(event) => setNewSection(event.target.value)}
                    placeholder="Nouvelle section"
                    aria-label="Nouvelle section"
                  />
                  <Button type="submit" size="sm" disabled={!newSection.trim() || isCreating}>
                    {isCreating ? "Création…" : "Créer"}
                  </Button>
                </form>
                {createError && <p role="alert" {...stylex.props(styles.errorMessage)}>{createError}</p>}
                {(loading || navigationLoading) && <p {...stylex.props(styles.panelMessage)}>Chargement…</p>}
                {error && <p {...stylex.props(styles.errorMessage)}>{error.message}</p>}
                {navigationError && <p {...stylex.props(styles.errorMessage)}>{navigationError.message}</p>}
                <ManuscriptNavigation
                  entries={navigationEntries}
                  units={units}
                  selectedNodeId={selectedNode?.id}
                  selectedUnitId={selectedUnit?.id}
                  onSelectNode={selectNode}
                  onSelectUnit={selectUnit}
                />
              </nav>
            </aside>
          )}

          <main {...stylex.props(styles.editorColumn)}>
            {selectedUnit ? (
              <UnitEditor
                unit={selectedUnit}
                content={draftContent}
                saveStatus={saveStatus}
                onChange={queueSave}
                onSplit={() => void changeGranularity(split)}
                onMergeNext={() => void changeGranularity(mergeNext)}
                granularityBusy={granularityBusy}
                granularityError={granularityError}
              />
            ) : selectedNode ? (
              <NodeScopeView projectId={projectId ?? ""} scope={selectedNode} />
            ) : requestedNewUnit && !loading && units.length === 0 ? (
              <StartWritingForm
                section={newSection}
                onChange={setNewSection}
                onSubmit={handleAddUnit}
                isCreating={isCreating}
                error={createError}
              />
            ) : (
              <EmptyEditorState onCreate={() => setNavigationOpen(true)} onChoose={() => setNavigationOpen(true)} />
            )}
          </main>

          {isInspectorOpen && (selectedUnit || selectedNode) && (
            <aside
              id="editorial-inspector"
              role="complementary"
              aria-label="Inspecteur éditorial"
              {...stylex.props(styles.inspectorPanel)}
            >
              {selectedUnit ? (
                <ChatPanel
                  projectId={projectId ?? ""}
                  unit={selectedUnit}
                  manuscript={draftContent}
                  onGenerate={() => void handleGenerate()}
                  onApplyProposal={(proposal, content) => void applyRevisionProposal(proposal, content)}
                  onApplyCollaborative={applyCollaborativeRevision}
                  onRejectCollaborative={rejectCollaborativeRevision}
                  onReviseChat={reviseChat}
                />
              ) : selectedNode ? (
                <NodeContextPanel projectId={projectId ?? ""} scope={selectedNode} />
              ) : null}
            </aside>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function ManuscriptNavigation({
  entries,
  units,
  selectedNodeId,
  selectedUnitId,
  onSelectNode,
  onSelectUnit,
}: {
  entries: ManuscriptNavigationEntry[];
  units: DraftUnit[];
  selectedNodeId: string | undefined;
  selectedUnitId: string | undefined;
  onSelectNode: (scope: NodeScope) => void;
  onSelectUnit: (unit: DraftUnit) => void;
}) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  return (
    <ul {...stylex.props(styles.tree)}>
      {entries.map((entry, index) => (
        <ManuscriptNavigationEntryView
          key={entry.kind === "node" ? entry.id : `${entry.unitId}:${entry.version}`}
          entry={entry}
          unitsById={unitsById}
          selectedNodeId={selectedNodeId}
          selectedUnitId={selectedUnitId}
          onSelectNode={onSelectNode}
          onSelectUnit={onSelectUnit}
          depth={0}
          position={index}
        />
      ))}
    </ul>
  );
}

function ManuscriptNavigationEntryView({
  entry,
  unitsById,
  selectedNodeId,
  selectedUnitId,
  onSelectNode,
  onSelectUnit,
  depth,
  position,
}: {
  entry: ManuscriptNavigationEntry;
  unitsById: Map<string, DraftUnit>;
  selectedNodeId: string | undefined;
  selectedUnitId: string | undefined;
  onSelectNode: (scope: NodeScope) => void;
  onSelectUnit: (unit: DraftUnit) => void;
  depth: number;
  position: number;
}) {
  if (entry.kind === "node") {
    return (
      <li {...stylex.props(styles.treeNode)}>
        <button
          type="button"
          {...stylex.props(styles.nodeButton, selectedNodeId === entry.id && styles.unitButtonActive)}
          onClick={() => onSelectNode({ id: entry.id, title: entry.title, depth })}
        >
          {entry.title}
        </button>
        {entry.children.length > 0 && (
          <ul {...stylex.props(styles.tree)}>
            {entry.children.map((child, childPosition) => (
              <ManuscriptNavigationEntryView
                key={child.kind === "node" ? child.id : `${child.unitId}:${child.version}`}
                entry={child}
                unitsById={unitsById}
                selectedNodeId={selectedNodeId}
                selectedUnitId={selectedUnitId}
                onSelectNode={onSelectNode}
                onSelectUnit={onSelectUnit}
                depth={depth + 1}
                position={childPosition}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }
  const unit = unitsById.get(entry.unitId);
  if (!unit) return null;
  return (
    <li>
      <button
        type="button"
        {...stylex.props(styles.unitButton, selectedUnitId === unit.id && styles.unitButtonActive)}
        onClick={() => onSelectUnit(unit)}
      >
        <span {...stylex.props(styles.unitTitle)}>
          {entry.granularity === "paragraph" ? `Paragraphe ${position + 1}` : "Section"}
        </span>
        <span {...stylex.props(styles.unitMeta)}>{unit.status} · v{entry.version}</span>
      </button>
    </li>
  );
}

function NodeScopeView({ projectId, scope }: { projectId: string; scope: NodeScope }) {
  const label = scope.depth === 0 ? "Chapitre" : "Section";
  return (
    <section {...stylex.props(styles.scopeOverview)} aria-label={`Scope courant : ${scope.title}`}>
      <p {...stylex.props(styles.eyebrow)}>Scope courant · {label}</p>
      <h1 {...stylex.props(styles.manuscriptTitle)}>{scope.title}</h1>
      <p {...stylex.props(styles.scopeDescription)}>
        Ce niveau est maintenant le contexte de travail. Sélectionnez un passage rédigé pour écrire ou réviser son texte.
      </p>
      {scope.depth === 0 && (
        <Link to={`/projects/${projectId}/chapitre?chapterId=${scope.id}`} {...stylex.props(styles.primaryLink)}>
          Travailler le plan du chapitre
        </Link>
      )}
    </section>
  );
}

function NodeContextPanel({ projectId, scope }: { projectId: string; scope: NodeScope }) {
  return (
    <section {...stylex.props(styles.inspectorContent)}>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Contexte du scope</p>
        <h2 {...stylex.props(styles.inspectorTitle)}>{scope.title}</h2>
      </header>
      <p {...stylex.props(styles.resultText)}>
        Les outils de planification restent sur l’écran existant jusqu’à leur intégration dans ce workspace.
      </p>
      {scope.depth === 0 && (
        <Link to={`/projects/${projectId}/chapitre?chapterId=${scope.id}`} {...stylex.props(styles.evaluationLink)}>
          Ouvrir le plan du chapitre
        </Link>
      )}
    </section>
  );
}

function StartWritingForm({ section, onChange, onSubmit, isCreating, error }: {
  section: string;
  onChange: (section: string) => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  isCreating: boolean;
  error?: string;
}) {
  return (
    <section {...stylex.props(styles.emptyState)} aria-label="Commencer à écrire">
      <p {...stylex.props(styles.eyebrow)}>Manuscrit</p>
      <h1 {...stylex.props(styles.emptyTitle)}>Commencer à écrire</h1>
      <p {...stylex.props(styles.emptyDescription)}>Donnez un titre à la première section : vous pourrez écrire dès sa création.</p>
      <form {...stylex.props(styles.createForm)} onSubmit={(event) => void onSubmit(event)}>
        <Input value={section} onChange={(event) => onChange(event.target.value)} placeholder="Première section" aria-label="Titre de votre première section" />
        <Button type="submit" disabled={!section.trim() || isCreating}>{isCreating ? "Création…" : "Créer et écrire"}</Button>
      </form>
      {error && <p role="alert" {...stylex.props(styles.errorMessage)}>{error}</p>}
    </section>
  );
}

function EmptyEditorState({ onCreate, onChoose }: { onCreate: () => void; onChoose: () => void }) {
  return (
    <section {...stylex.props(styles.emptyState)} aria-label="Aucune section sélectionnée">
      <p {...stylex.props(styles.eyebrow)}>Manuscrit</p>
      <h1 {...stylex.props(styles.emptyTitle)}>Un espace pour écrire.</h1>
      <p {...stylex.props(styles.emptyDescription)}>Créez une section ou retrouvez un passage du manuscrit pour commencer.</p>
      <div {...stylex.props(styles.emptyActions)}>
        <Button type="button" onClick={onCreate}>Ajouter une section</Button>
        <Button type="button" variant="outline" onClick={onChoose}>Choisir dans le manuscrit</Button>
      </div>
    </section>
  );
}

function UnitEditor({ unit, content, saveStatus, onChange, onSplit, onMergeNext, granularityBusy, granularityError }: {
  unit: DraftUnit;
  content: string;
  saveStatus: SaveStatus;
  onChange: (content: string) => void;
  onSplit: () => void;
  onMergeNext: () => void;
  granularityBusy: boolean;
  granularityError?: string;
}) {
  const title = unit.thesis || unit.contextInPlan?.section || "Sans titre";
  const scopeLabel = unit.granularity === "paragraph" ? "Paragraphe" : "Section";
  return (
    <article {...stylex.props(styles.manuscript)}>
      <header {...stylex.props(styles.manuscriptHeader)}>
        <div>
          <p {...stylex.props(styles.eyebrow)}>Scope courant · {scopeLabel}</p>
          <h1 {...stylex.props(styles.manuscriptTitle)}>{title}</h1>
          <div {...stylex.props(styles.granularityActions)}>
            <Button type="button" variant="ghost" size="sm" onClick={onSplit} disabled={unit.granularity !== "section" || saveStatus !== "saved" || granularityBusy}>
              {granularityBusy ? "Modification…" : "Scinder en paragraphes"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onMergeNext} disabled={saveStatus !== "saved" || granularityBusy}>
              Fusionner avec la suivante
            </Button>
          </div>
        </div>
        <SaveIndicator status={saveStatus} />
      </header>
      {granularityError && <p role="alert" {...stylex.props(styles.errorMessage)}>{granularityError}</p>}
      <textarea
        {...stylex.props(styles.manuscriptField)}
        aria-label={`Manuscrit : ${title}`}
        value={content}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Commencez à écrire…"
      />
    </article>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label = {
    idle: "Prêt à enregistrer",
    dirty: "Modifications à enregistrer",
    saving: "Enregistrement…",
    saved: "Enregistré",
    error: "Échec de l’enregistrement",
  }[status];
  return <p {...stylex.props(styles.saveIndicator, status === "error" && styles.saveError)}>{label}</p>;
}

function collaborativeResultMessage(result: CollaborativeRevisionCommandResult): string | undefined {
  switch (result.status) {
    case "stale": return "Le texte a évolué depuis cette proposition. Elle reste consultable mais ne peut pas être appliquée.";
    case "conflict": return "Cette proposition entre en conflit avec le texte actuel. Elle reste consultable mais ne peut pas être appliquée.";
    case "recovery_failed": return "La proposition ne peut pas être finalisée pour le moment. Le texte existant n’a pas été modifié.";
    case "unsupported_projection_drift":
    case "scope_mismatch": return result.message;
    default: return undefined;
  }
}

function ChatPanel({ projectId, unit, manuscript, onGenerate, onApplyProposal, onApplyCollaborative, onRejectCollaborative, onReviseChat }: {
  projectId: string;
  unit: DraftUnit;
  manuscript: string;
  onGenerate: () => void;
  onApplyProposal: (proposal: RevisionProposal, content: string) => void;
  onApplyCollaborative: (work: PublicCollaborativeRevisionWork, content: string) => Promise<CollaborativeRevisionCommandResult | undefined>;
  onRejectCollaborative: (work: PublicCollaborativeRevisionWork) => Promise<CollaborativeRevisionCommandResult | undefined>;
  onReviseChat: (unitId: string, instruction: string) => Promise<RevisionSuggestionPayload | undefined>;
}) {
  const [instruction, setInstruction] = useState("");
  const [suggestion, setSuggestion] = useState<RevisionSuggestionPayload | null>(null);
  const [proposedContent, setProposedContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!instruction.trim()) return;
    setBusy(true);
    setCommandMessage(undefined);
    try {
      const result = await onReviseChat(unit.id, instruction);
      if (result) {
        setSuggestion(result);
        setProposedContent(isCollaborativeRevisionSuggestion(result) ? result.work.proposedContent : result.proposal.content);
      }
    } finally {
      setBusy(false);
    }
  }

  const legacyProposal = suggestion && !isCollaborativeRevisionSuggestion(suggestion) ? suggestion.proposal : null;
  const collaborativeWork = suggestion && isCollaborativeRevisionSuggestion(suggestion) ? suggestion.work : null;
  const sourceContent = legacyProposal?.before ?? collaborativeWork?.base.content ?? "";
  const suggestionUnitId = legacyProposal?.unitId ?? collaborativeWork?.unitId;
  const presentationStale = suggestion !== null && (suggestionUnitId !== unit.id || manuscript !== sourceContent);
  const backendStale = collaborativeWork?.status === "stale";
  const isStale = presentationStale || backendStale;
  const legacyBlocked = legacyProposal !== null && presentationStale;
  const collaborativeBlocked = collaborativeWork?.status === "stale";
  const interactionBlocked = Boolean(legacyBlocked || collaborativeBlocked || actionBusy);
  const levelLabel = unit.granularity === "paragraph" ? "Paragraphe" : "Section";

  function clearSuggestion() {
    setSuggestion(null);
    setProposedContent("");
    setCommandMessage(undefined);
  }

  async function applySuggestion() {
    if (!suggestion || interactionBlocked) return;
    if (!isCollaborativeRevisionSuggestion(suggestion)) {
      onApplyProposal(suggestion.proposal, proposedContent);
      clearSuggestion();
      return;
    }
    setActionBusy(true);
    setCommandMessage(undefined);
    try {
      const result = await onApplyCollaborative(suggestion.work, proposedContent);
      if (!result) return;
      if (result.status === "integrated") {
        clearSuggestion();
        return;
      }
      if ("work" in result && result.work) setSuggestion({ kind: "collaborative", work: result.work });
      setCommandMessage(collaborativeResultMessage(result));
    } catch {
      setCommandMessage("La proposition n’a pas pu être appliquée. Le texte existant n’a pas été modifié.");
    } finally {
      setActionBusy(false);
    }
  }

  async function rejectSuggestion() {
    if (!suggestion || actionBusy) return;
    if (!isCollaborativeRevisionSuggestion(suggestion)) {
      clearSuggestion();
      return;
    }
    setActionBusy(true);
    setCommandMessage(undefined);
    try {
      const result = await onRejectCollaborative(suggestion.work);
      if (result?.status === "rejected") {
        clearSuggestion();
        return;
      }
      if (result) setCommandMessage(collaborativeResultMessage(result));
    } catch {
      setCommandMessage("La proposition n’a pas pu être refusée. Le texte existant n’a pas été modifié.");
    } finally {
      setActionBusy(false);
    }
  }

  const presentationMessage = commandMessage ?? (
    isStale
      ? legacyBlocked || backendStale
        ? "Le manuscrit a changé depuis cette proposition. Elle reste consultable, mais ne peut pas être appliquée."
        : "Le manuscrit a changé depuis cette proposition. Elle reste consultable ; sa compatibilité sera vérifiée au moment de l’application."
      : "Le manuscrit ne change qu’après votre application explicite."
  );

  return (
    <section {...stylex.props(styles.inspectorContent)}>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Contexte du scope · {levelLabel}</p>
        <h2 {...stylex.props(styles.inspectorTitle)}>Révision assistée</h2>
        <p {...stylex.props(styles.scopeMeta)}>{unit.status} · v{unit.version}</p>
      </header>
      <Button type="button" variant="outline" size="sm" onClick={onGenerate} fullWidth>Générer une version</Button>
      <form {...stylex.props(styles.reviewForm)} onSubmit={handleSubmit}>
        <Textarea
          aria-label="Instruction de révision"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Que voulez-vous travailler ici ?"
          rows={4}
        />
        <Button type="submit" size="sm" disabled={busy} fullWidth>{busy ? "Révision…" : "Réviser"}</Button>
      </form>

      {suggestion && (
        <section {...stylex.props(styles.reviewResult)} aria-label="Proposition de révision">
          <p {...stylex.props(styles.resultTitle)}>{isStale ? "Proposition périmée" : "Proposition de révision"}</p>
          <p {...stylex.props(styles.resultText)}>{presentationMessage}</p>
          <Textarea aria-label="Texte proposé" value={proposedContent} onChange={(event) => setProposedContent(event.target.value)} rows={8} disabled={interactionBlocked} />
          <details>
            <summary>Comparer avec le texte de départ</summary>
            <p {...stylex.props(styles.resultText)}>{sourceContent}</p>
          </details>
          <div {...stylex.props(styles.resultActions)}>
            <Button size="sm" variant="outline" onClick={() => void applySuggestion()} disabled={interactionBlocked}>Appliquer la proposition</Button>
            <Button size="sm" variant="ghost" onClick={() => void rejectSuggestion()} disabled={actionBusy}>Refuser la proposition</Button>
          </div>
        </section>
      )}

      <Link {...stylex.props(styles.evaluationLink)} to={`/projects/${projectId}/evaluate/${unit.id}`}>
        Évaluer ce {levelLabel.toLocaleLowerCase("fr-FR")}
      </Link>
    </section>
  );
}

const styles = stylex.create({
  workspace: { display: "flex", flexDirection: "column", minHeight: "calc(100vh - 3rem)" },
  toolbar: {
    alignItems: "center", borderBottomColor: themeVars.border, borderBottomStyle: "solid", borderBottomWidth: "1px",
    display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-between", minHeight: "3.5rem",
    padding: { default: "0 0.5rem", "@media (max-width: 48rem)": "0.5rem 0.75rem" },
  },
  toolbarCluster: { alignItems: "center", display: "flex", gap: "0.625rem" },
  toolbarLink: { color: themeVars.textSecondary, fontSize: "0.875rem", textDecoration: "none" },
  scopeName: { color: themeVars.textSecondary, fontFamily: themeVars.fontManuscript, fontSize: "0.875rem" },
  eyebrow: { color: themeVars.textSubtle, fontFamily: themeVars.fontInterface, fontSize: "0.72rem", fontWeight: 650, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" },
  body: { display: "flex", flex: "1", minHeight: 0 },
  navigationPanel: {
    borderRightColor: themeVars.border, borderRightStyle: "solid", borderRightWidth: "1px", flexShrink: 0,
    backgroundColor: { default: "transparent", "@media (max-width: 48rem)": themeVars.surface },
    bottom: { default: "auto", "@media (max-width: 48rem)": 0 },
    boxShadow: { default: "none", "@media (max-width: 48rem)": themeVars.shadow },
    left: { default: "auto", "@media (max-width: 48rem)": 0 },
    overflowY: "auto", padding: "1.25rem 1rem",
    position: { default: "static", "@media (max-width: 48rem)": "fixed" },
    top: { default: "auto", "@media (max-width: 48rem)": "4.5rem" },
    width: { default: "16rem", "@media (max-width: 48rem)": "min(18rem, 88vw)" }, zIndex: 10,
  },
  panelHeader: { alignItems: "baseline", display: "flex", justifyContent: "space-between", marginBottom: "1rem" },
  panelTitle: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "1.25rem", fontWeight: 500, margin: "0.2rem 0 0" },
  createForm: { display: "flex", gap: "0.5rem", marginBottom: "1rem" },
  panelMessage: { color: themeVars.textSecondary, fontSize: "0.875rem" },
  errorMessage: { color: themeVars.danger, fontSize: "0.875rem" },
  tree: { display: "flex", flexDirection: "column", gap: "0.2rem", listStyle: "none", margin: 0, paddingLeft: "0.7rem" },
  treeNode: { display: "flex", flexDirection: "column", gap: "0.2rem" },
  nodeButton: {
    backgroundColor: { default: "transparent", ':hover': themeVars.accentMuted }, borderColor: "transparent", borderRadius: themeVars.radiusSmall,
    borderStyle: "solid", borderWidth: 0, color: themeVars.textPrimary, cursor: "pointer", fontFamily: themeVars.fontManuscript,
    fontSize: "0.9rem", fontWeight: 600, padding: "0.45rem 0.5rem", textAlign: "left", width: "100%",
    outline: { ':focus-visible': `2px solid ${themeVars.focus}` }, outlineOffset: { ':focus-visible': "2px" },
  },
  unitButton: {
    backgroundColor: { default: "transparent", ':hover': themeVars.accentMuted }, borderColor: "transparent", borderRadius: themeVars.radiusSmall,
    borderStyle: "solid", borderWidth: 0, color: themeVars.textPrimary, cursor: "pointer", display: "flex", flexDirection: "column",
    gap: "0.1875rem", padding: "0.55rem 0.6rem", textAlign: "left", width: "100%",
    outline: { ':focus-visible': `2px solid ${themeVars.focus}` }, outlineOffset: { ':focus-visible': "2px" },
  },
  unitButtonActive: { backgroundColor: themeVars.accentMuted },
  unitTitle: { fontSize: "0.84rem", fontWeight: 600 },
  unitMeta: { color: themeVars.textSubtle, fontSize: "0.72rem" },
  editorColumn: {
    alignItems: "stretch", display: "flex", flex: "1", justifyContent: "center", minWidth: 0,
    padding: { default: "2.5rem clamp(1.5rem, 5vw, 5rem)", "@media (max-width: 48rem)": "1.5rem 1rem 2.5rem" },
  },
  emptyState: { alignSelf: "center", maxWidth: "34rem", paddingBottom: "12vh" },
  emptyTitle: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1.04, margin: "0.75rem 0 1rem" },
  emptyDescription: { color: themeVars.textSecondary, fontFamily: themeVars.fontManuscript, fontSize: "1.125rem", lineHeight: 1.65, margin: 0, maxWidth: "28rem" },
  emptyActions: { display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.75rem" },
  scopeOverview: { alignSelf: "flex-start", maxWidth: "48rem", width: "100%" },
  scopeDescription: { color: themeVars.textSecondary, fontFamily: themeVars.fontManuscript, fontSize: "1.05rem", lineHeight: 1.7, maxWidth: "38rem" },
  primaryLink: { color: themeVars.accent, display: "inline-block", fontSize: "0.9rem", fontWeight: 600, marginTop: "1rem", textDecoration: "none" },
  manuscript: {
    display: "flex", flexDirection: "column", maxWidth: "48rem",
    minHeight: { default: "min(44rem, calc(100vh - 12rem))", "@media (max-width: 48rem)": "calc(100vh - 11rem)" }, width: "100%",
  },
  manuscriptHeader: { alignItems: "flex-start", borderBottomColor: themeVars.border, borderBottomStyle: "solid", borderBottomWidth: "1px", display: "flex", gap: "1rem", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem" },
  manuscriptTitle: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15, margin: "0.5rem 0 0" },
  granularityActions: { display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.5rem" },
  saveIndicator: { color: themeVars.textSubtle, fontSize: "0.75rem", margin: 0 },
  saveError: { color: themeVars.danger },
  manuscriptField: {
    backgroundColor: "transparent", borderColor: "transparent", borderStyle: "solid", borderWidth: 0, color: themeVars.textPrimary,
    flex: "1", fontFamily: themeVars.fontManuscript, fontSize: "1.1875rem", lineHeight: 1.78, minHeight: "28rem",
    outline: { ':focus-visible': `2px solid ${themeVars.focus}` }, outlineOffset: "0.5rem", padding: 0, resize: "none", width: "100%",
    '::placeholder': { color: themeVars.textSubtle },
  },
  inspectorPanel: {
    borderLeftColor: themeVars.border, borderLeftStyle: "solid", borderLeftWidth: "1px", flexShrink: 0,
    backgroundColor: { default: "transparent", "@media (max-width: 48rem)": themeVars.surface },
    bottom: { default: "auto", "@media (max-width: 48rem)": 0 },
    boxShadow: { default: "none", "@media (max-width: 48rem)": themeVars.shadow },
    overflowY: "auto", padding: "1.5rem 1.25rem",
    position: { default: "static", "@media (max-width: 48rem)": "fixed" },
    right: { default: "auto", "@media (max-width: 48rem)": 0 },
    top: { default: "auto", "@media (max-width: 48rem)": "4.5rem" },
    width: { default: "21rem", "@media (max-width: 48rem)": "min(22rem, 88vw)" }, zIndex: 10,
  },
  inspectorContent: { display: "flex", flexDirection: "column", gap: "1.25rem" },
  inspectorTitle: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "1.25rem", fontWeight: 500, margin: "0.35rem 0 0" },
  scopeMeta: { color: themeVars.textSubtle, fontSize: "0.75rem", margin: "0.3rem 0 0" },
  reviewForm: { display: "flex", flexDirection: "column", gap: "0.625rem" },
  reviewResult: { borderTopColor: themeVars.border, borderTopStyle: "solid", borderTopWidth: "1px", paddingTop: "1rem" },
  resultTitle: { color: themeVars.textPrimary, fontSize: "0.875rem", fontWeight: 650, margin: 0 },
  resultText: { color: themeVars.textSecondary, fontSize: "0.875rem", lineHeight: 1.5, margin: "0.5rem 0 0", whiteSpace: "pre-wrap" },
  resultActions: { display: "flex", gap: "0.5rem", marginTop: "0.75rem" },
  evaluationLink: { color: themeVars.accent, fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" },
});
