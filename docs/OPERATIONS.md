# Exploitation / Operations

## Scope

This is the source repository for the independent Cloudflare Worker **motel-a-vendre**, serving `motelavendre.ca` and redirecting `www.motelavendre.ca`. The production website has already been published. Repository creation or a Git push is not a deployment.

Do not deploy this project to the main site's Worker. No GitHub deployment secrets or automatic deployment workflow are configured here.

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
