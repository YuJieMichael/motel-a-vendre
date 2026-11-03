// Read-only public snapshot. Never reads private tables or writes to Supabase.
const fs=require('node:fs'),path=require('node:path');
const Core=require('../lib/catalogue-core.js');
const root=path.resolve(__dirname,'..');
async function sync(config,{apply=false}={}){
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key))throw Error('Expected a browser-public project URL and publishable key');
 const url=new URL(config.url+'/rest/v1/published_listings');
 url.searchParams.set('select','listing_number,type:property->>type,city:property->>city,region:property->>region,price:property->price,lotArea:property->lotArea,parkingSpaces:property->parkingSpaces,features:property->features,photoIllustrative:property->source->placeholder,photo_paths,published_at');
 url.searchParams.set('property->>type','eq.hotel-motel');url.searchParams.set('order','published_at.desc');url.searchParams.set('limit','1000');
 const response=await fetch(url,{headers:{apikey:config.key},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Public read failed: '+response.status);
 const rows=await response.json();if(!Array.isArray(rows))throw Error('Invalid public response');
 const catalogue=Core.importMainRows(rows.map(r=>({listing_number:r.listing_number,property:{type:r.type,city:r.city,region:r.region,price:r.price,lotArea:r.lotArea,parkingSpaces:r.parkingSpaces,features:r.features,photoIllustrative:r.photoIllustrative}})),new Date().toISOString());
 const manifest=[];fs.mkdirSync(path.join(root,'assets/main'),{recursive:true});
 for(const item of catalogue.items){
  const row=rows.find(r=>String(r.listing_number)===item.reference);item.photos=[];
  for(const remotePath of [...new Set(row.photo_paths??[])].slice(0,30)){
   // Only the same public photo paths accepted by the main website. No signed URLs persisted.
   if(!/^\/centris\/\d{7,8}\/\d{3}\.webp$/.test(remotePath))continue;
   const source='https://proprieteenvente.ca'+remotePath,local='assets/main/'+item.reference+'-'+path.basename(remotePath);
   try{
    const photo=await fetch(source,{signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!photo.ok||!/^image\/webp\b/.test(photo.headers.get('content-type')??''))throw Error('Image not available');
    const data=Buffer.from(await photo.arrayBuffer());
    if(data.length<12||data.length>8*1024*1024||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP')throw Error('Invalid photo');
    fs.writeFileSync(path.join(root,local),data);item.photos.push(local);manifest.push({reference:item.reference,source,local,illustrative:item.illustrative});
   }catch{console.warn('Photo unavailable for reference',item.reference);}
  }
  item.image=item.photos[0]||'assets/property-unavailable.svg';
 }
 // Put the best documented gallery first; this does not alter source facts.
 catalogue.items.sort((a,b)=>b.photos.length-a.photos.length);
 const validated=Core.validateCatalogue(catalogue),name=apply?'catalogue.json':'main-review.json';
 const target=path.join(root,'data',name),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(validated,null,2)+'\n');fs.renameSync(temp,target);
 fs.writeFileSync(path.join(root,'data/source-manifest.json'),JSON.stringify({syncedAt:validated.updatedAt,source:'https://proprieteenvente.ca',items:manifest},null,2)+'\n');
 console.log('Public snapshot:',validated.items.length,'hotel/motel listings,',manifest.length,'local images;',apply?'applied':'review file only');
 return validated;
}
if(require.main===module){const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--'));if(!file){console.error('Usage: node scripts/sync-main.cjs <public-config.json> [--apply]');process.exitCode=1;}else sync(JSON.parse(fs.readFileSync(path.resolve(file),'utf8')),{apply:args.includes('--apply')}).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={sync};
