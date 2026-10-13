// 副本编辑器：章节是蓝灯，种族/势力/组织/冒险区域是绿灯；全部角色定义前。
// 世界设置由开局写入现有 MVU；无需为章节新增时间、阶段或事件字段。
export const SCENARIO_ORDER_START = 101;
export const SCENARIO_MAX_SECTIONS = 70;
export const SCENARIO_ORDER_RANGES = Object.freeze({
  chapter: [101,200],
  race: [201,299],
  force: [302,349],
  organization: [352,399],
  area: [401,499],
});
const MODES=new Set(['both','multi','single']);
const clean=value=>String(value??'').trim();
function text(value,label,max=16000){
  const content=clean(value);
  if(content.length>max)throw new Error(label+'超过'+max+'字');
  if(/<%/u.test(content))throw new Error(label+'不能包含 EJS 代码');
  return content;
}
function safeName(value){return String(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,65);}
function parseCalendar(source){
  const name=text(source.scenario_calendar_name,'历法名称',80);
  const raw=text(source.scenario_calendar_months,'每月天数',160);
  const leap=text(source.scenario_calendar_leap,'闰年规则',160);
  if(!name&&!raw&&!leap)return null;
  const days=raw.split(/[，,;；\s]+/u).filter(Boolean).map(Number);
  if(!name||days.length<1||days.length>24||days.some(n=>!Number.isInteger(n)||n<1||n>99))
    throw new Error('自定义历法需填写名称与1～24个月的有效天数');
  return {名称:name,月份天数:days,闰年规则:leap};
}
function normalizeType(row){
  const type=clean(row?.type);
  if(type==='macro'||type==='event')return 'chapter';
  if(type==='location'||type==='near')return 'area';
  if(type==='faction')return 'race'; // 上个测试版的「阵营资料」实际面向种族和怪物。
  if(type==='always')return 'chapter'; // 旧版常驻正文转换为普通章节，不会永久常驻。
  return Object.hasOwn(SCENARIO_ORDER_RANGES,type)?type:'chapter';
}
function normalizeSections(rows){
  if(!Array.isArray(rows)||!rows.length)throw new Error('请先添加第一章');
  if(rows.length>SCENARIO_MAX_SECTIONS)throw new Error('副本资料最多'+SCENARIO_MAX_SECTIONS+'条');
  const sections=rows.map((row,index)=>{
    const type=normalizeType(row);
    const title=text(row?.title,'第'+(index+1)+'条名称',100);
    let content=text(row?.content,'第'+(index+1)+'条内容');
    const keywords=text(row?.keywords,'第'+(index+1)+'条关键词',1000);
    const location=text(row?.location||row?.match,'第'+(index+1)+'条区域',160);
    // 已保存的旧版资料不会因移除日期和前因输入而丢掉作者写过的设定。
    if(row?.type==='macro'||row?.type==='event'){
      const oldTime=text(row?.time,'旧章节日期',160);
      const oldCondition=text(row?.condition,'旧章节条件',260);
      if(oldTime&&!content.includes(oldTime))content='【时间参考】'+oldTime+'\n'+content;
      if(oldCondition&&!content.includes(oldCondition))content+=' \n【剧情参考】'+oldCondition;
    }
    if(!title||!content)throw new Error('第'+(index+1)+'条资料需要名称与正文');
    return {title,type,content,keywords,location};
  });
  if(!sections.some(row=>row.type==='chapter'))throw new Error('副本至少需要第一章');
  const usedNames=new Set();
  const counts={};
  for(const row of sections){
    if(usedNames.has(row.title))throw new Error('资料名称不能重复：'+row.title);
    if(['__proto__','constructor','prototype'].includes(row.title))throw new Error('请不要使用保留名称');
    usedNames.add(row.title);
    counts[row.type]=(counts[row.type]||0)+1;
    const [start,end]=SCENARIO_ORDER_RANGES[row.type];
    if(counts[row.type]>end-start+1)throw new Error('「'+row.type+'」分类已超过顺序范围 '+start+'–'+end);
  }
  return sections;
}
export function orderedScenarioMacros(rows){
  return (rows||[]).filter(row=>normalizeType(row)==='chapter');
}
export function scenarioEventRecords(scenario,{max=5}={}){
  const chapters=orderedScenarioMacros(scenario.sections||[]).slice(0,max);
  const records={};
  chapters.forEach((chapter,index)=>{
    const previous=chapters[index-1]?.title||'';
    records[chapter.title]={
      分类:'宏观节点',状态:index===0?'进行中':'待发生',
      描述:chapter.content.slice(0,140),时间:index===0?(scenario.time||''):(previous+'之后'),
      条件:previous?'上一章节推进到此处':'按当前剧情自然发展',
      前因:previous?[previous]:[],默认走向:chapter.content.slice(0,200),
      结果:'',公开征兆:'',地点:'',参与者:[],关联任务:[],可见影响:[],
    };
  });
  return records;
}
function keywordList(row){
  const candidates=[row.title,...(row.type==='area'&&row.location?[row.location]:[]),
    ...String(row.keywords||'').split(/[,，、;；\n]+/u)];
  return [...new Set(candidates.map(clean).filter(Boolean))].slice(0,32);
}
function commonGuard(world){
  return 'String(__w.名称||"")==='+JSON.stringify(world)
    +' && _.get(__rw,"系统状态.是否在主神空间",false)!==true'
    +' && !["已通关","副本通关","副本结束","剧情完结","已完结"].includes(String(_.get(__w,"因果轨道.当前阶段","")).trim())';
}
function chapterExpression(title,names){
  // 只看已有的「当前阶段」；允许阶段是带章节名称的自然语言描述，不增加硬性 AI 验收。
  // 优先完全匹配，避免名称存在包含关系时多个蓝灯章节同时出现。
  const titles=JSON.stringify(names);
  return '(function(){ const __stage=String(_.get(__w,"因果轨道.当前阶段","")||"").trim();'
    +'const __titles='+titles+';'
    +'const __exact=__titles.find(name=>name===__stage);'
    +'const __partial=__titles.filter(name=>__stage.includes(name)).sort((a,b)=>b.length-a.length)[0];'
    +'const __active=__exact||__partial||((!__stage||__stage==="待初始化")?__titles[0]:"");'
    +'return __active==='+JSON.stringify(title)+'; })()';
}
function entry(name,world,content,condition,order,keywords=[]){
  return {
    name,enabled:true,
    strategy:{type:keywords.length?'selective':'constant',keys:keywords,
      keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},
    position:{type:'before_character_definition',role:'system',order},
    content:[
      '<%_',
      'const __rw=getMessageVar("stat_data",{defaults:{}})||{};',
      'const __w=_.get(__rw,"世界",{});',
      'if(('+commonGuard(world)+') && ('+condition+')){',
      '_%>',content,'<%_ } _%>',
    ].join('\n'),
    probability:100,recursion:{prevent_incoming:true,prevent_outgoing:true},
    extra:{reincarnationWorkshop:{scenario:true,scenarioWorld:world}},
  };
}
export function buildScenarioArtifacts(source,projectName){
  const world=text(source.scenario_world,'副本世界名称',80);
  if(!world)throw new Error('请填写世界名称');
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
  const calendar=parseCalendar(source);
  const sections=normalizeSections(source.scenario_sections||[]);
  const chapters=orderedScenarioMacros(sections);
  const names=chapters.map(row=>row.title);
  const stage=names[0],story=names.join(' -> '),next=names[1]||'';
  const counters={chapter:0,race:0,force:0,organization:0,area:0};
  const entries=[];
  for(const row of sections){
    const [base]=SCENARIO_ORDER_RANGES[row.type];
    const order=base+counters[row.type]++;
    const isChapter=row.type==='chapter';
    const category={chapter:'原著章节',race:'种族资料',force:'势力资料',
      organization:'组织资料',area:'冒险区域'}[row.type];
    const body='【'+category+'】'+row.title+'\n'+row.content;
    entries.push(entry('[副本] '+world+' · '+row.title,world,body,
      isChapter?chapterExpression(row.title,names):'true',order,
      isChapter?[]:keywordList(row)));
  }
  entries.sort((a,b)=>a.position.order-b.position.order);
  const data={schema_version:1,kind:'scenario',world,time,stage,story,next,
    mode,laws,identity,calendar,rank,tier,location,currency,sections};
  data.initialEvents=scenarioEventRecords(data);
  return [
    {kind:'worldbook',name:safeName(projectName||world)+'.scenario.worldbook.json',
      format:'json',content:{entries}},
    {kind:'data',name:safeName(projectName||world)+'.scenario.json',format:'json',content:data},
  ];
}
export function scenarioInitialValues(artifacts){
  const data=artifacts.find(row=>row?.kind==='data'&&row.content?.kind==='scenario')?.content;
  if(!data)return {};
  const sections=(data.sections||[]).map(row=>{
    // 世界书内容由原数据重建；兼容上一轮测试版的章名与时间字段。
    if(row.type==='macro'||row.type==='event'){
      let content=String(row.content||'');
      if(row.time&&!content.includes(row.time))content='【时间参考】'+row.time+'\n'+content;
      if(row.condition&&!content.includes(row.condition))content+='\n【剧情参考】'+row.condition;
      return {...row,type:'chapter',content};
    }
    return {...row,type:normalizeType(row)};
  });
  return {
    scenario_world:data.world||'',scenario_time:data.time||'',scenario_laws:data.laws||'',
    scenario_identity:data.identity||'',scenario_mode:data.mode||'both',
    scenario_rank:data.rank||'Ⅲ',scenario_tier:data.tier||'F~D',
    scenario_location:data.location||'',
    scenario_currency_system:data.currency?.体系||'',
    scenario_currency_purchasing:data.currency?.购买力基准||'',
    scenario_currency_fluctuation:data.currency?.经济波动||'',
    scenario_calendar_name:data.calendar?.名称||'',
    scenario_calendar_months:Array.isArray(data.calendar?.月份天数)?data.calendar.月份天数.join(','):'',
    scenario_calendar_leap:data.calendar?.闰年规则||'',
    scenario_sections:structuredClone(sections),
  };
}
