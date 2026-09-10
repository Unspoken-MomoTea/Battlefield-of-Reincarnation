const fs = require('node:fs');
const assert = require('node:assert/strict');
const { WORLD_RESULT_SCHEMA, projectWorldContext, emptyState } = require('../script/世界推进系统.js');

const areaProps = WORLD_RESULT_SCHEMA.properties.势力地区.items.properties;
assert.equal(areaProps.资源点, undefined, '势力地区不应再维护误加的资源点字段');
assert.ok(areaProps.资源, '势力地区原有资源摘要仍可用于世界事实，不等同玩家资产账簿');

const stat = {
  世界: {
    名称: '测试世界',
    时间: '2026年-09月-10日-下午',
    地点: '北境-远征堡',
    后台: emptyState(),
    因果轨道: { 当前阶段: '', 故事线: '', 下一节点: '', 偏移记录: {} },
    异端雷达: { 名单: {} },
  },
  资产: {
    远征堡: {
      类型: '固定地产',
      主体规模: 4,
      完整度: 88,
      状态: '远征军正在整备',
      建设序列: {
        商路: { 阶段: '进阶', 功能: '组织商队跨区运输', 加成: [], 产出: '每周补给' },
      },
      驻扎人员: { 玛雅: '远征负责人' },
      待办事件: ['商队两日未归', '北门补给短缺'],
    },
  },
  关系列表: {},
  传闻: {},
  设置: {},
  系统状态: { 是否战斗中: false, 是否在主神空间: false },
};
const ctx = projectWorldContext(stat);
assert.ok(ctx.资产.远征堡, '世界引擎必须直接读取既有资产账簿');
assert.deepEqual(ctx.资产.远征堡.驻扎人员, { 玛雅: '远征负责人' }, '后台推演需要看到资产驻扎人员');
assert.deepEqual(ctx.资产.远征堡.待办事件, ['商队两日未归', '北门补给短缺'], '后台推演需要看到资产待办事件');
assert.equal(ctx.资产.远征堡.建设序列.商路.功能, '组织商队跨区运输', '后台推演需要看到资产建设功能');

const source = fs.readFileSync('script/世界推进系统.js', 'utf8');
const stateSource = fs.readFileSync('script/world-engine-src/10-world-state.part.js', 'utf8');
const runtimeSource = fs.readFileSync('script/world-engine-src/40-engine-runtime.part.js', 'utf8');
const uiSource = fs.readFileSync('script/world-engine-src/50-engine-ui.part.js', 'utf8');
const proseProjection = fs.readFileSync('World Book/[variables]当前变量.txt', 'utf8');

for (const [name, text] of [
  ['世界状态源码', stateSource],
  ['运行时源码', runtimeSource],
  ['UI源码', uiSource],
  ['正文只读投影', proseProjection],
]) {
  assert.doesNotMatch(text, /资源点/, `${name} 不应继续维护误加的资源点概念`);
}
assert.match(source, /delete area\.资源点/, '交付脚本只允许保留旧存档资源点的只读过滤兼容');
assert.doesNotMatch(uiSource, /<small>当前选择<\/small>/, '区域档案不应重复上方探索卡的当前选择摘要');
assert.doesNotMatch(uiSource, /sceneLane\('资源点'/, '地区现场 UI 不应再渲染资源点栏');
assert.match(source, /资产[^\n]{0,120}(?:驻扎人员|待办事件)|(?:驻扎人员|待办事件)[^\n]{0,120}资产/, 'Prompt 应明确让后台世界推演参考现有资产账簿');

console.log('world-engine asset ledger cleanup acceptance passed');
