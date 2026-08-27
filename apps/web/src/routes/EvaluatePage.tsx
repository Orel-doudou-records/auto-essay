import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnits } from "@/hooks/useUnits";
import {
  fetchEvaluationJudgeAssignments,
  fetchIntegratedEvaluationHistory,
  fetchIntegratedEvaluationReadiness,
  type EvaluationJudgeAssignmentsPayload,
  type IntegratedEvaluationHistoryEntryPayload,
  type IntegratedEvaluationReadinessPayload,
} from "@/api";

type DocumentaryEvaluation = Record<string, unknown>;
type IntegratedEvaluationOutcome = {
  editorialEvaluation: Record<string, unknown>;
  gates: { documentaryIntegrity: string; editorialCoherence: string };
  finalVerdict: string;
};

export function EvaluatePage() {
  const { projectId, unitId } = useParams<{ projectId: string; unitId: string }>();
  const { units, evaluate, evaluateIntegrated, verify } = useUnits(projectId);
  const [result, setResult] = useState<DocumentaryEvaluation | null>(null);
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [integratedOutcome, setIntegratedOutcome] = useState<IntegratedEvaluationOutcome | null>(null);
  const [loadingAction, setLoadingAction] = useState<"documentary" | "integrated" | null>(null);
  const [assignments, setAssignments] = useState<EvaluationJudgeAssignmentsPayload>();
  const [usedAssignments, setUsedAssignments] = useState<EvaluationJudgeAssignmentsPayload>();
  const [assignmentError, setAssignmentError] = useState<string>();
  const [readiness, setReadiness] = useState<IntegratedEvaluationReadinessPayload>();
  const [readinessError, setReadinessError] = useState<string>();
  const [history, setHistory] = useState<IntegratedEvaluationHistoryEntryPayload[]>([]);
  const [historyError, setHistoryError] = useState<string>();

  const unit = units.find((u) => u.id === unitId);

  useEffect(() => {
    if (!projectId || !unitId || !unit) return;
    let active = true;
    fetchEvaluationJudgeAssignments(projectId, unitId)
      .then((nextAssignments) => {
        if (active) setAssignments(nextAssignments);
      })
      .catch((reason) => {
        if (active) {
          setAssignmentError(reason instanceof Error ? reason.message : "Erreur inconnue");
        }
      });
    fetchIntegratedEvaluationReadiness(projectId, unitId)
      .then((nextReadiness) => {
        if (active) setReadiness(nextReadiness);
      })
      .catch((reason) => {
        if (active) {
          setReadinessError(reason instanceof Error ? reason.message : "Erreur inconnue");
        }
      });
    fetchIntegratedEvaluationHistory(projectId, unitId)
      .then((nextHistory) => {
        if (active) setHistory(nextHistory);
      })
      .catch((reason) => {
        if (active) {
          setHistoryError(reason instanceof Error ? reason.message : "Erreur inconnue");
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, unitId, unit]);

  async function handleDocumentaryEvaluate() {
    if (!unitId) return;
    setLoadingAction("documentary");
    try {
      const data = await evaluate(unitId);
      if (data) {
        setResult(data.evaluation);
        setBrief(data.brief);
        setUsedAssignments(data.assignments);
        setIntegratedOutcome(null);
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleIntegratedEvaluate() {
    if (!unitId || readiness?.status !== "ready") return;
    setLoadingAction("integrated");
    try {
      const data = await evaluateIntegrated(unitId);
      if (data) {
        setResult(data.evaluation);
        setBrief(data.brief);
        setUsedAssignments(data.assignments);
        setIntegratedOutcome({
          editorialEvaluation: data.editorialEvaluation,
          gates: data.gates,
          finalVerdict: data.finalVerdict,
        });
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleVerify() {
    if (!unitId) return;
    await verify(unitId);
  }

  if (!unit) return <AppShell projectId={projectId}>Unité introuvable.</AppShell>;

  const dimensions = (result?.dimensions as Record<string, number>) ?? {};
  const editorialScore = integratedOutcome?.editorialEvaluation.overallEditorialScore as number | undefined;
  const editorialSummary = integratedOutcome?.editorialEvaluation.summary as string | undefined;

  return (
    <AppShell projectId={projectId}>
      <div>
        <div>
          <h1>Évaluation</h1>
          <Link to={`/projects/${projectId}/editor`}>
            <Button variant="outline" size="sm">Retour à l'éditeur</Button>
          </Link>
        </div>

        {assignments && <JudgeAssignments assignments={assignments} title="Juges affectés" />}
        {assignmentError && (
          <p role="alert">Affectations de juge indisponibles : {assignmentError}</p>
        )}

        <IntegratedReadiness readiness={readiness} error={readinessError} />
        {historyError && (
          <p role="alert">Historique des évaluations intégrées indisponible : {historyError}</p>
        )}
        {history.length > 0 && <IntegratedEvaluationHistory history={history} />}

        <Card>
          <CardHeader>
            <CardTitle>{unit.thesis || unit.contextInPlan?.section}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Statut : {unit.status} — Version {unit.version}
            </p>
            <div>
              <Button
                onClick={handleDocumentaryEvaluate}
                disabled={loadingAction !== null}
              >
                {loadingAction === "documentary"
                  ? "Évaluation documentaire…"
                  : "Évaluation documentaire"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleIntegratedEvaluate}
                disabled={loadingAction !== null || readiness?.status !== "ready"}
              >
                {loadingAction === "integrated"
                  ? "Évaluation intégrée…"
                  : "Évaluation intégrée"}
              </Button>
              <Button variant="outline" onClick={handleVerify}>
                Marquer vérifié
              </Button>
            </div>
          </CardContent>
        </Card>

        {usedAssignments && (
          <JudgeAssignments
            assignments={usedAssignments}
            title="Affectations associées à cette évaluation"
          />
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Évaluation documentaire</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Score global : {result.overallScore as number}/10
              </p>
              <div>
                {Object.entries(dimensions).map(([key, value]) => (
                  <div key={key}>
                    <span>{key}</span> : {value}
                  </div>
                ))}
              </div>
              <p>
                Verdict documentaire :{" "}
                <span>{result.verdict as string}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {integratedOutcome && (
          <Card>
            <CardHeader>
              <CardTitle>Évaluation des effets éditoriaux</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Score éditorial : {editorialScore}/10</p>
              {editorialSummary && <p>{editorialSummary}</p>}
              <p>Porte documentaire : {integratedOutcome.gates.documentaryIntegrity}</p>
              <p>Porte éditoriale : {integratedOutcome.gates.editorialCoherence}</p>
              <p>
                Verdict intégré : <span>{integratedOutcome.finalVerdict}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {brief && (
          <Card>
            <CardHeader>
              <CardTitle>Brief de révision</CardTitle>
            </CardHeader>
            <CardContent>
              <pre>
                {JSON.stringify(brief, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function IntegratedEvaluationHistory({
  history,
}: {
  history: IntegratedEvaluationHistoryEntryPayload[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évaluation intégrée enregistrée</CardTitle>
      </CardHeader>
      <CardContent>
        {history.map((entry) => (
          <section key={entry.id}>
            <p>
              Version {entry.unitVersion} — enregistrée le {new Date(entry.recordedAt).toLocaleString("fr-FR")}
            </p>
            <p>
              {entry.current
                ? "Cette évaluation correspond encore à la version et aux décisions auteur actuelles."
                : "Historique : le texte ou la décision auteur a changé depuis ce jugement."}
            </p>
            <p>Évaluation documentaire archivée : {entry.evaluation.overallScore}/10</p>
            <p>Évaluation éditoriale archivée : {entry.editorialEvaluation.overallEditorialScore}/10</p>
            <p>
              Portes archivées : documentaire {entry.gates.documentaryIntegrity} ; éditoriale {entry.gates.editorialCoherence}
            </p>
            <p>Verdict intégré archivé : {entry.finalVerdict}</p>
            <div>
              <p>Brief archivé</p>
              <pre>
                {JSON.stringify(entry.brief, null, 2)}
              </pre>
            </div>
            <div>
              <p>Affectations archivées</p>
              <p>
                Documentaire : {entry.assignments.documentary.judge.model} ; éditoriale : {entry.assignments.editorial.judge.model}
              </p>
            </div>
            <div>
              <p>Provenance enregistrée</p>
              <p>Plan éditorial : {entry.context.editorialPlanId}</p>
              <p>
                Décisions auteur : {entry.authorDecisions
                  .map((decision) => `${decision.id} (v${decision.version}, ${decision.status})`)
                  .join(", ")}
              </p>
              <p>
                Projections : Writer {entry.context.writerProjection.id} ; Evaluator {entry.context.evaluatorProjection.id}
              </p>
              <p>
                Traces Writer : {entry.context.transformationTraces.map((trace) => trace.id).join(", ") || "aucune"}
              </p>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function IntegratedReadiness({
  readiness,
  error,
}: {
  readiness?: IntegratedEvaluationReadinessPayload;
  error?: string;
}) {
  if (error) {
    return <p role="alert">Préparabilité intégrée indisponible : {error}</p>;
  }
  if (!readiness) {
    return <p>Préparation de l’évaluation intégrée…</p>;
  }
  if (readiness.status === "ready") {
    return <p>Évaluation intégrée prête</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évaluation intégrée indisponible</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Cette unité reste évaluable documentairement.</p>
        <ul>
          {readiness.reasons.map((reason) => (
            <li key={reason.code}>{describeReadinessReason(reason.code)}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function describeReadinessReason(code: string): string {
  const messages: Record<string, string> = {
    missing_context: "Aucune décision éditoriale active ne prépare cette unité.",
    missing_evaluator_projection:
      "La projection nécessaire au juge éditorial est absente.",
    context_mismatch:
      "La version de l’unité ou son contexte éditorial a changé depuis la préparation.",
    missing_active_decision:
      "La décision éditoriale qui préparait cette unité n’est plus active.",
    missing_compatible_traces:
      "La génération n’a pas encore déclaré de trace compatible avec la décision active.",
  };
  return messages[code] ?? "Le contexte éditorial requis n’est pas disponible.";
}

function JudgeAssignments({
  assignments,
  title,
}: {
  assignments: EvaluationJudgeAssignmentsPayload;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          <li>
            <span>Juge documentaire</span> — <span>{assignments.documentary.judge.model}</span>
            <span>
              {" "}(id : <span>{assignments.documentary.judge.id}</span>; spécialité : <span>{assignments.documentary.judge.specialty}</span>; raison : <span>{assignments.documentary.rationale}</span>)
            </span>
          </li>
          <li>
            <span>Juge éditorial</span> — <span>{assignments.editorial.judge.model}</span>
            <span>
              {" "}(id : <span>{assignments.editorial.judge.id}</span>; spécialité : <span>{assignments.editorial.judge.specialty}</span>; raison : <span>{assignments.editorial.rationale}</span>)
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
