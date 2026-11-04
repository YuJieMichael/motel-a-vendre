(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MAVEnquiry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const languages = ['fr', 'en', 'zh'];
  const purposes = ['info', 'viewing', 'documents'];
  const sources = ['direct', 'google', 'bing', 'facebook', 'instagram', 'linkedin', 'wechat', 'xiaohongshu', 'other', 'unknown'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const copy = {
    fr: {
      source: 'Source : motelavendre.ca',
      info: 'Objet : demande de renseignements.',
      viewing: 'Objet : demande de visite. L’horaire reste à confirmer avec l’équipe.',
      documents: 'Objet : demande de documents confidentiels. Disponibilité et NDA à vérifier par l’équipe; cette demande ne signe aucune entente.',
      timeline: 'Échéancier souhaité',
      times: { exploring: 'En réflexion', '0-3': 'D’ici 3 mois', '3-6': 'Dans 3 à 6 mois', '6+': 'Dans plus de 6 mois' }
    },
    en: {
      source: 'Source: motelavendre.ca',
      info: 'Purpose: information request.',
      viewing: 'Purpose: viewing request. The time must be confirmed with the team.',
      documents: 'Purpose: confidential documents request. Availability and NDA require team review; this request does not sign an agreement.',
      timeline: 'Preferred timeframe',
      times: { exploring: 'Exploring', '0-3': 'Within 3 months', '3-6': 'In 3 to 6 months', '6+': 'In more than 6 months' }
    },
    zh: {
      source: '来源：motelavendre.ca',
      info: '咨询目的：了解物业资料。',
      viewing: '咨询目的：申请参观物业。具体时间须由团队与您确认。',
      documents: '咨询目的：申请保密资料。资料可用性及 NDA 须由团队核验；本次申请不构成签署协议。',
      timeline: '计划时间',
      times: { exploring: '考察中', '0-3': '3个月内', '3-6': '3至6个月', '6+': '6个月以后' }
    }
  };

  class EnquiryError extends Error {
    constructor(code, details = {}) {
      super('Enquiry ' + code);
      this.name = 'EnquiryError';
      this.code = code;
      if (details.field) this.field = details.field;
      if (Number.isInteger(details.status)) this.status = details.status;
    }
  }

  function invalid(field) { throw new EnquiryError('invalid', { field }); }
  function text(value, field, maximum, required = false) {
    const input = value == null ? '' : value;
    if (typeof input !== 'string' || input.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input)) invalid(field);
    const result = input.trim();
    if (required && !result) invalid(field);
    return result;
  }

  function safeEndpoint(endpoint) {
    if (typeof endpoint !== 'string' || endpoint.length > 200) return false;
    try {
      const url = new URL(endpoint);
      return url.protocol === 'https:' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.supabase\.co$/.test(url.hostname)
        && ['/functions/v1/submit-enquiry','/functions/v1/motel-services/enquiry'].includes(url.pathname) && !url.search && !url.hash
        && !url.username && !url.password && !url.port && url.href === endpoint;
    } catch { return false; }
  }

  function canonicalOrigin(origin) {
    if (typeof origin !== 'string') return false;
    try {
      const url = new URL(origin);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === origin && !url.username && !url.password;
    } catch { return false; }
  }

  // intake 'site': enquiries go to this site's own /api/enquiry (Cloudflare D1), not to Supabase.
  const siteIntake = config => plain(config) && config.intake === 'site';
  function canSubmit(config, origin) {
    if (siteIntake(config)) return canonicalOrigin(origin) && Array.isArray(config.allowedOrigins)
      && config.allowedOrigins.some(allowed => canonicalOrigin(allowed) && allowed === origin);
    return plain(config) && safeEndpoint(config.endpoint)
      && typeof config.publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]{8,256}$/.test(config.publishableKey)
      && canonicalOrigin(origin) && Array.isArray(config.allowedOrigins)
      && config.allowedOrigins.some(allowed => canonicalOrigin(allowed) && allowed === origin);
  }

  function amount(value) {
    if (value === null || value === undefined || value === '') return '';
    if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))
      || !Number.isSafeInteger(Number(value)) || Number(value) > 1000000000) invalid('budget');
    return String(Number(value));
  }

  function timeframe(value, language) {
    const input = text(value, 'timeline', 200);
    if (!input) return '';
    if (copy[language].times[input]) return copy[language].times[input];
    // A date can be retained as the user's written request. The API date field is
    // deliberately blank: local timeframe choices are not API calendar dates.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) invalid('timeline');
    const [year, month, day] = input.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) invalid('timeline');
    return input;
  }

  function buildPayload(draft, options = {}) {
    if (!plain(draft) || !plain(options)) invalid('draft');
    const kind = draft.kind === undefined ? 'buyer' : draft.kind;
    if (!['buyer', 'seller'].includes(kind)) invalid('kind');
    const language = options.language || draft.language || 'fr';
    if (!languages.includes(language)) invalid('language');
    const requestId = text(options.requestId, 'requestId', 36, true);
    if (!uuid.test(requestId)) invalid('requestId');
    const purpose = options.purpose || 'info';
    if (!purposes.includes(purpose)) invalid('purpose');
    const property = options.property;
    let listingReference = '';
    if (property !== null && property !== undefined) {
      if (!plain(property) || property.real !== true) throw new EnquiryError('demo', { field: 'property' });
      if ((typeof property.reference !== 'string' && typeof property.reference !== 'number')
        || !/^\d{1,18}$/.test(String(property.reference))) invalid('listingReference');
      if (typeof property.reference === 'number' && !Number.isSafeInteger(property.reference)) invalid('listingReference');
      listingReference = String(property.reference);
    }
    const service = kind === 'seller' ? options.service || draft.service || '' : '';
    if (kind === 'seller' && !['broker', 'hybrid'].includes(service)) throw new EnquiryError('service', { field: 'service' });
    const name = text(draft.name, 'name', 120, true);
    const email = text(draft.email, 'email', 254, true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('email');
    if (text(draft.website, 'website', 200)) invalid('website');
    const message = text(draft.message, 'message', 3000);
    const preferredTime = timeframe(draft.timeline, language);
    const requirements = [copy[language].source, copy[language][purpose],
      preferredTime ? copy[language].timeline + ': ' + preferredTime : '', message].filter(Boolean).join('\n');
    text(requirements, 'requirements', 3000);
    return {
      requestId, kind, language, name, email,
      phone: text(draft.phone, 'phone', 40),
      city: text(draft.region, 'region', 200),
      address: '', listingReference, propertyType: 'hotel-motel', daycareSubsidy: '',
      budgetMin: '', budgetMax: kind === 'buyer' ? amount(draft.budget) : '', expectedPrice: '',
      timeline: '', service, assistance: '', contactLanguage: language, contactMethod: 'email',
      contactTime: text(draft.contactTime, 'contactTime', 200), requirements, website: '',
      analyticsSource: sources.includes(draft.analyticsSource) ? draft.analyticsSource : 'unknown'
    };
  }

  async function send(config, payload, { origin, fetchImpl, signal } = {}) {
    if (!canSubmit(config, origin)) throw new EnquiryError('unavailable');
    if (!plain(payload) || !uuid.test(payload.requestId || '')) invalid('requestId');
    let encoded;
    try { encoded = JSON.stringify(payload); }
    catch { invalid('payload'); }
    if (new TextEncoder().encode(encoded).byteLength > 16000) invalid('payload');
    const request = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (typeof request !== 'function') throw new EnquiryError('network');
    let response;
    try {
      response = siteIntake(config)
        ? await request('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: encoded, signal, credentials: 'omit', redirect: 'error' })
        : await request(config.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
          body: encoded, signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
        });
    } catch { throw new EnquiryError('network'); }
    if (!response || !Number.isInteger(response.status)) throw new EnquiryError('unavailable');
    if (response.status === 429) throw new EnquiryError('rate', { status: 429 });
    if (response.status !== 200) throw new EnquiryError('unavailable', { status: response.status });
    let body;
    try { body = await response.json(); }
    catch { throw new EnquiryError('unavailable', { status: response.status }); }
    if (!plain(body) || body.ok !== true) throw new EnquiryError('unavailable', { status: response.status });
    if (body.preview === true) return { ok: true, preview: true };
    return { ok: true };
  }

  return { EnquiryError, canSubmit, buildPayload, send };
});
