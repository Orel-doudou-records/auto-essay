import * as stylex from "@stylexjs/stylex";
import { themeVars } from "./tokens.stylex";

export const darkTheme = stylex.createTheme(themeVars, {
  canvas: "#171a1f",
  surface: "#20252c",
  surfaceRaised: "#292f38",
  textPrimary: "#edf0f2",
  textSecondary: "#b5bec8",
  textSubtle: "#8d98a4",
  border: "#39424d",
  accent: "#8aa9bf",
  accentHover: "#aac8dc",
  accentContrast: "#182129",
  accentMuted: "#293944",
  danger: "#f09b98",
  dangerHover: "#f5b3b0",
  dangerMuted: "#422b2d",
  focus: "#aac8dc",
  shadow: "0 16px 42px rgba(0, 0, 0, 0.28)",
  radiusSmall: "6px",
  radiusMedium: "10px",
  radiusLarge: "16px",
  fontInterface: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontManuscript: "Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif",
});

export const globalStyles = stylex.create({
  root: {
    colorScheme: "light",
    minHeight: "100vh",
    backgroundColor: themeVars.canvas,
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontInterface,
  },
  darkRoot: {
    colorScheme: "dark",
  },
});
