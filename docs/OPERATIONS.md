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
npm test
npm run test:backend
npm run prepare:release
```

`dist/` is the static local-preview build and remains non-indexable. `release/` is a separate indexable Cloudflare candidate with generated hashes, headers, asset manifest, dynamic rendering code and `wrangler.jsonc`. Both directories are ignored by Git.

The default release candidate uses main-site enquiry hand-off. To prepare a candidate with the deployed Motel direct intake, explicitly run:

```sh
npm run prepare:release -- --direct-enquiries
```

That option makes only an `OPTIONS` preflight and a deliberately invalid `{}` validation request to the configured intake. It must receive 204 and 400 with the canonical CORS origin. It sends no valid enquiry or email. Release preparation does not deploy.

For an approved production update, review the generated release manifest, routes and intake mode first, then use the official Wrangler CLI with `release/wrangler.jsonc`. The deployed build used Wrangler **4.151.1**, with compatibility date **2026-10-19**. Authentication belongs to the operator's credential store, never this repository.

## Catalogue, images and indexing

The Worker reads only `published_listings` with the public browser key and a restricted field selection. Normal live-cache freshness is five minutes. On a source failure it uses the dated validated fallback, backs off for one minute and reports its state through `/api/catalogue`. Withdrawn listings return 404; uncertain unknown references during an outage return 503.

The sitemap is dynamic. Root requests redirect to French. Page canonical URLs, language alternates, structured data and security headers are generated per route. Keep the public Google verification HTML file available during rebuilds.

`data/catalogue.json` and `data/source-manifest.json` are public snapshots, not private exports. Optional `scripts/sync-main.cjs` reads public records only. Its configuration file must contain only a public project URL and publishable key. Syncing a review file also downloads public images and updates the local source manifest; it is not a deployment.

`data/illustrative-covers.json` records the attribution and hashes of the four approved illustrative covers. Keep illustration labels visible. Confidential property images are not part of this repository. The three older PNGs are retained for the demo test fixtures.

## Supabase backend

`supabase/functions/motel-services` handles `/enquiry` and `/events`. Local preview requests on `http://127.0.0.1:5173` exercise validation without database writes. Production intake allows only the two exact Motel HTTPS origins, validates the browser application key and request payload, and calls service-only SQL functions.

The function uses these environment variables, managed in Supabase:

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Server project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database client credential |
| `SUPABASE_PUBLISHABLE_KEY` | Accepted public browser key |
| `SUPABASE_PUBLISHABLE_KEYS` | Optional JSON map of accepted browser keys |
| `SUPABASE_ANON_KEY` | Optional legacy public browser key |
| `ENQUIRY_RATE_SALT` | Optional server-side rate hash salt; otherwise the service key is used |

Never place server secrets in frontend configuration, Git, a workflow log or screenshots. `verify_jwt = false` is intentional for this anonymous public intake: the handler checks the application key itself, enforces exact origins, bounds request bodies, validates the payload, and applies database rate limits. A browser key is public and is not a substitute for private-data authorization. Anonymous browser clients cannot read the private metric tables or call the collection RPCs.

The migration is an **extension of the existing platform**, not an empty-project bootstrap. It requires the existing `private` schema, `public.enquiries`, `public.published_listings`, and `public.collect_enquiry(uuid,jsonb,text)`. It adds isolated Motel metrics, deduplication receipts, and service-role-only RPCs. Those objects are already deployed; do not blindly reapply this migration to production.

The existing platform notification job sends enquiry emails. No recipient mailbox, email-provider credential, main-site notification implementation or private acceptance evidence is stored in this repository. A successful API receipt proves collection; actual mailbox delivery is a separate operational check requiring explicit permission for a real message.

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

Not included yet: saved-search email alerts (needs a Cron Trigger and unsubscribe links) and CAPTCHA on sign-up (Turnstile would need `https://challenges.cloudflare.com` in `script-src` and `frame-src`).
