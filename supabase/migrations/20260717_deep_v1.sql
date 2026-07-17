-- DEEP UPDATE v1 — support indexes only. The feature tables
-- (relationship_connections, graph_positions, email_inbox,
-- sequence_analytics_daily, reply_snippets) were already migrated live and are
-- verified; this adds what the new UI needs to upsert/dedupe fast.

-- Inbox dedupe: gmail-sync upserts on (user_id, gmail_message_id)
CREATE UNIQUE INDEX IF NOT EXISTS email_inbox_user_gmail_msg_uniq
  ON public.email_inbox (user_id, gmail_message_id);

-- Inbox list is always "newest first for this user"
CREATE INDEX IF NOT EXISTS email_inbox_user_received_idx
  ON public.email_inbox (user_id, received_at DESC);

-- Graph position hydration is a single per-user fetch
CREATE INDEX IF NOT EXISTS graph_positions_user_idx
  ON public.graph_positions (user_id);

-- graph_positions upserts on (user_id, client_id)
CREATE UNIQUE INDEX IF NOT EXISTS graph_positions_user_client_uniq
  ON public.graph_positions (user_id, client_id);

-- snippet shortcuts are unique per user (":thanks" can only mean one thing)
CREATE UNIQUE INDEX IF NOT EXISTS reply_snippets_user_shortcut_uniq
  ON public.reply_snippets (user_id, shortcut);
