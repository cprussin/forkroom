import { z } from "zod";

/**
 * A member's role within a chat. In-memory code uses this enum; the database
 * stores the wire strings `"creator"` / `"participant"`. The codec below maps
 * between the two at the boundary so the enum never leaks onto the wire.
 */
export enum Role {
  Creator = 0,
  Participant = 1,
}

const ROLE_TO_WIRE: Record<Role, "creator" | "participant"> = {
  [Role.Creator]: "creator",
  [Role.Participant]: "participant",
};

export const roleToWire = (role: Role): "creator" | "participant" =>
  ROLE_TO_WIRE[role];

export const roleFromWire = (wire: "creator" | "participant"): Role =>
  wire === "creator" ? Role.Creator : Role.Participant;

/** Zod codec: parses the DB string and yields the in-memory `Role` enum. */
export const roleSchema = z
  .enum(["creator", "participant"])
  .transform(roleFromWire);
