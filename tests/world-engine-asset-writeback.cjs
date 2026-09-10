const fs = require('node:fs');
const assert = require('node:assert/strict');
const {
  emptyState,
  compileWorldResult,
  applyPatches,
  WORLD_RESULT_SCHEMA,
  projectWorldContext,
} = require('../script/世界推进系统.js');

const assetSchema = WORLD_RESULT_SCHEMA.properties.资产;
assert.ok(assetSchema, 'WorldResult 必须开放资产业务字段');
assert.deepEqual(assetSchema.items.properties.操作.enum, ['更新', '移除', '撤销本轮']);
assert.ok(assetSchema.items.properties.所属对象, '资产结果必须支持所属对象');
assert.ok(assetSchema.items.properties.能源, '资产结果必须支持能源变化');
assert.ok(assetSchema.items.properties.消耗单元, '资产结果必须支持消耗单元变化');
assert.ok(assetSchema.items.properties.建设序列, '资产结果必须支持建设序列变化');
assert.ok(assetSchema.items.properties.驻扎人员, '资产结果必须支持驻扎人员变化');
assert.ok(assetSchema.items.properties.待办事件, '资产结果必须支持待办事件变化');

const stat = {
  世界: {
    名称: '艾泽拉斯',
    时间: '黑暗之门历84年7月12日正午',
    地点: '安多哈尔南郊',
    后台: emptyState(),
    因果轨道: { 当前阶段: '', 故事线: '', 下一节点: '', 偏移记录: {} },
    势力: { 白银之手: { 实力: 'B', 领地: '洛丹伦', 描述: '', 声望: 1000 } },
    探索: {},
    货币: { 体系: '', 购买力基准: '', 经济波动: '' },
    历法: { 名称: '', 月份天数: [], 闰年规则: '' },
    异端雷达: { 名单: {} },
  },
  角色: {},
  关系列表: {},
  传闻: {},
  设置: {},
  系统状态: { 是否战斗中: false, 是否在主神空间: false },
  资产: {
    远征堡: {
      所属对象: ['<user>'],
      类型: '固定地产',
      主体规模: 4,
      完整度: 88,
      状态: '远征军正在整备',
      能源: { 类型: '魔能核心', 当前: 40, 上限: 100, 描述: '维持护盾与传送阵' },
      消耗单元: {
        蜂群无人机: { 余量: 4, 上限: 6, 加成: ['侦察检定+10'] },
        旧弹药: { 余量: 12, 上限: 12, 加成: ['攻击力:50物理'] },
      },
      建设序列: {
        商路: { 阶段: '进阶', 功能: '组织商队跨区运输', 加成: ['贸易检定+5'], 产出: '每周补给', 下次产出日期: '84年7月15日', 下次产出游天: 9 },
        废旧工坊: { 阶段: '基础', 功能: '临时维修', 加成: [], 产出: '无', 下次产出日期: '', 下次产出游天: 0 },
      },
      驻扎人员: { 玛雅: '远征负责人', 老兵: '守卫' },
      待办事件: ['北门补给短缺'],
    },
  },
};

const update = compileWorldResult(stat, {
  摘要: '白银之手正式接管远征堡并调整后勤。',
  资产: [{
    名称: '远征堡',
    所属对象: ['白银之手'],
    完整度: 76,
    能源: { 当前: 25 },
    消耗单元: {
      蜂群无人机: { 余量: 2 },
      旧弹药: null,
    },
    建设序列: {
      商路: { 功能: '改走北线并护送难民' },
      废旧工坊: null,
    },
    驻扎人员: {
      玛雅: null,
      伊芙: '新任远征负责人',
    },
    待办事件: ['商队两日未归'],
  }],
});
assert.equal(update.patches.length, 1, '单个资产应作为一次原子账簿更新');
assert.equal(update.patches[0].path, '/资产/远征堡');
let next = applyPatches(stat, update.patches);
const fort = next.资产.远征堡;
assert.deepEqual(fort.所属对象, ['白银之手'], '资产可以从个人转移给势力');
assert.equal(fort.类型, '固定地产', '局部更新不能丢失既有资产字段');
assert.equal(fort.主体规模, 4);
assert.equal(fort.完整度, 76);
assert.deepEqual(fort.能源, { 类型: '魔能核心', 当前: 25, 上限: 100, 描述: '维持护盾与传送阵' }, '能源局部更新必须合并旧字段');
assert.deepEqual(fort.消耗单元.蜂群无人机, { 余量: 2, 上限: 6, 加成: ['侦察检定+10'] }, '消耗单元应按名称局部合并');
assert.equal(fort.消耗单元.旧弹药, undefined, 'null 应删除指定消耗单元而不是清空整个资产');
assert.equal(fort.建设序列.商路.阶段, '进阶');
assert.equal(fort.建设序列.商路.功能, '改走北线并护送难民');
assert.equal(fort.建设序列.商路.下次产出游天, 9, '模型不可见的收菜调度字段必须保留');
assert.equal(fort.建设序列.废旧工坊, undefined, 'null 应删除指定建设序列');
assert.equal(fort.驻扎人员.玛雅, undefined, 'null 应移除离岗人员');
assert.equal(fort.驻扎人员.老兵, '守卫', '未提交的驻扎人员必须保留');
assert.equal(fort.驻扎人员.伊芙, '新任远征负责人');
assert.deepEqual(fort.待办事件, ['商队两日未归'], '待办事件数组由本轮显式值替换');

const created = compileWorldResult(next, {
  摘要: '白银之手在南门建立新的前线要塞。',
  资产: [{
    名称: '南门前线要塞',
    所属对象: ['白银之手'],
    类型: '固定地产',
    主体规模: 3,
    状态: '正在加固城墙',
    建设序列: {
      城防: { 功能: '组织城防与警戒' },
    },
    驻扎人员: { 提里奥: '前线指挥' },
  }],
});
next = applyPatches(next, created.patches);
const newAsset = next.资产.南门前线要塞;
assert.deepEqual(newAsset.所属对象, ['白银之手']);
assert.equal(newAsset.完整度, 100, '新资产由程序补足安全默认字段');
assert.deepEqual(newAsset.建设序列.城防, {
  阶段: '基础',
  功能: '组织城防与警戒',
  加成: [],
  产出: '',
  下次产出日期: '',
  下次产出游天: 0,
});
assert.deepEqual(newAsset.待办事件, []);
assert.throws(() => compileWorldResult(next, {
  摘要: '错误的新资产。',
  资产: [{ 名称: '无主仓库', 类型: '固定地产' }],
}), /所属对象/, '新资产必须明确归属，禁止默认把世界资产送给玩家');

const projected = projectWorldContext(next);
assert.deepEqual(projected.资产.远征堡.所属对象, ['白银之手'], '世界引擎上下文必须看到势力资产与归属');
assert.ok(projected.资产.南门前线要塞, '世界引擎必须读取非玩家资产');

const removed = compileWorldResult(next, {
  摘要: '南门要塞被彻底摧毁并退出账簿。',
  资产: [{ 名称: '南门前线要塞', 操作: '移除' }],
});
next = applyPatches(next, removed.patches);
assert.equal(next.资产.南门前线要塞, undefined, '世界引擎应能移除已彻底消失的资产');

const zod = fs.readFileSync('script/ZOD脚本.js', 'utf8');
const mvuRules = fs.readFileSync('World Book/[mvu_update]变量更新规则.txt', 'utf8');
const assetRules = fs.readFileSync('World Book/⚙️资产与载具规则.txt', 'utf8');
const variables = fs.readFileSync('World Book/[variables]当前变量.txt', 'utf8');
const helper = fs.readFileSync('script/辅助计算脚本.js', 'utf8');
const checks = fs.readFileSync('World Book/⚙️行为判定[mvu_plot].txt', 'utf8');
const source = fs.readFileSync('script/世界推进系统.js', 'utf8');

assert.match(zod, /const assetOwners[\s\S]{0,220}z\.array\(z\.string\(\)\)/, '旧资产所属对象应兼容迁移为数组');
assert.match(zod, /所属对象:\s*assetOwners/, '资产 Schema 应使用所属对象数组规范器');
assert.match(mvuRules, /所属对象:[\s\S]{0,260}string\[\][\s\S]{0,260}(?:多个对象|共同持有|共管|空数组)/, '变量规则必须定义多主体/无主资产归属');
assert.match(assetRules, /所属对象[\s\S]{0,320}字符串数组[\s\S]{0,320}(?:多方共管|空数组|无主)/, '资产规则必须定义数组、多主体与无主归属');
assert.match(source, /WorldResult\.资产|资产账簿/, '世界引擎提示词必须明确资产写入职责');
assert.match(source, /场外[^\n]{0,160}资产[^\n]{0,160}(?:新增|更新|移除|转移)|资产[^\n]{0,160}(?:新增|更新|移除|转移)/, 'Prompt 应允许世界引擎维护资产变化');
assert.match(source, /version:13,\n        builtin:true,\n        name:'默认设置'/, '资产写回语义变更应升级内置默认提示词到 v13');
assert.match(variables, /isPlayerOwnedAsset/, '正文变量投影必须区分玩家资产与世界资产');
assert.match(helper, /isPlayerOwnedAsset/, '自动收菜必须区分玩家资产与世界资产');
assert.match(checks, /所属对象[^\n]*(?:执行者|角色)/, '资产检定加值必须受所属对象约束');

console.log('world-engine asset ownership/writeback acceptance passed');
