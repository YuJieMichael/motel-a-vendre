-- Staff workspace (motelavendre.ca/admin/). Staff identity comes from the main site's
-- Supabase staff accounts; only their email is recorded here, for the audit trail.

-- Per-listing display settings for this site. Listings themselves stay in the main database.
CREATE TABLE listing_settings (
  listing_reference TEXT PRIMARY KEY CHECK (listing_reference NOT GLOB '*[^0-9]*' AND length(listing_reference) BETWEEN 1 AND 12),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL CHECK (length(updated_by) <= 150)
);

CREATE TABLE staff_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL CHECK (length(actor) <= 150),
  action TEXT NOT NULL CHECK (action IN ('staff_invite','account_confirm','account_delete','listing_hide','listing_show','listing_pin','listing_unpin')),
  target TEXT NOT NULL CHECK (length(target) <= 150),
  at INTEGER NOT NULL
);
CREATE INDEX staff_audit_at_idx ON staff_audit(at);
