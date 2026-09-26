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
stat.世界.后台.人物.过期临时={
  ...clone(RECORDS.人物),所属世界:'生命周期测试',地点:'远方',目标:'',行动:'',状态:'',
  更新时间:'2026-07-01',关联事件:[]
};
stat.世界.后台.人物.当前路人={
  ...clone(RECORDS.人物),所属世界:'生命周期测试',地点:'北门',目标:'路过',行动:'观察',
  更新时间:'2026-07-01',关联事件:[]
};
stat.世界.后台.人物.正式旧人物={
  ...clone(RECORDS.人物),所属世界:'生命周期测试',地点:'远方',目标:'',行动:'',状态:'已结束',
  更新时间:'2026-07-01',关联事件:[]
};
stat.关系列表.正式旧人物={在场:false,态度:'仍保留正式档案'};
stat.世界.后台.人物.死亡异端={
  ...clone(RECORDS.人物),所属世界:'生命周期测试',地点:'北门',目标:'旧目标',行动:'旧行动',
  更新时间:'2026-09-10',关联事件:[]
};
stat.世界.异端雷达.名单.死亡异端={来源:'测试',经历:'',阵营:'',职业:'',层级:'Ⅰ',状态:'死亡'};
stat.关系列表.死亡异端={在场:false,态度:'正式档案由外部生命周期负责'};
stat.世界.后台.传播.过期广播={
  ...clone(RECORDS.传播),状态:'传播中',到期时间:'2026-09-09',内容:'已经过期'
};
stat.世界.后台.传播.仍在传播={
  ...clone(RECORDS.传播),状态:'传播中',到期时间:'2026-09-20',内容:'仍有效'
};
stat.世界.探索.远方旧城={风险:'D',探索度:40,描述:'长期探索台账',隐藏真相:''};

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
assert.ok(report.回收人物.includes('过期临时'),'超过临时人物宽限且无引用的后台人物必须回收');
assert.equal(stat.世界.后台.人物.过期临时,undefined);
assert.ok(stat.世界.后台.人物.当前路人,'当前地点人物必须保留');
assert.ok(stat.世界.后台.人物.正式旧人物,'存在正式人物档案的后台活动记录不得按临时人物规则回收');
assert.ok(report.回收人物.includes('死亡异端'),'死亡异端必须从世界后台人物活动中清理');
assert.equal(stat.世界.后台.人物.死亡异端,undefined);
assert.ok(stat.关系列表.死亡异端,'世界推进 lifecycle 不得越权删除正式人物档案');
assert.deepEqual(report.回收探索,[],'探索已是长期台账，不再随 lifecycle 回收');
assert.ok(stat.世界.探索.远方旧城,'离开区域后仍必须保留长期探索记录');

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
assert.match(lifecycleSource,/personActivityMeta\(stat,name,person\)/);
assert.match(lifecycleSource,/pruneColdTemporaryPeople\(stat\)/);
assert.match(lifecycleSource,/pruneDeadAlienPeople\(stat\)/);
assert.match(lifecycleSource,/compact\(stat\)/);
assert.doesNotMatch(
  legacySource,
  /function\s+(?:personActivityMeta|pruneColdTemporaryPeople|pruneDeadAlienPeople|collectEventRefs|detachEventSoftRefs|archiveFinishedEvent|propagationEnded|pruneSoftRefsToColdFinishedEvents|compactFinishedEvents|explorationLocationRefs|pruneColdExploration|compactWorldLifecycle)\b/,
  'person/event lifecycle implementation must leave the legacy state monolith'
);

console.log('PASS world lifecycle event, propagation and temporary-person cleanup are class-based');
