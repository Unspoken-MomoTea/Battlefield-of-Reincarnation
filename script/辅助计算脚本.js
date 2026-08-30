// 这是一个用于数值计算和属性更新的脚本，适用于角色扮演游戏中的角色属性管理。
// 在每轮结束后自动触发，确保角色属性始终保持最新状态。
(function () {
    'use strict';

    function getMvuGlobal() {
        try {
            if (typeof window.Mvu !== 'undefined') return window;
            if (typeof GS_PARENT.Mvu !== 'undefined') return GS_PARENT;
        } catch (e) {}
        return null;
    }
    function getStatData() {
        try {
            var win = getMvuGlobal();
            if (win && win.Mvu && typeof win.Mvu.getMvuData === 'function') {
                var r = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
                if (r && r.stat_data) return r.stat_data;
                if (r) return r;
            }
            if (typeof GS_PARENT.getMessageVar === 'function') return GS_PARENT.getMessageVar('stat_data');
            if (typeof window.getMessageVar === 'function') return window.getMessageVar('stat_data');
        } catch (e) { console.warn('[主神终端] 数据读取异常:', e.message); }
        return null;
    }

    /**
     * 写回 MVU：把对 stat_data 的修改通过 Mvu.replaceMvuData 正式落库
     *   - 用于 CHARACTER_MESSAGE_RENDERED 等"非 VARIABLE_UPDATE_ENDED"回调：
     *     这类回调里 getStatData() 返回的 stat_data 不保证是 MVU 主存储的同一引用对象，
     *     原地改字段不会持久化到数据库，必须走 replaceMvuData 正式写回 message/chat 通道。
     *   - mutator(sd) 在深拷贝的副本上执行修改，避免污染 MVU 内存快照。
     *   - 不广播 VARIABLE_UPDATE_ENDED：结算清理改的是剧情/世界/任务数据，无需触发属性重算，
     *     也避免 onUpdateData 在结算中途跑导致的 schema reconciliation 风险。
     *   - 实现与 悬浮球状态栏.js 的 writeBackMvu 对齐(仅去掉事件广播)。
     * @param {(sd:object)=>void} mutator 修改器，接收 stat_data 副本
     * @returns {boolean} 是否写回成功
     */
    function writeBackMvu(mutator) {
        try {
            var win = getMvuGlobal();
            if (!win || !win.Mvu || typeof win.Mvu.getMvuData !== 'function' || typeof win.Mvu.replaceMvuData !== 'function') {
                console.warn('[辅助计算脚本] MVU写回API不可用，修改未落库');
                return false;
            }
            var mvuData = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
            if (!mvuData || !mvuData.stat_data) {
                console.warn('[辅助计算脚本] 无可写数据，修改未落库');
                return false;
            }
            // 深拷贝副本，在副本上改，再整体写回(走正式通道，确保落库)
            var cloned = (typeof _ !== 'undefined' && _ && _.cloneDeep) ? _.cloneDeep(mvuData) : JSON.parse(JSON.stringify(mvuData));
            if (typeof mutator === 'function') mutator(cloned.stat_data);
            // 写回 message 通道
            win.Mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' });
            // 同步 chat 通道
            try { win.Mvu.replaceMvuData(cloned, { type: 'chat' }); } catch (e2) {}
            return true;
        } catch (e) {
            console.error('[辅助计算脚本] 写回MVU失败:', e);
            return false;
        }
    }

    /** 是否已初始化日志 */
    let isInitLog = false;
    /**
     * 防重入标志：防止脚本修改 stat_data 后触发 schema reconciliation
     * 再次进入 VARIABLE_UPDATE_ENDED 导致无限循环
     */
    let isProcessing = false;
    /**
     * 核心函数：在 stat_data 更新完成后执行，进行数值计算和属性更新
     * @param {*} rawVariables 原始变量
     * @param {*} rawVariablesBefore 之前的原始变量
     */
    function onUpdateData(rawVariables, rawVariablesBefore) {
        // 防重入：如果正在处理中，直接跳过
        if (isProcessing) {
            return;
        }
        isProcessing = true;
        
        try {
            /** 当前数据 */
            const statData = rawVariables?.stat_data;
            /** 之前的当前数据 */
            const statDataBefore = rawVariablesBefore?.stat_data;

            if (!statData) return;

            const users = statData.主角;
            if (!users) return;

            // ★ 先回滚受保护字段，再执行后续计算
            guardProtectedFields(statData, statDataBefore);

            // ★ 原住民NPC位格/血统品质压制: 新登场原住民 层级/血统品质超出 世界.位格 → 压回世界位格
            //   (主神空间中不压制; 轮回者/穿越者/守护者/织梦者/篡夺者/残魂 等特殊身份不压制)
            clampNativeNpcToWorldTier(statData, statDataBefore);

            // 初始化日志（只打印一次）
            if (!isInitLog) {
                isInitLog = true;
            }

            // 重算所有角色属性（传入 before 供 NPC 群体 THP/数量同步判断）
            recalcAllCharacters(statData, statDataBefore);

            // ★ 主角普升检测：五维阶位累计≥24 → 系统状态.是否可试炼=true/false
            //   必须在 recalcAllCharacters 之后执行(依赖最终属性已结算+层级截断)
            if (statData.主角 && statData.系统状态) {
                checkTrialEligibility(statData.主角, statData.系统状态);
            }

            // 插入：功法熟练度守卫 (模块4)
            // guardProficiency(statData.主角);

            // 插入：伴生神器自动成长 (模块3)
            // processArtifactGrowth(statData.主角);

            // 插入：真实游玩天数推进 (世界.时间日期变动 → 系统状态.游玩天数+1)
            updatePlayDays(statData);

            // 插入：全自动收菜系统 (模块1, 改由游玩天数轴驱动, 免疫副本时间跳跃)
            autoHarvestAssets(statData, statDataBefore);

            // 【新增】：执行三大后台清理逻辑
            const isCombat = statData.系统状态?.是否战斗中 === true;

            // 1. 清理主角的道具和状态
            if (statData.主角) {
                cleanupZeroQuantityItems(statData.主角);
                processStatusDuration(statData.主角, isCombat);
            }
            
            // 2. 清理 NPC 的道具和状态
            if (statData.关系列表) {
                Object.values(statData.关系列表).forEach(npc => {
                    if (!npc) return;
                    cleanupZeroQuantityItems(npc);
                    processStatusDuration(npc, isCombat);
                });
                
                // 3. 清理已死亡的 NPC
                cleanupDeadNPCs(statData);
            }

            // 4. 世界稳定值自动推演 (模块9)
            calcWorldStability(statData);

            // 5. 战斗轮次与形态冷却全自动管理 (模块10)
            processCombatAndCooldowns(statData, statDataBefore);

        } finally {
            isProcessing = false;
        }
    };

    // ===== 轻量路径工具(供数据守卫使用) =====
    /** 按 a.b.c 路径读取嵌套值 */
    function getByPath(obj, path) {
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    /** 按 a.b.c 路径写入嵌套值(父节点不存在则放弃,不创建) */
    function setByPath(obj, path, value) {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (cur[keys[i]] === undefined) return;
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    /** 变更检测:对象走 JSON 序列化比较,基本类型走 === */
    function hasChanged(oldVal, newVal) {
        if (oldVal === newVal) return false;
        if (typeof oldVal === 'object' && typeof newVal === 'object') {
            return JSON.stringify(oldVal) !== JSON.stringify(newVal);
        }
        return true;
    }

    /** 安全深拷贝(优先 lodash,回退 JSON) */
    function clonePlainValue(value) {
        if (value === undefined) return undefined;
        if (typeof _ !== 'undefined' && _?.cloneDeep) return _.cloneDeep(value);
        return JSON.parse(JSON.stringify(value));
    }

    /**
     * 是否处于"悬浮球UI操作"窗口期
     *   悬浮球 writeBackMvu 落库前会置 __samsaraUIMutation=true, 广播事件后立刻复位
     *   本函数在 VARIABLE_UPDATE_ENDED 回调内读取该标志, 判断本次更新来源是否为 UI 操作
     *   (主窗口 → GS_PARENT → window.parent → window.top → window 多级 fallback 读取)
     * @returns {boolean}
     */
    function isUIMutationActive() {
        try {
            let flagWin = null;
            try { if (typeof GS_PARENT !== 'undefined' && GS_PARENT) flagWin = GS_PARENT; } catch(e){}
            if (!flagWin) { try { if (window.parent && window.parent !== window) flagWin = window.parent; } catch(e){} }
            if (!flagWin) { try { if (window.top && window.top !== window) flagWin = window.top; } catch(e){} }
            if (!flagWin) flagWin = window;
            return !!(flagWin && flagWin.__samsaraUIMutation === true);
        } catch (e) {
            return false;
        }
    }

    /**
     * 主角层级"普升通行证"校验
     *   "开始进阶"按钮 writeBackMvu 时会携带 opts.tierPermit=目标层级(如 'Ⅱ'), 写入
     *   win/GS_PARENT/window 的 __samsaraTierPermit。原因: Mvu.replaceMvuData 是异步的,
     *   它自身会再触发一次 VARIABLE_UPDATE_ENDED——该次事件发生时 __samsaraUIMutation 已复位,
     *   层级变化会被 guardProtectedFields 当成 AI 篡改回滚 → 普升"闪一下又降回"。
     *   通行证允许 newVal === permit(仅此一档)时放行层级变化, 并在消费后立刻作废(一次性);
     *   多窗口(win/GS_PARENT/parent/top/window)任一命中即视为有效(与 isUIMutationActive 同策略)。
     *   permit 由悬浮球写入, 20s 后由其兜底清除, 不会长期残留。
     * @param {string} newVal 本次事件里的主角.层级 新值
     * @returns {boolean} 是否放行
     */
    function tierPermitAllows(newVal) {
        try {
            const permitWins = [];
            try { if (typeof GS_PARENT !== 'undefined' && GS_PARENT) permitWins.push(GS_PARENT); } catch(e){}
            try { if (window.parent && window.parent !== window) permitWins.push(window.parent); } catch(e){}
            try { if (window.top && window.top !== window) permitWins.push(window.top); } catch(e){}
            permitWins.push(window);
            for (const w of permitWins) {
                const permit = w && w.__samsaraTierPermit;
                if (permit && newVal === permit) {
                    // 一次性消费: 放行后立刻作废, 防止 AI 恰好改到同值也被豁免
                    try { w.__samsaraTierPermit = null; } catch(e2) {}
                    return true;
                }
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * 数据守卫：回滚被 AI 篡改的只读字段 + 规范化新增装备
     * 覆盖 主角 和 关系列表 中的所有在场 NPC
     * @param {object} statData 本次更新后的 stat_data
     * @param {object} statDataBefore 上一帧 stat_data
     */
    function guardProtectedFields(statData, statDataBefore) {
        if (!statDataBefore) return;

        // —— 1. 定义受保护的路径（相对于角色对象） ——
        // 这些字段在 schema 中标注了 readonly: true
        const PROTECTED_RELATIVE_PATHS = [
            'HP_MAX',
            'EP_MAX',
            '最终属性',   // 整个属性对象由后台全量计算，AI 禁止修改
        ];
        // 主角专属受保护路径: 层级仅可由 进阶流程(悬浮球"开始进阶"按钮→writeBackMvu) 修改,
        //   AI/世界书变量更新不得自行改写(试炼完成标记由 onShouldIAdvance 写回, 不广播事件, 不受守卫影响)
        //   ★ 仅主角受限; NPC 层级允许剧情演进自由变动(如反派突破/成长), 不做守卫
        const HERO_ONLY_PROTECTED_PATHS = [
            '层级',
        ];

        // —— 2. 通用的回滚函数：对比并回滚一个角色对象的只读字段 ——
        //   extraPaths: 额外受保护路径(如主角专属的"层级"), 仅调用方指定时生效
        function rollbackProtectedFields(char, charBefore, label, extraPaths) {
            if (!char || typeof char !== 'object') return;
            if (!charBefore || typeof charBefore !== 'object') return;

            for (const path of [...PROTECTED_RELATIVE_PATHS, ...(extraPaths || [])]) {
                const oldVal = getByPath(charBefore, path);
                const newVal = getByPath(char, path);
                if (oldVal !== undefined && hasChanged(oldVal, newVal)) {
                    console.warn(
                        `[变量守卫] ⚠️ ${label} 只读字段被外部修改: ${path} ` +
                        `(${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)})，已回滚`
                    );
                    setByPath(char, path, oldVal);
                }
            }
        }

        // —— 3. 回滚主角 ——
        const user = statData?.主角;
        const userBefore = statDataBefore?.主角;
        if (user && userBefore) {
            // 主角额外保护"层级": 仅进阶流程可改, AI 篡改一律回滚
            //   ★ UI 操作窗口期(悬浮球"开始进阶"按钮→writeBackMvu 广播事件)放行层级变化,
            //     否则合法进阶会被守卫回滚
            //   ★ 普升通行证: replaceMvuData 异步触发的二次 VARIABLE_UPDATE_ENDED 不在
            //     __samsaraUIMutation 窗口期内(标志已复位), 凭 __samsaraTierPermit
            //     (=目标层级, 由"开始进阶"按钮写入, 20s 兜底过期)放行, 覆盖"闪升又降回"缺陷
            const extraHeroPaths = isUIMutationActive()
                ? []
                : (tierPermitAllows(user.层级) ? [] : HERO_ONLY_PROTECTED_PATHS);
            rollbackProtectedFields(user, userBefore, '主角', extraHeroPaths);
        }

        // —— 4. 回滚关系列表中的所有在场 NPC ——
        const rel = statData?.关系列表;
        const relBefore = statDataBefore?.关系列表;
        if (rel && typeof rel === 'object' && relBefore && typeof relBefore === 'object') {
            for (const [name, npc] of Object.entries(rel)) {
                if (!npc || typeof npc !== 'object') continue;

                const npcBefore = relBefore[name];
                if (!npcBefore || typeof npcBefore !== 'object') continue;

                rollbackProtectedFields(npc, npcBefore, `NPC:${name}`);
            }
        }

         // —— 5. 新增装备守卫（主角装备，原有逻辑保持不变） ——
        // 仅处理“新增装备”，不动已有装备
        const oldEquip = statDataBefore?.主角?.装备 || {};
        const newEquip = statData?.主角?.装备 || {};
        for (const [equipKey, equipVal] of Object.entries(newEquip)) {
            if (!equipVal || typeof equipVal !== 'object') continue;
            const isNewEquip = oldEquip[equipKey] === undefined;
            if (!isNewEquip) continue;

            // 状态规范化：仅允许 0|1，其余一律归正为 0（未穿戴）
            if (equipVal.状态 !== 0 && equipVal.状态 !== 1) {
                console.warn(
                    `[变量守卫] ⚠️ 新增装备 "${equipKey}" 状态非法(${JSON.stringify(equipVal.状态)})，已归正为 0(未穿戴)`
                );
                equipVal.状态 = 0;
            }

            // 类型校验：应为 0-9 整数，非法仅告警（留待装备计算阶段处理）
            const typeVal = equipVal.类型;
            const isValidType = Number.isInteger(typeVal) && typeVal >= 0 && typeVal <= 9;
            if (!isValidType) {
                console.warn(
                    `[变量守卫] ⚠️ 新增装备 "${equipKey}" 类型非法(${JSON.stringify(typeVal)})，` +
                    `应为 0-9 整数，留待装备计算阶段处理`
                );
            }
        }
    }

    // ===== 属性全量重算（属性面板是只读汇总，由后台统计各来源加值）=====
    // 设计模型（经用户确认）：
    //   1. 属性面板 = 只读汇总。AI 只动血统/装备/技能/状态/形态，后台把加值统计进 属性
    //   2. 五维：血统 + (激活形态) + 已穿戴装备五维 + 状态五维
    //      - 形态激活时形态五维真属性直接累加到血统之上（不再二选一替代血统）
    //      - 未穿戴(状态!==1)装备不参与
    //   3. 衍生属性：公式 + 加值叠加（ATK=(力+敏)/2 + 装备ATK + 形态ATK ...）
    //   4. 检定：仅 先攻DC/防御DC；基础值 + 装备加值（形态无检定字段）
    //   5. 层级(位格)：只读，仅作修正值上限，绝不写回
    //   6. HP/EP：写顶级字段（属性对象全量只读，不在其内写 HP/EP 避免与守卫打架）
    //   注：状态.效果、形态.效果 为字符串，留待第三阶段字符串解析器统一处理

    const ATTR_NAMES = ['力量', '敏捷', '体质', '精神', '魅力'];
    const DERIVED_ATTRS = ['ATK', 'DEF', 'MATK', 'MDEF', 'AP'];
    const CHECK_ATTRS = ['先攻DC', '防御DC'];
    // 装备/形态可能提供的加值键（用于通用累加）
    const BONUS_KEYS = [...DERIVED_ATTRS, ...CHECK_ATTRS];
    // 位格 → 属性修正值上限
    const TIER_MODIFIER_CAPS = {
        'F': 12, 'E': 30, 'D': 60, 'C': 90, 'B': 120,
        'A': 150, 'S': 180, 'SS': 230, 'SSS': 270
    };
    // 品质阶位序列（低 → 高）
    const TIER_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    // 五维键常量（与 ZOD 的 attr5_keys 对齐）
    const attr5_keys_const = ['力量', '敏捷', '体质', '精神', '魅力'];
    // 生命层级（大层级）序列与单维属性加成区间上下限
    //   ★ 大层级只用于【最终单维累加值的截断上限】，不参与品质→数值转换
    const LIFE_TIER_ORDER = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ'];
    // ★ 罗马数字(大层级) ↔ 品质字母 双向映射（两序列各 9 档一一对应）
    //   Ⅰ↔F Ⅱ↔E Ⅲ↔D Ⅳ↔C Ⅴ↔B Ⅵ↔A Ⅶ↔S Ⅷ↔SS Ⅸ↔SSS
    //   AI 有时把品质字母错传成罗马数字（如 力量:Ⅲ），运行期归正用
    const ROMAN_TO_QUALITY = Object.assign({}, ...LIFE_TIER_ORDER.map((r, i) => ({ [r]: TIER_ORDER[i] })));
    const QUALITY_TIER_SET = Object.assign({}, ...TIER_ORDER.map(q => ({ [q]: 1 })));
    const LIFE_TIER_RANGE = {
        'Ⅰ': [1, 29],     'Ⅱ': [30, 99],     'Ⅲ': [100, 299],
        'Ⅳ': [300, 999],  'Ⅴ': [1000, 2999], 'Ⅵ': [3000, 9999],
        'Ⅶ': [10000, 29999], 'Ⅷ': [30000, 99999], 'Ⅸ': [100000, Infinity]
    };
    // ——— 品质字母判定（与 ZOD 的 E_quality 对齐） ———
    //   ★ 兼容 AI 错传罗马数字：'Ⅲ' 等视为品质字母（后续 normalizeTier 会归正为 'D'）
    const QUALITY_STRING_SET = { 'F':1, 'E':1, 'D':1, 'C':1, 'B':1, 'A':1, 'S':1, 'SS':1, 'SSS':1 };
    function isQualityString(v) {
        if (typeof v !== 'string') return false;
        const s = v.trim();
        if (Object.prototype.hasOwnProperty.call(QUALITY_STRING_SET, s.toUpperCase())) return true;
        return Object.prototype.hasOwnProperty.call(ROMAN_TO_QUALITY, s);
    }
    /**
     * 【血统/形态/成长状态 单属性加成档】（按实体品质锁主区间）
     *   key = 实体品质 ; value = [下限, 上限]
     *   D 级血统: 力量原属性任意品质 → 都在 D 档 120-180 内 9 等分取段
     */
    const GROW_QUALITY_RANGE = {
        'F':   [1, 20],
        'E':   [5, 60],
        'D':   [12, 180],
        'C':   [36, 600],
        'B':   [120, 1800],
        'A':   [360, 6000],
        'S':   [1200, 18000],
        'SS':  [3600, 60000],
        'SSS': [12000, 299999]
    };
    /**
     * 【装备与形态基础数值表】（按衍生项类型分列）
     *   列: ATK/MATK | DEF/MDEF | AP(百分点) | 单维属性加成(五维)
     *   key = 列名 ; value = { 品质: [下限, 上限] }
     */
    const EQUIP_QUALITY_RANGE = {
        'ATK':  { 'F':[3,15], 'E':[10,40], 'D':[25,100], 'C':[70,250], 'B':[180,600], 'A':[450,1400], 'S':[1000,3000], 'SS':[2200,6500], 'SSS':[5000,20000] },
        'MATK': { 'F':[3,15], 'E':[10,40], 'D':[25,100], 'C':[70,250], 'B':[180,600], 'A':[450,1400], 'S':[1000,3000], 'SS':[2200,6500], 'SSS':[5000,20000] },
        'DEF':  { 'F':[1,9],  'E':[5,25],  'D':[15,55],  'C':[40,130], 'B':[100,300], 'A':[250,700],  'S':[550,1500],  'SS':[1200,3300], 'SSS':[2600,7000] },
        'MDEF': { 'F':[1,9],  'E':[5,25],  'D':[15,55],  'C':[40,130], 'B':[100,300], 'A':[250,700],  'S':[550,1500],  'SS':[1200,3300], 'SSS':[2600,7000] },
        'AP':   { 'F':[1,15], 'E':[10,30], 'D':[20,45],  'C':[35,65],  'B':[55,90],   'A':[80,120],   'S':[110,150],   'SS':[140,180],   'SSS':[170,220] },
        // 装备单维属性加成(五维)列
        '五维': { 'F':[1,9],  'E':[4,18],  'D':[10,45],  'C':[30,110], 'B':[80,260],  'A':[200,600],  'S':[450,1300],  'SS':[1000,2800], 'SSS':[2200,6000] }
    };
    /**
     * 核心：单项品质字母 → 数值
     *   规则：实体品质 Q 锁定主区间 [lo, hi]；单项品质 q 决定 9 等分中的第几段；
     *         段宽 w=floor((hi-lo)/9)；段起 base=lo + rank(q)*w；值 = base + random(1..w)
     * @param {string} attrTier 单项品质（选段位）：'F'~'SSS'
     * @param {[number,number]} range [下限,上限] 主区间
     * @returns {number}
     */
    function qualitySegValue(attrTier, range) {
        const lo = safeNum(range && range[0], 0);
        const hi = safeNum(range && range[1], lo);
        const span = Math.max(1, hi - lo);
        const w = Math.max(1, Math.floor(span / 9));
        const segBase = lo + tierRank(attrTier) * w;        // 段起点
        return segBase + Math.floor(Math.random() * w) + 1; // 段内随机 [1, w]
    }
    /**
     * 品质字母 → 该项应落到的"档位区间" [下限, 上限]
     *   与 qualitySegValue 同公式反推：segBase + [1, w]
     *   用于独立于 before 的"区间校验"：旧真属性若落在此区间内 → 品质未变 → 保留；
     *   若落在区间外(品质字母变 / 实体整体品质变) → 品质变化 → 重随机。
     *   无区间数据(衍生肖漏)返回 [Infinity, -Infinity] 触发始终重算。
     */
    function attrSegRange(attrKey, attrTier, itemTier, kind) {
        const q = normalizeTier(attrTier);
        const it = normalizeTier(itemTier);
        let range;
        if (kind === 'status') {
            range = GROW_QUALITY_RANGE[it];
        } else if (kind === 'blood' || kind === 'form') {
            if (attr5_keys_const.includes(attrKey)) {
                range = GROW_QUALITY_RANGE[it];
            } else {
                range = EQUIP_QUALITY_RANGE[attrKey] && EQUIP_QUALITY_RANGE[attrKey][it];
            }
        } else { // equip
            const col = attr5_keys_const.includes(attrKey) ? '五维' : attrKey;
            range = EQUIP_QUALITY_RANGE[col] && EQUIP_QUALITY_RANGE[col][it];
        }
        if (!range) return [Infinity, -Infinity];
        const lo = safeNum(range && range[0], 0);
        const hi = safeNum(range && range[1], lo);
        const span = Math.max(1, hi - lo);
        const w = Math.max(1, Math.floor(span / 9));
        const segBase = lo + tierRank(q) * w;
        return [segBase + 1, segBase + w];
    }
    /**
     * 品质字母 → 数值（按实体类型/列分派）
     * @param {string} attrKey 属性键（力量/ATK/...）
     * @param {string} attrTier 该项的品质字母
     * @param {string} itemTier 实体整体品质（锁主区间）
     * @param {'blood'|'equip'|'form'|'status'} kind 来源类型
     * @returns {number}
     */
    function qualityToValue(attrKey, attrTier, itemTier, kind) {
        const q = normalizeTier(attrTier);
        const it = normalizeTier(itemTier);
        const grow = () => qualitySegValue(q, GROW_QUALITY_RANGE[it]);
        const equipCol = (col) => {
            const r = EQUIP_QUALITY_RANGE[col] && EQUIP_QUALITY_RANGE[col][it];
            return r ? qualitySegValue(q, r) : 0;
        };
        if (kind === 'status') {
            // 状态五维字母 → 成长档；衍生项不走本函数(数值直累加)
            return grow();
        }
        if (kind === 'blood' || kind === 'form') {
            if (attr5_keys_const.includes(attrKey)) return grow();
            return equipCol(attrKey);
        }
        // equip：五维走"单维属性加成"列，衍生项走对应列
        if (attr5_keys_const.includes(attrKey)) return equipCol('五维');
        return equipCol(attrKey);
    }
    /**
     * 解析实体"真属性"：把 原始属性(品质字母/数值) 转成 数值
     *   - 不用任何缓存/快照/before 对比；用"档位区间校验"独立判断品质是否变化
     *   - 品质未变(旧真属性落在当前品质算出的档位 [segBase+1, segBase+w] 内) → 复用旧随机数，不重随机
     *   - 品质变化(单项字母变 / 实体整体品质变 → 落到旧区间外) → 重随机
     *   - 状态特例：衍生项数值原样进真属性；五维项：字母→数值，数值→原样
     * @param {object} item 实体（血统/装备/状态/形态）
     * @param {'blood'|'equip'|'form'|'status'} kind 来源类型
     * @param {object} [itemBefore] 保留参数(已不依赖；区间校验取代 before 对比)
     * @returns {object} 真属性对象（数值）
     */
    function resolveRealAttr(item, kind, itemBefore) {
        if (!item || typeof item !== 'object') return {};
        const raw = item.原始属性;
        if (!raw || typeof raw !== 'object') return item.真属性 || {};
        if (!item.真属性 || typeof item.真属性 !== 'object') item.真属性 = {};
        const real = item.真属性;
        // 形态字段已由"品质"改为"层级"(Ⅰ~Ⅸ); normalizeTier 兼容罗马数字自动归正为品质字母; 旧存档 品质 字段兜底
        const it = normalizeTier(item.层级 != null ? item.层级 : item.品质);
        // ★ Bug 修复: 实体整体层级变化(Ⅰ→Ⅱ…)时强制重算所有品质型属性, 不依赖"区间校验"碰运气
        //   原因: 区间校验(seg range)在 item.层级 改变时会整体位移, 旧真属性可能恰好落在新区间内
        //         → inSeg 命中 → 不重算 → 真属性停留在旧层级档位; 故此处显式比对 itemBefore 的层级变化。
        let tierChanged = false;
        if (itemBefore && typeof itemBefore === 'object') {
            const beforeTierRaw = itemBefore.层级 != null ? itemBefore.层级 : itemBefore.品质;
            const beforeIt = normalizeTier(beforeTierRaw);
            if (beforeIt !== it) tierChanged = true;
        }
        for (const k of Object.keys(raw)) {
            const v = raw[k];
            const isQ = isQualityString(v);
            // 状态衍生项：永远数值，原样进真属性
            if (kind === 'status' && !attr5_keys_const.includes(k)) {
                real[k] = safeNum(v, 0);
                continue;
            }
            // 状态五维 / 装备&血统&形态 全部项：字母→数值；数值→原样
            //   ★ 区间校验独立于 before：旧真属性落在当前档位区间内 → 保留；否则重随机
            const tier = isQ ? normalizeTier(v) : null;
            if (isQ) {
                // 区间校验(独立于 before): 旧真属性若落在当前品质算出的档位区间
                //   [segBase+1, segBase+w] 内 → 品质未变 → 保留旧随机数(穿脱装备不跳变);
                //   落在区间外(单项品质字母变 / 实体整体品质变) → 品质变化 → 重随机。
                //   之所以不用 before 对比: writeBackMvu 的 before 来自当前内存 clone,
                //   已含用户对品质的修改 → beforeTier === tier 永真 → 失效。
                //   ★ 但"整体层级变化"(tierChanged) 在 writeBackMvu 路径下对 血统/装备/状态 仍可被检测到
                //     (层级字段属于只读保护字段, clone before 保留用户编辑前的层级), 故显式判定 tierChanged
                //     时强制重算, 覆盖区间校验可能漏判的情况。
                const old = real[k];
                const [segLo, segHi] = attrSegRange(k, tier, it, kind);
                const inSeg = typeof old === 'number' && isFinite(old) && old >= segLo && old <= segHi;
                if (!inSeg || tierChanged) {
                    real[k] = qualityToValue(k, tier, it, kind);
                }
                // inSeg 且 !tierChanged 时保留 real[k]（旧随机数）不重随机
            } else {
                real[k] = safeNum(v, 0);
            }
        }
        // 清理已从原始属性删除的键
        for (const k of Object.keys(real)) {
            if (raw[k] === undefined) delete real[k];
        }
        return real;
    }
    /** 安全取数 */
    function safeNum(v, def = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    /** 规范化品质字符串为 F~SSS；罗马数字归正为对应品质字母；非法值回落 F */
    function normalizeTier(q) {
        const s = String(q || '').trim();
        const up = s.toUpperCase();
        if (TIER_ORDER.includes(up)) return up;
        if (ROMAN_TO_QUALITY[s]) return ROMAN_TO_QUALITY[s]; // AI 错传 Ⅲ → D
        return 'F';
    }

    /** 规范化生命层级(大层级)字符串为 Ⅰ~Ⅸ；非法值回落 Ⅰ */
    function normalizeLifeTier(t) {
        const s = String(t || '').trim();
        return LIFE_TIER_ORDER.includes(s) ? s : 'Ⅰ';
    }

    /** 品质序位（越高越大） */
    function tierRank(q) {
        const i = TIER_ORDER.indexOf(normalizeTier(q));
        return i >= 0 ? i : 0;
    }

    /**
     * 原住民NPC位格/血统品质压制
     *   触发条件 (全部满足才压制):
     *     1. 新登场 NPC: 上一帧 关系列表 不存在该名字 (避免反复覆盖剧情合理成长)
     *     2. 不在主神空间 (系统状态.是否在主神空间 !== true)
     *     3. 身份不含 轮回者/穿越者/守护者/织梦者/篡夺者/残魂 (为特殊身份留通道)
     *   压制规则:
     *     - NPC.层级 (Ⅰ~Ⅸ) 超过 世界.位格 → 压回 世界.位格
     *     - 每条 血统[name].层级 或 .品质 超出 世界.位格 对应品质字母 → 压回 capQuality
     *   映射: Ⅰ↔F Ⅱ↔E Ⅲ↔D Ⅳ↔C Ⅴ↔B Ⅵ↔A Ⅶ↔S Ⅷ↔SS Ⅸ↔SSS (复用 ROMAN_TO_QUALITY / TIER_ORDER)
     */
    const NATIVE_SPECIAL_IDENTITY_SET = {
        '轮回者': 1, '穿越者': 1, '守护者': 1, '织梦者': 1, '篡夺者': 1, '残魂': 1
    };
    function clampNativeNpcToWorldTier(statData, statDataBefore) {
        if (!statData) return;
        const rel = statData.关系列表;
        if (!rel || typeof rel !== 'object') return;
        const relBefore = statDataBefore && statDataBefore.关系列表;
        const inMainSpace = !!(statData.系统状态 && statData.系统状态.是否在主神空间 === true);
        if (inMainSpace) return;
        const worldTier = statData.世界 && statData.世界.位格;
        if (!worldTier) return;
        const capLifeIdx = LIFE_TIER_ORDER.indexOf(normalizeLifeTier(worldTier));
        if (capLifeIdx < 0) return;
        const capQuality = TIER_ORDER[capLifeIdx];
        const capQualityRank = TIER_ORDER.indexOf(capQuality);
        const overCapQ = q => tierRank(q) > capQualityRank;
        const overCapLife = r => (LIFE_TIER_ORDER.indexOf(normalizeLifeTier(r)) > capLifeIdx);

        for (const [name, npc] of Object.entries(rel)) {
            if (!npc || typeof npc !== 'object') continue;
            if (relBefore && typeof relBefore === 'object' && relBefore[name]) continue;
            const identList = npc.身份;
            let isSpecial = false;
            if (Array.isArray(identList)) {
                for (const it of identList) {
                    if (typeof it === 'string' && NATIVE_SPECIAL_IDENTITY_SET[it.trim()]) { isSpecial = true; break; }
                }
            } else if (typeof identList === 'string') {
                if (NATIVE_SPECIAL_IDENTITY_SET[identList.trim()]) isSpecial = true;
            }
            if (isSpecial) continue;

            if (npc.层级 && overCapLife(npc.层级)) {
                console.warn(`[位格压制] 新登场NPC "${name}" 层级 ${npc.层级} 超出世界位格 ${worldTier}, 已压回 ${worldTier}`);
                npc.层级 = worldTier;
            }
            const bloodDict = npc.血统;
            if (bloodDict && typeof bloodDict === 'object') {
                for (const [bname, b] of Object.entries(bloodDict)) {
                    if (!b || typeof b !== 'object') continue;
                    if (b.层级 && isQualityString(b.层级) === false && overCapLife(b.层级)) {
                        console.warn(`[位格压制] NPC "${name}" 血统[${bname}] 层级 ${b.层级} 超出 ${worldTier}, 已压回 ${worldTier}`);
                        b.层级 = worldTier;
                        delete b.品质;
                    } else if (b.品质 && isQualityString(b.品质) && overCapQ(b.品质)) {
                        console.warn(`[位格压制] NPC "${name}" 血统[${bname}] 品质 ${b.品质} 超出 ${capQuality}, 已压回 ${capQuality}`);
                        b.品质 = capQuality;
                    }
                }
            }
        }
    }

    /** 新版 calcModifier：属性值 → 修正值曲线 */
    function calcModifier(attrVal) {
        const x = safeNum(attrVal, 0);
        if (x <= 0) return 0;

        // 断点数组: [属性值, 修正值]
        const points = [
            [0, 0],
            [20, 12],
            [60, 30],
            [180, 60],
            [600, 90],
            [1800, 120],
            [6000, 150],
            [18000, 180],
            [60000, 230],
            [180000, 270]
        ];

        // 如果超过 180000，继续缓慢增长（对数衰减，永不封死，满30万则是286）
        if (x >= 180000) {
            const extra = Math.floor(Math.log10((x - 180000) / 10000 + 1) * 15);
            return Math.min(350, 270 + extra);
        }

        // 分段线性插值
        for (let i = 0; i < points.length - 1; i++) {
            const [x1, y1] = points[i];
            const [x2, y2] = points[i + 1];
            if (x >= x1 && x < x2) {
                const slope = (y2 - y1) / (x2 - x1);
                return Math.floor(y1 + slope * (x - x1));
            }
        }

        return points[points.length - 1][1];
    }

    /**
     * 判定当前形态是否激活（激活则形态真属性累加到血统之上）
     * 状态字段仅为 AI 叙事记录，是否可激活由 悬浮球状态栏.js 决定，此处不做检查
     * @returns {object|null} 激活的形态库条目；未激活则 null
     */
    function getActiveForm(char) {
        const cur = char.当前形态;
        if (!cur || typeof cur !== 'object') return null;
        if (cur.激活 !== true) return null;
        const name = cur.名称;
        if (!name) return null;
        const entry = char.形态库 && char.形态库[name];
        if (!entry || typeof entry !== 'object') return null;
        return entry;
    }

    /**
     * NPC 群体单位 THP/数量同步
     * 规则（仅 NPC）:
     *   - 新建实体 / 无上一帧：始终信任 [数量]，强制 THP = HP_MAX*(数量-1)
     *     （AI 常按错误 HP 预填 THP，客户端必须覆盖）
     *   - 已有实体且 THP 相对上一帧减少：按 THP 反推人数
     *   - 增援（数量变大）：按新编制补满 THP
     *   - 单名成员属性/HP_MAX 不乘人数；THP 表示“其余成员”的生命池
     * @param {object} char 当前 NPC
     * @param {object|null} charBefore 上一帧 NPC（可空）
     * @param {string} label 日志标识
     */
    function syncNpcGroupThp(char, charBefore, label) {
        if (!char || typeof char !== 'object') return;
        // 仅处理关系列表 NPC；主角无“数量”群体语义
        if (!label || String(label).indexOf('NPC:') !== 0) return;
        // 无数量字段的旧数据按单体处理
        if (char.数量 === undefined || char.数量 === null) return;

        const maxHp = Math.max(1, safeNum(char.HP_MAX, 1));
        let qty = Math.max(1, Math.floor(safeNum(char.数量, 1)));
        let thp = Math.max(0, Math.floor(safeNum(char.THP, 0)));
        const isNew = !(charBefore && typeof charBefore === 'object');
        const thpBefore = isNew ? 0 : Math.max(0, safeNum(charBefore.THP, 0));
        const qtyBefore = (!isNew && charBefore.数量 != null)
            ? Math.max(1, Math.floor(safeNum(charBefore.数量, 1)))
            : qty;
        const fullPool = function(n) { return maxHp * (Math.max(1, n) - 1); };

        // 单体（数量<=1）：THP 仅为普通护盾，不参与群体编制
        if (qty <= 1) {
            if (char.数量 !== 1 && char.数量 !== undefined) char.数量 = 1;
            return;
        }

        // 1) 新建群体：强制按数量灌满 THP，忽略 AI 预填的错误 THP
        //    例：AI 写 HP=30,THP=60,数量=3，实际 HP_MAX=80 → 应 THP=160,数量=3
        if (isNew) {
            const pool = fullPool(qty);
            // if (thp !== pool) {
            //     console.log(
            //         `[群体单位] ${label}: 新建灌池 THP ${thp} → ${pool} ` +
            //         `(数量=${qty}, HP_MAX=${maxHp})`
            //     );
            // } else {
            //     console.log(
            //         `[群体单位] ${label}: 新建灌池 THP=${pool} ` +
            //         `(数量=${qty}, HP_MAX=${maxHp})`
            //     );
            // }
            char.THP = pool;
            char.数量 = qty;
            return;
        }

        // 2) 增援：AI 显式提高了数量 → 按新编制补满群体 THP 池
        if (qty > qtyBefore) {
            const need = fullPool(qty);
            if (thp < need) {
                // console.log(
                //     `[群体单位] ${label}: 编制增援 数量 ${qtyBefore} → ${qty}, THP ${thp} → ${need}`
                // );
                char.THP = need;
            }
            char.数量 = qty;
            return;
        }

        // 3) 脱战/清零后重灌：数量>1 且当前与上一帧 THP 均为 0
        if (thp === 0 && thpBefore === 0) {
            const pool = fullPool(qty);
            char.THP = pool;
            char.数量 = qty;
            // console.log(
            //     `[群体单位] ${label}: 重灌群体 THP=${pool} ` +
            //     `(数量=${qty}, HP_MAX=${maxHp})`
            // );
            return;
        }

        // [已关闭] THP 承伤→数量递减逻辑: 数量由 AI 管理, 后台不再反推
        // THP 未变化或其他情况: 保持现状, 不改写数量
    }

    /**
     * 重算单个角色（主角或NPC）的全套属性面板
     * @param {object} char 角色对象（主角 或 关系列表[某NPC]）
     * @param {string} label 日志标识
     * @param {object|null} [charBefore] 上一帧角色对象（NPC 群体同步用）
     */
    function recalcCharacter(char, label, charBefore) {
        if (!char || typeof char !== 'object') return;
        // ★ 后台守卫: 当前形态未激活时, 自动清空名称(防止残留脏数据导致 getActiveForm 误判)
        try {
            const cur = char.当前形态;
            if (cur && typeof cur === 'object' && cur.激活 !== true && cur.名称) {
                cur.名称 = '';
                // if (label) console.log(`[属性重算] ${label}: 当前形态未激活, 已清空残留名称`);
            }
        } catch (e) {}

        if (!char.最终属性) char.最终属性 = {};
        const attr = char.最终属性;
        const 血统 = char.血统 || {};
        const 装备 = char.装备 || {};
        const 状态 = char.状态 || {};
        // 上一帧对应子集合（供 resolveRealAttr 判定品质是否变化，未变则复用旧随机数）
        const 血统Before = (charBefore && charBefore.血统) || {};
        const 装备Before = (charBefore && charBefore.装备) || {};
        const 状态Before = (charBefore && charBefore.状态) || {};

        // —— 0. 判定形态激活（激活后形态真属性累加到血统之上）——
        const activeForm = getActiveForm(char);
        const formActive = activeForm !== null;
        const activeFormBefore = charBefore ? getActiveForm(charBefore) : null;
        // 形态激活：形态真属性直接累加到血统之上，不再二选一替代血统
        // ★ 新机制：原始属性是品质字母，需 resolveRealAttr 转成 真属性(数值) 再累加
        //   传入 before：品质未变复用上一轮随机数，品质变化才重随机（避免穿脱装备跳变）
        // ★ Bug 修复: 形态从"未激活"切换到"激活"时, 强制清空形态真属性并按当前层级重算
        //   原因: 形态未激活期间用户可能编辑了层级(Ⅰ→Ⅱ), 但未激活的形态不会被 resolveRealAttr 处理,
        //         其真属性仍是旧层级数值; 激活瞬间 before 克隆已含新层级 → tierChanged 检测失效 → 不重算。
        //   处理: 清空真属性 + 传 null 作 before, 让 resolveRealAttr 走"空真属性→inSeg 全 false→全量重算"。
        const forceFormRecompute = formActive && activeForm && !activeFormBefore;
        if (forceFormRecompute && activeForm.真属性 && typeof activeForm.真属性 === 'object') {
            Object.keys(activeForm.真属性).forEach(k => { delete activeForm.真属性[k]; });
        }
        const sixSource = formActive ? resolveRealAttr(activeForm, 'form', forceFormRecompute ? null : activeFormBefore) : null;

        // —— 1. 最终五维 ——
        // 来源：血统 + (激活形态) + 已穿戴装备五维 + 状态五维
        // 真属性(数值)累加；状态五维双修(字母→真属性 / 数值→原样)，衍生项永远数值
        const statusSix = {};
        ATTR_NAMES.forEach(a => { statusSix[a] = 0; });
        Object.entries(状态).forEach(([sname, s]) => {
            if (s && typeof s === 'object' && s.原始属性) {
                const sb = 状态Before[sname];
                const rs = resolveRealAttr(s, 'status', sb);
                // ★ 减益状态: 原始属性为字母品质时, 该项真属性以负数计入最终五维
                //   (真属性本身保持正值不变, 以维持 resolveRealAttr 的档位区间缓存稳定;
                //    数值型原始属性按原逻辑正负原样累加, 不做处理)
                const isDebuff = String(s.类型).trim() === '减益';
                ATTR_NAMES.forEach(a => {
                    const v = safeNum(rs[a]);
                    if (isDebuff && isQualityString(s.原始属性[a]) && v > 0) {
                        statusSix[a] -= v;
                    } else {
                        statusSix[a] += v;
                    }
                });
            }
        });
        // 已穿戴装备(状态===1)的五维加成（品质表允许装备带五维，需计入最终属性）
        const equipSix = {};
        ATTR_NAMES.forEach(a => { equipSix[a] = 0; });
        Object.entries(装备).forEach(([ename, e]) => {
            if (!e || typeof e !== 'object' || e.状态 !== 1) return;
            if (!e.原始属性 || typeof e.原始属性 !== 'object') return;
            const eb = 装备Before[ename];
            const re = resolveRealAttr(e, 'equip', eb);
            ATTR_NAMES.forEach(a => { equipSix[a] += safeNum(re[a]); });
        });

        // 血统五维真属性合计（始终参与：形态激活后血统依然生效，与形态累加）
        const bloodSix = {};
        ATTR_NAMES.forEach(a => { bloodSix[a] = 0; });
        Object.entries(血统).forEach(([bname, b]) => {
            if (b && typeof b === 'object' && b.原始属性) {
                const bb = 血统Before[bname];
                const rb = resolveRealAttr(b, 'blood', bb);
                ATTR_NAMES.forEach(a => { bloodSix[a] += safeNum(rb[a]); });
            }
        });

        // 五维 = 血统 + (激活形态) + 已穿戴装备 + 状态
        const finalBase = {};
        ATTR_NAMES.forEach(a => {
            finalBase[a] = bloodSix[a]
                + (formActive ? safeNum(sixSource[a]) : 0)
                + equipSix[a]
                + statusSix[a];
        });

        // —— 1.5 生命层级单维上限截断（核心新规则）——
        // 每个单维最终累加值，不得超过角色当前生命层级该单维上限(+1)
        //   例：层级Ⅰ→单维上限29+1=30；超过30则截断到30
        // ★ 形态激活时，上限层级取"形态层级 vs 角色自身层级"中较高者：
        //   形态层级更高 → 以形态层级为截断上限；否则仍以角色自身层级截断
        let lt = normalizeLifeTier(char.层级);
        if (formActive && activeForm) {
            // 形态.层级为生命层级(Ⅰ~Ⅸ)；旧存档可能用品质字段兜底
            const formTierRaw = activeForm.层级 != null ? activeForm.层级 : activeForm.品质;
            const formLt = normalizeLifeTier(formTierRaw);
            const charIdx = LIFE_TIER_ORDER.indexOf(lt);
            const formIdx = LIFE_TIER_ORDER.indexOf(formLt);
            if (formIdx > charIdx) {
                lt = formLt; // 形态层级更高，以形态层级作为单维上限
            }
        }
        const lifeCap = LIFE_TIER_RANGE[lt] ? (LIFE_TIER_RANGE[lt][1] + 1) : Infinity;
        ATTR_NAMES.forEach(a => {
            finalBase[a] = Math.min(finalBase[a], lifeCap);
            attr[a] = finalBase[a];
        });

        // —— 2. 修正值（受位格上限约束；位格只读，不写回）——
        // ★ 层级统一用 Ⅰ-Ⅸ 罗马数字（新机制，不再由属性总点反推写回，由开局/AI/进阶按钮写入）
        //    修正值位格上限表 TIER_MODIFIER_CAPS 按字母品质 F-SSS 作 key，故用 Ⅰ→F … Ⅸ→SSS 同序映射取 cap
        // ★ Bug 修复: 此前固定取 char.层级 计算修正上限 → 本体Ⅰ阶激活Ⅳ阶形态时，
        //   五维上限已随形态抬升至Ⅳ阶(见 1.5 的 lt)，但修正值仍被压在Ⅰ阶档(TIER_MODIFIER_CAPS['F']=12)。
        //   现改为复用 1.5 节已按"角色层级 vs 激活形态层级 取高"调整后的 lt，与属性单维上限同源：
        //   变身期间修正上限继承较高一方；结束变身 getActiveForm()=null → lt 回落本体层级 → 上限自动还原。
        const lifeIdx = LIFE_TIER_ORDER.indexOf(lt);
        const tierForCap = (lifeIdx >= 0 && lifeIdx < TIER_ORDER.length) ? TIER_ORDER[lifeIdx] : 'F';
        const modifierCap = TIER_MODIFIER_CAPS[tierForCap];
        ATTR_NAMES.forEach(a => {
            let m = calcModifier(finalBase[a]);
            if (Number.isFinite(modifierCap)) m = Math.min(m, modifierCap);
            attr[`${a}修正`] = m;
        });

        // —— 3. 汇总装备 + 形态的衍生/检定加值（均用真属性数值） ——
        // 武器(类型0,状态1)的ATK/MATK独立收集(后续各自+无武装成条目); 非武器装备全部属性计入bonus; 武器的DEF等仍计入bonus
        const bonus = {};
        BONUS_KEYS.forEach(k => { bonus[k] = 0; });
        const weapons = []; // [{name, atk, matk}]
        Object.entries(装备).forEach(([wname, e]) => {
            if (!e || typeof e !== 'object' || e.状态 !== 1) return;
            if (!e.原始属性) return;
            const eb = 装备Before[wname];
            const re = resolveRealAttr(e, 'equip', eb);
            if (safeNum(e.类型, 0) === 0) {
                // 武器: ATK/MATK单独记录, 其他属性(DEF/MDEF/AP/检定)仍计入bonus
                weapons.push({ name: wname, atk: safeNum(re.ATK), matk: safeNum(re.MATK) });
                BONUS_KEYS.forEach(k => { if (k !== 'ATK' && k !== 'MATK') bonus[k] += safeNum(re[k]); });
            } else {
                // 非武器: 全部属性(含ATK/MATK)计入bonus → 进入无武装
                BONUS_KEYS.forEach(k => { bonus[k] += safeNum(re[k]); });
            }
        });
        // 形态（仅激活时）：形态.原始属性 含 ATK/DEF/MATK/MDEF/AP（11键，无检定）; ATK/MATK计入无武装
        if (formActive) {
            DERIVED_ATTRS.forEach(k => { bonus[k] += safeNum(sixSource[k]); });
        }
        // 状态.原始属性：ATK/DEF/MATK/MDEF/AP/先攻DC/防御DC 全部计入bonus（状态无武器拆分逻辑）
        Object.entries(状态).forEach(([sname, s]) => {
            if (s && typeof s === 'object' && s.原始属性) {
                const sb = 状态Before[sname];
                const rs = resolveRealAttr(s, 'status', sb);
                BONUS_KEYS.forEach(k => { bonus[k] += safeNum(rs[k]); });
            }
        });

        // —— 4. HP_MAX / EP_MAX（旧公式；写顶级字段）——
        const { 体质, 精神} = finalBase;
        const oldMaxHP = safeNum(char.HP_MAX, safeNum(attr.HP_MAX));
        const newMaxHP = Math.max(1, Math.floor(体质 * 8));
        const oldMaxEP = safeNum(char.EP_MAX, safeNum(attr.EP_MAX));
        const newMaxEP = Math.max(0, Math.floor(精神 * 4));
        char.HP_MAX = newMaxHP;
        char.EP_MAX = newMaxEP;

        // —— 5. 智能HP/EP管理（升级按增量补、降级截断、初始化满血）——
        const isInit = (!oldMaxHP || oldMaxHP <= 10);
        const curHP = safeNum(char.HP, safeNum(attr.HP));
        const curEP = safeNum(char.EP, safeNum(attr.EP));
        if (isInit) {
            char.HP = newMaxHP;
            char.EP = newMaxEP;
        } else {
            if (newMaxHP > oldMaxHP) {
                char.HP = Math.min(curHP + (newMaxHP - oldMaxHP), newMaxHP);
            } else if (curHP > newMaxHP) {
                char.HP = newMaxHP;
            }
            if (newMaxEP > oldMaxEP) {
                char.EP = Math.min(curEP + (newMaxEP - oldMaxEP), newMaxEP);
            } else if (curEP > newMaxEP) {
                char.EP = newMaxEP;
            }
        }

        // —— 5.5 NPC 群体单位：THP 池初始化 + 按 THP 反推数量 ——
        // 必须在 HP_MAX 结算之后；主角跳过；数量<=1 时 THP 仍是普通护盾
        syncNpcGroupThp(char, charBefore || null, label);

        // —— 6. 衍生属性（公式 + 加值叠加）——
        // ATK/MATK 不再写顶层, 而是按"握持法则"拆入 最终属性.武器:
        //   无武装 = 公式换算 + 非武器装备/形态的ATK/MATK(bonus.ATK/MATK已排除武器)
        //   {武器名} = 武器原始属性ATK/MATK + 无武装ATK/MATK
        const { 力量, 敏捷 } = finalBase;
        const unarmedATK  = Math.floor((力量 + 敏捷) / 2) + bonus.ATK;
        const unarmedMATK = Math.floor(精神 / 2) + bonus.MATK;
        // 重建武器对象(每次全量重建, 防止脱下后旧条目遗留)
        attr.武器 = {};
        attr.武器.无武装 = { ATK: unarmedATK, MATK: unarmedMATK };
        weapons.forEach(w => {
            attr.武器[w.name] = { ATK: w.atk + unarmedATK, MATK: w.matk + unarmedMATK };
        });
        // 删除顶层ATK/MATK(已挪入武器结构; 旧数据残留也一并清除)
        delete attr.ATK;
        delete attr.MATK;
        // DEF/MDEF/AP 仍在顶层(武器的DEF等加成已计入bonus)
        attr.DEF  = Math.floor(体质 / 2) + bonus.DEF;
        attr.MDEF = Math.floor((体质 + 精神) / 4) + bonus.MDEF;
        attr.AP   = bonus.AP;

        // —— 新增：把护甲折算成减伤率，写回面板（前台替代固定防御）——
        attr.物理减伤率 = calcReduction(attr.DEF, char.层级 || 'E');
        attr.魔法减伤率 = calcReduction(attr.MDEF, char.层级 || 'E');

        // —— 7. 检定（基础值 + 装备加值；仅 先攻DC/防御DC）——
        attr.先攻DC = Math.floor((attr.敏捷修正 + attr.精神修正 / 2) / 2) + bonus.先攻DC;
        attr.防御DC = 30 + Math.floor((attr.体质修正 + attr.敏捷修正) / 2) + bonus.防御DC;

        const formTag = formActive ? `[形态:${char.当前形态.名称}]` : '[血统]';
        // console.log(
        //     `[属性重算] ${label} ${formTag}: ` +
        //     `五维={力${finalBase.力量}/敏${finalBase.敏捷}/体${finalBase.体质}/精${finalBase.精神}/魅${finalBase.魅力}} ` +
        //     `HP=${char.HP}/${newMaxHP} EP=${char.EP}/${newMaxEP} ` +
        //     `无武装ATK=${unarmedATK} MATK=${unarmedMATK} 武器x${weapons.length} ` +
        //     `DEF=${attr.DEF}(+${bonus.DEF}) ` +
        //     `先攻=${attr.先攻DC}(+${bonus.先攻DC}) 防御=${attr.防御DC}(+${bonus.防御DC})` +
        //     (Number.isFinite(modifierCap) ? '' : '(位格未命中,修正不限)')
        // );
    }

    /**
     * 主角普升检测：按最终五维属性值在【当前生命层级】内的相对段位判定，五维累计≥24 → 是否可试炼=true
     *   - 单维分：取主角当前层级(Ⅰ~Ⅸ)对应的 LIFE_TIER_RANGE [lo,hi]，9 等分为 F~SSS 九段
     *     属性值落在第几段 → 段位分(F=1, E=2 … SSS=9)，与 qualitySegValue 分段逻辑对齐
     *   - 低于当前层级下限(lo) → 保底 F=1 分（属性过低但仍给基础分，非 0 分）
     *     例：层级Ⅲ范围[100,299]，魅力=20 < 100 → 判 F=1 分
     *   - 阈值 24：五维满分 45(5×9)，24 ≈ 五维均达当前层级 B 段(5分)以上方可试炼
     *   - 进阶后新层级范围更大、属性需重新达标；属性下降导致累计<24 → 立即置 false
     *   - 仅作用于主角(系统状态.是否可试炼)，NPC 无此机制
     * @param {object} hero 主角对象
     * @param {object} sys 系统状态对象
     */
    const TRIAL_SCORE_THRESHOLD = 24;
    /**
     * 单维属性值 → 当前层级下的段位分(F=1 … SSS=9)
     *   取当前层级 LIFE_TIER_RANGE [lo,hi]，9 等分；属性值落在第几段即该段分
     *   低于 lo 保底 1 分(F)；达到/超过 hi 满分 9 分(SSS)
     * @param {number} val 单维最终属性值
     * @param {string} lifeTier 当前生命层级(Ⅰ~Ⅸ)
     * @returns {number} 段位分 1~9
     */
    function attrTierScore(val, lifeTier) {
        const v = safeNum(val, 0);
        const lt = normalizeLifeTier(lifeTier);
        const range = LIFE_TIER_RANGE[lt];
        if (!range) return 1; // 层级无效，保底 1 分
        const lo = range[0], hi = range[1];
        // 低于当前层级下限 → 保底 F=1 分
        if (v < lo) return 1;
        // 层级 Ⅸ 上限为 Infinity：无法直接 9 等分，用下限的 10 倍(100万)作分段上限基准
        //   逻辑：Ⅸ 是半神层级，单维 100万 视为该层级满档(SSS)；超过则封顶 9 分
        const effectiveHi = Number.isFinite(hi) ? hi : lo * 10;
        // 达到或超过上限 → 满分 SSS=9
        if (v >= effectiveHi) return 9;
        // [lo, effectiveHi] 内 9 等分，判定落在第几段（与 qualitySegValue 的 w=floor(span/9) 对齐）
        const span = Math.max(1, effectiveHi - lo);
        const w = Math.max(1, Math.floor(span / 9));
        const segIdx = Math.min(8, Math.floor((v - lo) / w));
        return segIdx + 1;
    }
    function checkTrialEligibility(hero, sys) {
        if (!hero || !sys) return;
        const attr = hero.最终属性;
        if (!attr || typeof attr !== 'object') return;
        const lifeTier = hero.层级;
        let total = 0;
        ATTR_NAMES.forEach(a => { total += attrTierScore(attr[a], lifeTier); });
        const eligible = total >= TRIAL_SCORE_THRESHOLD;
        if (sys.是否可试炼 !== eligible) {
            sys.是否可试炼 = eligible;
            // console.log(`[普升检测] 主角层级=${lifeTier} 五维段位累计=${total} (阈值${TRIAL_SCORE_THRESHOLD}) → 是否可试炼=${eligible}`);
        }
    }

    /** 遍历主角 + 全部NPC，逐个重算（后台全量计算，与是否在场无关） */
    function recalcAllCharacters(statData, statDataBefore) {
        if (!statData) return;
        // 主角
        if (statData.主角) {
            recalcCharacter(statData.主角, '主角', statDataBefore?.主角);
        }
        // 关系列表全部NPC（不在场也需重算属性，供面板查阅；是否展示给AI由变量可见性控制）
        const rel = statData.关系列表;
        const relBefore = statDataBefore?.关系列表;
        if (rel && typeof rel === 'object') {
            Object.entries(rel).forEach(([name, npc]) => {
                if (!npc || typeof npc !== 'object') return;
                const npcBefore = (relBefore && typeof relBefore === 'object') ? relBefore[name] : null;
                recalcCharacter(npc, `NPC:${name}`, npcBefore);
            });
        }
    }

    /** 真实游玩天数推进: 世界.时间 的日期(年月日)每变动一次 → 系统状态.游玩天数+1 (单调递增, 免疫副本时间跳跃/回退) */
    function updatePlayDays(statData) {
        const worldTime = statData?.世界?.时间;
        const sys = statData?.系统状态;
        if (!sys || !worldTime) return;

        const DATE_RE = /(\d+)\s*年\s*-?\s*(\d+)\s*月\s*-?\s*(\d+)\s*日/;
        const m = String(worldTime).match(DATE_RE);
        if (!m) return;

        // 规范化日期锚点: 仅取年月日(忽略"清晨/傍晚"等时辰, 同一游戏日内多次更新不重复计数)
        const dateKey = `${+m[1]}-${+m[2]}-${+m[3]}`;
        const lastDate = String(sys.上次世界日期 || '');

        if (!lastDate) {
            // 首次初始化: 开局即第1天
            sys.游玩天数 = 1;
        } else if (lastDate !== dateKey) {
            // 日期变动(跨日/进副本/出副本均计1天)
            sys.游玩天数 = Number(sys.游玩天数 || 0) + 1;
        }
        sys.上次世界日期 = dateKey;
    }

    /** 资产全自动收菜系统 (改由 系统状态.游玩天数 轴驱动, 免疫副本时间跳跃) */
    function autoHarvestAssets(statData, statDataBefore) {
        const assets = statData?.资产;
        const worldTime = statData?.世界?.时间;
        const sys = statData?.系统状态;
        if (!assets || typeof assets !== 'object' || !worldTime || !sys) return;

        const playDays = Number(sys.游玩天数 || 0);
        if (!(playDays > 0)) return; // 游玩天数未初始化(需先经 updatePlayDays 推进)

        // 简化历法: 每年365天, 每月30天; 天数与日期互转 (仅用于"下次产出日期"展示换算)
        const DAY_OF_YEAR = 365, DAY_OF_MONTH = 30;
        const toDays = (y, m, d) => y * DAY_OF_YEAR + (m - 1) * DAY_OF_MONTH + (d - 1);
        const fromDays = (n) => ({
            y: Math.floor(n / DAY_OF_YEAR),
            m: Math.floor((n % DAY_OF_YEAR) / DAY_OF_MONTH) + 1,
            d: (n % DAY_OF_YEAR) % DAY_OF_MONTH + 1,
        });
        const pad2 = (v) => (v < 10 ? '0' + v : String(v));
        const fmtDate = (n) => { const t = fromDays(n); return `${t.y}年${pad2(t.m)}月${pad2(t.d)}日`; };
        const DATE_RE = /(\d+)\s*年\s*-?\s*(\d+)\s*月\s*-?\s*(\d+)\s*日/;

        // 解析世界时间: "2026年-06月-23日-清晨"
        const timeMatch = String(worldTime).match(DATE_RE);
        if (!timeMatch) return;
        const currentDays = toDays(+timeMatch[1], +timeMatch[2], +timeMatch[3]);

        // 展示换算: 游玩天数轴第 n 天 → 以当前世界日期为基准的历法日期(仅供查看)
        const fmtByPlay = (n) => fmtDate(currentDays + (n - playDays));

        Object.entries(assets).forEach(([assetName, asset]) => {
            if (!asset || !asset.建设序列) return;
            if (!Array.isArray(asset.待办事件)) asset.待办事件 = [];

            Object.entries(asset.建设序列).forEach(([seqName, seq]) => {
                if (!seq) return;

                // 旧字段迁移①: 上次产出天数(旧式天数 = y*365+m*30+d, 与新式差31) → 下次产出日期(旧值+7天周期)
                if (seq.下次产出日期 === undefined && seq.上次产出天数 !== undefined) {
                    const legacy = Number(seq.上次产出天数);
                    if (Number.isFinite(legacy) && legacy > 0) {
                        seq.下次产出日期 = fmtDate(legacy - 31 + 7);
                    }
                    delete seq.上次产出天数;
                }

                if (!seq.产出 || seq.产出 === '无' || seq.产出 === '待定') return;

                // 锚点维护: 下次产出游天 = 游玩天数轴上的产出日 (脚本自动维护, 对AI不可见)
                const seqBefore = statDataBefore?.资产?.[assetName]?.建设序列?.[seqName];
                // 外部编辑检测: AI结算刷新/悬浮球手动改写了"下次产出日期" → 以新日期重新锚定游天轴
                const extEdited = seqBefore
                    && String(seqBefore.下次产出日期 || '') !== String(seq.下次产出日期 || '');
                let nextPlay = Number(seq.下次产出游天);
                if (!Number.isFinite(nextPlay) || nextPlay <= 0) {
                    // 首次初始化/旧数据迁移: 有旧日期 → 按剩余天数平移到游天轴(负值=已欠收, 保留份额); 无旧值 → 7天后产出
                    const nextMatch = String(seq.下次产出日期 || '').match(DATE_RE);
                    nextPlay = nextMatch
                        ? playDays + (toDays(+nextMatch[1], +nextMatch[2], +nextMatch[3]) - currentDays)
                        : playDays + 7;
                } else if (extEdited) {
                    // 新日期合法 → 平移锚点; 非法(被清空) → 重置为7天后
                    const reMatch = String(seq.下次产出日期 || '').match(DATE_RE);
                    nextPlay = reMatch
                        ? playDays + (toDays(+reMatch[1], +reMatch[2], +reMatch[3]) - currentDays)
                        : playDays + 7;
                }
                seq.下次产出游天 = nextPlay;

                const cycle = 7; // 默认7天一收菜

                if (playDays >= nextPlay) {
                    const daysPassed = playDays - nextPlay;
                    const harvestCount = Math.floor(daysPassed / cycle) + 1;
                    const todoMsg = `【自动收菜】${assetName}-${seqName} 经过了${daysPassed}天，产出了：${seq.产出} (共${harvestCount}份，请查收并清空此条待办)`;

                    // 避免重复推送
                    if (!asset.待办事件.includes(todoMsg)) {
                        asset.待办事件.push(todoMsg);
                        // console.log(`[资产收菜] 触发：${todoMsg}`);
                    }

                    // 刷新下次产出游天(按周期滚动, 必然晚于今天)
                    seq.下次产出游天 = nextPlay + harvestCount * cycle;
                }

                // 同步展示字段"下次产出日期"(以当前世界日期为基准换算)
                seq.下次产出日期 = fmtByPlay(seq.下次产出游天);
            });
        });
    }

    // ===== 模块 2：护甲收益递减 (对数防御曲线 - 动态层级适配版) =====
    const REDUCTION_CAP = 75; // 最高减伤 75%
    const ALPHA = 16;
    const LOG_DEN = Math.log(1 + ALPHA); // ln(17)

    /**
     * 【核心修复】：各阶位对应的理论满防值（防具上限 + 体质换算上限）
     * 来源依据：对照你的《品质效果数值规则》各阶位五维总和与防御阈值推算
    */ 
    const TIER_DEF_SCALE = {
        'Ⅰ': 70,       // F级萌新满防基准
        'Ⅱ': 200,       // E级满防基准
        'Ⅲ': 480,      // D级
        'Ⅳ': 1280,      // C级
        'Ⅴ': 3300,     // B级
        'Ⅵ': 9200,     // A级
        'Ⅶ': 24000,    // S级
        'Ⅷ': 70000,   // SS级
        'Ⅸ': 150000  // SSS级半神满防基准
    };

    /** 传入防御总值与角色当前层级 */
    function calcReduction(defenseValue, tier) {
        // 获取当前阶位的满防基准（兜底为E级）
        const fullScale = TIER_DEF_SCALE[tier] || TIER_DEF_SCALE['E'];
        const defense = Math.max(0, safeNum(defenseValue, 0));
        
        // 计算当前防御在当前阶位下的比例
        const scale = defense / fullScale;
        
        // 带入对数递减公式
        const rawReduction = REDUCTION_CAP * Math.log(1 + ALPHA * scale) / LOG_DEN;
        
        // 限制最高不得超过 75%
        return Math.min(REDUCTION_CAP, Math.round(rawReduction)); 
    }

    /** 伴生神器自动成长 */
    function processArtifactGrowth(char) {
        if (!char || !char.装备) return;
        
        // 假设伴生神器的装备标签为 "伴生神器" 或 "可成长"，在装备列表中查找
        const artifact = Object.values(char.装备).find(e => e.标签?.includes("伴生神器") || e.标签?.includes("可成长"));
        
        if (!artifact) return;

        const currentTier = char.层级; // F ~ SSS
        const oldTier = artifact.品质;

        // 如果神器品质已经等于主角层级，则不需要成长
        if (oldTier === currentTier) return;

        // 装备品质自动对齐主角位格
        artifact.品质 = currentTier;
        
        // 动态重写特效与属性
        if (!artifact.效果) artifact.效果 = {};
        if (!artifact.原始属性) artifact.原始属性 = {};

        // 根据不同层级解锁词条 (像修仙小说的本命法宝解封一样)
        switch(currentTier) {
            case 'E':
                artifact.效果['真名初现'] = "攻击时额外造成小幅灵魂震荡";
                artifact.原始属性['ATK'] = 50;
                break;
            case 'C':
                artifact.效果['火之高兴'] = "无视目标 20% 物理减伤率";
                artifact.原始属性['ATK'] = 500;
                break;
            case 'A':
                artifact.效果['焚天'] = "每次攻击附带基于目标最大HP 5% 的真实灼烧";
                artifact.原始属性['ATK'] = 3000;
                break;
            case 'SSS':
                artifact.效果['概念级·初火'] = "绝对必中，且击杀目标后直接抹除其在世界法则中的因果";
                artifact.原始属性['ATK'] = 50000;
                break;
        }
        
        // console.log(`[神器成长] 伴生神器已随主角突破！当前品质: ${currentTier}`);
    }

    /** 功法/熟练度 溢出进阶守卫 */
    function guardProficiency(char) {
        if (!char || !char.技能) return;
        
        // 设定阶位升阶门槛
        const TIER_THRESHOLDS = { '入门': 100, '熟练': 300, '精通': 1000, '宗师': 5000, '化境': Infinity };
        const TIER_ORDER = Object.keys(TIER_THRESHOLDS);

        Object.entries(char.技能).forEach(([skillName, skill]) => {
            // 假设通过“熟练度”字段来控制
            if (skill.熟练度 === undefined || skill.掌握程度 === undefined) return;

            let currentExp = safeNum(skill.熟练度, 0);
            let currentTier = skill.掌握程度; // 比如 "入门"
            
            let threshold = TIER_THRESHOLDS[currentTier] || Infinity;

            // 如果熟练度溢出，自动进阶
            while (currentExp >= threshold && threshold !== Infinity) {
                currentExp -= threshold; // 扣除门槛，保留溢出
                
                const nextIndex = TIER_ORDER.indexOf(currentTier) + 1;
                currentTier = TIER_ORDER[nextIndex];
                threshold = TIER_THRESHOLDS[currentTier];
                
                // console.log(`[功法突破] 恭喜！${skillName} 突破至 ${currentTier}！`);
                
                // 进阶时自动增强技能伤害系数
                if (skill.效果 && skill.效果['基础伤害倍率']) {
                    skill.效果['基础伤害倍率'] = (parseFloat(skill.效果['基础伤害倍率']) + 0.5) + "x";
                }
            }

            // 写回数据
            skill.掌握程度 = currentTier;
            skill.熟练度 = currentExp;
            skill.升阶阈值 = threshold;
        });
    }

    /** 物品数量归零清理 */
    function cleanupZeroQuantityItems(char) {
        if (!char || !char.道具) return;
        Object.keys(char.道具).forEach(itemName => {
            const item = char.道具[itemName];
            // 只要数量 <= 0，或者字段缺失，立刻删除
            if (item && (item.数量 === undefined || item.数量 === null || item.数量 <= 0)) {
                delete char.道具[itemName];
                console.log(`[道具清理] 物品 "${itemName}" 数量归零，已自动删除。`);
            }
        });
    }

    /** 状态回合衰减与过期清理 */
    function processStatusDuration(char, isCombat) {
        if (!char || !char.状态) return;
        const statusesToRemove = [];
        
        Object.entries(char.状态).forEach(([statusName, statusData]) => {
            if (!statusData || typeof statusData.持续 !== 'string') return;
            
            // 仅在战斗中，处理带有“回合”字样的状态倒计时
            if (isCombat && statusData.持续.includes('回合')) {
                let rounds = parseInt(statusData.持续);
                if (!isNaN(rounds) && rounds > 0) {
                    rounds -= 1; // 回合数 -1
                    if (rounds <= 0) {
                        statusesToRemove.push(statusName);
                    } else {
                        // 更新回字符串，例如 "2回合"
                        statusData.持续 = `${rounds}回合`;
                    }
                }
            }
            // 非战斗状态的持续时间（如"3天"或"直至被净化"）留给 AI 在剧情中判断
        });
        
        // 集中删除到期的状态
        statusesToRemove.forEach(name => {
            delete char.状态[name];
            console.log(`[状态清理] ${char.名称 || '角色'} 的状态 [${name}] 已到期，后台自动移除。`);
        });
    }

    /** 死亡 NPC 清理 (防误删强化版) */
    function cleanupDeadNPCs(statData) {
        if (!statData || !statData.关系列表) return;
        Object.keys(statData.关系列表).forEach(npcName => {
            const npc = statData.关系列表[npcName];
            if (!npc) return;
            
            // 1. 终极保护伞：如果是队友，或者好感度 > 30，绝对不删（为复活道具/技能保留肉体）;在场的不处理
            const isTeammate = npc.是否队友 === true;
            const highAffinity = typeof npc.好感度 === 'number' && npc.好感度 > 30;
            const isPresent = npc.在场 === true;
            if (isTeammate || highAffinity || isPresent) {
                return; // 直接跳过，免受清理
            }

            // 2. 智能死亡判定
            // 判断条件 A：HP 归零，并且状态里没有“濒死”二字
            const isHpZero = (typeof npc.HP === 'number' && npc.HP <= 0);
            // 遍历状态名，防止 AI 起名字叫“严重濒死”之类的
            const isDying = npc.状态 && Object.keys(npc.状态).some(key => key.includes('濒死')); 
            const isHpDead = isHpZero && !isDying;
            
            // 判断条件 B：AI 直接在状态里明确写了包含“死亡”的词汇（双重保险）
            const isExplicitlyDead = npc.状态 && Object.keys(npc.状态).some(key => key.includes('死亡'));

            // 3. 满足任意死亡条件，且没有保护伞，直接从内存中抹除
            if (isHpDead || isExplicitlyDead) {
                delete statData.关系列表[npcName];
                console.log(`[阵亡清理] 敌对或路人 NPC "${npcName}" 已确认死亡（无复活价值），后台自动移除。`);
            }
        });
    }

    /** 世界稳定值自动推演 */
    function calcWorldStability(statData) {
        if (!statData || !statData.世界 || !statData.世界.因果轨道 || statData.设置.世界超稳) return;
        const records = statData.世界.因果轨道.偏移记录;
        
        let totalOffset = 0;
        if (records && typeof records === 'object') {
            Object.values(records).forEach(record => {
                if (record && typeof record.影响程度 === 'number') {
                    totalOffset += record.影响程度;
                }
            });
        }
        
        // 稳定值: 基础 100 + 偏移记录累加值, 上下限 [0, 120]
        //   - 上限 120: 防止正偏移(利好事件)溢出突破系统上限
        //   - 下限 0: 防止负偏移(灾难事件)穿透至负值
        const STABILITY_MIN = 0, STABILITY_MAX = 120;
        const newStability = Math.max(STABILITY_MIN, Math.min(STABILITY_MAX, 100 + totalOffset));

        if (statData.世界.稳定 !== newStability) {
            console.log(`[世界法则] 稳定值重算: 100 + ${totalOffset}(偏移总和) = ${newStability} (限幅[${STABILITY_MIN},${STABILITY_MAX}])`);
            statData.世界.稳定 = newStability;
        }
    }

    /** 战斗轮次与技能冷却全自动管理 */
    function processCombatAndCooldowns(statData, statDataBefore) {
        // ★ UI 来源守卫: 若本次 VARIABLE_UPDATE_ENDED 由悬浮球UI操作(穿脱装备/道具/激活形态/进阶)触发, 跳过轮次推进+冷却递减
        //   避免反复穿脱导致战斗轮次+1 / 形态冷却-1 / 回合制状态-1; 属性重算等其他模块不受影响, 照常执行
        //   标志读取逻辑已提取为公共函数 isUIMutationActive()(主窗口多级 fallback)
        if (isUIMutationActive()) {
            // console.log('[战斗系统] 检测到本次更新来自UI操作(__samsaraUIMutation), 跳过轮次推进与冷却递减');
            return;
        }
        const combat = statData?.系统状态;
        const combatBefore = statDataBefore?.系统状态;
        if (!combat) return;

        let deltaRound = 0;
        let isCombatNow = combat.是否战斗中 === true;
        const wasCombatBefore = combatBefore?.是否战斗中 === true;

        // —— 0. 战场敌对存活性检测：无在场存活的敌对 NPC 时强制脱战 ——
        //   敌对定义: 在场 且 非队友 且 好感度<0(仇视及以上敌意)
        //   存活定义: HP>0 且 状态未明确标注“死亡”，且未处于纯濒死无威胁状态
        //   (濒死单位失去意识、无法行动，视为无威胁；只要还有任一“非濒死且存活”的敌对单位，战斗继续)
        function isHostileAlive(npc) {
            if (!npc) return false;
            // 队友 / 好感度非负 → 非敌对
            if (npc.是否队友 === true) return false;
            const affinity = safeNum(npc.好感度, 0);
            if (affinity >= 0) return false;
            // 死亡判定: HP 归零(且非濒死护盾) 或 状态含“死亡”
            const isHpDead = (typeof npc.HP === 'number' && npc.HP <= 0)
                && !(npc.状态 && Object.keys(npc.状态).some(k => k.includes('濒死')));
            const isExplicitlyDead = npc.状态 && Object.keys(npc.状态).some(k => k.includes('死亡'));
            if (isHpDead || isExplicitlyDead) return false;
            // 存活且仍有战斗能力的敌对单位
            return true;
        }

        let hasHostileOnScene = false;
        if (statData.关系列表 && typeof statData.关系列表 === 'object') {
            hasHostileOnScene = Object.values(statData.关系列表).some(npc =>
                npc && npc.在场 !== false && isHostileAlive(npc)
            );
        }

        // 战斗中但现场已无存活敌对单位 → 后台强制脱战，避免 AI 维持空转战斗
        if (isCombatNow && !hasHostileOnScene) {
            // console.log(`[战斗系统] 现场无存活敌对 NPC，后台强制结束战斗`);
            combat.是否战斗中 = false;
            // 让后续“脱战分支”在本帧得以触发，确保冷却/THP 清理协议立即生效
            isCombatNow = false;
        }

        // —— 1. 处理轮次自动递增 ——
        if (isCombatNow) {
            if (!wasCombatBefore) {
                combat.当前轮次 = 1; // 刚进战
                // console.log(`[战斗系统] 进入战斗，当前轮次初始化为 1`);
            } else {
                const beforeRound = safeNum(combatBefore.当前轮次, 1);
                const aiRound = safeNum(combat.当前轮次, 1);
                // 后台强力接管递增，防止 AI 双重加算
                if (aiRound <= beforeRound) {
                    combat.当前轮次 = beforeRound + 1;
                }
                deltaRound = combat.当前轮次 - beforeRound;
                // console.log(`[战斗系统] 轮次推进: ${beforeRound} -> ${combat.当前轮次}`);
            }
        } else {
            combat.当前轮次 = 0;
            // ★ 非战斗: 每条 AI 消息计 1 回合, 形态/状态冷却按回合递减(3回合后归零可重新激活)
            //   原逻辑 deltaRound=999 会让 tickCooldowns 强制清零冷却 → 每条非战斗消息都把冷却重置为 0 → 形态可随时激活/取消
            //   现改为 deltaRound=1: 脱战不清零冷却, 仅每回合 -1(与战斗内一致的倒数节奏); 脱战瞬间 THP 仍清零(见下方 wasCombatBefore 块)
            deltaRound = 1;

            // 仅在“刚刚脱离战斗”的这个瞬间触发清零！
            if (wasCombatBefore) {
                // console.log(`[战斗系统] 离开战斗，触发冷却与护盾(THP)清空协议`);
                
                // 1. 清空主角的临时生命值
                if (statData.主角 && typeof statData.主角.THP !== 'undefined') {
                    statData.主角.THP = 0;
                    // console.log(`[战斗系统] 主角 THP 已脱战归零`);
                }

                // 2. 清空所有NPC的临时生命值
                //    注意：本帧 recalc 已跑完；群体单位 THP 会被清掉后需同帧按数量重灌
                if (statData.关系列表) {
                    Object.entries(statData.关系列表).forEach(([npcName, npc]) => {
                        if (!npc || npc.在场 === false) return;
                        if (typeof npc.THP !== 'undefined') npc.THP = 0;
                        // 群体：THP 清零后按当前数量重灌（人数已在战斗中被 THP 反推过，不回满人数）
                        const qty = Math.max(1, Math.floor(safeNum(npc.数量, 1)));
                        if (qty > 1) {
                            const maxHp = Math.max(1, safeNum(npc.HP_MAX, 1));
                            const pool = maxHp * (qty - 1);
                            npc.THP = pool;
                            // console.log(`[战斗系统] 群体 NPC:${npcName} 脱战重灌 THP=${pool} (数量=${qty})`);
                        }
                    });
                }
            }
        }

        // —— 2. 冷却递减逻辑引擎 ——
        function tickCooldowns(actor, actorBefore, label) {
            if (!actor) return;
            
            const processDict = (dict, dictBefore) => {
                if (!dict) return;
                Object.entries(dict).forEach(([name, item]) => {
                    if (!item || typeof item.冷却 !== 'string') return;
                    
                    const oldItem = dictBefore?.[name];
                    const oldCdStr = oldItem?.冷却 || "0";
                    const newCdStr = item.冷却;
                    
                    // 解析字符串，例如 "2/3 回合" 提取出 cur=2, max=3
                    const parseCD = (str) => {
                        if (!str || str === "0") return { cur: 0, max: 0 };
                        const m = str.match(/^(\d+)\s*\/\s*(\d+)/);
                        if (m) return { cur: parseInt(m[1]), max: parseInt(m[2]) };
                        return { cur: 0, max: 0 };
                    };

                    const oldCD = parseCD(oldCdStr);
                    const newCD = parseCD(newCdStr);

                    if (newCD.max === 0) return; // 0/0的无CD技能直接跳过

                    // 【神级拦截】：如果 AI 刚把当前冷却拉高（即本回合释放了该技能），则本回合绝不扣减！
                    if (newCD.cur > oldCD.cur && isCombatNow) {
                        // console.log(`[冷却系统] ${label} 刚释放了 [${name}]，冷却已置为 ${newCdStr}，本轮不扣减。`);
                        return;
                    }

                    // 开始随轮次扣减
                    let finalCur = newCD.cur;
                    if (deltaRound === 999) {
                        finalCur = 0; // (保留兼容)显式脱战清零信号: 当前调用方已不传 999
                    } else if (deltaRound > 0) {
                        finalCur = Math.max(0, newCD.cur - deltaRound);
                    }

                    // 写回标准格式
                    const finalStr = finalCur === 0 ? "0" : `${finalCur}/${newCD.max} 回合`;
                    if (item.冷却 !== finalStr) {
                        // console.log(`[冷却系统] ${label} 的 [${name}] 冷却倒数: ${item.冷却} -> ${finalStr}`);
                        item.冷却 = finalStr;
                    }
                });
            };

            // 遍历技能库和形态库
            // processDict(actor.技能, actorBefore?.技能);
            processDict(actor.形态库, actorBefore?.形态库);
        }

        // 执行主角的冷却递减
        tickCooldowns(statData.主角, statDataBefore?.主角, "主角");
        // 执行在场 NPC 的冷却递减
        if (statData.关系列表) {
            Object.entries(statData.关系列表).forEach(([npcName, npc]) => {
                if (npc.在场 !== false) {
                    tickCooldowns(npc, statDataBefore?.关系列表?.[npcName], `NPC:${npcName}`);
                }
            });
        }
    }

    // 结算清理：消息级防重入，避免同一条 AI 消息多次渲染（编辑/重生成/分页）导致重复清算
    let clearedMessageId = -1;

    // 处理最新正文内容
    function onCharacter(messageId) {
        // messageId 就是最新这条 AI 消息在 chat 数组中的索引
        const lastMsg = context.chat[messageId];

        // 排除用户消息或系统消息
        if (lastMsg && !lastMsg.is_user && !lastMsg.is_system) {
            const aiText = lastMsg.mes; // 这就是 AI 最新返回的纯文本正文

            onShouldIAdvance(aiText, messageId);
            onClearCache(aiText, messageId);
            
            clearedMessageId = messageId;
        }
    }

    function hasReadyTrialTask(statData) {
        const taskList = statData && statData.任务 && statData.任务.列表 && typeof statData.任务.列表 === 'object'
            ? statData.任务.列表
            : {};
        const trialTasks = Object.values(taskList).filter(task => task
            && String(task.委托方 || '').trim() === '晋升试炼');
        return trialTasks.length > 0
            && trialTasks.every(task => String(task.状态 || '').trim() === '可结算');
    }

    // 结算判断是否取得晋升资格：只认数据库中全部到达【可结算】的专用晋升试炼任务。
    // 禁止再用正文中的“资格/试炼任务”等宽泛关键词，避免普通结算误触发。
    function onShouldIAdvance(aiText, messageId) {
        const keywords = ["轮回清算协议"];
        const isSettlement = keywords.every(kw => aiText.includes(kw)); // 全部命中才触发
        const isPass = hasReadyTrialTask(getStatData() || {});

        if (isSettlement && isPass && messageId !== clearedMessageId) {
            // ★ 本回调(CHARACTER_MESSAGE_RENDERED)不在 VARIABLE_UPDATE_ENDED 流程内，
            //   getStatData() 返回的 stat_data 不保证是 MVU 主存储的同一引用对象，
            //   原地改字段不会落库。必须走 writeBackMvu → Mvu.replaceMvuData 正式写回
            //   message/chat 通道才能持久化到数据库。
            //   clearedMessageId 防重入已保证同一条消息只写回一次，无 schema reconciliation 风险。
            const ok = writeBackMvu(function (sd) {
                if (!sd) return;
                const sys = sd.系统状态 = sd.系统状态 || {};
                if (sys.是否可试炼 === true && sys.试炼已完成 === false) {
                    sys.试炼已完成 = true;
                }
            });
            if (!ok) {
                console.warn('[辅助计算脚本] 试炼完成标记写回失败');
            }
        }
    }

    // 结算清除副本资料
    function onClearCache(aiText, messageId) {
        // 必须同时命中全部结算阶段标题，才判定为一次完整的世界清算面板输出
        // 用 every 而非 some，避免 AI 在闲聊/旁白中复述单个标题导致整盘数据被静默重置
        const keywords = ["轮回清算协议", "世界因果与综合评估", "因果烙印与干涉回放", "因果演进与世界暗流"];
        const isSettlement = keywords.every(kw => aiText.includes(kw));
        // 在清空任务前预先锁定试炼结果，并在同一次写回中落库，避免连续异步写回互相覆盖。
        const shouldCompleteTrial = isSettlement && hasReadyTrialTask(getStatData() || {});
        console.log(`[结算清理] 是否结算: ${isSettlement}`,messageId !== clearedMessageId)
        if (isSettlement && messageId !== clearedMessageId) {
            // ★ 本回调(CHARACTER_MESSAGE_RENDERED)不在 VARIABLE_UPDATE_ENDED 流程内，
            //   getStatData() 返回的 stat_data 不保证是 MVU 主存储的同一引用对象，
            //   原地改字段不会落库。必须走 writeBackMvu → Mvu.replaceMvuData 正式写回
            //   message/chat 通道才能持久化到数据库。
            //   clearedMessageId 防重入已保证同一条消息只写回一次，无 schema reconciliation 风险。
            const ok = writeBackMvu(function (sd) {
                if (!sd) return;
                console.log(`[数据]${sd}`,sd)
                const isSingleWorld = sd.设置 && sd.设置.单一世界 === true;
                if (shouldCompleteTrial) {
                    sd.系统状态 = sd.系统状态 || {};
                    sd.系统状态.试炼已完成 = true;
                }
                // 1. 基础数据重置
                sd.任务 = sd.任务 || {};
                sd.任务.击杀 = {Ⅰ:0, Ⅱ:0, Ⅲ:0, Ⅳ:0, Ⅴ:0, Ⅵ:0, Ⅶ:0, Ⅷ:0, Ⅸ:0};
                sd.世界 = sd.世界 || {};
                sd.世界.探索 = {};
                // 2. 根据模式执行深度清理
                if (!isSingleWorld) {
                    // 完整世界清算：全量格式化
                    sd.世界.势力 = {};
                    sd.世界.稳定 = 100;
                    sd.世界.异端雷达 = sd.世界.异端雷达 || {};
                    sd.世界.异端雷达.当前模式 = '';
                    sd.世界.异端雷达.名单 = {};
                    sd.世界.法则 = [];
                    sd.世界.货币 = {};
                    sd.世界.因果轨道 = {};
                    sd.任务.列表 = {};
                    sd.任务.副本成就 = {}; // 副本成就绑定当前副本世界, 完整清算时一并清空
                    sd.传闻 = sd.传闻 || {};
                    sd.传闻.街头巷议 = {};
                    sd.传闻.情报交易 = {};
                    sd.传闻.布告与檄文 = {};

                    sd.世界.名称 = '主神空间';
                    sd.世界.位格 = 'Ⅸ';
                    sd.世界.难度 = 'F~SSS';
                    sd.系统状态 = sd.系统状态 || {};
                    sd.系统状态.是否在主神空间 = true;
                } else {
                    // 单一世界：精准遍历，仅安全移除【可结算】和【失败】任务，保留进行中
                    if (!sd.任务.列表) sd.任务.列表 = {};
                    const taskList = sd.任务.列表;
                    for (const taskKey in taskList) {
                        const taskStatus = taskList[taskKey] && taskList[taskKey].状态;
                        if (taskStatus === '可结算' || taskStatus === '失败') {
                            delete taskList[taskKey]; // 原生 JS 删除键值
                        }
                    }
                }
            });
            if (!ok) {
                console.warn('[辅助计算脚本] 结算清理写回失败');
            }
        }
    }

    const context = SillyTavern.getContext();
    const { eventSource, eventTypes } = context;

    // 初始化事件注册
    const init = async () => {
        await waitGlobalInitialized('Mvu');
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdateData);
        eventSource.on(eventTypes.CHARACTER_MESSAGE_RENDERED, onCharacter);
        try { (window.parent || window).__辅助计算脚本_loaded__ = true; } catch(e) { window.__辅助计算脚本_loaded__ = true; }
        // console.log('[辅助计算脚本] 脚本已加载 ');
        toastr.success('[辅助计算脚本] 脚本已加载 ');
    };

    $(init);

})();
