const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const schemaPath=path.join(__dirname,'../src/opening/character-assets/schema.js');
let source=fs.readFileSync(schemaPath,'utf8')
  .replace(/export const /g,'const ')
  .replace(/export function /g,'function ');
source+='\n;globalThis.__api={createHereticAsset,sanitizeCombatBuild,stripDerivedFields};';
const ctx={structuredClone:global.structuredClone}; vm.runInNewContext(source,ctx);
const {createHereticAsset}=ctx.__api;
const character={
  姓名:'测试者',种族:'人类',身份:['守护者'],职业:{剑士:{类型:'战斗'}},层级:'Ⅲ',
  HP:10,HP_MAX:20,THP:3,EP:4,EP_MAX:8,空间币:999,凭证:{A:1},最终属性:{力量:999},
  道具:{药:{数量:9}},
  血统:{龙:{原始属性:{力量:'C'},真属性:{ATK:999},效果:{a:'b'}}},
  技能:{斩:{品质:'C',真属性:{ATK:999}}},
  装备:{剑:{品质:'C',真属性:{ATK:999}}},
  状态:{燃烧:{原始属性:{体质:'E'},真属性:{DEF:99}}},
  形态库:{龙化:{层级:'Ⅳ',真属性:{ATK:999},技能:{吐息:{真属性:{MATK:1}}}}},
  当前形态:{激活:true,名称:'龙化'}
};
const asset=createHereticAsset(character,{name:'测试异端',personality:'冷静',likes:'剑',background:'背景'});
assert.equal(asset.kind,'heretic');
assert.equal(asset.name,'测试异端');
assert.equal(asset.profile.性格,'冷静');
assert.equal(asset.build.种族,'人类');
assert.equal(asset.build.层级,'Ⅲ');
for(const forbidden of ['HP','HP_MAX','THP','EP','EP_MAX','空间币','凭证','最终属性','道具']) assert.equal(asset.build[forbidden],undefined,forbidden+' excluded');
const json=JSON.stringify(asset);
assert.ok(!json.includes('真属性'),'nested derived attributes excluded');
assert.ok(json.includes('原始属性'),'raw attributes retained');
assert.ok(json.includes('当前形态'),'current form retained');
console.log('PASS heretic sanitizer');
