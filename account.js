'use strict';
// Account centre page. Runs only on /fr/compte/, /en/account/ and /zh/account/.
(function(){
 if(document.body.dataset.page!=='account'||!window.MAVApp)return;
 const App=window.MAVApp,account=App.account,t=App.t,$=s=>document.querySelector(s),e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=$('#account-status');
 if(!account){$('#account-unavailable').hidden=false;return;}
 const say=(message,error=false)=>{status.textContent=message;status.classList.toggle('is-error',error);if(message)status.scrollIntoView({block:'nearest',behavior:'smooth'});};
 // A clear panel in place of the form, so a successful sign-up or reset request is never missed.
 function showSent(key,email){
  status.textContent='';$('#account-sent-text').textContent=t(key).replace('{email}',email);
  selectTab('signin');$('#signin-email').value=email;$('#account-sent').showModal();$('#account-sent-back').focus();
 }
 $('#account-sent-back').addEventListener('click',()=>$('#account-sent').close());
 $('#account-sent').addEventListener('close',()=>$('#signin-password').focus());
 const fail=error=>{say(App.accountMessage(error),true);if(error?.code==='session')show();};
 let busy=false,resetToken='';
 async function guarded(form,fn){
  if(busy)return;busy=true;const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');
  try{await fn();}catch(error){fail(error);}finally{busy=false;controls.forEach(el=>el.disabled=false);form.removeAttribute('aria-busy');}
 }

 function selectTab(name){
  for(const tab of ['signin','signup','recover']){const on=tab===name;$('#tab-'+tab).setAttribute('aria-selected',String(on));$('#tab-'+tab).tabIndex=on?0:-1;$('#form-'+tab).hidden=!on;}
 }
 function show(mode){
  const user=account.user;
  $('#account-guest').hidden=!!user||mode==='recovery';$('#account-member').hidden=!user||mode==='recovery';$('#form-new-password').hidden=mode!=='recovery';
  if(user&&mode!=='recovery'){$('#account-email').textContent=user.email;loadMember();}
 }

 async function loadMember(){
  try{
   const refs=await account.syncSaved(App.localSavedReferences());
   const [profile,searches,history]=await Promise.all([account.profile(),account.searches(),account.history()]);
   fillProfile(profile||{});renderSaved(refs);renderSearches(searches);renderHistory(history);App.setSavedReferences(refs);
  }catch(error){fail(error);}
 }
 function fillProfile(p){
  $('#profile-name').value=p.full_name||'';$('#profile-phone').value=p.phone||'';$('#profile-language').value=p.preferred_language||App.language();
  $('#profile-budget').value=p.buyer_budget??'';$('#profile-regions').value=p.buyer_regions||'';$('#profile-timeline').value=p.buyer_timeline||'';
 }
 function renderSaved(refs){
  const list=$('#account-saved'),items=refs.map(ref=>({ref,p:App.byReference(ref)}));
  list.innerHTML=items.map(({ref,p})=>`<li><span><strong>${e(p?App.nameOf(p):'#'+ref)}</strong><small>${e(p?p.city+' · '+App.money(p.price):t('propertyUnavailable'))}</small></span><span class="account-row-actions">${p?`<a class="text-link" href="${e(App.pageURL(App.language(),'property',ref))}">${e(t('acctOpen'))}</a>`:''}<button class="quiet-button" data-remove-saved="${e(ref)}">${e(t('acctRemove'))}</button></span></li>`).join('');
  $('#account-saved-empty').hidden=items.length>0;
 }
 function renderSearches(rows){
  $('#account-searches').innerHTML=rows.map(r=>`<li><span><strong>${e(r.name)}</strong><small>${e(new Date(r.created_at).toLocaleDateString(document.documentElement.lang,{dateStyle:'medium',timeZone:'America/Toronto'}))}</small></span><span class="account-row-actions"><a class="text-link" href="${e(App.shareURL(r.criteria||{}))}">${e(t('acctOpen'))}</a><button class="quiet-button" data-remove-search="${e(r.id)}">${e(t('acctRemove'))}</button></span></li>`).join('');
  $('#account-searches-empty').hidden=rows.length>0;
 }
 function renderHistory(rows){
  const purposes={info:'purposeInfo',viewing:'purposeViewing',documents:'purposeDocuments'};
  $('#account-history').innerHTML=rows.map(r=>{const p=r.listing_reference?App.byReference(r.listing_reference):null;return `<li><span><strong>${e(t(r.kind==='seller'?'acctHistorySeller':'acctHistoryBuyer'))}${r.kind==='buyer'?' · '+e(t(purposes[r.purpose]||'purposeInfo')):''}</strong><small>${e(new Date(r.sent_at).toLocaleString(document.documentElement.lang,{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}))}${r.listing_reference?' · '+e(p?App.nameOf(p):'#'+r.listing_reference):''}</small></span><span class="receipt-code">${e(r.id.slice(0,8))}</span></li>`;}).join('');
  $('#account-history-empty').hidden=rows.length>0;
 }

 $('.account-tabs').addEventListener('click',event=>{const tab=event.target.closest('[data-account-tab]');if(tab){selectTab(tab.dataset.accountTab);say('');}});
 $('.account-tabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const tabs=['signin','signup','recover'],current=tabs.findIndex(x=>$('#tab-'+x).getAttribute('aria-selected')==='true'),next=tabs[(current+(event.key==='ArrowRight'?1:2))%3];selectTab(next);$('#tab-'+next).focus();});
 $('#form-signin').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{await account.signIn($('#signin-email').value.trim(),$('#signin-password').value);f.reset();say('');show();});});
 $('#form-signup').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const email=$('#signup-email').value.trim();await account.signUp(email,$('#signup-password').value,App.language());f.reset();showSent('acctCheckEmailText',email);});});
 $('#form-recover').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const email=$('#recover-email').value.trim();await account.recover(email,App.language());f.reset();showSent('acctResetSentText',email);});});
 $('#form-new-password').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{await account.resetPassword(resetToken,$('#new-password').value);resetToken='';f.reset();say(t('acctPasswordSaved'));show();});});
 $('#form-profile').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const p=await account.updateProfile({full_name:$('#profile-name').value,phone:$('#profile-phone').value,preferred_language:$('#profile-language').value,buyer_budget:$('#profile-budget').value,buyer_regions:$('#profile-regions').value,buyer_timeline:$('#profile-timeline').value});App.dropProfileCache();fillProfile(p||{});say(t('acctProfileSaved'));});});
 $('#account-signout').addEventListener('click',async()=>{await account.signOut();App.clearPersonalData();say(t('acctSignedOut'));show();});
 $('#account-member').addEventListener('click',async event=>{
  const savedRef=event.target.closest('[data-remove-saved]')?.dataset.removeSaved,searchId=event.target.closest('[data-remove-search]')?.dataset.removeSearch;
  try{
   if(savedRef){await account.removeSaved(savedRef);const refs=await account.savedReferences();renderSaved(refs);App.setSavedReferences(refs);}
   if(searchId){await account.removeSearch(searchId);renderSearches(await account.searches());}
  }catch(error){fail(error);}
 });
 $('#account-export').addEventListener('click',async()=>{
  try{const data=await account.exportData(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='motel-a-vendre-account-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);say(t('acctExported'));}catch(error){fail(error);}
 });
 $('#account-delete-open').addEventListener('click',()=>{$('#form-delete').reset();$('#account-delete-dialog').showModal();});
 $('#form-delete').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;
  guarded(f,async()=>{await account.deleteAccount($('#delete-password').value);App.clearPersonalData();$('#account-delete-dialog').close();say(t('acctDeleted'));show();});
 });

 // Confirmation and password-recovery links land here with tokens in the fragment.
 (async()=>{
  selectTab('signin');
  const parsed=MAVAccount.parseAuthHash(location.hash),linkLike=/^#(verify|reset)=/.test(location.hash);
  if(linkLike){try{history.replaceState(null,'',location.pathname+location.search);}catch{location.hash='';}}
  if(linkLike&&!parsed)fail({code:'link_invalid'});
  if(parsed?.type==='reset'){resetToken=parsed.token;say('');show('recovery');$('#new-password').focus();return;}
  if(parsed?.type==='verify'){try{await account.verify(parsed.token);say(t('acctLinkConfirmed'));}catch(error){fail(error);}}
  else{try{await account.refresh();}catch(error){fail(error);}}
  show();
 })();
})();
