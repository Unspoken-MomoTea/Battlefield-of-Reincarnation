// 副本专用 UI：作者只填写数据，所有 EJS 条件由编译模块生成。
function node(doc, tag, text = '', cls = '') {
  const el = doc.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function input(doc, name, value = '', area = false, placeholder = '') {
  const el = node(doc, area ? 'textarea' : 'input', '', area ? 'rw-textarea' : 'rw-input');
  el.name = name; el.value = value || '';
  if (placeholder) el.placeholder = placeholder;
  if (area) el.rows = 4;
  return el;
}
function select(doc, name, options, value) {
  const el = node(doc, 'select', '', 'rw-select'); el.name = name;
  for (const [key, text] of options) {
    const option = node(doc, 'option', text); option.value = key;
    option.selected = key === value; el.append(option);
  }
  return el;
}
function field(doc, title, control, hint = '') {
  const el = node(doc, 'label', '', 'rw-field');
  el.append(node(doc, 'span', title), control);
  if (hint) el.append(node(doc, 'small', hint));
  return el;
}
const FIELD_NAMES = ['scenario_world','scenario_time','scenario_stage','scenario_story','scenario_next',
  'scenario_overview','scenario_location','scenario_identity','scenario_laws','scenario_goal',
  'scenario_rank','scenario_tier_low','scenario_tier_high','scenario_mode'];
export function createScenarioEditor({doc, initial = {}, onChange = null}) {
  const root = node(doc, 'div', '', 'rw-scenario-editor');
  const intro = node(doc, 'p', '副本不新增 MVU 字段：世界、时间、因果轨道沿用现有结构；剧情和设定生成角色定义前（顺序 200～300）的 EJS 世界书。', 'rw-muted');
  root.append(intro);
  const ranks = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'].map(k=>[k,k]);
  const tiers = ['F','E','D','C','B','A','S','SS','SSS'].map(k=>[k,k]);
  root.append(
    field(doc,'世界名称 *',input(doc,'scenario_world',initial.scenario_world,'','例如：艾泽拉斯')),
    field(doc,'适用模式',select(doc,'scenario_mode',[['both','多元 / 单一世界'],['multi','仅多元'],['single','仅单一世界']],initial.scenario_mode||'both')),
    field(doc,'初始时间锚点 *',input(doc,'scenario_time',initial.scenario_time,'','例如：第三次战争前期')),
    field(doc,'初始地点',input(doc,'scenario_location',initial.scenario_location,'','例如：东部王国-洛丹伦')),
    field(doc,'初始阶段 *',input(doc,'scenario_stage',initial.scenario_stage,true,'当前实际局势，不是整个故事概述')),
    field(doc,'默认故事线 *',input(doc,'scenario_story',initial.scenario_story,true,'例如：亡灵瘟疫扩散 → 斯坦索姆抉择 → 阿尔萨斯北伐 → 霜之哀伤事件'),'按顺序填写 3～5 个宏观事件，必须与世界推进中的事件名称一致。'),
    field(doc,'下一节点 *',input(doc,'scenario_next',initial.scenario_next,'','必须与故事线中的一个节点同名')),
    field(doc,'基础世界设定 *',input(doc,'scenario_overview',initial.scenario_overview,true,'世界背景、力量体系、主要势力')),
    field(doc,'世界法则',input(doc,'scenario_laws',initial.scenario_laws,true,'每条以分号分隔；最多10条')),
    field(doc,'切入身份',input(doc,'scenario_identity',initial.scenario_identity,'','例如：洛丹伦边境冒险者')),
    field(doc,'单一世界初始任务参考',input(doc,'scenario_goal',initial.scenario_goal,true,'可留空，由正文 AI 按现有系统生成')),
    field(doc,'世界位格',select(doc,'scenario_rank',ranks,initial.scenario_rank||'Ⅲ')),
    field(doc,'最低副本评级',select(doc,'scenario_tier_low',tiers,initial.scenario_tier_low||'F')),
    field(doc,'最高副本评级',select(doc,'scenario_tier_high',tiers,initial.scenario_tier_high||'D')),
  );
  const heading = node(doc,'div','地区与剧情资料 · EJS 自动筛选','rw-publish-step-title');
  const help = node(doc,'p','常驻：仅当前世界可见；地区：仅当前位置相关；事件：仅下一节点匹配或对应事件进行中。禁止预先把未来章节全部送给 AI。','rw-muted');
  const list = node(doc,'div','', 'rw-scenario-section-list');
  const add = node(doc,'button','＋ 新增资料条目','rw-button');
  add.type='button';
  root.append(heading,help,list,add);
  const cards=[];
  const emit=()=>{try{onChange?.();}catch{}};
  function appendSection(value = {}, notify = true) {
    if (cards.length >= 70) throw new Error('每个副本最多 70 条地区/剧情资料');
    const card=node(doc,'div','','rw-opening-equipment-card');
    const top=node(doc,'div','','rw-opening-skill-head');
    const remove=node(doc,'button','删除','rw-button danger');remove.type='button';
    top.append(node(doc,'strong','资料 '+(cards.length+1)),remove);
    const kind=select(doc,'scenario_section_type',[['always','常驻设定'],['location','当前位置包含'],['event','关联宏观事件']],value.type||'always');
    const title=input(doc,'scenario_section_title',value.title||'',false,'例如：斯坦索姆抉择');
    const match=input(doc,'scenario_section_match',value.match||'',false,'地区名或宏观事件名称');
    const content=input(doc,'scenario_section_content',value.content||'',true,'该阶段需要 AI 知道的具体设定与剧情');
    card.append(top,field(doc,'条目名称 *',title),field(doc,'触发方式',kind),
      field(doc,'匹配条件（常驻可留空）',match),field(doc,'资料正文 *',content));
    list.append(card);cards.push(card);
    remove.addEventListener('click',()=>{list.removeChild(card);cards.splice(cards.indexOf(card),1);emit();});
    card.addEventListener('input',emit);card.addEventListener('change',emit);
    if(notify) emit();
  }
  add.addEventListener('click',()=>{if(cards.length>=70)return;appendSection();});
  root.addEventListener('input',emit);root.addEventListener('change',emit);
  for(const section of initial.scenario_sections||[])appendSection(section,false);
  return {node:root,values(){
    return {...Object.fromEntries(FIELD_NAMES.map(name=>[name,root.querySelector('[name="'+name+'"]')?.value||''])),
      scenario_sections:cards.map(card=>({
        title:card.querySelector('[name="scenario_section_title"]').value,
        type:card.querySelector('[name="scenario_section_type"]').value,
        match:card.querySelector('[name="scenario_section_match"]').value,
        content:card.querySelector('[name="scenario_section_content"]').value,
      }))};
  }};
}
