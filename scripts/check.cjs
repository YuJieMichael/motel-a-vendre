const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('../lib/catalogue-core.js'),root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const copy=vm.runInNewContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8')+';translations');
const data=C.validateCatalogue(JSON.parse(fs.readFileSync(path.join(root,'data/catalogue.json'),'utf8')));
const bundle=vm.runInNewContext(fs.readFileSync(path.join(root,'data/catalogue-data.js'),'utf8')+';MAV_CATALOGUE');
assert.equal(JSON.stringify(data),JSON.stringify(bundle),'Run npm run build:data after updating catalogue.json');
for(const lang of ['en','fr','zh'])for(const key of Object.keys(copy.en))assert.equal(typeof copy[lang][key],'string',lang+': '+key);
for(const match of html.matchAll(/data-(?:i18n|placeholder|aria|alt)="([^"]+)"/g))assert.equal(typeof copy.en[match[1]],'string','Missing translation: '+match[1]);
const refs=[...html.matchAll(/<(?:script|img)[^>]*src="([^"#]+)"|<link[^>]*rel="(?:stylesheet|icon)"[^>]*href="([^"#]+)"/g)].map(m=>m[1]||m[2]);
for(const file of [...refs,...data.items.flatMap(p=>[p.image,...p.photos]),'assets/logo.svg']){assert.ok(!/^(?:https?:|\/\/|javascript:)/i.test(file),'Unexpected external runtime asset');assert.ok(fs.existsSync(path.join(root,file)),file);}
for(const file of ['app.js','i18n.js','lib/catalogue-core.js','lib/enquiry-core.js','lib/property-view.js','data/site-config.js','data/catalogue-data.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const id of ['rooms-filter','season-filter','share-dialog','buyer-criteria','catalogue-error','route-notice'])assert.ok(ids.includes(id),'Missing element: '+id);
assert.ok(html.includes('class="view-switch"'));assert.ok(html.indexOf('lib/catalogue-core.js')<html.indexOf('src="app.js"'));
console.log('Static checks passed:',Object.keys(copy.en).length,'translation keys,',data.items.length,'validated properties, local assets and script syntax.');
