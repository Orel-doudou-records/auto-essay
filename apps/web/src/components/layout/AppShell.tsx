import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { darkTheme, globalStyles } from "../../styles/theme";
import { themeVars } from "../../styles/tokens.stylex";
import { useProject } from "@/hooks/useProject";

interface AppShellProps {
  projectId?: string;
  children: React.ReactNode;
  scopeQuery?: string;
  beforeNavigate?: () => Promise<boolean>;
}

type ThemePreference = "light" | "dark";
const THEME_STORAGE_KEY = "auto-essay.theme";
function initialThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function AppShell({
  projectId,
  children,
  scopeQuery,
  beforeNavigate,
}: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { project } = useProject(projectId);
  const [theme, setTheme] = useState<ThemePreference>(initialThemePreference);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const params = new URLSearchParams(scopeQuery ?? location.search);
  const context = new URLSearchParams();
  for (const key of ["unitId", "nodeId", "chapterId"]) {
    const value = params.get(key);
    if (value) context.set(key, value);
  }
  const suffix = context.size ? `?${context}` : "";
  const base = `/projects/${projectId}`;
  const links = projectId
    ? [
        { to: `${base}/editor`, label: "Écrire" },
        { to: `${base}/chapitre`, label: "Plan" },
        { to: `${base}/sources`, label: "Sources" },
        { to: `${base}/analyse`, label: "Analyse" },
      ]
    : [
        { to: "/", label: "Projets" },
        { to: "/espace", label: "Espace" },
        { to: "/demo", label: "Démo" },
      ];
  const nextTheme = theme === "light" ? "dark" : "light";
  return (
    <div
      {...stylex.props(
        globalStyles.root,
        theme === "dark" && globalStyles.darkRoot,
        theme === "dark" && darkTheme,
        styles.shell,
      )}
      data-theme={theme}
      onClickCapture={(event) => {
        if (
          !beforeNavigate ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as Element).closest("a");
        if (
          !anchor ||
          anchor.target ||
          anchor.hasAttribute("download") ||
          anchor.origin !== window.location.origin
        )
          return;
        event.preventDefault();
        const destination = anchor.pathname + anchor.search + anchor.hash;
        void beforeNavigate().then((saved) => {
          if (saved) navigate(destination);
        });
      }}
    >
      <header {...stylex.props(styles.header)}>
        <Link
          to="/"
          {...stylex.props(styles.brand)}
          aria-label="Auto Essay — projets"
        >
          ▤ AutoEssay
        </Link>
        {projectId && (
          <span {...stylex.props(styles.project)}>
            {project?.title ?? "Mon essai"}
          </span>
        )}
        <nav
          {...stylex.props(styles.navigation)}
          aria-label="Navigation principale"
        >
          {links.map((link) => {
            const active =
              location.pathname === link.to ||
              (link.label === "Analyse" &&
                location.pathname.includes("/evaluate/")) ||
              (link.label === "Écrire" &&
                /\/(reimport|import)$/.test(location.pathname));
            return (
              <Link
                key={link.to}
                to={link.to + (projectId ? suffix : "")}
                aria-current={active ? "page" : undefined}
                {...stylex.props(styles.link, active && styles.active)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <details {...stylex.props(styles.menu)}>
          <summary
            {...stylex.props(styles.menuButton)}
            aria-label="Menu du projet"
          >
            •••
          </summary>
          <div {...stylex.props(styles.menuContent)}>
            <Link to="/" {...stylex.props(styles.menuLink)}>
              Tous les projets
            </Link>
            {projectId && (
              <>
                <Link to={`${base}/cadrage`} {...stylex.props(styles.menuLink)}>
                  Cadrage
                </Link>
                <Link
                  to={`${base}/atelier${suffix}`}
                  {...stylex.props(styles.menuLink)}
                >
                  Lectures
                </Link>
                <Link to={`${base}/import`} {...stylex.props(styles.menuLink)}>
                  Import du manuscrit
                </Link>
                <Link
                  to={`${base}/plan-import`}
                  {...stylex.props(styles.menuLink)}
                >
                  Import du plan
                </Link>
              </>
            )}
            <Link to="/espace" {...stylex.props(styles.menuLink)}>
              Espace
            </Link>
            <Link to="/demo" {...stylex.props(styles.menuLink)}>
              Démo
            </Link>
          </div>
        </details>
        <button
          type="button"
          {...stylex.props(styles.themeToggle)}
          aria-label={`Activer le thème ${nextTheme === "dark" ? "sombre" : "clair"}`}
          onClick={() => {
            window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
            setTheme(nextTheme);
          }}
        >
          {theme === "light" ? "◐" : "◑"}
        </button>
      </header>
      <div {...stylex.props(styles.main)}>{children}</div>
    </div>
  );
}
const styles = stylex.create({
  shell: { display: "flex", flexDirection: "column", minHeight: "100vh" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    minHeight: "3.5rem",
    padding: "0 1.25rem",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: themeVars.border,
    backgroundColor: themeVars.surface,
    position: "sticky",
    top: 0,
    zIndex: 30,
    flexWrap: "wrap",
  },
  brand: {
    color: themeVars.textPrimary,
    fontSize: "1.05rem",
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  project: {
    fontSize: "0.82rem",
    fontWeight: 600,
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: themeVars.border,
    paddingLeft: "1rem",
    maxWidth: "18rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: { default: "block", "@media (max-width: 60rem)": "none" },
  },
  navigation: {
    display: "flex",
    gap: "0.25rem",
    justifyContent: "center",
    margin: "0 auto",
    order: { default: 0, "@media (max-width: 40rem)": 1 },
    width: { default: "auto", "@media (max-width: 40rem)": "100%" },
  },
  link: {
    padding: "1.1rem 0.9rem",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    color: themeVars.textSecondary,
    textDecoration: "none",
    fontSize: "0.85rem",
  },
  active: { color: themeVars.accent, borderBottomColor: themeVars.accent },
  menu: { position: "relative", marginLeft: "auto" },
  menuButton: {
    cursor: "pointer",
    padding: "0.5rem",
    listStyle: "none",
    color: themeVars.textSecondary,
  },
  menuContent: {
    position: "absolute",
    right: 0,
    top: "2.7rem",
    width: "15rem",
    padding: "0.5rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: themeVars.border,
    backgroundColor: themeVars.surface,
    borderRadius: themeVars.radiusMedium,
    boxShadow: themeVars.shadow,
    display: "flex",
    flexDirection: "column",
  },
  menuLink: {
    color: themeVars.textPrimary,
    padding: "0.65rem",
    textDecoration: "none",
    fontSize: "0.85rem",
  },
  themeToggle: {
    cursor: "pointer",
    backgroundColor: themeVars.accentMuted,
    color: themeVars.accent,
    borderWidth: 0,
    borderRadius: "50%",
    width: "2rem",
    height: "2rem",
  },
  main: { flex: "1", minWidth: 0 },
});
