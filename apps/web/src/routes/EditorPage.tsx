import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnits } from "@/hooks/useUnits";
import { exportProject } from "@/api";
import type { DraftUnit } from "@auto-essay/core";

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { units, loading, error, add, update, generate, reviseChat } = useUnits(projectId);
  const [selectedUnit, setSelectedUnit] = useState<DraftUnit | null>(null);
  const [newSection, setNewSection] = useState("");

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!newSection.trim()) return;
    const unit = await add(newSection);
    if (unit) {
      setNewSection("");
      setSelectedUnit(unit);
    }
  }

  async function handleExport() {
    if (!projectId) return;
    const { markdown } = await exportProject(projectId);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell projectId={projectId}>
      <div className="flex h-[calc(100vh-6rem)] gap-4">
        <div className="w-1/3 space-y-4 overflow-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Éditeur</h1>
            <Button variant="outline" size="sm" onClick={handleExport}>
              Exporter
            </Button>
          </div>

          <form onSubmit={handleAddUnit} className="flex gap-2">
            <Input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="Nouvelle section"
            />
            <Button type="submit" size="sm">+</Button>
          </form>

          {loading && <p>Chargement…</p>}
          {error && <p className="text-destructive">{error.message}</p>}

          <div className="space-y-2">
            {units.map((unit) => (
              <button
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
                className={`
                  w-full rounded-md border p-3 text-left text-sm transition-colors
                  ${selectedUnit?.id === unit.id ? "border-primary bg-primary/5" : "hover:bg-accent"}
                `}
              >
                <div className="font-medium">{unit.thesis || unit.contextInPlan?.section || "Sans titre"}</div>
                <div className="text-xs text-muted-foreground">
                  {unit.status} — v{unit.version}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 gap-4">
          {selectedUnit ? (
            <>
              <UnitEditor
                unit={selectedUnit}
                onChange={(content) => update(selectedUnit.id, { content })}
                onGenerate={() => generate(selectedUnit.id).then((u) => u && setSelectedUnit(u))}
              />
              <ChatPanel
                projectId={projectId!}
                unit={selectedUnit}
                onRevise={(unit) => setSelectedUnit(unit)}
                onReviseChat={reviseChat}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Sélectionne une unité pour l'éditer.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function UnitEditor({
  unit,
  onChange,
  onGenerate,
}: {
  unit: DraftUnit;
  onChange: (content: string) => void;
  onGenerate: () => void;
}) {
  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{unit.thesis || unit.contextInPlan?.section}</CardTitle>
        <Button size="sm" onClick={onGenerate}>Générer</Button>
      </CardHeader>
      <CardContent className="flex-1">
        <Textarea
          value={unit.content}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-h-[400px] resize-none font-mono text-sm"
        />
      </CardContent>
    </Card>
  );
}

function ChatPanel({
  projectId,
  unit,
  onRevise,
  onReviseChat,
}: {
  projectId: string;
  unit: DraftUnit;
  onRevise: (unit: DraftUnit) => void;
  onReviseChat: (unitId: string, instruction: string) => Promise<{
    before: string; after: string; unit: DraftUnit
  } | undefined>;
}) {
  const [instruction, setInstruction] = useState("");
  const [after, setAfter] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      const result = await onReviseChat(unit.id, instruction);
      if (result) {
        setAfter(result.after);
        onRevise(result.unit);
      }
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    await onReviseChat(unit.id, "Applique la révision.");
    setAfter("");
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="text-base">Chat de révision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Instruction de révision…"
            rows={3}
          />
          <Button type="submit" size="sm" disabled={busy} className="w-full">
            {busy ? "Révision…" : "Réviser"}
          </Button>
        </form>

        {after && (
          <div className="space-y-2 rounded bg-muted p-2 text-sm">
            <p className="font-medium">Résultat :</p>
            <p className="max-h-48 overflow-auto whitespace-pre-wrap">{after}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={accept}>Accepter</Button>
              <Button size="sm" variant="ghost" onClick={() => setAfter("")}>Rejeter</Button>
            </div>
          </div>
        )}

        <Link
          to={`/projects/${projectId}/evaluate/${unit.id}`}
          className="inline-block text-sm text-primary underline"
        >
          Évaluer cette unité
        </Link>
      </CardContent>
    </Card>
  );
}
