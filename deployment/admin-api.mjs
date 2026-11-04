// Staff workspace API, served at /api/admin/* (motelavendre.ca/admin/).
// Staff sign in with their existing Propriété En Vente staff account (Supabase Auth).
// Each request carries that access token; Supabase decides whether it belongs to active staff.
// Buyer accounts and per-listing display settings live in this site's D1 (binding ACCOUNTS).
import {publicRowsURL} from './live-catalogue.mjs';

const JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF = /^\d{1,12}$/;
const STAFF_CACHE_MS = 60000, PAGE = 50, LANGS = ['fr', 'en', 'zh'];
const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const INVITE_MAIL = {
  fr: ['Accès à l’administration Motel à vendre', 'Bonjour,\n\n{owner} vous a donné accès à l’administration de Motel à vendre et de Propriété En Vente.\n\nConnectez-vous avec votre compte Propriété En Vente (même courriel, même mot de passe) :\n{link}\n\nSi vous ne vous attendiez pas à ce message, répondez à {owner}.'],
  en: ['Access to the Motel à vendre admin', 'Hello,\n\n{owner} has given you access to the Motel à vendre and Propriété En Vente admin.\n\nSign in with your Propriété En Vente account (same email and password):\n{link}\n\nIf you did not expect this message, reply to {owner}.'],
  zh: ['您已获得 Motel à vendre 管理后台权限', '您好：\n\n{owner} 已为您开通 Motel à vendre 及 Propriété En Vente 的管理后台权限。\n\n请使用您的 Propriété En Vente 账号（相同邮箱和密码）登录：\n{link}\n\n如果这不是您预期的邮件，请联系 {owner}。']
};

class AdminError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
const hex = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');

export function createAdminApi({ site, now = () => Date.now(), fetchImpl = (...a) => fetch(...a), onListingsChanged = () => {} }) {
  const supabase = new URL(site.endpoint).origin;
  const staffCache = new Map();

  // Ask Supabase, with the caller's own token, whether this is active staff. No server secret is used.
  async function staff(request) {
    const token = (/^Bearer (.+)$/.exec(request.headers.get('authorization') || '') || [])[1] || '';
    if (token.length > 4096 || !JWT.test(token)) throw new AdminError(401, 'signin_required');
    const key = await hex(token), hit = staffCache.get(key);
    if (hit && hit.until > now()) return hit;
    const headers = { apikey: site.publishableKey, Authorization: 'Bearer ' + token };
    // Same checks as the main admin (auth.tsx): get_my_staff_role + get_my_staff_access (private.is_staff).
    const rpc = name => fetchImpl(supabase + '/rest/v1/rpc/' + name, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000), redirect: 'manual' });
    let roleRes, accessRes, user;
    try { [roleRes, accessRes, user] = await Promise.all([rpc('get_my_staff_role'), rpc('get_my_staff_access'), fetchImpl(supabase + '/auth/v1/user', { headers, signal: AbortSignal.timeout(8000), redirect: 'manual' })]); }
    catch { throw new AdminError(503, 'unavailable'); }
    if ([roleRes, accessRes, user].some(r => r.status === 401) || user.status === 403) throw new AdminError(401, 'signin_required');
    if (!roleRes.ok || !accessRes.ok || !user.ok) throw new AdminError(503, 'unavailable');
    const role = await roleRes.json(), access = await accessRes.json(), email = String((await user.json())?.email || '').slice(0, 150);
    if (!['owner', 'operator'].includes(role) || access !== true || !email) throw new AdminError(403, 'staff_required');
    if (staffCache.size > 200) staffCache.clear();
    const who = { email, role, token, until: now() + STAFF_CACHE_MS };
    staffCache.set(key, who);
    return who;
  }

  // Appointment goes through the main site's own invite-staff function (owner check,
  // appoint_existing_staff, audit). Called server-side: that function only admits its own browser origin.
  async function appoint(token, email) {
    let r;
    try { r = await fetchImpl(supabase + '/functions/v1/invite-staff', { method: 'POST', headers: { apikey: site.publishableKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role: 'operator' }), signal: AbortSignal.timeout(10000), redirect: 'manual' }); }
    catch { throw new AdminError(503, 'unavailable'); }
    if (r.ok) return;
    const code = (await r.json().catch(() => ({}))).error;
    if (r.status === 401) throw new AdminError(401, 'signin_required');
    if (r.status === 404 || code === 'account_not_found') throw new AdminError(404, 'account_not_found');
    if (r.status === 409 && code === 'already_staff') throw new AdminError(409, 'already_staff');
    if (r.status === 400) throw new AdminError(400, 'invalid_input');
    if (r.status === 403) throw new AdminError(403, 'owner_required');
    throw new AdminError(502, 'invite_failed');
  }
  // Notice to the new member, sent from this site's verified mail domain. A failed email does not undo the appointment.
  async function notify(env, email, language, actor) {
    const [subject, text] = INVITE_MAIL[language], link = site.siteOrigin + '/admin/';
    const message = { to: email, subject, text: text.replace('{link}', link).replace('{owner}', actor) };
    if (typeof env.ACCOUNT_MAIL_LOG === 'function') { env.ACCOUNT_MAIL_LOG(message); return true; }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
    try {
      const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM, to: [email], subject: message.subject, text: message.text }) });
      return r.ok;
    } catch { return false; }
  }

  const audit = (db, actor, action, target) => db.prepare('INSERT INTO staff_audit(actor,action,target,at) VALUES(?1,?2,?3,?4)').bind(actor, action, String(target).slice(0, 150), Math.floor(now() / 1000));

  async function body(request) {
    const origin = request.headers.get('origin');
    if (origin && origin !== site.siteOrigin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) throw new AdminError(403, 'forbidden');
    if (!/^application\/json\b/.test(request.headers.get('content-type') || '')) throw new AdminError(415, 'invalid_input');
    const text = await request.text();
    if (text.length > 2048) throw new AdminError(413, 'invalid_input');
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
    let rows;
    try {
      const r = await fetchImpl(publicRowsURL(site), { headers: { apikey: site.publishableKey }, signal: AbortSignal.timeout(8000), redirect: 'manual' });
      if (!r.ok) throw Error(String(r.status));
      rows = await r.json();
      if (!Array.isArray(rows)) throw Error('shape');
    } catch { throw new AdminError(503, 'catalogue_unavailable'); }
    const settings = new Map((await db.prepare('SELECT listing_reference,hidden,pinned,updated_at,updated_by FROM listing_settings').all()).results.map(s => [s.listing_reference, s]));
    const listings = rows.filter(r => REF.test(String(r.listing_number))).map(r => {
      const ref = String(r.listing_number), s = settings.get(ref);
      return { reference: ref, city: String(r.city || ''), region: String(r.region || ''), price: Number.isFinite(Number(r.price)) ? Number(r.price) : null,
        photos: Array.isArray(r.photo_paths) ? new Set(r.photo_paths).size : 0, illustrative: !!r.photoIllustrative, published_at: r.published_at || null,
        hidden: !!s?.hidden, pinned: !!s?.pinned, updated_at: s?.updated_at || null, updated_by: s?.updated_by || '' };
    });
    listings.sort((a, b) => (b.pinned - a.pinned) || String(b.published_at || '').localeCompare(String(a.published_at || '')));
    return { listings };
  }

  return async function adminApi(request, env) {
    const url = new URL(request.url), route = url.pathname.replace(/^\/api\/admin\//, '');
    try {
      const db = env && env.ACCOUNTS;
      if (!db) throw new AdminError(503, 'unavailable');
      const who = await staff(request), actor = who.email;
      const is = (method, name) => request.method === method && route === name;
      if (is('GET', 'me')) return json(200, { email: who.email, role: who.role });
      if (is('POST', 'invite')) {
        if (who.role !== 'owner') throw new AdminError(403, 'owner_required');
        const input = await body(request), email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        if (!EMAIL.test(email) || email.length > 254) throw new AdminError(400, 'invalid_input');
        await appoint(who.token, email);
        await audit(db, actor, 'staff_invite', email).run();
        const mailed = await notify(env, email, LANGS.includes(input.language) ? input.language : 'fr', actor);
        return json(200, { ok: true, mailed });
      }
      if (is('GET', 'accounts')) return json(200, await listAccounts(db, url.searchParams));
      if (is('POST', 'accounts/confirm') || is('POST', 'accounts/delete')) {
        const { id } = await body(request);
        if (typeof id !== 'string' || !UUID.test(id)) throw new AdminError(400, 'invalid_input');
        const user = await db.prepare('SELECT id,email,verified_at FROM users WHERE id=?1').bind(id).first();
        if (!user) throw new AdminError(404, 'not_found');
        if (route === 'accounts/confirm') {
          await db.batch([
            db.prepare('UPDATE users SET verified_at=coalesce(verified_at,?1) WHERE id=?2').bind(Math.floor(now() / 1000), id),
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
      if (is('POST', 'listings')) {
        const input = await body(request), ref = String(input.reference || '');
        if (!REF.test(ref) || (input.hidden !== undefined && typeof input.hidden !== 'boolean') || (input.pinned !== undefined && typeof input.pinned !== 'boolean') || (input.hidden === undefined && input.pinned === undefined)) throw new AdminError(400, 'invalid_input');
        const current = await db.prepare('SELECT hidden,pinned FROM listing_settings WHERE listing_reference=?1').bind(ref).first();
        const hidden = input.hidden ?? !!current?.hidden, pinned = input.pinned ?? !!current?.pinned;
        const steps = [db.prepare('INSERT INTO listing_settings(listing_reference,hidden,pinned,updated_at,updated_by) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(listing_reference) DO UPDATE SET hidden=?2,pinned=?3,updated_at=?4,updated_by=?5')
          .bind(ref, hidden ? 1 : 0, pinned ? 1 : 0, Math.floor(now() / 1000), actor)];
        if (input.hidden !== undefined && input.hidden !== !!current?.hidden) steps.push(audit(db, actor, hidden ? 'listing_hide' : 'listing_show', ref));
        if (input.pinned !== undefined && input.pinned !== !!current?.pinned) steps.push(audit(db, actor, pinned ? 'listing_pin' : 'listing_unpin', ref));
        await db.batch(steps);
        onListingsChanged();
        return json(200, { reference: ref, hidden, pinned });
      }
      if (is('GET', 'audit')) {
        const events = (await db.prepare('SELECT id,actor,action,target,at FROM staff_audit ORDER BY at DESC,id DESC LIMIT 100').all()).results;
        return json(200, { events });
      }
      throw new AdminError(404, 'not_found');
    } catch (error) {
      if (error instanceof AdminError) return json(error.status, { error: error.code });
      console.error('admin-api', String(error?.message || error).slice(0, 200));
      return json(500, { error: 'server' });
    }
  };
}
