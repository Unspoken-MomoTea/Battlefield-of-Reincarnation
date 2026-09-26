const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function fresh(){
  return {
    世界:{名称:'提示词注册表测试',时间:'2026年09月26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},货币:{},历法:{},法则:[],异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},关系列表:{},资产:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}
function hostFor(statRef){
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    SillyTavern:{name1:'测试玩家'},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    getCurrentChatId:()=> 'prompt-registry-complete',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'中央区夜间仍在正常运行。'}],
    document:{addEventListener:()=>{},removeEventListener:()=>{}}
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(statRef.value)}),replaceMvuData:async()=>{}};
  return host;
}

(async()=>{
  const statRef={value:fresh()},engine=new Engine(hostFor(statRef));
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=false;
  engine.worldbook=async()=>[];

  const values=engine.services.prompts.values();
  Object.assign(values,{
    projectionGuidance:'【自定义投影】只发送玩家能在正文中利用的公开投影。',
    requestSummaryGuidance:'【自定义总说明】只提交真实世界差分。',
    worldActivity:'【自定义世界活动 system】世界必须继续运转。',
    worldActivityInputGuidance:'【自定义世界活动 payload】至少推进一个非异端世界对象。',
    retryFresh:'【自定义纠错】只修正本轮错误。',
    historyMemory:'【自定义历史 system】只压缩已确认历史。',
    historyInputGuidance:'【自定义历史 input】保持输入时间粒度。'
  });
  engine.applyPromptSettings({promptRegistry:values});

  const request=await engine.buildRequest(engine.snapshot());
  const payload=JSON.parse(request.input);
  assert.match(request.system,/【自定义世界活动 system】/);
  assert.doesNotMatch(request.system,/【世界活动交付 · 非异端世界必须推进】/,'custom registry value must replace the hidden default');
  assert.equal(payload.正文可见投影规则.要求,'【自定义投影】只发送玩家能在正文中利用的公开投影。');
  assert.equal(payload.说明,'【自定义总说明】只提交真实世界差分。');
  assert.deepEqual(payload.本轮世界活动交付.硬要求,['【自定义世界活动 payload】至少推进一个非异端世界对象。']);

  const retry=JSON.parse(engine.services.requests.retryInput(
    request.input,new Error('测试错误'),'{}',1,5,null,[]
  ));
  assert.equal(retry.纠错重试.要求,'【自定义纠错】只修正本轮错误。');

  let historySystem='',historyInput='';
  engine.requestAI=async(system,input)=>{historySystem=String(system);historyInput=String(input);return JSON.stringify({摘要:'历史压缩结果'});};
  const summary=await engine.requestHistoryMemorySummary({名称:'测试'},[{timeStart:'第1日',timeEnd:'第1日',text:'已确认事实'}],1);
  assert.equal(summary,'历史压缩结果');
  assert.equal(historySystem,'【自定义历史 system】只压缩已确认历史。');
  assert.equal(JSON.parse(historyInput).说明,'【自定义历史 input】保持输入时间粒度。');

  const exported=engine.services.prompts.list();
  assert.ok(exported.length>=28,'registry should expose system, payload, history and retry prompts together');
  assert.ok(exported.every(item=>typeof item.scope==='string'&&typeof item.condition==='string'));

  console.log('PASS every static AI instruction is visible, editable and used by the actual request path');
})().catch(error=>{console.error(error);process.exitCode=1;});
