const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','script','悬浮球状态栏.js'),'utf8');

assert.match(source,/function isSettlementReadyTask\(task\)/,'statusbar must expose settlement-ready task policy');
assert.match(source,/issuer === '主神任务' \|\| issuer === '晋升试炼' \|\| issuer === '试炼任务'/,'both main-god and trial tasks must qualify');
assert.match(source,/status === '可结算' \|\| status === '可交付' \|\| status === '已完成' \|\| status === '完成'/,'settlement entry must tolerate current and legacy completion aliases');
assert.match(source,/sys\.是否在主神空间 !== false \|\| sys\.是否战斗中 === true/,'entry must only appear outside the main-god space and outside combat');
assert.doesNotMatch(source,/shouldShowSettlementButton[\s\S]{0,500}单一世界/,'single-world mode must not suppress the settlement entry');
assert.match(source,/function renderTopbar\(world, sys, editMode, sd\)/,'topbar must accept full state for settlement policy');
assert.match(source,/html \+= renderTopbar\(world, sys, editMode, statData\);/,'renderAll must pass its actual statData variable into the topbar');
assert.doesNotMatch(source,/html \+= renderTopbar\(world, sys, editMode, sd\);/,'renderAll must not reference an undefined sd variable');
assert.match(source,/class="sam-icon-btn choose-world mission-settle"[^>]*data-mission-settle>📋结算任务/,'settlement entry must reuse the choose-world topbar button shape');
assert.doesNotMatch(source,/sam-mission-settle-wrap|sam-mission-settle-btn|sam-mission-settle-hint/,'old task-tab settlement UI must be removed');

console.log('PASS statusbar surfaces settlement in the topbar without undefined renderAll state references');
