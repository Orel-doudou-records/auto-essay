import * as React from "react";
import * as stylex from "@stylexjs/stylex";
import { themeVars } from "../../styles/tokens.stylex";

export type LabelProps = Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "className">;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>((props, ref) => (
  <label ref={ref} {...props} {...stylex.props(styles.label)} />
));
Label.displayName = "Label";

const styles = stylex.create({
  label: {
    color: themeVars.textPrimary,
    fontFamily: themeVars.fontInterface,
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.2,
  },
});

export { Label };
