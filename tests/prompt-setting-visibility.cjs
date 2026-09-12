const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../World Book');
const files = [
  '[mvu_update]变量更新规则.txt',
  '⚙️世界因果与法则协议.txt',
  '⚙️任务与委托系统.txt',
  '【主神任务】[mvu_plot].txt',
  '【试炼任务】[mvu_plot].txt',
];

// 设置名可以存在于 EJS/程序判断层；这里模拟“AI最终能看到的静态文案”，先剥离所有 EJS 代码。
const stripEjs = source => source.replace(/<%[\s\S]*?%>/g, '');
const forbiddenVisiblePhrases = [
  '单一世界模式',
  '轮回副本模式',
  '轮回模式只能',
  '模式隔离——单一世界',
  '模式隔离——轮回试炼',
  '世界超稳模式',
  '世界超稳：',
  '世界引擎开启时',
  '世界引擎关闭时',
  '世界引擎已启用',
  '世界引擎未启用',
  '单一世界禁止',
  '单一世界不存在副本成就',
];

for (const name of files) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  const visible = stripEjs(source);
  for (const phrase of forbiddenVisiblePhrases) {
    assert.equal(
      visible.includes(phrase),
      false,
      `${name} 不应把隐藏设置/模式名作为 AI 可见规则：${phrase}`
    );
  }
}

const trial = fs.readFileSync(path.join(root, '【试炼任务】[mvu_plot].txt'), 'utf8');
assert.match(trial, /模式:\s*单一世界/,'试炼输出协议仍需保留解析字段“模式: 单一世界”');
assert.match(trial, /模式:\s*轮回试炼/,'试炼输出协议仍需保留解析字段“模式: 轮回试炼”');
assert.match(trial, /本次试炼必须发生在当前世界内/);
assert.match(trial, /本次试炼生成一个完整、独立的试炼副本/);

const taskRules = fs.readFileSync(path.join(root, '⚙️任务与委托系统.txt'), 'utf8');
assert.match(taskRules, /委托方`必须固定填写`主神任务`/);
assert.match(taskRules, /当前规则下不存在副本成就与成就盲盒/);

console.log('prompt setting visibility tests passed');
