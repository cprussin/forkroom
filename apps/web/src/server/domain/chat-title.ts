const MAX_TITLE_LENGTH = 48;

/**
 * Derive a chat's display title from its first message, ChatGPT-style: collapse
 * whitespace, then keep a short prefix, truncating on a word boundary with an
 * ellipsis when the message is long. Blank content falls back to a placeholder.
 */
export const deriveChatTitle = (content: string): string => {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return "New chat";
  } else if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized;
  } else {
    const clipped = normalized.slice(0, MAX_TITLE_LENGTH);
    const lastSpace = clipped.lastIndexOf(" ");
    const base = lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped;
    return `${base.trimEnd()}…`;
  }
};
