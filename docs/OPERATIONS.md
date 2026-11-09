# Exploitation / Operations

## Scope

This is the source repository for the independent Cloudflare Worker **motel-a-vendre**, serving `motelavendre.ca` and redirecting `www.motelavendre.ca`.

**Deployment is automatic from `main`** through Cloudflare Workers Builds (connected in the Cloudflare dashboard, not GitHub Actions). Every push to `main` runs:

- Build command: `npm run build && npm run prepare:release && npm test`
- Deploy command: `npx wrangler@4.151.1 deploy -c release/wrangler.jsonc`

A failing build or test stops the deployment. Work on another branch and merge to `main` only when the change should go live. Roll back from Workers → motel-a-vendre → Deployments. No Cloudflare credentials are stored in GitHub. Do not deploy this project to the main site's Worker.

## Build and release preparation

Use Node.js 24 or later:

```sh
npm run build
npm run prepare:release
npm test
npm run test:backend
```

`dist/` is the static local-preview build and remains non-indexable. `release/` is a separate indexable Cloudflare candidate with generated hashes, headers, asset manifest, dynamic rendering code and `wrangler.jsonc`. Both directories are ignored by Git.

With `directEnquiries: true` in `data/site-config.js`, the standard CLI build enables the existing Motel intake and performs its non-writing live check. Enquiries stay on this site; the endpoint and internal notification pipeline are unchanged. The explicit equivalent is:

```sh
npm run prepare:release -- --direct-enquiries
```

That option makes only an `OPTIONS` preflight and a deliberately invalid `{}` validation request to the configured intake. It must receive 204 and 400 with the canonical CORS origin and records `intake.verification: "non-writing-live-check"`. It sends no valid enquiry or email. Release preparation does not deploy. If direct intake is disabled, visitors can keep a local draft; there is no external enquiry or account redirect.

For an offline local review only, set `MAV_INTAKE_CHECK=offline` before preparing the candidate. Its manifest records `intake.verification: "not-run"` and `offlineSkipped: true`; do not describe this as a successful live check. Keep the normal Cloudflare build environment free of that override.

For an approved production update, review the generated release manifest, routes and intake mode first, then use the official Wrangler CLI with `release/wrangler.jsonc`. The deployed build used Wrangler **4.151.1**, with compatibility date **2026-10-19**. Authentication belongs to the operator's credential store, never this repository.

## Listings, photos and indexing

Motel à vendre owns its listings. They live in this site's D1 (`ACCOUNTS`, table `listings`, migration `0005_own_listings.sql`) and are managed in the staff workspace (**Listings** tab). Nothing is read from another site or database. Migration 0005 imports the six listings published on 2026-11-09 (same content as the live catalogue that day, with the approved illustrative covers); imported photos stay static assets under `assets/main/` and `assets/covers/`.

Photos added from the admin are resized and converted to WebP **in the browser** (max. 1600 px, keeps the Worker within the Free-plan CPU limit), then uploaded to the R2 bucket `motel-a-vendre-photos` (binding `PHOTOS`) under `listings/<reference>/<random>.webp`. The Worker serves them at `/assets/listings/...` with a one-year immutable cache. Removing a photo from a listing deletes it from R2 when the listing is saved.

The public catalogue reads published rows from D1 (in-memory copy for one minute, cleared immediately after a staff change). On a D1 error the last good copy is kept (`stale`), otherwise the bundled `data/catalogue.json` snapshot is served (`fallback`); `/api/catalogue` reports the status. The sitemap is dynamic. Root requests redirect to French. Keep the public Google verification HTML file available during rebuilds.

**Free first month.** A listing saved with “Free first month” and the seller's email is published for 30 days from its publication date. The daily Cron Trigger (`17 13 * * *` UTC) emails the seller 7 days before the end, unpublishes the listing at the end (status `expired`, audited as `listing_expire`) and sends one removal notice. Emails come from `MAIL_FROM` with the owner (`ownerEmail` in `data/site-config.js`) as reply-to. Nothing is ever charged. Staff use **Extend 30 days** to renew. Imported listings are not free and never expire.

**Visit counts.** The public pages post bounded aggregate events to `/api/events` (D1 `metric_counts`: day, event, language, broad source, listing reference, count). No names, emails, URLs, query strings or IP addresses are stored. Do Not Track, Global Privacy Control and `?qa=1` are respected in the browser. Staff see 30-day totals in the **Visits** tab.

`data/illustrative-covers.json` records the attribution and hashes of the approved illustrative covers. Keep illustration labels visible.

## Read-only production checks

Check HTTPS, root/www redirects, `/api/catalogue` live status and freshness, all language homepages, a current property, the guides and the sitemap. Intake checks use only `OPTIONS` and invalid `{}` requests. Never submit a valid production enquiry or analytics event just to test availability. Do not repeatedly resubmit the sitemap or change account access during routine monitoring.

## Account centre (Cloudflare D1)

The optional buyer account centre (`/fr/compte/`, `/en/account/`, `/zh/account/`) is served by this Worker at `/api/account/*` and stores its data in a dedicated **Cloudflare D1** database bound as `ACCOUNTS`. It never shares users or tables with the main Propriété En Vente platform. While `data/site-config.js` → `account.enabled` is `false` (the default), the page shows "coming soon", the menu link is hidden and the API answers 404.

One-time setup by the operator:

1. `npx wrangler d1 create motel-a-vendre-accounts --location enam` and copy the returned `database_id` into `account.d1DatabaseId`.
2. `npx wrangler d1 migrations apply motel-a-vendre-accounts --remote` (migrations live in `d1/migrations/`).
3. Email: create a Resend account, verify the `motelavendre.ca` sending domain (DNS records in Cloudflare), then add `RESEND_API_KEY` as a Worker **secret** (dashboard → Workers → motel-a-vendre → Settings → Variables and Secrets, or `npx wrangler secret put RESEND_API_KEY`). The sender, `account.mailFrom` (`Motel à vendre <compte@mail.motelavendre.ca>` on the verified Resend domain `mail.motelavendre.ca`), is written by `prepare:release` as the `MAIL_FROM` variable. Without them sign-up and password reset answer 503; nothing is sent from any other service.
4. Set `account.privacyContact` (person in charge of personal information, Québec Law 25) and `account.enabled: true`. `prepare:release` refuses to build an enabled release without the database id or the privacy contact, and adds the D1 binding to `release/wrangler.jsonc`.

Security model: passwords are salted PBKDF2-SHA256 (20 000 iterations by default, see the CPU note); sessions are random 256-bit tokens in an `HttpOnly; Secure; SameSite=Lax` `__Host-` cookie, stored only as SHA-256 hashes (30 days). Every API call needs the `X-MAV-Account: 1` header and a same-origin `Origin`, so cross-site requests fail. Email links carry one-time tokens in the URL fragment (`#verify=` 48 h, `#reset=` 1 h), so mail scanners and logs never spend or record them. Sign-up, sign-in, recovery and link use are rate limited (hashed buckets, no raw IPs). Responses never reveal whether an address is registered. A password reset signs out every other session. Unconfirmed accounts are removed after 7 days. The account API refuses plain HTTP outside local preview.

CPU note: the site runs on the Workers Free plan (10 ms CPU per request), so the default is 20 000 PBKDF2 rounds (about 3–4 ms; a request computes at most one hash, two only during an upgrade). This is weaker than the 100 000 rounds Workers allows, which matters only if the database itself leaks; rate limits protect against online guessing. After moving to Workers Paid, set the plain variable `PASSWORD_ITERATIONS` to `100000` (Worker settings → Variables): every hash is upgraded at that user's next sign-in.

Stored per user: profile, favourite references (max 200), saved searches (max 20) and an enquiry log (type, purpose, reference, date, receipt id — never the message or contact details; max 500). Users can export everything as JSON and delete their account after re-entering the password; deletion removes every row explicitly. Signing out clears favourites, recent views and drafts on the device.

Local preview: set `account.enabled: true` locally, run `npm run build && npm start`; the preview server runs the same API on a SQLite file in `.local/` (ignored by Git) and prints confirmation and reset emails in the terminal.

Saved-search alerts: a daily Cron Trigger (`17 13 * * *` UTC) checks every saved search with alerts on and emails only listings it has not reported before; the first check after alerts are switched on records a baseline and sends nothing. At most 80 alert emails per run (Resend free tier); the rest go out the next day. Each email has a one-click `List-Unsubscribe` header and an unsubscribe link (`#unsubscribe=` on the account page). Migration `0002_search_alerts.sql` must be applied before deploying this code.

Turnstile: widget "motelavendre.ca account" (site key in `account.turnstileSiteKey`) protects sign-up and password-reset requests. The server enforces it only once the Worker secret `TURNSTILE_SECRET` exists. Only the account page allows `https://challenges.cloudflare.com` in `script-src`/`frame-src`.

Direct enquiries: `directEnquiries: true` makes `prepare:release` verify the intake (OPTIONS + invalid `{}` only) and send enquiries straight from motelavendre.ca, so signed-in users get an enquiry log. A failed check stops the build. In an offline sandbox, `MAV_INTAKE_CHECK=offline` skips the network check (never in CI).

## Staff workspace / Espace administration / 管理后台

`https://motelavendre.ca/admin/` mirrors the Propriété En Vente admin (same layout, wording and styles) but is **fully independent** of it: everything below lives in this site's D1 (`ACCOUNTS`) and is served by this Worker at `/api/admin/*`. Tabs: enquiries, buyer accounts, listings on this site, activity log and, for the owner only, invite a member.

- **Staff accounts** (`staff_members`, `staff_sessions`, `staff_tokens`): the owner `achat.vente.garderie@gmail.com` is seeded by migration 0004 without a password; on first use choose “First sign-in or forgot your password?” to receive a one-hour link. Passwords use the buyer-account PBKDF2 format. Sessions are an HttpOnly `__Host-mav_staff` cookie (SameSite=Strict, 12 hours); writes also require the `X-MAV-Admin: 1` header and this origin.
- **Invitations (owner only):** enter an email; the person receives a 7-day link from `MAIL_FROM` to choose a password and becomes an operator. No prior account is needed. The owner can resend, deactivate (ends sessions at once) and reactivate members. Operators cannot invite.
- **Enquiries:** the public form posts to `/api/enquiry` (`intake: "site"` in `data/site-config.js`). The Worker validates like the former Supabase intake, stores the enquiry in D1 `enquiries` (idempotent on `requestId`, rate-limited per connection and email) and emails the active owner(s), with Reply-To set to the enquirer. Staff accept, reopen, delete and restore them. Enquiries received before this change stay in the main site's database.
- **Buyer accounts:** D1 `users` — search, confirm manually (also invalidates outstanding confirmation links), delete (cascades).
- **Listings:** create, edit, upload photos, publish, unpublish and renew free listings (see *Listings, photos and indexing*). D1 `listing_settings` still hides or pins a published listing; public pages pick changes up within a minute.
- **Audit:** D1 `staff_audit` records the staff email, action and target.
- **Visits:** 30-day aggregate counts from D1 `metric_counts`.

Deploy (listings release, 1.11.0), in this order:

1. Create the R2 bucket once: dashboard → R2 → Create bucket `motel-a-vendre-photos` (or `npx wrangler r2 bucket create motel-a-vendre-photos`). The deploy fails if the bucket does not exist.
2. Apply D1 migration `0005_own_listings.sql` to `motel-a-vendre-accounts` (`npx wrangler d1 migrations apply motel-a-vendre-accounts --remote`, or paste it into the dashboard console and record it in `d1_migrations`).
3. Merge to `main`, then check that the Workers build for that commit succeeded, `/api/catalogue` reports `live` with six listings, and an admin photo upload works.
