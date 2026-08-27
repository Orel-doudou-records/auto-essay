import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import type { DraftUnit } from "@auto-essay/core";
import { exportProject } from "@/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnits } from "@/hooks/useUnits";
import { themeVars } from "../styles/tokens.stylex";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 600;

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const { units, loading, error, add, update, generate, reviseChat } = useUnits(projectId);
  const [selectedUnit, setSelectedUnit] = useState<DraftUnit | null>(null);
  const [newSection, setNewSection] = useState("");
  const [isNavigationOpen, setNavigationOpen] = useState(false);
  const [isInspectorOpen, setInspectorOpen] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<number>();
  const saveSequence = useRef(0);
  const selectedUnitId = useRef<string | null>(null);
  const requestedUnitId = searchParams.get("unitId");

  function clearPendingSave() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
  }

  function selectUnit(unit: DraftUnit) {
    clearPendingSave();
    saveSequence.current += 1;
    selectedUnitId.current = unit.id;
    setSelectedUnit(unit);
    setDraftContent(unit.content);
    setSaveStatus("saved");
  }

  useEffect(() => {
    if (!requestedUnitId) return;
    const requestedUnit = units.find((unit) => unit.id === requestedUnitId);
    if (requestedUnit) selectUnit(requestedUnit);
  }, [requestedUnitId, units]);

  useEffect(() => () => clearPendingSave(), []);

  async function handleAddUnit(event: React.FormEvent) {
    event.preventDefault();
    if (!newSection.trim()) return;
    const unit = await add(newSection);
    if (unit) {
      setNewSection("");
      selectUnit(unit);
      setNavigationOpen(false);
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

    saveTimer.current = window.setTimeout(() => {
      void saveUnit(unitId, content, sequence);
    }, SAVE_DELAY_MS);
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

  async function handleGenerate() {
    if (!selectedUnit) return;
    const generated = await generate(selectedUnit.id);
    if (generated) selectUnit(generated);
  }

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
            <p {...stylex.props(styles.eyebrow)}>Écriture</p>
          </div>
          <div {...stylex.props(styles.toolbarCluster)}>
            <Button type="button" variant="ghost" size="sm" onClick={handleExport}>
              Exporter
            </Button>
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
              <nav id="manuscript-navigation" aria-label="Unités du manuscrit">
                <div {...stylex.props(styles.panelHeader)}>
                  <h2 {...stylex.props(styles.panelTitle)}>Manuscrit</h2>
                  <span {...stylex.props(styles.panelMeta)}>{units.length} unité{units.length > 1 ? "s" : ""}</span>
                </div>
                <form {...stylex.props(styles.createForm)} onSubmit={handleAddUnit}>
                  <Input
                    value={newSection}
                    onChange={(event) => setNewSection(event.target.value)}
                    placeholder="Nouvelle unité"
                    aria-label="Nouvelle unité"
                  />
                  <Button type="submit" size="sm" disabled={!newSection.trim()}>
                    Créer
                  </Button>
                </form>
                {loading && <p {...stylex.props(styles.panelMessage)}>Chargement…</p>}
                {error && <p {...stylex.props(styles.errorMessage)}>{error.message}</p>}
                <div {...stylex.props(styles.unitList)}>
                  {units.map((unit) => {
                    const active = selectedUnit?.id === unit.id;
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        {...stylex.props(styles.unitButton, active && styles.unitButtonActive)}
                        onClick={() => selectUnit(unit)}
                      >
                        <span {...stylex.props(styles.unitTitle)}>
                          {unit.thesis || unit.contextInPlan?.section || "Sans titre"}
                        </span>
                        <span {...stylex.props(styles.unitMeta)}>
                          {unit.status} · v{unit.version}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
              />
            ) : (
              <EmptyEditorState
                onCreate={() => setNavigationOpen(true)}
                onChoose={() => setNavigationOpen(true)}
              />
            )}
          </main>

          {isInspectorOpen && selectedUnit && (
            <aside
              id="editorial-inspector"
              role="complementary"
              aria-label="Inspecteur éditorial"
              {...stylex.props(styles.inspectorPanel)}
            >
              <ChatPanel
                projectId={projectId ?? ""}
                unit={selectedUnit}
                onGenerate={() => void handleGenerate()}
                onRevise={selectUnit}
                onReviseChat={reviseChat}
              />
            </aside>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function EmptyEditorState({ onCreate, onChoose }: { onCreate: () => void; onChoose: () => void }) {
  return (
    <section {...stylex.props(styles.emptyState)} aria-label="Aucune unité sélectionnée">
      <p {...stylex.props(styles.eyebrow)}>Manuscrit</p>
      <h1 {...stylex.props(styles.emptyTitle)}>Un espace pour écrire.</h1>
      <p {...stylex.props(styles.emptyDescription)}>
        Créez une unité ou retrouvez un passage du manuscrit pour commencer.
      </p>
      <div {...stylex.props(styles.emptyActions)}>
        <Button type="button" onClick={onCreate}>Créer une unité</Button>
        <Button type="button" variant="outline" onClick={onChoose}>Choisir dans le manuscrit</Button>
      </div>
    </section>
  );
}

function UnitEditor({
  unit,
  content,
  saveStatus,
  onChange,
}: {
  unit: DraftUnit;
  content: string;
  saveStatus: SaveStatus;
  onChange: (content: string) => void;
}) {
  const title = unit.thesis || unit.contextInPlan?.section || "Sans titre";
  return (
    <article {...stylex.props(styles.manuscript)}>
      <header {...stylex.props(styles.manuscriptHeader)}>
        <h1 {...stylex.props(styles.manuscriptTitle)}>{title}</h1>
        <SaveIndicator status={saveStatus} />
      </header>
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

function ChatPanel({
  projectId,
  unit,
  onGenerate,
  onRevise,
  onReviseChat,
}: {
  projectId: string;
  unit: DraftUnit;
  onGenerate: () => void;
  onRevise: (unit: DraftUnit) => void;
  onReviseChat: (unitId: string, instruction: string) => Promise<{
    before: string;
    after: string;
    unit: DraftUnit;
  } | undefined>;
}) {
  const [instruction, setInstruction] = useState("");
  const [after, setAfter] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      const result = await onReviseChat(unit.id, instruction);
      if (result) {
        setAfter(result.after);
        onRevise(result.unit);
      }
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    await onReviseChat(unit.id, "Applique la révision.");
    setAfter("");
  }

  return (
    <section {...stylex.props(styles.inspectorContent)}>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Unité · {unit.status}</p>
        <h2 {...stylex.props(styles.inspectorTitle)}>Révision assistée</h2>
      </header>
      <Button type="button" variant="outline" size="sm" onClick={onGenerate} fullWidth>
        Générer une version
      </Button>
      <form {...stylex.props(styles.reviewForm)} onSubmit={handleSubmit}>
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Instruction de révision…"
          rows={3}
        />
        <Button type="submit" size="sm" disabled={busy} fullWidth>
          {busy ? "Révision…" : "Réviser"}
        </Button>
      </form>

      {after && (
        <section {...stylex.props(styles.reviewResult)} aria-label="Proposition de révision">
          <p {...stylex.props(styles.resultTitle)}>Résultat</p>
          <p {...stylex.props(styles.resultText)}>{after}</p>
          <div {...stylex.props(styles.resultActions)}>
            <Button size="sm" variant="outline" onClick={() => void accept()}>Accepter</Button>
            <Button size="sm" variant="ghost" onClick={() => setAfter("")}>Rejeter</Button>
          </div>
        </section>
      )}

      <Link {...stylex.props(styles.evaluationLink)} to={`/projects/${projectId}/evaluate/${unit.id}`}>
        Évaluer cette unité
      </Link>
    </section>
  );
}

const styles = stylex.create({
  workspace: {
    display: "flex",
    flexDirection: "column",
    minHeight: "calc(100vh - 3rem)",
  },
  toolbar: {
    alignItems: "center",
    borderBottomColor: themeVars.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    justifyContent: "space-between",
    minHeight: "3.5rem",
    padding: {
      default: "0",
      "@media (max-width: 48rem)": "0.5rem 0.75rem",
    },
  },
  toolbarCluster: {
    alignItems: "center",
    display: "flex",
    gap: "0.625rem",
  },
  eyebrow: {
    color: themeVars.textSubtle,
    fontFamily: themeVars.fontInterface,
    fontSize: "0.75rem",
    fontWeight: 650,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  body: {
    display: "flex",
    flex: "1",
    minHeight: 0,
  },
  navigationPanel: {
    borderRightColor: themeVars.border,
    borderRightStyle: "solid",
    borderRightWidth: "1px",
    flexShrink: 0,
    backgroundColor: {
      default: "transparent",
      "@media (max-width: 48rem)": themeVars.surface,
    },
    bottom: {
      default: "auto",
      "@media (max-width: 48rem)": 0,
    },
    boxShadow: {
      default: "none",
      "@media (max-width: 48rem)": themeVars.shadow,
    },
    left: {
      default: "auto",
      "@media (max-width: 48rem)": 0,
    },
    overflowY: {
      default: "visible",
      "@media (max-width: 48rem)": "auto",
    },
    padding: "1.25rem 1rem",
    position: {
      default: "static",
      "@media (max-width: 48rem)": "fixed",
    },
    top: {
      default: "auto",
      "@media (max-width: 48rem)": "4.5rem",
    },
    width: {
      default: "16rem",
      "@media (max-width: 48rem)": "min(18rem, 88vw)",
    },
    zIndex: 10,
  },
  panelHeader: {
    alignItems: "baseline",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "1rem",
  },
  panelTitle: {
    color: themeVars.textPrimary,
    fontSize: "0.9375rem",
    fontWeight: 650,
    margin: 0,
  },
  panelMeta: {
    color: themeVars.textSubtle,
    fontSize: "0.75rem",
  },
  createForm: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1rem",
  },
  panelMessage: {
    color: themeVars.textSecondary,
    fontSize: "0.875rem",
  },
  errorMessage: {
    color: themeVars.danger,
    fontSize: "0.875rem",
  },
  unitList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  unitButton: {
    backgroundColor: {
      default: "transparent",
      ':hover': themeVars.accentMuted,
    },
    borderColor: "transparent",
    borderRadius: themeVars.radiusSmall,
    borderStyle: "solid",
    borderWidth: 0,
    color: themeVars.textPrimary,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "0.1875rem",
    padding: "0.625rem 0.75rem",
    textAlign: "left",
    width: "100%",
  },
  unitButtonActive: {
    backgroundColor: themeVars.accentMuted,
  },
  unitTitle: {
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  unitMeta: {
    color: themeVars.textSubtle,
    fontSize: "0.75rem",
  },
  editorColumn: {
    alignItems: "stretch",
    display: "flex",
    flex: "1",
    justifyContent: "center",
    minWidth: 0,
    padding: {
      default: "2.5rem clamp(1rem, 6vw, 6rem)",
      "@media (max-width: 48rem)": "1.5rem 1rem 2.5rem",
    },
  },
  emptyState: {
    alignSelf: "center",
    maxWidth: "34rem",
    paddingBottom: "12vh",
  },
  emptyTitle: {
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontManuscript,
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    fontWeight: 500,
    letterSpacing: "-0.035em",
    lineHeight: 1.04,
    margin: "0.75rem 0 1rem",
  },
  emptyDescription: {
    color: themeVars.textSecondary,
    fontFamily: themeVars.fontManuscript,
    fontSize: "1.125rem",
    lineHeight: 1.65,
    margin: 0,
    maxWidth: "28rem",
  },
  emptyActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    marginTop: "1.75rem",
  },
  manuscript: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "48rem",
    minHeight: {
      default: "min(44rem, calc(100vh - 12rem))",
      "@media (max-width: 48rem)": "calc(100vh - 11rem)",
    },
    width: "100%",
  },
  manuscriptHeader: {
    alignItems: "flex-start",
    borderBottomColor: themeVars.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "flex",
    gap: "1rem",
    justifyContent: "space-between",
    marginBottom: "1.5rem",
    paddingBottom: "1rem",
  },
  manuscriptTitle: {
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontManuscript,
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
    fontWeight: 500,
    letterSpacing: "-0.03em",
    lineHeight: 1.15,
    margin: "0.5rem 0 0",
  },
  saveIndicator: {
    color: themeVars.textSubtle,
    fontSize: "0.75rem",
    margin: 0,
  },
  saveError: {
    color: themeVars.danger,
  },
  manuscriptField: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderStyle: "solid",
    borderWidth: 0,
    color: themeVars.textPrimary,
    flex: "1",
    fontFamily: themeVars.fontManuscript,
    fontSize: "1.1875rem",
    lineHeight: 1.78,
    minHeight: "28rem",
    outline: {
      ':focus-visible': `2px solid ${themeVars.focus}`,
    },
    outlineOffset: "0.5rem",
    padding: 0,
    resize: "none",
    width: "100%",
    '::placeholder': {
      color: themeVars.textSubtle,
    },
  },
  inspectorPanel: {
    borderLeftColor: themeVars.border,
    borderLeftStyle: "solid",
    backgroundColor: {
      default: "transparent",
      "@media (max-width: 48rem)": themeVars.surface,
    },
    borderLeftWidth: "1px",
    bottom: {
      default: "auto",
      "@media (max-width: 48rem)": 0,
    },
    boxShadow: {
      default: "none",
      "@media (max-width: 48rem)": themeVars.shadow,
    },
    flexShrink: 0,
    overflowY: {
      default: "visible",
      "@media (max-width: 48rem)": "auto",
    },
    padding: "1.5rem 1.25rem",
    position: {
      default: "static",
      "@media (max-width: 48rem)": "fixed",
    },
    right: {
      default: "auto",
      "@media (max-width: 48rem)": 0,
    },
    top: {
      default: "auto",
      "@media (max-width: 48rem)": "4.5rem",
    },
    width: {
      default: "20rem",
      "@media (max-width: 48rem)": "min(22rem, 88vw)",
    },
    zIndex: 10,
  },
  inspectorContent: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  inspectorTitle: {
    color: themeVars.textPrimary,
    fontSize: "1.125rem",
    fontWeight: 650,
    margin: "0.375rem 0 0",
  },
  reviewForm: {
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
  },
  reviewResult: {
    backgroundColor: themeVars.surfaceRaised,
    borderRadius: themeVars.radiusSmall,
    padding: "0.875rem",
  },
  resultTitle: {
    color: themeVars.textPrimary,
    fontSize: "0.875rem",
    fontWeight: 650,
    margin: 0,
  },
  resultText: {
    color: themeVars.textSecondary,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    margin: "0.5rem 0 0",
    whiteSpace: "pre-wrap",
  },
  resultActions: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "0.75rem",
  },
  evaluationLink: {
    color: themeVars.accent,
    fontSize: "0.875rem",
    fontWeight: 600,
    textDecoration: {
      default: "none",
      ':hover': "underline",
    },
  },
});
