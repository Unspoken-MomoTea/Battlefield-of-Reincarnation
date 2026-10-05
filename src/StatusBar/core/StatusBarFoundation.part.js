/* * ==========================================================================
 * [轮回空间] 主神终端系统 UI (Samsara Destiny UI) v2
 * 重构特性：
 *   - 多主题换肤(暗夜/绯红/靛蓝/羊皮纸) 通过 data-theme + CSS变量
 *   - 数据编辑模式(行内编辑器→赋值回MVU: replaceMvuData)
 *   - 顶栏(时间地点 + 刷新/设置/关闭) + 中部(头像/名称/层级 + HP/EP/THP) + 底部状态图标条
 *   - 左侧Tab(任务/信息/持有/血统/关系/经营/传闻/世界) + 右侧内容
 *   - 弹窗式状态详情与物品详情
 *   - 全量字段渲染覆盖ZOD Schema
 * ==========================================================================
 */
(function () {
    'use strict';
    var STATUS_BAR_VERSION = '1.0.1';
    try { console.log('%c[主神终端] ⚡ 轮回终端 v2 接入中...', 'color:#8f9fff;font-weight:bold'); } catch (e) {}

    /* ===== 1. 父窗口重定向 ===== */
    var GS_PARENT = (function () {
        try { if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) return window.parent; } catch (e) {}
        try { if (window.top && window.top !== window && window.top.document && window.top.document.body) return window.top; } catch (e) {}
        return window;
    })();
    var $ = (GS_PARENT.jQuery || GS_PARENT.$ || window.jQuery || window.$);
    var document = GS_PARENT.document;
    var _ = (GS_PARENT._ || window._);

    /* 状态栏运行时生命周期：用于版本诊断与 loader 管理后的安全热重载。 */
    var STATUS_BAR_LOADER = GS_PARENT.SamsaraStatusBarLoader || {};
    class StatusBarRuntimeLifecycle {
        constructor(host, loader) {
            this.host = host;
            this.version = STATUS_BAR_VERSION;
            this.ref = String(loader && loader.ref || '');
            this.sha = String(loader && loader.sha || '');
            this.url = String(loader && loader.url || '');
            this.subscriptions = [];
            this.startedAt = Date.now();
        }
        track(subscription) {
            if (subscription && typeof subscription.stop === 'function') this.subscriptions.push(subscription);
            return subscription;
        }
        stopSubscriptions() {
            var current = this.subscriptions.splice(0);
            for (var i = 0; i < current.length; i++) {
                try { current[i].stop(); } catch (e) {}
            }
        }
    }

    /* 当前酒馆 Persona：状态栏内部与其他 Samsara 模块共用同一份玩家身份。 */
    var PLAYER_NAME = '';
    function refreshPlayerName() {
        try {
            var tavern = GS_PARENT && GS_PARENT.SillyTavern;
            var context = tavern && typeof tavern.getContext === 'function' ? tavern.getContext() : null;
            PLAYER_NAME = String((context && context.name1) || (tavern && tavern.name1) || '').trim();
        } catch (e) {
            PLAYER_NAME = '';
        }
        try {
            GS_PARENT.Samsara = GS_PARENT.Samsara || {};
            GS_PARENT.Samsara.playerName = PLAYER_NAME;
            GS_PARENT.Samsara.getPlayerName = getPlayerName;
            GS_PARENT.Samsara.refreshPlayerName = refreshPlayerName;
        } catch (e2) {}
        return PLAYER_NAME;
    }
    function getPlayerName() {
        return PLAYER_NAME || refreshPlayerName();
    }
    function isPlayerIdentity(value) {
        var text = String(value == null ? '' : value).trim();
        if (!text) return false;
        var playerName = getPlayerName();
        return (!!playerName && text === playerName)
            || text === '<user>'
            || text === '{{user}}'
            || text === '玩家';
    }
    function canonicalPlayerIdentity(value) {
        var text = String(value == null ? '' : value).trim();
        return isPlayerIdentity(text) ? (getPlayerName() || text) : text;
    }
    function displayPlayerIdentity(value) {
        var text = String(value == null ? '' : value).trim();
        return isPlayerIdentity(text) ? (getPlayerName() || '玩家') : text;
    }
    refreshPlayerName();

    /* ===== 2. 状态存储配置 ===== */
    var SAM_CONFIG = {
        pos: 'samsara_ball_pos_v2',
        open: 'samsara_panel_open_v2',
        theme: 'samsara_theme_v2',
        tab: 'samsara_tab_v2',
        edit: 'samsara_edit_v2'
    };

    /* ===== 3. 主题定义 ===== */
    var THEMES = {
        'night':   { name: '暗夜', accent: '#8f9fff', hp: '#e4587d', thp: '#e5c166', ep: '#5d97ff', bg: 'rgba(14,19,32,0.88)', card: 'rgba(22,30,46,0.7)', border: 'rgba(143,159,255,0.28)', text: '#f3f5f8', sub: '#8b95a6', dark: '#07090e' },
        'crimson': { name: '绯红', accent: '#ff5f57', hp: '#ff4757', thp: '#ffa502', ep: '#5b8cff', bg: 'rgba(28,12,16,0.9)', card: 'rgba(46,18,24,0.72)', border: 'rgba(255,95,87,0.3)', text: '#fff0f3', sub: '#b08896', dark: '#0e0406' },
        'indigo':  { name: '靛蓝', accent: '#7c5cff', hp: '#ff6b8a', thp: '#ffd166', ep: '#4dabff', bg: 'rgba(14,16,38,0.9)', card: 'rgba(28,30,58,0.72)', border: 'rgba(124,92,255,0.32)', text: '#eef0ff', sub: '#9094c0', dark: '#06081a' },
        'parchment': { name: '羊皮', accent: '#a8761e', hp: '#c0392b', thp: '#d4a017', ep: '#2c6fbb', bg: 'rgba(245,235,210,0.95)', card: 'rgba(235,222,190,0.8)', border: 'rgba(168,118,30,0.35)', text: '#3a2a14', sub: '#7a6440', dark: '#e8d8b8' },
        'sakura':   { name: '樱白', accent: '#ff80ab', hp: '#e91e63', thp: '#ffb300', ep: '#42a5f5', bg: 'rgba(255,240,245,0.95)', card: 'rgba(255,224,233,0.82)', border: 'rgba(255,128,171,0.36)', text: '#3d1e2a', sub: '#8a6172', dark: '#f7d4e0' },
        'matcha':   { name: '抹茶', accent: '#66bb6a', hp: '#ef5350', thp: '#ffa726', ep: '#26c6da', bg: 'rgba(238,246,232,0.95)', card: 'rgba(224,240,210,0.82)', border: 'rgba(102,187,106,0.34)', text: '#1f3320', sub: '#5a7560', dark: '#d6ecc8' }
    };
    var THEME_ORDER = ['night', 'crimson', 'indigo', 'parchment', 'sakura', 'matcha'];

    /* ===== 4. 受保护(只读)字段定义 ===== */
    var READONLY_PATHS = [
        '角色.HP_MAX', '角色.EP_MAX', '角色.最终属性', '角色.层级',
        '角色.当前形态', '角色.形态库',
        '世界.稳定', '世界.当前轮次', '系统状态.当前轮次'
    ];
    /* 层级阈值表: F→E→D→C→B→A→S→SS→SSS (下限值; 进阶任务才升层级, 故进度条只显示进度不自动升级) */
    var TIER_THRESHOLDS = [
        {tier:'F',   min:0},
        {tier:'E',   min:30},
        {tier:'D',   min:100},
        {tier:'C',   min:300},
        {tier:'B',   min:1000},
        {tier:'A',   min:3000},
        {tier:'S',   min:10000},
        {tier:'SS',  min:30000},
        {tier:'SSS', min:100000}
    ];
    /* 装备穿戴槽位配置: type=装备类型枚举索引, cap=槽位上限(0表示无上限如特殊);
       cap>=2 满则拒绝穿戴; cap===1 穿戴时替换同类型已装备; cap===0 无限制;
       renderEquipSlotsBar 与 handleItemAction 共用此表, 修改上限只需改一处 */
    var EQUIP_SLOTS = [
        {label:'武器', type:0, cap:2},
        {label:'手套', type:1, cap:1},
        {label:'头部', type:2, cap:1},
        {label:'胸部', type:3, cap:1},
        {label:'腿部', type:4, cap:1},
        {label:'鞋子', type:5, cap:1},
        {label:'披风', type:6, cap:1},
        {label:'饰品', type:7, cap:2},
        {label:'世界遗物', type:8, cap:0}
    ];
    /* 道具战术栏槽位上限 */
    var ITEM_SLOT_CAP = 5;
    /* 血统数量上限(与 EQUIP_SLOTS / ITEM_SLOT_CAP 同级常量, 不写入数据库) */
    var BLOODLINE_CAP = 1;
    function isReadonlyPath(path) {
        if (!path) return false;
        // 精确匹配 + 前缀匹配(针对最终属性子字段、NPC层级等)
        for (var i = 0; i < READONLY_PATHS.length; i++) {
            var rp = READONLY_PATHS[i];
            if (path === rp || path.indexOf(rp + '.') === 0) return true;
        }
        // NPC 的 HP_MAX / EP_MAX / 最终属性 / 层级
        if (/^关系列表\.[^.]+\.HP_MAX$/.test(path)) return true;
        if (/^关系列表\.[^.]+\.EP_MAX$/.test(path)) return true;
        if (/^关系列表\.[^.]+\.最终属性/.test(path)) return true;
        if (/^关系列表\.[^.]+\.层级$/.test(path)) return true;
        // 装备/技能的"类型"是数字枚举(武器/胸部/.../主动/被动/特殊), 用户改字符串会导致解析为"未知", 一律只读; (道具的"类型"是字符串, 可编辑)
        if (/\.(装备|技能)\.[^.]+\.类型$/.test(path)) return true;
        return false;
    }

    /* ===== 5. 预清理旧实例 ===== */
    function samPreClean() {
        try {
            var previousRuntime = GS_PARENT.SamsaraStatusBarRuntime;
            if (previousRuntime && typeof previousRuntime.stopSubscriptions === 'function') {
                previousRuntime.stopSubscriptions();
            }
            if ($) {
                $('#samsara-ball, #samsara-panel, #samsara-modal, #samsara-theme-style').remove();
                $(document).off('.sam .samPanel .samBall .samModal');
                $(window).off('.sam');
            }
            if (window.samsaraGuardTimer) {
                clearInterval(window.samsaraGuardTimer);
                window.samsaraGuardTimer = null;
            }
        } catch (e) { console.warn('[主神终端] 预清理失败:', e.message); }
    }
    samPreClean();

    var STATUS_BAR_RUNTIME = new StatusBarRuntimeLifecycle(GS_PARENT, STATUS_BAR_LOADER);
    GS_PARENT.SamsaraStatusBarRuntime = STATUS_BAR_RUNTIME;
    GS_PARENT.Samsara = GS_PARENT.Samsara || {};
    GS_PARENT.Samsara.StatusBarInfo = {
        version: STATUS_BAR_VERSION,
        ref: STATUS_BAR_RUNTIME.ref,
        sha: STATUS_BAR_RUNTIME.sha,
        url: STATUS_BAR_RUNTIME.url,
        startedAt: STATUS_BAR_RUNTIME.startedAt
    };
    function trackStatusBarSubscription(subscription) {
        return STATUS_BAR_RUNTIME.track(subscription);
    }

    /* ===== 6. 获取数据 ===== */
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

    /* ===== 7. 写回MVU(编辑模式保存) ===== */
    /* opts.tierPermit: 角色层级"普升通行证"(罗马数字层级字符串, 如 'Ⅱ')
       仅"开始进阶"按钮传入; 配合 辅助计算脚本 tierPermitAllows() 放行
       replaceMvuData 异步触发的二次 VARIABLE_UPDATE_ENDED 中的层级变化,
       否则异步事件落在 __samsaraUIMutation 窗口期之外, 会被变量守卫当 AI 篡改回滚 → 普升"闪一下又降回" */
    function writeBackMvu(mutator, opts) {
        var tierPermitInstalled = false;
        try {
            var win = getMvuGlobal();
            if (!win || !win.Mvu || typeof win.Mvu.getMvuData !== 'function' || typeof win.Mvu.replaceMvuData !== 'function') {
                console.warn('[主神终端] MVU写回API不可用');
                return false;
            }
            // 获取最新完整数据(含stat_data) —— 作为"更新前"快照(before)
            var mvuData = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
            if (!mvuData || !mvuData.stat_data) { console.warn('[主神终端] 无可写数据'); return false; }
            // 备份"更新前"数据(深拷贝, 供事件回调的 variables_before_update 参数使用)
            var before = (_ && _.cloneDeep) ? _.cloneDeep(mvuData) : JSON.parse(JSON.stringify(mvuData));
            // lodash深拷贝避免直接污染原对象(走replaceMvuData正式通道) —— 作为"更新后"数据(after)
            var cloned = (_ && _.cloneDeep) ? _.cloneDeep(mvuData) : JSON.parse(JSON.stringify(mvuData));
            // 应用修改器(在克隆的新数据上原地改)
            if (typeof mutator === 'function') mutator(cloned.stat_data);
            // 写入前设置晋升通行证，覆盖 replaceMvuData 同步/异步触发的守卫。
            //   replaceMvuData 是异步的, 它自己会再触发一次 VARIABLE_UPDATE_ENDED(不经过本函数),
            //   那次事件里 __samsaraUIMutation 已复位 → 守卫会回滚层级; 通行证覆盖该异步事件
            if (opts && opts.tierPermit) {
                try {
                    var permitObj = (win && typeof win === 'object') ? win : window;
                    permitObj.__samsaraTierPermit = opts.tierPermit;
                    if (GS_PARENT !== permitObj) GS_PARENT.__samsaraTierPermit = opts.tierPermit;
                    try { window.__samsaraTierPermit = opts.tierPermit; } catch(eT1) {}
                    tierPermitInstalled = true;
                } catch(eT2) {}
                // 兜底清除: 20s 后无论消费与否都过期(防止持久残留把守卫豁免变成摆设)
                setTimeout(function() {
                    try {
                        if (win && win.__samsaraTierPermit === opts.tierPermit) win.__samsaraTierPermit = null;
                        if (GS_PARENT.__samsaraTierPermit === opts.tierPermit) GS_PARENT.__samsaraTierPermit = null;
                        if (window.__samsaraTierPermit === opts.tierPermit) window.__samsaraTierPermit = null;
                    } catch(eT3) {}
                }, 20000);
            }
            try {
                GS_PARENT.__samsaraUIMutation = true;
                if (win !== GS_PARENT) win.__samsaraUIMutation = true;
            } catch(e4) { try { window.__samsaraUIMutation = true; } catch(e5){} }
            var pendingWrites = [];
            var rememberWrite = function(result) {
                if (result && typeof result.then === 'function') pendingWrites.push(Promise.resolve(result));
            };
            // 写回 message 通道
            rememberWrite(win.Mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' }));
            // 同步 chat 通道
            try { rememberWrite(win.Mvu.replaceMvuData(cloned, { type: 'chat' })); } catch (e2) {}
            // ★ 关键: 手动广播 VARIABLE_UPDATE_ENDED 事件, 把 (after, before) 传给监听者
            //   这会让"辅助计算脚本"的 onUpdateData(after, before) 跑一遍, 后台重算属性/HP/EP
            //   事件签名见 exported.mvu.d.ts:186 -> (variables, variables_before_update) => void
            // ★ 标记本次更新来源为"UI操作", 供辅助计算脚本跳过战斗轮次推进/冷却递减
            //   辅助计算脚本运行在iframe, 它通过 GS_PARENT(主窗口) 读此标志, 故必须写在 GS_PARENT 上
            //   同时双写到 win(若不同), 保险起见
            try {
                var evtName = win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED;
                if (evtName && typeof win.eventEmit === 'function') {
                    win.eventEmit(evtName, cloned, before);
                } else if (evtName && typeof eventEmit === 'function') {
                    eventEmit(evtName, cloned, before);
                }
            } catch (e3) { console.warn('[主神终端] 广播VARIABLE_UPDATE_ENDED失败:', e3.message); }
            // 同步写回可立即清除；异步 replaceMvuData 可能在 Promise 完成前后再次广播
            // VARIABLE_UPDATE_ENDED，因此 UI 标记必须覆盖完整持久化生命周期，避免形态/穿戴等
            // 本地操作被误判为新正文战斗回合。
            var clearUIMutation = function() {
                try {
                    GS_PARENT.__samsaraUIMutation = false;
                    if (win !== GS_PARENT) win.__samsaraUIMutation = false;
                } catch(e6) { try { window.__samsaraUIMutation = false; } catch(e7){} }
            };
            if (pendingWrites.length) {
                Promise.allSettled(pendingWrites).then(function() {
                    setTimeout(clearUIMutation, 0);
                }, clearUIMutation);
            } else {
                clearUIMutation();
            }
            try { console.log('%c[主神终端] ✅ 数据已写回MVU并广播更新事件', 'color:#86efac'); } catch(e){}
            return true;
        } catch (e) {
            try {
                GS_PARENT.__samsaraUIMutation = false;
                if (win) win.__samsaraUIMutation = false;
                if (tierPermitInstalled && opts && opts.tierPermit) {
                    if (win && win.__samsaraTierPermit === opts.tierPermit) win.__samsaraTierPermit = null;
                    if (GS_PARENT.__samsaraTierPermit === opts.tierPermit) GS_PARENT.__samsaraTierPermit = null;
                    if (window.__samsaraTierPermit === opts.tierPermit) window.__samsaraTierPermit = null;
                }
            } catch (_) {}
            console.error('[主神终端] 写回MVU失败:', e);
            return false;
        }
    }

    /* ===== 8. 工具函数 ===== */
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function safeNum(v, def) { var n = Number(v); return Number.isFinite(n) ? n : (def || 0); }
    function safeStr(v, def) { return (v === null || v === undefined) ? (def || '') : String(v); }
    /* 编辑模式暂存: {path: {val, type}} —— 点击即编辑,失焦/回车暂存,统一保存写回 */
    var pendingEdits = {};
    function stageEdit(path, val, type) {
        if (!path) return;
        pendingEdits[path] = { val: val, type: type || 'text' };
    }
    /* 把处于编辑态的输入框还原为显示态(保留新值并暂存) */
    function flushStagedDisplay($el) {
        if (!$el || !$el.length) return;
        var path = $el.attr('data-path');
        if (!path) return;
        var type = $el.attr('data-type') || 'text';
        var val = $el.is('select') ? $el.val() : $el.val();
        if (type === 'number') { var n = Number(val); val = Number.isFinite(n) ? n : 0; }
        // ★ tags 类型(标签数组): 逗号/顿号分隔输入→拆为数组
        if (type === 'tags') {
            val = String(val).split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean);
            if (/^资产\.[^.]+\.所属对象$/.test(path)) {
                val = val.filter(function(owner, idx, arr){ return owner !== '无主' && arr.indexOf(owner) === idx; });
            }
        }
        // ★ json 类型(嵌套对象): 尝试还原为对象; 非法JSON保留原字符串(ZOD层会拒绝并回退)
        if (type === 'json') {
            var _jt = String(val).trim();
            if (_jt === '') val = {};
            else { try { val = JSON.parse(_jt); } catch(e2) {} }
        }
        // ★ 身份仍为字符串数组(逗号/斜杠分隔输入→拆为数组); 职业已改为「以职业名为键的记录对象」,不再拆分
        if (path.indexOf('.身份') >= 0) {
            val = String(val).split(/[\/,，]/).map(function(s){return s.trim();}).filter(Boolean);
        }
        stageEdit(path, val, type);
        var $wrap = $el.closest('.sam-ed-wrap');
        if (!$wrap.length) { $wrap = $el.wrap('<span class="sam-ed-wrap"></span>').closest('.sam-ed-wrap'); }
        var optsStr = $el.attr('data-opts') || '';
        var disp = editDisplayInnerTyped(val, type);
        $wrap.attr('data-path', path).attr('data-type', type);
        if (optsStr) $wrap.attr('data-opts', optsStr);
        $wrap.removeClass('editing').html(disp + '<span class="sam-ed-ico">✎</span>');
    }
    function editDisplayInner(val) {
        var vs = (val === null || val === undefined) ? '' : (Array.isArray(val) ? val.join(',') : String(val));
        return (vs === '' ? '<span class="sam-ed-ph">空</span>' : esc(vs));
    }
    /* 显示态HTML: 文本 + ✎ 角标, 点击才变输入框(避免变形) */
    function editDisplayInnerTyped(val, type) {
        if (type === 'textarea' || type === 'json') {
            // 多行文本(JSON等): 用 <pre> 保留换行与缩进, 避免被折叠成一行"乱码"
            var vs = (val === null || val === undefined) ? '' : String(val);
            return (vs === '' ? '<span class="sam-ed-ph">空</span>' : '<pre class="sam-ed-pre">'+esc(vs)+'</pre>');
        }
        return editDisplayInner(val);
    }
    function editDisplayHtml(path, val, type, optsStr) {
        var optsAttr = optsStr ? ' data-opts="'+esc(optsStr)+'"' : '';
        var isTa = (type === 'textarea');
        return '<span class="sam-ed-wrap'+(isTa?' pre-wrap':'')+'" data-path="'+esc(path)+'" data-type="'+esc(type||'text')+'"'+optsAttr+'>'
            + '<span class="sam-ed-val">'+editDisplayInnerTyped(val, type||'text')+'</span>'
            + '<span class="sam-ed-ico">'+(isTa?' ✎':'✎')+'</span>'
            + '</span>';
    }
    /* 真正的输入框(仅在点击后插入, 失焦还原) */
    function editRealInputHtml(path, val, type) {
        var v = (val === null || val === undefined) ? '' : String(val);
        if (type === 'textarea' || type === 'json') {
            // 多行(职业JSON等): 较大默认可视行高+等宽字体
            return '<textarea class="sam-edit-input sam-edit-active" data-path="'+esc(path)+'" data-type="'+esc(type)+'" rows="8" style="width:100%;min-height:100px;resize:vertical;font-family:monospace;line-height:1.5;white-space:pre;">'+esc(v)+'</textarea>';
        }
        // tags 类型: 普通文本输入(逗号分隔), 暂存时拆数组
        return '<input class="sam-edit-input sam-edit-active" type="'+esc(type||'text')+'" data-path="'+esc(path)+'" data-type="'+esc(type||'text')+'" value="'+esc(v)+'" />';
    }
    function editRealSelectHtml(path, options, val) {
        var html = '<select class="sam-edit-input sam-edit-active" data-path="'+esc(path)+'" data-type="select">';
        options.forEach(function(o) {
            html += '<option value="'+esc(o)+'"'+(String(o)===String(val)?' selected':'')+'>'+esc(o)+'</option>';
        });
        html += '</select>';
        return html;
    }
    function optsToStr(options) { return (options||[]).map(function(o){return String(o);}).join('|'); }
    function strToOpts(s) { return String(s||'').split('|'); }
    function parseRarity(q) {
        if (!q) return 'E';
        var s = String(q).trim().toUpperCase();
        // 精确匹配 F~SSS 枚举
        if (['F','E','D','C','B','A','S','SS','SSS'].indexOf(s) >= 0) return s;
        // 宽容解析: 兼容 "D级"/"S级"/"SSS级" 等带"级"后缀的变体(多字母档位从长到短匹配, 防止 SSS 被截成 S)
        var m = s.match(/^(SSS|SS|S|A|B|C|D|E|F)\s*级?$/);
        return m ? m[1] : 'E';
    }
    /* 生命层级(Ⅰ~Ⅸ) ↔ 品质字母(F~SSS) 双向映射: 罗马数字用于显示文本, 品质字母用于着色CSS类
       两序列各9档, 一一对应: Ⅰ↔F Ⅱ↔E Ⅲ↔D Ⅳ↔C Ⅴ↔B Ⅵ↔A Ⅶ↔S Ⅷ↔SS Ⅸ↔SSS */
    var TIER_ROMAN = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    var TIER_QUALITY = ['F','E','D','C','B','A','S','SS','SSS'];
    /* 生命层级单维属性加成区间上下限(与辅助计算脚本.LIFE_TIER_RANGE 对齐; 用于段位分判定)
       ★ 仅用于UI段位显示, 实际数值结算/截断在辅助计算脚本中完成 */
    var LIFE_TIER_RANGE = {
        'Ⅰ': [1, 29],     'Ⅱ': [30, 99],     'Ⅲ': [100, 299],
        'Ⅳ': [300, 999],  'Ⅴ': [1000, 2999], 'Ⅵ': [3000, 9999],
        'Ⅶ': [10000, 29999], 'Ⅷ': [30000, 99999], 'Ⅸ': [100000, Infinity]
    };
    /* 进阶试炼阈值: 五维段位分累计 ≥ 24 → 可申请进阶(约五维均达当前层级 B 段以上) */
    var TRIAL_SCORE_THRESHOLD = 24;
    /* 源力灌注普升费用：仅允许当前层级 → 下一层级，且必须消耗对应下一阶权限凭证×1。 */
    var SOURCE_INFUSION_COSTS = {
        'E': 2500,
        'D': 10000,
        'C': 50000,
        'B': 250000,
        'A': 1000000,
        'S': 5000000,
        'SS': 25000000,
        'SSS': 100000000
    };
    /* 规范化生命层级(大层级)为 Ⅰ~Ⅸ; 非法值回落 Ⅰ */
    function normalizeLifeTier(t) {
        var s = String(t || '').trim();
        return TIER_ROMAN.indexOf(s) >= 0 ? s : 'Ⅰ';
    }
    /* 单维属性值 → 当前层级下的段位分(F=1 … SSS=9), 与辅助计算脚本.attrTierScore 逻辑一致
       取当前层级 LIFE_TIER_RANGE [lo,hi], 9 等分; 属性值落在第几段即该段分
       低于 lo 保底 1 分(F); 达到/超过 hi 满分 9 分(SSS)
       层级 Ⅸ 上限 Infinity → 用 lo*10(100万)作分段上限基准 */
    function attrTierScore(val, lifeTier) {
        var v = safeNum(val, 0);
        var lt = normalizeLifeTier(lifeTier);
        var range = LIFE_TIER_RANGE[lt];
        if (!range) return 1;
        var lo = range[0], hi = range[1];
        if (v < lo) return 1;
        var effectiveHi = Number.isFinite(hi) ? hi : lo * 10;
        if (v >= effectiveHi) return 9;
        var span = Math.max(1, effectiveHi - lo);
        var w = Math.max(1, Math.floor(span / 9));
        var segIdx = Math.min(8, Math.floor((v - lo) / w));
        return segIdx + 1;
    }
    /* 段位分(1~9) → 品质字母(F~SSS), 用于显示与着色 */
    function scoreToQuality(score) {
        var i = Math.max(0, Math.min(8, Math.floor(safeNum(score, 1)) - 1));
        return TIER_QUALITY[i];
    }
    /* 计算五维在当前层级下的段位分累计(力量+敏捷+体质+精神+魅力), 用于进阶进度条 */
    function calcTrialScore(fa, lifeTier) {
        var attrs = fa || {};
        var total = 0;
        ['力量','敏捷','体质','精神','魅力'].forEach(function(an) {
            total += attrTierScore(attrs[an], lifeTier);
        });
        return total;
    }
    // SOURCE_INFUSION_CREDENTIAL_START
    /* 权限凭证持有数：只读取角色.权限凭证.<品质>。 */
    function sourceInfusionCredentialQty(reincarnator, credentialGrade) {
        if (!reincarnator || !credentialGrade) return 0;
        var ledger = reincarnator.权限凭证 || {};
        return Math.max(0, Math.floor(safeNum(ledger[credentialGrade], 0)));
    }

    /* 消耗恰好1枚指定品质凭证；凭证为独立数值账本，不再从道具/状态中查找。 */
    function sourceInfusionConsumeCredential(reincarnator, credentialGrade) {
        if (!reincarnator || !credentialGrade) return false;
        reincarnator.权限凭证 = reincarnator.权限凭证 || {};
        var q = Math.max(0, Math.floor(safeNum(reincarnator.权限凭证[credentialGrade], 0)));
        if (q < 1) return false;
        reincarnator.权限凭证[credentialGrade] = q - 1;
        return true;
    }
    // SOURCE_INFUSION_CREDENTIAL_END    /* 统一生成一次“当前层级→下一层级”的源力灌注计划；绝不按凭证品质跳级。 */
    function sourceInfusionPlan(sd, targetName) {
        if (!sd || !sd.角色) return { error:'数据未就绪' };
        var isReincarnator = (targetName === '角色');
        var target = isReincarnator ? sd.角色 : (sd.关系列表 && sd.关系列表[targetName]);
        if (!target) return { error:'未找到目标角色' };
        if (!isReincarnator && target.是否队友 !== true) return { error:'仅队友可使用源力灌注' };
        if (sd.系统状态 && sd.系统状态.是否战斗中 === true) return { error:'请在安全区域内再重新尝试' };
        if (isReincarnator && sd.系统状态 && sd.系统状态.试炼已完成 === true) return { error:'晋升试炼已完成，请直接使用「开始进阶」' };

        var currentTier = normalizeLifeTier(target.层级);
        var idx = TIER_ROMAN.indexOf(currentTier);
        if (idx < 0) idx = 0;
        if (idx >= TIER_ROMAN.length - 1) return { error:'当前已是最高层级' };
        var score = calcTrialScore(target.最终属性 || {}, currentTier);
        if (score < TRIAL_SCORE_THRESHOLD) return { error:'段位累计尚未满足普升要求' };

        var nextTier = TIER_ROMAN[idx + 1];
        var nextGrade = TIER_QUALITY[idx + 1];
        var credentialName = nextGrade + '级权限凭证';
        return {
            isReincarnator: isReincarnator,
            targetName: targetName,
            currentTier: currentTier,
            nextTier: nextTier,
            nextGrade: nextGrade,
            score: score,
            cost: safeNum(SOURCE_INFUSION_COSTS[nextGrade], 0),
            credentialName: credentialName,
            credentialGrade: nextGrade,
            coin: safeNum(sd.角色.空间币, 0),
            credentialQty: sourceInfusionCredentialQty(sd.角色, nextGrade)
        };
    }

    function sourceInfusionFmtNum(v) {
        var n = Math.max(0, Math.floor(safeNum(v, 0)));
        return n.toLocaleString ? n.toLocaleString() : String(n);
    }

    function openSourceInfusion(targetName) {
        targetName = targetName || '角色';
        var first = sourceInfusionPlan(getStatData(), targetName);
        if (first.error) { samToast('warning', first.error); return; }
        var label = first.isReincarnator ? '角色' : first.targetName;
        var body = '目标: '+label+' '+first.currentTier+' → '+first.nextTier+'（'+first.nextGrade+'）'
            +' ｜ 空间币: '+sourceInfusionFmtNum(first.cost)+'（持有 '+sourceInfusionFmtNum(first.coin)+'）'
            +' ｜ 凭证: '+first.credentialName+' ×1（持有 ×'+first.credentialQty+'）'
            +' ｜ 确认后由角色账户支付，并直接完成本次普升。';
        samConfirm('源力灌注 · '+first.currentTier+' → '+first.nextTier, body, function() {
            var latest = sourceInfusionPlan(getStatData(), targetName);
            if (latest.error) { samToast('warning', latest.error); return; }
            if (latest.coin < latest.cost) {
                samToast('warning', '空间币不足：需要 '+sourceInfusionFmtNum(latest.cost));
                return;
            }
            if (latest.credentialQty < 1) {
                samToast('warning', '缺少 '+latest.credentialName+' ×1');
                return;
            }

            var applied = false;
            var opts = latest.isReincarnator ? { tierPermit: latest.nextTier } : undefined;
            var ok = writeBackMvu(function(statData) {
                var check = sourceInfusionPlan(statData, targetName);
                if (check.error || check.nextTier !== latest.nextTier || check.nextGrade !== latest.nextGrade) return;
                if (check.coin < check.cost || check.credentialQty < 1) return;
                var payer = statData.角色;
                var target = check.isReincarnator ? payer : (statData.关系列表 && statData.关系列表[check.targetName]);
                if (!target || (!check.isReincarnator && target.是否队友 !== true)) return;
                if (!sourceInfusionConsumeCredential(payer, check.credentialGrade)) return;
                payer.空间币 = Math.max(0, safeNum(payer.空间币, 0) - check.cost);
                target.层级 = check.nextTier;
                var receiptActor = check.isReincarnator ? '角色' : check.targetName;
                shopAppendReceipt(statData, '[普升]['+receiptActor+'] 源力灌注：'+check.currentTier+' → '+check.nextTier+'｜消耗 '+sourceInfusionFmtNum(check.cost)+'空间币、'+check.credentialName+'×1');
                if (check.isReincarnator && statData.系统状态) statData.系统状态.试炼已完成 = false;
                applied = true;
            }, opts);
            if (ok && applied) {
                samToast('success', label+' 已通过源力灌注提升至 '+latest.nextTier+' 级');
                renderAll();
            } else {
                samToast('error', '源力灌注失败，资源或角色状态已发生变化');
            }
        });
    }

    /* 取层级显示文本(罗马数字); 兼容旧数据中存的品质字母→转对应罗马数字; 非法值回落 Ⅰ */
    function tierRomanOf(raw) {
        var s = String(raw || '').trim();
        var i = TIER_ROMAN.indexOf(s);
        if (i >= 0) return s;
        i = TIER_QUALITY.indexOf(s.toUpperCase());
        if (i >= 0) return TIER_ROMAN[i];
        return 'Ⅰ';
    }
    /* 取层级品质色阶(F~SSS, 用于CSS q-class着色); 兼容旧数据中的品质字母; 非法值回落 F */
    function tierQOfClass(raw) {
        var s = String(raw || '').trim();
        var i = TIER_ROMAN.indexOf(s);
        if (i >= 0) return TIER_QUALITY[i];
        i = TIER_QUALITY.indexOf(s.toUpperCase());
        if (i >= 0) return s.toUpperCase();
        return 'F';
    }
    /* 层级显示源值：当前形态激活(激活===true 且名称非空)且形态层级 > 自身层级时，
       返回形态层级；否则返回自身层级。仅用于UI显示（绝不写回数据）。
       判定规则与各渲染函数里已有的 formActive / npcFormName 判定一致。
       形态变身结束后 当前形态.激活 不再为 true → 自动回落到自身层级显示。 */
    function displayTierRaw(char) {
        var ownRaw = (char && char.层级 != null) ? char.层级 : '';
        var cf = char && char.当前形态 ? char.当前形态 : null;
        if (!cf || cf.激活 !== true || !safeStr(cf.名称)) return ownRaw;
        var entry = char.形态库 && char.形态库[cf.名称];
        if (!entry || typeof entry !== 'object') return ownRaw;
        var fTierRaw = (entry.层级 != null) ? entry.层级 : entry.品质;  // 旧存档可能用 品质 字段兜底
        var ownIdx = TIER_ROMAN.indexOf(tierRomanOf(ownRaw));     // 归一为 Ⅰ~Ⅸ 索引
        var formIdx = TIER_ROMAN.indexOf(tierRomanOf(fTierRaw));
        if (formIdx > ownIdx) return fTierRaw;  // 形态层级更高 → 显示形态层级
        return ownRaw;                          // 形态层级 ≤ 自身 → 显示自身层级
    }
    function getTheme() {
        try { var t = localStorage.getItem(SAM_CONFIG.theme); if (t && THEMES[t]) return t; } catch(e){}
        return 'night';
    }
    function setTheme(t) {
        try { localStorage.setItem(SAM_CONFIG.theme, t); } catch(e){}
        var $p = $('#samsara-panel');
        if ($p.length) {
            if (t === 'night') $p.removeAttr('data-theme');
            else $p.attr('data-theme', t);
        }
        applyThemeCSSVars(t);
    }
    function applyThemeCSSVars(t) {
        var th = THEMES[t] || THEMES.night;
        var root = document.getElementById('samsara-theme-style');
        if (!root) return;
        // 重建style块(变量+固定CSS)
        root.innerHTML = buildCSS(th, t);
    }
    function isMobile() { return (GS_PARENT.innerWidth || document.documentElement.clientWidth) <= 768; }
    function getCurrentTab() {
        try { var t = localStorage.getItem(SAM_CONFIG.tab); if (t) return t; } catch(e){}
        return 'mission';
    }
    function setCurrentTab(t) { try { localStorage.setItem(SAM_CONFIG.tab, t); } catch(e){} }
    function isEditMode() {
        try { return localStorage.getItem(SAM_CONFIG.edit) === '1'; } catch(e){ return false; }
    }
    function setEditMode(on) {
        try { localStorage.setItem(SAM_CONFIG.edit, on ? '1' : '0'); } catch(e){}
        // 进入/退出编辑模式时清空暂存, 避免脏数据
        pendingEdits = {};
    }

    