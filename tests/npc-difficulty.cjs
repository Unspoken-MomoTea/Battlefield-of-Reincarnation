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
assert.deepEqual(run('体验').关系列表.新,make());
const normal=run('正常').关系列表.新;
assert.equal(normal.血统.血.品质,'C');
assert.equal(normal.技能.术.品质,'C');
assert.equal(normal.形态库.变身.层级,'Ⅳ');
assert.equal(normal.形态库.变身.技能.招式.品质,'C');
assert.equal(normal.血统.血.原始属性.力量,'C');
const hard=run('困难');
assert.equal(hard.关系列表.新.血统.血.原始属性.力量,'A');
assert.equal(hard.关系列表.新.血统.血.原始属性.敏捷,'B');
assert.equal(hard.关系列表.新.装备.剑.原始属性.ATK,'A');
assert.equal(hard.关系列表.新.状态.临时.原始属性.敏捷,-5);
const snapshot=JSON.stringify(hard);
apply(hard,{关系列表:{新:JSON.parse(snapshot).关系列表.新}});
assert.equal(JSON.stringify(hard),snapshot);
const challenge=run('挑战').关系列表.新;
assert.equal(challenge.血统.血.原始属性.力量,'SS');
assert.equal(challenge.血统.血.原始属性.体质,'SSS');
assert.equal(challenge.装备.剑.品质,'B');
assert.equal(challenge.状态.功法.品质,'B');
assert.equal(challenge.形态库.变身.层级,'Ⅴ');
for (const before of [undefined,{关系列表:{新:make()}}]) {
    const stat={设置:{难度:'挑战'},关系列表:{新:make()}};
    apply(stat,before);
    assert.deepEqual(stat.关系列表.新,make());
}
const top={设置:{难度:'挑战'},关系列表:{新:make()}};
top.关系列表.新.层级='Ⅸ';
top.关系列表.新.装备.剑.原始属性.ATK='SSS';
apply(top,{关系列表:{}});
assert.equal(top.关系列表.新.装备.剑.品质,'SSS');
assert.equal(top.关系列表.新.装备.剑.原始属性.ATK,'SSS');
assert.equal(top.关系列表.新.形态库.变身.层级,'Ⅸ');
const world=fs.readFileSync('script/世界推进系统.js','utf8');
const expression=world.match(/const factionWeight=(.*);/)[1];
const weight=new Function('factionList','return '+expression);
assert.equal(weight([['敌',{声望:-5000}],['冷',{声望:0}]]),0);
assert.equal(weight([['敌',{声望:-5000}],['友',{声望:200}]]),2);
const settlement=fs.readFileSync('World Book/【结算任务】[mvu_plot].txt','utf8');
assert.ok(settlement.includes('Number(f?.声望)>0'));
assert.ok(settlement.includes('<%= reputationReward %>'));
assert.ok(!settlement.includes('声望绝对值'));
for (const npc of [{...make(),好感度:0},{...make(),好感度:50},{...make(),是否队友:true}]) {
    const stat={设置:{难度:'挑战'},关系列表:{新:npc}};
    const original=JSON.stringify(stat);
    apply(stat,{关系列表:{}});
    assert.equal(JSON.stringify(stat),original);
}
assert.ok(!source.includes('难度已应用'));
console.log('PASS: difficulty tiers, old NPCs, replay, nested skills, caps and positive-only reputation');

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
