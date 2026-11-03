import { parseEnquiry } from '../_shared/enquiry.ts';
import { readSmallJson } from '../_shared/invitation.ts';
import { hasValidAppKey, trafficSource, trafficClientHash } from '../_shared/traffic-metrics.ts';

type Dependencies = { env: (key:string)=>string|undefined; createClient:(url:string,key:string)=>any };
export function createHandler(deps:Dependencies) {
 return async (request:Request):Promise<Response> => {
  const origin=request.headers.get('origin')||'';
  const allowed=['https://motelavendre.ca','https://www.motelavendre.ca','http://127.0.0.1:5173'];
  const headers={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'https://motelavendre.ca','Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store',Vary:'Origin'};
  const reply=(status:number,body:unknown)=>Response.json(body,{status,headers});
  if(!allowed.includes(origin))return reply(403,{error:'forbidden'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply(405,{error:'method'});
  if(!hasValidAppKey(request,deps.env))return reply(401,{error:'unauthorized'});
  const route=new URL(request.url).pathname.split('/').pop();
  if(!['enquiry','events'].includes(route||''))return reply(404,{error:'route'});
  let input:any, data:any;
  try {
   input=await readSmallJson(request,route==='events'?2048:16000);
   if(route==='enquiry'){
    data=parseEnquiry(input);
    if(data.propertyType!=='hotel-motel')throw Error('invalid');
   }else{
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['event','language','source','reference'].includes(k)))throw Error('invalid');
    if(!['page_view','property_view','guide_view','enquiry_open'].includes(input.event)||!['fr','en','zh'].includes(input.language))throw Error('invalid');
    if(typeof input.reference!=='string'||!/^\d{0,12}$/.test(input.reference))throw Error('invalid');
    if(input.source!==trafficSource(input.source))throw Error('invalid');
    if(input.event==='property_view'&&!input.reference)throw Error('invalid');
   }
  }catch{return reply(400,{error:'invalid_input'});}
  // Local preview exercises contracts without saving production enquiries/events.
  if(origin.startsWith('http:'))return reply(200,{ok:true,preview:true});
  try {
   const secret=deps.env('SUPABASE_SERVICE_ROLE_KEY'),url=deps.env('SUPABASE_URL');
   if(!secret||!url)return reply(503,{error:'unavailable'});
   const db=deps.createClient(url,secret),ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
   if(route==='enquiry'){
    const salt=deps.env('ENQUIRY_RATE_SALT')||secret;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+ip)))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const {error}=await db.rpc('collect_motel_enquiry',{p_id:data.requestId,p_payload:data,p_client_hash:hash,p_source:trafficSource(input.analyticsSource)});
    if(error)return reply(String(error.message).includes('rate_limit')?429:503,{error:'not_saved'});
    return reply(200,{ok:true,receipt:data.requestId});
   }
   const hash=await trafficClientHash(secret,ip);
   const {data:recorded,error}=await db.rpc('record_motel_metric',{p_event:input.event,p_language:input.language,p_source:input.source,p_reference:input.reference,p_client_hash:hash});
   return error?reply(503,{error:'unavailable'}):reply(200,{ok:recorded===true});
  }catch{return reply(503,{error:'unavailable'});}
 };
}
