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

const now = '黑暗之门历84年7月12日正午';
const data = {
  世界: {
    名称: '艾泽拉斯',
    时间: now,
    地点: '东部王国-暴风城-法师区-高塔',
    因果轨道: { 当前阶段: '多地局势同时推进', 故事线: '', 下一节点: '', 偏移记录: {} },
    异端雷达: {
      名单: {
        '异端侦察者': { 状态: '活跃' },
      },
    },
    后台: {
      事件: {
        '安多哈尔攻防': { 分类: '当前事件', 状态: '进行中', 时间: now, 地点: '东部王国-西瘟疫之地-安多哈尔', 公开征兆: '南门号角连续响起。', 可见影响: [] },
        '冰冠围城': { 分类: '当前事件', 状态: '进行中', 时间: now, 地点: '诺森德-冰冠堡垒', 公开征兆: '远征军开始封锁山口。', 可见影响: [] },
      },
      人物: {
        '乌瑟尔': { 地点: '东部王国-西瘟疫之地-安多哈尔-南门', 目标: '稳住防线', 行动: '重新部署圣骑士', 状态: '活跃', 更新时间: now, 公开动态: '南门守军正在重组。', 关联事件: ['安多哈尔攻防'] },
        '萨尔': { 地点: '卡利姆多-奥格瑞玛-力量谷', 目标: '整顿远征军', 行动: '召集各氏族代表', 状态: '活跃', 更新时间: now, 公开动态: '', 关联事件: [] },
        '异端侦察者': { 地点: '外域-影月谷-废墟', 目标: '侦察传送门', 行动: '潜伏观察', 状态: '活跃', 更新时间: '很久以前', 公开动态: '', 关联事件: [] },
        '冷旧人物': { 地点: '东部王国-湿地', 目标: '旧目标', 行动: '旧行动', 状态: '', 更新时间: '黑暗之门历80年', 公开动态: '', 关联事件: [] },
      },
      势力地区: {
        '东部王国-暴风城-法师区': { 类型: '地区', 更新时间: now, 控制方: '暴风城王国', 环境状态: ['魔网稳定'], 现场群体: [{ 名称: '法师学徒', 规模: '数十', 身份: '施法者', 动态: '维持高塔结界' }] },
        '东部王国-西瘟疫之地-安多哈尔': { 类型: '地区', 更新时间: now, 控制方: '白银之手', 环境状态: ['瘟疫迷雾'], 现场群体: [{ 名称: '白银之手残军', 规模: '24人', 身份: '守军', 动态: '重建南门防线' }] },
        '卡利姆多-奥格瑞玛': { 类型: '地区', 更新时间: now, 控制方: '部落', 环境状态: ['军队集结'], 现场群体: [] },
        '诺森德-冰冠堡垒': { 类型: '地区', 更新时间: '昨日', 控制方: '远征军', 环境状态: ['寒风'], 现场群体: [] },
        '外域-沙塔斯': { 类型: '地区', 更新时间: now, 控制方: '沙塔尔', 环境状态: ['难民涌入'], 现场群体: [{ 名称: '外域难民', 规模: '数百', 身份: '平民', 动态: '进入贫民窟' }] },
        '东部王国-湿地': { 类型: '地区', 更新时间: '黑暗之门历80年', 控制方: '', 环境状态: ['旧记录'], 现场群体: [] },
      },
    },
  },
  系统状态: { 是否在主神空间: false },
  角色: { 名称: '玩家' },
  关系列表: {},
};

function project(sample) {
  const current = { 世界: clone(sample.世界) };
  const readonly = { 世界: {} };
  render(current, sample, readonly, lodash, true, false);
  return readonly.世界;
}

const readonlyWorld = project(data);
assert.equal(readonlyWorld.场外人物动态, undefined, '旧的场外人物动态字段必须退出正文投影');
assert.ok(Array.isArray(readonlyWorld.场外场景), '正文应输出场外场景数组');
const scenes = readonlyWorld.场外场景;
assert.equal(new Set(scenes.map(scene => scene.地区)).size, scenes.length, '同一地区只能出现一个热场景');
assert.equal(scenes.some(scene => Object.hasOwn(scene, '资源点')), false, '热场景不得继续暴露误加的资源点');

const andorhal = scenes.find(scene => scene.地区 === '东部王国-西瘟疫之地-安多哈尔');
assert.ok(andorhal, '有当前事件与热人物的安多哈尔必须进入热场景');
assert.deepEqual(andorhal.关联事件, ['安多哈尔攻防']);
assert.equal(andorhal.现场群体[0].名称, '白银之手残军');
assert.equal(andorhal.人物[0].名称, '乌瑟尔');

const icecrown = scenes.find(scene => scene.地区 === '诺森德-冰冠堡垒');
assert.ok(icecrown, '没有人物但存在公开进行中事件的地区也必须成为热场景');
assert.deepEqual(icecrown.关联事件, ['冰冠围城']);
assert.equal(Object.hasOwn(icecrown, '人物'), false, '事件型场景不应为填格式制造空人物数组');

const shattrath = scenes.find(scene => scene.地区 === '外域-沙塔斯');
assert.ok(shattrath, '本轮刚更新且存在现场事实的地区可独立成为热场景');
assert.equal(shattrath.现场群体[0].名称, '外域难民');

const alienScene = scenes.find(scene => (scene.人物 || []).some(person => person.名称 === '异端侦察者'));
assert.ok(alienScene, '活跃异端所在场景必须保持热度，即使其更新时间较旧');

assert.equal(scenes.some(scene => scene.地区 === '东部王国-湿地'), false, '没有当前事件、热人物或本轮变化的冷地区不得占正文上下文');
for (const person of scenes.flatMap(scene => scene.人物 || [])) {
  for (const key of ['身边发展', '身边人物', '现场群体', '环境状态']) {
    assert.equal(Object.hasOwn(person, key), false, `人物子项不得复制地区共享现场：${person.名称}/${key}`);
  }
}

// 大型世界压力：很多活跃异端分散在不同大陆时，不能把当前地区和公开进行中事件挤出场景投影。
const crowded = clone(data);
for (let i = 1; i <= 7; i++) {
  const name = `异端远征者${i}`;
  crowded.世界.异端雷达.名单[name] = { 状态: '活跃' };
  crowded.世界.后台.人物[name] = {
    地点: `未知大陆${i}-前线营地`,
    目标: '维持干涉行动',
    行动: '观察当地局势',
    状态: '活跃',
    更新时间: '很久以前',
    公开动态: '',
    关联事件: [],
  };
}
const crowdedScenes = project(crowded).场外场景 || [];
assert.ok(crowdedScenes.some(scene => scene.地区 === '东部王国-暴风城-法师区'), '当前玩家所在地区必须强制保留，不能被大量异端场景挤出');
assert.ok(crowdedScenes.some(scene => scene.地区 === '东部王国-西瘟疫之地-安多哈尔'), '公开进行中事件所在地区必须强制保留');
assert.ok(crowdedScenes.some(scene => scene.地区 === '诺森德-冰冠堡垒'), '无人但公开进行中的事件场景也必须强制保留');
for (const name of Object.keys(crowded.世界.异端雷达.名单)) {
  if (crowded.世界.异端雷达.名单[name].状态 === '死亡') continue;
  assert.ok(crowdedScenes.some(scene => (scene.人物 || []).some(person => person.名称 === name)), `活跃异端所在场景必须保留：${name}`);
}

console.log('world-engine hot scene projection acceptance passed');
