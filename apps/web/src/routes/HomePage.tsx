import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

export function HomePage() {
  const { projects, loading, error, reload, add, remove } = useProjects();
  const [title, setTitle] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await add(title);
    setTitle("");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Projets</h1>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du nouvel essai"
          />
          <Button type="submit">Nouveau</Button>
        </form>

        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {error && (
          <div className="text-sm text-destructive">
            {error.message}
            <Button variant="ghost" size="sm" onClick={reload}>Réessayer</Button>
          </div>
        )}

        <div className="space-y-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  <Link
                    to={`/projects/${project.id}`}
                    className="hover:underline"
                  >
                    {project.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  Mis à jour : {new Date(project.updatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Link to={`/projects/${project.id}/editor`}>
                  <Button variant="outline" size="sm">Éditer</Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(project.id)}
                >
                  Supprimer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
