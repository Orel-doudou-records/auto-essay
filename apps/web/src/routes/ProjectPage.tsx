import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setThesisSeed(project.thesisSeed ?? "");
    }
  }, [project]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await update({ title, thesisSeed });
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
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Projet</h1>
        <form onSubmit={handleSave} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métadonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thesisSeed">Thèse (amorce)</Label>
                <Textarea
                  id="thesisSeed"
                  value={thesisSeed}
                  onChange={(e) => setThesisSeed(e.target.value)}
                  rows={4}
                />
              </div>
              <Button type="submit">Enregistrer</Button>
            </CardContent>
          </Card>
        </form>

        {project?.argumentMap && (
          <Card>
            <CardHeader>
              <CardTitle>Carte argumentative</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded bg-muted p-3 text-xs">
                {JSON.stringify(project.argumentMap, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
