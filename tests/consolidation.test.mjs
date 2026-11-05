import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Routes from '../lib/site-routes.cjs';
import {handleRequest} from '../deployment/worker.mjs';
import {handleLiveRequest} from '../release/live-worker.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const legacy=[['fr/equipe/','/fr/#listings'],['fr/vendre/','/fr/guide-achat/#vendre'],['en/team/','/en/#listings'],['en/sell/','/en/buying-guide/#vendre'],['zh/team/','/zh/#listings'],['zh/sell/','/zh/buying-guide/#vendre']];

test('consolidated URLs permanently reach a useful same-language destination before loading data',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Redirect must not read the catalogue');};
 const env={ASSETS:{fetch:async()=>{throw Error('Redirect must not read removed assets');}}};
 try{for(const handler of [handleRequest,handleLiveRequest])for(const [old,target]of legacy)for(const suffix of ['', 'index.html']){
  const result=await handler(new Request('https://motelavendre.ca/'+old+suffix+'?from=bookmark'),env);
  assert.equal(result.status,301);const url=new URL(result.headers.get('location'));
  assert.equal(url.origin,'https://motelavendre.ca');assert.equal(url.pathname+url.hash,target);assert.equal(url.search,'?from=bookmark');
 }}finally{globalThis.fetch=original;}
 for(const path of ['/en/equipe/','/fr/team/','/fr/constructor/','/fr/__proto__/','/fr/compte/','/zh/proprietes/100021/','/en/team/other/','//evil.test/team/'])assert.equal(Routes.legacyTarget(path),null);
});

test('only useful page types enter the build and the sitemap',()=>{
 const pages=JSON.parse(read('data/page-manifest.json'));
 assert.deepEqual([...new Set(pages.map(p=>p.kind))].sort(),['account','guide','home','property']);
 const sitemap=read('release/public/sitemap.xml');assert.doesNotMatch(sitemap,/\/(?:equipe|team|vendre|sell|compte|account)\//);
 const publicPages=pages.filter(page=>page.kind!=='account'&&page.file!=='index.html');
 assert.equal((sitemap.match(/<loc>/g)||[]).length,publicPages.length);
 for(const lang of ['fr','en','zh']){
  const html=read(lang+'/index.html');assert.doesNotMatch(html,/approach-section|team-section|seller-section|data-route="(?:team|seller)"/);
  const guide=read(lang+'/'+(lang==='fr'?'guide-achat':'buying-guide')+'/index.html');assert.match(guide,/id="vendre"/);assert.match(guide,/class="guide-faq"/);
 }
});

test('account is the final header action and stays outside the browse navigation',()=>{
 const pages=JSON.parse(read('data/page-manifest.json'));
 for(const page of pages){
  const header=read(page.file).match(/<header\b[\s\S]*?<\/header>/)[0];
  assert.equal((header.match(/class="nav-account"/g)||[]).length,1);
  assert.ok(header.indexOf('class="nav-account"')>header.indexOf('data-lang="zh"'));
  assert.ok(header.indexOf('class="nav-account"')>header.indexOf('header-sell'));
  assert.doesNotMatch(header.match(/<nav\b[\s\S]*?<\/nav>/)[0],/nav-account/);
  assert.match(header,/class="nav-account"[^>]*aria-label="[^"]+"/);
 }
});
