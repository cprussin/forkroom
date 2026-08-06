"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { css } from "../../styled-system/css";

/**
 * Render assistant/user content as sanitized Markdown. `react-markdown` does
 * not render raw HTML unless `rehype-raw` is added — it isn't — so model and
 * user text is treated strictly as data (PRD §12).
 */
export const Markdown = ({ content }: { content: string }) => (
  <div className={proseStyles}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
);

const proseStyles = css({
  "& a": { color: "accent", textDecoration: "underline" },
  "& code": {
    backgroundColor: "card",
    borderRadius: "sm",
    fontFamily: "mono",
    fontSize: "0.9em",
    paddingBlock: 0.5,
    paddingInline: 1,
  },
  "& p": { marginBlock: 1 },
  "& pre": {
    backgroundColor: "card",
    borderRadius: "md",
    overflowX: "auto",
    padding: 3,
  },
  "& pre code": { backgroundColor: "transparent", padding: 0 },
  "& ul, & ol": { marginBlock: 1, paddingInlineStart: 5 },
  color: "foreground",
  fontSize: "sm",
  lineHeight: "normal",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
});
