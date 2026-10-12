// 工坊副本作者填写普通剧情资料，程序编译 EJS；禁止把作者文本当代码运行。
export const SCENARIO_ORDER_START = 200;
export const SCENARIO_MAX_SECTIONS = 70;
const RANKS = new Set(['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ']);
const TIERS = new Set(['F','E','D','C','B','A','S','SS','SSS']);
const MODES = new Set(['both','multi','single']);
const TYPES = new Set(['always','location','event']);

const trimmed = value => String(value ?? '').trim();
function cleanText(value, label, limit = 16000) {
  const text = trimmed(value);
  if (text.length > limit) throw new Error(label + '过长（最多' + limit + '字）');
  // 避免任何作者原文闭合程序生成的 EJS，或注入动态模板。
  if (/<[%]/u.test(text)) throw new Error(label + '不能包含 EJS 代码（<%）');
  return text;
}
function sanitize(value) {
  return String(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 65);
}
function gate(world, expression) {
  return [
    '<%_',
    'const __rw = getMessageVar("stat_data", { defaults: {} }) || {};',
    'const __rww = _.get(__rw, "世界", {});',
    'if (String(__rww.名称 || "") === ' + JSON.stringify(world) + ' && (' + expression + ')) {',
    '_%>'
  ].join('\n');
}
const endGate = '<%_ } _%>';
const entry = (name, world, content, expr, order) => ({
  name,
  enabled: true,
  strategy: { type: 'constant', keys: [], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
  position: { type: 'before_character_definition', role: 'system', order },
  content: gate(world, expr) + '\n' + content + '\n' + endGate,
  probability: 100,
  recursion: { prevent_incoming: true, prevent_outgoing: true },
  extra: { reincarnationWorkshop: { scenario: true, scenarioWorld: world } },
});
export function buildScenarioArtifacts(source, projectName) {
  const world = cleanText(source.scenario_world || projectName, '世界名称', 80);
  const time = cleanText(source.scenario_time, '时间锚点', 160);
  const stage = cleanText(source.scenario_stage, '当前阶段', 500);
  const story = cleanText(source.scenario_story, '故事线', 800);
  const next = cleanText(source.scenario_next, '下一节点', 120);
  const overview = cleanText(source.scenario_overview, '基础设定', 8000);
  const location = cleanText(source.scenario_location, '初始地点', 160);
  const identity = cleanText(source.scenario_identity, '切入身份', 160);
  const laws = cleanText(source.scenario_laws, '世界法则', 1200);
  const goal = cleanText(source.scenario_goal, '单一世界任务', 500);
  const rank = RANKS.has(source.scenario_rank) ? source.scenario_rank : 'Ⅲ';
  const low = TIERS.has(source.scenario_tier_low) ? source.scenario_tier_low : 'F';
  const high = TIERS.has(source.scenario_tier_high) ? source.scenario_tier_high : 'D';
  const mode = MODES.has(source.scenario_mode) ? source.scenario_mode : 'both';
  const sections = Array.isArray(source.scenario_sections) ? source.scenario_sections : [];
  if (!world || !time || !stage || !overview) throw new Error('副本必须填写世界名称、时间锚点、当前阶段与基础设定');
  const stages = story.split(/\s*(?:->|→|⇒|=>)\s*/u).map(trimmed).filter(Boolean);
  if (stages.length < 3 || stages.length > 5 || !next || !stages.includes(next)) {
    throw new Error('故事线须使用 → 串联3～5个宏观事件，且“下一节点”必须与其中一个事件同名');
  }
  if (sections.length > SCENARIO_MAX_SECTIONS) throw new Error('副本资料条目不能超过' + SCENARIO_MAX_SECTIONS + '条');
  const validated = sections.map((item, index) => {
    const title = cleanText(item?.title, '第'+(index+1)+'条标题', 100);
    const type = TYPES.has(item?.type) ? item.type : 'always';
    const match = cleanText(item?.match, '第'+(index+1)+'条关联条件', 120);
    const content = cleanText(item?.content, '第'+(index+1)+'条正文');
    if (!title || !content) throw new Error('第'+(index+1)+'条资料缺少名称或正文');
    if (type !== 'always' && !match) throw new Error('第'+(index+1)+'条资料缺少地区或事件名称');
    return { title, type, match, content };
  });
  const core = [
    '【副本世界设定】' + world,
    '【起始时期】' + time,
    '【默认初始阶段】' + stage,
    '【初始地点】' + location,
    '【世界背景】\n' + overview,
    '【世界法则参考】\n' + laws,
  ].filter(Boolean).join('\n');
  const timeline = [
    '【原作宏观剧情参考】',
    '原作默认故事线：' + story,
    '起始下一节点：' + next,
    '注：这是未被玩家改变时的默认未来，已确认事实与因果偏移始终优先；不得强行修正回原作。'
  ].join('\n');
  const entries = [
    entry('[副本] '+world+' · 基础设定', world, core, 'true', SCENARIO_ORDER_START),
    entry('[副本] '+world+' · 宏观剧情', world, timeline, 'true', SCENARIO_ORDER_START + 1),
  ];
  validated.forEach((item, index) => {
    const expr = item.type === 'location'
      ? 'String(__rww.地点 || "").includes(' + JSON.stringify(item.match) + ')'
      : item.type === 'event'
        ? '(String(_.get(__rww, "因果轨道.下一节点", "")) === ' + JSON.stringify(item.match)
          + ' || String(_.get(__rww, ["后台","事件",' + JSON.stringify(item.match) + ',"状态"], "")) === "进行中")'
        : 'true';
    entries.push(entry('[副本] '+world+' · '+item.title, world, item.content, expr, SCENARIO_ORDER_START + 10 + index));
  });
  return [
    { kind:'worldbook', name:sanitize(projectName || world)+'.scenario.worldbook.json', format:'json', content:{ entries } },
    { kind:'data', name:sanitize(projectName || world)+'.scenario.json', format:'json',
      content:{ schema_version:1, kind:'scenario', world, time, stage, story, next, overview,
        location, identity, laws, goal, rank, tier:low+'~'+high, mode, sections: validated } },
  ];
}

export function scenarioInitialValues(artifacts) {
  const raw = artifacts.find(item => item?.kind === 'data' && item.content?.kind === 'scenario')?.content;
  if (!raw) return {};
  const [low, high] = String(raw.tier || 'F~D').split('~');
  return {
    scenario_world:raw.world || '', scenario_time:raw.time || '',
    scenario_stage:raw.stage || '', scenario_story:raw.story || '',
    scenario_next:raw.next || '', scenario_overview:raw.overview || '',
    scenario_location:raw.location || '', scenario_identity:raw.identity || '',
    scenario_laws:raw.laws || '', scenario_goal:raw.goal || '',
    scenario_rank:raw.rank || 'Ⅲ', scenario_tier_low:low || 'F',
    scenario_tier_high:high || 'D', scenario_mode:raw.mode || 'both',
    scenario_sections:Array.isArray(raw.sections)?structuredClone(raw.sections):[],
  };
}
