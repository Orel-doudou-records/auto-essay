import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import type { DiffractiveReading } from "@auto-essay/core";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workshopStyles } from "../styles/workshopStyles";
import {
  acceptEditorialProposal,
  createEditorialWritingDraftUnit,
  fetchEditorialSectionContext,
  fetchEditorialWritingContext,
  modifyEditorialProposal,
  rejectEditorialProposal,
  reviewAutomaticDiffractiveReading,
  runEditorialParagraphReading,
  runEditorialSectionReading,
  runEditorialSectionScopeReading,
  setEditorialSectionDiffractionMode,
  type AutomaticDiffractiveReadingPayload,
  type EditorialReadingScope,
  type EditorialSectionContextPayload,
  type EditorialWritingContextPayload,
} from "@/api";

const VERDICT_LABELS: Record<string, string> = {
  integrate_now: "Intégrer maintenant",
  adapt_differently: "Adapter la coupe",
  incubate: "Incuber",
  archive: "Archiver (trace)",
  discard: "Écarter",
};

type AuthorAction = "adapt" | "reject" | null;

function WorkshopCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div {...stylex.props(workshopStyles.cardFrame)}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div {...stylex.props(workshopStyles.stack)}>{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AuthorWorkshopPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sectionId, setSectionId] = useState("");
  const [context, setContext] = useState<EditorialSectionContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [readingProposalId, setReadingProposalId] = useState<string | null>(null);
  const [readingScope, setReadingScope] = useState<EditorialReadingScope | null>(null);
  const [reading, setReading] = useState<DiffractiveReading | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [modeLoading, setModeLoading] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [reviewingReadingId, setReviewingReadingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [authorAction, setAuthorAction] = useState<AuthorAction>(null);
  const [contentCommitments, setContentCommitments] = useState("");
  const [formalCommitments, setFormalCommitments] = useState("");
  const [authorNote, setAuthorNote] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [writingDecisionId, setWritingDecisionId] = useState("");
  const [writingContext, setWritingContext] = useState<EditorialWritingContextPayload | null>(null);
  const [writingLoading, setWritingLoading] = useState(false);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [createdDraftUnitId, setCreatedDraftUnitId] = useState<string | null>(null);

  const readingProposal = context?.proposals.find((proposal) => proposal.id === readingProposalId);

  async function refreshContext(scope: string, preserveReading = false) {
    if (!projectId) return;
    const next = await fetchEditorialSectionContext(projectId, scope);
    setContext(next);
    const nextProposal = next.proposals[0];
    setProposalId(nextProposal?.id ?? "");
    setContentCommitments(nextProposal?.contentCommitments.join("\n") ?? "");
    setFormalCommitments(nextProposal?.formalCommitments.join("\n") ?? "");
    setWritingDecisionId(next.decisions[0]?.id ?? "");
    setWritingContext(null);
    setWritingError(null);
    setDraftMessage(null);
    setCreatedDraftUnitId(null);
    setModeError(null);
    if (!preserveReading) {
      setReading(null);
      setReadingProposalId(null);
      setReadingScope(null);
    }
  }

  async function loadContext() {
    const scope = sectionId.trim();
    if (!projectId || !scope || contextLoading) return;
    setContextLoading(true);
    setContextError(null);
    setDecisionMessage(null);
    try {
      await refreshContext(scope);
    } catch (error) {
      setContext(null);
      setContextError(error instanceof Error ? error.message : String(error));
    } finally {
      setContextLoading(false);
    }
  }

  function selectProposal(id: string) {
    setProposalId(id);
    const proposal = context?.proposals.find((item) => item.id === id);
    setContentCommitments(proposal?.contentCommitments.join("\n") ?? "");
    setFormalCommitments(proposal?.formalCommitments.join("\n") ?? "");
    setAuthorAction(null);
    setAuthorNote("");
    setDecisionError(null);
  }

  async function setDiffractiveReadingMode(mode: "strict" | "automatic") {
    if (!projectId || !context || modeLoading) return;
    setModeLoading(true);
    setModeError(null);
    try {
      const result = await setEditorialSectionDiffractionMode(projectId, context.section.id, mode);
      setContext((current) => {
        if (!current) return current;
        const automaticReadings = result.request
          ? [result.request, ...current.diffraction.automaticReadings]
          : current.diffraction.automaticReadings;
        return {
          ...current,
          diffraction: {
            ...current.diffraction,
            mode: result.mode,
            automaticReadings,
          },
        };
      });
    } catch (error) {
      setModeError(error instanceof Error ? error.message : String(error));
    } finally {
      setModeLoading(false);
    }
  }

  async function reviewAutomaticReading(
    readingId: string,
    disposition: "kept" | "archived"
  ) {
    if (!projectId || !context || reviewingReadingId) return;
    setReviewingReadingId(readingId);
    setReviewError(null);
    try {
      const result = await reviewAutomaticDiffractiveReading(
        projectId,
        context.section.id,
        readingId,
        disposition
      );
      setContext((current) => {
        if (!current) return current;
        return {
          ...current,
          diffraction: {
            ...current.diffraction,
            automaticReadings: current.diffraction.automaticReadings.map((reading) =>
              reading.id === result.automaticReading.id ? result.automaticReading : reading
            ),
          },
        };
      });
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setReviewingReadingId(null);
    }
  }

  async function runReading() {
    if (!projectId || !context || !statement.trim() || readingLoading) return;
    setReadingLoading(true);
    setReadingError(null);
    setReading(null);
    setDecisionMessage(null);
    try {
      const result = await runEditorialSectionReading(projectId, context.section.id, {
        statement: statement.trim(),
        articulationId: proposalId || undefined,
      });
      setReading(result.reading);
      setReadingProposalId(proposalId || null);
      setReadingScope(result.scope);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : String(error));
    } finally {
      setReadingLoading(false);
    }
  }

  async function runSectionScopeReading() {
    if (!projectId || !context || readingLoading) return;
    setReadingLoading(true);
    setReadingError(null);
    setReading(null);
    setDecisionMessage(null);
    try {
      const result = await runEditorialSectionScopeReading(projectId, context.section.id, {});
      setReading(result.reading);
      setReadingProposalId(null);
      setReadingScope(result.scope);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : String(error));
    } finally {
      setReadingLoading(false);
    }
  }

  async function runParagraphScopeReading(unitId: string) {
    if (!projectId || !context || readingLoading) return;
    setReadingLoading(true);
    setReadingError(null);
    setReading(null);
    setDecisionMessage(null);
    try {
      const result = await runEditorialParagraphReading(
        projectId,
        context.section.id,
        unitId,
        {}
      );
      setReading(result.reading);
      setReadingProposalId(null);
      setReadingScope(result.scope);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : String(error));
    } finally {
      setReadingLoading(false);
    }
  }

  async function prepareWritingContext() {
    if (!projectId || !context || !writingDecisionId || writingLoading) return;
    setWritingLoading(true);
    setWritingError(null);
    setDraftMessage(null);
    setCreatedDraftUnitId(null);
    try {
      const prepared = await fetchEditorialWritingContext(
        projectId,
        context.section.id,
        writingDecisionId
      );
      setWritingContext(prepared);
    } catch (error) {
      setWritingContext(null);
      setWritingError(error instanceof Error ? error.message : String(error));
    } finally {
      setWritingLoading(false);
    }
  }

  async function createWritingDraftUnit() {
    if (!projectId || !context || !writingContext || writingLoading) return;
    setWritingLoading(true);
    setWritingError(null);
    try {
      const result = await createEditorialWritingDraftUnit(projectId, context.section.id, {
        decisionId: writingContext.decision.id,
      });
      setCreatedDraftUnitId(result.unit.id);
      setDraftMessage(`Unité ${result.unit.id} créée, avec un contenu vide.`);
    } catch (error) {
      setWritingError(error instanceof Error ? error.message : String(error));
    } finally {
      setWritingLoading(false);
    }
  }

  async function submitDecision(action: "accept" | "modify" | "reject") {
    if (!projectId || !context || !readingProposal || decisionLoading) return;
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      if (action === "accept") {
        await acceptEditorialProposal(projectId, readingProposal.id, {
          contentCommitments: readingProposal.contentCommitments,
          formalCommitments: readingProposal.formalCommitments,
          validationNote: authorNote.trim() || undefined,
        });
      } else if (action === "modify") {
        const content = splitLines(contentCommitments);
        const formal = splitLines(formalCommitments);
        if (!authorNote.trim() || content.length === 0 || formal.length === 0) {
          setDecisionError("L’adaptation exige des engagements de contenu et de forme, ainsi qu’une note auteur.");
          return;
        }
        await modifyEditorialProposal(projectId, readingProposal.id, {
          contentCommitments: content,
          formalCommitments: formal,
          validationNote: authorNote.trim(),
        });
      } else {
        await rejectEditorialProposal(projectId, readingProposal.id, authorNote.trim() || undefined);
      }

      await refreshContext(context.section.id, true);
      setAuthorAction(null);
      setAuthorNote("");
      setDecisionMessage(
        action === "accept"
          ? "Décision validée et coupe active rafraîchie."
          : action === "modify"
            ? "Décision adaptée et coupe active rafraîchie."
            : "Proposition refusée et archivée ; aucune coupe active n’a été créée."
      );
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : String(error));
    } finally {
      setDecisionLoading(false);
    }
  }

  return (
    <AppShell projectId={projectId}>
      <div {...stylex.props(workshopStyles.page)}>
        <header {...stylex.props(workshopStyles.intro)}>
          <p {...stylex.props(workshopStyles.eyebrow)}>Atelier auteur</p>
          <h1 {...stylex.props(workshopStyles.title)}>Lecture située sur un projet réel</h1>
          <p {...stylex.props(workshopStyles.copy)}>
            La lecture décrit une proposition et ses conséquences. L’auteur peut la valider, l’adapter ou la refuser ; aucun acte n’est appliqué par défaut.
          </p>
        </header>

        <WorkshopCard title="Portée de travail">
          <div {...stylex.props(workshopStyles.formRow)}>
            <div {...stylex.props(workshopStyles.field)}>
              <Label htmlFor="sectionId">ID de section</Label>
              <Input
                id="sectionId"
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
                placeholder="chapitre-2-section-1"
              />
            </div>
            <Button onClick={() => void loadContext()} disabled={contextLoading || !sectionId.trim()}>
              {contextLoading ? "Chargement…" : "Charger l’atelier"}
            </Button>
          </div>
          {contextError && <p>Contexte indisponible : {contextError}</p>}
        </WorkshopCard>

        {context && (
          <>
            <header {...stylex.props(workshopStyles.sectionHeader)}>
              <div {...stylex.props(workshopStyles.compactStack)}>
                <p {...stylex.props(workshopStyles.eyebrow)}>Section</p>
                <h2 {...stylex.props(workshopStyles.sectionTitle)}>{context.section.title}</h2>
                <p {...stylex.props(workshopStyles.meta)}>Portée : {context.section.id}</p>
              </div>
              <p {...stylex.props(workshopStyles.status)}>
                {context.decisions.length} décision{context.decisions.length > 1 ? "s" : ""} active
                {context.decisions.length > 1 ? "s" : ""}
              </p>
            </header>

            {decisionMessage && <p {...stylex.props(workshopStyles.status)}>{decisionMessage}</p>}

            <div {...stylex.props(workshopStyles.grid)}>
              <WorkshopCard title="État du livre">
                {context.bookParts.length === 0 ? <p>Aucune partie projetée pour ce manuscrit.</p> : (
                  <ul>
                    {context.bookParts.map((part) => (
                      <li key={part.id}>
                        <span>{part.title}</span><span>{part.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkshopCard>

              <WorkshopCard title="Coupes déjà édictées">
                {context.existingCuts.length === 0 ? <p>Aucune coupe active dans cette portée.</p> : (
                  <ul>
                    {context.existingCuts.map((cut) => (
                      <li key={`${cut.scope}-${cut.cut}`}>
                        <p>{cut.scope} — {cut.verdict}</p><p>{cut.cut}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkshopCard>
            </div>

            <WorkshopCard title="Décisions actives">
              {context.decisions.length === 0 ? <p>Aucune décision active dans cette portée.</p> : (
                <ul>
                  {context.decisions.map((decision) => (
                    <li key={decision.id}>
                      <p>Décision {decision.id}</p>
                      <p>Validée par {decision.validation.validatedBy}</p>
                      {decision.supersedesDecisionId && (
                        <p>Supersède la décision {decision.supersedesDecisionId}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </WorkshopCard>

            <WorkshopCard title="Préparer la rédaction">
              {context.decisions.length === 0 ? (
                <p>Une décision auteur active est nécessaire avant de préparer une unité de rédaction.</p>
              ) : (
                <div>
                  <p>Cette préparation assemble des décisions et des preuves ; elle ne génère aucun texte.</p>
                  {context.decisions.length > 1 && (
                    <div>
                      <Label htmlFor="writingDecisionId">Décision active</Label>
                      <select
                        id="writingDecisionId"
                        value={writingDecisionId}
                        onChange={(event) => {
                          setWritingDecisionId(event.target.value);
                          setWritingContext(null);
                          setDraftMessage(null);
                          setCreatedDraftUnitId(null);
                        }}
                      >
                        {context.decisions.map((decision) => <option key={decision.id} value={decision.id}>{decision.id}</option>)}
                      </select>
                    </div>
                  )}
                  <Button onClick={() => void prepareWritingContext()} disabled={writingLoading || !writingDecisionId}>
                    {writingLoading ? "Préparation…" : "Préparer le contexte de rédaction"}
                  </Button>
                  {writingError && <p>Préparation indisponible : {writingError}</p>}
                  {writingContext && (
                    <WritingContextResult
                      context={writingContext}
                      loading={writingLoading}
                      onCreate={() => void createWritingDraftUnit()}
                    />
                  )}
                  {draftMessage && (
                    <div>
                      <p>{draftMessage}</p>
                      {createdDraftUnitId && projectId && (
                        <Link to={`/projects/${projectId}/editor?unitId=${createdDraftUnitId}`}>
                          Ouvrir l’unité préparée
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </WorkshopCard>

            <WorkshopCard title="Sources de la section">
              {context.sources.length === 0 ? <p>Aucune source distribuée dans cette portée.</p> : (
                <ul>
                  {context.sources.map((source) => (
                    <li key={source.sourceId}>
                      <div>
                        <span>{source.title}</span>
                        <span>{source.qualified ? "Qualifiée" : "Non qualifiée"}</span>
                      </div>
                      {source.authors.length > 0 && <p>{source.authors.join(", ")}</p>}
                      {!source.qualified && <p>Piste visible, mais non disponible comme preuve automatique.</p>}
                    </li>
                  ))}
                </ul>
              )}
            </WorkshopCard>

            <WorkshopCard title="Mode de diffraction">
              <div>
                <p>
                  {context.diffraction.mode === "automatic" ? "Mode automatique" : "Mode strict"}
                </p>
                <p>
                  {context.diffraction.mode === "automatic"
                    ? "Les lectures de section sont demandées automatiquement ; aucun texte ni aucune décision ne sont modifiés."
                    : "Chaque lecture est déclenchée explicitement par l’auteur."}
                </p>
                <Button
                  variant={context.diffraction.mode === "automatic" ? "outline" : "default"}
                  onClick={() => void setDiffractiveReadingMode(
                    context.diffraction.mode === "automatic" ? "strict" : "automatic"
                  )}
                  disabled={modeLoading}
                >
                  {modeLoading
                    ? "Mise à jour…"
                    : context.diffraction.mode === "automatic"
                      ? "Suspendre l’automatisme"
                      : "Activer les lectures automatiques"}
                </Button>
                {modeError && <p>Mode indisponible : {modeError}</p>}
              </div>
            </WorkshopCard>

            {context.diffraction.mode === "strict" && (
              <WorkshopCard title="Lectures strictes">
                <div>
                  <p>
                    Choisissez explicitement la portée de la lecture. Ces lectures restent non exécutables.
                  </p>
                  <Button onClick={() => void runSectionScopeReading()} disabled={readingLoading}>
                    {readingLoading ? "Lecture en cours…" : "Lire la section"}
                  </Button>
                  {context.diffraction.paragraphs.length === 0 ? (
                    <p>Aucun paragraphe rédigé dans cette section.</p>
                  ) : (
                    <div>
                      {context.diffraction.paragraphs.map((paragraph) => (
                        <div key={paragraph.id}>
                          <span>{paragraph.id}, version {paragraph.version}</span>
                          <Button variant="outline" onClick={() => void runParagraphScopeReading(paragraph.id)} disabled={readingLoading}>
                            Lire le paragraphe {paragraph.id}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {readingError && <p>Lecture indisponible : {readingError}</p>}
                </div>
              </WorkshopCard>
            )}

            <AutomaticReadingReviewBox
              readings={context.diffraction.automaticReadings}
              reviewingReadingId={reviewingReadingId}
              error={reviewError}
              onReview={(readingId, disposition) => void reviewAutomaticReading(readingId, disposition)}
            />

            <WorkshopCard title="Fragment à diffracter">
              <div>
                {context.proposals.length > 0 && (
                  <div>
                    <Label htmlFor="proposalId">Proposition candidate</Label>
                    <select id="proposalId" value={proposalId} onChange={(event) => selectProposal(event.target.value)}>
                      {context.proposals.map((proposal) => <option key={proposal.id} value={proposal.id}>{proposal.id}</option>)}
                    </select>
                  </div>
                )}
                <Textarea id="statement" aria-label="Fragment à lire" value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Posez un fragment dans la section sélectionnée…" rows={4} />
                <div>
                  <Button onClick={() => void runReading()} disabled={readingLoading || !statement.trim()}>{readingLoading ? "Lecture en cours…" : "Lire le fragment"}</Button>
                  {readingError && <p>Lecture indisponible : {readingError}</p>}
                </div>
              </div>
            </WorkshopCard>

            {reading && (
              <ReadingResult
                reading={reading}
                proposal={readingProposal}
                scope={readingScope}
                authorAction={authorAction}
                contentCommitments={contentCommitments}
                formalCommitments={formalCommitments}
                authorNote={authorNote}
                loading={decisionLoading}
                error={decisionError}
                onAuthorAction={(action) => {
                  setAuthorAction(action);
                  setAuthorNote("");
                  setDecisionError(null);
                }}
                onContentCommitments={setContentCommitments}
                onFormalCommitments={setFormalCommitments}
                onAuthorNote={setAuthorNote}
                onSubmit={(action) => void submitDecision(action)}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function AutomaticReadingReviewBox({
  readings,
  reviewingReadingId,
  error,
  onReview,
}: {
  readings: AutomaticDiffractiveReadingPayload[];
  reviewingReadingId: string | null;
  error: string | null;
  onReview: (readingId: string, disposition: "kept" | "archived") => void;
}) {
  return (
    <WorkshopCard title="Boîte de revue automatique">
      {readings.length === 0 ? (
        <p>Aucune lecture automatique enregistrée pour cette section.</p>
      ) : (
        <div>
          <p>Aucune proposition n’est choisie automatiquement.</p>
          {readings.map((request) => (
            <div key={request.id}>
              <div>
                <p>{automaticReadingStatusLabel(request.status)}</p>
                <p>
                  {automaticReadingReviewStatusLabel(request.reviewStatus)} · {request.historical ? "Historique" : "Courante"}
                </p>
                <p>
                  Déclenchée par {automaticReadingTriggerLabel(request.trigger)}
                  {request.historical ? " · historique" : ""}
                </p>
              </div>
              {request.reading && <AutomaticReadingDetails request={request} />}
              {request.failure && <p>Lecture indisponible : {request.failure}</p>}
              <div>
                <Button
                  variant="outline"
                  onClick={() => onReview(request.id, "kept")}
                  disabled={reviewingReadingId !== null || request.reviewStatus === "kept"}
                >
                  {reviewingReadingId === request.id ? "Mise à jour…" : "Conserver cette lecture"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onReview(request.id, "archived")}
                  disabled={reviewingReadingId !== null || request.reviewStatus === "archived"}
                >
                  Archiver cette lecture
                </Button>
              </div>
            </div>
          ))}
          {error && <p>Revue indisponible : {error}</p>}
        </div>
      )}
    </WorkshopCard>
  );
}

function AutomaticReadingDetails({ request }: { request: AutomaticDiffractiveReadingPayload }) {
  const reading = request.reading;
  if (!reading) return null;
  return (
    <details open>
      <summary>Consulter la lecture complète</summary>
      <div>
        <ReadingItems title="Passe 1 — Réfraction" items={reading.pass1.refraction} />
        <ReadingItems title="Passe 2 — Motifs nommés" items={reading.pass2.namedPatterns} />
        <section>
          <h4>Passe 2 — Defaults révélés</h4>
          <ul>
            {reading.pass2.revealedDefaults.map((item) => (
              <li key={`${item.default}-${item.priorCut ?? ""}`}>
                {item.default}{item.priorCut ? ` — coupe antérieure : ${item.priorCut}` : ""}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4>Passe 3 — Enchevêtrements</h4>
          <ul>
            {reading.pass3.entanglements.map((item) => (
              <li key={item.name}>{item.name} — {item.cutIfIntegrated}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>Coupe agentielle</h4>
          <p>{reading.pass4.cut}</p>
          <ReadingItems title="Inclus" items={reading.pass4.included} />
          <ReadingItems title="Exclus" items={reading.pass4.excluded} />
          <ReadingItems title="Exclusion de la non-décision" items={reading.pass4.cutOfNonAdoption} />
        </section>
        <section>
          <h4>Verdict</h4>
          <p>
            {VERDICT_LABELS[reading.verdict] ?? reading.verdict} — {reading.verdictDetail}
          </p>
        </section>
        <section>
          <h4>Compromis</h4>
          {reading.tradeoffs.length === 0 ? (
            <p>Aucun compromis renseigné.</p>
          ) : (
            <ul>
              {reading.tradeoffs.map((tradeoff) => (
                <li key={tradeoff.path}>
                  {tradeoff.path} — effort : {tradeoff.effort} ; réversibilité : {tradeoff.reversibility} ; levier : {tradeoff.leverage} ; taxe de distraction : {tradeoff.distractionTax}.
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4>Provenance</h4>
          <p>{request.scope.sectionId} · {request.fingerprint}</p>
          <p>
            Demandée par l’auteur le {new Date(request.createdAt).toLocaleString("fr-FR")}.
          </p>
        </section>
      </div>
    </details>
  );
}

function ReadingItems({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p>Aucun élément renseigné.</p>
      ) : (
        <ul>
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

function WritingContextResult({
  context,
  loading,
  onCreate,
}: {
  context: EditorialWritingContextPayload;
  loading: boolean;
  onCreate: () => void;
}) {
  return (
    <div>
      <p>Contexte de rédaction préparé : aucune génération n’a été lancée.</p>
      <p>Décision {context.decision.id}, validée par {context.decision.validation.validatedBy}.</p>
      <p>{context.evidencePack.sourceIds.length} preuve{context.evidencePack.sourceIds.length > 1 ? "s" : ""} retenue{context.evidencePack.sourceIds.length > 1 ? "s" : ""} dans l’EvidencePack.</p>
      <ul>
        {context.visibleSources.map((source) => (
          <li key={source.sourceId}>
            <div>
              <span>{source.title}</span>
              <span>
                {source.inclusion === "evidence_pack" ? "Preuve retenue" : "Visible, non retenue"}
              </span>
            </div>
            <p>Distribution : {source.provenance.distributionRationale}</p>
            {source.exclusionReason && <p>Exclusion : {source.exclusionReason === "missing_or_unqualified_profile" ? "profil manquant ou non qualifiant" : "extrait manquant"}.</p>}
          </li>
        ))}
      </ul>
      <Button onClick={onCreate} disabled={loading}>Créer une unité de rédaction vide</Button>
    </div>
  );
}

function ReadingResult({
  reading, proposal, scope, authorAction, contentCommitments, formalCommitments, authorNote, loading, error,
  onAuthorAction, onContentCommitments, onFormalCommitments, onAuthorNote, onSubmit,
}: {
  reading: DiffractiveReading;
  proposal?: EditorialSectionContextPayload["proposals"][number];
  scope: EditorialReadingScope | null;
  authorAction: AuthorAction;
  contentCommitments: string;
  formalCommitments: string;
  authorNote: string;
  loading: boolean;
  error: string | null;
  onAuthorAction: (action: AuthorAction) => void;
  onContentCommitments: (value: string) => void;
  onFormalCommitments: (value: string) => void;
  onAuthorNote: (value: string) => void;
  onSubmit: (action: "accept" | "modify" | "reject") => void;
}) {
  const adaptationReady =
    splitLines(contentCommitments).length > 0 &&
    splitLines(formalCommitments).length > 0 &&
    authorNote.trim().length > 0;

  return (
    <div>
      <div>
        <span>{VERDICT_LABELS[reading.verdict] ?? reading.verdict}</span>
        <span>{reading.verdictDetail}</span>
        {scope && <span>{readingScopeLabel(scope)}</span>}
        <span>Proposition non exécutable avant acte auteur</span>
      </div>

      <div>
        <WorkshopCard title="Pass 1 — le fragment à travers le livre">
          {reading.pass1.refraction.length > 0 ? <ul>{reading.pass1.refraction.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Aucune réfraction supplémentaire.</p>}
        </WorkshopCard>
        <WorkshopCard title="Pass 4 — la coupe agentielle"><p>{reading.pass4.cut}</p><p>{reading.action}</p></WorkshopCard>
      </div>

      {(reading.planImpacts.length > 0 || reading.bibliographyImpacts.length > 0) && (
        <div>
          {reading.planImpacts.length > 0 && <WorkshopCard title="Impacts sur le plan"><ul>{reading.planImpacts.map((impact) => <li key={`${impact.partId}-${impact.entryId ?? impact.impact}`}>{impact.impact}</li>)}</ul></WorkshopCard>}
          {reading.bibliographyImpacts.length > 0 && <WorkshopCard title="Impacts bibliographiques"><ul>{reading.bibliographyImpacts.map((impact) => <li key={`${impact.sourceId}-${impact.scopeId}`}>{impact.kind} — {impact.impact}</li>)}</ul></WorkshopCard>}
        </div>
      )}

      <WorkshopCard title="Acte auteur">
        {!proposal ? (
          <p>Cette lecture n’est rattachée à aucune proposition candidate ; aucun acte ne peut être enregistré.</p>
        ) : (
          <div>
            <p>La proposition {proposal.id} reste candidate jusqu’à votre acte explicite.</p>
            {authorAction === null && (
              <div>
                <Label htmlFor="validationNote">Note de validation (facultative)</Label>
                <Textarea id="validationNote" value={authorNote} onChange={(event) => onAuthorNote(event.target.value)} rows={2} />
              </div>
            )}
            <div>
              <Button disabled={loading} onClick={() => onSubmit("accept")}>{loading ? "Enregistrement…" : "Valider"}</Button>
              <Button disabled={loading} variant="outline" onClick={() => onAuthorAction(authorAction === "adapt" ? null : "adapt")}>Adapter</Button>
              <Button disabled={loading} variant="outline" onClick={() => onAuthorAction(authorAction === "reject" ? null : "reject")}>Refuser</Button>
            </div>
            {authorAction === "adapt" && (
              <div>
                <p>Adapter la proposition</p>
                <div><Label htmlFor="contentCommitments">Engagements de contenu (une ligne par engagement)</Label><Textarea id="contentCommitments" value={contentCommitments} onChange={(event) => onContentCommitments(event.target.value)} rows={3} /></div>
                <div><Label htmlFor="formalCommitments">Engagements de forme (une ligne par engagement)</Label><Textarea id="formalCommitments" value={formalCommitments} onChange={(event) => onFormalCommitments(event.target.value)} rows={3} /></div>
                <div><Label htmlFor="adaptationNote">Note d’adaptation</Label><Textarea id="adaptationNote" value={authorNote} onChange={(event) => onAuthorNote(event.target.value)} rows={3} /></div>
                <Button disabled={loading || !adaptationReady} onClick={() => onSubmit("modify")}>Enregistrer l’adaptation</Button>
              </div>
            )}
            {authorAction === "reject" && (
              <div>
                <p>Refuser la proposition</p>
                <div><Label htmlFor="rejectionNote">Note de refus (facultative)</Label><Textarea id="rejectionNote" value={authorNote} onChange={(event) => onAuthorNote(event.target.value)} rows={3} /></div>
                <Button disabled={loading} variant="outline" onClick={() => onSubmit("reject")}>Confirmer le refus</Button>
              </div>
            )}
            {error && <p>Décision indisponible : {error}</p>}
          </div>
        )}
      </WorkshopCard>
    </div>
  );
}

function automaticReadingStatusLabel(
  status: AutomaticDiffractiveReadingPayload["status"]
): string {
  if (status === "pending") return "Lecture automatique en attente";
  if (status === "running") return "Lecture automatique en cours";
  if (status === "completed") return "Lecture automatique terminée";
  if (status === "superseded") return "Lecture automatique remplacée";
  return "Lecture automatique échouée";
}

function automaticReadingReviewStatusLabel(
  reviewStatus: AutomaticDiffractiveReadingPayload["reviewStatus"]
): string {
  if (reviewStatus === "kept") return "Lecture conservée";
  if (reviewStatus === "archived") return "Lecture archivée";
  return "Nouvelle lecture";
}

function automaticReadingTriggerLabel(
  trigger: AutomaticDiffractiveReadingPayload["trigger"]
): string {
  if (trigger === "activation") return "l’activation du mode automatique";
  if (trigger === "text_changed") return "un changement de texte";
  if (trigger === "plan_changed") return "un changement de plan";
  if (trigger === "decision_changed") return "un changement de décision";
  return "un changement de sources";
}

function readingScopeLabel(scope: EditorialReadingScope): string {
  if (scope.kind === "section") return "Lecture de section";
  if (scope.kind === "paragraph") {
    return `Lecture de paragraphe — ${scope.unitId}, version ${scope.unitVersion}`;
  }
  return "Lecture de fragment";
}

function splitLines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}
