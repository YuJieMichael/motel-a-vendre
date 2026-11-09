const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const E = require('../lib/enquiry-core.js');

const requestId = '1eab8fca-c2a5-4d89-802f-f4335f34ff94';
const otherId = '729b093c-a9f9-45a2-8bf7-0645b2493ea2';
const config = {
  intake: 'site',
  allowedOrigins: ['http://127.0.0.1:5173', 'https://motelavendre.ca']
};
const origin = 'http://127.0.0.1:5173';
const draft = {
  kind: 'buyer', name: '  Essai local  ', email: 'test@example.invalid', phone: '+1 514 555 0100',
  message: 'Please confirm the sale scope.', budget: 3000000, region: 'Laurentides', timeline: '3-6', contactTime: 'Weekdays'
};
const property = { real: true, reference: '100024', source: { originalAddress: 'PRIVATE' }, name: 'Do not trust client property details' };
const build = (changes = {}, options = {}) => E.buildPayload({ ...draft, ...changes }, { property, language: 'en', requestId, ...options });
const code = expected => error => error instanceof E.EnquiryError && error.code === expected;
const success = () => ({ status: 200, json: async () => ({ ok: true }) });

test('enquiry core exposes the same buildless browser and CommonJS API', () => {
  const context = { URL, TextEncoder };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/enquiry-core.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.MAVEnquiry).sort(), Object.keys(E).sort());
  assert.equal(context.MAVEnquiry.canSubmit(config, origin), true);
});

test('submission requires the exact configured origin and the site intake', () => {
  assert.equal(E.canSubmit(config, origin), true);
  assert.equal(E.canSubmit(config, 'https://motelavendre.ca'), true);
  for (const candidate of ['null', 'file://', 'http://127.0.0.1:5175', 'https://motelavendre.ca.evil', 'https://motelavendre.ca/', 'https://user:pass@motelavendre.ca']) {
    assert.equal(E.canSubmit(config, candidate), false, candidate);
  }
  // Only this site's own /api/enquiry is supported; any other intake setting disables sending.
  for (const intake of [undefined, '', 'supabase', 'SITE']) assert.equal(E.canSubmit({ ...config, intake }, origin), false, String(intake));
  assert.equal(E.canSubmit({ allowedOrigins: config.allowedOrigins, endpoint: 'https://project.supabase.co/functions/v1/submit-enquiry', publishableKey: 'sb_publishable_local_mock_key_123456' }, origin), false);
  assert.equal(E.canSubmit({ ...config, allowedOrigins: [] }, origin), false);
});

test('buyer payload maps acquisition fields without copying private or client property facts', () => {
  const p = build();
  assert.equal(p.name, 'Essai local');
  assert.equal(p.listingReference, '100024');
  assert.equal(p.budgetMax, '3000000');
  assert.equal(p.city, 'Laurentides');
  assert.equal(p.propertyType, 'hotel-motel');
  assert.equal(p.contactLanguage, 'en');
  assert.equal(p.contactMethod, 'email');
  assert.equal(p.contactTime, 'Weekdays');
  assert.equal(p.address, '');
  assert.equal(p.website, '');
  assert.match(p.requirements, /Source: motelavendre\.ca/);
  assert.match(p.requirements, /information request/);
  assert.match(p.requirements, /In 3 to 6 months/);
  assert.equal(p.timeline, '');
  assert.ok(!JSON.stringify(p).includes('PRIVATE'));
  assert.ok(!JSON.stringify(p).includes('Do not trust'));
});

test('generic enquiries have no property reference; demo and forged references cannot be submitted', () => {
  assert.equal(build({}, { property: undefined }).listingReference, '');
  assert.equal(build({}, { property: { real: true, reference: 100024 } }).listingReference, '100024');
  for (const candidate of [{ real: false, reference: 'MAV-001' }, { reference: '100024' }, { real: false, reference: '100024' }]) {
    assert.throws(() => build({}, { property: candidate }), code('demo'));
  }
  for (const reference of ['MAV-001', 'https://example.com/100024', '', '100024?email=private', '9999999999999999999']) {
    assert.throws(() => build({}, { property: { real: true, reference } }), code('invalid'));
  }
});

test('local timeline codes and real calendar dates stay in requirements rather than the API date field', () => {
  for (const timeline of ['', 'exploring', '0-3', '3-6', '6+', '2028-02-29', '2030-12-12']) {
    const p = build({ timeline });
    assert.equal(p.timeline, '');
    if (/^\d/.test(timeline) && timeline.includes('-') && timeline.length === 10) assert.ok(p.requirements.includes(timeline));
  }
  for (const timeline of ['tomorrow', '2026-02-30', '2027-02-29', '2026-13-01', '0000-01-01']) {
    assert.throws(() => build({ timeline }), code('invalid'));
  }
});

test('all three languages preserve a specific viewing or confidential-document request', () => {
  for (const language of ['fr', 'en', 'zh']) {
    const information = build({}, { language, purpose: 'info' });
    const viewing = build({}, { language, purpose: 'viewing' });
    const documents = build({}, { language, purpose: 'documents' });
    assert.notEqual(information.requirements, viewing.requirements);
    assert.notEqual(documents.requirements, information.requirements);
    assert.match(documents.requirements, /NDA/);
    assert.equal(documents.contactLanguage, language);
    assert.ok(documents.requirements.includes(draft.message));
  }
  assert.throws(() => build({}, { purpose: 'automatic-nda-signature' }), code('invalid'));
});

test('seller submissions require an explicit supported service choice and omit buyer budgets', () => {
  assert.throws(() => build({ kind: 'seller' }, { property: null }), code('service'));
  assert.throws(() => build({ kind: 'seller', service: 'automatically-agreed' }, { property: null }), code('service'));
  assert.equal(build({ kind: 'seller', service: 'hybrid' }, { property: null }).service, 'hybrid');
  const p = build({ kind: 'seller', service: 'hybrid' }, { property: null, service: 'broker' });
  assert.equal(p.service, 'broker');
  assert.equal(p.budgetMax, '');
  assert.equal(p.assistance, '');
  assert.equal(build({ service: 'broker' }).service, '');
});

test('invalid contact data, unsafe controls, unsupported budgets and honeypot input are blocked locally', () => {
  for (const changes of [{ name: '  ' }, { email: 'invalid' }, { phone: '\u0000' }, { budget: -1 }, { budget: 3.4 }, { budget: Infinity }, { budget: 1000000001 }, { budget: '3e6' }, { website: 'spam.example' }, { message: 'x'.repeat(3000) }]) {
    assert.throws(() => build(changes), code('invalid'));
  }
  assert.equal(build({ budget: 0 }).budgetMax, '0');
  assert.equal(build({ budget: null }).budgetMax, '');
  assert.equal(build({ budget: '003000000' }).budgetMax, '3000000');
  for (const options of [{ requestId: 'not-a-uuid' }, { requestId: requestId.replace('-4d89-', '-1d89-') }, { language: 'de' }]) {
    assert.throws(() => build({}, options), code('invalid'));
  }
});

test('only bounded analytics labels are retained and the caller owns idempotency request IDs', () => {
  assert.equal(build({ analyticsSource: 'google' }).analyticsSource, 'google');
  assert.equal(build({ analyticsSource: 'https://example.com/?email=private' }).analyticsSource, 'unknown');
  assert.equal(build().requestId, requestId);
  assert.equal(build({ message: 'Changed locally' }).requestId, requestId);
  assert.equal(build({}, { requestId: otherId }).requestId, otherId);
});

test('successful API collection uses POST JSON, no contact URL data, and does not claim email delivery', async () => {
  const payload = build();
  const controller = new AbortController();
  const calls = [];
  const result = await E.send(config, payload, { origin, signal: controller.signal, fetchImpl: async (...args) => { calls.push(args); return success(); } });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, '/api/enquiry');
  assert.ok(!url.includes(payload.email));
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.apikey, undefined);
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.equal(options.signal, controller.signal);
  assert.equal(JSON.parse(options.body).requestId, requestId);
});

test('explicit user retries reuse their original request ID; the library never retries automatically', async () => {
  const calls = [];
  const payload = build();
  const fetchImpl = async (url, options) => { calls.push(JSON.parse(options.body).requestId); throw Error('test network interruption'); };
  await assert.rejects(E.send(config, payload, { origin, fetchImpl }), code('network'));
  assert.deepEqual(calls, [requestId]);
  await assert.rejects(E.send(config, payload, { origin, fetchImpl }), code('network'));
  assert.deepEqual(calls, [requestId, requestId]);
});

test('429 has a rate error and non-success/invalid responses never produce success', async () => {
  await assert.rejects(E.send(config, build(), { origin, fetchImpl: async () => ({ status: 429 }) }), code('rate'));
  for (const response of [
    null, undefined,
    { status: 400 }, { status: 401 }, { status: 403 }, { status: 404 }, { status: 503 },
    { status: 201, json: async () => ({ ok: true }) },
    { status: 200, json: async () => ({ ok: false }) },
    { status: 200, json: async () => ({ ok: 'true' }) },
    { status: 200, json: async () => { throw Error('non-JSON body'); } }
  ]) {
    await assert.rejects(E.send(config, build(), { origin, fetchImpl: async () => response }), code('unavailable'));
  }
});

test('configuration and invalid/oversized request failures never invoke the network', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return success(); };
  await assert.rejects(E.send(config, build(), { origin: 'null', fetchImpl }), code('unavailable'));
  await assert.rejects(E.send(config, { requestId: 'bad' }, { origin, fetchImpl }), code('invalid'));
  await assert.rejects(E.send(config, { ...build(), requirements: '字'.repeat(6000) }, { origin, fetchImpl }), code('invalid'));
  assert.equal(calls, 0);
});
