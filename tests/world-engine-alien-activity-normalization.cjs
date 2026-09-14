const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {emptyState,compileWorldResult,applyPatches,activeAlienActivityRequirements}=require('../script/世界推进系统.js');

const stat={
  世界:{
    名称:'斩赤红之瞳',
    时间:'帝国历1024年 雨季 · 深夜',
    地点:'帝都贫民窟',
    后台:emptyState(),
    因果轨道:{当前阶段:'狩人部队集结',故事线:'',下一节点:'',偏移记录:{}},
    异端雷达:{名单:{
      '塞琉·尤比基塔斯·伪':{来源:'轮回者',经历:'',阵营:'',职业:'',层级:'Ⅱ',状态:'活跃'},
      '兰·伪':{来源:'轮回者',经历:'',阵营:'',职业:'',层级:'Ⅱ',状态:'活跃'}
    }},
    势力:{},探索:{}
  },
  设置:{单一世界:false},
  系统状态:{是否在主神空间:false,是否战斗中:false},
  关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{},任务:{列表:{},副本成就:{}}
};

const result={
  摘要:'异端继续在帝都行动。',
  人物:[
    {
      名称:'塞琉·尤比基塔斯·伪',操作:'更新',地点:'帝都贫民窟-第四封锁区',目标:'捕获目标',行动:'指挥搜捕。',
      更新时间:'帝国历1024年 雨季 深夜'
    },
    {
      名称:'兰·伪',操作:'更新',地点:'帝都西侧瞭望塔',目标:'观测目标',行动:'拦截援军情报。'
    }
  ],
  异端:[
    {名称:'塞琉·尤比基塔斯·伪',操作:'更新',状态:'活跃'},
    {名称:'兰·伪',操作:'更新',状态:'活跃'}
  ]
};

const compiled=compileWorldResult(stat,result);
const next=applyPatches(stat,compiled.patches);
for(const name of ['塞琉·尤比基塔斯·伪','兰·伪']){
  const person=next.世界.后台.人物[name];
  assert.ok(person,'active alien activity must create/update backend person '+name);
  assert.equal(person.更新时间,stat.世界.时间,'program must stamp the canonical current world time for '+name);
  assert.ok(person.地点&&person.目标&&person.行动,'activity facts must remain intact for '+name);
}

const requirements=activeAlienActivityRequirements(stat);
assert.equal(requirements.length,2);
for(const item of requirements){
  assert.match(item.要求,/更新时间由程序统一记录为当前世界时间/);
  assert.doesNotMatch(item.要求,/更新时间精确写为当前世界时间/);
}

const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
assert.match(source,/ensureActiveAlienActivity=function\(/,'delivery must replace the brittle alien activity validator');
assert.match(source,/sameWorldTimeAnchor\(person\?\.更新时间,worldTime\)/,'validator must use semantic world-time matching as a fallback');
assert.match(source,/submitted=proposal&&String\(proposal\.地点/,'validator must require this round to actually submit activity facts');
console.log('PASS active alien activity facts are model-owned while timestamps are program-owned');
