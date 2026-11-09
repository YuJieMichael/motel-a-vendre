// Optional local preview. No dependencies. Binds only to this computer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Routes from './lib/site-routes.cjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.ico':'image/x-icon','.webmanifest':'application/manifest+json; charset=utf-8'};
const pageManifest=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json'),'utf8'));
const publicFiles=new Set([...pageManifest.map(p=>p.file),'styles.css','responsive.css','property.css','direction.css','app.js','i18n.js','lib/catalogue-core.js','lib/enquiry-core.js','lib/property-view.js','lib/account-core.js','lib/account-view.js','account.js','admin/index.html','admin/admin.js','admin/admin.css','data/catalogue-data.js','data/site-config.js','robots.txt','sitemap.xml','favicon.ico','apple-touch-icon.png','manifest.webmanifest']);
// Local account API: same handler as production, SQLite file instead of D1, emails printed here.
const site=vm.runInNewContext(fs.readFileSync(path.join(root,'data/site-config.js'),'utf8')+';MAV_SITE');
let accountApi=null,accountEnv=null,adminApi=null,enquiryIntake=null;
if(site.account&&site.account.enabled===true){
  const {createAccountApi}=await import('./deployment/account-api.mjs'),{openLocalD1}=await import('./deployment/local-d1.mjs');
  fs.mkdirSync(path.join(root,'.local'),{recursive:true});
  accountEnv={ACCOUNTS:openLocalD1(path.join(root,'.local/accounts.sqlite'),path.join(root,'d1/migrations')),ACCOUNT_MAIL_LOG:m=>console.log(`\n[local email] to ${m.to}: ${m.subject}\n${m.text.replace('https://motelavendre.ca',`http://127.0.0.1:${port}`)}\n`)};
  accountApi=createAccountApi({siteOrigin:'https://motelavendre.ca'});
  // Staff workspace: local D1 staff, accounts, listings and settings.
  const {createAdminApi}=await import('./deployment/admin-api.mjs');adminApi=createAdminApi({site});
  const {createEnquiryIntake}=await import('./deployment/enquiry-intake.mjs');const intake=createEnquiryIntake({site});enquiryIntake=(request,env)=>intake(request,env,{local:true});
}
async function handleAccount(req,res,api=accountApi){
  const max=req.url.startsWith('/api/admin/listings/')?2200000:16384;
  const chunks=[];for await(const c of req){chunks.push(c);if(chunks.reduce((n,x)=>n+x.length,0)>max){res.writeHead(413);res.end();return;}}
  const body=['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks);
  const response=await api(new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,body}),accountEnv);
  for(const [k,v] of response.headers)if(k!=='set-cookie')res.setHeader(k,v);
  const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
  res.writeHead(response.status);
  res.end(Buffer.from(await response.arrayBuffer()));
}
const server=http.createServer((req,res)=>{
  if(enquiryIntake&&req.url==='/api/enquiry'){handleAccount(req,res,enquiryIntake).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});return;}
  if(accountEnv&&req.url==='/api/events'){import('./deployment/metrics.mjs').then(m=>handleAccount(req,res,m.recordEvent)).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});return;}
  if(accountEnv&&req.url.startsWith('/assets/listings/')){import('./deployment/listings.mjs').then(async m=>{const rel=req.url.slice(1).split('?')[0],o=m.PHOTO_PATH.test(rel)?await m.photoStore(accountEnv).get(m.photoKey(rel)):null;if(!o){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':o.contentType});res.end(Buffer.from(o.bytes));}).catch(()=>{res.writeHead(500);res.end();});return;}
  if(adminApi&&req.url.startsWith('/api/admin/')){handleAccount(req,res,adminApi).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});return;}
  if(accountApi&&req.url.startsWith('/api/account/')){handleAccount(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  let requestURL;try{requestURL=new URL(req.url,'http://127.0.0.1:'+port);}catch{res.writeHead(400);res.end('Bad request');return;}
  const oldTarget=Routes.legacyTarget(requestURL.pathname);
  if(oldTarget){const target=new URL(oldTarget,requestURL);target.search=requestURL.search;res.writeHead(301,{Location:target.pathname+target.search+target.hash,'Cache-Control':'no-cache','X-Robots-Tag':'noindex, nofollow'});res.end();return;}
  let file;
  try{const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);if(pathname.endsWith('/'))pathname+='index.html';file=path.resolve(root,'.'+pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end('Forbidden');return;}
  const publicPath=relative.replaceAll(path.sep,'/');
  if(!publicFiles.has(publicPath)&&!/^assets\/[a-zA-Z0-9_/-]+\.(svg|png|jpe?g|webp)$/.test(publicPath)){res.writeHead(404);res.end('Not found');return;}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    const accountPage=pageManifest.some(p=>p.kind==='account'&&p.file===publicPath);
    const localHTML=accountPage?Buffer.from(fs.readFileSync(file,'utf8').replace('id="account-page"','id="account-page" data-local-preview="true"').replace(/ data-turnstile="[^"]*"/,'')):null;
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':localHTML?localHTML.length:stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow'});
    if(req.method==='HEAD'){res.end();return;}
    if(localHTML){res.end(localHTML);return;}
    const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is already in use. Set PORT to use another port.`:err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
