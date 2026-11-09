import Core from '../lib/catalogue-core.js';
// Listings live in this site's D1 (binding ACCOUNTS, table listings). No outside database is read.
export const freshnessMs=60000;
const memory={at:0,catalogue:null};
export function invalidateCatalogue(){memory.at=0;}

// Published rows -> validated catalogue. Rows that no longer validate are skipped, never shown half-broken.
export function catalogueFromListings(rows,now=new Date()){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid listings');
 const items=[];
 for(const row of rows){
  try{const item=JSON.parse(row.item);Core.validateCatalogue({schemaVersion:1,mode:'main-snapshot',items:[item]});items.push(item);}
  catch{console.warn('Listing skipped (invalid item):',String(row.reference).slice(0,12));}
 }
 const catalogue=Core.validateCatalogue({schemaVersion:1,mode:'main-snapshot',updatedAt:now.toISOString(),items});
 catalogue.items.sort((a,b)=>b.photos.length-a.photos.length);
 return catalogue;
}

export async function loadCatalogue(site,fallback,{db,now=()=>new Date()}={}){
 if(memory.catalogue&&now().getTime()-memory.at<freshnessMs)return {catalogue:memory.catalogue,status:'live'};
 try{
  if(!db)throw Error('No listings database');
  const rows=(await db.prepare("SELECT reference,item FROM listings WHERE status='published' ORDER BY published_at DESC, reference DESC LIMIT 1000").all()).results||[];
  const catalogue=catalogueFromListings(rows,now());
  memory.catalogue=catalogue;memory.at=now().getTime();
  return {catalogue,status:'live'};
 }catch(error){
  console.warn('Listings unavailable:',String(error?.message||'read failed').slice(0,140));
  return memory.catalogue?{catalogue:memory.catalogue,status:'stale'}:{catalogue:fallback,status:'fallback'};
 }
}

// Staff display settings (D1 listing_settings): hidden listings leave this site; pinned ones lead.
export function applyListingSettings(catalogue,settings){
 if(!Array.isArray(settings)||!settings.length)return catalogue;
 const hidden=new Set(settings.filter(s=>Number(s.hidden)===1).map(s=>String(s.listing_reference))),pinned=new Set(settings.filter(s=>Number(s.pinned)===1).map(s=>String(s.listing_reference)));
 const items=catalogue.items.filter(p=>!hidden.has(p.reference)).map((p,i)=>[p,i]).sort((a,b)=>(pinned.has(b[0].reference)-pinned.has(a[0].reference))||a[1]-b[1]).map(x=>x[0]);
 return {...catalogue,items};
}
