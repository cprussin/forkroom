-- A generation that fails before the model emits any text leaves its assistant
-- placeholder with empty content and status 'failed'. The original constraint
-- only permitted empty content while 'queued' or 'streaming', so persisting the
-- failure violated the check — wedging the generation at 'streaming' forever and
-- permanently blocking the branch. Allow 'failed' to carry empty content too.
ALTER TABLE messages
  DROP CONSTRAINT messages_content_nonempty_unless_pending;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_nonempty_unless_pending CHECK (
    content <> '' OR status IN ('queued', 'streaming', 'failed')
  );
