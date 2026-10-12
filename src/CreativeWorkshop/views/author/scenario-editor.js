// 副本作者编辑原著资料：没有手动故事线 / 下一节点，编译器从宏观事件名称生成。
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
  root.append(element(doc,'p','世界基础信息在开局时写入已有 MVU 字段；宏观故事线和下一节点由资料卡自动生成，原著正文进入 EJS 世界书。','rw-muted'));
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
    field(doc,'初始时间锚点（可选）',start,'日历不是必填项；可用日历选日期、手写作品时期，或留空让世界推进确定。'),
    bindCalendar(doc,start), calendarDetails,
  );
  const title=element(doc,'div','副本资料 · 时间轴','rw-publish-step-title');
  const help=element(doc,'p','地区和宏观剧情使用绿灯关键词 + EJS 世界/日期筛选，即使关闭世界推进也能触发。仅作者编写原著宏观事件，临时的近期事件由 AI 自由生成。日期可选，未知日期时不做硬拦截。','rw-muted');
  const list=element(doc,'div','','rw-scenario-section-list');
  const add=element(doc,'button','＋ 新增资料卡片','rw-button');add.type='button';
  root.append(title,help,list,add);
  const cards=[];
  function syncCards(){
    cards.forEach((card,index)=>{
      const label=card.querySelector('[data-scenario-label]');
      if(label)label.textContent='资料 '+(index+1);
    });
    notify();
  }
  function appendCard(value={},withChange=true){
    if(cards.length>=70)return;
    const card=element(doc,'div','','rw-opening-equipment-card');
    card.style.marginBlock='10px';
    const head=element(doc,'div','','rw-opening-skill-head');
    const label=element(doc,'strong','资料 '+(cards.length+1));label.setAttribute('data-scenario-label','');
    const up=element(doc,'button','↑','rw-button');up.title='前移';up.type='button';
    const down=element(doc,'button','↓','rw-button');down.title='后移';down.type='button';
    const del=element(doc,'button','删除','rw-button danger');del.type='button';
    head.append(label,up,down,del);
    const name=control(doc,'scenario_section_title',value.title||'',false,'例如：斯坦索姆抉择');
    const legacyType=value.type==='near'?(value.location||value.match?'location':'always'):value.type;
    const kind=picker(doc,'scenario_section_type',[['macro','宏观剧情事件'],['location','地区资料'],['always','常驻世界资料']],legacyType==='event'?'macro':legacyType||'macro');
    const clock=picker(doc,'scenario_section_time_type',[['phase','作品时期 / 模糊时间'],['date','明确日期（日历）'],['after','前置事件之后']],value.timeType||'phase');
    const time=control(doc,'scenario_section_time',value.time||'',false,'例如：第三次战争初期');
    const timeField=field(doc,'关联日期或时期（可选）',time,'明确日期用于 EJS 起始时间筛选；模糊时期只作参考，不硬拦截。');
    const calendar=bindCalendar(doc,time);
    const after=control(doc,'scenario_section_after',value.after||'',false,'填写另一条宏观事件的名称');
    const afterField=field(doc,'前置事件（选择「前置事件之后」时填写）',after,'其他时间类型均可留空。');
    const location=control(doc,'scenario_section_location',value.location||value.match||'',false,'例如：东部王国-洛丹伦');
    const locationField=field(doc,'关联地区（可选）',location);
    const condition=control(doc,'scenario_section_condition',value.condition||'',false,'可选：例如守军集结后');
    const conditionField=field(doc,'成立条件（可选）',condition);
    const keywords=control(doc,'scenario_section_keywords',value.keywords||'',false,'多个关键词用逗号分隔，例如：斯坦索姆,阿尔萨斯');
    const keywordField=field(doc,'绿灯关键词（可选）',keywords,'自动包含条目名称；地区资料还包含地区名称。此处可以补充别称。');
    const body=control(doc,'scenario_section_content',value.content||'',true,'原作背景、剧情、世界知识……');
    body.rows=5;
    card.append(head,field(doc,'资料名称 *',name),field(doc,'资料类型',kind),keywordField,field(doc,'时间表达',clock),
      timeField,calendar,afterField,locationField,conditionField,field(doc,'详细资料 *',body));
    const visibility=()=>{
      const dynamic=kind.value==='macro'||kind.value==='location';
      clock.parentElement.hidden=!dynamic;
      timeField.hidden=!dynamic||clock.value==='after';
      calendar.hidden=!dynamic||clock.value!=='date';
      afterField.hidden=kind.value!=='macro'||clock.value!=='after';
      conditionField.hidden=kind.value!=='macro';
      locationField.hidden=kind.value==='always';
    };
    kind.addEventListener('change',visibility);clock.addEventListener('change',visibility);
    up.addEventListener('click',()=>{const i=cards.indexOf(card);if(i>0){cards.splice(i,1);cards.splice(i-1,0,card);list.insertBefore(card,cards[i]||null);syncCards();}});
    down.addEventListener('click',()=>{const i=cards.indexOf(card);if(i>=0&&i<cards.length-1){cards.splice(i,1);cards.splice(i+1,0,card);list.insertBefore(card,cards[i+2]||null);syncCards();}});
    del.addEventListener('click',()=>{cards.splice(cards.indexOf(card),1);card.remove();syncCards();});
    list.append(card);cards.push(card);visibility();
    if(withChange)notify();
  }
  for(const value of initial.scenario_sections||[])appendCard(value,false);
  add.addEventListener('click',()=>appendCard());
  root.addEventListener('input',notify);root.addEventListener('change',notify);
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
        timeType:card.querySelector('[name="scenario_section_time_type"]').value,
        time:card.querySelector('[name="scenario_section_time"]').value,
        after:card.querySelector('[name="scenario_section_after"]').value,
        location:card.querySelector('[name="scenario_section_location"]').value,
        condition:card.querySelector('[name="scenario_section_condition"]').value,
        keywords:card.querySelector('[name="scenario_section_keywords"]').value,
        content:card.querySelector('[name="scenario_section_content"]').value,
      })),
    };
  }};
}
