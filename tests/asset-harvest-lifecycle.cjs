const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const auxPath = 'script/辅助计算脚本.js';
const rulesPath = 'World Book/⚙️资产与载具规则.txt';
const source = fs.readFileSync(auxPath, 'utf8');
const rules = fs.readFileSync(rulesPath, 'utf8');

// 提示词只保留 AI 真正需要知道的内容，不暴露程序内部调度细节。
assert.match(rules, /产出记录: 只写“名称×数量”；无产出填“无”。自动收菜由程序处理；任务世界不得产出空间币。/);
assert.doesNotMatch(rules, /每7个【系统状态\.游玩天数】形成1份/);
assert.doesNotMatch(rules, /AI不得代替玩家自动办理/);
assert.doesNotMatch(rules, /绝不直接写入背包、货币或库存/);

assert.match(
  source,
  /worldCommit[\s\S]*?guardTaskGenerationLock\(statData\);[\s\S]*?updatePlayDays\(statData\);[\s\S]*?autoHarvestAssets\(statData, statDataBefore\);[\s\S]*?calcWorldStability\(statData\);[\s\S]*?return;/,
  '世界推进提交必须同步推进隐藏游玩日并执行资产收菜调度',
);

const harvestStart = source.indexOf('function autoHarvestAssets');
const harvestEnd = source.indexOf('/** 传入防御总值与角色当前层级 */', harvestStart);
assert.ok(harvestStart >= 0 && harvestEnd > harvestStart, '找不到收菜函数');
const harvestSource = source.slice(harvestStart, harvestEnd);
assert.match(harvestSource, /天后/);
assert.doesNotMatch(harvestSource, /worldTime|DATE_RE|fmtDate|currentDays/);

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
  $: (fn) => { if (typeof fn === 'function') fn(); },
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

// 游玩天数只统计“日期变化次数”：即使世界时间一跳几十年，也只 +1。
const clock = {
  世界: { 时间: '大业十三年-08月-12日-午时' },
  系统状态: { 游玩天数: 0, 上次世界日期: '' },
};
updatePlayDays(clock);
assert.equal(clock.系统状态.游玩天数, 1);
clock.世界.时间 = '大业十三年-08月-13日-清晨';
updatePlayDays(clock);
assert.equal(clock.系统状态.游玩天数, 2);
clock.世界.时间 = '公元2099年-01月-01日-清晨';
updatePlayDays(clock);
assert.equal(clock.系统状态.游玩天数, 3, '跨越几十年也只能算一次日期变化');

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
assert.equal(seq.下次产出日期, '7天后');
assert.deepEqual(stat.资产.永恒魔力池.待办事件, []);
assert.equal(JSON.stringify(stat.角色), beforeRole, '初始化调度不得修改背包/货币');

// 世界历法随副本切换怎么变都不影响倒计时，只看隐藏游玩日。
stat.世界.时间 = '公元2099年-01月-01日-清晨';
autoHarvestAssets(stat, JSON.parse(JSON.stringify(stat)));
assert.equal(seq.下次产出游天, 12);
assert.equal(seq.下次产出日期, '7天后');

stat.系统状态.游玩天数 = 6;
autoHarvestAssets(stat, JSON.parse(JSON.stringify(stat)));
assert.equal(seq.下次产出日期, '6天后');

// 到期只形成待办；产物绝不直接进入玩家背包/货币。
stat.系统状态.游玩天数 = 12;
autoHarvestAssets(stat, JSON.parse(JSON.stringify(stat)));
assert.equal(seq.下次产出游天, 19);
assert.equal(seq.下次产出日期, '7天后');
assert.equal(stat.资产.永恒魔力池.待办事件.length, 1);
assert.match(stat.资产.永恒魔力池.待办事件[0], /共1份/);
assert.match(stat.资产.永恒魔力池.待办事件[0], /待玩家领取/);
assert.equal(JSON.stringify(stat.角色), beforeRole, '到期触发不得直接修改玩家资产');

// 玩家不领取时，后续周期累计到同一条待办，而不是自动入账或丢失。
stat.系统状态.游玩天数 = 19;
autoHarvestAssets(stat, JSON.parse(JSON.stringify(stat)));
assert.equal(seq.下次产出游天, 26);
assert.equal(seq.下次产出日期, '7天后');
assert.equal(stat.资产.永恒魔力池.待办事件.length, 1);
assert.match(stat.资产.永恒魔力池.待办事件[0], /共2份/);
assert.equal(JSON.stringify(stat.角色), beforeRole);

// 一次跨过多个收菜周期时也只保留一条累计待办。
stat.系统状态.游玩天数 = 40;
autoHarvestAssets(stat, JSON.parse(JSON.stringify(stat)));
assert.equal(seq.下次产出游天, 47);
assert.equal(seq.下次产出日期, '7天后');
assert.equal(stat.资产.永恒魔力池.待办事件.length, 1);
assert.match(stat.资产.永恒魔力池.待办事件[0], /共5份/);
assert.equal(JSON.stringify(stat.角色), beforeRole);

console.log('PASS asset harvest lifecycle');
