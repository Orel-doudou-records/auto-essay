import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProject } from "@/hooks/useProject";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loading, error, update } = useProject(projectId);
  const [title, setTitle] = useState("");
  const [thesisSeed, setThesisSeed] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setThesisSeed(project.thesisSeed ?? "");
    }
  }, [project]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await update({ title, thesisSeed });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  if (loading) return <AppShell projectId={projectId}>Chargement…</AppShell>;
  if (error)
    return (
      <AppShell projectId={projectId}>
        Erreur : {error.message}
      </AppShell>
    );

  return (
    <AppShell projectId={projectId}>
      <div>
        <h1>Cadrage</h1>
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>Métadonnées</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setSaveStatus("idle");
                  }}
                />
              </div>
              <div>
                <Label htmlFor="thesisSeed">Thèse (amorce)</Label>
                <Textarea
                  id="thesisSeed"
                  value={thesisSeed}
                  onChange={(e) => {
                    setThesisSeed(e.target.value);
                    setSaveStatus("idle");
                  }}
                  rows={4}
                />
              </div>
              <Button type="submit" disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <p aria-live="polite" role={saveStatus === "error" ? "alert" : undefined}>
                {saveStatus === "saved"
                  ? "Cadrage enregistré."
                  : saveStatus === "error"
                    ? "L’enregistrement a échoué. Réessayez."
                    : ""}
              </p>
            </CardContent>
          </Card>
        </form>

        <Card>
          <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
          <CardContent>
            <p>À partir de votre amorce de thèse, obtenez une proposition à corriger avant toute création dans le manuscrit.</p>
            <Link to={`/projects/${projectId}/plan-import?from=cadrage`}>Proposer un plan</Link>
          </CardContent>
        </Card>

        {project?.argumentMap && (
          <Card>
            <CardHeader>
              <CardTitle>Carte argumentative</CardTitle>
            </CardHeader>
            <CardContent>
              <pre>
                {JSON.stringify(project.argumentMap, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
