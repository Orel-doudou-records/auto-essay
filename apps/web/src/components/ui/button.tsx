import * as React from "react";
import * as stylex from "@stylexjs/stylex";
import { themeVars } from "../../styles/tokens.stylex";

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", fullWidth = false, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      {...stylex.props(
        styles.button,
        buttonVariantStyles[variant],
        buttonSizeStyles[size],
        fullWidth && styles.fullWidth
      )}
    />
  )
);
Button.displayName = "Button";

const styles = stylex.create({
  button: {
    alignItems: "center",
    appearance: "none",
    borderColor: "transparent",
    borderRadius: themeVars.radiusSmall,
    borderStyle: "solid",
    borderWidth: "1px",
    cursor: {
      default: "pointer",
      ':disabled': "not-allowed",
    },
    display: "inline-flex",
    fontFamily: themeVars.fontInterface,
    fontSize: "0.875rem",
    fontWeight: 600,
    justifyContent: "center",
    lineHeight: 1,
    opacity: {
      ':disabled': 0.48,
    },
    outline: {
      ':focus-visible': `2px solid ${themeVars.focus}`,
    },
    outlineOffset: {
      ':focus-visible': "2px",
    },
    transitionDuration: "160ms",
    transitionProperty: "background-color, border-color, color, opacity",
    transitionTimingFunction: "ease",
    whiteSpace: "nowrap",
  },
  default: {
    backgroundColor: {
      default: themeVars.accent,
      ':hover': themeVars.accentHover,
    },
    color: themeVars.accentContrast,
  },
  destructive: {
    backgroundColor: {
      default: themeVars.danger,
      ':hover': themeVars.dangerHover,
    },
    color: themeVars.accentContrast,
  },
  outline: {
    backgroundColor: {
      default: "transparent",
      ':hover': themeVars.accentMuted,
    },
    borderColor: themeVars.border,
    color: themeVars.textPrimary,
  },
  secondary: {
    backgroundColor: themeVars.surfaceRaised,
    color: themeVars.textPrimary,
  },
  ghost: {
    backgroundColor: {
      default: "transparent",
      ':hover': themeVars.accentMuted,
    },
    color: themeVars.textSecondary,
  },
  link: {
    backgroundColor: "transparent",
    color: themeVars.accent,
    padding: 0,
    textDecoration: {
      default: "none",
      ':hover': "underline",
    },
  },
  sizeDefault: {
    minHeight: "2.5rem",
    padding: "0.625rem 0.875rem",
  },
  sm: {
    minHeight: "2.125rem",
    padding: "0.5rem 0.75rem",
  },
  lg: {
    minHeight: "2.75rem",
    padding: "0.75rem 1.25rem",
  },
  icon: {
    height: "2.5rem",
    width: "2.5rem",
  },
  fullWidth: {
    width: "100%",
  },
});

const buttonVariantStyles = {
  default: styles.default,
  destructive: styles.destructive,
  outline: styles.outline,
  secondary: styles.secondary,
  ghost: styles.ghost,
  link: styles.link,
};

const buttonSizeStyles = {
  default: styles.sizeDefault,
  sm: styles.sm,
  lg: styles.lg,
  icon: styles.icon,
};

export { Button };
