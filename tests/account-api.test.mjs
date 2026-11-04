import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createAccountApi,hashPassword,verifyPassword} from '../deployment/account-api.mjs';
import {openLocalD1} from '../deployment/local-d1.mjs';
const migrations=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../d1/migrations');
const ORIGIN='https://motelavendre.ca';

function setup(){
 let clock=Date.UTC(2026,10,3,15);const mails=[];
 const env={ACCOUNTS:openLocalD1(':memory:',migrations),ACCOUNT_MAIL_LOG:m=>mails.push(m)};
 const api=createAccountApi({siteOrigin:ORIGIN,now:()=>clock});
 const client=(ip='203.0.113.1')=>{let jar='';const call=async(method,route,body,extra={})=>{const r=await api(new Request(ORIGIN+'/api/account/'+route,{method,headers:{'x-mav-account':'1',origin:ORIGIN,'content-type':'application/json','cf-connecting-ip':ip,cookie:jar,...extra},body:body===undefined?undefined:JSON.stringify(body)}),env);const c=r.headers.get('set-cookie');if(c)jar=c.split(';')[0];return {status:r.status,body:await r.json(),headers:r.headers};};return {call,get jar(){return jar;}};};
 const tokenFrom=(kind,i=mails.length-1)=>mails[i].text.match(new RegExp('#'+kind+'=([\\w-]+)'))[1];
 const verified=async(c,email='buyer@example.com',password='harbour-lights-42')=>{await c.call('POST','signup',{email,password,language:'fr',consent:true});await c.call('POST','verify',{token:tokenFrom('verify')});return c;};
 return {env,mails,client,tokenFrom,verified,tick:s=>clock+=s*1000,db:env.ACCOUNTS.raw};
}

test('passwords use salted PBKDF2 and verify in constant form',async()=>{
 const a=await hashPassword('harbour-lights-42'),b=await hashPassword('harbour-lights-42');
 assert.match(a,/^pbkdf2-sha256\$20000\$/);assert.notEqual(a,b);
 assert.equal(await verifyPassword('harbour-lights-42',a),true);assert.equal(await verifyPassword('harbour-lights-43',a),false);assert.equal(await verifyPassword('x','garbage'),false);
});

test('sign-up requires consent and a reasonable password, and needs email confirmation',async()=>{
 const t=setup(),c=t.client();
 assert.equal((await c.call('POST','signup',{email:'buyer@example.com',password:'harbour-lights-42'})).status,400);
 assert.equal((await c.call('POST','signup',{email:'buyer@example.com',password:'password',consent:true})).body.error,'weak_password');
 assert.equal((await c.call('POST','signup',{email:'not-an-email',password:'harbour-lights-42',consent:true})).body.error,'invalid_input');
 assert.equal((await c.call('POST','signup',{email:'Buyer@Example.com',password:'harbour-lights-42',language:'zh',consent:true})).status,200);
 assert.equal(t.mails.length,1);assert.equal(t.mails[0].to,'buyer@example.com');assert.match(t.mails[0].text,/https:\/\/motelavendre\.ca\/zh\/account\/#verify=/);
 assert.equal((await c.call('POST','login',{email:'buyer@example.com',password:'harbour-lights-42'})).body.error,'email_not_confirmed');
 const v=await c.call('POST','verify',{token:t.tokenFrom('verify')});assert.equal(v.status,200);
 assert.match(v.headers.get('set-cookie'),/^__Host-mav_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/);
 assert.equal((await c.call('POST','verify',{token:t.tokenFrom('verify')})).body.error,'link_invalid','links are single-use');
 assert.equal((await c.call('GET','me')).body.profile.preferred_language,'zh');
 assert.equal(t.db.prepare("SELECT count(*) n FROM auth_tokens").get().n,0);
 assert.doesNotMatch(JSON.stringify(t.db.prepare('SELECT * FROM sessions').all()),new RegExp(c.jar.split('=')[1]),'only token hashes are stored');
});

test('duplicate sign-up does not reveal whether an address exists',async()=>{
 const t=setup(),c=await t.verified(t.client());
 const again=await t.client('203.0.113.9').call('POST','signup',{email:'buyer@example.com',password:'another-pass-77',consent:true});
 assert.equal(again.status,200);assert.deepEqual(again.body,{ok:true});assert.match(t.mails.at(-1).subject,/existe déjà/);
 assert.equal((await c.call('POST','login',{email:'buyer@example.com',password:'harbour-lights-42'})).status,200,'old password still works');
 const unknown=await t.client().call('POST','recover',{email:'nobody@example.com'});assert.deepEqual(unknown.body,{ok:true});
});

test('an expired confirmation can be reissued without replacing the account or its password',async()=>{
 const t=setup(),c=t.client(),email='pending@example.com',password='harbour-lights-42';
 await c.call('POST','signup',{email,password,language:'fr',consent:true});
 const old=t.tokenFrom('verify'),before=t.db.prepare('SELECT id,password_hash,consent_at FROM users').get();
 t.tick(49*3600);assert.equal((await c.call('POST','verify',{token:old})).body.error,'link_invalid');
 const resent=await c.call('POST','resend',{email:' Pending@Example.com ',language:'en'});
 assert.deepEqual([resent.status,resent.body],[200,{ok:true}]);assert.equal(t.mails.length,2);assert.match(t.mails.at(-1).text,/\/en\/account\/#verify=/);
 assert.deepEqual(t.db.prepare('SELECT id,password_hash,consent_at FROM users').get(),before);
 const fresh=t.tokenFrom('verify');assert.notEqual(fresh,old);assert.equal((await c.call('POST','verify',{token:fresh})).status,200);
 assert.equal((await c.call('POST','login',{email,password})).status,200);
 assert.equal((await c.call('POST','verify',{token:fresh})).body.error,'link_invalid');
});

test('registering a pending address again sends a fresh link for the same account',async()=>{
 const t=setup(),c=t.client(),body={email:'pending@example.com',password:'harbour-lights-42',language:'fr',consent:true};
 assert.equal((await c.call('POST','signup',body)).status,200);const old=t.tokenFrom('verify');
 assert.equal((await c.call('POST','signup',body)).status,200);assert.equal(t.mails.length,2);assert.equal(t.db.prepare('SELECT count(*) n FROM users').get().n,1);
 assert.equal((await c.call('POST','verify',{token:old})).body.error,'link_invalid');
 assert.equal((await c.call('POST','verify',{token:t.tokenFrom('verify')})).status,200);
});

test('resend is generic for unknown or activated addresses and cannot create or alter credentials',async()=>{
 const t=setup(),c=t.client();const unknown=await c.call('POST','resend',{email:'unknown@example.com',password:'ignored-password'});
 assert.deepEqual([unknown.status,unknown.body],[200,{ok:true}]);assert.equal(t.mails.length,0);assert.equal(t.db.prepare('SELECT count(*) n FROM users').get().n,0);
 await t.verified(c);const before=t.db.prepare('SELECT * FROM users').get();
 const known=await c.call('POST','resend',{email:'buyer@example.com',language:'fr',password:'ignored-password'});
 assert.deepEqual([known.status,known.body],[unknown.status,unknown.body]);assert.match(t.mails.at(-1).subject,/existe déjà/);assert.doesNotMatch(t.mails.at(-1).text,/#verify=/);
 assert.deepEqual(t.db.prepare('SELECT * FROM users').get(),before);
});

test('resend shares the mail budget, returns its real retry window and respects Turnstile',async()=>{
 const t=setup(),c=t.client();await c.call('POST','signup',{email:'pending@example.com',password:'harbour-lights-42',consent:true});
 t.env.TURNSTILE_SECRET='test-secret';t.env.TURNSTILE_VERIFY=async token=>token==='good-token';
 assert.equal((await c.call('POST','resend',{email:'pending@example.com'})).body.error,'captcha');assert.equal(t.mails.length,1);
 const body={email:'pending@example.com',turnstile:'good-token'};
 assert.equal((await c.call('POST','resend',body)).status,200);assert.equal((await c.call('POST','resend',body)).status,200);
 const limited=await c.call('POST','resend',body);assert.equal(limited.status,429);assert.equal(limited.body.error,'rate');assert.ok(Number(limited.headers.get('retry-after'))>0);assert.ok(Number(limited.headers.get('retry-after'))<=3600);
 t.tick(3601);assert.equal((await c.call('POST','resend',body)).status,200);
});

test('confirmation resend rejects cross-origin requests before sending mail',async()=>{
 const t=setup(),c=t.client();await c.call('POST','signup',{email:'pending@example.com',password:'harbour-lights-42',consent:true});
 const result=await c.call('POST','resend',{email:'pending@example.com'},{origin:'https://untrusted.example'});
 assert.deepEqual([result.status,result.body],[403,{error:'forbidden'}]);assert.equal(t.mails.length,1);assert.equal(result.headers.get('set-cookie'),null);
});

test('a failed mail delivery is not reported as success and a later resend can recover',async()=>{
 const t=setup(),c=t.client();await c.call('POST','signup',{email:'pending@example.com',password:'harbour-lights-42',consent:true});
 const logger=t.env.ACCOUNT_MAIL_LOG,originalFetch=globalThis.fetch;delete t.env.ACCOUNT_MAIL_LOG;t.env.RESEND_API_KEY='local-test-only';t.env.MAIL_FROM='Motel à vendre <compte@mail.motelavendre.ca>';
 globalThis.fetch=async()=>Response.json({error:'unavailable'},{status:503});
 try{const failed=await c.call('POST','resend',{email:'pending@example.com'});assert.deepEqual([failed.status,failed.body],[503,{error:'unavailable'}]);}finally{globalThis.fetch=originalFetch;t.env.ACCOUNT_MAIL_LOG=logger;}
 assert.equal((await c.call('POST','resend',{email:'pending@example.com'})).status,200);assert.equal((await c.call('POST','verify',{token:t.tokenFrom('verify')})).status,200);
});

test('login failures are generic and rate limited per address',async()=>{
 const t=setup();await t.verified(t.client());
 const wrong=await t.client().call('POST','login',{email:'buyer@example.com',password:'nope-nope-nope'});const missing=await t.client().call('POST','login',{email:'ghost@example.com',password:'nope-nope-nope'});
 assert.deepEqual([wrong.status,wrong.body],[401,{error:'invalid_credentials'}]);assert.deepEqual([missing.status,missing.body],[401,{error:'invalid_credentials'}]);
 let last;for(let i=0;i<11;i++)last=await t.client('198.51.100.'+i).call('POST','login',{email:'buyer@example.com',password:'nope-nope-nope'});
 assert.deepEqual([last.status,last.body.error],[429,'rate']);
 t.tick(901);assert.equal((await t.client().call('POST','login',{email:'buyer@example.com',password:'harbour-lights-42'})).status,200);
});

test('password reset uses a one-hour link and signs out every other session',async()=>{
 const t=setup(),phone=await t.verified(t.client()),laptop=t.client();
 assert.equal((await laptop.call('POST','recover',{email:'buyer@example.com',language:'en'})).status,200);assert.match(t.mails.at(-1).text,/\/en\/account\/#reset=/);
 const token=t.tokenFrom('reset');
 assert.equal((await laptop.call('POST','reset',{token,password:'short'})).body.error,'weak_password');
 assert.equal((await laptop.call('POST','reset',{token,password:'new-harbour-lights-42'})).status,200,'a rejected weak password does not spend the link');
 assert.equal((await phone.call('GET','me')).body.error,'session');
 assert.equal((await laptop.call('GET','me')).status,200);
 await laptop.call('POST','recover',{email:'buyer@example.com'});t.tick(3601);
 assert.equal((await laptop.call('POST','reset',{token:t.tokenFrom('reset'),password:'another-harbour-99'})).body.error,'link_invalid');
});

test('requests without the same-origin header or from another origin are refused',async()=>{
 const t=setup(),api=createAccountApi({siteOrigin:ORIGIN});
 const plain=await api(new Request(ORIGIN+'/api/account/me'),t.env);assert.equal(plain.status,403);
 const cross=await api(new Request(ORIGIN+'/api/account/login',{method:'POST',headers:{'x-mav-account':'1',origin:'https://evil.example','content-type':'application/json'},body:'{}'}),t.env);assert.equal(cross.status,403);
 const form=await api(new Request(ORIGIN+'/api/account/login',{method:'POST',headers:{'x-mav-account':'1',origin:ORIGIN,'content-type':'text/plain'},body:'{}'}),t.env);assert.equal(form.status,415);
 const big=await api(new Request(ORIGIN+'/api/account/login',{method:'POST',headers:{'x-mav-account':'1',origin:ORIGIN,'content-type':'application/json'},body:JSON.stringify({x:'a'.repeat(9000)})}),t.env);assert.equal(big.status,413);
 assert.equal((await api(new Request(ORIGIN+'/api/account/me',{headers:{'x-mav-account':'1'}}),{})).status,503,'missing D1 binding fails closed');
});

test('each user only ever sees and changes their own data, within quotas',async()=>{
 const t=setup(),a=await t.verified(t.client(),'a@example.com'),b=await t.verified(t.client(),'b@example.com');
 assert.equal((await a.call('POST','saved',{references:['100021','100024','100021']})).status,200);
 assert.equal((await a.call('POST','saved',{references:['../etc']})).status,400);
 assert.deepEqual((await b.call('GET','saved')).body.references,[]);
 await a.call('POST','searches',{name:'Laurentides',criteria:{region:'Laurentides',__proto__:{x:1},extra:'dropped'}});
 const [search]=(await a.call('GET','searches')).body.searches;assert.deepEqual(search.criteria,{region:'Laurentides'});
 await b.call('DELETE','searches/'+search.id);assert.equal((await a.call('GET','searches')).body.searches.length,1,'B cannot delete A’s search');
 await b.call('DELETE','saved/100021');assert.equal((await a.call('GET','saved')).body.references.length,2);
 for(let i=1;i<20;i++)await a.call('POST','searches',{name:'s'+i,criteria:{}});
 assert.deepEqual((await a.call('POST','searches',{name:'over',criteria:{}})).body,{error:'quota'});
 const p=await a.call('PUT','profile',{full_name:'  Marie  ',buyer_budget:'2500000',buyer_timeline:'3-6',preferred_language:'en',phone:'x'.repeat(99)});
 assert.deepEqual(p.body.profile,{full_name:'Marie',phone:'x'.repeat(40),preferred_language:'en',buyer_budget:2500000,buyer_regions:'',buyer_timeline:'3-6'});
 assert.equal((await a.call('PUT','profile',{buyer_budget:'-5'})).status,400);
 await a.call('POST','history',{id:'44444444-4444-4444-8444-444444444444',kind:'buyer',purpose:'viewing',listing_reference:'100021',language:'fr',message:'secret',email:'a@example.com'});
 assert.doesNotMatch(JSON.stringify(t.db.prepare('SELECT * FROM enquiry_history').all()),/secret|a@example/);
 assert.equal((await b.call('GET','history')).body.history.length,0);
});

test('export returns everything and deletion erases every row after a password check',async()=>{
 const t=setup(),a=await t.verified(t.client(),'a@example.com'),b=await t.verified(t.client(),'b@example.com');
 await a.call('POST','saved',{references:['100021']});await a.call('POST','searches',{name:'x',criteria:{}});
 const data=(await a.call('GET','export')).body;assert.equal(data.account.email,'a@example.com');assert.equal(data.saved_listings.length,1);assert.equal(data.saved_searches.length,1);assert.equal(JSON.stringify(data).includes('password'),false);
 assert.equal((await a.call('POST','delete',{password:'wrong-password-1'})).status,401);
 const gone=await a.call('POST','delete',{password:'harbour-lights-42'});assert.equal(gone.status,200);assert.match(gone.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await a.call('GET','me')).status,401);
 const left=t.db.prepare("SELECT (SELECT count(*) FROM users) u,(SELECT count(*) FROM profiles) p,(SELECT count(*) FROM sessions) s,(SELECT count(*) FROM saved_listings) l,(SELECT count(*) FROM saved_searches) q").get();
 assert.deepEqual({...left},{u:1,p:1,s:1,l:0,q:0});assert.equal((await b.call('GET','me')).status,200);
});

test('unconfirmed accounts expire and plain-HTTP sessions use a non-Secure local cookie',async()=>{
 const t=setup();await t.client().call('POST','signup',{email:'late@example.com',password:'harbour-lights-42',consent:true});
 t.tick(8*86400);await t.client('192.0.2.7').call('POST','signup',{email:'other@example.com',password:'harbour-lights-42',consent:true});
 assert.equal(t.db.prepare("SELECT count(*) n FROM users WHERE email='late@example.com'").get().n,0);
 const api=createAccountApi({siteOrigin:ORIGIN});
 const r=await api(new Request('http://127.0.0.1:5173/api/account/verify',{method:'POST',headers:{'x-mav-account':'1',origin:'http://127.0.0.1:5173','content-type':'application/json'},body:JSON.stringify({token:t.tokenFrom('verify')})}),t.env);
 assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/^mav_session=/);assert.doesNotMatch(r.headers.get('set-cookie'),/Secure/);
});

test('raising PASSWORD_ITERATIONS upgrades a stored hash at the next sign-in',async()=>{
 const t=setup();await t.verified(t.client());
 const before=t.db.prepare("SELECT password_hash h FROM users").get().h;assert.match(before,/\$20000\$/);
 t.env.PASSWORD_ITERATIONS='100000';assert.equal((await t.client().call('POST','login',{email:'buyer@example.com',password:'harbour-lights-42'})).status,200);
 assert.match(t.db.prepare("SELECT password_hash h FROM users").get().h,/\$100000\$/);
 assert.equal((await t.client().call('POST','login',{email:'buyer@example.com',password:'harbour-lights-42'})).status,200);
 t.env.PASSWORD_ITERATIONS='5';assert.equal((await t.client().call('POST','login',{email:'buyer@example.com',password:'harbour-lights-42'})).status,200,'out-of-range values fall back to the default');
 assert.match(t.db.prepare("SELECT password_hash h FROM users").get().h,/\$20000\$/);
});

import {runAlerts,matchingReferences} from '../deployment/account-alerts.mjs';
import fsAlerts from 'node:fs';
import C from '../lib/catalogue-core.js';
const realCatalogue=C.validateCatalogue(JSON.parse(fsAlerts.readFileSync(new URL('../data/catalogue.json',import.meta.url))));
const alertSite={siteOrigin:ORIGIN};

test('saved-search alerts: baseline first, then one email per search with only new listings',async()=>{
 const t=setup(),a=await t.verified(t.client(),'a@example.com');
 await a.call('PUT','profile',{preferred_language:'en'});
 assert.equal((await a.call('POST','searches',{name:'Under 2M',criteria:{budget:'under2'},alerts:true})).status,201);
 await a.call('POST','searches',{name:'Quiet',criteria:{budget:'under2'},alerts:false});
 const under2=matchingReferences(realCatalogue,{budget:'under2'},'en');assert.ok(under2.length>=2);
 const older={...realCatalogue,items:realCatalogue.items.filter(p=>C.reference(p)!==under2[0])};
 const before=t.mails.length;
 let s=await runAlerts(t.env,{site:alertSite,catalogue:older,log:()=>{}});assert.deepEqual([s.sent,s.baselined],[0,1]);assert.equal(t.mails.length,before,'baseline sends nothing');
 s=await runAlerts(t.env,{site:alertSite,catalogue:older,log:()=>{}});assert.equal(s.sent,0,'nothing new, nothing sent');
 s=await runAlerts(t.env,{site:alertSite,catalogue:realCatalogue,log:()=>{}});assert.equal(s.sent,1);
 const mail=t.mails.at(-1);assert.equal(mail.to,'a@example.com');assert.match(mail.subject,/Under 2M/);assert.ok(mail.text.includes(`/en/proprietes/${under2[0]}/`));
 for(const ref of under2.slice(1))assert.ok(!mail.text.includes(`/proprietes/${ref}/`),'already-seen listings are not repeated');
 assert.match(mail.headers['List-Unsubscribe'],/\/api\/account\/unsubscribe\?t=[\w-]{43}>$/);assert.equal(mail.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
 s=await runAlerts(t.env,{site:alertSite,catalogue:realCatalogue,log:()=>{}});assert.equal(s.sent,0,'never sent twice');
});

test('a region that disappeared matches nothing instead of every listing',()=>{
 assert.deepEqual(matchingReferences(realCatalogue,{region:'Nunavik'},'fr'),[]);
 assert.ok(matchingReferences(realCatalogue,{},'fr').length===realCatalogue.items.length);
});

test('one-click unsubscribe works without the site header, and switching back on re-baselines',async()=>{
 const t=setup(),a=await t.verified(t.client(),'a@example.com');
 await a.call('POST','searches',{name:'All',criteria:{},alerts:true});
 const token=t.db.prepare('SELECT unsubscribe_token t FROM saved_searches').get().t;assert.match(token,/^[\w-]{43}$/);
 const api=createAccountApi({siteOrigin:ORIGIN});
 const oneClick=await api(new Request(ORIGIN+'/api/account/unsubscribe?t='+token,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}),t.env);
 assert.equal(oneClick.status,200);assert.equal((await oneClick.json()).name,'All');
 const [row]=(await a.call('GET','searches')).body.searches;assert.equal(row.alerts,false);
 assert.equal((await api(new Request(ORIGIN+'/api/account/unsubscribe?t='+'x'.repeat(43),{method:'POST'}),t.env)).status,400);
 await runAlerts(t.env,{site:alertSite,catalogue:realCatalogue,log:()=>{}});
 const on=await a.call('PATCH','searches/'+row.id,{alerts:true});assert.deepEqual(on.body,{ok:true,alerts:true});
 assert.equal(t.db.prepare('SELECT alert_checked_at c FROM saved_searches').get().c,null,'fresh baseline after re-enabling');
 const other=await t.verified(t.client(),'b@example.com');assert.equal((await other.call('PATCH','searches/'+row.id,{alerts:false})).status,404,'cannot touch another user’s search');
});

test('Turnstile is enforced on sign-up and recovery once its secret is set',async()=>{
 const t=setup();t.env.TURNSTILE_SECRET='test-secret';t.env.TURNSTILE_VERIFY=async token=>token==='good-token';
 const c=t.client();
 assert.equal((await c.call('POST','signup',{email:'x@example.com',password:'harbour-lights-42',consent:true})).body.error,'captcha');
 assert.equal((await c.call('POST','signup',{email:'x@example.com',password:'harbour-lights-42',consent:true,turnstile:'bad'})).body.error,'captcha');
 assert.equal((await c.call('POST','signup',{email:'x@example.com',password:'harbour-lights-42',consent:true,turnstile:'good-token'})).status,200);
 assert.equal((await t.client('192.0.2.9').call('POST','recover',{email:'x@example.com'})).body.error,'captcha');
 assert.equal((await t.client('192.0.2.9').call('POST','recover',{email:'x@example.com',turnstile:'good-token'})).status,200);
});
