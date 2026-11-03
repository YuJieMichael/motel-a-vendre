-- Email alerts for saved searches. Apply once:
-- npx wrangler d1 migrations apply motel-a-vendre-accounts --remote
ALTER TABLE saved_searches ADD COLUMN alerts INTEGER NOT NULL DEFAULT 0 CHECK (alerts IN (0,1));
-- Listing references already reported (or present when alerts were switched on).
ALTER TABLE saved_searches ADD COLUMN seen_refs TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(seen_refs) AND json_type(seen_refs) = 'array');
-- NULL until the first daily check, which records a baseline instead of mailing everything.
ALTER TABLE saved_searches ADD COLUMN alert_checked_at INTEGER;
-- One-click unsubscribe link token (random, per search).
ALTER TABLE saved_searches ADD COLUMN unsubscribe_token TEXT;
CREATE UNIQUE INDEX saved_searches_unsubscribe_idx ON saved_searches(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;
CREATE INDEX saved_searches_alerts_idx ON saved_searches(alerts) WHERE alerts = 1;
