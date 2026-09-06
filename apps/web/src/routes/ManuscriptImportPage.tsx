import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ManuscriptImportPreview, ManuscriptImportSection } from "@auto-essay/core";
import { confirmManuscriptImport, previewManuscriptImport } from "@/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_MANUSCRIPT_BYTES = 5_000_000;

export function ManuscriptImportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ManuscriptImportPreview>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "confirming" | "done">("idle");
  const [error, setError] = useState<string>();
  const [firstUnitId, setFirstUnitId] = useState<string>();
  const isValidPreview = Boolean(
    preview?.title.trim() && preview.sections.every((section) => section.title.trim())
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
      const result = await previewManuscriptImport(
        projectId,
        file.name,
        /\.(docx|odt)$/i.test(file.name) ? await file.arrayBuffer() : await file.text()
      );
      setPreview(result.preview);
      setWarnings(result.warnings);
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

  async function confirmImport() {
    if (!projectId || !preview || preview.sections.length === 0) return;
    setError(undefined);
    setStatus("confirming");
    try {
      const result = await confirmManuscriptImport(projectId, preview);
      setFirstUnitId(result.units[0]?.id);
      setStatus("done");
    } catch (reason) {
      setError(messageFor(reason));
      setStatus("idle");
    }
  }

  return (
    <AppShell projectId={projectId}>
      <section>
        <h1>Importer un manuscrit</h1>
        <p>Le fichier reste un aperçu modifiable jusqu’à votre confirmation.</p>

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
          <section aria-label="Aperçu du manuscrit" aria-busy={status === "confirming"}>
            {status === "done" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Import terminé</CardTitle>
                </CardHeader>
                <CardContent>
                  <p aria-live="polite">Import terminé : {preview.sections.length} unité{preview.sections.length > 1 ? "s" : ""} créée{preview.sections.length > 1 ? "s" : ""}.</p>
                  {firstUnitId && (
                    <Link to={`/projects/${projectId}/editor?unitId=${firstUnitId}`}>
                      Ouvrir la première section
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <h2>Aperçu à corriger</h2>
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
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={preview.sections.length === 1}
                        onClick={() => removeSection(index)}
                      >
                        Retirer cette section
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button type="button" variant="outline" onClick={addSection}>Ajouter une section</Button>
                {!isValidPreview && <p role="alert">Donnez un titre au manuscrit et à chaque section avant de confirmer.</p>}
                <Button type="button" onClick={() => void confirmImport()} disabled={status === "confirming" || !isValidPreview}>
                  {status === "confirming" ? "Import…" : "Confirmer l’import"}
                </Button>
              </>
            )}
          </section>
        )}
      </section>
    </AppShell>
  );
}

function messageFor(reason: unknown): string {
  return reason instanceof Error ? reason.message : "L’import a échoué. Réessayez.";
}
