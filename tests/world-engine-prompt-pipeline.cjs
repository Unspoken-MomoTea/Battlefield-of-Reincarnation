const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('script/世界推进系统.js', 'utf8');

function capture(pattern, label) {
  const match = source.match(pattern);
  assert(match, `missing ${label}`);
  return match[1];
}

const preset = capture(/const DEFAULT_PRESET = `([\s\S]*?)`;\n    const BUILTIN_DEFAULT_SELECTED_ENTRIES/, 'DEFAULT_PRESET');
const core = capture(/const CORE_WORLD_RULES = `([\s\S]*?)`;?\n    function splitPresetSegments/, 'CORE_WORLD_RULES');
const protocol = capture(/function protocol\(\)[\s\S]*?return `([\s\S]*?)`;\n    \}/, 'protocol');

assert(source.includes("version:11,\n        builtin:true,\n        name:'默认设置'"), 'built-in prompt version should be 11');
assert(source.includes("const shouldApply=appliedVersion===0||this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id"), 'built-in migration must not overwrite custom prompt documents');

for (let i = 1; i <= 7; i += 1) {
  assert(preset.includes(`Step ${i} ·`), `pipeline is missing Step ${i}`);
}
assert(preset.includes('【执行检查】'), 'pipeline should end with execution checks');
assert(preset.includes('先更新当前区间内确实变化的地区现场'), 'pipeline should advance shared world scenes before person actions');
assert(preset.includes('不复制地点现场'), 'pipeline should keep shared scene facts out of person records');
assert(preset.length < 1900, `DEFAULT_PRESET regressed into a long rule manual: ${preset.length} chars`);

const businessInvariants = [
  '只用世界.时间计算本世界进展',
  '待发生/进行中事件必须有可排序',
  '死亡不可恢复',
  '探索度以0/10/30/60/90/100',
  '单轮绝对变化≤1000',
  '影响程度负值表示偏离原轨道',
  '世界超稳时不新增偏移',
  '普通副本返回主神空间后停止本世界推演',
  '主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界',
  '现场群体与环境事实属于势力地区',
  '同一现场事实不得复制进人物',
];
for (const marker of businessInvariants) {
  assert(core.includes(marker), `core invariant missing: ${marker}`);
}
assert(core.length < 1550, `CORE_WORLD_RULES regressed into a long rule manual: ${core.length} chars`);

assert(protocol.includes('【Canonical WorldResult JSON Schema】'), 'protocol must retain canonical schema');
assert(protocol.includes('${schemaText}'), 'protocol must inject the canonical schema');
assert(protocol.includes('人物背景关联只记录持续的团体/组织/社交关系'), 'protocol should define background-link ownership');
assert(protocol.includes('现场群体与环境变化写在势力地区'), 'protocol should define shared scene ownership');
assert(core.includes('现有资产账簿') && core.includes('驻扎人员') && core.includes('待办事件'), 'core should make existing asset ledger relevant to offscreen world actions');
assert(!protocol.includes('【WorldResult 标准字段结构】'), 'duplicated field-manual section must stay removed');
assert(!core.includes('WorldResult.探索必须是数组'), 'schema-level exploration shape must not return to core rules');
assert(!preset.includes('风险只能是 F/E/D/C/B/A/S/SS/SSS'), 'schema enum must not be duplicated in default prompt');
assert(source.includes("['json_schema','json_object','plain']"), 'structured-output fallback order must remain json_schema -> json_object -> plain');

for (const architectureMarker of [
  'function compactWorldLifecycle',
  'function projectWorldContext',
  'const NPC_BUILD_AUDIT_RULES',
  'builtinDefaultPromptVersionApplied',
]) {
  assert(source.includes(architectureMarker), `architecture marker missing: ${architectureMarker}`);
}

console.log(`world-engine prompt pipeline audit passed: preset=${preset.length}, core=${core.length}, protocol=${protocol.length}`);
