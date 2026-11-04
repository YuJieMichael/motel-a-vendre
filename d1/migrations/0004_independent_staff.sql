-- Independent staff workspace: staff accounts, invitations and enquiries live in this D1
-- database, fully separate from the main Propriété En Vente backend.

-- Staff accounts. Passwords use the same PBKDF2 format as buyer accounts.
CREATE TABLE staff_members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 150),
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner','operator')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  invited_by TEXT NOT NULL DEFAULT '' CHECK (length(invited_by) <= 150),
  language TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr','en','zh')),
  created_at INTEGER NOT NULL,
  password_set_at INTEGER
);

CREATE TABLE staff_sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX staff_sessions_staff_idx ON staff_sessions(staff_id);

-- One-time links: 'invite' (7 days) and 'reset' (1 hour). Only hashes are stored.
CREATE TABLE staff_tokens (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
  expires_at INTEGER NOT NULL
);
CREATE INDEX staff_tokens_staff_idx ON staff_tokens(staff_id, purpose);

-- The platform owner. A password is chosen through an emailed link on first sign-in.
INSERT INTO staff_members(id,email,role,active,invited_by,language,created_at)
VALUES('5f0c6a3e-8d2b-4c1e-9a7f-0b3d2e1c4a5b','achat.vente.garderie@gmail.com','owner',1,'',
'zh',CAST(strftime('%s','now') AS INTEGER));

-- Enquiries sent from motelavendre.ca (buyer and seller), with staff triage.
CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('buyer','seller')),
  language TEXT NOT NULL CHECK (language IN ('fr','en','zh')),
  email TEXT NOT NULL CHECK (length(email) <= 254),
  listing_reference TEXT NOT NULL DEFAULT '' CHECK (length(listing_reference) <= 36),
  payload TEXT NOT NULL CHECK (json_valid(payload) AND length(payload) <= 16000),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','accepted')),
  deleted_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 0,
  notified_at INTEGER
);
CREATE INDEX enquiries_created_idx ON enquiries(created_at);

-- staff_audit from 0003 is still empty; recreate it with the full action list.
DROP TABLE staff_audit;
CREATE TABLE staff_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL CHECK (length(actor) <= 150),
  action TEXT NOT NULL CHECK (action IN ('staff_invite','staff_deactivate','staff_activate','staff_resend','staff_password',
    'account_confirm','account_delete','listing_hide','listing_show','listing_pin','listing_unpin',
    'enquiry_accept','enquiry_reopen','enquiry_delete','enquiry_restore')),
  target TEXT NOT NULL CHECK (length(target) <= 150),
  at INTEGER NOT NULL
);
CREATE INDEX staff_audit_at_idx ON staff_audit(at);
