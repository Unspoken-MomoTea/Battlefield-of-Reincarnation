const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('Regular/结算任务美化.html','utf8');
const taskRules=fs.readFileSync('World Book/⚙️任务与委托系统.txt','utf8');
const updateRules=fs.readFileSync('World Book/[mvu_update]变量更新规则.txt','utf8');

// 当前结算面板即使拿不到 getCurrentMessageId，也必须能安全回落到 latest；
// 但历史结算不能因此改写最新楼层。
assert.match(html,/SETTLEMENT_PANEL_TARGET_START/,'缺少当前结算楼层安全识别器');
assert.match(html,/panelTextBelongsToMessage\(/,'必须校验当前结算文本确实属于 latest 消息');
assert.match(html,/resolveSettlementMessageTarget\(/,'结算写回必须通过统一目标解析器');
assert.doesNotMatch(html,/if \(panelMessageId === null\) return;/,'拿不到楼层号时不得直接放弃当前结算');

// 结算 HTML 本身就是酒馆正则 replacement template。整个替换模板里只能保留一个裸 $1：
// .st-raw 的捕获占位符。任何 JS 字符串/注释里的第二个 $1 都会在酒馆替换时被正文展开，直接造成 srcdoc SyntaxError。
const replacementTemplate=html.match(/<!-- 替换模板开始 -->([\s\S]*?)<!-- 替换模板结束 -->/);
assert.ok(replacementTemplate,'必须能提取酒馆结算 replacement template');
const captureTokens=replacementTemplate[1].match(/\$1/g)||[];
assert.equal(captureTokens.length,1,'结算 replacement template 中裸 $1 必须且只能出现一次');
assert.match(replacementTemplate[1],/<div class="st-raw"[^>]*>\$1<\/div>/,'唯一 $1 必须位于 st-raw 捕获容器');

// 正则替换偶发未展开 $1 时，美化器必须能从当前消息原文恢复 <settlement tasks>，
// 否则整个 AI 结算正文会只剩字面量 "$1"，界面只能显示程序后插入的收益区块。
assert.match(html,/function extractSettlementBlock\(/,'必须能从消息原文提取 settlement tasks');
assert.match(html,/function resolveSettlementRawText\(/,'必须提供 $1 捕获失败的运行时恢复');
assert.match(html,/const rawText = resolveSettlementRawText\(/,'实际解析必须使用恢复后的结算正文');

const rawRecoveryBlock=html.match(/function extractSettlementBlock\(value\) \{[\s\S]*?function resolveSettlementRawText\(value, win\) \{[\s\S]*?\n          \}(?=\n\n          function panelTextBelongsToMessage)/);
assert.ok(rawRecoveryBlock,'应可提取结算正文恢复器做行为回归');
const rawContext={String,Number,window:{parent:null}};
rawContext.latestChatMessage=()=>({id:42,message:'前文<settlement tasks>### 【主神空间 - 轮回清算协议】\n* [主线]: 完成</settlement tasks>后文'});
rawContext.latestChatMessageId=m=>Number(m&&m.id);
vm.createContext(rawContext);
vm.runInContext(rawRecoveryBlock[0]+'\nthis.resolveRaw=resolveSettlementRawText;',rawContext);
assert.match(rawContext.resolveRaw('$1',{}),/轮回清算协议/,'$1 未展开时必须从当前消息恢复真实 settlement tasks 内容');
assert.doesNotMatch(rawContext.resolveRaw('$1',{}),/^\$1$/,'恢复后不得继续把 $1 当正文显示');

// 未完成的晋升试炼只应阻止晋升资格/清理，不应阻止已完成主神任务的空间币结算。
const terminalGateCount=(html.match(/trialTasks\.some\(function\(task\)\{return !isSettlementTaskTerminal\(task\.status\);\}\)/g)||[]).length;
assert.equal(terminalGateCount,1,'试炼未终态只允许在最终清理处拦截，不能拦截整次结算写回');

// 结算核验不能盲信“最近一份非空快照”。变量更新存在消息级时序差时，
// 必须比较候选快照的任务完成度，并允许当前/latest 的更成熟状态覆盖旧楼层。
assert.match(html,/function settlementSnapshotTaskScore\(/,'缺少任务快照完成度评分');
assert.match(html,/function preferSettlementSnapshot\(/,'缺少任务快照择优逻辑');
assert.match(html,/let settlementBaselineData = readSettlementBaselineData\(\);/,'结算基线必须允许在变量更新完成后升级');

const trialIdentityBlock=html.match(/function extractTrialTasks\(data\) \{[\s\S]*?function settlementTaskKeysForData\(data\) \{[\s\S]*?\n          \}(?=\n\n          let achievementBaselineData)/);
assert.ok(trialIdentityBlock,'快照回归必须加载隐藏试炼身份识别器');
const taskPreferenceBlock=html.match(/function settlementSnapshotTaskScore\(data\) \{[\s\S]*?function preferSettlementSnapshot\(current,candidate\) \{[\s\S]*?\n          \}(?=\n\n          function readSettlementBaselineData)/);
assert.ok(taskPreferenceBlock,'应可提取任务快照择优器做行为回归');
const taskContext={Object,String,Array,Set,Math};
vm.createContext(taskContext);
vm.runInContext(trialIdentityBlock[0]+'\n'+taskPreferenceBlock[0]+'\nthis.prefer=preferSettlementSnapshot;',taskContext);
const staleTaskSnapshot={stat_data:{世界:{名称:'Fate/stay night'},任务:{列表:{A:{委托方:'主神任务',状态:'进行中'},B:{委托方:'主神任务',状态:'进行中'}}}}};
const matureTaskSnapshot={stat_data:{世界:{名称:'Fate/stay night'},任务:{列表:{A:{委托方:'主神任务',状态:'可交付'},B:{委托方:'主神任务',状态:'可结算'}}}}};
assert.equal(taskContext.prefer(staleTaskSnapshot,matureTaskSnapshot),matureTaskSnapshot,'同世界任务应优先选择完成态更成熟的快照');
assert.equal(taskContext.prefer(matureTaskSnapshot,staleTaskSnapshot),matureTaskSnapshot,'已取得成熟任务快照后不得被旧进行中状态降级');
const corruptedTrialSnapshot={stat_data:{世界:{名称:'Fate/stay night'},系统状态:{是否试炼任务:true,试炼任务名单:['晋升关卡']},任务:{列表:{晋升关卡:{委托方:'主神空间',状态:'可结算'}}}}};
assert.equal(taskContext.prefer(staleTaskSnapshot,corruptedTrialSnapshot),corruptedTrialSnapshot,'隐藏试炼身份必须让委托方损坏的晋升快照压过历史普通副本');
const otherWorldSnapshot={stat_data:{世界:{名称:'下一个世界'},任务:{列表:{A:{委托方:'主神任务',状态:'可结算'},B:{委托方:'主神任务',状态:'可结算'}}}}};
assert.equal(taskContext.prefer(staleTaskSnapshot,otherWorldSnapshot),staleTaskSnapshot,'不同世界的任务快照不得串入当前结算');

// 成就同样必须择优而不是“当前楼有 6 条就立即返回”。典型回归：当前楼 6 条未达成，
// 更成熟快照已经 6 条已达成；UI 必须显示 6/6，且随后清空数据库不能把面板降回 0/6。
assert.match(html,/function achievementTaskScore\(/,'缺少成就快照完成度评分');
assert.match(html,/function preferAchievementTasks\(/,'缺少成就快照择优逻辑');
assert.match(html,/let achievementTasks = readAchievementTasks\(\);/,'成就面板必须允许刷新到更成熟快照');
assert.doesNotMatch(html,/const achievementTasks = readAchievementTasks\(\);/,'成就状态不能在初次渲染时永久冻结');
assert.match(html,/function refreshAchievementTasks\(/,'VARIABLE_UPDATE_ENDED 后必须刷新成就快照');
assert.match(html,/\.st-achievement-host/,'刷新后必须重绘成就面板');

const achievementPreferenceBlock=html.match(/function achievementTaskSignature\(tasks\) \{[\s\S]*?function preferAchievementTasks\(current, candidate\) \{[\s\S]*?\n          \}(?=\n\n          function readAchievementTasks)/);
assert.ok(achievementPreferenceBlock,'应可提取成就快照择优器做行为回归');
const achievementContext={Array,String};
vm.createContext(achievementContext);
vm.runInContext(achievementPreferenceBlock[0]+'\nthis.score=achievementTaskScore;this.prefer=preferAchievementTasks;',achievementContext);
const names=['观察者','初入战局','违规猎手','补魔大师','圣杯干预','规则终结者'];
const staleAchievements=names.map(name=>({name,status:'未达成'}));
const completedAchievements=names.map(name=>({name,status:'已达成'}));
assert.equal(achievementContext.score(staleAchievements),6,'0/6 快照只能获得基础列表分');
assert.equal(achievementContext.score(completedAchievements),6006,'6/6 快照必须明显高于旧未达成快照');
assert.equal(achievementContext.prefer(staleAchievements,completedAchievements),completedAchievements,'6 条已达成必须覆盖同一批 6 条未达成旧快照');
assert.equal(achievementContext.prefer(completedAchievements,staleAchievements),completedAchievements,'成就面板取得 6/6 后不得被清理前后的旧状态降回 0/6');

// 成就盲盒最终会作为“角色.道具.<名称>”写入 MVU，名称里的点号/斜杠会被路径解析器拆成层级。
// 发放前必须规范化成安全的单一键名；来源世界文本仍保留原作品名。
const achievementRewardBlock=html.match(/function sanitizeMvuObjectKey\(value\) \{[\s\S]*?function parseAchievementReward\(reward, fallbackWorld\) \{[\s\S]*?\n          \}(?=\n\n          function parseSettlement)/);
assert.ok(achievementRewardBlock,'应可提取成就奖励键名规范化与解析器做行为回归');
const rewardContext={String};
rewardContext.gradeTier=value=>String(value||'').toUpperCase().match(/SSS|SS|S|A|B|C|D|E|F/)?.[0]||'F';
vm.createContext(rewardContext);
vm.runInContext(achievementRewardBlock[0]+'\nthis.parseReward=parseAchievementReward;',rewardContext);
const unsafeReward=rewardContext.parseReward('D级盲盒·Fate/stay night','');
assert.equal(unsafeReward.world,'Fate/stay night','奖励来源世界应保留原始作品名');
assert.equal(unsafeReward.name,'D级盲盒·Fate·stay night','成就盲盒数据库键名不得保留 /');
const dottedReward=rewardContext.parseReward('E级盲盒·Steins.Gate/Zero','');
assert.equal(dottedReward.world,'Steins.Gate/Zero','奖励来源世界应保留原始作品名');
assert.equal(dottedReward.name,'E级盲盒·Steins·Gate·Zero','成就盲盒名称必须可安全作为 MVU 对象键');

// 任务状态必须随已确认剧情同步；“状态变化≠流程执行”不能被写成“AI不得更新状态”。
assert.match(taskRules,/目标已明确完成[^\n]*可结算/,'主神/试炼任务目标完成后必须明确同步为可结算');
assert.doesNotMatch(taskRules,/AI不得自动推进状态机/,'不得用笼统禁令阻止变量AI同步任务状态');
assert.match(updateRules,/主神任务\/晋升试炼[^\n]*目标已明确完成[^\n]*可结算/,'变量规则必须明确主神/试炼完成态同步');

console.log('settlement current panel regression passed');