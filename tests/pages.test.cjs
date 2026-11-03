const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../lib/catalogue-core.js'),V=require('../lib/property-view.js');
const catalogue=C.validateCatalogue(JSON.parse(fs.readFileSync(path.join(root,'data/catalogue.json'))));
const pages=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json')));
test('every public property has a pre-rendered page in all three languages',()=>{
 assert.equal(new Set(pages.map(p=>p.file)).size,pages.length);
 for(const property of catalogue.items)for(const lang of ['fr','en','zh']){
  const p=pages.find(p=>p.lang===lang&&p.reference===C.reference(property));assert.ok(p);
  const html=fs.readFileSync(path.join(root,p.file),'utf8');assert.ok(html.includes('<h1 id="property-heading">'+C.escapeHTML(C.nameOf(property,lang))+'</h1>'));assert.ok(html.includes(C.escapeHTML(property.rooms===null?property.roomsText[lang]||'':String(property.rooms))));
 }
});
test('pre-rendered pages have consistent canonical, language alternates and local review indexing rules',()=>{
 for(const p of pages){const html=fs.readFileSync(path.join(root,p.file),'utf8');
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)[1];assert.equal(canonical,'https://motelavendre.ca/'+p.route);
  assert.equal((html.match(/rel="alternate" hreflang=/g)||[]).length,4);assert.ok(html.includes('name="robots" content="noindex,nofollow"'));
  const json=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'].find(n=>n['@id']===canonical+'#webpage');assert.equal(json.url,canonical);assert.ok(!html.includes('token='));
 }
 assert.equal(fs.readFileSync(path.join(root,'robots.txt'),'utf8').trim(),'User-agent: *\nDisallow: /');
});
test('all generated page assets and internal navigation remain inside the project and exist offline',()=>{
 for(const p of pages){const html=fs.readFileSync(path.join(root,p.file),'utf8');
  for(const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
   const link=m[1];if(/^(?:https?:|#|data:)/.test(link))continue;
   const pathname=link.split(/[?#]/)[0];if(!pathname)continue;
   let target=path.resolve(path.dirname(path.join(root,p.file)),pathname);if(pathname.endsWith('/'))target=path.join(target,'index.html');
   assert.ok(target.startsWith(root+path.sep),'Outside project: '+link);assert.ok(fs.existsSync(target),p.file+' -> '+link);
  }
 }
});
test('gallery validation rejects remote or signed photo paths even when the cover is safe',()=>{
 const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/demo-catalogue.json')));
 for(const photos of [['https://example.com/private.webp'],['assets/../private.webp'],['assets/a.webp?token=secret'],Array(31).fill('assets/lakeside.png')])assert.throws(()=>C.validateCatalogue({...fixture,items:[{...fixture.items[0],photos}]}));
});
test('public facts stay localized and escaped in the property page',()=>{
 const p={...catalogue.items[0],facts:[{label:{fr:'<script>x</script>',en:'Label',zh:'标签'},value:{fr:'"<img onerror=x>',en:'Value',zh:'内容'}}]};
 const copy=new Proxy({},{get:(_,key)=>String(key)}),html=V.property(p,{lang:'fr',copy,asset:x=>x,home:'index.html',main:'https://proprieteenvente.ca/'});
 assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));assert.ok(!html.includes('<img onerror=x>'));
});
test('property pages describe the listing in structured data and localize names and filters',()=>{
 for(const property of catalogue.items)for(const lang of ['fr','en','zh']){
  const p=pages.find(p=>p.lang===lang&&p.reference===C.reference(property)),html=fs.readFileSync(path.join(root,p.file),'utf8');
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'],listing=graph.find(n=>n['@type']==='RealEstateListing');
  assert.equal(listing.name,C.nameOf(property,lang));assert.equal(listing.description,property.copy[lang].description);
  if(property.price!==null)assert.deepEqual([listing.offers.price,listing.offers.priceCurrency],[property.price,'CAD']);
  assert.equal(graph.find(n=>n['@type']==='BreadcrumbList').itemListElement.length,2);
  assert.equal((html.match(/<script type="application\/ld\+json">/g)||[]).length,1);
 }
 const home=fs.readFileSync(path.join(root,'fr/index.html'),'utf8'),regions=[...home.match(/<select id="region">(.*?)<\/select>/s)[1].matchAll(/value="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(regions,['all',...[...new Set(catalogue.items.map(p=>p.region))].sort((a,b)=>a.localeCompare(b,'fr'))]);
 for(const type of ['hotel','motel','inn','hotel-motel'])assert.equal(home.includes(`<option value="${type}"`),catalogue.items.some(p=>p.type===type));
});
