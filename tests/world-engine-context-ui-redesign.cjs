const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const prose = fs.readFileSync(path.join(root, 'World Book', '[variables]当前变量.txt'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'script', 'world-engine-src', '50-engine-ui.part.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'script', '世界引擎接入说明.md'), 'utf8');

// 正文可见投影必须以热场景为一级单位，共享现场只出现一次。
assert.match(prose, /const sceneCandidates = new Map\(\)/, '场外场景应由热场景候选统一聚合');
assert.match(prose, /关联事件: scene\.关联事件/, '地区投影应挂当前事件索引');
assert.match(prose, /人物: scene\.人物/, '地区投影应包含该地区活动人物列表');
assert.match(prose, /readonly\.世界\.场外场景 = hotScenes/, '正文投影应输出热场景数组');
assert.doesNotMatch(prose, /readonly\.世界\.场外人物动态\s*=/, '旧场外人物动态字段不得继续输出');
assert.doesNotMatch(prose, /身边发展:\s*Object\.keys\(surroundings\)/, '人物下不应再复制共享身边发展');
assert.doesNotMatch(prose, /身边人物:\s*nearbyPeopleFor/, '正文投影不应为每个热人物重复列同地区人物');

// 角色管理必须把正式关系人物和纯后台人物放进同一名册、同一详情区。
assert.match(ui, /const rolePeople=/, '角色页应构建统一人物名册');
assert.match(ui, /section\('人物名册'/, '角色页标题应改为统一人物名册');
assert.doesNotMatch(ui, /section\('后台活动人物'/, '独立后台活动人物面板必须删除');
assert.doesNotMatch(ui, /we-temp-person-list/, '独立后台人物卡片布局必须删除');
assert.match(ui, /世界人物/, '纯后台人物应以轻量来源标签出现在统一名册');
assert.match(ui, /异端档案/, '异端选中时应能查看雷达中的阵营、职业、层级等信息');
assert.match(ui, /derivePersonWorldContext\(s,chosen\[0\],userName\)/, '纯后台人物也应复用统一世界现场详情');

// 探索页必须把地区详情移出窄右栏，现场群体/资源点使用完整宽度展示。
assert.match(ui, /we-area-detail/, '探索页应有全宽区域详情布局');
assert.match(ui, /we-area-scene-wide/, '现场群体与资源点应使用宽版现场布局');
assert.doesNotMatch(ui, /<aside class=\"we-area-side\">'\+section\('区域档案'/, '区域档案不能继续塞在右侧窄栏');
assert.match(ui, /section\('区域档案',areaDetail/, '区域档案应独立成完整宽度区块');

assert.match(guide, /场外场景.*热场景/s, '接入说明应记录多场景热投影结构');
assert.match(guide, /统一人物名册/, '接入说明应记录角色 UI 新边界');
assert.match(guide, /区域档案.*完整宽度/s, '接入说明应记录探索 UI 新布局');

console.log('world-engine context/UI redesign acceptance passed');
