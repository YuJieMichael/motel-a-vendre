const fs=require('node:fs');
const path=require('node:path');
const core=require('../lib/catalogue-core.js');
const [input,output]=process.argv.slice(2);
if(!input||!output){console.error('Usage: node scripts/import-main.cjs <public-export.json> <review-output.json>\nReads a public published_listings export. Review the output before replacing data/catalogue.json. No network requests or database writes.');process.exitCode=1;}
else{
 const target=path.resolve(output);
 if(fs.existsSync(target))throw Error('Output already exists; choose a new review file.');
 const catalogue=core.importMainRows(JSON.parse(fs.readFileSync(path.resolve(input),'utf8')),new Date().toISOString());
 fs.writeFileSync(target,JSON.stringify(catalogue,null,2)+'\n',{flag:'wx'});
 console.log('Prepared',catalogue.items.length,'hotel/motel listings for local review. Missing photos use a labelled local placeholder.');
}
