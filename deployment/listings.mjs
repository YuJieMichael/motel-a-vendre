// Listings owned by Motel à vendre: D1 table `listings` (binding ACCOUNTS), photos in R2 (binding PHOTOS).
// Each row stores one catalogue item validated by lib/catalogue-core.js before it is saved.
import Core from '../lib/catalogue-core.js';

export const FREE_DAYS = 30, REMINDER_DAYS = 7;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024, PHOTOS_PER_LISTING = 30;
const LANGS = ['fr', 'en', 'zh'], TYPES = ['motel', 'hotel', 'inn', 'hotel-motel'];
const REF = /^\d{1,12}$/, EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export const PHOTO_PATH = /^assets\/listings\/(\d{1,12})\/([a-f0-9]{24})\.(webp|jpg)$/;
const STATIC_PHOTO = /^assets\/(main|covers)\/[A-Za-z0-9_-]+\.(webp|png|jpe?g)$/;
const UNAVAILABLE = 'assets/property-unavailable.svg';

export class ListingError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
const bad = code => new ListingError(400, code || 'invalid_input');
const str = (v, max, field, optional = true) => {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw bad('invalid_' + field);
  v = v.trim(); if (!optional && !v) throw bad('missing_' + field); return v;
};
const num = (v, max, field, integer = false) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max || (integer && !Number.isInteger(n))) throw bad('invalid_' + field);
  return n;
};

// Admin form -> catalogue item. French copy is required; English and Chinese fall back to French when blank.
export function itemFromInput(input, reference, existing = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad();
  const type = TYPES.includes(input.type) ? input.type : null; if (!type) throw bad('invalid_type');
  const city = str(input.city, 120, 'city', false), cityBase = city.split(' (')[0].trim();
  const region = str(input.region, 120, 'region') || Core.regionOf(city);
  const price = num(input.price, 1e9, 'price'), rooms = num(input.rooms, 5000, 'rooms', true);
  if (rooms === 0) throw bad('invalid_rooms');
  const acres = num(input.acres, 1e7, 'acres'), parking = num(input.parking, 10000, 'parking', true);
  const season = ['year-round', 'seasonal'].includes(input.season) ? input.season : 'unknown';
  const copyIn = input.copy && typeof input.copy === 'object' ? input.copy : {};
  const read = lang => {
    const c = copyIn[lang] && typeof copyIn[lang] === 'object' ? copyIn[lang] : {};
    const features = (Array.isArray(c.features) ? c.features : String(c.features || '').split('\n')).map(x => str(x, 220, 'features')).filter(Boolean);
    if (features.length > 12) throw bad('invalid_features');
    return { short: str(c.short, 300, 'short'), description: str(c.description, 4000, 'description'), features };
  };
  const fr = read('fr'); if (!fr.short) throw bad('missing_short'); if (!fr.description) throw bad('missing_description');
  const copy = { fr };
  for (const lang of ['en', 'zh']) { const c = read(lang); copy[lang] = { short: c.short || fr.short, description: c.description || fr.description, features: c.features.length ? c.features : fr.features }; }
  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length > PHOTOS_PER_LISTING) throw bad('too_many_photos');
  for (const p of photos) {
    if (typeof p !== 'string') throw bad('invalid_photo');
    const m = PHOTO_PATH.exec(p);
    if (!(m && m[1] === reference) && !STATIC_PHOTO.test(p)) throw bad('invalid_photo');
  }
  const unique = [...new Set(photos)];
  // Keep an imported approximate wording ("Environ 17") while the exact count stays unknown.
  const roomsText = rooms === null && existing?.roomsText && existing.rooms === null ? existing.roomsText
    : Object.fromEntries(LANGS.map(lang => [lang, rooms === null ? '' : lang === 'zh' ? rooms + '间' : String(rooms)]));
  const names = Core.namesFor(type, cityBase);
  const item = {
    id: existing?.id || 'mav-' + reference, reference, name: names.fr, names, city, region, type, price, rooms, roomsText,
    acres, parking, tenure: input.tenure === 'freehold' ? 'freehold' : null, season,
    image: unique[0] || UNAVAILABLE, photos: unique, facts: Array.isArray(existing?.facts) ? existing.facts : [],
    illustrative: input.illustrative === true, copy
  };
  Core.validateCatalogue({ schemaVersion: 1, mode: 'main-snapshot', items: [item] }); // throws if anything is off
  return item;
}

export function sellerFromInput(input) {
  const s = input && typeof input.seller === 'object' && input.seller ? input.seller : {};
  const name = str(s.name, 120, 'seller_name'), email = str(s.email, 254, 'seller_email').toLowerCase();
  if (email && !EMAIL.test(email)) throw bad('invalid_seller_email');
  return { name: name || null, email: email || null, language: LANGS.includes(s.language) ? s.language : 'fr' };
}

// New listings get their own number range, distinct from the imported references.
export async function nextReference(db) {
  const row = await db.prepare('SELECT max(CAST(reference AS INTEGER)) AS top FROM listings').first();
  return String(Math.max(200000, Number(row?.top || 0)) + 1);
}

export function rowView(row, settings) {
  const item = JSON.parse(row.item), s = settings?.get(row.reference);
  return {
    reference: row.reference, status: row.status, revision: row.revision, item,
    free: row.free_listing === 1, free_until: row.free_until, seller: { name: row.seller_name || '', email: row.seller_email || '', language: row.seller_language || 'fr' },
    published_at: row.published_at, updated_at: row.updated_at, updated_by: row.updated_by,
    hidden: !!s?.hidden, pinned: !!s?.pinned
  };
}

export const photoKey = path => { const m = PHOTO_PATH.exec(path); return m ? `listings/${m[1]}/${m[2]}.${m[3]}` : null; };
export function photoTypeOf(bytes) {
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}
export function newPhotoPath(reference, ext) {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  return `assets/listings/${reference}/${id}.${ext}`;
}

// ---- Free first month: daily expiry, 7-day reminder, one notice at expiry ----
const NOTICE = {
  reminder: {
    fr: ['Votre annonce gratuite se termine le {date}', 'Bonjour {name},\n\nVotre annonce {title} (référence {ref}) sur motelavendre.ca est affichée gratuitement jusqu’au {date}.\nÀ cette date, elle sera retirée automatiquement. Aucun paiement ne sera prélevé.\n\nPour la prolonger, répondez simplement à ce courriel.\n\nMotel à vendre'],
    en: ['Your free listing ends on {date}', 'Hello {name},\n\nYour listing {title} (reference {ref}) on motelavendre.ca is displayed free of charge until {date}.\nIt will then be removed automatically. Nothing will be charged.\n\nTo extend it, simply reply to this email.\n\nMotel à vendre'],
    zh: ['您的免费房源将于 {date} 到期', '{name}，您好：\n\n您在 motelavendre.ca 上的房源 {title}（编号 {ref}）免费展示至 {date}。\n到期后房源会自动下架，不会收取任何费用。\n\n如需续期，直接回复本邮件即可。\n\nMotel à vendre']
  },
  expired: {
    fr: ['Votre annonce a été retirée', 'Bonjour {name},\n\nLa période gratuite de votre annonce {title} (référence {ref}) est terminée et l’annonce a été retirée de motelavendre.ca. Aucun paiement n’a été prélevé.\n\nPour la remettre en ligne, répondez simplement à ce courriel.\n\nMotel à vendre'],
    en: ['Your listing has been removed', 'Hello {name},\n\nThe free period for your listing {title} (reference {ref}) has ended and it has been removed from motelavendre.ca. Nothing was charged.\n\nTo put it back online, simply reply to this email.\n\nMotel à vendre'],
    zh: ['您的房源已下架', '{name}，您好：\n\n您的房源 {title}（编号 {ref}）免费展示期已结束，已从 motelavendre.ca 下架，没有收取任何费用。\n\n如需重新上架，直接回复本邮件即可。\n\nMotel à vendre']
  }
};
const dateIn = (sec, lang) => new Intl.DateTimeFormat({ fr: 'fr-CA', en: 'en-CA', zh: 'zh-CN' }[lang], { dateStyle: 'long', timeZone: 'America/Toronto' }).format(new Date(sec * 1000));
export function noticeMail(kind, row) {
  const lang = LANGS.includes(row.seller_language) ? row.seller_language : 'fr', item = JSON.parse(row.item);
  const vars = { name: row.seller_name || '', title: item.names?.[lang] || item.name, ref: row.reference, date: dateIn(row.free_until, lang) };
  const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const [subject, text] = NOTICE[kind][lang];
  return { subject: fill(subject), text: fill(text) };
}

// replyTo: the owner's mailbox, so a seller can answer the email directly.
export async function runListingLifecycle(env, { now = () => Date.now(), replyTo = '', fetchImpl = (...a) => fetch(...a), log = console.log } = {}) {
  const db = env && env.ACCOUNTS; if (!db) return { skipped: 'no-db' };
  const t = Math.floor(now() / 1000);
  const expiring = (await db.prepare("SELECT reference FROM listings WHERE status='published' AND free_until IS NOT NULL AND free_until<=?1").bind(t).all()).results || [];
  for (const r of expiring) await db.batch([
    db.prepare("UPDATE listings SET status='expired',revision=revision+1,updated_at=?2,updated_by='system' WHERE reference=?1 AND status='published'").bind(r.reference, t),
    db.prepare("INSERT INTO staff_audit(actor,action,target,at) VALUES('system','listing_expire',?1,?2)").bind(r.reference, t)
  ]);
  async function send(kind, row) {
    const mail = noticeMail(kind, row);
    if (typeof env.ACCOUNT_MAIL_LOG === 'function') { env.ACCOUNT_MAIL_LOG({ to: row.seller_email, ...mail }); return true; }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
    try {
      const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': `listing-${kind}/${row.reference}/${row.free_until}` },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [row.seller_email], ...(replyTo ? { reply_to: replyTo } : {}), subject: mail.subject, text: mail.text }) });
      return r.ok;
    } catch { return false; }
  }
  let reminders = 0, notices = 0;
  const due = (await db.prepare(`SELECT reference,item,free_until,seller_name,seller_email,seller_language FROM listings
    WHERE status='published' AND free_until>?1 AND free_until<=?2 AND reminder_sent_at IS NULL AND seller_email IS NOT NULL LIMIT 40`).bind(t, t + REMINDER_DAYS * 86400).all()).results || [];
  for (const row of due) if (await send('reminder', row)) { await db.prepare('UPDATE listings SET reminder_sent_at=?2 WHERE reference=?1 AND free_until=?3').bind(row.reference, t, row.free_until).run(); reminders++; }
  const ended = (await db.prepare(`SELECT reference,item,free_until,seller_name,seller_email,seller_language FROM listings
    WHERE status='expired' AND expiry_notice_sent_at IS NULL AND seller_email IS NOT NULL AND free_until>?1 LIMIT 40`).bind(t - REMINDER_DAYS * 86400).all()).results || [];
  for (const row of ended) if (await send('expired', row)) { await db.prepare('UPDATE listings SET expiry_notice_sent_at=?2 WHERE reference=?1 AND free_until=?3').bind(row.reference, t, row.free_until).run(); notices++; }
  log(`listings: ${expiring.length} expired, ${reminders} reminders, ${notices} expiry notices`);
  return { expired: expiring.length, reminders, notices };
}
