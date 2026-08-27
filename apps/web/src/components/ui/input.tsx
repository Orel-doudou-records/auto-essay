import * as React from "react";
import * as stylex from "@stylexjs/stylex";
import { themeVars } from "../../styles/tokens.stylex";

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ type, ...props }, ref) => (
  <input ref={ref} type={type} {...props} {...stylex.props(styles.input)} />
));
Input.displayName = "Input";

const styles = stylex.create({
  input: {
    backgroundColor: themeVars.surface,
    borderColor: themeVars.border,
    borderRadius: themeVars.radiusSmall,
    borderStyle: "solid",
    borderWidth: "1px",
    boxSizing: "border-box",
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontInterface,
    fontSize: "0.875rem",
    minHeight: "2.5rem",
    outline: {
      ':focus-visible': `2px solid ${themeVars.focus}`,
    },
    outlineOffset: {
      ':focus-visible': "2px",
    },
    padding: "0.625rem 0.75rem",
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

export { Input };
