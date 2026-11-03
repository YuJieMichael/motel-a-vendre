import Core from '../lib/catalogue-core.js';
export const freshnessMs=300000;
export function publicRowsURL(site){
 const url=new URL(new URL(site.endpoint).origin+'/rest/v1/published_listings');
 url.searchParams.set('select','listing_number,type:property->>type,city:property->>city,region:property->>region,price:property->price,lotArea:property->lotArea,parkingSpaces:property->parkingSpaces,features:property->features,photoIllustrative:property->source->placeholder,description:property->description,descriptionTranslations:property->descriptionTranslations,photo_paths,published_at');
 url.searchParams.set('property->>type','eq.hotel-motel');url.searchParams.set('order','published_at.desc');url.searchParams.set('limit','1000');return url;
}
export function catalogueFromRows(rows,now=new Date(),covers={}){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid public catalogue');
 const catalogue=Core.importMainRows(rows.map(r=>({listing_number:r.listing_number,property:{type:r.type,city:r.city,region:r.region,price:r.price,lotArea:r.lotArea,parkingSpaces:r.parkingSpaces,features:r.features,photoIllustrative:r.photoIllustrative,description:r.description,descriptionTranslations:r.descriptionTranslations}})),now.toISOString());
 for(const p of catalogue.items){
  const row=rows.find(r=>String(r.listing_number)===p.reference);
  p.photos=[...new Set(row.photo_paths??[])].filter(x=>/^\/centris\/\d{7,8}\/\d{3}\.webp$/.test(x)).slice(0,30).map(x=>'assets'+x);
  p.image=p.photos[0]||'assets/property-unavailable.svg';
  if(p.illustrative&&/^assets\/covers\/\d{1,12}\.webp$/.test(covers[p.reference]||'')){p.image=covers[p.reference];p.photos=[p.image];}
 }
 catalogue.items.sort((a,b)=>b.photos.length-a.photos.length);return Core.validateCatalogue(catalogue);
}
export async function loadCatalogue(site,fallback,{fetchImpl=fetch,cache=globalThis.caches?.default,now=()=>new Date()}={}){
 const key=new Request(site.siteOrigin+'/__internal/catalogue-v18');
 let previous,retryAt=0,failedStatus='';
 try{const hit=cache&&await cache.match(key);if(hit){retryAt=Number(hit.headers.get('X-Catalogue-Retry-At')||0);failedStatus=hit.headers.get('X-Catalogue-Failed')||'';previous=Core.validateCatalogue(await hit.json());}}catch{}
 if(previous&&failedStatus&&now().getTime()<retryAt)return {catalogue:previous,status:failedStatus};
 if(previous&&!failedStatus&&now().getTime()-Date.parse(previous.updatedAt)<freshnessMs)return {catalogue:previous,status:'live'};
 try{
  const r=await fetchImpl(publicRowsURL(site),{headers:{apikey:site.publishableKey},signal:AbortSignal.timeout(8000),redirect:'manual'});
  if(!r.ok)throw Error('Public catalogue '+r.status);
  const catalogue=catalogueFromRows(await r.json(),now(),site.coverOverrides||{});
  if(cache)try{await cache.put(key,Response.json(catalogue,{headers:{'Cache-Control':'public, max-age=86400'}}));}catch{}
  return {catalogue,status:'live'};
 }catch(error){
  console.warn('Public catalogue refresh unavailable:',String(error?.message||'request failed').slice(0,140));
  const catalogue=previous||fallback,status=previous?(failedStatus==='fallback'?'fallback':'stale'):'fallback';
  if(cache)try{await cache.put(key,Response.json(catalogue,{headers:{'Cache-Control':'public, max-age=86400','X-Catalogue-Retry-At':String(now().getTime()+60000),'X-Catalogue-Failed':status}}));}catch{}
  return {catalogue,status};
 }
}
