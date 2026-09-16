const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const auxPath = 'script/辅助计算脚本.js';
const rulesPath = 'World Book/⚙️资产与载具规则.txt';
const source = fs.readFileSync(auxPath, 'utf8');
const rules = fs.readFileSync(rulesPath, 'utf8');

// 提示词只保留 AI 真正需要知道的内容，不暴露程序内部调度细节；用户措辞由世界书自身维护。
assert.match(rules, /产出记录: 写明本地货币或物资的名称、数量；无产出填“无”。主神空间资产按空间经济结算，任务世界不得产出空间币。收获日期由程序计算，AI无需处理/);
assert.doesNotMatch(rules, /每7个【系统状态\.游玩天数】形成1份/);
assert.doesNotMatch(rules, /AI不得代替玩家自动办理/);
assert.doesNotMatch(rules, /绝不直接写入背包、货币或库存/);

const removedWorldCommitKey='__samsara'+'WorldCommit';
assert.equal(source.includes(removedWorldCommitKey),false,'辅助脚本不得再依赖世界推进提交根标记');
assert.match(source,/let lastTurnMessageKey = '';/,'回合防重必须只保存在脚本内存');
assert.match(source,/const turnMessageKey = currentAssistantTurnKey\(\);[\s\S]*?shouldAdvanceTurn = turnMessageKey !== lastTurnMessageKey/);
assert.match(source,/if \(shouldAdvanceTurn\) \{[\s\S]*?processStatusDuration\(statData\.角色, isCombat\);/);
assert.match(source,/if \(shouldAdvanceTurn\) \{[\s\S]*?processCombatAndCooldowns\(statData, statDataBefore\);[\s\S]*?lastTurnMessageKey = turnMessageKey;/);
assert.doesNotMatch(source,/isUIMutationActive\(\)/,'UI 来源判断不再承担回合防重职责');

// 行为 seam：同一 AI 正文楼层重复 VARIABLE_UPDATE_ENDED 只做一致性计算；新正文楼层才消费一次状态/冷却。
const turnStart=source.indexOf('    let lastTurnMessageKey =');
const turnEnd=source.indexOf('    // ===== 轻量路径工具',turnStart);
assert.ok(turnStart>=0&&turnEnd>turnStart,'找不到正文楼层防重核心');
const turnSnippet=source.slice(turnStart,turnEnd);
const turnNames=['syncRemovedRelationshipPeople','syncRemovedAssets','syncAlienLifecycle','guardTaskGenerationLock','guardPersistedSystemTaskOwner','guardProtectedFields','clampNativeNpcToWorldTier','applyNewNpcDifficulty','recalcAllCharacters','checkTrialEligibility','updatePlayDays','autoHarvestAssets','cleanupZeroQuantityItems','processStatusDuration','cleanupDeadNPCs','calcWorldStability','processCombatAndCooldowns'];
const turnCalls={};
const turnStubs=Object.fromEntries(turnNames.map(name=>[name,()=>{turnCalls[name]=(turnCalls[name]||0)+1;} ]));
const turnContext={chatId:'turn-test',chat:[{is_user:true,mes:'玩家输入'},{role:'assistant',mes:'已有正文'}]};
const turnApi=new Function('stubs','SillyTavern',`let isProcessing=false,isInitLog=false;const {${turnNames.join(',')}}=stubs;${turnSnippet};return {onUpdateData,initializeTurnMessageBaseline};`)(turnStubs,{getContext:()=>turnContext});
turnApi.initializeTurnMessageBaseline();
const turnStat={角色:{},系统状态:{是否战斗中:false},关系列表:{},世界:{后台:{}},资产:{}};
const fireTurn=()=>turnApi.onUpdateData({stat_data:turnStat},{stat_data:JSON.parse(JSON.stringify(turnStat))});
fireTurn();
assert.equal(turnCalls.processStatusDuration,undefined,'脚本加载后的当前旧楼不得凭空消耗状态');
assert.equal(turnCalls.processCombatAndCooldowns,undefined,'脚本加载后的当前旧楼不得凭空推进冷却');
assert.equal(turnCalls.recalcAllCharacters,1,'同楼变量更新仍必须执行派生属性等一致性计算');
turnContext.chat.push({role:'assistant',mes:'新正文A'});
fireTurn();
assert.equal(turnCalls.processStatusDuration,1,'新正文楼层应消费一次状态');
assert.equal(turnCalls.processCombatAndCooldowns,1,'新正文楼层应推进一次冷却');
fireTurn();fireTurn();
assert.equal(turnCalls.processStatusDuration,1,'同楼世界推进/UI/schema 写回不得重复消耗状态');
assert.equal(turnCalls.processCombatAndCooldowns,1,'同楼世界推进/UI/schema 写回不得重复推进冷却');
assert.equal(turnCalls.recalcAllCharacters,4,'防重复不得挡住普通辅助计算');
turnContext.chat.push({is_user:true,mes:'下一次玩家输入'});
fireTurn();
assert.equal(turnCalls.processCombatAndCooldowns,1,'只有用户消息变化不算新 AI 正文楼层');
turnContext.chat.push({role:'assistant',mes:'新正文B'});
fireTurn();
assert.equal(turnCalls.processStatusDuration,2);
assert.equal(turnCalls.processCombatAndCooldowns,2,'下一条 AI 正文才再次推进一轮');

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
