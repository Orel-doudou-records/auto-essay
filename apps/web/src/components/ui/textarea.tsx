import * as React from "react";
import * as stylex from "@stylexjs/stylex";
import { themeVars } from "../../styles/tokens.stylex";

export type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => (
  <textarea ref={ref} {...props} {...stylex.props(styles.textarea)} />
));
Textarea.displayName = "Textarea";

const styles = stylex.create({
  textarea: {
    backgroundColor: themeVars.surface,
    borderColor: themeVars.border,
    borderRadius: themeVars.radiusSmall,
    borderStyle: "solid",
    borderWidth: "1px",
    boxSizing: "border-box",
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontInterface,
    fontSize: "0.9375rem",
    lineHeight: 1.55,
    minHeight: "5rem",
    outline: {
      ':focus-visible': `2px solid ${themeVars.focus}`,
    },
    outlineOffset: {
      ':focus-visible': "2px",
    },
    padding: "0.75rem",
    resize: "vertical",
    width: "100%",
    '::placeholder': {
      color: themeVars.textSubtle,
    },
    cursor: {
      ':disabled': "not-allowed",
    },
    opacity: {
      ':disabled': 0.5,
    },
  },
});

export { Textarea };
