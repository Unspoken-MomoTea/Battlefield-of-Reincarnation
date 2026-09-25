const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS,compileWorldResult,applyPatches,activeAlienActivityRequirements,WORLD_RESULT_SCHEMA,calendarDate}=require('../script/世界推进系统.js');
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
assert.equal(requirements.length,2,'missing backend activity must still require initialization for each active alien');
for(const item of requirements){
  assert.match(item.要求,/触发复核/);
  assert.match(item.要求,/更新时间无需抄写/);
  assert.doesNotMatch(item.要求,/每轮/);
  assert.doesNotMatch(item.要求,/更新时间精确写为当前世界时间/);
}

const settled=clone(stat);
settled.世界.后台=emptyState();
settled.世界.后台.事件['帝都封锁']={
  ...RECORDS.事件,描述:'帝都封锁仍在持续。',分类:'当前事件',状态:'进行中',
  时间:settled.世界.时间,更新时间:settled.世界.时间
};
settled.世界.后台.人物={
  '塞琉·尤比基塔斯·伪':{
    所属世界:settled.世界.名称,地点:'帝都贫民窟-第四封锁区',目标:'维持封锁',行动:'继续搜查既定区域。',
    状态:'活跃',更新时间:settled.世界.时间,下次检查:'',关联事件:['帝都封锁'],认知:['封锁命令仍然有效'],认知来源:[]
  },
  '兰·伪':{
    所属世界:settled.世界.名称,地点:'帝都西侧瞭望塔',目标:'观察城内动向',行动:'按既定计划监视交通。',
    状态:'活跃',更新时间:settled.世界.时间,下次检查:'',关联事件:[],认知:[],认知来源:[]
  }
};
assert.deepEqual(activeAlienActivityRequirements(settled),[],'complete active aliens with no due/event/area trigger must keep their existing plan instead of being forced to react every world-engine run');

const eventTriggered=clone(settled);
eventTriggered.世界.后台.最近变化=[{时间:eventTriggered.世界.时间,类别:'事件',名称:'帝都封锁',操作:'更新',字段:'状态',内容:'封锁范围扩大'}];
const triggeredRequirements=activeAlienActivityRequirements(eventTriggered);
assert.equal(triggeredRequirements.length,1,'a linked world event change should trigger only the affected alien review');
assert.equal(triggeredRequirements[0].名称,'塞琉·尤比基塔斯·伪');
assert.match(triggeredRequirements[0].触发原因.join('、'),/关联事件变化/);

(async()=>{
  // 异端无触发时仍应延续既定行动，但世界本身不能因此停摆。
  // 第一答只给摘要应被“世界活动交付”打回；第二答建立地区/势力现场后才允许提交。
  let quietState=clone(settled),quietCalls=0,quietWrites=0;
  const quietReplies=[
    {摘要:'没有新的世界侧事实。'},
    {
      摘要:'帝都封锁继续运作，警备力量正在调整街区控制。',
      势力:[{名称:'帝都警备队',操作:'更新',实力:'C',领地:'帝都',描述:'负责帝都治安与封锁执行的武装组织。',声望:0}],
      势力地区:[
        {名称:'帝都北区',操作:'更新',类型:'地区',描述:'帝都北部住宅与贫民混合区。',目标:'维持封锁秩序',进展:'警备队把搜查重点转向北侧街巷。',关联事件:['帝都封锁'],公开动态:'北区路口增加临检。'},
        {名称:'帝都警备队',操作:'更新',类型:'势力',描述:'负责帝都治安与封锁执行的武装组织。',目标:'维持帝都封锁',进展:'重新分配巡逻队与检查站。',关联事件:['帝都封锁'],公开动态:'警备队公开加强北区检查。'}
      ]
    }
  ];
  const quietHost={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'alien-no-trigger',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'这一小段时间里，主角只在室内整理物品，没有新的公开动静。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>JSON.stringify(quietReplies[quietCalls++])}},
    Mvu:{getMvuData:()=>({stat_data:clone(quietState)}),replaceMvuData:async data=>{quietWrites++;quietState=clone(data.stat_data);}}
  };
  const quietEngine=new Engine(quietHost);
  quietEngine.config.enabled=true;
  quietEngine.config.requireMacroBackbone=false;
  quietEngine.config.retryAttempts=2;
  quietEngine.worldbook=async()=>[];
  const quietRequest=await quietEngine.buildRequest(quietEngine.snapshot());
  const quietPayload=JSON.parse(quietRequest.input);
  assert.equal(quietPayload.本轮世界活动交付.初始化缺口.地区,true);
  assert.equal(quietPayload.本轮世界活动交付.初始化缺口.势力,true);
  assert.equal(quietPayload.本轮世界活动交付.当前数量.顶层势力数,0);
  assert.equal(quietPayload.本轮世界活动交付.当前数量.动态势力数,0);
  assert.match(quietRequest.system,/世界推进不是“异端模拟器”/);
  assert.equal(await quietEngine.run(),true,'world activity must progress even when active aliens have no review trigger');
  assert.equal(quietCalls,2,'summary-only world result must be retried instead of allowing the non-alien world to freeze');
  assert.equal(quietWrites,1,'repaired world activity should commit once');
  assert.ok(quietState.世界.后台.势力地区['帝都北区']);
  assert.equal(quietState.世界.后台.势力地区['帝都警备队']?.类型,'势力');
  assert.equal(quietState.世界.势力['帝都警备队']?.实力,'C','faction bootstrap must also populate the top-level faction ledger used by reputation/settlement');

  // 世界现场已经建立后也不能退化成“只有异端会动”。
  let ongoingState=clone(quietState),ongoingCalls=0,ongoingWrites=0;
  const ongoingReplies=[
    {摘要:'异端继续原计划，世界其余部分没有变化。'},
    {
      摘要:'封锁现场继续推进。',
      事件:[{名称:'帝都封锁',操作:'更新',描述:'帝都封锁仍在持续，北区检查密度上升。',分类:'当前事件',状态:'进行中',时间:ongoingState.世界.时间,地点:'帝都北区'}],
      势力地区:[{名称:'帝都北区',操作:'更新',类型:'地区',描述:'帝都北部住宅与贫民混合区。',目标:'维持封锁秩序',进展:'新增两处临时检查点，行人绕行。',关联事件:['帝都封锁'],公开动态:'北区临检范围继续扩大。'}]
    }
  ];
  const ongoingHost={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'world-must-keep-moving',
    getChatMessages:()=>[{message_id:2,role:'assistant',message:'主角继续在室内行动，城内时间仍在流逝。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async()=>JSON.stringify(ongoingReplies[ongoingCalls++])}},
    Mvu:{getMvuData:()=>({stat_data:clone(ongoingState)}),replaceMvuData:async data=>{ongoingWrites++;ongoingState=clone(data.stat_data);}}
  };
  const ongoingEngine=new Engine(ongoingHost);
  ongoingEngine.config.enabled=true;
  ongoingEngine.config.requireMacroBackbone=false;
  ongoingEngine.config.retryAttempts=2;
  ongoingEngine.worldbook=async()=>[];
  assert.equal(await ongoingEngine.run(),true,'an initialized world must still make a non-alien semantic step each world-engine run');
  assert.equal(ongoingCalls,2,'alien-only/summary-only follow-up must be retried even after the world scene already exists');
  assert.equal(ongoingWrites,1);
  assert.match(ongoingState.世界.后台.势力地区['帝都北区']?.进展||'',/临时检查点/);

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
    摘要:'帝都搜捕扩大，世界现场与异端活动同时建立。',
    时间:'帝国历1024年秋',
    事件:[{名称:'帝都搜捕扩大',操作:'更新',描述:'帝都警备力量扩大夜间搜捕。',分类:'当前事件',状态:'进行中',时间:'帝国历1024年秋',地点:'帝都'}],
    势力:[{名称:'帝都警备队',操作:'更新',实力:'C',领地:'帝都',描述:'帝都治安武装。',声望:0}],
    势力地区:[
      {名称:'帝都',操作:'更新',类型:'地区',描述:'帝国首都。',目标:'维持城市运转',进展:'夜间搜捕扩大。',关联事件:['帝都搜捕扩大']},
      {名称:'帝都警备队',操作:'更新',类型:'势力',描述:'帝都治安武装。',目标:'扩大搜捕',进展:'调集巡逻与检查站。',关联事件:['帝都搜捕扩大']}
    ],
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

  // 精确到“某月某日”的顶层时间和事件时间都必须可被日历解析。
  // 复现真实返回：顶层已经用数字月日，但事件仍写“枯叶之月，第15日”时也必须打回，不能留下不可排序节点。
  let timeState=clone(stat);
  timeState.设置={单一世界:true};
  timeState.世界.时间='';
  timeState.世界.后台=emptyState();
  timeState.世界.异端雷达={名单:{}};
  timeState.世界.历法={名称:'帝国历',月份天数:[30,28,31,30,31,30,31,31,30,31,30,31],闰年规则:'每四年一闰'};
  const timeReplies=[
    {
      摘要:'建立时间锚点与当前世界现场。',时间:'帝历1024年-09月-12日-下午',
      事件:[
        {名称:'帝都戒严',操作:'更新',描述:'帝都进入戒严状态。',时间:'帝历1024年-09月-12日-下午',状态:'进行中',地点:'帝都',分类:'当前事件'},
        {名称:'狩人集结',操作:'更新',描述:'狩人部队开始集结。',时间:'帝历1024年，枯叶之月，第15日',状态:'待发生',地点:'帝都',分类:'宏观节点'}
      ],
      势力:[{名称:'帝都警备队',操作:'更新',实力:'C',领地:'帝都',描述:'帝都治安武装。',声望:0}],
      势力地区:[
        {名称:'帝都',操作:'更新',类型:'地区',描述:'帝国首都。',目标:'维持秩序',进展:'戒严措施正在执行。',关联事件:['帝都戒严']},
        {名称:'帝都警备队',操作:'更新',类型:'势力',描述:'帝都治安武装。',目标:'执行戒严',进展:'部署检查站。',关联事件:['帝都戒严']}
      ]
    },
    {
      摘要:'修正宏观日期。',时间:'帝历1024年-09月-12日-下午',
      事件:[{名称:'狩人集结',操作:'更新',描述:'狩人部队开始集结。',时间:'帝历1024年-09月-15日-上午',状态:'待发生',地点:'帝都',分类:'宏观节点'}]
    }
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
  const initializationRequest=await timeEngine.buildRequest(timeEngine.snapshot());
  const initializationPayload=JSON.parse(initializationRequest.input);
  assert.equal(initializationPayload.世界时间维护.是否需要初始化,true);
  assert.equal(initializationPayload.世界时间维护.初始化锚定.任务世界,timeState.世界.名称);
  assert.match(initializationPayload.世界时间维护.初始化锚定.禁止,/下一宏观节点.*未来事件.*当前世界时间/);
  assert.match(initializationPayload.世界时间维护.正文时间职责,/必须输出顶层“时间”/);
  assert.match(initializationRequest.system,/活跃异端只在活动缺失、复核到期、关联事件\/所在地区变化或长期未复核时更新/,'built-in prompt must no longer tell the model to rewrite every active alien each run');
  assert.equal(await timeEngine.run(),true,'calendar-incompatible precise event time should be retried instead of committed');
  assert.equal(timeCalls,2,'named-month event date must be rejected once and retried with machine-readable month/day');
  assert.equal(timeState.世界.时间,'帝历1024年-09月-12日-下午');
  assert.ok(calendarDate(timeState.世界.时间,timeState.世界.历法),'committed world time must be convertible into the calendar panel');
  assert.equal(timeState.世界.后台.事件['狩人集结'].时间,'帝历1024年-09月-15日-上午');
  assert.ok(calendarDate(timeState.世界.后台.事件['狩人集结'].时间,timeState.世界.历法),'committed event time must also be calendar/sort compatible');

  const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
  assert.match(source,/【世界时间所有权】/,'delivery must inject world-time ownership rules');
  assert.match(source,/\{yyy\}年-\{mm\}月-\{dd\}日-\{时间段\}/,'delivery prompt must use the neutral world-time format template');
  assert.doesNotMatch(source,/例如“帝历1024年-09月-12日-下午”/,'delivery prompt must not teach a specific world calendar as the generic format');
  assert.match(source,/WORLD_RESULT_SCHEMA\.properties\.时间/,'delivery must expose WorldResult.时间');
  assert.match(source,/canonicalTime=String\(next\?\.世界\?\.时间/,'alien validator must read the final world-engine clock');
  console.log('PASS world engine owns 世界.时间, enforces calendar-compatible precise dates, and active-alien timestamps follow that clock');
})().catch(error=>{console.error(error);process.exitCode=1;});
