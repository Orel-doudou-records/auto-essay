import { useState, useCallback } from "react";
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
  const [dragOver, setDragOver] = useState(false);

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
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">Sources</h1>

        <div
          className={`
            rounded-lg border-2 border-dashed p-8 text-center transition-colors
            ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
          `}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-muted-foreground">
            Glisse-dépose des fichiers .md ou .bib ici, ou{" "}
            <label className="cursor-pointer text-primary underline">
              parcours
              <input
                type="file"
                accept=".md,.bib"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </p>
        </div>

        {loading && <p>Chargement…</p>}
        {error && <p className="text-destructive">{error.message}</p>}

        <div className="space-y-4">
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
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{source.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Régime : </span>
            {source.regime}
          </div>
          <div>
            <span className="text-muted-foreground">Position : </span>
            {typeof source.position === "string" ? source.position : source.position?.perspective}
          </div>
        </div>
        <div className="space-y-1">
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
