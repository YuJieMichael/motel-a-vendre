const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../lib/catalogue-core.js'),V=require('../lib/property-view.js');
const sourceRoot=path.resolve(__dirname,'..');
const root=process.env.MAV_RELEASE_ROOT?path.resolve(process.env.MAV_RELEASE_ROOT):sourceRoot;
if(root!==sourceRoot&&root!==path.join(sourceRoot,'release/stage'))throw Error('Unexpected release staging directory');
const template=fs.readFileSync(path.join(root,'templates/site.html'),'utf8');
const translations=vm.runInNewContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8')+';translations');
const catalogue=C.validateCatalogue(JSON.parse(fs.readFileSync(path.join(root,'data/catalogue.json'),'utf8')));
const site=vm.runInNewContext(fs.readFileSync(path.join(root,'data/site-config.js'),'utf8')+';MAV_SITE');
const indexable=process.argv.includes('--indexable');
if(indexable&&catalogue.mode!=='main-snapshot')throw Error('Demo catalogues cannot be indexed.');
const renderer=require('../lib/page-renderer.cjs')({template,translations,catalogue,site,indexable});
const {publicPath,languages}=renderer;
const date=new Date(catalogue.updatedAt).toISOString().slice(0,10);
function make(...args){const {html,...page}=renderer.make(...args);const target=path.join(root,page.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,html);return page;}
const pages=[make('fr','home',null,{rootEntry:true})];
for(const lang of languages){pages.push(make(lang));pages.push(make(lang,'team'));pages.push(make(lang,'seller'));pages.push(make(lang,'guide'));for(const p of catalogue.items)pages.push(make(lang,'property',p));}
fs.writeFileSync(path.join(root,'data/page-manifest.json'),JSON.stringify(pages,null,2)+'\n');
const urls=pages.filter(p=>p.file!=='index.html').map(p=>`<url><loc>${site.siteOrigin+'/'+p.route}</loc>${languages.map(lang=>`<xhtml:link rel="alternate" hreflang="${lang==='zh'?'zh-Hans':lang+'-CA'}" href="${site.siteOrigin+'/'+publicPath(lang,p.kind,p.reference)}"/>`).join('')}<lastmod>${date}</lastmod></url>`).join('\n');
fs.writeFileSync(path.join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
fs.writeFileSync(path.join(root,'robots.txt'),indexable?`User-agent: *\nAllow: /\nSitemap: ${site.siteOrigin}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n');
console.log('Pre-rendered',pages.length,'pages (three languages); indexing',indexable?'enabled':'disabled for local review');
module.exports={pages,publicPath};
