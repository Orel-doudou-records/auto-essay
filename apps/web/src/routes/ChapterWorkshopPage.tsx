import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchChapterEditorialWorkspace, type ChapterEditorialWorkspacePayload } from "@/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChapterWorkshopPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [chapterId, setChapterId] = useState("");
  const [workspace, setWorkspace] = useState<ChapterEditorialWorkspacePayload>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function loadChapter() {
    if (!projectId || !chapterId.trim()) return;
    setLoading(true);
    setError(undefined);
    setWorkspace(undefined);
    try {
      setWorkspace(await fetchChapterEditorialWorkspace(projectId, chapterId.trim()));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell projectId={projectId}>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Atelier de chapitre</h1>
          <p className="text-sm text-muted-foreground">
            Consultez l’état éditorial du chapitre, puis choisissez explicitement la section ou l’unité à poursuivre.
          </p>
        </header>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-6">
            <div className="min-w-64 flex-1 space-y-2">
              <Label htmlFor="chapter-id">ID du chapitre</Label>
              <Input
                id="chapter-id"
                value={chapterId}
                onChange={(event) => setChapterId(event.target.value)}
                placeholder="chapter-1"
              />
            </div>
            <Button type="button" onClick={loadChapter} disabled={!chapterId.trim() || loading}>
              {loading ? "Chargement…" : "Charger le chapitre"}
            </Button>
          </CardContent>
        </Card>

        {error && <p role="alert">Erreur : {error}</p>}

        {workspace && (
          <section className="space-y-4" aria-label="État du chapitre">
            <div>
              <h1 className="text-xl font-semibold">{workspace.chapter.title}</h1>
              <p className="text-sm text-muted-foreground">
                Statut de rédaction : {workspace.chapter.writingStatus}
              </p>
            </div>

            {workspace.sections.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  Ce chapitre ne contient encore aucune section.
                </CardContent>
              </Card>
            ) : (
              <ol className="space-y-4">
                {workspace.sections.map((section) => (
                  <li key={section.id}>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {section.order}. {section.title}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Statut de rédaction : {section.writingStatus}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p>
                          {section.decisions.length === 0
                            ? "Aucune décision active : préparation non disponible."
                            : `${section.decisions.length} décision${section.decisions.length > 1 ? "s" : ""} active${section.decisions.length > 1 ? "s" : ""}`}
                        </p>

                        <div className="space-y-2">
                          <h3 className="font-medium">Sources distribuées</h3>
                          {section.sources.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Aucune source distribuée.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {section.sources.map((source) => (
                                <li key={source.sourceId}>
                                  <span className="font-medium">{source.title}</span>{" "}
                                  — {source.availability === "evidence_pack" ? "Preuve qualifiée" : "Visible, non retenue"}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Link
                            className={buttonVariants({ variant: "outline" })}
                            to={section.transitions.workshop.href}
                          >
                            Ouvrir l’atelier de section
                          </Link>
                          {section.transitions.preparedUnits.map((unit) => (
                            <Link
                              className={buttonVariants({ variant: "outline" })}
                              key={unit.unitId}
                              to={unit.href}
                            >
                              Ouvrir l’unité préparée
                            </Link>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
