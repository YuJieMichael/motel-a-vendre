import { readSmallJson } from './invitation.ts';
import { enquiryDateRange } from './platform-date.ts';

export const TRAFFIC_SOURCES = ['direct', 'google', 'bing', 'facebook', 'instagram', 'linkedin', 'wechat', 'xiaohongshu', 'other', 'unknown'] as const;
export type TrafficSource = typeof TRAFFIC_SOURCES[number];
type TrafficEvent = { event: 'site_visit' | 'property_view'; source: TrafficSource; reference: string };
type Environment = (name: string) => string | undefined;

export function trafficSource(value: unknown): TrafficSource {
  return typeof value === 'string' && (TRAFFIC_SOURCES as readonly string[]).includes(value) ? value as TrafficSource : 'unknown';
}

export function trafficEvent(value: unknown): TrafficEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !['event', 'source', 'reference'].includes(key))) return null;
  if (body.event !== 'site_visit' && body.event !== 'property_view') return null;
  const source = body.source === undefined ? 'unknown' : trafficSource(body.source);
  if (body.source !== undefined && source !== body.source) return null;
  const reference = body.reference ?? '';
  if (typeof reference !== 'string' || reference.length > 36 || reference !== reference.trim()) return null;
  if (body.event === 'site_visit' ? reference !== '' : !/^(?:[0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(reference)) return null;
  return { event: body.event, source, reference };
}

// Match the submit-enquiry gateway, including the modern publishable-key map.
// A browser key permits this bounded ingestion endpoint, never private reports.
export function hasValidAppKey(request: Request, env: Environment): boolean {
  const supplied = request.headers.get('apikey');
  if (!supplied) return false;
  const allowed = [env('SUPABASE_ANON_KEY'), env('SUPABASE_PUBLISHABLE_KEY')].filter((key): key is string => !!key);
  try {
    const configured = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}') as Record<string, unknown>;
    allowed.push(...Object.values(configured).filter((key): key is string => typeof key === 'string'));
  } catch { /* A malformed optional map must not disable a valid configured key. */ }
  return allowed.includes(supplied);
}

export async function trafficClientHash(secret: string, ip: string, now = new Date()): Promise<string> {
  const day = enquiryDateRange(now).minimumDate;
  const input = new TextEncoder().encode(`${secret}\u0000traffic\u0000${day}\u0000${ip}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input))).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

type TrafficDependencies = {
  env: Environment;
  createClient: (url: string, key: string) => {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  };
  now?: () => Date;
};

export function createTrafficMetricsHandler(deps: TrafficDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = 'https://proprieteenvente.ca';
    const requestOrigin = request.headers.get('origin');
    const allowedOrigins = [origin, 'http://127.0.0.1:5173'];
    const headers = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(requestOrigin || '') ? requestOrigin! : origin,
      'Access-Control-Allow-Headers': 'content-type,apikey',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    };
    const reply = (status: number, ok = false) => Response.json({ ok }, { status, headers });
    if (!allowedOrigins.includes(requestOrigin || '')) return reply(403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405);
    if (!hasValidAppKey(request, deps.env)) return reply(401);
    let event: TrafficEvent | null;
    try { event = trafficEvent(await readSmallJson(request, 2048)); }
    catch { return reply(400); }
    if (!event) return reply(400);
    // Local previews can exercise the API contract without creating production
    // traffic. Production QA uses rejected/non-writing requests only.
    if (requestOrigin !== origin) return reply(200);
    const url = deps.env('SUPABASE_URL');
    const secret = deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !secret) return reply(503);
    try {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const hash = await trafficClientHash(secret, ip, deps.now?.() ?? new Date());
      const { data, error } = await deps.createClient(url, secret).rpc('record_site_metric', {
        p_event: event.event, p_source: event.source, p_reference: event.reference, p_client_hash: hash,
      });
      if (error) return reply(503);
      return reply(200, data === true);
    } catch { return reply(503); }
  };
}
