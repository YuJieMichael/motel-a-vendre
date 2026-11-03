// Pure shared renderer: build-time HTML and live Worker use the same views.
const C=require('./catalogue-core.js'),V=require('./property-view.js'),G=require('./guide-content.js'),renderAccount=require('./account-view.cjs');
module.exports=function createRenderer({template,translations,catalogue,site,indexable=false}){
const E=C.escapeHTML,languages=['fr','en','zh'],locale={fr:'fr-CA',en:'en-CA',zh:'zh-Hans'},routes={fr:{team:'equipe',seller:'vendre',guide:'guide-achat',account:'espace-client'},en:{team:'team',seller:'sell',guide:'buying-guide',account:'account'},zh:{team:'team',seller:'sell',guide:'buying-guide',account:'account'}};
const publicPath=(lang,kind,ref)=>`${lang}/${kind==='property'?'proprietes/'+ref+'/':kind==='home'?'':routes[lang][kind]+'/'}`;
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(catalogue.updatedAt));
function localize(html,c){
 html=html.replace(/<([a-z0-9]+)([^>]*\bdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi,(_,tag,attrs,key)=>`<${tag}${attrs}>${E(c[key]??key)}</${tag}>`);
 for(const [attribute,data]of [['placeholder','placeholder'],['aria-label','aria'],['alt','alt']])html=html.replace(new RegExp('<([a-z0-9]+)([^>]*\\bdata-'+data+'="([^"]+)"[^>]*)>','gi'),(_,tag,attrs,key)=>`<${tag}${attrs.replace(new RegExp('\\s'+attribute+'="[^"]*"','g'),'')} ${attribute}="${E(c[key]??key)}">`);
 return html;
}
function staticCard(p,lang,c,prefix){
 return V.card(p,{lang,copy:c,asset:x=>prefix+x,href:prefix+publicPath(lang,'property',C.reference(p))+'index.html',index:catalogue.items.indexOf(p)+1});
}
function make(lang,kind='home',p=null,{rootEntry=false}={}){
 if(kind==='account')return renderAccount({lang,site});
 const c=translations[lang],ref=p?C.reference(p):'',route=publicPath(lang,kind,ref),file=rootEntry?'index.html':route+'index.html',prefix='../'.repeat(file.split('/').length-1),asset=x=>prefix+x;
 const home=prefix+lang+'/index.html',main='https://proprieteenvente.ca/'+lang+'/',canonical=site.siteOrigin+'/'+route;
 let html=template.replace('<html lang="fr-CA">',`<html lang="${locale[lang]}">`).replace('<body>',`<body data-page="${kind}" data-lang="${lang}"${p?` data-reference="${E(ref)}"`:''}>`);
 if(kind!=='home'){
  const content=kind==='property'?V.property(p,{lang,copy:c,asset,home,main:C.mainListingURL(ref,lang)}):kind==='guide'?G.render(lang):kind==='team'?V.trust({copy:c,main}):V.seller({copy:c,main:main+'#vendre'});
  html=html.replace(/<!-- PAGE CONTENT START -->[\s\S]*?<!-- PAGE CONTENT END -->/,content);
 }else{
  html=html.replace('<!-- TEAM SECTION -->',V.trust({copy:c,main,compact:true}));
  html=html.replace('<div id="listing-grid" class="listing-grid"></div>',`<div id="listing-grid" class="listing-grid">${catalogue.items.map(p=>staticCard(p,lang,c,prefix)).join('')}</div>`);
  const first=catalogue.items[0];if(first){html=html.replace('src="assets/lakeside.png"',`src="${E(first.image)}"`).replace('data-detail="nord-001"',`data-detail="${first.id}"`).replace('Motel du Lac',E(C.nameOf(first,lang))).replace('LAURENTIDES, QC',E(first.region+', QC'));}
  // Filters list only the regions and property types present in this catalogue.
  const regions=[...new Set(catalogue.items.map(p=>p.region))].sort((a,b)=>a.localeCompare(b,'fr')),types=new Set(catalogue.items.map(p=>p.type));
  html=html.replace(/(<select id="region"><option value="all" data-i18n="allRegions">[^<]*<\/option>)[\s\S]*?(<\/select>)/,(_,a,b)=>a+regions.map(r=>`<option value="${E(r)}">${E(r)}</option>`).join('')+b);
  html=html.replace(/<option value="(hotel|motel|inn|hotel-motel)" data-i18n="\1">[^<]*<\/option>|<button data-type="(hotel|motel|inn|hotel-motel)"[^>]*>[^<]*<\/button>/g,(m,a,b)=>types.has(a||b)?m:'');
 }
 // Prefix only local runtime assets. Navigation is rebuilt explicitly below.
 html=html.replace(/((?:src|href)=")((?:assets\/|lib\/|data\/|favicon\.ico|apple-touch-icon\.png|manifest\.webmanifest|styles\.css|responsive\.css|property\.css|direction\.css|i18n\.js|app\.js)[^"]*)"/g,(_,start,url)=>start+prefix+url+'"');
 // Static card and property paths are already relative to this generated page.
 html=localize(html,c);
 if(kind==='home'&&!catalogue.items.length){
  const start=html.indexOf('<div class="hero-feature">');
  if(start>=0){const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=start;let depth=0,m;while((m=tags.exec(html))){depth+=m[0].startsWith('</')?-1:1;if(!depth){html=html.slice(0,start)+`<aside class="data-note"><h2>${E(c.emptyTitle)}</h2><p>${E(c.emptyDescription)}</p><a href="${main}">${E(c.visitMain)}</a></aside>`+html.slice(tags.lastIndex);break;}}}
 }
 if(kind==='home'&&catalogue.items[0]){const first=catalogue.items[0],rooms=first.rooms===null?first.roomsText[lang]||c.toConfirm:c.roomCount.replace('{count}',first.rooms);html=html.replace(/(<span data-i18n="heroRooms">)[\s\S]*?(<\/span>)/,(_,a,b)=>a+E(c.rooms+': '+rooms+' · '+c[first.type])+b).replace('01 / 03','01 / '+String(catalogue.items.length).padStart(2,'0')).replace(/(<div class="image-caption"[^>]*>)[\s\S]*?(<\/div>)/,(_,a,b)=>a+E(c[first.illustrative?(first.real?'illustrativePhotoShort':'imageCaption'):'propertyPhoto'])+b).replace(/(<img class="hero-photo"[^>]*?) alt="[^"]*"[^>]*?width=/,(_,a)=>a+' alt="'+E(C.nameOf(first,lang))+'" width=');}
 // Capacity comes from this snapshot, never from the old illustrative copy.
 html=html.replace('data-i18n="heroRooms"','data-hero-rooms');
 if(kind==='home'&&catalogue.items[0]){const first=catalogue.items[0];html=html.replace('<dd class="hero-metric-price"></dd>','<dd class="hero-metric-price">'+E(first.price===null?c.toConfirm:new Intl.NumberFormat(locale[lang],{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(first.price))+'</dd>').replace('<dd class="hero-metric-reference"></dd>','<dd class="hero-metric-reference">'+E(C.reference(first))+'</dd>');}
 html=html.replace(/href="#home"/g,`href="${home}"`).replace(/href="#listings"/g,`href="${kind==='home'?'#listings':home+'#listings'}"`).replace(/href="#approach"/g,`href="${kind==='home'?'#approach':home+'#approach'}"`);
 html=html.replace(/<a data-route="(team|seller|account)"/g,(_,which)=>`<a href="${prefix+publicPath(lang,which)}index.html" data-route="${which}"`).replace(/<a data-main-link/g,`<a href="${main}" data-main-link`);
 html=html.replace(/<a href="#" data-lang="(fr|en|zh)"([^>]*)>/g,(_,target,attrs)=>'<a href="'+E(prefix+publicPath(target,kind,ref)+'index.html')+'" data-lang="'+target+'"'+attrs.replace(/\saria-current="[^"]*"/g,'')+(target===lang?' aria-current="page"':'')+'>');
 html=html.replace(/<a data-main-policy="(privacy|terms)"/g,(_,policy)=>`<a href="${main}#${policy}" data-main-policy="${policy}"`);
 html=html.replace(/(<span data-i18n="demo">)[\s\S]*?(<\/span>)/,(_,a,b)=>a+E(c.snapshotBanner)+b);
 html=html.replace(/(<p id="inventory-note">)[\s\S]*?(<\/p>)/,(_,a,b)=>a+E(c.snapshotNote.replace('{date}',date))+b);
 html=html.replace('id="all-count">3','id="all-count">'+catalogue.items.length);
 html=html.replace('id="results-count" role="status" aria-live="polite"></p>',`id="results-count" role="status" aria-live="polite">${E(c.results.replace('{count}',catalogue.items.length))}</p>`);
 if(kind!=='home')html=html.replace('href="'+home+'#listings" data-i18n="skip"','href="#'+(kind==='property'?'property-page':'home')+'" data-i18n="skip"');
 const title=p?C.nameOf(p,lang)+' | Motel à vendre':kind==='guide'?G.content[lang].title:kind==='team'?c.teamPage+' | Motel à vendre':kind==='seller'?c.ownerPage+' | Motel à vendre':c.pageTitle;
 const description=p?p.copy[lang].short+(p.copy[lang].short.includes(p.city.split(' (')[0])?'':' '+p.city+'.')+(lang==='zh'?'':' ')+c.teamFollowup:kind==='guide'?G.content[lang].intro:kind==='team'?c.teamIntro:kind==='seller'?c.ownerIntro:c.metaDescription;
 html=html.replace('<!-- GUIDE LINK -->',`<a href="${prefix+publicPath(lang,'guide')}">${E(G.content[lang].label)}</a>`);
 const image=site.siteOrigin+'/'+(p?.image||catalogue.items[0]?.image||'assets/logo.svg');
 html=html.replace(/<title>[\s\S]*?<\/title>/,`<title>${E(title)}</title>`).replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g,(_,start)=>start+E(description)).replace(/(<meta property="og:title" content=")[^"]*/g,(_,start)=>start+E(title));
 const alternates=languages.map(l=>`<link rel="alternate" hreflang="${l==='zh'?'zh-Hans':l+'-CA'}" href="${site.siteOrigin+'/'+publicPath(l,kind,ref)}">`).join('\n  ');
 const page={'@type':kind==='home'?'CollectionPage':'WebPage','@id':canonical+'#webpage',name:title,description,inLanguage:locale[lang],url:canonical,isPartOf:{'@type':'WebSite',name:'Motel à vendre',url:site.siteOrigin+'/'}};
 if(kind==='guide')Object.assign(page,{'@type':'FAQPage',mainEntity:G.content[lang].faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))});
 const graph=[page];
 // One JSON-LD block per page: the Worker and release CSP hash exactly one script.
 if(kind!=='home'){page.breadcrumb={'@id':canonical+'#breadcrumb'};graph.push({'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'Motel à vendre',item:site.siteOrigin+'/'+publicPath(lang,'home')},{'@type':'ListItem',position:2,name:p?C.nameOf(p,lang):title.replace(/ | Motel à vendre$/,''),item:canonical}]});}
 if(p){
  const lodging={'@type':{motel:'Motel',hotel:'Hotel',inn:'BedAndBreakfast'}[p.type]||'LodgingBusiness',name:C.nameOf(p,lang),address:{'@type':'PostalAddress',addressLocality:p.city.split(' (')[0],addressRegion:'QC',addressCountry:'CA'}};if(p.rooms!==null)lodging.numberOfRooms=p.rooms;
  const listing={'@type':'RealEstateListing','@id':canonical+'#listing',name:C.nameOf(p,lang),description:p.copy[lang].description,url:canonical,inLanguage:locale[lang],image:(p.photos.length?p.photos:[p.image]).slice(0,6).map(x=>site.siteOrigin+'/'+x),about:lodging};
  if(p.price!==null)listing.offers={'@type':'Offer',price:p.price,priceCurrency:'CAD',url:canonical};
  page.mainEntity={'@id':canonical+'#listing'};graph.push(listing);
 }
 const json={'@context':'https://schema.org','@graph':graph};
 html=html.replace('</head>',`  <meta name="robots" content="${indexable?'index,follow':'noindex,nofollow'}">\n  <link rel="canonical" href="${canonical}">\n  ${alternates}\n  <link rel="alternate" hreflang="x-default" href="${site.siteOrigin+'/'+publicPath('fr',kind,ref)}">\n  <meta property="og:url" content="${canonical}">\n  <meta property="og:image" content="${image}">\n  <meta property="og:locale" content="${lang==='zh'?'zh_CN':lang+'_CA'}">\n  <meta property="og:image:alt" content="${E(p?C.nameOf(p,lang)+' — '+c[p.illustrative?'illustrativePhotoShort':'propertyPhoto']:'Motel à vendre — Québec')}">\n  <meta property="og:type" content="website">\n  <meta name="twitter:card" content="summary_large_image">\n  <script type="application/ld+json">${JSON.stringify(json).replace(/</g,'\\u003c')}</script>\n</head>`);
 html=html.replace(/<button\b(?![^>]*\btype=)/g,'<button type="button"');
 return {file,route,lang,kind,reference:ref,html};
}
return {make,publicPath,languages};
};
