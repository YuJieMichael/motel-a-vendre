(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MAVAccount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Account centre client for the SEPARATE Supabase project (never the main site).
  // Talks to Supabase Auth and PostgREST directly so no third-party script is
  // loaded: the site's CSP only allows its own scripts.
  const SESSION_KEY = 'mav-account-session';
  const SYNC_KEY = 'mav-account-synced';
  const languages = ['fr', 'en', 'zh'];
  const timelines = ['', 'exploring', '0-3', '3-6', '6+'];
  const refPattern = /^\d{1,12}$/;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  class AccountError extends Error {
    constructor(code, detail) { super(code); this.name = 'AccountError'; this.code = code; this.detail = detail; }
  }

  function settings(site) {
    const a = site && site.account;
    if (!a || typeof a.url !== 'string' || typeof a.publishableKey !== 'string' || !a.url || !a.publishableKey) return null;
    let url;
    try { url = new URL(a.url); } catch { return null; }
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) return null;
    // The account project must stay separate from the main-site project.
    if (site.endpoint && new URL(site.endpoint).origin === url.origin) return null;
    return { origin: url.origin, key: a.publishableKey };
  }
  const configured = site => settings(site) !== null;

  function parseAuthHash(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    if (!raw || !/(^|&)(access_token|error|error_description)=/.test(raw)) return null;
    const p = new URLSearchParams(raw);
    if (p.get('error') || p.get('error_description')) return { error: p.get('error_code') || p.get('error') || 'auth_error', description: p.get('error_description') || '' };
    const access = p.get('access_token'), refresh = p.get('refresh_token');
    if (!access || !refresh) return null;
    const expiresIn = Number(p.get('expires_in')), expiresAt = Number(p.get('expires_at'));
    return { access_token: access, refresh_token: refresh, expires_at: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null, expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600, type: p.get('type') || '' };
  }

  // First sign-in on a device: union of both lists, upload what the server lacks.
  // Later visits: the server is authoritative so removals on another device stick.
  function mergeSaved(localRefs, remoteRefs, firstSync) {
    const remote = [...new Set(remoteRefs.filter(r => refPattern.test(r)))];
    if (!firstSync) return { merged: remote, upload: [] };
    const upload = [...new Set(localRefs.filter(r => refPattern.test(r) && !remote.includes(r)))];
    return { merged: [...remote, ...upload], upload };
  }

  function cleanProfile(input) {
    const text = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);
    const budget = input.buyer_budget === '' || input.buyer_budget === null || input.buyer_budget === undefined ? null : Number(input.buyer_budget);
    if (budget !== null && (!Number.isInteger(budget) || budget < 0 || budget > 1e9)) throw new AccountError('invalid_input');
    return {
      full_name: text(input.full_name, 80), phone: text(input.phone, 40),
      preferred_language: languages.includes(input.preferred_language) ? input.preferred_language : 'fr',
      buyer_budget: budget, buyer_regions: text(input.buyer_regions, 120),
      buyer_timeline: timelines.includes(input.buyer_timeline) ? input.buyer_timeline : ''
    };
  }

  function errorFrom(status, body) {
    const code = String((body && (body.error_code || body.code || body.error)) || '');
    if (status === 429 || /rate_limit/.test(code)) return new AccountError('rate');
    if (/invalid_credentials|invalid_grant/.test(code)) return new AccountError('invalid_credentials');
    if (/email_not_confirmed/.test(code)) return new AccountError('email_not_confirmed');
    if (/weak_password/.test(code)) return new AccountError('weak_password');
    if (/same_password/.test(code)) return new AccountError('same_password');
    if (/user_already_exists|email_exists/.test(code)) return new AccountError('user_exists');
    if (/email_address_invalid|validation_failed/.test(code)) return new AccountError('invalid_input');
    if (/quota_exceeded/.test(JSON.stringify(body || ''))) return new AccountError('quota');
    if (status === 401 || status === 403) return new AccountError('session');
    if (status >= 400 && status < 500) return new AccountError('invalid_input');
    return new AccountError('unavailable', { status });
  }

  function createClient(site, { storage, fetchImpl, now = () => Date.now(), timeoutMs = 15000 } = {}) {
    const cfg = settings(site);
    if (!cfg) throw new AccountError('not_configured');
    const doFetch = fetchImpl || ((...args) => fetch(...args));
    const events = new EventTarget();
    let refreshing = null;

    const read = () => { try { const s = JSON.parse(storage.getItem(SESSION_KEY)); return s && s.access_token && s.refresh_token && s.user && uuid.test(s.user.id) ? s : null; } catch { return null; } };
    const write = s => { try { if (s) storage.setItem(SESSION_KEY, JSON.stringify(s)); else storage.removeItem(SESSION_KEY); } catch { /* storage blocked */ } events.dispatchEvent(new Event('change')); };
    const fromToken = body => ({
      access_token: body.access_token, refresh_token: body.refresh_token,
      expires_at: body.expires_at || Math.floor(now() / 1000) + (Number(body.expires_in) || 3600),
      user: { id: body.user.id, email: body.user.email || '', created_at: body.user.created_at || '' }
    });

    async function call(path, { method = 'GET', body, token, headers = {}, query } = {}) {
      const url = new URL(path, cfg.origin);
      if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
      let response;
      try {
        response = await doFetch(url.href, {
          method, signal: AbortSignal.timeout(timeoutMs), credentials: 'omit', cache: 'no-store',
          headers: { apikey: cfg.key, Authorization: 'Bearer ' + (token || cfg.key), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
      } catch { throw new AccountError('network'); }
      const text = await response.text();
      let data = null;
      if (text) { try { data = JSON.parse(text); } catch { data = null; } }
      if (!response.ok) throw errorFrom(response.status, data);
      return data;
    }

    async function refresh(session) {
      if (!refreshing) refreshing = call('/auth/v1/token', { method: 'POST', query: { grant_type: 'refresh_token' }, body: { refresh_token: session.refresh_token } })
        .then(body => { const next = fromToken(body); write(next); return next; })
        .catch(error => { if (error.code !== 'network' && error.code !== 'unavailable') { write(null); throw new AccountError('session'); } throw error; })
        .finally(() => { refreshing = null; });
      return refreshing;
    }
    async function activeSession() {
      const s = read();
      if (!s) throw new AccountError('session');
      return s.expires_at * 1000 - now() < 60000 ? refresh(s) : s;
    }
    async function authed(path, options = {}) {
      let s = await activeSession();
      try { return await call(path, { ...options, token: s.access_token }); }
      catch (error) {
        if (error.code !== 'session') throw error;
        s = await refresh(s);
        return call(path, { ...options, token: s.access_token });
      }
    }

    const api = {
      events,
      session: read,
      get user() { const s = read(); return s ? s.user : null; },
      async signUp(email, password, language, redirectTo) {
        const body = await call('/auth/v1/signup', { method: 'POST', query: { redirect_to: redirectTo }, body: { email, password, data: { language: languages.includes(language) ? language : 'fr' } } });
        if (body && body.access_token) { write(fromToken(body)); return { confirmed: true }; }
        return { confirmed: false };
      },
      async signIn(email, password) {
        const body = await call('/auth/v1/token', { method: 'POST', query: { grant_type: 'password' }, body: { email, password } });
        write(fromToken(body)); return read().user;
      },
      async recover(email, redirectTo) { await call('/auth/v1/recover', { method: 'POST', query: { redirect_to: redirectTo }, body: { email } }); },
      // Confirmation and recovery links return tokens in the URL fragment.
      async adoptRedirect(parsed) {
        if (!parsed || parsed.error) throw new AccountError('link_invalid');
        const user = await call('/auth/v1/user', { token: parsed.access_token });
        if (!user || !uuid.test(user.id)) throw new AccountError('link_invalid');
        write(fromToken({ ...parsed, expires_at: parsed.expires_at || Math.floor(now() / 1000) + parsed.expires_in, user }));
        return parsed.type;
      },
      async updatePassword(password) { await authed('/auth/v1/user', { method: 'PUT', body: { password } }); },
      async signOut() {
        const s = read();
        write(null);
        try { storage.removeItem(SYNC_KEY); } catch { /* ignore */ }
        if (s) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access_token, query: { scope: 'local' } }); } catch { /* token may already be invalid */ } }
      },
      async profile() { const rows = await authed('/rest/v1/profiles', { query: { select: '*' } }); return rows && rows[0] || null; },
      async updateProfile(input) {
        const rows = await authed('/rest/v1/profiles', { method: 'PATCH', query: { id: 'eq.' + read().user.id, select: '*' }, headers: { Prefer: 'return=representation' }, body: cleanProfile(input) });
        return rows && rows[0] || null;
      },
      async savedReferences() { const rows = await authed('/rest/v1/saved_listings', { query: { select: 'listing_reference,created_at', order: 'created_at.desc' } }); return (rows || []).map(r => r.listing_reference); },
      async addSaved(ref) { if (!refPattern.test(ref)) throw new AccountError('invalid_input'); await authed('/rest/v1/saved_listings', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { listing_reference: ref } }); },
      async removeSaved(ref) { if (!refPattern.test(ref)) throw new AccountError('invalid_input'); await authed('/rest/v1/saved_listings', { method: 'DELETE', query: { listing_reference: 'eq.' + ref } }); },
      async syncSaved(localRefs) {
        const userId = read() && read().user.id;
        let first = true;
        try { first = storage.getItem(SYNC_KEY) !== userId; } catch { /* treat as first */ }
        const { merged, upload } = mergeSaved(localRefs, await api.savedReferences(), first);
        for (const ref of upload) { try { await api.addSaved(ref); } catch (error) { if (error.code !== 'quota') throw error; } }
        try { storage.setItem(SYNC_KEY, userId); } catch { /* ignore */ }
        return merged;
      },
      async searches() { return (await authed('/rest/v1/saved_searches', { query: { select: 'id,name,criteria,created_at', order: 'created_at.desc' } })) || []; },
      async addSearch(name, criteria) {
        const clean = String(name || '').trim().slice(0, 80);
        if (!clean || !criteria || typeof criteria !== 'object' || Array.isArray(criteria)) throw new AccountError('invalid_input');
        await authed('/rest/v1/saved_searches', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { name: clean, criteria } });
      },
      async removeSearch(id) { if (!uuid.test(id)) throw new AccountError('invalid_input'); await authed('/rest/v1/saved_searches', { method: 'DELETE', query: { id: 'eq.' + id } }); },
      async history() { return (await authed('/rest/v1/enquiry_history', { query: { select: 'id,kind,purpose,listing_reference,language,sent_at', order: 'sent_at.desc', limit: '100' } })) || []; },
      async addHistory(entry) {
        const row = { id: entry.id, kind: entry.kind === 'seller' ? 'seller' : 'buyer', purpose: ['info', 'viewing', 'documents'].includes(entry.purpose) ? entry.purpose : 'info', listing_reference: refPattern.test(entry.listing_reference || '') ? entry.listing_reference : '', language: languages.includes(entry.language) ? entry.language : 'fr' };
        if (!uuid.test(row.id)) throw new AccountError('invalid_input');
        await authed('/rest/v1/enquiry_history', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: row });
      },
      async exportData() {
        const [profile, saved, searches, history] = await Promise.all([api.profile(), authed('/rest/v1/saved_listings', { query: { select: '*' } }), api.searches(), api.history()]);
        return { exportedAt: new Date(now()).toISOString(), site: 'motelavendre.ca', account: read().user, profile, saved_listings: saved, saved_searches: searches, enquiry_history: history };
      },
      async deleteAccount() { await authed('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} }); await api.signOut(); }
    };
    return api;
  }

  return { AccountError, SESSION_KEY, SYNC_KEY, settings, configured, parseAuthHash, mergeSaved, cleanProfile, createClient };
});
