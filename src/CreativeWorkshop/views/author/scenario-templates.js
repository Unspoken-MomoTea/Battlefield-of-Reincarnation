// 副本是世界书 + 现有世界后台事件的数据来源，不创建新的 MVU 剧情字段。
export const SCENARIO_ORDER_START = 200;
export const SCENARIO_MAX_SECTIONS = 70;
const SECTION_TYPES = new Set(['macro','location','always']);
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
function parseCalendar(source) {
  const name=text(source.scenario_calendar_name,'历法名称',80);
  const raw=text(source.scenario_calendar_months,'每月天数',160);
  const leap=text(source.scenario_calendar_leap,'闰年规则',160);
  if(!name&&!raw&&!leap)return null;
  const days=raw.split(/[，,;；\s]+/u).filter(Boolean).map(Number);
  if(!name||days.length<1||days.length>24||days.some(n=>!Number.isInteger(n)||n<1||n>99))
    throw new Error('自定义历法需填写名称与1～24个月的有效天数');
  return {名称:name,月份天数:days,闰年规则:leap};
}
function customDateValid(value,calendar) {
  if(!calendar)return false;
  const m=clean(value).match(/^(\d{1,4})年[- ]?(\d{1,2})月[- ]?(\d{1,2})日/u);
  if(!m)return false;
  const month=Number(m[2]),day=Number(m[3]);
  return month>=1&&month<=calendar.月份天数.length&&day>=1&&day<=calendar.月份天数[month-1];
}
function keywordList(row) {
  const candidates=[row.title, ...(row.type==='location'?[row.location]:[]),
    ...String(row.keywords||'').split(/[,，、;；\n]+/u)];
  return [...new Set(candidates.map(clean).filter(Boolean))].slice(0,32);
}
function dateExpression(row, calendar) {
  if(row.timeType!=='date'||!row.time)return 'true';
  // 时间字符串为作品时期时不能比较，退回关键词选择；不因未知时间封死副本。
  const key=dateKey(row.time)||(customDateValid(row.time,calendar)
    ? String(row.time).match(/^(\d{1,4})年[- ]?(\d{1,2})月[- ]?(\d{1,2})日/u).slice(1,4)
      .map((n,i)=>n.padStart(i===0?4:2,'0')).join('-') : '');
  return key?'(!__rwDate || __rwDate >= '+JSON.stringify(key)+')':'true';
}
function entry(name, world, content, expression, order, keywords=[]) {
  return {
    name, enabled:true,
    strategy:{type:keywords.length?'selective':'constant',keys:keywords,keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},
    position:{type:'before_character_definition',role:'system',order},
    content:[
      '<%_',
      'const __rw = getMessageVar("stat_data", { defaults: {} }) || {};',
      'const __w = _.get(__rw, "世界", {});',
      'const __m = String(__w.时间||"").match(/(\\d{1,4})年[- ]?(\\d{1,2})月[- ]?(\\d{1,2})日|(\\d{4})-(\\d{2})-(\\d{2})/);',
      'const __rwDate = __m ? [__m[1]||__m[4],__m[2]||__m[5],__m[3]||__m[6]].map((n,i)=>String(n).padStart(i?2:4,"0")).join("-") : "";',
      'if (String(__w.名称 || "") === '+JSON.stringify(world)+' && ('+expression+')) {',
      '_%>',
      content,
      '<%_ } _%>',
    ].join('\n'),
    probability:100, recursion:{prevent_incoming:true,prevent_outgoing:true},
    extra:{reincarnationWorkshop:{scenario:true,scenarioWorld:world}},
  };
}
function normalizeSections(rows, calendar) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('至少添加一条副本资料');
  if(rows.length>SCENARIO_MAX_SECTIONS)throw new Error('副本资料最多'+SCENARIO_MAX_SECTIONS+'条');
  const result=rows.map((source,index)=>{
    const title=text(source?.title,'第'+(index+1)+'条名称',100);
    const content=text(source?.content,'第'+(index+1)+'条内容');
    const type=SECTION_TYPES.has(source?.type)?source.type:source?.type==='event'?'macro':source?.type==='near'?(source?.location||source?.match?'location':'always'):'always';
    const timeType=TIME_TYPES.has(source?.timeType)?source.timeType:'phase';
    const time=text(source?.time,'第'+(index+1)+'条时间',160);
    const after=text(source?.after,'第'+(index+1)+'条前因',100);
    const location=text(source?.location|| (type==='location'?source?.match:''),'第'+(index+1)+'条地点',160);
    const condition=text(source?.condition,'第'+(index+1)+'条条件',260);
    const keywords=text(source?.keywords,'第'+(index+1)+'条关键词',1000);
    if(!title||!content)throw new Error('第'+(index+1)+'条资料缺少名称或内容');
    if(timeType==='date'&&time&&!dateKey(time)&&!customDateValid(time,calendar))throw new Error('「'+title+'」的日期格式应为 年-月-日，可改为作品时期');
    if(type==='location'&&!location)throw new Error('「'+title+'」需要填写关联地区');
    return {title,type,content,timeType,time,after,location,condition,keywords};
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
function sceneExpression(row,calendar) {
  const date=dateExpression(row,calendar);
  if(row.type==='always')return 'true';
  if(row.type==='location'){
    const place=JSON.stringify(row.location);
    const placeCheck='(!String(__w.地点||"").trim() || String(__w.地点||"")==="待初始化"'
      +' || String(__w.地点||"").includes('+place+') || '+place+'.includes(String(__w.地点||"")))';
    return '('+placeCheck+' && '+date+')';
  }
  const title=JSON.stringify(row.title);
  const state='String(_.get(__w,["后台","事件",'+title+',"状态"],""))';
  // 世界推进关闭时事件可永远是“待发生”：不能将其当作强制门禁。
  // 已发生真实因果优先；进行中允许早于原著日期发生。
  return '(!["已完成","已取消"].includes('+state+') && ('
    +state+'==="进行中" || '+date+'))';
}
export function buildScenarioArtifacts(source, projectName) {
  const world=text(source.scenario_world,'副本世界名称',80);
  const time=text(source.scenario_time,'初始时间锚点',160);
  const laws=text(source.scenario_laws,'世界法则',1200);
  const location=text(source.scenario_location,'初始地点',160);
  const rank=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'].includes(source.scenario_rank)?source.scenario_rank:'Ⅲ';
  const tier=text(source.scenario_tier,'副本难度范围',50)||'F~D';
  const currency={
    体系:text(source.scenario_currency_system,'货币体系',1000),
    购买力基准:text(source.scenario_currency_purchasing,'购买力基准',1500),
    经济波动:text(source.scenario_currency_fluctuation,'经济波动',1500),
  };
  const identity=text(source.scenario_identity,'切入身份',160);
  const mode=MODES.has(source.scenario_mode)?source.scenario_mode:'both';
  if(!world)throw new Error('请填写副本世界名称（写入 MVU 的 世界.名称），不能只填写工坊作品标题');
  const calendar=parseCalendar(source);
  const sections=normalizeSections(source.scenario_sections||[],calendar);
  const macros=orderedScenarioMacros(sections);
  const current=macros.filter(row=>dateKey(time)&&dateKey(row.time)&&dateKey(row.time)<=dateKey(time)).at(-1);
  const future=macros.filter(row=>!dateKey(time)||!dateKey(row.time)||dateKey(row.time)>dateKey(time));
  const initialTime=time; // 作者留空时间锚点时，不从未来事件杜撰开局日期。
  const stage=current?.title||future[0]?.title||'待初始化';
  const initialFive=[...new Set([...(current?[current.title]:[]),...future.map(row=>row.title)])].slice(0,5);
  const story=initialFive.join(' -> '); // 一两个宏观节点也可开局，后续由世界推进补全。
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
    entry('[副本] '+world+' · 基础',world,[
      '【世界名称】'+world,
      '【世界初始地区】'+(location||'由开局决定'),
      '【世界法则】'+(laws||'依当前世界设定'),
      '【货币体系】'+(currency.体系||'由当前世界经济设定决定'),
      currency.购买力基准?'【购买力基准】'+currency.购买力基准:'',
      currency.经济波动?'【经济波动】'+currency.经济波动:'',
      '【切入身份】'+(identity||'自由切入'),
    ].filter(Boolean).join('\n'),'true',200),
    { ...entry('[副本] '+world+' · 近期年表',world,'', 'false',201),content:indexScript },
  ];
  sections.forEach((row,index)=>{
    const content=row.type==='macro'?'【原著事件】'+row.title+'\n【原定时间】'+(row.time||row.after+'之后')+'\n【原定情节】\n'+row.content:
      '【'+(row.type==='location'?'地区资料':'世界资料')+'】'+row.title+'\n'+row.content;
    entries.push(entry('[副本] '+world+' · '+row.title,world,content,sceneExpression(row,calendar),210+index,
      row.type==='always'?[]:keywordList(row)));

  });
  const data={schema_version:1,kind:'scenario',world,time:initialTime,stage,story,next,
    mode,laws,identity,calendar,rank,tier,location,currency,sections};
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
    if(row.type==='event')return {title:row.title,type:'macro',content:row.content,timeType:'phase',time:'',after:'',location:'',condition:'',keywords:''};
    if(row.type==='near')return {...row,type:row.location||row.match?'location':'always'};
    return row;
  });
  return {scenario_world:data.world||'',scenario_time:data.time||'',scenario_laws:data.laws||'',
    scenario_identity:data.identity||'',scenario_mode:data.mode||'both',
    scenario_rank:data.rank||'Ⅲ',scenario_tier:data.tier||'F~D',
    scenario_location:data.location||'',
    scenario_currency_system:data.currency?.体系||'',
    scenario_currency_purchasing:data.currency?.购买力基准||'',
    scenario_currency_fluctuation:data.currency?.经济波动||'',
    scenario_calendar_name:data.calendar?.名称||'',
    scenario_calendar_months:Array.isArray(data.calendar?.月份天数)?data.calendar.月份天数.join(','):'',
    scenario_calendar_leap:data.calendar?.闰年规则||'',
    scenario_sections:structuredClone(sections)};
}
