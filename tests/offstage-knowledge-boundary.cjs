const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../World Book/[variables]当前变量.txt'), 'utf8');
const start = source.indexOf('if (current.世界) {', source.indexOf('// 后台完整状态'));
const end = source.indexOf('// 世界超稳模式:', start);
assert.ok(start >= 0 && end > start, '应能定位正文世界投影块');
const render = new Function('current', 'data', 'readonly', '_', 'isWorldEngineEnabled', 'isOneWorld', source.slice(start, end));
const clone = value => JSON.parse(JSON.stringify(value));
const lodash = {
  get(value, dotted, fallback) {
    const result = String(dotted || '').split('.').filter(Boolean).reduce((node, key) => node?.[key], value);
    return result ?? fallback;
  },
};

const now = '2026年-09月-14日-夜晚';
const data = {
  世界: {
    名称: '测试世界', 时间: now, 地点: '王城-旅店', 因果轨道: {当前阶段:'',故事线:'',下一节点:'',偏移记录:{}},
    异端雷达: {名单:{}},
    后台: {
      事件: {},
      人物: {
        '场外密探': {地点:'王城-地牢',目标:'秘密调查玩家',行动:'翻查密档',状态:'活跃',更新时间:now,公开动态:'',关联事件:[]}
      },
      势力地区: {
        '王城-地牢': {类型:'地区',更新时间:now,控制方:'城卫军',环境状态:['戒严'],现场群体:[]}
      }
    }
  },
  系统状态: {是否在主神空间:false},
  角色: {名称:'玩家'},
  关系列表: {'场外密探': {在场:false,是否队友:false}}
};
const current = {世界: clone(data.世界)};
const readonly = {世界:{}};
render(current, data, readonly, lodash, true, false);
assert.ok(Array.isArray(readonly.世界.场外场景), '热场外人物应进入正文规划投影');
assert.match(String(readonly.世界.场外场景使用规则 || ''), /不等于.*知情|不得.*全知/, '场外私密行动必须附带正文可见的反全知规则');
assert.match(String(readonly.世界.场外场景使用规则 || ''), /在场|观察|认知|传播/, '反全知规则必须说明现实知情来源');
console.log('PASS offstage planning context carries an explicit anti-omniscience boundary');
