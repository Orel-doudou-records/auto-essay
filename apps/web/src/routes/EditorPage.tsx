import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const { units, loading, error, add, update, generate, reviseChat } = useUnits(projectId);
  const [selectedUnit, setSelectedUnit] = useState<DraftUnit | null>(null);
  const requestedUnitId = searchParams.get("unitId");

  useEffect(() => {
    if (!requestedUnitId) return;
    const requestedUnit = units.find((unit) => unit.id === requestedUnitId);
    if (requestedUnit) setSelectedUnit(requestedUnit);
  }, [requestedUnitId, units]);
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
      <div>
        <div>
          <div>
            <h1>Éditeur</h1>
            <Button variant="outline" size="sm" onClick={handleExport}>
              Exporter
            </Button>
          </div>

          <form onSubmit={handleAddUnit}>
            <Input
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              placeholder="Nouvelle section"
            />
            <Button type="submit" size="sm">+</Button>
          </form>

          {loading && <p>Chargement…</p>}
          {error && <p>{error.message}</p>}

          <div>
            {units.map((unit) => (
              <button
                key={unit.id}
                onClick={() => setSelectedUnit(unit)}
              >
                <div>{unit.thesis || unit.contextInPlan?.section || "Sans titre"}</div>
                <div>
                  {unit.status} — v{unit.version}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
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
            <div>
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
    <Card>
      <CardHeader>
        <CardTitle>{unit.thesis || unit.contextInPlan?.section}</CardTitle>
        <Button size="sm" onClick={onGenerate}>Générer</Button>
      </CardHeader>
      <CardContent>
        <Textarea
          value={unit.content}
          onChange={(e) => onChange(e.target.value)}
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
    <Card>
      <CardHeader>
        <CardTitle>Chat de révision</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Instruction de révision…"
            rows={3}
          />
          <Button type="submit" size="sm" disabled={busy} fullWidth>
            {busy ? "Révision…" : "Réviser"}
          </Button>
        </form>

        {after && (
          <div>
            <p>Résultat :</p>
            <p>{after}</p>
            <div>
              <Button size="sm" variant="outline" onClick={accept}>Accepter</Button>
              <Button size="sm" variant="ghost" onClick={() => setAfter("")}>Rejeter</Button>
            </div>
          </div>
        )}

        <Link
          to={`/projects/${projectId}/evaluate/${unit.id}`}
        >
          Évaluer cette unité
        </Link>
      </CardContent>
    </Card>
  );
}
