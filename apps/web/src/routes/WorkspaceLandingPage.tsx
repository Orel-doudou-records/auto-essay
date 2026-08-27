import { Link } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { themeVars } from "../styles/tokens.stylex";

const features = [
  {
    number: "01",
    title: "Manuscrit",
    copy: "Écrivez dans un canevas calme, gardez le fil de vos unités et retrouvez une sauvegarde discrète.",
  },
  {
    number: "02",
    title: "Sources et preuves",
    copy: "Rassemblez les textes qui comptent et distribuez les preuves dans le chantier où elles deviennent utiles.",
  },
  {
    number: "03",
    title: "Lecture diffractive",
    copy: "Confrontez un fragment au livre en cours. La lecture éclaire une décision ; elle ne la prend jamais à votre place.",
  },
  {
    number: "04",
    title: "Révision explicite",
    copy: "Comparez une proposition au texte de départ, ajustez-la, appliquez-la ou écartez-la selon votre jugement.",
  },
  {
    number: "05",
    title: "Évaluation située",
    copy: "Relisez la solidité documentaire et les effets éditoriaux d’une version sans les confondre avec l’écriture.",
  },
] as const;

export function WorkspaceLandingPage() {
  return (
    <AppShell>
      <div {...stylex.props(styles.page)}>
        <section {...stylex.props(styles.hero)} aria-labelledby="workspace-title">
          <p {...stylex.props(styles.eyebrow)}>Auto Essay · espace de travail</p>
          <h1 id="workspace-title" {...stylex.props(styles.title)}>Écrire un essai sans céder la décision.</h1>
          <p {...stylex.props(styles.lead)}>
            Un environnement pour tenir ensemble manuscrit, sources, lectures et révisions — sans transformer l’assistance en autorité.
          </p>
          <div {...stylex.props(styles.actions)}>
            <Link to="/" {...stylex.props(styles.primaryLink)}>Ouvrir mes projets</Link>
            <Link to="/demo" {...stylex.props(styles.secondaryLink)}>Explorer la démo</Link>
          </div>
        </section>

        <section {...stylex.props(styles.workflow)} aria-labelledby="workflow-title">
          <div {...stylex.props(styles.sectionIntro)}>
            <p {...stylex.props(styles.eyebrow)}>Du matériau au manuscrit</p>
            <h2 id="workflow-title" {...stylex.props(styles.sectionTitle)}>Le parcours de travail</h2>
            <p {...stylex.props(styles.sectionCopy)}>Chaque fonction intervient à un moment précis : elle éclaire la suite du travail, sans déplacer la responsabilité de l’auteur.</p>
          </div>
          <ol {...stylex.props(styles.featureGrid)}>
            {features.map((feature) => (
              <li key={feature.number} {...stylex.props(styles.featureItem)}>
                <Card>
                  <CardHeader>
                    <p {...stylex.props(styles.featureNumber)}>{feature.number}</p>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p {...stylex.props(styles.featureCopy)}>{feature.copy}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section {...stylex.props(styles.authority)} aria-labelledby="authority-title">
          <div>
            <p {...stylex.props(styles.eyebrow)}>Une frontière nette</p>
            <h2 id="authority-title" {...stylex.props(styles.sectionTitle)}>L’auteur garde le dernier mot</h2>
          </div>
          <div {...stylex.props(styles.authorityCopy)}>
            <p>Une lecture est une matière à examiner. Une proposition de révision reste distincte du manuscrit. Toute application est un geste intentionnel et une proposition devient périmée si votre texte évolue.</p>
            <Link to="/demo"><Button variant="outline">Voir une lecture en démo</Button></Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "clamp(3.5rem, 9vw, 8rem)",
    margin: "0 auto",
    maxWidth: "76rem",
    padding: "clamp(1rem, 4vw, 3rem) 0 clamp(3rem, 8vw, 6rem)",
  },
  hero: {
    borderBottomColor: themeVars.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    maxWidth: "54rem",
    paddingBottom: "clamp(2rem, 5vw, 4rem)",
  },
  eyebrow: {
    color: themeVars.accent,
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    margin: 0,
    textTransform: "uppercase",
  },
  title: {
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontManuscript,
    fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
    fontWeight: 500,
    letterSpacing: "-0.055em",
    lineHeight: 0.98,
    margin: "1rem 0 1.5rem",
  },
  lead: {
    color: themeVars.textSecondary,
    fontFamily: themeVars.fontManuscript,
    fontSize: "clamp(1.125rem, 2vw, 1.375rem)",
    lineHeight: 1.6,
    margin: 0,
    maxWidth: "42rem",
  },
  actions: { display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "2rem" },
  primaryLink: {
    backgroundColor: { default: themeVars.accent, ':hover': themeVars.accentHover },
    borderRadius: themeVars.radiusSmall,
    color: themeVars.accentContrast,
    fontSize: "0.875rem",
    fontWeight: 650,
    padding: "0.75rem 1rem",
    textDecoration: "none",
  },
  secondaryLink: {
    borderColor: { default: themeVars.border, ':hover': themeVars.accent },
    borderRadius: themeVars.radiusSmall,
    borderStyle: "solid",
    borderWidth: "1px",
    color: themeVars.textPrimary,
    fontSize: "0.875rem",
    fontWeight: 650,
    padding: "calc(0.75rem - 1px) calc(1rem - 1px)",
    textDecoration: "none",
  },
  workflow: { display: "flex", flexDirection: "column", gap: "2rem" },
  sectionIntro: { maxWidth: "40rem" },
  sectionTitle: {
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontManuscript,
    fontSize: "clamp(2rem, 4vw, 3.25rem)",
    fontWeight: 500,
    letterSpacing: "-0.04em",
    lineHeight: 1.05,
    margin: "0.75rem 0 0",
  },
  sectionCopy: { color: themeVars.textSecondary, lineHeight: 1.6, margin: "1rem 0 0" },
  featureGrid: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: { default: "repeat(3, minmax(0, 1fr))", "@media (max-width: 56rem)": "repeat(2, minmax(0, 1fr))", "@media (max-width: 40rem)": "1fr" },
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  featureItem: { minWidth: 0 },
  featureNumber: { color: themeVars.accent, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", margin: 0 },
  featureCopy: { color: themeVars.textSecondary, lineHeight: 1.6, margin: 0 },
  authority: {
    alignItems: "start",
    backgroundColor: themeVars.accentMuted,
    borderRadius: themeVars.radiusLarge,
    display: "grid",
    gap: "2rem",
    gridTemplateColumns: { default: "minmax(0, 1fr) minmax(0, 1fr)", "@media (max-width: 40rem)": "1fr" },
    padding: "clamp(1.5rem, 5vw, 3rem)",
  },
  authorityCopy: { color: themeVars.textSecondary, display: "flex", flexDirection: "column", gap: "1.25rem", lineHeight: 1.65 },
});
