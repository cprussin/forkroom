import type { ReactNode } from "react";
import { css } from "../../styled-system/css";

/** Centered single-column layout for landing, sign-in, invite, and error pages. */
export const CenteredPanel = ({ children }: { children: ReactNode }) => (
  <main className={outerStyles}>
    <div className={panelStyles}>{children}</div>
  </main>
);

const outerStyles = css({
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minBlockSize: "100dvh",
  padding: 4,
});

const panelStyles = css({
  backgroundColor: "card",
  border: "1px solid {colors.border}",
  borderRadius: "xl",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  inlineSize: "100%",
  maxInlineSize: 120,
  padding: 6,
});
