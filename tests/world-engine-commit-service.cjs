const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=v=>JSON.parse(JSON.stringify(v));

const current={
  stat_data:{
    世界:{名称:'提交服务测试',时间:'2026年09月26日-下午',地点:'北门',稳定:100,后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},货币:{},历法:{},法则:[],异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  }
};
let written=null;
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  SillyTavern:{name1:'测试玩家'},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:s=>s},
  getCurrentChatId:()=> 'commit-service',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍在运转。'}],
  document:{addEventListener:()=>{},removeEventListener:()=>{}},
};
host.Mvu={
  getMvuData:()=>clone(current),
  replaceMvuData:async data=>{written=clone(data);}
};

const engine=new Engine(host);
assert.equal(engine.services.commit?.constructor?.name,'WorldCommitService');

const base=engine.snapshot();
const next=clone(base.stat);
next.世界.因果轨道.偏移记录.测试偏移={描述:'测试',引发者:'系统',影响程度:-5};
next.世界.后台.事件.测试事件={
  分类:'当前事件',状态:'进行中',描述:'测试事件',地点:'北门',时间:'2026年09月26日-下午',
  开始时间:'2026年09月26日-下午',预计结束:'',下次检查:'',更新时间:'2026年09月26日-下午',
  条件:'',前因:[],参与者:[],关联任务:[],公开征兆:'',可见影响:[],默认走向:'',结果:''
};
const patches=[{op:'add',path:'/世界/后台/事件/测试事件',value:clone(next.世界.后台.事件.测试事件)}];
const reply={summary:'测试提交',patches:[]};

const prepared=engine.services.commit.prepare({
  next,committedPatches:patches,base,acceptedWorldResult:{摘要:'测试提交'},reply,validate:s=>s
});
assert.equal(prepared.next.世界.稳定,95,'commit preparation must recalculate causal stability');
assert.equal(prepared.next.世界.后台.已处理楼层,base.fingerprint);
assert.equal(prepared.next.世界.后台.已处理时间,base.stat.世界.时间);
assert.equal(prepared.next.世界.后台.最近变化.at(-1).名称,'测试事件');
assert.deepEqual(prepared.reply.patches,patches);

(async()=>{
  await engine.services.commit.persist({current:base,next:prepared.next,reply:prepared.reply},base);
  assert.ok(written&&written.stat_data,'commit service must perform the single MVU write');
  assert.equal(written.stat_data.世界.后台.事件.测试事件.描述,'测试事件');

  const orchestrator=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldRunOrchestrator.part.js'),'utf8');
  assert.match(orchestrator,/services\?\.commit\?\.prepare|services\.commit\.prepare/,'run orchestrator must route commit preparation through WorldCommitService');
  assert.match(orchestrator,/services\?\.commit\?\.persist|services\.commit\.persist/,'run orchestrator must route MVU persistence through WorldCommitService');

  console.log('PASS world commit preparation and persistence are class-based');
})().catch(error=>{console.error(error);process.exitCode=1;});
