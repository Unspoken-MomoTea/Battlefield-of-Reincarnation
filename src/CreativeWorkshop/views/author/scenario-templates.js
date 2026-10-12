// 副本是世界书 + 现有世界后台事件的数据来源，不创建新的 MVU 剧情字段。
export const SCENARIO_ORDER_START = 200;
export const SCENARIO_MAX_SECTIONS = 70;
const SECTION_TYPES = new Set(['macro','near','location','always']);
const TIME_TYPES = new Set(['date','phase','after']);
const MODES = new Set(['both','multi','single']);
const clean = value => String(value ?? '').trim();
function text(value, label, max = 16000) {
  const content = clean(value);
  if (content.length > max) throw new Error(label + '超过' + max + '字');
  if (/<%/u.test(content)) throw new Error(label + '不能包含 EJS 代码');
  return content;
}
function safeName(value) { return String(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,65); }
function dateKey(value) {
  const hit = clean(value).match(/^(\d{1,4})年[- ]?(\d{1,2})月[- ]?(\d{1,2})日|^(\d{4})-(\d\d)-(\d\d)/u);
  if (!hit) return '';
  const y=+(hit[1]||hit[4]),m=+(hit[2]||hit[5]),d=+(hit[3]||hit[6]);
  if(m<1||m>12||d<1||d>31)return '';
  return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function entry(name, world, content, expression, order) {
  return {
    name, enabled:true,
    strategy:{type:'constant',keys:[],keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},
    position:{type:'before_character_definition',role:'system',order},
    content:[
      '<%_',
      'const __rw = getMessageVar("stat_data", { defaults: {} }) || {};',
      'const __w = _.get(__rw, "世界", {});',
      'if (String(__w.名称 || "") === '+JSON.stringify(world)+' && ('+expression+')) {',
      '_%>',
      content,
      '<%_ } _%>',
    ].join('\n'),
    probability:100, recursion:{prevent_incoming:true,prevent_outgoing:true},
    extra:{reincarnationWorkshop:{scenario:true,scenarioWorld:world}},
  };
}
function normalizeSections(rows) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('至少添加一条副本资料');
  if(rows.length>SCENARIO_MAX_SECTIONS)throw new Error('副本资料最多'+SCENARIO_MAX_SECTIONS+'条');
  const result=rows.map((source,index)=>{
    const title=text(source?.title,'第'+(index+1)+'条名称',100);
    const content=text(source?.content,'第'+(index+1)+'条内容');
    const type=SECTION_TYPES.has(source?.type)?source.type:source?.type==='event'?'macro':'always';
    const timeType=TIME_TYPES.has(source?.timeType)?source.timeType:'phase';
    const time=text(source?.time,'第'+(index+1)+'条时间',160);
    const after=text(source?.after,'第'+(index+1)+'条前因',100);
    const location=text(source?.location|| (type==='location'?source?.match:''),'第'+(index+1)+'条地点',160);
    const condition=text(source?.condition,'第'+(index+1)+'条条件',260);
    if(!title||!content)throw new Error('第'+(index+1)+'条资料缺少名称或内容');
    if(timeType==='date'&&time&&!dateKey(time))throw new Error('「'+title+'」的日期格式应为 年-月-日，可改为作品时期');
    if(type==='location'&&!location)throw new Error('「'+title+'」需要填写关联地区');
    return {title,type,content,timeType,time,after,location,condition};
  });
  const names=new Set();
  for(const row of result) {
    if(names.has(row.title))throw new Error('副本资料名称不能重复：'+row.title);
    if(row.title==='__proto__'||row.title==='constructor'||row.title==='prototype')throw new Error('资料名称不可使用保留字');
    names.add(row.title);
  }
  const macros=result.filter(row=>row.type==='macro'),macroNames=new Set(macros.map(row=>row.title));
  for(const row of macros) {
    if(row.timeType==='after'&&!row.after)throw new Error('「'+row.title+'」需要选择前置事件');
    if(row.after && (!macroNames.has(row.after)||row.after===row.title))throw new Error('「'+row.title+'」的前置事件不存在或指向自身');
  }
  const parents=new Map(macros.map(row=>[row.title,row.after]));
  for(const row of macros) {
    const seen=new Set();let name=row.title;
    while(name){if(seen.has(name))throw new Error('宏观剧情存在循环前因：'+name);seen.add(name);name=parents.get(name);}
  }
  return result;
}
export function orderedScenarioMacros(rows) {
  const input=rows.filter(row=>row.type==='macro');
  const sourceIndex=new Map(input.map((row,index)=>[row.title,index]));
  const output=[],pending=new Map(input.map(row=>[row.title,row]));
  while(pending.size) {
    const ready=[...pending.values()].filter(row=>!row.after||!pending.has(row.after));
    if(!ready.length)throw new Error('宏观事件存在循环前因');
    ready.sort((a,b)=> {
      const aKey=dateKey(a.time),bKey=dateKey(b.time);
      return aKey&&bKey ? aKey.localeCompare(bKey) : (aKey?-1:bKey?1:sourceIndex.get(a.title)-sourceIndex.get(b.title));
    });
    const first=ready[0];output.push(first);pending.delete(first.title);
  }
  return output;
}
export function scenarioEventRecords(scenario, {max=5}={}) {
  const macros=orderedScenarioMacros(scenario.sections||[]);
  const initialKey=dateKey(scenario.time);
  const future=macros.filter(row=>!initialKey||!dateKey(row.time)||dateKey(row.time)>=initialKey);
  const current=macros.filter(row=>initialKey&&dateKey(row.time)&&dateKey(row.time)<=initialKey);
  const chosen=[...current.slice(-1),...future].filter((row,index,array)=>array.findIndex(x=>x.title===row.title)===index).slice(0,max);
  const records={};
  let previous='';
  chosen.forEach((row,index)=>{
    const active=index===0&&current.some(e=>e.title===row.title);
    records[row.title]={
      分类:'宏观节点', 状态:active?'进行中':'待发生',
      描述:row.content.slice(0,140),
      时间:row.timeType==='after'?(row.after+'之后'):(row.time|| (previous?previous+'之后':scenario.time||'')),
      条件:row.condition||(row.after?'前置事件「'+row.after+'」具备触发条件':'按照世界当前事实自然发展'),
      前因:row.after&&records[row.after]?[row.after]:(previous?[previous]:[]),
      默认走向:row.content.slice(0,200),结果:'',公开征兆:'',地点:row.location||'',
      参与者:[],关联任务:[],可见影响:[],
    };
    previous=row.title;
  });
  return records;
}
function sceneExpression(row) {
  if(row.type==='always')return 'true';
  if(row.type==='location')return 'String(__w.地点 || "").includes('+JSON.stringify(row.location)+')';
  if(row.type==='near')return 'String(__w.地点 || "").includes('+JSON.stringify(row.location||'__no_location__')+')';
  const title=JSON.stringify(row.title);
  return [
    '(String(_.get(__w,"因果轨道.下一节点","")) === '+title,
    '|| String(_.get(__w,"因果轨道.当前阶段","")) === '+title,
    '|| String(_.get(__w,["后台","事件",'+title+',"状态"],"")) === "进行中")',
    '&& !["已完成","已取消"].includes(String(_.get(__w,["后台","事件",'+title+',"状态"],"")))',
  ].join(' ');
}
export function buildScenarioArtifacts(source, projectName) {
  const world=text(source.scenario_world||projectName,'副本世界名称',80);
  const time=text(source.scenario_time,'初始时间锚点',160);
  const laws=text(source.scenario_laws,'世界法则',1200);
  const identity=text(source.scenario_identity,'切入身份',160);
  const mode=MODES.has(source.scenario_mode)?source.scenario_mode:'both';
  if(!world)throw new Error('请填写工坊作品名称');
  const sections=normalizeSections(source.scenario_sections||[]);
  const macros=orderedScenarioMacros(sections);
  const current=macros.filter(row=>dateKey(time)&&dateKey(row.time)&&dateKey(row.time)<=dateKey(time)).at(-1);
  const future=macros.filter(row=>!dateKey(time)||!dateKey(row.time)||dateKey(row.time)>dateKey(time));
  const initialTime=time||macros[0]?.time||'';
  const stage=current?.title||future[0]?.title||'待初始化';
  const initialFive=[...new Set([...(current?[current.title]:[]),...future.map(row=>row.title)])].slice(0,5);
  const story=initialFive.length>=3?initialFive.join(' -> '):'';
  const next=future[0]?.title||'';
  const catalog=macros.map(row=>({name:row.title,time:row.timeType==='after'?row.after+'之后':row.time,after:row.after}));
  const indexScript=[
    '<%_',
    'const __rw = getMessageVar("stat_data", { defaults: {} }) || {};',
    'const __w = _.get(__rw, "世界", {});',
    'if(String(__w.名称||"")==='+JSON.stringify(world)+'){',
    'const __records=_.get(__w,"后台.事件",{});',
    'const __all='+JSON.stringify(catalog)+';',
    'const __at=String(__w.时间||"").match(/(\\d{1,4})年[- ]?(\\d{1,2})月[- ]?(\\d{1,2})日/);',
    'const __key=__at?(String(__at[1]).padStart(4,"0")+"-"+String(__at[2]).padStart(2,"0")+"-"+String(__at[3]).padStart(2,"0")):"";',
    'const __future=__all.filter(e=>{ const s=String((__records[e.name]||{}).状态||""); if(s==="已完成"||s==="已取消")return false; const d=String(e.time||"").match(/(\\d{1,4})年[- ]?(\\d{1,2})月[- ]?(\\d{1,2})日/); return !__key||!d||(String(d[1]).padStart(4,"0")+"-"+String(d[2]).padStart(2,"0")+"-"+String(d[3]).padStart(2,"0"))>=__key; });',
    'const __next=__future.slice(0,5).map(e=>e.name+"("+e.time+")").join(" → ");',
    'if(__next){ _%>',
    '【原著近期宏观参考（仅供规划，不可强制修正已发生因果）】',
    '<%= __next %>',
    '<%_ } } _%>',
  ].join('\n');
  const entries=[
    entry('[副本] '+world+' · 基础',world,'【世界法则】'+(laws||'依当前世界设定')+'\n【切入身份】'+(identity||'自由切入'), 'true',200),
    { ...entry('[副本] '+world+' · 近期年表',world,'', 'false',201),content:indexScript },
  ];
  sections.forEach((row,index)=>{
    const content=row.type==='macro'?'【原著事件】'+row.title+'\n【原定时间】'+(row.time||row.after+'之后')+'\n【原定情节】\n'+row.content:
      '【'+(row.type==='location'?'地区资料':'世界资料')+'】'+row.title+'\n'+row.content;
    entries.push(entry('[副本] '+world+' · '+row.title,world,content,sceneExpression(row),210+index));
  });
  const data={schema_version:1,kind:'scenario',world,time:initialTime,stage,story,next,
    mode,laws,identity,rank:'Ⅲ',tier:'F~D',sections};
  data.initialEvents=scenarioEventRecords(data);
  return [
    {kind:'worldbook',name:safeName(projectName||world)+'.scenario.worldbook.json',format:'json',content:{entries}},
    {kind:'data',name:safeName(projectName||world)+'.scenario.json',format:'json',content:data},
  ];
}
export function scenarioInitialValues(artifacts) {
  const data=artifacts.find(row=>row?.kind==='data'&&row.content?.kind==='scenario')?.content;
  if(!data)return {};
  const sections=(data.sections||[]).map(row=>{
    if(row.type==='event')return {title:row.title,type:'macro',content:row.content,timeType:'phase',time:'',after:'',location:'',condition:''};
    return row;
  });
  return {scenario_world:data.world||'',scenario_time:data.time||'',scenario_laws:data.laws||'',
    scenario_identity:data.identity||'',scenario_mode:data.mode||'both',scenario_sections:structuredClone(sections)};
}
