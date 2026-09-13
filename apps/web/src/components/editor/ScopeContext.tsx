import { useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  fetchScopeContext,
  setScopeContextSourceIncluded,
  type ScopeContext as ScopeContextData,
  type ScopeContextRef,
  type ScopeContextSource,
} from "@/api/scopeContext";
import { Button } from "@/components/ui/button";
import { themeVars } from "../../styles/tokens.stylex";

const SOURCE_STATE_LABELS: Record<ScopeContextSource["state"], string> = {
  explored: "Explorée",
  partial: "Partielle",
  registered_unexplored: "Enregistrée · non explorée",
  unusable: "Inutilisable",
};

export function ScopeContext({
  projectId,
  scope,
}: {
  projectId: string;
  scope: ScopeContextRef;
}) {
  const [context, setContext] = useState<ScopeContextData>();
  const [loading, setLoading] = useState(true);
  const [changingSourceId, setChangingSourceId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setContext(undefined);
    setError(undefined);
    void fetchScopeContext(projectId, scope)
      .then((next) => {
        if (active) setContext(next);
      })
      .catch(() => {
        if (active) setError("Le contexte de ce scope n’a pas pu être chargé.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, scope.kind, scope.id]);

  async function changeSource(source: ScopeContextSource) {
    if (!context?.sourceSelection.editable || changingSourceId) return;
    setChangingSourceId(source.id);
    setError(undefined);
    try {
      setContext(
        await setScopeContextSourceIncluded(projectId, scope, source.id, !source.included)
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "La sélection documentaire n’a pas pu être modifiée."
      );
    } finally {
      setChangingSourceId(undefined);
    }
  }

  return (
    <section aria-label="Contexte inspectable du scope" {...stylex.props(styles.root)}>
      <header>
        <p {...stylex.props(styles.eyebrow)}>Contexte mobilisé</p>
        <p {...stylex.props(styles.help)}>
          Sources, cadrage et décisions réellement rattachés à ce scope.
        </p>
      </header>

      {loading && <p {...stylex.props(styles.status)}>Chargement du contexte…</p>}
      {error && <p role="alert" {...stylex.props(styles.error)}>{error}</p>}

      {context && (
        <>
          <p role="status" {...stylex.props(styles.coverage)}>
            {explorationLabel(context)}
          </p>

          <details {...stylex.props(styles.details)}>
            <summary>Texte existant</summary>
            <p {...stylex.props(styles.detailText)}>
              {context.text.trim() || "Aucun texte rédigé dans ce scope."}
            </p>
          </details>

          {context.planning && (
            <section aria-label="Cadrage du scope" {...stylex.props(styles.section)}>
              <h3 {...stylex.props(styles.sectionTitle)}>Cadrage</h3>
              <p {...stylex.props(styles.detailText)}>{context.planning.question}</p>
              {context.planning.intention && (
                <p {...stylex.props(styles.metaText)}>Intention · {context.planning.intention}</p>
              )}
              {context.planning.angleOrFunction && (
                <p {...stylex.props(styles.metaText)}>Fonction · {context.planning.angleOrFunction}</p>
              )}
            </section>
          )}

          <section aria-label="Sources du scope" {...stylex.props(styles.section)}>
            <div {...stylex.props(styles.sectionHeading)}>
              <h3 {...stylex.props(styles.sectionTitle)}>Sources</h3>
              <span {...stylex.props(styles.count)}>
                {context.sources.filter((source) => source.included).length}/{context.sources.length}
              </span>
            </div>
            {context.sources.length === 0 ? (
              <p {...stylex.props(styles.status)}>Aucune source enregistrée dans le projet.</p>
            ) : (
              <ul {...stylex.props(styles.sourceList)}>
                {context.sources.map((source) => (
                  <li key={source.id} {...stylex.props(styles.sourceItem)}>
                    <div {...stylex.props(styles.sourceHeader)}>
                      <div>
                        <strong {...stylex.props(styles.sourceTitle)}>{source.title}</strong>
                        <span
                          aria-label={`État documentaire : ${SOURCE_STATE_LABELS[source.state]}`}
                          {...stylex.props(styles.sourceState)}
                        >
                          {SOURCE_STATE_LABELS[source.state]}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!context.sourceSelection.editable || Boolean(changingSourceId)}
                        onClick={() => void changeSource(source)}
                        aria-label={`${source.included ? "Exclure" : "Ajouter"} ${source.title} ${source.included ? "du" : "au"} contexte`}
                      >
                        {changingSourceId === source.id
                          ? "Modification…"
                          : source.included
                            ? "Exclure"
                            : "Ajouter"}
                      </Button>
                    </div>
                    {source.abstract && <p {...stylex.props(styles.metaText)}>{source.abstract}</p>}
                    {source.coverage && (
                      <p {...stylex.props(styles.coverageMeta)}>
                        Couverture documentaire · {source.coverage.coveredBlocks}/{source.coverage.totalBlocks} blocs
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!context.sourceSelection.editable && context.sources.length > 0 && (
              <p {...stylex.props(styles.status)}>
                La sélection de sources deviendra modifiable lorsque ce scope aura un cadrage actif.
              </p>
            )}
          </section>

          {context.passages.length > 0 && (
            <section aria-label="Passages mobilisés" {...stylex.props(styles.section)}>
              <h3 {...stylex.props(styles.sectionTitle)}>Passages mobilisés</h3>
              <ol {...stylex.props(styles.passageList)}>
                {context.passages.map((passage, index) => (
                  <li key={`${passage.sourceId}:${index}`} {...stylex.props(styles.passage)}>
                    <p {...stylex.props(styles.detailText)}>{passage.text}</p>
                    {passage.pageRange && (
                      <p {...stylex.props(styles.coverageMeta)}>Repère · {passage.pageRange}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(context.exploration.gaps.length > 0 || context.exploration.underDocumentedHypotheses.length > 0) && (
            <section aria-label="Zones documentaires ouvertes" {...stylex.props(styles.section)}>
              <h3 {...stylex.props(styles.sectionTitle)}>À documenter</h3>
              <ul {...stylex.props(styles.compactList)}>
                {context.exploration.gaps.map((gap) => (
                  <li key={`${gap.description}:${gap.consequence}`}>{gap.description}</li>
                ))}
                {context.exploration.underDocumentedHypotheses.map((hypothesis) => (
                  <li key={hypothesis}>{hypothesis}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Décisions éditoriales du scope" {...stylex.props(styles.section)}>
            <h3 {...stylex.props(styles.sectionTitle)}>Décisions éditoriales</h3>
            {context.decisions.length === 0 ? (
              <p {...stylex.props(styles.status)}>Aucune décision active pour ce scope.</p>
            ) : (
              <ul {...stylex.props(styles.decisionList)}>
                {context.decisions.map((decision) => (
                  <li key={decision.id} {...stylex.props(styles.decision)}>
                    <p {...stylex.props(styles.detailText)}>{decision.contentCommitments.join(" · ")}</p>
                    {decision.formalCommitments.length > 0 && (
                      <p {...stylex.props(styles.metaText)}>{decision.formalCommitments.join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function explorationLabel(context: ScopeContextData): string {
  switch (context.exploration.status) {
    case "has_context":
      return context.exploration.complete
        ? "Contexte documentaire exploré pour les sources actuellement enregistrées."
        : "Contexte disponible ; le corpus pertinent reste partiellement exploré.";
    case "empty_library":
      return "Aucune source n’est encore enregistrée dans le projet.";
    case "no_result":
      return "Aucun résultat trouvé dans le corpus actuellement exploré.";
    case "incomplete":
      return "Corpus pertinent pas encore suffisamment exploré : l’absence de résultat n’est pas concluante.";
  }
}

const styles = stylex.create({
  root: {
    borderBottomColor: themeVars.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    paddingBottom: "1.25rem",
  },
  eyebrow: {
    color: themeVars.textSubtle,
    fontSize: "0.72rem",
    fontWeight: 650,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  help: { color: themeVars.textSecondary, fontSize: "0.82rem", lineHeight: 1.5, margin: "0.35rem 0 0" },
  status: { color: themeVars.textSubtle, fontSize: "0.82rem", lineHeight: 1.45, margin: 0 },
  error: { color: themeVars.danger, fontSize: "0.82rem", margin: 0 },
  coverage: { color: themeVars.textSecondary, fontSize: "0.82rem", lineHeight: 1.5, margin: 0 },
  details: { color: themeVars.textPrimary, fontSize: "0.82rem" },
  detailText: { color: themeVars.textSecondary, fontSize: "0.84rem", lineHeight: 1.5, margin: "0.35rem 0 0", whiteSpace: "pre-wrap" },
  metaText: { color: themeVars.textSubtle, fontSize: "0.78rem", lineHeight: 1.45, margin: "0.3rem 0 0" },
  coverageMeta: { color: themeVars.textSubtle, fontSize: "0.72rem", margin: "0.3rem 0 0" },
  section: { borderTopColor: themeVars.border, borderTopStyle: "solid", borderTopWidth: "1px", paddingTop: "0.85rem" },
  sectionHeading: { alignItems: "baseline", display: "flex", justifyContent: "space-between" },
  sectionTitle: { color: themeVars.textPrimary, fontSize: "0.82rem", fontWeight: 650, margin: 0 },
  count: { color: themeVars.textSubtle, fontSize: "0.72rem" },
  sourceList: { display: "flex", flexDirection: "column", gap: "0.75rem", listStyle: "none", margin: "0.7rem 0 0", padding: 0 },
  sourceItem: { margin: 0 },
  sourceHeader: { alignItems: "flex-start", display: "flex", gap: "0.5rem", justifyContent: "space-between" },
  sourceTitle: { color: themeVars.textPrimary, display: "block", fontSize: "0.82rem" },
  sourceState: { color: themeVars.textSubtle, display: "block", fontSize: "0.72rem", marginTop: "0.2rem" },
  passageList: { display: "flex", flexDirection: "column", gap: "0.65rem", margin: "0.6rem 0 0", paddingLeft: "1rem" },
  passage: { color: themeVars.textSubtle },
  compactList: { color: themeVars.textSecondary, fontSize: "0.82rem", lineHeight: 1.5, margin: "0.5rem 0 0", paddingLeft: "1rem" },
  decisionList: { display: "flex", flexDirection: "column", gap: "0.65rem", listStyle: "none", margin: "0.6rem 0 0", padding: 0 },
  decision: { margin: 0 },
});
