const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../Regular/开局.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
assert.ok(scripts.length>0,'opening page should contain scripts');
for(const [index,source] of scripts.entries()){
  try{ new Function(source); }
  catch(error){ throw new Error('opening inline script #'+(index+1)+' failed to compile: '+error.message); }
}
for(const id of ['character-mode-custom','character-mode-library','opening-character-library','partner-mode-library','partner-mode-custom','opening-partner-library']){
  assert.match(html,new RegExp('id=["\\\']'+id+'["\\\']'),'opening UI contains '+id);
}
assert.match(html,/indexedDB\.open\('reincarnation-workshop', 4\)/,'opening uses shared workshop database');
assert.match(html,/openingCharacterBuild/,'opening consumes installed character build');
assert.match(html,/partnerIsCompleteAsset/,'opening distinguishes complete installed partner');
assert.match(html,/opening_store_catalogs/,'opening reads installed workshop store catalogs');
assert.match(html,/workshop:' \+ row\.sourceProjectId \+ ':' \+ sourceId/,'workshop store ids are namespaced');
assert.match(html,/Promise\.all\(\[loadOpeningAssets\(\), loadOpeningStoreCatalogs\(\)\]\)/,'opening loads assets and store catalogs together');
assert.match(html,/openingDataReady[\s\S]*finally\(\(\) => init\(\)\)/,'opening waits for installed assets before init');
assert.match(html,/structuredClone\(openingCharacterBuild\.装备 \|\| \{\}\)[\s\S]*\.\.\.equipObj/,'opening character keeps base equipment and merges store purchases');
assert.match(html,/structuredClone\(openingCharacterBuild\.技能 \|\| \{\}\)[\s\S]*\.\.\.skillObj/,'opening character keeps base skills and merges store purchases');
assert.doesNotMatch(html,/\$\('grid-partner'\)\.innerHTML/,'legacy partner grid is no longer accessed');
console.log('PASS opening page compile and integration seams');
