(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MAVCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const languages=['fr','en','zh'];
  const types=['all','motel','hotel','inn','hotel-motel'];
  const oneOf=(value,values,fallback)=>values.includes(value)?value:fallback;
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function text(value,max=160,optional=false){if(typeof value!=='string'||value.length>max||(!optional&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('invalid-text');return value.trim();}
  function number(value,max,integer=false){if(value===null||value===undefined)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||(integer&&!Number.isInteger(value)))throw Error('invalid-number');return value;}
  const displayId=id=>id?String(id).replace(/^nord-/i,'MAV-').toUpperCase():'';
  const reference=item=>item.reference||displayId(item.id);
  function safeImage(value){const path=text(value,240);if(!/^assets\/[a-zA-Z0-9_/-]+\.(png|jpe?g|webp|svg)$/.test(path)||path.includes('..')||path.includes('//'))throw Error('invalid-image');return path;}
  function validateCatalogue(value){
    if(!plain(value)||value.schemaVersion!==1||!['demo','main-snapshot'].includes(value.mode)||!Array.isArray(value.items)||value.items.length>1000)throw Error('invalid-catalogue');
    const seen=new Set();
    const items=value.items.map(raw=>{
      if(!plain(raw)||!/^[-a-zA-Z0-9_]{1,64}$/.test(raw.id)||seen.has(raw.id)||!types.slice(1).includes(raw.type))throw Error('invalid-property');
      seen.add(raw.id);
      const ref=raw.reference===undefined?'':text(raw.reference,20,true);if(ref&&!/^(?:MAV-\d{3,12}|\d{1,12})$/.test(ref))throw Error('invalid-reference');
      const rooms=number(raw.rooms,5000,true);if(rooms===0)throw Error('invalid-rooms');
      const copy={};const roomsText={};
      for(const lang of languages){
        const source=raw.copy?.[lang];if(!plain(source)||!Array.isArray(source.features)||source.features.length>12)throw Error('invalid-translation');
        copy[lang]={short:text(source.short,300),description:text(source.description,4000),features:source.features.map(x=>text(x,220))};
        roomsText[lang]=text(raw.roomsText?.[lang]??'',100,true);
      }
      const image=safeImage(raw.image),photos=raw.photos===undefined?[image]:raw.photos;
      if(!Array.isArray(photos)||photos.length>30)throw Error('invalid-photos');
      const facts=raw.facts??[];if(!Array.isArray(facts)||facts.length>24)throw Error('invalid-facts');
      const safeFacts=facts.map(f=>{if(!plain(f))throw Error('invalid-facts');const label={},value={};for(const lang of languages){label[lang]=text(f.label?.[lang],150);value[lang]=text(f.value?.[lang],800);}return {label,value};});
      return {id:raw.id,reference:ref,name:text(raw.name),city:text(raw.city,120),region:text(raw.region,120),type:raw.type,price:number(raw.price,1e9),rooms,roomsText,acres:number(raw.acres,1e7),parking:number(raw.parking,10000,true),tenure:raw.tenure==='freehold'?'freehold':null,season:oneOf(raw.season,['year-round','seasonal'],'unknown'),image,photos:[...new Set(photos.map(safeImage))],facts:safeFacts,illustrative:raw.illustrative!==false,copy,real:value.mode==='main-snapshot'};
    });
    return {schemaVersion:1,mode:value.mode,updatedAt:text(value.updatedAt??'',40,true),source:value.mode==='main-snapshot'?'proprieteenvente.ca':'local-demo',items};
  }
  function normalizeRoute(raw={},regions=[],defaultLanguage='fr'){
    return {lang:oneOf(raw.lang,languages,defaultLanguage),region:oneOf(raw.region,['all',...regions],'all'),type:oneOf(raw.type,types,'all'),budget:oneOf(raw.budget,['all','under2','2to5','over5'],'all'),rooms:oneOf(raw.rooms,['all','lt20','20to39','40plus','unknown'],'all'),season:oneOf(raw.season,['all','year-round','seasonal','unknown'],'all'),q:typeof raw.q==='string'?raw.q.trim().slice(0,120):'',sort:oneOf(raw.sort,['featured','priceAsc','priceDesc','rooms'],'featured'),view:oneOf(raw.view,['grid','list'],'grid'),tab:oneOf(raw.tab,['all','saved','recent'],'all'),property:typeof raw.property==='string'&&/^(?:MAV-\d{3,12}|\d{1,12})$/i.test(raw.property)?raw.property.toUpperCase():''};
  }
  function readRoute(hash,regions=[],defaultLanguage='fr'){
    const [path,query='']=String(hash||'').replace(/^#/,'').split('?');
    const params=new URLSearchParams(query),raw=Object.fromEntries(params);
    const match=/^propriete\/(MAV-\d{3,12}|\d{1,12})$/i.exec(path);
    if(match)raw.property=match[1];
    return normalizeRoute(raw,regions,defaultLanguage);
  }
  function routeHash(raw,regions=[]){
    const state=normalizeRoute(raw,regions,oneOf(raw.lang,languages,'fr'));
    const params=new URLSearchParams({lang:state.lang});
    const defaults=normalizeRoute({},regions,state.lang);
    for(const key of ['region','type','budget','rooms','season','q','sort','view','tab'])if(state[key]!==defaults[key])params.set(key,state[key]);
    return `#${state.property?'propriete/'+state.property:'listings'}?${params}`;
  }
  function selectListings(items,state,saved=[],recent=[]){
    const savedIds=new Set(saved),recentIds=new Set(recent),query=normalize(state.q);
    const result=items.filter(p=>{
      const knownPrice=p.price!==null,knownRooms=p.rooms!==null;
      return (state.tab!=='saved'||savedIds.has(p.id))&&(state.tab!=='recent'||recentIds.has(p.id))
        &&(state.region==='all'||p.region===state.region)&&(state.type==='all'||p.type===state.type)
        &&(state.budget==='all'||knownPrice&&(state.budget==='under2'?p.price<2e6:state.budget==='2to5'?p.price>=2e6&&p.price<=5e6:p.price>5e6))
        &&(state.rooms==='all'||(state.rooms==='unknown'?!knownRooms:knownRooms&&(state.rooms==='lt20'?p.rooms<20:state.rooms==='20to39'?p.rooms>=20&&p.rooms<40:p.rooms>=40)))
        &&(state.season==='all'||p.season===state.season)
        &&(!query||normalize(`${p.name} ${p.city} ${p.region} ${reference(p)} ${p.copy[state.lang].short}`).includes(query));
    });
    const compareKnown=(a,b,key,direction)=>a[key]===null?b[key]===null?0:1:b[key]===null?-1:direction*(a[key]-b[key]);
    if(state.sort==='priceAsc')result.sort((a,b)=>compareKnown(a,b,'price',1));
    else if(state.sort==='priceDesc')result.sort((a,b)=>compareKnown(a,b,'price',-1));
    else if(state.sort==='rooms')result.sort((a,b)=>compareKnown(a,b,'rooms',-1));
    else if(state.tab==='recent')result.sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id));
    return result;
  }
  function addRecent(recent,id,validIds){return validIds.includes(id)?[id,...recent.filter(x=>x!==id&&validIds.includes(x))].slice(0,12):recent.filter(x=>validIds.includes(x)).slice(0,12);}
  function mainListingURL(ref,lang){return /^\d{1,12}$/.test(String(ref))?`https://proprieteenvente.ca/${oneOf(lang,languages,'fr')}/proprietes/${ref}/`:null;}
  function shareURL(base,state,regions=[]){const hash=routeHash(state,regions),url=new URL(base);if(url.protocol==='file:')return hash;if(!['http:','https:'].includes(url.protocol))throw Error('invalid-share-origin');url.username='';url.password='';url.search='';url.hash=hash;return url.href;}
  function importMainRows(input,updatedAt){
    if(!Array.isArray(input)||input.length>5000)throw Error('invalid-public-export');
    const basic={fr:{short:'Annonce publique de Propriété En Vente.',description:'Consultez la fiche publiée sur le site principal pour confirmer les renseignements et la disponibilité.',features:['Référence du site principal','Renseignements manquants à confirmer']},en:{short:'A public Propriété En Vente listing.',description:'Consult the published listing on the main website to confirm the details and current availability.',features:['Main website reference','Missing details to confirm']},zh:{short:'来自 Propriété En Vente 的公开房源。',description:'请查看主站已发布的房源，核对详细资料及当前挂牌状态。',features:['保留主站房源编号','缺少的资料需进一步确认']}};
    const items=input.filter(row=>plain(row)&&plain(row.property)&&row.property.type==='hotel-motel'&&(!row.status||row.status==='published')).map(row=>{
      const p=row.property,ref=String(row.listing_number??'');if(!/^\d{1,12}$/.test(ref))throw Error('missing-public-reference');
      const guest=Array.isArray(p.features)?p.features.find(f=>f?.key==='guestRooms'):null;
      const roomsText=Object.fromEntries(languages.map(lang=>[lang,typeof guest?.value?.[lang]==='string'?guest.value[lang].trim():'']));
      const exactPatterns={fr:/^(\d{1,4})(?:\s*chambres?)?$/i,en:/^(\d{1,4})(?:\s*rooms?)?$/i,zh:/^(\d{1,4})(?:\s*[间間](?:客房)?)?$/};
      const numeric=languages.map(lang=>{const match=exactPatterns[lang].exec(roomsText[lang]);return match?Number(match[1]):null;});
      const rooms=numeric.every(n=>n!==null&&n>0&&n===numeric[0])?numeric[0]:null;
      const city=text(p.city,120);
      const publishedKind=normalize((Array.isArray(p.features)?p.features:[]).find(f=>f?.key==='Genre de commerce')?.value?.fr);
      const hospitalityType=publishedKind==='motel'?'motel':publishedKind==='hotel'?'hotel':publishedKind==='auberge'?'inn':'hotel-motel';
      const illustrative=typeof p.photoIllustrative==='boolean'?p.photoIllustrative:p.source?.placeholder!==false;
      // Only allowlisted public fields. Never copy source.originalAddress, contact data,
      // unpublished street addresses, raw objects or expiring signed photo URLs.
      const allowed=['guestRooms','guestRoomsStatus','Genre de commerce','poolFromDescription','ownerHome','hotelAmenities','parkingDetail','transactionStructure','municipalServices','heating','Année de construction','commercialAreaPublished','Superficie commerciale disponible','Superficie du terrain','Caractéristiques additionnelles'];
      const facts=(Array.isArray(p.features)?p.features:[]).filter(f=>allowed.includes(f?.key)&&languages.every(lang=>typeof f.label?.[lang]==='string'&&f.label[lang].trim()&&f.label[lang].length<=150&&typeof f.value?.[lang]==='string'&&f.value[lang].trim()&&f.value[lang].length<=800)).map(f=>({label:Object.fromEntries(languages.map(lang=>[lang,f.label[lang]])),value:Object.fromEntries(languages.map(lang=>[lang,f.value[lang]]))}));
      const copy=Object.fromEntries(languages.map(lang=>[lang,{...basic[lang],features:facts.filter(f=>f.value[lang].length<180).slice(0,5).map(f=>f.label[lang]+': '+f.value[lang])}]));
      return {id:'main-'+ref,reference:ref,name:'Hôtel / Motel — '+city,city,region:typeof p.region==='string'&&p.region.trim()?p.region:city.split(' (')[0],type:hospitalityType,price:typeof p.price==='number'&&p.price>0?p.price:null,rooms,roomsText,acres:typeof p.lotArea==='number'&&p.lotArea>0?Math.round(p.lotArea/43560*10000)/10000:null,parking:typeof p.parkingSpaces==='number'?p.parkingSpaces:null,tenure:null,season:'unknown',image:'assets/property-unavailable.svg',photos:[],facts,illustrative,copy};
    });
    return validateCatalogue({schemaVersion:1,mode:'main-snapshot',updatedAt,items});
  }
  return {languages,normalize,escapeHTML,displayId,reference,validateCatalogue,normalizeRoute,readRoute,routeHash,shareURL,selectListings,addRecent,mainListingURL,importMainRows};
});
