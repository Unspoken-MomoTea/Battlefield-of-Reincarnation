const assert=require('node:assert/strict');
const {
  SamsaraWorldEngine:Engine,
  emptyState,
  WorldEngineMutationService,
  WorldEventService,
  WorldPersonActivityService,
  WorldEnginePromptService,
  WorldEngineRequestService,
  WorldHistoryMemoryService
}=require('../script/世界推进系统.js');

const clone=value=>JSON.parse(JSON.stringify(value));
const backend=emptyState();
backend.事件.旧事件={
  描述:'旧描述',时间:'2026年09月26日-上午',开始时间:'2026年09月26日-上午',预计结束:'2026年09月26日-中午',
  条件:'',前因:[],状态:'进行中',默认走向:'',结果:'',公开征兆:'',地点:'北门',分类:'当前事件',更新时间:'2026年09月26日-上午',
  下次检查:'2026年09月26日-中午',参与者:[],关联任务:[],可见影响:[]
};
backend.人物.卫兵={
  所属世界:'测试世界',状态:'活跃',地点:'北门',目标:'守门',行动:'盘查',认知:[],认知来源:[],关联事件:['旧事件'],
  公开动态:'正在盘查',更新时间:'2026年09月26日-上午',开始时间:'2026年09月26日-上午',预计结束:'2026年09月26日-中午',
  下次检查:'2026年09月26日-中午',行程:[],背景关联:[],登场条件:''
};
let stat={
  世界:{名称:'测试世界',时间:'2026年09月26日-上午',地点:'北门',后台:backend,势力:{},探索:{},因果轨道:{当前阶段:'封锁',故事线:'',下一节点:'旧事件',偏移记录:{}},异端雷达:{名单:{}},历法:{},货币:{},法则:[]},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},
  关系列表:{卫兵:{背景故事:'正式档案',好感度:10}},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const message={message_id:5,role:'assistant',message:'北门仍在封锁。'};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'class-services',
  getChatMessages:()=>[message],
  Mvu:{getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async raw=>{stat=clone(raw.stat_data);}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
  toastr:{error:()=>{}}
};

(async()=>{
  const engine=new Engine(host);
  engine.render=()=>{};
  assert.ok(engine.services,'engine facade must expose composed domain services');
  assert.ok(engine.services.mutations instanceof WorldEngineMutationService);
  assert.ok(engine.services.events instanceof WorldEventService);
  assert.ok(engine.services.people instanceof WorldPersonActivityService);
  assert.ok(engine.services.prompts instanceof WorldEnginePromptService);
  assert.ok(engine.services.requests instanceof WorldEngineRequestService);
  assert.ok(engine.services.history instanceof WorldHistoryMemoryService);

  await engine.setWorldEventRecord('旧事件','修正事件',{...clone(stat.世界.后台.事件.旧事件),描述:'修正后'});
  assert.equal(stat.世界.后台.事件.旧事件,undefined);
  assert.equal(stat.世界.后台.事件.修正事件.描述,'修正后');
  assert.deepEqual(stat.世界.后台.人物.卫兵.关联事件,['修正事件']);

  const formal=clone(stat.关系列表.卫兵);
  await engine.setWorldPersonRecord('卫兵',{...clone(stat.世界.后台.人物.卫兵),地点:'南门',行动:'重新核验'});
  assert.equal(stat.世界.后台.人物.卫兵.地点,'南门');
  assert.deepEqual(stat.关系列表.卫兵,formal,'world person service must not mutate formal status-bar profile');

  assert.equal(typeof engine.promptCatalog,'function');
  assert.ok(engine.promptCatalog().length>10,'prompt service must expose the unified editable prompt catalogue');
  console.log('PASS world engine facade delegates to composed domain classes');
})().catch(error=>{console.error(error);process.exitCode=1;});
