import type { Result } from "@cprussin/option-result";
import { Err, Ok } from "@cprussin/option-result";
import { ChatEventType } from "../../contracts/chat-events";
import { withTransaction } from "../db/client";
import { getPool } from "../db/pool";
import { canManageInvites } from "../domain/authorization";
import type { IdGenerator } from "../domain/ids";
import { newId as defaultNewId } from "../domain/ids";
import {
  assessInvite,
  defaultInviteExpiry,
  generateInviteToken,
  hashInviteToken,
  InviteRejectionReason,
} from "../domain/invites";
import { getChatPreview } from "../repositories/chats";
import {
  appendAuditEntry,
  getInviteByHash,
  incrementInviteUse,
  insertInvite,
  revokeInvite as revokeInviteRow,
} from "../repositories/invites";
import {
  getMember,
  getMemberRole,
  insertMember,
} from "../repositories/members";
import { appendOutboxEvent } from "../repositories/outbox";
import type { DomainError } from "./domain-error";
import { DomainErrors } from "./domain-error";

export type CreatedInvite = {
  inviteId: string;
  token: string;
  expiresAt: string;
};

/** Creator-only: mint an invitation and store only its hash. */
export const createInvite = (
  input: { chatId: string; userId: string; now?: Date },
  pool = getPool(),
  mint: IdGenerator = defaultNewId,
): Promise<Result<CreatedInvite, DomainError>> =>
  withTransaction(async (tx) => {
    const role = await getMemberRole(tx, input.chatId, input.userId);
    if (canManageInvites(role)) {
      const now = input.now ?? new Date();
      const token = generateInviteToken();
      const inviteId = mint();
      const expiresAt = defaultInviteExpiry(now);
      await insertInvite(tx, {
        chatId: input.chatId,
        createdByUserId: input.userId,
        expiresAt,
        id: inviteId,
        maxUses: undefined,
        tokenHash: hashInviteToken(token),
      });
      await appendAuditEntry(tx, {
        action: "invite_created",
        actorUserId: input.userId,
        chatId: input.chatId,
        targetId: inviteId,
      });
      return Ok({ expiresAt: expiresAt.toISOString(), inviteId, token });
    } else {
      return Err(DomainErrors.forbidden());
    }
  }, pool);

/** Creator-only: revoke an invitation. Idempotent. */
export const revokeInvite = (
  input: { chatId: string; inviteId: string; userId: string },
  pool = getPool(),
): Promise<Result<true, DomainError>> =>
  withTransaction(async (tx) => {
    const role = await getMemberRole(tx, input.chatId, input.userId);
    if (canManageInvites(role)) {
      await revokeInviteRow(tx, input.chatId, input.inviteId);
      await appendAuditEntry(tx, {
        action: "invite_revoked",
        actorUserId: input.userId,
        chatId: input.chatId,
        targetId: input.inviteId,
      });
      return Ok(true);
    } else {
      return Err(DomainErrors.forbidden());
    }
  }, pool);

export type InvitePreview = { chatTitle: string; creatorDisplayName: string };

/** Minimal, non-leaking invitation preview shown before acceptance. */
export const previewInvite = (
  input: { token: string; now?: Date },
  pool = getPool(),
): Promise<Result<InvitePreview, DomainError>> =>
  withTransaction(async (tx) => {
    const invite = await getInviteByHash(tx, hashInviteToken(input.token));
    if (invite === undefined) {
      return Err(DomainErrors.inviteInvalid());
    } else {
      const assessment = assessInviteRow(invite, input.now ?? new Date());
      if (assessment === undefined) {
        const preview = await getChatPreview(tx, invite.chatId);
        return preview === undefined
          ? Err(DomainErrors.inviteInvalid())
          : Ok({
              chatTitle: preview.title,
              creatorDisplayName: preview.creatorDisplayName,
            });
      } else {
        return Err(assessment);
      }
    }
  }, pool);

export type AcceptedInvite = { chatId: string };

/**
 * Accept an invitation. Idempotent: an existing member is returned unchanged
 * without incrementing the use count or creating a duplicate membership
 * (PRD §7.3). A new membership emits a `member_joined` event.
 */
export const acceptInvite = (
  input: { token: string; userId: string; now?: Date },
  pool = getPool(),
): Promise<Result<AcceptedInvite, DomainError>> =>
  withTransaction(async (tx) => {
    const invite = await getInviteByHash(tx, hashInviteToken(input.token));
    if (invite === undefined) {
      return Err(DomainErrors.inviteInvalid());
    }
    const assessment = assessInviteRow(invite, input.now ?? new Date());
    if (assessment !== undefined) {
      return Err(assessment);
    }

    const existing = await getMemberRole(tx, invite.chatId, input.userId);
    if (existing !== undefined) {
      return Ok({ chatId: invite.chatId });
    }

    await insertMember(tx, invite.chatId, input.userId, "participant");
    await incrementInviteUse(tx, invite.id);
    await appendAuditEntry(tx, {
      action: "membership_accepted",
      actorUserId: input.userId,
      chatId: invite.chatId,
      detail: { inviteId: invite.id },
      targetId: input.userId,
    });
    const member = await getMember(tx, invite.chatId, input.userId);
    if (member !== undefined) {
      await appendOutboxEvent(
        tx,
        invite.chatId,
        ChatEventType.MemberJoined,
        member.userId,
        { member },
      );
    }
    return Ok({ chatId: invite.chatId });
  }, pool);

const assessInviteRow = (
  invite: {
    expiresAt: Date | null;
    revokedAt: Date | null;
    maxUses: number | null;
    useCount: number;
  },
  now: Date,
): DomainError | undefined =>
  assessInvite(
    {
      expiresAt: invite.expiresAt ?? undefined,
      maxUses: invite.maxUses ?? undefined,
      revokedAt: invite.revokedAt ?? undefined,
      useCount: invite.useCount,
    },
    now,
  ).match<DomainError | undefined>({
    Err: (rejection) => {
      switch (rejection.reason) {
        case InviteRejectionReason.Revoked: {
          return DomainErrors.inviteRevoked();
        }
        case InviteRejectionReason.Expired: {
          return DomainErrors.inviteExpired();
        }
        case InviteRejectionReason.Exhausted: {
          return DomainErrors.inviteExhausted();
        }
      }
    },
    Ok: () => undefined,
  });
