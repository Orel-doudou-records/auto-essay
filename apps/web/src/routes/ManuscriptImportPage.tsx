import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ManuscriptImportPreview, ManuscriptImportSection, ManuscriptReimportAction, ManuscriptReimportComparison } from "@auto-essay/core";
import {
  confirmManuscriptImport,
  confirmManuscriptReimport,
  previewManuscriptImport,
  previewManuscriptReimport,
  type ManuscriptReimportPreviewPayload,
} from "@/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_MANUSCRIPT_BYTES = 5_000_000;

export function ManuscriptImportPage({ mode = "import" }: { mode?: "import" | "reimport" }) {
  const { projectId } = useParams<{ projectId: string }>();
  const reimport = mode === "reimport";
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ManuscriptImportPreview>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ManuscriptReimportComparison>();
  const [actions, setActions] = useState<Record<string, Partial<ManuscriptReimportAction>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "confirming" | "done">("idle");
  const [error, setError] = useState<string>();
  const [firstUnitId, setFirstUnitId] = useState<string>();
  const isValidPreview = Boolean(
    preview?.title.trim() && preview.sections.every((section) => section.title.trim())
  );
  const reimportIsComplete = Boolean(
    !reimport ||
      (preview && comparison && preview.sections.every((section) => {
        const choice = actions[section.id];
        return choice?.action && (choice.action !== "replace" || Boolean(choice.targetSectionId));
      }) &&
        new Set(
          Object.values(actions)
            .filter((choice) => choice.action === "replace")
            .map((choice) => choice.targetSectionId)
        ).size === Object.values(actions).filter((choice) => choice.action === "replace").length)
  );

  async function preparePreview(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !file) return;
    if (file.size > MAX_MANUSCRIPT_BYTES) {
      setError("Le fichier dépasse la taille maximale de 5 Mo.");
      return;
    }
    setError(undefined);
    setStatus("loading");
    try {
      const content = /\.(docx|odt)$/i.test(file.name) ? await file.arrayBuffer() : await file.text();
      const result = reimport
        ? await previewManuscriptReimport(projectId, file.name, content)
        : await previewManuscriptImport(projectId, file.name, content);
      setPreview(result.preview);
      setWarnings(result.warnings);
      setComparison(isReimportPreview(result) ? result.comparison : undefined);
      setActions({});
      setStatus("idle");
    } catch (reason) {
      setError(messageFor(reason));
      setStatus("idle");
    }
  }

  function updatePreview(mutator: (current: ManuscriptImportPreview) => ManuscriptImportPreview) {
    setPreview((current) => (current ? mutator(current) : current));
  }

  function updateSection(index: number, patch: Partial<ManuscriptImportSection>) {
    updatePreview((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section
      ),
    }));
  }

  function addSection() {
    updatePreview((current) => ({
      ...current,
      sections: [
        ...current.sections,
        { id: crypto.randomUUID(), title: "Nouvelle section", content: "", level: 1, annotations: [] },
      ],
    }));
  }

  function removeSection(index: number) {
    updatePreview((current) => ({
      ...current,
      sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index),
    }));
  }

  function updateAction(sectionId: string, action: ManuscriptReimportAction["action"]) {
    setActions((current) => ({
      ...current,
      [sectionId]: { sectionId, action, targetSectionId: action === "replace" ? current[sectionId]?.targetSectionId : undefined },
    }));
  }

  function updateReplacementTarget(sectionId: string, targetSectionId: string) {
    setActions((current) => ({ ...current, [sectionId]: { ...current[sectionId], sectionId, action: "replace", targetSectionId } }));
  }

  async function confirmImport() {
    if (!projectId || !preview || preview.sections.length === 0) return;
    setError(undefined);
    setStatus("confirming");
    try {
      const result: { units: Array<{ id: string }>; unitIds?: string[] } = reimport && comparison
        ? await confirmManuscriptReimport(
            projectId,
            preview,
            comparison.manuscriptUpdatedAt,
            preview.sections.map((section) => actions[section.id] as ManuscriptReimportAction)
          )
        : await confirmManuscriptImport(projectId, preview);
      setFirstUnitId(result.unitIds?.[0] ?? result.units[0]?.id);
      setStatus("done");
    } catch (reason) {
      setError(messageFor(reason));
      setStatus("idle");
    }
  }

  return (
    <AppShell projectId={projectId}>
      <section>
        <h1>{reimport ? "Comparer un nouveau fichier" : "Importer un manuscrit"}</h1>
        <p>{reimport ? "Comparez le fichier au manuscrit courant, puis choisissez explicitement le sort de chaque section." : "Le fichier reste un aperçu modifiable jusqu’à votre confirmation."}</p>

        {!preview && status !== "done" && (
          <form onSubmit={preparePreview}>
            <Label htmlFor="manuscript-file">Fichier Markdown, Word ou LibreOffice</Label>
            <Input
              id="manuscript-file"
              type="file"
              accept=".md,.docx,.odt,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setError(undefined);
              }}
            />
            <Button type="submit" disabled={!file || status === "loading"}>
              {status === "loading" ? "Préparation…" : "Préparer l’aperçu"}
            </Button>
          </form>
        )}

        {error && <p role="alert">{error}</p>}

        <p aria-live="polite">
          {status === "loading" ? "Préparation de l’aperçu…" : status === "confirming" ? "Import du manuscrit…" : ""}
        </p>

        {preview && (
          <section aria-label={reimport ? "Aperçu comparé du manuscrit" : "Aperçu du manuscrit"} aria-busy={status === "confirming"}>
            {status === "done" ? (
              <Card>
                <CardHeader>
                  <CardTitle>{reimport ? "Comparaison terminée" : "Import terminé"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p aria-live="polite">
                    {reimport
                      ? `Comparaison terminée : ${preview.sections.length} section${preview.sections.length > 1 ? "s" : ""} examinée${preview.sections.length > 1 ? "s" : ""}.`
                      : `Import terminé : ${preview.sections.length} section${preview.sections.length > 1 ? "s" : ""} créée${preview.sections.length > 1 ? "s" : ""}.`}
                  </p>
                  {firstUnitId && (
                    <Link to={`/projects/${projectId}/editor?unitId=${firstUnitId}`}>
                      Ouvrir la première section
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <h2>{reimport ? "Aperçu comparé à appliquer" : "Aperçu à corriger"}</h2>
                {warnings.length > 0 && (
                  <div role="status">
                    <h3>Points à vérifier avant l’import</h3>
                    <ul>
                      {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                    </ul>
                  </div>
                )}
                <Label htmlFor="manuscript-title">Titre du manuscrit</Label>
                <Input
                  id="manuscript-title"
                  value={preview.title}
                  onChange={(event) => updatePreview((current) => ({ ...current, title: event.target.value }))}
                  aria-invalid={!preview.title.trim()}
                />
                {preview.sections.map((section, index) => (
                  <Card key={section.id}>
                    <CardHeader>
                      <CardTitle>Section {index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Label htmlFor={`section-title-${section.id}`}>Titre de la section {index + 1}</Label>
                      <Input
                        id={`section-title-${section.id}`}
                        value={section.title}
                        onChange={(event) => updateSection(index, { title: event.target.value })}
                        aria-invalid={!section.title.trim()}
                      />
                      <Label htmlFor={`section-content-${section.id}`}>Texte de la section {index + 1}</Label>
                      <Textarea
                        id={`section-content-${section.id}`}
                        value={section.content}
                        onChange={(event) => updateSection(index, { content: event.target.value })}
                        rows={8}
                      />
                      {section.annotations.length > 0 && (
                        <div>
                          <h3>Annotations à examiner</h3>
                          <ul>
                            {section.annotations.map((annotation, annotationIndex) => (
                              <li key={`${section.id}-${annotationIndex}`}>
                                {annotation.kind === "link"
                                  ? `Lien : ${annotation.label} (${annotation.url})`
                                  : `Commentaire : ${annotation.content}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {reimport && comparison ? (
                        <ReimportDecision
                          section={section}
                          comparison={comparison}
                          choice={actions[section.id]}
                          onAction={updateAction}
                          onTarget={updateReplacementTarget}
                        />
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={preview.sections.length === 1}
                          onClick={() => removeSection(index)}
                        >
                          Retirer cette section
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {!reimport && <Button type="button" variant="outline" onClick={addSection}>Ajouter une section</Button>}
                {!isValidPreview && <p role="alert">Donnez un titre au manuscrit et à chaque section avant de confirmer.</p>}
                {reimport && !reimportIsComplete && <p role="alert">Choisissez une action pour chaque section et une seule cible par remplacement.</p>}
                <Button type="button" onClick={() => void confirmImport()} disabled={status === "confirming" || !isValidPreview || !reimportIsComplete}>
                  {status === "confirming" ? "Application…" : reimport ? "Appliquer les changements choisis" : "Confirmer l’import"}
                </Button>
              </>
            )}
          </section>
        )}
      </section>
    </AppShell>
  );
}

function ReimportDecision({
  section,
  comparison,
  choice,
  onAction,
  onTarget,
}: {
  section: ManuscriptImportSection;
  comparison: ManuscriptReimportComparison;
  choice?: Partial<ManuscriptReimportAction>;
  onAction: (sectionId: string, action: ManuscriptReimportAction["action"]) => void;
  onTarget: (sectionId: string, targetSectionId: string) => void;
}) {
  const suggestion = comparison.suggestions.find((item) => item.sectionId === section.id);
  const suggestedTarget = suggestion?.targetSectionId
    ? comparison.targets.find((target) => target.id === suggestion.targetSectionId)
    : undefined;
  return (
    <fieldset>
      <legend>Décision pour « {section.title} »</legend>
      <p>
        {suggestedTarget
          ? `Correspondance suggérée : « ${suggestedTarget.title} » (${suggestedTarget.unitCount} passage${suggestedTarget.unitCount > 1 ? "s" : ""}).`
          : "Aucune correspondance sûre n’a été trouvée."}
      </p>
      <Label htmlFor={`reimport-action-${section.id}`}>Action</Label>
      <select
        id={`reimport-action-${section.id}`}
        value={choice?.action ?? ""}
        onChange={(event) => onAction(section.id, event.target.value as ManuscriptReimportAction["action"])}
      >
        <option value="">Choisir une action</option>
        <option value="add">Ajouter comme nouvelle section</option>
        <option value="replace">Remplacer une section existante</option>
        <option value="ignore">Ignorer cette section</option>
      </select>
      {choice?.action === "replace" && (
        <>
          <Label htmlFor={`reimport-target-${section.id}`}>Section à remplacer</Label>
          <select
            id={`reimport-target-${section.id}`}
            value={choice.targetSectionId ?? ""}
            onChange={(event) => onTarget(section.id, event.target.value)}
          >
            <option value="">Choisir une section</option>
            {comparison.targets.map((target) => (
              <option key={target.id} value={target.id}>{target.title} ({target.unitCount} passage{target.unitCount > 1 ? "s" : ""})</option>
            ))}
          </select>
        </>
      )}
    </fieldset>
  );
}

function messageFor(reason: unknown): string {
  return reason instanceof Error ? reason.message : "L’import a échoué. Réessayez.";
}

function isReimportPreview(
  result: { preview: ManuscriptImportPreview; warnings: string[] } | ManuscriptReimportPreviewPayload
): result is ManuscriptReimportPreviewPayload {
  return "comparison" in result;
}
