const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('World Book/[variables]当前变量.txt', 'utf8');

// 某些酒馆预设会把英文 asset/ass 做零宽字符混淆。普通文本不受影响，
// 但 EJS 可执行区中的 JavaScript 标识符会因此变成非法语法。
assert.doesNotMatch(source, /asset/i, '变量 EJS 可执行模板不得再包含会被部分预设改写的 asset 标识符');
assert.match(source, /const isPlayerOwnedHolding = holding => \{/,'应使用不触发预设敏感词改写的资产归属判定标识符');
assert.match(source, /const playerHoldings = _.pickBy\(data\.资产 \|\| \{\}, holding => isPlayerOwnedHolding\(holding\)\);/,'资产投影应保持原有归属过滤语义');
assert.match(source, /current\.资产 = _.mapValues\(playerHoldings, \(holding, name\) => \{/,'非战斗资产投影仍应正常工作');
assert.match(source, /current\.资产 = _.transform\(playerHoldings, \(result, holding, name\) => \{/,'战斗资产投影仍应正常工作');

console.log('EJS preset compatibility regression passed');
