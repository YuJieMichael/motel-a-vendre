// Aggregate visit counts at POST /api/events, stored in D1 metric_counts.
// Only bounded labels are kept: no names, emails, URLs, query strings or IP addresses.
const EVENTS = ['page_view', 'property_view', 'guide_view', 'enquiry_open'];
const SOURCES = ['direct', 'google', 'bing', 'facebook', 'instagram', 'linkedin', 'wechat', 'xiaohongshu', 'other', 'unknown'];

export function parseEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!EVENTS.includes(value.event) || !['fr', 'en', 'zh'].includes(value.language)) return null;
  const reference = typeof value.reference === 'string' && /^\d{1,12}$/.test(value.reference) ? value.reference : '';
  return { event: value.event, language: value.language, source: SOURCES.includes(value.source) ? value.source : 'unknown', reference };
}

export async function recordEvent(request, env, { now = () => Date.now() } = {}) {
  const reply = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply(405);
  const db = env && env.ACCOUNTS; if (!db) return reply(503);
  const text = await request.text();
  if (text.length > 400) return reply(413);
  let event; try { event = parseEvent(JSON.parse(text)); } catch { event = null; }
  if (!event) return reply(400);
  const day = new Date(now()).toISOString().slice(0, 10);
  try {
    await db.prepare(`INSERT INTO metric_counts(day,event,language,source,reference,count) VALUES(?1,?2,?3,?4,?5,1)
      ON CONFLICT(day,event,language,source,reference) DO UPDATE SET count=count+1`).bind(day, event.event, event.language, event.source, event.reference).run();
  } catch { return reply(503); }
  return reply(204);
}
