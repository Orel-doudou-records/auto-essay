import { Link, Navigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/hooks/useUnits";

export function ProjectEntryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { units, loading, error, reload } = useUnits(projectId);

  if (loading) return <AppShell projectId={projectId}>Chargement du manuscrit…</AppShell>;
  if (error) {
    return (
      <AppShell projectId={projectId}>
        <p role="alert">
          Impossible d’ouvrir le manuscrit. <Button type="button" variant="link" onClick={() => void reload()}>Réessayer</Button>
        </p>
      </AppShell>
    );
  }

  const lastUnit = units.reduce<typeof units[number] | undefined>(
    (latest, unit) => (!latest || unit.updatedAt > latest.updatedAt ? unit : latest),
    undefined
  );
  if (lastUnit) return <Navigate to={`/projects/${projectId}/editor?unitId=${lastUnit.id}`} replace />;

  return (
    <AppShell projectId={projectId}>
      <section aria-label="Commencer le manuscrit">
        <h1>Comment voulez-vous commencer ?</h1>
        <p>Vous pouvez reprendre un texte existant ou ouvrir une première section vide.</p>
        <div>
          <Card>
            <CardHeader><CardTitle>Importer un manuscrit</CardTitle></CardHeader>
            <CardContent>
              <p>Préparez puis corrigez un aperçu Markdown avant toute création.</p>
              <Link to={`/projects/${projectId}/import`}>Importer un manuscrit</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Créer la première section</CardTitle></CardHeader>
            <CardContent>
              <p>Donnez un titre à votre première section, puis écrivez.</p>
              <Link to={`/projects/${projectId}/editor?new=1`}>Créer la première section</Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
