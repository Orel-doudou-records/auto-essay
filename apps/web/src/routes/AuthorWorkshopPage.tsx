import { useState } from "react";
import { useParams } from "react-router-dom";
import type { DiffractiveReading } from "@auto-essay/core";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchEditorialSectionContext,
  runEditorialSectionReading,
  type EditorialSectionContextPayload,
} from "@/api";

const VERDICT_LABELS: Record<string, string> = {
  integrate_now: "Intégrer maintenant",
  adapt_differently: "Adapter la coupe",
  incubate: "Incuber",
  archive: "Archiver (trace)",
  discard: "Écarter",
};

const VERDICT_STYLES: Record<string, string> = {
  integrate_now: "bg-emerald-100 text-emerald-900",
  adapt_differently: "bg-amber-100 text-amber-900",
  incubate: "bg-sky-100 text-sky-900",
  archive: "bg-slate-200 text-slate-800",
  discard: "bg-rose-100 text-rose-900",
};

function WorkshopCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export function AuthorWorkshopPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sectionId, setSectionId] = useState("");
  const [context, setContext] = useState<EditorialSectionContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [reading, setReading] = useState<DiffractiveReading | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);

  async function loadContext() {
    const scope = sectionId.trim();
    if (!projectId || !scope || contextLoading) return;
    setContextLoading(true);
    setContextError(null);
    setContext(null);
    setReading(null);
    try {
      setContext(await fetchEditorialSectionContext(projectId, scope));
    } catch (error) {
      setContextError(error instanceof Error ? error.message : String(error));
    } finally {
      setContextLoading(false);
    }
  }

  async function runReading() {
    if (!projectId || !context || !statement.trim() || readingLoading) return;
    setReadingLoading(true);
    setReadingError(null);
    setReading(null);
    try {
      const result = await runEditorialSectionReading(projectId, context.section.id, {
        statement: statement.trim(),
      });
      setReading(result.reading);
    } catch (error) {
      setReadingError(error instanceof Error ? error.message : String(error));
    } finally {
      setReadingLoading(false);
    }
  }

  return (
    <AppShell projectId={projectId}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Atelier de décision auteur</p>
          <h1 className="text-2xl font-bold">Lecture située sur un projet réel</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            La lecture décrit une proposition et ses conséquences. Elle ne modifie pas le manuscrit et
            ne déclenche aucune rédaction avant une décision explicite de l’auteur.
          </p>
        </div>

        <WorkshopCard title="Portée de travail">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-2">
              <Label htmlFor="sectionId">ID de section</Label>
              <Input
                id="sectionId"
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
                placeholder="chapitre-2-section-1"
              />
            </div>
            <Button onClick={() => void loadContext()} disabled={contextLoading || !sectionId.trim()}>
              {contextLoading ? "Chargement…" : "Charger l’atelier"}
            </Button>
          </div>
          {contextError && <p className="mt-3 text-sm text-rose-600">Contexte indisponible : {contextError}</p>}
        </WorkshopCard>

        {context && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">{context.section.title}</h2>
                <p className="text-sm text-muted-foreground">Scope : {context.section.id}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {context.decisions.length} décision{context.decisions.length > 1 ? "s" : ""} active
                {context.decisions.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <WorkshopCard title="État du livre">
                {context.bookParts.length === 0 ? (
                  <p className="text-muted-foreground">Aucune partie projetée pour ce manuscrit.</p>
                ) : (
                  <ul className="space-y-2">
                    {context.bookParts.map((part) => (
                      <li key={part.id} className="flex justify-between gap-3 rounded bg-muted/60 px-3 py-2">
                        <span>{part.title}</span>
                        <span className="text-xs text-muted-foreground">{part.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkshopCard>

              <WorkshopCard title="Coupes déjà édictées">
                {context.existingCuts.length === 0 ? (
                  <p className="text-muted-foreground">Aucune coupe active dans cette portée.</p>
                ) : (
                  <ul className="space-y-2">
                    {context.existingCuts.map((cut) => (
                      <li key={`${cut.scope}-${cut.cut}`} className="rounded bg-muted/60 px-3 py-2">
                        <p className="font-medium">{cut.scope} — {cut.verdict}</p>
                        <p className="text-muted-foreground">{cut.cut}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkshopCard>
            </div>

            <WorkshopCard title="Sources de la section">
              {context.sources.length === 0 ? (
                <p className="text-muted-foreground">Aucune source distribuée dans cette portée.</p>
              ) : (
                <ul className="space-y-2">
                  {context.sources.map((source) => (
                    <li key={source.sourceId} className="rounded bg-muted/60 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{source.title}</span>
                        <span className={source.qualified ? "text-emerald-700" : "text-amber-700"}>
                          {source.qualified ? "Qualifiée" : "Non qualifiée"}
                        </span>
                      </div>
                      {source.authors.length > 0 && <p className="text-muted-foreground">{source.authors.join(", ")}</p>}
                      {!source.qualified && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Piste visible, mais non disponible comme preuve automatique.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </WorkshopCard>

            <WorkshopCard title="Fragment à diffracter">
              <div className="space-y-3">
                <Textarea
                  id="statement"
                  aria-label="Fragment à lire"
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                  placeholder="Posez un fragment dans la section sélectionnée…"
                  rows={4}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void runReading()} disabled={readingLoading || !statement.trim()}>
                    {readingLoading ? "Lecture en cours…" : "Lire le fragment"}
                  </Button>
                  {readingError && <p className="text-sm text-rose-600">Lecture indisponible : {readingError}</p>}
                </div>
              </div>
            </WorkshopCard>

            {reading && <ReadingResult reading={reading} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ReadingResult({ reading }: { reading: DiffractiveReading }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${VERDICT_STYLES[reading.verdict] ?? "bg-slate-100 text-slate-800"}`}>
          {VERDICT_LABELS[reading.verdict] ?? reading.verdict}
        </span>
        <span className="text-sm text-muted-foreground">{reading.verdictDetail}</span>
        <span className="rounded border border-dashed px-2 py-1 text-xs text-muted-foreground">Proposition non exécutable</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WorkshopCard title="Pass 1 — le fragment à travers le livre">
          {reading.pass1.refraction.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4">
              {reading.pass1.refraction.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="text-muted-foreground">Aucune réfraction supplémentaire.</p>}
        </WorkshopCard>
        <WorkshopCard title="Pass 4 — la coupe agentielle">
          <p className="font-medium">{reading.pass4.cut}</p>
          <p className="mt-2 text-muted-foreground">{reading.action}</p>
        </WorkshopCard>
      </div>

      {(reading.planImpacts.length > 0 || reading.bibliographyImpacts.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {reading.planImpacts.length > 0 && (
            <WorkshopCard title="Impacts sur le plan">
              <ul className="list-disc space-y-1 pl-4">
                {reading.planImpacts.map((impact) => <li key={`${impact.partId}-${impact.entryId ?? impact.impact}`}>{impact.impact}</li>)}
              </ul>
            </WorkshopCard>
          )}
          {reading.bibliographyImpacts.length > 0 && (
            <WorkshopCard title="Impacts bibliographiques">
              <ul className="list-disc space-y-1 pl-4">
                {reading.bibliographyImpacts.map((impact) => <li key={`${impact.sourceId}-${impact.scopeId}`}>{impact.kind} — {impact.impact}</li>)}
              </ul>
            </WorkshopCard>
          )}
        </div>
      )}

      <WorkshopCard title="Acte auteur">
        <p className="mb-3 text-muted-foreground">
          La décision est réservée à P1.4. Cette lecture reste consultable et ne produit aucune coupe active tant que l’auteur n’agit pas explicitement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled>Valider (P1.4)</Button>
          <Button disabled variant="outline">Adapter (P1.4)</Button>
          <Button disabled variant="outline">Refuser (P1.4)</Button>
        </div>
      </WorkshopCard>
    </div>
  );
}
