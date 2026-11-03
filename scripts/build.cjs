const fs=require('node:fs'),path=require('node:path');
require('./build-data.cjs');require('./generate-pages.cjs');require('./check.cjs');
const root=path.resolve(__dirname,'..'),dist=path.resolve(root,'dist');
if(path.relative(root,dist)!=='dist'||path.basename(dist)!=='dist')throw Error('Unsafe build target');
// This verified project-local directory contains generated public assets only.
if(fs.existsSync(dist))fs.rmSync(dist,{recursive:true,force:true});
const pages=JSON.parse(fs.readFileSync(path.join(root,'data/page-manifest.json'),'utf8'));
const files=[...pages.map(p=>p.file),'styles.css','responsive.css','property.css','direction.css','app.js','i18n.js','lib/catalogue-core.js','lib/enquiry-core.js','lib/property-view.js','data/catalogue-data.js','data/site-config.js','robots.txt','sitemap.xml'];
function assets(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())assets(file);else if(/^[\w-]+\.(png|jpe?g|webp|svg)$/.test(entry.name))files.push(file);}}assets('assets');
for(const file of files){const target=path.join(dist,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
console.log('Public build prepared:',files.length,'files in',dist);
console.log('Authoring JSON, import tools, tests and server source are excluded. No deployment performed.');
