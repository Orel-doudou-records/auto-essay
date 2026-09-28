import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { workshopStyles } from "../styles/workshopStyles";
import {
  fetchChapterEditorialWorkspace,
  type ChapterEditorialWorkspacePayload,
} from "@/api";
import { ProjectWorkspace } from "@/components/workspace/ProjectWorkspace";
import { useManuscriptNavigation } from "@/hooks/useManuscriptNavigation";
import { findScopePath } from "@/components/workspace/ProjectNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ChapterOperationPanel } from "@/components/editorial/ChapterOperationPanel";
import {
  PlanStructureEditor,
  findPlanNode,
} from "@/components/editorial/PlanStructureEditor";
import { PlanV2Panel } from "@/components/editorial/PlanV2Panel";

export function ChapterWorkshopPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useManuscriptNavigation(projectId);
  const targetId = searchParams.get("nodeId") ?? searchParams.get("unitId");
  const requestedChapterId =
    searchParams.get("chapterId") ??
    (targetId
      ? searchParams.has("nodeId")
        ? targetId
        : findScopePath(navigation.entries, targetId).at(-2)?.id
      : undefined);
  const requestSequence = useRef(0);
  const [revision, setRevision] = useState(0);
  const [chapterId, setChapterId] = useState(
    () => searchParams.get("chapterId") ?? "",
  );
  const [workspace, setWorkspace] =
    useState<ChapterEditorialWorkspacePayload>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function loadChapter(selectedChapterId = chapterId) {
    if (!projectId || !selectedChapterId.trim()) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(undefined);
    setWorkspace(undefined);
    try {
      const next = await fetchChapterEditorialWorkspace(
        projectId,
        selectedChapterId.trim(),
      );
      if (sequence === requestSequence.current) setWorkspace(next);
    } catch (reason) {
      if (sequence === requestSequence.current)
        setError(reason instanceof Error ? reason.message : "Erreur inconnue");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    const selectedChapterId = requestedChapterId;
    if (!selectedChapterId) return;
    setChapterId(selectedChapterId);
    void loadChapter(selectedChapterId);
    return () => {
      requestSequence.current += 1;
    };
  }, [requestedChapterId]);

  const planNode =
    workspace && findPlanNode(navigation.entries, workspace.chapter.id);

  async function refreshStructure() {
    await Promise.all([
      loadChapter(workspace?.chapter.id),
      navigation.reload(),
    ]);
    setRevision((value) => value + 1);
  }

  return (
    <ProjectWorkspace
      projectId={projectId ?? ""}
      scope={workspace ? { kind: "node", id: workspace.chapter.id } : null}
      revision={revision}
    >
      <div {...stylex.props(workshopStyles.page)}>
        <header {...stylex.props(workshopStyles.intro)}>
          <p {...stylex.props(workshopStyles.eyebrow)}>Manuscrit</p>
          <h1 {...stylex.props(workshopStyles.title)}>Plan du manuscrit</h1>
          <p {...stylex.props(workshopStyles.copy)}>
            Explorez, précisez et validez la structure avant de poursuivre
            l’écriture. Aucun changement n’est appliqué sans confirmation
            explicite.
          </p>
        </header>

        <div {...stylex.props(workshopStyles.cardFrame)}>
          <Card>
            <CardContent>
              <div {...stylex.props(workshopStyles.formRow)}>
                <div {...stylex.props(workshopStyles.field)}>
                  <Label htmlFor="chapter-id">Chapitre</Label>
                  <select
                    id="chapter-id"
                    value={chapterId}
                    onChange={(event) => setChapterId(event.target.value)}
                  >
                    <option value="">Choisir un chapitre du manuscrit</option>
                    {planNode &&
                      !navigation.entries.some(
                        (entry) =>
                          entry.kind === "node" && entry.id === planNode.id,
                      ) && (
                        <option value={planNode.id}>{planNode.title}</option>
                      )}
                    {navigation.entries
                      .filter((entry) => entry.kind === "node")
                      .map(
                        (entry) =>
                          entry.kind === "node" && (
                            <option key={entry.id} value={entry.id}>
                              {entry.title}
                            </option>
                          ),
                      )}
                  </select>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setSearchParams({ chapterId });
                  }}
                  disabled={!chapterId.trim() || loading}
                >
                  {loading ? "Chargement…" : "Charger le chapitre"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {!chapterId && (
          <p {...stylex.props(workshopStyles.copy)}>
            Sélectionnez un chapitre dans le manuscrit, ou{" "}
            <Link to={`/projects/${projectId}/plan-import`}>
              importez ou générez un plan
            </Link>
            .
          </p>
        )}
        {error && (
          <p role="alert" {...stylex.props(workshopStyles.alert)}>
            Erreur : {error}
          </p>
        )}

        {workspace && (
          <section
            {...stylex.props(workshopStyles.stack)}
            aria-label="État du chapitre"
          >
            <header {...stylex.props(workshopStyles.sectionHeader)}>
              <div {...stylex.props(workshopStyles.compactStack)}>
                <p {...stylex.props(workshopStyles.eyebrow)}>Chapitre</p>
                <h2 {...stylex.props(workshopStyles.sectionTitle)}>
                  {workspace.chapter.title}
                </h2>
              </div>
              <p {...stylex.props(workshopStyles.status)}>
                Statut de rédaction : {workspace.chapter.writingStatus}
              </p>
            </header>

            {planNode && (
              <details>
                <summary>Modifier le plan</summary>
                <PlanStructureEditor
                  key={`${planNode.id}:${revision}`}
                  projectId={projectId ?? ""}
                  node={planNode}
                  onApplied={refreshStructure}
                />
              </details>
            )}
            <details>
              <summary>
                Préparer une restructuration à partir des sources
              </summary>
              <PlanV2Panel
                projectId={projectId ?? ""}
                chapterId={workspace.chapter.id}
                key={workspace.chapter.id}
                onApplied={() => {
                  void loadChapter(workspace.chapter.id);
                  setRevision((value) => value + 1);
                  void navigation.reload();
                }}
                writingHref={workspace.sections[0]?.transitions.workshop.href}
              />
            </details>
            <details>
              <summary>Suivre une opération de chapitre</summary>
              <ChapterOperationPanel
                key={workspace.chapter.id}
                projectId={projectId ?? ""}
                chapterId={workspace.chapter.id}
              />
            </details>

            {workspace.sections.length === 0 ? (
              <Card>
                <CardContent>
                  Ce chapitre ne contient encore aucune section.
                </CardContent>
              </Card>
            ) : (
              <ol {...stylex.props(workshopStyles.list)}>
                {workspace.sections.map((section) => (
                  <li
                    key={section.id}
                    {...stylex.props(workshopStyles.listItem)}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {section.order}. {section.title}
                        </CardTitle>
                        <p>Statut de rédaction : {section.writingStatus}</p>
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
                                  <span>{source.title}</span> —{" "}
                                  {source.availability === "evidence_pack"
                                    ? "Preuve qualifiée"
                                    : "Visible, non retenue"}
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
    </ProjectWorkspace>
  );
}
