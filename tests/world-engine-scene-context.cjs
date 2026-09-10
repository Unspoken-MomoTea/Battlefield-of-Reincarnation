const fs = require('node:fs');
const assert = require('node:assert/strict');
const {
  emptyState,
  compileWorldResult,
  applyPatches,
  WORLD_RESULT_SCHEMA,
} = require('../script/世界推进系统.js');

const personProps = WORLD_RESULT_SCHEMA.properties.人物.items.properties;
const areaProps = WORLD_RESULT_SCHEMA.properties.势力地区.items.properties;

assert.ok(personProps.背景关联, '人物应支持世界引擎背景关联');
assert.ok(areaProps.现场群体, '势力地区应支持共享现场群体');
assert.ok(areaProps.资源点, '势力地区应支持世界资源点');
assert.equal(personProps.身边发展, undefined, '身边发展必须是派生视图，不能持久化到人物');
assert.equal(personProps.身边人物, undefined, '身边人物必须从地点关系派生，不能持久化到人物');
assert.equal(WORLD_RESULT_SCHEMA.properties.资源点, undefined, '不得新增第二套顶层资源点数据库');

assert.deepEqual(Object.keys(personProps.背景关联.items.properties), ['类型', '名称', '关系']);
assert.deepEqual(Object.keys(areaProps.现场群体.items.properties), ['名称', '规模', '身份', '动态']);
assert.deepEqual(Object.keys(areaProps.资源点.items.properties), ['名称', '类型', '状态', '控制方', '动态']);

const stat = {
  世界: {
    名称: '艾泽拉斯',
    时间: '黑暗之门历84年7月12日正午',
    地点: '安多哈尔南郊-乱石岗',
    后台: emptyState(),
    因果轨道: { 当前阶段: '', 故事线: '', 下一节点: '', 偏移记录: {} },
    势力: {},
    探索: {},
    货币: { 体系: '', 购买力基准: '', 经济波动: '' },
    历法: { 名称: '', 月份天数: [], 闰年规则: '' },
    异端雷达: { 名单: {} },
  },
  设置: {},
  系统状态: { 是否在主神空间: false },
  关系列表: {},
  传闻: {},
};

const compiled = compileWorldResult(stat, {
  摘要: '安多哈尔南郊的流亡营继续变化。',
  人物: [{
    名称: '光明使者乌瑟尔',
    所属世界: '艾泽拉斯',
    地点: '安多哈尔南郊-乱石岗',
    目标: '维持流亡者生存并整顿残部',
    行动: '清点伤员并重新安排警戒',
    背景关联: [
      { 类型: '团体', 名称: '白银之手骑士团', 关系: '大领袖' },
      { 类型: '社交圈', 名称: '洛丹伦流亡者核心', 关系: '核心成员' },
    ],
  }],
  势力地区: [{
    名称: '安多哈尔南郊',
    类型: '地区',
    描述: '洛丹伦流亡者临时聚居的南部荒地。',
    现场群体: [
      { 名称: '残余圣骑士', 规模: '8人', 身份: '战斗员', 动态: '正在修整铠甲并轮换警戒' },
      { 名称: '洛丹伦难民', 规模: '约180人', 身份: '平民', 动态: '正在枯叶堆与篝火旁取暖' },
    ],
    资源点: [
      { 名称: '临时粮仓', 类型: '补给', 状态: '紧缺', 控制方: '白银之手残部', 动态: '每日消耗速度正在加快' },
      { 名称: '废弃修道院', 类型: '避难设施', 状态: '可用', 控制方: '洛丹伦流亡者', 动态: '正在改造成伤员安置点' },
    ],
  }],
});

const next = applyPatches(stat, compiled.patches);
assert.equal(next.世界.后台.人物['光明使者乌瑟尔'].背景关联[0].名称, '白银之手骑士团');
assert.equal(next.世界.后台.势力地区['安多哈尔南郊'].现场群体[1].规模, '约180人');
assert.equal(next.世界.后台.势力地区['安多哈尔南郊'].资源点[0].状态, '紧缺');
assert.equal(next.世界.后台.人物['光明使者乌瑟尔'].身边发展, undefined);

const variableProjection = fs.readFileSync('World Book/[variables]当前变量.txt', 'utf8');
for (const marker of [
  "const rawAreas = _.get(data, '世界.后台.势力地区', {}) || {};",
  'sceneAreaFor',
  '背景关联',
  '身边发展',
  '现场群体',
  '资源点',
  '身边人物',
]) {
  assert.ok(variableProjection.includes(marker), `正文只读投影缺少现场语义：${marker}`);
}
assert.match(variableProjection, /\.slice\(0, 4\)/, '身边发展必须限制投影规模');

const source = fs.readFileSync('script/世界推进系统.js', 'utf8');
assert.match(source, /先更新[^\n]*地区现场[^\n]*再决定人物行动/, '默认 Pipeline 应改为世界现场优先');
assert.match(source, /同一现场事实不得复制|不复制地点现场/, 'Prompt 必须约束共享现场去重');
assert.match(source, /version:10,\n        builtin:true,\n        name:'默认设置'/, 'P1-A 默认提示词应升级到 v10');

console.log('world-engine scene context acceptance passed');
