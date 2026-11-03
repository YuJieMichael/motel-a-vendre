const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../lib/catalogue-core.js');
const source=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'fixtures/demo-catalogue.json'),'utf8'));
const catalogue=C.validateCatalogue(source),items=catalogue.items,regions=items.map(p=>p.region);
const state=values=>C.normalizeRoute({lang:'fr',...values},regions);

test('public route round trip keeps all supported criteria and excludes private fields',()=>{
 const values={lang:'zh',region:'Montréal',type:'hotel',budget:'over5',rooms:'40plus',season:'year-round',q:'Montréal & hôtel',sort:'priceDesc',view:'list',tab:'recent',property:'MAV-002',email:'private@example.com',phone:'5551234',message:'private text',name:'Person',token:'secret'};
 const hash=C.routeHash(values,regions);assert.deepEqual(C.readRoute(hash,regions),state(values));for(const forbidden of ['private','5551234','Person','secret','email','token'])assert.ok(!hash.includes(forbidden));
});
test('route parser validates enums, region, reference and keyword length',()=>{
 const s=C.readRoute('#propriete/javascript:evil?lang=xx&region=Elsewhere&type=house&budget=x&rooms=5&season=x&view=table&q='+('x'.repeat(300)),regions);
 assert.equal(s.lang,'fr');assert.equal(s.region,'all');assert.equal(s.type,'all');assert.equal(s.rooms,'all');assert.equal(s.view,'grid');assert.equal(s.property,'');assert.equal(s.q.length,120);
});
test('language stays attached to property links and numeric main references',()=>{assert.equal(C.readRoute('#propriete/100024?lang=en',regions).property,'100024');assert.equal(C.readRoute('#propriete/mav-001?lang=zh',regions).property,'MAV-001');});
test('room ranges are hotel capacity ranges, with exact boundaries',()=>{
 const rows=[19,20,39,40,null].map((rooms,i)=>({...items[0],id:'x'+i,rooms}));
 assert.deepEqual(C.selectListings(rows,state({rooms:'lt20'})).map(p=>p.rooms),[19]);assert.deepEqual(C.selectListings(rows,state({rooms:'20to39'})).map(p=>p.rooms),[20,39]);assert.deepEqual(C.selectListings(rows,state({rooms:'40plus'})).map(p=>p.rooms),[40]);assert.deepEqual(C.selectListings(rows,state({rooms:'unknown'})).map(p=>p.rooms),[null]);
});
test('room and operating-season filters combine with budget and region',()=>{assert.equal(C.selectListings(items,state({rooms:'40plus',budget:'over5',region:'Montréal',season:'year-round'}))[0].name,'Hôtel Maison Saint-Paul');assert.equal(C.selectListings(items,state({rooms:'lt20',season:'year-round'})).length,0);});
test('unknown prices are not matched to a budget or sorted ahead of known prices',()=>{
 const rows=[null,5e6,2e6,1999999,5000001].map((price,i)=>({...items[0],id:'x'+i,price}));
 assert.equal(C.selectListings(rows,state({budget:'2to5'})).length,2);assert.equal(C.selectListings(rows,state({budget:'under2'})).length,1);assert.equal(C.selectListings(rows,state({budget:'over5'})).length,1);for(const sort of ['priceAsc','priceDesc'])assert.equal(C.selectListings(rows,state({sort})).at(-1).price,null);
});
test('accent-insensitive search accepts the public reference',()=>{assert.equal(C.selectListings(items,state({q:'montreal'})).length,1);assert.equal(C.selectListings(items,state({q:'mav-001'}))[0].id,'nord-001');});
test('recent records are unique, bounded and exclude removed IDs',()=>{let recent=[];const valid=Array.from({length:20},(_,i)=>'id'+i);for(const id of valid)recent=C.addRecent(recent,id,valid);assert.equal(recent.length,12);recent=C.addRecent(recent,'id18',valid);assert.equal(recent[0],'id18');assert.equal(recent.filter(x=>x==='id18').length,1);assert.ok(!C.addRecent(['removed'],'invalid',valid).includes('removed'));});
test('saved and recently viewed selections preserve their own ordering',()=>{assert.deepEqual(C.selectListings(items,state({tab:'saved'}),[items[1].id]).map(p=>p.id),[items[1].id]);assert.deepEqual(C.selectListings(items,state({tab:'recent'}),[],[items[2].id,items[0].id]).map(p=>p.id),[items[2].id,items[0].id]);});
test('catalogue validates unique IDs and rejects mixed or malformed records',()=>{assert.throws(()=>C.validateCatalogue({...source,items:[source.items[0],source.items[0]]}));assert.throws(()=>C.validateCatalogue({...source,items:[{...source.items[0],rooms:-1}]}));assert.throws(()=>C.validateCatalogue({...source,items:[{...source.items[0],copy:{fr:{}}}]}));});
test('local image allowlist rejects remote assets, traversal and executable URLs',()=>{for(const image of ['https://example.com/private.png','assets/../private.png','javascript:alert(1)','assets/a.png?token=secret','assets//a.png'])assert.throws(()=>C.validateCatalogue({...source,items:[{...source.items[0],image}]}));});
test('property text is escaped for both HTML content and attribute contexts',()=>{const escaped=C.escapeHTML('<img src=x onerror="bad()"> & \'');assert.equal(escaped,'&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; &#39;');});
const exported=(features=[],extras={})=>({listing_number:100024,property:{type:'hotel-motel',city:'Saint-Sauveur',price:4890000,beds:100,description:'999 rooms',features,source:{originalAddress:'PRIVATE ADDRESS',locationStatus:'approximate'},...extras},contact:{email:'private@example.com'},photo_paths:['https://private.example/signed?token=secret']});
test('main-site import preserves approximate counts without turning them into exact capacity',()=>{
 const p=C.importMainRows([exported([{key:'guestRooms',value:{en:'Approximately 17',fr:'Environ 17',zh:'约17间'}}])],'2026-10-29').items[0];assert.equal(p.rooms,null);assert.equal(p.roomsText.fr,'Environ 17');assert.equal(C.selectListings([p],state({rooms:'lt20'})).length,0);assert.equal(C.selectListings([p],state({rooms:'unknown'})).length,1);
});
test('main-site import reads only canonical guestRooms and never beds or promotional text',()=>{const p=C.importMainRows([exported([{key:'commercialUnits',value:{en:'82',fr:'82',zh:'82'}}])],'2026-10-29').items[0];assert.equal(p.rooms,null);});
test('exact count requires matching values in all three languages',()=>{const exact=C.importMainRows([exported([{key:'guestRooms',value:{en:'18',fr:'18',zh:'18'}}])],'2026-10-29').items[0];assert.equal(exact.rooms,18);const missing=C.importMainRows([exported([{key:'guestRooms',value:{en:'18',fr:'',zh:'18'}}])],'2026-10-29').items[0];assert.equal(missing.rooms,null);assert.equal(missing.roomsText.fr,'');});
test('main-site import allowlists public fields and leaves unverified facts unknown',()=>{
 const result=C.importMainRows([exported([],{title:'PRIVATE STREET',lotArea:43560})],'2026-10-29'),p=result.items[0],text=JSON.stringify(result);assert.equal(p.reference,'100024');assert.equal(p.name,'Hôtel / Motel — Saint-Sauveur');assert.equal(p.acres,1);assert.equal(p.tenure,null);assert.equal(p.season,'unknown');assert.equal(p.image,'assets/property-unavailable.svg');for(const value of ['PRIVATE','private@','token=','photo_paths','source.originalAddress','beds'])assert.ok(!text.includes(value));
});
test('non-hotel and withdrawn rows are excluded; missing public references are rejected',()=>{assert.equal(C.importMainRows([{...exported(),status:'withdrawn'},exported([],{type:'house'})],'2026-10-29').items.length,0);assert.throws(()=>C.importMainRows([{...exported(),listing_number:''}],'2026-10-29'));});
test('original listing links have a fixed origin, validated numeric reference and language',()=>{assert.equal(C.mainListingURL('100024','en'),'https://proprieteenvente.ca/en/proprietes/100024/');assert.equal(C.mainListingURL('javascript:bad','fr'),null);assert.equal(C.mainListingURL('100024','unknown'),'https://proprieteenvente.ca/fr/proprietes/100024/');});
test('sharing from file mode never copies the local user path',()=>{const link=C.shareURL('file:///C:/Users/PrivateName/Desktop/site/index.html',state({property:'MAV-001'}),regions);assert.equal(link,'#propriete/MAV-001?lang=fr');assert.ok(!link.includes('PrivateName'));});
test('sharing removes original query strings and embedded URL credentials',()=>{const link=C.shareURL('https://user:password@example.com/?email=private@example.com',state({q:'Montréal'}),regions);assert.equal(link,'https://example.com/#listings?lang=fr&q=Montr%C3%A9al');assert.ok(!link.includes('private'));assert.ok(!link.includes('password'));});
test('hospitality subtype filters use only an explicitly published business-kind feature',()=>{for(const [value,expected]of [['Motel','motel'],['Hôtel','hotel'],['Auberge','inn'],['Bar et motel','hotel-motel']])assert.equal(C.importMainRows([exported([{key:'Genre de commerce',value:{fr:value}}])],'2026-10-30').items[0].type,expected);assert.equal(C.importMainRows([exported([],{description:'A motel with 17 rooms'})],'2026-10-30').items[0].type,'hotel-motel');});
test('unambiguous localized room units preserve exact capacity without accepting approximate text',()=>{const value={en:'18 rooms',fr:'18 chambres',zh:'18间'};assert.equal(C.importMainRows([exported([{key:'guestRooms',value}])],'2026-10-30').items[0].rooms,18);for(const zh of ['约18间','18–20间','19间',''])assert.equal(C.importMainRows([exported([{key:'guestRooms',value:{...value,zh}}])],'2026-10-30').items[0].rooms,null);});
test('public illustration flags do not turn a real listing into a fictional property or leak raw source data',()=>{for(const flag of [true,false]){const p=C.importMainRows([exported([],{source:{placeholder:flag,originalAddress:'PRIVATE ADDRESS'}})],'2026-10-30').items[0];assert.equal(p.illustrative,flag);assert.equal(p.real,true);assert.ok(!JSON.stringify(p).includes('PRIVATE'));}});
test('main-site import keeps public descriptions, localized names and administrative regions',()=>{
 const features=[{key:'Genre de commerce',label:{fr:'Activité',en:'Business',zh:'类型'},value:{fr:'Motel',en:'Motel',zh:'汽车旅馆'}}];
 const description='Environ 17 chambres pour ce motel à Laurier-Station. Données publiées sur demande.';
 const [p]=C.importMainRows([{listing_number:7,property:{type:'hotel-motel',city:'Laurier-Station',price:1,features,description,descriptionTranslations:{en:'About 17 rooms at this Laurier-Station motel. Figures on request.',zh:'约 17 间客房的 Laurier-Station 汽车旅馆。财务资料可申请索取。'}}}],'2026-11-03T00:00:00Z').items;
 assert.deepEqual(p.names,{fr:'Motel — Laurier-Station',en:'Motel — Laurier-Station',zh:'Laurier-Station 汽车旅馆'});
 assert.equal(p.region,'Chaudière-Appalaches');assert.equal(p.copy.fr.description,description);
 assert.equal(p.copy.fr.short,'Environ 17 chambres pour ce motel à Laurier-Station.');assert.equal(p.copy.zh.short,'约 17 间客房的 Laurier-Station 汽车旅馆。');
 const [q]=C.importMainRows([{listing_number:8,property:{type:'hotel-motel',city:'Ville Inconnue (Secteur)',description:'court'}}],'2026-11-03T00:00:00Z').items;
 assert.equal(q.region,'Ville Inconnue');assert.equal(q.copy.fr.short,'Annonce publique de Propriété En Vente.');assert.equal(C.nameOf(q,'en'),'Hotel / motel — Ville Inconnue');
});
