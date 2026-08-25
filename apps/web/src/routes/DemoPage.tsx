import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchDemoContext,
  runDiffractReading,
  type DemoContextPayload,
  type DiffractReadingPayload,
} from "@/api";
import type { DiffractiveReading } from "@auto-essay/core";

const VERDICT_STYLES: Record<string, string> = {
  integrate_now: "bg-emerald-100 text-emerald-900",
  adapt_differently: "bg-amber-100 text-amber-900",
  incubate: "bg-sky-100 text-sky-900",
  archive: "bg-slate-200 text-slate-800",
  discard: "bg-rose-100 text-rose-900",
};

const VERDICT_LABELS: Record<string, string> = {
  integrate_now: "Intégrer maintenant",
  adapt_differently: "Adapter la coupe",
  incubate: "Incuber",
  archive: "Archiver (trace)",
  discard: "Écarter",
};

function PassCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

export function DemoPage() {
  const [demo, setDemo] = useState<DemoContextPayload | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [reading, setReading] = useState<DiffractiveReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoContext()
      .then(setDemo)
      .catch((e: unknown) =>
        setContextError(e instanceof Error ? e.message : String(e))
      );
  }, []);

  async function handleRun(fragment?: string) {
    const text = (fragment ?? statement).trim();
    if (!text || !demo || loading) return;
    setLoading(true);
    setError(null);
    setReading(null);
    try {
      const payload: DiffractReadingPayload = {
        statement: text,
        ...demo.context,
      };
      setReading(await runDiffractReading(payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const bibliographyImpacts = reading?.bibliographyImpacts ?? [];
  const planImpacts = reading?.planImpacts ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Lecture diffractive — démo</h1>
          <p className="text-muted-foreground text-sm">
            {demo
              ? `${demo.title} — ${demo.chapter.title}. Bibliothèque graphifiée : ${demo.sourcesCount} sources, graphe de ${demo.graphSummary.nodes} nœuds / ${demo.graphSummary.links} arêtes.`
              : "Chargement du contexte de démonstration…"}
          </p>
        </div>

        {contextError && (
          <p className="text-sm text-rose-600">
            Contexte indisponible : {contextError} (l'API doit être lancée depuis
            apps/api avec le .env renseigné).
          </p>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fragment à diffracter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Pose un fragment dans le chapitre 2…"
              rows={3}
            />
            {demo && demo.suggestedFragments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {demo.suggestedFragments.map((f) => (
                  <Button
                    key={f.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatement(f.statement);
                      void handleRun(f.statement);
                    }}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={() => void handleRun()} disabled={loading || !demo}>
                {loading ? "Lecture en cours…" : "Lire (4 passes + verdict)"}
              </Button>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </CardContent>
        </Card>

        {demo && demo.context.bookBibliography.graphNeighborhoods && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Signaux du graphe envoyés au lecteur (
                {demo.context.bookBibliography.graphNeighborhoods.length} voisinages)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <details>
                <summary className="cursor-pointer text-sm">
                  Voir les voisinages (BFS budgété, zéro token)
                </summary>
                <div className="mt-2 space-y-3">
                  {demo.context.bookBibliography.graphNeighborhoods.map((n) => (
                    <div key={n.term}>
                      <p className="font-medium">Terme : {n.term}</p>
                      <pre className="whitespace-pre-wrap rounded bg-muted p-2">
                        {n.text}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        )}

        {reading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  VERDICT_STYLES[reading.verdict] ?? "bg-slate-100 text-slate-800"
                }`}
              >
                {VERDICT_LABELS[reading.verdict] ?? reading.verdict}
              </span>
              <span className="text-sm text-muted-foreground">
                {reading.verdictDetail}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <PassCard title="Pass 1 — le fragment à travers le livre">
                <ul className="list-disc space-y-1 pl-4">
                  {reading.pass1.refraction.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </PassCard>
              <PassCard title="Pass 2 — le livre à travers le fragment">
                {reading.pass2.namedPatterns.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4">
                    {reading.pass2.namedPatterns.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
                {reading.pass2.revealedDefaults.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    {reading.pass2.revealedDefaults.map((d, i) => (
                      <li key={i}>
                        défaut : {d.default}
                        {d.priorCut ? ` — coupe : ${d.priorCut}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </PassCard>
              <PassCard title="Pass 3 — enchevêtrements">
                {reading.pass3.entanglements.length === 0 ? (
                  <p className="text-muted-foreground">Aucun enchevêtrement honnête.</p>
                ) : (
                  <ul className="space-y-2">
                    {reading.pass3.entanglements.map((e, i) => (
                      <li key={i}>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-muted-foreground">
                          coupe si intégré : {e.cutIfIntegrated}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </PassCard>
              <PassCard title="Pass 4 — la coupe agentielle">
                <p className="font-medium">{reading.pass4.cut}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {reading.pass4.included.map((x, i) => (
                    <li key={i}>inclut : {x}</li>
                  ))}
                  {reading.pass4.excluded.map((x, i) => (
                    <li key={i}>exclut : {x}</li>
                  ))}
                  {reading.pass4.cutOfNonAdoption.map((x, i) => (
                    <li key={i} className="text-muted-foreground">
                      sinon : {x}
                    </li>
                  ))}
                </ul>
              </PassCard>
            </div>

            {(planImpacts.length > 0 || bibliographyImpacts.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {planImpacts.length > 0 && (
                  <PassCard title="Impacts sur le plan">
                    <ul className="list-disc space-y-1 pl-4">
                      {planImpacts.map((p, i) => (
                        <li key={i}>
                          [{p.partId}
                          {p.entryId ? ` / ${p.entryId}` : ""}] {p.impact}
                        </li>
                      ))}
                    </ul>
                  </PassCard>
                )}
                {bibliographyImpacts.length > 0 && (
                  <PassCard title="Impacts bibliographiques (signaux du graphe qualifiés)">
                    <ul className="list-disc space-y-1 pl-4">
                      {bibliographyImpacts.map((b, i) => (
                        <li key={i}>
                          <span className="font-medium">{b.kind}</span> — {b.impact}
                          <span className="text-muted-foreground">
                            {" "}
                            ({b.sourceId} / {b.scopeId})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </PassCard>
                )}
              </div>
            )}

            {reading.tradeoffs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Matrice de compromis</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <ul className="space-y-2">
                    {reading.tradeoffs.map((t, i) => (
                      <li key={i}>
                        <span className="font-medium">{t.path}</span> — verdict{" "}
                        {VERDICT_LABELS[t.verdict] ?? t.verdict} — effort : {t.effort},
                        réversibilité : {t.reversibility}, levier : {t.leverage},
                        taxe de distraction : {t.distractionTax}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}