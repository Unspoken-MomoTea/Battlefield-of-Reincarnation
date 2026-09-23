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
assert.match(html,/数量:\s*Math\.max\(1, Number\(i\.quantity \|\| 1\)\)/,'workshop item quantity is written to the backpack');
assert.match(html,/const cost=PARTNER_COST\[rank\]\|\|0;/,'installed opening partners use rank-based partner cost');
assert.match(html,/currentCoins=available-cost;/,'opening partner selection deducts the cost');
assert.match(html,/currentCoins\+=partnerCostPaid;/,'switching partner source refunds the previous partner cost');
assert.match(html,/id="opening-attributes-panel"/,'opening attribute panel can be locked for installed characters');
assert.match(html,/openingAttributePanelLocked\(\)/,'opening exposes installed-character attribute lock state');
assert.match(html,/characterMode==='library' && !!selectedOpeningCharacter/,'installed opening character locks manual attributes');
assert.match(html,/if \(openingAttributePanelLocked\(\)\) return;/,'manual attribute stepping is blocked for installed characters');
assert.match(html,/is-library-locked/,'opening shows locked attribute state when an installed character is selected');
assert.match(html,/const openingSummaryBuild = characterMode === 'library'/,'opening summary reads the selected installed character build');
assert.match(html,/openingBlood\.原始属性/,'opening summary uses installed bloodline attributes instead of locked manual points');
assert.match(html,/function applyOpeningDefaultPortraits\(\)/,'opening can seed default statusbar portraits');
assert.match(html,/samsara_reincarnator_portrait/,'opening writes the selected character cover to the player portrait key');
assert.match(html,/samsara_npc_portrait_/,'opening writes the selected partner cover to the NPC portrait key');
assert.match(html,/selectedOpeningCharacter\.avatarUrl/,'opening character portrait comes from the installed opening asset');
assert.match(html,/selectedOpeningPartner\.avatarUrl/,'opening partner portrait comes from the installed opening asset');
assert.match(html,/applyOpeningDefaultPortraits\(\);[\s\S]{0,1200}replaceMvuData/,'default portraits are seeded before the MVU refresh');
assert.match(html,/replaceMvuData[\s\S]{0,500}applyOpeningDefaultPortraits\(\);/,'default portraits are restored after the MVU refresh if the statusbar clears a fresh-game portrait');
console.log('PASS opening page compile and integration seams');
