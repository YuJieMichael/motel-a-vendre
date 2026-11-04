'use strict';
// Account centre page. Runs only on /fr/compte/, /en/account/ and /zh/account/.
(function(){
 if(document.body.dataset.page!=='account'||!window.MAVApp)return;
 const App=window.MAVApp,account=App.account,t=App.t,$=s=>document.querySelector(s),e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=$('#account-status'),localPreview=$('#account-page').dataset.localPreview==='true';
 status.tabIndex=-1;
 $('#account-local-preview').hidden=!localPreview;
 if(!account){$('#account-unavailable').hidden=false;return;}
 const say=(message,error=false)=>{status.textContent=message;status.classList.toggle('is-error',error);if(message)status.scrollIntoView({block:'nearest',behavior:'smooth'});};
 // A clear panel in place of the form, so a successful sign-up or reset request is never missed.
 function showSent(key,email){
  status.textContent='';$('#account-sent-heading').textContent=t(localPreview?'acctLocalMailTitle':'acctCheckEmailTitle');$('#account-sent-hint').hidden=localPreview;$('#account-sent-text').textContent=t(localPreview?'acctLocalMailSent':key).replace('{email}',email);
  selectTab('signin');$('#signin-email').value=email;$('#account-sent').showModal();$('#account-sent-back').focus();
 }
 $('#account-sent-back').addEventListener('click',()=>$('#account-sent').close());
 $('#account-sent').addEventListener('close',()=>$('#signin-password').focus());
 const fail=error=>{
  say(error?.code==='rate'&&error.detail?.retryAfter?t('acctErrRateWait').replace('{minutes}',String(Math.ceil(error.detail.retryAfter/60))):App.accountMessage(error),true);
  if(error?.code==='email_not_confirmed')openAccess('resend',$('#signin-email').value,false);
  if(error?.code==='link_invalid'&&(linkPurpose==='verify'||linkPurpose==='reset'||resetToken)){openAccess(linkPurpose==='reset'||resetToken?'recover':'resend',null,false);resetToken='';show();}
  if(error?.code==='link_invalid'&&linkPurpose==='unsubscribe')say(t('acctUnsubscribeInvalid'),true);
  if(error?.code==='email_not_confirmed'||error?.code==='link_invalid'){status.focus();status.scrollIntoView({block:'nearest'});}
  if(error?.code==='session')show();
 };
 let busy=false,resetToken='',linkPurpose='',authBusy=false,authQueue=Promise.resolve();
 // Cloudflare Turnstile, loaded only here and only when a site key is configured.
 const turnstileKey=$('#account-page').dataset.turnstile||'',widgets={};
 let turnstileReady=null;
 function loadTurnstile(){
  if(!turnstileKey)return Promise.resolve(null);
  if(!turnstileReady)turnstileReady=new Promise((resolve)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=()=>resolve(window.turnstile||null);s.onerror=()=>resolve(null);document.head.append(s);});
  return turnstileReady;
 }
 async function renderTurnstile(name){
  const ts=await loadTurnstile();if(!ts||widgets[name]!==undefined)return;
  widgets[name]=ts.render('#'+name+'-turnstile',{sitekey:turnstileKey,action:name,appearance:'interaction-only',language:{fr:'fr',en:'en',zh:'zh-cn'}[App.language()]||'fr'});
 }
 function turnstileToken(name){const ts=window.turnstile;return ts&&widgets[name]!==undefined?ts.getResponse(widgets[name])||'':'';}
 function resetTurnstile(name){const ts=window.turnstile;if(ts&&widgets[name]!==undefined)ts.reset(widgets[name]);}
 async function guarded(form,fn){
  if(busy||authBusy)return;busy=true;const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(el=>el.disabled=true);form.setAttribute('aria-busy','true');
  try{await fn();}catch(error){fail(error);}finally{busy=false;controls.forEach(el=>el.disabled=false);form.removeAttribute('aria-busy');}
 }

 function selectTab(name){
  for(const tab of ['signin','signup','recover','resend']){const on=tab===name,button=$('#tab-'+tab);if(button){button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}$('#form-'+tab).hidden=!on;}
  $('.account-tabs').hidden=name==='resend';$('#account-access-help').hidden=name==='resend';
  if(['signup','recover','resend'].includes(name))renderTurnstile(name);
 }
 function openAccess(name,email,focus=true){
  const address=email||$('#resend-email').value||$('#signin-email').value||$('#signup-email').value||$('#recover-email').value;
  selectTab(name);const input=$('#'+(name==='resend'?'resend':name==='recover'?'recover':'signin')+'-email');if(address)input.value=address.trim();if(focus)input.focus();
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
  $('#account-searches').innerHTML=rows.map(r=>`<li><span><strong>${e(r.name)}</strong><small>${e(new Date(r.created_at).toLocaleDateString(document.documentElement.lang,{dateStyle:'medium',timeZone:'America/Toronto'}))}</small></span><span class="account-row-actions"><label class="account-switch"><input type="checkbox" data-search-alerts="${e(r.id)}"${r.alerts?' checked':''}><span>${e(t('acctAlerts'))}</span></label><a class="text-link" href="${e(App.shareURL(r.criteria||{}))}">${e(t('acctOpen'))}</a><button class="quiet-button" data-remove-search="${e(r.id)}">${e(t('acctRemove'))}</button></span></li>`).join('');
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
 $('#form-signup').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const email=$('#signup-email').value.trim();try{await account.signUp(email,$('#signup-password').value,App.language(),turnstileToken('signup'));}finally{resetTurnstile('signup');}f.reset();showSent('acctCheckEmailText',email);});});
 $('#form-recover').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const email=$('#recover-email').value.trim();try{await account.recover(email,App.language(),turnstileToken('recover'));}finally{resetTurnstile('recover');}f.reset();showSent('acctResetSentText',email);});});
 $('#account-resend-open').addEventListener('click',()=>{say('');openAccess('resend');});
 $('#resend-signin').addEventListener('click',()=>{say('');openAccess('signin');});
 $('#resend-recover').addEventListener('click',()=>{say('');openAccess('recover');});
 $('#form-resend').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const email=$('#resend-email').value.trim();try{await account.resendConfirmation(email,App.language(),turnstileToken('resend'));}finally{resetTurnstile('resend');}showSent('acctResendSent',email);});});
 $('#form-new-password').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{await account.resetPassword(resetToken,$('#new-password').value);resetToken='';f.reset();say(t('acctPasswordSaved'));show();});});
 $('#form-profile').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;guarded(f,async()=>{const p=await account.updateProfile({full_name:$('#profile-name').value,phone:$('#profile-phone').value,preferred_language:$('#profile-language').value,buyer_budget:$('#profile-budget').value,buyer_regions:$('#profile-regions').value,buyer_timeline:$('#profile-timeline').value});App.dropProfileCache();fillProfile(p||{});say(t('acctProfileSaved'));});});
 $('#account-signout').addEventListener('click',async()=>{await account.signOut();App.clearPersonalData();say(t('acctSignedOut'));show();});
 $('#account-member').addEventListener('change',async event=>{
  const box=event.target.closest('[data-search-alerts]');if(!box)return;
  box.disabled=true;try{const r=await account.setSearchAlerts(box.dataset.searchAlerts,box.checked);box.checked=r.alerts;say(t(r.alerts?'acctAlertsOn':'acctAlertsOff'));}catch(error){box.checked=!box.checked;fail(error);}finally{box.disabled=false;}
 });
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

 // Process email links on first load and same-page fragment navigation.
 // Capture and clear each fragment immediately; serialize requests without persisting tokens.
 function queueAuthLink(hash,initial=false){
  const parsed=MAVAccount.parseAuthHash(hash),purpose=/^#(verify|reset|unsubscribe)=/.exec(hash)?.[1]||'';
  if(!purpose&&!initial)return;
  if(purpose){try{history.replaceState(null,'',location.pathname+location.search);}catch{location.hash='';}}
  authQueue=authQueue.catch(()=>{}).then(async()=>{
   authBusy=true;$('#account-page').setAttribute('aria-busy','true');
   try{
    if($('#account-sent').open)$('#account-sent').close();
    linkPurpose=purpose;
    if(initial)selectTab('signin');
    if(purpose&&!parsed){fail({code:'link_invalid'});show();return;}
    if(parsed?.type==='unsubscribe'){try{const r=await account.unsubscribe(parsed.token);say(t('acctUnsubscribed').replace('{name}',r.name||''));}catch(error){fail(error);}try{await account.refresh();}catch{}show();return;}
    if(parsed?.type==='reset'){resetToken=parsed.token;say('');show('recovery');$('#new-password').focus();return;}
    if(parsed?.type==='verify'){
     say(t('acctLoading'));
     try{await account.verify(parsed.token);say(t('acctLinkConfirmed'));}
     catch(error){let session=null;if(error?.code==='link_invalid')try{session=await account.refresh();}catch{}if(session?.user)say(t('acctAlreadySignedIn'));else fail(error);}
    }else{try{await account.refresh();}catch(error){fail(error);}}
    show();
   }finally{authBusy=false;$('#account-page').removeAttribute('aria-busy');}
  });
 }
 window.addEventListener('hashchange',()=>queueAuthLink(location.hash));
 queueAuthLink(location.hash,true);
})();
