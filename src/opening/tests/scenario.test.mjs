import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectScenarioCatalog } from '../scenarios/installed.js';
const source=readFileSync(new URL('../runtime/70-journey.js',import.meta.url),'utf8');
const begin=source.indexOf('    function parseOpeningWorldLaws(');
const end=source.indexOf('    function applyOpeningDefaultPortraits()',begin);
assert.ok(begin>0&&end>begin,'开局必须包含法则解析与副本初始化 seam');
const seed=new Function(source.slice(begin,end)+'\nreturn seedOpeningScenario;')();
function set(target,path,value){
  const parts=path.split('.');let object=target;
  for(const part of parts.slice(0,-1))object=object[part]||(object[part]={});
  object[parts.at(-1)]=value;
}
const scenario={
  world:'艾泽拉斯',location:'东部王国-洛丹伦',rank:'Ⅳ',tier:'D~A',laws:'魔法客观存在',
  currency:{体系:'金币、银币、铜币',购买力基准:'旅店每晚1银币',经济波动:'战时物价上涨'},
  time:'2026年-10月-13日-上午',stage:'亡灵瘟疫扩散',
  story:'亡灵瘟疫扩散 -> 斯坦索姆抉择 -> 北伐',next:'斯坦索姆抉择',
  calendar:{名称:'艾泽拉斯历',月份天数:[30,30,30,30,30,30,30,30,30,30,30,30],闰年规则:'无'},
  initialEvents:{
    '亡灵瘟疫扩散':{状态:'进行中',时间:'2026年-10月-12日-上午',描述:'瘟疫',前因:[]},
    '斯坦索姆抉择':{状态:'待发生',时间:'2026年-10月-14日-上午',描述:'城市危机',前因:['亡灵瘟疫扩散']},
    '北伐':{状态:'待发生',时间:'斯坦索姆抉择之后',描述:'北伐',前因:['斯坦索姆抉择']},
  },
};
test('同名世界的不同工坊副本以唯一 ID 识别，未启用作品不会加入',()=>{
  const project=(id,applied)=>({id,name:'魔兽世界',applied,bundle:{artifacts:[{kind:'data',content:{schema_version:1,kind:'scenario',world:'艾泽拉斯',...scenario}}]}});
  const rows=projectScenarioCatalog([project('a',true),project('b',true),project('c',false)]);
  assert.equal(rows.length,2);
  assert.notEqual(rows[0].id,rows[1].id);
  assert.equal(Object.keys(rows[0].initialEvents).length,3);
});
test('首次进入时把少量宏观节点注入世界后台，因果轨道沿用现有字段',()=>{
  const saved={stat_data:{世界:{名称:'主神空间'}}};
  seed(saved,scenario,set,'主神空间');
  const w=saved.stat_data.世界;
  assert.equal(w.时间,scenario.time);
  assert.equal(w.名称,'主神空间'); // 世界名称由开局选项自身写入，不依靠工坊作品标题
  assert.equal(w.地点,'东部王国-洛丹伦');
  assert.equal(w.位格,'Ⅳ');
  assert.equal(w.难度,'D~A');
  assert.deepEqual(w.法则,['魔法客观存在']);
  assert.equal(w.货币.体系,'金币、银币、铜币');
  assert.equal(w.货币.购买力基准,'旅店每晚1银币');
  assert.equal(w.货币.经济波动,'战时物价上涨');
  assert.equal(w.历法.名称,'艾泽拉斯历');
  assert.equal(w.后台.事件['亡灵瘟疫扩散'].分类,'宏观节点');
  assert.equal(w.后台.事件['斯坦索姆抉择'].状态,'待发生');
  assert.deepEqual(w.后台.事件['斯坦索姆抉择'].前因,['亡灵瘟疫扩散']);
  assert.equal(w.因果轨道.故事线,scenario.story);
  assert.equal(w.因果轨道.下一节点,scenario.next);
  assert.ok(!Object.hasOwn(w,'副本进度'),'不能新增 MVU 剧情结构');
});
test('同世界重载不得复活取消事件、覆盖世界时间或删除已有因果偏移',()=>{
  const saved={stat_data:{世界:{名称:'艾泽拉斯',时间:'2026年-11月-15日-上午',
    后台:{事件:{'亡灵瘟疫扩散':{分类:'宏观节点',状态:'已完成',结果:'已解决'},'斯坦索姆抉择':{分类:'宏观节点',状态:'已取消'}}},
    因果轨道:{故事线:'原作已经偏移',下一节点:'北伐',偏移记录:{玩家干涉:{描述:'阻止瘟疫'}}}}}};
  seed(saved,scenario,set,'艾泽拉斯');
  const w=saved.stat_data.世界;
  assert.equal(w.后台.事件['斯坦索姆抉择'].状态,'已取消');
  assert.equal(w.后台.事件['亡灵瘟疫扩散'].结果,'已解决');
  assert.equal(w.后台.事件['北伐'].分类,'宏观节点');
  assert.equal(w.时间,'2026年-11月-15日-上午');
  assert.equal(w.货币.体系,'金币、银币、铜币');
  assert.deepEqual(w.因果轨道.偏移记录,{玩家干涉:{描述:'阻止瘟疫'}});
});
test('同世界重载已有货币状态不可被工坊副本重置',()=>{
  const saved={stat_data:{世界:{名称:'艾泽拉斯',时间:'第三次战争后期',
    货币:{体系:'自定义金币体系',购买力基准:'当前经济已改变',经济波动:'高通胀'},
    后台:{事件:{}},因果轨道:{故事线:'改写后的路线',下一节点:'',偏移记录:{}}}}};
  seed(saved,scenario,set,'艾泽拉斯');
  assert.equal(saved.stat_data.世界.货币.体系,'自定义金币体系');
  assert.equal(saved.stat_data.世界.时间,'第三次战争后期');
});
test('作者未提供初始日期时，允许留空并写入待初始化而不是旧世界日期',()=>{
  const saved={stat_data:{世界:{名称:'主神空间',时间:'2025年-01月-01日'}}};
  seed(saved,{...scenario,time:'',calendar:null},set,'主神空间');
  assert.equal(saved.stat_data.世界.时间,'待初始化');
});
