const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../lib/account-core.js'),copy=require('../lib/account-copy.js'),render=require('../lib/account-view.cjs');
const draft={name:'Motel — Laurentides',city:'Sainte-Adèle',region:'Laurentides',type:'motel',rooms:'24',price:'1500000',season:'year-round'};
test('draft storage requires explicit consent and a valid property, without retaining arbitrary private fields',()=>{
 assert.throws(()=>A.serialize(draft),/consent/);assert.throws(()=>A.serialize({...draft,city:''},{consent:true}),/city/);
 const raw=A.serialize({...draft,email:'private@example.test',password:'private',document:'confidential.pdf'},{consent:true,now:new Date('2026-11-03T12:00:00Z')});
 assert.doesNotMatch(raw,/email|password|document|confidential/);assert.deepEqual(A.parseStored(raw).property,draft);
 for(const raw of ['{','null','[]','{"version":1,"consent":false}','{"version":1,"consent":true,"savedAt":"invalid"}'])assert.equal(A.parseStored(raw),null);
});
test('unconfirmed capacity stays blank and malformed numeric or enum values are rejected',()=>{
 assert.equal(A.normalize({}).rooms,'');for(const value of ['0','-1','24.5','5001','twenty'])assert.throws(()=>A.normalize({...draft,rooms:value}));
 for(const value of ['-1','1000000001','1e6'])assert.throws(()=>A.normalize({...draft,price:value}));
 assert.throws(()=>A.normalize({...draft,type:'daycare'}));assert.throws(()=>A.normalize({...draft,name:'a\u0000b'}));assert.equal(A.completion(A.blank()),0);assert.equal(A.completion(draft),100);
});
test('draft export excludes browser consent, saved account identifiers and unsupported services',()=>{
 const value=JSON.parse(A.exportDraft({...draft,userId:'private',email:'private@example.test'},['photos','photos','admin','offers']));
 assert.deepEqual(value.services,['photos','offers']);assert.equal(value.format,'motel-a-vendre-local-draft');assert.equal('userId' in value.property,false);assert.equal('email' in value.property,false);assert.equal('consent' in value,false);
});
test('calendar starts on Monday, includes leap days and never changes viewing data',()=>{
 const leap=A.monthGrid(2028,1);assert.equal(leap.filter(Boolean).length,29);assert.equal(leap[1],1);assert.equal(leap.length%7,0);
 const november=A.monthGrid(2026,10);assert.equal(november[6],1);assert.equal(november.filter(Boolean).length,30);assert.throws(()=>A.monthGrid(2026,12));assert.equal(A.readSection('#admin'),'overview');
});
test('all account template languages expose the same sections and clearly separate local drafts from real accounts',()=>{
 for(const lang of ['fr','en','zh']){
  assert.deepEqual(Object.keys(copy[lang]).sort(),Object.keys(copy.fr).sort());
  const view=render({lang,site:{siteOrigin:'https://motelavendre.ca'}}),html=view.html;
  assert.equal(view.route,A.languagePath(lang));assert.match(html,/name="robots" content="noindex,nofollow"/);
  for(const section of A.sections)assert.ok(html.includes('data-account-section="'+section+'"'));
  assert.ok(html.includes(copy[lang].localNote));assert.ok(html.includes(copy[lang].ndaNote));assert.ok(html.includes('https://proprieteenvente.ca/'+lang+'/#login'));
  assert.doesNotMatch(html,/type="password"|type="file"|data-example-buyer|Camille R\./);
  assert.match(html,/<form id="account-project-form" method="post">/);assert.match(html,/<button[^>]*type="submit" disabled>/,'draft submission stays disabled until its local-only handler is ready');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 }
});
test('generated account routes are linked from the public site and remain outside the search sitemap',()=>{
 const root=path.resolve(__dirname,'..'),pages=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json')));
 assert.equal(pages.filter(p=>p.kind==='account').length,3);
 for(const lang of ['fr','en','zh']){
  const html=fs.readFileSync(path.join(root,lang,'index.html'),'utf8');assert.ok(html.includes(A.languagePath(lang)+'index.html'));
  const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');assert.ok(!sitemap.includes('https://motelavendre.ca/'+A.languagePath(lang)));
 }
});
