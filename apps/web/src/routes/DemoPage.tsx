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
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
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
      <div>
        <div>
          <h1>Lecture diffractive — démo</h1>
          <p>
            {demo
              ? `${demo.title} — ${demo.chapter.title}. Bibliothèque graphifiée : ${demo.sourcesCount} sources, graphe de ${demo.graphSummary.nodes} nœuds / ${demo.graphSummary.links} arêtes.`
              : "Chargement du contexte de démonstration…"}
          </p>
        </div>

        {contextError && (
          <p>
            Contexte indisponible : {contextError} (l'API doit être lancée depuis
            apps/api avec le .env renseigné).
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fragment à diffracter</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Pose un fragment dans le chapitre 2…"
              rows={3}
            />
            {demo && demo.suggestedFragments.length > 0 && (
              <div>
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
            <div>
              <Button onClick={() => void handleRun()} disabled={loading || !demo}>
                {loading ? "Lecture en cours…" : "Lire (4 passes + verdict)"}
              </Button>
              {error && <p>{error}</p>}
            </div>
          </CardContent>
        </Card>

        {demo && demo.context.bookBibliography.graphNeighborhoods && (
          <Card>
            <CardHeader>
              <CardTitle>
                Signaux du graphe envoyés au lecteur (
                {demo.context.bookBibliography.graphNeighborhoods.length} voisinages)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <details>
                <summary>
                  Voir les voisinages (BFS budgété, zéro token)
                </summary>
                <div>
                  {demo.context.bookBibliography.graphNeighborhoods.map((n) => (
                    <div key={n.term}>
                      <p>Terme : {n.term}</p>
                      <pre>
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
          <div>
            <div>
              <span
              >
                {VERDICT_LABELS[reading.verdict] ?? reading.verdict}
              </span>
              <span>
                {reading.verdictDetail}
              </span>
            </div>

            <div>
              <PassCard title="Pass 1 — le fragment à travers le livre">
                <ul>
                  {reading.pass1.refraction.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </PassCard>
              <PassCard title="Pass 2 — le livre à travers le fragment">
                {reading.pass2.namedPatterns.length > 0 && (
                  <ul>
                    {reading.pass2.namedPatterns.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
                {reading.pass2.revealedDefaults.length > 0 && (
                  <ul>
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
                  <p>Aucun enchevêtrement honnête.</p>
                ) : (
                  <ul>
                    {reading.pass3.entanglements.map((e, i) => (
                      <li key={i}>
                        <p>{e.name}</p>
                        <p>
                          coupe si intégré : {e.cutIfIntegrated}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </PassCard>
              <PassCard title="Pass 4 — la coupe agentielle">
                <p>{reading.pass4.cut}</p>
                <ul>
                  {reading.pass4.included.map((x, i) => (
                    <li key={i}>inclut : {x}</li>
                  ))}
                  {reading.pass4.excluded.map((x, i) => (
                    <li key={i}>exclut : {x}</li>
                  ))}
                  {reading.pass4.cutOfNonAdoption.map((x, i) => (
                    <li key={i}>
                      sinon : {x}
                    </li>
                  ))}
                </ul>
              </PassCard>
            </div>

            {(planImpacts.length > 0 || bibliographyImpacts.length > 0) && (
              <div>
                {planImpacts.length > 0 && (
                  <PassCard title="Impacts sur le plan">
                    <ul>
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
                    <ul>
                      {bibliographyImpacts.map((b, i) => (
                        <li key={i}>
                          <span>{b.kind}</span> — {b.impact}
                          <span>
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
                <CardHeader>
                  <CardTitle>Matrice de compromis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul>
                    {reading.tradeoffs.map((t, i) => (
                      <li key={i}>
                        <span>{t.path}</span> — verdict{" "}
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