(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MAVAccount=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const sections=['overview','property','buyers','visits','offers','documents','services','saved'];
  const serviceIds=['photos','video','pricing','listing','visits','offers'];
  const storageKey='mav-account-draft-v1',serviceKey='mav-account-services-v1';
  const blank=()=>({name:'',city:'',region:'',type:'motel',rooms:'',price:'',season:'unknown'});
  const limits={name:100,city:100,region:100,type:12,rooms:4,price:10,season:12};
  function normalize(input,{required=false}={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid');
    const result=blank();
    for(const [key,max] of Object.entries(limits)){
      const value=input[key]??result[key];
      if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error('invalid');
      result[key]=value.trim();
    }
    if(!['motel','hotel','inn'].includes(result.type)||!['unknown','year-round','seasonal'].includes(result.season))throw Error('invalid');
    if(result.rooms&&(!/^\d+$/.test(result.rooms)||Number(result.rooms)<1||Number(result.rooms)>5000))throw Error('invalid');
    if(result.price&&(!/^\d+$/.test(result.price)||Number(result.price)>1000000000))throw Error('invalid');
    if(required&&!result.city)throw Error('city');
    return result;
  }
  function selectedServices(input){return Array.isArray(input)?serviceIds.filter(id=>input.includes(id)):[];}
  function completion(input){const value=normalize(input);return Math.round([!!value.city,!!value.name,!!value.rooms,!!value.price].filter(Boolean).length/4*100);}
  function parseStored(raw){
    if(!raw)return null;
    try{const value=JSON.parse(raw);if(value?.version!==1||value.consent!==true||!Number.isFinite(Date.parse(value.savedAt)))return null;return {version:1,consent:true,savedAt:value.savedAt,property:normalize(value.property,{required:true})};}catch{return null;}
  }
  function serialize(property,{consent=false,now=new Date()}={}){
    if(consent!==true)throw Error('consent');
    return JSON.stringify({version:1,consent:true,savedAt:now.toISOString(),property:normalize(property,{required:true})});
  }
  function exportDraft(property,services=[]){return JSON.stringify({format:'motel-a-vendre-local-draft',version:1,property:normalize(property),services:selectedServices(services)},null,2)+'\n';}
  function readSection(hash){const value=String(hash||'').replace(/^#/,'');return sections.includes(value)?value:'overview';}
  function languagePath(lang){if(!['fr','en','zh'].includes(lang))throw Error('language');return lang+'/'+(lang==='fr'?'espace-client':'account')+'/';}
  function monthGrid(year,month){
    if(!Number.isInteger(year)||!Number.isInteger(month)||year<1900||year>2200||month<0||month>11)throw Error('month');
    const offset=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
    const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i<offset||i>=offset+count?null:i-offset+1);
  }
  return {sections,serviceIds,storageKey,serviceKey,blank,normalize,selectedServices,completion,parseStored,serialize,exportDraft,readSection,languagePath,monthGrid};
});
