import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDedicatedArtifacts, detectPublishMode, dedicatedInitialValues, resolvePublishMode, projectCategoryForSelection } from '../views/author/publish-templates.js';
import { normalizeWorldbookArtifact } from '../services/installer/normalize/worldbook.js';
import { buildArtifactPlan } from '../services/installer/plan.js';
import { buildScenarioArtifacts } from '../views/author/scenario-templates.js';
import { projectScenarioCatalog } from '../../opening/scenarios/installed.js';

const sample = {
  scenario_world:'艾泽拉斯', scenario_mode:'both', scenario_time:'第三次战争前期',
  scenario_location:'东部王国-洛丹伦', scenario_stage:'亡灵瘟疫已扩散',
  scenario_story:'亡灵瘟疫扩散 → 斯坦索姆抉择 → 阿尔萨斯北伐 → 霜之哀伤事件',
  scenario_next:'斯坦索姆抉择', scenario_rank:'Ⅳ',
  scenario_tier_low:'E',scenario_tier_high:'A',scenario_identity:'王国调查员',
  scenario_overview:'联盟与部落并存，亡灵天灾蠢蠢欲动。',
  scenario_laws:'魔法客观存在；自然与奥术体系并行',
  scenario_sections:[
    {title:'洛丹伦',type:'location',match:'洛丹伦',content:'洛丹伦王国位于东部王国。'},
    {title:'斯坦索姆',type:'event',match:'斯坦索姆抉择',content:'瘟疫危机逼近城市。'},
    {title:'法术',type:'always',match:'',content:'奥术可以被法师学习。'},
  ],
};
test('副本发布使用现有 extension 分类，不新增顶层服务器分类',()=>{
  assert.equal(resolvePublishMode('scenario'),'scenario');
  assert.equal(projectCategoryForSelection('scenario'),'extension');
});
test('编辑器编译的全部世界书条目在角色定义前 200～300 且自动加 EJS 门禁',()=>{
  const artifacts=buildScenarioArtifacts(sample,'魔兽世界 · 第三次战争');
  assert.deepEqual(artifacts.map(a=>a.kind),['worldbook','data']);
  const entries=normalizeWorldbookArtifact(artifacts[0].content);
  assert.equal(entries.length,5);
  assert.deepEqual(entries.map(e=>e.position.order),[200,201,210,211,212]);
  assert.ok(entries.every(e=>e.position.type==='before_character_definition'));
  assert.ok(entries.every(e=>e.strategy.type==='constant'));
  assert.ok(entries.every(e=>e.content.includes('getMessageVar("stat_data"')));
  assert.ok(entries.every(e=>e.content.includes('艾泽拉斯')));
  assert.match(entries[3].content,/因果轨道\.下一节点/u);
  assert.match(entries[3].content,/后台/u);
  assert.match(entries[2].content,/\.地点/u);
  assert.ok(!entries[4].content.includes('阶段完成数量'));
});
test('副本编辑重开时资料原样回填，安装后世界书不被角色插入排序覆盖',()=>{
  const artifacts=buildDedicatedArtifacts(sample,'scenario','魔兽世界');
  assert.equal(detectPublishMode('extension',artifacts),'scenario');
  const values=dedicatedInitialValues(artifacts,'scenario');
  assert.equal(values.scenario_next,sample.scenario_next);
  assert.deepEqual(values.scenario_sections,sample.scenario_sections);
  const plan=buildArtifactPlan({id:'pkg',name:'魔兽世界',version:1,bundle:{schema_version:1,artifacts}});
  assert.ok(plan.worldbook.every(e=>e.position.type==='before_character_definition'));
  assert.deepEqual(plan.worldbook.map(e=>e.position.order),[200,201,210,211,212]);
  assert.ok(plan.worldbook.every(e=>e.extra.reincarnationWorkshop.scenario));
});
test('已安装且启用的副本才进入开局候选，支持双模式及单一模式',()=>{
  const bundle={schema_version:1,artifacts:buildScenarioArtifacts(sample,'魔兽世界')};
  const rows=projectScenarioCatalog([
    {id:'ok',name:'魔兽世界',applied:true,bundle},
    {id:'off',name:'未启用',applied:false,bundle},
  ]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,'workshop:scenario:ok');
  assert.equal(rows[0].story,sample.scenario_story);
  assert.equal(rows[0].mode,'both');
});
test('错误节点、EJS 注入与过长章节不能发布',()=>{
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_next:'不存在'},'魔兽世界'),/下一节点/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[{title:'bad',type:'always',content:'<% alert(1) %>'}]},'魔兽世界'),/EJS/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:Array.from({length:71},()=>({title:'无限',type:'always',content:'x'}))},'魔兽世界'),/70/u);
});
