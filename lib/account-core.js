(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MAVAccount = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Browser client for the account API served by this site's own Worker
  // (/api/account/*, Cloudflare D1). The session lives in an HttpOnly cookie;
  // localStorage only keeps a non-secret hint so pages know whether to ask.
  const HINT_KEY = 'mav-account';
  const SYNC_KEY = 'mav-account-synced';
  const languages = ['fr', 'en', 'zh'];
  const refPattern = /^\d{1,12}$/;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

  class AccountError extends Error {
    constructor(code, detail) { super(code); this.name = 'AccountError'; this.code = code; this.detail = detail; }
  }

  const configured = site => !!(site && site.account && site.account.enabled === true);

  // Email links land on the account page as #verify=TOKEN or #reset=TOKEN.
  // A fragment never reaches servers or logs, and mail scanners cannot spend it.
  function parseAuthHash(hash) {
    const m = /^#?(verify|reset|unsubscribe)=([A-Za-z0-9_-]+)$/.exec(String(hash || ''));
    return m && tokenPattern.test(m[2]) ? { type: m[1], token: m[2] } : null;
  }

  // First sign-in on a device: union of both lists, upload what the server lacks.
  // Later visits: the server is authoritative so removals on another device stick.
  function mergeSaved(localRefs, remoteRefs, firstSync) {
    const remote = [...new Set(remoteRefs.filter(r => refPattern.test(r)))];
    if (!firstSync) return { merged: remote, upload: [] };
    const upload = [...new Set(localRefs.filter(r => refPattern.test(r) && !remote.includes(r)))];
    return { merged: [...remote, ...upload], upload };
  }

  function createClient(site, { storage, fetchImpl, base = '/api/account/', timeoutMs = 15000 } = {}) {
    if (!configured(site)) throw new AccountError('not_configured');
    const doFetch = fetchImpl || ((...args) => fetch(...args));
    const events = new EventTarget();
    const readHint = () => { try { const h = JSON.parse(storage.getItem(HINT_KEY)); return h && uuid.test(h.id) && typeof h.email === 'string' ? h : null; } catch { return null; } };
    const writeHint = user => {
      const before = readHint();
      try { if (user) storage.setItem(HINT_KEY, JSON.stringify({ id: user.id, email: user.email })); else { storage.removeItem(HINT_KEY); storage.removeItem(SYNC_KEY); } } catch { /* storage blocked */ }
      if (JSON.stringify(before) !== JSON.stringify(readHint())) events.dispatchEvent(new Event('change'));
    };

    async function call(path, { method = 'GET', body } = {}) {
      let response;
      try {
        response = await doFetch(base + path, {
          method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs),
          headers: { 'X-MAV-Account': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
      } catch { throw new AccountError('network'); }
      let data = null;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const code = data && typeof data.error === 'string' ? data.error : response.status === 429 ? 'rate' : 'unavailable';
        if (code === 'session') writeHint(null);
        throw new AccountError(code === 'not_found' || code === 'forbidden' ? 'unavailable' : code, { status: response.status });
      }
      return data || {};
    }
    const signedIn = data => { writeHint(data.user); return data.user; };

    const api = {
      events,
      get user() { return readHint(); },
      async refresh() { try { const data = await call('me'); writeHint(data.user); return data; } catch (error) { if (error.code === 'session') return null; throw error; } },
      async signUp(email, password, language, turnstile) { await call('signup', { method: 'POST', body: { email, password, language: languages.includes(language) ? language : 'fr', consent: true, ...(turnstile ? { turnstile } : {}) } }); },
      async signIn(email, password) { return signedIn(await call('login', { method: 'POST', body: { email, password } })); },
      async recover(email, language, turnstile) { await call('recover', { method: 'POST', body: { email, language, ...(turnstile ? { turnstile } : {}) } }); },
      async unsubscribe(token) { if (!tokenPattern.test(token)) throw new AccountError('link_invalid'); return call('unsubscribe', { method: 'POST', body: { token } }); },
      async verify(token) { return signedIn(await call('verify', { method: 'POST', body: { token } })); },
      async resetPassword(token, password) { return signedIn(await call('reset', { method: 'POST', body: { token, password } })); },
      async signOut() { try { await call('logout', { method: 'POST', body: {} }); } catch { /* already signed out */ } writeHint(null); },
      async profile() { return (await call('me')).profile; },
      async updateProfile(profile) { return (await call('profile', { method: 'PUT', body: profile })).profile; },
      async savedReferences() { return (await call('saved')).references || []; },
      async addSaved(ref) { if (!refPattern.test(ref)) throw new AccountError('invalid_input'); await call('saved', { method: 'POST', body: { references: [ref] } }); },
      async removeSaved(ref) { if (!refPattern.test(ref)) throw new AccountError('invalid_input'); await call('saved/' + ref, { method: 'DELETE' }); },
      async syncSaved(localRefs) {
        const user = readHint();
        if (!user) throw new AccountError('session');
        let first = true;
        try { first = storage.getItem(SYNC_KEY) !== user.id; } catch { /* treat as first */ }
        const { merged, upload } = mergeSaved(localRefs, await api.savedReferences(), first);
        for (let i = 0; i < upload.length; i += 50) {
          try { await call('saved', { method: 'POST', body: { references: upload.slice(i, i + 50) } }); }
          catch (error) { if (error.code !== 'quota') throw error; }
        }
        try { storage.setItem(SYNC_KEY, user.id); } catch { /* ignore */ }
        return merged;
      },
      async searches() { return (await call('searches')).searches || []; },
      async addSearch(name, criteria, alerts = false) {
        const clean = String(name || '').trim().slice(0, 80);
        if (!clean || !criteria || typeof criteria !== 'object' || Array.isArray(criteria)) throw new AccountError('invalid_input');
        await call('searches', { method: 'POST', body: { name: clean, criteria, alerts: alerts === true } });
      },
      async setSearchAlerts(id, alerts) { if (!uuid.test(id)) throw new AccountError('invalid_input'); return call('searches/' + id, { method: 'PATCH', body: { alerts: alerts === true } }); },
      async removeSearch(id) { if (!uuid.test(id)) throw new AccountError('invalid_input'); await call('searches/' + id, { method: 'DELETE' }); },
      async history() { return (await call('history')).history || []; },
      async addHistory(entry) {
        // Only these five fields are ever sent: no contact details, no message.
        const row = { id: entry.id, kind: entry.kind === 'seller' ? 'seller' : 'buyer', purpose: ['info', 'viewing', 'documents'].includes(entry.purpose) ? entry.purpose : 'info', listing_reference: refPattern.test(entry.listing_reference || '') ? entry.listing_reference : '', language: languages.includes(entry.language) ? entry.language : 'fr' };
        if (!uuid.test(row.id)) throw new AccountError('invalid_input');
        await call('history', { method: 'POST', body: row });
      },
      async exportData() { return call('export'); },
      async deleteAccount(password) { await call('delete', { method: 'POST', body: { password } }); writeHint(null); }
    };
    return api;
  }

  return { AccountError, HINT_KEY, SYNC_KEY, configured, parseAuthHash, mergeSaved, createClient };
});
