import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {handleRequest,policy} from '../deployment/worker.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),release=path.join(root,'release');
const assets={fetch:async request=>new Response(request.method==='HEAD'?null:'property content',{headers:{'Content-Type':'text/html; charset=utf-8',ETag:'"public-1"'}})};
test('canonical redirects preserve public paths and query without trusting redirect targets',async()=>{
 for(const input of ['http://motelavendre.ca/fr/?x=1','https://www.motelavendre.ca/fr/?x=1']){const r=await handleRequest(new Request(input),{ASSETS:assets});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://motelavendre.ca/fr/?x=1');}
 const rootResponse=await handleRequest(new Request('https://motelavendre.ca/?next=https://example.com'),{ASSETS:assets});assert.equal(rootResponse.status,301);assert.equal(new URL(rootResponse.headers.get('location')).origin,'https://motelavendre.ca');assert.equal(new URL(rootResponse.headers.get('location')).pathname,'/fr/');
});
test('static gateway rejects unsupported hosts and mutating methods without invoking assets',async()=>{
 const env={ASSETS:{fetch:async()=>{throw Error('Unexpected asset call');}}};
 assert.equal((await handleRequest(new Request('https://untrusted.example/fr/'),env)).status,421);
 for(const method of ['POST','PUT','DELETE']){const r=await handleRequest(new Request('https://motelavendre.ca/fr/',{method}),env);assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');}
});
test('public asset content, conditional responses and HEAD survive security headers',async()=>{
 const r=await handleRequest(new Request('https://motelavendre.ca/fr/'),{ASSETS:assets});assert.equal(await r.text(),'property content');assert.equal(r.headers.get('etag'),'"public-1"');
 assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('strict-transport-security'),/max-age=/);
 const head=await handleRequest(new Request('http://127.0.0.1:5873/fr/',{method:'HEAD'}),{ASSETS:assets});assert.equal(await head.text(),'');assert.equal(head.headers.get('strict-transport-security'),null);
 const cached=await handleRequest(new Request('https://motelavendre.ca/fr/'),{ASSETS:{fetch:async()=>new Response(null,{status:304})}});assert.equal(cached.status,304);
});
test('security policy keeps executable code local and enquiry traffic bounded',()=>{
 assert.match(policy,/script-src 'self'/);assert.doesNotMatch(policy,/unsafe-inline|unsafe-eval|https:\/\/\*/);assert.match(policy,/connect-src 'self' https:\/\/usngcexxobcpjncuwaxo\.supabase\.co/);assert.match(policy,/frame-ancestors 'none'/);
});
test('missing property URLs retain real error status and cannot be indexed',async()=>{
 const r=await handleRequest(new Request('https://motelavendre.ca/fr/proprietes/999999/'),{ASSETS:{fetch:async()=>new Response('not found',{status:404})}});assert.equal(r.status,404);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');
});
test('publication candidate is separate from the local noindex review and excludes authoring files',()=>{
 assert.ok(fs.existsSync(path.join(release,'manifest.json')),'Run npm run prepare:release before release tests');
 const manifest=JSON.parse(fs.readFileSync(path.join(release,'manifest.json'),'utf8'));assert.equal(manifest.deployed,false);assert.equal(typeof manifest.intake.enabled,'boolean');
 const local=fs.readFileSync(path.join(root,'fr/index.html'),'utf8'),live=fs.readFileSync(path.join(release,'public/fr/index.html'),'utf8');
 assert.match(local,/noindex,nofollow/);assert.match(live,/name="robots" content="index,follow"/);assert.doesNotMatch(live,/APERÇU LOCAL/);
 assert.equal(fs.readFileSync(path.join(release,'public/robots.txt'),'utf8').includes('Allow: /'),true);
 for(const f of manifest.files){assert.doesNotMatch(f.file,/^(?:tests|scripts|templates|deployment)\//);assert.doesNotMatch(f.file,/catalogue\.json|site\.html|server\.mjs|source-manifest|README/);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(release,'public',f.file))).digest('hex'),f.sha256);}
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(release,'worker.mjs'))).digest('hex'),manifest.workerSha256);
});
test('language links work without JavaScript and keep the property reference',()=>{
 const pages=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json'),'utf8'));
 for(const p of pages){const html=fs.readFileSync(path.join(root,p.file),'utf8');for(const target of ['fr','en','zh']){const match=html.match(new RegExp('<a href="([^"]+)" data-lang="'+target+'"'));assert.ok(match,p.file+' '+target);assert.notEqual(match[1],'#');assert.ok(fs.existsSync(path.resolve(path.dirname(path.join(root,p.file)),match[1])));if(p.reference)assert.ok(match[1].includes('/proprietes/'+p.reference+'/'));}assert.equal((html.match(/aria-current="page"/g)||[]).length,1);}
});
test('release enquiry capability is explicit and CSP hashes match structured data',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(release,'manifest.json'),'utf8'));
 const config=vm.runInNewContext(fs.readFileSync(path.join(release,'public/data/site-config.js'),'utf8')+';MAV_SITE');assert.equal(config.publicationMode,'production');assert.equal(config.allowedOrigins.includes('https://motelavendre.ca'),manifest.intake.enabled);
 const worker=fs.readFileSync(path.join(release,'worker.mjs'),'utf8'),html=fs.readFileSync(path.join(release,'public/fr/proprietes/100021/index.html'),'utf8');const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];assert.ok(worker.includes('sha256-'+crypto.createHash('sha256').update(json).digest('base64')));
 const headers=fs.readFileSync(path.join(release,'public/_headers'),'utf8');assert.ok(headers.split('\n').every(l=>l.length<=2000));assert.match(headers,/frame-ancestors 'none'/);
});
