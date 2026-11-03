// Optional local preview. No dependencies. Binds only to this computer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const pageManifest=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json'),'utf8'));
const publicFiles=new Set([...pageManifest.map(p=>p.file),'styles.css','responsive.css','property.css','direction.css','app.js','i18n.js','lib/catalogue-core.js','lib/enquiry-core.js','lib/property-view.js','data/catalogue-data.js','data/site-config.js','robots.txt','sitemap.xml']);
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return;}
  let file;
  try{const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);if(pathname.endsWith('/'))pathname+='index.html';file=path.resolve(root,'.'+pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  const relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end('Forbidden');return;}
  const publicPath=relative.replaceAll(path.sep,'/');
  if(!publicFiles.has(publicPath)&&!/^assets\/[a-zA-Z0-9_/-]+\.(svg|png|jpe?g|webp)$/.test(publicPath)){res.writeHead(404);res.end('Not found');return;}
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  });
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is already in use. Set PORT to use another port.`:err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
