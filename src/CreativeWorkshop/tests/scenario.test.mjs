import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDedicatedArtifacts, detectPublishMode, dedicatedInitialValues, resolvePublishMode, projectCategoryForSelection } from '../views/author/publish-templates.js';
import { buildScenarioArtifacts, orderedScenarioMacros, scenarioEventRecords } from '../views/author/scenario-templates.js';
import { normalizeWorldbookArtifact } from '../services/installer/normalize/worldbook.js';
import { buildArtifactPlan } from '../services/installer/plan.js';
import { projectScenarioCatalog } from '../../opening/scenarios/installed.js';
const sections=[
  {title:'亡灵瘟疫扩散',type:'macro',timeType:'date',time:'2026年-10月-12日-上午',content:'亡灵瘟疫逐渐影响王国。'},
  {title:'斯坦索姆抉择',type:'macro',timeType:'date',time:'2026年-10月-14日-上午',after:'亡灵瘟疫扩散',content:'王子需要做出选择。'},
  {title:'阿尔萨斯北伐',type:'macro',timeType:'after',after:'斯坦索姆抉择',content:'北伐行动展开。'},
  {title:'洛丹伦',type:'location',location:'洛丹伦',content:'王国位于东部王国。'},
  {title:'法术',type:'always',content:'奥术、圣光和自然魔法并存。'},
];
const sample={
  scenario_time:'2026年-10月-13日-上午',scenario_laws:'魔法客观存在；亡灵瘟疫会传播',
  scenario_identity:'王国调查员',scenario_sections:sections,
};
test('副本发布复用 extension 分类，编辑器不要求填写故事线与下一节点',()=>{
  assert.equal(resolvePublishMode('scenario'),'scenario');
  assert.equal(projectCategoryForSelection('scenario'),'extension');
  assert.equal(buildScenarioArtifacts(sample,'艾泽拉斯').length,2);
  const ui=readFileSync(new URL('../views/author/scenario-editor.js',import.meta.url),'utf8');
  assert.doesNotMatch(ui,/field\(doc,'默认故事线'/);
  assert.doesNotMatch(ui,/field\(doc,'下一节点'/);
  assert.match(ui,/date\.type='date'/);
});
test('宏观节点由事件名称、日期与前因自动排期，正文不写入 MVU',()=>{
  const bundle=buildScenarioArtifacts(sample,'艾泽拉斯');
  const data=bundle[1].content;
  assert.equal(data.world,'艾泽拉斯');
  assert.equal(data.stage,'亡灵瘟疫扩散');
  assert.equal(data.next,'斯坦索姆抉择');
  assert.equal(data.story,'亡灵瘟疫扩散 -> 斯坦索姆抉择 -> 阿尔萨斯北伐');
  assert.deepEqual(Object.keys(data.initialEvents),['亡灵瘟疫扩散','斯坦索姆抉择','阿尔萨斯北伐']);
  assert.equal(data.initialEvents['亡灵瘟疫扩散'].状态,'进行中');
  assert.deepEqual(data.initialEvents['斯坦索姆抉择'].前因,['亡灵瘟疫扩散']);
  assert.ok(data.initialEvents['斯坦索姆抉择'].描述.length<=140);
  const entries=normalizeWorldbookArtifact(bundle[0].content);
  assert.deepEqual(entries.map(e=>e.position.order),[200,201,210,211,212,213,214]);
  assert.ok(entries.every(e=>e.position.type==='before_character_definition'));
  assert.ok(entries.every(e=>e.content.includes('getMessageVar("stat_data"')));
  assert.ok(entries[3].content.includes('因果轨道.下一节点'));
  assert.ok(entries[5].content.includes('洛丹伦'));
});
test('70个原著宏观节点只初始化5个，剩余信息由动态年表按需筛选',()=>{
  const many=Array.from({length:70},(_,i)=>({title:'事件'+i,type:'macro',timeType:'phase',time:'第'+i+'阶段',content:'详细内容'+i}));
  const bundle=buildScenarioArtifacts({...sample,scenario_time:'第一阶段',scenario_sections:many},'艾泽拉斯');
  assert.equal(Object.keys(bundle[1].content.initialEvents).length,5);
  assert.equal(bundle[0].content.entries.length,72);
  assert.ok(bundle[0].content.entries[1].content.includes('slice(0,5)'));
  assert.equal(bundle[0].content.entries.at(-1).position.order,279);
});
test('自定义年号/相对时间可用，精确时间按日历排序；有环的前因拒绝',()=>{
  const world=buildScenarioArtifacts({...sample,scenario_time:'第三次战争初期',scenario_sections:sections},'艾泽拉斯')[1].content;
  assert.equal(world.time,'第三次战争初期');
  assert.equal(world.initialEvents['阿尔萨斯北伐'].时间,'斯坦索姆抉择之后');
  assert.deepEqual(orderedScenarioMacros(sections).map(e=>e.title),['亡灵瘟疫扩散','斯坦索姆抉择','阿尔萨斯北伐']);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:sections.map((s,i)=>i===0?{...s,after:'阿尔萨斯北伐'}:s)},'艾泽拉斯'),/循环/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[{title:'x',type:'macro',timeType:'date',time:'错误日期',content:'x'}]},'艾泽拉斯'),/日期格式/u);
});
test('编辑回填、安装保留场景标识，启用后出现在开局选择',()=>{
  const artifacts=buildDedicatedArtifacts(sample,'scenario','艾泽拉斯');
  assert.equal(detectPublishMode('extension',artifacts),'scenario');
  const initial=dedicatedInitialValues(artifacts,'scenario');
  assert.deepEqual(initial.scenario_sections,sections.map(row=>({
    ...row, timeType:row.timeType||'phase', time:row.time||'',after:row.after||'',location:row.location||'',condition:row.condition||'',
  })));
  const plan=buildArtifactPlan({id:'pkg',name:'艾泽拉斯',version:1,bundle:{schema_version:1,artifacts}});
  assert.ok(plan.worldbook.every(row=>row.extra.reincarnationWorkshop.scenario));
  const catalog=projectScenarioCatalog([
    {id:'one',name:'艾泽拉斯',applied:true,bundle:{schema_version:1,artifacts}},
    {id:'two',name:'艾泽拉斯',applied:false,bundle:{schema_version:1,artifacts}},
  ]);
  assert.equal(catalog.length,1);
  assert.equal(Object.keys(catalog[0].initialEvents).length,3);
});
test('防止 EJS 代码混入和超出资料条数',()=>{
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[{title:'bad',type:'always',content:'<% malicious %>'}]},'艾泽拉斯'),/EJS/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:Array.from({length:71},()=>({title:'x',type:'always',content:'x'}))},'艾泽拉斯'),/70/u);
});
