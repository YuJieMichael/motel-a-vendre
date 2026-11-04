// Builds a separate publication candidate. Does not deploy, change DNS or write to the backend.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),release=path.join(root,'release'),stage=path.join(release,'stage'),publicDir=path.join(release,'public');
function cleanOwned(dir){if(fs.existsSync(release)&&fs.lstatSync(release).isSymbolicLink())throw Error('Release parent must not be a link');if(![stage,publicDir].includes(dir)||!path.resolve(dir).startsWith(root+path.sep)||fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Unsafe release directory');if(fs.existsSync(dir))fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});}
async function prepare({direct=false}={}){
 const config=vm.runInNewContext(fs.readFileSync(path.join(root,'data/site-config.js'),'utf8')+';MAV_SITE');
 if(config.siteOrigin!=='https://motelavendre.ca')throw Error('Verify the canonical domain before preparing a release');
 const accounts=!!(config.account&&config.account.enabled===true);
 if(accounts&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(config.account.d1DatabaseId||''))throw Error('Set account.d1DatabaseId (wrangler d1 create motel-a-vendre-accounts) before enabling accounts');
 if(accounts&&!String(config.account.privacyContact||'').trim())throw Error('Québec Law 25: set account.privacyContact (person in charge of personal information) before enabling accounts');
 const directEnabled=direct||config.enquiryMode==='direct'||config.directEnquiries===true;
 let intakeCheck={enabled:directEnabled,verification:'not-run',reason:directEnabled?'Existing enquiry endpoint enabled by site configuration; no live request made during this build.':'Direct sending is disabled; local drafts remain available.'};
 if(direct&&process.env.MAV_INTAKE_CHECK==='offline'){intakeCheck={enabled:true,verification:'not-run',offlineSkipped:true,productionEnquiriesSent:0,reason:'Live intake check explicitly skipped in an offline local build.'};}
 else if(direct){
  const preflight=await fetch(config.endpoint,{method:'OPTIONS',headers:{Origin:config.siteOrigin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,apikey'},signal:AbortSignal.timeout(12000)});
  if(preflight.status!==204||preflight.headers.get('access-control-allow-origin')!==config.siteOrigin)throw Error('Production enquiry origin is not yet allowed. Verify the existing enquiry backend before enabling direct sending.');
  const validation=await fetch(config.endpoint,{method:'POST',headers:{Origin:config.siteOrigin,'Content-Type':'application/json',apikey:config.publishableKey},body:'{}',signal:AbortSignal.timeout(12000)});
  if(validation.status!==400||validation.headers.get('access-control-allow-origin')!==config.siteOrigin)throw Error('Non-writing enquiry validation did not pass');
  intakeCheck={enabled:true,verification:'non-writing-live-check',preflight:preflight.status,rejectedInvalidBody:validation.status,productionEnquiriesSent:0};
 }
 cleanOwned(stage);cleanOwned(publicDir);
 for(const dir of ['templates','data'])fs.mkdirSync(path.join(stage,dir),{recursive:true});
 fs.copyFileSync(path.join(root,'templates/site.html'),path.join(stage,'templates/site.html'));
 fs.copyFileSync(path.join(root,'data/catalogue.json'),path.join(stage,'data/catalogue.json'));
 const translations=vm.runInNewContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8')+';translations');
 const copy=require('../deployment/publication-copy.cjs');
 for(const lang of ['fr','en','zh'])Object.assign(translations[lang],copy[lang]);
 if(directEnabled){for(const lang of ['fr','en','zh'])translations[lang].realFormNote=vm.runInNewContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8')+';translations')[lang].realFormNote;}
 fs.writeFileSync(path.join(stage,'i18n.js'),'const translations = '+JSON.stringify(translations,null,2)+';\n');
 config.publicationMode='production';if(directEnabled)config.allowedOrigins=[...new Set([...config.allowedOrigins,config.siteOrigin,'https://www.motelavendre.ca'])];
 fs.writeFileSync(path.join(stage,'data/site-config.js'),'const MAV_SITE = '+JSON.stringify(config,null,2)+';\n');
 const generated=spawnSync(process.execPath,[path.join(root,'scripts/generate-pages.cjs'),'--indexable'],{env:{...process.env,MAV_RELEASE_ROOT:stage},encoding:'utf8'});
 if(generated.status!==0)throw Error(generated.stderr||generated.stdout);
 const pages=JSON.parse(fs.readFileSync(path.join(stage,'data/page-manifest.json'),'utf8'));
 for(const p of pages){const dest=path.join(publicDir,p.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(stage,p.file),dest);}
 for(const file of ['i18n.js','data/site-config.js','robots.txt','sitemap.xml']){const dest=path.join(publicDir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(stage,file),dest);}
 for(const file of ['styles.css','responsive.css','property.css','direction.css','app.js','account.js','lib/catalogue-core.js','lib/enquiry-core.js','lib/property-view.js','lib/account-core.js','lib/account-view.js','data/catalogue-data.js','admin/index.html','admin/admin.js','admin/admin.css']){const dest=path.join(publicDir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
 const catalogue=JSON.parse(fs.readFileSync(path.join(root,'data/catalogue.json'),'utf8'));
 const images=new Set(['assets/logo.svg','assets/brand-mark.svg','assets/favicon.svg','assets/property-unavailable.svg','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable-512.png','favicon.ico','apple-touch-icon.png','manifest.webmanifest','googleb6173475a8eadbeb.html',...catalogue.items.flatMap(p=>[p.image,...p.photos]),...Object.values(config.coverOverrides||{})]);
 for(const file of images){const dest=path.join(publicDir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
 fs.writeFileSync(path.join(publicDir,'404.html'),'<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page introuvable | Motel à vendre</title><link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/direction.css"></head><body class="not-found-page"><main><a class="not-found-brand" href="/fr/">Motel à vendre</a><p class="eyebrow">404</p><h1>Cette adresse reste à trouver.</h1><p>Page introuvable. Retrouvez les propriétés disponibles.</p><nav aria-label="Language"><a class="button button-dark" href="/fr/">Voir les propriétés · FR</a><a class="button button-outline" href="/en/">View properties · EN</a><a class="button button-outline" href="/zh/">查看在售物业 · 中文</a></nav></main></body></html>');
 const hashes=[...new Set(pages.map(p=>fs.readFileSync(path.join(publicDir,p.file),'utf8').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).map(json=>"'sha256-"+crypto.createHash('sha256').update(json).digest('base64')+"'"))];
 const workerSource=fs.readFileSync(path.join(root,'deployment/worker.mjs'),'utf8').replace('/* RELEASE_JSON_LD_HASHES */[]',JSON.stringify(hashes)).replaceAll('../lib/','./runtime/');
 fs.writeFileSync(path.join(release,'worker.mjs'),workerSource);
 fs.copyFileSync(path.join(root,'deployment/entry.mjs'),path.join(release,'entry.mjs'));
 const policy="default-src 'self'; script-src 'self' "+hashes.join(' ')+"; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' "+new URL(config.endpoint).origin+"; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
 const headerLines=['/*','  X-Content-Type-Options: nosniff','  X-Frame-Options: DENY','  Referrer-Policy: strict-origin-when-cross-origin','  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()','  Cache-Control: public, max-age=0, must-revalidate','  Content-Security-Policy: '+policy];
 headerLines.push('/admin/*','  X-Robots-Tag: noindex, nofollow');if(headerLines.some(line=>line.length>2000))throw Error('Review CSP header size before publishing');fs.writeFileSync(path.join(publicDir,'_headers'),headerLines.join('\n')+'\n');
 const runtime=path.join(release,'runtime');fs.mkdirSync(runtime,{recursive:true});
 for(const file of ['catalogue-core.js','property-view.js','account-view.js','page-renderer.cjs','guide-content.js','site-routes.cjs'])fs.copyFileSync(path.join(root,'lib',file),path.join(runtime,file));
 const inputs='export const template='+JSON.stringify(fs.readFileSync(path.join(root,'templates/site.html'),'utf8'))+';\nexport const translations='+JSON.stringify(translations)+';\nexport const site='+JSON.stringify(config)+';\nexport const fallback='+JSON.stringify(catalogue)+';\n';
 fs.writeFileSync(path.join(release,'runtime-inputs.mjs'),inputs);
 for(const file of ['live-catalogue.mjs','live-worker.mjs','account-api.mjs','account-alerts.mjs','admin-api.mjs'])fs.writeFileSync(path.join(release,file),fs.readFileSync(path.join(root,'deployment',file),'utf8').replaceAll('../lib/','./runtime/'));
 const wrangler={name:'motel-a-vendre',main:'./entry.mjs',compatibility_date:'2026-10-19',workers_dev:false,preview_urls:false,routes:[{pattern:'motelavendre.ca',custom_domain:true},{pattern:'www.motelavendre.ca',custom_domain:true}],assets:{directory:'./public',binding:'ASSETS',run_worker_first:['/','/index.html','/fr*','/en*','/zh*','/data/catalogue-data.js','/api/*','/sitemap.xml','/assets/centris/*','/googleb6173475a8eadbeb.html'],html_handling:'auto-trailing-slash',not_found_handling:'404-page'}};
 if(accounts){
  if(!/^[^<>@\s]+(?: [^<>@]+)* <[^<>@\s]+@mail\.motelavendre\.ca>$/.test(config.account.mailFrom||''))throw Error('Set account.mailFrom to an address on the verified Resend domain mail.motelavendre.ca');
  wrangler.d1_databases=[{binding:'ACCOUNTS',database_name:'motel-a-vendre-accounts',database_id:config.account.d1DatabaseId,migrations_dir:'../d1/migrations'}];
  // MAIL_FROM is public configuration; RESEND_API_KEY stays a Worker secret set in the dashboard.
  wrangler.vars={MAIL_FROM:config.account.mailFrom};
  wrangler.triggers={crons:['17 13 * * *']};
 }
 fs.writeFileSync(path.join(release,'wrangler.jsonc'),JSON.stringify(wrangler,null,2)+'\n');
 function walk(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(path.join(dir,f.name),prefix+f.name+'/'):[prefix+f.name]);}
 const files=walk(publicDir).sort().map(file=>({file,bytes:fs.statSync(path.join(publicDir,file)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(publicDir,file))).digest('hex')}));
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(release,file))).digest('hex');
 const manifest={version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,preparedAt:new Date().toISOString(),deployed:false,canonicalOrigin:config.siteOrigin,worker:wrangler.name,entrySha256:digest('entry.mjs'),workerSha256:digest('worker.mjs'),configSha256:digest('wrangler.jsonc'),intake:intakeCheck,accounts,propertySnapshot:catalogue.updatedAt,pages:pages.length,files};
 fs.writeFileSync(path.join(release,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({version:manifest.version,pages:pages.length,publicFiles:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),directEnquiries:directEnabled,deployed:false}));return manifest;
}
if(require.main===module)prepare({direct:process.argv.includes('--direct-enquiries')||vm.runInNewContext(fs.readFileSync(path.join(root,'data/site-config.js'),'utf8')+';MAV_SITE').directEnquiries===true}).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={prepare};
