const fs = require('node:fs');
const assert = require('node:assert/strict');
const { emptyState, derivePersonWorldContext } = require('../script/世界推进系统.js');

const stat = {
  世界: {
    名称: '艾泽拉斯',
    地点: '安多哈尔南郊-乱石岗',
    后台: emptyState(),
    异端雷达: { 名单: {} },
  },
  关系列表: {
    '光明使者乌瑟尔': { 身份: ['圣骑士'], 在场: false, 背景故事: '白银之手的领袖。' },
    '巴拉斯·希尔维': { 身份: ['副官'], 在场: false },
    '远方斥候': { 身份: ['斥候'], 在场: false },
  },
};

stat.世界.后台.人物 = {
  '光明使者乌瑟尔': {
    所属世界: '艾泽拉斯',
    地点: '安多哈尔南郊-乱石岗',
    目标: '整顿残部',
    行动: '清点伤员',
    背景关联: [
      { 类型: '团体', 名称: '白银之手骑士团', 关系: '大领袖' },
      { 类型: '社交圈', 名称: '洛丹伦流亡者核心', 关系: '核心成员' },
    ],
    关联事件: ['洛丹伦的陷落'],
  },
  '巴拉斯·希尔维': {
    所属世界: '艾泽拉斯',
    地点: '安多哈尔南郊-乱石岗',
    行动: '正递来一壶温水',
  },
  '远方斥候': {
    所属世界: '艾泽拉斯',
    地点: '安多哈尔南郊-旧路口',
    行动: '监视北侧道路',
  },
};

stat.世界.后台.势力地区 = {
  '安多哈尔南郊': {
    类型: '地区',
    进展: '流亡营在岗哨后方逐渐成形。',
    控制方: '白银之手残部',
    争夺方: ['天灾军团游荡队'],
    环境状态: ['死灵寒雾', '粮食紧张'],
    现场群体: [
      { 名称: '残余圣骑士', 规模: '8人', 身份: '战斗员', 动态: '正在修整铠甲' },
      { 名称: '洛丹伦难民', 规模: '约180人', 身份: '平民', 动态: '正在篝火旁取暖' },
    ],
    资源点: [
      { 名称: '临时粮仓', 类型: '补给', 状态: '紧缺', 控制方: '白银之手残部', 动态: '每日消耗加快' },
    ],
  },
};

const context = derivePersonWorldContext(stat, '光明使者乌瑟尔', '测试玩家');
assert.equal(context.地区, '安多哈尔南郊');
assert.equal(context.地区动态, '流亡营在岗哨后方逐渐成形。');
assert.equal(context.控制方, '白银之手残部');
assert.deepEqual(context.背景关联.map(x => x.名称), ['白银之手骑士团', '洛丹伦流亡者核心']);
assert.deepEqual(context.关联事件, ['洛丹伦的陷落']);
assert.deepEqual(context.现场群体.map(x => x.名称), ['残余圣骑士', '洛丹伦难民']);
assert.deepEqual(context.资源点.map(x => x.名称), ['临时粮仓']);
assert.deepEqual(context.身边人物.map(x => x.名称), ['巴拉斯·希尔维', '远方斥候']);
assert.equal(context.身边人物[0].关系, '贴身');
assert.equal(context.身边人物[1].关系, '同地区');
assert.equal(context.身边人物[0].身份, '副官');

// 人物移动只改变派生视图，不能复制/改写地区现场。
stat.世界.后台.人物['光明使者乌瑟尔'].地点 = '提瑞斯法林地北部';
const moved = derivePersonWorldContext(stat, '光明使者乌瑟尔', '测试玩家');
assert.equal(moved.地区, '');
assert.deepEqual(moved.现场群体, []);
assert.deepEqual(moved.资源点, []);
assert.equal(stat.世界.后台.势力地区['安多哈尔南郊'].现场群体.length, 2);

const source = fs.readFileSync('script/世界推进系统.js', 'utf8');
for (const marker of [
  "section('身边发展'",
  "section('背景关联'",
  'we-scene-grid',
  'we-context-list',
  'derivePersonWorldContext(s,chosen[0],userName)',
  '现场群体',
  '资源点',
]) {
  assert.ok(source.includes(marker), `角色管理 UI 缺少：${marker}`);
}
assert.ok(source.includes('人物背景:rel.背景故事'), 'MVU 背景故事仍应保留在人物完整档案');
assert.ok(!source.includes('chosen[1].身边发展'), 'UI 必须使用派生现场，不能读取持久化身边发展');

console.log('world-engine person scene UI acceptance passed');
