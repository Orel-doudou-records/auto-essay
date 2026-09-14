import { Link, Navigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/hooks/useUnits";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { useSources } from "@/hooks/useSources";

export function ProjectEntryPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { units, loading, error, reload } = useUnits(projectId);
  const { entries, loading: navigationLoading } = useManuscriptNavigation(projectId);
  const {
    sources,
    loading: sourcesLoading,
    error: sourcesError,
    reload: reloadSources,
  } = useSources(projectId);

  if (loading || navigationLoading || sourcesLoading) {
    return <AppShell projectId={projectId}>Chargement du projet…</AppShell>;
  }
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
  const firstChapter = entries.find((entry) => entry.kind === "node");
  const hasManuscript = Boolean(lastUnit);
  const hasPlan = Boolean(firstChapter);
  const hasSources = sources.length > 0;
  const activeMatterCount = Number(hasManuscript) + Number(hasPlan) + Number(hasSources);

  if (!sourcesError && activeMatterCount === 1) {
    if (lastUnit) {
      return <Navigate to={`/projects/${projectId}/editor?unitId=${lastUnit.id}`} replace />;
    }
    if (firstChapter) {
      return <Navigate to={`/projects/${projectId}/chapitre?chapterId=${firstChapter.id}`} replace />;
    }
    if (hasSources) {
      return <Navigate to={`/projects/${projectId}/sources`} replace />;
    }
  }

  const isEmpty = activeMatterCount === 0;

  return (
    <AppShell projectId={projectId}>
      <section aria-label={isEmpty ? "Commencer le projet" : "État du projet"}>
        <h1>{isEmpty ? "Comment voulez-vous commencer ?" : "Reprendre votre essai"}</h1>
        <p>
          {isEmpty
            ? "Manuscrit, plan et bibliographie peuvent être commencés dans l’ordre qui correspond à votre travail."
            : "Manuscrit, plan et bibliographie restent indépendants : reprenez ou enrichissez chaque matière selon vos besoins."}
        </p>

        {sourcesError && (
          <p role="alert">
            Impossible de vérifier la bibliographie. <Button type="button" variant="link" onClick={() => void reloadSources()}>Réessayer</Button>
          </p>
        )}

        <div>
          <Card>
            <CardHeader><CardTitle>Manuscrit</CardTitle></CardHeader>
            <CardContent>
              {lastUnit ? (
                <>
                  <p>Un texte est déjà en cours. Vous pouvez reprendre la dernière section travaillée ou comparer un nouveau fichier.</p>
                  <Link to={`/projects/${projectId}/editor?unitId=${lastUnit.id}`}>Reprendre le manuscrit</Link>
                  {" · "}
                  <Link to={`/projects/${projectId}/reimport`}>Comparer un nouveau fichier</Link>
                </>
              ) : (
                <>
                  <p>Importez un texte existant ou créez une première section sans attendre que le plan soit complet.</p>
                  <Link to={`/projects/${projectId}/import`}>Importer un manuscrit</Link>
                  {" · "}
                  <Link to={`/projects/${projectId}/editor?new=1`}>Créer la première section</Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
            <CardContent>
              {firstChapter ? (
                <>
                  <p>Une structure existe déjà. Vous pouvez travailler ce chapitre même si d’autres parties du livre restent provisoires.</p>
                  <Link to={`/projects/${projectId}/chapitre?chapterId=${firstChapter.id}`}>Reprendre le plan</Link>
                  {" · "}
                  <Link to={`/projects/${projectId}/plan-import`}>Importer un plan</Link>
                </>
              ) : (
                <>
                  <p>Importez une structure sans créer artificiellement de texte rédigé.</p>
                  <Link to={`/projects/${projectId}/plan-import`}>Importer un plan</Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Bibliographie</CardTitle></CardHeader>
            <CardContent>
              <p>
                {hasSources
                  ? `${sources.length} source${sources.length > 1 ? "s" : ""} enregistrée${sources.length > 1 ? "s" : ""}. Vous pouvez les compléter indépendamment du manuscrit et du plan.`
                  : "Ajoutez des sources dès maintenant ou plus tard, sans bloquer le manuscrit ni le plan."}
              </p>
              <Link to={`/projects/${projectId}/sources`}>{hasSources ? "Reprendre les sources" : "Ajouter des sources"}</Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
