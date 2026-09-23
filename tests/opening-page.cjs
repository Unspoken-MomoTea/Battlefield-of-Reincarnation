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
const journeyStart=html.indexOf('async function executeJourney()');
assert.ok(journeyStart>=0,'opening contains executeJourney');
const journey=html.slice(journeyStart);
const firstPortraitSeed=journey.indexOf('applyOpeningDefaultPortraits();');
const mvuReplace=journey.indexOf('await win.Mvu.replaceMvuData');
const secondPortraitSeed=journey.indexOf('applyOpeningDefaultPortraits();',mvuReplace);
assert.ok(firstPortraitSeed>=0 && mvuReplace>firstPortraitSeed,'default portraits are seeded before the MVU refresh');
assert.ok(secondPortraitSeed>mvuReplace,'default portraits are restored after the MVU refresh if the statusbar clears a fresh-game portrait');
console.log('PASS opening page compile and integration seams');


assert.doesNotMatch(html,/\+ 招募自定义伙伴/,'custom partner mode no longer adds a redundant collapsible header');
assert.doesNotMatch(html,/onclick="toggleCustomPartner\(\)"/,'custom partner mode has no obsolete accordion toggle');
assert.match(html,/class="custom-partner-direct" id="custom-partner-form"/,'custom partner form renders directly when its mode is selected');
assert.match(html,/if\(partnerMode==='custom'\) updatePartnerBuildBtnState\(\);/,'direct custom partner form initializes its price state');

assert.match(html,/types\.push\(\{ v:'__workshop__', label:'创意工坊' \}\)/,'installed workshop store content gets an explicit sidebar entry');
assert.match(html,/activeSubCategory === '__workshop__'/,'workshop sidebar entry shows installed workshop goods regardless of builtin subtype');
assert.match(html,/function availableRarities\(\)/,'opening derives rarity tabs from actual visible merchandise');
assert.match(html,/if \(rarities\.length === 1\) activeRarity = rarities\[0\];/,'single available rarity does not keep redundant all-level tabs');
assert.match(html,/DB\.rarityList\.filter\(r => present\.has\(r\)\)/,'rarity buttons omit levels with no merchandise');
assert.match(html,/opening_store_catalogs/,'opening loads installed workshop store catalogs');
assert.match(html,/DB\.equipments\.some\(e=>e\.id===i\.id\)/,'selected workshop equipment is exported through the normal equipment path');
assert.match(html,/DB\.items\.some\(e=>e\.id===i\.id\)/,'selected workshop items are exported through the normal item path');
assert.match(html,/DB\.skills\.some\(e=>e\.id===i\.id\)/,'selected workshop skills are exported through the normal skill path');
