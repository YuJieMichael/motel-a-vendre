import createRenderer from '../lib/page-renderer.cjs';
import {loadCatalogue} from './live-catalogue.mjs';
import {template,translations,site,fallback} from './runtime-inputs.mjs';
import {responseHeaders} from './worker.mjs';

const locales={fr:'fr-CA',en:'en-CA',zh:'zh-Hans'};
const sections={fr:{equipe:'team',vendre:'seller','guide-achat':'guide','espace-client':'account'},en:{team:'team',sell:'seller','buying-guide':'guide',account:'account'},zh:{team:'team',sell:'seller','buying-guide':'guide',account:'account'}};
const checkedDay=c=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.updatedAt));
const notices={fr:'La mise à jour du catalogue est momentanément indisponible. Dernière vérification : ',en:'The catalogue update is temporarily unavailable. Last checked: ',zh:'目录更新暂时不可用。上次核验：'};
export async function handleLiveRequest(request,env){
 const url=new URL(request.url),local=['127.0.0.1','localhost'].includes(url.hostname);
 const wrapped=(r,policy)=>responseHeaders(r,request,policy);
 if(!local&&!['motelavendre.ca','www.motelavendre.ca'].includes(url.hostname))return wrapped(new Response('Not found',{status:404}));
 if(!['GET','HEAD'].includes(request.method))return wrapped(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}));
 if(!local&&(url.hostname==='www.motelavendre.ca'||url.protocol!=='https:'))return wrapped(Response.redirect(site.siteOrigin+url.pathname+url.search,308));
 if(['/','/index.html'].includes(url.pathname))return wrapped(Response.redirect(new URL('/fr/'+url.search,local?url.origin:site.siteOrigin).href,301));
 if(url.pathname==='/googleb6173475a8eadbeb.html')return wrapped(new Response(request.method==='HEAD'?null:'google-site-verification: googleb6173475a8eadbeb.html',{headers:{'Content-Type':'text/html; charset=utf-8'}}));
 const route=/^\/(fr|en|zh)(?:\/(.*))?$/.exec(url.pathname);
 const dynamic=['/data/catalogue-data.js','/api/catalogue','/sitemap.xml'].includes(url.pathname)||url.pathname.startsWith('/assets/centris/');
 if(!route&&!dynamic)return wrapped(await env.ASSETS.fetch(request));
 const {catalogue,status}=await loadCatalogue(site,fallback);
 if(url.pathname==='/data/catalogue-data.js')return wrapped(new Response(request.method==='HEAD'?null:'const MAV_CATALOGUE = '+JSON.stringify(catalogue).replace(/</g,'\\u003c')+';\n',{headers:{'Content-Type':'application/javascript; charset=utf-8','X-Catalogue-Status':status}}));
 if(url.pathname==='/api/catalogue')return wrapped(new Response(request.method==='HEAD'?null:JSON.stringify({catalogue,status,refreshIntervalSeconds:300}),{headers:{'Content-Type':'application/json; charset=utf-8','X-Catalogue-Status':status}}));
 if(url.pathname.startsWith('/assets/centris/')){
  const relative=url.pathname.slice(1);
  if(!/^assets\/centris\/\d{7,8}\/\d{3}\.webp$/.test(relative)||!catalogue.items.some(p=>p.photos.includes(relative)))return wrapped(new Response('Not found',{status:404}));
  try{
   const image=await fetch('https://proprieteenvente.ca'+url.pathname.slice('/assets'.length),{method:request.method,redirect:'manual',signal:AbortSignal.timeout(10000),cf:{cacheTtl:3600,cacheEverything:true}});
   if(!image.ok||!/^image\/webp\b/.test(image.headers.get('content-type')||''))throw Error('Image unavailable');
   return wrapped(new Response(image.body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=3600'}}));
  }catch{return wrapped(new Response('Image unavailable',{status:502}));}
 }
 const renderer=createRenderer({template,translations,catalogue,site,indexable:true});
 if(url.pathname==='/sitemap.xml'){
  const urls=[];
  for(const lang of ['fr','en','zh'])for(const [kind,reference]of [['home',''],['team',''],['seller',''],['guide',''],...catalogue.items.map(p=>['property',p.reference])]){
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
 const csp="default-src 'self'; script-src 'self' 'sha256-"+hash+"'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' "+new URL(site.endpoint).origin+"; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://proprieteenvente.ca";
 return wrapped(new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','X-Catalogue-Status':status,'X-Catalogue-Checked-At':catalogue.updatedAt,...(kind==='account'?{'X-Robots-Tag':'noindex, nofollow'}:{})}}),csp);
}
export default {fetch:handleLiveRequest};
