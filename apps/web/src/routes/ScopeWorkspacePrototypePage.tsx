// PROTOTYPE — throwaway UI used to answer one question:
// How should AutoEssay keep the manuscript dominant while combining scoped agent work,
// sources, planning and Diffract consequences without feeling like five separate tools?
// Run with `npm run dev`, then open an existing project editor with ?variant=A|B|C.

import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { themeVars } from "../styles/tokens.stylex";

type VariantKey = "A" | "B" | "C";

const VARIANTS: Array<{ key: VariantKey; label: string }> = [
  { key: "A", label: "Trois colonnes" },
  { key: "B", label: "Manuscrit + dock" },
  { key: "C", label: "Studio de chapitre" },
];

const CURRENT_TEXT = `Le soupçon de conversion ne fonctionne pas seulement comme une question religieuse. Il reconfigure les critères par lesquels une communauté politique prétend reconnaître ses membres, et déplace progressivement l’attention de la pratique vers la filiation.`;

const PROPOSED_TEXT = `Le soupçon de conversion déplace le problème religieux vers une technologie politique de la filiation. Ce qui doit désormais être reconnu n’est plus seulement une pratique présente, mais une continuité supposée du lignage. Cette translation permet de lire ensemble la conversion, la pureté et la production administrative d’une différence durable.`;

const SOURCES = [
  ["Schaub — Pour une histoire politique de la race", "12 passages retrouvés", "explorée"],
  ["Ingram — Conversos and Moriscos", "7 passages retrouvés", "explorée"],
  ["Race et histoire dans les sociétés occidentales", "3 passages potentiels", "partielle"],
];

const IMPACTS = [
  "Chapitre 5 : risque de redondance avec la section sur la transmission.",
  "Introduction de partie : adaptation recommandée si la filiation devient l’axe principal.",
  "Hypothèse H2 : mieux mise à l’épreuve par cette séparation.",
];

export function ScopeWorkspacePrototypePage() {
  const { projectId = "prototype" } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requested = searchParams.get("variant")?.toUpperCase();
  const variant: VariantKey = requested === "B" || requested === "C" ? requested : "A";
  const [proposal, setProposal] = useState(PROPOSED_TEXT);

  function setVariant(next: VariantKey) {
    const params = new URLSearchParams(searchParams);
    params.set("variant", next);
    navigate({ search: params.toString() }, { replace: true });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const index = VARIANTS.findIndex((item) => item.key === variant);
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setVariant(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length].key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, searchParams]);

  return (
    <AppShell projectId={projectId}>
      <section {...stylex.props(styles.prototype)} aria-label="Prototype du workspace AutoEssay">
        <header {...stylex.props(styles.prototypeHeader)}>
          <div>
            <p {...stylex.props(styles.eyebrow)}>Prototype throwaway · ne pas fusionner tel quel</p>
            <h1 {...stylex.props(styles.prototypeTitle)}>Chapitre 4 — Conversion, lignage et soupçon</h1>
          </div>
          <div {...stylex.props(styles.scopeStatus)}>
            <span>Scope : chapitre</span>
            <span>Bibliographie : 47 sources · 12 explorées</span>
          </div>
        </header>

        {variant === "A" && <VariantA proposal={proposal} setProposal={setProposal} />}
        {variant === "B" && <VariantB proposal={proposal} setProposal={setProposal} />}
        {variant === "C" && <VariantC proposal={proposal} setProposal={setProposal} />}

        {import.meta.env.DEV && <PrototypeSwitcher variant={variant} onChange={setVariant} />}
      </section>
    </AppShell>
  );
}

function VariantA({ proposal, setProposal }: PrototypeProps) {
  return (
    <div {...stylex.props(styles.threeColumns)}>
      <BookRail />
      <main {...stylex.props(styles.mainCanvas)}>
        <ScopeTabs />
        <Manuscript />
        <Proposal proposal={proposal} setProposal={setProposal} />
      </main>
      <aside {...stylex.props(styles.contextRail)}>
        <AgentPrompt />
        <Sources compact />
        <Diffract />
      </aside>
    </div>
  );
}

function VariantB({ proposal, setProposal }: PrototypeProps) {
  const [dock, setDock] = useState<"agent" | "sources" | "impacts">("agent");
  return (
    <div {...stylex.props(styles.focusLayout)}>
      <div {...stylex.props(styles.breadcrumbRow)}>
        <span>Partie II</span><span>›</span><span>Chapitre 4</span><span>›</span><strong>Section 4.2</strong>
      </div>
      <main {...stylex.props(styles.focusCanvas)}>
        <Manuscript />
        <Proposal proposal={proposal} setProposal={setProposal} />
      </main>
      <aside {...stylex.props(styles.bottomDock)}>
        <div {...stylex.props(styles.dockTabs)}>
          {(["agent", "sources", "impacts"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setDock(item)} {...stylex.props(styles.dockTab, dock === item && styles.dockTabActive)}>
              {item === "agent" ? "Travailler avec l’agent" : item === "sources" ? "Sources (3)" : "Conséquences (3)"}
            </button>
          ))}
        </div>
        {dock === "agent" && <AgentPrompt />}
        {dock === "sources" && <Sources />}
        {dock === "impacts" && <Diffract />}
      </aside>
    </div>
  );
}

function VariantC({ proposal, setProposal }: PrototypeProps) {
  return (
    <div {...stylex.props(styles.studio)}>
      <header {...stylex.props(styles.chapterMap)}>
        <button type="button">4.1 Conversion</button>
        <button type="button" {...stylex.props(styles.chapterMapActive)}>4.2 Filiation</button>
        <button type="button">4.3 Pureté</button>
        <button type="button">4.4 Administration</button>
        <button type="button">+ idée de section</button>
      </header>
      <div {...stylex.props(styles.studioBody)}>
        <main {...stylex.props(styles.studioEditor)}>
          <Manuscript />
          <Proposal proposal={proposal} setProposal={setProposal} inlineImpacts />
        </main>
        <aside {...stylex.props(styles.studioConversation)}>
          <p {...stylex.props(styles.eyebrow)}>Conversation située · Chapitre 4</p>
          <div {...stylex.props(styles.messageUser)}>À partir de ma bibliographie, est-ce que cette section devrait devenir le pivot du chapitre ?</div>
          <div {...stylex.props(styles.messageAgent)}>
            Oui, mais seulement si tu sépares clairement filiation et pratique religieuse. Schaub et Ingram donnent assez de matière pour tester cette structure. J’ai vérifié les conséquences sur les chapitres voisins.
          </div>
          <Diffract condensed />
          <AgentPrompt conversational />
          <Sources compact />
        </aside>
      </div>
    </div>
  );
}

type PrototypeProps = { proposal: string; setProposal: (value: string) => void };

function BookRail() {
  return (
    <aside {...stylex.props(styles.bookRail)}>
      <p {...stylex.props(styles.eyebrow)}>Le livre</p>
      <strong>Partie II</strong>
      <button type="button">Chapitre 2</button>
      <button type="button">Chapitre 3</button>
      <button type="button" {...stylex.props(styles.activeTreeItem)}>Chapitre 4</button>
      <div {...stylex.props(styles.treeChildren)}>
        <button type="button">4.1 Conversion</button>
        <button type="button" {...stylex.props(styles.activeTreeItem)}>4.2 Filiation</button>
        <button type="button">4.3 Pureté</button>
      </div>
      <button type="button">Chapitre 5</button>
      <p {...stylex.props(styles.muted)}>Plan partiellement stabilisé · 2 chapitres encore à l’état d’idée</p>
    </aside>
  );
}

function ScopeTabs() {
  return (
    <nav {...stylex.props(styles.scopeTabs)} aria-label="Vue du scope courant">
      <button type="button" {...stylex.props(styles.scopeTabActive)}>Texte</button>
      <button type="button">Structure</button>
      <button type="button">Brief</button>
    </nav>
  );
}

function Manuscript() {
  return (
    <article {...stylex.props(styles.manuscript)}>
      <p {...stylex.props(styles.eyebrow)}>Section 4.2 · texte existant</p>
      <h2 {...stylex.props(styles.manuscriptTitle)}>La filiation comme technologie politique</h2>
      <p {...stylex.props(styles.manuscriptText)}>{CURRENT_TEXT}</p>
      <p {...stylex.props(styles.manuscriptText)}>
        Ce déplacement rend possible une lecture où la différence n’est plus seulement attachée à une conduite observable, mais à une origine reconstruite comme persistante.
      </p>
    </article>
  );
}

function Proposal({ proposal, setProposal, inlineImpacts = false }: PrototypeProps & { inlineImpacts?: boolean }) {
  return (
    <section {...stylex.props(styles.proposal)}>
      <header {...stylex.props(styles.proposalHeader)}>
        <div>
          <p {...stylex.props(styles.eyebrow)}>Proposition de l’agent · non intégrée</p>
          <strong>Resserrement argumentatif à partir de 2 sources</strong>
        </div>
        <span {...stylex.props(styles.safeBadge)}>Le manuscrit n’a pas changé</span>
      </header>
      <Textarea aria-label="Texte proposé" rows={5} value={proposal} onChange={(event) => setProposal(event.target.value)} />
      <details {...stylex.props(styles.details)}>
        <summary>Comparer avec le texte de départ</summary>
        <p>{CURRENT_TEXT}</p>
      </details>
      {inlineImpacts && <Diffract condensed />}
      <div {...stylex.props(styles.actions)}>
        <Button type="button" size="sm">Accepter</Button>
        <Button type="button" size="sm" variant="outline">Continuer à discuter</Button>
        <Button type="button" size="sm" variant="ghost">Refuser</Button>
      </div>
    </section>
  );
}

function AgentPrompt({ conversational = false }: { conversational?: boolean }) {
  return (
    <section {...stylex.props(styles.panel)}>
      <header>
        <p {...stylex.props(styles.eyebrow)}>{conversational ? "Poursuivre" : "Agent"}</p>
        {!conversational && <h3 {...stylex.props(styles.panelTitle)}>Travailler sur ce scope</h3>}
      </header>
      <Textarea
        aria-label="Demande à l’agent"
        rows={3}
        defaultValue={conversational ? "" : "À partir de ma bibliographie, aide-moi à renforcer l’argument de cette section sans inventer de preuve."}
        placeholder="Demander, contester, préciser…"
      />
      <div {...stylex.props(styles.contextSummary)}>
        <span>Contexte automatique</span>
        <span>✓ texte · ✓ brief · ✓ plan · ✓ 19 passages</span>
      </div>
      <Button type="button" size="sm" fullWidth>Envoyer</Button>
    </section>
  );
}

function Sources({ compact = false }: { compact?: boolean }) {
  return (
    <section {...stylex.props(styles.panel)}>
      <div {...stylex.props(styles.panelHeading)}>
        <div><p {...stylex.props(styles.eyebrow)}>Bibliographie</p><h3 {...stylex.props(styles.panelTitle)}>Sources utilisées ici</h3></div>
        <button type="button" {...stylex.props(styles.textButton)}>Voir le contexte</button>
      </div>
      <div {...stylex.props(styles.sourceList)}>
        {SOURCES.slice(0, compact ? 2 : SOURCES.length).map(([title, passages, status]) => (
          <article key={title} {...stylex.props(styles.sourceItem)}>
            <strong>{title}</strong>
            <span>{passages}</span>
            <small>{status}</small>
          </article>
        ))}
      </div>
      <button type="button" {...stylex.props(styles.textButton)}>+ Ajouter ou exclure une source</button>
    </section>
  );
}

function Diffract({ condensed = false }: { condensed?: boolean }) {
  return (
    <section {...stylex.props(styles.panel, styles.impactPanel)}>
      <div {...stylex.props(styles.panelHeading)}>
        <div><p {...stylex.props(styles.eyebrow)}>Conséquences détectées</p>{!condensed && <h3 {...stylex.props(styles.panelTitle)}>Avant de stabiliser ce choix</h3>}</div>
        <span {...stylex.props(styles.advisoryBadge)}>conseil</span>
      </div>
      <ul {...stylex.props(styles.impactList)}>
        {IMPACTS.slice(0, condensed ? 2 : IMPACTS.length).map((impact) => <li key={impact}>{impact}</li>)}
      </ul>
      <button type="button" {...stylex.props(styles.textButton)}>Voir l’analyse complète</button>
    </section>
  );
}

function PrototypeSwitcher({ variant, onChange }: { variant: VariantKey; onChange: (key: VariantKey) => void }) {
  const index = VARIANTS.findIndex((item) => item.key === variant);
  function move(delta: number) {
    onChange(VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length].key);
  }
  return (
    <div {...stylex.props(styles.switcher)} role="group" aria-label="Variantes du prototype">
      <button type="button" onClick={() => move(-1)} aria-label="Variante précédente">←</button>
      <span>{variant} · {VARIANTS[index].label}</span>
      <button type="button" onClick={() => move(1)} aria-label="Variante suivante">→</button>
    </div>
  );
}

const styles = stylex.create({
  prototype: { minHeight: "calc(100vh - 3rem)", paddingBottom: "5rem" },
  prototypeHeader: { alignItems: "flex-end", borderBottomColor: themeVars.border, borderBottomStyle: "solid", borderBottomWidth: "1px", display: "flex", gap: "1rem", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "1rem" },
  prototypeTitle: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 500, margin: "0.35rem 0 0" },
  eyebrow: { color: themeVars.textSubtle, fontSize: "0.7rem", fontWeight: 650, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" },
  scopeStatus: { color: themeVars.textSecondary, display: "flex", flexDirection: "column", fontSize: "0.78rem", gap: "0.25rem", textAlign: "right" },
  threeColumns: { display: "grid", gap: "1rem", gridTemplateColumns: "13rem minmax(0, 1fr) 20rem", minHeight: "44rem" },
  bookRail: { borderRightColor: themeVars.border, borderRightStyle: "solid", borderRightWidth: "1px", display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.75rem 1rem 1rem 0" },
  activeTreeItem: { backgroundColor: themeVars.accentMuted, color: themeVars.accent },
  treeChildren: { display: "flex", flexDirection: "column", gap: "0.25rem", paddingLeft: "0.75rem" },
  muted: { color: themeVars.textSubtle, fontSize: "0.75rem", lineHeight: 1.5, marginTop: "1rem" },
  mainCanvas: { minWidth: 0, padding: "0 1rem" },
  contextRail: { display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 0 },
  scopeTabs: { display: "flex", gap: "1rem", marginBottom: "1rem" },
  scopeTabActive: { borderBottomColor: themeVars.accent, borderBottomStyle: "solid", borderBottomWidth: "2px", color: themeVars.accent },
  manuscript: { margin: "0 auto", maxWidth: "46rem", padding: "1.5rem 0" },
  manuscriptTitle: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "2rem", fontWeight: 500, lineHeight: 1.2, margin: "0.5rem 0 1.5rem" },
  manuscriptText: { color: themeVars.textPrimary, fontFamily: themeVars.fontManuscript, fontSize: "1.12rem", lineHeight: 1.8 },
  proposal: { backgroundColor: themeVars.surfaceRaised, borderColor: themeVars.border, borderRadius: themeVars.radiusSmall, borderStyle: "solid", borderWidth: "1px", margin: "1rem auto", maxWidth: "46rem", padding: "1rem" },
  proposalHeader: { alignItems: "flex-start", display: "flex", gap: "1rem", justifyContent: "space-between", marginBottom: "0.75rem" },
  safeBadge: { color: themeVars.textSecondary, fontSize: "0.72rem", whiteSpace: "nowrap" },
  details: { color: themeVars.textSecondary, fontSize: "0.82rem", marginTop: "0.75rem" },
  actions: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" },
  panel: { borderColor: themeVars.border, borderRadius: themeVars.radiusSmall, borderStyle: "solid", borderWidth: "1px", display: "flex", flexDirection: "column", gap: "0.65rem", padding: "0.85rem" },
  panelTitle: { color: themeVars.textPrimary, fontSize: "0.98rem", margin: "0.25rem 0 0" },
  panelHeading: { alignItems: "flex-start", display: "flex", gap: "0.5rem", justifyContent: "space-between" },
  contextSummary: { color: themeVars.textSubtle, display: "flex", flexDirection: "column", fontSize: "0.72rem", gap: "0.15rem" },
  sourceList: { display: "flex", flexDirection: "column", gap: "0.65rem" },
  sourceItem: { display: "flex", flexDirection: "column", fontSize: "0.78rem", gap: "0.15rem" },
  textButton: { backgroundColor: "transparent", borderWidth: 0, color: themeVars.accent, cursor: "pointer", fontSize: "0.76rem", padding: 0, textAlign: "left" },
  impactPanel: { backgroundColor: themeVars.accentMuted },
  advisoryBadge: { color: themeVars.textSecondary, fontSize: "0.7rem" },
  impactList: { color: themeVars.textSecondary, display: "flex", flexDirection: "column", fontSize: "0.78rem", gap: "0.45rem", lineHeight: 1.45, margin: 0, paddingLeft: "1.1rem" },
  focusLayout: { display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr) 21rem", gridTemplateRows: "auto 1fr", minHeight: "44rem" },
  breadcrumbRow: { color: themeVars.textSecondary, display: "flex", gap: "0.5rem", gridColumn: "1 / -1", padding: "0.5rem 0" },
  focusCanvas: { minWidth: 0, padding: "0 clamp(1rem, 6vw, 6rem)" },
  bottomDock: { alignSelf: "start", borderLeftColor: themeVars.border, borderLeftStyle: "solid", borderLeftWidth: "1px", display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: "32rem", paddingLeft: "1rem" },
  dockTabs: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  dockTab: { backgroundColor: "transparent", borderWidth: 0, color: themeVars.textSecondary, cursor: "pointer", padding: "0.5rem", textAlign: "left" },
  dockTabActive: { backgroundColor: themeVars.accentMuted, color: themeVars.accent },
  studio: { display: "flex", flexDirection: "column", gap: "1rem" },
  chapterMap: { borderBottomColor: themeVars.border, borderBottomStyle: "solid", borderBottomWidth: "1px", display: "flex", flexWrap: "wrap", gap: "0.5rem", paddingBottom: "0.75rem" },
  chapterMapActive: { backgroundColor: themeVars.accentMuted, color: themeVars.accent },
  studioBody: { display: "grid", gap: "1.5rem", gridTemplateColumns: "minmax(0, 1.5fr) minmax(18rem, 0.8fr)" },
  studioEditor: { minWidth: 0, padding: "0 clamp(0rem, 3vw, 3rem)" },
  studioConversation: { borderLeftColor: themeVars.border, borderLeftStyle: "solid", borderLeftWidth: "1px", display: "flex", flexDirection: "column", gap: "0.75rem", paddingLeft: "1rem" },
  messageUser: { alignSelf: "flex-end", backgroundColor: themeVars.accentMuted, borderRadius: themeVars.radiusSmall, color: themeVars.textPrimary, fontSize: "0.84rem", lineHeight: 1.5, maxWidth: "90%", padding: "0.7rem" },
  messageAgent: { color: themeVars.textSecondary, fontSize: "0.84rem", lineHeight: 1.55, padding: "0.25rem" },
  switcher: { alignItems: "center", backgroundColor: themeVars.textPrimary, borderRadius: "999px", bottom: "1rem", boxShadow: themeVars.shadow, color: themeVars.surface, display: "flex", gap: "0.8rem", left: "50%", padding: "0.55rem 0.8rem", position: "fixed", transform: "translateX(-50%)", zIndex: 50 },
});
