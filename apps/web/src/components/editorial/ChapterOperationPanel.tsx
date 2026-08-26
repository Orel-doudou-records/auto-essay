import { useState } from "react";
import {
  awaitChapterOperationAuthor,
  cancelChapterOperation,
  createChapterOperation,
  pauseChapterOperation,
  resumeChapterOperation,
  startChapterOperation,
  type ChapterOperationPayload,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChapterOperationPanelProps {
  projectId: string;
  chapterId: string;
}

const stateLabels: Record<ChapterOperationPayload["state"], string> = {
  preparing: "Préparation déclarée",
  awaiting_author: "En attente de l’acte auteur",
  running: "Exécution déclarée",
  paused: "En pause",
  failed: "Échec déclaré",
  cancelled: "Annulée",
  completed: "Terminée",
};

export function ChapterOperationPanel({ projectId, chapterId }: ChapterOperationPanelProps) {
  const [operation, setOperation] = useState<ChapterOperationPayload>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function apply(action: () => Promise<{ operation: ChapterOperationPayload }>) {
    setPending(true);
    setError(undefined);
    try {
      const result = await action();
      setOperation(result.operation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur inconnue");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opération de chapitre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!operation ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Déclarez une opération pour rendre ses futurs actes observables. Cette déclaration ne lance aucun travail.
            </p>
            <Button
              type="button"
              disabled={pending}
              onClick={() => apply(() => createChapterOperation(projectId, chapterId))}
            >
              Déclarer une opération de chapitre
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="font-medium">{stateLabels[operation.state]}</p>
              {operation.state === "preparing" && (
                <p className="text-sm text-muted-foreground">
                  Préparation déclarée : aucun travail automatique n’est lancé.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {operation.state === "preparing" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => apply(() => awaitChapterOperationAuthor(projectId, operation.id))}
                >
                  Marquer prête à recevoir l’acte auteur
                </Button>
              )}
              {operation.state === "awaiting_author" && (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => apply(() => startChapterOperation(projectId, operation.id))}
                >
                  Démarrer l’opération (acte auteur)
                </Button>
              )}
              {operation.state === "running" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => apply(() => pauseChapterOperation(projectId, operation.id))}
                >
                  Mettre l’opération en pause
                </Button>
              )}
              {(operation.state === "paused" || operation.state === "failed") && (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => apply(() => resumeChapterOperation(projectId, operation.id))}
                >
                  Reprendre l’opération (acte auteur)
                </Button>
              )}
              {!(["cancelled", "completed"] as ChapterOperationPayload["state"][]).includes(operation.state) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => apply(() => cancelChapterOperation(projectId, operation.id))}
                >
                  Annuler l’opération
                </Button>
              )}
            </div>

            <ol className="space-y-1 text-sm text-muted-foreground">
              {operation.trace.map((event, index) => (
                <li key={`${event.occurredAt}-${index}`}>
                  {event.type} — {event.actor}
                  {event.detail ? ` : ${event.detail}` : ""}
                </li>
              ))}
            </ol>
          </>
        )}
        {error && <p role="alert">Erreur : {error}</p>}
      </CardContent>
    </Card>
  );
}
