// Keep previously indexed addresses useful after consolidating public pages.
const consolidated={fr:{equipe:'/fr/#listings',vendre:'/fr/guide-achat/#vendre'},en:{team:'/en/#listings',sell:'/en/buying-guide/#vendre'},zh:{team:'/zh/#listings',sell:'/zh/buying-guide/#vendre'}};
function legacyTarget(pathname){
 const match=/^\/(fr|en|zh)\/([^/]+)(?:\/(?:index\.html)?)?$/.exec(pathname);
 return match&&Object.hasOwn(consolidated[match[1]],match[2])?consolidated[match[1]][match[2]]:null;
}
module.exports={legacyTarget};
