import { useState } from "react";
import { Link } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
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
import { workshopStyles } from "../styles/workshopStyles";

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
      <div {...stylex.props(workshopStyles.page)}>
        <header {...stylex.props(workshopStyles.intro)}>
          <p {...stylex.props(workshopStyles.eyebrow)}>Auto Essay</p>
          <h1 {...stylex.props(workshopStyles.title)}>Projets</h1>
          <p {...stylex.props(workshopStyles.copy)}>Choisissez un essai existant ou ouvrez un nouveau chantier d’écriture.</p>
        </header>

        <form {...stylex.props(workshopStyles.formRow)} onSubmit={handleSubmit}>
          <div {...stylex.props(workshopStyles.field)}>
            <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du nouvel essai"
            />
          </div>
          <Button type="submit">Nouveau</Button>
        </form>

        {loading && <p>Chargement…</p>}
        {error && (
          <div {...stylex.props(workshopStyles.alert)}>
            {error.message}
            <Button variant="ghost" size="sm" onClick={reload}>Réessayer</Button>
          </div>
        )}

        {projects.length === 0 && !loading && !error ? <p {...stylex.props(workshopStyles.copy)}>Aucun projet pour le moment.</p> : null}
        <div {...stylex.props(workshopStyles.grid)}>
          {projects.map((project) => (
              <Card key={project.id}>
              <CardHeader>
                <CardTitle>
                  <Link
                    to={`/projects/${project.id}`}
                  >
                    {project.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  Mis à jour : {new Date(project.updatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div {...stylex.props(workshopStyles.actionRow)}>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
