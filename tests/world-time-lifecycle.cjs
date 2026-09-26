const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const settlement = fs.readFileSync(path.join(root, 'Regular/结算任务美化.html'), 'utf8');
const selection = fs.readFileSync(path.join(root, 'Regular/选择世界美化.txt'), 'utf8');
const ownership = [
  path.join(root, 'script/world-engine-src/59-world-time-ownership.part.js'),
  path.join(root, 'src/WorldEngine/domains/WorldTimeOwnershipFeature.part.js'),
].map(file=>fs.readFileSync(file,'utf8')).join('\n');

// 回到主神空间：时间必须脱离副本年代，改用“游玩天数 -> 轮回历”的固定映射。
assert.match(settlement, /const playDays = Math\.max\(1, Math\.floor\(Number\(sys\.游玩天数\) \|\| 1\)\);/);
assert.match(settlement, /const samsaraDayIndex = \(\(4 - 1\) \* 30 \+ \(4 - 1\)\) \+ \(playDays - 1\);/);
assert.match(settlement, /const samsaraTime = '轮回历' \+ samsaraYear \+ '年-'[\s\S]*'日-清晨';/);
assert.match(settlement, /setValue\(world, '时间', samsaraTime\);/);
assert.match(settlement, /setValue\(world, '历法', \{\}\);/);
assert.match(settlement, /setValue\(sys, '上次世界日期', samsaraYear \+ '-' \+ samsaraMonth \+ '-' \+ samsaraDay\);/);
assert.match(settlement, /setValue\(sys, '是否在主神空间', true\);/);

// 进入任意新副本：先清空世界时钟与旧历法，再写新世界名，让世界推进重新初始化时间。
const enterSpace = selection.indexOf("_set(c, 'stat_data.系统状态.是否在主神空间', false);");
const clearTime = selection.indexOf("_set(c, 'stat_data.世界.时间', '');", enterSpace);
const clearCalendar = selection.indexOf("_set(c, 'stat_data.世界.历法', {});", enterSpace);
const setWorldName = selection.indexOf("_set(c, 'stat_data.世界.名称', worldTitle);", enterSpace);
assert.ok(enterSpace >= 0, 'missing main-space exit write');
assert.ok(clearTime > enterSpace, '世界.时间 must be cleared when leaving main space');
assert.ok(clearCalendar > clearTime, 'old world calendar must be cleared with world time');
assert.ok(setWorldName > clearCalendar, 'new world name should be written after time/calendar reset');

// 世界时间所有权守卫仍禁止普通变量更新改时间，但允许两个程序化世界切换边界。
assert.match(ownership, /从主神空间进入新副本时，程序会先清空世界\.时间与旧历法/);
assert.match(ownership, /const enteringWorld=wasSpace&&!isSpace;/);
assert.match(ownership, /const returningToSpace=!wasSpace&&isSpace;/);
assert.match(ownership, /enteringWorld&&worldTimeUnset\(incoming\)/);
assert.match(ownership, /returningToSpace&&mainSpaceTime/);
assert.match(ownership, /variables\.stat_data\.世界\.时间=previous;/);

// 轮回历映射：游玩第1天固定从 1年-04月-04日开始；360天后进入下一轮回年同一日期。
function samsaraDate(playDays) {
  const safeDays = Math.max(1, Math.floor(Number(playDays) || 1));
  const index = ((4 - 1) * 30 + (4 - 1)) + (safeDays - 1);
  const year = Math.floor(index / 360) + 1;
  const dayOfYear = index % 360;
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;
  return [year, month, day];
}
assert.deepEqual(samsaraDate(1), [1, 4, 4]);
assert.deepEqual(samsaraDate(2), [1, 4, 5]);
assert.deepEqual(samsaraDate(360), [2, 4, 3]);
assert.deepEqual(samsaraDate(361), [2, 4, 4]);

console.log('world-time lifecycle regression: ok');
