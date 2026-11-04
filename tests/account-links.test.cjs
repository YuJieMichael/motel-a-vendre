const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const A=require('../lib/account-core.js');
const script=fs.readFileSync(require('node:path').join(__dirname,'../account.js'),'utf8');
function page({local=false,verify,resend}={}){
 const nodes=new Map(),historyWrites=[],calls=[];let document;
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.open=false;this.value='';this.dataset={};this.textContent='';this.classList={toggle(){}};}
  setAttribute(name,value){this[name]=value;} removeAttribute(name){delete this[name];} querySelectorAll(){return [];} focus(){document.activeElement=this;} scrollIntoView(){} reset(){} showModal(){this.open=true;} close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector);};
 document={body:{dataset:{page:'account'}},documentElement:{lang:'fr-CA'},querySelector:node,head:{append(){}}};
 node('#account-page').dataset.localPreview=String(local);
 const account={user:null,refresh:async()=>account.user?{user:account.user}:null,verify:async token=>{calls.push(token);if(verify)await verify(token);account.user={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.invalid'};return account.user;},syncSaved:async()=>[],profile:async()=>({}),searches:async()=>[],history:async()=>[],resendConfirmation:async email=>{calls.push(email);if(resend)await resend();}};
 const window=new EventTarget();window.MAVApp={account,t:key=>key+' {email}',language:()=> 'fr',accountMessage:e=>e.code,localSavedReferences:()=>[],setSavedReferences(){}};
 const location={hash:'',pathname:'/fr/compte/',search:''};
 vm.runInNewContext(script,{window,document,location,history:{replaceState:(_s,_t,url)=>{historyWrites.push(url);location.hash='';}},MAVAccount:A,Event,Promise,console});
 const settle=()=>new Promise(setImmediate);
 const link=hash=>{location.hash=hash;window.dispatchEvent(new Event('hashchange'));};
 return {node,account,calls,historyWrites,location,settle,link};
}

test('a confirmation link works in an already open account page and immediately leaves the address bar',async()=>{
 const p=page();await p.settle();const token='a'.repeat(43);p.link('#verify='+token);
 assert.equal(p.location.hash,'');await p.settle();assert.deepEqual(p.calls,[token]);
 assert.equal(p.node('#account-member').hidden,false);assert.match(p.node('#account-status').textContent,/acctLinkConfirmed/);assert.deepEqual(p.historyWrites,['/fr/compte/']);
});

test('expired confirmation and malformed reset links have the correct recovery forms',async()=>{
 const p=page({verify:async()=>{throw {code:'link_invalid'};}});await p.settle();p.link('#verify='+'b'.repeat(43));await p.settle();
 assert.equal(p.node('#form-resend').hidden,false);assert.equal(p.node('#account-guest').hidden,false);
 p.link('#reset=too-short');await p.settle();assert.equal(p.node('#form-recover').hidden,false);assert.equal(p.node('#form-new-password').hidden,true);
});

test('successive email links are queued rather than dropping the newest one',async()=>{
 const p=page();await p.settle();p.link('#verify='+'c'.repeat(43));p.link('#verify='+'d'.repeat(43));await p.settle();
 assert.deepEqual(p.calls,['c'.repeat(43),'d'.repeat(43)]);assert.equal(p.location.hash,'');
});

test('reopening a used link while signed in keeps the active account usable',async()=>{
 let n=0;const p=page({verify:async()=>{if(n++)throw {code:'link_invalid'};}});await p.settle();p.link('#verify='+'e'.repeat(43));await p.settle();p.link('#verify='+'e'.repeat(43));await p.settle();
 assert.equal(p.node('#account-member').hidden,false);assert.match(p.node('#account-status').textContent,/acctAlreadySignedIn/);
});

test('local resend feedback does not promise delivery or tell users to check spam',async()=>{
 const p=page({local:true});await p.settle();p.node('#account-resend-open').dispatchEvent(new Event('click'));p.node('#resend-email').value='qa@example.invalid';p.node('#form-resend').dispatchEvent(new Event('submit',{cancelable:true}));await p.settle();
 assert.deepEqual(p.calls,['qa@example.invalid']);assert.equal(p.node('#account-sent').open,true);assert.match(p.node('#account-sent-heading').textContent,/acctLocalMailTitle/);assert.match(p.node('#account-sent-text').textContent,/acctLocalMailSent/);assert.equal(p.node('#account-sent-hint').hidden,true);
});

test('an in-flight resend cannot be submitted twice and an error leaves a usable retry form',async()=>{
 let reject;const pending=new Promise((_resolve,r)=>{reject=r;});const p=page({resend:()=>pending});await p.settle();
 p.node('#account-resend-open').dispatchEvent(new Event('click'));p.node('#resend-email').value='qa@example.invalid';
 const form=p.node('#form-resend');form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));await p.settle();
 assert.equal(p.calls.length,1);assert.equal(form['aria-busy'],'true');reject({code:'unavailable'});await p.settle();
 assert.equal(form['aria-busy'],undefined);assert.equal(form.hidden,false);assert.equal(p.node('#account-sent').open,false);assert.match(p.node('#account-status').textContent,/unavailable/);
});
