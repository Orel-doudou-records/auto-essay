import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { fetchScopeContext, type ScopeContext } from "@/api/scopeContext";
import {
  ProjectWorkspace,
  scopeFromQuery,
} from "@/components/workspace/ProjectWorkspace";
import { workspaceStyles as s } from "@/components/workspace/workspaceStyles";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/hooks/useUnits";
import { sourceStateLabels } from "@/hooks/useSourceOverview";

const hypothesisLabels: Record<string, string> = {
  emergent: "Émergente",
  supported: "Étayée",
  contested: "Contestée",
  under_documented: "À documenter",
  rejected: "Écartée",
};
export function AnalysisPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [query] = useSearchParams();
  const scope = scopeFromQuery(query);
  const { units } = useUnits(projectId);
  const unit = units.find((item) => item.id === scope?.id);
  const [context, setContext] = useState<ScopeContext>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState("Vue d’ensemble");
  useEffect(() => {
    let active = true;
    setContext(undefined);
    setError(undefined);
    if (!scope) return;
    setLoading(true);
    void fetchScopeContext(projectId, scope)
      .then((data) => {
        if (active) setContext(data);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Analyse indisponible.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, scope?.kind, scope?.id, revision]);
  const included =
    context?.sources.filter(
      (source) => source.included || source.usedInDescendants,
    ) ?? [];
  const readings = context?.readings ?? [];
  const sectionId =
    scope?.kind === "node" ? scope.id : unit?.contextInPlan?.section;
  return (
    <ProjectWorkspace projectId={projectId}>
      <div {...stylex.props(s.row)}>
        <h1 {...stylex.props(s.title)}>
          Analyse{unit?.thesis ? ` — ${unit.thesis}` : " du manuscrit"}
        </h1>
        <Button
          variant="outline"
          size="sm"
          disabled={!scope || loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {loading ? "Chargement…" : "Actualiser"}
        </Button>
      </div>
      <p {...stylex.props(s.subtitle)}>
        Hypothèses, sources mobilisées et questions ouvertes pour la sélection
        courante.
      </p>
      {!scope && (
        <p {...stylex.props(s.meta)}>
          Choisissez un chapitre ou un passage dans le manuscrit pour consulter
          son analyse.
        </p>
      )}
      {error && (
        <p role="alert" {...stylex.props(s.error)}>
          {error}
        </p>
      )}
      {context && (
        <>
          <div {...stylex.props(s.tabs)} aria-label="Vues d’analyse">
            {[
              "Vue d’ensemble",
              "Couverture des sources",
              "Relations entre chapitres",
              "Synthèse",
            ].map((name) => (
              <button
                type="button"
                key={name}
                aria-pressed={tab === name}
                {...stylex.props(s.tab, tab === name && s.tabActive)}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {tab === "Vue d’ensemble" && (
            <div {...stylex.props(s.grid)}>
              <section {...stylex.props(s.card)}>
                <h2 {...stylex.props(s.label)}>
                  ◎ Hypothèses / axes principaux
                </h2>
                {context.planning?.hypotheses?.length ? (
                  <ol>
                    {context.planning.hypotheses.map((hypothesis, index) => (
                      <li key={index}>
                        <p>{hypothesis.statement}</p>
                        <span {...stylex.props(s.badge)}>
                          {hypothesisLabels[hypothesis.status] ??
                            hypothesis.status}
                        </span>
                        <p {...stylex.props(s.meta)}>
                          {hypothesis.sourceRefs.length} source(s) rattachée(s)
                          {hypothesis.note ? ` · ${hypothesis.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p {...stylex.props(s.meta)}>
                    Aucune hypothèse formalisée dans le cadrage de cette
                    sélection.
                  </p>
                )}
              </section>
              <section {...stylex.props(s.card)}>
                <h2 {...stylex.props(s.label)}>▥ Couverture documentaire</h2>
                <p>{included.length} source(s) mobilisée(s)</p>
                <p>{context.passages.length} passage(s) cité(s)</p>
                <p {...stylex.props(s.meta)}>
                  Ces nombres décrivent le contexte disponible. La solidité de
                  l’argument reste à évaluer.
                </p>
                {unit && (
                  <Link
                    {...stylex.props(s.link)}
                    to={`/projects/${projectId}/evaluate/${unit.id}`}
                  >
                    Évaluer ce passage →
                  </Link>
                )}
              </section>
              <section {...stylex.props(s.card)}>
                <h2 {...stylex.props(s.label)}>? Questions ouvertes</h2>
                <p {...stylex.props(s.meta)}>
                  {context.planning?.question ||
                    "Aucune question de cadrage renseignée."}
                </p>
                {context.exploration.underDocumentedHypotheses.map(
                  (hypothesis) => (
                    <p key={hypothesis}>{hypothesis}</p>
                  ),
                )}
                <Link
                  {...stylex.props(s.link)}
                  to={`/projects/${projectId}/chapitre?${query}`}
                >
                  Préciser le cadrage dans le plan
                </Link>
              </section>
              <section {...stylex.props(s.card)}>
                <h2 {...stylex.props(s.label)}>△ Lacunes documentaires</h2>
                {context.exploration.gaps.length ? (
                  context.exploration.gaps.map((gap, index) => (
                    <div key={index}>
                      <p>{gap.description}</p>
                      <p {...stylex.props(s.meta)}>
                        {gap.consequence}
                        {gap.neededEvidence
                          ? ` · À rechercher : ${gap.neededEvidence}`
                          : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p {...stylex.props(s.meta)}>
                    Aucune lacune consignée. Cela ne signifie pas que le corpus
                    est complet.
                  </p>
                )}
                <Link
                  {...stylex.props(s.link)}
                  to={`/projects/${projectId}/sources?${query}`}
                >
                  Voir les sources →
                </Link>
              </section>
            </div>
          )}
          {tab === "Couverture des sources" && (
            <div {...stylex.props(s.stack)}>
              {included.length ? (
                included.map((source) => (
                  <article key={source.id} {...stylex.props(s.card)}>
                    <div {...stylex.props(s.row)}>
                      <Link
                        {...stylex.props(s.link)}
                        to={`/projects/${projectId}/sources?${query}&sourceId=${encodeURIComponent(source.id)}`}
                      >
                        {source.title}
                      </Link>
                      <span {...stylex.props(s.badge)}>
                        {sourceStateLabels[source.state]}
                      </span>
                    </div>
                    {source.usedInDescendants && (
                      <p {...stylex.props(s.meta)}>
                        Source mobilisée dans les sections ou passages de cette
                        sélection.
                      </p>
                    )}
                    {source.coverage && (
                      <p {...stylex.props(s.meta)}>
                        {source.coverage.coveredBlocks} /{" "}
                        {source.coverage.totalBlocks} blocs explorés
                      </p>
                    )}
                    {context.passages
                      .filter((passage) => passage.sourceId === source.id)
                      .map((passage, index) => (
                        <blockquote key={index} {...stylex.props(s.passage)}>
                          {passage.text}
                          <footer {...stylex.props(s.meta)}>
                            {passage.pageRange}
                            {passage.unitId && (
                              <Link
                                {...stylex.props(s.link)}
                                to={`/projects/${projectId}/editor?unitId=${encodeURIComponent(passage.unitId)}`}
                              >
                                Ouvrir le passage
                              </Link>
                            )}
                          </footer>
                        </blockquote>
                      ))}
                  </article>
                ))
              ) : (
                <p>Aucune source mobilisée pour cette sélection.</p>
              )}
            </div>
          )}
          {(tab === "Relations entre chapitres" || tab === "Synthèse") && (
            <div {...stylex.props(s.stack)}>
              <p {...stylex.props(s.meta)}>
                Lectures historiques : leur validité pour le texte actuel n’est
                pas vérifiée. Lancez une nouvelle lecture après modification.
              </p>
              {readings.length ? (
                readings.map((reading) => (
                  <article key={reading.id} {...stylex.props(s.card)}>
                    <p {...stylex.props(s.meta)}>
                      Lecture enregistrée le{" "}
                      {new Date(reading.createdAt).toLocaleString("fr-FR")}
                    </p>
                    <p>{reading.verdict}</p>
                    {reading.impacts.map((impact, index) => (
                      <p key={index}>
                        <strong>{impact.partTitle}</strong> — {impact.impact}
                      </p>
                    ))}
                  </article>
                ))
              ) : (
                <p {...stylex.props(s.meta)}>
                  Aucune lecture Diffract enregistrée pour cette sélection.
                </p>
              )}
              {sectionId && (
                <Link
                  {...stylex.props(s.link)}
                  to={`/projects/${projectId}/atelier?sectionId=${encodeURIComponent(sectionId)}`}
                >
                  Ouvrir les lectures et les décisions →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </ProjectWorkspace>
  );
}
