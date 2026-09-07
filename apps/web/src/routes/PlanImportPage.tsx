import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { ManuscriptImportPreview, ManuscriptImportSection } from "@auto-essay/core";
import { confirmPlanImport, previewPlanImport, proposePlan } from "@/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_PLAN_BYTES = 5_000_000;

export function PlanImportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const fromFraming = searchParams.get("from") === "cadrage";
  const proposalRequestedFor = useRef<string>();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ManuscriptImportPreview>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "confirming" | "done" | "discarded">("idle");
  const [error, setError] = useState<string>();
  const [firstNodeId, setFirstNodeId] = useState<string>();
  const isValidPreview = Boolean(preview?.title.trim() && preview.sections.every((section) => section.title.trim()));

  useEffect(() => {
    if (!fromFraming || !projectId || proposalRequestedFor.current === projectId) return;
    proposalRequestedFor.current = projectId;
    setPreview(undefined);
    setWarnings([]);
    setError(undefined);
    setStatus("loading");
    void proposePlan(projectId)
      .then((result) => {
        setPreview(result.preview);
        setWarnings(result.warnings);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "La proposition ne peut pas être préparée."))
      .finally(() => setStatus("idle"));
  }, [fromFraming, projectId]);

  async function preparePreview(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !file) return;
    if (file.size > MAX_PLAN_BYTES) {
      setError("Le fichier dépasse la taille maximale de 5 Mo.");
      return;
    }
    setError(undefined);
    setStatus("loading");
    try {
      const content = /\.(docx|odt)$/i.test(file.name) ? await file.arrayBuffer() : await file.text();
      const result = await previewPlanImport(projectId, file.name, content);
      setPreview(result.preview);
      setWarnings(result.warnings);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le plan ne peut pas être lu.");
    } finally {
      setStatus("idle");
    }
  }

  function updatePreview(mutator: (current: ManuscriptImportPreview) => ManuscriptImportPreview) {
    setPreview((current) => (current ? mutator(current) : current));
  }

  function updateSection(index: number, patch: Partial<ManuscriptImportSection>) {
    updatePreview((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    }));
  }

  function addSection() {
    updatePreview((current) => ({
      ...current,
      sections: [...current.sections, { id: crypto.randomUUID(), title: "Nouvelle section", content: "", level: 1, annotations: [] }],
    }));
  }

  function removeSection(index: number) {
    updatePreview((current) => ({ ...current, sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index) }));
  }

  function cancelPreview() {
    setPreview(undefined);
    setWarnings([]);
    setError(undefined);
    if (fromFraming) setStatus("discarded");
  }

  async function confirmPlan() {
    if (!projectId || !preview || !isValidPreview) return;
    setError(undefined);
    setStatus("confirming");
    try {
      const result = await confirmPlanImport(projectId, preview);
      setFirstNodeId(result.manuscript.tree[0]?.id);
      setStatus("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le plan ne peut pas être enregistré.");
      setStatus("idle");
    }
  }

  return (
    <AppShell projectId={projectId}>
      <section>
        <h1>{fromFraming ? "Proposer un plan" : "Importer un plan"}</h1>
        <p>Le plan reste un aperçu modifiable jusqu’à votre confirmation. Aucun texte rédigé ne sera créé.</p>
        {status === "discarded" ? (
          <Card><CardHeader><CardTitle>Proposition écartée</CardTitle></CardHeader><CardContent><Link to={`/projects/${projectId}/cadrage`}>Retour au cadrage</Link></CardContent></Card>
        ) : !preview && status !== "done" && !fromFraming && (
          <form onSubmit={preparePreview}>
            <Label htmlFor="plan-file">Fichier Markdown, Word ou LibreOffice</Label>
            <Input
              id="plan-file"
              type="file"
              accept=".md,.docx,.odt,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text"
              onChange={(event) => { setFile(event.target.files?.[0]); setError(undefined); }}
            />
            <Button type="submit" disabled={!file || status === "loading"}>
              {status === "loading" ? "Préparation…" : "Préparer l’aperçu"}
            </Button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        {fromFraming && error && !preview && <Link to={`/projects/${projectId}/cadrage`}>Retour au cadrage</Link>}
        {fromFraming && status === "loading" && <p>Préparation de la proposition…</p>}
        {preview && (
          <section aria-label="Aperçu du plan" aria-busy={status === "confirming"}>
            {status === "done" ? (
              <Card>
                <CardHeader><CardTitle>Plan enregistré</CardTitle></CardHeader>
                <CardContent>
                  {firstNodeId && <Link to={`/projects/${projectId}/chapitre?chapterId=${firstNodeId}`}>Ouvrir le plan</Link>}
                </CardContent>
              </Card>
            ) : (
              <>
                <h2>Aperçu à corriger</h2>
                {warnings.length > 0 && <ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
                <Label htmlFor="plan-title">Titre du plan</Label>
                <Input id="plan-title" value={preview.title} onChange={(event) => updatePreview((current) => ({ ...current, title: event.target.value }))} />
                {preview.sections.map((section, index) => (
                  <Card key={section.id}>
                    <CardHeader><CardTitle>{section.level === 1 ? "Partie" : section.level === 2 ? "Chapitre" : "Section"} {index + 1}</CardTitle></CardHeader>
                    <CardContent>
                      <Label htmlFor={`plan-section-title-${section.id}`}>Titre</Label>
                      <Input id={`plan-section-title-${section.id}`} value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} />
                      <Label htmlFor={`plan-section-level-${section.id}`}>Niveau</Label>
                      <select
                        id={`plan-section-level-${section.id}`}
                        value={section.level}
                        onChange={(event) => updateSection(index, { level: Number(event.target.value) })}
                      >
                        <option value={1}>Partie</option>
                        <option value={2}>Chapitre</option>
                        <option value={3}>Section</option>
                      </select>
                      <Label htmlFor={`plan-section-content-${section.id}`}>Entrée de plan</Label>
                      <Textarea id={`plan-section-content-${section.id}`} value={section.content} onChange={(event) => updateSection(index, { content: event.target.value })} rows={4} />
                      <Button type="button" variant="ghost" disabled={preview.sections.length === 1} onClick={() => removeSection(index)}>
                        Retirer cette partie, ce chapitre ou cette section
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Button type="button" variant="outline" onClick={addSection}>Ajouter une section</Button>
                <Button type="button" variant="ghost" onClick={cancelPreview}>{fromFraming ? "Écarter la proposition" : "Annuler l’aperçu"}</Button>
                {!isValidPreview && <p role="alert">Donnez un titre au plan et à chaque partie, chapitre ou section avant de confirmer.</p>}
                <Button type="button" onClick={() => void confirmPlan()} disabled={!isValidPreview || status === "confirming"}>
                  {status === "confirming" ? "Enregistrement…" : "Confirmer le plan"}
                </Button>
              </>
            )}
          </section>
        )}
      </section>
    </AppShell>
  );
}
