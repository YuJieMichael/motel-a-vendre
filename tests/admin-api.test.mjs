import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {createAdminApi} from '../deployment/admin-api.mjs';
import {createAccountApi} from '../deployment/account-api.mjs';
import {applyListingSettings} from '../deployment/live-catalogue.mjs';
import {openLocalD1} from '../deployment/local-d1.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),migrations=path.resolve(here,'../d1/migrations');
const ORIGIN='https://motelavendre.ca',SB='https://usngcexxobcpjncuwaxo.supabase.co';
const site={endpoint:SB+'/functions/v1/motel-services/enquiry',publishableKey:'sb_publishable_test',siteOrigin:ORIGIN};
const TOKENS={owner:'aaaaaaaaaaaa.bbbbbbbbbbbb.owner0000000',operator:'aaaaaaaaaaaa.bbbbbbbbbbbb.operator0000',buyer:'aaaaaaaaaaaa.bbbbbbbbbbbb.buyer0000000'};
const rows=[{listing_number:100013,city:'Québec',region:'Capitale-Nationale',price:1900000,photo_paths:['/centris/1234567/001.webp'],published_at:'2026-10-01T00:00:00Z'},{listing_number:100024,city:'Lévis',price:2500000,photo_paths:[],published_at:'2026-10-02T00:00:00Z'}];

function setup({inviteStatus=200,inviteError}={}){
 const calls=[],mails=[];
 const fetchImpl=async(url,init={})=>{
  url=String(url);calls.push({url,init});
  const token=(init.headers?.Authorization||'').replace('Bearer ','');
  const role=Object.entries(TOKENS).find(([,v])=>v===token)?.[0];
  if(url.endsWith('/rest/v1/rpc/get_my_staff_role'))return role?Response.json(role==='buyer'?null:role):new Response('{}',{status:401});
  if(url.endsWith('/rest/v1/rpc/get_my_staff_access'))return role?Response.json(role!=='buyer'):new Response('{}',{status:401});
  if(url.endsWith('/auth/v1/user'))return role?Response.json({email:role+'@example.com'}):new Response('{}',{status:401});
  if(url.endsWith('/functions/v1/invite-staff'))return Response.json(inviteError?{error:inviteError}:{ok:true},{status:inviteStatus});
  if(url.includes('/rest/v1/published_listings'))return Response.json(rows);
  throw Error('unexpected '+url);
 };
 let changed=0;
 const env={ACCOUNTS:openLocalD1(':memory:',migrations),ACCOUNT_MAIL_LOG:m=>mails.push(m)};
 const api=createAdminApi({site,fetchImpl,onListingsChanged:()=>changed++});
 const call=async(method,route,body,who='owner',headers={})=>{
  const r=await api(new Request(ORIGIN+'/api/admin/'+route,{method,headers:{...(who?{authorization:'Bearer '+TOKENS[who]}:{}),...(body?{'content-type':'application/json',origin:ORIGIN}:{}),...headers},body:body?JSON.stringify(body):undefined}),env);
  return {status:r.status,body:await r.json(),headers:r.headers};
 };
 return {env,call,calls,mails,changed:()=>changed,db:env.ACCOUNTS.raw};
}
async function buyer(env,email,mails){
 const accounts=createAccountApi({siteOrigin:ORIGIN});
 await accounts(new Request(ORIGIN+'/api/account/signup',{method:'POST',headers:{'x-mav-account':'1',origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify({email,password:'harbour-lights-42',language:'fr',consent:true})}),{...env,ACCOUNT_MAIL_LOG:m=>mails.push(m)});
 return env.ACCOUNTS.raw.prepare('SELECT id FROM users WHERE email=?').get(email).id;
}

test('staff workspace requires a staff token verified by Supabase',async()=>{
 const t=setup();
 assert.equal((await t.call('GET','me',null,null)).status,401);
 assert.equal((await t.call('GET','me',null,null,{authorization:'Bearer not-a-jwt'})).status,401);
 const denied=await t.call('GET','me',null,'buyer');assert.equal(denied.status,403);assert.equal(denied.body.error,'staff_required');
 const me=await t.call('GET','me',null,'operator');assert.deepEqual(me.body,{email:'operator@example.com',role:'operator'});
 assert.equal(me.headers.get('cache-control'),'no-store');
 const rpc=t.calls.find(c=>c.url.endsWith('get_my_staff_role'));assert.equal(rpc.init.headers.apikey,'sb_publishable_test');
 assert.equal((await t.call('GET','nope',null,'operator')).status,404);
});

test('staff can list, confirm and delete buyer accounts, with an audit trail',async()=>{
 const t=setup(),mails=[];
 const id=await buyer(t.env,'pending@example.com',mails);await buyer(t.env,'other@example.com',mails);
 let list=await t.call('GET','accounts?filter=unverified',null,'operator');
 assert.equal(list.status,200);assert.equal(list.body.accounts.length,2);assert.deepEqual(list.body.totals,{total:2,verified:0});
 assert.equal((await t.call('GET','accounts?q=pend',null,'operator')).body.accounts[0].email,'pending@example.com');
 assert.equal((await t.call('GET','accounts?q=%25',null,'operator')).body.accounts.length,0,'LIKE wildcards are escaped');
 assert.equal((await t.call('POST','accounts/confirm',{id},'operator')).status,200);
 assert.ok(t.db.prepare('SELECT verified_at FROM users WHERE id=?').get(id).verified_at);
 assert.equal(t.db.prepare("SELECT count(*) n FROM auth_tokens WHERE user_id=? AND purpose='verify'").get(id).n,0,'old confirmation links stop working');
 list=await t.call('GET','accounts?filter=verified',null,'operator');assert.equal(list.body.accounts[0].email,'pending@example.com');
 assert.equal((await t.call('POST','accounts/delete',{id},'operator')).status,200);
 assert.equal(t.db.prepare('SELECT count(*) n FROM users WHERE id=?').get(id).n,0);
 assert.equal((await t.call('POST','accounts/delete',{id},'operator')).status,404);
 assert.equal((await t.call('POST','accounts/delete',{id:'x'},'operator')).status,400);
 assert.equal((await t.call('POST','accounts/delete',{id},'operator',{origin:'https://evil.example'})).status,403);
 const audit=(await t.call('GET','audit',null,'operator')).body.events.map(e=>[e.action,e.actor,e.target]);
 assert.deepEqual(audit,[['account_delete','operator@example.com','pending@example.com'],['account_confirm','operator@example.com','pending@example.com']]);
});

test('listing display settings: hide and pin on this site only',async()=>{
 const t=setup();
 let r=await t.call('GET','listings',null,'operator');assert.equal(r.status,200);assert.deepEqual(r.body.listings.map(l=>[l.reference,l.hidden,l.pinned,l.photos]),[['100024',false,false,0],['100013',false,false,1]]);
 assert.equal((await t.call('POST','listings',{reference:'100024',hidden:true},'operator')).status,200);
 assert.equal((await t.call('POST','listings',{reference:'100013',pinned:true},'operator')).status,200);
 assert.equal(t.changed(),2);
 assert.equal((await t.call('POST','listings',{reference:'abc',hidden:true},'operator')).status,400);
 assert.equal((await t.call('POST','listings',{reference:'100013'},'operator')).status,400);
 r=await t.call('GET','listings',null,'operator');assert.deepEqual(r.body.listings.map(l=>[l.reference,l.hidden,l.pinned,l.updated_by]),[['100013',false,true,'operator@example.com'],['100024',true,false,'operator@example.com']]);
 const settings=t.db.prepare('SELECT listing_reference,hidden,pinned FROM listing_settings').all();
 const catalogue={items:[{reference:'100099'},{reference:'100024'},{reference:'100013'}]};
 assert.deepEqual(applyListingSettings(catalogue,settings).items.map(p=>p.reference),['100013','100099']);
 assert.equal(applyListingSettings(catalogue,[]),catalogue);
 assert.deepEqual((await t.call('GET','audit',null,'operator')).body.events.map(e=>e.action),['listing_pin','listing_hide']);
});

test('only the owner can invite; invitations reuse the main invite-staff function',async()=>{
 let t=setup();
 assert.equal((await t.call('POST','invite',{email:'new@example.com'},'operator')).body.error,'owner_required');
 const ok=await t.call('POST','invite',{email:' New@Example.com ',language:'zh'},'owner');
 assert.deepEqual(ok.body,{ok:true,mailed:true});
 const call=t.calls.find(c=>c.url.endsWith('/functions/v1/invite-staff'));
 assert.deepEqual(JSON.parse(call.init.body),{email:'new@example.com',role:'operator'});
 assert.equal(call.init.headers.Authorization,'Bearer '+TOKENS.owner);assert.equal(call.init.headers.Origin,undefined);
 assert.equal(t.mails[0].to,'new@example.com');assert.match(t.mails[0].text,/https:\/\/motelavendre\.ca\/admin\//);assert.match(t.mails[0].text,/owner@example\.com/);
 assert.equal((await t.call('GET','audit',null,'owner')).body.events[0].action,'staff_invite');
 assert.equal((await t.call('POST','invite',{email:'bad'},'owner')).status,400);
 t=setup({inviteStatus:404,inviteError:'account_not_found'});assert.equal((await t.call('POST','invite',{email:'nobody@example.com'},'owner')).body.error,'account_not_found');assert.equal(t.mails.length,0);
 t=setup({inviteStatus:409,inviteError:'already_staff'});assert.equal((await t.call('POST','invite',{email:'operator@example.com'},'owner')).body.error,'already_staff');
});

test('admin page ships with the release, stays out of search and calls only same-origin and Supabase',()=>{
 const release=path.resolve(here,'../release');
 for(const f of ['admin/index.html','admin/admin.js','admin/admin.css'])assert.ok(fs.existsSync(path.join(release,'public',f)),f);
 assert.ok(fs.existsSync(path.join(release,'admin-api.mjs')));
 assert.match(fs.readFileSync(path.join(release,'public/_headers'),'utf8'),/\/admin\/\*\n {2}X-Robots-Tag: noindex, nofollow/);
 assert.match(fs.readFileSync(path.join(release,'public/robots.txt'),'utf8'),/Disallow: \/admin\//);
 const html=fs.readFileSync(path.resolve(here,'../admin/index.html'),'utf8');assert.match(html,/noindex,nofollow/);assert.doesNotMatch(html,/<script>(?!<)/,'no inline scripts under the CSP');
 const js=fs.readFileSync(path.resolve(here,'../admin/admin.js'),'utf8');assert.doesNotMatch(js,/innerHTML|localStorage\.setItem\('mav_admin_session/);
 for(const lang of ['fr','en','zh'])assert.match(js,new RegExp(lang+': \\{ tab:'));
 assert.match(js,/list_buyer_enquiries_managed/);assert.match(js,/review_buyer_enquiry/);
});
