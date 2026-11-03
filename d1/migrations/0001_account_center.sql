-- Motel à vendre account centre on Cloudflare D1 (SQLite).
-- Binding: ACCOUNTS. Fully separate from the main Propriété En Vente database.
-- Apply with: npx wrangler d1 migrations apply motel-a-vendre-accounts --remote

-- D1 enforces foreign keys by default; deletes are also explicit in the API.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 150),
  password_hash TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr','en','zh')),
  consent_at INTEGER NOT NULL,
  verified_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

-- One-time email links (verify address, reset password). Only hashes are stored.
CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens(user_id, purpose);

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '' CHECK (length(full_name) <= 80),
  phone TEXT NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
  preferred_language TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('fr','en','zh')),
  buyer_budget INTEGER CHECK (buyer_budget IS NULL OR buyer_budget BETWEEN 0 AND 1000000000),
  buyer_regions TEXT NOT NULL DEFAULT '' CHECK (length(buyer_regions) <= 120),
  buyer_timeline TEXT NOT NULL DEFAULT '' CHECK (buyer_timeline IN ('','exploring','0-3','3-6','6+')),
  updated_at INTEGER NOT NULL
);

CREATE TABLE saved_listings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_reference TEXT NOT NULL CHECK (listing_reference NOT GLOB '*[^0-9]*' AND length(listing_reference) BETWEEN 1 AND 12),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, listing_reference)
);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  criteria TEXT NOT NULL CHECK (json_valid(criteria) AND json_type(criteria) = 'object' AND length(criteria) <= 2048),
  created_at INTEGER NOT NULL
);
CREATE INDEX saved_searches_user_idx ON saved_searches(user_id, created_at);

-- Record of enquiries sent while signed in: no message text, no contact details.
CREATE TABLE enquiry_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('buyer','seller')),
  purpose TEXT NOT NULL CHECK (purpose IN ('info','viewing','documents')),
  listing_reference TEXT NOT NULL DEFAULT '' CHECK (listing_reference = '' OR (listing_reference NOT GLOB '*[^0-9]*' AND length(listing_reference) <= 12)),
  language TEXT NOT NULL CHECK (language IN ('fr','en','zh')),
  sent_at INTEGER NOT NULL
);
CREATE INDEX enquiry_history_user_idx ON enquiry_history(user_id, sent_at);

-- Fixed-window counters keyed by a hash of (action, IP or email). No raw IPs stored.
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
