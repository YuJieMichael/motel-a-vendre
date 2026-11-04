// Enquiry intake at POST /api/enquiry, stored in this site's D1 (binding ACCOUNTS).
// Validation follows supabase/functions/_shared/enquiry.ts (parseEnquiry), limited to
// hotel/motel enquiries. Each new enquiry is emailed to the active owner(s).
const LIMITS = { requestId: 36, kind: 6, language: 2, name: 120, email: 254, phone: 40, city: 200, address: 300, listingReference: 36, propertyType: 20, daycareSubsidy: 20, budgetMin: 10, budgetMax: 10, expectedPrice: 10, timeline: 200, service: 6, assistance: 100, contactLanguage: 2, contactMethod: 5, contactTime: 200, requirements: 3000, website: 200 };
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = ['direct', 'google', 'bing', 'facebook', 'instagram', 'linkedin', 'wechat', 'xiaohongshu', 'other', 'unknown'];

export function parseEnquiry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid');
  const r = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    const v = value[key] ?? '';
    if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) throw Error('invalid');
    r[key] = v.trim();
  }
  if (!UUID4.test(r.requestId) || !['buyer', 'seller'].includes(r.kind) || !['en', 'fr', 'zh'].includes(r.language)) throw Error('invalid');
  if (!r.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || r.website) throw Error('invalid');
  for (const key of ['budgetMin', 'budgetMax', 'expectedPrice']) if (r[key] && (!/^\d+$/.test(r[key]) || Number(r[key]) > 1000000000)) throw Error('invalid');
  if (r.timeline && !/^\d{4}-\d{2}-\d{2}$/.test(r.timeline)) throw Error('invalid');
  if (r.budgetMin && r.budgetMax && Number(r.budgetMin) > Number(r.budgetMax)) throw Error('invalid');
  if (r.listingReference && !/^\d{1,18}$/.test(r.listingReference)) throw Error('invalid');
  if (r.propertyType !== 'hotel-motel' || r.daycareSubsidy || !['', 'hybrid', 'broker'].includes(r.service)) throw Error('invalid');
  if (r.kind === 'buyer') { r.address = ''; r.expectedPrice = ''; r.service = ''; }
  else { if (!['broker', 'hybrid'].includes(r.service)) throw Error('invalid'); r.budgetMin = ''; r.budgetMax = ''; }
  if (!['', 'en', 'fr', 'zh'].includes(r.contactLanguage) || !['', 'email', 'phone'].includes(r.contactMethod)) throw Error('invalid');
  const allowed = ['photos', 'video', 'listing', 'pricing', 'visits', 'offers', 'unsure'], requested = r.assistance ? r.assistance.split(',') : [];
  if (requested.some(id => !allowed.includes(id)) || new Set(requested).size !== requested.length || (requested.includes('unsure') && requested.length > 1)) throw Error('invalid');
  r.assistance = r.kind === 'seller' && r.service === 'hybrid' ? allowed.filter(id => requested.includes(id)).join(',') : '';
  delete r.website;
  r.analyticsSource = SOURCES.includes(value.analyticsSource) ? value.analyticsSource : 'unknown';
  return r;
}

const hex = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
const LABELS = { name: 'Nom / Name / 姓名', email: 'Courriel / Email / 邮箱', phone: 'Téléphone / Phone / 电话', city: 'Région / Region / 地区', address: 'Adresse / Address / 地址', budgetMax: 'Budget (CAD)', expectedPrice: 'Prix souhaité / Expected price / 期望售价 (CAD)', service: 'Service', assistance: 'Assistance', contactTime: 'Disponibilités / Availability / 方便联系时间', requirements: 'Message' };

export function createEnquiryIntake({ site, now = () => Date.now(), fetchImpl = (...a) => fetch(...a) }) {
  const sec = () => Math.floor(now() / 1000);
  const reply = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  async function notify(env, row, listing) {
    const owners = (await env.ACCOUNTS.prepare("SELECT email FROM staff_members WHERE role='owner' AND active=1").all()).results.map(r => r.email);
    if (!owners.length) return false;
    const p = row.payload, kind = p.kind === 'seller' ? 'Vendeur / Seller / 卖家' : 'Acheteur / Buyer / 买家';
    const lines = [`${kind} · ${p.language.toUpperCase()}`, p.listingReference ? `#${p.listingReference}${listing ? ' — ' + [listing.city, listing.price ? listing.price.toLocaleString('fr-CA') + ' $' : ''].filter(Boolean).join(' · ') : ''}\n${site.siteOrigin}/fr/proprietes/${p.listingReference}/` : 'Demande générale / General enquiry / 通用咨询', ''];
    for (const [k, label] of Object.entries(LABELS)) if (p[k]) lines.push(`${label}: ${p[k]}`);
    lines.push('', `${site.siteOrigin}/admin/#enquiries`);
    const message = { to: owners.join(', '), subject: `Nouvelle demande Motel à vendre — ${p.name}`, text: lines.join('\n') };
    if (typeof env.ACCOUNT_MAIL_LOG === 'function') { env.ACCOUNT_MAIL_LOG(message); return true; }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) return false;
    try {
      const r = await fetchImpl('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(10000), headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.MAIL_FROM, to: owners, reply_to: p.email, subject: message.subject, text: message.text }) });
      return r.ok;
    } catch { return false; }
  }

  // catalogueLookup(reference) → the public listing, used for the email and the staff view.
  return async function intake(request, env, { catalogueLookup = () => null, local = false } = {}) {
    const origin = request.headers.get('origin') || '';
    if (!local && origin !== site.siteOrigin) return reply(403, { error: 'forbidden' });
    if (request.method !== 'POST') return reply(405, { error: 'method' });
    if (!env || !env.ACCOUNTS) return reply(503, { error: 'unavailable' });
    let data;
    try {
      const text = await request.text();
      if (text.length > 16000) throw Error('size');
      data = parseEnquiry(JSON.parse(text));
    } catch { return reply(400, { error: 'invalid_input' }); }
    const db = env.ACCOUNTS, t = sec();
    // Fixed-window limits on a hash of the address (no raw IP stored): 8 per hour per connection, 4 per hour per email.
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    for (const [key, max] of [['enquiry-ip:' + ip, 8], ['enquiry-email:' + data.email.toLowerCase(), 4]]) {
      const start = t - (t % 3600);
      const row = await db.prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES(?1,?2,1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN window_start=?2 THEN count+1 ELSE 1 END, window_start=?2 RETURNING count').bind(await hex(key), start).first();
      if (row.count > max) return reply(429, { error: 'rate' });
    }
    const listing = data.listingReference ? catalogueLookup(data.listingReference) : null;
    if (listing) Object.assign(data, { listingStatus: 'linked', listingNumber: data.listingReference, listingCity: listing.city || '', listingPrice: listing.price ? String(listing.price) : '' });
    const inserted = await db.prepare('INSERT INTO enquiries(id,created_at,kind,language,email,listing_reference,payload) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO NOTHING RETURNING id')
      .bind(data.requestId.toLowerCase(), t, data.kind, data.language, data.email, data.listingReference, JSON.stringify(data)).first();
    // A retried submission with the same requestId is accepted without a second email.
    if (inserted && await notify(env, { payload: data }, listing)) await db.prepare('UPDATE enquiries SET notified_at=?1 WHERE id=?2').bind(t, inserted.id).run();
    return reply(200, local ? { ok: true, preview: true } : { ok: true });
  };
}
