const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const auxPath = 'script/辅助计算脚本.js';
const rulesPath = 'World Book/⚙️资产与载具规则.txt';
const source = fs.readFileSync(auxPath, 'utf8');
const rules = fs.readFileSync(rulesPath, 'utf8');

assert.match(rules, /每7个【系统状态\.游玩天数】形成1份/);
assert.match(rules, /【自动收菜】绝不直接写入背包、货币或库存/);
assert.match(rules, /AI不得代替玩家自动办理/);
assert.match(rules, /产出字段只写每份的本地货币或物资“名称×数量”，不写周期/);

assert.match(
  source,
  /worldCommit[\s\S]*?guardTaskGenerationLock\(statData\);[\s\S]*?updatePlayDays\(statData\);[\s\S]*?autoHarvestAssets\(statData, statDataBefore\);[\s\S]*?calcWorldStability\(statData\);[\s\S]*?return;/,
  '世界推进提交必须同步推进隐藏游玩日并执行资产收菜调度',
);

const injectMarker = '    // 初始化事件注册';
assert.ok(source.includes(injectMarker), '找不到辅助脚本测试注入点');
const testable = source.replace(
  injectMarker,
  "    globalThis.__assetHarvestTest = { updatePlayDays, autoHarvestAssets };\n\n" + injectMarker,
);

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  waitGlobalInitialized: async () => {},
  eventOn: () => {},
  Mvu: { events: { VARIABLE_UPDATE_ENDED: 'VARIABLE_UPDATE_ENDED' } },
  toastr: { success: () => {} },
  GS_PARENT: {},
  window: { parent: {} },
};
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox;
vm.runInNewContext(testable, sandbox, { filename: auxPath });

const { updatePlayDays, autoHarvestAssets } = sandbox.__assetHarvestTest || {};
assert.equal(typeof updatePlayDays, 'function');
assert.equal(typeof autoHarvestAssets, 'function');

// 自定义/古代纪年也必须能推进隐藏游玩日轴，不要求阿拉伯数字年份。
const clock = {
  世界: { 时间: '大业十三年-08月-12日-午时' },
  系统状态: { 游玩天数: 0, 上次世界日期: '' },
};
updatePlayDays(clock);
assert.equal(clock.系统状态.游玩天数, 1);
assert.equal(clock.系统状态.上次世界日期, '大业十三-8-12');
clock.世界.时间 = '大业十三年-08月-13日-清晨';
updatePlayDays(clock);
assert.equal(clock.系统状态.游玩天数, 2);
assert.equal(clock.系统状态.上次世界日期, '大业十三-8-13');

// 收菜必须只靠游玩日轴初始化；世界历法无法换算时，展示字段回退为“第N游玩日”。
const stat = {
  世界: { 时间: '大业十三年-08月-13日-清晨' },
  系统状态: { 游玩天数: 5, 上次世界日期: '大业十三-8-13' },
  角色: { 道具: { 旧物: { 数量: 1 } }, 空间币: 77 },
  资产: {
    永恒魔力池: {
      所属对象: ['<user>'],
      类型: '固定地产',
      建设序列: {
        魔力凝聚: {
          阶段: '专业',
          功能: '周期凝聚高纯度魔力结晶',
          加成: [],
          产出: '魔力结晶×2',
          下次产出日期: '',
          下次产出游天: 0,
        },
      },
      待办事件: [],
    },
  },
};
const beforeRole = JSON.stringify(stat.角色);
autoHarvestAssets(stat, { 资产: {} });
const seq = stat.资产.永恒魔力池.建设序列.魔力凝聚;
assert.equal(seq.下次产出游天, 12, '首次有效产出应固定在当前游玩日+7');
assert.equal(seq.下次产出日期, '第12游玩日', '自定义纪年不能阻断调度，展示应回退到游玩日');
assert.deepEqual(stat.资产.永恒魔力池.待办事件, []);
assert.equal(JSON.stringify(stat.角色), beforeRole, '初始化调度不得修改背包/货币');

// 到期只生成待办；绝不直接写入玩家背包、货币或库存。
const beforeDue = JSON.parse(JSON.stringify(stat));
stat.系统状态.游玩天数 = 12;
autoHarvestAssets(stat, beforeDue);
assert.equal(seq.下次产出游天, 19);
assert.equal(seq.下次产出日期, '第19游玩日');
assert.equal(stat.资产.永恒魔力池.待办事件.length, 1);
assert.match(stat.资产.永恒魔力池.待办事件[0], /共1份/);
assert.match(stat.资产.永恒魔力池.待办事件[0], /玩家主动办理领取/);
assert.match(stat.资产.永恒魔力池.待办事件[0], /不得自动写入背包、货币或库存/);
assert.equal(JSON.stringify(stat.角色), beforeRole, '到期触发也不得直接修改玩家资产');

// 跨过多个周期时只生成一条累计待办，并滚动到严格晚于当前游玩日的下一周期。
const catchUp = JSON.parse(JSON.stringify(stat));
catchUp.系统状态.游玩天数 = 33;
catchUp.资产.永恒魔力池.待办事件 = [];
catchUp.资产.永恒魔力池.建设序列.魔力凝聚.下次产出游天 = 19;
catchUp.资产.永恒魔力池.建设序列.魔力凝聚.下次产出日期 = '第19游玩日';
const catchUpBefore = JSON.parse(JSON.stringify(catchUp));
autoHarvestAssets(catchUp, catchUpBefore);
const catchSeq = catchUp.资产.永恒魔力池.建设序列.魔力凝聚;
assert.equal(catchSeq.下次产出游天, 40);
assert.equal(catchUp.资产.永恒魔力池.待办事件.length, 1);
assert.match(catchUp.资产.永恒魔力池.待办事件[0], /共3份/);
assert.equal(JSON.stringify(catchUp.角色), beforeRole, '累计产出仍只能进入待办，不能自动入账');

console.log('PASS asset harvest lifecycle');
