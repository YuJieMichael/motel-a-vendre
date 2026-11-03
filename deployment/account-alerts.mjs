// Daily saved-search alerts (Cloudflare Cron Trigger). One email per saved search
// that has new matching listings; the first run after alerts are switched on only
// records a baseline so nobody receives the whole catalogue at once.
import C from '../lib/catalogue-core.js';
import { deliverMail } from './account-api.mjs';

const LANGS = ['fr', 'en', 'zh'];
const ACCOUNT_PATH = { fr: 'fr/compte/', en: 'en/account/', zh: 'zh/account/' };
const MAX_EMAILS_PER_RUN = 80; // Stays under Resend's free daily allowance with room for sign-ups.
const COPY = {
  fr: { subject: n => `Nouvelle propriété pour « ${n} »`, subjectMany: (n, k) => `${k} nouvelles propriétés pour « ${n} »`, intro: n => `Bonjour,\n\nDe nouvelles propriétés correspondent à votre recherche enregistrée « ${n} » sur Motel à vendre :`, price: 'Prix', toConfirm: 'à confirmer', manage: 'Gérer vos alertes', stop: 'Ne plus recevoir d’alertes pour cette recherche', footer: 'Vous recevez ce courriel parce que vous avez activé les alertes pour cette recherche dans votre compte Motel à vendre.' },
  en: { subject: n => `New property for “${n}”`, subjectMany: (n, k) => `${k} new properties for “${n}”`, intro: n => `Hello,\n\nNew properties match your saved search “${n}” on Motel à vendre:`, price: 'Price', toConfirm: 'to be confirmed', manage: 'Manage your alerts', stop: 'Stop alerts for this search', footer: 'You are receiving this email because you turned on alerts for this search in your Motel à vendre account.' },
  zh: { subject: n => `“${n}”有新物业`, subjectMany: (n, k) => `“${n}”有 ${k} 个新物业`, intro: n => `您好：\n\n以下新物业符合您在 Motel à vendre 保存的搜索“${n}”：`, price: '报价', toConfirm: '待确认', manage: '管理提醒', stop: '不再接收此搜索的提醒', footer: '您收到此邮件，是因为您在 Motel à vendre 账户中为该搜索开启了提醒。' }
};

// Listings matching saved criteria. A region that no longer exists matches nothing
// (normalizeRoute would otherwise widen it to "all regions").
export function matchingReferences(catalogue, criteria, lang) {
  const items = catalogue.items, regions = [...new Set(items.map(p => p.region))];
  if (criteria && typeof criteria.region === 'string' && criteria.region !== 'all' && !regions.includes(criteria.region)) return [];
  const state = C.normalizeRoute({ ...criteria, lang, tab: 'all' }, regions, lang);
  return C.selectListings(items, state).map(p => C.reference(p)).filter(r => /^\d{1,12}$/.test(r));
}

function emailFor({ search, lang, listings, site }) {
  const c = COPY[lang], money = v => v === null ? c.toConfirm : new Intl.NumberFormat({ fr: 'fr-CA', en: 'en-CA', zh: 'zh-CN' }[lang], { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v);
  const unsubscribePage = `${site.siteOrigin}/${ACCOUNT_PATH[lang]}#unsubscribe=${search.unsubscribe_token}`;
  const lines = [c.intro(search.name), ''];
  for (const p of listings) lines.push(`• ${C.nameOf(p, lang)} — ${p.city} — ${c.price} : ${money(p.price)}`, `  ${site.siteOrigin}/${lang}/proprietes/${C.reference(p)}/`, '');
  lines.push(`${c.manage} : ${site.siteOrigin}/${ACCOUNT_PATH[lang]}`, `${c.stop} : ${unsubscribePage}`, '', '—', c.footer);
  return {
    subject: listings.length === 1 ? c.subject(search.name) : c.subjectMany(search.name, listings.length),
    text: lines.join('\n'),
    headers: { 'List-Unsubscribe': `<${site.siteOrigin}/api/account/unsubscribe?t=${search.unsubscribe_token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  };
}

export async function runAlerts(env, { site, catalogue, now = () => Date.now(), log = console.log }) {
  const db = env.ACCOUNTS;
  if (!db || !catalogue || !Array.isArray(catalogue.items) || !catalogue.items.length) return { skipped: 'no-catalogue' };
  const t = Math.floor(now() / 1000), byRef = new Map(catalogue.items.map(p => [C.reference(p), p])), current = new Set(byRef.keys());
  const { results } = await db.prepare(`SELECT s.id, s.name, s.criteria, s.seen_refs, s.alert_checked_at, s.unsubscribe_token, u.email, coalesce(p.preferred_language, u.language) AS lang
    FROM saved_searches s JOIN users u ON u.id = s.user_id AND u.verified_at IS NOT NULL LEFT JOIN profiles p ON p.user_id = s.user_id
    WHERE s.alerts = 1 AND s.unsubscribe_token IS NOT NULL ORDER BY s.alert_checked_at IS NOT NULL, s.alert_checked_at`).all();
  let sent = 0, baselined = 0, failed = 0, deferred = 0;
  for (const search of results) {
    const lang = LANGS.includes(search.lang) ? search.lang : 'fr';
    let criteria = {}, seen = [];
    try { criteria = JSON.parse(search.criteria); seen = JSON.parse(search.seen_refs); } catch { /* treat as empty */ }
    const matches = matchingReferences(catalogue, criteria, lang);
    const seenNow = [...new Set([...seen.filter(r => current.has(r)), ...matches])]; // Forget withdrawn listings so the list stays small.
    const fresh = matches.filter(r => !seen.includes(r));
    if (search.alert_checked_at === null || !fresh.length) {
      if (search.alert_checked_at === null) baselined++;
      await db.prepare('UPDATE saved_searches SET seen_refs = ?1, alert_checked_at = ?2 WHERE id = ?3').bind(JSON.stringify(seenNow), t, search.id).run();
      continue;
    }
    if (sent >= MAX_EMAILS_PER_RUN) { deferred++; continue; } // Picked up first tomorrow (oldest check first).
    try {
      await deliverMail(env, { to: search.email, ...emailFor({ search, lang, listings: fresh.map(r => byRef.get(r)), site }) });
      sent++;
      await db.prepare('UPDATE saved_searches SET seen_refs = ?1, alert_checked_at = ?2 WHERE id = ?3').bind(JSON.stringify(seenNow), t, search.id).run();
    } catch { failed++; } // Not marked as seen: retried on the next run.
  }
  const summary = { searches: results.length, sent, baselined, failed, deferred };
  log('account-alerts', JSON.stringify(summary));
  return summary;
}
