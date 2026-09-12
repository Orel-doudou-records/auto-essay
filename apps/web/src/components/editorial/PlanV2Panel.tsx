import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  PlanningArchitectureProposal,
  PlanningQuestionCandidate,
  PlanningStructuralChange,
  PlanningSubjectExploration,
} from "@auto-essay/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workshopStyles } from "../../styles/workshopStyles";
import * as stylex from "@stylexjs/stylex";
import {
  applyPlanningStructuralDiff,
  createPlanningBriefFromSubjectRequest,
  createPlanningStructuralDiff,
  explorePlanningSubjects,
  fetchPlanningGrill,
  fetchPlanningState,
  proposePlanningDecomposition,
  refinePlanning,
  supersedePlanningBriefRequest,
  type PlanRefinementPayload,
  type PlanningStatePayload,
} from "@/api/planning";

interface PlanV2PanelProps {
  projectId: string;
  chapterId: string;
  writingHref?: string;
}

export function PlanV2Panel({ projectId, chapterId, writingHref }: PlanV2PanelProps) {
  const [state, setState] = useState<PlanningStatePayload>();
  const [exploration, setExploration] = useState<PlanningSubjectExploration>();
  const [refinement, setRefinement] = useState<PlanRefinementPayload>();
  const [grillQuestions, setGrillQuestions] = useState<PlanningQuestionCandidate[]>([]);
  const [architectures, setArchitectures] = useState<PlanningArchitectureProposal[]>([]);
  const [changes, setChanges] = useState<PlanningStructuralChange[]>([]);
  const [question, setQuestion] = useState("");
  const [angle, setAngle] = useState("");
  const [cadrage, setCadrage] = useState("");
  const [loading, setLoading] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function refresh() {
    const next = await fetchPlanningState(projectId, "node", chapterId);
    setState(next);
    setQuestion(next.activeBrief?.question ?? "");
    setAngle(next.activeBrief?.angleOrFunction ?? "");
    if (next.activeBrief) {
      const grill = await fetchPlanningGrill(projectId, next.activeBrief.id, 0);
      setGrillQuestions(grill.questions);
    } else {
      setGrillQuestions([]);
    }
  }

  useEffect(() => {
    void refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [projectId, chapterId]);

  async function run(action: string, task: () => Promise<void>) {
    if (loading) return;
    setLoading(action);
    setError(undefined);
    setMessage(undefined);
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(undefined);
    }
  }

  function editChangeTitle(changeId: string, title: string) {
    setChanges((current) => current.map((change) => {
      if (change.id !== changeId || change.kind !== "create_node") return change;
      return { ...change, node: { ...change.node, title } };
    }));
  }

  return (
    <section {...stylex.props(workshopStyles.stack)} aria-label="Préparation du plan">
      <Card>
        <CardHeader>
          <CardTitle>Préparer ce chapitre</CardTitle>
        </CardHeader>
        <CardContent>
          <div {...stylex.props(workshopStyles.stack)}>
            <p>
              {state?.mode === "existing_plan"
                ? "Le plan existe déjà : vous pouvez le relire, le préciser ou proposer une structure locale."
                : "Partez du corpus pour faire émerger plusieurs sujets avant de structurer."}
            </p>

            {state && (
              <div {...stylex.props(workshopStyles.compactStack)}>
                <strong>Couverture documentaire</strong>
                <span>
                  {state.coverage.representedSourceCount}/{state.coverage.registeredSourceCount} sources ont un contenu exploitable ici.
                </span>
                <span>{state.coverage.note}</span>
              </div>
            )}

            <div {...stylex.props(workshopStyles.field)}>
              <Label htmlFor="plan-cadrage">Cadrage facultatif</Label>
              <Textarea
                id="plan-cadrage"
                value={cadrage}
                onChange={(event) => setCadrage(event.target.value)}
                placeholder="Ce que vous cherchez à comprendre, sans imposer une thèse."
              />
            </div>

            <div {...stylex.props(workshopStyles.actionRow)}>
              <Button
                type="button"
                disabled={Boolean(loading)}
                onClick={() => void run("explore", async () => {
                  setExploration(await explorePlanningSubjects(projectId, cadrage));
                  setRefinement(undefined);
                })}
              >
                {loading === "explore" ? "Exploration…" : "Explorer"}
              </Button>
              {state?.mode === "existing_plan" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(loading)}
                  onClick={() => void run("refine", async () => {
                    setRefinement(await refinePlanning(projectId));
                    setExploration(undefined);
                  })}
                >
                  {loading === "refine" ? "Lecture…" : "Relire le plan"}
                </Button>
              )}
            </div>

            {error && <p role="alert" {...stylex.props(workshopStyles.alert)}>{error}</p>}
            {message && <p {...stylex.props(workshopStyles.status)}>{message}</p>}
          </div>
        </CardContent>
      </Card>

      {exploration && (
        <Card>
          <CardHeader><CardTitle>Sujets possibles</CardTitle></CardHeader>
          <CardContent>
            <div {...stylex.props(workshopStyles.stack)}>
              <p>Couverture observée : {exploration.coverage.exploredSourceCount}/{exploration.coverage.registeredSourceCount}. Les propositions restent provisoires.</p>
              {exploration.subjects.map((subject) => (
                <article key={`${subject.title}-${subject.question}`} {...stylex.props(workshopStyles.compactStack)}>
                  <strong>{subject.title}</strong>
                  <span>{subject.question}</span>
                  <span>{subject.angle}</span>
                  <span>Statut documentaire : {subject.status}</span>
                  {subject.limits.length > 0 && <span>Limites : {subject.limits.join(" · ")}</span>}
                  <Button type="button" disabled={Boolean(loading)} onClick={() => void run("subject", async () => {
                    if (!state) return;
                    await createPlanningBriefFromSubjectRequest(projectId, state.manuscriptId, chapterId, subject);
                    await refresh();
                    setExploration(undefined);
                    setMessage("Sujet retenu. Vous pouvez maintenant le préciser.");
                  })}>Choisir ce sujet</Button>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {refinement && (
        <Card>
          <CardHeader><CardTitle>Ce que la relecture du plan met en tension</CardTitle></CardHeader>
          <CardContent>
            <div {...stylex.props(workshopStyles.stack)}>
              {refinement.diagnostics.length === 0 ? <p>Aucun diagnostic local significatif.</p> : refinement.diagnostics.map((diagnostic, index) => (
                <p key={`${diagnostic.partId}-${diagnostic.entryId ?? index}`}><strong>{diagnostic.kind}</strong> — {diagnostic.reason}</p>
              ))}
              {refinement.remoteImpacts.length > 0 && (
                <div {...stylex.props(workshopStyles.compactStack)}>
                  <strong>Conséquences ailleurs dans le livre</strong>
                  {refinement.remoteImpacts.map((impact, index) => <span key={`${impact.partId}-${impact.entryId ?? index}`}>{impact.partTitle} — {impact.impact}</span>)}
                </div>
              )}
              {!state?.activeBrief && <p>Pour transformer ce diagnostic en structure, choisissez d’abord un sujet avec « Explorer ».</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {state?.activeBrief && (
        <Card>
          <CardHeader><CardTitle>Préciser</CardTitle></CardHeader>
          <CardContent>
            <div {...stylex.props(workshopStyles.stack)}>
              {grillQuestions.length > 0 && (
                <div {...stylex.props(workshopStyles.compactStack)}>
                  <strong>Questions utiles maintenant</strong>
                  {grillQuestions.map((item) => <span key={item.id}>{item.prompt}</span>)}
                  <small>Le nombre de questions est borné par le backend ; aucune session de grill n’est créée.</small>
                </div>
              )}
              <div {...stylex.props(workshopStyles.field)}>
                <Label htmlFor="plan-question">Question directrice</Label>
                <Textarea id="plan-question" value={question} onChange={(event) => setQuestion(event.target.value)} />
              </div>
              <div {...stylex.props(workshopStyles.field)}>
                <Label htmlFor="plan-angle">Angle / fonction</Label>
                <Input id="plan-angle" value={angle} onChange={(event) => setAngle(event.target.value)} />
              </div>

              {state.activeBrief.gaps.length > 0 && (
                <div {...stylex.props(workshopStyles.compactStack)}>
                  <strong>Lacunes encore ouvertes</strong>
                  {state.activeBrief.gaps.map((gap, index) => <span key={`${gap.description}-${index}`}>{gap.description} — {gap.consequence}</span>)}
                </div>
              )}

              {state.readiness && !state.readiness.ready && state.readiness.reasons.length > 0 && (
                <div {...stylex.props(workshopStyles.compactStack)}>
                  <strong>Avant d’écrire</strong>
                  {state.readiness.reasons.map((reason) => <span key={reason}>{reason}</span>)}
                </div>
              )}

              <div {...stylex.props(workshopStyles.actionRow)}>
                <Button type="button" disabled={Boolean(loading) || !question.trim()} onClick={() => void run("clarify", async () => {
                  await supersedePlanningBriefRequest(projectId, state.activeBrief!.id, {
                    question: question.trim(),
                    angleOrFunction: angle.trim() || undefined,
                  });
                  await refresh();
                  setMessage("Précisions enregistrées dans une nouvelle version.");
                })}>{loading === "clarify" ? "Enregistrement…" : "Préciser"}</Button>
                <Button type="button" variant="outline" disabled={Boolean(loading)} onClick={() => void run("decompose", async () => {
                  const result = await proposePlanningDecomposition(projectId, state.activeBrief!.id);
                  setArchitectures(result.architectures);
                  setChanges([]);
                })}>{loading === "decompose" ? "Proposition…" : "Proposer une structure"}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {architectures.length > 0 && state?.activeBrief && (
        <Card>
          <CardHeader><CardTitle>Structures proposées</CardTitle></CardHeader>
          <CardContent>
            <div {...stylex.props(workshopStyles.stack)}>
              {architectures.map((architecture, index) => (
                <article key={`${architecture.structuralDecision}-${index}`} {...stylex.props(workshopStyles.compactStack)}>
                  <strong>{architecture.structuralDecision}</strong>
                  {architecture.whyDifferent && <span>{architecture.whyDifferent}</span>}
                  <ul>{architecture.children.map((child) => <li key={`${child.level}-${child.title}`}>{child.title} — {child.rationale}</li>)}</ul>
                  <Button type="button" disabled={Boolean(loading)} onClick={() => void run("diff", async () => {
                    const result = await createPlanningStructuralDiff(projectId, state.activeBrief!.id, architecture);
                    setChanges(result.changes);
                  })}>Préparer les changements</Button>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {changes.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Vérifier avant validation</CardTitle></CardHeader>
          <CardContent>
            <div {...stylex.props(workshopStyles.stack)}>
              <p>Aucun changement n’est appliqué avant votre validation.</p>
              {changes.map((change) => (
                <div key={change.id} {...stylex.props(workshopStyles.compactStack)}>
                  {change.kind === "create_node" ? (
                    <><Label htmlFor={`change-${change.id}`}>Titre</Label><Input id={`change-${change.id}`} value={change.node.title} onChange={(event) => editChangeTitle(change.id, event.target.value)} /></>
                  ) : <strong>{change.kind}</strong>}
                  <span>Pourquoi : {change.reason}</span>
                  {change.consequences.length > 0 && <span>Conséquences : {change.consequences.join(" · ")}</span>}
                </div>
              ))}
              <div {...stylex.props(workshopStyles.actionRow)}>
                <Button type="button" disabled={Boolean(loading) || changes.some((change) => change.kind === "create_node" && !change.node.title.trim())} onClick={() => void run("apply", async () => {
                  await applyPlanningStructuralDiff(projectId, changes);
                  setChanges([]);
                  setArchitectures([]);
                  await refresh();
                  setMessage("Structure validée et appliquée.");
                })}>{loading === "apply" ? "Validation…" : "Valider"}</Button>
                <Button type="button" variant="outline" disabled={Boolean(loading)} onClick={() => setChanges([])}>Refuser</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state?.readiness?.ready && writingHref && (
        <Card><CardContent><div {...stylex.props(workshopStyles.actionRow)}><span>Ce scope est suffisamment stable pour poursuivre localement.</span><Link {...stylex.props(workshopStyles.actionLink)} to={writingHref}>Passer à l’écriture</Link></div></CardContent></Card>
      )}
    </section>
  );
}
