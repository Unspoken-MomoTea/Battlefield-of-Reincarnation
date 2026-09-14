const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,compileWorldResult,applyPatches,activeAlienActivityRequirements,WORLD_RESULT_SCHEMA,calendarDate}=require('../script/世界推进系统.js');
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

assert.ok(WORLD_RESULT_SCHEMA.properties.时间,'WorldResult schema must expose top-level world time');
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
  assert.match(item.要求,/更新时间无需抄写/);
  assert.doesNotMatch(item.要求,/更新时间精确写为当前世界时间/);
}

(async()=>{
  // 复现实际开局：世界.时间为空，但后台回复里的两名活跃异端给出了同一个当前时间锚点。
  // 世界引擎应直接接管该时钟并一次成功，不再把异端活动打回。
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
  assert.equal(current.世界.时间,'帝国历1024年秋','world engine should promote the common current-activity time anchor into 世界.时间');
  for(const name of ['塞琉·尤比基塔斯·伪','兰·伪']){
    const person=current.世界.后台.人物[name];
    assert.ok(person?.地点&&person?.目标&&person?.行动,'complete activity must be committed for '+name);
    assert.equal(person.更新时间,current.世界.时间,'active alien timestamp must use the final world-engine clock');
  }

  // 世界推进开启时，变量 AI 即使尝试改世界.时间，也要在 VARIABLE_UPDATE_ENDED 前置处理里被恢复。
  const before={stat_data:clone(current)},variables={stat_data:clone(current)};
  variables.stat_data.世界.时间='变量AI擅自推进的时间';
  engine.handleWorldReplayVariableEvent(variables,before);
  assert.equal(variables.stat_data.世界.时间,current.世界.时间,'variable-AI world-time writes must be ignored while world engine is enabled');

  // 精确到“某月某日”的世界时间必须同时可被日历解析。
  // 复现真实返回：模型写“枯叶之月，第12日”虽然人能读懂，但程序没有月份名称映射，不能生成日历。
  // 引擎应拒绝这种精确但不可机器解析的写法，并在重试后接受数字月日的统一格式。
  let timeState=clone(stat);
  timeState.设置={单一世界:true};
  timeState.世界.时间='';
  timeState.世界.后台=emptyState();
  timeState.世界.异端雷达={名单:{}};
  timeState.世界.历法={名称:'帝国历',月份天数:[30,28,31,30,31,30,31,31,30,31,30,31],闰年规则:'每四年一闰'};
  const timeReplies=[
    {摘要:'建立时间锚点。',时间:'帝历1024年，枯叶之月（秋），第12日'},
    {摘要:'建立时间锚点。',时间:'帝历1024年-09月-12日-下午'}
  ];
  let timeCalls=0;
  const timeHost={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'calendar-compatible-world-time',
    getChatMessages:()=>[{message_id:2,role:'assistant',message:'帝都进入秋季戒严。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>JSON.stringify(timeReplies[timeCalls++])}},
    Mvu:{getMvuData:()=>({stat_data:clone(timeState)}),replaceMvuData:async data=>{timeState=clone(data.stat_data);}}
  };
  const timeEngine=new Engine(timeHost);
  timeEngine.config.enabled=true;
  timeEngine.config.requireMacroBackbone=false;
  timeEngine.config.retryAttempts=2;
  timeEngine.worldbook=async()=>[];
  assert.equal(await timeEngine.run(),true,'calendar-incompatible precise world time should be retried instead of committed');
  assert.equal(timeCalls,2,'named-month precise date must be rejected once and retried with machine-readable month/day');
  assert.equal(timeState.世界.时间,'帝历1024年-09月-12日-下午');
  assert.ok(calendarDate(timeState.世界.时间,timeState.世界.历法),'committed world time must be convertible into the calendar panel');

  const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
  assert.match(source,/【世界时间所有权】/,'delivery must inject world-time ownership rules');
  assert.match(source,/WORLD_RESULT_SCHEMA\.properties\.时间/,'delivery must expose WorldResult.时间');
  assert.match(source,/canonicalTime=String\(next\?\.世界\?\.时间/,'alien validator must read the final world-engine clock');
  console.log('PASS world engine owns 世界.时间, enforces calendar-compatible precise dates, and active-alien timestamps follow that clock');
})().catch(error=>{console.error(error);process.exitCode=1;});
