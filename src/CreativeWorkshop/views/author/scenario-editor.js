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
  row.append(date);
  return row;
}
export function createScenarioEditor({doc,initial={},onChange=null}) {
  const root=element(doc,'div','','rw-scenario-editor');
  const notify=()=>{try{onChange?.();}catch{}};
  root.append(element(doc,'p','世界名称使用工坊作品名称；宏观故事线和下一节点自动取自事件卡片。原著资料入世界书，近期节点在开局时接入世界推进后台。','rw-muted'));
  const mode=initial.scenario_mode||'both';
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
    field(doc,'世界法则',laws,'副本独特规则；已有通用规则无需重复填写。'),
    field(doc,'切入身份',identity),
    field(doc,'初始时间锚点',start,'日历可选明确日期；虚构历法、模糊时期可直接填写文字。'),
    bindCalendar(doc,start), calendarDetails,
  );
  const title=element(doc,'div','副本资料 · 时间轴','rw-publish-step-title');
  const help=element(doc,'p','宏观事件自动组成因果轨道；常驻设定/地区资料只放世界书。可用日历或相对事件时间，不必硬编原著日期。','rw-muted');
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
    const kind=picker(doc,'scenario_section_type',[['macro','宏观剧情事件'],['near','近期事件资料'],['location','地区资料'],['always','常驻世界资料']],value.type==='event'?'macro':value.type||'macro');
    const clock=picker(doc,'scenario_section_time_type',[['phase','作品时期 / 模糊时间'],['date','明确日期（日历）'],['after','前置事件之后']],value.timeType||'phase');
    const time=control(doc,'scenario_section_time',value.time||'',false,'例如：第三次战争初期');
    const timeField=field(doc,'事件时间',time);
    const calendar=bindCalendar(doc,time);
    const after=control(doc,'scenario_section_after',value.after||'',false,'填写另一条宏观事件的名称');
    const afterField=field(doc,'前置事件',after,'仅对宏观事件有效，填入已创建的事件名称');
    const location=control(doc,'scenario_section_location',value.location||value.match||'',false,'例如：东部王国-洛丹伦');
    const locationField=field(doc,'关联地区',location);
    const condition=control(doc,'scenario_section_condition',value.condition||'',false,'可选：例如守军集结后');
    const conditionField=field(doc,'成立条件',condition);
    const body=control(doc,'scenario_section_content',value.content||'',true,'原作背景、剧情、世界知识……');
    body.rows=5;
    card.append(head,field(doc,'资料名称 *',name),field(doc,'资料类型',kind),field(doc,'时间表达',clock),
      timeField,calendar,afterField,locationField,conditionField,field(doc,'详细资料 *',body));
    const visibility=()=>{
      const dynamic=kind.value==='macro'||kind.value==='near';
      clock.parentElement.hidden=!dynamic;
      timeField.hidden=!dynamic||clock.value==='after';
      calendar.hidden=!dynamic||clock.value!=='date';
      afterField.hidden=!dynamic||clock.value!=='after';
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
      scenario_world:'',scenario_mode:mode,scenario_time:start.value,
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
        content:card.querySelector('[name="scenario_section_content"]').value,
      })),
    };
  }};
}
