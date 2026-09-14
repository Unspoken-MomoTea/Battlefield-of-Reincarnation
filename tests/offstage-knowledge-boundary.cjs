const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../script/world-engine-src/00-foundation-prompt.part.js'), 'utf8');
function readTemplateConstant(name) {
  const marker = `const ${name} = \``;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `缺少 ${name}`);
  const bodyStart = start + marker.length;
  const end = source.indexOf('`;', bodyStart);
  assert.ok(end > bodyStart, `无法读取 ${name}`);
  return source.slice(bodyStart, end);
}
const preset = readTemplateConstant('DEFAULT_PRESET');
const core = readTemplateConstant('CORE_WORLD_RULES');
const prompt = `${preset}\n${core}`;

assert.match(prompt, /模型看到|正文楼层|当前变量/, '必须明确区分世界模型可见信息与NPC实际知情');
assert.match(prompt, /不等于.*(?:NPC|人物).*知情|不得.*因为.*(?:正文|玩家).*自动.*知/, '玩家行为进入模型上下文时不能自动变成场外NPC知识');
assert.match(prompt, /认知来源/, '场外NPC因新情报改变行动时必须使用既有认知来源结构');
assert.match(prompt, /观察|传播|通讯|目击/, '知情来源必须来自现实信息路径');
assert.match(prompt, /没有.*来源|无.*来源|否则.*(?:维持|不得).*行动/, '没有信息来源时场外NPC不得针对玩家即时反应');

console.log('PASS offstage NPC knowledge is separated from world-model knowledge');
