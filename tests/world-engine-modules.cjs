const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'script', 'world-engine-src');
const delivery = path.join(root, 'script', '世界推进系统.js');
const parts = [
  '00-foundation-prompt.part.js',
  '10-world-state.part.js',
  '20-world-result.part.js',
  '30-context-protocol.part.js',
  '40-engine-runtime.part.js',
  '50-engine-ui.part.js',
  '55-policy-compat.part.js',
  '56-rumor-liveliness.part.js',
  '57-task-awareness.part.js',
  '58-chronology-guard.part.js',
  '59-auto-progress.part.js',
  '59-auto-trigger-rebuild.part.js',
  '59-soft-maintenance.part.js',
  '59-world-integrity-guard.part.js',
  '59-world-time-daypart-aliases.part.js',
  '59-causal-stability-gate.part.js',
  '59-world-time-ownership.part.js',
  '59-world-replay-persistence.part.js',
  '59-reprocess-immediate-retry.part.js',
  '59-alien-activity-normalization.part.js',
  '59-rumor-throttle.part.js',
  '59-rumor-world-source.part.js',
  '59-rumor-world-facts.part.js',
  '59-rumor-world-request.part.js',
  '59-rumor-world-system.part.js',
  '59-editable-module-prompts.part.js',
  '59-causal-overview-ui.part.js',
  '59-causal-offset-editor.part.js',
  '59-api-preset-selection.part.js',
  '59-history-memory.part.js',
  '59-history-memory-editor.part.js',
  '60-bootstrap.part.js',
];

for (const name of parts) assert.ok(fs.existsSync(path.join(srcDir, name)), `missing source part ${name}`);
const texts = Object.fromEntries(parts.map(name => [name, fs.readFileSync(path.join(srcDir, name), 'utf8')]));
const assembled = parts.map(name => texts[name]).join('');
const output = fs.readFileSync(delivery, 'utf8');
assert.equal(assembled, output, 'source parts must reproduce the checked-in single-file delivery byte-for-byte');

assert.ok(texts['00-foundation-prompt.part.js'].startsWith('/* 轮回战场 · 世界引擎\n'), 'foundation part must own the delivery header');
assert.ok(texts['00-foundation-prompt.part.js'].includes('(function (root) {'), 'foundation part must open the shared IIFE');
assert.match(texts['00-foundation-prompt.part.js'], /const DEFAULT_PRESET = `/);
assert.match(texts['10-world-state.part.js'], /^    const RECORDS = \{/);
assert.match(texts['10-world-state.part.js'], /function compactWorldLifecycle\(/);
assert.match(texts['20-world-result.part.js'], /^    const CURRENCY_FIELDS=/);
assert.match(texts['20-world-result.part.js'], /const WORLD_RESULT_SCHEMA=\{/);
assert.match(texts['20-world-result.part.js'], /function compileWorldResult\(/);
assert.match(texts['30-context-protocol.part.js'], /^    function activation\(/);
assert.match(texts['30-context-protocol.part.js'], /function projectWorldContext\(/);
assert.match(texts['30-context-protocol.part.js'], /function protocol\(\)/);
assert.match(texts['40-engine-runtime.part.js'], /^    class SamsaraWorldEngine \{/);
assert.match(texts['40-engine-runtime.part.js'], /async requestDedicatedApi\(/);
assert.match(texts['40-engine-runtime.part.js'], /async run\(/);
assert.doesNotMatch(texts['40-engine-runtime.part.js'], /        createPanel\(\) \{/);
assert.match(texts['50-engine-ui.part.js'], /^        createPanel\(\) \{/);
assert.match(texts['50-engine-ui.part.js'], /        render\(force\) \{/);
assert.match(texts['50-engine-ui.part.js'], /        dispose\(\) \{/);
assert.doesNotMatch(texts['50-engine-ui.part.js'], /we-ledger-strip|we-ledger-stat/, '探索/热点/势力页不应恢复四格汇总统计条');
assert.doesNotMatch(texts['50-engine-ui.part.js'], /\btotalProgress\b/, '探索页不得引用已经删除的总权重统计变量');
const settlementHtml = fs.readFileSync(path.join(root, 'Regular', '结算任务美化.html'), 'utf8');
assert.match(settlementHtml, /if \(!isSingleWorld\) \{[\s\S]{0,180}setValue\(world, '探索', \{\}\)/, '普通副本结算仍需清空探索台账');
assert.match(settlementHtml, /单一世界继续使用同一世界：探索档案长期保留，但不参与空间币结算/, '单一世界结算必须保留探索档案');
assert.doesNotMatch(settlementHtml, /探索结算基线/, '单一世界不再维护探索结算基线');
const settlementPrompt = fs.readFileSync(path.join(root, 'World Book', '【结算任务】[mvu_plot].txt'), 'utf8');
assert.doesNotMatch(settlementPrompt, /探索结算基线|只计算自上次阶段结算后新增的探索度/);
assert.match(settlementHtml, /const explorationReward = isSingleWorld \? 0 : Math\.min\(explorationRaw, explorationCap\)/, '持续世界探索不得结算空间币');
assert.match(settlementHtml, /const reputationReward = isSingleWorld \? 0 : Math\.min\(reputationRaw, reputationCap\)/, '持续世界势力声望不得结算空间币');
assert.match(texts['55-policy-compat.part.js'], /^    \/\/ 可选策略层/);
assert.match(texts['55-policy-compat.part.js'], /npcBuildAuditEnabled/);
assert.match(texts['55-policy-compat.part.js'], /事件前因不存在/);
assert.match(texts['56-rumor-liveliness.part.js'], /^    \/\/ 传闻是常驻活跃层/);
assert.match(texts['56-rumor-liveliness.part.js'], /RUMOR_LIVELINESS_RULES/);
assert.match(texts['56-rumor-liveliness.part.js'], /ensureRumorLiveliness/);
assert.match(texts['57-task-awareness.part.js'], /^    \/\/ 任务感知层/);
assert.match(texts['57-task-awareness.part.js'], /TASK_AWARENESS_RULES/);
assert.match(texts['57-task-awareness.part.js'], /projectTaskListForWorld/);
assert.match(texts['58-chronology-guard.part.js'], /^    \/\/ 原著\/数据库时间轴保护层/);
assert.match(texts['58-chronology-guard.part.js'], /CHRONOLOGY_GUARD_RULES/);
assert.match(texts['58-chronology-guard.part.js'], /validateChronologyResult/);
assert.match(texts['59-auto-progress.part.js'], /^    \/\/ 自动推进策略/);
assert.match(texts['59-auto-progress.part.js'], /autoProgress/);
assert.match(texts['59-auto-progress.part.js'], /战斗中，世界推进暂停/);
assert.match(texts['59-auto-trigger-rebuild.part.js'], /^    \/\/ 自动推进触发重构/);
assert.match(texts['59-auto-trigger-rebuild.part.js'], /GENERATION_ENDED/);
assert.match(texts['59-auto-trigger-rebuild.part.js'], /WORLD_REPLAY_VERSION/);
assert.match(texts['59-soft-maintenance.part.js'], /^    \/\/ 容错验收策略/);
assert.match(texts['59-soft-maintenance.part.js'], /SOFT_MAINTENANCE_RULES/);
assert.match(texts['59-soft-maintenance.part.js'], /eventHasUsableSchedule/);
assert.match(texts['59-soft-maintenance.part.js'], /ensureRumorLiveliness=function/);
assert.match(texts['59-world-integrity-guard.part.js'], /^    \/\/ 世界完整性保护/);
assert.match(texts['59-world-integrity-guard.part.js'], /WORLD_INTEGRITY_GUARD_RULES/);
assert.match(texts['59-world-integrity-guard.part.js'], /softNormalizeCausalOffsets/);
assert.match(texts['59-world-time-daypart-aliases.part.js'], /^    \/\/ 世界时间段别名兼容/);
assert.match(texts['59-world-time-daypart-aliases.part.js'], /'夜晚':'晚上'/);
assert.match(texts['59-causal-stability-gate.part.js'], /^    \/\/ 稳定度因果闸门/);
assert.match(texts['59-causal-stability-gate.part.js'], /causalOffsetHasWorldScaleEvidence/);
assert.match(texts['59-causal-stability-gate.part.js'], /清理局部稳定偏移/);
assert.match(texts['59-world-time-ownership.part.js'], /^    \/\/ 世界时间单一所有权/);
assert.match(texts['59-world-time-ownership.part.js'], /WORLD_RESULT_SCHEMA\.properties\.时间/);
assert.match(texts['59-world-time-ownership.part.js'], /变量 AI 的写入在事件层被回滚/);
assert.match(texts['59-world-replay-persistence.part.js'], /worldReplayPersistAfterSuccess/);
assert.match(texts['59-reprocess-immediate-retry.part.js'], /worldReplayImmediateRetry/);
assert.match(texts['59-alien-activity-normalization.part.js'], /^    \/\/ 活跃异端活动时间戳/);
assert.match(texts['59-alien-activity-normalization.part.js'], /更新时间无需抄写/);
assert.match(texts['59-alien-activity-normalization.part.js'], /sameWorldTimeAnchor/);
assert.match(texts['59-rumor-throttle.part.js'], /RUMOR_THROTTLE_RULES/);
assert.match(texts['59-rumor-world-source.part.js'], /RUMOR_WORLD_SOURCE_RULES/);
assert.match(texts['59-rumor-world-facts.part.js'], /世界侧可传播事实/);
assert.match(texts['59-rumor-world-request.part.js'], /传闻维护/);
assert.match(texts['59-rumor-world-system.part.js'], /RUMOR_WORLD_SOURCE_RULES/);
assert.match(texts['59-editable-module-prompts.part.js'], /WORLD_PROMPT_MODULE_DEFS/);
assert.match(texts['59-editable-module-prompts.part.js'], /stripLegacyWorldModulePrompts/);
assert.match(texts['59-editable-module-prompts.part.js'], /data-module-prompt/);
assert.match(texts['59-causal-overview-ui.part.js'], /因果/);
assert.match(texts['59-causal-offset-editor.part.js'], /^    \/\/ 因果偏移手动维护/);
assert.match(texts['59-causal-offset-editor.part.js'], /setCausalOffsetRecord/);
assert.match(texts['59-causal-offset-editor.part.js'], /removeCausalOffsetRecord/);
assert.match(texts['59-causal-offset-editor.part.js'], /causal-offset-edit/);
assert.match(texts['59-api-preset-selection.part.js'], /^    \/\/ 专属 API 预设选择态/);
assert.match(texts['59-api-preset-selection.part.js'], /dedicatedApiPresetSelection/);
assert.match(texts['59-api-preset-selection.part.js'], /dedicated-preset-delete/);
assert.match(texts['59-history-memory.part.js'], /^    \/\/ 世界长期历史记忆/);
assert.match(texts['59-history-memory.part.js'], /HISTORY_MEMORY_L0_BATCH/);
assert.match(texts['59-history-memory.part.js'], /projectWorldHistoryMemory/);
assert.match(texts['59-history-memory-editor.part.js'], /^    \/\/ 历史记忆手动维护/);
assert.match(texts['59-history-memory-editor.part.js'], /setHistoryAnchorRecord/);
assert.match(texts['59-history-memory-editor.part.js'], /setHistorySummaryRecord/);
assert.match(texts['60-bootstrap.part.js'], /^    \/\/ CommonJS 入口仅供离线测试/);
assert.match(texts['60-bootstrap.part.js'], /module\.exports/);
assert.match(texts['60-bootstrap.part.js'], /\}\)\(typeof window !== 'undefined' \? window : globalThis\);\s*$/);

for (const name of parts) {
  assert.doesNotMatch(texts[name], /^\s*(?:import|export)\s/m, `${name} must not introduce runtime ES modules`);
}

execFileSync('python', [path.join(root, 'tools', 'build-world-engine.py'), '--check'], {cwd: root, stdio: 'pipe'});
console.log(`world-engine module contract passed: ${parts.length} parts, delivery=${output.length} chars`);
