import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { workshopStyles } from "../styles/workshopStyles";
import { fetchChapterEditorialWorkspace, type ChapterEditorialWorkspacePayload } from "@/api";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChapterOperationPanel } from "@/components/editorial/ChapterOperationPanel";

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
      <div {...stylex.props(workshopStyles.page)}>
        <header {...stylex.props(workshopStyles.intro)}>
          <p {...stylex.props(workshopStyles.eyebrow)}>Manuscrit</p>
          <h1 {...stylex.props(workshopStyles.title)}>Atelier de chapitre</h1>
          <p {...stylex.props(workshopStyles.copy)}>
            Consultez l’état éditorial du chapitre, puis choisissez explicitement la section ou l’unité à poursuivre.
          </p>
        </header>

        <div {...stylex.props(workshopStyles.cardFrame)}>
          <Card>
            <CardContent>
              <div {...stylex.props(workshopStyles.formRow)}>
                <div {...stylex.props(workshopStyles.field)}>
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
              </div>
            </CardContent>
          </Card>
        </div>

        {error && <p role="alert" {...stylex.props(workshopStyles.alert)}>Erreur : {error}</p>}

        {workspace && (
          <section {...stylex.props(workshopStyles.stack)} aria-label="État du chapitre">
            <header {...stylex.props(workshopStyles.sectionHeader)}>
              <div {...stylex.props(workshopStyles.compactStack)}>
                <p {...stylex.props(workshopStyles.eyebrow)}>Chapitre</p>
                <h2 {...stylex.props(workshopStyles.sectionTitle)}>{workspace.chapter.title}</h2>
              </div>
              <p {...stylex.props(workshopStyles.status)}>
                Statut de rédaction : {workspace.chapter.writingStatus}
              </p>
            </header>

            <ChapterOperationPanel projectId={projectId ?? ""} chapterId={workspace.chapter.id} />

            {workspace.sections.length === 0 ? (
              <Card>
                <CardContent>
                  Ce chapitre ne contient encore aucune section.
                </CardContent>
              </Card>
            ) : (
              <ol {...stylex.props(workshopStyles.list)}>
                {workspace.sections.map((section) => (
                  <li key={section.id} {...stylex.props(workshopStyles.listItem)}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {section.order}. {section.title}
                        </CardTitle>
                        <p>
                          Statut de rédaction : {section.writingStatus}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <p>
                          {section.decisions.length === 0
                            ? "Aucune décision active : préparation non disponible."
                            : `${section.decisions.length} décision${section.decisions.length > 1 ? "s" : ""} active${section.decisions.length > 1 ? "s" : ""}`}
                        </p>

                        <div {...stylex.props(workshopStyles.compactStack)}>
                          <h3>Sources distribuées</h3>
                          {section.sources.length === 0 ? (
                            <p>Aucune source distribuée.</p>
                          ) : (
                            <ul>
                              {section.sources.map((source) => (
                                <li key={source.sourceId}>
                                  <span>{source.title}</span>{" "}
                                  — {source.availability === "evidence_pack" ? "Preuve qualifiée" : "Visible, non retenue"}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div {...stylex.props(workshopStyles.actionRow)}>
                          <Link
                            {...stylex.props(workshopStyles.actionLink)}
                            to={section.transitions.workshop.href}
                          >
                            Ouvrir l’atelier de section
                          </Link>
                          {section.transitions.preparedUnits.map((unit) => (
                            <Link
                              {...stylex.props(workshopStyles.actionLink)}
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
