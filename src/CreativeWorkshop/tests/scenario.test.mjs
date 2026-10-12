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
  scenario_world:'艾泽拉斯',scenario_rank:'Ⅳ',scenario_tier:'D~A',
  scenario_location:'东部王国-洛丹伦',
  scenario_currency_system:'铜币、银币、金币；100铜=1银，100银=1金',
  scenario_currency_purchasing:'旅店每晚1银币',
  scenario_currency_fluctuation:'战争时期粮食涨价',
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
  assert.equal(data.rank,'Ⅳ');
  assert.equal(data.tier,'D~A');
  assert.equal(data.location,'东部王国-洛丹伦');
  assert.equal(data.currency.体系,sample.scenario_currency_system);
  assert.equal(data.currency.购买力基准,sample.scenario_currency_purchasing);
  assert.equal(data.currency.经济波动,sample.scenario_currency_fluctuation);
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
  assert.equal(entries[3].strategy.type,'selective');
  assert.deepEqual(entries[3].strategy.keys,['斯坦索姆抉择']);
  assert.equal(entries[5].strategy.type,'selective');
  assert.deepEqual(entries[5].strategy.keys,['洛丹伦']);
  assert.ok(entries[3].content.includes('__rwDate'));
  assert.match(entries[0].content,/【世界名称】艾泽拉斯/);
  assert.match(entries[0].content,/【货币体系】铜币、银币、金币/);
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
  assert.equal(initial.scenario_world,sample.scenario_world);
  assert.equal(initial.scenario_rank,'Ⅳ');
  assert.equal(initial.scenario_tier,'D~A');
  assert.equal(initial.scenario_location,sample.scenario_location);
  assert.equal(initial.scenario_currency_system,sample.scenario_currency_system);
  assert.equal(initial.scenario_currency_purchasing,sample.scenario_currency_purchasing);
  assert.equal(initial.scenario_currency_fluctuation,sample.scenario_currency_fluctuation);
  assert.deepEqual(initial.scenario_sections,sections.map(row=>({
    ...row, timeType:row.timeType||'phase', time:row.time||'',after:row.after||'',location:row.location||'',condition:row.condition||'',keywords:'',
  })));
  const plan=buildArtifactPlan({id:'pkg',name:'艾泽拉斯',version:1,bundle:{schema_version:1,artifacts}});
  assert.ok(plan.worldbook.every(row=>row.extra.reincarnationWorkshop.scenario));
  const catalog=projectScenarioCatalog([
    {id:'one',name:'艾泽拉斯',applied:true,bundle:{schema_version:1,artifacts}},
    {id:'two',name:'艾泽拉斯',applied:false,bundle:{schema_version:1,artifacts}},
  ]);
  assert.equal(catalog.length,1);
  assert.equal(Object.keys(catalog[0].initialEvents).length,3);
  assert.equal(catalog[0].currency.体系,sample.scenario_currency_system);
  assert.equal(catalog[0].rank,'Ⅳ');
  assert.equal(catalog[0].tier,'D~A');
});
test('自定义历法可使用现有世界.历法字段，包含第13个月的作品日期',()=>{
  const custom=buildScenarioArtifacts({
    ...sample,
    scenario_calendar_name:'异界历',
    scenario_calendar_months:Array(13).fill(30).join(','),
    scenario_calendar_leap:'每十年增一天',
    scenario_time:'303年-13月-1日',
    scenario_sections:[{title:'异界王朝',type:'macro',timeType:'date',time:'303年-13月-2日',content:'王朝转折'}],
  },'自定义世界');
  assert.equal(custom[1].content.calendar.名称,'异界历');
  assert.equal(custom[1].content.calendar.月份天数.length,13);
  const reopened=dedicatedInitialValues(custom,'scenario');
  assert.equal(reopened.scenario_calendar_name,'异界历');
  assert.equal(reopened.scenario_calendar_months,Array(13).fill(30).join(','));
});
test('世界名称必须独立填写；日历和资料日期完全可选，两个宏观节点也可生成故事线',()=>{
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_world:''},'工坊作品标题'),/副本世界名称/u);
  const bundle=buildScenarioArtifacts({
    scenario_world:'艾泽拉斯',scenario_time:'',
    scenario_sections:[
      {title:'瘟疫扩散',type:'macro',content:'天灾开始'},
      {title:'斯坦索姆抉择',type:'macro',content:'玩家可改变历史'},
    ],
  },'魔兽世界工坊作品');
  assert.equal(bundle[1].content.world,'艾泽拉斯');
  assert.equal(bundle[1].content.time,'');
  assert.equal(bundle[1].content.calendar,null);
  assert.equal(bundle[1].content.story,'瘟疫扩散 -> 斯坦索姆抉择');
  const ui=readFileSync(new URL('../views/author/scenario-editor.js',import.meta.url),'utf8');
  for(const field of ['scenario_world','scenario_rank','scenario_tier','scenario_location',
    'scenario_currency_system','scenario_currency_purchasing','scenario_currency_fluctuation']) {
    assert.ok(ui.includes(field),'编辑器必须展示现有世界 MVU 初始化项：'+field);
  }
  assert.match(ui,/可选，不选日期也能保存/);
});
test('地区与宏观剧情是绿灯，并能在不运行世界推进时由 EJS 日期独立筛选',()=>{
  const b=buildScenarioArtifacts({
    scenario_world:'艾泽拉斯',scenario_time:'2026年-10月-12日',
    scenario_sections:[
      {title:'斯坦索姆抉择',type:'macro',timeType:'date',time:'2026年-10月-14日',keywords:'斯坦索姆,阿尔萨斯',content:'王子面临抉择'},
      {title:'洛丹伦',type:'location',timeType:'date',time:'2026年-10月-13日',location:'东部王国-洛丹伦',content:'洛丹伦王国资料'},
      {title:'魔法法则',type:'always',content:'圣光与魔法存在'},
    ],
  },'魔兽世界');
  const [macro,region,always]=b[0].content.entries.slice(2);
  assert.equal(macro.strategy.type,'selective');
  assert.deepEqual(macro.strategy.keys,['斯坦索姆抉择','斯坦索姆','阿尔萨斯']);
  assert.equal(region.strategy.type,'selective');
  assert.deepEqual(region.strategy.keys,['洛丹伦','东部王国-洛丹伦']);
  assert.equal(always.strategy.type,'constant');
  // 只模拟已经激活的绿灯 EJS 层，不需要世界推进引擎、后台事件或因果轨道。
  const gate=(entry,world)=>{
    const prefix=entry.content.slice(3,entry.content.indexOf('_%>'));
    const run=new Function('getMessageVar','_',prefix+'return true; } return false;');
    const get=(obj,path,fallback)=>{
      const keys=Array.isArray(path)?path:String(path).split('.');
      const result=keys.reduce((value,k)=>value&&value[k],obj);
      return result===undefined?fallback:result;
    };
    return run(()=>({世界:world}),{get});
  };
  const bare=(time,place='东部王国-洛丹伦')=>({名称:'艾泽拉斯',时间:time,地点:place});
  assert.equal(gate(macro,bare('2026年-10月-13日')),false,'日期未到，不能提前剧透');
  assert.equal(gate(macro,bare('2026年-10月-14日')),true,'无世界推进后台也能激活宏观剧情');
  assert.equal(gate(region,bare('2026年-10月-12日')),false);
  assert.equal(gate(region,bare('2026年-10月-13日')),true);
  assert.equal(gate(region,bare('2026年-10月-13日','卡利姆多')),false);
  assert.equal(gate(region,{...bare('2026年-10月-14日'),名称:'其他世界'}),false);
  assert.equal(gate(macro,{...bare('2026年-10月-12日'),后台:{事件:{'斯坦索姆抉择':{状态:'进行中'}}}}),true,
    '因果偏移提前发生时，真实进行中状态优先');
  assert.equal(gate(macro,{...bare('2026年-10月-14日'),后台:{事件:{'斯坦索姆抉择':{状态:'已取消'}}}}),false);
  assert.equal(gate(macro,bare('第三次战争初期')),true,'无法比较的虚构纪年不应锁死绿灯');
});
test('旧近期事件编辑时软迁为地区/常驻资料，不再出现近期事件创作项',()=>{
  const src=readFileSync(new URL('../views/author/scenario-editor.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/\['near','近期事件资料'\]/);
  assert.match(src,/scenario_section_keywords/);
  const artifacts=buildScenarioArtifacts({...sample,scenario_sections:[
    {title:'瘟疫见闻',type:'near',location:'洛丹伦',content:'历史资料'},
  ]},'魔兽世界');
  assert.equal(artifacts[1].content.sections[0].type,'location');
  assert.equal(artifacts[0].content.entries[2].strategy.type,'selective');
});
test('防止 EJS 代码混入和超出资料条数',()=>{
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[{title:'bad',type:'always',content:'<% malicious %>'}]},'艾泽拉斯'),/EJS/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:Array.from({length:71},()=>({title:'x',type:'always',content:'x'}))},'艾泽拉斯'),/70/u);
});
