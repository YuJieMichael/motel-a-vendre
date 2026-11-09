import createRenderer from '../lib/page-renderer.cjs';
import Routes from '../lib/site-routes.cjs';
import {loadCatalogue as loadSourceCatalogue,applyListingSettings,invalidateCatalogue} from './live-catalogue.mjs';
import {runListingLifecycle,PHOTO_PATH,photoKey} from './listings.mjs';
import {recordEvent} from './metrics.mjs';
import {template,translations,site,fallback} from './runtime-inputs.mjs';
import {responseHeaders} from './worker.mjs';
import {withGoogleAdsCsp} from './google-ads-csp.mjs';
import {createAccountApi} from './account-api.mjs';
import {runAlerts} from './account-alerts.mjs';
import {createAdminApi} from './admin-api.mjs';
import {createEnquiryIntake} from './enquiry-intake.mjs';

const locales={fr:'fr-CA',en:'en-CA',zh:'zh-Hans'};
const sections={fr:{'guide-achat':'guide',compte:'account'},en:{'buying-guide':'guide',account:'account'},zh:{'buying-guide':'guide',account:'account'}};
const accountsEnabled=!!(site.account&&site.account.enabled===true);
const accountApi=createAccountApi({siteOrigin:site.siteOrigin});
// Staff display settings, read at most once a minute per isolate; a staff change clears this copy at once.
const settingsCache={at:0,rows:[]};
async function listingSettings(env){
 if(!env||!env.ACCOUNTS)return [];
 if(Date.now()-settingsCache.at<60000)return settingsCache.rows;
 try{settingsCache.rows=(await env.ACCOUNTS.prepare('SELECT listing_reference,hidden,pinned FROM listing_settings').all()).results||[];}catch{/* table not migrated yet: show everything */}
 settingsCache.at=Date.now();return settingsCache.rows;
}
async function loadCatalogue(site,fallback,env){const result=await loadSourceCatalogue(site,fallback,{db:env&&env.ACCOUNTS});return {...result,catalogue:applyListingSettings(result.catalogue,await listingSettings(env))};}
const adminApi=createAdminApi({site,onListingsChanged:()=>{settingsCache.at=0;invalidateCatalogue();}});
const enquiryIntake=createEnquiryIntake({site});
const turnstile=accountsEnabled&&/^0x[A-Za-z0-9_-]{10,}$/.test(site.account.turnstileSiteKey||'');
const turnstileOrigin='https://challenges.cloudflare.com';
const checkedDay=c=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.updatedAt));
const notices={fr:'La mise à jour du catalogue est momentanément indisponible. Dernière vérification : ',en:'The catalogue update is temporarily unavailable. Last checked: ',zh:'目录更新暂时不可用。上次核验：'};
export async function handleLiveRequest(request,env){
 const url=new URL(request.url),local=['127.0.0.1','localhost'].includes(url.hostname);
 const wrapped=(r,policy)=>responseHeaders(r,request,policy);
 if(!local&&!['motelavendre.ca','www.motelavendre.ca'].includes(url.hostname))return wrapped(new Response('Not found',{status:404}));
 if(url.pathname.startsWith('/api/account/')){
  // Account API (Cloudflare D1). Plain HTTP is refused rather than redirected so credentials never travel unencrypted.
  if(!accountsEnabled)return wrapped(Response.json({error:'unavailable'},{status:404,headers:{'Cache-Control':'no-store'}}));
  if(!local&&(url.hostname!=='motelavendre.ca'||url.protocol!=='https:'))return wrapped(Response.json({error:'forbidden'},{status:403,headers:{'Cache-Control':'no-store'}}));
  return wrapped(await accountApi(request,env));
 }
 if(url.pathname==='/api/enquiry'){
  // Enquiries are stored in this site's D1 and emailed to the owner.
  if(!local&&(url.hostname!=='motelavendre.ca'||url.protocol!=='https:'))return wrapped(Response.json({error:'forbidden'},{status:403,headers:{'Cache-Control':'no-store'}}));
  let lookup=()=>null;try{const {catalogue}=await loadCatalogue(site,fallback,env);lookup=ref=>catalogue.items.find(p=>p.reference===ref)||null;}catch{}
  return wrapped(await enquiryIntake(request,env,{catalogueLookup:lookup,local}));
 }
 if(url.pathname==='/api/events'){
  // Aggregate page counts in this site's D1; refused off the canonical host.
  if(!local&&(url.hostname!=='motelavendre.ca'||url.protocol!=='https:'))return wrapped(new Response(null,{status:403}));
  return wrapped(await recordEvent(request,env));
 }
 if(url.pathname.startsWith('/assets/listings/')&&['GET','HEAD'].includes(request.method)){
  // Listing photos uploaded from the admin, stored in R2 (binding PHOTOS).
  const key=PHOTO_PATH.test(url.pathname.slice(1))?photoKey(url.pathname.slice(1)):null;
  const object=key&&env&&env.PHOTOS?await env.PHOTOS.get(key):null;
  if(!object)return wrapped(new Response('Not found',{status:404}));
  return wrapped(new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/webp','Cache-Control':'public, max-age=31536000, immutable'}}));
 }
 if(url.pathname.startsWith('/api/admin/')){
  // Staff workspace API. HTTPS on the canonical host only.
  if(!accountsEnabled)return wrapped(Response.json({error:'unavailable'},{status:404,headers:{'Cache-Control':'no-store'}}));
  if(!local&&(url.hostname!=='motelavendre.ca'||url.protocol!=='https:'))return wrapped(Response.json({error:'forbidden'},{status:403,headers:{'Cache-Control':'no-store'}}));
  return wrapped(await adminApi(request,env));
 }
 if(!['GET','HEAD'].includes(request.method))return wrapped(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}));
 if(!local&&(url.hostname==='www.motelavendre.ca'||url.protocol!=='https:'))return wrapped(Response.redirect(site.siteOrigin+url.pathname+url.search,308));
 if(['/','/index.html'].includes(url.pathname))return wrapped(Response.redirect(new URL('/fr/'+url.search,local?url.origin:site.siteOrigin).href,301));
 if(url.pathname==='/googleb6173475a8eadbeb.html')return wrapped(new Response(request.method==='HEAD'?null:'google-site-verification: googleb6173475a8eadbeb.html',{headers:{'Content-Type':'text/html; charset=utf-8'}}));
 const oldTarget=Routes.legacyTarget(url.pathname);if(oldTarget){const target=new URL(oldTarget,local?url.origin:site.siteOrigin);target.search=url.search;return wrapped(Response.redirect(target.href,301));}
 const route=/^\/(fr|en|zh)(?:\/(.*))?$/.exec(url.pathname);
 const dynamic=['/data/catalogue-data.js','/api/catalogue','/sitemap.xml'].includes(url.pathname);
 if(!route&&!dynamic)return wrapped(await env.ASSETS.fetch(request));
 const {catalogue,status}=await loadCatalogue(site,fallback,env);
 if(url.pathname==='/data/catalogue-data.js')return wrapped(new Response(request.method==='HEAD'?null:'const MAV_CATALOGUE = '+JSON.stringify(catalogue).replace(/</g,'\\u003c')+';\n',{headers:{'Content-Type':'application/javascript; charset=utf-8','X-Catalogue-Status':status}}));
 if(url.pathname==='/api/catalogue')return wrapped(new Response(request.method==='HEAD'?null:JSON.stringify({catalogue,status,refreshIntervalSeconds:300}),{headers:{'Content-Type':'application/json; charset=utf-8','X-Catalogue-Status':status}}));
 const renderer=createRenderer({template,translations,catalogue,site,indexable:true});
 if(url.pathname==='/sitemap.xml'){
  const urls=[];
  for(const lang of ['fr','en','zh'])for(const [kind,reference]of [['home',''],['guide',''],...catalogue.items.map(p=>['property',p.reference])]){
   urls.push(`<url><loc>${site.siteOrigin+'/'+renderer.publicPath(lang,kind,reference)}</loc>${['fr','en','zh'].map(l=>`<xhtml:link rel="alternate" hreflang="${locales[l]}" href="${site.siteOrigin+'/'+renderer.publicPath(l,kind,reference)}"/>`).join('')}</url>`);
  }
  return wrapped(new Response(request.method==='HEAD'?null:'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+urls.join('')+'</urlset>',{headers:{'Content-Type':'application/xml; charset=utf-8'}}));
 }
 const lang=route[1],tail=(route[2]||'').replace(/index\.html$/,'').replace(/\/$/,'');
 let kind=tail===''?'home':sections[lang][tail],property=null;
 const match=/^proprietes\/(\d{1,12})$/.exec(tail);
 if(match){kind='property';property=catalogue.items.find(p=>p.reference===match[1]);}
 if(kind==='property'&&!property&&status!=='live')return wrapped(new Response(request.method==='HEAD'?null:`<!doctype html><html lang="${locales[lang]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/direction.css"><title>${translations[lang].catalogueError} | Motel à vendre</title></head><body><main class="buying-guide wrap"><h1>${translations[lang].catalogueError}</h1><p>${notices[lang]+checkedDay(catalogue)}</p><a class="button button-dark" href="/${lang}/">${translations[lang].backToListings}</a></main></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Retry-After':'300'}}));
 if(!kind||kind==='property'&&!property){
  const notFound=await env.ASSETS.fetch(new Request(new URL('/404.html',url),{method:request.method}));
  return wrapped(new Response(notFound.body,{status:404,headers:notFound.headers}));
 }
 const canonicalPath='/'+renderer.publicPath(lang,kind,property?.reference||'');
 if(url.pathname!==canonicalPath)return wrapped(Response.redirect(new URL(canonicalPath+url.search,url).href,308));
 let {html}=renderer.make(lang,kind,property);
 if(status!=='live')html=html.replace('<main ',`<aside class="catalogue-status" role="status">${notices[lang]+checkedDay(catalogue)}</aside><main `);
 const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
 const hash=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json)))));
 const third=kind==='account'&&turnstile?' '+turnstileOrigin:'';
 const csp="default-src 'self'; script-src 'self' 'sha256-"+hash+"'"+third+"; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"+(third?'; frame-src'+third:'');
 return wrapped(new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','X-Catalogue-Status':status,'X-Catalogue-Checked-At':catalogue.updatedAt,...(kind==='account'?{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}:{})}}),kind==='account'?csp:withGoogleAdsCsp(csp,site.googleAds));
}
// Daily Cron Trigger (wrangler.jsonc): free-listing expiry and reminders first, then saved-search alerts.
export async function handleScheduled(event,env,ctx){
 if(!accountsEnabled||!env.ACCOUNTS)return;
 ctx.waitUntil((async()=>{
  try{await runListingLifecycle(env,{replyTo:site.ownerEmail||''});invalidateCatalogue();}catch(error){console.warn('listing lifecycle failed:',String(error?.message||error).slice(0,140));}
  const {catalogue,status}=await loadCatalogue(site,fallback,env);if(status!=='live'){console.log('account-alerts skipped: catalogue',status);return;}await runAlerts(env,{site,catalogue});
 })());
}
export default {fetch:handleLiveRequest,scheduled:handleScheduled};
