const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../lib/account-core.js'),V=require('../lib/account-view.js');
const root=path.resolve(__dirname,'..');
const site={endpoint:'https://usngcexxobcpjncuwaxo.supabase.co/functions/v1/motel-services/enquiry',account:{url:'https://acct.supabase.co',publishableKey:'sb_publishable_test'}};
const uid='11111111-1111-4111-8111-111111111111';
function memory(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};}
function fake(routes){const calls=[];const fetchImpl=async(url,init)=>{const u=new URL(url);calls.push({url:u,init,body:init.body?JSON.parse(init.body):undefined});const key=init.method+' '+u.pathname;const handler=routes[key];if(!handler)return new Response('{}',{status:404});const [status,body]=handler(u,init);return new Response(body===undefined?'':JSON.stringify(body),{status});};return {fetchImpl,calls};}
const token=(extra={})=>({access_token:'at',refresh_token:'rt',expires_in:3600,user:{id:uid,email:'a@example.com'},...extra});

test('account settings require a separate https project and a publishable key',()=>{
 assert.equal(A.configured({...site,account:{url:'',publishableKey:''}}),false);
 assert.equal(A.configured({...site,account:{url:'http://acct.supabase.co',publishableKey:'k'}}),false);
 assert.equal(A.configured({...site,account:{url:'https://usngcexxobcpjncuwaxo.supabase.co',publishableKey:'k'}}),false,'main-site project must be refused');
 assert.equal(A.configured({...site,account:{url:'https://acct.supabase.co/rest',publishableKey:'k'}}),false);
 assert.equal(A.configured(site),true);
 assert.throws(()=>A.createClient({...site,account:undefined},{storage:memory()}),/not_configured/);
});

test('auth redirect fragments are parsed and errors are surfaced',()=>{
 assert.equal(A.parseAuthHash('#listings?lang=fr'),null);
 const ok=A.parseAuthHash('#access_token=a&refresh_token=r&expires_in=3600&type=recovery');assert.equal(ok.type,'recovery');assert.equal(ok.access_token,'a');
 assert.equal(A.parseAuthHash('#error=access_denied&error_code=otp_expired&error_description=expired').error,'otp_expired');
 assert.equal(A.parseAuthHash('#access_token=a'),null);
});

test('favourites merge once per device, then the server stays authoritative',()=>{
 assert.deepEqual(A.mergeSaved(['1','2'],['2','3'],true),{merged:['2','3','1'],upload:['1']});
 assert.deepEqual(A.mergeSaved(['1','2'],['3'],false),{merged:['3'],upload:[]});
 assert.deepEqual(A.mergeSaved(['../x','1'],['bad','2'],true),{merged:['2','1'],upload:['1']});
});

test('profile input is bounded and invalid budgets are rejected',()=>{
 const p=A.cleanProfile({full_name:' '+'x'.repeat(100),preferred_language:'de',buyer_budget:'2500000',buyer_timeline:'soon'});
 assert.equal(p.full_name.length,80);assert.equal(p.preferred_language,'fr');assert.equal(p.buyer_budget,2500000);assert.equal(p.buyer_timeline,'');
 assert.equal(A.cleanProfile({buyer_budget:''}).buyer_budget,null);
 assert.throws(()=>A.cleanProfile({buyer_budget:'-1'}),/invalid_input/);assert.throws(()=>A.cleanProfile({buyer_budget:'1.5'}),/invalid_input/);
});

test('sign-in stores a session, sends only the publishable key and maps errors',async()=>{
 const storage=memory();let attempt=0;
 const {fetchImpl,calls}=fake({'POST /auth/v1/token':()=>++attempt===1?[400,{error_code:'invalid_credentials'}]:[200,token()]});
 const client=A.createClient(site,{storage,fetchImpl});
 await assert.rejects(client.signIn('a@example.com','bad'),e=>e.code==='invalid_credentials');assert.equal(client.user,null);
 const user=await client.signIn('a@example.com','good');assert.equal(user.id,uid);
 assert.equal(calls[0].url.origin,'https://acct.supabase.co');assert.equal(calls[0].url.searchParams.get('grant_type'),'password');
 assert.equal(calls[0].init.headers.apikey,'sb_publishable_test');assert.equal(calls[0].init.credentials,'omit');
 assert.ok(storage.getItem(A.SESSION_KEY).includes('"refresh_token":"rt"'));
});

test('rate limits and quota errors get their own codes',async()=>{
 const {fetchImpl}=fake({'POST /auth/v1/recover':()=>[429,{error_code:'over_email_send_rate_limit'}],'POST /auth/v1/signup':()=>[200,{id:uid}]});
 const client=A.createClient(site,{storage:memory(),fetchImpl});
 await assert.rejects(client.recover('a@example.com','https://motelavendre.ca/fr/compte/'),e=>e.code==='rate');
 assert.deepEqual(await client.signUp('a@example.com','longpassword','zh','https://motelavendre.ca/zh/account/'),{confirmed:false});
});

test('expired access tokens are refreshed once before data calls',async()=>{
 const storage=memory();let now=1_000_000_000_000;
 const {fetchImpl,calls}=fake({'POST /auth/v1/token':(u)=>u.searchParams.get('grant_type')==='refresh_token'?[200,token({access_token:'at2',refresh_token:'rt2'})]:[200,token()],'GET /rest/v1/saved_listings':()=>[200,[{listing_reference:'100021'}]]});
 const client=A.createClient(site,{storage,fetchImpl,now:()=>now});
 await client.signIn('a@example.com','x');now+=3600*1000;
 assert.deepEqual(await client.savedReferences(),['100021']);
 const data=calls.find(c=>c.url.pathname==='/rest/v1/saved_listings');assert.equal(data.init.headers.Authorization,'Bearer at2');
 assert.equal(calls.filter(c=>c.url.searchParams.get('grant_type')==='refresh_token').length,1);
});

test('a revoked refresh token signs the user out locally',async()=>{
 const storage=memory();let now=1_000_000_000_000;
 const {fetchImpl}=fake({'POST /auth/v1/token':(u)=>u.searchParams.get('grant_type')==='refresh_token'?[400,{error_code:'refresh_token_not_found'}]:[200,token()]});
 const client=A.createClient(site,{storage,fetchImpl,now:()=>now});await client.signIn('a@example.com','x');now+=7200*1000;
 await assert.rejects(client.profile(),e=>e.code==='session');assert.equal(client.user,null);
});

test('first sync uploads local favourites and marks the device',async()=>{
 const storage=memory(),uploads=[];
 const {fetchImpl}=fake({'POST /auth/v1/token':()=>[200,token()],'GET /rest/v1/saved_listings':()=>[200,[{listing_reference:'100024'}]],'POST /rest/v1/saved_listings':(u,init)=>{uploads.push(JSON.parse(init.body).listing_reference);return [201];}});
 const client=A.createClient(site,{storage,fetchImpl});await client.signIn('a@example.com','x');
 assert.deepEqual(await client.syncSaved(['100021','100024']),['100024','100021']);assert.deepEqual(uploads,['100021']);
 assert.deepEqual(await client.syncSaved(['999']),['100024']);assert.deepEqual(uploads,['100021']);
 await client.signOut();assert.equal(storage.getItem(A.SYNC_KEY),null);assert.equal(storage.getItem(A.SESSION_KEY),null);
});

test('enquiry history never carries contact details or message text',async()=>{
 let sent;const {fetchImpl}=fake({'POST /auth/v1/token':()=>[200,token()],'POST /rest/v1/enquiry_history':(u,init)=>{sent=JSON.parse(init.body);return [201];}});
 const client=A.createClient(site,{storage:memory(),fetchImpl});await client.signIn('a@example.com','x');
 await client.addHistory({id:'22222222-2222-4222-8222-222222222222',kind:'buyer',purpose:'viewing',listing_reference:'100021',language:'fr',email:'a@example.com',message:'secret'});
 assert.deepEqual(Object.keys(sent).sort(),['id','kind','language','listing_reference','purpose']);
 await assert.rejects(client.addHistory({id:'nope'}),e=>e.code==='invalid_input');
});

test('account page markup is escaped, has a delete confirmation and shows the privacy contact',()=>{
 const copy=new Proxy({},{get:(_,k)=>k==='acctTitle'?'<b>x</b>':String(k)});
 const html=V.page({copy,configured:true,privacyContact:'Jane <privacy@example.com>'});
 assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));assert.ok(html.includes('Jane &lt;privacy@example.com&gt;'));
 for(const id of ['form-signin','form-signup','form-recover','form-new-password','form-profile','account-delete-dialog','delete-confirm','account-export'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/id="account-unavailable" class="data-note" hidden/);
 assert.doesNotMatch(V.page({copy,configured:false}),/id="account-unavailable" class="data-note" hidden/);
});

test('account pages exist in all languages, are never indexed and stay out of the sitemap',()=>{
 const pages=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json'),'utf8'));
 const routes=pages.filter(p=>p.kind==='account').map(p=>p.route).sort();assert.deepEqual(routes,['en/account/','fr/compte/','zh/account/']);
 for(const r of routes){assert.match(fs.readFileSync(path.join(root,r,'index.html'),'utf8'),/name="robots" content="noindex,nofollow"/);}
 assert.doesNotMatch(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),/compte|\/account\//);
 const release=path.join(root,'release/public');
 if(fs.existsSync(release)){for(const r of routes)assert.match(fs.readFileSync(path.join(release,r,'index.html'),'utf8'),/name="robots" content="noindex,nofollow"/);const robots=fs.readFileSync(path.join(release,'robots.txt'),'utf8');for(const r of routes)assert.ok(robots.includes('Disallow: /'+r),r);}
});

test('account scripts load from the site itself and the main-site project key is not reused',()=>{
 const config=vm.runInNewContext(fs.readFileSync(path.join(root,'data/site-config.js'),'utf8')+';MAV_SITE');
 assert.ok(config.account&&typeof config.account==='object');assert.notEqual(config.account.publishableKey,config.publishableKey);
 const html=fs.readFileSync(path.join(root,'fr/compte/index.html'),'utf8');
 assert.ok(html.indexOf('lib/account-core.js')<html.indexOf('src="../../app.js"'));assert.ok(html.indexOf('src="../../app.js"')<html.indexOf('account.js"'));
 assert.doesNotMatch(html,/<script[^>]+src="https?:/);
});
