const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS,compactWorldLifecycle}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function fresh(){
  return {
    世界:{
      名称:'生命周期测试',时间:'2026-09-10',地点:'北门',稳定:100,后台:emptyState(),
      势力:{},探索:{},因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},
      异端雷达:{名单:{}},法则:[],货币:{},历法:{}
    },
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

const stat=fresh();
stat.世界.后台.事件.旧战={
  ...clone(RECORDS.事件),分类:'当前事件',状态:'已完成',描述:'旧战已经结束',
  时间:'2026-09-01',更新时间:'2026-09-01',前因:[]
};
stat.世界.后台.事件.受保护旧战={
  ...clone(RECORDS.事件),分类:'当前事件',状态:'已完成',描述:'仍被未来节点依赖',
  时间:'2026-09-01',更新时间:'2026-09-01',前因:[]
};
stat.世界.后台.事件.后续行动={
  ...clone(RECORDS.事件),分类:'近期节点',状态:'待发生',描述:'后续行动',
  时间:'2026-09-12',前因:['受保护旧战']
};
stat.世界.后台.事件.刚结束={
  ...clone(RECORDS.事件),分类:'当前事件',状态:'已完成',描述:'刚刚结束',
  时间:'2026-09-10',更新时间:'2026-09-10',前因:[]
};
stat.世界.后台.人物.观察者={
  ...clone(RECORDS.人物),所属世界:'生命周期测试',地点:'北门',目标:'记录',行动:'记录',
  关联事件:['旧战']
};
stat.世界.后台.传播.过期广播={
  ...clone(RECORDS.传播),状态:'传播中',到期时间:'2026-09-09',内容:'已经过期'
};
stat.世界.后台.传播.仍在传播={
  ...clone(RECORDS.传播),状态:'传播中',到期时间:'2026-09-20',内容:'仍有效'
};

const report=compactWorldLifecycle(stat);
assert.ok(report.归档事件.includes('旧战'),'冷结束事件必须归档');
assert.equal(stat.世界.后台.事件.旧战,undefined);
assert.ok(stat.世界.后台.历史['归档·旧战'],'归档事件必须转为永久历史事实');
assert.deepEqual(stat.世界.后台.人物.观察者.关联事件,[],'冷结束事件的软引用必须解绑');
assert.ok(stat.世界.后台.事件.受保护旧战,'仍被活跃/未来事件作为前因引用的结束事件不得归档');
assert.ok(stat.世界.后台.事件.刚结束,'刚结束事件必须保留展示宽限');
assert.deepEqual(report.回收传播,['过期广播']);
assert.equal(stat.世界.后台.传播.过期广播,undefined);
assert.ok(stat.世界.后台.传播.仍在传播);

const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'lifecycle-service-test',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'北门仍在运行。'}],
  Mvu:{getMvuData:()=>({stat_data:fresh()}),replaceMvuData:async()=>{}},
  document:{addEventListener:()=>{},removeEventListener:()=>{}}
};
const engine=new Engine(host);
assert.equal(engine.services.lifecycle?.constructor?.name,'WorldLifecycleService');

const lifecycleSource=fs.readFileSync(path.join(root,'src','WorldEngine','domains','WorldLifecycleService.part.js'),'utf8');
const legacySource=fs.readFileSync(path.join(root,'script','world-engine-src','10-world-state.part.js'),'utf8');
assert.match(lifecycleSource,/class\s+WorldLifecycleService\b/);
assert.doesNotMatch(legacySource,/function\s+(?:collectEventRefs|detachEventSoftRefs|archiveFinishedEvent|propagationEnded|pruneSoftRefsToColdFinishedEvents|compactFinishedEvents)\b/,'event lifecycle implementation must leave the legacy state monolith');
assert.match(legacySource,/function\s+compactWorldLifecycle\b/,'top-level lifecycle compatibility orchestration remains until people/exploration lifecycle is migrated');

console.log('PASS world lifecycle event archival and propagation expiry are class-based');
