const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script/辅助计算脚本.js', 'utf8');
function extract(name) {
    const start = source.indexOf('function '+name+'(');
    assert.ok(start >= 0);
    const brace = source.indexOf('{', start);
    let depth = 1, end = brace + 1;
    while (depth && end < source.length) {
        if (source[end] === '{') depth++;
        if (source[end] === '}') depth--;
        end++;
    }
    return source.slice(start, end);
}
const context = vm.createContext({});
vm.runInContext(`const TIER_ORDER=['F','E','D','C','B','A','S','SS','SSS'];
const LIFE_TIER_ORDER=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
const ATTR_NAMES=['力量','敏捷','体质','精神','魅力'];
const DERIVED_ATTRS=['ATK','DEF','MATK','MDEF','AP'];
const ROMAN_TO_QUALITY=Object.fromEntries(LIFE_TIER_ORDER.map((r,i)=>[r,TIER_ORDER[i]]));
const QUALITY_STRING_SET=Object.fromEntries(TIER_ORDER.map(q=>[q,1]));
const QUALITY_TIER_SET=QUALITY_STRING_SET;
${['normalizeTier','normalizeLifeTier','tierRank','isQualityString','applyNewNpcDifficulty'].map(extract).join('\n')}`, context);
const apply = context.applyNewNpcDifficulty;
const make = () => ({好感度:-10,是否队友:false,层级:'Ⅳ',血统:{血:{品质:'F',原始属性:{力量:'C',敏捷:'D',体质:'C'}}},技能:{术:{品质:'F'}},装备:{剑:{品质:'F',原始属性:{ATK:'C'}}},状态:{功法:{品质:'F',原始属性:{力量:'D'}},临时:{品质:'F',原始属性:{敏捷:-5}}},形态库:{变身:{层级:'Ⅰ',原始属性:{力量:'C',体质:'D'},技能:{招式:{品质:'F'}}}}});
const run = mode => {
    const stat={设置:{难度:mode},关系列表:{新:make()}};
    apply(stat,{关系列表:{}});
    return stat;
};
const base=make();
const experience=run('体验').关系列表.新;
assert.equal(experience.状态.额外强化,undefined);
assert.notDeepEqual(experience.血统,base.血统,'体验 must align bloodlines with the NPC life tier');
assert.notDeepEqual(experience.技能,base.技能,'体验 must align skills with the NPC life tier');
assert.deepEqual(experience.装备,base.装备,'体验 must not mutate equipment');
assert.notDeepEqual(experience.状态.功法,base.状态.功法,'体验 must align existing statuses with the NPC life tier');
assert.notDeepEqual(experience.形态库,base.形态库,'体验 must align forms with the NPC life tier');
const extraExpectations = {
    正常: { quality: 'C', attrs: ['ATK','DEF','MATK','MDEF','AP'], attrTier: 'E' },
    困难: { quality: 'C', attrs: ['力量','敏捷','体质','精神','魅力','ATK','DEF','MATK','MDEF','AP'], attrTier: 'C' },
    挑战: { quality: 'B', attrs: ['力量','敏捷','体质','精神','魅力','ATK','DEF','MATK','MDEF','AP'], attrTier: 'B' }
};
for (const mode of ['正常','困难','挑战']) {
    const stat=run(mode);
    const npc=stat.关系列表.新;
    const boost=npc.状态.额外强化;
    const extra=extraExpectations[mode];
    assert.equal(boost.品质,extra.quality,mode+' uses the expected extra status quality');
    assert.equal(boost.类型,'增益',mode);
    assert.equal(boost.持续,'持续',mode);
    assert.equal(boost.来源,'难度机制',mode);
    assert.equal(boost.效果,'全属性强化',mode);
    assert.deepEqual(Object.keys(boost.原始属性),extra.attrs,mode+' uses the expected extra status attributes');
    for (const [attr,value] of Object.entries(boost.原始属性)) {
        assert.equal(value,extra.attrTier,mode+' '+attr);
    }
    assert.notDeepEqual(npc.血统,base.血统,mode+' must upgrade bloodlines');
    assert.notDeepEqual(npc.技能,base.技能,mode+' must upgrade skills');
    assert.deepEqual(npc.装备,base.装备,mode+' must not mutate equipment');
    assert.notDeepEqual(npc.形态库,base.形态库,mode+' must upgrade forms');
    assert.notDeepEqual(npc.状态.功法,base.状态.功法,mode+' must upgrade existing statuses');
    assert.equal(npc.状态.临时.原始属性.敏捷,-5,mode+' must preserve numeric temporary modifiers');
    const snapshot=JSON.stringify(stat);
    apply(stat,{关系列表:{}});
    assert.equal(JSON.stringify(stat),snapshot,mode+' must not inject the fixed status twice');
}
for (const before of [undefined,{关系列表:{新:make()}}]) {
    const stat={设置:{难度:'挑战'},关系列表:{新:make()}};
    apply(stat,before);
    assert.deepEqual(stat.关系列表.新,make());
}
const top={设置:{难度:'挑战'},关系列表:{新:make()}};
top.关系列表.新.层级='Ⅸ';
apply(top,{关系列表:{}});
assert.equal(top.关系列表.新.状态.额外强化.品质,'SSS');
for (const value of Object.values(top.关系列表.新.状态.额外强化.原始属性)) assert.equal(value,'B');
for (const npc of [{...make(),好感度:0},{...make(),好感度:50},{...make(),是否队友:true}]) {
    const stat={设置:{难度:'挑战'},关系列表:{新:npc}};
    const original=JSON.stringify(stat);
    apply(stat,{关系列表:{}});
    assert.equal(JSON.stringify(stat),original);
}
assert.ok(!source.includes('难度已应用'));
console.log('PASS: difficulty extra status rules, enemy filtering, replay and caps');

function extractConst(name) {
    const start=source.indexOf('const '+name+' =');
    assert.ok(start >= 0,name);
    const end=source.indexOf(';',start);
    assert.ok(end >= 0,name);
    return source.slice(start,end+1);
}
const attrContext=vm.createContext({console});
const attrConstants=[
    'ATTR_NAMES','DERIVED_ATTRS','CHECK_ATTRS','BONUS_KEYS','TIER_MODIFIER_CAPS','TIER_ORDER',
    'attr5_keys_const','LIFE_TIER_ORDER','ROMAN_TO_QUALITY','QUALITY_TIER_SET','LIFE_TIER_RANGE',
    'QUALITY_STRING_SET','GROW_QUALITY_RANGE','EQUIP_QUALITY_RANGE',
    'REDUCTION_CAP','ALPHA','LOG_DEN','TIER_DEF_SCALE'
].map(extractConst).join('\n');
const attrFunctions=[
    'isQualityString','qualitySegValue','attrSegRange','qualityToValue','resolveRealAttr','safeNum',
    'normalizeTier','normalizeLifeTier','tierRank','calcModifier','getActiveForm','getEffectiveLifeTier','syncNpcGroupThp',
    'recalcCharacter','calcReduction'
].map(extract).join('\n');
vm.runInContext(`${attrConstants}\n${attrFunctions}\nMath.random=()=>0;`,attrContext);
const recalc=attrContext.recalcCharacter;
const character = ({charTier='Ⅲ',formTier=null}={}) => ({
    层级:charTier,HP:1,EP:1,最终属性:{},
    当前形态:{激活:!!formTier,名称:formTier?'形态':''},
    血统:{高阶血统:{品质:'S',原始属性:{力量:'F',ATK:'F'}}},
    装备:{高阶装备:{品质:'S',类型:1,状态:1,原始属性:{敏捷:'F',DEF:'F'}}},
    状态:{高阶状态:{品质:'S',类型:'增益',原始属性:{体质:'F',MATK:'F'}}},
    形态库:formTier?{形态:{层级:formTier,原始属性:{精神:'F',MDEF:'F'}}}:{}
});

const capped=character();
recalc(capped,'角色',null);
assert.equal(capped.血统.高阶血统.真属性.力量,13,'bloodline five-stat uses the character D-tier range');
assert.equal(capped.装备.高阶装备.真属性.敏捷,11,'equipment five-stat uses the character D-tier range');
assert.equal(capped.状态.高阶状态.真属性.体质,13,'status five-stat uses the character D-tier range');
assert.equal(capped.血统.高阶血统.真属性.ATK,1001,'bloodline derived stat keeps the component S-tier range');
assert.equal(capped.装备.高阶装备.真属性.DEF,551,'equipment derived stat keeps the component S-tier range');
assert.equal(capped.状态.高阶状态.真属性.MATK,1001,'status derived stat keeps the component S-tier range');

const lowerForm=character({charTier:'Ⅱ',formTier:'Ⅰ'});
recalc(lowerForm,'角色',null);
assert.equal(lowerForm.血统.高阶血统.真属性.力量,6,'effective tier remains the higher character tier');
assert.equal(lowerForm.形态库.形态.真属性.精神,2,'form five-stat always uses its own lower form tier');
assert.equal(lowerForm.形态库.形态.真属性.MDEF,2,'form derived stat also uses its own form tier');

const higherForm=character({charTier:'Ⅰ',formTier:'Ⅲ'});
recalc(higherForm,'角色',null);
assert.equal(higherForm.血统.高阶血统.真属性.力量,13,'a higher active form raises the effective character tier');
assert.equal(higherForm.形态库.形态.真属性.精神,13,'form five-stat follows the form tier without downgrade');
console.log('PASS: effective character tier caps component five-stats while forms and derived stats keep their own tiers');

// 可单独运行难度回归；默认仍执行历史声望/结算检查。
if (!process.argv.includes('--difficulty-only')) {
const world=fs.readFileSync('script/世界推进系统.js','utf8');
const expression=world.match(/const factionWeight=(.*);/)[1];
const weight=new Function('factionList','return '+expression);
assert.equal(weight([['敌',{声望:-5000}],['冷',{声望:0}]]),0);
assert.equal(weight([['敌',{声望:-5000}],['友',{声望:200}]]),2);
const settlement=fs.readFileSync('World Book/【结算任务】[mvu_plot].txt','utf8');
assert.ok(settlement.includes('Number(f?.声望)>0'));
assert.ok(settlement.includes('<%= reputationReward %>'));
assert.ok(!settlement.includes('声望绝对值'));

const settlementCalc=settlement.slice(settlement.indexOf('  const reputationGrades'),settlement.indexOf('  // 仓库物品'));
function settlementReward(factions,difficulty='C-B') {
 const ctx=vm.createContext({rule_data:{世界:{难度:difficulty,势力:factions}},_:{get:(o,p,d)=>p.split('.').reduce((v,k)=>v?.[k],o)??d}});
 vm.runInContext(settlementCalc+'\nthis.result={reputationReward,reputationBase};',ctx);
 return ctx.result;
}
assert.equal(settlementReward({敌:{声望:-5000},冷:{声望:0}}).reputationReward,0);
assert.equal(settlementReward({敌:{声望:-5000},友:{声望:100}}).reputationReward,12000);
assert.equal(settlementReward({友:{声望:500}}).reputationReward,36000);
console.log('PASS: settlement template computes positive-only coin amounts and cap');
}
