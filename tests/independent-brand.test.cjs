const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const translations=vm.runInNewContext(read('i18n.js')+';translations');
const site=vm.runInNewContext(read('data/site-config.js')+';MAV_SITE');
const C=require('../lib/catalogue-core.js'),E=require('../lib/enquiry-core.js');
const catalogue=C.validateCatalogue(JSON.parse(read('data/catalogue.json')));
const associated=/Propriété En Vente|proprieteenvente\.ca|主站|site principal|main (?:web)?site/i;

test('all local and production pages keep customer navigation and branding on Motel à vendre',()=>{
 const pages=JSON.parse(read('data/page-manifest.json'));
 for(const prefix of ['', 'release/public/'])for(const p of pages){
  const html=read(prefix+p.file);assert.doesNotMatch(html,associated,prefix+p.file);
  assert.doesNotMatch(html,/data-main-|main-enquiry-link|\bundefined\b/);
  for(const [,href]of html.matchAll(/<a\b[^>]*href="(https?:[^\"]+)"/g)){
   assert.equal(new URL(href).hostname,'motelavendre.ca',p.file+' -> '+href);
  }
 }
 for(const [lang,copy]of Object.entries(translations))for(const [key,value]of Object.entries(copy))assert.doesNotMatch(value,associated,lang+'.'+key);
});

test('empty catalogue and newly synced partial listings have a usable on-site next action',()=>{
 const create=require('../lib/page-renderer.cjs');
 const imported=C.importMainRows([{listing_number:100099,property:{type:'hotel-motel',city:'Québec',price:1900000,features:[],photoIllustrative:true,photo_paths:[]}}],'2026-11-03T12:00:00Z');
 for(const items of [[],imported.items]){
  const renderer=create({template:read('templates/site.html'),translations,site,catalogue:{...catalogue,items}});
  for(const lang of ['fr','en','zh']){
   const home=renderer.make(lang).html;assert.doesNotMatch(home,associated);assert.doesNotMatch(home,/\bundefined\b/);assert.match(home,/buyer-trigger/);
   if(items.length)assert.doesNotMatch(renderer.make(lang,'property',items[0]).html,associated);
  }
 }
});

test('production enquiries use the existing intake without an external hand-off or claimed live check',()=>{
 const release=vm.runInNewContext(read('release/public/data/site-config.js')+';MAV_SITE');
 const manifest=JSON.parse(read('release/manifest.json'));
 assert.equal(release.endpoint,site.endpoint);assert.equal(release.publishableKey,site.publishableKey);
 assert.equal(release.enquiryMode,'direct');assert.equal(E.canSubmit(release,release.siteOrigin),true);
 assert.equal(manifest.intake.enabled,true);
 assert.ok(['not-run','non-writing-live-check'].includes(manifest.intake.verification));
 if(manifest.intake.verification==='not-run'){assert.equal(manifest.intake.preflight,undefined);assert.equal(manifest.intake.rejectedInvalidBody,undefined);}
 for(const p of ['deployment/worker.mjs','deployment/live-worker.mjs','release/public/_headers'])assert.doesNotMatch(read(p),/form-action[^;\n"]*proprieteenvente/);
});

test('own-site account controls, privacy contact and source synchronization stay available',()=>{
 assert.equal(site.account.enabled,true);assert.equal(site.account.mailFrom,'Motel à vendre <compte@mail.motelavendre.ca>');
 assert.ok(site.account.privacyContact);assert.match(read('deployment/live-catalogue.mjs'),/published_listings/);
 for(const [lang,route]of [['fr','compte'],['en','account'],['zh','account']]){
  const html=read(lang+'/'+route+'/index.html');
  for(const id of ['form-signin','form-signup','signup-consent','form-recover','form-new-password','account-export','account-delete-open','form-delete'])assert.ok(html.includes('id="'+id+'"'));
  assert.ok(html.includes(C.escapeHTML(site.account.privacyContact)));
  assert.match(html,/noindex,nofollow/);assert.ok(translations[lang].acctRights);
 }
});
