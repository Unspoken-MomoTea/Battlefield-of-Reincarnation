// 副本作者编辑章节与世界资料：章节次序生成因果轨道，章节内容可以自由描写时间与事件。
function element(doc,tag,label='',className='') {
  const el=doc.createElement(tag);
  if(label)el.textContent=label;
  if(className)el.className=className;
  return el;
}
function control(doc,name,value='',area=false,placeholder=''){
  const el=element(doc,area?'textarea':'input','',area?'rw-textarea':'rw-input');
  el.name=name;el.value=value||'';el.placeholder=placeholder;
  if(area)el.rows=3;
  return el;
}
function picker(doc,name,values,selected) {
  const select=element(doc,'select','','rw-select');select.name=name;
  for(const [value,label] of values){
    const option=element(doc,'option',label);option.value=value;option.selected=value===selected;select.append(option);
  }
  return select;
}
function field(doc,label,input,hint=''){
  const wrapper=element(doc,'label','','rw-field');
  wrapper.append(element(doc,'span',label),input);
  if(hint)wrapper.append(element(doc,'small',hint));
  return wrapper;
}
function bindCalendar(doc,textInput){
  const row=element(doc,'div','','rw-scenario-calendar');
  row.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  const date=element(doc,'input','','rw-input');date.type='date';date.title='通过日历选择公历日期';
  date.style.cssText='min-width:140px;flex:1';
  const match=String(textInput.value||'').match(/(\d{1,4})年[- ]?(\d{1,2})月[- ]?(\d{1,2})日/);
  if(match)date.value=match[1].padStart(4,'0')+'-'+match[2].padStart(2,'0')+'-'+match[3].padStart(2,'0');
  date.addEventListener('change',()=>{
    if(date.value){
      const [year,month,day]=date.value.split('-');
      textInput.value=year+'年-'+month+'月-'+day+'日-上午';
      textInput.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  const note=element(doc,'small','可选，不选日期也能保存','rw-muted');
  row.append(date,note);
  return row;
}
export function createScenarioEditor({doc,initial={},onChange=null}) {
  const root=element(doc,'div','','rw-scenario-editor');
  const notify=()=>{try{onChange?.();}catch{}};
  root.append(element(doc,'p','世界初始信息写入现有 MVU。第一章自动成为「当前阶段」，后续章节按编辑顺序生成「故事线」。章节蓝灯只依据世界名称与当前阶段输出；其余资料为绿灯关键词。','rw-muted'));
  const mode=picker(doc,'scenario_mode',[['both','多元副本与单一世界'],['multi','仅多元副本'],['single','仅单一世界']],initial.scenario_mode||'both');
  const worldName=control(doc,'scenario_world',initial.scenario_world||'',false,'例如：艾泽拉斯（独立于工坊作品标题）');
  const rank=picker(doc,'scenario_rank',['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'].map(v=>[v,v]),initial.scenario_rank||'Ⅲ');
  const tier=control(doc,'scenario_tier',initial.scenario_tier||'F~D',false,'例如：F~D');
  const location=control(doc,'scenario_location',initial.scenario_location||'',false,'例如：东部王国-洛丹伦');
  const moneySystem=control(doc,'scenario_currency_system',initial.scenario_currency_system||'',false,'例如：铜币、银币、金币；100铜=1银，100银=1金');
  const purchasing=control(doc,'scenario_currency_purchasing',initial.scenario_currency_purchasing||'',true,'例如：普通旅店住宿每晚约1银币');
  const fluctuation=control(doc,'scenario_currency_fluctuation',initial.scenario_currency_fluctuation||'',true,'例如：战争时期粮食价格明显上涨');
  const laws=control(doc,'scenario_laws',initial.scenario_laws,true,'世界特殊法则，以分号分隔（可留空）');
  const identity=control(doc,'scenario_identity',initial.scenario_identity,false,'例如：洛丹伦旅行者');
  const start=control(doc,'scenario_time',initial.scenario_time,false,'具体日期、作品纪年或剧情时期');
  const calendarDetails=element(doc,'details','','rw-scenario-custom-calendar');
  calendarDetails.style.marginBlock='8px';
  calendarDetails.append(element(doc,'summary','自定义作品历法（可选）'));
  const calendarName=control(doc,'scenario_calendar_name',initial.scenario_calendar_name||'',false,'例如：艾泽拉斯历');
  const calendarMonths=control(doc,'scenario_calendar_months',initial.scenario_calendar_months||'',false,'例如：31,28,31,30,31,30,31,31,30,31,30,31');
  const calendarLeap=control(doc,'scenario_calendar_leap',initial.scenario_calendar_leap||'',false,'例如：每四年增加一天');
  calendarDetails.append(field(doc,'历法名称',calendarName),field(doc,'每月天数',calendarMonths,'1～24个月，用逗号隔开。'),
    field(doc,'闰年规则',calendarLeap));
  calendarDetails.open=Boolean(calendarName.value||calendarMonths.value||calendarLeap.value);

  root.append(
    element(doc,'div','世界初始信息 · MVU','rw-publish-step-title'),
    field(doc,'世界名称 *',worldName,'例如「艾泽拉斯」；不能直接以工坊作品标题代替。'),
    field(doc,'适用开局模式',mode),
    field(doc,'世界位格',rank),
    field(doc,'副本难度范围',tier,'示例 F~D；写入现有 世界.难度。'),
    field(doc,'初始地点',location,'可选；留空表示由开局 AI 安排地点。'),
    field(doc,'货币体系',moneySystem,'写入 世界.货币.体系；可留空。'),
    field(doc,'购买力基准',purchasing,'写入 世界.货币.购买力基准；可留空。'),
    field(doc,'经济波动',fluctuation,'写入 世界.货币.经济波动；可留空。'),
    field(doc,'世界法则',laws,'副本独特规则；已有通用规则无需重复填写。'),
    field(doc,'切入身份',identity),
    field(doc,'开局时间（可选）',start,'这里仅初始化世界时间；每章的时间、情节、前因都直接写在章节内容里。'),
    bindCalendar(doc,start), calendarDetails,
  );
  const title=element(doc,'div','章节与世界书资料','rw-publish-step-title');
  const help=element(doc,'p','章节：蓝灯 · 101–200；种族：绿灯 · 201–299；势力：绿灯 · 302–349；组织：绿灯 · 352–399；冒险区域：绿灯 · 401–499。全部位于角色定义前，不需要单独设置章节日期。','rw-muted');
  const list=element(doc,'div','','rw-scenario-section-list');
  const add=element(doc,'button','＋ 新增章节 / 资料','rw-button');add.type='button';
  const storyPreview=element(doc,'p','','rw-muted');
  root.append(title,help,list,add,storyPreview);
  const cards=[];
  const types=[
    ['chapter','章节（蓝灯）'],['race','种族（绿灯）'],['force','势力（绿灯）'],
    ['organization','组织（绿灯）'],['area','冒险区域（绿灯）'],
  ];
  const ranges={chapter:101,race:201,force:302,organization:352,area:401};
  function syncCards(){
    const counters={chapter:0,race:0,force:0,organization:0,area:0};
    const chapterNames=[];
    cards.forEach(card=>{
      const type=card.querySelector('[name="scenario_section_type"]').value;
      const order=ranges[type]+counters[type]++;
      card.querySelector('[data-scenario-label]').textContent=(type==='chapter'?'章节':'资料')+' · 顺序 '+order;
      if(type==='chapter'){
        const name=card.querySelector('[name="scenario_section_title"]').value.trim();
        if(name)chapterNames.push(name);
      }
    });
    storyPreview.textContent=chapterNames.length
      ?'开局当前阶段：'+chapterNames[0]+'　|　故事线：'+chapterNames.join(' → ')
      :'请至少添加一个章节，第一章的名称会成为开局当前阶段。';
    notify();
  }
  function legacyType(type,value){
    if(type==='macro'||type==='event'||type==='always')return 'chapter';
    if(type==='faction')return 'race';
    if(type==='near'||type==='location')return 'area';
    return ranges[type]===undefined?'chapter':type;
  }
  function appendCard(value={},withChange=true){
    if(cards.length>=70)return;
    const type=legacyType(value.type,value);
    const card=element(doc,'div','','rw-opening-equipment-card');
    card.style.marginBlock='10px';
    const head=element(doc,'div','','rw-opening-skill-head');
    const label=element(doc,'strong','');
    label.setAttribute('data-scenario-label','');
    const up=element(doc,'button','↑','rw-button');up.title='前移';up.type='button';
    const down=element(doc,'button','↓','rw-button');down.title='后移';down.type='button';
    const del=element(doc,'button','删除','rw-button danger');del.type='button';
    head.append(label,up,down,del);
    const name=control(doc,'scenario_section_title',value.title||'',false,'例如：斯坦索姆抉择');
    const kind=picker(doc,'scenario_section_type',types,type);
    let bodyValue=String(value.content||'');
    if(value.type==='macro'||value.type==='event'){
      if(value.time&&!bodyValue.includes(value.time))bodyValue='【时间参考】'+value.time+'\n'+bodyValue;
      if(value.condition&&!bodyValue.includes(value.condition))bodyValue+='\n【剧情参考】'+value.condition;
    }
    const body=control(doc,'scenario_section_content',bodyValue,true,'本章可自由写时间、事件、人物、剧情走向，或填写种族/势力/组织/区域设定');
    body.rows=5;
    const keywords=control(doc,'scenario_section_keywords',value.keywords||'',false,'例如：部落,兽人,萨满');
    const keyField=field(doc,'绿灯关键词（可选）',keywords,'自动包含资料名称，额外填写别称即可。');
    const areaAlias=control(doc,'scenario_section_location',value.location||value.match||'',false,'例如：东部王国-洛丹伦');
    const aliasField=field(doc,'区域别名（可选）',areaAlias,'也会作为绿灯关键词。');
    card.append(head,field(doc,'资料类型',kind),field(doc,'名称 *',name),
      field(doc,'正文 *',body),keyField,aliasField);
    function visibility(){
      keyField.hidden=kind.value==='chapter';
      aliasField.hidden=kind.value!=='area';
    }
    kind.addEventListener('change',()=>{visibility();syncCards();});
    up.addEventListener('click',()=>{
      const i=cards.indexOf(card);
      if(i>0){cards.splice(i,1);cards.splice(i-1,0,card);list.append(...cards);syncCards();}
    });
    down.addEventListener('click',()=>{
      const i=cards.indexOf(card);
      if(i>=0&&i<cards.length-1){cards.splice(i,1);cards.splice(i+1,0,card);list.append(...cards);syncCards();}
    });
    del.addEventListener('click',()=>{
      const i=cards.indexOf(card);
      if(i>=0){cards.splice(i,1);card.remove();syncCards();}
    });
    list.append(card);cards.push(card);visibility();
    if(withChange)syncCards();
  }
  if(initial.scenario_sections?.length){
    for(const value of initial.scenario_sections)appendCard(value,false);
  } else {
    appendCard({type:'chapter'},false);
  }
  add.addEventListener('click',()=>appendCard({type:'chapter'}));
  root.addEventListener('input',syncCards);
  root.addEventListener('change',notify);
  syncCards();
  return {node:root,values(){
    return {
      scenario_world:worldName.value,scenario_mode:mode.value,scenario_time:start.value,
      scenario_rank:rank.value,scenario_tier:tier.value,scenario_location:location.value,
      scenario_currency_system:moneySystem.value,scenario_currency_purchasing:purchasing.value,
      scenario_currency_fluctuation:fluctuation.value,
      scenario_laws:laws.value,scenario_identity:identity.value,
      scenario_calendar_name:calendarName.value,scenario_calendar_months:calendarMonths.value,
      scenario_calendar_leap:calendarLeap.value,
      scenario_sections:cards.map(card=>({
        title:card.querySelector('[name="scenario_section_title"]').value,
        type:card.querySelector('[name="scenario_section_type"]').value,
        content:card.querySelector('[name="scenario_section_content"]').value,
        keywords:card.querySelector('[name="scenario_section_keywords"]').value,
        location:card.querySelector('[name="scenario_section_location"]').value,
      })),
    };
  }};
}
