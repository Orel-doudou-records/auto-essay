import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSources } from "@/hooks/useSources";

export function SourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { sources, loading, error, importFiles, update, remove } = useSources(projectId);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const arr = Array.from(files).filter(
        (f) => f.name.endsWith(".md") || f.name.endsWith(".bib")
      );
      const contents = await Promise.all(
        arr.map(async (f) => ({
          name: f.name,
          content: await f.text(),
        }))
      );
      await importFiles(contents);
    },
    [importFiles]
  );

  return (
    <AppShell projectId={projectId}>
      <div>
        <h1>Sources</h1>

        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <p>
            Glisse-dépose des fichiers .md ou .bib ici, ou{" "}
            <label>
              parcours
              <input
                type="file"
                accept=".md,.bib"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </p>
        </div>

        {loading && <p>Chargement…</p>}
        {error && <p>{error.message}</p>}

        <div>
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              onUpdate={(patch) => update(source.id, patch)}
              onDelete={() => remove(source.id)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function SourceCard({
  source,
  onUpdate,
  onDelete,
}: {
  source: import("@auto-essay/core").Source;
  onUpdate: (patch: Partial<Omit<import("@auto-essay/core").Source, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{source.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <div>
            <span>Régime : </span>
            {source.regime}
          </div>
          <div>
            <span>Position : </span>
            {typeof source.position === "string" ? source.position : source.position?.perspective}
          </div>
        </div>
        <div>
          <Label>Limites épistémiques</Label>
          <Textarea
            value={source.epistemicLimits?.join("\n") ?? ""}
            onChange={(e) =>
              onUpdate({
                epistemicLimits: e.target.value.split("\n").filter(Boolean),
              })
            }
            rows={3}
          />
        </div>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          Supprimer
        </Button>
      </CardContent>
    </Card>
  );
}
