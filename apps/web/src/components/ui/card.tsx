import * as React from "react";
import * as stylex from "@stylexjs/stylex";
import { themeVars } from "../../styles/tokens.stylex";

const Card = React.forwardRef<HTMLDivElement, Omit<React.HTMLAttributes<HTMLDivElement>, "className">>(
  (props, ref) => <div ref={ref} {...props} {...stylex.props(styles.card)} />
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, Omit<React.HTMLAttributes<HTMLDivElement>, "className">>(
  (props, ref) => <div ref={ref} {...props} {...stylex.props(styles.header)} />
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, Omit<React.HTMLAttributes<HTMLHeadingElement>, "className">>(
  (props, ref) => <h3 ref={ref} {...props} {...stylex.props(styles.title)} />
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  Omit<React.HTMLAttributes<HTMLParagraphElement>, "className">
>((props, ref) => <p ref={ref} {...props} {...stylex.props(styles.description)} />);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, Omit<React.HTMLAttributes<HTMLDivElement>, "className">>(
  (props, ref) => <div ref={ref} {...props} {...stylex.props(styles.content)} />
);
CardContent.displayName = "CardContent";

const styles = stylex.create({
  card: {
    backgroundColor: themeVars.surface,
    borderColor: themeVars.border,
    borderRadius: themeVars.radiusMedium,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: themeVars.shadow,
    color: themeVars.textPrimary,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
    padding: "1.25rem 1.25rem 0.875rem",
  },
  title: {
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontInterface,
    fontSize: "1.0625rem",
    fontWeight: 650,
    letterSpacing: "-0.015em",
    lineHeight: 1.25,
    margin: 0,
  },
  description: {
    color: themeVars.textSecondary,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    margin: 0,
  },
  content: {
    padding: "0.875rem 1.25rem 1.25rem",
  },
});

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
