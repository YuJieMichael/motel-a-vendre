(function(){
  'use strict';
  const A=MAVAccount,C=MAVCore,lang=document.body.dataset.lang,c=MAVAccountCopy[lang],E=C.escapeHTML;
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const root=new URL('.',document.querySelector('script[src$="account.js"]').src),locale={fr:'fr-CA',en:'en-CA',zh:'zh-CN'}[lang];
  const t=(key,values={})=>Object.entries(values).reduce((text,[key,value])=>text.replaceAll('{'+key+'}',String(value)),c[key]);
  let catalogue=[],catalogueAvailable=true,storageAvailable=true,stored=null,project=A.blank(),services=[],saved=[],toastTimer;
  try{catalogue=C.validateCatalogue(typeof MAV_CATALOGUE==='undefined'?null:MAV_CATALOGUE).items;}catch{catalogueAvailable=false;$('#account-catalogue-notice').hidden=false;}
  function read(key,fallback){try{return localStorage.getItem(key)??fallback;}catch{storageAvailable=false;return fallback;}}
  function write(key,value){try{localStorage.setItem(key,value);return true;}catch{storageAvailable=false;$('#account-storage-notice').hidden=false;return false;}}
  stored=A.parseStored(read(A.storageKey,null));if(stored)project=stored.property;
  try{services=A.selectedServices(JSON.parse(read(A.serviceKey,'[]')));}catch{}
  function savedIDs(){try{const ids=JSON.parse(read('nord-saved','[]'));return Array.isArray(ids)?[...new Set(ids.filter(id=>typeof id==='string'&&catalogue.some(p=>p.id===id)))]:[];}catch{return [];}}
  saved=savedIDs();
  if(!storageAvailable)$('#account-storage-notice').hidden=false;
  function notify(text){clearTimeout(toastTimer);$('#account-toast').textContent=text;$('#account-toast').hidden=false;toastTimer=setTimeout(()=>$('#account-toast').hidden=true,4500);}
  function currentProject(){return A.normalize(Object.fromEntries(new FormData($('#account-project-form'))));}
  function fillProject(){for(const [key,value]of Object.entries(project))$('#project-'+key).value=value;$('#account-storage-consent').checked=!!stored;}
  function price(value){return value?new Intl.NumberFormat(locale,{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(Number(value)):c.pricePending;}
  function renderProject(){
    let draft;try{draft=currentProject();}catch{return;}
    const progress=A.completion(draft),hasDraft=!!(draft.city||draft.name);
    $$('[data-project-completion]').forEach(el=>el.textContent=t('complete',{count:progress}));$$('[data-project-percent]').forEach(el=>el.textContent=progress+' %');$('#project-progress').value=progress;$('#project-progress').textContent=progress+'%';
    $('[data-project-name]').textContent=draft.name|| (draft.city?c[draft.type]+' — '+draft.city:c.emptyProject);
    $('[data-project-description]').textContent=hasDraft?[draft.city,draft.region].filter(Boolean).join(' · '):c.emptyProjectNote;
    $('[data-project-status]').textContent=hasDraft?c.draft:c.noProject;
    $('[data-project-price]').textContent=price(draft.price);$('[data-project-rooms]').textContent=draft.rooms?t('rooms',{count:draft.rooms}):c.roomsPending;
    $$('.account-heading-action,.account-dossier-copy .account-text-link').forEach(el=>{el.firstChild.textContent=hasDraft?c.edit:c.create;});
  }
  function card(p,compact){
    const ref=C.reference(p),text=C.nameOf(p,lang);
    const href=new URL(lang+'/proprietes/'+ref+'/',root).href;
    const image=new URL(p.image,root).href;
    return `<article class="account-saved-property ${compact?'account-saved-compact':''}"><a class="account-saved-image" href="${href}" tabindex="-1" aria-hidden="true"><img src="${E(image)}" width="360" height="220" alt="" loading="lazy"></a><div class="account-saved-copy"><span class="account-kicker">${E(p.city)} · ${E(c.reference)} ${E(ref)}</span><h3><a href="${href}">${E(text)}</a></h3><p>${E(p.price===null?c.pricePending:price(String(p.price)))}</p><small>${E(p.illustrative?c.illustrative:c.realPhoto)}</small></div><button class="icon-button account-remove-saved" type="button" data-account-remove="${E(p.id)}" aria-label="${E(c.removeSaved+' — '+text)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></article>`;
  }
  const emptyIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  function renderSaved(){
    const items=saved.map(id=>catalogue.find(p=>p.id===id)).filter(Boolean);
    $$('[data-saved-count]').forEach(el=>el.textContent=String(items.length));
    $$('[data-account-shortlist]').forEach(el=>{
      const compact=el.dataset.accountShortlist==='compact';
      el.classList.toggle('account-saved-grid',!compact&&items.length>0);
      if(items.length)el.innerHTML=items.slice(0,compact?2:items.length).map(p=>card(p,compact)).join('');
      else el.innerHTML=`<div class="account-empty ${compact?'account-empty-compact':''}">${emptyIcon}${compact?'':'<h2>'+E(c.noSaved)+'</h2>'}<p>${E(catalogueAvailable?c.noSavedNote:c.cataloguePartial)}</p><a class="${compact?'account-text-link':'button button-dark'}" href="${new URL(lang+'/#listings',root).href}">${E(c.browse)} <span aria-hidden="true">→</span></a></div>`;
    });
  }
  function renderServices(){
    $$('[data-service-count]').forEach(el=>el.textContent=t('serviceSelected',{count:services.length}));
    $$('[data-account-service]').forEach(button=>{const selected=services.includes(button.dataset.accountService);button.setAttribute('aria-pressed',String(selected));button.closest('.account-service').classList.toggle('selected',selected);button.innerHTML=E(selected?c.removeService:c.addService)+'<span aria-hidden="true">'+(selected?'✓':'+')+'</span>';});
  }
  const dayParts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const today={year:Number(dayParts.find(p=>p.type==='year').value),month:Number(dayParts.find(p=>p.type==='month').value)-1,day:Number(dayParts.find(p=>p.type==='day').value)};
  let calendar={year:today.year,month:today.month},selectedDate='';
  function renderCalendar(){
    $('#account-calendar-month').textContent=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(calendar.year,calendar.month,1)));
    $('#account-calendar-grid').innerHTML=A.monthGrid(calendar.year,calendar.month).map(day=>{
      if(!day)return '<span class="account-calendar-blank" aria-hidden="true"></span>';
      const date=calendar.year+'-'+String(calendar.month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      const current=calendar.year===today.year&&calendar.month===today.month&&day===today.day;
      const label=new Intl.DateTimeFormat(locale,{dateStyle:'full',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
      return `<button type="button" data-calendar-date="${date}" aria-label="${E(label)}" aria-pressed="${date===selectedDate}"${current?' aria-current="date"':''}>${day}${current?'<span class="sr-only">'+E(c.calendarToday)+'</span>':''}</button>`;
    }).join('');
  }
  const intros={property:'propertyIntro',buyers:'buyerIntro',visits:'visitsIntro',offers:'offersIntro',documents:'documentsIntro',services:'servicesIntro',saved:'shortlistNote'};
  function section(focus=false){
    const key=A.readSection(location.hash);
    $$('[data-account-section]').forEach(el=>el.hidden=el.dataset.accountSection!==key);
    $$('[data-account-nav]').forEach(el=>{if(el.dataset.accountNav===key)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('[data-account-title]').textContent=key==='overview'?c.heading:c[key];
    $('[data-account-intro]').textContent=key==='overview'?c.intro:c[intros[key]];
    $('[data-account-breadcrumb]').textContent=c[key];
    $$('.language-switch [data-lang]').forEach(el=>{const destination=new URL(A.languagePath(el.dataset.lang)+(location.protocol==='file:'?'index.html':''),root);destination.hash=key==='overview'?'':key;el.href=destination.href;});
    if(focus)$('[data-account-title]').focus({preventScroll:true});
    document.title=c[key]+' | Motel à vendre';
  }
  function dialog(id){$('#'+id).showModal();}
  function download(){
    let content;try{content=A.exportDraft(currentProject(),services);}catch{$('#account-form-error').textContent=c.invalid;$('#account-form-error').hidden=false;return;}
    const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'})),a=document.createElement('a');
    a.href=url;a.download='motel-a-vendre-draft.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(c.exported);
  }
  fillProject();renderProject();renderSaved();renderServices();renderCalendar();section();
  if(stored)$('#account-save-state').textContent=t('lastSaved',{date:new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(new Date(stored.savedAt))});
  $('#account-project-form').addEventListener('input',()=>{renderProject();$('#account-save-state').textContent=c.unsaved;$('#account-form-success').hidden=true;});
  $('#account-project-form').addEventListener('submit',event=>{
    event.preventDefault();const error=$('#account-form-error'),success=$('#account-form-success');error.hidden=true;success.hidden=true;
    if(!$('#account-storage-consent').checked){error.textContent=c.saveConsent;error.hidden=false;$('#account-storage-consent').focus();return;}
    let value;try{project=currentProject();value=A.serialize(project,{consent:true});}catch{error.textContent=c.invalid;error.hidden=false;return;}
    if(!write(A.storageKey,value)){error.textContent=c.storageError;error.hidden=false;return;}
    stored=A.parseStored(value);success.textContent=c.savedOk;success.hidden=false;$('#account-save-state').textContent=t('lastSaved',{date:new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(new Date(stored.savedAt))});renderProject();
  });
  document.addEventListener('click',event=>{
    const go=event.target.closest('[data-account-go],[data-account-nav]');if(go){event.preventDefault();const key=go.dataset.accountGo||go.dataset.accountNav;if(location.hash!=='#'+key)history.pushState(null,'','#'+key);section(true);window.scrollTo({top:0,behavior:'instant'});return;}
    const service=event.target.closest('[data-account-service]');if(service){const id=service.dataset.accountService;const next=A.selectedServices(services.includes(id)?services.filter(x=>x!==id):[...services,id]);if(write(A.serviceKey,JSON.stringify(next))){services=next;renderServices();notify(c.selectionSaved);}return;}
    const remove=event.target.closest('[data-account-remove]');if(remove){const next=saved.filter(id=>id!==remove.dataset.accountRemove);if(write('nord-saved',JSON.stringify(next))){saved=next;renderSaved();}return;}
    const date=event.target.closest('[data-calendar-date]');if(date){selectedDate=date.dataset.calendarDate;renderCalendar();$('#account-calendar-grid [data-calendar-date="'+selectedDate+'"]').focus();$('#account-calendar-selection').textContent=t('selectedDate',{date:new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date(selectedDate+'T12:00:00Z'))});return;}
    if(event.target.closest('[data-account-close]')){event.target.closest('dialog').close();return;}
    const action=event.target.closest('[data-account-action]')?.dataset.accountAction;
    if(action==='access')dialog('account-access-dialog');
    else if(action==='privacy')dialog('account-privacy-dialog');
    else if(action==='clear')dialog('account-clear-dialog');
    else if(action==='close-dialog')event.target.closest('dialog').close();
    else if(action==='export')download();
    else if(action==='reload')location.reload();
    else if(action==='confirm-clear'){
      try{localStorage.removeItem(A.storageKey);}catch{$('#account-storage-notice').hidden=false;return;}
      stored=null;project=A.blank();fillProject();renderProject();$('#account-save-state').textContent='';$('#account-form-success').hidden=true;$('#account-form-error').hidden=true;$('#account-clear-dialog').close();notify(c.cleared);
    }else if(action==='previous-month'||action==='next-month'){
      const next=new Date(Date.UTC(calendar.year,calendar.month+(action==='next-month'?1:-1),1));
      if(next.getUTCFullYear()>=1900&&next.getUTCFullYear()<=2200){calendar={year:next.getUTCFullYear(),month:next.getUTCMonth()};renderCalendar();}
    }
  });
  addEventListener('hashchange',()=>section(true));
  addEventListener('storage',event=>{
    if(event.key==='nord-saved'){saved=savedIDs();renderSaved();}
    if(event.key===A.serviceKey){try{services=A.selectedServices(JSON.parse(event.newValue||'[]'));renderServices();}catch{}}
    if(event.key===A.storageKey&&event.newValue===null){stored=null;$('#account-storage-consent').checked=false;$('#account-save-state').textContent=c.unsaved;$('#account-form-success').hidden=true;}
  });
  $('#account-project-form button[type="submit"]').disabled=false;
  document.body.dataset.accountReady='true';
  requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));
})();
