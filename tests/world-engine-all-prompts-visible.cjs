const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const delivery=path.join(__dirname,'../script/世界推进系统.js');
const promptService=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/prompt/00-prompt-service.part.js'),'utf8');
const promptUi=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/ui/60-prompt-tab.part.js'),'utf8');
const history=fs.readFileSync(path.join(__dirname,'../script/world-engine-src/59-history-memory.part.js'),'utf8');
const {SamsaraWorldEngine:Engine,emptyState}=require(delivery);
const clone=value=>JSON.parse(JSON.stringify(value));

for(const key of [
  'pipeline','core','macro','stability','npcAudit','structure',
  'task','chronology','maintenance','exploration','integrity','worldTime','rumor','worldActivity',
  'historyMemorySystem','historyMemoryUserTemplate',
  'retryAcceptedWithPlan','retryAccepted','retryFresh'
]){
  assert.match(promptService,new RegExp("key:'"+key+"'"),'prompt registry must expose '+key);
}
assert.match(promptUi,/全部运行提示词/,'prompt workspace must visibly list every registered runtime prompt');
assert.match(promptUi,/data-all-prompt=/,'registered prompts must render editable textareas');
assert.doesNotMatch(history,/requestAI\(\s*HISTORY_MEMORY_SYSTEM\s*,/,'history summarizer must no longer bypass editable prompt registry');

function fresh(){
 return {世界:{名称:'测试世界',时间:'2026年9月26日-下午',地点:'测试区',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},货币:{},历法:{},异端雷达:{名单:{}}},任务:{列表:{}},系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}},资产:{}};
}
const ref={value:fresh()};
const host={localStorage:{getItem:()=>null,setItem:()=>{}},SillyTavern:{name1:'玩家'},Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},getCurrentChatId:()=> 'all-prompts',getChatMessages:()=>[{message_id:1,role:'assistant',message:'测试正文'}],document:{addEventListener:()=>{},removeEventListener:()=>{}}};
host.Mvu={getMvuData:()=>({stat_data:clone(ref.value)}),replaceMvuData:async data=>{ref.value=clone(data.stat_data);}};
const engine=new Engine(host);
const entries=engine.services.prompts.entries();
const keys=new Set(entries.map(x=>x.key));
for(const key of ['pipeline','core','worldTime','historyMemorySystem','retryFresh'])assert.ok(keys.has(key),key+' missing from runtime registry');
const editable=engine.services.prompts.snapshot();
assert.equal(typeof editable.historyMemorySystem,'string');
engine.services.prompts.apply({...editable,historyMemorySystem:'【自定义历史压缩】\n只按我的规则总结。'});
assert.equal(engine.services.prompts.get('historyMemorySystem'),'【自定义历史压缩】\n只按我的规则总结。');
console.log('PASS all runtime prompt families are visible and editable through one registry');
