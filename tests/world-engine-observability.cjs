const assert = require('assert');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'script', '世界推进系统.js');
const source = fs.readFileSync(file, 'utf8');
const {
  estimateTokens,
  formatTokenCount,
  normalizeTokenUsage,
  requestTokenTelemetry,
  WORLD_RESULT_SCHEMA
} = require(file);

assert.equal(typeof estimateTokens, 'function');
assert.equal(typeof formatTokenCount, 'function');
assert.equal(typeof requestTokenTelemetry, 'function');

assert.ok(estimateTokens('中文世界推进测试') >= 6, 'CJK token estimate must not collapse to latin char ratio');
assert.ok(estimateTokens('hello world') > 0, 'latin text must still have a token estimate');
assert.equal(formatTokenCount(1850, true), '≈1.85k tk');
assert.equal(formatTokenCount(12000, false), '12k tk');

assert.deepEqual(normalizeTokenUsage({prompt_tokens:1200,completion_tokens:300,total_tokens:1500}), {
  inputTokens:1200, outputTokens:300, totalTokens:1500
});
assert.deepEqual(normalizeTokenUsage({input_tokens:100,output_tokens:25}), {
  inputTokens:100, outputTokens:25, totalTokens:125
});
assert.equal(normalizeTokenUsage({}), null);

const telemetry = requestTokenTelemetry(
  '身份说明\n【核心约束】\n必须遵守。\n【Canonical WorldResult JSON Schema】\n{}',
  JSON.stringify({世界书:[{名称:'设定',内容:'世界规则'}],正文楼层:[{楼层:2,正文:'事件发生'}]}, null, 2),
  WORLD_RESULT_SCHEMA
);
assert.ok(telemetry.请求估算Tokens > 0);
assert.ok(telemetry.System估算Tokens > 0);
assert.ok(telemetry.User估算Tokens > 0);
assert.ok(telemetry.Schema估算Tokens > 0);
assert.ok(telemetry.System分段.length >= 2);
assert.deepEqual(telemetry.User分段.map(x=>x.名称), ['世界书','正文楼层']);

assert.doesNotMatch(source, /请求字符数:/, 'request manifest must no longer expose character counts');
assert.doesNotMatch(source, /part\.body\.length\+' 字/, 'prompt segment badges must use tk instead of characters');
assert.doesNotMatch(source, /f\.字符数\+'字'/, 'floor diagnostics must not render character counts');
assert.match(source, /世界书条目:books\.map\(b=>\(\{[^}]*估算Tokens:estimateTokens\(b\.内容\)/, 'worldbook manifest must carry token estimates');
assert.match(source, /正文楼层:floors\.map\(f=>\(\{[^}]*估算Tokens:estimateTokens\(f\.正文\)/, 'prose manifest must carry token estimates');
assert.match(source, /观测:requestTokenTelemetry\(system,input,WORLD_RESULT_SCHEMA\)/, 'request manifest must carry token telemetry');
assert.match(source, /lastAttemptTelemetry=\[\]/, 'attempt telemetry must be in-memory state');
assert.match(source, /this\.lastAttemptTelemetry\.push\(attemptTelemetry\)/, 'returned attempts must be observed');
assert.match(source, /结构化模式:mode,尝试模式:copy\(modeAttempts\),usage:normalizeTokenUsage\(data\?\.usage\)/, 'dedicated API must record actual structured mode and provider usage');
assert.match(source, /auto（由主神终端协商）/, 'terminal path must not fake an actual structured mode');
assert.match(source, /带“≈”的 tk 为本地估算/, 'UI must explain estimated vs provider token usage');
assert.match(source, /副 API 原始回复 · '\+replyTk/, 'raw reply heading must expose token size');
assert.match(source, /请求超过内部安全上限（'\+formatTokenCount/, 'oversize error must be token-facing even if internal safety remains character based');
assert.match(source, /system\.length\+input\.length>240000/, 'existing internal safety ceiling must remain unchanged in P1-C');
assert.match(source, /this\.lastAttemptTelemetry=\[\];this\.lastTransportInfo=null;/, 'context reset must clear observability state');

console.log('world-engine observability acceptance passed');
