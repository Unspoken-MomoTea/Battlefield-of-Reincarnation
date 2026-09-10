const assert = require('node:assert/strict');
const {
  emptyState,
  compactWorldLifecycle,
  projectWorldContext,
} = require('../script/世界推进系统.js');

const person = (overrides = {}) => ({
  所属世界: '测试世界',
  地点: '远郊',
  目标: '继续行动',
  行动: '等待',
  认知: [],
  下次检查: '',
  关联事件: [],
  公开动态: '',
  状态: '活动中',
  更新时间: '2026年-8月-1日',
  ...overrides,
});

const stat = {
  世界: {
    名称: '测试世界',
    时间: '2026年-10月-1日',
    地点: '灰港',
    后台: emptyState(),
    异端雷达: {
      名单: {
        活跃异端: { 状态: '活跃' },
      },
    },
  },
  关系列表: {
    正式同伴: { 在场: false, 身份: ['同伴'], 好感度: 0 },
  },
  设置: { 单一世界: false },
};

stat.世界.后台.事件 = {
  远方任务: {
    描述: '远方行动持续',
    时间: '2026年-10月-3日',
    条件: '',
    前因: [],
    状态: '待发生',
    默认走向: '',
    结果: '',
    公开征兆: '',
    地点: '北境',
    分类: '近期节点',
    开始时间: '',
    预计结束: '',
    更新时间: '',
    下次检查: '',
    参与者: ['事件人物'],
    关联任务: [],
    可见影响: [],
  },
};

stat.世界.后台.人物 = {
  正式同伴: person({ 更新时间: '2026年-7月-1日' }),
  活跃异端: person({ 地点: '极远处', 更新时间: '2026年-1月-1日' }),
  事件人物: person({ 地点: '北境', 关联事件: ['远方任务'], 更新时间: '2026年-1月-1日' }),
  当前现场临时人: person({ 地点: '灰港-码头', 更新时间: '2026年-1月-1日' }),
  近期临时人: person({ 地点: '南方驿站', 更新时间: '2026年-9月-30日' }),
  语义时间临时人: person({ 地点: '西部道路', 更新时间: '第七夜' }),
  已离场临时人: person({ 状态: '已离场', 更新时间: '2026年-9月-30日' }),
  过期临时人: person({ 更新时间: '2026年-8月-1日' }),
};

// 请求上下文只发送真正热的后台人物；正式关系列表仍单独存在。
const before = projectWorldContext(stat);
const hotNames = Object.keys(before.世界.后台.人物);
assert.ok(hotNames.includes('活跃异端'), '活跃异端必须始终进入世界引擎上下文');
assert.ok(hotNames.includes('事件人物'), '活跃/未来事件关联人物必须进入上下文');
assert.ok(hotNames.includes('当前现场临时人'), '当前地点相关临时人物必须进入上下文');
assert.ok(hotNames.includes('近期临时人'), '近期更新的临时人物应保留短期连续性');
assert.ok(!hotNames.includes('过期临时人'), '陈旧且无引用的临时人物不应继续污染世界引擎上下文');
assert.ok(!hotNames.includes('已离场临时人'), '明确结束的临时人物不应继续进入上下文');
assert.ok(!hotNames.includes('正式同伴'), '仅存在于关系列表本身不能让陈旧后台行动永久保持热度');
assert.ok(before.关系列表.正式同伴, '正式人物档案仍通过关系列表提供给世界引擎');

const report = compactWorldLifecycle(stat);
assert.ok(report.回收人物.includes('已离场临时人'), '明确终止且无保护引用的临时人物应被回收');
assert.ok(report.回收人物.includes('过期临时人'), '超过冷却期且无保护引用的临时人物应被回收');
assert.ok(stat.世界.后台.人物.正式同伴, '关系列表正式人物绝不能被临时人物回收器删除');
assert.ok(stat.世界.后台.人物.活跃异端, '活跃异端绝不能被临时人物回收器删除');
assert.ok(stat.世界.后台.人物.事件人物, '仍被活跃/未来事件引用的人物不能被回收');
assert.ok(stat.世界.后台.人物.当前现场临时人, '当前地点相关临时人物不能被回收');
assert.ok(stat.世界.后台.人物.近期临时人, '近期活动人物不能被回收');
assert.ok(stat.世界.后台.人物.语义时间临时人, '无法比较的作品内时间不得仅凭时间字符串盲删');

// 无引用、无正式档案、无可比较更新时间的冷临时人物也有硬上限，避免永久累积。
for (let i = 0; i < 40; i++) {
  stat.世界.后台.人物[`无时间临时${String(i).padStart(2, '0')}`] = person({ 更新时间: '', 地点: `远郊-${i}` });
}
const capped = compactWorldLifecycle(stat);
const coldUntimed = Object.keys(stat.世界.后台.人物).filter(name => name.startsWith('无时间临时'));
assert.ok(coldUntimed.length <= 32, `冷临时人物应受硬上限控制，当前 ${coldUntimed.length}`);
assert.ok(capped.回收人物.some(name => name.startsWith('无时间临时')), '超过硬上限时应确定性回收最旧冷临时人物');

console.log('world-engine temporary people lifecycle acceptance passed');
