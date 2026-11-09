import Routes from '../lib/site-routes.cjs';
// Bounded routing and response headers only. Enquiries, listings and counts stay on this site.
export const canonicalOrigin='https://motelavendre.ca';
const structuredDataHashes=/* RELEASE_JSON_LD_HASHES */[];
export const policy="default-src 'self'; script-src 'self' "+structuredDataHashes.join(' ')+"; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
export function responseHeaders(response,request,policyOverride){
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');
 headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
 headers.set('Content-Security-Policy',policyOverride||policy);
 // Personal pages opt out of every cache; everything else revalidates.
 // Uploaded listing photos have unique, never-reused names and may be cached for a year.
 if(!/\bno-store\b|\bimmutable\b/.test(response.headers.get('Cache-Control')||''))headers.set('Cache-Control','public, max-age=0, must-revalidate');
 if(new URL(request.url).protocol==='https:')headers.set('Strict-Transport-Security','max-age=15552000');
 if(response.status>=400)headers.set('X-Robots-Tag','noindex, nofollow');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export async function handleRequest(request,env){
 const url=new URL(request.url),isLocal=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!isLocal&&!['motelavendre.ca','www.motelavendre.ca'].includes(url.hostname))return responseHeaders(new Response('Unknown host',{status:421}),request);
 if(!['GET','HEAD'].includes(request.method))return responseHeaders(new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}}),request);
 if(!isLocal&&(url.hostname==='www.motelavendre.ca'||url.protocol!=='https:'))return responseHeaders(Response.redirect(canonicalOrigin+url.pathname+url.search,308),request);
 if(url.pathname==='/'||url.pathname==='/index.html')return responseHeaders(Response.redirect(new URL('/fr/'+url.search,isLocal?url.origin:canonicalOrigin).href,301),request);
 const oldTarget=Routes.legacyTarget(url.pathname);if(oldTarget){const target=new URL(oldTarget,isLocal?url.origin:canonicalOrigin);target.search=url.search;return responseHeaders(Response.redirect(target.href,301),request);}
 const response=await env.ASSETS.fetch(request);
 return responseHeaders(response,request);
}
export default {fetch:handleRequest};
