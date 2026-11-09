// Staff workspace API, served at /api/admin/* (motelavendre.ca/admin/).
// Fully independent: staff accounts, sessions, invitations, enquiries, buyer accounts,
// listings and their display settings live in this site's D1 (binding ACCOUNTS);
// including listing photos (listing_photos). Nothing outside this site is read.
import { hashPassword, verifyPassword } from './account-api.mjs';
import { itemFromInput, sellerFromInput, nextReference, rowView, photoKey, photoTypeOf, newPhotoPath, photoStore, ListingError, FREE_DAYS, PHOTO_MAX_BYTES, PHOTOS_PER_LISTING } from './listings.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^\d{1,12}$/, TOKEN = /^[A-Za-z0-9_-]{43}$/;
const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const LANGS = ['fr', 'en', 'zh'], PAGE = 50;
const SESSION_HOURS = 12, INVITE_HOURS = 168, RESET_HOURS = 1;

// Wording follows the buyer-account emails (account-api.mjs).
const MAIL = {
  invite: {
    fr: ['Invitation à l’administration Motel à vendre', 'Bonjour,\n\n{owner} vous invite à rejoindre l’équipe d’administration de Motel à vendre.\n\nChoisissez votre mot de passe pour activer votre accès :\n{link}\n\nCe lien expire dans 7 jours. Si vous ne vous attendiez pas à ce message, ignorez-le.'],
    en: ['Invitation to the Motel à vendre admin', 'Hello,\n\n{owner} has invited you to join the Motel à vendre admin team.\n\nChoose your password to activate your access:\n{link}\n\nThis link expires in 7 days. If you did not expect this message, ignore it.'],
    zh: ['Motel à vendre 管理后台邀请', '您好：\n\n{owner} 邀请您加入 Motel à vendre 管理团队。\n\n请点击以下链接设置密码，开通您的后台权限：\n{link}\n\n链接 7 天内有效。如非预期，请忽略此邮件。']
  },
  reset: {
    fr: ['Votre mot de passe d’administration Motel à vendre', 'Bonjour,\n\nPour choisir votre mot de passe d’administration Motel à vendre, ouvrez ce lien :\n{link}\n\nCe lien expire dans une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.'],
    en: ['Your Motel à vendre admin password', 'Hello,\n\nTo choose your Motel à vendre admin password, open this link:\n{link}\n\nThis link expires in one hour. If you did not request it, ignore this email.'],
    zh: ['设置 Motel à vendre 管理后台密码', '您好：\n\n请打开以下链接设置 Motel à vendre 管理后台密码：\n{link}\n\n链接 1 小时内有效。如非本人操作，请忽略此邮件。']
  }
};

class AdminError extends Error { constructor(status, code, retryAfter) { super(code); this.status = status; this.code = code; this.retryAfter = retryAfter; } }
const enc = new TextEncoder();
const hex = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const lang = v => LANGS.includes(v) ? v : 'fr';
// Unknown emails still pay for one PBKDF2 check, so response time does not reveal staff addresses.
let dummyHash = null;
const dummy = async () => dummyHash || (dummyHash = await hashPassword('timing-equaliser-' + randomToken()));

export function createAdminApi({ site, now = () => Date.now(), fetchImpl = (...a) => fetch(...a), onListingsChanged = () => {} }) {
  const sec = () => Math.floor(now() / 1000);
  const cookieName = secure => secure ? '__Host-mav_staff' : 'mav_staff';
  const cookie = (secure, value, maxAge) => `${cookieName(secure)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  const json = (status, body, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra } });

  async function limit(db, action, key, max, windowSec) {
    const bucket = await hex('staff-' + action + ':' + key), t = sec(), start = t - (t % windowSec);
    const row = await db.prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES(?1,?2,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window_start=?2 THEN count+1 ELSE 1 END, window_start=?2 RETURNING count').bind(bucket, start).first();
    if (row.count > max) throw new AdminError(429, 'rate', Math.max(1, start + windowSec - t));
  }
  const audit = (db, actor, action, target) => db.prepare('INSERT INTO staff_audit(actor,action,target,at) VALUES(?1,?2,?3,?4)').bind(actor, action, String(target).slice(0, 150), sec());

  async function current(db, request, secure) {
    const raw = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(cookieName(secure) + '='));
    const token = raw ? raw.slice(cookieName(secure).length + 1) : '';
    if (!TOKEN.test(token)) return null;
    const hash = await hex(token);
    const who = await db.prepare('SELECT m.id,m.email,m.role,m.language FROM staff_sessions s JOIN staff_members m ON m.id=s.staff_id WHERE s.token_hash=?1 AND s.expires_at>=?2 AND m.active=1 AND m.password_hash IS NOT NULL').bind(hash, sec()).first();
    return who ? { ...who, sessionHash: hash } : null;
  }
  async function startSession(db, staffId, secure) {
    const token = randomToken(), t = sec();
    await db.batch([
      db.prepare('DELETE FROM staff_sessions WHERE expires_at<?1').bind(t),
      db.prepare('DELETE FROM staff_tokens WHERE expires_at<?1').bind(t),
      db.prepare('INSERT INTO staff_sessions(token_hash,staff_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await hex(token), staffId, t, t + SESSION_HOURS * 3600)
    ]);
    return cookie(secure, token, SESSION_HOURS * 3600);
  }
  async function issueToken(db, staffId, purpose, hours) {
    const token = randomToken();
    await db.batch([
      db.prepare('DELETE FROM staff_tokens WHERE staff_id=?1').bind(staffId),
      db.prepare('INSERT INTO staff_tokens(token_hash,staff_id,purpose,expires_at) VALUES(?1,?2,?3,?4)').bind(await hex(token), staffId, purpose, sec() + hours * 3600)
    ]);
    return token;
  }
  async function sendMail(env, to, kind, language, vars) {
    const [subject, template] = MAIL[kind][lang(language)];
    let text = template; for (const [k, v] of Object.entries(vars)) text = text.replaceAll('{' + k + '}', v);
    if (typeof env.ACCOUNT_MAIL_LOG === 'function') { env.ACCOUNT_MAIL_LOG({ to, subject, text }); return true; }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
    try {
      const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }) });
      return r.ok;
    } catch { return false; }
  }
  const link = (kind, token) => `${site.siteOrigin}/admin/#${kind}=${token}`;
  const passwordProblem = (password, email) => typeof password !== 'string' || password.length < 10 || password.length > 128 || password.toLowerCase() === String(email).toLowerCase() || /^(.)\1+$/.test(password);

  async function body(request, max = 4096) {
    const text = await request.text();
    if (text.length > max) throw new AdminError(413, 'invalid_input');
    try { const v = JSON.parse(text); if (v && typeof v === 'object' && !Array.isArray(v)) return v; } catch {}
    throw new AdminError(400, 'invalid_input');
  }

  async function listAccounts(db, params) {
    const filter = ['all', 'verified', 'unverified'].includes(params.get('filter')) ? params.get('filter') : 'all';
    const q = (params.get('q') || '').trim().slice(0, 100), offset = Math.max(0, Math.min(100000, Number.parseInt(params.get('offset') || '0', 10) || 0));
    const like = q ? '%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%' : '';
    const rows = (await db.prepare(`SELECT u.id,u.email,u.language,u.created_at,u.verified_at,
      coalesce(p.full_name,'') AS full_name,coalesce(p.phone,'') AS phone,p.buyer_budget,coalesce(p.buyer_regions,'') AS buyer_regions,coalesce(p.buyer_timeline,'') AS buyer_timeline,
      (SELECT count(*) FROM saved_listings s WHERE s.user_id=u.id) AS saved,
      (SELECT count(*) FROM saved_searches s WHERE s.user_id=u.id) AS searches,
      (SELECT count(*) FROM enquiry_history s WHERE s.user_id=u.id) AS enquiries,
      (SELECT max(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_signin
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id
      WHERE (?1='all' OR (?1='verified' AND u.verified_at IS NOT NULL) OR (?1='unverified' AND u.verified_at IS NULL))
      AND (?2='' OR u.email LIKE ?2 ESCAPE '\\' OR p.full_name LIKE ?2 ESCAPE '\\' OR p.phone LIKE ?2 ESCAPE '\\')
      ORDER BY u.created_at DESC, u.id LIMIT ${PAGE + 1} OFFSET ?3`).bind(filter, like, offset).all()).results;
    const totals = await db.prepare('SELECT count(*) AS total, coalesce(sum(verified_at IS NOT NULL),0) AS verified FROM users').first();
    return { accounts: rows.slice(0, PAGE), more: rows.length > PAGE, totals: { total: Number(totals.total), verified: Number(totals.verified) } };
  }

  async function listListings(db) {
    const settings = new Map((await db.prepare('SELECT listing_reference,hidden,pinned FROM listing_settings').all()).results.map(r => [r.listing_reference, r]));
    const rows = (await db.prepare(`SELECT reference,status,item,free_listing,free_until,seller_name,seller_email,seller_language,published_at,updated_at,updated_by,revision
      FROM listings ORDER BY CASE status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END, updated_at DESC LIMIT 500`).all()).results;
    const listings = rows.map(r => rowView(r, settings));
    listings.sort((a, b) => (a.status === 'draft') - (b.status === 'draft') || (b.pinned - a.pinned) || 0);
    return { listings, freeDays: FREE_DAYS };
  }
  async function saveListing(db, input, actor) {
    let ref = input.reference === undefined || input.reference === '' ? null : String(input.reference);
    const current = ref ? await db.prepare('SELECT * FROM listings WHERE reference=?1').bind(ref).first() : null;
    if (ref && !current) throw new AdminError(404, 'not_found');
    if (current && current.revision !== input.revision) throw new AdminError(409, 'revision_conflict');
    if (!ref) ref = await nextReference(db);
    let item, seller;
    try { item = itemFromInput(input, ref, current ? JSON.parse(current.item) : null); seller = sellerFromInput(input); }
    catch (e) { if (e instanceof ListingError) throw new AdminError(e.status, e.code); throw new AdminError(400, 'invalid_input'); }
    const t = sec(), free = input.free === true;
    // Free period: starts at first publication; clearing the box removes it.
    const freeUntil = !free ? null : current?.free_until || (current?.status === 'published' ? t + FREE_DAYS * 86400 : null);
    if (free && !seller.email) throw new AdminError(400, 'missing_seller_email');
    const steps = [];
    if (current) {
      steps.push(db.prepare(`UPDATE listings SET item=?2,free_until=?3,seller_name=?4,seller_email=?5,seller_language=?6,updated_at=?7,updated_by=?8,revision=revision+1,free_listing=?10
        WHERE reference=?1 AND revision=?9`).bind(ref, JSON.stringify(item), freeUntil, seller.name, seller.email, seller.language, t, actor, current.revision, free ? 1 : 0));
      steps.push(audit(db, actor, 'listing_update', ref));
    } else {
      steps.push(db.prepare(`INSERT INTO listings(reference,status,item,free_listing,free_until,seller_name,seller_email,seller_language,created_at,updated_at,updated_by)
        VALUES(?1,'draft',?2,?8,NULL,?3,?4,?5,?6,?6,?7)`).bind(ref, JSON.stringify(item), seller.name, seller.email, seller.language, t, actor, free ? 1 : 0));
      steps.push(audit(db, actor, 'listing_create', ref));
    }
    await db.batch(steps);
    // Photos removed in this edit are deleted from storage.
    if (current) {
      const before = JSON.parse(current.item).photos || [], kept = new Set(item.photos);
      const gone = before.filter(p => !kept.has(p)).map(photoKey).filter(Boolean);
      if (gone.length) try { await photoStore(envRef).delete(gone); } catch {}
    }
    onListingsChanged();
    return { listing: rowView(await db.prepare('SELECT * FROM listings WHERE reference=?1').bind(ref).first(), null) };
  }
  async function changeStatus(db, input, actor) {
    const ref = String(input.reference || ''), action = input.action;
    if (!REF.test(ref) || !['publish', 'unpublish', 'renew'].includes(action) || !Number.isInteger(input.revision)) throw new AdminError(400, 'invalid_input');
    const row = await db.prepare('SELECT * FROM listings WHERE reference=?1').bind(ref).first();
    if (!row) throw new AdminError(404, 'not_found');
    if (row.revision !== input.revision) throw new AdminError(409, 'revision_conflict');
    const t = sec(), item = JSON.parse(row.item);
    if (action !== 'unpublish' && !item.photos.length) throw new AdminError(400, 'photo_required');
    let status = row.status, freeUntil = row.free_until, published = row.published_at, reset = false;
    if (action === 'publish') {
      if (row.status === 'published') throw new AdminError(409, 'revision_conflict');
      if (row.status === 'expired') throw new AdminError(400, 'renew_required');
      status = 'published'; published = published || t;
      if (row.free_listing === 1 && freeUntil === null) freeUntil = t + FREE_DAYS * 86400;
    } else if (action === 'unpublish') {
      if (row.status !== 'published') throw new AdminError(409, 'revision_conflict');
      status = 'draft';
    } else {
      if (row.free_listing !== 1 || freeUntil === null) throw new AdminError(400, 'not_free');
      freeUntil = Math.max(freeUntil, t) + FREE_DAYS * 86400; status = 'published'; published = published || t; reset = true;
    }
    await db.batch([
      db.prepare(`UPDATE listings SET status=?2,free_until=?3,published_at=?4,updated_at=?5,updated_by=?6,revision=revision+1
        ${reset ? ',reminder_sent_at=NULL,expiry_notice_sent_at=NULL' : ''} WHERE reference=?1 AND revision=?7`).bind(ref, status, freeUntil, published, t, actor, row.revision),
      audit(db, actor, 'listing_' + action, ref)
    ]);
    onListingsChanged();
    return { listing: rowView(await db.prepare('SELECT * FROM listings WHERE reference=?1').bind(ref).first(), null) };
  }
  async function uploadPhoto(db, request, params) {
    const ref = params.get('reference') || '';
    if (!REF.test(ref)) throw new AdminError(400, 'invalid_input');

    const row = await db.prepare('SELECT item FROM listings WHERE reference=?1').bind(ref).first();
    if (!row) throw new AdminError(404, 'not_found');
    if ((JSON.parse(row.item).photos || []).length >= PHOTOS_PER_LISTING) throw new AdminError(400, 'too_many_photos');
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > PHOTO_MAX_BYTES) throw new AdminError(413, 'photo_too_large');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) throw new AdminError(413, 'photo_too_large');
    const ext = photoTypeOf(bytes); if (!ext) throw new AdminError(415, 'photo_format');
    const path = newPhotoPath(ref, ext);
    await photoStore(envRef).put(photoKey(path), bytes, ext === 'webp' ? 'image/webp' : 'image/jpeg');
    return { path };
  }
  async function stats(db, params) {
    const days = Math.max(1, Math.min(90, Number.parseInt(params.get('days') || '30', 10) || 30));
    const since = new Date(now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const byEvent = (await db.prepare('SELECT event,sum(count) AS n FROM metric_counts WHERE day>=?1 GROUP BY event').bind(since).all()).results;
    const bySource = (await db.prepare('SELECT source,sum(count) AS n FROM metric_counts WHERE day>=?1 GROUP BY source ORDER BY n DESC').bind(since).all()).results;
    const byListing = (await db.prepare("SELECT reference,sum(count) AS n FROM metric_counts WHERE day>=?1 AND event='property_view' AND reference<>'' GROUP BY reference ORDER BY n DESC LIMIT 20").bind(since).all()).results;
    const byDay = (await db.prepare("SELECT day,sum(count) AS n FROM metric_counts WHERE day>=?1 AND event IN ('page_view','property_view','guide_view') GROUP BY day ORDER BY day").bind(since).all()).results;
    return { days, since, byEvent, bySource, byListing, byDay };
  }
  async function listEnquiries(db, params) {
    const filter = ['active', 'pending', 'accepted', 'deleted'].includes(params.get('filter')) ? params.get('filter') : 'active';
    const offset = Math.max(0, Math.min(100000, Number.parseInt(params.get('offset') || '0', 10) || 0));
    const rows = (await db.prepare(`SELECT id,created_at,payload,review_status,deleted_at,revision FROM enquiries
      WHERE CASE WHEN ?1='deleted' THEN deleted_at IS NOT NULL ELSE deleted_at IS NULL AND (?1='active' OR review_status=?1) END
      ORDER BY created_at DESC,id DESC LIMIT ${PAGE + 1} OFFSET ?2`).bind(filter, offset).all()).results;
    const counts = await db.prepare("SELECT coalesce(sum(deleted_at IS NULL AND review_status='pending'),0) AS pending FROM enquiries").first();
    return { enquiries: rows.slice(0, PAGE).map(r => ({ ...r, created_at: new Date(r.created_at * 1000).toISOString(), deleted_at: r.deleted_at ? new Date(r.deleted_at * 1000).toISOString() : null, payload: JSON.parse(r.payload) })), more: rows.length > PAGE, pending: Number(counts.pending) };
  }

  let envRef = {};
  return async function adminApi(request, env) {
    envRef = env || {};
    const url = new URL(request.url), route = url.pathname.replace(/^\/api\/admin\//, ''), secure = url.protocol === 'https:';
    const is = (method, name) => request.method === method && route === name;
    try {
      const db = env && env.ACCOUNTS;
      if (!db) throw new AdminError(503, 'unavailable');
      // Writes need the custom header and, when the browser sends one, this site's origin (with SameSite=Strict, against CSRF).
      if (request.method !== 'GET') {
        const origin = request.headers.get('origin');
        if (request.headers.get('x-mav-admin') !== '1' || (origin && origin !== site.siteOrigin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))) throw new AdminError(403, 'forbidden');
        const photo = route === 'listings/photo';
        if (!/^application\/json\b/.test(request.headers.get('content-type') || '') && !(photo && /^image\/(webp|jpeg)\b/.test(request.headers.get('content-type') || ''))) throw new AdminError(415, 'invalid_input');
      }
      const ip = request.headers.get('cf-connecting-ip') || 'local';

      // ---- Sign-in, password links, sign-out (no session needed) ----
      if (is('POST', 'login')) {
        const input = await body(request), email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        await limit(db, 'login-ip', ip, 30, 900); await limit(db, 'login-email', email, 10, 900);
        const member = EMAIL.test(email) ? await db.prepare('SELECT id,password_hash,active FROM staff_members WHERE email=?1').bind(email).first() : null;
        const usable = member && member.active === 1 && member.password_hash;
        const ok = await verifyPassword(String(input.password || '').slice(0, 128), usable ? member.password_hash : await dummy()) && usable;
        if (!ok) throw new AdminError(401, 'invalid_credentials');
        return json(200, { ok: true }, { 'Set-Cookie': await startSession(db, member.id, secure) });
      }
      if (is('POST', 'password-link')) {
        const input = await body(request), email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        if (!EMAIL.test(email)) throw new AdminError(400, 'invalid_input');
        await limit(db, 'link-ip', ip, 5, 3600); await limit(db, 'link-email', email, 3, 3600);
        const member = await db.prepare('SELECT id,language FROM staff_members WHERE email=?1 AND active=1').bind(email).first();
        if (member) await sendMail(env, email, 'reset', input.language || member.language, { link: link('set', await issueToken(db, member.id, 'reset', RESET_HOURS)) });
        return json(200, { ok: true }); // Same answer whether or not the address is staff.
      }
      if (is('POST', 'set-password')) {
        const input = await body(request);
        await limit(db, 'token-ip', ip, 20, 3600);
        if (typeof input.token !== 'string' || !TOKEN.test(input.token)) throw new AdminError(400, 'link_invalid');
        const row = await db.prepare('SELECT t.staff_id,t.purpose,m.email FROM staff_tokens t JOIN staff_members m ON m.id=t.staff_id WHERE t.token_hash=?1 AND t.expires_at>=?2 AND m.active=1').bind(await hex(input.token), sec()).first();
        if (!row) throw new AdminError(400, 'link_invalid');
        if (passwordProblem(input.password, row.email)) throw new AdminError(400, 'weak_password');
        await db.batch([
          db.prepare('UPDATE staff_members SET password_hash=?1,password_set_at=?2 WHERE id=?3').bind(await hashPassword(input.password), sec(), row.staff_id),
          db.prepare('DELETE FROM staff_tokens WHERE staff_id=?1').bind(row.staff_id),
          db.prepare('DELETE FROM staff_sessions WHERE staff_id=?1').bind(row.staff_id),
          audit(db, row.email, 'staff_password', row.purpose)
        ]);
        return json(200, { ok: true }, { 'Set-Cookie': await startSession(db, row.staff_id, secure) });
      }
      if (is('POST', 'logout')) {
        const who = await current(db, request, secure);
        if (who) await db.prepare('DELETE FROM staff_sessions WHERE token_hash=?1').bind(who.sessionHash).run();
        return json(200, { ok: true }, { 'Set-Cookie': cookie(secure, '', 0) });
      }

      // ---- Everything below needs an active staff session ----
      const who = await current(db, request, secure);
      if (!who) throw new AdminError(401, 'signin_required');
      const actor = who.email;
      if (is('GET', 'me')) return json(200, { email: who.email, role: who.role });

      if (is('GET', 'enquiries')) return json(200, await listEnquiries(db, url.searchParams));
      if (is('POST', 'enquiries/review')) {
        const input = await body(request), action = input.action;
        if (typeof input.id !== 'string' || !UUID.test(input.id) || !['accept', 'reopen', 'delete', 'restore'].includes(action) || !Number.isInteger(input.revision)) throw new AdminError(400, 'invalid_input');
        const e = await db.prepare('SELECT id,email,deleted_at,revision FROM enquiries WHERE id=?1').bind(input.id.toLowerCase()).first();
        if (!e) throw new AdminError(404, 'not_found');
        if (e.revision !== input.revision) throw new AdminError(409, 'revision_conflict');
        if (e.deleted_at && ['accept', 'reopen'].includes(action)) throw new AdminError(409, 'restore_first');
        const set = { accept: "review_status='accepted'", reopen: "review_status='pending'", delete: 'deleted_at=coalesce(deleted_at,?2)', restore: 'deleted_at=NULL' }[action];
        const [updated] = await db.batch([
          db.prepare(`UPDATE enquiries SET ${set}, revision=revision+1 WHERE id=?1 AND revision=?3 RETURNING id,review_status,deleted_at,revision`).bind(e.id, sec(), input.revision),
          audit(db, actor, 'enquiry_' + action, e.email)
        ]);
        if (!updated.length && !updated.results?.length) throw new AdminError(409, 'revision_conflict');
        return json(200, { ok: true });
      }

      if (is('GET', 'accounts')) return json(200, await listAccounts(db, url.searchParams));
      if (is('POST', 'accounts/confirm') || is('POST', 'accounts/delete')) {
        const { id } = await body(request);
        if (typeof id !== 'string' || !UUID.test(id)) throw new AdminError(400, 'invalid_input');
        const user = await db.prepare('SELECT id,email FROM users WHERE id=?1').bind(id).first();
        if (!user) throw new AdminError(404, 'not_found');
        if (route === 'accounts/confirm') {
          await db.batch([
            db.prepare('UPDATE users SET verified_at=coalesce(verified_at,?1) WHERE id=?2').bind(sec(), id),
            db.prepare("DELETE FROM auth_tokens WHERE user_id=?1 AND purpose='verify'").bind(id),
            audit(db, actor, 'account_confirm', user.email)
          ]);
        } else {
          // Cascades to sessions, tokens, profile, saved items and enquiry history.
          await db.batch([db.prepare('DELETE FROM users WHERE id=?1').bind(id), audit(db, actor, 'account_delete', user.email)]);
        }
        return json(200, { ok: true });
      }

      if (is('GET', 'listings')) return json(200, await listListings(db));
      if (is('POST', 'listings/save')) return json(200, await saveListing(db, await body(request, 64000), actor));
      if (is('POST', 'listings/status')) return json(200, await changeStatus(db, await body(request), actor));
      if (is('POST', 'listings/photo')) return json(200, await uploadPhoto(db, request, url.searchParams));
      if (is('GET', 'stats')) return json(200, await stats(db, url.searchParams));
      if (is('POST', 'listings')) {
        const input = await body(request), ref = String(input.reference || '');
        if (!REF.test(ref) || (input.hidden !== undefined && typeof input.hidden !== 'boolean') || (input.pinned !== undefined && typeof input.pinned !== 'boolean') || (input.hidden === undefined && input.pinned === undefined)) throw new AdminError(400, 'invalid_input');
        const cur = await db.prepare('SELECT hidden,pinned FROM listing_settings WHERE listing_reference=?1').bind(ref).first();
        const hidden = input.hidden ?? !!cur?.hidden, pinned = input.pinned ?? !!cur?.pinned;
        const steps = [db.prepare('INSERT INTO listing_settings(listing_reference,hidden,pinned,updated_at,updated_by) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(listing_reference) DO UPDATE SET hidden=?2,pinned=?3,updated_at=?4,updated_by=?5').bind(ref, hidden ? 1 : 0, pinned ? 1 : 0, sec(), actor)];
        if (input.hidden !== undefined && input.hidden !== !!cur?.hidden) steps.push(audit(db, actor, hidden ? 'listing_hide' : 'listing_show', ref));
        if (input.pinned !== undefined && input.pinned !== !!cur?.pinned) steps.push(audit(db, actor, pinned ? 'listing_pin' : 'listing_unpin', ref));
        await db.batch(steps);
        onListingsChanged();
        return json(200, { reference: ref, hidden, pinned });
      }

      if (is('GET', 'audit')) return json(200, { events: (await db.prepare('SELECT id,actor,action,target,at FROM staff_audit ORDER BY at DESC,id DESC LIMIT 100').all()).results });

      // ---- Team (owner only) ----
      if (route === 'team' || route.startsWith('team/') || route === 'invite') {
        if (who.role !== 'owner') throw new AdminError(403, 'owner_required');
        if (is('GET', 'team')) {
          const members = (await db.prepare('SELECT id,email,role,active,invited_by,created_at,password_set_at FROM staff_members ORDER BY role=\'owner\' DESC, created_at').all()).results;
          return json(200, { members: members.map(m => ({ ...m, active: m.active === 1, pending: !m.password_set_at })) });
        }
        if (is('POST', 'invite')) {
          const input = await body(request), email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
          if (!EMAIL.test(email) || email.length > 150 || email === who.email.toLowerCase()) throw new AdminError(400, 'invalid_input');
          await limit(db, 'invite', who.id, 20, 3600);
          const existing = await db.prepare('SELECT id,active,role,password_set_at FROM staff_members WHERE email=?1').bind(email).first();
          // An active member who already chose a password is on the team; a pending invitation is simply sent again.
          if (existing && (existing.role === 'owner' || (existing.active === 1 && existing.password_set_at))) throw new AdminError(409, 'already_staff');
          const id = existing?.id || crypto.randomUUID(), language = lang(input.language);
          await db.batch([
            existing ? db.prepare("UPDATE staff_members SET active=1,role='operator',invited_by=?2,language=?3 WHERE id=?1").bind(id, actor, language)
              : db.prepare("INSERT INTO staff_members(id,email,role,active,invited_by,language,created_at) VALUES(?1,?2,'operator',1,?3,?4,?5)").bind(id, email, actor, language, sec()),
            audit(db, actor, 'staff_invite', email)
          ]);
          const mailed = await sendMail(env, email, 'invite', language, { owner: actor, link: link('invite', await issueToken(db, id, 'invite', INVITE_HOURS)) });
          return json(200, { ok: true, mailed });
        }
        if (['team/deactivate', 'team/activate', 'team/resend'].includes(route) && request.method === 'POST') {
          const { id } = await body(request);
          if (typeof id !== 'string' || !UUID.test(id)) throw new AdminError(400, 'invalid_input');
          const m = await db.prepare('SELECT id,email,role,active,language,password_set_at FROM staff_members WHERE id=?1').bind(id).first();
          if (!m) throw new AdminError(404, 'not_found');
          if (m.role === 'owner') throw new AdminError(400, 'invalid_input');
          if (route === 'team/deactivate') await db.batch([db.prepare('UPDATE staff_members SET active=0 WHERE id=?1').bind(id), db.prepare('DELETE FROM staff_sessions WHERE staff_id=?1').bind(id), db.prepare('DELETE FROM staff_tokens WHERE staff_id=?1').bind(id), audit(db, actor, 'staff_deactivate', m.email)]);
          if (route === 'team/activate') await db.batch([db.prepare('UPDATE staff_members SET active=1 WHERE id=?1').bind(id), audit(db, actor, 'staff_activate', m.email)]);
          if (route === 'team/resend') {
            if (m.active !== 1) throw new AdminError(400, 'invalid_input');
            await limit(db, 'invite', who.id, 20, 3600);
            await audit(db, actor, 'staff_resend', m.email).run();
            const mailed = await sendMail(env, m.email, m.password_set_at ? 'reset' : 'invite', m.language, { owner: actor, link: m.password_set_at ? link('set', await issueToken(db, id, 'reset', RESET_HOURS)) : link('invite', await issueToken(db, id, 'invite', INVITE_HOURS)) });
            return json(200, { ok: true, mailed });
          }
          return json(200, { ok: true });
        }
      }
      throw new AdminError(404, 'not_found');
    } catch (error) {
      if (error instanceof AdminError) return json(error.status, { error: error.code, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) }, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {});
      console.error('admin-api', String(error?.message || error).slice(0, 200));
      return json(500, { error: 'server' });
    }
  };
}
