const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,compileWorldResult,applyPatches,activeAlienActivityRequirements}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const stat={
  世界:{
    名称:'斩！赤红之瞳',
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

(async()=>{
  // 真实开局数据里世界.时间可能仍为空。此时不能因为没有可用时间戳而把已经提交完整活动的异端反复拒绝。
  let current=clone(stat);
  current.世界.时间='';
  current.世界.地点='';
  current.世界.后台=emptyState();
  current.世界.因果轨道={当前阶段:'狩人部队集结，夜袭面临全面围剿。',故事线:'夜袭初战受阻 -> 狩人全面搜捕 -> 轮回者搅局 -> 最终帝具决战',下一节点:'待初始化',偏移记录:{}};
  current.世界.异端雷达.名单['塞琉·尤比基塔斯·伪'].层级='Ⅲ';
  current.世界.异端雷达.名单['兰·伪'].层级='Ⅲ';

  const reply={
    摘要:'异端活动复核完成。',
    人物:[
      {名称:'塞琉·尤比基塔斯·伪',操作:'更新',地点:'帝都·北区贫民窟深巷',目标:'猎杀感知范围内的所有异端轮回者。',行动:'利用帝具小比锁定觉醒波动并布置陷阱。',状态:'活跃',更新时间:'帝国历1024年秋'},
      {名称:'兰·伪',操作:'更新',地点:'帝都·行政办公厅机要室',目标:'通过操控情报流向诱导冲突。',行动:'伪造名单并扩大搜捕范围。',状态:'活跃',更新时间:'帝国历1024年秋'}
    ],
    异端:[
      {名称:'塞琉·尤比基塔斯·伪',状态:'活跃'},
      {名称:'兰·伪',状态:'活跃'}
    ]
  };
  let calls=0,writes=0;
  const message={message_id:1,role:'assistant',message:'雨夜里，帝都的搜捕正在扩大。'};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'alien-empty-world-time',
    getChatMessages:()=>[message],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>{calls++;return JSON.stringify(reply);}}},
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}}
  };
  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=1;
  engine.worldbook=async()=>[];
  assert.equal(await engine.run(),true,'empty world time must not reject complete active-alien activity');
  assert.equal(calls,1,'valid activity should be accepted on the first request');
  assert.equal(writes,1,'accepted activity should be committed once');
  for(const name of ['塞琉·尤比基塔斯·伪','兰·伪']){
    const person=current.世界.后台.人物[name];
    assert.ok(person?.地点&&person?.目标&&person?.行动,'complete activity must be committed for '+name);
    assert.equal(person.更新时间,'','AI-invented timestamp must not become canonical while 世界.时间 is empty');
  }

  const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
  assert.match(source,/ensureActiveAlienActivity=function\(/,'delivery must replace the brittle alien activity validator');
  assert.match(source,/sameWorldTimeAnchor\(person\?\.更新时间,worldTime\)/,'validator should use semantic world-time matching when a canonical time exists');
  console.log('PASS active alien activity accepts complete facts even when 世界.时间 is empty');
})().catch(error=>{console.error(error);process.exitCode=1;});
