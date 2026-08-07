import { forkLabel } from "./fork-label";

/**
 * The banner headline naming the fork whose thread is on screen, e.g.
 * "Viewing Alice's fork". Owner names are always a real member (never "You"),
 * so the possessive comes straight from {@link forkLabel}.
 */
export const viewingForkLabel = (ownerName: string): string =>
  `Viewing ${forkLabel(ownerName)}`;
