const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const storage=read('src/CreativeWorkshop/services/storage.js');
const assets=read('src/opening/character-assets/registry.js');
const catalogs=read('src/opening/store/installed-catalogs.js');
const opening=read('Regular/开局.html');
for(const [name,source] of Object.entries({storage,assets,catalogs,opening})){
 assert.match(source,/reincarnation-workshop/,name+' shared database name');
 assert.match(source,/(DB_VERSION = 4|indexedDB\.open\('reincarnation-workshop', 4\))/,name+' database v4');
 for(const store of ['opening_assets','opening_store_catalogs']) assert.ok(source.includes(store),name+' knows '+store);
}
for(const source of [storage,assets,catalogs]){
 for(const store of ['auth','installed_projects','meta']) assert.ok(source.includes(store),'upgrade path preserves '+store);
}
console.log('PASS opening/workshop IndexedDB v4 contract');
