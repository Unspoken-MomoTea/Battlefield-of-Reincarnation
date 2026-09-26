const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');

const root=path.join(__dirname,'..');
for(const file of [
  'src/WorldEngine/domains/WorldDueEventService.part.js',
  'src/WorldEngine/ui/WorldCausalOverviewController.part.js',
  'src/WorldEngine/ui/WorldApiPresetController.part.js',
]){
  assert.ok(fs.existsSync(path.join(root,file)),file+' must exist');
}
const legacy=[
  'script/world-engine-src/59-due-event-relaxation.part.js',
  'script/world-engine-src/59-causal-overview-ui.part.js',
  'script/world-engine-src/59-api-preset-selection.part.js',
].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
assert.doesNotMatch(legacy,/SamsaraWorldEngine\s*=\s*class/,'phase3 legacy modules must not add engine inheritance layers');

const stat={
  世界:{名称:'phase3',时间:'2026年09月26日-晚上',地点:'中央区',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},货币:{},历法:{},法则:[]},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'class-phase3',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'正文。'}],
  Mvu:{getMvuData:()=>({stat_data:JSON.parse(JSON.stringify(stat))}),replaceMvuData:async()=>{}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
const engine=new Engine(host);
assert.equal(engine.services.due.constructor.name,'WorldDueEventService');
assert.equal(engine.services.causalOverview.constructor.name,'WorldCausalOverviewController');
assert.equal(engine.services.apiPresets.constructor.name,'WorldApiPresetController');
assert.equal(typeof engine.syncDedicatedApiPresetSelection,'function');

console.log('PASS phase3 class services replace due/causal-overview/api-preset inheritance layers');
