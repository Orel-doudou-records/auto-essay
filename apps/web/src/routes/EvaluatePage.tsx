import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnits } from "@/hooks/useUnits";
import {
  fetchEvaluationJudgeAssignments,
  type EvaluationJudgeAssignmentsPayload,
} from "@/api";

export function EvaluatePage() {
  const { projectId, unitId } = useParams<{ projectId: string; unitId: string }>();
  const { units, evaluate, verify } = useUnits(projectId);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<EvaluationJudgeAssignmentsPayload>();
  const [usedAssignments, setUsedAssignments] = useState<EvaluationJudgeAssignmentsPayload>();
  const [assignmentError, setAssignmentError] = useState<string>();

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
    return () => {
      active = false;
    };
  }, [projectId, unitId, unit]);

  async function handleEvaluate() {
    if (!unitId) return;
    setLoading(true);
    try {
      const data = await evaluate(unitId);
      if (data) {
        setResult(data.evaluation);
        setBrief(data.brief);
        setUsedAssignments(data.assignments);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!unitId) return;
    await verify(unitId);
  }

  if (!unit) return <AppShell projectId={projectId}>Unité introuvable.</AppShell>;

  const dimensions = (result?.dimensions as Record<string, number>) ?? {};

  return (
    <AppShell projectId={projectId}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Évaluation</h1>
          <Link to={`/projects/${projectId}/editor`}>
            <Button variant="outline" size="sm">Retour à l'éditeur</Button>
          </Link>
        </div>

        {assignments && <JudgeAssignments assignments={assignments} title="Juges affectés" />}
        {assignmentError && (
          <p role="alert">Affectations de juge indisponibles : {assignmentError}</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{unit.thesis || unit.contextInPlan?.section}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Statut : {unit.status} — Version {unit.version}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleEvaluate} disabled={loading}>
                {loading ? "Évaluation…" : "Évaluer"}
              </Button>
              <Button variant="secondary" onClick={handleVerify}>
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
              <CardTitle>Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-lg font-medium">
                Score global : {result.overallScore as number}/10
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(dimensions).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded border p-2 text-sm"
                  >
                    <span className="font-medium">{key}</span> : {value}
                  </div>
                ))}
              </div>
              <p className="text-sm">
                Verdict :{" "}
                <span className="font-medium">{result.verdict as string}</span>
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
              <pre className="rounded bg-muted p-3 text-xs">
                {JSON.stringify(brief, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
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
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">Juge documentaire</span> — <span>{assignments.documentary.judge.model}</span>
            <span className="text-muted-foreground">
              {" "}(id : <span>{assignments.documentary.judge.id}</span>; spécialité : <span>{assignments.documentary.judge.specialty}</span>; raison : <span>{assignments.documentary.rationale}</span>)
            </span>
          </li>
          <li>
            <span className="font-medium">Juge éditorial</span> — <span>{assignments.editorial.judge.model}</span>
            <span className="text-muted-foreground">
              {" "}(id : <span>{assignments.editorial.judge.id}</span>; spécialité : <span>{assignments.editorial.judge.specialty}</span>; raison : <span>{assignments.editorial.rationale}</span>)
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
