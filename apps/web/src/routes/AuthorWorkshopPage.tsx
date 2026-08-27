import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DiffractiveReading } from "@auto-essay/core";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptEditorialProposal,
  createEditorialWritingDraftUnit,
  fetchEditorialSectionContext,
  fetchEditorialWritingContext,
  modifyEditorialProposal,
  rejectEditorialProposal,
  runEditorialParagraphReading,
  runEditorialSectionReading,
  runEditorialSectionScopeReading,
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

const VERDICT_STYLES: Record<string, string> = {
  integrate_now: "bg-emerald-100 text-emerald-900",
  adapt_differently: "bg-amber-100 text-amber-900",
  incubate: "bg-sky-100 text-sky-900",
  archive: "bg-slate-200 text-slate-800",
  discard: "bg-rose-100 text-rose-900",
};

type AuthorAction = "adapt" | "reject" | null;

function WorkshopCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
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
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Atelier de décision auteur</p>
          <h1 className="text-2xl font-bold">Lecture située sur un projet réel</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            La lecture décrit une proposition et ses conséquences. L’auteur peut la valider, l’adapter ou la refuser ; aucun acte n’est appliqué par défaut.
          </p>
        </div>

        <WorkshopCard title="Portée de travail">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-2">
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
          {contextError && <p className="mt-3 text-sm text-rose-600">Contexte indisponible : {contextError}</p>}
        </WorkshopCard>

        {context && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">{context.section.title}</h2>
                <p className="text-sm text-muted-foreground">Scope : {context.section.id}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {context.decisions.length} décision{context.decisions.length > 1 ? "s" : ""} active
                {context.decisions.length > 1 ? "s" : ""}
              </p>
            </div>

            {decisionMessage && <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{decisionMessage}</p>}

            <div className="grid gap-4 lg:grid-cols-2">
              <WorkshopCard title="État du livre">
                {context.bookParts.length === 0 ? <p className="text-muted-foreground">Aucune partie projetée pour ce manuscrit.</p> : (
                  <ul className="space-y-2">
                    {context.bookParts.map((part) => (
                      <li key={part.id} className="flex justify-between gap-3 rounded bg-muted/60 px-3 py-2">
                        <span>{part.title}</span><span className="text-xs text-muted-foreground">{part.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkshopCard>

              <WorkshopCard title="Coupes déjà édictées">
                {context.existingCuts.length === 0 ? <p className="text-muted-foreground">Aucune coupe active dans cette portée.</p> : (
                  <ul className="space-y-2">
                    {context.existingCuts.map((cut) => (
                      <li key={`${cut.scope}-${cut.cut}`} className="rounded bg-muted/60 px-3 py-2">
                        <p className="font-medium">{cut.scope} — {cut.verdict}</p><p className="text-muted-foreground">{cut.cut}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkshopCard>
            </div>

            <WorkshopCard title="Décisions actives">
              {context.decisions.length === 0 ? <p className="text-muted-foreground">Aucune décision active dans cette portée.</p> : (
                <ul className="space-y-2">
                  {context.decisions.map((decision) => (
                    <li key={decision.id} className="rounded bg-muted/60 px-3 py-2">
                      <p className="font-medium">Décision {decision.id}</p>
                      <p className="text-muted-foreground">Validée par {decision.validation.validatedBy}</p>
                      {decision.supersedesDecisionId && (
                        <p className="text-muted-foreground">Supersède la décision {decision.supersedesDecisionId}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </WorkshopCard>

            <WorkshopCard title="Préparer la rédaction">
              {context.decisions.length === 0 ? (
                <p className="text-muted-foreground">Une décision auteur active est nécessaire avant de préparer une unité de rédaction.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground">Cette préparation assemble des décisions et des preuves ; elle ne génère aucun texte.</p>
                  {context.decisions.length > 1 && (
                    <div className="space-y-2">
                      <Label htmlFor="writingDecisionId">Décision active</Label>
                      <select
                        id="writingDecisionId"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                  {writingError && <p className="text-sm text-rose-600">Préparation indisponible : {writingError}</p>}
                  {writingContext && (
                    <WritingContextResult
                      context={writingContext}
                      loading={writingLoading}
                      onCreate={() => void createWritingDraftUnit()}
                    />
                  )}
                  {draftMessage && (
                    <div className="flex flex-wrap items-center gap-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      <p>{draftMessage}</p>
                      {createdDraftUnitId && projectId && (
                        <Link className="font-medium underline" to={`/projects/${projectId}/editor?unitId=${createdDraftUnitId}`}>
                          Ouvrir l’unité préparée
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </WorkshopCard>

            <WorkshopCard title="Sources de la section">
              {context.sources.length === 0 ? <p className="text-muted-foreground">Aucune source distribuée dans cette portée.</p> : (
                <ul className="space-y-2">
                  {context.sources.map((source) => (
                    <li key={source.sourceId} className="rounded bg-muted/60 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{source.title}</span>
                        <span className={source.qualified ? "text-emerald-700" : "text-amber-700"}>{source.qualified ? "Qualifiée" : "Non qualifiée"}</span>
                      </div>
                      {source.authors.length > 0 && <p className="text-muted-foreground">{source.authors.join(", ")}</p>}
                      {!source.qualified && <p className="mt-1 text-xs text-muted-foreground">Piste visible, mais non disponible comme preuve automatique.</p>}
                    </li>
                  ))}
                </ul>
              )}
            </WorkshopCard>

            <WorkshopCard title="Lectures strictes">
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Mode strict : choisissez explicitement la portée de la lecture. Ces lectures restent non exécutables.
                </p>
                <Button onClick={() => void runSectionScopeReading()} disabled={readingLoading}>
                  {readingLoading ? "Lecture en cours…" : "Lire la section"}
                </Button>
                {context.diffraction.paragraphs.length === 0 ? (
                  <p className="text-muted-foreground">Aucun paragraphe rédigé dans cette section.</p>
                ) : (
                  <div className="space-y-2">
                    {context.diffraction.paragraphs.map((paragraph) => (
                      <div key={paragraph.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/60 px-3 py-2">
                        <span className="text-muted-foreground">{paragraph.id}, version {paragraph.version}</span>
                        <Button variant="outline" onClick={() => void runParagraphScopeReading(paragraph.id)} disabled={readingLoading}>
                          Lire le paragraphe {paragraph.id}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {readingError && <p className="text-sm text-rose-600">Lecture indisponible : {readingError}</p>}
              </div>
            </WorkshopCard>

            <WorkshopCard title="Fragment à diffracter">
              <div className="space-y-3">
                {context.proposals.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="proposalId">Proposition candidate</Label>
                    <select id="proposalId" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={proposalId} onChange={(event) => selectProposal(event.target.value)}>
                      {context.proposals.map((proposal) => <option key={proposal.id} value={proposal.id}>{proposal.id}</option>)}
                    </select>
                  </div>
                )}
                <Textarea id="statement" aria-label="Fragment à lire" value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="Posez un fragment dans la section sélectionnée…" rows={4} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void runReading()} disabled={readingLoading || !statement.trim()}>{readingLoading ? "Lecture en cours…" : "Lire le fragment"}</Button>
                  {readingError && <p className="text-sm text-rose-600">Lecture indisponible : {readingError}</p>}
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
    <div className="space-y-3 rounded border border-emerald-200 bg-emerald-50/40 p-3">
      <p className="font-medium">Contexte de rédaction préparé : aucune génération n’a été lancée.</p>
      <p className="text-muted-foreground">Décision {context.decision.id}, validée par {context.decision.validation.validatedBy}.</p>
      <p className="text-muted-foreground">{context.evidencePack.sourceIds.length} preuve{context.evidencePack.sourceIds.length > 1 ? "s" : ""} retenue{context.evidencePack.sourceIds.length > 1 ? "s" : ""} dans l’EvidencePack.</p>
      <ul className="space-y-2">
        {context.visibleSources.map((source) => (
          <li key={source.sourceId} className="rounded bg-background/70 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{source.title}</span>
              <span className={source.inclusion === "evidence_pack" ? "text-emerald-700" : "text-amber-700"}>
                {source.inclusion === "evidence_pack" ? "Preuve retenue" : "Visible, non retenue"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Distribution : {source.provenance.distributionRationale}</p>
            {source.exclusionReason && <p className="text-xs text-muted-foreground">Exclusion : {source.exclusionReason === "missing_or_unqualified_profile" ? "profil manquant ou non qualifiant" : "extrait manquant"}.</p>}
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${VERDICT_STYLES[reading.verdict] ?? "bg-slate-100 text-slate-800"}`}>{VERDICT_LABELS[reading.verdict] ?? reading.verdict}</span>
        <span className="text-sm text-muted-foreground">{reading.verdictDetail}</span>
        {scope && <span className="rounded border border-dashed px-2 py-1 text-xs text-muted-foreground">{readingScopeLabel(scope)}</span>}
        <span className="rounded border border-dashed px-2 py-1 text-xs text-muted-foreground">Proposition non exécutable avant acte auteur</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WorkshopCard title="Pass 1 — le fragment à travers le livre">
          {reading.pass1.refraction.length > 0 ? <ul className="list-disc space-y-1 pl-4">{reading.pass1.refraction.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-muted-foreground">Aucune réfraction supplémentaire.</p>}
        </WorkshopCard>
        <WorkshopCard title="Pass 4 — la coupe agentielle"><p className="font-medium">{reading.pass4.cut}</p><p className="mt-2 text-muted-foreground">{reading.action}</p></WorkshopCard>
      </div>

      {(reading.planImpacts.length > 0 || reading.bibliographyImpacts.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {reading.planImpacts.length > 0 && <WorkshopCard title="Impacts sur le plan"><ul className="list-disc space-y-1 pl-4">{reading.planImpacts.map((impact) => <li key={`${impact.partId}-${impact.entryId ?? impact.impact}`}>{impact.impact}</li>)}</ul></WorkshopCard>}
          {reading.bibliographyImpacts.length > 0 && <WorkshopCard title="Impacts bibliographiques"><ul className="list-disc space-y-1 pl-4">{reading.bibliographyImpacts.map((impact) => <li key={`${impact.sourceId}-${impact.scopeId}`}>{impact.kind} — {impact.impact}</li>)}</ul></WorkshopCard>}
        </div>
      )}

      <WorkshopCard title="Acte auteur">
        {!proposal ? (
          <p className="text-muted-foreground">Cette lecture n’est rattachée à aucune proposition candidate ; aucun acte ne peut être enregistré.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground">La proposition {proposal.id} reste candidate jusqu’à votre acte explicite.</p>
            {authorAction === null && (
              <div className="space-y-2">
                <Label htmlFor="validationNote">Note de validation (facultative)</Label>
                <Textarea id="validationNote" value={authorNote} onChange={(event) => onAuthorNote(event.target.value)} rows={2} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={loading} onClick={() => onSubmit("accept")}>{loading ? "Enregistrement…" : "Valider"}</Button>
              <Button disabled={loading} variant="outline" onClick={() => onAuthorAction(authorAction === "adapt" ? null : "adapt")}>Adapter</Button>
              <Button disabled={loading} variant="outline" onClick={() => onAuthorAction(authorAction === "reject" ? null : "reject")}>Refuser</Button>
            </div>
            {authorAction === "adapt" && (
              <div className="space-y-3 rounded border p-3">
                <p className="font-medium">Adapter la proposition</p>
                <div className="space-y-2"><Label htmlFor="contentCommitments">Engagements de contenu (une ligne par engagement)</Label><Textarea id="contentCommitments" value={contentCommitments} onChange={(event) => onContentCommitments(event.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label htmlFor="formalCommitments">Engagements de forme (une ligne par engagement)</Label><Textarea id="formalCommitments" value={formalCommitments} onChange={(event) => onFormalCommitments(event.target.value)} rows={3} /></div>
                <div className="space-y-2"><Label htmlFor="adaptationNote">Note d’adaptation</Label><Textarea id="adaptationNote" value={authorNote} onChange={(event) => onAuthorNote(event.target.value)} rows={3} /></div>
                <Button disabled={loading || !adaptationReady} onClick={() => onSubmit("modify")}>Enregistrer l’adaptation</Button>
              </div>
            )}
            {authorAction === "reject" && (
              <div className="space-y-3 rounded border p-3">
                <p className="font-medium">Refuser la proposition</p>
                <div className="space-y-2"><Label htmlFor="rejectionNote">Note de refus (facultative)</Label><Textarea id="rejectionNote" value={authorNote} onChange={(event) => onAuthorNote(event.target.value)} rows={3} /></div>
                <Button disabled={loading} variant="outline" onClick={() => onSubmit("reject")}>Confirmer le refus</Button>
              </div>
            )}
            {error && <p className="text-sm text-rose-600">Décision indisponible : {error}</p>}
          </div>
        )}
      </WorkshopCard>
    </div>
  );
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
