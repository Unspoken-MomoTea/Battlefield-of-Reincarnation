const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../Regular/结算任务美化.html'), 'utf8');
const start = html.indexOf('function applySettlementFinalization(');
let end = html.indexOf('async function writeSettlementToMvu(', start);
if (end < 0) end = html.indexOf('function writeSettlementToMvu(', start);
assert.ok(start >= 0 && end > start, '应能提取实际结算清理函数');
const snippet = html.slice(start, end);
const finalize = new Function(`
  const rawText='轮回清算协议';
  const hasSettlementHeader=()=>true;
  const isFullSettlement=()=>true;
  const isTrialPassed=()=>false;
  const trialTasks=[];
  const readReincarnatorTier=()=> 'Ⅰ';
  const settlementBaselineTier='Ⅰ';
  ${snippet};
  return applySettlementFinalization;
`)();

function state(single) {
  return {
    设置:{单一世界:single},
    世界:{名称:'旧世界',时间:'2026年-09月-14日-夜晚',后台:{人物:{本地NPC:{行动:'旧世界行动'}}},探索:{旧地:{}},势力:{},因果轨道:{},异端雷达:{当前模式:'',名单:{}},货币:{}},
    系统状态:{是否在主神空间:false,游玩天数:3},
    任务:{列表:{结束:{状态:'可结算'}},副本成就:{},击杀:{}},
    资产:{},
    关系列表:{
      本地NPC:{在场:false,是否队友:false,好感度:60,背景故事:'只属于旧世界'},
      临时同行者:{在场:true,是否队友:false,好感度:20,背景故事:'副本临时同行'},
      长期队友:{在场:false,是否队友:true,好感度:50,背景故事:'正式队友'}
    }
  };
}

const ordinary = state(false);
assert.equal(finalize({stat_data:ordinary}, true), true);
assert.equal(ordinary.关系列表.本地NPC, undefined, '普通副本结算必须清掉旧世界非队友档案，即使高好感');
assert.equal(ordinary.关系列表.临时同行者, undefined, '普通副本结算必须清掉仍在场但未正式组队的副本人物');
assert.ok(ordinary.关系列表.长期队友, '正式队友属于跨世界队伍成员，应保留');
assert.deepEqual(ordinary.世界.后台, {}, '普通副本后台人物同时清空');
assert.equal(ordinary.系统状态.是否在主神空间, true);

const single = state(true);
assert.equal(finalize({stat_data:single}, true), true);
assert.ok(single.关系列表.本地NPC, '单一世界没有跨世界切换，不应清角色档案');
assert.ok(single.关系列表.临时同行者, '单一世界结算不应清当前世界人物');
assert.ok(single.关系列表.长期队友, '单一世界正式队友当然保留');
assert.equal(single.系统状态.是否在主神空间, false);

console.log('PASS settlement removes old-world non-team character records without deleting persistent teammates');
