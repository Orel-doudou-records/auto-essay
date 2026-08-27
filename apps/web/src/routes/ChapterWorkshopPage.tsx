import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { themeVars } from "../styles/tokens.stylex";
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
      <div>
        <header>
          <h1>Atelier de chapitre</h1>
          <p>
            Consultez l’état éditorial du chapitre, puis choisissez explicitement la section ou l’unité à poursuivre.
          </p>
        </header>

        <Card>
          <CardContent>
            <div>
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
          <section aria-label="État du chapitre">
            <div>
              <h1>{workspace.chapter.title}</h1>
              <p>
                Statut de rédaction : {workspace.chapter.writingStatus}
              </p>
            </div>

            <ChapterOperationPanel projectId={projectId ?? ""} chapterId={workspace.chapter.id} />

            {workspace.sections.length === 0 ? (
              <Card>
                <CardContent>
                  Ce chapitre ne contient encore aucune section.
                </CardContent>
              </Card>
            ) : (
              <ol>
                {workspace.sections.map((section) => (
                  <li key={section.id}>
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

                        <div>
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

                        <div>
                          <Link
                            {...stylex.props(styles.actionLink)}
                            to={section.transitions.workshop.href}
                          >
                            Ouvrir l’atelier de section
                          </Link>
                          {section.transitions.preparedUnits.map((unit) => (
                            <Link
                              {...stylex.props(styles.actionLink)}
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

const styles = stylex.create({
  actionLink: {
    backgroundColor: {
      default: "transparent",
      ':hover': themeVars.accentMuted,
    },
    borderColor: themeVars.border,
    borderRadius: themeVars.radiusSmall,
    borderStyle: "solid",
    borderWidth: "1px",
    color: themeVars.textPrimary,
    fontSize: "0.875rem",
    fontWeight: 600,
    padding: "0.625rem 0.875rem",
    textDecoration: "none",
  },
});
