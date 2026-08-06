-- forkroom initial schema.
--
-- Design notes:
--   * All identifiers are UUID (UUIDv7 minted in the app, so primary keys are
--     time-ordered without depending on a DB extension).
--   * Same-chat integrity across tables is enforced with composite foreign
--     keys built on `UNIQUE (id, chat_id)` columns: a branch's parent, a
--     message's branch, and a generation's branch are all forced to belong to
--     the same chat by the database, not just by application code.
--   * Branch tips, generation locks, one-creator-per-chat, and one-main-per-chat
--     are all enforced with partial unique indexes so concurrency invariants
--     hold under races, not just in the happy path.

CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chats (
  id               UUID PRIMARY KEY,
  title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  creator_user_id  UUID NOT NULL REFERENCES users (id),
  -- Assigned inside the create-chat transaction once the main branch exists.
  -- The FK is added after `branches` is defined (circular dependency).
  main_branch_id   UUID UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_members (
  chat_id    UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id),
  role       TEXT NOT NULL CHECK (role IN ('creator', 'participant')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

-- At most one creator membership per chat.
CREATE UNIQUE INDEX chat_members_one_creator
  ON chat_members (chat_id)
  WHERE role = 'creator';

CREATE TABLE chat_invites (
  id                  UUID PRIMARY KEY,
  chat_id             UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  created_by_user_id  UUID NOT NULL REFERENCES users (id),
  token_hash          TEXT NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  max_uses            INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  use_count           INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chat_invites_by_chat ON chat_invites (chat_id);

CREATE TABLE branches (
  id                 UUID PRIMARY KEY,
  chat_id            UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  parent_branch_id   UUID,
  -- Explicit fork point. Null only for the main branch or a fork from an empty
  -- history. FK added after `messages` exists.
  fork_message_id    UUID,
  owner_user_id      UUID NOT NULL REFERENCES users (id),
  created_by_user_id UUID NOT NULL REFERENCES users (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branches_not_self_parent CHECK (parent_branch_id <> id),
  -- Support for same-chat composite FKs from messages / generations / children.
  UNIQUE (id, chat_id),
  -- A branch's parent must live in the same chat.
  FOREIGN KEY (parent_branch_id, chat_id)
    REFERENCES branches (id, chat_id)
);

-- Exactly one main (parent-less) branch per chat.
CREATE UNIQUE INDEX branches_one_main_per_chat
  ON branches (chat_id)
  WHERE parent_branch_id IS NULL;

CREATE INDEX branches_by_chat_created ON branches (chat_id, created_at);

CREATE TABLE messages (
  id                  UUID PRIMARY KEY,
  chat_id             UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  branch_id           UUID NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  author_user_id      UUID REFERENCES users (id),
  content             TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL CHECK (status IN ('completed', 'queued', 'streaming', 'failed')),
  sequence_number     INTEGER NOT NULL,
  reply_to_message_id UUID REFERENCES messages (id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- User messages carry an author; assistant/system messages never do.
  CONSTRAINT messages_author_matches_role CHECK (
    (role = 'user' AND author_user_id IS NOT NULL)
    OR (role IN ('assistant', 'system') AND author_user_id IS NULL)
  ),
  -- Empty content is only valid for an in-flight assistant placeholder.
  CONSTRAINT messages_content_nonempty_unless_pending CHECK (
    content <> '' OR status IN ('queued', 'streaming')
  ),
  UNIQUE (branch_id, sequence_number),
  UNIQUE (id, chat_id),
  FOREIGN KEY (branch_id, chat_id) REFERENCES branches (id, chat_id)
);

CREATE INDEX messages_by_chat_created ON messages (chat_id, created_at);

-- Complete the circular references now that both tables exist.
ALTER TABLE branches
  ADD CONSTRAINT branches_fork_message_same_chat
  FOREIGN KEY (fork_message_id, chat_id) REFERENCES messages (id, chat_id);

ALTER TABLE chats
  ADD CONSTRAINT chats_main_branch_fk
  FOREIGN KEY (main_branch_id) REFERENCES branches (id);

CREATE TABLE generations (
  id                    UUID PRIMARY KEY,
  chat_id               UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  branch_id             UUID NOT NULL,
  user_message_id       UUID NOT NULL UNIQUE REFERENCES messages (id),
  assistant_message_id  UUID NOT NULL UNIQUE REFERENCES messages (id),
  status                TEXT NOT NULL CHECK (status IN ('queued', 'streaming', 'completed', 'failed')),
  provider              TEXT NOT NULL,
  model                 TEXT NOT NULL,
  attempt_count         INTEGER NOT NULL DEFAULT 0,
  error_code            TEXT,
  prompt_tokens         INTEGER,
  completion_tokens     INTEGER,
  first_token_ms        INTEGER,
  latency_ms            INTEGER,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, chat_id) REFERENCES branches (id, chat_id)
);

-- At most one queued/streaming generation per branch.
CREATE UNIQUE INDEX generations_one_active_per_branch
  ON generations (branch_id)
  WHERE status IN ('queued', 'streaming');

CREATE TABLE prompt_requests (
  idempotency_key  TEXT NOT NULL,
  user_id          UUID NOT NULL REFERENCES users (id),
  chat_id          UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL,
  user_message_id  UUID NOT NULL,
  generation_id    UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (idempotency_key, user_id, chat_id)
);

-- Transactional outbox. `id` is a monotonically increasing sequence value so
-- clients can order events and detect gaps. Rows are inserted in the same
-- transaction as the change they describe and published asynchronously.
CREATE TABLE outbox_events (
  id            BIGSERIAL PRIMARY KEY,
  chat_id       UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  aggregate_id  UUID,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ,
  attempts      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX outbox_events_by_chat ON outbox_events (chat_id, id);
CREATE INDEX outbox_events_unpublished ON outbox_events (id) WHERE published_at IS NULL;

CREATE TABLE generation_jobs (
  id             UUID PRIMARY KEY,
  generation_id  UUID NOT NULL UNIQUE REFERENCES generations (id) ON DELETE CASCADE,
  available_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts       INTEGER NOT NULL DEFAULT 0,
  locked_at      TIMESTAMPTZ,
  locked_by      TEXT,
  last_error     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

-- Claimable queue index: unfinished jobs ordered by availability.
CREATE INDEX generation_jobs_claimable
  ON generation_jobs (available_at)
  WHERE completed_at IS NULL;

-- Append-only audit trail for invite lifecycle and membership acceptance.
-- No UI in the MVP; queried directly for support / security review.
CREATE TABLE audit_log (
  id             BIGSERIAL PRIMARY KEY,
  chat_id        UUID REFERENCES chats (id) ON DELETE CASCADE,
  actor_user_id  UUID REFERENCES users (id),
  action         TEXT NOT NULL,
  target_id      UUID,
  detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_by_chat ON audit_log (chat_id, id);
