const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');

const clone=value=>JSON.parse(JSON.stringify(value));
const host={
  localStorage:{getItem:()=>null,setItem:()=>{}},
  Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
  getCurrentChatId:()=> 'causal-soft-projection',
  getChatMessages:()=>[{message_id:1,role:'assistant',message:'局势发生了变化。'}],
};
const engine=new Engine(host);
const events=(definitions)=>Object.fromEntries(definitions.map(([name,status,time,parents=[]])=>[
  name,{...clone(RECORDS.事件),分类:'宏观节点',状态:status,时间:time,描述:name,前因:parents},
]));
function state(definitions,story,stage,next=''){
  const backend=emptyState();
  backend.事件=events(definitions);
  return {世界:{名称:'测试世界',时间:'2026年-10月-13日-上午',后台:backend,
    因果轨道:{当前阶段:stage,故事线:story,下一节点:next,偏移记录:{改变原定命运:{影响程度:3}}}}};
}
function project(stat){return engine.services.causal.repairProjection(stat);}
const macro=(name,status,time,parents)=>[name,status,time,parents];

// 已完成宏观事件从故事线退出，但后台保留历史事实。
{
  const stat=state([
    macro('A','已完成','2026年-10月-01日-上午'),
    macro('B','进行中','2026年-10月-02日-上午'),
    macro('C','待发生','2026年-10月-03日-上午'),
    macro('D','待发生','2026年-10月-04日-上午'),
    macro('E','待发生','2026年-10月-05日-上午'),
  ],'A -> B -> C -> D','A');
  assert.ok(project(stat).length>0);
  assert.equal(stat.世界.因果轨道.故事线,'B -> C -> D -> E');
  assert.equal(stat.世界.因果轨道.当前阶段,'B');
  assert.equal(stat.世界.因果轨道.下一节点,'C');
  assert.equal(stat.世界.后台.事件.A.状态,'已完成');
  assert.equal(project(stat).length,0,'重复投影不应再产生额外写入');
}

// 原有因果分支明确重新排过顺序时，不应仅凭原定日期强行回退。
// 已存在前因链 A -> B -> C，反向改序不能再自动插入 C -> A 形成循环。
{
  const stat=state([
    macro('A','待发生','2026年-10月-01日-上午'),
    macro('B','待发生','2026年-10月-02日-上午',['A']),
    macro('C','待发生','2026年-10月-03日-上午',['B']),
    macro('D','待发生','2026年-10月-04日-上午'),
  ],'C -> A -> B','局势已被玩家改写','B');
  project(stat);
  assert.equal(stat.世界.因果轨道.故事线,'C -> A -> B');
  assert.equal(stat.世界.因果轨道.下一节点,'B');
  assert.equal(stat.世界.因果轨道.当前阶段,'局势已被玩家改写');
  engine.services.stateNormalizer.repairMacroPredecessors(stat);
  assert.ok(!stat.世界.后台.事件.A.前因.includes('C'),'不能补出循环前因');
  assert.deepEqual(stat.世界.后台.事件.B.前因,['A']);
  assert.equal(stat.世界.因果轨道.偏移记录.改变原定命运.影响程度,3);
}

// 宏观节点只剩2个时，先保存成功片段，并将已完成/取消事件从当前投影剔除。
{
  const stat=state([
    macro('A','已完成','2026年-10月-01日-上午'),
    macro('B','已取消','2026年-10月-02日-上午'),
    macro('C','待发生','2026年-10月-03日-上午'),
    macro('D','待发生','2026年-10月-04日-上午'),
  ],'A -> B -> C -> D','B');
  project(stat);
  assert.equal(stat.世界.因果轨道.故事线,'C -> D');
  assert.equal(stat.世界.因果轨道.当前阶段,'','已取消阶段不再占据当前阶段');
  assert.equal(stat.世界.因果轨道.下一节点,'C');
  assert.doesNotThrow(()=>engine.services.validationPolicy.ensureMacroBackbone(stat,{需要补充远期:true},true),
    '不足3个宏观节点只保留补充建议，不得整轮重Roll');
  assert.equal(project(stat).length,0);
}

// 世界尚无宏观事件时，不应删除原有单一世界阶段；多个并行事件不覆盖独立叙事摘要。
{
  const stat=state([], '单一世界剧情正在发展', '洛丹伦仍在动荡');
  assert.equal(project(stat).length,0);
  assert.equal(stat.世界.因果轨道.故事线,'单一世界剧情正在发展');
}
{
  const stat=state([
    macro('A','进行中','2026年-10月-01日-上午'),
    macro('B','进行中','2026年-10月-02日-上午'),
    macro('C','待发生','2026年-10月-03日-上午'),
  ],'A -> B -> C','两地同时爆发冲突');
  project(stat);
  assert.equal(stat.世界.因果轨道.当前阶段,'两地同时爆发冲突');
  assert.equal(stat.世界.因果轨道.故事线,'A -> B -> C');
}

console.log('world-engine soft causal projection acceptance passed');
