import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import fs from 'node:fs';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
import {createAdminApi} from '../deployment/admin-api.mjs';
import {createAccountApi} from '../deployment/account-api.mjs';
import {createEnquiryIntake,parseEnquiry} from '../deployment/enquiry-intake.mjs';
import {applyListingSettings} from '../deployment/live-catalogue.mjs';
import {openLocalD1} from '../deployment/local-d1.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),migrations=path.resolve(here,'../d1/migrations');
const ORIGIN='https://motelavendre.ca',OWNER='achat.vente.garderie@gmail.com';
const site={endpoint:'https://usngcexxobcpjncuwaxo.supabase.co/functions/v1/motel-services/enquiry',publishableKey:'sb_publishable_test',siteOrigin:ORIGIN};
const rows=[{listing_number:100013,city:'Québec',region:'Capitale-Nationale',price:1900000,photo_paths:['/centris/1234567/001.webp'],published_at:'2026-10-01T00:00:00Z'},{listing_number:100024,city:'Lévis',price:2500000,photo_paths:[],published_at:'2026-10-02T00:00:00Z'}];

function setup(){
 const mails=[],outside=[];
 const fetchImpl=async url=>{url=String(url);outside.push(url);if(url.includes('/rest/v1/published_listings'))return Response.json(rows);throw Error('unexpected '+url);};
 const env={ACCOUNTS:openLocalD1(':memory:',migrations),ACCOUNT_MAIL_LOG:m=>mails.push(m)};
 let changed=0;
 const api=createAdminApi({site,fetchImpl,onListingsChanged:()=>changed++});
 const client=(ip='203.0.113.9')=>{let jar='';const call=async(method,route,body,extra={})=>{
  const r=await api(new Request(ORIGIN+'/api/admin/'+route,{method,headers:{'cf-connecting-ip':ip,...(jar?{cookie:jar}:{}),...(method==='GET'?{}:{'x-mav-admin':'1','content-type':'application/json',origin:ORIGIN}),...extra},body:body?JSON.stringify(body):undefined}),env);
  const set=r.headers.get('set-cookie');if(set){const v=set.split(';')[0];jar=v.endsWith('=')?'':v;}
  return {status:r.status,body:await r.json(),cookie:set};
 };return {call,jar:()=>jar};};
 const linkToken=(kind,i=mails.length-1)=>mails[i].text.match(new RegExp('#'+kind+'=([\\w-]+)'))[1];
 const owner=async()=>{const c=client();await c.call('POST','password-link',{email:OWNER});await c.call('POST','set-password',{token:linkToken('set'),password:'motel-owner-2026'});return c;};
 return {env,mails,outside,client,linkToken,owner,changed:()=>changed,db:env.ACCOUNTS.raw};
}

test('owner is seeded without a password and sets one through an emailed link',async()=>{
 const t=setup(),c=t.client();
 assert.equal((await c.call('GET','me')).status,401);
 assert.equal((await c.call('POST','login',{email:OWNER,password:'anything-at-all'})).body.error,'invalid_credentials');
 assert.equal((await c.call('POST','password-link',{email:'stranger@example.com'})).status,200,'same answer for non-staff');
 assert.equal(t.mails.length,0);
 await c.call('POST','password-link',{email:OWNER});
 assert.equal(t.mails[0].to,OWNER);assert.match(t.mails[0].text,/https:\/\/motelavendre\.ca\/admin\/#set=/);
 assert.equal((await c.call('POST','set-password',{token:t.linkToken('set'),password:'short'})).body.error,'weak_password');
 const set=await c.call('POST','set-password',{token:t.linkToken('set'),password:'motel-owner-2026'});
 assert.equal(set.status,200);assert.match(set.cookie,/__Host-mav_staff=.+HttpOnly; SameSite=Strict; Max-Age=43200; Secure/);
 assert.deepEqual((await c.call('GET','me')).body,{email:OWNER,role:'owner'});
 assert.equal((await c.call('POST','set-password',{token:t.linkToken('set'),password:'motel-owner-2027'})).body.error,'link_invalid','links work once');
 await c.call('POST','logout',{});assert.equal((await c.call('GET','me')).status,401);
 assert.equal((await c.call('POST','login',{email:'ACHAT.vente.garderie@gmail.com',password:'motel-owner-2026'})).status,200);
 assert.equal(t.db.prepare('SELECT count(*) n FROM staff_members').get().n,1);
 assert.deepEqual(t.outside,[],'no outside service is called for staff sign-in');
});

test('writes require the admin header and this origin',async()=>{
 const t=setup(),c=t.client();
 assert.equal((await c.call('POST','login',{email:OWNER,password:'x'},{'x-mav-admin':''})).body.error,'forbidden');
 assert.equal((await c.call('POST','login',{email:OWNER,password:'x'},{origin:'https://evil.example'})).body.error,'forbidden');
});

test('owner invites by email; the invitee sets a password and gets operator access; owner can deactivate',async()=>{
 const t=setup(),o=await t.owner();
 const inv=await o.call('POST','invite',{email:' Ops@Example.com ',language:'zh'});
 assert.deepEqual(inv.body,{ok:true,mailed:true});
 const mail=t.mails.at(-1);assert.equal(mail.to,'ops@example.com');assert.match(mail.subject,/邀请/);assert.match(mail.text,/achat\.vente\.garderie@gmail\.com/);assert.match(mail.text,/\/admin\/#invite=/);
 assert.equal((await o.call('POST','invite',{email:'ops@example.com'})).status,200,'re-inviting a pending member resends');
 const ops=t.client('198.51.100.7');
 assert.equal((await ops.call('POST','set-password',{token:t.linkToken('invite'),password:'operator-pass-1'})).status,200);
 assert.deepEqual((await ops.call('GET','me')).body,{email:'ops@example.com',role:'operator'});
 assert.equal((await o.call('POST','invite',{email:'ops@example.com'})).body.error,'already_staff');
 assert.equal((await ops.call('POST','invite',{email:'x@example.com'})).body.error,'owner_required');
 assert.equal((await ops.call('GET','team')).status,403);
 const team=(await o.call('GET','team')).body.members;assert.deepEqual(team.map(m=>[m.email,m.role,m.active,m.pending]),[[OWNER,'owner',true,false],['ops@example.com','operator',true,false]]);
 assert.equal((await o.call('POST','team/deactivate',{id:team[0].id})).status,400,'owner cannot be deactivated');
 assert.equal((await o.call('POST','team/deactivate',{id:team[1].id})).status,200);
 assert.equal((await ops.call('GET','me')).status,401,'sessions end at once');
 assert.equal((await ops.call('POST','login',{email:'ops@example.com',password:'operator-pass-1'})).status,401);
 await o.call('POST','team/activate',{id:team[1].id});
 assert.equal((await ops.call('POST','login',{email:'ops@example.com',password:'operator-pass-1'})).status,200);
 assert.equal((await o.call('POST','invite',{email:OWNER})).status,400);
 const audit=(await o.call('GET','audit')).body.events.map(e=>e.action);
 for(const a of ['staff_invite','staff_password','staff_deactivate','staff_activate'])assert.ok(audit.includes(a),a);
});

test('staff can list, confirm and delete buyer accounts',async()=>{
 const t=setup(),o=await t.owner(),mails=[];
 const accounts=createAccountApi({siteOrigin:ORIGIN});
 for(const email of ['pending@example.com','other@example.com'])await accounts(new Request(ORIGIN+'/api/account/signup',{method:'POST',headers:{'x-mav-account':'1',origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify({email,password:'harbour-lights-42',language:'fr',consent:true})}),{...t.env,ACCOUNT_MAIL_LOG:m=>mails.push(m)});
 const id=t.db.prepare('SELECT id FROM users WHERE email=?').get('pending@example.com').id;
 let list=await o.call('GET','accounts?filter=unverified');assert.equal(list.body.accounts.length,2);assert.deepEqual(list.body.totals,{total:2,verified:0});
 assert.equal((await o.call('GET','accounts?q=%25')).body.accounts.length,0,'LIKE wildcards are escaped');
 assert.equal((await o.call('POST','accounts/confirm',{id})).status,200);
 assert.ok(t.db.prepare('SELECT verified_at FROM users WHERE id=?').get(id).verified_at);
 assert.equal(t.db.prepare("SELECT count(*) n FROM auth_tokens WHERE user_id=? AND purpose='verify'").get(id).n,0);
 assert.equal((await o.call('POST','accounts/delete',{id})).status,200);
 assert.equal(t.db.prepare('SELECT count(*) n FROM users WHERE id=?').get(id).n,0);
 assert.equal((await o.call('POST','accounts/delete',{id})).status,404);
});

test('listing display settings: hide and pin on this site only',async()=>{
 const t=setup(),o=await t.owner();
 assert.deepEqual((await o.call('GET','listings')).body.listings.map(l=>l.reference),['100024','100013']);
 await o.call('POST','listings',{reference:'100024',hidden:true});await o.call('POST','listings',{reference:'100013',pinned:true});
 assert.equal(t.changed(),2);
 assert.equal((await o.call('POST','listings',{reference:'abc',hidden:true})).status,400);
 const settings=t.db.prepare('SELECT listing_reference,hidden,pinned FROM listing_settings').all();
 assert.deepEqual(applyListingSettings({items:[{reference:'100099'},{reference:'100024'},{reference:'100013'}]},settings).items.map(p=>p.reference),['100013','100099']);
});

const enquiry=(over={})=>({requestId:'6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',kind:'buyer',language:'fr',name:'Marc Tremblay',email:'marc@example.com',phone:'418-555-0142',city:'Québec',address:'',listingReference:'100013',propertyType:'hotel-motel',daycareSubsidy:'',budgetMin:'',budgetMax:'2000000',expectedPrice:'',timeline:'',service:'',assistance:'',contactLanguage:'fr',contactMethod:'email',contactTime:'',requirements:'Visite souhaitée',website:'',analyticsSource:'google',...over});

test('enquiries are stored in D1, emailed to the owner once, and triaged by staff',async()=>{
 const t=setup(),intake=createEnquiryIntake({site});
 const send=(body,headers={})=>intake(new Request(ORIGIN+'/api/enquiry',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json','cf-connecting-ip':'203.0.113.20',...headers},body:JSON.stringify(body)}),t.env,{catalogueLookup:ref=>ref==='100013'?{city:'Québec',price:1900000}:null});
 assert.equal((await send(enquiry(),{origin:'https://evil.example'})).status,403);
 assert.equal((await send(enquiry({website:'spam'}))).status,400,'honeypot');
 assert.equal((await send(enquiry({propertyType:'house'}))).status,400);
 assert.deepEqual(await (await send(enquiry())).json(),{ok:true});
 assert.equal((await send(enquiry())).status,200,'retry with the same requestId');
 const mail=t.mails.filter(m=>/Nouvelle demande/.test(m.subject));assert.equal(mail.length,1);assert.equal(mail[0].to,OWNER);assert.match(mail[0].text,/#100013 — Québec/);assert.match(mail[0].text,/\/admin\/#enquiries/);
 await send(enquiry({requestId:'7f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',kind:'seller',service:'broker',budgetMax:'',expectedPrice:'1500000',listingReference:''}));
 const o=await t.owner();
 let list=(await o.call('GET','enquiries')).body;assert.equal(list.enquiries.length,2);assert.equal(list.pending,2);
 const row=list.enquiries.find(e=>e.payload.kind==='buyer');assert.equal(row.payload.listingStatus,'linked');assert.equal(row.payload.listingCity,'Québec');
 assert.equal((await o.call('POST','enquiries/review',{id:row.id,revision:5,action:'accept'})).body.error,'revision_conflict');
 assert.equal((await o.call('POST','enquiries/review',{id:row.id,revision:0,action:'accept'})).status,200);
 assert.equal((await o.call('GET','enquiries?filter=accepted')).body.enquiries.length,1);
 assert.equal((await o.call('POST','enquiries/review',{id:row.id,revision:1,action:'delete'})).status,200);
 assert.equal((await o.call('POST','enquiries/review',{id:row.id,revision:2,action:'accept'})).body.error,'restore_first');
 assert.equal((await o.call('GET','enquiries?filter=deleted')).body.enquiries.length,1);
 for(let i=0;i<8;i++)await send(enquiry({requestId:`8f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a${String(i).padStart(2,'0')}`,email:`p${i}@example.com`}));
 assert.equal((await send(enquiry({requestId:'9f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',email:'late@example.com'}))).status,429);
});

test('parseEnquiry mirrors the Supabase validation for hotel/motel enquiries',()=>{
 assert.equal(parseEnquiry(enquiry()).analyticsSource,'google');
 assert.throws(()=>parseEnquiry(enquiry({kind:'seller'})),'seller needs a service');
 assert.equal(parseEnquiry(enquiry({kind:'seller',service:'hybrid',assistance:'video,photos'})).assistance,'photos,video');
 assert.throws(()=>parseEnquiry(enquiry({budgetMax:'12a'})));
 assert.throws(()=>parseEnquiry(enquiry({requestId:'not-a-uuid'})));
});

test('public form posts to /api/enquiry in site mode, without any Supabase key',async()=>{
 const E=vm.runInNewContext(fs.readFileSync(path.resolve(here,'../lib/enquiry-core.js'),'utf8')+';MAVEnquiry',{URL,TextEncoder,Response});
 const config={intake:'site',allowedOrigins:[ORIGIN]};
 assert.equal(E.canSubmit(config,ORIGIN),true);assert.equal(E.canSubmit(config,'https://evil.example'),false);
 let seen;const r=await E.send(config,{requestId:'6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'},{origin:ORIGIN,fetchImpl:async(url,init)=>{seen={url,init};return new Response('{"ok":true}',{status:200});}});
 assert.equal(r.ok,true);assert.equal(seen.url,'/api/enquiry');assert.equal(seen.init.headers.apikey,undefined);
});

test('admin page ships with the release and stays out of search',()=>{
 const release=path.resolve(here,'../release');
 for(const f of ['admin/index.html','admin/admin.js','admin/admin.css'])assert.ok(fs.existsSync(path.join(release,'public',f)),f);
 for(const f of ['admin-api.mjs','enquiry-intake.mjs'])assert.ok(fs.existsSync(path.join(release,f)),f);
 assert.match(fs.readFileSync(path.join(release,'public/_headers'),'utf8'),/\/admin\/\*\n {2}X-Robots-Tag: noindex, nofollow/);
 assert.match(fs.readFileSync(path.join(release,'public/robots.txt'),'utf8'),/Disallow: \/admin\//);
 const js=fs.readFileSync(path.resolve(here,'../admin/admin.js'),'utf8');
 assert.doesNotMatch(js,/innerHTML|supabase\.co|auth\/v1|rest\/v1/,'the admin page talks only to this site');
});
