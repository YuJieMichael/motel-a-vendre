const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../lib/account-core.js'),V=require('../lib/account-view.js');
const root=path.resolve(__dirname,'..');
const site={account:{enabled:true}};
const uid='11111111-1111-4111-8111-111111111111';
function memory(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};}
function fake(routes){const calls=[];const fetchImpl=async(url,init)=>{calls.push({url,init,body:init.body?JSON.parse(init.body):undefined});const handler=routes[init.method+' '+url];if(!handler)return Response.json({error:'not_found'},{status:404});const [status,body]=handler(init);return Response.json(body??{},{status});};return {fetchImpl,calls};}
const me={user:{id:uid,email:'a@example.com'}};

test('accounts are opt-in through site configuration',()=>{
 assert.equal(A.configured({}),false);assert.equal(A.configured({account:{enabled:'yes'}}),false);assert.equal(A.configured(site),true);
 assert.throws(()=>A.createClient({account:{enabled:false}},{storage:memory()}),/not_configured/);
});

test('email links are read from the fragment only',()=>{
 const token='a'.repeat(43);
 assert.deepEqual(A.parseAuthHash('#verify='+token),{type:'verify',token});assert.deepEqual(A.parseAuthHash('#reset='+token),{type:'reset',token});
 for(const h of ['#listings?lang=fr','#verify=short','#reset='+token+'&x=1','#login='+token])assert.equal(A.parseAuthHash(h),null);
});

test('favourites merge once per device, then the server stays authoritative',()=>{
 assert.deepEqual(A.mergeSaved(['1','2'],['2','3'],true),{merged:['2','3','1'],upload:['1']});
 assert.deepEqual(A.mergeSaved(['1','2'],['3'],false),{merged:['3'],upload:[]});
 assert.deepEqual(A.mergeSaved(['../x','1'],['bad','2'],true),{merged:['2','1'],upload:['1']});
});

test('requests stay same-origin with the CSRF header and the session cookie only',async()=>{
 const storage=memory(),{fetchImpl,calls}=fake({'POST /api/account/login':()=>[200,me]});
 const client=A.createClient(site,{storage,fetchImpl});const user=await client.signIn('a@example.com','longpassword');
 assert.equal(user.id,uid);assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.headers['X-MAV-Account'],'1');
 assert.deepEqual(JSON.parse(storage.getItem(A.HINT_KEY)),{id:uid,email:'a@example.com'});assert.doesNotMatch(storage.getItem(A.HINT_KEY),/token|session/i);
});

test('server error codes reach the page and an expired session clears the hint',async()=>{
 const storage=memory();let n=0;
 const {fetchImpl}=fake({'POST /api/account/login':()=>++n===1?[401,{error:'invalid_credentials'}]:[200,me],'GET /api/account/saved':()=>[401,{error:'session'}],'POST /api/account/recover':()=>[429,{error:'rate'}]});
 const client=A.createClient(site,{storage,fetchImpl});let changes=0;client.events.addEventListener('change',()=>changes++);
 await assert.rejects(client.signIn('a@example.com','bad'),e=>e.code==='invalid_credentials');
 await client.signIn('a@example.com','good');assert.ok(client.user);
 await assert.rejects(client.savedReferences(),e=>e.code==='session');assert.equal(client.user,null);assert.equal(changes,2);
 await assert.rejects(client.recover('a@example.com','fr'),e=>e.code==='rate');
});

test('first sync uploads local favourites in one batch and marks the device',async()=>{
 const storage=memory(),uploads=[];
 const {fetchImpl}=fake({'POST /api/account/login':()=>[200,me],'GET /api/account/saved':()=>[200,{references:['100024']}],'POST /api/account/saved':init=>{uploads.push(JSON.parse(init.body).references);return [200,{ok:true}];},'POST /api/account/logout':()=>[200,{ok:true}]});
 const client=A.createClient(site,{storage,fetchImpl});await client.signIn('a@example.com','x');
 assert.deepEqual(await client.syncSaved(['100021','100024']),['100024','100021']);assert.deepEqual(uploads,[['100021']]);
 assert.deepEqual(await client.syncSaved(['999']),['100024']);assert.equal(uploads.length,1);
 await client.signOut();assert.equal(storage.getItem(A.SYNC_KEY),null);assert.equal(storage.getItem(A.HINT_KEY),null);
});

test('enquiry history never carries contact details or message text',async()=>{
 let sent;const {fetchImpl}=fake({'POST /api/account/history':init=>{sent=JSON.parse(init.body);return [201,{ok:true}];}});
 const client=A.createClient(site,{storage:memory(),fetchImpl});
 await client.addHistory({id:'22222222-2222-4222-8222-222222222222',kind:'buyer',purpose:'viewing',listing_reference:'100021',language:'fr',email:'a@example.com',message:'secret'});
 assert.deepEqual(Object.keys(sent).sort(),['id','kind','language','listing_reference','purpose']);
 await assert.rejects(client.addHistory({id:'nope'}),e=>e.code==='invalid_input');
});

test('account page markup is escaped, has a delete confirmation and shows the privacy contact',()=>{
 const copy=new Proxy({},{get:(_,k)=>k==='acctTitle'?'<b>x</b>':String(k)});
 const html=V.page({copy,configured:true,privacyContact:'Jane <privacy@example.com>'});
 assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));assert.ok(html.includes('Jane &lt;privacy@example.com&gt;'));
 for(const id of ['form-signin','form-signup','form-recover','form-new-password','form-profile','account-sent','account-delete-dialog','delete-password','account-export'])assert.ok(html.includes(`id="${id}"`),id);
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

test('account scripts load from the site itself and the menu link follows the account switch',()=>{
 const config=vm.runInNewContext(fs.readFileSync(path.join(root,'data/site-config.js'),'utf8')+';MAV_SITE');
 const html=fs.readFileSync(path.join(root,'fr/compte/index.html'),'utf8');
 assert.ok(html.indexOf('lib/account-core.js')<html.indexOf('src="../../app.js"'));assert.ok(html.indexOf('src="../../app.js"')<html.indexOf('account.js"'));
 assert.doesNotMatch(html,/<script[^>]+src="https?:/);assert.equal(/data-route="account"/.test(fs.readFileSync(path.join(root,'fr/index.html'),'utf8')),config.account.enabled===true);
 if(config.account.enabled){assert.match(config.account.d1DatabaseId,/^[0-9a-f-]{36}$/);assert.ok(config.account.privacyContact.trim());assert.match(config.account.mailFrom,/@mail\.motelavendre\.ca>$/);}
});
