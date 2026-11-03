'use strict';
const Core=MAVCore,Enquiry=MAVEnquiry,BRAND={name:'Motel à vendre',domain:'motelavendre.ca'},config=MAV_SITE;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],e=Core.escapeHTML;
const SITE_ROOT=new URL('.',document.querySelector('script[src$="app.js"]').src),asset=src=>new URL(src,SITE_ROOT).href;
const page=document.body.dataset.page||'home',isHome=page==='home',pageReference=document.body.dataset.reference||'';
let catalogue;try{catalogue=Core.validateCatalogue(MAV_CATALOGUE);}catch{catalogue={mode:'demo',items:[],error:true,updatedAt:''};}
const properties=catalogue.items,ids=properties.map(p=>p.id),regions=[...new Set(properties.map(p=>p.region))].sort((a,b)=>a.localeCompare(b,'fr'));
const storageKeys={language:'nord-language',saved:'nord-saved',draft:'nord-draft',recent:'mav-recent',view:'mav-view',accountDraft:'mav-account-draft-v1',accountServices:'mav-account-services-v1'};
function readLocal(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function storedIds(key){const value=readLocal(key,[]);return Array.isArray(value)?[...new Set(value.filter(id=>ids.includes(id)))]:[];}
const byReference=ref=>properties.find(p=>Core.reference(p).toUpperCase()===String(ref).toUpperCase());
let saved=new Set(storedIds(storageKeys.saved)),recent=storedIds(storageKeys.recent).slice(0,12);
const preferred=readLocal(storageKeys.language,'fr'),isRoot=location.pathname===SITE_ROOT.pathname||location.pathname===SITE_ROOT.pathname+'index.html';
const initialLanguage=isRoot&&Core.languages.includes(preferred)?preferred:document.body.dataset.lang||'fr';
let state=Core.readRoute(location.hash,regions,initialLanguage),language=state.lang,activeProperty=pageReference?byReference(pageReference):null;
if(!location.hash.includes('?'))state.view=readLocal(storageKeys.view,'grid')==='list'?'list':'grid';
let latestDraft=null,enquiryKind='buyer',enquiryProperty=null,enquiryPurpose='info',formKey='',sent=false,busy=false,attempt={body:'',id:''},toastTimer,lastAppliedURL='';
let galleryProperty=null,galleryIndex=0;
const locale=()=>({fr:'fr-CA',en:'en-CA',zh:'zh-CN'}[language]);
const t=(key,values={})=>Object.entries(values).reduce((s,[a,b])=>s.replaceAll('{'+a+'}',String(b)),translations[language][values.count===1&&translations[language][key+'One']?key+'One':key]??translations.fr[key]??key);
const money=value=>value===null?t('toConfirm'):new Intl.NumberFormat(locale(),{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(value);
const area=value=>value===null?t('toConfirm'):new Intl.NumberFormat(locale(),{maximumFractionDigits:2}).format(value)+' '+(language==='zh'?'英亩':'acres');
const roomSummary=p=>p.rooms===null?p.roomsText[language]||t('toConfirm'):t('roomCount',{count:p.rooms});
const seasonLabel=p=>t(p.season==='year-round'?'yearRound':p.season==='seasonal'?'seasonal':'unknownSeason');
const icons={bookmark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg>',bed:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19V6m18 13V9H3m0 7h18M6 9V5h5v4m2 0V5h5v4"/></svg>'};
const paths={fr:{team:'equipe',seller:'vendre',guide:'guide-achat',account:'espace-client'},en:{team:'team',seller:'sell',guide:'buying-guide',account:'account'},zh:{team:'team',seller:'sell',guide:'buying-guide',account:'account'}};
function pageURL(lang=language,kind='home',reference=''){
 const route=lang+'/'+(kind==='property'?'proprietes/'+reference+'/':kind==='home'?'':paths[lang][kind]+'/');
 return new URL(route+(location.protocol==='file:'?'index.html':''),SITE_ROOT).href;
}
function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
function updateMetadata(){const title=activeProperty?Core.nameOf(activeProperty,language)+' | '+BRAND.name:page==='guide'?t('guideTitle'):page==='team'?t('teamPage')+' | '+BRAND.name:page==='seller'?t('ownerPage')+' | '+BRAND.name:t('pageTitle');document.title=title;}
function applyLanguage(next){
 language=next;state.lang=next;document.documentElement.lang={fr:'fr-CA',en:'en-CA',zh:'zh-Hans'}[next];
 $$('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$$('[data-placeholder]').forEach(el=>el.placeholder=t(el.dataset.placeholder));$$('[data-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.aria)));
 $$('.language-switch [data-lang]').forEach(el=>{if(el.dataset.lang===next)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 $('.main-nav')?.setAttribute('aria-label',t('navigation'));$('.language-switch').setAttribute('aria-label',t('language'));
 $('.preview-strip [data-i18n=demo]').textContent=t(catalogue.mode==='main-snapshot'?'snapshotBanner':'demo');
 const date=catalogue.updatedAt?new Date(catalogue.updatedAt).toLocaleDateString(locale(),{timeZone:'America/Toronto'}):t('toConfirm');
 if(isHome){
  $('#region').replaceChildren(...['all',...regions].map(value=>{const o=document.createElement('option');o.value=value;o.textContent=value==='all'?t('allRegions'):value;return o;}));
  $('.search-section').setAttribute('aria-label',t('searchLabel'));$('.filter-tabs').setAttribute('aria-label',t('propertyTypes'));$('.library-tabs').setAttribute('aria-label',t('browseAll'));$('.view-switch').setAttribute('aria-label',t('viewLabel'));
  $('#inventory-note').textContent=catalogue.mode==='main-snapshot'?t('snapshotNote',{date}):t('inventoryNote',{count:properties.length});
  renderHero();
 }
 updateMetadata();
}
function renderHero(){
 const p=properties[0],img=$('.hero-photo'),button=$('.hero-property');
 if(!button)return;
 if(img){img.src=asset(p?.image||'assets/property-unavailable.svg');img.alt=p?Core.nameOf(p,language):t('catalogueError');}
 button.disabled=!p;if(p){button.dataset.detail=p.id;$('.hero-property-main small').textContent=p.region+', QC';$('.hero-property-main strong').textContent=Core.nameOf(p,language);$('.hero-property-main>span').textContent=t('rooms')+': '+roomSummary(p)+' · '+t(p.type);}
 else{$('.hero-property-main strong').textContent=t('catalogueError');$('.hero-property-main small').textContent='';$('.hero-property-main>span').textContent='';}
 $('.hero-metric-price').textContent=p?money(p.price):t('toConfirm');$('.hero-metric-reference').textContent=p?Core.reference(p):'—';
 $('.photo-counter').textContent=`${p?'01':'00'} / ${String(properties.length).padStart(2,'0')}`;
 $('.image-caption').textContent=p&&img?t(p.illustrative?(p.real?'illustrativePhotoShort':'imageCaption'):'propertyPhoto'):t('partialImage');installImageFallbacks();
}
function controlsToState(){return Core.normalizeRoute({...state,region:$('#region').value,type:$('#type').value,budget:$('#budget').value,rooms:$('#rooms-filter').value,season:$('#season-filter').value,q:$('#keyword').value,sort:$('#sort').value},regions,language);}
function syncControls(){if(!isHome)return;for(const [id,key]of [['region','region'],['type','type'],['budget','budget'],['rooms-filter','rooms'],['season-filter','season'],['keyword','q'],['sort','sort']])$('#'+id).value=state[key];}
function writeRoute(){if(!isHome)return;const hash=Core.routeHash({...state,property:''},regions);try{history.replaceState({},'',hash);}catch{location.hash=hash;}lastAppliedURL=location.href;}
function filtersChanged(){state=controlsToState();writeRoute();renderListings();}
function resetFilters(){state=Core.normalizeRoute({lang:language,view:state.view},regions,language);syncControls();writeRoute();renderListings();}
function setLibrary(tab){if(!isHome){location.href=pageURL(language)+'#listings?lang='+language+'&tab='+tab;return;}state.tab=tab;writeRoute();renderListings();$('#listings').scrollIntoView({block:'start'});}
function card(p){
 return MAVViews.card(p,{lang:language,copy:translations[language],asset,href:pageURL(language,'property',Core.reference(p)),saved:saved.has(p.id),index:properties.indexOf(p)+1});
}
function renderListings(){
 if(!isHome){renderSaved();return;}
 const result=Core.selectListings(properties,state,[...saved],recent);$('#listing-grid').innerHTML=result.map(card).join('');$('#listing-grid').classList.toggle('list-view',state.view==='list');$('#catalogue-error').hidden=!catalogue.error;$('#empty-state').hidden=!!catalogue.error||result.length>0;
 const emptySaved=state.tab==='saved'&&!saved.size,emptyRecent=state.tab==='recent'&&!recent.length;
 $('#empty-state h3').textContent=t(emptySaved?'noSaved':emptyRecent?'emptyRecent':'emptyTitle');$('#empty-state p').textContent=t(emptySaved?'noSavedDescription':emptyRecent?'emptyRecentDescription':'emptyDescription');$('#results-count').textContent=t(state.tab==='saved'?'savedResults':state.tab==='recent'?'recentResults':'results',{count:result.length});
 $$('[data-type]').forEach(el=>{const active=el.dataset.type===state.type;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});$$('[data-library]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.library===state.tab)));$$('[data-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.view===state.view)));
 $('#library-saved-count').textContent=saved.size;$('#recent-count').textContent=recent.length;$('#all-count').textContent=properties.length;
 renderSaved();installImageFallbacks();
}
function renderSaved(){
 document.body.classList.toggle('has-saved',saved.size>0);
 $('.saved-count').textContent=saved.size;$('#saved-nav').setAttribute('aria-pressed',String(isHome&&state.tab==='saved'));$('#compare-tray').hidden=!saved.size;$('#compare-count').textContent=t('compareCount',{count:saved.size});$('#compare-open').disabled=saved.size<2;
 if(activeProperty)$$('.property-save').forEach(el=>{el.setAttribute('aria-pressed',String(saved.has(activeProperty.id)));el.textContent=t(saved.has(activeProperty.id)?'unsave':'save');});
}
function installImageFallbacks(){
 $$('img:not(.brand-mark)').forEach(img=>{img.onerror=()=>{if(img.id==='gallery-image'){img.src=asset('assets/property-unavailable.svg');img.alt=t('partialImage');return;}if(img.closest('.hero-image-panel'))$('.image-caption').textContent=t('partialImage');const fallback=document.createElement('span');fallback.className='photo-fallback';fallback.textContent=t('partialImage');fallback.setAttribute('role','img');fallback.setAttribute('aria-label',img.alt);img.replaceWith(fallback);};});
}
function toggleSave(id){const restoreFocus=isHome&&document.activeElement?.dataset.save===id,was=saved.has(id);was?saved.delete(id):saved.add(id);const ok=writeLocal(storageKeys.saved,[...saved]);renderListings();if(restoreFocus)($(`[data-save="${id}"]`)||$('#listing-grid [data-save]')||$('#empty-reset')).focus({preventScroll:true});notify(t(ok?(was?'removedToast':'savedToast'):'storageError'));}
function showCompare(){
 const list=properties.filter(p=>saved.has(p.id));if(list.length<2){notify(t('compareMinimum'));return;}
 const row=(label,fn)=>`<tr><th scope="row">${e(label)}</th>${list.map(p=>`<td>${fn(p)}</td>`).join('')}</tr>`;
 $('#compare-content').innerHTML=`<div class="compare-scroll"><table class="compare-table"><thead><tr><th scope="col">${e(t('propertyType'))}</th>${list.map(p=>`<th scope="col"><img src="${e(asset(p.image))}" alt="${e(Core.nameOf(p,language))}">${e(Core.nameOf(p,language))}</th>`).join('')}</tr></thead><tbody>${row(t('price'),p=>e(money(p.price)))}${row(t('location'),p=>e(p.city))}${row(t('rooms'),p=>e(roomSummary(p)))}${row(t('land'),p=>e(area(p.acres)))}${row(t('seasonLabel'),p=>e(seasonLabel(p)))}${row(t('details'),p=>`<a class="text-link" href="${e(pageURL(language,'property',Core.reference(p)))}">${e(t('details'))} ↗︎</a>`)}</tbody></table></div><p class="privacy-note">${e(t('detailNote'))}</p>`;
 installImageFallbacks();$('#compare-dialog').showModal();
}
function showShare(p=null){
 const url=p?location.protocol==='file:'?Core.routeHash({lang:language,property:Core.reference(p)},regions):pageURL(language,'property',Core.reference(p)):Core.shareURL(pageURL(language),{...state,property:'',tab:'all'},regions);
 $('#share-url').value=url;$('#share-feedback').textContent='';$('#share-dialog').showModal();
}
function mainEnquiryURL(kind,p,purpose){const url=new URL(language+'/',config.mainOrigin+'/');url.hash=kind==='seller'?'vendre':p?'acheter?listing='+encodeURIComponent(Core.reference(p))+(purpose==='documents'?'&intent=nda':''):'acheter?propertyType=hotel-motel&intent=hotel-acquisition';return url.href;}
function setFormError(message){const error=$('#form-error');error.textContent=message;error.hidden=!message;if(message)error.scrollIntoView({block:'nearest'});}
function showEnquiry(kind,id='',purpose='info'){
 if(busy)return;
 const next=kind+':'+id;
 enquiryKind=kind;enquiryProperty=properties.find(p=>p.id===id)||null;enquiryPurpose=purpose;sent=false;
 $('#enquiry-title').textContent=t(kind==='seller'?'sellerFormTitle':'buyerTitle');$('#enquiry-kicker').textContent=enquiryProperty?Core.nameOf(enquiryProperty,language):BRAND.name;
 if(formKey!==next){
  $('#enquiry-form').reset();const draft=readLocal(storageKeys.draft,null);
  if(draft&&draft.kind===kind&&draft.propertyId===id){for(const key of ['name','email','phone','message'])$('#enquiry-'+key).value=typeof draft[key]==='string'?draft[key]:'';$('#enquiry-region').value=typeof draft.region==='string'?draft.region:'';$('#enquiry-owner-city').value=typeof draft.region==='string'?draft.region:'';$('#enquiry-budget').value=Number.isFinite(draft.budget)?draft.budget:'';$('#enquiry-timeline').value=['exploring','0-3','3-6','6+'].includes(draft.timeline)?draft.timeline:'';$('#enquiry-service').value=['broker','hybrid'].includes(draft.service)?draft.service:'';$('#enquiry-contact-time').value=draft.contactTime||'';}
 }
 formKey=next;$('#enquiry-property').value=id;$('#enquiry-purpose').value=purpose;
 $('#buyer-criteria').hidden=kind!=='buyer';$('#buyer-criteria').disabled=kind!=='buyer';$('#seller-criteria').hidden=kind!=='seller';$('#seller-criteria').disabled=kind!=='seller';$('.enquiry-purpose').hidden=kind==='seller';$('#enquiry-message').placeholder=t(kind==='seller'?'sellerMessage':'buyerMessage');
 $('#enquiry-consent').setCustomValidity('');$('#enquiry-service').setCustomValidity('');
 const available=Enquiry.canSubmit(config,location.origin)&&(!enquiryProperty||enquiryProperty.real);
 $('#enquiry-consent').closest('label').hidden=!available;
 $('#intake-unavailable').hidden=available;$('#main-enquiry-link').href=mainEnquiryURL(kind,enquiryProperty,purpose);$('#send-enquiry').disabled=!available;$('#send-enquiry').hidden=config.publicationMode==='production'&&!available;$('#main-enquiry-link').classList.toggle('button',config.publicationMode==='production');$('#main-enquiry-link').classList.toggle('button-dark',config.publicationMode==='production');
 recordMetric('enquiry_open',enquiryProperty?.reference||'');$('#enquiry-form').hidden=false;$('#enquiry-success').hidden=true;setFormError('');$('#enquiry-dialog').showModal();
}
function collectDraft(){
 for(const id of ['enquiry-name','enquiry-message','enquiry-consent','enquiry-service'])$('#'+id).setCustomValidity('');
 $('#enquiry-name').setCustomValidity($('#enquiry-name').value.trim()?'':t('invalidBlank'));
 if(!$('#enquiry-form').reportValidity())return null;
 return {kind:enquiryKind,propertyId:enquiryProperty?.id||'',name:$('#enquiry-name').value.trim(),email:$('#enquiry-email').value.trim(),phone:$('#enquiry-phone').value.trim(),message:$('#enquiry-message').value.trim(),budget:enquiryKind==='buyer'&&$('#enquiry-budget').value!==''?Number($('#enquiry-budget').value):null,region:$(enquiryKind==='buyer'?'#enquiry-region':'#enquiry-owner-city').value.trim(),timeline:enquiryKind==='buyer'?$('#enquiry-timeline').value:'',service:enquiryKind==='seller'?$('#enquiry-service').value:'',purpose:$('#enquiry-purpose').value,contactTime:$('#enquiry-contact-time').value.trim(),language,savedAt:new Date().toISOString(),sourceSite:BRAND.domain};
}
function showSuccess(real){
 sent=real;$('#enquiry-form').hidden=true;$('#intake-unavailable').hidden=true;$('#enquiry-success').hidden=false;$('#enquiry-success-title').textContent=t(real?'sent':'draftSaved');$('#enquiry-success-note').textContent=t(real?'sentText':'draftSavedText');if(real){let receipt=$('#enquiry-receipt');if(!receipt){receipt=document.createElement('p');receipt.id='enquiry-receipt';receipt.className='receipt-code';$('#enquiry-success-note').after(receipt);}receipt.textContent='ID: '+attempt.id;}$('#download-draft').hidden=real;$('#new-enquiry').textContent=t(real?'close':'newEnquiry');(real?$('#new-enquiry'):$('#download-draft')).focus();
}
function saveDraft(){const draft=collectDraft();if(!draft)return;latestDraft=draft;if(!writeLocal(storageKeys.draft,draft)){setFormError(t('storageError'));return;}showSuccess(false);}
async function submitEnquiry(event){
 event.preventDefault();if(busy)return;const draft=collectDraft();if(!draft)return;
 if(!$('#enquiry-consent').checked){$('#enquiry-consent').setCustomValidity(t('sendConsentNeeded'));$('#enquiry-consent').reportValidity();return;}
 if(enquiryKind==='seller'&&!draft.service){$('#enquiry-service').setCustomValidity(t('serviceError'));$('#enquiry-service').reportValidity();return;}
 draft.analyticsSource=analyticsSource();const signature=JSON.stringify({...draft,savedAt:''});if(signature!==attempt.body)attempt={body:signature,id:crypto.randomUUID()};
 let payload;try{payload=Enquiry.buildPayload(draft,{property:enquiryProperty,language,requestId:attempt.id,purpose:draft.purpose,service:draft.service});}catch(error){setFormError(t(error.code==='service'?'serviceError':'sendError'));return;}
 busy=true;setFormError('');$('#send-enquiry').disabled=true;$('#save-local-draft').disabled=true;$('#enquiry-form').querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);$('#send-enquiry span').textContent=t('sending');$('#enquiry-form').setAttribute('aria-busy','true');
 try{const result=await Enquiry.send(config,payload,{origin:location.origin,signal:AbortSignal.timeout(20000)});showSuccess(!result.preview);if(result.preview){$('#enquiry-success-title').textContent=t('previewChecked');$('#enquiry-success-note').textContent=t('previewCheckedText');$('#download-draft').hidden=true;}}catch(error){setFormError(t(error.code==='rate'?'sendRate':error.code==='unavailable'?'sendUnavailable':'sendError'));}
 finally{busy=false;$('#send-enquiry').disabled=!Enquiry.canSubmit(config,location.origin);$('#save-local-draft').disabled=false;$('#enquiry-form').querySelectorAll('input,textarea,select').forEach(el=>el.disabled=false);$('#send-enquiry span').textContent=t('send');$('#enquiry-form').removeAttribute('aria-busy');}
}
function downloadDraft(){
 if(!latestDraft)return;const d=latestDraft,p=properties.find(p=>p.id===d.propertyId);
 const lines=[BRAND.name,BRAND.domain,t('notSent'),'',`${t('propertyId')}: ${p?Core.reference(p):'—'}`];if(p)lines.push(`${t('propertyContext')}: ${Core.nameOf(p,language)} | ${p.city} | ${money(p.price)}`);
 const timeframe={exploring:'exploring','0-3':'months3','3-6':'months6','6+':'monthsLater'},purposes={info:'purposeInfo',viewing:'purposeViewing',documents:'purposeDocuments'};
 lines.push(t('purposeLabel')+': '+t(purposes[d.purpose]||'purposeInfo'));
 for(const [key,label]of [['name','name'],['email','email'],['phone','phone'],['budget','buyerBudget'],['region',d.kind==='seller'?'ownerCity':'buyerRegion'],['timeline','buyerTimeline'],['contactTime','contactTime'],['service','serviceLabel']]){let value=d[key];if(key==='budget'&&value!==null&&value!==undefined)value=money(value)+' CAD';else if(key==='timeline'&&timeframe[value])value=t(timeframe[value]);else if(key==='service'&&value)value=t(value==='broker'?'serviceBroker':'serviceHybrid');lines.push(t(label)+': '+(value===null||value===undefined||value===''?'—':value));}
 lines.push('',t('message')+':',d.message);const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`motel-a-vendre-${d.kind}-${p?Core.reference(p):'project'}-draft.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);notify(t('downloadReady'));
}
function renderGallery(){
 const photos=galleryProperty.photos.length?galleryProperty.photos:[galleryProperty.image];galleryIndex=(galleryIndex+photos.length)%photos.length;
 $('#gallery-image').src=asset(photos[galleryIndex]);$('#gallery-image').alt=Core.nameOf(galleryProperty,language)+' — '+t('photoNumber',{index:galleryIndex+1});$('#gallery-title').textContent=Core.nameOf(galleryProperty,language);$('#gallery-counter').textContent=(galleryIndex+1)+' / '+photos.length;
 let note=$('#gallery-illustration-note');if(!note){note=document.createElement('p');note.id='gallery-illustration-note';note.className='gallery-source-note';$('#gallery-counter').after(note);}note.hidden=!galleryProperty.illustrative;note.textContent=galleryProperty.illustrative?t('illustrativePhoto'):'';
 $('#gallery-previous').disabled=photos.length<2;$('#gallery-next').disabled=photos.length<2;
 $('#gallery-thumbnails').innerHTML=photos.map((src,i)=>`<button data-gallery-index="${i}" aria-label="${e(t('photoNumber',{index:i+1}))}" aria-pressed="${i===galleryIndex}"><img src="${e(asset(src))}" alt="" loading="lazy"></button>`).join('');installImageFallbacks();
}
function openGallery(index){if(!activeProperty)return;galleryProperty=activeProperty;galleryIndex=Number(index)||0;renderGallery();$('#gallery-dialog').showModal();}
function restoreRoute(){
 if(!isHome||lastAppliedURL===location.href)return;lastAppliedURL=location.href;state=Core.readRoute(location.hash,regions,language);
 if(state.property){const p=byReference(state.property);if(p){location.href=pageURL(state.lang,'property',Core.reference(p));return;}$('#route-notice').hidden=false;$('#route-notice').textContent=t('propertyUnavailable');}
 applyLanguage(state.lang);syncControls();renderListings();
}
$$('.language-switch [data-lang]').forEach(button=>button.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();const lang=button.dataset.lang;writeLocal(storageKeys.language,lang);location.href=pageURL(lang,page,activeProperty?Core.reference(activeProperty):'')+(isHome?Core.routeHash({...state,lang,property:''},regions):'');}));
if(isHome){
 $('#search-form').addEventListener('submit',event=>{event.preventDefault();state.tab='all';filtersChanged();$('#listings').scrollIntoView({block:'start'});});
 for(const id of ['region','type','budget','rooms-filter','season-filter','sort'])$('#'+id).addEventListener('change',filtersChanged);
 $('#keyword').addEventListener('input',filtersChanged);$('#reset-filters').addEventListener('click',resetFilters);$('#empty-reset').addEventListener('click',resetFilters);
 $$('[data-type]').forEach(b=>b.addEventListener('click',()=>{$('#type').value=b.dataset.type;filtersChanged();}));$$('[data-library]').forEach(b=>b.addEventListener('click',()=>setLibrary(b.dataset.library)));$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;writeLocal(storageKeys.view,state.view);writeRoute();renderListings();}));
 $('#share-search').addEventListener('click',()=>showShare());$('#reload-catalogue').addEventListener('click',()=>location.reload());
}
$('#saved-nav').addEventListener('click',()=>setLibrary(isHome&&state.tab==='saved'?'all':'saved'));$('#view-saved').addEventListener('click',()=>setLibrary('saved'));$('#compare-open').addEventListener('click',showCompare);
$$('.seller-trigger').forEach(b=>b.addEventListener('click',()=>showEnquiry('seller')));$$('.buyer-trigger').forEach(b=>b.addEventListener('click',()=>showEnquiry('buyer')));
document.addEventListener('click',event=>{
 const target=event.target.closest('button,a[data-gallery-open]');if(!target)return;
 if(target.dataset.detail){const p=properties.find(p=>p.id===target.dataset.detail);if(p)location.href=pageURL(language,'property',Core.reference(p));}
 if(target.dataset.save)toggleSave(target.dataset.save);
 if(target.dataset.close&&!busy)$('#'+target.dataset.close).close();
 if(target.dataset.enquire!==undefined)showEnquiry('buyer',target.dataset.enquire,target.dataset.purpose||'info');
 if(target.dataset.shareProperty)showShare(properties.find(p=>p.id===target.dataset.shareProperty));
 if(target.dataset.galleryOpen!==undefined){event.preventDefault();openGallery(target.dataset.galleryOpen);}
 if(target.dataset.galleryIndex!==undefined){galleryIndex=Number(target.dataset.galleryIndex);renderGallery();}
});
$('#gallery-previous').addEventListener('click',()=>{galleryIndex--;renderGallery();});$('#gallery-next').addEventListener('click',()=>{galleryIndex++;renderGallery();});
$('#gallery-dialog').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();galleryIndex+=event.key==='ArrowLeft'?-1:1;renderGallery();}});
document.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const modal=$$('dialog[open]').at(-1);if(!modal)return;const controls=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([type=hidden]),select,textarea')].filter(el=>el.getClientRects().length&&!el.disabled);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(!modal.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
$$('dialog').forEach(dialog=>{dialog.addEventListener('click',event=>{if(event.target!==dialog||busy)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});});
$('#enquiry-form').addEventListener('submit',submitEnquiry);$('#save-local-draft').addEventListener('click',saveDraft);$('#download-draft').addEventListener('click',downloadDraft);$('#new-enquiry').addEventListener('click',()=>{if(sent){$('#enquiry-dialog').close();return;}$('#enquiry-success').hidden=true;$('#enquiry-form').hidden=false;$('#enquiry-name').focus();});
for(const id of ['enquiry-name','enquiry-consent','enquiry-service'])$('#'+id).addEventListener('input',event=>event.target.setCustomValidity(''));
$('#privacy-trigger').addEventListener('click',()=>$('#privacy-dialog').showModal());$('#clear-data').addEventListener('click',()=>{if(!confirm(t('clearDrafts')))return;try{Object.values(storageKeys).forEach(key=>localStorage.removeItem(key));saved=new Set();recent=[];latestDraft=null;if(isHome)resetFilters();else renderSaved();notify(t('dataCleared'));}catch{notify(t('storageError'));}});
$('#copy-share-url').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#share-url').value);$('#share-feedback').textContent=t('linkCopied');}catch{$('#share-url').focus();$('#share-url').select();$('#share-feedback').textContent=t('linkReady');}});
window.addEventListener('popstate',restoreRoute);window.addEventListener('hashchange',restoreRoute);
const metricNote=document.createElement('p');metricNote.dataset.i18n='privacyMetrics';$('#privacy-dialog').append(metricNote);
applyLanguage(language);syncControls();renderListings();installImageFallbacks();
if(activeProperty){recent=Core.addRecent(recent,activeProperty.id,ids);writeLocal(storageKeys.recent,recent);renderSaved();}
if(page==='property'&&!activeProperty){const notice=document.createElement('div');notice.className='catalogue-error';notice.setAttribute('role','alert');notice.innerHTML=`<h2>${e(t('catalogueError'))}</h2><p>${e(t('catalogueErrorText'))}</p><button type="button" class="button button-outline">${e(t('reload'))}</button>`;notice.querySelector('button').addEventListener('click',()=>location.reload());$('#property-page').prepend(notice);$$('#property-page button').forEach(button=>{if(!notice.contains(button))button.disabled=true;});$$('#property-page a[data-gallery-open]').forEach(link=>delete link.dataset.galleryOpen);}
if(isHome)restoreRoute();
document.body.dataset.ready='true';

// Only bounded aggregate events; never send names, email, messages, URLs or query strings.
function analyticsSource(){try{const u=new URL(location.href),v=u.searchParams.get("utm_source")||new URLSearchParams(location.hash.split("?")[1]||"").get("utm_source");if(v)return ["google","bing","facebook","instagram","linkedin","wechat","xiaohongshu","direct"].includes(v.toLowerCase())?v.toLowerCase():"other";if(!document.referrer)return "direct";const h=new URL(document.referrer).hostname;if(h===location.hostname)return sessionStorage.getItem("mav-source")||"direct";if(/(^|\.)google\./.test(h))return "google";if(/(^|\.)bing\.com$/.test(h))return "bing";return "other";}catch{return "unknown";}}
function recordMetric(event,reference=""){let qa=false;try{if(new URLSearchParams(location.search).get('qa')==='1')sessionStorage.setItem('mav-qa','1');qa=sessionStorage.getItem('mav-qa')==='1';}catch{}if(qa||!config.metricsEndpoint||!["motelavendre.ca","www.motelavendre.ca"].includes(location.hostname)||navigator.doNotTrack==="1"||navigator.globalPrivacyControl===true)return;try{fetch(config.metricsEndpoint,{method:"POST",headers:{"Content-Type":"application/json",apikey:config.publishableKey},body:JSON.stringify({event,language,source:analyticsSource(),reference}),credentials:"omit",referrerPolicy:"no-referrer",keepalive:true}).catch(()=>{});}catch{}}
try{sessionStorage.setItem("mav-source",analyticsSource());}catch{}
recordMetric(page==="property"?"property_view":page==="guide"?"guide_view":"page_view",activeProperty?.reference||"");
