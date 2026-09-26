const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const stat={
  世界:{名称:'核心服务测试',时间:'2026年09月26日-下午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},货币:{},历法:{},法则:[],异端雷达:{名单:{}}},
  系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
};
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'core-services',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍在运转。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}}
};
host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async()=>{}};

const engine=new Engine(host);
assert.equal(engine.services.stateProjector?.constructor?.name,'WorldStateProjector');
assert.equal(engine.services.compiler?.constructor?.name,'WorldResultCompiler');

const projected=engine.services.stateProjector.world(stat);
assert.equal(projected.世界.名称,'核心服务测试');
assert.equal(projected.世界.地点,'北门');
assert.ok(projected.世界.后台,'state projector must expose the world-engine hot backend projection');

const compiled=engine.services.compiler.compile(stat,{
  摘要:'测试',
  事件:[{
    名称:'巡逻升级',分类:'当前事件',状态:'进行中',描述:'北门巡逻升级',
    时间:'2026年09月26日-下午',开始时间:'2026年09月26日-下午',参与者:[],前因:[],关联任务:[],可见影响:[]
  }]
});
assert.ok(compiled.patches.some(p=>String(p.path).includes('/事件/巡逻升级')),'compiler service must compile WorldResult through the canonical compiler');
const built=engine.services.compiler.materialize(stat,[],compiled.patches);
assert.equal(built.next.世界.后台.事件.巡逻升级.描述,'北门巡逻升级');

const runtime=fs.readFileSync(path.join(root,'script/world-engine-src/40-engine-runtime.part.js'),'utf8');
assert.match(runtime,/services\?\.stateProjector\?\.world/,'runtime request building must use the state projector service seam');
assert.match(runtime,/services\?\.compiler\?\.compile/,'runtime result handling must use the compiler service seam');
assert.match(runtime,/services\?\.compiler\?\.stage/,'runtime staged WorldResult validation must use the compiler service seam');

console.log('PASS runtime uses class-based state projection and WorldResult compiler services');
