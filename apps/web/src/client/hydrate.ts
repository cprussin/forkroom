import type { ChatSnapshot } from "../contracts/chat-snapshot";
import type { ChatState } from "./chat-reducer";

/**
 * Build the initial reducer state from a snapshot. Every entity's version is
 * seeded to the snapshot cursor so a replayed event at or below the cursor
 * (already reflected in the snapshot) is ignored, while newer events still
 * apply — avoiding an old event clobbering fresher snapshot data on reconnect.
 */
export const hydrateFromSnapshot = (snapshot: ChatSnapshot): ChatState => {
  const entityVersion: Record<string, number> = {};
  const seed = (id: string) => {
    entityVersion[id] = snapshot.cursor;
  };

  const branches = Object.fromEntries(
    snapshot.branches.map((branch) => {
      seed(branch.id);
      return [branch.id, branch];
    }),
  );
  const messages = Object.fromEntries(
    snapshot.messages.map((message) => {
      seed(message.id);
      return [message.id, message];
    }),
  );
  const generations = Object.fromEntries(
    snapshot.generations.map((generation) => {
      seed(generation.id);
      return [generation.id, generation];
    }),
  );
  const members = Object.fromEntries(
    snapshot.members.map((member) => {
      seed(member.userId);
      return [member.userId, member];
    }),
  );

  return {
    branches,
    entityVersion,
    generations,
    lastEventId: snapshot.cursor,
    members,
    messages,
  };
};
