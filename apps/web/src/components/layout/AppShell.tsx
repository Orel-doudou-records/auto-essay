import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import * as stylex from "@stylexjs/stylex";
import { darkTheme, globalStyles } from "../../styles/theme";
import { themeVars } from "../../styles/tokens.stylex";

interface AppShellProps {
  projectId?: string;
  children: React.ReactNode;
}

type ThemePreference = "light" | "dark";

const THEME_STORAGE_KEY = "auto-essay.theme";

function initialThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppShell({ projectId, children }: AppShellProps) {
  const location = useLocation();
  const [theme, setTheme] = useState<ThemePreference>(initialThemePreference);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const projectLinks = projectId
    ? [
        { to: `/projects/${projectId}`, label: "Projet" },
        { to: `/projects/${projectId}/sources`, label: "Sources" },
        { to: `/projects/${projectId}/editor`, label: "Éditeur" },
        { to: `/projects/${projectId}/atelier`, label: "Atelier" },
        { to: `/projects/${projectId}/chapitre`, label: "Chapitre" },
      ]
    : [];

  const links = [{ to: "/", label: "Projets" }, { to: "/espace", label: "Espace" }, { to: "/demo", label: "Démo" }, ...projectLinks];
  const nextTheme = theme === "light" ? "dark" : "light";

  function toggleTheme() {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  return (
    <div
      {...stylex.props(
        globalStyles.root,
        theme === "dark" && globalStyles.darkRoot,
        theme === "dark" && darkTheme,
        styles.shell
      )}
      data-theme={theme}
    >
      <aside {...stylex.props(styles.sidebar)}>
        <div {...stylex.props(styles.brand)}>auto-essay</div>
        <nav {...stylex.props(styles.navigation)} aria-label="Navigation principale">
          {links.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                {...stylex.props(styles.navigationLink, active && styles.navigationLinkActive)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" {...stylex.props(styles.themeToggle)} onClick={toggleTheme}>
          Activer le thème {nextTheme === "dark" ? "sombre" : "clair"}
        </button>
      </aside>
      <main {...stylex.props(styles.main)}>{children}</main>
    </div>
  );
}

const styles = stylex.create({
  shell: {
    display: "flex",
    minHeight: "100vh",
  },
  sidebar: {
    width: "14rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    flexShrink: 0,
    padding: "1.25rem",
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: themeVars.border,
    backgroundColor: themeVars.surfaceRaised,
  },
  brand: {
    color: themeVars.textPrimary,
    fontSize: "1.0625rem",
    fontWeight: 650,
    letterSpacing: "-0.02em",
  },
  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  navigationLink: {
    borderRadius: themeVars.radiusSmall,
    backgroundColor: {
      default: "transparent",
      ':hover': themeVars.accentMuted,
    },
    color: {
      default: themeVars.textSecondary,
      ':hover': themeVars.textPrimary,
    },
    fontSize: "0.875rem",
    fontWeight: 550,
    outline: {
      ':focus-visible': `2px solid ${themeVars.focus}`,
    },
    outlineOffset: {
      ':focus-visible': "2px",
    },
    padding: "0.625rem 0.75rem",
    textDecoration: "none",
  },
  navigationLinkActive: {
    backgroundColor: themeVars.accentMuted,
    color: themeVars.accent,
  },
  themeToggle: {
    marginTop: "auto",
    alignSelf: "flex-start",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: themeVars.radiusSmall,
    backgroundColor: "transparent",
    borderColor: {
      default: themeVars.border,
      ':hover': themeVars.accent,
    },
    color: {
      default: themeVars.textSecondary,
      ':hover': themeVars.accent,
    },
    cursor: "pointer",
    fontFamily: themeVars.fontInterface,
    fontSize: "0.8125rem",
    outline: {
      ':focus-visible': `2px solid ${themeVars.focus}`,
    },
    outlineOffset: {
      ':focus-visible': "2px",
    },
    padding: "0.5rem 0.625rem",
  },
  main: {
    flex: "1",
    minWidth: 0,
    overflow: "auto",
    padding: "1.5rem",
  },
});
