import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDedicatedArtifacts,detectPublishMode,dedicatedInitialValues,resolvePublishMode,projectCategoryForSelection} from '../views/author/publish-templates.js';
import {buildScenarioArtifacts,orderedScenarioMacros,SCENARIO_ORDER_RANGES} from '../views/author/scenario-templates.js';
import {normalizeWorldbookArtifact} from '../services/installer/normalize/worldbook.js';
import {buildArtifactPlan} from '../services/installer/plan.js';
import {projectScenarioCatalog} from '../../opening/scenarios/installed.js';

const sections=[
  {title:'亡灵瘟疫扩散',type:'chapter',content:'第三次战争初期，瘟疫蔓延。'},
  {title:'斯坦索姆抉择',type:'chapter',content:'王子与玩家可以改变命运。'},
  {title:'阿尔萨斯北伐',type:'chapter',content:'原著时间和战役均在这里描述。'},
  {title:'人类',type:'race',keywords:'人族',content:'王国历史。'},
  {title:'部落',type:'force',keywords:'兽人',content:'部落势力。'},
  {title:'银色黎明',type:'organization',keywords:'银色黎明组织',content:'反亡灵组织。'},
  {title:'诺森德',type:'area',location:'冰封大陆',keywords:'北境',content:'探险地区。'},
];
const sample={
  scenario_world:'艾泽拉斯',scenario_rank:'Ⅳ',scenario_tier:'D~A',
  scenario_location:'东部王国-洛丹伦',scenario_time:'第三次战争初期',
  scenario_currency_system:'金币、银币、铜币',scenario_currency_purchasing:'旅店一晚1银',
  scenario_currency_fluctuation:'战时涨价',scenario_laws:'魔法存在；亡灵瘟疫会传播',
  scenario_identity:'王国调查员',scenario_sections:sections,
};
const bundle=()=>buildScenarioArtifacts(sample,'魔兽世界');
const get=(obj,path,fallback)=>{
  const keys=Array.isArray(path)?path:String(path).split('.');
  const val=keys.reduce((node,k)=>node&&node[k],obj);
  return val===undefined?fallback:val;
};
const activated=(entry,stage,world='艾泽拉斯',space=false)=>{
  const script=entry.content.slice(3,entry.content.indexOf('_%>'));
  const runner=new Function('getMessageVar','_',script+'return true; } return false;');
  return runner(()=>({世界:{名称:world,因果轨道:{当前阶段:stage}},
    系统状态:{是否在主神空间:space}}),{get});
};
test('发布分类和简化编辑器：无每章日期/前置事件硬要求',()=>{
  assert.equal(resolvePublishMode('scenario'),'scenario');
  assert.equal(projectCategoryForSelection('scenario'),'extension');
  const ui=readFileSync(new URL('../views/author/scenario-editor.js',import.meta.url),'utf8');
  for(const name of ['chapter','race','force','organization','area'])assert.ok(ui.includes("'"+name+"'"));
  assert.doesNotMatch(ui,/scenario_section_time_type|scenario_section_after|scenario_section_condition/);
  assert.match(ui,/date.type='date'/);
  assert.match(ui,/scenario_currency_system/);
});
test('章节顺序自然生成首章、故事线与下一节点，时间写在正文',()=>{
  const [book,{content:data}]=bundle();
  assert.equal(data.stage,'亡灵瘟疫扩散');
  assert.equal(data.next,'斯坦索姆抉择');
  assert.equal(data.story,'亡灵瘟疫扩散 -> 斯坦索姆抉择 -> 阿尔萨斯北伐');
  assert.equal(data.world,'艾泽拉斯');
  assert.equal(data.currency.体系,'金币、银币、铜币');
  assert.equal(data.rank,'Ⅳ');
  assert.equal(data.location,'东部王国-洛丹伦');
  assert.deepEqual(Object.keys(data.initialEvents),['亡灵瘟疫扩散','斯坦索姆抉择','阿尔萨斯北伐']);
  assert.deepEqual(data.initialEvents['斯坦索姆抉择'].前因,['亡灵瘟疫扩散']);
  assert.match(book.content.entries[0].content,/第三次战争初期/);
  assert.deepEqual(orderedScenarioMacros(data.sections).map(x=>x.title),['亡灵瘟疫扩散','斯坦索姆抉择','阿尔萨斯北伐']);
});
test('世界书角色定义前精确分区：101、201、302、352、401',()=>{
  const entries=normalizeWorldbookArtifact(bundle()[0].content);
  assert.deepEqual(SCENARIO_ORDER_RANGES,{
    chapter:[101,200],race:[201,299],force:[302,349],organization:[352,399],area:[401,499],
  });
  assert.deepEqual(entries.map(e=>e.position.order),[101,102,103,201,302,352,401]);
  assert.ok(entries.every(e=>e.position.type==='before_character_definition'));
  assert.deepEqual(entries.map(e=>e.strategy.type),[
    'constant','constant','constant','selective','selective','selective','selective']);
  assert.deepEqual(entries[3].strategy.keys,['人类','人族']);
  assert.deepEqual(entries[4].strategy.keys,['部落','兽人']);
  assert.deepEqual(entries[5].strategy.keys,['银色黎明','银色黎明组织']);
  assert.deepEqual(entries[6].strategy.keys,['诺森德','冰封大陆','北境']);
});
test('世界推进关闭时蓝灯只输出当前章节，允许阶段正文带章名',()=>{
  const entries=normalizeWorldbookArtifact(bundle()[0].content);
  const flags=stage=>entries.slice(0,3).map(x=>activated(x,stage));
  assert.deepEqual(flags('亡灵瘟疫扩散'),[true,false,false]);
  assert.deepEqual(flags('斯坦索姆抉择'),[false,true,false]);
  assert.deepEqual(flags('阿尔萨斯北伐前夕'),[false,false,true]);
  assert.deepEqual(flags('待初始化'),[true,false,false]);
  assert.deepEqual(flags('副本通关'),[false,false,false]);
  assert.equal(activated(entries[1],'斯坦索姆抉择','其他世界'),false);
  assert.ok(entries.every(e=>!activated(e,'斯坦索姆抉择','艾泽拉斯',true)));
  assert.ok(entries.slice(3).every(e=>activated(e,'斯坦索姆抉择')),
    '绿灯EJS只检查世界，正文关键词由酒馆决定');
});
test('章节上移改变第一章与故事线，70章仅初始化五个宏观事件',()=>{
  const reordered=buildScenarioArtifacts({...sample,scenario_sections:[
    sections[2],sections[0],sections[1],...sections.slice(3)]},'魔兽世界');
  assert.equal(reordered[1].content.stage,'阿尔萨斯北伐');
  assert.equal(reordered[1].content.next,'亡灵瘟疫扩散');
  assert.equal(reordered[1].content.story,'阿尔萨斯北伐 -> 亡灵瘟疫扩散 -> 斯坦索姆抉择');
  const chapters=Array.from({length:70},(_,i)=>({type:'chapter',title:'第'+i+'章',content:'情节自由写'}));
  const long=buildScenarioArtifacts({...sample,scenario_sections:chapters},'长篇');
  assert.equal(long[0].content.entries.length,70);
  assert.equal(long[0].content.entries.at(-1).position.order,170);
  assert.equal(Object.keys(long[1].content.initialEvents).length,5);
  assert.equal(long[1].content.story.split(' -> ').length,70);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[
    {type:'chapter',title:'序章',content:'正文'},
    ...Array.from({length:49},(_,i)=>({type:'force',title:'势力'+i,content:'背景'})),
  ]},'世界'),/302–349/u);
});
test('保存回填、安装与开局目录一致，兼容旧宏观资料的日期文字',()=>{
  const artifacts=buildDedicatedArtifacts(sample,'scenario','魔兽世界');
  assert.equal(detectPublishMode('extension',artifacts),'scenario');
  const initial=dedicatedInitialValues(artifacts,'scenario');
  assert.equal(initial.scenario_world,sample.scenario_world);
  assert.equal(initial.scenario_currency_system,sample.scenario_currency_system);
  assert.deepEqual(initial.scenario_sections,sections.map(s=>({...s,keywords:s.keywords||'',location:s.location||''})));
  const plan=buildArtifactPlan({id:'pkg',name:'魔兽世界',version:1,bundle:{schema_version:1,artifacts}});
  assert.ok(plan.worldbook.every(x=>x.extra.reincarnationWorkshop.scenario));
  const catalog=projectScenarioCatalog([{id:'one',name:'魔兽世界',applied:true,bundle:{schema_version:1,artifacts}}]);
  assert.equal(catalog.length,1);
  assert.equal(catalog[0].stage,'亡灵瘟疫扩散');
  const old=buildScenarioArtifacts({...sample,scenario_sections:[
    {type:'macro',title:'瘟疫扩散',time:'第三次战争初期',condition:'守军集结',content:'原著情节'},
  ]},'旧版');
  assert.equal(old[1].content.sections[0].type,'chapter');
  assert.match(old[0].content.entries[0].content,/第三次战争初期/);
  assert.match(old[0].content.entries[0].content,/守军集结/);
});
test('初始历法可选，正文不要求日期；拒绝无首章和注入 EJS 语法',()=>{
  const custom=buildScenarioArtifacts({...sample,scenario_calendar_name:'异界历',
    scenario_calendar_months:Array(13).fill(30).join(','),scenario_sections:sections},'异界');
  assert.equal(custom[1].content.calendar.月份天数.length,13);
  assert.equal(bundle()[1].content.calendar,null);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_world:''},'工坊标题'),/世界名称/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[
    {title:'兽人',type:'race',content:'种族描述'},
  ]},'世界'),/第一章/u);
  assert.throws(()=>buildScenarioArtifacts({...sample,scenario_sections:[
    {title:'序章',type:'chapter',content:'<% malicious %>'},
  ]},'世界'),/EJS/u);
});
