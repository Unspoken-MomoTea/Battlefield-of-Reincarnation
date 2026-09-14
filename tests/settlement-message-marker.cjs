const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('Regular/结算任务美化.html');
const zod = read('script/ZOD脚本.js');
const init = read('World Book/[InitVar]世界初始设定.yaml');
const vars = read('World Book/[variables]当前变量.txt');

assert.match(source, /SETTLEMENT_COIN_MESSAGE_MARKER_START/, 'missing message marker helper');
assert.match(source, /__samsara_settlement_coin_applied/, 'missing private message marker key');
assert.match(source, /getMessageVar[\s\S]*withMsg:\s*\{\s*id:/, 'marker read must target a concrete message');
assert.match(source, /setMessageVar[\s\S]*withMsg:\s*\{\s*id:/, 'marker write must target a concrete message');
assert.match(source, /readSettlementCoinMessageMarker\(win, targetMessageId\)/, 'coin write path must read the message marker');
assert.match(source, /writeSettlementCoinMessageMarker\(win, targetMessageId, settlementMarker\)/, 'coin write path must write the message marker');
assert.doesNotMatch(source, /sys\.结算空间币记录|系统状态\.结算空间币记录/, 'program marker must not live in stat_data');
assert.doesNotMatch(zod, /结算空间币记录/, 'schema must not contain program-only settlement state');
assert.doesNotMatch(init, /结算空间币记录/, 'initial variables must not contain program-only settlement state');
assert.doesNotMatch(vars, /结算空间币记录/, 'AI projection must not contain program-only settlement state');

console.log('settlement message marker regression: OK');
