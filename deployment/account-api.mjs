// Account centre API on Cloudflare D1 (binding ACCOUNTS), served at /api/account/*.
// Self-contained: Web Crypto + D1 + optional Resend for email. No main-site data.
const enc = new TextEncoder();
// 20 000 PBKDF2 rounds keep one hash at ~3-4 ms CPU, inside the Workers Free plan's 10 ms.
// Set the PASSWORD_ITERATIONS variable (max 100 000, the Workers limit) after moving to
// Workers Paid; each user's hash is upgraded at their next sign-in.
const DEFAULT_ITERATIONS = 20000;
const iterationsFor = env => { const n = Number(env && env.PASSWORD_ITERATIONS); return Number.isInteger(n) && n >= 10000 && n <= 100000 ? n : DEFAULT_ITERATIONS; };
const SESSION_DAYS = 30, VERIFY_HOURS = 48, RESET_HOURS = 1, UNVERIFIED_DAYS = 7;
const QUOTA = { saved_listings: 200, saved_searches: 20, enquiry_history: 500 };
const LANGS = ['fr', 'en', 'zh'], TIMELINES = ['', 'exploring', '0-3', '3-6', '6+'];
const ACCOUNT_PATH = { fr: 'fr/compte/', en: 'en/account/', zh: 'zh/account/' };
const REF = /^\d{1,12}$/, UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const COMMON = new Set(['password', 'password1', '12345678', '123456789', '1234567890', 'qwertyuiop', 'motdepasse', 'azertyuiop', '11111111', 'iloveyou', 'motelavendre']);

class ApiError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }

const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async s => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
function sameBytes(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
export async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${iterations}$${b64u(salt)}$${b64u(await derive(password, salt, iterations))}`;
}
const iterationsOf = stored => Number(String(stored || '').split('$')[1]) || 0;
export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored || '').split('$');
  if (alg !== 'pbkdf2-sha256' || !/^\d+$/.test(iter)) return false;
  return sameBytes(await derive(password, fromB64u(salt), Number(iter)), fromB64u(hash));
}
const dummyHashes = new Map();
const dummy = async iterations => dummyHashes.get(iterations) || dummyHashes.set(iterations, await hashPassword('timing-equaliser-' + randomToken(), iterations)).get(iterations);

function passwordProblem(password, email) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return 'weak_password';
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || lower === String(email || '').toLowerCase() || /^(.)\1+$/.test(password)) return 'weak_password';
  return '';
}
const cleanEmail = v => { const e = typeof v === 'string' ? v.trim().toLowerCase() : ''; if (e.length > 150 || !EMAIL.test(e)) throw new ApiError(400, 'invalid_input'); return e; };
const lang = v => LANGS.includes(v) ? v : 'fr';

function cleanProfile(input) {
  const text = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);
  const raw = input.buyer_budget;
  const budget = raw === '' || raw === null || raw === undefined ? null : Number(raw);
  if (budget !== null && (!Number.isInteger(budget) || budget < 0 || budget > 1e9)) throw new ApiError(400, 'invalid_input');
  return { full_name: text(input.full_name, 80), phone: text(input.phone, 40), preferred_language: lang(input.preferred_language), buyer_budget: budget, buyer_regions: text(input.buyer_regions, 120), buyer_timeline: TIMELINES.includes(input.buyer_timeline) ? input.buyer_timeline : '' };
}
function cleanCriteria(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new ApiError(400, 'invalid_input');
  const out = {};
  for (const k of ['region', 'type', 'budget', 'rooms', 'season', 'q', 'sort']) if (typeof c[k] === 'string') out[k] = c[k].slice(0, 120);
  return out;
}

// ---- Email (Resend). Locally, ACCOUNT_MAIL_LOG receives the message instead.
const MAIL = {
  verify: {
    fr: ['Confirmez votre compte Motel à vendre', 'Bonjour,\n\nConfirmez votre adresse pour activer votre compte Motel à vendre :\n{link}\n\nCe lien expire dans 48 heures. Si vous n’avez pas créé de compte, ignorez ce courriel.'],
    en: ['Confirm your Motel à vendre account', 'Hello,\n\nConfirm your address to activate your Motel à vendre account:\n{link}\n\nThis link expires in 48 hours. If you did not create an account, ignore this email.'],
    zh: ['请确认您的 Motel à vendre 账户', '您好：\n\n请点击以下链接确认邮箱，激活 Motel à vendre 账户：\n{link}\n\n链接 48 小时内有效。如非本人操作，请忽略此邮件。']
  },
  reset: {
    fr: ['Réinitialisez votre mot de passe', 'Bonjour,\n\nPour choisir un nouveau mot de passe Motel à vendre, ouvrez ce lien :\n{link}\n\nCe lien expire dans une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez ce courriel.'],
    en: ['Reset your password', 'Hello,\n\nTo choose a new Motel à vendre password, open this link:\n{link}\n\nThis link expires in one hour. If you did not request it, ignore this email.'],
    zh: ['重置您的密码', '您好：\n\n请打开以下链接设置新的 Motel à vendre 密码：\n{link}\n\n链接 1 小时内有效。如非本人操作，请忽略此邮件。']
  },
  exists: {
    fr: ['Votre compte Motel à vendre existe déjà', 'Bonjour,\n\nQuelqu’un a tenté de créer un compte avec cette adresse, qui en a déjà un. Pour vous connecter ou réinitialiser votre mot de passe :\n{link}\n\nSi ce n’était pas vous, aucune action n’est requise.'],
    en: ['You already have a Motel à vendre account', 'Hello,\n\nSomeone tried to create an account with this address, which already has one. To sign in or reset your password:\n{link}\n\nIf this was not you, no action is needed.'],
    zh: ['您已拥有 Motel à vendre 账户', '您好：\n\n有人尝试用此邮箱注册，但该邮箱已有账户。登录或重置密码请打开：\n{link}\n\n如非本人操作，无需处理。']
  }
};
async function sendMail(env, to, kind, language, link) {
  const [subject, body] = MAIL[kind][lang(language)];
  const message = { to, subject, text: body.replace('{link}', link) };
  if (typeof env.ACCOUNT_MAIL_LOG === 'function') { await env.ACCOUNT_MAIL_LOG(message); return; }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new ApiError(503, 'unavailable');
  let r;
  try { r = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: message.subject, text: message.text }) }); }
  catch { throw new ApiError(503, 'unavailable'); }
  if (!r.ok) throw new ApiError(503, 'unavailable');
}

export function createAccountApi({ siteOrigin, now = () => Date.now() }) {
  const sec = () => Math.floor(now() / 1000);

  async function limit(db, action, key, max, windowSec) {
    const bucket = await sha256(action + ':' + key), t = sec(), start = t - (t % windowSec);
    const row = await db.prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES(?1,?2,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window_start=?2 THEN count+1 ELSE 1 END, window_start=?2 RETURNING count').bind(bucket, start).first();
    if (row.count > max) throw new ApiError(429, 'rate');
  }
  async function housekeeping(db) {
    const t = sec();
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(t),
      db.prepare('DELETE FROM auth_tokens WHERE expires_at < ?1').bind(t),
      db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(t - 86400),
      db.prepare('DELETE FROM users WHERE verified_at IS NULL AND created_at < ?1').bind(t - UNVERIFIED_DAYS * 86400)
    ]);
  }
  async function issueToken(db, userId, purpose, hours) {
    const token = randomToken();
    await db.batch([
      db.prepare('DELETE FROM auth_tokens WHERE user_id=?1 AND purpose=?2').bind(userId, purpose),
      db.prepare('INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token), userId, purpose, sec() + hours * 3600)
    ]);
    return token;
  }
  async function consumeToken(db, token, purpose) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(400, 'link_invalid');
    const row = await db.prepare('DELETE FROM auth_tokens WHERE token_hash=?1 AND purpose=?2 AND expires_at>=?3 RETURNING user_id').bind(await sha256(token), purpose, sec()).first();
    if (!row) throw new ApiError(400, 'link_invalid');
    return row.user_id;
  }
  const link = (language, kind, token) => `${siteOrigin}/${ACCOUNT_PATH[lang(language)]}${token ? '#' + kind + '=' + token : ''}`;

  async function startSession(db, userId, secure) {
    const token = randomToken(), t = sec();
    await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token), userId, t, t + SESSION_DAYS * 86400).run();
    return cookie(secure, token, SESSION_DAYS * 86400);
  }
  const cookieName = secure => secure ? '__Host-mav_session' : 'mav_session';
  const cookie = (secure, value, maxAge) => `${cookieName(secure)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  async function currentUser(db, request, secure) {
    const raw = (request.headers.get('cookie') || '').split(/;\s*/).find(c => c.startsWith(cookieName(secure) + '='));
    const token = raw && raw.slice(cookieName(secure).length + 1);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const hash = await sha256(token);
    const user = await db.prepare('SELECT u.id,u.email,u.language,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>=?2 AND u.verified_at IS NOT NULL').bind(hash, sec()).first();
    return user ? { ...user, sessionHash: hash } : null;
  }
  const publicUser = u => ({ id: u.id, email: u.email, created_at: new Date(u.created_at * 1000).toISOString() });
  async function profileOf(db, userId) {
    return db.prepare('SELECT full_name,phone,preferred_language,buyer_budget,buyer_regions,buyer_timeline FROM profiles WHERE user_id=?1').bind(userId).first();
  }
  async function underQuota(db, table, userId) {
    const { n } = await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id=?1`).bind(userId).first();
    if (n >= QUOTA[table]) throw new ApiError(409, 'quota');
  }

  return async function handle(request, env) {
    const url = new URL(request.url), secure = url.protocol === 'https:';
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    const reply = (status, body, setCookie) => { const h = new Headers(headers); if (setCookie) h.append('Set-Cookie', setCookie); return new Response(request.method === 'HEAD' ? null : JSON.stringify(body), { status, headers: h }); };
    try {
      const db = env.ACCOUNTS;
      if (!db) throw new ApiError(503, 'unavailable');
      // Same-origin only: a custom header forces a CORS preflight that is never granted.
      if (request.headers.get('x-mav-account') !== '1') throw new ApiError(403, 'forbidden');
      const origin = request.headers.get('origin');
      if (request.method !== 'GET' && origin !== url.origin) throw new ApiError(403, 'forbidden');
      const route = url.pathname.replace(/^\/api\/account\//, '').replace(/\/$/, '');
      const ip = request.headers.get('cf-connecting-ip') || 'local';
      let body = {};
      if (!['GET', 'DELETE'].includes(request.method)) {
        if (!/^application\/json\b/.test(request.headers.get('content-type') || '')) throw new ApiError(415, 'invalid_input');
        const text = await request.text();
        if (text.length > 8192) throw new ApiError(413, 'invalid_input');
        try { body = text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, 'invalid_input'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_input');
      }
      const is = (method, path) => request.method === method && route === path;

      // ---------- Public endpoints
      if (is('POST', 'signup')) {
        if (body.consent !== true) throw new ApiError(400, 'invalid_input');
        const email = cleanEmail(body.email), language = lang(body.language);
        const problem = passwordProblem(body.password, email);
        if (problem) throw new ApiError(400, problem);
        await limit(db, 'signup-ip', ip, 5, 3600);
        await limit(db, 'mail-to', email, 3, 3600);
        await housekeeping(db);
        const existing = await db.prepare('SELECT id,verified_at,language FROM users WHERE email=?1').bind(email).first();
        if (existing && existing.verified_at) { await sendMail(env, email, 'exists', language, link(language)); return reply(200, { ok: true }); }
        let userId = existing && existing.id;
        const hash = await hashPassword(body.password, iterationsFor(env)), t = sec();
        if (userId) await db.prepare('UPDATE users SET password_hash=?1, language=?2, consent_at=?3 WHERE id=?4').bind(hash, language, t, userId).run();
        else {
          userId = crypto.randomUUID();
          await db.batch([
            db.prepare('INSERT INTO users(id,email,password_hash,language,consent_at,created_at) VALUES(?1,?2,?3,?4,?5,?5)').bind(userId, email, hash, language, t),
            db.prepare('INSERT INTO profiles(user_id,preferred_language,updated_at) VALUES(?1,?2,?3)').bind(userId, language, t)
          ]);
        }
        await sendMail(env, email, 'verify', language, link(language, 'verify', await issueToken(db, userId, 'verify', VERIFY_HOURS)));
        return reply(200, { ok: true });
      }
      if (is('POST', 'verify')) {
        await limit(db, 'token-ip', ip, 20, 3600);
        const userId = await consumeToken(db, body.token, 'verify');
        await db.prepare('UPDATE users SET verified_at=coalesce(verified_at,?1) WHERE id=?2').bind(sec(), userId).run();
        const user = await db.prepare('SELECT id,email,created_at FROM users WHERE id=?1').bind(userId).first();
        return reply(200, { user: publicUser(user) }, await startSession(db, userId, secure));
      }
      if (is('POST', 'login')) {
        const email = cleanEmail(body.email);
        await limit(db, 'login-ip', ip, 30, 900);
        await limit(db, 'login-email', email, 10, 900);
        const user = await db.prepare('SELECT id,email,password_hash,verified_at,created_at FROM users WHERE email=?1').bind(email).first();
        const ok = await verifyPassword(String(body.password || ''), user ? user.password_hash : await dummy(iterationsFor(env)));
        if (!user || !ok) throw new ApiError(401, 'invalid_credentials');
        if (!user.verified_at) throw new ApiError(403, 'email_not_confirmed');
        // Transparent upgrade when PASSWORD_ITERATIONS changes (one extra hash, this sign-in only).
        if (iterationsOf(user.password_hash) !== iterationsFor(env)) await db.prepare('UPDATE users SET password_hash=?1 WHERE id=?2').bind(await hashPassword(String(body.password), iterationsFor(env)), user.id).run();
        await housekeeping(db);
        return reply(200, { user: publicUser(user) }, await startSession(db, user.id, secure));
      }
      if (is('POST', 'recover')) {
        const email = cleanEmail(body.email);
        await limit(db, 'recover-ip', ip, 5, 3600);
        await limit(db, 'mail-to', email, 3, 3600);
        const user = await db.prepare('SELECT id,language FROM users WHERE email=?1').bind(email).first();
        if (user) await sendMail(env, email, 'reset', body.language || user.language, link(body.language || user.language, 'reset', await issueToken(db, user.id, 'reset', RESET_HOURS)));
        return reply(200, { ok: true }); // Same answer whether or not the address exists.
      }
      if (is('POST', 'reset')) {
        await limit(db, 'token-ip', ip, 20, 3600);
        const early = passwordProblem(body.password); // Check before the one-time link is spent.
        if (early) throw new ApiError(400, early);
        const userId = await consumeToken(db, body.token, 'reset');
        const t = sec();
        await db.batch([
          db.prepare('UPDATE users SET password_hash=?1, verified_at=coalesce(verified_at,?2) WHERE id=?3').bind(await hashPassword(body.password, iterationsFor(env)), t, userId),
          db.prepare('DELETE FROM sessions WHERE user_id=?1').bind(userId)
        ]);
        const user = await db.prepare('SELECT id,email,created_at FROM users WHERE id=?1').bind(userId).first();
        return reply(200, { user: publicUser(user) }, await startSession(db, userId, secure));
      }

      // ---------- Signed-in endpoints
      const user = await currentUser(db, request, secure);
      if (!user) throw new ApiError(401, 'session');
      if (is('POST', 'logout')) { await db.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(user.sessionHash).run(); return reply(200, { ok: true }, cookie(secure, '', 0)); }
      if (is('GET', 'me')) return reply(200, { user: publicUser(user), profile: await profileOf(db, user.id) });
      if (is('PUT', 'profile')) {
        const p = cleanProfile(body);
        await db.prepare('UPDATE profiles SET full_name=?1,phone=?2,preferred_language=?3,buyer_budget=?4,buyer_regions=?5,buyer_timeline=?6,updated_at=?7 WHERE user_id=?8').bind(p.full_name, p.phone, p.preferred_language, p.buyer_budget, p.buyer_regions, p.buyer_timeline, sec(), user.id).run();
        return reply(200, { profile: await profileOf(db, user.id) });
      }
      if (is('GET', 'saved')) {
        const { results } = await db.prepare('SELECT listing_reference FROM saved_listings WHERE user_id=?1 ORDER BY created_at DESC, listing_reference').bind(user.id).all();
        return reply(200, { references: results.map(r => r.listing_reference) });
      }
      if (is('POST', 'saved')) {
        const refs = Array.isArray(body.references) ? [...new Set(body.references)] : [];
        if (!refs.length || refs.length > 50 || refs.some(r => typeof r !== 'string' || !REF.test(r))) throw new ApiError(400, 'invalid_input');
        const { n } = await db.prepare('SELECT count(*) AS n FROM saved_listings WHERE user_id=?1').bind(user.id).first();
        const room = Math.max(0, QUOTA.saved_listings - n), t = sec();
        if (room) await db.batch(refs.slice(0, room).map(r => db.prepare('INSERT OR IGNORE INTO saved_listings(user_id,listing_reference,created_at) VALUES(?1,?2,?3)').bind(user.id, r, t)));
        if (refs.length > room) throw new ApiError(409, 'quota');
        return reply(200, { ok: true });
      }
      const savedMatch = /^saved\/(\d{1,12})$/.exec(route);
      if (request.method === 'DELETE' && savedMatch) { await db.prepare('DELETE FROM saved_listings WHERE user_id=?1 AND listing_reference=?2').bind(user.id, savedMatch[1]).run(); return reply(200, { ok: true }); }
      if (is('GET', 'searches')) {
        const { results } = await db.prepare('SELECT id,name,criteria,created_at FROM saved_searches WHERE user_id=?1 ORDER BY created_at DESC').bind(user.id).all();
        return reply(200, { searches: results.map(r => ({ id: r.id, name: r.name, criteria: JSON.parse(r.criteria), created_at: new Date(r.created_at * 1000).toISOString() })) });
      }
      if (is('POST', 'searches')) {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
        if (!name) throw new ApiError(400, 'invalid_input');
        await underQuota(db, 'saved_searches', user.id);
        await db.prepare('INSERT INTO saved_searches(id,user_id,name,criteria,created_at) VALUES(?1,?2,?3,?4,?5)').bind(crypto.randomUUID(), user.id, name, JSON.stringify(cleanCriteria(body.criteria)), sec()).run();
        return reply(201, { ok: true });
      }
      const searchMatch = /^searches\/([0-9a-f-]{36})$/i.exec(route);
      if (request.method === 'DELETE' && searchMatch) { await db.prepare('DELETE FROM saved_searches WHERE user_id=?1 AND id=?2').bind(user.id, searchMatch[1]).run(); return reply(200, { ok: true }); }
      if (is('GET', 'history')) {
        const { results } = await db.prepare('SELECT id,kind,purpose,listing_reference,language,sent_at FROM enquiry_history WHERE user_id=?1 ORDER BY sent_at DESC LIMIT 100').bind(user.id).all();
        return reply(200, { history: results.map(r => ({ ...r, sent_at: new Date(r.sent_at * 1000).toISOString() })) });
      }
      if (is('POST', 'history')) {
        if (!UUID.test(body.id || '')) throw new ApiError(400, 'invalid_input');
        await underQuota(db, 'enquiry_history', user.id);
        await db.prepare('INSERT OR IGNORE INTO enquiry_history(id,user_id,kind,purpose,listing_reference,language,sent_at) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(body.id.toLowerCase(), user.id, body.kind === 'seller' ? 'seller' : 'buyer', ['info', 'viewing', 'documents'].includes(body.purpose) ? body.purpose : 'info', REF.test(body.listing_reference || '') ? body.listing_reference : '', lang(body.language), sec()).run();
        return reply(201, { ok: true });
      }
      if (is('GET', 'export')) {
        const all = async sql => (await db.prepare(sql).bind(user.id).all()).results;
        return reply(200, {
          exportedAt: new Date(now()).toISOString(), site: 'motelavendre.ca', account: publicUser(user), profile: await profileOf(db, user.id),
          saved_listings: await all('SELECT listing_reference,created_at FROM saved_listings WHERE user_id=?1'),
          saved_searches: await all('SELECT id,name,criteria,created_at FROM saved_searches WHERE user_id=?1'),
          enquiry_history: await all('SELECT id,kind,purpose,listing_reference,language,sent_at FROM enquiry_history WHERE user_id=?1')
        });
      }
      if (is('POST', 'delete')) {
        await limit(db, 'delete-user', user.id, 5, 3600);
        const row = await db.prepare('SELECT password_hash FROM users WHERE id=?1').bind(user.id).first();
        if (!(await verifyPassword(String(body.password || ''), row.password_hash))) throw new ApiError(401, 'invalid_credentials');
        // Explicit deletes so erasure never depends on the foreign-key pragma.
        await db.batch(['sessions', 'auth_tokens', 'profiles', 'saved_listings', 'saved_searches', 'enquiry_history'].map(t => db.prepare(`DELETE FROM ${t} WHERE user_id=?1`).bind(user.id)).concat(db.prepare('DELETE FROM users WHERE id=?1').bind(user.id)));
        return reply(200, { ok: true }, cookie(secure, '', 0));
      }
      throw new ApiError(404, 'not_found');
    } catch (error) {
      if (error instanceof ApiError) return reply(error.status, { error: error.code });
      console.error('account-api', error && error.message);
      return reply(500, { error: 'unavailable' });
    }
  };
}
