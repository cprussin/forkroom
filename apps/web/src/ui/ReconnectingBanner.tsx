"use client";

import { css } from "../../styled-system/css";

/**
 * Non-blocking banner shown while the realtime connection is down. Sends are
 * disabled by the composer meanwhile (PRD §6.4).
 */
export const ReconnectingBanner = () => (
  <div className={bannerStyles} role="status">
    <span aria-hidden="true" className={dotStyles} />
    Reconnecting to live updates…
  </div>
);

const bannerStyles = css({
  alignItems: "center",
  backgroundColor: "warning",
  color: "background",
  display: "flex",
  fontSize: "sm",
  fontWeight: "semibold",
  gap: 2,
  justifyContent: "center",
  paddingBlock: 1.5,
});

const dotStyles = css({
  animationDuration: "pulse",
  animationIterationCount: "infinite",
  animationName: "pulse",
  backgroundColor: "background",
  blockSize: 2,
  borderRadius: "full",
  inlineSize: 2,
});
