from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUX_PATHS = [
    ROOT / 'script' / '辅助计算脚本.js',
    ROOT / 'dist' / 'V20260916' / '辅助计算脚本.js',
]
RUNTIME = ROOT / 'script' / 'world-engine-src' / '40-engine-runtime.part.js'
AUTO_REPLAY = ROOT / 'script' / 'world-engine-src' / '59-auto-trigger-rebuild.part.js'
REPLAY_PERSIST = ROOT / 'script' / 'world-engine-src' / '59-world-replay-persistence.part.js'
REPROCESS_RETRY = ROOT / 'script' / 'world-engine-src' / '59-reprocess-immediate-retry.part.js'
WORLD_TEST = ROOT / 'tests' / 'world-engine.cjs'
HARVEST_TEST = ROOT / 'tests' / 'asset-harvest-lifecycle.cjs'
AUTO_REPROCESS_TEST = ROOT / 'tests' / 'world-engine-auto-reprocess.cjs'
MISSING_REPLAY_TEST = ROOT / 'tests' / 'world-engine-reprocess-missing-snapshot-policy.cjs'
CAUSAL_EDITOR_TEST = ROOT / 'tests' / 'world-engine-causal-offset-editor.cjs'
HISTORY_EDITOR_TEST = ROOT / 'tests' / 'world-engine-history-memory-editor.cjs'
LEGACY_WORLD_COMMIT = '__samsara' + 'WorldCommit'


def read_preserve(path: Path):
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    newline = '\r\n' if '\r\n' in text else '\n'
    return text, newline


def write(path: Path, text: str):
    path.write_bytes(text.encode('utf-8'))


def block(text: str, newline: str) -> str:
    return text.replace('\n', newline)


def replace_once_or_accept(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'[turn-dedup] {label} anchor count != 1: {count}')
    return text.replace(old, new, 1)


def remove_once_or_accept(text: str, old: str, label: str) -> str:
    if old not in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'[turn-dedup] {label} anchor count != 1: {count}')
    return text.replace(old, '', 1)


def splice_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        if replacement and replacement in text:
            return text
        raise RuntimeError(f'[turn-dedup] missing start anchor: {label}')
    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f'[turn-dedup] missing end anchor: {label}')
    return text[:a] + replacement + text[b:]


TURN_STATE = """    /**
     * 正文楼层级回合防重，仅保存在脚本内存，不写入 MVU。
     * 同一 AI 正文楼层产生的世界推进、UI、schema 等额外变量写回，都不能重复消耗状态或冷却。
     */
    let lastTurnMessageKey = '';

    function currentAssistantTurnKey() {
        try {
            const context = SillyTavern.getContext();
            const chat = Array.isArray(context?.chat) ? context.chat : [];
            const chatId = String(context?.chatId ?? '');
            for (let i = chat.length - 1; i >= 0; i--) {
                const msg = chat[i];
                if (!msg) continue;
                const role = String(msg.role || '').toLowerCase();
                if (msg.is_user === true || msg.is_system === true || role === 'user' || role === 'system') continue;
                return `${chatId}:${i}`;
            }
        } catch (_) {}
        return '';
    }

    function initializeTurnMessageBaseline() {
        lastTurnMessageKey = currentAssistantTurnKey();
    }
"""

TURN_DECISION = """            // 状态时长、战斗轮次与冷却只按“新 AI 正文楼层”推进一次。
            // 世界推进、UI 操作、schema reconciliation 等同楼层二次写回只做数据一致性计算，不再消耗回合。
            const turnMessageKey = currentAssistantTurnKey();
            let shouldAdvanceTurn = false;
            if (turnMessageKey) {
                if (!lastTurnMessageKey) lastTurnMessageKey = turnMessageKey;
                else shouldAdvanceTurn = turnMessageKey !== lastTurnMessageKey;
            }
"""

for path in AUX_PATHS:
    if not path.exists():
        continue
    text, nl = read_preserve(path)

    # 1) 恢复旧版“正文消息楼层”思路，但只在脚本内存记录，不写 MVU。
    if '    let lastTurnMessageKey = ' not in text:
        anchor = '    let isProcessing = false;' + nl
        if anchor not in text:
            raise RuntimeError(f'[turn-dedup] {path}: isProcessing anchor missing')
        text = text.replace(anchor, anchor + block(TURN_STATE, nl), 1)

    # 2) 删除世界提交来源识别；所有一致性/派生计算一律走统一链路。
    world_start = '            // 世界引擎独立提交仍必须执行全部数据一致性与派生计算。'
    task_anchor = '            // ★ 任务生成当层整块锁：任何后续计算前先恢复美化器权威快照。'
    if world_start in text:
        text = splice_between(text, world_start, task_anchor, '', f'{path}: remove world-commit source branch')

    # 3) 在角色数据有效以后读取当前 AI 正文楼层。
    users_anchor = block("""            const users = statData.角色;
            if (!users) return;
""", nl)
    if TURN_DECISION.strip() not in text:
        if users_anchor not in text:
            raise RuntimeError(f'[turn-dedup] {path}: users anchor missing')
        text = text.replace(users_anchor, users_anchor + nl + block(TURN_DECISION, nl), 1)

    old_role = block("""            if (statData.角色) {
                cleanupZeroQuantityItems(statData.角色);
                if (!isWorldCommit) {
                    processStatusDuration(statData.角色, isCombat);
                }
            }
""", nl)
    new_role = block("""            if (statData.角色) {
                cleanupZeroQuantityItems(statData.角色);
                if (shouldAdvanceTurn) {
                    processStatusDuration(statData.角色, isCombat);
                }
            }
""", nl)
    if old_role in text or new_role in text:
        text = replace_once_or_accept(text, old_role, new_role, f'{path}: player status turn guard')
    else:
        raise RuntimeError(f'[turn-dedup] {path}: player status anchor missing')

    old_npc = block("""                    cleanupZeroQuantityItems(npc);
                    if (!isWorldCommit) {
                        processStatusDuration(npc, isCombat);
                    }
""", nl)
    new_npc = block("""                    cleanupZeroQuantityItems(npc);
                    if (shouldAdvanceTurn) {
                        processStatusDuration(npc, isCombat);
                    }
""", nl)
    if old_npc in text or new_npc in text:
        text = replace_once_or_accept(text, old_npc, new_npc, f'{path}: npc status turn guard')
    else:
        raise RuntimeError(f'[turn-dedup] {path}: npc status anchor missing')

    old_combat = block("""            // 5. 战斗轮次与形态冷却全自动管理 (模块10)
            // 世界推进写回不是额外正文回合，只屏蔽这一类消耗型推进；其余辅助计算全部照常执行。
            if (!isWorldCommit) {
                processCombatAndCooldowns(statData, statDataBefore);
            }
""", nl)
    new_combat = block("""            // 5. 战斗轮次与形态冷却全自动管理 (模块10)
            if (shouldAdvanceTurn) {
                processCombatAndCooldowns(statData, statDataBefore);
                // 只有消费型回合逻辑完整执行后才记住本楼，异常时允许同楼重试。
                lastTurnMessageKey = turnMessageKey;
            }
""", nl)
    if old_combat in text or new_combat in text:
        text = replace_once_or_accept(text, old_combat, new_combat, f'{path}: combat turn guard')
    else:
        raise RuntimeError(f'[turn-dedup] {path}: combat guard anchor missing')

    # 旧 UI 来源守卫和消息楼层幂等职责重复；删掉，避免继续维护两套防重来源判断。
    ui_start = '    /**\n     * 是否处于"悬浮球UI操作"窗口期'
    permit_anchor = '    /**\n     * 角色层级"普升通行证"校验'
    ui_start = block(ui_start, nl)
    permit_anchor = block(permit_anchor, nl)
    if ui_start in text:
        text = splice_between(text, ui_start, permit_anchor, '', f'{path}: remove redundant UI mutation helper')

    ui_guard = block("""        // ★ UI 来源守卫: 若本次 VARIABLE_UPDATE_ENDED 由悬浮球UI操作(穿脱装备/道具/激活形态/进阶)触发, 跳过轮次推进+冷却递减
        //   避免反复穿脱导致战斗轮次+1 / 形态冷却-1 / 回合制状态-1; 属性重算等其他模块不受影响, 照常执行
        //   标志读取逻辑已提取为公共函数 isUIMutationActive()(主窗口多级 fallback)
        if (isUIMutationActive()) {
            // console.log('[战斗系统] 检测到本次更新来自UI操作(__samsaraUIMutation), 跳过轮次推进与冷却递减');
            return;
        }
""", nl)
    text = remove_once_or_accept(text, ui_guard, f'{path}: remove redundant combat UI guard')

    init_old = block("""    const init = async () => {
        await waitGlobalInitialized('Mvu');
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdateData);
""", nl)
    init_new = block("""    const init = async () => {
        await waitGlobalInitialized('Mvu');
        // 当前已有正文只作为基线；脚本重载/页面刷新不能凭空消耗一轮状态或冷却。
        initializeTurnMessageBaseline();
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdateData);
""", nl)
    text = replace_once_or_accept(text, init_old, init_new, f'{path}: initialize message baseline')

    if LEGACY_WORLD_COMMIT in text:
        raise RuntimeError(f'[turn-dedup] {path}: legacy world commit marker still present')
    write(path, text)


# 4) 世界引擎不再写“世界提交”根字段。恢复包自身 fingerprint + 后台已处理楼层足够证明本楼是否成功推进。
runtime, rnl = read_preserve(RUNTIME)
runtime = remove_once_or_accept(
    runtime,
    block(f"                result.{LEGACY_WORLD_COMMIT}=base.fingerprint;\n", rnl),
    'runtime commit marker write',
)
runtime = remove_once_or_accept(
    runtime,
    block(f"""                const commit=variables?.{LEGACY_WORLD_COMMIT};
                if(commit&&before&&commit!==before.{LEGACY_WORLD_COMMIT}&&commit===variables?.stat_data?.世界?.[PATH]?.已处理楼层)return;
""", rnl),
    'runtime commit-marker listener bypass',
)
if LEGACY_WORLD_COMMIT in runtime:
    raise RuntimeError('[turn-dedup] runtime still contains legacy world commit marker')
write(RUNTIME, runtime)


auto, anl = read_preserve(AUTO_REPLAY)
auto = remove_once_or_accept(
    auto,
    block(f"            const commit=String(variables.{LEGACY_WORLD_COMMIT}||'');\n", anl),
    'auto replay commit variable',
)
auto = replace_once_or_accept(
    auto,
    block("""            if(pending&&commit===pending&&handled===pending&&plain(before?.stat_data)&&plain(variables.stat_data)){
""", anl),
    block("""            if(pending&&handled===pending&&plain(before?.stat_data)&&plain(variables.stat_data)){
""", anl),
    'auto replay successful write detection',
)
auto = replace_once_or_accept(
    auto,
    block(f"""            const storedCommit=String(raw.{LEGACY_WORLD_COMMIT}||'');
            if(!storedCommit||storedCommit!==current.fingerprint)return false;

            // 重处理本身不是新的游戏轮次，也绝不能触发世界 AI；让基础监听与辅助脚本都把本事件视为内部恢复。
            this.worldReplayMarkEventInternal();
            const replay=raw.__samsaraWorldReplay;
""", anl),
    block("""            const storedReplay=raw.__samsaraWorldReplay;
            const beforeHandled=String(before?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            const replayMatches=plain(storedReplay)&&String(storedReplay.fingerprint||'')===current.fingerprint;
            if(!replayMatches&&beforeHandled!==current.fingerprint)return false;

            // 重处理本身不是新的游戏轮次，也绝不能触发世界 AI；让世界引擎把本事件视为内部恢复。
            this.worldReplayMarkEventInternal();
            const replay=storedReplay;
""", anl),
    'auto replay reprocess proof',
)
auto = remove_once_or_accept(
    auto,
    block(f"            variables.{LEGACY_WORLD_COMMIT}=current.fingerprint;\n", anl),
    'auto replay marker restore',
)
auto = auto.replace('            // 只有当前消息自己的成功提交标记仍与正文指纹完全一致，才认定为同正文重处理。',
                    '            // 只有当前消息自己的 replay 指纹或 before 中已处理楼层能证明旧结果，才认定为同正文重处理。')
if LEGACY_WORLD_COMMIT in auto:
    raise RuntimeError('[turn-dedup] auto replay still contains legacy world commit marker')
write(AUTO_REPLAY, auto)


persist, pnl = read_preserve(REPLAY_PERSIST)
old_context = block(f"""        worldReplayReprocessContext(variables,before) {{
            if(!plain(variables?.stat_data))return null;
            const current=this.worldReplayCurrentMessage?.();
            if(!current)return null;
            const mvu=this.env.Mvu||this.host.Mvu;
            let raw;
            try{{raw=mvu?.getMvuData?.({{type:'message',message_id:current.id}});}}catch(_){{return null;}}
            // 真正的“重新处理变量”期间，当前楼持久化数据已经被 MVU 清掉 stat_data，但未知 root 元数据仍在。
            if(!plain(raw)||plain(raw.stat_data))return null;
            const commit=String(raw.{LEGACY_WORLD_COMMIT}||'');
            if(!commit||commit!==current.fingerprint)return null;
            return {{current,raw,mvu,beforeStat:plain(before?.stat_data)?before.stat_data:null}};
        }}
""", pnl)
new_context = block("""        worldReplayReprocessContext(variables,before) {
            if(!plain(variables?.stat_data))return null;
            const current=this.worldReplayCurrentMessage?.();
            if(!current)return null;
            const mvu=this.env.Mvu||this.host.Mvu;
            let raw;
            try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return null;}
            // “重新处理变量”会清掉当前楼 stat_data，但 replay 根字段仍可保留；before 也可证明旧楼已成功处理。
            if(!plain(raw)||plain(raw.stat_data))return null;
            const beforeStat=plain(before?.stat_data)?before.stat_data:null;
            const replay=raw.__samsaraWorldReplay;
            const replayMatches=plain(replay)&&String(replay.fingerprint||'')===current.fingerprint;
            const beforeHandled=String(beforeStat?.世界?.[PATH]?.已处理楼层||'');
            if(!replayMatches&&beforeHandled!==current.fingerprint)return null;
            return {current,raw,mvu,beforeStat};
        }
""", pnl)
persist = replace_once_or_accept(persist, old_context, new_context, 'replay persistence reprocess proof')
persist = remove_once_or_accept(
    persist,
    block(f"                    variables.{LEGACY_WORLD_COMMIT}=context.current.fingerprint;\n", pnl),
    'replay persistence marker restore',
)
persist = remove_once_or_accept(
    persist,
    block(f"                delete variables.{LEGACY_WORLD_COMMIT};\n", pnl),
    'replay persistence marker delete',
)
persist = replace_once_or_accept(
    persist,
    block(f"            if(String(raw.{LEGACY_WORLD_COMMIT}||'')!==fingerprint)return false;\n", pnl),
    block("            if(String(raw?.stat_data?.世界?.[PATH]?.已处理楼层||'')!==fingerprint)return false;\n", pnl),
    'replay persistence success proof',
)
persist = persist.replace('    // 对旧楼若已有 commit 但缺 replay，优先从本次重处理事件的 before 恢复；实在无旧状态时按自动推进开关决定是否立即重建。',
                          '    // 对旧楼若 replay 缺失，优先用本次重处理事件的 before/已处理楼层恢复；实在无旧状态时按自动推进开关决定是否立即重建。')
persist = persist.replace('                // commit 与当前正文指纹一致，已经证明这一楼过去确实成功推进过；缺 replay 时不需要重新计算推进间隔。',
                          '                // before/已处理楼层已经证明这一楼过去确实成功推进过；缺 replay 时不需要重新计算推进间隔。')
if LEGACY_WORLD_COMMIT in persist:
    raise RuntimeError('[turn-dedup] replay persistence still contains legacy world commit marker')
write(REPLAY_PERSIST, persist)


retry, qnl = read_preserve(REPROCESS_RETRY)
retry = remove_once_or_accept(retry, block(f"            delete seed.{LEGACY_WORLD_COMMIT};\n", qnl), 'retry seed marker delete')
retry = remove_once_or_accept(
    retry,
    block(f"            if(finalRaw&&Object.prototype.hasOwnProperty.call(finalRaw,'{LEGACY_WORLD_COMMIT}'))variables.{LEGACY_WORLD_COMMIT}=finalRaw.{LEGACY_WORLD_COMMIT};\n", qnl),
    'retry marker copy-back',
)
retry = remove_once_or_accept(retry, block(f"                    delete variables.{LEGACY_WORLD_COMMIT};\n", qnl), 'retry marker delete')
if LEGACY_WORLD_COMMIT in retry:
    raise RuntimeError('[turn-dedup] reprocess retry still contains legacy world commit marker')
write(REPROCESS_RETRY, retry)


# 5) 回归测试：同一正文楼层可以触发任意次变量写回，但消费型回合逻辑只执行一次。
harvest, hnl = read_preserve(HARVEST_TEST)
old_guard_start = "assert.match(\n  source,\n  /const isWorldCommit = !!\\("
if old_guard_start in harvest:
    start = harvest.index(old_guard_start)
    end = harvest.index("const harvestStart = source.indexOf('function autoHarvestAssets');", start)
    new_guard = block("""const removedWorldCommitKey='__samsara'+'WorldCommit';
assert.equal(source.includes(removedWorldCommitKey),false,'辅助脚本不得再依赖世界推进提交根标记');
assert.match(source,/let lastTurnMessageKey = '';/,'回合防重必须只保存在脚本内存');
assert.match(source,/const turnMessageKey = currentAssistantTurnKey\\(\\);[\\s\\S]*?shouldAdvanceTurn = turnMessageKey !== lastTurnMessageKey/);
assert.match(source,/if \\(shouldAdvanceTurn\\) \\{[\\s\\S]*?processStatusDuration\\(statData\\.角色, isCombat\\);/);
assert.match(source,/if \\(shouldAdvanceTurn\\) \\{[\\s\\S]*?processCombatAndCooldowns\\(statData, statDataBefore\\);[\\s\\S]*?lastTurnMessageKey = turnMessageKey;/);
assert.doesNotMatch(source,/isUIMutationActive\\(\\)/,'UI 来源判断不再承担回合防重职责');

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

""", hnl)
    harvest = harvest[:start] + new_guard + harvest[end:]
HARVEST_TEST.write_bytes(harvest.encode('utf-8'))


# world-engine.cjs 中旧的“worldCommit 特判”测试改成正文楼层幂等测试，避免测试继续固化已删除架构。
world, wnl = read_preserve(WORLD_TEST)
needle = f"        const after={{stat_data:stat,{LEGACY_WORLD_COMMIT}:'commit-1'}};"
if needle in world:
    body_start = world.rfind("        const source=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');", 0, world.index(needle))
    body_end = world.index("    });\n    await test('world-engine Step.5", world.index(needle))
    if body_start < 0:
        raise RuntimeError('[turn-dedup] world-engine helper test start missing')
    replacement = block("""        const source=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');
        const snippet=source.slice(source.indexOf('let lastTurnMessageKey ='),source.indexOf('// ===== 轻量路径工具'));
        const names=['syncRemovedRelationshipPeople','syncRemovedAssets','syncAlienLifecycle','guardTaskGenerationLock','guardPersistedSystemTaskOwner','guardProtectedFields','clampNativeNpcToWorldTier','applyNewNpcDifficulty','recalcAllCharacters','checkTrialEligibility','updatePlayDays','autoHarvestAssets','cleanupZeroQuantityItems','processStatusDuration','cleanupDeadNPCs','calcWorldStability','processCombatAndCooldowns'];
        const calls={}; const stubs=Object.fromEntries(names.map(name=>[name,()=>{calls[name]=(calls[name]||0)+1;}]));
        const context={chatId:'helper-test',chat:[{role:'assistant',mes:'已有正文'}]};
        const api=new Function('stubs','SillyTavern',`let isProcessing=false,isInitLog=false;const {${names.join(',')}}=stubs;${snippet};return {onUpdateData,initializeTurnMessageBaseline};`)(stubs,{getContext:()=>context});
        api.initializeTurnMessageBaseline();
        const stat=fresh();stat.角色={};stat.关系列表={};
        const after={stat_data:stat};
        api.onUpdateData(after,{stat_data:clone(stat)});
        assert.equal(calls.recalcAllCharacters,1,'同楼写回仍要执行角色/NPC派生属性重算');
        assert.equal(calls.checkTrialEligibility,1,'同楼写回仍要执行晋升资格派生');
        assert.equal(calls.processCombatAndCooldowns,undefined,'当前旧楼不得重复推进冷却');
        assert.equal(calls.processStatusDuration,undefined,'当前旧楼不得重复消耗状态');
        context.chat.push({role:'assistant',mes:'下一楼正文'});
        api.onUpdateData(after,{stat_data:clone(stat)});
        assert.equal(calls.processCombatAndCooldowns,1,'新 AI 正文楼层推进一次冷却');
        assert.equal(calls.processStatusDuration,1,'新 AI 正文楼层消耗一次状态');
        api.onUpdateData(after,{stat_data:clone(stat)});
        assert.equal(calls.processCombatAndCooldowns,1,'同楼再次写回不得重复推进冷却');
        assert.equal(calls.processStatusDuration,1,'同楼再次写回不得重复消耗状态');
""", wnl)
    world = world[:body_start] + replacement + world[body_end:]
WORLD_TEST.write_bytes(world.encode('utf-8'))


# 世界恢复回归不再构造/断言旧根标记；replay fingerprint 与 before.已处理楼层分别承担恢复证据。
auto_test, tnl = read_preserve(AUTO_REPROCESS_TEST)
auto_test = auto_test.replace(f"  assert.equal(first.{LEGACY_WORLD_COMMIT},firstFingerprint);\n", '')
auto_test = auto_test.replace('  // 兼容已经出现过的旧楼：commit 标记还在，但当时因为真实 MVU 事件时序没有把 replay 根字段写进去。',
                              '  // 兼容旧楼：replay 根字段缺失时，before 中的已处理楼层仍能证明这一楼过去成功推进过。')
auto_test = auto_test.replace(f"  x.write({{{LEGACY_WORLD_COMMIT}:firstFingerprint}});", '  x.write({});')
auto_test = auto_test.replace(f"  x.write({{{LEGACY_WORLD_COMMIT}:firstFingerprint,__samsaraWorldReplay:clone(first.__samsaraWorldReplay)}});",
                              '  x.write({__samsaraWorldReplay:clone(first.__samsaraWorldReplay)});')
auto_test = auto_test.replace(f"  x.write({{{LEGACY_WORLD_COMMIT}:x.read().{LEGACY_WORLD_COMMIT},__samsaraWorldReplay:inheritedReplay}});",
                              '  x.write({__samsaraWorldReplay:inheritedReplay});')
auto_test = auto_test.replace(f"  y.write({{{LEGACY_WORLD_COMMIT}:yFingerprint}});", '  y.write({});')
if LEGACY_WORLD_COMMIT in auto_test:
    raise RuntimeError('[turn-dedup] auto reprocess test still contains legacy marker')
AUTO_REPROCESS_TEST.write_bytes(auto_test.encode('utf-8'))


missing, mnl = read_preserve(MISSING_REPLAY_TEST)
old_setup_tail = block(f"""  const fingerprint=engine.snapshot().fingerprint;raw={{{LEGACY_WORLD_COMMIT}:fingerprint}};
  return {{engine,fresh,calls:()=>calls,runReprocess:()=>firstMvuHandler(fresh(),{{}}),resolve:()=>resolveRequest?.(),read:()=>clone(raw)}};
""", mnl)
new_setup_tail = block("""  const fingerprint=engine.snapshot().fingerprint;
  const previous=fresh();previous.stat_data.世界.后台.已处理楼层=fingerprint;raw={};
  return {engine,fresh,calls:()=>calls,runReprocess:()=>firstMvuHandler(fresh(),previous),resolve:()=>resolveRequest?.(),read:()=>clone(raw)};
""", mnl)
missing = replace_once_or_accept(missing, old_setup_tail, new_setup_tail, 'missing replay test uses before proof')
if LEGACY_WORLD_COMMIT in missing:
    raise RuntimeError('[turn-dedup] missing replay test still contains legacy marker')
MISSING_REPLAY_TEST.write_bytes(missing.encode('utf-8'))


for editor_path in [CAUSAL_EDITOR_TEST, HISTORY_EDITOR_TEST]:
    editor, enl = read_preserve(editor_path)
    line = block(f"  current.{LEGACY_WORLD_COMMIT}=fingerprint;\n", enl)
    editor = remove_once_or_accept(editor, line, f'{editor_path.name}: legacy marker fixture')
    if LEGACY_WORLD_COMMIT in editor:
        raise RuntimeError(f'[turn-dedup] {editor_path.name} still contains legacy marker')
    editor_path.write_bytes(editor.encode('utf-8'))

print('patched message-level turn deduplication and removed legacy world-commit marker')
