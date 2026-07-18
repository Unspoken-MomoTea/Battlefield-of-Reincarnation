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
        'parchment': { name: '羊皮', accent: '#a8761e', hp: '#c0392b', thp: '#d4a017', ep: '#2c6fbb', bg: 'rgba(245,235,210,0.95)', card: 'rgba(235,222,190,0.8)', border: 'rgba(168,118,30,0.35)', text: '#3a2a14', sub: '#7a6440', dark: '#e8d8b8' }
    };
    var THEME_ORDER = ['night', 'crimson', 'indigo', 'parchment'];

    /* ===== 4. 受保护(只读)字段定义 ===== */
    var READONLY_PATHS = [
        '主角.HP_MAX', '主角.EP_MAX', '主角.最终属性', '主角.层级',
        '主角.当前形态', '主角.形态库',
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
        {label:'特殊', type:8, cap:0}
    ];
    /* 道具战术栏槽位上限 */
    var ITEM_SLOT_CAP = 5;
    /* 血统数量上限(与 EQUIP_SLOTS / ITEM_SLOT_CAP 同级常量, 不写入数据库) */
    var BLOODLINE_CAP = 3;
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
            if ($) {
                $('#samsara-ball, #samsara-panel, #samsara-modal, #samsara-theme-style').remove();
                $(document).off('.sam .samPanel .samBall .samModal');
            }
            if (window.samsaraGuardTimer) clearInterval(window.samsaraGuardTimer);
        } catch (e) { console.warn('[主神终端] 预清理失败:', e.message); }
    }
    samPreClean();

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
    function writeBackMvu(mutator) {
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
            // 写回 message 通道
            win.Mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' });
            // 同步 chat 通道
            try { win.Mvu.replaceMvuData(cloned, { type: 'chat' }); } catch (e2) {}
            // ★ 关键: 手动广播 VARIABLE_UPDATE_ENDED 事件, 把 (after, before) 传给监听者
            //   这会让"辅助计算脚本"的 onUpdateData(after, before) 跑一遍, 后台重算属性/HP/EP
            //   事件签名见 exported.mvu.d.ts:186 -> (variables, variables_before_update) => void
            // ★ 标记本次更新来源为"UI操作", 供辅助计算脚本跳过战斗轮次推进/冷却递减
            //   辅助计算脚本运行在iframe, 它通过 GS_PARENT(主窗口) 读此标志, 故必须写在 GS_PARENT 上
            //   同时双写到 win(若不同), 保险起见
            try {
                GS_PARENT.__samsaraUIMutation = true;
                if (win !== GS_PARENT) win.__samsaraUIMutation = true;
            } catch(e4) { try { window.__samsaraUIMutation = true; } catch(e5){} }
            try {
                var evtName = win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED;
                if (evtName && typeof win.eventEmit === 'function') {
                    win.eventEmit(evtName, cloned, before);
                } else if (evtName && typeof eventEmit === 'function') {
                    eventEmit(evtName, cloned, before);
                }
            } catch (e3) { console.warn('[主神终端] 广播VARIABLE_UPDATE_ENDED失败:', e3.message); }
            // 事件回调同步执行完毕后, 立即清除标志(eventEmit 同步触发 onUpdateData, 返回后即安全)
            try {
                GS_PARENT.__samsaraUIMutation = false;
                if (win !== GS_PARENT) win.__samsaraUIMutation = false;
            } catch(e6) { try { window.__samsaraUIMutation = false; } catch(e7){} }
            try { console.log('%c[主神终端] ✅ 数据已写回MVU并广播更新事件', 'color:#86efac'); } catch(e){}
            return true;
        } catch (e) {
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
        if (path.indexOf('.身份') >= 0 || path.indexOf('.职业') >= 0) {
            val = String(val).split(/[\/,，]/).map(function(s){return s.trim();}).filter(Boolean);
        }
        stageEdit(path, val, type);
        var $wrap = $el.closest('.sam-ed-wrap');
        if (!$wrap.length) { $wrap = $el.wrap('<span class="sam-ed-wrap"></span>').closest('.sam-ed-wrap'); }
        var optsStr = $el.attr('data-opts') || '';
        var disp = editDisplayInner(val);
        $wrap.attr('data-path', path).attr('data-type', type);
        if (optsStr) $wrap.attr('data-opts', optsStr);
        $wrap.removeClass('editing').html(disp + '<span class="sam-ed-ico">✎</span>');
    }
    function editDisplayInner(val) {
        var vs = (val === null || val === undefined) ? '' : (Array.isArray(val) ? val.join(',') : String(val));
        return (vs === '' ? '<span class="sam-ed-ph">空</span>' : esc(vs));
    }
    /* 显示态HTML: 文本 + ✎ 角标, 点击才变输入框(避免变形) */
    function editDisplayHtml(path, val, type, optsStr) {
        var optsAttr = optsStr ? ' data-opts="'+esc(optsStr)+'"' : '';
        return '<span class="sam-ed-wrap" data-path="'+esc(path)+'" data-type="'+esc(type||'text')+'"'+optsAttr+'>'
            + '<span class="sam-ed-val">'+editDisplayInner(val)+'</span>'
            + '<span class="sam-ed-ico">✎</span>'
            + '</span>';
    }
    /* 真正的输入框(仅在点击后插入, 失焦还原) */
    function editRealInputHtml(path, val, type) {
        var v = (val === null || val === undefined) ? '' : String(val);
        if (type === 'textarea') {
            return '<textarea class="sam-edit-input sam-edit-active" data-path="'+esc(path)+'" data-type="textarea" rows="2" style="width:100%;min-height:40px;resize:vertical;">'+esc(v)+'</textarea>';
        }
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
        var s = String(q).toUpperCase();
        return ['F','E','D','C','B','A','S','SS','SSS'].indexOf(s) >= 0 ? s : 'E';
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

    /* ===== 9. CSS 注入(含多主题变量) ===== */
    function buildCSS(th, themeKey) {
        var isLight = (themeKey === 'parchment');
        return `
        :root {
            --sam-accent: ${th.accent};
            --sam-hp: ${th.hp}; --sam-thp: ${th.thp}; --sam-ep: ${th.ep};
            --sam-bg: ${th.bg}; --sam-card: ${th.card}; --sam-dark: ${th.dark};
            --sam-border: ${th.border}; --sam-text: ${th.text}; --sam-sub: ${th.sub};
            /* 品质/层级色: 基础冷色→高阶暖色→破格霓虹 (F~SSS 九档, 品质徽章/层级字母/卡片边框统一引用) */
            --sam-q-f:#94a3b8; --sam-q-e:#f8fafc; --sam-q-d:#22c55e; --sam-q-c:#3b82f6;
            --sam-q-b:#a855f7; --sam-q-a:#f97316; --sam-q-s:#eab308; --sam-q-ss:#ef4444; --sam-q-sss:#ec4899;
            --sam-modal-overlay: ${isLight ? 'rgba(60,40,10,0.45)' : 'rgba(0,0,0,0.65)'};
            --sam-input-bg: ${isLight ? 'rgba(255,250,235,0.9)' : 'rgba(0,0,0,0.4)'};
            --sam-hover: ${isLight ? 'rgba(168,118,30,0.12)' : 'rgba(255,255,255,0.06)'};
        }
        #samsara-ball {
            position: fixed; top: 15%; right: 20px; z-index: 999999;
            width: 34px; height: 34px; border-radius: 50%;
            background: radial-gradient(circle, var(--sam-bg) 30%, var(--sam-dark) 100%);
            border: 1.5px solid var(--sam-border); box-shadow: 0 0 10px var(--sam-accent);
            cursor: pointer; user-select: none; touch-action: none;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(8px); transition: box-shadow 0.3s, transform 0.25s;
        }
        #samsara-ball:hover { transform: scale(1.1); box-shadow: 0 0 18px var(--sam-ep); }
        #samsara-ball:active { transform: scale(0.95); }
        #samsara-ball.combat-mode { box-shadow: 0 0 18px var(--sam-hp); border-color: var(--sam-hp); }
        #samsara-ball .core { width: 11px; height: 11px; background: var(--sam-accent); border-radius: 50%; box-shadow: 0 0 7px var(--sam-accent); pointer-events: none; }
        #samsara-ball.combat-mode .core { background: var(--sam-hp); box-shadow: 0 0 10px var(--sam-hp); animation: samPulse 1.2s ease-in-out infinite; }
        @keyframes samPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 10px var(--sam-hp); } 50% { transform: scale(1.3); box-shadow: 0 0 20px var(--sam-hp); } }

        #samsara-panel {
            position: fixed !important; right: 70px; top: 6%; z-index: 999998;
            width: 470px; max-width: 94vw; height: 82vh; max-height: 800px;
            display: none; flex-direction: column;
            background: var(--sam-bg); border: 1px solid var(--sam-border); border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.3);
            backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            color: var(--sam-text); font-family: 'Segoe UI', system-ui, sans-serif; overflow: hidden;
        }
        #samsara-panel.open { display: flex; animation: samPanelIn 0.28s cubic-bezier(0.16,1,0.3,1) forwards; }
        #samsara-panel.closing { display: flex; pointer-events: none; animation: samPanelOut 0.18s cubic-bezier(0.4,0,1,1) forwards; }
        @keyframes samPanelIn { from { opacity: 0; transform: scale(0.94) translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes samPanelOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: scale(0.96) translateY(12px); } }

        /* 顶栏 */
        .sam-topbar { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-bottom:1px solid var(--sam-border); background:linear-gradient(90deg,var(--sam-dark) 0%,transparent 100%); cursor:grab; user-select:none; flex-shrink:0; }
        .sam-topbar:active { cursor:grabbing; }
        .sam-topbar .tl-info { display:flex; flex-direction:column; gap:2px; font-size:12px; min-width:0; }
        .sam-topbar .tl-time { color:var(--sam-text); font-weight:bold; }
        .sam-topbar .tl-place { color:var(--sam-sub); font-size:11px; }
        .sam-topbar .tl-actions { display:flex; gap:6px; align-items:center; }
        .sam-icon-btn { width:28px; height:28px; border-radius:6px; border:1px solid var(--sam-border); background:var(--sam-card); color:var(--sam-text); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; transition:all 0.2s; flex-shrink:0; }
        .sam-icon-btn:hover { background:var(--sam-accent); color:#fff; transform:translateY(-1px); box-shadow:0 0 8px var(--sam-accent); }
        .sam-icon-btn.choose-world { width:auto; padding:0 8px; font-size:12px; gap:3px; white-space:nowrap; }
        .sam-icon-btn.close { border-color:var(--sam-hp); color:var(--sam-hp); }
        .sam-icon-btn.close:hover { background:var(--sam-hp); color:#fff; }
        .sam-icon-btn.edit-on { background:var(--sam-accent); color:#fff; box-shadow:0 0 10px var(--sam-accent); }

        /* 中部:角色条(左头像列+层级/种族/形态 / 右HP+EP+THP三栏 纯色) */
        .sam-hero { display:flex; padding:8px 12px; gap:10px; border-bottom:1px solid var(--sam-border); flex-shrink:0; align-items:center; }
        .sam-hero-left { display:flex; align-items:center; gap:10px; flex:0 1 auto; min-width:0; }
        /* 头像: 大头像, 空态点击=上传, 有图点击=放大, 右上角✎按钮=上传 */
        .sam-avatar { width:90px; height:110px; border-radius:6px; border:2px solid var(--sam-accent); background:var(--sam-card); display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:28px; flex-shrink:0; overflow:hidden; cursor:pointer; box-shadow:0 0 10px rgba(143,159,255,0.25); position:relative; transition:box-shadow 0.2s, transform 0.15s; }
        .sam-avatar:hover { box-shadow:0 0 16px rgba(143,159,255,0.5); transform:translateY(-1px); }
        .sam-avatar.empty { cursor:pointer; gap:4px; }
        .sam-avatar.empty img { display:none; }
        .sam-avatar:not(.empty) .sam-ava-ph { display:none; }
        .sam-avatar:not(.empty) { cursor:pointer; }
        .sam-avatar img { width:100%; height:100%; object-fit:cover; }
        .sam-ava-ph { display:flex; flex-direction:column; align-items:center; gap:4px; color:var(--sam-sub); }
        .sam-ava-ph .sam-ava-ico { font-size:30px; opacity:0.7; }
        .sam-ava-ph .sam-ava-hint { font-size:9px; text-align:center; line-height:1.2; opacity:0.8; }
        .sam-hero-text { display:flex; flex-direction:column; min-width:0; flex:1 1 auto; gap:5px; }
        /* 战斗状态徽章: 红色脉冲, 平时不渲染(由JS按 是否战斗中 输出) */
        .sam-hero-combat { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:bold; color:#fff; background:linear-gradient(135deg, rgba(228,88,125,0.92), rgba(170,38,66,0.9)); border:1px solid var(--sam-hp); border-radius:10px; padding:2px 10px; letter-spacing:0.5px; box-shadow:0 0 8px rgba(228,88,125,0.5); animation:samCombatPulse 1.4s ease-in-out infinite; }
        @keyframes samCombatPulse { 0%,100% { box-shadow:0 0 7px rgba(228,88,125,0.45); } 50% { box-shadow:0 0 16px rgba(228,88,125,0.85); } }
        /* 层级: 品质描边徽章(文字色由 .q-X 提供, 边框跟随 currentColor) - 独立成行 */
        .sam-hero-tier { align-self:flex-start; display:inline-flex; align-items:baseline; font-weight:900; line-height:1; color:var(--sam-accent); padding:3px 10px; border:1px solid currentColor; border-radius:8px; background:rgba(0,0,0,0.28); }
        .sam-hero-tier-num { font-size:19px; }
        .sam-hero-tier-suf { font-size:11px; opacity:0.75; margin-left:1px; }
        /* 种族: 次要标签 - 独立成行 */
        .sam-hero-race { align-self:flex-start; display:inline-flex; align-items:center; font-size:12px; font-weight:bold; color:var(--sam-text); line-height:1.2; padding:3px 9px; background:rgba(255,255,255,0.05); border:1px solid var(--sam-border); border-radius:8px; }
        /* 形态: 金色发光标签 */
        .sam-hero-form { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:bold; color:var(--sam-thp); line-height:1.2; padding:2px 9px; background:rgba(229,193,102,0.1); border:1px solid rgba(229,193,102,0.4); border-radius:8px; box-shadow:0 0 7px rgba(229,193,102,0.18); }
        .sam-hero-form-name { font-size:13px; }
        /* 右侧HP/EP/THP三排 */
        /* 右侧HP/EP/THP三排 */
        .sam-hero-bars { 
            flex: 1 1 auto;             /* 允许伸缩，自动填充剩余空间 */
            display: flex; 
            flex-direction: column; 
            gap: 5px; 
            min-width: 150px;           /* 设定一个最小宽度，防止被左侧挤没 */
            max-width: 210px;           /* 👈 核心修改：将最大宽度限制在 200px 左右，这就是黄金比例 */
            margin-left: auto;          /* 把它推到最右侧 */
        }
        .sam-hero-bars .stat-bar-box { min-width: 0; }
        .stat-labels { display:flex; justify-content:space-between; font-size:11px; font-weight:bold; margin-bottom:2px; color:var(--sam-sub); }
        .bar-track { width:100%; height:13px; background:var(--sam-dark); border-radius:6px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.08); }
        .bar-fill { height:100%; position:absolute; top:0; left:0; border-radius:6px; transition:width 0.5s cubic-bezier(0.2,0.8,0.2,1); }
        .fill-hp { background:var(--sam-hp); z-index:1; }
        .fill-thp { background:var(--sam-thp); z-index:2; opacity:0.85; box-shadow:0 0 6px var(--sam-thp); }
        .fill-ep { background:var(--sam-ep); }
        .fill-thp2 { background:var(--sam-thp); }
        /* THP行(顶部主角): 临时护盾/额外生命值, 无进度条, 外框包裹, 略向下偏移 */
        .sam-thp-row { margin-top:3px; padding:5px 10px; border:1px solid var(--sam-thp); border-radius:6px; background:rgba(255,255,255,0.04); }
        .sam-thp-row .stat-labels { margin-bottom:0; }
        /* THP行(NPC): 外框包裹, 标签可完整显示 */
        .sam-npc-thp-row { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:3px 8px; border:1px solid var(--sam-thp); border-radius:5px; background:rgba(255,255,255,0.04); margin-top:3px; }
        .sam-npc-thp-row .lbl { font-size:10px; font-weight:bold; color:var(--sam-thp); }
        .sam-npc-thp-row .num { font-size:11px; color:var(--sam-text); font-weight:bold; }
        /* 层级进度条: 左当前层级 / 中总点+进度条 / 右下一层级 */
        .sam-tier-prog { display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--sam-hover); border-radius:8px; border:1px solid var(--sam-border); margin-bottom:8px; }
        .sam-tier-side { font-size:18px; font-weight:900; color:var(--sam-accent); min-width:34px; text-align:center; line-height:1; }
        .sam-tier-side.next { color:var(--sam-sub); opacity:0.7; }
        .sam-tier-side.max { color:var(--sam-hp); }
        .sam-tier-mid { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
        .sam-tier-sum { font-size:11px; color:var(--sam-sub); font-weight:bold; display:flex; justify-content:space-between; }
        .sam-tier-sum .v { color:var(--sam-text); }
        .sam-tier-bar { width:100%; height:14px; background:var(--sam-dark); border-radius:7px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.1); }
        .sam-tier-bar .bar-fill { background:linear-gradient(90deg, var(--sam-accent), var(--sam-hp)); box-shadow:0 0 8px var(--sam-accent); }
        /* 进阶按钮: 仅在属性总点达下一层级下限时渲染; 两态色调 */
        .sam-tier-adv-btn { margin-top:4px; padding:5px 14px; font-size:12px; font-weight:900; border:1px solid; border-radius:6px; cursor:pointer; align-self:flex-start; transition:all 0.18s; letter-spacing:1px; }
        .sam-tier-adv-btn.apply { border-color:#7a1f1f; color:#e04848; background:rgba(122,31,31,0.18); text-shadow:0 0 4px rgba(224,72,72,0.5); }
        .sam-tier-adv-btn.apply:hover { background:#7a1f1f; color:#fff; box-shadow:0 0 10px rgba(224,72,72,0.7); }
        .sam-tier-adv-btn.start { border-color:#d4af37; color:#fff7d6; background:linear-gradient(135deg, rgba(212,175,55,0.25), rgba(255,247,214,0.12)); text-shadow:0 0 5px rgba(255,247,214,0.8); box-shadow:0 0 8px rgba(212,175,55,0.5); }
        .sam-tier-adv-btn.start:hover { background:linear-gradient(135deg, #d4af37, #fff7d6); color:#2a2300; box-shadow:0 0 14px rgba(255,247,214,0.9); }
        /* 结算任务按钮区: 任务面板所有栏目下方, 与上方栏目分隔; 按钮居中, 提示在下 */
        .sam-mission-settle-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--sam-border); }
        /* 按钮使用主题无关的稳重配色(深绿), 与整体UI协调且在任意主题清晰可见 */
        .sam-mission-settle-btn { margin-top:4px; padding:7px 26px; font-size:12px; font-weight:900; letter-spacing:1px; cursor:pointer; border-radius:6px; transition:all 0.18s;
            color:#fff; background:#2e9e6b; border:1px solid #2e9e6b; box-shadow:0 0 8px rgba(46,158,107,0.4); }
        .sam-mission-settle-btn:hover { background:#36b67c; border-color:#36b67c; box-shadow:0 0 12px rgba(46,158,107,0.65); }
        .sam-mission-settle-btn:active { transform:translateY(1px); }
        .sam-mission-settle-hint { font-size:11px; color:var(--sam-sub); line-height:1.2; text-align:center; }
        /* 血统/形态/技能卡片删除按钮: 编辑模式显示在卡片头部右侧 */
        .sam-fc-del-btn { margin-left:auto; width:22px; height:22px; flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; font-size:13px; line-height:1; cursor:pointer; color:var(--sam-hp); background:rgba(228,72,72,0.12); border:1px solid rgba(228,72,72,0.45); border-radius:6px; transition:all 0.18s; }
        .sam-fc-del-btn:hover { background:var(--sam-hp); color:#fff; box-shadow:0 0 8px rgba(228,72,72,0.6); }
        @media (max-width:768px) {
            .sam-tier-prog { padding:6px 8px; gap:6px; }
            .sam-tier-side { font-size:15px; min-width:28px; }
            .sam-tier-bar { height:11px; }
        }
        /* 战术栏穿戴槽位信息栏: 各类型 当前数/上限; 未满白/满绿/超限红(整个字段变色) */
        .sam-slots-bar { display:flex; flex-wrap:wrap; gap:4px 8px; padding:6px 10px; background:var(--sam-hover); border-radius:8px; border:1px solid var(--sam-border); margin-bottom:8px; }
        .sam-slot-chip { font-size:11px; color:var(--sam-text); font-weight:bold; white-space:nowrap; }
        .sam-slot-chip.full { color:#4ade80; }      /* 满: 绿 */
        .sam-slot-chip.over { color:var(--sam-hp); } /* 超限: 红 */
        /* 立绘放大查看器 — 全屏 + dvh/safe-area，避免刘海/底栏裁切 */
        #samsara-portrait-viewer {
            display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; height:100dvh;
            background:rgba(5,5,12,0.94); backdrop-filter:blur(14px); z-index:999999999;
            justify-content:center; align-items:center; flex-direction:column; cursor:zoom-out;
            padding:env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
            box-sizing:border-box;
        }
        #samsara-portrait-viewer.show { display:flex; animation:samPvFade 0.2s ease; }
        @keyframes samPvFade { from{opacity:0;} to{opacity:1;} }
        #sam-pv-img {
            max-width:min(88vw, 100%);
            max-height:calc(86vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            max-height:calc(86dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            object-fit:contain; border:2px solid var(--sam-accent); border-radius:6px;
            box-shadow:0 0 60px rgba(143,159,255,0.4); display:block;
        }
        #sam-pv-label { margin-top:10px; color:var(--sam-accent); font-size:14px; font-weight:bold; text-align:center; padding:0 12px; }

        /* 底部状态按钮条(状态名+持续时间, 点击弹二级详情) —— 强制单行横向滚动, 状态再多也不换行/不竖排 */
        .sam-buff-rail { display:flex; flex-wrap:nowrap; gap:5px; padding:6px 12px; border-bottom:1px solid var(--sam-border); overflow-x:auto; overflow-y:hidden; flex-shrink:0; background:var(--sam-card); -webkit-overflow-scrolling:touch; white-space:nowrap; }
        .sam-buff-rail::-webkit-scrollbar { height:4px; }
        .sam-buff-rail::-webkit-scrollbar-track { background:transparent; }
        .sam-buff-rail::-webkit-scrollbar-thumb { background:var(--sam-border); border-radius:2px; }
        /* 商城面板: 顶部紧凑余额条 */
        .sam-shop-coin-mini { display:flex; align-items:center; justify-content:center; gap:6px; padding:4px 10px; background:linear-gradient(135deg, rgba(212,175,55,0.12), rgba(255,247,214,0.06)); border:1px solid rgba(229,193,102,0.4); border-radius:16px; font-size:12px; color:var(--sam-thp); margin-bottom:6px; line-height:1.2; }
        .sam-shop-coin-mini .lbl { font-weight:normal; color:var(--sam-sub); opacity:0.85; }
        .sam-shop-coin-mini .val { font-weight:900; text-shadow:0 0 6px rgba(229,193,102,0.5); }
        .sam-shop-warn { font-size:12px; color:var(--sam-hp); padding:8px 10px; background:rgba(228,88,125,0.10); border:1px solid rgba(228,88,125,0.35); border-radius:6px; margin-bottom:8px; line-height:1.5; }
        .sam-shop-ok { font-size:12px; color:#56bf7b; padding:8px 10px; background:rgba(86,191,123,0.10); border:1px solid rgba(86,191,123,0.35); border-radius:6px; margin-bottom:8px; line-height:1.5; }
        /* 商城入口: 需求输入框 + 刷新商品按钮(横排) */
        .sam-shop-entry { display:flex; align-items:stretch; gap:8px; }
        .sam-shop-entry .sam-shop-req { flex:1 1 auto; min-width:0; background:var(--sam-input-bg, rgba(0,0,0,0.25)); border:1px solid var(--sam-border); border-radius:6px; padding:8px 10px; font-size:12px; color:var(--sam-fg, #d1d8e0); outline:none; transition:border-color 0.15s, box-shadow 0.15s; }
        .sam-shop-entry .sam-shop-req:focus { border-color:var(--sam-thp, #e5c166); box-shadow:0 0 0 2px rgba(229,193,102,0.18); }
        .sam-shop-entry .sam-shop-req::placeholder { color:var(--sam-sub, #7a8499); opacity:0.9; }
        .sam-shop-refresh-btn { flex:0 0 auto; display:inline-flex; align-items:center; gap:4px; padding:0 14px; border:1px solid rgba(229,193,102,0.5); border-radius:6px; background:linear-gradient(135deg, rgba(212,175,55,0.18), rgba(255,247,214,0.08)); color:var(--sam-thp, #e5c166); font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap; transition:transform 0.15s, box-shadow 0.15s, background 0.15s; }
        .sam-shop-refresh-btn:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(229,193,102,0.25); background:linear-gradient(135deg, rgba(212,175,55,0.28), rgba(255,247,214,0.14)); }
        .sam-shop-refresh-btn:active { transform:translateY(0); }
        .sam-shop-refresh-btn[disabled] { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
        /* ===== 商城市场区(刷新商品后展示) ===== */
        /* 区域Tab条: 装备|道具|技能|血统 */
        .sam-shop-tabs { display:flex; flex-wrap:nowrap; gap:4px; padding:6px 4px; border-bottom:1px solid var(--sam-border); overflow-x:auto; overflow-y:hidden; flex-shrink:0; -webkit-overflow-scrolling:touch; }
        .sam-shop-tabs::-webkit-scrollbar { height:3px; }
        .sam-shop-tab { flex:0 0 auto; padding:5px 12px; font-size:12px; color:var(--sam-sub); background:transparent; border:1px solid transparent; border-radius:14px; cursor:pointer; white-space:nowrap; transition:all 0.15s; line-height:1.2; }
        .sam-shop-tab:hover { color:var(--sam-accent); }
        .sam-shop-tab.active { color:#0d1220; background:var(--sam-accent); border-color:var(--sam-accent); box-shadow:0 0 10px rgba(143,159,255,0.3); font-weight:bold; }
        .sam-shop-tab .sam-shop-tab-cnt { font-size:10px; opacity:0.75; margin-left:2px; }
        /* 持有面板子Tab条: 战术栏|装备背包|道具背包|仓库 (四等分卡片式) */
        .sam-hold-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:8px 2px 10px; flex-shrink:0; }
        .sam-hold-tab { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:8px 4px 7px; background:linear-gradient(180deg, rgba(22,30,46,0.5), rgba(13,18,28,0.6)); border:1px solid var(--sam-border); border-radius:10px; cursor:pointer; transition:all 0.18s; position:relative; overflow:visible; line-height:1.1; }
        .sam-hold-tab:hover { border-color:rgba(143,159,255,0.45); transform:translateY(-1px); }
        .sam-hold-tab.active { background:linear-gradient(180deg, rgba(143,159,255,0.16), rgba(143,159,255,0.05)); border-color:var(--sam-accent); box-shadow:0 0 0 1px rgba(143,159,255,0.35), 0 0 12px rgba(143,159,255,0.18); }
        .sam-hold-tab .sam-hold-tab-ico { font-size:17px; line-height:1; filter:grayscale(0.35); transition:filter 0.18s; }
        .sam-hold-tab.active .sam-hold-tab-ico { filter:grayscale(0); }
        .sam-hold-tab .sam-hold-tab-lbl { font-size:11px; color:var(--sam-sub); white-space:nowrap; transition:color 0.18s; }
        .sam-hold-tab.active .sam-hold-tab-lbl { color:var(--sam-accent); font-weight:bold; }
        .sam-hold-tab .sam-hold-tab-cnt { position:absolute; top:-5px; right:-4px; min-width:16px; height:16px; padding:0 4px; font-size:10px; font-weight:bold; line-height:16px; text-align:center; color:#0d1220; background:var(--sam-accent); border-radius:9px; box-shadow:0 0 6px rgba(143,159,255,0.4); }
        .sam-hold-tab .sam-hold-tab-cnt:empty, .sam-hold-tab .sam-hold-tab-cnt.zero { display:none; }
        /* 持有面板内容区 */
        .sam-hold-content { padding:2px 2px 6px; }
        .sam-hold-hint { display:inline-flex; align-items:center; gap:4px; font-size:10px; color:var(--sam-sub); background:rgba(0,0,0,0.25); border:1px solid var(--sam-border); border-radius:10px; padding:2px 9px; margin-bottom:8px; opacity:0.85; }
        /* 上方归类Tab条 + 中部list(滚动) + 底部购物车栏(常驻) 三段式固定布局 */
        .sam-shop-market { display:flex; flex-direction:column; gap:0; height:420px; min-height:120px; }
        .sam-shop-tabs { flex-shrink:0; }
        .sam-shop-nav { display:flex; flex-direction:row; flex-wrap:nowrap; gap:4px; padding:6px 4px; border-bottom:1px solid var(--sam-border); overflow-x:auto; overflow-y:hidden; flex-shrink:0; -webkit-overflow-scrolling:touch; }
        .sam-shop-nav::-webkit-scrollbar { height:3px; }
        .sam-shop-nav-btn { flex:0 0 auto; display:flex; align-items:center; gap:4px; padding:5px 11px; font-size:12px; color:var(--sam-sub); background:transparent; border:1px solid transparent; border-radius:14px; cursor:pointer; white-space:nowrap; transition:all 0.15s; line-height:1.2; }
        .sam-shop-nav-btn:hover { color:var(--sam-accent); }
        .sam-shop-nav-btn.active { color:#0d1220; background:var(--sam-accent); border-color:var(--sam-accent); box-shadow:0 0 10px rgba(143,159,255,0.3); font-weight:bold; }
        .sam-shop-nav-btn .sam-shop-nav-cnt { font-size:10px; opacity:0.75; margin-left:2px; }
        /* 中部list: flex:1 占满剩余空间, 自身滚动 */
        .sam-shop-list { flex:1 1 auto; min-height:0; padding:8px 6px 12px; display:flex; flex-direction:column; gap:8px; overflow-y:auto; }
        .sam-shop-list::-webkit-scrollbar { width:5px; }
        .sam-shop-list::-webkit-scrollbar-thumb { background:var(--sam-border); border-radius:3px; }
        /* 刷新中提示(替代列表区) */
        .sam-shop-refreshing { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:20px; text-align:center; color:var(--sam-sub); font-size:13px; line-height:1.6; }
        .sam-shop-refreshing .sam-shop-refreshing-spin { font-size:24px; animation:sam-spin 1.2s linear infinite reverse; }
        @keyframes sam-spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        /* 商品卡片(参考 开局.html .item-card 选中/禁用模式) */
        .sam-shop-item { background:linear-gradient(180deg, rgba(22,30,46,0.7), rgba(13,18,28,0.8)); border:1px solid var(--sam-border); border-radius:8px; padding:10px; cursor:pointer; transition:all 0.15s; position:relative; overflow:visible; }
        .sam-shop-item::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--sam-border); opacity:0; transition:opacity 0.15s; border-radius:8px 0 0 8px; }
        .sam-shop-item:hover:not(.disabled) { border-color:rgba(143,159,255,0.4); transform:translateY(-1px); }
        .sam-shop-item:hover:not(.disabled)::before { opacity:0.6; }
        /* 选中态: 边框亮起(青蓝) + 辉光 + 左条加粗, 不整体变红 */
        .sam-shop-item.selected { background:linear-gradient(180deg, rgba(22,30,46,0.7), rgba(143,159,255,0.08)); border-color:var(--sam-accent); box-shadow:0 0 0 1px rgba(143,159,255,0.35), 0 0 12px rgba(143,159,255,0.18); }
        .sam-shop-item.selected::before { background:var(--sam-accent); opacity:1; width:4px; }
        /* 右下角"已选"角标(默认隐藏, 选中时显示) */
        .sam-shop-item .sam-shop-sel-corner { position:absolute; right:-1px; bottom:-1px; background:var(--sam-accent); color:#0a0e14; font-size:10px; font-weight:bold; padding:2px 8px; border-top-left-radius:6px; border-bottom-right-radius:8px; box-shadow:0 0 6px rgba(143,159,255,0.5); display:none; letter-spacing:0.5px; line-height:1.4; }
        .sam-shop-item.selected .sam-shop-sel-corner { display:block; }
        /* 禁用态(余额不足): 灰调 + 不可点击 + hover无变化 */
        .sam-shop-item.disabled { opacity:0.45; cursor:not-allowed; filter:grayscale(0.7); }
        .sam-shop-item.disabled:hover { transform:none; box-shadow:none; border-color:var(--sam-border); }
        .sam-shop-item.disabled:hover::before { opacity:0; }
        .sam-shop-item-head { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; margin-bottom:6px; min-width:0; }
        .sam-shop-item-name { font-weight:bold; font-size:13px; color:var(--sam-fg, #e8f0f8); line-height:1.25; min-width:0; overflow-wrap:anywhere; }
        .sam-shop-item.selected .sam-shop-item-name { color:var(--sam-accent); }
        .sam-shop-item-meta { flex-shrink:0; font-size:11px; font-weight:900; padding:1px 7px; border-radius:3px; border:1px solid; line-height:1.4; min-width:30px; text-align:center; }
        .sam-shop-item-meta.q-F { color:var(--sam-q-f); border-color:var(--sam-q-f); background:rgba(148,163,184,0.14); }
        .sam-shop-item-meta.q-E { color:var(--sam-q-e); border-color:var(--sam-q-e); background:rgba(248,250,252,0.10); }
        .sam-shop-item-meta.q-D { color:var(--sam-q-d); border-color:var(--sam-q-d); background:rgba(34,197,94,0.14); }
        .sam-shop-item-meta.q-C { color:var(--sam-q-c); border-color:var(--sam-q-c); background:rgba(59,130,246,0.14); }
        .sam-shop-item-meta.q-B { color:var(--sam-q-b); border-color:var(--sam-q-b); background:rgba(168,85,247,0.16); }
        .sam-shop-item-meta.q-A { color:var(--sam-q-a); border-color:var(--sam-q-a); background:rgba(249,115,22,0.16); }
        .sam-shop-item-meta.q-S { color:var(--sam-q-s); border-color:var(--sam-q-s); background:rgba(234,179,8,0.16); text-shadow:0 0 4px rgba(234,179,8,0.5); }
        .sam-shop-item-meta.q-SS { color:var(--sam-q-ss); border-color:var(--sam-q-ss); background:rgba(239,68,68,0.18); text-shadow:0 0 4px rgba(239,68,68,0.6); }
        .sam-shop-item-meta.q-SSS { color:var(--sam-q-sss); border-color:var(--sam-q-sss); background:rgba(236,72,153,0.20); text-shadow:0 0 5px rgba(236,72,153,0.7); box-shadow:0 0 6px rgba(236,72,153,0.4); }
        .sam-shop-item-attrs { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px; }
        .sam-shop-chip { font-size:10px; padding:1px 6px; border-radius:8px; background:rgba(0,0,0,0.25); border:1px solid var(--sam-border); color:var(--sam-fg, #d1d8e0); line-height:1.4; }
        .sam-shop-chip b { color:var(--sam-accent); font-weight:normal; }
        .sam-shop-item-detail { font-size:11px; color:var(--sam-text); padding:4px 0 2px; border-top:1px dashed rgba(255,255,255,0.06); line-height:1.5; }
        .sam-shop-item-detail b { color:var(--sam-accent); }
        .sam-shop-item-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:6px; }
        .sam-shop-price { font-size:13px; font-weight:bold; color:var(--sam-thp, #e5c166); text-shadow:0 0 5px rgba(229,193,102,0.4); }
        .sam-shop-qty { display:flex; align-items:center; gap:2px; }
        .sam-shop-qty-btn { width:22px; height:22px; border:1px solid var(--sam-border); border-radius:4px; background:rgba(0,0,0,0.25); color:var(--sam-fg, #d1d8e0); font-size:12px; cursor:pointer; line-height:1; }
        .sam-shop-qty-btn:hover { border-color:var(--sam-accent); color:var(--sam-accent); }
        .sam-shop-qty-inp { width:36px; height:22px; text-align:center; border:1px solid var(--sam-border); border-radius:4px; background:rgba(0,0,0,0.25); color:var(--sam-fg, #d1d8e0); font-size:11px; outline:none; }
        .sam-shop-empty { font-size:12px; color:var(--sam-sub); padding:20px 8px; text-align:center; }
        /* 底部购物车条: flex 末项常驻底部(不再用 sticky) */
        .sam-shop-foot { flex-shrink:0; display:flex; align-items:center; gap:8px; padding:8px 10px; border-top:1px solid var(--sam-border); background:var(--sam-card); z-index:5; }
        .sam-shop-foot-info { flex:1 1 auto; min-width:0; font-size:11px; color:var(--sam-sub); line-height:1.3; }
        .sam-shop-foot-info b { color:var(--sam-thp, #e5c166); font-weight:bold; }
        .sam-shop-foot-info .sam-shop-foot-warn { color:var(--sam-hp); }
        .sam-shop-foot-info .sam-shop-foot-remain { color:var(--sam-mn, #7fd4c1); font-weight:bold; }
        .sam-shop-foot-info .sam-shop-foot-remain.insufficient { color:var(--sam-hp); }
        .sam-shop-exec-btn { flex:0 0 auto; padding:6px 16px; border:1px solid rgba(229,193,102,0.5); border-radius:6px; background:linear-gradient(135deg, rgba(212,175,55,0.2), rgba(255,247,214,0.1)); color:var(--sam-thp, #e5c166); font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
        .sam-shop-exec-btn:hover:not([disabled]) { transform:translateY(-1px); box-shadow:0 3px 8px rgba(229,193,102,0.25); }
        .sam-shop-exec-btn[disabled] { opacity:0.5; cursor:not-allowed; }
        .sam-buff-chip { display:flex; flex-direction:column; align-items:center; gap:1px; padding:4px 10px; border-radius:8px; font-size:11px; cursor:pointer; border:1px solid; flex-shrink:0; transition:transform 0.15s, box-shadow 0.15s; line-height:1.2; position:relative; }
        .sam-buff-chip:hover { transform:translateY(-2px); box-shadow:0 3px 8px rgba(0,0,0,0.4); }
        .sam-buff-chip .sam-buff-name { font-weight:bold; }
        .sam-buff-chip .sam-buff-dur { font-size:9px; opacity:0.85; }
        .sam-buff-chip.增益 { color:#56bf7b; border-color:#56bf7b; background:rgba(86,191,123,0.14); }
        .sam-buff-chip.减益 { color:var(--sam-hp); border-color:var(--sam-hp); background:rgba(228,88,125,0.14); }
        .sam-buff-chip.特殊 { color:var(--sam-accent); border-color:var(--sam-accent); background:rgba(143,159,255,0.14); }
        /* 编辑模式: 右侧预留删除按钮空间; 删除按钮在chip内缩成小圆点(覆盖sam-fc-del-btn默认22px) */
        .sam-buff-chip.is-edit { padding-right:16px; }
        .sam-buff-chip .sam-fc-del-btn { position:absolute; top:1px; right:1px; width:14px; height:14px; font-size:9px; line-height:1; margin:0; padding:0; border:none; border-radius:50%; z-index:3; }
        .sam-buff-empty { font-size:11px; color:var(--sam-sub); padding:4px 0; }

        /* Tab主体 — flex 滚动链需 min-height:0，否则展开后无法内部滚动 */
        .sam-main { display:flex; flex:1; min-height:0; overflow:hidden; }
        .sam-tab-rail { flex:0 0 58px; display:flex; flex-direction:column; border-right:1px solid var(--sam-border); background:var(--sam-dark); overflow-y:auto; min-height:0; -webkit-overflow-scrolling:touch; }
        .sam-tab-rail::-webkit-scrollbar { width:4px; }
        .sam-tab-rail::-webkit-scrollbar-thumb { background:var(--sam-border); }
        .sam-tab-btn { padding:8px 2px; text-align:center; font-size:11px; font-weight:bold; cursor:pointer; border-left:3px solid transparent; color:var(--sam-sub); transition:all 0.2s; line-height:1.2; }
        .sam-tab-btn:hover { background:var(--sam-hover); color:var(--sam-text); }
        .sam-tab-btn.active { color:var(--sam-accent); border-left-color:var(--sam-accent); background:var(--sam-hover); }
        .sam-tab-content { flex:1; min-height:0; overflow-x:hidden; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; touch-action:pan-y; padding:8px 10px; }
        .sam-tab-content::-webkit-scrollbar { width:6px; }
        .sam-tab-content::-webkit-scrollbar-thumb { background:var(--sam-border); border-radius:3px; }

        /* 卡片/网格 */
        .sam-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:6px; }
        .sam-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:0 4px; }
        .sam-grid-2 > .sam-row { padding:5px 8px; background:rgba(0,0,0,0.18); border-radius:4px; border-bottom:1px solid rgba(143,159,255,0.06); }
        .sam-grid-2 > .sam-row .k { min-width:48px; }
        .sam-grid-2 > .sam-row .v { padding-left:10px; }
        .sam-card { padding:8px 10px; background:var(--sam-card); border:1px solid var(--sam-border); border-left:3px solid var(--sam-sub); border-radius:5px; cursor:pointer; transition:transform 0.15s,background 0.15s; }
        .sam-card:hover { transform:translateY(-2px); background:var(--sam-hover); }
        .sam-card.q-F{border-left-color:var(--sam-q-f);} .sam-card.q-E{border-left-color:var(--sam-q-e);}
        .sam-card.q-D{border-left-color:var(--sam-q-d);} .sam-card.q-C{border-left-color:var(--sam-q-c);}
        .sam-card.q-B{border-left-color:var(--sam-q-b);} .sam-card.q-A{border-left-color:var(--sam-q-a);}
        .sam-card.q-S{border-left-color:var(--sam-q-s);} .sam-card.q-SS{border-left-color:var(--sam-q-ss);}
        .sam-card.q-SSS{border-left-color:var(--sam-q-sss);}
        .sam-card-title { font-size:13px; font-weight:bold; color:var(--sam-text); margin-bottom:3px; }
        .sam-card-meta { font-size:11px; color:var(--sam-sub); }
        .sam-card-desc { font-size:11px; color:var(--sam-sub); margin-top:4px; line-height:1.4; }
        /* ===== 经营/资产: 每个资产一个可折叠栏目, 展开显示全部资料(精美排版) ===== */
        .sam-asset-wrap { display:flex; flex-direction:column; gap:10px; }
        .sam-asset { background:linear-gradient(160deg,var(--sam-card),rgba(0,0,0,0.22)); border:1px solid var(--sam-border); border-radius:9px; overflow:hidden; box-shadow:0 1px 6px rgba(0,0,0,0.25); transition:box-shadow 0.2s,border-color 0.2s; }
        .sam-asset[open] { border-color:var(--sam-accent); box-shadow:0 3px 16px rgba(0,0,0,0.4); }
        .sam-asset-sum { display:flex; align-items:center; gap:8px; padding:9px 12px; cursor:pointer; user-select:none; list-style:none; background:rgba(143,159,255,0.05); }
        .sam-asset-sum::-webkit-details-marker { display:none; }
        .sam-asset-sum::after { content:'▾'; margin-left:auto; font-size:11px; color:var(--sam-sub); transition:transform 0.2s; }
        .sam-asset:not([open]) .sam-asset-sum::after { transform:rotate(-90deg); }
        .sam-asset-ico { font-size:18px; flex:0 0 auto; filter:drop-shadow(0 0 3px rgba(143,159,255,0.4)); }
        .sam-asset-name { font-size:14px; font-weight:900; color:var(--sam-text); flex:0 1 auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sam-asset-badge { font-size:10px; font-weight:bold; color:var(--sam-accent); background:rgba(143,159,255,0.14); border:1px solid rgba(143,159,255,0.28); border-radius:10px; padding:1px 8px; flex:0 0 auto; }
        .sam-asset-integ { font-size:11px; font-weight:900; padding:1px 7px; border-radius:8px; flex:0 0 auto; }
        .sam-asset-integ.good { color:#7fd6a0; background:rgba(127,214,160,0.12); }
        .sam-asset-integ.warn { color:var(--sam-thp); background:rgba(229,193,102,0.12); }
        .sam-asset-integ.bad { color:var(--sam-hp); background:rgba(228,88,125,0.12); }
        .sam-asset-body { padding:10px 12px 12px; border-top:1px solid rgba(143,159,255,0.10); display:flex; flex-direction:column; gap:10px; }
        /* 概览区: 完整度进度条 / 规模点阵 / 类型 */
        .sam-asset-overview { display:flex; flex-direction:column; gap:6px; padding:8px 10px; background:rgba(0,0,0,0.16); border-radius:6px; }
        .sam-asset-ov-row { display:flex; align-items:center; gap:8px; font-size:12px; }
        .sam-asset-ov-lbl { flex:0 0 auto; min-width:52px; color:var(--sam-sub); }
        .sam-asset-ov-val { flex:0 0 auto; color:var(--sam-text); font-weight:bold; margin-left:auto; }
        .sam-asset-bar { flex:1 1 auto; height:8px; background:rgba(0,0,0,0.35); border-radius:5px; overflow:hidden; min-width:60px; }
        .sam-asset-bar-fill { height:100%; border-radius:5px; background:var(--sam-accent); transition:width 0.3s; }
        .sam-asset-bar-fill.good { background:linear-gradient(90deg,#5db487,#7fd6a0); }
        .sam-asset-bar-fill.warn { background:linear-gradient(90deg,#c9a544,var(--sam-thp)); }
        .sam-asset-bar-fill.bad { background:linear-gradient(90deg,#c04663,var(--sam-hp)); }
        .sam-asset-bar-fill.energy { background:linear-gradient(90deg,var(--sam-ep),#8f9fff); }
        .sam-asset-scale { display:flex; align-items:center; gap:3px; flex:1 1 auto; }
        .sam-asset-dot { width:8px; height:8px; border-radius:50%; background:rgba(143,159,255,0.18); flex:0 0 auto; }
        .sam-asset-dot.on { background:var(--sam-accent); box-shadow:0 0 4px var(--sam-accent); }
        .sam-asset-scale-num { margin-left:6px; font-size:11px; color:var(--sam-sub); }
        /* 分节 */
        .sam-asset-sec { display:flex; flex-direction:column; gap:6px; }
        .sam-asset-sec-t { font-size:12px; font-weight:900; color:var(--sam-accent); padding-left:6px; border-left:3px solid var(--sam-accent); }
        .sam-asset-text { font-size:12px; color:var(--sam-text); line-height:1.6; white-space:pre-wrap; word-break:break-word; padding:6px 9px; background:rgba(0,0,0,0.16); border-radius:5px; }
        .sam-asset-none { color:var(--sam-sub); font-style:italic; opacity:0.7; }
        /* 能源 */
        .sam-asset-energy { display:flex; align-items:center; gap:8px; }
        .sam-asset-energy-num { flex:0 0 auto; font-size:11px; font-weight:bold; color:var(--sam-text); }
        /* 消耗单元 */
        .sam-asset-unit { padding:7px 9px; background:rgba(0,0,0,0.16); border-radius:5px; border-left:2px solid var(--sam-ep); display:flex; flex-direction:column; gap:5px; }
        .sam-asset-unit-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .sam-asset-unit-name { font-size:12px; font-weight:bold; color:var(--sam-text); }
        .sam-asset-unit-num { font-size:11px; color:var(--sam-sub); font-weight:bold; }
        .sam-asset-unit-bonus { margin-top:2px; }
        /* 标签 chips */
        .sam-asset-tags { display:flex; flex-wrap:wrap; gap:4px; }
        .sam-asset-tag { font-size:10px; padding:2px 8px; border-radius:9px; background:rgba(143,159,255,0.12); color:var(--sam-accent); border:1px solid rgba(143,159,255,0.22); }
        /* 建设序列 */
        .sam-asset-seq { padding:7px 9px; background:rgba(0,0,0,0.16); border-radius:5px; display:flex; flex-direction:column; gap:6px; }
        .sam-asset-seq-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .sam-asset-seq-name { font-size:12px; font-weight:900; color:var(--sam-text); }
        .sam-asset-stage { font-size:10px; font-weight:bold; padding:1px 8px; border-radius:8px; flex:0 0 auto; }
        .sam-asset-stage.s1 { color:var(--sam-sub); background:rgba(143,159,255,0.10); border:1px solid rgba(143,159,255,0.18); }
        .sam-asset-stage.s2 { color:#7fd6a0; background:rgba(127,214,160,0.12); border:1px solid rgba(127,214,160,0.28); }
        .sam-asset-stage.s3 { color:var(--sam-ep); background:rgba(143,159,255,0.14); border:1px solid rgba(143,159,255,0.30); }
        .sam-asset-stage.s4 { color:var(--sam-thp); background:rgba(229,193,102,0.14); border:1px solid rgba(229,193,102,0.32); }
        .sam-asset-stage.s5 { color:var(--sam-hp); background:rgba(228,88,125,0.14); border:1px solid rgba(228,88,125,0.32); }
        .sam-asset-seq-rows { display:flex; flex-direction:column; gap:2px; }
        .sam-asset-kv { display:flex; gap:8px; font-size:12px; line-height:1.6; padding:1px 0; }
        .sam-asset-kv .k { flex:0 0 auto; min-width:72px; color:var(--sam-sub); }
        .sam-asset-kv .v { flex:1 1 auto; color:var(--sam-text); font-weight:bold; word-break:break-word; }
        .sam-asset-seq-bonus { margin-top:2px; }
        /* 驻扎人员 */
        .sam-asset-staff { display:flex; flex-direction:column; gap:4px; }
        .sam-asset-staff-item { display:flex; justify-content:space-between; gap:8px; font-size:12px; padding:4px 9px; background:rgba(0,0,0,0.16); border-radius:5px; }
        .sam-asset-staff-name { color:var(--sam-text); font-weight:bold; }
        .sam-asset-staff-role { color:var(--sam-sub); }
        /* 待办事件 */
        .sam-asset-todo { display:flex; flex-direction:column; gap:4px; }
        .sam-asset-todo-item { font-size:12px; color:var(--sam-text); line-height:1.5; padding:5px 9px 5px 22px; position:relative; background:rgba(229,193,102,0.06); border-radius:5px; border-left:2px solid var(--sam-thp); }
        .sam-asset-todo-item::before { content:'◽'; position:absolute; left:6px; top:2px; font-size:15px; }
        /* NPC单列卡片(关系面板) */
        .sam-npc-card { padding:8px 10px; background:var(--sam-card); border:1px solid var(--sam-border); border-left:3px solid var(--sam-sub); border-radius:6px; margin-bottom:6px; cursor:pointer; transition:transform 0.15s,background 0.15s,box-shadow 0.2s; }
        .sam-npc-card:hover { transform:translateY(-1px); background:var(--sam-hover); box-shadow:0 2px 10px rgba(0,0,0,0.3); }
        .sam-npc-card.q-F{border-left-color:var(--sam-q-f);} .sam-npc-card.q-E{border-left-color:var(--sam-q-e);}
        .sam-npc-card.q-D{border-left-color:var(--sam-q-d);} .sam-npc-card.q-C{border-left-color:var(--sam-q-c);}
        .sam-npc-card.q-B{border-left-color:var(--sam-q-b);} .sam-npc-card.q-A{border-left-color:var(--sam-q-a);}
        .sam-npc-card.q-S{border-left-color:var(--sam-q-s);} .sam-npc-card.q-SS{border-left-color:var(--sam-q-ss);}
        .sam-npc-card.q-SSS{border-left-color:var(--sam-q-sss);}
        .sam-npc-name { font-size:13px; font-weight:bold; color:var(--sam-text); margin-bottom:4px; }
        .sam-npc-head { display:flex; gap:8px; align-items:center; margin-bottom:6px; }
        .sam-npc-avatar { position:relative; width:54px; height:66px; border-radius:6px; overflow:hidden; background:rgba(0,0,0,0.25); border:1px solid var(--sam-border); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:box-shadow 0.2s, transform 0.15s; }
        .sam-npc-avatar:hover { box-shadow:0 0 12px rgba(143,159,255,0.4); transform:translateY(-1px); }
        .sam-npc-avatar img { width:100%; height:100%; object-fit:cover; object-position:center top; }
        .sam-npc-avatar-ph { font-size:20px; opacity:0.55; }
        .sam-npc-avatar.has-img .sam-npc-avatar-ph { display:none; }
        .sam-npc-portrait-btn { flex-shrink:0; padding:4px 8px; font-size:11px; color:var(--sam-accent); background:rgba(143,159,255,0.1); border:1px solid rgba(143,159,255,0.3); border-radius:4px; cursor:pointer; line-height:1.4; white-space:nowrap; }
        .sam-npc-portrait-btn:hover { background:rgba(143,159,255,0.22); }
        .sam-npc-head-info { flex:1; min-width:0; }
        .sam-npc-head-name { font-size:14px; font-weight:bold; color:var(--sam-text); line-height:1.3; word-break:break-all; display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
        .sam-npc-form-tag { font-size:11px; font-weight:bold; font-style:italic; color:var(--sam-thp); background:rgba(102,170,170,0.15); border:1px solid rgba(102,170,170,0.35); padding:1px 6px; border-radius:8px; white-space:nowrap; }
        .sam-npc-del { position:absolute; top:4px; right:4px; width:20px; height:20px; border-radius:4px; background:rgba(180,40,30,0.85); color:#fff; border:none; cursor:pointer; font-size:13px; line-height:1; display:flex; align-items:center; justify-content:center; flex-shrink:0; z-index:2; }
        .sam-npc-del:hover { background:rgba(220,60,40,1); }
        .sam-npc-card { position:relative; }
        .sam-npc-row { font-size:11px; color:var(--sam-sub); line-height:1.5; }
        .sam-npc-row .k { color:var(--sam-accent); font-weight:bold; }
        .sam-npc-row .v { color:var(--sam-text); }
        .sam-npc-quote { font-size:11px; color:var(--sam-sub); font-style:italic; margin-top:4px; padding:4px 8px; border-left:2px solid var(--sam-border); background:rgba(0,0,0,0.15); border-radius:0 4px 4px 0; line-height:1.5; }
        .sam-npc-quote::before { content:'💬 '; }
        /* 原生伸缩框(NPC在场面板折叠区) */
        .sam-npc-details { margin-top:6px; }
        .sam-npc-details > summary { font-size:11px; color:var(--sam-accent); cursor:pointer; padding:3px 6px; background:rgba(143,159,255,0.08); border-radius:4px; user-select:none; list-style:none; }
        .sam-npc-details > summary::-webkit-details-marker { display:none; }
        .sam-npc-details > summary::before { content:'▸ '; }
        .sam-npc-details[open] > summary::before { content:'▾ '; }
        .sam-npc-details[open] > summary { margin-bottom:4px; }
        /* NPC卡片内紧凑进度条(HP/EP/THP) */
        .sam-npc-bars { display:flex; flex-direction:column; gap:4px; margin:6px 0 4px; }
        .sam-npc-bar { display:flex; align-items:center; gap:6px; }
        .sam-npc-bar .lbl { font-size:10px; font-weight:bold; width:28px; flex-shrink:0; }
        .sam-npc-bar .trk { flex:1; height:9px; background:var(--sam-dark); border-radius:5px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); position:relative; }
        .sam-npc-bar .fl { height:100%; border-radius:5px; transition:width 0.5s cubic-bezier(0.2,0.8,0.2,1); }
        .sam-npc-bar .num { font-size:10px; color:var(--sam-sub); width:64px; text-align:right; flex-shrink:0; }
        /* NPC卡片字段网格(种族/身份等双列排版) */
        .sam-npc-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 12px; margin:4px 0; }
        .sam-npc-grid .sam-npc-row { font-size:11px; line-height:1.5; }
        .sam-npc-sec { height:0; margin:6px 0; border:0; border-top:1px solid rgba(143,159,255,0.16); padding:0; font-size:0; }
        /* 技能可伸缩分组(形态/血统技能用) */
        .sam-skill-group { margin:4px 0 6px; }
        .sam-skill-group > summary { font-size:12px; font-weight:bold; color:var(--sam-accent); cursor:pointer; padding:4px 8px; background:rgba(143,159,255,0.08); border-radius:4px; user-select:none; list-style:none; border-left:3px solid var(--sam-accent); }
        .sam-skill-group > summary::-webkit-details-marker { display:none; }
        .sam-skill-group > summary::before { content:'▸ '; }
        .sam-skill-group[open] > summary::before { content:'▾ '; }
        .sam-skill-group[open] > summary { margin-bottom:4px; }
        .sam-skill-group .sam-card-list { grid-template-columns:1fr; margin-top:4px; }
        /* ===== 详情弹窗精美排版 ===== */
        .sam-detail { padding:4px 2px; }
        .sam-detail .sam-stat-grid { grid-template-columns:repeat(6,1fr); gap:3px; }
        .sam-detail .sam-stat-cell { padding:2px 0; background:rgba(0,0,0,0.25); }
        .sam-detail .sam-stat-cell .sn { font-size:9px; }
        .sam-detail .sam-stat-cell .sv { font-size:12px; }
        .sam-detail-sec { font-size:12px; font-weight:900; color:var(--sam-accent); margin:10px 0 5px; padding:3px 8px; border-left:3px solid var(--sam-accent); background:rgba(143,159,255,0.06); border-radius:0 4px 4px 0; }
        .sam-detail-sec:first-child { margin-top:0; }
        .sam-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:1px 14px; }
        .sam-detail-grid .sam-d-row { display:flex; gap:6px; font-size:12px; line-height:1.6; padding:2px 0; border-bottom:1px dashed rgba(143,159,255,0.06); }
        .sam-detail-grid .sam-d-row .k { color:var(--sam-sub); flex:0 0 auto; min-width:52px; }
        .sam-detail-grid .sam-d-row .v { color:var(--sam-text); font-weight:bold; }
        .sam-d-block { margin:4px 0 8px; }
        .sam-d-block .sam-d-label { font-size:11px; font-weight:bold; color:var(--sam-accent); margin-bottom:2px; }
        .sam-d-block .sam-d-content { font-size:12px; color:var(--sam-text); line-height:1.6; text-align:left; word-break:break-word; white-space:pre-wrap; padding:5px 8px; background:rgba(0,0,0,0.18); border-radius:4px; border-left:2px solid var(--sam-border); }
        .sam-d-tags { display:flex; flex-wrap:wrap; gap:4px; padding:2px 0; }
        .sam-d-tag { font-size:11px; padding:2px 8px; border-radius:10px; background:rgba(143,159,255,0.14); color:var(--sam-accent); border:1px solid rgba(143,159,255,0.25); }
        .sam-d-sub { margin:4px 0 6px; }
        .sam-d-sub > summary { font-size:12px; font-weight:bold; color:var(--sam-accent); cursor:pointer; padding:4px 8px; background:rgba(143,159,255,0.08); border-radius:4px; user-select:none; list-style:none; border-left:3px solid var(--sam-accent); }
        .sam-d-sub > summary::-webkit-details-marker { display:none; }
        .sam-d-sub > summary::before { content:'▸ '; }
        .sam-d-sub[open] > summary::before { content:'▾ '; }
        .sam-d-sub[open] > summary { margin-bottom:4px; }
        .sam-d-sub-body { padding:4px 0 0 10px; border-left:2px solid rgba(143,159,255,0.12); margin-left:4px; }
        @media (max-width:768px) { .sam-detail-grid { grid-template-columns:1fr; } }
        .sam-sec { margin:8px 0; }
        .sam-sec:first-child { margin-top:0; }
        .sam-sec > .sam-sec-sum { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:900; color:var(--sam-accent); cursor:pointer; padding:4px 8px; border-left:3px solid var(--sam-accent); background:rgba(143,159,255,0.06); border-radius:0 4px 4px 0; user-select:none; list-style:none; }
        .sam-sec > .sam-sec-sum::-webkit-details-marker { display:none; }
        .sam-sec > .sam-sec-sum::before { content:'▾ '; }
        .sam-sec:not([open]) > .sam-sec-sum::before { content:'▸ '; }
        .sam-sec > .sam-sec-sum .sam-sec-title { flex:1 1 auto; min-width:0; }
        .sam-sec > .sam-sec-sum .sam-sec-cnt { font-size:11px; font-weight:normal; color:var(--sam-sub); margin-left:4px; }
        .sam-sec > .sam-sec-sum .sam-rumor-clear-btn { flex:0 0 auto; padding:2px 8px; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid var(--sam-hp); color:var(--sam-hp); background:rgba(228,88,125,0.08); cursor:pointer; }
        .sam-sec > .sam-sec-sum .sam-rumor-clear-btn:hover { background:var(--sam-hp); color:#fff; }
        .sam-sec > .sam-sec-body { margin-top:4px; }
        /* 传闻: 顶部一键删除全部 + 单条删除 + 交易按钮 */
        .sam-rumor-toolbar { display:flex; justify-content:flex-end; gap:6px; margin-bottom:6px; }
        .sam-rumor-clearall-btn { padding:4px 10px; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid var(--sam-hp); color:var(--sam-hp); background:rgba(228,88,125,0.10); cursor:pointer; }
        .sam-rumor-clearall-btn:hover { background:var(--sam-hp); color:#fff; }
        .sam-rumor-del-btn { flex:0 0 auto; width:20px; height:20px; border-radius:4px; border:1px solid var(--sam-hp); background:rgba(228,88,125,0.10); color:var(--sam-hp); cursor:pointer; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; padding:0; }
        .sam-rumor-del-btn:hover { background:var(--sam-hp); color:#fff; }
        .sam-rumor-trade-btn { margin-left:6px; padding:1px 8px; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid var(--sam-thp); color:var(--sam-thp); background:rgba(229,193,102,0.10); cursor:pointer; }
        .sam-rumor-trade-btn:hover { background:var(--sam-thp); color:#1a1a1a; }
        .sam-rumor-price { display:inline-flex; align-items:center; gap:4px; }
        /* 确认弹窗: 宽度自适应 + 长文可滚 + 触控热区 */
        .sam-confirm-box {
            width:min(360px, 100%); min-width:0; max-width:100%; margin:auto;
            max-height:calc(100vh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            max-height:calc(100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
            overflow-x:hidden; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;
            background:var(--sam-bg); border:1px solid var(--sam-accent); border-radius:10px;
            padding:16px; box-shadow:0 12px 40px rgba(0,0,0,0.7); box-sizing:border-box;
        }
        .sam-confirm-title { font-size:14px; font-weight:900; color:var(--sam-accent); margin-bottom:10px; }
        .sam-confirm-body { font-size:12px; color:var(--sam-text); line-height:1.5; margin-bottom:14px; word-break:break-word; overflow-wrap:anywhere; }
        .sam-confirm-actions { display:flex; justify-content:flex-end; gap:8px; }
        .sam-confirm-btn { min-height:40px; min-width:72px; padding:10px 16px; font-size:13px; font-weight:bold; border-radius:6px; border:1px solid var(--sam-border); background:rgba(143,159,255,0.10); color:var(--sam-text); cursor:pointer; }
        .sam-confirm-btn.ok { border-color:var(--sam-hp); color:var(--sam-hp); }
        .sam-confirm-btn.ok:hover { background:var(--sam-hp); color:#fff; }
        .sam-confirm-btn.cancel:hover { background:rgba(143,159,255,0.25); }
        @media (max-width:768px) { .sam-sec > .sam-sec-sum { font-size:12px; padding:3px 6px; } }
        .sam-row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; padding:4px 0; border-bottom:1px dashed rgba(143,159,255,0.08); font-size:12px; }
        .sam-row .k { color:var(--sam-sub); flex:0 0 auto; min-width:60px; }
        .sam-row .v { color:var(--sam-text); font-weight:bold; text-align:right; flex:1; word-break:break-word; overflow-wrap:anywhere; }
        .sam-empty { color:var(--sam-sub); font-size:12px; text-align:center; padding:14px 0; font-style:italic; opacity:0.7; }
        /* 经营面板空状态: 引导说明(能做什么/怎么获得), 替代干瘪的[无资产] */
        .sam-asset-empty { padding:18px 16px; color:var(--sam-sub); }
        .sam-asset-empty .ae-title { font-size:14px; font-weight:bold; color:var(--sam-text); text-align:center; margin-bottom:10px; }
        .sam-asset-empty .ae-desc { font-size:11.5px; line-height:1.7; color:var(--sam-sub); }
        .sam-asset-empty .ae-section { margin-top:12px; }
        .sam-asset-empty .ae-h { font-size:11.5px; font-weight:bold; color:var(--sam-accent); margin-bottom:4px; }
        .sam-asset-empty ul { margin:0; padding-left:16px; }
        .sam-asset-empty li { font-size:11.5px; line-height:1.7; color:var(--sam-sub); }
        .sam-asset-empty li b { color:var(--sam-text); font-weight:bold; }
        /* ===== NPC角色档案(详情弹窗专用, 替代通用dump式渲染) ===== */
        .sam-nd { padding:2px; }
        .sam-nd-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding-bottom:8px; border-bottom:1px solid var(--sam-border); margin-bottom:8px; }
        .sam-nd-name { font-size:16px; font-weight:900; color:var(--sam-text); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .sam-nd-form { font-size:11px; font-weight:bold; font-style:italic; color:var(--sam-thp); background:rgba(102,170,170,0.15); border:1px solid rgba(102,170,170,0.35); padding:2px 8px; border-radius:10px; }
        .sam-nd-badges { display:flex; gap:5px; align-items:center; }
        .sam-nd-tier { font-size:13px; font-weight:900; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(0,0,0,0.3); border:1px solid currentColor; }
        .sam-nd-badge { font-size:10px; font-weight:bold; padding:2px 8px; border-radius:8px; }
        .sam-nd-badge.present { color:#56bf7b; background:rgba(86,191,123,0.14); border:1px solid rgba(86,191,123,0.4); }
        .sam-nd-badge.team { color:var(--sam-thp); background:rgba(229,193,102,0.14); border:1px solid rgba(229,193,102,0.4); }
        .sam-nd-favor { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .sam-nd-favor-lbl { font-size:11px; color:var(--sam-sub); flex-shrink:0; }
        .sam-nd-favor-track { position:relative; flex:1; height:8px; background:rgba(0,0,0,0.3); border-radius:5px; overflow:hidden; border:1px solid rgba(255,255,255,0.06); }
        .sam-nd-favor-track::before { content:''; position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.25); z-index:1; }
        .sam-nd-favor-fill { position:absolute; top:0; bottom:0; border-radius:2px; transition:width 0.4s; }
        .sam-nd-favor-fill.pos { left:50%; }
        .sam-nd-favor-fill.neg { right:50%; }
        .sam-nd-favor-val { font-size:12px; font-weight:900; min-width:36px; text-align:right; }
        .sam-nd-sec-lbl { font-size:11px; font-weight:900; color:var(--sam-accent); margin:10px 0 5px; padding:3px 8px; border-left:3px solid var(--sam-accent); background:rgba(143,159,255,0.06); border-radius:0 4px 4px 0; }
        .sam-nd-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; margin-bottom:8px; }
        .sam-nd-row { display:flex; gap:6px; font-size:12px; line-height:1.7; padding:2px 0; border-bottom:1px dashed rgba(143,159,255,0.06); }
        .sam-nd-row .k { color:var(--sam-sub); flex:0 0 auto; min-width:42px; }
        .sam-nd-row .v { color:var(--sam-text); font-weight:bold; word-break:break-all; }
        .sam-nd-bars { display:flex; flex-direction:column; gap:5px; margin-bottom:6px; }
        .sam-nd-attrs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
        .sam-nd-attr { display:flex; flex-direction:column; align-items:center; padding:4px 10px; background:rgba(0,0,0,0.25); border:1px solid var(--sam-border); border-radius:6px; min-width:54px; }
        .sam-nd-attr .k { font-size:10px; color:var(--sam-sub); }
        .sam-nd-attr .v { font-size:14px; font-weight:900; color:var(--sam-text); }
        .sam-nd-block { margin:4px 0 8px; }
        .sam-nd-block-lbl { font-size:11px; font-weight:bold; color:var(--sam-accent); margin-bottom:2px; }
        .sam-nd-block-ct { font-size:12px; color:var(--sam-text); line-height:1.7; word-break:break-word; white-space:pre-wrap; padding:6px 10px; background:rgba(0,0,0,0.18); border-radius:5px; border-left:2px solid var(--sam-accent); }
        .sam-nd-quote { font-size:12px; color:var(--sam-sub); font-style:italic; margin:6px 0 10px; padding:6px 10px; border-left:3px solid var(--sam-thp); background:rgba(229,193,102,0.06); border-radius:0 5px 5px 0; line-height:1.6; }
        .sam-nd-sub { margin:4px 0; }
        .sam-nd-sub > summary { font-size:12px; font-weight:bold; color:var(--sam-accent); cursor:pointer; padding:4px 8px; background:rgba(143,159,255,0.08); border-radius:4px; user-select:none; list-style:none; border-left:3px solid var(--sam-accent); }
        .sam-nd-sub > summary::-webkit-details-marker { display:none; }
        .sam-nd-sub > summary::before { content:'▸ '; }
        .sam-nd-sub[open] > summary::before { content:'▾ '; }
        .sam-nd-sub[open] > summary { margin-bottom:4px; }
        .sam-nd-sub-body { padding:4px 0 0 10px; border-left:2px solid rgba(143,159,255,0.12); margin-left:4px; }
        @media (max-width:520px) { .sam-nd-grid { grid-template-columns:1fr; } }
        /* ===== 武器攻击面板(主角衍生属性 + NPC详情最终属性) ===== */
        .sam-wpn-divider { font-size:11px; font-weight:bold; color:var(--sam-accent); margin:10px 0 5px; padding-bottom:3px; border-bottom:1px solid rgba(143,159,255,0.15); }
        .sam-wpn-list { display:flex; flex-direction:column; gap:5px; }
        .sam-wpn-row { display:flex; flex-direction:column; gap:3px; padding:5px 10px; border-radius:5px; background:rgba(0,0,0,0.15); border:1px solid var(--sam-border); }
        .sam-wpn-row.base { background:rgba(143,159,255,0.04); border-style:dashed; border-color:rgba(143,159,255,0.2); }
        .sam-wpn-name { font-size:12px; font-weight:bold; color:var(--sam-text); }
        .sam-wpn-row.base .sam-wpn-name { color:var(--sam-sub); font-weight:normal; }
        .sam-wpn-stat { display:flex; justify-content:space-between; align-items:center; font-size:11px; padding:3px 8px; border-radius:4px; }
        .sam-wpn-stat.atk { color:var(--sam-hp); background:rgba(228,88,125,0.1); border:1px solid rgba(228,88,125,0.2); }
        .sam-wpn-stat.matk { color:var(--sam-accent); background:rgba(143,159,255,0.1); border:1px solid rgba(143,159,255,0.2); }
        .sam-wpn-stat b { font-weight:900; font-size:13px; }
        .sam-nd-wpn { display:flex; flex-direction:column; gap:5px; margin-bottom:8px; }
        .sam-nd-wpn-row { display:flex; flex-direction:column; gap:3px; padding:5px 10px; border-radius:5px; background:rgba(0,0,0,0.2); border:1px solid var(--sam-border); }
        .sam-nd-wpn-row.base { background:rgba(143,159,255,0.04); border-style:dashed; border-color:rgba(143,159,255,0.2); }
        .sam-nd-wpn-row .nm { font-size:12px; font-weight:bold; color:var(--sam-text); }
        .sam-nd-wpn-row.base .nm { color:var(--sam-sub); font-weight:normal; }
        .sam-nd-wpn-row .atk { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--sam-hp); background:rgba(228,88,125,0.1); padding:3px 8px; border-radius:4px; }
        .sam-nd-wpn-row .matk { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--sam-accent); background:rgba(143,159,255,0.1); padding:3px 8px; border-radius:4px; }
        .sam-nd-wpn-row .atk b, .sam-nd-wpn-row .matk b { font-weight:900; font-size:13px; }
        /* ===== 物资转移弹窗(向在场NPC转移装备/道具) ===== */
        .sam-npc-transfer { position:absolute; top:4px; z-index:2; padding:3px 8px; font-size:10px; font-weight:bold; color:var(--sam-thp); background:rgba(229,193,102,0.12); border:1px solid rgba(229,193,102,0.4); border-radius:5px; cursor:pointer; line-height:1.4; white-space:nowrap; }
        .sam-npc-transfer:hover { background:rgba(229,193,102,0.28); box-shadow:0 0 8px rgba(229,193,102,0.3); }
        /* 转移列表：不再固定 50vh 嵌套滚动，交给 .sam-modal-body 单层滚 */
        .sam-trf-list { padding:2px; }
        .sam-trf-sec { font-size:11px; font-weight:900; color:var(--sam-accent); margin:8px 0 5px; padding:3px 8px; border-left:3px solid var(--sam-accent); background:rgba(143,159,255,0.06); border-radius:0 4px 4px 0; }
        .sam-trf-sec:first-child { margin-top:0; }
        .sam-trf-item { position:relative; padding:8px 10px; margin-bottom:6px; background:var(--sam-card); border:1px solid var(--sam-border); border-left:3px solid var(--sam-sub); border-radius:6px; cursor:pointer; transition:transform 0.15s,box-shadow 0.15s,border-color 0.15s; }
        .sam-trf-item:hover { transform:translateY(-1px); box-shadow:0 2px 10px rgba(0,0,0,0.3); }
        .sam-trf-item.selected { background:linear-gradient(180deg,rgba(22,30,46,0.7),rgba(143,159,255,0.08)); border-color:var(--sam-accent); box-shadow:0 0 0 1px rgba(143,159,255,0.35),0 0 12px rgba(143,159,255,0.18); }
        .sam-trf-item.selected { border-left-color:var(--sam-accent); }
        .sam-trf-head { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:2px; }
        .sam-trf-name { font-size:13px; font-weight:bold; color:var(--sam-text); word-break:break-all; }
        .sam-trf-qtag { font-size:11px; font-weight:900; padding:1px 7px; border-radius:4px; border:1px solid currentColor; flex-shrink:0; }
        .sam-trf-qtag.q-F{color:var(--sam-q-f);} .sam-trf-qtag.q-E{color:var(--sam-q-e);} .sam-trf-qtag.q-D{color:var(--sam-q-d);} .sam-trf-qtag.q-C{color:var(--sam-q-c);}
        .sam-trf-qtag.q-B{color:var(--sam-q-b);} .sam-trf-qtag.q-A{color:var(--sam-q-a);} .sam-trf-qtag.q-S{color:var(--sam-q-s);} .sam-trf-qtag.q-SS{color:var(--sam-q-ss);} .sam-trf-qtag.q-SSS{color:var(--sam-q-sss);}
        .sam-trf-sub { font-size:11px; color:var(--sam-sub); margin-bottom:3px; }
        .sam-trf-attrs { font-size:11px; color:var(--sam-thp); margin-bottom:3px; font-weight:bold; }
        .sam-trf-desc { font-size:11px; color:var(--sam-sub); line-height:1.5; }
        .sam-trf-corner { position:absolute; right:-1px; bottom:-1px; background:var(--sam-accent); color:#0a0e14; font-size:10px; font-weight:bold; padding:2px 8px; border-top-left-radius:6px; border-bottom-right-radius:8px; box-shadow:0 0 6px rgba(143,159,255,0.5); display:none; }
        .sam-trf-item.selected .sam-trf-corner { display:block; }
        .sam-trf-qty { display:flex; align-items:center; gap:6px; margin-top:6px; }
        .sam-trf-qty-btn { width:26px; height:26px; border:1px solid var(--sam-accent); background:rgba(143,159,255,0.1); color:var(--sam-accent); border-radius:5px; cursor:pointer; font-size:15px; font-weight:bold; line-height:1; padding:0; }
        .sam-trf-qty-btn:hover { background:rgba(143,159,255,0.25); }
        .sam-trf-qty-inp { width:52px; text-align:center; background:rgba(0,0,0,0.3); border:1px solid var(--sam-border); color:var(--sam-text); border-radius:5px; padding:3px 4px; font-size:12px; font-weight:bold; }
        .sam-trf-qty-max { font-size:11px; color:var(--sam-sub); }
        .sam-trf-footer { flex-shrink:0; margin-top:10px; padding-top:10px; border-top:1px solid var(--sam-border); }
        .sam-trf-warn { font-size:11px; color:var(--sam-hp); line-height:1.6; margin-bottom:8px; padding:6px 10px; background:rgba(228,88,125,0.08); border:1px solid rgba(228,88,125,0.25); border-radius:5px; }
        .sam-trf-warn strong { color:var(--sam-hp); font-weight:900; }
        .sam-trf-actions { display:flex; gap:8px; justify-content:flex-end; }
        .sam-trf-btn { min-height:40px; padding:10px 18px; font-size:13px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid var(--sam-border); transition:all 0.18s; }
        .sam-trf-btn.cancel { background:rgba(143,159,255,0.1); color:var(--sam-text); }
        .sam-trf-btn.cancel:hover { background:rgba(143,159,255,0.22); }
        .sam-trf-btn.confirm { background:rgba(228,88,125,0.15); color:var(--sam-hp); border-color:var(--sam-hp); }
        .sam-trf-btn.confirm:hover:not(:disabled) { background:var(--sam-hp); color:#fff; box-shadow:0 0 10px rgba(228,88,125,0.5); }
        .sam-trf-btn.confirm:disabled { opacity:0.4; cursor:not-allowed; }

        /* 子Tab */
        .sam-subtabs { display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap; }
        .sam-subtab { padding:4px 10px; font-size:11px; border-radius:4px; cursor:pointer; border:1px solid var(--sam-border); color:var(--sam-sub); background:var(--sam-card); }
        .sam-subtab:hover { color:var(--sam-text); }
        .sam-subtab.active { color:#fff; background:var(--sam-accent); border-color:var(--sam-accent); }

        /* 编辑器 */
        .sam-edit-field { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
        .sam-edit-label { font-size:11px; color:var(--sam-sub); min-width:70px; }
        .sam-edit-input { flex:1; background:var(--sam-input-bg); border:1px solid var(--sam-border); color:var(--sam-text); padding:3px 6px; border-radius:3px; font-size:12px; min-width:0; }
        .sam-edit-input:focus { outline:none; border-color:var(--sam-accent); box-shadow:0 0 4px var(--sam-accent); }
        .sam-edit-readonly { color:var(--sam-sub); font-style:italic; font-size:11px; }
        /* 点击即编辑: 显示态(文本+✎角标, 不变形) */
        .sam-ed-wrap { display:inline-flex; align-items:center; gap:2px; cursor:pointer; border-radius:3px; padding:0 3px; transition:background 0.12s; position:relative; max-width:100%; }
        .sam-ed-wrap:hover { background:rgba(143,159,255,0.14); }
        .sam-ed-wrap .sam-ed-val { color:var(--sam-text); font-weight:bold; word-break:break-word; overflow-wrap:anywhere; }
        .sam-ed-wrap .sam-ed-ph { color:var(--sam-sub); font-style:italic; font-weight:normal; opacity:0.7; }
        .sam-ed-wrap .sam-ed-ico { font-size:10px; color:var(--sam-sub); opacity:0; transition:opacity 0.12s; }
        .sam-ed-wrap:hover .sam-ed-ico { opacity:1; }
        .sam-ed-wrap.editing { background:rgba(143,159,255,0.10); }
        .sam-ed-wrap .sam-edit-active { flex:1; min-width:60px; max-width:100%; background:var(--sam-input-bg); border:1px solid var(--sam-accent); color:var(--sam-text); padding:2px 4px; border-radius:3px; font-size:12px; box-shadow:0 0 4px rgba(143,159,255,0.4); }
        .sam-ed-wrap .sam-edit-active:focus { outline:none; }
        .sam-ed-wrap .sam-edit-active[type="number"] { max-width:90px; }
        /* 在.card-meta等紧凑容器里也保持inline */
        .sam-card-meta .sam-ed-wrap, .sam-card-meta .sam-ed-val { display:inline; }
        .sam-edit-badge { position:fixed; top:8px; right:50%; transform:translateX(50%); background:var(--sam-accent); color:#fff; padding:3px 12px; border-radius:12px; font-size:11px; font-weight:bold; z-index:999999; box-shadow:0 0 10px var(--sam-accent); }
        .sam-save-btn { position:fixed; bottom:10px; left:10px; z-index:999999; padding:3px 9px; border-radius:10px; border:none; background:var(--sam-accent); color:#fff; font-size:10px; font-weight:bold; cursor:pointer; box-shadow:0 1px 6px rgba(0,0,0,0.4); }
        .sam-save-btn:hover { transform:scale(1.05); }

        /* 弹窗(必须高于面板999998) — 遮罩不滚，仅 .sam-modal-body 单层滚动 */
        #samsara-modal {
            position:fixed; top:0; left:0; width:100vw; height:100vh; height:100dvh; z-index:1000000;
            display:none; align-items:center; justify-content:center;
            background:var(--sam-modal-overlay); backdrop-filter:blur(4px);
            overflow:hidden;
            padding:max(8px, env(safe-area-inset-top, 0px), 3dvh) 12px max(8px, env(safe-area-inset-bottom, 0px), 3dvh);
            box-sizing:border-box;
        }
        #samsara-modal.open { display:flex; animation:samFade 0.2s; }
        @keyframes samFade { from{opacity:0;} to{opacity:1;} }

        .sam-modal-box {
            width:520px; max-width:100%; margin:0 auto;
            max-height:100%;
            display:flex; flex-direction:column; box-sizing:border-box;
            background:var(--sam-bg); border:1px solid var(--sam-accent); border-radius:10px;
            box-shadow:0 12px 40px rgba(0,0,0,0.7); color:var(--sam-text);
            min-height:0; overflow:hidden;
        }
        .sam-modal-head { flex-shrink:0; display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--sam-border); font-weight:900; gap:8px; }
        .sam-modal-head > span:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sam-modal-body {
            flex:1 1 auto; min-height:0;
            overflow-x:hidden; overflow-y:auto;
            -webkit-overflow-scrolling:touch; overscroll-behavior:contain; touch-action:pan-y;
            padding:12px 16px;
        }
        .sam-modal-body::-webkit-scrollbar { width:6px; }
        .sam-modal-body::-webkit-scrollbar-thumb { background:var(--sam-border); border-radius:3px; }
        .sam-modal-close { cursor:pointer; color:var(--sam-hp); font-size:20px; line-height:1; padding:4px 6px; flex-shrink:0; min-width:32px; min-height:32px; display:inline-flex; align-items:center; justify-content:center; }
        /* 内联完整资料卡片(装备/道具/技能/血统/形态) */
        .sam-full-card { padding:8px 10px; background:linear-gradient(180deg,var(--sam-card),rgba(0,0,0,0.15)); border:1px solid var(--sam-border); border-left:3px solid var(--sam-sub); border-radius:6px; margin-bottom:6px; transition:box-shadow 0.2s; }
        /* 单列列表(任务/传闻 一条一排) */
        .sam-list-1col { display:flex; flex-direction:column; gap:6px; }
        .sam-list-1col .sam-full-card { margin-bottom:0; }
        .sam-card-list { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .sam-card-list .sam-full-card { margin-bottom:0; }
        .sam-card-list .sam-empty { grid-column:1/-1; }
        .sam-card-list .sam-empty { grid-column:1/-1; }
        .sam-full-card:hover { box-shadow:0 2px 12px rgba(0,0,0,0.4); }
        .sam-full-card.q-F{border-left-color:var(--sam-q-f);} .sam-full-card.q-E{border-left-color:var(--sam-q-e);}
        .sam-full-card.q-D{border-left-color:var(--sam-q-d);} .sam-full-card.q-C{border-left-color:var(--sam-q-c);}
        .sam-full-card.q-B{border-left-color:var(--sam-q-b);} .sam-full-card.q-A{border-left-color:var(--sam-q-a);}
        .sam-full-card.q-S{border-left-color:var(--sam-q-s);} .sam-full-card.q-SS{border-left-color:var(--sam-q-ss);}
        .sam-full-card.q-SSS{border-left-color:var(--sam-q-sss);box-shadow:0 0 8px rgba(255,77,77,0.2);}
        .sam-fc-head { display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px; }
        .sam-fc-title { font-size:14px; font-weight:900; color:var(--sam-text); flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sam-fc-head .sam-act-btn { flex:0 0 auto; flex-shrink:0; }
        .sam-fc-q { font-size:11px; font-weight:900; padding:1px 6px; border-radius:3px; border:1px solid; min-width:34px; text-align:center; }
        .sam-fc-q.q-F { color:var(--sam-q-f); border-color:var(--sam-q-f); background:rgba(148,163,184,0.14); }
        .sam-fc-q.q-E { color:var(--sam-q-e); border-color:var(--sam-q-e); background:rgba(248,250,252,0.10); }
        .sam-fc-q.q-D { color:var(--sam-q-d); border-color:var(--sam-q-d); background:rgba(34,197,94,0.14); }
        .sam-fc-q.q-C { color:var(--sam-q-c); border-color:var(--sam-q-c); background:rgba(59,130,246,0.14); }
        .sam-fc-q.q-B { color:var(--sam-q-b); border-color:var(--sam-q-b); background:rgba(168,85,247,0.16); }
        .sam-fc-q.q-A { color:var(--sam-q-a); border-color:var(--sam-q-a); background:rgba(249,115,22,0.16); }
        .sam-fc-q.q-S { color:var(--sam-q-s); border-color:var(--sam-q-s); background:rgba(234,179,8,0.16); text-shadow:0 0 4px rgba(234,179,8,0.5); }
        .sam-fc-q.q-SS { color:var(--sam-q-ss); border-color:var(--sam-q-ss); background:rgba(239,68,68,0.18); text-shadow:0 0 4px rgba(239,68,68,0.6); }
        .sam-fc-q.q-SSS { color:var(--sam-q-sss); border-color:var(--sam-q-sss); background:rgba(236,72,153,0.20); text-shadow:0 0 5px rgba(236,72,153,0.7); box-shadow:0 0 6px rgba(236,72,153,0.4); }
        /* 层级字母(顶部主角层级 / 进度条左右层级 / NPC层级): 按档着色, 与品质徽章同色板 */
        .sam-hero-tier.q-F,.sam-tier-side.q-F,.sam-npc-tier.q-F,.sam-nd-tier.q-F { color:var(--sam-q-f); }
        .sam-hero-tier.q-E,.sam-tier-side.q-E,.sam-npc-tier.q-E,.sam-nd-tier.q-E { color:var(--sam-q-e); }
        .sam-hero-tier.q-D,.sam-tier-side.q-D,.sam-npc-tier.q-D,.sam-nd-tier.q-D { color:var(--sam-q-d); }
        .sam-hero-tier.q-C,.sam-tier-side.q-C,.sam-npc-tier.q-C,.sam-nd-tier.q-C { color:var(--sam-q-c); }
        .sam-hero-tier.q-B,.sam-tier-side.q-B,.sam-npc-tier.q-B,.sam-nd-tier.q-B { color:var(--sam-q-b); }
        .sam-hero-tier.q-A,.sam-tier-side.q-A,.sam-npc-tier.q-A,.sam-nd-tier.q-A { color:var(--sam-q-a); }
        .sam-hero-tier.q-S,.sam-tier-side.q-S,.sam-npc-tier.q-S,.sam-nd-tier.q-S { color:var(--sam-q-s); text-shadow:0 0 4px rgba(234,179,8,0.5); }
        .sam-hero-tier.q-SS,.sam-tier-side.q-SS,.sam-npc-tier.q-SS,.sam-nd-tier.q-SS { color:var(--sam-q-ss); text-shadow:0 0 5px rgba(239,68,68,0.6); }
        .sam-hero-tier.q-SSS,.sam-tier-side.q-SSS,.sam-npc-tier.q-SSS,.sam-nd-tier.q-SSS { color:var(--sam-q-sss); text-shadow:0 0 6px rgba(236,72,153,0.7); }
        .sam-fc-rows { font-size:12px; }
        .sam-fc-rows .sam-row { padding:3px 0; }
        .sam-fc-rows .sam-row .v { max-width:75%; }
        /* 效果/描述 全宽块(标签在上, 内容左对齐独占整行) */
        .sam-fc-body { margin-top:4px; }
        .sam-fc-block { margin-bottom:5px; }
        .sam-fc-block .sam-fc-label { font-size:11px; font-weight:bold; color:var(--sam-sub); margin-bottom:2px; }
        .sam-fc-block .sam-fc-content { font-size:12px; color:var(--sam-text); text-align:left; line-height:1.6; word-break:break-word; white-space:pre-wrap; padding-left:2px; }
        .sam-fc-block .sam-fc-content.sam-fc-effects { padding-left:0; }
        /* 装备/道具操作按钮栏 */
        .sam-fc-actions { display:flex; flex-wrap:wrap; gap:5px; padding:4px 2px 2px; }
        .sam-act-btn { padding:3px 9px; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid var(--sam-border); background:rgba(143,159,255,0.10); color:var(--sam-text); cursor:pointer; transition:background 0.12s,border-color 0.12s,transform 0.1s; }
        .sam-act-btn:hover { background:var(--sam-accent); border-color:var(--sam-accent); color:#fff; transform:translateY(-1px); }
        .sam-act-btn:active { transform:translateY(0); }
        .sam-act-btn[data-act="delete"] { border-color:var(--sam-hp); color:var(--sam-hp); }
        .sam-act-btn[data-act="delete"]:hover { background:var(--sam-hp); border-color:var(--sam-hp); color:#fff; }
        .sam-act-btn[data-act="wear"] { border-color:#27ae60; color:#2ecc71; background:rgba(46,204,113,0.12); }
        .sam-act-btn[data-act="wear"]:hover { background:#27ae60; border-color:#27ae60; color:#fff; box-shadow:0 0 8px rgba(46,204,113,0.6); }
        .sam-act-btn[data-act="remove"] { border-color:#d35400; color:#e67e22; background:rgba(230,126,34,0.12); }
        .sam-act-btn[data-act="remove"]:hover { background:#d35400; border-color:#d35400; color:#fff; box-shadow:0 0 8px rgba(230,126,34,0.6); }
        .sam-act-btn[data-act="store"] { border-color:#2980b9; color:#3498db; background:rgba(52,152,219,0.12); }
        .sam-act-btn[data-act="store"]:hover { background:#2980b9; border-color:#2980b9; color:#fff; box-shadow:0 0 8px rgba(52,152,219,0.6); }
        .sam-act-btn[data-act="takeback"] { border-color:#8e44ad; color:#9b59b6; background:rgba(155,89,182,0.12); }
        .sam-act-btn[data-act="takeback"]:hover { background:#8e44ad; border-color:#8e44ad; color:#fff; box-shadow:0 0 8px rgba(155,89,182,0.6); }
        .sam-act-btn[data-act="activate"] { border-color:#d4af37; color:#f1c40f; background:linear-gradient(135deg, rgba(212,175,55,0.18), rgba(241,196,15,0.10)); text-shadow:0 0 4px rgba(241,196,15,0.6); }
        .sam-act-btn[data-act="activate"]:hover { background:linear-gradient(135deg, #d4af37, #f1c40f); border-color:#d4af37; color:#2a2300; text-shadow:none; box-shadow:0 0 10px rgba(241,196,15,0.8); }
        .sam-act-btn[data-act="deactivate"] { border-color:#7a1f1f; color:#e04848; background:rgba(224,72,72,0.12); }
        .sam-act-btn[data-act="deactivate"]:hover { background:#7a1f1f; border-color:#7a1f1f; color:#fff; box-shadow:0 0 8px rgba(224,72,72,0.6); }
        .sam-fc-collapse { margin-bottom:5px; }
        .sam-fc-collapse > .sam-fc-collapse-sum { font-size:11px; font-weight:bold; color:var(--sam-sub); cursor:pointer; padding:3px 6px; background:rgba(143,159,255,0.06); border-radius:4px; user-select:none; list-style:none; border-left:3px solid var(--sam-border); }
        .sam-fc-collapse > .sam-fc-collapse-sum::-webkit-details-marker { display:none; }
        .sam-fc-collapse > .sam-fc-collapse-sum::before { content:'▸ '; color:var(--sam-accent); }
        .sam-fc-collapse[open] > .sam-fc-collapse-sum::before { content:'▾ '; }
        .sam-fc-collapse > .sam-fc-content { margin-top:4px; }
        /* 效果对象分行显示 */
        .sam-effects { display:flex; flex-direction:column; gap:2px; align-items:flex-start; }
        .sam-effect-line { font-size:11px; color:var(--sam-text); padding:1px 0 1px 8px; border-left:2px solid var(--sam-border); line-height:1.4; text-align:left; }
        .sam-effect-line .ek { color:var(--sam-accent); font-weight:bold; }
        /* 标签 */
        .sam-tags { display:flex; gap:3px; flex-wrap:wrap; }
        .sam-tag { font-size:10px; padding:1px 5px; border-radius:3px; background:rgba(143,159,255,0.12); color:var(--sam-sub); border:1px solid var(--sam-border); }
        /* 数值徽章 */
        .sam-stat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr)); gap:4px; margin-top:4px; }
        .sam-stat-cell { text-align:center; padding:3px 2px; background:rgba(0,0,0,0.2); border-radius:3px; }
        .sam-stat-cell .sn { font-size:9px; color:var(--sam-sub); }
        .sam-stat-cell .sv { font-size:13px; font-weight:bold; color:var(--sam-text); }

        /* 设置弹窗 */
        .sam-settings-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        .sam-theme-card { padding:14px 10px; text-align:center; border-radius:8px; cursor:pointer; border:2px solid transparent; transition:all 0.2s; }
        .sam-theme-card:hover { transform:scale(1.03); }
        .sam-theme-card.active { border-color:var(--sam-accent); box-shadow:0 0 10px var(--sam-accent); }
        .sam-theme-card .swatch { width:100%; height:24px; border-radius:4px; margin-bottom:6px; }
        .sam-theme-card .name { font-size:13px; font-weight:bold; }
        .sam-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-top:1px solid var(--sam-border); }
        .sam-toggle-switch { width:44px; height:22px; border-radius:11px; background:var(--sam-dark); border:1px solid var(--sam-border); position:relative; cursor:pointer; transition:background 0.2s; }
        .sam-toggle-switch.on { background:var(--sam-accent); }
        .sam-toggle-switch .knob { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left 0.2s; }
        .sam-toggle-switch.on .knob { left:24px; }

        @media (max-width:768px) {
            #samsara-ball { top:calc(70px + env(safe-area-inset-top, 0px)) !important; bottom:auto !important; right:calc(16px + env(safe-area-inset-right, 0px)) !important; width:30px !important; height:30px !important; }
            /* 手机端：上下贴边自适应固定视口，内部由 .sam-tab-content 滚动 */
            #samsara-panel {
                top: calc(8px + env(safe-area-inset-top, 0px)) !important;
                bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;
                left: 0 !important; right: 0 !important;
                margin: 0 auto !important; width: 94vw !important; max-width: 440px !important;
                height: auto !important; max-height: none !important;
                border-radius: 12px !important;
            }
            .sam-topbar { padding:10px; cursor:default; }
            .sam-topbar .tl-info { font-size:11px; }
            .sam-topbar .tl-place { font-size:10px; }
            .sam-icon-btn { width:26px; height:26px; font-size:13px; }
            .sam-tab-rail { flex:0 0 48px; }
            .sam-tab-btn { font-size:10px; padding:6px 1px; }
            .sam-tab-content { padding:6px 8px; }
            .sam-grid { grid-template-columns:1fr; }
            .sam-grid-2, .sam-card-list, .sam-list-1col { display:flex; flex-direction:column; gap:6px; }
            .sam-grid-2 { gap:6px; }
            .sam-grid-2 > .sam-row { padding:4px 6px; }
            .sam-hero { padding:6px 8px; gap:6px; }
            .sam-avatar { width:64px; height:80px; font-size:22px; }
            .sam-ava-ph .sam-ava-ico { font-size:22px; }
            .sam-ava-ph .sam-ava-hint { font-size:8px; }
            .sam-hero-tier { padding:2px 8px; }
            .sam-hero-tier-num { font-size:16px; }
            .sam-hero-race { font-size:11px; padding:2px 7px; }
            .sam-hero-bars { gap:4px; max-width:none; flex:1; margin-left:10px; }
            .stat-labels { font-size:9px; }
            .bar-track { height:10px; }
            .sam-row { font-size:11px; padding:3px 0; }
            .sam-row .k { min-width:50px; }
            .sam-full-card { padding:6px 8px; }
            .sam-fc-title { font-size:13px; }
            .sam-fc-rows { font-size:11px; }
            .sam-save-btn { bottom:8px; left:8px; padding:2px 7px; font-size:9px; }
            /* 二级弹窗手机加固 */
            #samsara-modal {
                padding:max(8px, env(safe-area-inset-top, 0px)) 10px max(8px, env(safe-area-inset-bottom, 0px));
            }
            .sam-modal-box { width:100%; border-radius:12px; }
            .sam-modal-head { padding:10px 12px; font-size:14px; }
            .sam-modal-body { padding:10px 12px; }
            .sam-settings-grid { grid-template-columns:1fr; }
            .sam-toggle-row { gap:10px; align-items:flex-start; }
            .sam-confirm-box { width:100%; padding:14px; }
            .sam-confirm-actions { gap:10px; }
            .sam-confirm-btn { flex:1; min-height:44px; }
            .sam-trf-actions { gap:10px; }
            .sam-trf-btn { flex:1; min-height:44px; }
            .sam-trf-qty-btn { width:36px; height:36px; }
        }
        `;
    }
    function initSamsaraCSS() {
        var old = document.getElementById('samsara-theme-style');
        if (old) old.remove();
        var styleEl = document.createElement('style');
        styleEl.id = 'samsara-theme-style';
        styleEl.type = 'text/css';
        styleEl.innerHTML = buildCSS(THEES_DEFAULT(), getTheme());
        document.head.appendChild(styleEl);
    }
    function THEES_DEFAULT() { return THEMES[getTheme()] || THEMES.night; }

    /* ===== 10. 面板开关 ===== */
    function toggleSamsaraPanel() {
        var $panel = $('#samsara-panel');
        var $ball = $('#samsara-ball');
        var isOpen = $panel.hasClass('open');
        if (isOpen) {
            // 打开时写了内联 display:flex，仅 removeClass('open') 不会立刻隐藏
            // 以前空等 300ms 才 display:none，又没有退场动画，体感像卡了约 1 秒
            if ($panel.data('samCloseTimer')) {
                clearTimeout($panel.data('samCloseTimer'));
                $panel.removeData('samCloseTimer');
            }
            $panel.removeClass('open').addClass('closing');
            var closeTimer = setTimeout(function() {
                $panel.removeClass('closing').css('display', 'none');
                $panel.removeData('samCloseTimer');
            }, 180);
            $panel.data('samCloseTimer', closeTimer);
            $ball.stop(true, true).fadeIn(160);
            try { localStorage.setItem(SAM_CONFIG.open, '0'); } catch(e){}
        } else {
            if ($panel.data('samCloseTimer')) {
                clearTimeout($panel.data('samCloseTimer'));
                $panel.removeData('samCloseTimer');
            }
            $panel.removeClass('closing');
            if (isMobile()) { $panel.css({left:'',top:'',right:'',bottom:'',margin:'',height:''}); }
            else {
                var r = $ball[0].getBoundingClientRect();
                var vw = GS_PARENT.innerWidth, vh = GS_PARENT.innerHeight;
                var pw = $panel.outerWidth() || 720;
                var nl = Math.max(20, Math.min(vw - pw - 20, r.left > vw/2 ? r.left - pw - 20 : r.left + 60));
                var nt = Math.max(20, Math.min(vh - 700, r.top));
                $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
            }
            $panel.css('display', 'flex');
            $panel[0].offsetHeight;
            $panel.addClass('open');
            $ball.stop(true, true).fadeOut(160);
            try { localStorage.setItem(SAM_CONFIG.open, '1'); } catch(e){}
            renderAll();
        }
    }

    /* ===== 11. 拖拽系统(球+面板) ===== */
    function setupDragEngines() {
        var $ball = $('#samsara-ball');
        var $panel = $('#samsara-panel');
        if (!$ball.length || !$panel.length) return;

        if (!$ball.data('samDragBound')) {
            $ball.data('samDragBound', '1');
            var sx1=0, sy1=0, ox1=0, oy1=0, dragging1=false, moved1=false;
            try {
                var savedPos = localStorage.getItem(SAM_CONFIG.pos);
                if (savedPos && !isMobile()) {
                    var arr = savedPos.split(',');
                    if (arr.length === 2) {
                        $ball[0].style.setProperty('left', arr[0]+'px', 'important');
                        $ball[0].style.setProperty('top', arr[1]+'px', 'important');
                        $ball[0].style.setProperty('right', 'auto', 'important');
                    }
                }
            } catch(e){}
            $ball[0].addEventListener('touchstart', handleBallDown, { passive: false });
            $ball.on('mousedown', function(e) { if (e.button !== 0) return; handleBallDown(e); });
            function handleBallDown(e) {
                var p = e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0] : (e.touches ? e.touches[0] : e);
                sx1 = p.clientX; sy1 = p.clientY;
                var r = $ball[0].getBoundingClientRect(); ox1 = r.left; oy1 = r.top;
                dragging1 = true;
                document.addEventListener('mousemove', handleBallMove);
                document.addEventListener('touchmove', handleBallMove, { passive: false });
                document.addEventListener('mouseup', handleBallUp);
                document.addEventListener('touchend', handleBallUp);
            }
            function handleBallMove(me) {
                if (!dragging1) return;
                var mp = me.originalEvent && me.originalEvent.touches ? me.originalEvent.touches[0] : (me.touches ? me.touches[0] : me);
                var dx = mp.clientX - sx1, dy = mp.clientY - sy1;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    moved1 = true;
                    var vw = GS_PARENT.innerWidth||1024, vh = GS_PARENT.innerHeight||768;
                    var sz = $ball[0].offsetWidth || 34;
                    var nl = Math.max(10, Math.min(vw-sz-10, ox1+dx));
                    var nt = Math.max(10, Math.min(vh-sz-10, oy1+dy));
                    $ball[0].style.setProperty('right','auto','important');
                    $ball[0].style.setProperty('bottom','auto','important');
                    $ball[0].style.setProperty('left', nl+'px','important');
                    $ball[0].style.setProperty('top', nt+'px','important');
                    if (me.type === 'touchmove' && me.cancelable) me.preventDefault();
                }
            }
            function handleBallUp() {
                if (dragging1 && moved1) {
                    try { localStorage.setItem(SAM_CONFIG.pos, parseInt($ball[0].style.left)+','+parseInt($ball[0].style.top)); } catch(e){}
                }
                dragging1 = false;
                document.removeEventListener('mousemove', handleBallMove);
                document.removeEventListener('touchmove', handleBallMove);
                document.removeEventListener('mouseup', handleBallUp);
                document.removeEventListener('touchend', handleBallUp);
                setTimeout(function() { moved1 = false; }, 50);
            }
            $ball.on('click', function() { if (!moved1) toggleSamsaraPanel(); });
        }

        if (!$panel.data('samDragBound')) {
            $panel.data('samDragBound', '1');
            var sx2=0, sy2=0, ox2=0, oy2=0, dragging2=false;
            $panel.on('mousedown touchstart', '.sam-topbar', function(e) {
                if (e.type === 'mousedown' && e.button !== 0) return;
                if ($(e.target).closest('.sam-icon-btn').length) return;
                if (isMobile()) return;
                var p = e.originalEvent.touches ? e.originalEvent.touches[0] : e;
                sx2 = p.clientX; sy2 = p.clientY;
                var r = $panel[0].getBoundingClientRect(); ox2 = r.left; oy2 = r.top;
                dragging2 = true;
                $(document).on('mousemove.samPanel touchmove.samPanel', function(me) {
                    if (!dragging2) return;
                    var mp = me.originalEvent.touches ? me.originalEvent.touches[0] : me;
                    var dx = mp.clientX - sx2, dy = mp.clientY - sy2;
                    var vw = GS_PARENT.innerWidth||1024, vh = GS_PARENT.innerHeight||768;
                    var pw = $panel.outerWidth(), ph = $panel.outerHeight();
                    var nl = Math.max(0, Math.min(vw-pw, ox2+dx));
                    var nt = Math.max(0, Math.min(vh-ph, oy2+dy));
                    $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
                    if (me.type === 'touchmove' && me.cancelable) me.preventDefault();
                });
                $(document).on('mouseup.samPanel touchend.samPanel', function() {
                    dragging2 = false;
                    $(document).off('mousemove.samPanel touchmove.samPanel mouseup.samPanel touchend.samPanel');
                });
            });
        }
    }

    /* ===== 12. DOM 注入 ===== */
    function initSamsaraDOM() {
        if (!document.getElementById('samsara-ball')) {
            var t = getTheme();
            var panelAttr = (t === 'night') ? '' : ('data-theme="'+t+'"');
            var tpl = '<div id="samsara-ball"><div class="core"></div></div><div id="samsara-panel" '+panelAttr+'></div><div id="samsara-modal"></div><div id="samsara-portrait-viewer"><img id="sam-pv-img" alt=""><div id="sam-pv-label"></div></div>';
            $('body').append(tpl);
            setupDragEngines();
            bindUIEvents();
            bindPortraitEvents();
        }
    }

    /* ===== 13. 弹窗 ===== */
    function showModal(title, bodyHtml) {
        var $m = $('#samsara-modal');
        if (!$m.length) { $('body').append('<div id="samsara-modal"></div>'); }
        $m = $('#samsara-modal');
        $m.html('<div class="sam-modal-box"><div class="sam-modal-head"><span>'+esc(title)+'</span><span class="sam-modal-close">✕</span></div><div class="sam-modal-body">'+bodyHtml+'</div></div>');
        $m[0].scrollTop = 0;
        $m.addClass('open');
        $m.off('click.samModal').on('click.samModal', '.sam-modal-close', closeModal);
        $m.off('click.samModalBg').on('click.samModalBg', function(e) { if (e.target === this) closeModal(); });
    }
    function closeModal() { $('#samsara-modal').removeClass('open'); }

    /* ===== 13.5 物资转移(向在场NPC转移装备/道具) ===== */
    var transferTarget = null;                  // 转移目标NPC名
    var transferCart = { 装备: {}, 背包: {} };   // 选中项: { 装备: {key:1}, 背包: {key:qty} }
    function openTransferModal(npcName) {
        var sd = getStatData();
        var npc = sd && sd.关系列表 && sd.关系列表[npcName];
        if (!npc) { samToast('error', '未找到该角色'); return; }
        transferTarget = npcName;
        transferCart = { 装备: {}, 背包: {} };
        showModal('向「'+npcName+'」转移物资', renderTransferList(sd));
    }
    function renderTransferList(sd) {
        var equips = (sd.主角 && sd.主角.装备) || {};
        var backpack = (sd.主角 && sd.主角.背包) || {};
        var eqList = [], bpList = [];
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            if (safeNum(e.状态, 0) === 1) return;   // 已装备: 排除
            if (safeNum(e.类型, 0) === 8) return;    // 特殊类型: 排除
            eqList.push({ key: k, val: e });
        });
        Object.keys(backpack).forEach(function(k) {
            var b = backpack[k] || {};
            if (safeNum(b.数量, 0) <= 0) return;
            bpList.push({ key: k, val: b, qty: safeNum(b.数量, 0) });
        });
        var html = '<div class="sam-trf-list">';
        if (eqList.length) {
            html += '<div class="sam-trf-sec">⚔ 装备 · '+eqList.length+'</div>';
            eqList.forEach(function(it) { html += transferItemCard('装备', it.key, it.val, 1); });
        }
        if (bpList.length) {
            html += '<div class="sam-trf-sec">🎒 道具 · '+bpList.length+'</div>';
            bpList.forEach(function(it) { html += transferItemCard('背包', it.key, it.val, it.qty); });
        }
        if (!eqList.length && !bpList.length) {
            html += '<div class="sam-empty">无可转移物资（已装备与特殊装备已自动排除）</div>';
        }
        html += '</div>';
        var hasSel = Object.keys(transferCart.装备).length + Object.keys(transferCart.背包).length > 0;
        html += '<div class="sam-trf-footer">';
        html += '<div class="sam-trf-warn">⚠️ 确认转移后<strong>不可取消、不可取回</strong>，物资将直接归属目标角色，请认真考虑。</div>';
        html += '<div class="sam-trf-actions">';
        html += '<button type="button" class="sam-trf-btn cancel">取消</button>';
        html += '<button type="button" class="sam-trf-btn confirm"'+(hasSel ? '' : ' disabled')+'>确认转移</button>';
        html += '</div></div>';
        return html;
    }
    function transferItemCard(cat, key, item, maxQty) {
        var sel = transferCart[cat][key] != null;
        var selQty = sel ? transferCart[cat][key] : 0;
        var q = parseRarity(item.品质);
        var isItem = (cat === '背包');
        var corner = sel ? (isItem ? '已选 ×'+selQty : '已选') : '';
        var typeLabel = isItem ? safeStr(item.类型) : (EQUIP_TYPE_MAP[safeNum(item.类型, 0)] || '');
        var attrs = item.原始属性 || {};
        var attrStr = Object.keys(attrs).map(function(k) { return esc(k)+' '+safeNum(attrs[k], 0); }).join(' / ');
        var desc = safeStr(item.描述) || '';
        var inner = '<div class="sam-trf-head"><span class="sam-trf-name">'+esc(key)+'</span><span class="sam-trf-qtag q-'+q+'">'+esc(q)+'</span></div>';
        if (typeLabel) inner += '<div class="sam-trf-sub">'+esc(typeLabel) + (isItem ? ' · 持有 '+maxQty : '') + '</div>';
        if (attrStr) inner += '<div class="sam-trf-attrs">'+attrStr+'</div>';
        if (desc) inner += '<div class="sam-trf-desc">'+esc(desc)+'</div>';
        if (isItem && sel) {
            inner += '<div class="sam-trf-qty">'
                + '<button type="button" class="sam-trf-qty-btn" data-trf-qty="minus" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">−</button>'
                + '<input type="number" class="sam-trf-qty-inp" min="1" max="'+maxQty+'" value="'+selQty+'" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">'
                + '<button type="button" class="sam-trf-qty-btn" data-trf-qty="plus" data-cat="'+esc(cat)+'" data-key="'+esc(key)+'">+</button>'
                + '<span class="sam-trf-qty-max">/'+maxQty+'</span></div>';
        }
        return '<div class="sam-trf-item'+(sel?' selected':'')+'" data-trf-cat="'+esc(cat)+'" data-trf-key="'+esc(key)+'">'+inner+'<span class="sam-trf-corner">'+esc(corner)+'</span></div>';
    }
    function transferToggle(cat, key) {
        if (transferCart[cat][key] != null) delete transferCart[cat][key];
        else transferCart[cat][key] = 1;
        refreshTransferModal();
    }
    function transferAdjustQty(cat, key, dir) {
        var sd = getStatData();
        var max = 1;
        if (cat === '背包') max = safeNum(sd.主角.背包[key] && sd.主角.背包[key].数量, 1);
        var cur = transferCart[cat][key] != null ? transferCart[cat][key] : 1;
        if (dir === 'plus') cur = Math.min(max, cur + 1);
        else cur = Math.max(1, cur - 1);
        transferCart[cat][key] = cur;
        refreshTransferModal();
    }
    function transferInputQty(cat, key, val) {
        var sd = getStatData();
        var max = 1;
        if (cat === '背包') max = safeNum(sd.主角.背包[key] && sd.主角.背包[key].数量, 1);
        var v = Math.max(1, Math.min(max, parseInt(val, 10) || 1));
        transferCart[cat][key] = v;
        refreshTransferModal();
    }
    function refreshTransferModal() {
        var $body = $('#samsara-modal .sam-modal-body');
        // 列表已改为 body 单层滚动，恢复 body 的 scrollTop
        var saved = $body.length ? ($body[0].scrollTop || 0) : 0;
        var sd = getStatData();
        $body.html(renderTransferList(sd));
        if ($body.length && saved > 0) { try { $body[0].scrollTop = saved; } catch(e){} }
    }
    function executeTransfer() {
        var eqKeys = Object.keys(transferCart.装备);
        var bpKeys = Object.keys(transferCart.背包);
        if (eqKeys.length + bpKeys.length === 0) return;
        var npcName = transferTarget;
        samConfirm('确认转移', '确定将选中的物资转移给「'+npcName+'」吗？此操作不可取消、不可取回。', function() {
            var ok = writeBackMvu(function(statData) {
                if (!statData) return;
                var mc = statData.主角 = statData.主角 || {};
                mc.装备 = mc.装备 || {}; mc.背包 = mc.背包 || {};
                var rel = statData.关系列表 = statData.关系列表 || {};
                var npc = rel[npcName] = rel[npcName] || {};
                npc.装备 = npc.装备 || {}; npc.背包 = npc.背包 || {};
                // 装备: 整件复制给NPC(状态置0未装备), 删除主角的
                eqKeys.forEach(function(key) {
                    var e = mc.装备[key];
                    if (!e) return;
                    var copy = (_ && _.cloneDeep) ? _.cloneDeep(e) : JSON.parse(JSON.stringify(e));
                    copy.状态 = 0;
                    npc.装备[key] = copy;
                    delete mc.装备[key];
                });
                // 道具: 按数量转移(NPC已有则累加, 否则新建; 主角扣减, 归0则删)
                bpKeys.forEach(function(key) {
                    var b = mc.背包[key];
                    if (!b) return;
                    var have = safeNum(b.数量, 0);
                    var move = Math.min(transferCart.背包[key] || 1, have);
                    if (move <= 0) return;
                    if (npc.背包[key]) {
                        npc.背包[key].数量 = safeNum(npc.背包[key].数量, 0) + move;
                    } else {
                        var copy2 = (_ && _.cloneDeep) ? _.cloneDeep(b) : JSON.parse(JSON.stringify(b));
                        copy2.数量 = move;
                        npc.背包[key] = copy2;
                    }
                    b.数量 = have - move;
                    if (b.数量 <= 0) delete mc.背包[key];
                });
            });
            if (ok) {
                var cnt = eqKeys.length + bpKeys.length;
                transferCart = { 装备: {}, 背包: {} };
                transferTarget = null;
                closeModal();
                samToast('success', '已向「'+npcName+'」转移 '+cnt+' 项物资');
                renderAll();
            } else {
                samToast('error', '转移失败: 数据写回不可用');
            }
        });
    }

    /* ===== 14. 事件绑定 ===== */
    function bindUIEvents() {
        var $panel = $('#samsara-panel');
        // 关闭(编辑模式开启时, 先退出编辑模式再关闭面板)
        $panel.off('click.samClose').on('click.samClose', '.sam-icon-btn.close', function() {
            if (isEditMode()) setEditMode(false);
            if ($('#samsara-panel').hasClass('open')) toggleSamsaraPanel();
        });
        // 刷新(编辑模式开启时, 先退出编辑模式再刷新数据)
        $panel.off('click.samRefresh').on('click.samRefresh', '.sam-icon-btn.refresh', function() {
            if (isEditMode()) setEditMode(false);
            renderAll();
            try { console.log('%c[主神终端] 🔄 手动刷新', 'color:#8f9fff'); } catch(e){}
        });
        // 设置
        $panel.off('click.samSettings').on('click.samSettings', '.sam-icon-btn.settings', function() { openSettings(); });
        // Tab切换
        $panel.off('click.samTab').on('click.samTab', '.sam-tab-btn', function() {
            var tab = $(this).data('tab');
            setCurrentTab(tab);
            renderTabContent(tab);
            $panel.find('.sam-tab-btn').removeClass('active');
            $(this).addClass('active');
        });
        // 子Tab切换
        $panel.off('click.samSubtab').on('click.samSubtab', '.sam-subtab', function() {
            var sub = $(this).data('sub');
            $(this).siblings().removeClass('active');
            $(this).addClass('active');
            $panel.find('.sam-subpane').removeClass('active').hide();
            $panel.find('.sam-subpane[data-sub="'+sub+'"]').addClass('active').show();
        });
        // 卡片点击→详情弹窗
        $panel.off('click.samCard').on('click.samCard', '.sam-card', function(e) {
            if (isEditMode()) return; // 编辑模式不弹详情
            var path = $(this).data('path');
            var title = $(this).data('title') || '详情';
            if (path) openDetailModal(path, title);
        });
        // NPC删除按钮(编辑模式)→从MVU删除该NPC
        $panel.off('click.samNpcDel').on('click.samNpcDel', '.sam-npc-del', function(e) {
            e.stopPropagation();
            var name = $(this).data('del-npc');
            if (!name) return;
            deleteNpc(name);
        });
        // ★ NPC转移按钮(在场NPC)→打开物资转移弹窗
        $panel.off('click.samTransfer').on('click.samTransfer', '.sam-npc-transfer', function(e) {
            e.stopPropagation();
            var name = $(this).data('transfer-npc');
            if (name) openTransferModal(name);
        });
        // ★ 转移弹窗内交互(委托到document, 因modal容器首次showModal时才创建)
        $(document).off('click.samTrfItem').on('click.samTrfItem', '.sam-trf-item', function(e) {
            if ($(e.target).closest('.sam-trf-qty').length) return; // 数量控件区不触发toggle
            transferToggle($(this).data('trf-cat'), $(this).data('trf-key'));
        });
        $(document).off('click.samTrfQty').on('click.samTrfQty', '.sam-trf-qty-btn', function(e) {
            e.stopPropagation();
            transferAdjustQty($(this).data('cat'), $(this).data('key'), $(this).data('trf-qty'));
        });
        $(document).off('change.samTrfInp').on('change.samTrfInp', '.sam-trf-qty-inp', function(e) {
            e.stopPropagation();
            transferInputQty($(this).data('cat'), $(this).data('key'), this.value);
        });
        $(document).off('click.samTrfConfirm').on('click.samTrfConfirm', '.sam-trf-btn.confirm', function(e) {
            executeTransfer();
        });
        $(document).off('click.samTrfCancel').on('click.samTrfCancel', '.sam-trf-btn.cancel', function(e) {
            closeModal();
        });
        // ★ 世界条目删除按钮(编辑模式, 探索点/势力)→从MVU删除该条目
        $panel.off('click.samWorldDel').on('click.samWorldDel', '.sam-rumor-del-btn[data-world-del]', function(e) {
            e.stopPropagation();
            var path = $(this).attr('data-del-path') || '';
            if (!path) return;
            // 解析出父路径和末段key(用于确认文案)
            var parts = path.split('.');
            var key = parts.pop();
            var parentPath = parts.join('.');
            var label = key;
            samConfirm('删除条目', '确定删除「'+label+'」吗？此操作不可撤销。', function() {
                deleteWorldEntry(path, parentPath, key);
            });
        });
        // ★ R21-传闻交易: 可交易按钮 → 发送文字到输入框(找{卖家}购买情报「{名}」)
        $panel.off('click.samRumorTrade').on('click.samRumorTrade', '.sam-rumor-trade-btn', function(e) {
            e.stopPropagation();
            var name = $(this).attr('data-rumor-name') || '';
            var seller = $(this).attr('data-rumor-seller') || '不明';
            if (!name) return;
            var text = '找'+seller+'购买情报「'+name+'」';
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已发送到输入框: '+text);
            else samToast('warning', '未找到输入框, 已复制到剪贴板');
        });
        // ★ R21-传闻交易: 单条删除按钮 → 写回MVU删除该条传闻(需确认)
        $panel.off('click.samRumorDel').on('click.samRumorDel', '.sam-rumor-del-btn[data-rumor-del]', function(e) {
            e.stopPropagation();
            var section = $(this).attr('data-rumor-section') || '';
            var name = $(this).attr('data-rumor-name') || '';
            if (!section || !name) return;
            samConfirm('删除传闻', '确定删除「'+name+'」这条'+section+'吗？此操作不可撤销。', function() {
                handleRumorDelete(section, name);
            });
        });
        // ★ R21-传闻交易: 分类一键清除 → 清空该分类(街头巷议/情报交易/布告与檄文), 需确认
        $panel.off('click.samRumorClearSec').on('click.samRumorClearSec', '.sam-rumor-clear-btn', function(e) {
            e.stopPropagation();
            e.preventDefault(); // 阻止 summary 展开/收起
            var section = $(this).attr('data-rumor-clear-section') || '';
            if (!section) return;
            samConfirm('清空分类', '确定一键清除「'+section+'」中的全部传闻吗？此操作不可撤销。', function() {
                handleRumorClearSection(section);
            });
        });
        // ★ R21-传闻交易: 顶部一键删除全部传闻 → 清空 传闻.街头巷议/情报交易/布告与檄文, 需确认
        $panel.off('click.samRumorClearAll').on('click.samRumorClearAll', '.sam-rumor-clearall-btn', function(e) {
            e.stopPropagation();
            samConfirm('删除全部传闻', '确定删除全部传闻(街头巷议/情报交易/布告与檄文)吗？此操作不可撤销。', function() {
                handleRumorClearAll();
            });
        });
        // 装备/道具操作按钮(穿戴/脱下/存放/取回/删除)→写回MVU+刷新
        $panel.off('click.samAct').on('click.samAct', '.sam-act-btn', function(e) {
            e.stopPropagation();
            var $b = $(this);
            var action = $b.attr('data-act');
            // 形态激活/取消激活按钮(单独分发, 不走装备/道具 handler)
            if (action === 'activate' || action === 'deactivate') {
                var formName = $b.attr('data-form');
                if (formName) {
                    if (action === 'activate') handleFormActivate(formName);
                    else handleFormDeactivate(formName);
                }
                return;
            }
            var path = $b.attr('data-path');
            var kind = $b.attr('data-kind');
            var type = $b.attr('data-type');
            var key = $b.attr('data-key');
            // 删除操作先弹二级确认框, 确认后再执行
            if (action === 'delete') {
                var label = key || (path ? path.split('.').pop() : '');
                var cat = (kind === 'equip') ? '装备' : '道具';
                samConfirm('删除'+cat, '确定删除'+cat+'「'+label+'」吗？此操作不可撤销。', function() {
                    handleItemAction(action, path, kind, type, key);
                });
                return;
            }
            handleItemAction(action, path, kind, type, key);
        });
        // 状态按钮点击→二级详情弹窗(复用主面板卡片渲染风格)
        $panel.off('click.samBuff').on('click.samBuff', '.sam-buff-chip', function() {
            var name = $(this).data('name');
            var path = $(this).data('path');
            var sd = getStatData();
            if (!sd || !path) return;
            var obj = resolvePath(sd, path);
            if (!obj) return;
            var rows = '', body = '';
            Object.keys(obj).forEach(function(k) {
                var v = obj[k];
                if (v === null || v === undefined || v === '') return;
                if (typeof v === 'object') {
                    if (Array.isArray(v)) {
                        if (v.length === 0) return;
                        if (isStringArray(v)) body += fcBody(k, formatTags(v, null, false), 'sam-fc-tags');
                        else body += fcBody(k, esc(v.map(function(t){return safeStr(t);}).join(', ')));
                    } else {
                        var keys = Object.keys(v);
                        if (keys.length === 0) return;
                        if (isNumObj(v)) body += fcBody(k, formatStatGrid(v, 6), 'sam-fc-stats');
                        else body += fcBody(k, formatEffects(v, null, false), 'sam-fc-effects');
                    }
                } else {
                    var fv = (v === true) ? '是' : (v === false) ? '否' : safeStr(v);
                    rows += fcRow(k, fv);
                }
            });
            var html = '';
            if (rows) html += '<div class="sam-fc-rows">'+rows+'</div>';
            html += body;
            showModal(name + ' · 状态详情', '<div class="sam-detail">'+html+'</div>');
        });
        // ★ 进阶按钮(层级进度条中部): 属性总点达下层级下限才显示; 战斗中拦截
        //   - 申请进阶(进阶试炼未完成): 发送"【当前进阶条件已满足，申请进阶试炼】"到输入框
        //   - 开始进阶(进阶试炼已完成): writeBackMvu(主角.层级=nextTier) + renderAll() 刷新进度条/顶部层级
        $panel.off('click.samTierAdv').on('click.samTierAdv', '.sam-tier-adv-btn', function(e) {
            e.stopPropagation();
            var $b = $(this);
            var act = $b.attr('data-tier-act') || '';
            var nextTier = $b.attr('data-tier-next') || '';
            var sd = getStatData();
            if (!sd || !sd.主角) { samToast('error', '数据未就绪'); return; }
            var sys = sd.系统状态 || {};
            // 战斗中拦截: 任何进阶操作均不可在战斗中执行
            if (sys.是否战斗中 === true) {
                samToast('warning', '请在安全区域内再重新尝试');
                return;
            }
            if (act === 'apply') {
                // 申请进阶: 写入一句话到输入框(同情报交易可购买按钮, 不自动发送)
                var text = '当前进阶条件已满足，申请【晋升试炼任务】';
                var ok = sendToInputBox(text, false);
                if (ok) samToast('success', '已发送到输入框: '+text);
                else samToast('warning', '未找到输入框, 已复制到剪贴板');
            } else if (act === 'start') {
                // 开始进阶: 直接提升主角层级到下一级(F→E→...→SSS), 进阶试炼完成后执行
                if (!nextTier) { samToast('error', '未知目标层级'); return; }
                var ok2 = writeBackMvu(function(statData) {
                    if (statData.主角) statData.主角.层级 = nextTier;
                    // 进阶完成后重置试炼标记, 为下一轮进阶流程做准备
                    if (statData.系统状态) statData.系统状态.进阶试炼已完成 = false;
                });
                if (ok2) {
                    samToast('success', '层级已提升至 '+nextTier+' 级');
                    renderAll(); // 刷新进度条与顶部层级显示, 按钮随之隐藏(达新层级未满足下一级条件)
                } else {
                    samToast('error', '进阶失败: MVU写回不可用');
                }
            }
        });
        // ★ 结算任务按钮: 任务面板所有栏目下方, 点击发送【结算任务】到输入框(仅对主神任务起效, 由提示文案说明)
        $panel.off('click.samMissionSettle').on('click.samMissionSettle', '[data-mission-settle]', function(e) {
            e.stopPropagation();
            var text = '【结算任务】';
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已发送到输入框: '+text);
            else samToast('warning', '未找到输入框, 已复制到剪贴板');
        });
        // ★ 血统/形态/技能卡片删除按钮(编辑模式显示): 二级确认 → 写回MVU删除
        $panel.off('click.samFcDel').on('click.samFcDel', '.sam-fc-del-btn[data-del-path]', function(e) {
            e.stopPropagation();
            var path = $(this).attr('data-del-path') || '';
            if (!path) return;
            // 提取末段名用于提示
            var seg = path.split('.');
            var name = seg[seg.length - 1] || path;
            samConfirm('确认删除', '确定要删除「'+name+'」吗? 此操作将写入变量并刷新面板。', function() {
                var ok = writeBackMvu(function(statData) {
                    if (!statData) return;
                    var cur = statData, i;
                    for (i = 0; i < seg.length - 1; i++) {
                        if (!cur[seg[i]] || typeof cur[seg[i]] !== 'object') return;
                        cur = cur[seg[i]];
                    }
                    if (cur[seg[seg.length - 1]] !== undefined) delete cur[seg[seg.length - 1]];
                });
                if (ok) {
                    samToast('success', '已删除: '+name);
                    renderAll();
                } else {
                    samToast('error', '删除失败: MVU写回不可用');
                }
            });
        });
        // ★ 选择世界按钮(顶栏, 仅在主神空间且非战斗时渲染): 点击发送【选择世界】到输入框
        $panel.off('click.samChooseWorld').on('click.samChooseWorld', '[data-choose-world]', function(e) {
            e.stopPropagation();
            var text = '【选择世界】';
            var ok = sendToInputBox(text, false);
            if (ok) samToast('success', '已发送到输入框: '+text);
            else samToast('warning', '未找到输入框, 已复制到剪贴板');
        });
        // ★ 商城刷新商品按钮: 调正文AI generateRaw 按新ZOD结构生成商品库, 写回 stat_data.商城
        $panel.off('click.samShopRefresh').on('click.samShopRefresh', '.sam-shop-refresh-btn', async function(e) {
            e.stopPropagation();
            var $btn = $(this);
            if ($btn.is('[disabled]')) return;
            var $req = $btn.siblings('.sam-shop-req').first();
            var req = $req.length ? String($req.val() || '').trim() : '';
            
            var content = ''
                + '属性系统 (底层定义):\n'
                + '  基础六维 (判定依据):\n'
                + '    力量: 近战/负重/破坏\n'
                + '    敏捷: 平衡/潜行/精巧操作\n'
                + '    体质: 生命/耐性/恢复\n'
                + '    精神: 施法/念力/神秘学共鸣\n'
                + '    感知: 察觉/瞄准/意志\n'
                + '    魅力: 社交/欺骗/威吓\n'
                + '  衍生属性 (自动计算):\n'
                + '    HP: 生命值，归零进入濒死，【濒死状态再次受伤则死亡】\n'
                + '    HP_MAX: 生命值上限\n'
                + '    THP: 临时生命值/护盾，受到伤害时优先扣减，不叠加，脱战归零\n'
                + '    EP: 能量值，用于技能消耗\n'
                + '    EP_MAX: 能量值上限\n'
                + '    ATK: 物理攻击\n'
                + '    DEF: 物理防御\n'
                + '    MATK: 法术攻击\n'
                + '    MDEF: 法术防御\n'
                + '    AP: 法术强度乘区\n'
                + '    先攻DC: 行动顺序\n'
                + '    防御DC: 被命中难度\n';
            // 获取世界书内容的调用
            content += await getWorldBookContent('⚙️品质效果数值规则'); 
            content += await getWorldBookContent('⚙️实体生成规则'); 
            content += await getWorldBookContent('⚙️状态协议'); 
            content += await getWorldBookContent('⚙️行为判定[mvu_plot]'); 
            
            if (content) {
                // 在这里可以把拿到的世界书内容传进去
                handleShopRefresh(req, content); 
            }
        });
        // ★ 商城市场区: 区域Tab切换(装备|道具|技能|血统)
        $panel.off('click.samShopTab').on('click.samShopTab', '.sam-shop-tab', function(e) {
            e.stopPropagation();
            var tab = $(this).attr('data-shop-tab');
            if (!tab || tab === shopActiveTab) return;
            shopActiveTab = tab;
            shopActiveSlot = ''; // 切区时重置槽位
            shopRefreshMarket();
        });
        // ★ 持有面板: 子Tab切换(战术栏|装备背包|道具背包|仓库)
        $panel.off('click.samHoldTab').on('click.samHoldTab', '.sam-hold-tab', function(e) {
            e.stopPropagation();
            var tab = $(this).attr('data-hold-tab');
            if (!tab || tab === holdActiveTab) return;
            holdActiveTab = tab;
            // 仅切换Tab条active态 + 局部替换内容区(不重建Tab条, 消除整排抖动/错位)
            $panel.find('.sam-hold-tab').removeClass('active');
            $(this).addClass('active');
            var sdHold = getStatData();
            if (sdHold) $('#sam-hold-body').html(renderHoldBody(sdHold));
        });
        // ★ 商城市场区: 装备区 左nav槽位切换
        $panel.off('click.samShopSlot').on('click.samShopSlot', '.sam-shop-nav-btn', function(e) {
            e.stopPropagation();
            var slot = $(this).attr('data-shop-slot');
            if (!slot || slot === shopActiveSlot) return;
            shopActiveSlot = slot;
            shopRefreshMarket();
        });
        // ★ 商城市场区: 商品卡片点击(选中/取消); 道具区不响应卡片整体点击(由数量控件决定)
        $panel.off('click.samShopItem').on('click.samShopItem', '.sam-shop-item', function(e) {
            // 若点击源自数量控件(按钮/输入框), 则放行由 qty 委托处理
            var $tgt = $(e.target);
            if ($tgt.closest('.sam-shop-qty').length) return;
            e.stopPropagation();
            var $card = $(this);
            // 禁用态拦截: 按禁用原因给出对应提示
            if ($card.hasClass('disabled')) {
                var reason = $card.attr('data-dis-reason');
                if (reason === 'bloodfull') { samToast('warning', '当前自身血统已经过载, 请消除自身血统数量后再次尝试'); return; }
                samToast('warning', '空间币不足, 无法购买'); return;
            }
            var name = $card.attr('data-name');
            var cat  = $card.attr('data-cat');
            var slot = $card.attr('data-slot') || '';
            if (!name || !cat) return;
            // 道具区: 点击卡片=+1数量(便捷操作); 加1前预检余额
            if (cat === '道具区') {
                var cur = 0, unitPrice = 0;
                for (var i = 0; i < shopCart.length; i++) {
                    if (shopCart[i].name === name && shopCart[i]._cat === cat) { cur = shopCart[i].quantity || 0; unitPrice = Number(shopCart[i].price || 0); break; }
                }
                if (!unitPrice) {
                    var fnd = shopFindItems(cat, slot, name);
                    if (fnd.length) unitPrice = Number(fnd[0].price || 0);
                }
                var coinNow = (function(){ var sd = getStatData(); return sd && sd.主角 ? safeNum(sd.主角.空间币, 0) : 0; })();
                // 剩余余额 = 原始余额 - 已选合计(含本商品已选数量)
                var remainNow = shopRemain(coinNow) + (cur * unitPrice); // 移除本商品已占额度后才是真正可加的剩余
                if (remainNow < unitPrice * (cur + 1)) { samToast('warning', '空间币不足, 无法再加1(剩余 '+remainNow.toLocaleString()+')'); return; }
                shopSetQty(name, cat, cur + 1);
                return;
            }
            var items = shopFindItems(cat, slot, name);
            if (items.length) shopToggleSelect(items[0], cat, slot);
        });
        // ★ 商城市场区: 道具数量控件(+/− 按钮 + 输入框); 加数量时预检余额
        $panel.off('click.samShopQty').on('click.samShopQty', '.sam-shop-qty-btn', function(e) {
            e.stopPropagation();
            var $btn = $(this);
            var name = $btn.attr('data-name');
            var isPlus = ($btn.attr('data-shop-qty-btn') === 'plus');
            var $inp = $btn.siblings('.sam-shop-qty-inp').first();
            var cur = $inp.length ? (parseInt($inp.val(), 10) || 0) : 0;
            var nxt = Math.max(0, cur + (isPlus ? 1 : -1));
            if (isPlus && nxt > cur) {
                // 查单价并预检余额
                var up = 0;
                for (var k = 0; k < shopCart.length; k++) { if (shopCart[k].name === name && shopCart[k]._cat === '道具区') { up = Number(shopCart[k].price || 0); break; } }
                if (!up) { var f = shopFindItems('道具区', '', name); if (f.length) up = Number(f[0].price || 0); }
                var cn = (function(){ var sd = getStatData(); return sd && sd.主角 ? safeNum(sd.主角.空间币, 0) : 0; })();
                // 剩余余额 = 原始余额 - 已选合计; 但本商品已选数量应排除(因为是把它从 cur 改到 nxt)
                var curQty = shopGetQty(name, '道具区') || 0;
                var remainB = shopRemain(cn) + (curQty * up);
                if (remainB < up * nxt) { samToast('warning', '空间币不足, 无法加到 '+nxt+' 件(剩余 '+remainB.toLocaleString()+')'); return; }
            }
            if ($inp.length) $inp.val(nxt);
            shopSetQty(name, '道具区', nxt);
        });
        $panel.off('input.samShopQty change.samShopQty', '.sam-shop-qty-inp').on('input.samShopQty change.samShopQty', '.sam-shop-qty-inp', function(e) {
            e.stopPropagation();
            var $inp = $(this);
            var name = $inp.attr('data-name');
            var qty = parseInt($inp.val(), 10) || 0;
            if (qty < 0) qty = 0;
            // 余额预检: 直接输入大数字也需拦截(防止绕过 +/- 按钮的预检)
            if (qty > 0) {
                var upInp = 0;
                for (var k2 = 0; k2 < shopCart.length; k2++) { if (shopCart[k2].name === name && shopCart[k2]._cat === '道具区') { upInp = Number(shopCart[k2].price || 0); break; } }
                if (!upInp) { var fInp = shopFindItems('道具区', '', name); if (fInp.length) upInp = Number(fInp[0].price || 0); }
                var cnInp = (function(){ var sd = getStatData(); return sd && sd.主角 ? safeNum(sd.主角.空间币, 0) : 0; })();
                var curQtyInp = shopGetQty(name, '道具区') || 0;
                var remainInp = shopRemain(cnInp) + (curQtyInp * upInp);
                if (remainInp < upInp * qty) {
                    // 计算可承受最大数量, 回填并提示
                    var maxQty = upInp > 0 ? Math.floor(remainInp / upInp) : qty;
                    if (maxQty < 0) maxQty = 0;
                    samToast('warning', '空间币不足, 最多可购 '+maxQty+' 件(剩余 '+remainInp.toLocaleString()+')');
                    qty = maxQty;
                    $inp.val(qty);
                }
            }
            shopSetQty(name, '道具区', qty);
        });
        // ★ 商城市场区: 执行交易按钮
        $panel.off('click.samShopExec').on('click.samShopExec', '.sam-shop-exec-btn', function(e) {
            e.stopPropagation();
            var $btn = $(this);
            if ($btn.is('[disabled]')) return;
            shopHandleExec();
        });
        // 编辑器input变更(实时暂存, 不立即写回)
        $panel.off('input.samEdit change.samEdit', '.sam-edit-input').on('input.samEdit change.samEdit', '.sam-edit-input', function() {
            $(this).addClass('sam-dirty');
        });
        // 点击即编辑: 点击显示态(.sam-ed-wrap)→插入真实输入框→聚焦
        $panel.off('click.samEd', '.sam-ed-wrap').on('click.samEd', '.sam-ed-wrap', function(e) {
            e.stopPropagation();
            var $w = $(this);
            if ($w.hasClass('editing')) return;
            $w.addClass('editing');
            var path = $w.attr('data-path');
            var type = $w.attr('data-type') || 'text';
            var optsStr = $w.attr('data-opts') || '';
            var cur = $w.find('.sam-ed-val').first().text();
            var real;
            if (type === 'select') {
                real = editRealSelectHtml(path, strToOpts(optsStr), cur);
            } else {
                real = editRealInputHtml(path, cur, type);
            }
            $w.html(real);
            var $inp = $w.find('.sam-edit-active').first();
            if ($inp.is('input,textarea')) { $inp.trigger('focus'); if ($inp[0].select) $inp[0].select(); }
        });
        // 失焦/回车: 暂存到pendingEdits并还原显示态
        $panel.off('blur.samEd keydown.samEd', '.sam-edit-active').on('blur.samEd', '.sam-edit-active', function() {
            flushStagedDisplay($(this));
        });
        $panel.on('keydown.samEd', '.sam-edit-active', function(e) {
            if (e.which === 13 && $(this).is('input')) { e.preventDefault(); this.blur(); }
            else if (e.which === 27) { e.preventDefault(); this.blur(); }
        });
        // 保存按钮
        $(document).off('click.samSave').on('click.samSave', '.sam-save-btn', saveEdits);
        // 字段级开关(编辑模式内)
        $panel.off('click.samFieldToggle').on('click.samFieldToggle', '.sam-toggle-switch[data-toggle="field"]', function(e) {
            e.stopPropagation();
            $(this).toggleClass('on');
            var path = $(this).data('path');
            if (path) stageEdit(path, $(this).hasClass('on'), 'toggle');
        });
        // ESC关闭弹窗(但当前正在编辑的输入框优先消耗ESC)
        $(document).off('keydown.samEsc').on('keydown.samEsc', function(e) {
            if (e.which !== 27) return;
            if ($(e.target).is('.sam-edit-active')) return; // 输入框自己处理ESC
            closeModal();
        });
        // <details> 折叠记忆: 监听 summary 点击(用户主动切换), 记录open状态供下次渲染还原
        // 注: 用 click 而非原生 toggle 事件, 因 jQuery 对 toggle 的委托在部分版本有兼容问题;
        // key 取 summary 文本并剥离尾部 "(N)" 数量括号, 保证跨数据增减稳定匹配
        $panel.off('click.samDetails').on('click.samDetails', 'details > summary', function(e) {
            // 仅处理本面板内栏目标题点击(冒泡到的 summary)
            var $d = $(this).closest('details');
            if (!$d.length) return;
            // 异步读取: click 先触发默认toggle切换, 之后再读 open 属性
            var $sum = $(this);
            setTimeout(function() {
                var raw = $sum.text().trim();
                var key = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
                if (key) detailsOpenState[key] = $d.prop('open');
            }, 0);
        });
    }
    /* ===== 14b. 立绘相关事件绑定(头像点击放大/上传 + 查看器关闭) ===== */
    function bindPortraitEvents() {
        // 主角头像点击: 不管有无立绘, 直接弹自定义立绘框(不再放大/不再有✎角标)
        $(document).off('click.samPortrait', '.sam-avatar').on('click.samPortrait', '.sam-avatar', function(e) {
            e.stopPropagation();
            openHeroPortraitUp();
        });
        // NPC头像点击: 不管有无立绘, 直接弹自定义立绘框(阻止冒泡到卡片详情)
        $(document).off('click.samNpcAvatar', '.sam-npc-avatar').on('click.samNpcAvatar', '.sam-npc-avatar', function(e) {
            e.stopPropagation();
            openPortraitUpload($(this).data('name') || '');
        });
        // NPC无立绘时的"立绘"小按钮→上传(阻止冒泡)
        $(document).off('click.samNpcPortraitBtn', '.sam-npc-portrait-btn').on('click.samNpcPortraitBtn', '.sam-npc-portrait-btn', function(e) {
            e.stopPropagation();
            openPortraitUpload($(this).data('name') || '');
        });
        // 立绘查看器点击关闭
        $(document).off('click.samPvClose', '#samsara-portrait-viewer').on('click.samPvClose', '#samsara-portrait-viewer', function() {
            $(this).removeClass('show');
        });
    }

    /* ===== 15. 设置弹窗 ===== */
    function openSettings() {
        var cur = getTheme();
        var editOn = isEditMode();
        var stat = getStatData() || {};
        var cfg = stat.设置 || {};
        var superStable = (cfg.世界超稳 === true);
        var singleWorld = (cfg.单一世界 === true);
        var themeHtml = '';
        THEME_ORDER.forEach(function(key) {
            var th = THEMES[key];
            themeHtml += '<div class="sam-theme-card '+(key===cur?'active':'')+'" data-theme="'+key+'">'
                + '<div class="swatch" style="background:linear-gradient(90deg,'+th.dark+','+th.accent+','+th.hp+');"></div>'
                + '<div class="name" style="color:'+th.text+';background:'+th.bg+';">'+th.name+'</div></div>';
        });
        var html = secBlock('🎨 换肤',
              '<div class="sam-settings-grid">'+themeHtml+'</div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">✏️ 修改数据</div><div style="font-size:11px;color:var(--sam-sub);">开启后点击任意数值即可就地编辑(不变形),保存写回MVU</div></div>'
            + '<div class="sam-toggle-switch '+(editOn?'on':'')+'" data-toggle="edit"><div class="knob"></div></div></div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">🌐 世界超稳</div><div style="font-size:11px;color:var(--sam-sub);">开启后世界稳定性锁定,因果轨道不再偏移</div></div>'
            + '<div class="sam-toggle-switch '+(superStable?'on':'')+'" data-toggle="世界超稳"><div class="knob"></div></div></div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">🪐 单一世界</div><div style="font-size:11px;color:var(--sam-sub);">开启后仅存在单一世界,关闭后可在多世界间选择</div></div>'
            + '<div class="sam-toggle-switch '+(singleWorld?'on':'')+'" data-toggle="单一世界"><div class="knob"></div></div></div>');
        showModal('⚙️ 设置', html);
        // 主题选择
        $('#samsara-modal').off('click.samTheme').on('click.samTheme', '.sam-theme-card', function() {
            var tk = $(this).data('theme');
            setTheme(tk);
            $(this).siblings().removeClass('active');
            $(this).addClass('active');
            // 重渲染(变量变更需重建style + 重新渲染面板)
            renderAll();
        });
        // 编辑开关
        $('#samsara-modal').off('click.samToggle').on('click.samToggle', '.sam-toggle-switch[data-toggle="edit"]', function() {
            var on = !$(this).hasClass('on');
            $(this).toggleClass('on', on);
            setEditMode(on);
            closeModal();
            renderAll();
        });
        // 世界超稳 / 单一世界 开关(写回 MVU 设置节点)
        $('#samsara-modal').off('click.samCfgToggle').on('click.samCfgToggle', '.sam-toggle-switch[data-toggle="世界超稳"], .sam-toggle-switch[data-toggle="单一世界"]', function() {
            var key = $(this).data('toggle');
            var on = !$(this).hasClass('on');
            $(this).toggleClass('on', on);
            writeBackMvu(function(statData) {
                if (!statData.设置) statData.设置 = {};
                statData.设置[key] = on;
            });
            renderAll();
        });
    }

    /* ===== 16. 路径解析(读) ===== */
    function resolvePath(obj, path) {
        if (!path) return obj;
        try {
            if (_ && _.get) return _.get(obj, path);
        } catch(e){}
        return path.split('.').reduce(function(o, k) { return (o == null) ? undefined : o[k]; }, obj);
    }

    /* ===== 17. 主渲染入口 ===== */
    function renderAll() {
        // 重建前失焦面板内输入框, 防止ST AutoComplete绑定已移除的输入框报错(getBoundingClientRect on null)
        try {
            var _ae = document.activeElement;
            if (_ae && (_ae.tagName === 'INPUT' || _ae.tagName === 'TEXTAREA')) {
                var _pn = document.getElementById('samsara-panel');
                if (_pn && _pn.contains(_ae)) _ae.blur();
            }
        } catch(_e) {}
        var statData = getStatData();
        var $panel = $('#samsara-panel');
        if (!statData || !statData.主角) {
            // 终端未响应: 顶栏仍提供 刷新/关闭 按钮(刷新复用.sam-icon-btn.refresh, 事件已在bindUIEvents委托)
            $panel.html('<div class="sam-topbar"><div class="tl-info"><div class="tl-time" style="color:var(--sam-sub);">终端未响应</div></div><div class="tl-actions"><div class="sam-icon-btn refresh" title="刷新数据">🔄</div><div class="sam-icon-btn close" title="关闭">✕</div></div></div><div class="sam-empty"><div style="font-size:36px;opacity:0.6;animation:samPulse 2s infinite;">📡</div><div style="margin-top:10px;">因果链尚未接入...</div><div style="font-size:11px;opacity:0.6;">(请等待新剧本初始化或推进时间, 或点右上🔄刷新)</div></div>');
            $('#samsara-ball').removeClass('combat-mode');
            // 仅在"终端未响应"时启动5秒自动刷新定时器; 收到数据正常渲染后由下方清除
            if (!window.samsaraRefreshTimer) {
                window.samsaraRefreshTimer = setInterval(function() {
                    try { if ($('#samsara-panel').hasClass('open') && !isEditMode()) renderAll(); } catch (e) {}
                }, 5000);
            }
            return;
        }
        // 已收到数据: 清除"终端未响应"自动刷新定时器, 避免影响用户滚动/操作与无谓性能消耗
        if (window.samsaraRefreshTimer) { clearInterval(window.samsaraRefreshTimer); window.samsaraRefreshTimer = null; }
        var p = statData.主角;
        var sys = statData.系统状态 || {};
        var world = statData.世界 || {};
        // 新开局检测: 种族为空 + 身份为空数组 + 空间币为0 (已获取信息后判定)
        // → 清除主角立绘 + 所有NPC立绘(避免上一局头像残留到新角色)
        try {
            var raceStr = safeStr(p.种族, '');
            var idArr = Array.isArray(p.身份) ? p.身份 : [];
            var coin = safeNum(p.空间币, 0);
            var freshSig = (raceStr === '' && idArr.length === 0 && coin === 0) ? 'FRESH' : 'PLAY';
            if (freshSig === 'FRESH' && lastHeroSig !== 'FRESH') {
                clearAllPortraits();
            }
            lastHeroSig = freshSig;
        } catch(e) {}
        var isCombat = sys.是否战斗中 === true;
        if (isCombat) $('#samsara-ball').addClass('combat-mode');
        else $('#samsara-ball').removeClass('combat-mode');

        var editMode = isEditMode();
        var html = '';
        // 顶栏
        html += renderTopbar(world, sys, editMode);
        // 中部角色条
        html += renderHeroBar(p, sys, editMode);
        // 底部状态图标条
        html += renderBuffRail(p, editMode);
        // Tab主体
        html += '<div class="sam-main">';
        html += renderTabRail(getCurrentTab());
        html += '<div class="sam-tab-content" id="sam-tab-content"></div>';
        html += '</div>';
        // 编辑模式额外UI
        if (editMode) {
            html += '<div class="sam-edit-badge">编辑模式 · 点击数值就地修改,失焦自动暂存</div>';
            html += '<button class="sam-save-btn">💾 保存</button>';
        }
        // 刷新前保存滚动位置(整个panel重建会丢失容器scrollTop)
        var $oldContent = $('#sam-tab-content');
        var savedScrollTop = ($oldContent.length ? ($oldContent[0].scrollTop || 0) : 0);
        $panel.html(html);
        renderTabContent(getCurrentTab());
        // 同Tab刷新: 同步恢复滚动位置(避免重建后先渲染顶部再跳回中间的抖动)
        // 注: renderTabContent 内读到的 scrollTop 是新空容器的0, 故须用此处的 savedScrollTop
        if (savedScrollTop > 0) {
            var $newContent = $('#sam-tab-content');
            if ($newContent.length) {
                // 同步设置(内容已填入, 高度通常已定型); rAF兜底确保布局完成后再校正一次
                try { $newContent[0].scrollTop = savedScrollTop; } catch(e){}
                var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
                if (raf) raf(function(){ try { $newContent[0].scrollTop = savedScrollTop; } catch(e){} });
            }
        }
    }

    /* ===== 18. 顶栏 ===== */
    function renderTopbar(world, sys, editMode) {
        var time = safeStr(world.时间, '未知时间');
        var place = safeStr(world.地点, '未知地点');
        if (editMode) {
            time = editInput('世界.时间', time, 'text');
            place = editInput('世界.地点', place, 'text');
        }
        // 选择世界按钮: 仅当在主神空间且非战斗时显示(编辑模式下也保持可点以便快速测试)
        var worldBtn = '';
        if (sys && sys.是否在主神空间 === true && sys.是否战斗中 !== true) {
            worldBtn = '<div class="sam-icon-btn choose-world" title="选择世界" data-choose-world>🌐选择世界</div>';
        }
        return '<div class="sam-topbar">'
            + '<div class="tl-info"><div class="tl-time">🕒 '+time+'</div><div class="tl-place">📍 '+place+'</div></div>'
            + '<div class="tl-actions">'
            + worldBtn
            + '<div class="sam-icon-btn refresh" title="刷新">🔄</div>'
            + '<div class="sam-icon-btn settings '+(editMode?'edit-on':'')+'" title="设置">⚙️</div>'
            + '<div class="sam-icon-btn close" title="关闭">✕</div>'
            + '</div></div>';
    }

    /* ===== 19. 角色条(左头像列+层级/种族/形态 / 右HP+EP+THP三栏 纯色) ===== */
    var SAM_PORTRAIT_KEY = 'samsara_hero_portrait';
    var SAM_NPC_PORTRAIT_PREFIX = 'samsara_npc_portrait_';
    // 角色签名: 用于检测新开局(种族空+身份空+空间币0)→清除旧立绘
    var lastHeroSig = null;
    // <details>折叠状态记忆: key=summary纯文本, value=true(展开)/false(折叠); 跨刷新保持
    var detailsOpenState = {};
    // 清除主角立绘 + 所有NPC立绘(localStorage中以SAM_NPC_PORTRAIT_PREFIX开头的键)
    function clearAllPortraits() {
        try {
            localStorage.removeItem(SAM_PORTRAIT_KEY);
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(SAM_NPC_PORTRAIT_PREFIX) === 0) keysToRemove.push(k);
            }
            keysToRemove.forEach(function(k){ try { localStorage.removeItem(k); } catch(e){} });
            try { console.log('%c[主神终端] 🧹 检测到新开局, 已清除全部旧立绘 ('+(1+keysToRemove.length)+'个)', 'color:#fbbf24'); } catch(e){}
        } catch(e) { try { console.warn('[主神终端] 清除立绘失败:', e.message); } catch(x){} }
    }
    function getHeroPortrait() {
        try { return localStorage.getItem(SAM_PORTRAIT_KEY) || ''; } catch(e) { return ''; }
    }
    function saveHeroPortrait(dataUrl) {
        try {
            if (dataUrl) localStorage.setItem(SAM_PORTRAIT_KEY, dataUrl);
            else localStorage.removeItem(SAM_PORTRAIT_KEY);
        } catch(e) { try { console.warn('[主神终端] 立绘存储失败:', e.message); } catch(x){} }
        closeModal();
        renderAll();
    }
    // NPC立绘(localStorage, 以名称为键; 独立于主角)
    function getNpcPortrait(name) {
        if (!name) return '';
        try { return localStorage.getItem(SAM_NPC_PORTRAIT_PREFIX + name) || ''; } catch(e) { return ''; }
    }
    function saveNpcPortrait(name, dataUrl) {
        if (!name) return;
        try {
            if (dataUrl) localStorage.setItem(SAM_NPC_PORTRAIT_PREFIX + name, dataUrl);
            else localStorage.removeItem(SAM_NPC_PORTRAIT_PREFIX + name);
        } catch(e) { try { console.warn('[主神终端] NPC立绘存储失败:', e.message); } catch(x){} }
        closeModal();
        renderAll();
    }
    // 立绘放大查看器
    function showPortraitViewer(url, label) {
        var pv = document.getElementById('samsara-portrait-viewer');
        if (!pv || !url) return;
        var img = document.getElementById('sam-pv-img');
        var lbl = document.getElementById('sam-pv-label');
        if (img) img.src = url;
        if (lbl) lbl.textContent = label || '';
        pv.classList.add('show');
    }
    // 自定义立绘上传弹窗(主角/NPC通用; name为主角时存SAM_PORTRAIT_KEY, 否则存NPC键)
    function openPortraitUpload(name) {
        var isHero = (!name || name === '主角');
        var title = isHero ? '自定义主角立绘' : ('自定义立绘 · ' + name);
        var body = '<div style="display:flex;gap:8px;margin-bottom:10px;">'
            + '<input type="text" id="sam-portrait-url" placeholder="粘贴图片URL..." style="flex:1;font-size:13px;padding:8px;background:var(--sam-input-bg);color:var(--sam-text);border:1px solid var(--sam-border);border-radius:3px;">'
            + '</div>'
            + '<div style="display:flex;gap:8px;">'
            + '<button type="button" id="sam-portrait-url-btn" style="flex:1;padding:8px;cursor:pointer;background:var(--sam-accent);color:#fff;border:none;border-radius:3px;font-weight:bold;">📥 载入链接</button>'
            + '<button type="button" id="sam-portrait-file-btn" style="flex:1;padding:8px;cursor:pointer;background:var(--sam-accent);color:#fff;border:none;border-radius:3px;font-weight:bold;">📂 选择文件</button>'
            + '</div>'
            + '<input type="file" id="sam-portrait-file" accept="image/*" style="display:none;">'
            + '<div style="margin-top:10px;"><button type="button" id="sam-portrait-clear-btn" style="width:100%;padding:8px;cursor:pointer;background:rgba(40,15,10,0.6);color:var(--sam-hp);border:1px solid var(--sam-border);border-radius:3px;font-weight:bold;">🗑️ 清除自定义立绘</button></div>'
            + '<div style="margin-top:8px;font-size:11px;color:var(--sam-sub);">本地图片不做大小限制(仅受浏览器存储上限约束)。</div>';
        showModal(title, body);
        var doSave = function(u) { isHero ? saveHeroPortrait(u) : saveNpcPortrait(name, u); };
        $('#sam-portrait-url-btn').off('click.samPt').on('click.samPt', function() {
            var u = ($('#sam-portrait-url').val() || '').trim();
            if (!u) return;
            doSave(u);
        });
        $('#sam-portrait-file-btn').off('click.samPt').on('click.samPt', function() { $('#sam-portrait-file').click(); });
        $('#sam-portrait-file').off('change.samPt').on('change.samPt', function() {
            var f = this.files && this.files[0];
            if (!f) return;
            var rd = new FileReader();
            rd.onload = function(ev) { doSave(ev.target.result); };
            rd.readAsDataURL(f);
        });
        $('#sam-portrait-clear-btn').off('click.samPt').on('click.samPt', function() { doSave(''); });
    }
    function openHeroPortraitUp() { openPortraitUpload('主角'); }
    function renderHeroBar(p, sys, editMode) {
        var maxHp = safeNum(p.HP_MAX, 1), curHp = safeNum(p.HP, 0), curThp = safeNum(p.THP, 0);
        var maxEp = safeNum(p.EP_MAX, 1), curEp = safeNum(p.EP, 0);
        var hpPct = Math.min(100, Math.max(0, (curHp/maxHp)*100));
        var epPct = Math.min(100, Math.max(0, (curEp/maxEp)*100));
        // 注: THP 是临时护盾/额外生命值, 无上限概念, 不渲染进度条, 仅显示纯数值
        var tier = safeStr(p.层级, 'F');
        var race = safeStr(p.种族, '人类');
        var cf = p.当前形态 || {};
        var formActive = (cf.激活 === true && safeStr(cf.名称));
        // 战斗状态徽章: 平时隐藏, 进入战斗(系统状态.是否战斗中)时显示, 附当前轮次
        var combatBadge = '';
        if (sys && sys.是否战斗中 === true) {
            var combatRound = safeNum(sys.当前轮次, 0);
            combatBadge = '<div class="sam-hero-combat">⚔️ 战斗中'+(combatRound > 0 ? ' · 第'+combatRound+'轮' : '')+'</div>';
        }
        // 顶部排版: 竖排四行 战斗徽章(战斗时) / 层级 / 种族 / 形态标签(激活时)
        var tierField = (editMode && !isReadonlyPath('主角.层级')) ? editInput('主角.层级', tier, 'text') : '<span class="sam-hero-tier-num">'+esc(tier)+'</span><span class="sam-hero-tier-suf">级</span>';
        var raceField = editMode ? editInput('主角.种族', race, 'text') : esc(race);
        var formField = '';
        if (formActive) {
            // 当前形态由能力面板"激活按钮"统一管理, 修改模式下也不可手动编辑名称
            formField = '<div class="sam-hero-form">🌀 <span class="sam-hero-form-name">'+esc(safeStr(cf.名称))+'</span></div>';
        }
        // 头像: 自定义立绘优先, 否则占位符; 不管有无图, 点击框体均弹自定义立绘框
        var portraitUrl = getHeroPortrait();
        if (portraitUrl) {
            var avatarHtml = '<div class="sam-avatar" data-portrait="'+esc(portraitUrl)+'">'
                + '<img src="'+esc(portraitUrl)+'" alt="立绘">'
                + '</div>';
        } else {
            var avatarHtml = '<div class="sam-avatar empty">'
                + '<div class="sam-ava-ph"><span class="sam-ava-ico">📷</span><span class="sam-ava-hint">点击设置<br>立绘</span></div>'
                + '</div>';
        }
        // HP/EP/THP 三栏(编辑模式下数字可改,HP_MAX/EP_MAX只读)
        var hpNum = editMode ? editInput('主角.HP', curHp, 'number') : (curHp + ' / ' + maxHp);
        var epNum = editMode ? editInput('主角.EP', curEp, 'number') : (curEp + ' / ' + maxEp);
        var thpNum = editMode ? editInput('主角.THP', curThp, 'number') : curThp;
        return '<div class="sam-hero">'
            + '<div class="sam-hero-left">'+avatarHtml
            + '<div class="sam-hero-text">'+combatBadge
            + '<div class="sam-hero-tier q-'+parseRarity(tier)+'">'+tierField+'</div>'
            + '<div class="sam-hero-race">'+raceField+'</div>'
            + formField+'</div></div>'
            + '<div class="sam-hero-bars">'
            + '<div class="stat-bar-box"><div class="stat-labels"><span style="color:var(--sam-hp)">HP</span><span>'+hpNum+'</span></div><div class="bar-track"><div class="bar-fill fill-hp" style="width:'+hpPct+'%;"></div></div></div>'
            + '<div class="stat-bar-box"><div class="stat-labels"><span style="color:var(--sam-ep)">EP</span><span>'+epNum+'</span></div><div class="bar-track"><div class="bar-fill fill-ep" style="width:'+epPct+'%;"></div></div></div>'
            + '<div class="sam-thp-row"><div class="stat-labels"><span style="color:var(--sam-thp)">THP (临时护盾/额外生命值)</span><span>'+thpNum+'</span></div></div>'
            + '</div></div>';
    }

    /* ===== 20. 状态按钮条(状态名+持续时间, 点击弹二级详情) ===== */
    function renderBuffRail(p, editMode) {
        var buffs = p.状态 || {};
        var keys = Object.keys(buffs);
        // 无状态时不渲染任何占位,直接返回空
        if (keys.length === 0) return '';
        var chips = '';
        keys.forEach(function(k) {
            var b = buffs[k] || {};
            var type = safeStr(b.类型, '增益');
            var dur = safeStr(b.持续, '');
            var path = '主角.状态.'+k;
            // 按钮显示: 状态名 + 持续时间(若有)
            var durHtml = dur ? '<span class="sam-buff-dur">⏳ '+esc(dur)+'</span>' : '';
            var label = (editMode ? '📝 ' : '') + esc(k);
            // 编辑模式: 追加删除按钮(复用sam-fc-del-btn事件 → 二级确认 → 写回MVU删除 → 刷新; stopPropagation防误触详情弹窗)
            var delBtn = editMode ? '<button type="button" class="sam-fc-del-btn sam-buff-del" data-del-path="'+esc(path)+'" title="删除该状态">✕</button>' : '';
            chips += '<div class="sam-buff-chip '+esc(type)+(editMode?' is-edit':'')+'" data-path="'+esc(path)+'" data-name="'+esc(k)+'">'
                + '<span class="sam-buff-name">'+label+'</span>'+durHtml+delBtn+'</div>';
        });
        return '<div class="sam-buff-rail">'+chips+'</div>';
    }

    /* ===== 21. Tab导航 ===== */
    function renderTabRail(curTab) {
        var tabs = [
            {key:'mission', label:'任务', icon:'📜'},
            {key:'info', label:'信息', icon:'📋'},
            {key:'hold', label:'持有', icon:'🎒'},
            {key:'blood', label:'能力', icon:'🧬'},
            {key:'relation', label:'关系', icon:'👥'},
            {key:'asset', label:'经营', icon:'🏗️'},
            {key:'rumor', label:'传闻', icon:'📰'},
            {key:'world', label:'世界', icon:'🌍'},
            {key:'shop', label:'商城', icon:'🛒'}
            // {key:'enhance', label:'强化', icon:'⚒️'}
        ];
        var html = '<div class="sam-tab-rail">';
        tabs.forEach(function(t) {
            html += '<div class="sam-tab-btn '+(t.key===curTab?'active':'')+'" data-tab="'+t.key+'">'+t.icon+'<br>'+t.label+'</div>';
        });
        html += '</div>';
        return html;
    }

    /* ===== 22. Tab内容路由 =====
       同一Tab刷新(非切换)时保持滚动位置; 切换Tab时回到顶部 */
    var lastRenderedTab = null;
    function renderTabContent(tab) {
        var $c = $('#sam-tab-content');
        if (!$c.length) return;
        var sameTab = (tab === lastRenderedTab);
        var savedScroll = sameTab ? ($c[0].scrollTop || 0) : 0;
        var sd = getStatData();
        if (!sd) { $c.html('<div class="sam-empty">无数据</div>'); lastRenderedTab = tab; return; }
        var html = '';
        switch (tab) {
            case 'mission': html = renderMissionTab(sd); break;
            case 'info': html = renderInfoTab(sd); break;
            case 'hold': html = renderHoldTab(sd); break;
            case 'blood': html = renderBloodTab(sd); break;
            case 'relation': html = renderRelationTab(sd); break;
            case 'asset': html = renderAssetTab(sd); break;
            case 'rumor': html = renderRumorTab(sd); break;
            case 'world': html = renderWorldTab(sd); break;
            case 'shop': html = renderShopTab(sd); break;
            case 'enhance': html = renderEnhanceTab(sd); break;
            default: html = '<div class="sam-empty">未知Tab</div>';
        }
        $c.html(html);
        // 还原<details>折叠状态: 按summary文本(剥离数量括号)查detailsOpenState, 覆盖默认open
        // 必须同步执行(在滚动恢复前), 因open属性不依赖reflow时序
        if (Object.keys(detailsOpenState).length) {
            $c.find('details').each(function() {
                var $d = $(this);
                var raw = $d.children('summary').first().text().trim();
                var key = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
                if (key && Object.prototype.hasOwnProperty.call(detailsOpenState, key)) {
                    $d.prop('open', !!detailsOpenState[key]);
                }
            });
        }
        // 同Tab刷新: 同步恢复滚动位置(切Tab时sameTab=false, 天然保持顶部)
        // 注: renderAll路径下此处savedScroll=0(新空容器), 恢复由renderAll用savedScrollTop处理
        if (sameTab && savedScroll > 0) {
            try { $c[0].scrollTop = savedScroll; } catch(e){}
        }
        lastRenderedTab = tab;
    }

    /* ===== 23. Tab: 任务 ===== */
    function renderMissionTab(sd) {
        var m = sd.任务 || {};
        var list = m.列表 || {};
        var kills = m.击杀 || {};
        var contrib = m.贡献 || {};
        var editMode = isEditMode();
        var html = '';
        // 任务列表
        var tHtml = '';
        if (Object.keys(list).length === 0) tHtml += '<div class="sam-empty">[无任务]</div>';
        else {
            tHtml += '<div class="sam-list-1col">';
            Object.keys(list).forEach(function(k) {
                var q = list[k] || {};
                var path = '任务.列表.'+k;
                var status = editMode ? editSelect(path+'.状态', ['进行中','可交付','可结算','失败'], safeStr(q.状态,'进行中')) : esc(q.状态 || '进行中');
                var rows = '';
                rows += fcRow('委托方', q.委托方, path+'.委托方', editMode);
                rows += fcRow('状态', status, null, false);
                rows += fcRow('目标', q.目标, path+'.目标', editMode);
                rows += fcRow('奖励', q.奖励, path+'.奖励', editMode);
                rows += fcRow('交付', q.交付, path+'.交付', editMode);
                var body = fcRow('简介', q.简介, path+'.简介', editMode);
                tHtml += fullCard('', k, rows, body);
            });
            tHtml += '</div>';
        }
        html += secBlock('📜 任务列表 ('+Object.keys(list).length+')', tHtml, Object.keys(list).length > 0);
        // 击杀统计
        var kHtml = '<div class="sam-grid">';
        ['F','E','D','C','B','A','S','SS','SSS'].forEach(function(q) {
            var v = safeNum(kills[q], 0);
            var path = '任务.击杀.'+q;
            kHtml += '<div class="sam-card q-'+q+'"><div class="sam-card-title">'+q+'级</div><div class="sam-card-meta">'+(editMode ? editInput(path, v, 'number') : v)+' 击杀</div></div>';
        });
        kHtml += '</div>';
        html += secBlock('⚔️ 击杀统计', kHtml);
        // 贡献(始终显示)
        var ckeys = Object.keys(contrib);
        var conHtml = '';
        if (ckeys.length === 0) conHtml += '<div class="sam-empty">[暂无贡献记录]</div>';
        else ckeys.forEach(function(k) {
            var c = contrib[k] || {};
            var path = '任务.贡献.'+k;
            conHtml += '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+(editMode ? editInput(path+'.剧情定性', safeStr(c.剧情定性), 'text') : esc(c.剧情定性 || '-'))+'</span></div>';
        });
        html += secBlock('🌟 贡献', conHtml);
        // 结算任务: 置于任务面板所有栏目下方; 仅对主神任务起效(提示说明), 点击发送【结算任务】到输入框
        if (sd.系统状态.是否在主神空间 == false && sd.系统状态.是否战斗中 == false) {
            html += '<div class="sam-mission-settle-wrap">'
                + '<button type="button" class="sam-mission-settle-btn" data-mission-settle>📋 结算任务</button>'
                + '<div class="sam-mission-settle-hint">⚠️ 仅对主神任务起效</div>'
                + '</div>';
        }
        return html;
    }

    /* 层级进度条: 左=当前层级(主角.层级,只读,需进阶任务才升) / 中=基础属性总点+进度条+进阶按钮 / 右=下一层级
       sum=基础属性6项之和; 进度=(sum-当前层级下限)/(下一层级下限-当前层级下限), clamp 0~100
       进阶按钮显示条件: 非最高级 且 sum>=下一层级下限; SSS最高级不显示
       按钮两态(依据 系统状态.进阶试炼已完成):
         - false: "申请进阶" 暗红色 → sendToInputBox("【当前进阶条件已满足，申请进阶试炼】")
         - true:  "开始进阶" 白金色 → writeBackMvu(主角.层级=nextTier) + renderAll()
       战斗中(系统状态.是否战斗中===true) 拦截: 仅提示, 不执行 */
    function renderTierProgressBar(p, fa, sys) {
        var curTier = safeStr(p.层级, 'F');
        var attrs = fa || p.最终属性 || {};
        var sum = safeNum(attrs.力量,0) + safeNum(attrs.敏捷,0) + safeNum(attrs.体质,0)
                + safeNum(attrs.精神,0) + safeNum(attrs.感知,0) + safeNum(attrs.魅力,0);
        var idx = -1;
        for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
            if (TIER_THRESHOLDS[i].tier === curTier) { idx = i; break; }
        }
        if (idx < 0) idx = 0;
        var cur = TIER_THRESHOLDS[idx];
        var isMax = (idx >= TIER_THRESHOLDS.length - 1);
        var next = isMax ? null : TIER_THRESHOLDS[idx + 1];
        var pct;
        if (isMax) {
            pct = 100;
        } else {
            var span = next.min - cur.min;
            pct = span > 0 ? Math.floor(((sum - cur.min) / span) * 100) : 0;
            if (pct < 0) pct = 0;
            if (pct > 100) pct = 100;
        }
        // 进阶按钮: 仅当非最高级 且 属性总点已达下一层级下限时显示
        var advBtnHtml = '';
        if (!isMax && next && sum >= next.min) {
            var st = sys || {};
            var trialDone = (st.进阶试炼已完成 === true);
            if (trialDone) {
                // 进阶试炼已完成 → "开始进阶" 白金色, 点击直接提升层级
                advBtnHtml = '<button type="button" class="sam-tier-adv-btn start" data-tier-act="start" data-tier-next="'+esc(next.tier)+'">✦ 开始进阶</button>';
            } else {
                // 进阶试炼未完成 → "申请进阶" 暗红色, 点击发送申请文字到输入框
                advBtnHtml = '<button type="button" class="sam-tier-adv-btn apply" data-tier-act="apply" data-tier-next="'+esc(next.tier)+'">☠ 申请进阶</button>';
            }
        }
        var leftHtml = '<div class="sam-tier-side q-'+cur.tier+'">'+esc(cur.tier)+'</div>';
        var rightHtml = isMax
            ? '<div class="sam-tier-side max">MAX</div>'
            : '<div class="sam-tier-side next q-'+next.tier+'">'+esc(next.tier)+'</div>';
        var midHtml = '<div class="sam-tier-mid">'
            + '<div class="sam-tier-sum"><span>属性总点</span><span class="v">'+sum+(isMax?'':' / '+next.min)+'</span></div>'
            + '<div class="sam-tier-bar"><div class="bar-fill" style="width:'+pct+'%;"></div></div>'
            + advBtnHtml
            + '</div>';
        return '<div class="sam-tier-prog">'+leftHtml+midHtml+rightHtml+'</div>';
    }

    /* ===== 24. Tab: 信息(主角详情) ===== */
    function renderInfoTab(sd) {
        var p = sd.主角 || {};
        var editMode = isEditMode();
        var html = '';
        // 角色信息
        var infoHtml = '';
        var fields = [
            {k:'身份', path:'主角.身份', type:'text', arr:true},
            {k:'职业', path:'主角.职业', type:'text', arr:true}
        ];
        fields.forEach(function(f) {
            var v = resolvePath(sd, f.path);
            var display;
            if (f.readonly || isReadonlyPath(f.path)) {
                display = '<span class="sam-edit-readonly">'+esc(Array.isArray(v)?v.join('/'):v)+'</span>';
            } else if (editMode) {
                var val = f.arr ? (Array.isArray(v) ? v.join(',') : safeStr(v)) : v;
                display = editInput(f.path, val, f.type);
            } else {
                display = esc(Array.isArray(v) ? v.join(' / ') : safeStr(v));
            }
            infoHtml += '<div class="sam-row"><span class="k">'+esc(f.k)+'</span><span class="v">'+display+'</span></div>';
        });
        html += secBlock('📋 角色信息', infoHtml);
        // 最终属性 - 拆分为基础属性/修正值/衍生属性三个面板(只读,系统计算)
        var fa = p.最终属性 || {};
        // 1.基础属性(6项)
        var baseHtml = '<div class="sam-grid-2">';
        ['力量','敏捷','体质','精神','感知','魅力'].forEach(function(an) {
            var v = safeNum(fa[an], 0);
            var path = '主角.最终属性.'+an;
            baseHtml += '<div class="sam-row"><span class="k">'+esc(an)+'</span><span class="v">'+(editMode && !isReadonlyPath(path) ? editInput(path, v, 'number') : '<span class="sam-edit-readonly">'+v+'</span>')+'</span></div>';
        });
        baseHtml += '</div>';
        // 层级进度条: 当前层级(取自主角.层级,只读) → 下一层级; 中间显示基础属性总点数与进度
        html += renderTierProgressBar(p, fa, sd.系统状态 || {});
        html += secBlock('💪 基础属性', baseHtml);
        // 2.修正值(6项)
        var modHtml = '<div class="sam-grid-2">';
        ['力量修正','敏捷修正','体质修正','精神修正','感知修正','魅力修正'].forEach(function(an) {
            var v = safeNum(fa[an], 0);
            var path = '主角.最终属性.'+an;
            modHtml += '<div class="sam-row"><span class="k">'+esc(an)+'</span><span class="v">'+(editMode && !isReadonlyPath(path) ? editInput(path, v, 'number') : '<span class="sam-edit-readonly">'+v+'</span>')+'</span></div>';
        });
        modHtml += '</div>';
        html += secBlock('✨ 修正值', modHtml);
        // 3.衍生属性
        var derHtml = '<div class="sam-grid-2">';
        // 衍生属性: 数据键(key, 与辅助计算脚本写入字段一致) + 显示名(label, 带中文后缀)
        var derList = [
            {key:'DEF', label:'DEF(物防)'},
            {key:'MDEF', label:'MDEF(术防)'},
            {key:'物理减伤率', label:'物理减伤率'},
            {key:'魔法减伤率', label:'魔法减伤率'},
            {key:'AP', label:'AP(法术增幅)'},
            {key:'先攻DC', label:'先攻DC'},
            {key:'防御DC', label:'防御DC'}
        ];
        derList.forEach(function(item) {
            var key = item.key, label = item.label;
            var v = safeNum(fa[key], 0);
            var unit = (key === 'AP' || key.indexOf('减伤率')>=0) ? '%' : '';
            var path = '主角.最终属性.'+key;
            derHtml += '<div class="sam-row"><span class="k">'+esc(label)+'</span><span class="v">'+(editMode && !isReadonlyPath(path) ? editInput(path, v, 'number') : '<span class="sam-edit-readonly">'+v+unit+'</span>')+'</span></div>';
        });
        derHtml += '</div>';
        // 3b. 武器攻击(并入衍生属性, 减伤说明上方; 无武装常驻+已装备武器; ATK/MATK分两排)
        var wpn = fa.武器 || {};
        derHtml += '<div class="sam-wpn-divider">⚔ 武器攻击</div>';
        derHtml += '<div class="sam-wpn-list">';
        derHtml += '<div class="sam-wpn-row base"><div class="sam-wpn-name">无武装</div><div class="sam-wpn-stat atk">ATK(物攻) <b>'+safeNum(wpn.无武装 && wpn.无武装.ATK, 0)+'</b></div><div class="sam-wpn-stat matk">MATK(术攻) <b>'+safeNum(wpn.无武装 && wpn.无武装.MATK, 0)+'</b></div></div>';
        Object.keys(wpn).forEach(function(name) {
            if (name === '无武装') return;
            var w = wpn[name] || {};
            derHtml += '<div class="sam-wpn-row"><div class="sam-wpn-name">⚔ '+esc(name)+'</div><div class="sam-wpn-stat atk">ATK(物攻) <b>'+safeNum(w.ATK, 0)+'</b></div><div class="sam-wpn-stat matk">MATK(术攻) <b>'+safeNum(w.MATK, 0)+'</b></div></div>';
        });
        derHtml += '</div>';
        // 减伤率说明标签: 上限与各阶位满防基准
        derHtml += '<div style="margin-top:8px;padding:8px 10px;background:var(--sam-hover);border:1px solid var(--sam-border);border-left:3px solid var(--sam-accent);border-radius:6px;font-size:11px;line-height:1.7;color:var(--sam-sub);">'
            + '<div style="color:var(--sam-accent);font-weight:bold;margin-bottom:3px;">🛡️ 减伤率说明</div>'
            + '<div>减伤率上限：<b style="color:var(--sam-text);">75%</b>（超过不再叠加）</div>'
            + '<div>各阶位满防基准（DEF/MDEF 达到对应值即满减伤）：</div>'
            + '<div style="color:var(--sam-text);margin-top:2px;letter-spacing:0.3px;">F:20　E:60　D:200　C:600　B:2000　A:6000　S:20000　SS:60000　SSS:150000</div>'
            + '</div>';
        html += secBlock('⚡ 衍生属性', derHtml);
        // 注: "当前形态"栏已移除 — 顶部头像旁已显示形态名, 由能力面板激活按钮统一管理
        return html;
    }

    /* 战术栏穿戴槽位信息栏: 统计装备(status=1)各类型穿戴数 + 道具(status=1)数, 显示 当前/上限
       超限(当前>上限)标红; 满(当前==上限且上限>0)标蓝; 特殊(类型8)无上限显示 当前/X */
    function renderEquipSlotsBar(p) {
        var equips = p.装备 || {};
        var items = p.背包 || {};
        // 装备类型与上限来自模块级常量 EQUIP_SLOTS; 道具上限来自 ITEM_SLOT_CAP
        // 统计各类型已穿戴数
        var counts = {};
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            if (Number(e.状态) === 1) {
                var t = Number(e.类型);
                counts[t] = (counts[t] || 0) + 1;
            }
        });
        // 道具已穿戴数
        var itemCount = 0;
        Object.keys(items).forEach(function(k) {
            if (Number(items[k].状态) === 1) itemCount++;
        });
        var html = '<div class="sam-slots-bar">';
        EQUIP_SLOTS.forEach(function(s) {
            var cur = counts[s.type] || 0;
            var cls = 'sam-slot-chip';
            var right;
            if (s.cap === 0) {
                // 特殊: 无上限, 显示 cur/X (X=cur自身, 表示当前穿戴数)
                right = cur+'/X';
            } else {
                right = cur+'/'+s.cap;
                if (cur > s.cap) cls += ' over';      // 超限标红
                else if (cur === s.cap) cls += ' full'; // 满标蓝
            }
            html += '<span class="'+cls+'">'+s.label+' <span class="n">'+right+'</span></span>';
        });
        // 道具槽 (上限来自 ITEM_SLOT_CAP)
        var iCls = 'sam-slot-chip';
        if (itemCount > ITEM_SLOT_CAP) iCls += ' over';
        else if (itemCount === ITEM_SLOT_CAP) iCls += ' full';
        html += '<span class="'+iCls+'">道具 <span class="n">'+itemCount+'/'+ITEM_SLOT_CAP+'</span></span>';
        html += '</div>';
        return html;
    }

    /* ===== 25. Tab: 持有(战术栏/装备/道具/仓库) =====
       改版: 装备背包/道具背包/仓库 由折叠栏改为顶部子Tab(战术栏 + 三仓)
       - 顶部常驻穿戴槽位信息栏 + 4个子Tab(带数量角标)
       - 子Tab选择存于模块级 holdActiveTab, 切聊天/重渲染保持
       - 内容区按当前子Tab渲染对应状态的卡片列表, 附战斗可见性提示 */
    var holdActiveTab = 'tactical';   // 持有子Tab: tactical|equip|item|storage
    function renderHoldTab(sd) {
        var p = sd.主角 || {};
        var editMode = isEditMode();
        var equips = p.装备 || {};
        var items = p.背包 || {};
        // 统计字典中 状态 命中 statuses 的条目数(用于子Tab角标计数)
        function countByStatus(dict, statuses) {
            var n = 0;
            Object.keys(dict || {}).forEach(function(k) {
                var st = Number((dict[k] || {}).状态);
                if (statuses.indexOf(st) >= 0) n++;
            });
            return n;
        }
        // 各子Tab条目数(供角标)
        var tCount = countByStatus(equips, [1]) + countByStatus(items, [1]);
        var eCount = countByStatus(equips, [0]);
        var iCount = countByStatus(items, [0]);
        var wCount = countByStatus(equips, [2]) + countByStatus(items, [2]);
        var tabs = [
            {key:'tactical', icon:'🎯', label:'战术栏', cnt:tCount},
            {key:'equip',    icon:'⚔️', label:'装备背包', cnt:eCount},
            {key:'item',     icon:'🎒', label:'道具背包', cnt:iCount},
            {key:'storage',  icon:'📦', label:'仓库', cnt:wCount}
        ];
        // 校验当前激活子Tab有效(防脏值)
        var validKeys = tabs.map(function(t){ return t.key; });
        if (validKeys.indexOf(holdActiveTab) < 0) holdActiveTab = 'tactical';
        var html = '';
        // 穿戴槽位信息栏(各类装备/道具 当前穿戴数/上限, 常驻顶部)
        html += renderEquipSlotsBar(p);
        // 子Tab条
        html += '<div class="sam-hold-tabs">';
        tabs.forEach(function(t) {
            var active = (t.key === holdActiveTab);
            html += '<button type="button" class="sam-hold-tab'+(active?' active':'')+'" data-hold-tab="'+t.key+'">'
                + '<span class="sam-hold-tab-ico">'+t.icon+'</span>'
                + '<span class="sam-hold-tab-lbl">'+t.label+'</span>'
                + '<span class="sam-hold-tab-cnt'+(t.cnt?'':' zero')+'">'+t.cnt+'</span>'
                + '</button>';
        });
        html += '</div>';
        // 内容区: 独立容器, 切Tab时仅替换其内容(不重建Tab条, 避免整排抖动/错位)
        html += '<div class="sam-hold-content" id="sam-hold-body">'+renderHoldBody(sd)+'</div>';
        return html;
    }
    /* 持有面板内容区: 按当前 holdActiveTab 渲染对应状态卡片列表 + 战斗可见性提示
       独立于Tab条, 供子Tab切换时局部刷新(不触发Tab条DOM重建, 消除抖动) */
    function renderHoldBody(sd) {
        var p = sd.主角 || {};
        var editMode = isEditMode();
        var equips = p.装备 || {};
        var items = p.背包 || {};
        // 剥离[无]占位, 仅保留真实卡片HTML(避免空占位被grid当作单格占位导致视觉空格)
        function stripEmpty(s){ return (s||'').replace(/<div class="sam-empty">\[无\]<\/div>/g,'').trim(); }
        function mergeList(htmlA, htmlB, emptyMsg){
            var cards = stripEmpty(htmlA) + stripEmpty(htmlB);
            if (cards === '') return '<div class="sam-empty">'+emptyMsg+'</div>';
            return '<div class="sam-card-list">'+cards+'</div>';
        }
        var content = '', hint = '';
        if (holdActiveTab === 'tactical') {
            // 战术栏: 已装备的装备(status=1) + 已装备的道具(status=1)
            content = mergeList(
                renderEquipFullList(equips, '主角.装备', editMode, [1]),
                renderItemFullList(items, '主角.背包', editMode, [1]),
                '尚未装备任何战术项'
            );
        } else if (holdActiveTab === 'equip') {
            // 装备背包: status=0
            content = mergeList(
                renderEquipFullList(equips, '主角.装备', editMode, [0]),
                '', '装备背包空空如也'
            );
            hint = '战斗时 AI 不可见';
        } else if (holdActiveTab === 'item') {
            // 道具背包: status=0
            content = mergeList(
                renderItemFullList(items, '主角.背包', editMode, [0]),
                '', '道具背包空空如也'
            );
            hint = '战斗时 AI 不可见';
        } else {
            // 仓库: 装备status=2 + 道具status=2
            content = mergeList(
                renderEquipFullList(equips, '主角.装备', editMode, [2]),
                renderItemFullList(items, '主角.背包', editMode, [2]),
                '仓库中没有存放任何物品'
            );
            hint = 'AI 不可见';
        }
        var hintHtml = hint ? '<div class="sam-hold-hint">🔒 '+hint+'</div>' : '';
        return hintHtml + content;
    }
    /* 装备完整资料卡片列表(内联展示, 不用弹窗; 品质仅在标题右侧徽章展示) */
    function renderEquipFullList(equips, basePath, editMode, statuses) {
        var filtered = [];
        Object.keys(equips).forEach(function(k) {
            var e = equips[k] || {};
            var st = Number(e.状态);
            if (statuses.indexOf(st) >= 0) filtered.push({key:k, val:e});
        });
        if (filtered.length === 0) return '<div class="sam-empty">[无]</div>';
        var typeMap = ['武器','手套','头部','胸部','腿部','鞋子','披风','饰品','特殊'];
        var html = '';
        filtered.forEach(function(it) {
            var e = it.val;
            var st = Number(e.状态);
            var path = basePath+'.'+it.key;
            var q = parseRarity(e.品质);
            var typeStr = typeMap[e.类型] || '未知';
            var rows = '';
            rows += fcRow('类型', typeStr, path+'.类型', false); // 类型是数字枚举, 不可编辑
            if (e.消耗) rows += fcRow('消耗', e.消耗, path+'.消耗', editMode);
            var body = '<div class="sam-fc-body">';
            if (editMode || (Array.isArray(e.标签) && e.标签.length > 0)) body += fcBody('标签', formatTags(e.标签, path+'.标签', editMode), 'sam-fc-tags');
            if (e.原始属性 && typeof e.原始属性 === 'object' && Object.keys(e.原始属性).length > 0) {
                body += fcBodyCollapsible('原始属性', formatStatGrid(e.原始属性, 3), 'sam-fc-stats', false);
            }
            body += fcBody('效果', formatEffects(e.效果, path+'.效果', editMode), 'sam-fc-effects');
            var descContent;
            if (editMode && !isReadonlyPath(path+'.描述')) {
                descContent = editInput(path+'.描述', safeStr(e.描述), 'textarea');
            } else {
                descContent = esc(safeStr(e.描述) || '-');
            }
            body += fcBody('描述', descContent);
            // 操作按钮(类型8特殊装备无按钮无限制); 删除按钮仅在修改模式显示
            var btns = equipActionButtons(path, st, Number(e.类型), editMode);
            if (btns) body += fcBody('操作', btns, 'sam-fc-actions');
            body += '</div>';
            html += fullCard(q, it.key, rows, body);
        });
        return html;
    }
    /* 道具完整资料卡片列表(内联展示, 不用弹窗; 品质仅在标题右侧徽章展示) */
    function renderItemFullList(items, basePath, editMode, statuses) {
        var filtered = [];
        Object.keys(items).forEach(function(k) {
            var it = items[k] || {};
            var st = Number(it.状态);
            if (statuses.indexOf(st) >= 0) filtered.push({key:k, val:it});
        });
        if (filtered.length === 0) return '<div class="sam-empty">[无]</div>';
        var html = '';
        filtered.forEach(function(it) {
            var v = it.val;
            var st = Number(v.状态);
            var path = basePath+'.'+it.key;
            var q = parseRarity(v.品质);
            var qty = safeNum(v.数量, 1);
            var rows = '';
            rows += fcRow('类型', v.类型, path+'.类型', editMode);
            rows += fcRow('数量', qty, path+'.数量', editMode, 'number');
            var body = '<div class="sam-fc-body">';
            if (editMode || (Array.isArray(v.标签) && v.标签.length > 0)) body += fcBody('标签', formatTags(v.标签, path+'.标签', editMode), 'sam-fc-tags');
            body += fcBody('效果', formatEffects(v.效果, path+'.效果', editMode), 'sam-fc-effects');
            var descContent;
            if (editMode && !isReadonlyPath(path+'.描述')) {
                descContent = editInput(path+'.描述', safeStr(v.描述), 'textarea');
            } else {
                descContent = esc(safeStr(v.描述) || '-');
            }
            body += fcBody('描述', descContent);
            body += fcBody('操作', itemActionButtons(path, st, editMode), 'sam-fc-actions');
            body += '</div>';
            html += fullCard(q, it.key, rows, body);
        });
        return html;
    }
    /* 技能完整资料卡片列表(用于血统Tab; 品质仅在标题右侧徽章展示)
       主动/被动/特殊 三栏改为可伸缩<details>, 标题显示数量 */
    function renderSkillFullList(skills, basePath, editMode) {
        var cats = [
            {idx:0, label:'主动'},
            {idx:1, label:'被动'},
            {idx:2, label:'特殊'}
        ];
        var html = '';
        cats.forEach(function(cat) {
            var list = [];
            Object.keys(skills).forEach(function(k) {
                var s = skills[k] || {};
                if (Number(s.类型) === cat.idx) list.push({key:k, val:s});
            });
            // 可伸缩分组, 标题带数量
            html += '<details class="sam-skill-group">';  // 默认折叠; 折叠记忆优先覆盖
            html += '<summary>✨ '+cat.label+'技能 ('+list.length+')</summary>';
            if (list.length === 0) { html += '<div class="sam-empty">[无]</div>'; html += '</details>'; return; }
            html += '<div class="sam-card-list">';
            list.forEach(function(it) {
                var s = it.val;
                var path = basePath+'.'+it.key;
                var q = parseRarity(s.品质);
                var rows = '';
                rows += fcRow('消耗', s.消耗, path+'.消耗', editMode);
                var body = '<div class="sam-fc-body">';
                if (editMode || (Array.isArray(s.标签) && s.标签.length > 0)) body += fcBody('标签', formatTags(s.标签, path+'.标签', editMode), 'sam-fc-tags');
                body += fcBody('效果', formatEffects(s.效果, path+'.效果', editMode), 'sam-fc-effects');
                var descContent;
                if (editMode && !isReadonlyPath(path+'.描述')) {
                    descContent = editInput(path+'.描述', safeStr(s.描述), 'textarea');
                } else {
                    descContent = esc(safeStr(s.描述) || '-');
                }
                body += fcBody('描述', descContent);
                body += '</div>';
                html += fullCard(q, it.key, rows, body, samDelBtn(path, editMode, '删除技能'));
            });
            html += '</div>';
            html += '</details>';
        });
        return html;
    }

    /* ===== 26. Tab: 血统(血统/形态库/技能) ===== */
    function renderBloodTab(sd) {
        var p = sd.主角 || {};
        var bl = p.血统 || {};
        var editMode = isEditMode();
        var keys = Object.keys(bl);
        // 血统数量限制: 取自顶部常量 BLOODLINE_CAP(默认3), 用于栏目标题与商城上限判定
        var bloodLimit = BLOODLINE_CAP;
        var html = '';
        // 血统
        var blHtml = '';
        if (keys.length === 0) blHtml += '<div class="sam-empty">[无血统]</div>';
        else {
            blHtml += '<div class="sam-card-list">';
            keys.forEach(function(k) {
                var b = bl[k] || {};
                var path = '主角.血统.'+k;
                var q = parseRarity(b.品质);
                var rows = '';
                var body = '<div class="sam-fc-body">';
                if (editMode || (Array.isArray(b.标签) && b.标签.length > 0)) body += fcBody('标签', formatTags(b.标签, path+'.标签', editMode), 'sam-fc-tags');
                if (b.原始属性 && typeof b.原始属性 === 'object' && Object.keys(b.原始属性).length > 0) {
                    body += fcBodyCollapsible('原始属性', formatStatGrid(b.原始属性, 3), 'sam-fc-stats', false);
                }
                body += fcBody('效果', formatEffects(b.效果, path+'.效果', editMode), 'sam-fc-effects');
                var descContent;
                if (editMode && !isReadonlyPath(path+'.描述')) {
                    descContent = editInput(path+'.描述', safeStr(b.描述), 'textarea');
                } else {
                    descContent = esc(safeStr(b.描述) || '-');
                }
                body += fcBody('描述', descContent);
                body += '</div>';
                blHtml += fullCard(q, k, rows, body, samDelBtn(path, editMode, '删除血统'));
            });
            blHtml += '</div>';
        }
        html += secBlock('🧬 血统 ('+keys.length+'/'+bloodLimit+')', blHtml, false);  // 默认折叠; 折叠记忆优先覆盖
        // 形态库
        var forms = p.形态库 || {};
        var fkeys = Object.keys(forms);
        var fHtml = '';
        if (fkeys.length === 0) fHtml += '<div class="sam-empty">[无形态]</div>';
        else {
            fHtml += '<div class="sam-card-list">';
            fkeys.forEach(function(k) {
                var f = forms[k] || {};
                var path = '主角.形态库.'+k;
                var q = parseRarity(f.品质);
                var rows = '';
                rows += fcRow('状态', f.状态, path+'.状态', editMode);
                rows += fcRow('消耗', f.消耗, path+'.消耗', editMode);
                // 注: 冷却不再用 fcRow 显示, 由激活按钮(⏳ N回合)统一呈现, 避免重复
                var body = '<div class="sam-fc-body">';
                if (f.原始属性 && typeof f.原始属性 === 'object' && Object.keys(f.原始属性).length > 0) {
                    body += fcBodyCollapsible('原始属性', formatStatGrid(f.原始属性, 3), 'sam-fc-stats', false);
                }
                body += fcBody('效果', formatEffects(f.效果, path+'.效果', editMode), 'sam-fc-effects');
                var descContent;
                if (editMode && !isReadonlyPath(path+'.描述')) {
                    descContent = editInput(path+'.描述', safeStr(f.描述), 'textarea');
                } else {
                    descContent = esc(safeStr(f.描述) || '-');
                }
                body += fcBody('描述', descContent);
                // 形态自带技能子表
                var formSkills = f.技能 || {};
                if (formSkills && typeof formSkills === 'object' && Object.keys(formSkills).length > 0) {
                    body += fcBody('技能', renderSkillFullList(formSkills, path+'.技能', editMode), 'sam-fc-skills');
                }
                // 激活/取消按钮: 放在品质徽章左侧(headExtra); 已激活→✕取消(可点), 冷却中→禁用⏳, 归零→⚡激活
                var cf = p.当前形态 || {};
                var isThisActive = (cf.激活 === true && safeStr(cf.名称) === k);
                var cdCur = 0;
                var cdM = safeStr(f.冷却).match(/^(\d+)\s*\/\s*(\d+)/);
                if (cdM) cdCur = parseInt(cdM[1], 10) || 0;
                var actBtnHtml;
                if (isThisActive) {
                    actBtnHtml = '<button class="sam-act-btn" data-act="deactivate" data-form="'+esc(k)+'">✕ 取消</button>';
                } else if (cdCur > 0) {
                    actBtnHtml = '<button class="sam-act-btn" disabled style="opacity:0.6;cursor:not-allowed;">⏳ '+cdCur+'回合</button>';
                } else {
                    actBtnHtml = '<button class="sam-act-btn" data-act="activate" data-form="'+esc(k)+'">⚡ 激活</button>';
                }
                body += '</div>';
                fHtml += fullCard(q, k, rows, body, (actBtnHtml||'') + samDelBtn(path, editMode, '删除形态'));
            });
            fHtml += '</div>';
        }
        html += secBlock('🌀 形态库 ('+fkeys.length+')', fHtml, false);  // 默认折叠; 折叠记忆优先覆盖
        // 技能(直接列出主动/被动/特殊三个折叠栏, 不再套外层"主技能栏"section)
        var skills = p.技能 || {};
        html += renderSkillFullList(skills, '主角.技能', editMode);
        return html;
    }

    /* ===== 27. Tab: 关系 ===== */
    function renderRelationTab(sd) {
        var rel = sd.关系列表 || {};
        var editMode = isEditMode();
        var all = [], present = [], absent = [], team = [];
        Object.keys(rel).forEach(function(k) {
            var n = rel[k] || {};
            var item = {key:k, val:n};
            all.push(item);
            if (n.在场 === true) present.push(item); else absent.push(item);
            if (n.是否队友 === true) team.push(item);
        });
        var html = '<div class="sam-subtabs">'
            + '<div class="sam-subtab active" data-sub="all">全部('+all.length+')</div>'
            + '<div class="sam-subtab" data-sub="present">在场('+present.length+')</div>'
            + '<div class="sam-subtab" data-sub="absent">不在场('+absent.length+')</div>'
            + '<div class="sam-subtab" data-sub="team">小队('+team.length+')</div>'
            + '</div>';
        html += '<div class="sam-subpane active" data-sub="all">'+renderNpcList(all, editMode, 'all')+'</div>';
        html += '<div class="sam-subpane" data-sub="present" style="display:none;">'+renderNpcList(present, editMode, 'present')+'</div>';
        html += '<div class="sam-subpane" data-sub="absent" style="display:none;">'+renderNpcList(absent, editMode, 'absent')+'</div>';
        html += '<div class="sam-subpane" data-sub="team" style="display:none;">'+renderNpcList(team, editMode, 'present')+'</div>';
        return html;
    }
    /* NPC单列卡片: mode决定字段
       all    -> 名字/在场状态/种族/身份/HP·好感/外貌/心里话
       present-> 能显示都显示+伸缩框(性格/着装/喜爱/状态/装备/技能等)
       absent -> 姓名/种族/身份/层级/好感度/外貌/背景故事 */
    /* 仅AI可见的身份关键词: 不在玩家面板显示(只在数据库中给AI看) */
    var HIDDEN_IDENTITY_KEYWORDS = ['执行者', '篡夺者', '梦魇师', '残魂', '穿越者'];
    function isHiddenIdentity(s) {
        if (typeof s !== 'string') return false;
        for (var i = 0; i < HIDDEN_IDENTITY_KEYWORDS.length; i++) {
            if (s.indexOf(HIDDEN_IDENTITY_KEYWORDS[i]) >= 0) return true;
        }
        return false;
    }
    function filterHiddenIdentity(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.filter(function(x) { return !isHiddenIdentity(x); });
    }
    function renderNpcList(list, editMode, mode) {
        if (list.length === 0) return '<div class="sam-empty">[无]</div>';
        var html = '<div class="sam-list-1col">';
        list.forEach(function(it) {
            var n = it.val;
            var path = '关系列表.'+it.key;
            var q = parseRarity(n.层级);
            var hp = safeNum(n.HP,0), hpmax = safeNum(n.HP_MAX,1);
            var ep = safeNum(n.EP,0), epmax = safeNum(n.EP_MAX,1);
            var thp = safeNum(n.THP,0);
            var favor = safeNum(n.好感度,0);
            var race = safeStr(n.种族) || '-';
            // 阵营身份默认隐藏(仅AI可见); 但小队成员或好感度>60时不隐藏
            var rawIdArr = Array.isArray(n.身份) ? n.身份 : [];
            var showAllIdentity = (n.是否队友 === true) || (favor > 60);
            var idArr = showAllIdentity ? rawIdArr : filterHiddenIdentity(rawIdArr);
            var idStr = idArr.length ? idArr.join(' / ') : '-';
            var jobArr = Array.isArray(n.职业) ? n.职业 : [];
            var jobStr = jobArr.length ? jobArr.join(' / ') : '-';
            var looks = safeStr(n.外貌) || '';
            var dress = safeStr(n.着装) || '';
            var persona = safeStr(n.性格) || '';
            var likes = safeStr(n.喜爱) || '';
            var mind = safeStr(n.心里话) || '';
            var bg = safeStr(n.背景故事) || '';
            var presentTxt = (n.在场 === true) ? '是' : '否';
            // 在场卡片点击弹详情(同全部/不在场)
            var cls = 'sam-card sam-npc-card q-'+q;
            var card = '<div class="'+cls+'" data-path="'+esc(path)+'" data-title="'+esc(it.key)+'">';
            // 编辑模式: 右上角删除按钮
            if (editMode) card += '<button type="button" class="sam-npc-del" data-del-npc="'+esc(it.key)+'" title="删除该NPC">✕</button>';
            // 在场卡片: 右上角转移按钮(仅在场时显示; 编辑模式时左移避开删除按钮)
            if (mode === 'present' && n.在场 === true) {
                var trfPos = editMode ? 'right:30px;' : 'right:4px;';
                card += '<button type="button" class="sam-npc-transfer" data-transfer-npc="'+esc(it.key)+'" style="'+trfPos+'" title="向该角色转移物资">📦 转移</button>';
            }
            // 头像+名字 横排: 有立绘=小头像(点击放大), 无立绘=小按钮(点击上传)
            var npcPUrl = getNpcPortrait(it.key);
            card += '<div class="sam-npc-head">';
            if (npcPUrl) {
                card += '<div class="sam-npc-avatar has-img" data-name="'+esc(it.key)+'" data-portrait="'+esc(npcPUrl)+'">';
                card += '<img src="'+esc(npcPUrl)+'" alt="'+esc(it.key)+'">';
                card += '</div>';
            } else {
                card += '<button type="button" class="sam-npc-portrait-btn" data-name="'+esc(it.key)+'" title="设置立绘">📷 立绘</button>';
            }
            // NPC 变身形态: 若 当前形态.激活===true 且有名称, 名字右侧显示形态名
            var npcCf = n.当前形态 || {};
            var npcFormName = (npcCf.激活 === true && safeStr(npcCf.名称)) ? safeStr(npcCf.名称) : '';
            var npcFormTag = npcFormName ? '<span class="sam-npc-form-tag">🌀 '+esc(npcFormName)+'</span>' : '';
            card += '<div class="sam-npc-head-info"><div class="sam-npc-head-name">'+esc(it.key)+npcFormTag+'</div></div>';
            card += '</div>';
            if (mode === 'all') {
                // 紧凑双列网格: 短字段并排, 节省纵向空间
                var allGrid = '';
                allGrid += npcRow('在场', presentTxt);
                allGrid += npcRow('种族', race);
                allGrid += npcRow('身份', idStr);
                allGrid += npcRow('好感', favor);
                var qty = safeNum(n.数量, 1);
                if (qty > 1) {
                    allGrid += npcRow('THP', thp);
                    allGrid += npcRow('数量', 'x'+qty);
                } else {
                    allGrid += npcRow('HP', hp+'/'+hpmax);
                }
                card += '<div class="sam-npc-grid">'+allGrid+'</div>';
                // 长文本全宽
                if (looks) card += npcRow('外貌', looks);
                if (bg) card += npcRow('背景故事', bg);
            } else if (mode === 'present') {
                // 基础信息双列网格
                var grid = '';
                grid += npcRow('在场', presentTxt);
                grid += npcRow('种族', race);
                grid += npcRow('身份', idStr);
                grid += npcRow('职业', jobStr);
                grid += npcRow('层级', q, 'sam-npc-tier q-'+q);
                grid += npcRow('好感度', favor);
                card += '<div class="sam-npc-grid">'+grid+'</div>';
                // 进度条 HP/EP/THP
                card += '<div class="sam-npc-sec"></div>';
                card += npcBar('HP', hp, hpmax, 'var(--sam-hp)');
                card += npcBar('EP', ep, epmax, 'var(--sam-ep)');
                card += npcThpRow(thp);
                // 外貌(含着装)
                if (looks || dress) {
                    card += '<div class="sam-npc-sec"></div>';
                    if (looks) card += npcRow('外貌', looks);
                    if (dress) card += npcRow('着装', dress);
                }
                // 心里话
                if (mind) { card += '<div class="sam-npc-sec"></div>'; card += '<div class="sam-npc-quote">'+esc(mind)+'</div>'; }
            } else { // absent
                card += npcRow('种族', race);
                card += npcRow('身份', idStr);
                card += npcRow('层级', q, 'sam-npc-tier q-'+q);
                card += npcRow('好感度', favor);
                if (looks) card += npcRow('外貌', looks);
                if (bg) card += npcRow('背景故事', bg);
            }
            card += '</div>';
            html += card;
        });
        html += '</div>';
        return html;
    }
    function npcRow(k, v, vClass) {
        var cls = vClass ? ' v '+vClass : ' v';
        return '<div class="sam-npc-row"><span class="k">'+esc(k)+':</span> <span class="'+cls.trim()+'">'+esc(safeStr(v))+'</span></div>';
    }
    function npcBar(label, cur, max, color) {
        var pct = (max > 0) ? Math.min(100, Math.round(cur / max * 100)) : 0;
        return '<div class="sam-npc-bar">'
            + '<span class="lbl" style="color:'+color+';">'+esc(label)+'</span>'
            + '<div class="trk"><div class="fl" style="width:'+pct+'%;background:'+color+';"></div></div>'
            + '<span class="num">'+cur+'/'+max+'</span>'
            + '</div>';
    }
    /* NPC THP行: 纯数值(临时护盾/额外生命值, 无上限无进度条) */
    function npcThpRow(cur) {
        return '<div class="sam-npc-thp-row">'
            + '<span class="lbl">THP (临时护盾/额外生命值)</span>'
            + '<span class="num">'+cur+'</span>'
            + '</div>';
    }

    /* ===== 28. Tab: 经营(资产) —— 每个资产名为一个可折叠栏目, 展开显示全部资料(不再弹详情窗) ===== */
    function renderAssetTab(sd) {
        var assets = sd.资产 || {};
        var editMode = isEditMode();
        var keys = Object.keys(assets);
        if (keys.length === 0) return ''
            + '<div class="sam-asset-empty">'
            +   '<div class="ae-title">🏗️ 经营资产</div>'
            +   '<div class="ae-desc">在此管理你的产业、据点与大型载具——它们能为角色提供检定加成、定期产出与战斗支援。</div>'
            +   '<div class="ae-section"><div class="ae-h">可经营类型</div>'
            +     '<ul>'
            +       '<li><b>固定地产</b>：领地 / 庄园 / 店铺 / 秘密据点，含建设序列、驻扎人员、待办事件</li>'
            +       '<li><b>大型载具与要塞</b>：星舰 / 战争兵器，可下场参战或场外火力支援，受能源与完整度约束</li>'
            +     '</ul>'
            +   '</div>'
            +   '<div class="ae-section"><div class="ae-h">如何获得</div>'
            +   '<div class="ae-desc">通过剧情事件、任务奖励或扩张领土获得（资产不得凭空生成）。获得领土级资产时，初始建设序列直接解锁满额 8 条。</div>'
            +   '</div>'
            + '</div>';
        var html = '<div class="sam-asset-wrap">';
        keys.forEach(function(k) {
            html += renderAssetBlock(k, assets[k] || {}, '资产.' + k, editMode);
        });
        html += '</div>';
        return html;
    }
    // 资产类型 → 图标
    function assetTypeIcon(type) {
        if (type === '大型载具与要塞') return '🚀';
        if (type === '便携式据点') return '🎒';
        return '🏛️';
    }
    // 完整度 → 状态色类
    function assetIntegClass(v) {
        if (v >= 80) return 'good';
        if (v >= 40) return 'warn';
        return 'bad';
    }
    // 建设阶段 → 色类
    function assetStageClass(stage) {
        var map = { '基础':'s1', '进阶':'s2', '专业':'s3', '顶尖':'s4', '禁忌':'s5' };
        return map[stage] || 's1';
    }
    // 标量: 编辑态返回可编辑组件, 否则纯文本
    function assetScalar(path, val, type, editMode) {
        return editMode ? editInput(path, val, type || 'text') : esc(safeStr(val, '-'));
    }
    // 标签数组 → chips
    function assetTagChips(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return '<span class="sam-asset-none">无</span>';
        return '<div class="sam-asset-tags">' + arr.map(function(t) {
            return '<span class="sam-asset-tag">' + esc(safeStr(t)) + '</span>';
        }).join('') + '</div>';
    }
    // 规模点阵(1-10); 编辑态改用输入框
    function assetScaleDots(scale, path, editMode) {
        if (editMode) return editInput(path + '.主体规模', scale, 'number');
        var dots = '';
        for (var i = 1; i <= 10; i++) {
            dots += '<span class="sam-asset-dot' + (i <= scale ? ' on' : '') + '"></span>';
        }
        return dots + '<span class="sam-asset-scale-num">' + scale + '/10</span>';
    }
    // KV行
    function assetKvRow(k, vHtml) {
        return '<div class="sam-asset-kv"><span class="k">' + esc(k) + '</span><span class="v">' + vHtml + '</span></div>';
    }
    /* 单个资产可折叠栏目(默认展开, 展开后显示全部资料) */
    function renderAssetBlock(name, a, path, editMode) {
        var type = safeStr(a.类型, '固定地产');
        var integ = safeNum(a.完整度, 100);
        var scale = safeNum(a.主体规模, 1);
        var integCls = assetIntegClass(integ);
        var integW = Math.max(0, Math.min(100, integ));

        // 头部: 图标 + 名字 + 类型徽章 + 完整度
        var head = '<summary class="sam-asset-sum">'
            + '<span class="sam-asset-ico">' + assetTypeIcon(type) + '</span>'
            + '<span class="sam-asset-name">' + esc(name) + '</span>'
            + '<span class="sam-asset-badge">' + esc(type) + '</span>'
            + '<span class="sam-asset-integ ' + integCls + '">' + integ + '%</span>'
            + '</summary>';

        var body = '<div class="sam-asset-body">';

        // 概览: 完整度进度条 / 主体规模 / 类型
        body += '<div class="sam-asset-overview">'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">完整度</span>'
            +   '<div class="sam-asset-bar"><div class="sam-asset-bar-fill ' + integCls + '" style="width:' + integW + '%;"></div></div>'
            +   '<span class="sam-asset-ov-val">' + (editMode ? editInput(path + '.完整度', integ, 'number') : integ + '%') + '</span>'
            + '</div>'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">主体规模</span>'
            +   '<div class="sam-asset-scale">' + assetScaleDots(scale, path, editMode) + '</div>'
            + '</div>'
            + '<div class="sam-asset-ov-row">'
            +   '<span class="sam-asset-ov-lbl">类型</span>'
            +   '<span class="sam-asset-ov-val">' + (editMode ? editSelect(path + '.类型', ['固定地产', '大型载具与要塞', '便携式据点'], type) : esc(type)) + '</span>'
            + '</div>'
            + '</div>';

        // 状态(长文本)
        var status = safeStr(a.状态, '');
        body += '<div class="sam-asset-sec">'
            + '<div class="sam-asset-sec-t">📋 状态</div>'
            + '<div class="sam-asset-text">' + (editMode ? editInput(path + '.状态', status, 'textarea') : (status ? esc(status) : '<span class="sam-asset-none">无</span>')) + '</div>'
            + '</div>';

        // 能源(可选)
        var energy = a.能源;
        if (energy && typeof energy === 'object' && (safeStr(energy.类型) || safeNum(energy.上限) > 0 || safeStr(energy.描述))) {
            var eCur = safeNum(energy.当前, 0);
            var eMax = safeNum(energy.上限, 0);
            var ePct = eMax > 0 ? Math.max(0, Math.min(100, Math.round(eCur / eMax * 100))) : 0;
            body += '<div class="sam-asset-sec">'
                + '<div class="sam-asset-sec-t">⚡ 能源 · ' + esc(safeStr(energy.类型, '-')) + '</div>'
                + '<div class="sam-asset-energy">'
                +   '<div class="sam-asset-bar"><div class="sam-asset-bar-fill energy" style="width:' + ePct + '%;"></div></div>'
                +   '<span class="sam-asset-energy-num">' + (editMode ? editInput(path + '.能源.当前', eCur, 'number') : eCur) + ' / ' + (editMode ? editInput(path + '.能源.上限', eMax, 'number') : eMax) + '</span>'
                + '</div>';
            var eDesc = safeStr(energy.描述, '');
            if (eDesc || editMode) {
                body += '<div class="sam-asset-text">' + (editMode ? editInput(path + '.能源.描述', eDesc, 'textarea') : esc(eDesc)) + '</div>';
            }
            body += '</div>';
        }

        // 消耗单元(可选)
        var units = a.消耗单元 || {};
        var uKeys = Object.keys(units);
        if (uKeys.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">🔋 消耗单元 (' + uKeys.length + ')</div>';
            uKeys.forEach(function(uk) {
                var u = units[uk] || {};
                var upath = path + '.消耗单元.' + uk;
                var rem = safeNum(u.余量, 0);
                var cap = safeNum(u.上限, 0);
                var upct = cap > 0 ? Math.max(0, Math.min(100, Math.round(rem / cap * 100))) : 0;
                body += '<div class="sam-asset-unit">'
                    + '<div class="sam-asset-unit-head"><span class="sam-asset-unit-name">' + esc(uk) + '</span>'
                    +   '<span class="sam-asset-unit-num">' + (editMode ? editInput(upath + '.余量', rem, 'number') : rem) + ' / ' + (editMode ? editInput(upath + '.上限', cap, 'number') : cap) + '</span></div>'
                    + '<div class="sam-asset-bar"><div class="sam-asset-bar-fill" style="width:' + upct + '%;"></div></div>'
                    + (Array.isArray(u.加成) && u.加成.length ? '<div class="sam-asset-unit-bonus">' + assetTagChips(u.加成) + '</div>' : '')
                    + '</div>';
            });
            body += '</div>';
        }

        // 建设序列(可选)
        var seqs = a.建设序列 || {};
        var sKeys = Object.keys(seqs);
        if (sKeys.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">🏗️ 建设序列 (' + sKeys.length + ')</div>';
            sKeys.forEach(function(sk) {
                var s = seqs[sk] || {};
                var spath = path + '.建设序列.' + sk;
                var stage = safeStr(s.阶段, '基础');
                body += '<div class="sam-asset-seq">'
                    + '<div class="sam-asset-seq-head">'
                    +   '<span class="sam-asset-seq-name">' + esc(sk) + '</span>'
                    +   '<span class="sam-asset-stage ' + assetStageClass(stage) + '">' + esc(stage) + '</span>'
                    + '</div>'
                    + '<div class="sam-asset-seq-rows">'
                    +   assetKvRow('功能', assetScalar(spath + '.功能', safeStr(s.功能), 'text', editMode))
                    +   assetKvRow('产出', assetScalar(spath + '.产出', safeStr(s.产出), 'text', editMode))
                    +   assetKvRow('上次产出天数', assetScalar(spath + '.上次产出天数', safeNum(s.上次产出天数, 0), 'number', editMode))
                    + '</div>'
                    + (Array.isArray(s.加成) && s.加成.length ? '<div class="sam-asset-seq-bonus">' + assetTagChips(s.加成) + '</div>' : '')
                    + '</div>';
            });
            body += '</div>';
        }

        // 驻扎人员(可选)
        var staff = a.驻扎人员 || {};
        var stKeys = Object.keys(staff);
        if (stKeys.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">👥 驻扎人员 (' + stKeys.length + ')</div>'
                + '<div class="sam-asset-staff">';
            stKeys.forEach(function(pn) {
                body += '<div class="sam-asset-staff-item"><span class="sam-asset-staff-name">' + esc(pn) + '</span><span class="sam-asset-staff-role">' + esc(safeStr(staff[pn], '-')) + '</span></div>';
            });
            body += '</div></div>';
        }

        // 待办事件(可选)
        var todo = a.待办事件;
        if (Array.isArray(todo) && todo.length > 0) {
            body += '<div class="sam-asset-sec"><div class="sam-asset-sec-t">📌 待办事件 (' + todo.length + ')</div>'
                + '<div class="sam-asset-todo">';
            todo.forEach(function(t) {
                body += '<div class="sam-asset-todo-item">' + esc(safeStr(t)) + '</div>';
            });
            body += '</div></div>';
        }

        body += '</div>';
        return '<details class="sam-asset" open>' + head + body + '</details>';
    }

    /* ===== 29. Tab: 传闻(全部一屏展示; 根据变量全部显示, 情报交易.真实内幕除外) =====
       R21-传闻交易: 移植自 创世状态栏.txt
         - 顶部工具栏: 一键删除全部传闻(需确认)
         - 每个分类标题右侧: 一键清除(仅清该分类, 需确认)
         - 情报交易卡片: 要价数字旁加"可交易"按钮, 点击发送文字到输入框(找{卖家}购买情报「{名}」)
         - 每条传闻名字最右侧: 单条删除按钮
    */
    function renderRumorTab(sd) {
        var r = sd.传闻 || {};
        var editMode = isEditMode();
        var html = '';
        var street = r.街头巷议 || {};
        var intel = r.情报交易 || {};
        var notice = r.布告与檄文 || {};
        // 顶部工具栏: 一键删除全部传闻(仅当确实有传闻时才出现)
        var total = Object.keys(street).length + Object.keys(intel).length + Object.keys(notice).length;
        if (total > 0) {
            html += '<div class="sam-rumor-toolbar">'
                + '<button type="button" class="sam-rumor-clearall-btn" data-rumor-clearall="1">🗑 一键删除全部传闻 ('+total+')</button>'
                + '</div>';
        }
        // 分类清除按钮(挂在 secBlock summary 右侧) — 仅当该分类传闻数 ≥ 2 才显示
        function clearBtn(sectionKey, count) {
            if (count < 2) return '';
            return '<button type="button" class="sam-rumor-clear-btn" data-rumor-clear-section="'+esc(sectionKey)+'">一键清除</button>';
        }
        var nStreet = Object.keys(street).length;
        var nIntel = Object.keys(intel).length;
        var nNotice = Object.keys(notice).length;
        // 街头巷议
        html += secBlock('🗣️ 街头巷议 ('+nStreet+')',
            renderRumorFullList(street, '传闻.街头巷议', editMode, [
                {k:'来源', f:'说书人', type:'text'},
                {k:'可信度', f:'可信度', type:'select', options:['酒话','可疑','或许可信']},
                {k:'内容', f:'内容', type:'textarea', block:true}
            ], '街头巷议'), nStreet > 0, clearBtn('街头巷议', nStreet));
        // 情报交易: 要价字段标记 tradeable:true, 触发交易按钮
        html += secBlock('💎 情报交易 ('+nIntel+')',
            renderRumorFullList(intel, '传闻.情报交易', editMode, [
                {k:'卖家', f:'卖家', type:'text'},
                {k:'情报评级', f:'情报评级', type:'select', options:['F','E','D','C','B','A','S','SS','SSS','日常','战略']},
                {k:'要价', f:'要价', type:'number', tradeable:true},
                {k:'摘要', f:'摘要', type:'textarea', block:true}
            ], '情报交易'), nIntel > 0, clearBtn('情报交易', nIntel));
        // 布告与檄文
        html += secBlock('📜 布告与檄文 ('+nNotice+')',
            renderRumorFullList(notice, '传闻.布告与檄文', editMode, [
                {k:'发布者', f:'发布者', type:'text'},
                {k:'张贴位置', f:'张贴位置', type:'text'},
                {k:'内容', f:'内容', type:'textarea', block:true}
            ], '布告与檄文'), nNotice > 0, clearBtn('布告与檄文', nNotice));
        return html;
    }
    /* 传闻/布告等通用完整字段列表(按schema字段全量展示, 长文本字段独占一行)
       sectionKey: 当前分类 key(街头巷议/情报交易/布告与檄文), 用于单条删除按钮回写路径
       fd.tradeable=true 的字段, 在值旁追加"可交易"按钮(仅情报交易.要价)
    */
    function renderRumorFullList(obj, basePath, editMode, fields, sectionKey) {
        var keys = Object.keys(obj);
        if (keys.length === 0) return '<div class="sam-empty">[无]</div>';
        var html = '<div class="sam-list-1col">';
        keys.forEach(function(k) {
            var it = obj[k] || {};
            var path = basePath+'.'+k;
            var rows = '';
            var blockHtml = '';
            fields.forEach(function(fd) {
                var val = it[fd.f];
                var fpath = path+'.'+fd.f;
                var isReadonly = isReadonlyPath(fpath);
                if (fd.block) {
                    var content;
                    if (editMode && !isReadonly) {
                        content = editInput(fpath, safeStr(val), fd.type === 'textarea' ? 'textarea' : 'text');
                    } else if (isReadonly) {
                        content = '<span class="sam-edit-readonly">'+esc(safeStr(val))+'</span>';
                    } else {
                        content = esc(safeStr(val) || '-');
                    }
                    blockHtml += '<div class="sam-rumor-content" style="margin-top:4px;">'
                        + '<div style="font-size:11px;color:var(--sam-sub);margin-bottom:3px;">'+esc(fd.k)+'</div>'
                        + '<div style="font-size:12px;color:var(--sam-text);line-height:1.6;word-break:break-word;white-space:pre-wrap;">'+content+'</div>'
                        + '</div>';
                } else {
                    var display;
                    if (fd.type === 'select') {
                        display = editMode && !isReadonly ? editSelect(fpath, fd.options, safeStr(val)) : esc(safeStr(val) || '-');
                    } else if (fd.type === 'number') {
                        var nv = safeNum(val, 0);
                        display = editMode && !isReadonly ? editInput(fpath, nv, 'number') : nv;
                    } else {
                        display = editMode && !isReadonly ? editInput(fpath, safeStr(val), 'text') : (isReadonly ? '<span class="sam-edit-readonly">'+esc(safeStr(val))+'</span>' : esc(safeStr(val) || '-'));
                    }
                    // ★ 可交易按钮: 紧贴要价数字右侧(仅情报交易.要价 字段)
                    if (fd.tradeable) {
                        var seller = safeStr(it.卖家) || '不明';
                        var price = safeNum(val, 0);
                        display = '<span class="sam-rumor-price">'+display
                            + '<button type="button" class="sam-rumor-trade-btn" data-rumor-trade="1" data-rumor-name="'+esc(k)+'" data-rumor-seller="'+esc(seller)+'" data-rumor-price="'+esc(String(price))+'" title="发送交易请求到输入框">🛒 可交易</button>'
                            + '</span>';
                    }
                    rows += '<div class="sam-row"><span class="k">'+esc(fd.k)+'</span><span class="v">'+display+'</span></div>';
                }
            });
            // ★ 单条删除按钮: 挂在卡片标题最右侧(仅编辑模式显示)
            var delBtn = editMode ? '<button type="button" class="sam-rumor-del-btn" data-rumor-del="1" data-rumor-section="'+esc(sectionKey||'')+'" data-rumor-name="'+esc(k)+'" title="删除该条传闻">✕</button>' : '';
            html += '<div class="sam-full-card">'
                + '<div class="sam-fc-head"><div class="sam-fc-title">'+esc(k)+'</div>'+delBtn+'</div>'
                + '<div class="sam-fc-rows">'+rows+'</div>'
                + blockHtml
                + '</div>';
        });
        html += '</div>';
        return html;
    }

    /* ===== 30. Tab: 世界(全部一屏展示) ===== */
    function renderWorldTab(sd) {
        var w = sd.世界 || {};
        var isSingleWorld = (sd.设置 && sd.设置.单一世界 === true);
        var isInHub = (sd.系统状态 && sd.系统状态.是否在主神空间 === true);
        var editMode = isEditMode();
        var html = '';
        // 世界介绍(时间/地点已在顶部 topbar 显示, 此处不重复)
        var introFields = [
            {k:'名称', path:'世界.名称', type:'text'},
            {k:'难度', path:'世界.难度', type:'text'},
            {k:'稳定', path:'世界.稳定', type:'number', readonly:true},
            {k:'模式', path:'世界.异端雷达.当前模式', type:'text', hideOnSingle:true},
            {k:'异端', composite:'alien', hideOnSingle:true}
        ];
        var introHtml = '';
        introFields.forEach(function(f) {
            if (f.hideOnSingle && (isSingleWorld || isInHub)) return;
            if (f.composite === 'alien') {
                var ac = resolvePath(sd, '世界.异端雷达.活跃余量');
                var am = resolvePath(sd, '世界.异端雷达.异端上限');
                var alienVal = safeNum(ac,0) + ' / ' + safeNum(am,0);
                introHtml += '<div class="sam-row"><span class="k">'+esc(f.k)+'</span><span class="v"><span class="sam-edit-readonly">'+esc(alienVal)+'</span></span></div>';
                return;
            }
            var v = resolvePath(sd, f.path);
            var display;
            if (f.readonly || isReadonlyPath(f.path)) display = '<span class="sam-edit-readonly">'+esc(v)+'</span>';
            else if (editMode) display = editInput(f.path, v, f.type);
            else display = esc(safeStr(v));
            introHtml += '<div class="sam-row"><span class="k">'+esc(f.k)+'</span><span class="v">'+display+'</span></div>';
        });
        html += secBlock('🌍 世界介绍', introHtml);
        // 法则(移到世界介绍下方)
        var laws = Array.isArray(w.法则) ? w.法则 : [];
        var lawHtml = '';
        if (laws.length === 0) lawHtml += '<div class="sam-empty">[无法则]</div>';
        else laws.forEach(function(law, i) { lawHtml += '<div class="sam-row"><span class="k">法则'+(i+1)+'</span><span class="v">'+(editMode ? editInput('世界.法则.'+i, safeStr(law), 'text') : esc(law))+'</span></div>'; });
        html += secBlock('📜 法则', lawHtml);
        // 货币
        var cur = w.货币 || {};
        var curHtml = '';
        curHtml += '<div class="sam-row"><span class="k">体系</span><span class="v">'+(editMode ? editInput('世界.货币.体系', safeStr(cur.体系), 'text') : esc(cur.体系||'-'))+'</span></div>';
        curHtml += '<div class="sam-row"><span class="k">购买力</span><span class="v">'+(editMode ? editInput('世界.货币.购买力基准', safeStr(cur.购买力基准), 'text') : esc(cur.购买力基准||'-'))+'</span></div>';
        curHtml += '<div class="sam-row"><span class="k">经济波动</span><span class="v">'+(editMode ? editInput('世界.货币.经济波动', safeStr(cur.经济波动), 'text') : esc(cur.经济波动||'-'))+'</span></div>';
        html += secBlock('💰 货币', curHtml);
        // 因果轨道(移到货币下方、探索点上方)
        var ko = w.因果轨道 || {};
        var koHtml = '';
        koHtml += '<div class="sam-row"><span class="k">当前阶段</span><span class="v">'+(editMode ? editInput('世界.因果轨道.当前阶段', safeStr(ko.当前阶段), 'text') : esc(ko.当前阶段||'-'))+'</span></div>';
        koHtml += '<div class="sam-row"><span class="k">故事线</span><span class="v">'+(editMode ? editInput('世界.因果轨道.故事线', safeStr(ko.故事线), 'text') : esc(ko.故事线||'-'))+'</span></div>';
        koHtml += '<div class="sam-row"><span class="k">下一节点</span><span class="v">'+(editMode ? editInput('世界.因果轨道.下一节点', safeStr(ko.下一节点), 'text') : esc(ko.下一节点||'-'))+'</span></div>';
        var off = ko.偏移记录 || {};
        var okeys = Object.keys(off);
        if (okeys.length > 0) {
            var offHtml = '';
            okeys.forEach(function(k) {
                var o = off[k] || {};
                var path = '世界.因果轨道.偏移记录.'+k;
                offHtml += '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+(editMode ? editInput(path+'.描述', safeStr(o.描述), 'text') : esc(o.描述||'-'))+'</span></div>';
            });
            koHtml += secBlock('偏差记录 ('+okeys.length+')', offHtml, false);
        }
        html += secBlock('🌀 因果轨道', koHtml);
        // 探索点
        var exp = w.探索 || {};
        // 编辑模式删除按钮(探索点/势力通用, 挂在卡片 head 右侧)
        function worldDelBtn(path) {
            if (!editMode) return '';
            return '<button type="button" class="sam-rumor-del-btn" data-world-del="1" data-del-path="'+esc(path)+'" title="删除该条目">✕</button>';
        }
        var ekeys = Object.keys(exp);
        var expHtml = '';
        if (ekeys.length === 0) expHtml += '<div class="sam-empty">[无探索点]</div>';
        else ekeys.forEach(function(k) {
            var e = exp[k] || {};
            var path = '世界.探索.'+k;
            var q = e.风险 ? parseRarity(e.风险) : '';
            var rows = fcRow('探索度', safeNum(e.探索度,0)+'%', path+'.探索度', editMode, 'number');
            var body = fcRow('描述', e.描述, path+'.描述', editMode);
            expHtml += fullCard(q, k, rows, body, worldDelBtn(path));
        });
        html += secBlock('🧭 探索点 ('+Object.keys(w.探索||{}).length+')', expHtml, Object.keys(w.探索||{}).length > 0);
        // 势力
        var forces = w.势力 || {};
        var fkeys = Object.keys(forces);
        var forceHtml = '';
        if (fkeys.length === 0) forceHtml += '<div class="sam-empty">[无势力]</div>';
        else fkeys.forEach(function(k) {
            var f = forces[k] || {};
            var path = '世界.势力.'+k;
            var q = f.实力 ? parseRarity(f.实力) : '';
            var rows = '';
            rows += fcRow('声望', safeNum(f.声望,0), path+'.声望', editMode, 'number');
            var body = fcRow('描述', f.描述, path+'.描述', editMode);
            forceHtml += fullCard(q, k, rows, body, worldDelBtn(path));
        });
        html += secBlock('⚔️ 势力 ('+Object.keys(w.势力||{}).length+')', forceHtml, Object.keys(w.势力||{}).length > 0);
        return html;
    }

    /* ===== 30b. Tab: 商城(主神空间交易终端) =====
       - 顶部紧凑余额条: 显示当前空间币(主角.空间币, 只读, 由系统结算发放)
       - 状态提示条: 战斗中/任务世界/主神空间 三态, 置于商城入口栏目上方
       - 交易规则栏目(折叠): 双轨经济/物价锚点等, 置于商城入口上方
       - 商城入口栏目: 需求输入框(左) + 刷新商品按钮(右); 不在主神空间/战斗中时禁用
         刷新商品按钮: 调正文AI generateRaw 生成商品库 → 写回 stat_data.商城 → renderAll
     */
    function renderShopTab(sd) {
        var p = sd.主角 || {};
        var sys = sd.系统状态 || {};
        var editMode = isEditMode();
        var coin = safeNum(p.空间币, 0);
        var inHub = (sys.是否在主神空间 === true);
        var isCombat = (sys.是否战斗中 === true);
        // 血统数量上限判定: 当前血统数 vs 共同.血统限制数(用于商城血统区灰显)
        shopBloodCount = Object.keys(p.血统 || {}).length;
        shopBloodLimit = BLOODLINE_CAP;
        var isSingleWorld = (sd.设置.单一世界 === true);
        var html = '';
        // 顶部紧凑余额条(空间币由系统结算发放, 余额只读展示; 编辑模式仅作兜底)
        var coinDisplay = editMode ? editInput('主角.空间币', coin, 'number') : esc(String(coin));
        html += '<div class="sam-shop-coin-mini"><span class="lbl">💰 余额</span><span class="val">' + coinDisplay + '</span><span class="lbl">空间币</span></div>';
        // 状态提示条: 置于商城入口上方(独立于栏目, 不折叠)
        if (isCombat) {
            html += '<div class="sam-shop-warn">⚔️ 战斗中无法交易, 请在安全区域后再试</div>';
        } else if (!inHub && !isSingleWorld) {
            html += '<div class="sam-shop-warn">🔒 当前位于任务世界, 空间币已锁定<br>需返回主神空间后才能开启商城交易</div>';
        } else {
            if (isSingleWorld) {
                html += '<div class="sam-shop-ok">✅ 已在安全区域, 可开启商城交易</div>';
            }else{
                html += '<div class="sam-shop-ok">✅ 已在主神空间, 可开启商城交易</div>';
            }
        }
        // 交易规则(折叠): 置于商城入口上方
        var ruleHtml = '<div class="sam-row"><span class="k">交易货币</span><span class="v">空间币(主神空间专用)</span></div>'
            + '<div class="sam-row"><span class="k">商品类别</span><span class="v">装备 / 道具 / 技能 / 血统</span></div>'
            + '<div class="sam-row"><span class="k">物价区间</span><span class="v">F(10-99) · E(100-999) · D(1k-4.9k) · C(5k-2w) · B(2w-8w) · A(8w-32w) · S(32w-127w) · SS(128w-511w) · SSS(512w+)</span></div>'
            + '<div class="sam-row"><span class="k">权限锁</span><span class="v">跨越自身大段位的高阶商品需权限凭证</span></div>'
            + '<div class="sam-row"><span class="k">双轨隔离</span><span class="v">任务世界内强制使用本地货币, 空间币不可流通</span></div>';
        html += secBlock('📜 交易规则', ruleHtml, false);
        // 商城入口(含商品市场): 需求输入框(左) + 刷新商品按钮(右) + Tab条 + 列表 + 购物车条
        // 不在主神空间时禁用入口控件, 但商品库仍可浏览(已购入的库存)
        var canShop = (!isCombat && (inHub || isSingleWorld));
        // 刷新中: 按钮置灰 + 文案变更, 需求输入框也禁用(由模块级 shopRefreshing 驱动, 切换界面/重渲染仍保持)
        var refreshDisabled = (!canShop || shopRefreshing) ? ' disabled' : '';
        var refreshBtnText = shopRefreshing ? '🔄 正在刷新商品…' : '🔄 刷新商品';
        var reqDisabled = (!canShop || shopRefreshing) ? ' disabled' : '';
        var entryHtml = '<div class="sam-shop-entry">'
            + '<input type="text" class="sam-shop-req" data-shop-req placeholder="写入需求内容"'+reqDisabled+'>'
            + '<button type="button" class="sam-shop-refresh-btn" data-shop-refresh'+refreshDisabled+'>'+refreshBtnText+'</button>'
            + '</div>';
        // ===== 市场区: 从 stat_data.商城 读取持久化商品数据 =====
        // 商品库由 AI 在「刷新商品」后写入, 持久保存在 MVU 变量中, 直至刷新/清空/重开游戏
        var rawMarket = (sd.商城 && sd.商城) ? sd.商城 : null;
        if (rawMarket) {
            shopMarketData = shopNormalizeMarketData(rawMarket);
            // 切换聊天/新商品上架时, 若当前区域无数据则回退到首个有数据的区域
            var fallback = shopPickFirstAvailableTab();
            if (!shopActiveTab || !shopTabHasData(shopActiveTab)) shopActiveTab = fallback;
        } else {
            shopMarketData = null;
        }
        // 商品面板与"刷新/购买"能力绑定: 不能刷新(战斗中/不在主神空间)时, 直接隐藏下方整个商品面板
        //   canShop 下再细分三态:
        //     刷新中 → 固定高容器 + 刷新中提示(隐藏原列表)
        //     已刷新 → 固定高容器 + Tab条 + 列表 + 购物车条(三段式, footer常驻底部)
        //     空库   → 空库提示
        //   !canShop → 不渲染任何商品面板(原因由上方状态提示条说明)
        if (canShop) {
            if (shopRefreshing) {
                entryHtml += '<div class="sam-shop-market"><div class="sam-shop-refreshing">'
                    + '<div class="sam-shop-refreshing-spin">🔄</div>'
                    + '<div>正在请求正文AI生成商品…<br>可以关闭界面或等待, 商品刷新完成后会弹窗提示。</div>'
                    + '</div></div>';
            } else if (shopMarketData) {
                entryHtml += '<div class="sam-shop-market">' + shopRenderTabs() + shopRenderContent(coin) + shopRenderFooter(coin) + '</div>';
            } else {
                entryHtml += '<div class="sam-shop-empty">尚未刷新商品, 请在上方写入需求后点击「刷新商品」</div>';
            }
        }
        html += secBlock('🛒 商城入口', entryHtml, true);
        return html;
    }

    /* ===== 30c. Tab: 强化(装备针对性强化) =====
       - 对现有装备进行 +1/+2/+3 等针对性强化, 品质不变, 固定价格, 几率失败
       - 读取 主角.装备 列表, 展示可强化装备
    */
    function renderEnhanceTab(sd) {
        var p = sd.主角 || {};
        var equips = p.装备 || {};
        var editMode = isEditMode();
        var html = '';
        var keys = Object.keys(equips);
        // 空库提示
        if (keys.length === 0) {
            html += '<div class="sam-empty">[无可强化的装备]</div>';
            return html;
        }
        // 装备列表
        var listHtml = '<div class="sam-list-1col">';
        keys.forEach(function(k) {
            var it = equips[k] || {};
            var path = '主角.装备.'+k;
            var tier = safeStr(it.品质, 'F');
            var typeNum = safeNum(it.类型, 0);
            var typeLabel = ['', '手套', '头部', '胸部', '腿部', '鞋子', '披风', '饰品', '特殊'][typeNum] || '武器';
            var enhanceLv = safeNum(it.强化等级, 0);
            var rows = '';
            rows += fcRow('品质', tier, null, false);
            rows += fcRow('类型', typeLabel, null, false);
            rows += fcRow('强化等级', '+'+enhanceLv, null, false);
            listHtml += '<div class="sam-full-card">'
                + '<div class="sam-fc-head"><div class="sam-fc-title">'+esc(k)+'</div></div>'
                + '<div class="sam-fc-rows">'+rows+'</div>'
                + '</div>';
        });
        listHtml += '</div>';
        html += secBlock('⚒️ 可强化装备 ('+keys.length+')', listHtml, true);
        return html;
    }
    // 市场区辅助: 判断某区域是否有数据
    function shopTabHasData(cat) {
        if (!shopMarketData) return false;
        // 装备区/技能区/道具区: 分组对象 {类型label: [...]}; 血统区: 扁平数组
        if (cat === '装备区' || cat === '技能区' || cat === '道具区') {
            var groups = shopMarketData[cat] || {};
            for (var g in groups) { if (groups.hasOwnProperty(g) && groups[g] && groups[g].length) return true; }
            return false;
        }
        return (shopMarketData[cat] || []).length > 0;
    }
    function shopPickFirstAvailableTab() {
        var order = ['装备区','道具区','技能区','血统区','升级区'];
        for (var i = 0; i < order.length; i++) { if (shopTabHasData(order[i])) return order[i]; }
        return '装备区';
    }
    // 按区域/槽位/名称查找标准化商品条目(返回数组, 供 toggleSelect 使用)
    function shopFindItems(cat, slot, name) {
        if (!shopMarketData) return [];
        var out = [];
        // 装备区/技能区/道具区: 分组对象(slot=类型label); 血统区: 扁平数组(slot忽略)
        if (cat === '装备区' || cat === '技能区' || cat === '道具区') {
            var groups = shopMarketData[cat] || {};
            if (slot) {
                // 有slot: 精确定位该类型分组
                var arr = groups[slot] || [];
                for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) out.push(arr[i]); }
            } else {
                // 无slot(数量控件等场景): 遍历全部分组查找
                for (var g2 in groups) {
                    if (!groups.hasOwnProperty(g2)) continue;
                    var arr2 = groups[g2] || [];
                    for (var i2 = 0; i2 < arr2.length; i2++) { if (arr2[i2].name === name) out.push(arr2[i2]); }
                }
            }
        } else {
            var items = shopMarketData[cat] || [];
            for (var k = 0; k < items.length; k++) { if (items[k].name === name) out.push(items[k]); }
        }
        return out;
    }

    /* ===== 31. 详情弹窗(点击卡片) ===== */
    // 玩家不可见的敏感字段(不给玩家看)
    var HIDDEN_FIELDS = ['隐藏真相', '真实内幕', '心里话'];
    function openDetailModal(path, title) {
        var sd = getStatData();
        if (!sd) return;
        var obj = resolvePath(sd, path);
        if (obj == null) { showModal(title, '<div class="sam-empty">数据不存在</div>'); return; }
        // NPC详情: 走专用角色档案面板(分区精美排版, 空值不显示, 不裸露技术字段)
        var isNpc = (typeof path === 'string' && path.indexOf('关系列表.') === 0);
        if (isNpc) {
            var npcHtml = renderNpcDetail(obj, title);
            showModal(title + ' · 角色档案', '<div class="sam-nd">'+npcHtml+'</div>');
            return;
        }
        var hidden = HIDDEN_FIELDS;
        var html = renderDetailNode(obj, hidden);
        showModal(title + ' · 详情', '<div class="sam-detail">'+html+'</div>');
    }
    /* NPC角色档案专用渲染: 分区卡片式, 仅显示有值字段, 不裸露HP_MAX/EP_MAX/空对象/未激活形态等技术字段 */
    function renderNpcDetail(n, name) {
        if (!n || typeof n !== 'object') return '<div class="sam-empty">数据不存在</div>';
        var q = parseRarity(n.层级);
        var hp = safeNum(n.HP,0), hpmax = safeNum(n.HP_MAX,0);
        var ep = safeNum(n.EP,0), epmax = safeNum(n.EP_MAX,0);
        var thp = safeNum(n.THP,0);
        var favor = safeNum(n.好感度,0);
        var race = safeStr(n.种族) || '';
        var rawIdArr = Array.isArray(n.身份) ? n.身份 : [];
        var showAllId = (n.是否队友 === true) || (favor > 60);
        var idArr = showAllId ? rawIdArr : filterHiddenIdentity(rawIdArr);
        var jobArr = Array.isArray(n.职业) ? n.职业 : [];
        var cf = n.当前形态 || {};
        var formName = (cf.激活 === true && safeStr(cf.名称)) ? safeStr(cf.名称) : '';
        var attrs = n.最终属性 || {};
        var html = '';
        // ① 头部: 名字 + 形态标签 + 层级徽章 + 在场/队友徽章
        html += '<div class="sam-nd-head"><div class="sam-nd-name">'+esc(name||'')+(formName?'<span class="sam-nd-form">🌀 '+esc(formName)+'</span>':'')+'</div>';
        html += '<div class="sam-nd-badges"><span class="sam-nd-tier q-'+q+'">'+esc(q)+'</span>';
        if (n.在场 === true) html += '<span class="sam-nd-badge present">在场</span>';
        if (n.是否队友 === true) html += '<span class="sam-nd-badge team">队友</span>';
        html += '</div></div>';
        // ② 好感度双向条 (中线=0, 正向右绿, 负向左红)
        var favorColor = favor > 60 ? '#56bf7b' : (favor < 0 ? 'var(--sam-hp)' : 'var(--sam-accent)');
        var favorPct = Math.min(50, Math.abs(favor) / 2);
        var favorDir = favor >= 0 ? 'pos' : 'neg';
        html += '<div class="sam-nd-favor"><span class="sam-nd-favor-lbl">好感度</span>';
        html += '<div class="sam-nd-favor-track"><div class="sam-nd-favor-fill '+favorDir+'" style="width:'+favorPct+'%;background:'+favorColor+';"></div></div>';
        html += '<span class="sam-nd-favor-val" style="color:'+favorColor+';">'+(favor>0?'+':'')+favor+'</span></div>';
        // ③ 基础信息网格 (仅有值时)
        var grid = '';
        if (race) grid += ndRow('种族', race);
        if (idArr.length) grid += ndRow('身份', idArr.join(' / '));
        if (jobArr.length) grid += ndRow('职业', jobArr.join(' / '));
        var npcQty = safeNum(n.数量, 1);
        if (npcQty > 1) grid += ndRow('数量', 'x'+npcQty);
        if (grid) html += '<div class="sam-nd-grid">'+grid+'</div>';
        // ④ 心里话引用 (仅有值时, 置于战斗属性上方)
        if (safeStr(n.心里话)) html += '<div class="sam-nd-quote">💬 '+esc(safeStr(n.心里话))+'</div>';
        // ⑤ 战斗属性条 (HP_MAX/EP_MAX/THP 任一>0 才显示)
        if (hpmax > 0 || epmax > 0 || thp > 0) {
            html += '<div class="sam-nd-sec-lbl">⚔ 战斗属性</div><div class="sam-nd-bars">';
            if (hpmax > 0) html += npcBar('HP', hp, hpmax, 'var(--sam-hp)');
            if (epmax > 0) html += npcBar('EP', ep, epmax, 'var(--sam-ep)');
            if (thp > 0) html += npcThpRow(thp);
            html += '</div>';
        }
        // ⑤ 最终属性 (仅非零项, 排除武器对象) + 武器攻击(并入最终属性, ATK/MATK分两排)
        var attrKeys = Object.keys(attrs).filter(function(k){ return k !== '武器' && safeNum(attrs[k],0) !== 0; });
        var wpn = attrs.武器;
        var wpnKeys = (wpn && typeof wpn === 'object') ? Object.keys(wpn) : [];
        if (attrKeys.length || wpnKeys.length) {
            html += '<div class="sam-nd-sec-lbl">📊 最终属性</div>';
            if (attrKeys.length) {
                html += '<div class="sam-nd-attrs">';
                attrKeys.forEach(function(k){ html += '<div class="sam-nd-attr"><span class="k">'+esc(k)+'</span><span class="v">'+safeNum(attrs[k],0)+'</span></div>'; });
                html += '</div>';
            }
            if (wpnKeys.length) {
                html += '<div class="sam-nd-wpn">';
                wpnKeys.forEach(function(name) {
                    var w = wpn[name] || {};
                    var isBase = (name === '无武装');
                    html += '<div class="sam-nd-wpn-row'+(isBase?' base':'')+'"><div class="nm">'+(isBase?'无武装':'⚔ '+esc(name))+'</div><div class="atk">ATK (物攻) <b>'+safeNum(w.ATK,0)+'</b></div><div class="matk">MATK (术攻) <b>'+safeNum(w.MATK,0)+'</b></div></div>';
                });
                html += '</div>';
            }
        }
        // ⑥ 人物档案 (外貌/着装/性格/喜爱, 仅有值时)
        var profile = '';
        if (safeStr(n.外貌)) profile += ndBlock('外貌', n.外貌);
        if (safeStr(n.着装)) profile += ndBlock('着装', n.着装);
        if (safeStr(n.性格)) profile += ndBlock('性格', n.性格);
        if (safeStr(n.喜爱)) profile += ndBlock('喜爱', n.喜爱);
        if (safeStr(n.背景故事)) profile += ndBlock('背景故事', n.背景故事);
        if (profile) html += '<details class="sam-nd-sub"><summary>👤 人物档案</summary><div class="sam-nd-sub-body">'+profile+'</div></details>';
        // ⑨ 子系统 (装备/技能/血统/形态库/状态, 仅非空时才折叠显示)
        var subs = [{k:'状态',d:n.状态},{k:'血统',d:n.血统},{k:'形态库',d:n.形态库},{k:'技能',d:n.技能},{k:'装备',d:n.装备},{k:'背包',d:n.背包}];
        subs.forEach(function(s) {
            var d = s.d || {};
            var ks = Object.keys(d);
            if (ks.length === 0) return;
            var subHtml = renderDetailNode(d, ['隐藏真相','真实内幕'], [s.k]);
            html += '<details class="sam-nd-sub"><summary>'+esc(s.k)+' ('+ks.length+')</summary><div class="sam-nd-sub-body">'+subHtml+'</div></details>';
        });
        return html;
    }
    function ndRow(k, v) {
        return '<div class="sam-nd-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(safeStr(v))+'</span></div>';
    }
    function ndBlock(label, content) {
        return '<div class="sam-nd-block"><div class="sam-nd-block-lbl">'+esc(label)+'</div><div class="sam-nd-block-ct">'+esc(safeStr(content))+'</div></div>';
    }
    /* 精美递归渲染: 标量分短值(网格行)/长文本(块); 子对象/数组用可伸缩details; 字符串数组用tag chips */
    var DETAIL_LONG_FIELDS = ['描述','外貌','着装','性格','喜爱','心里话','背景故事','内容','状态','效果','摘要','真实内幕','隐藏真相'];
    function isLongField(k, v) {
        if (DETAIL_LONG_FIELDS.indexOf(k) >= 0) return true;
        if (typeof v === 'string' && v.length > 30) return true;
        return false;
    }
    /* 枚举翻译表(装备类型/装备状态/技能类型) */
    var EQUIP_TYPE_MAP = ['武器','手部','头部','胸部','腿部','鞋子','披风','饰品','特殊'];
    var EQUIP_STATUS_MAP = ['未装备','已装备','仓库'];
    var SKILL_TYPE_MAP = ['主动','被动','特殊'];
    // 父级容器键 -> 判定枚举字段
    var ENUM_PARENTS = { 装备: { 类型: EQUIP_TYPE_MAP, 状态: EQUIP_STATUS_MAP }, 背包: { 状态: EQUIP_STATUS_MAP }, 技能: { 类型: SKILL_TYPE_MAP }, 形态: { 状态: EQUIP_STATUS_MAP } };
    function translateEnum(field, value, ancestors) {
        if (!ancestors || ancestors.length < 2) return null;
        // ancestors: [..., 容器键(装备/技能/背包/形态), 条目名, field]
        // 找到最近的容器键
        for (var i = ancestors.length - 2; i >= 0; i--) {
            var container = ancestors[i];
            if (ENUM_PARENTS[container] && ENUM_PARENTS[container][field]) {
                var map = ENUM_PARENTS[container][field];
                var idx = (typeof value === 'number') ? value : parseInt(value, 10);
                if (!isNaN(idx) && idx >= 0 && idx < map.length) return map[idx];
                return null;
            }
        }
        return null;
    }
    function renderDetailNode(node, hidden, ancestors) {
        ancestors = ancestors || [];
        if (node == null) return '<div class="sam-empty">无</div>';
        if (typeof node !== 'object') {
            return '<div class="sam-d-block"><div class="sam-d-content">'+esc(fmtScalar(node, ancestors))+'</div></div>';
        }
        if (Array.isArray(node)) {
            if (node.length === 0) return '<div class="sam-empty">无</div>';
            return renderDetailArray(node, hidden, ancestors);
        }
        var keys = Object.keys(node);
        if (keys.length === 0) return '<div class="sam-empty">无</div>';
        // 分三类: 短标量/长文本/对象数组
        var shortRows = '', longBlocks = '', subBlocks = '';
        keys.forEach(function(k) {
            if (hidden && hidden.indexOf(k) >= 0) return;
            var v = node[k];
            if (v == null) return;
            // 身份数组: 过滤仅AI可见的关键词(执行者/篡夺者/梦魇师/残魂/穿越者)
            if (k === '身份' && Array.isArray(v)) {
                // 小队成员或好感度>60时不隐藏阵营身份
                var _showAllId = (node.是否队友 === true) || (safeNum(node.好感度,0) > 60);
                if (!_showAllId) v = filterHiddenIdentity(v);
                if (v.length === 0) return;
            }
            var childAnc = ancestors.concat([k]);
            if (typeof v === 'object') {
                // 对象/数组 -> 可伸缩
                if (Array.isArray(v)) {
                    if (v.length === 0) {
                        // 空数组: 跳过, 不渲染空折叠栏
                    } else if (isStringArray(v)) {
                        // 纯字符串数组 -> tag chips, 不折叠
                        subBlocks += detailTagBlock(k, v, childAnc);
                    } else {
                        subBlocks += detailSub(k, renderDetailArray(v, hidden, childAnc), v.length <= 2);
                    }
                } else if (Object.keys(v).length === 0) {
                    // 空对象(如原始属性/效果为{}): 跳过, 不渲染空折叠栏
                } else {
                    subBlocks += detailSub(k, '<div class="sam-d-sub-body">'+renderDetailNode(v, hidden, childAnc)+'</div>', Object.keys(v).length <= 2);
                }
            } else {
                // 标量
                var fv = fmtScalar(v, childAnc);
                if (isLongField(k, v)) {
                    longBlocks += '<div class="sam-d-block"><div class="sam-d-label">'+esc(k)+'</div><div class="sam-d-content">'+esc(fv)+'</div></div>';
                } else {
                    shortRows += '<div class="sam-d-row"><span class="k">'+esc(k)+':</span><span class="v">'+esc(fv)+'</span></div>';
                }
            }
        });
        var html = '';
        if (shortRows) html += '<div class="sam-detail-grid">'+shortRows+'</div>';
        if (longBlocks) html += longBlocks;
        if (subBlocks) html += subBlocks;
        return html;
    }
    function renderDetailArray(arr, hidden, ancestors) {
        // 对象数组: 每元素一个小卡片; 字符串数组: tag chips
        if (isStringArray(arr)) {
            var chips = arr.map(function(item) { return '<span class="sam-d-tag">'+esc(fmtScalar(item, ancestors))+'</span>'; }).join('');
            return '<div class="sam-d-tags">'+chips+'</div>';
        }
        var html = '';
        arr.forEach(function(item, i) {
            if (typeof item === 'object' && item !== null) {
                html += '<div class="sam-d-block">'+renderDetailNode(item, hidden, ancestors)+'</div>';
            } else {
                html += '<div class="sam-d-row"><span class="v">'+esc(fmtScalar(item, ancestors))+'</span></div>';
            }
        });
        return html;
    }
    function detailSub(label, contentHtml, openByDefault) {
        return '<details class="sam-d-sub" '+(openByDefault?'open':'')+'><summary>'+esc(label)+'</summary><div class="sam-d-sub-body">'+contentHtml+'</div></details>';
    }
    function detailTagBlock(label, arr, ancestors) {
        var chips = arr.map(function(item) { return '<span class="sam-d-tag">'+esc(fmtScalar(item, ancestors))+'</span>'; }).join('');
        return '<div class="sam-d-block"><div class="sam-d-label">'+esc(label)+'</div><div class="sam-d-tags">'+chips+'</div></div>';
    }
    function isNumObj(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        var keys = Object.keys(obj);
        if (keys.length === 0) return false;
        return keys.every(function(k) { var v = obj[k]; return typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(String(v).trim())); });
    }
    function isStringArray(arr) {
        return arr.every(function(x) { return typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'; });
    }
    /* 标量格式化: 布尔→是/否; 枚举字段(装备类型/状态/技能类型)→翻译; 其他→字符串 */
    function fmtScalar(v, ancestors) {
        if (v === true) return '是';
        if (v === false) return '否';
        if (ancestors && ancestors.length) {
            var field = ancestors[ancestors.length - 1];
            var tr = translateEnum(field, v, ancestors);
            if (tr != null) return tr;
        }
        return safeStr(v);
    }

    /* ===== 32. 编辑器组件 ===== */
    /* 编辑模式不再直接渲染输入框; 改为"点击即编辑":
       editInput/editSelect 返回显示态HTML(文本+✎), 点击后由事件动态插入真实输入框, 失焦/回车暂存到 pendingEdits 并还原显示态. 这样不会让所有输入框同时撑开导致变形. */
    function editInput(path, val, type) {
        return editDisplayHtml(path, val, type || 'text', '');
    }
    function editSelect(path, options, val) {
        return editDisplayHtml(path, val, 'select', optsToStr(options));
    }
    function editToggle(path, val) {
        return '<span class="sam-toggle-switch '+(val?'on':'')+'" data-toggle="field" data-path="'+esc(path)+'"><div class="knob"></div></span>';
    }
    function modalRow(k, v) {
        var vs = (typeof v === 'object') ? JSON.stringify(v) : safeStr(v);
        return '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(vs)+'</span></div>';
    }
    /* 效果对象分行渲染 {a:b,c:d} → 多行 */
    function formatEffects(effects, path, editMode) {
        if (!effects || typeof effects !== 'object') return '<span class="sam-empty" style="padding:4px 0;">无</span>';
        var keys = Object.keys(effects);
        if (keys.length === 0) return '<span class="sam-empty" style="padding:4px 0;">无</span>';
        var html = '<div class="sam-effects">';
        keys.forEach(function(k) {
            var v = effects[k];
            var vs = (typeof v === 'object') ? JSON.stringify(v) : safeStr(v);
            if (editMode && path) {
                html += '<div class="sam-effect-line"><span class="ek">'+esc(k)+':</span> '+editInput(path+'.'+k, v, 'text')+'</div>';
            } else {
                html += '<div class="sam-effect-line"><span class="ek">'+esc(k)+':</span> '+esc(vs)+'</div>';
            }
        });
        html += '</div>';
        return html;
    }
    /* 标签数组渲染 */
    function formatTags(tags, path, editMode) {
        if (!Array.isArray(tags)) tags = [];
        if (tags.length === 0 && !editMode) return '<span class="sam-empty" style="padding:2px 0;">无</span>';
        if (editMode && path) return editInput(path, tags.join(','), 'text');
        var html = '<div class="sam-tags">';
        tags.forEach(function(t) { html += '<span class="sam-tag">'+esc(t)+'</span>'; });
        html += '</div>';
        return html;
    }
    /* 数值属性网格 */
    function formatStatGrid(stats, cols) {
        if (!stats || typeof stats !== 'object') return '';
        var keys = Object.keys(stats);
        if (keys.length === 0) return '';
        var html = '<div class="sam-stat-grid" style="'+(cols?('grid-template-columns:repeat('+cols+',1fr);'):'')+'">';
        keys.forEach(function(k) {
            html += '<div class="sam-stat-cell"><div class="sn">'+esc(k)+'</div><div class="sv">'+safeNum(stats[k],0)+'</div></div>';
        });
        html += '</div>';
        return html;
    }
    /* 内联完整资料卡片(装备/道具/技能/血统/形态) */
    // 删除按钮HTML(编辑模式时显示, 挂在卡片头部右侧; 点击触发二级确认→写MVU删除)
    function samDelBtn(path, editMode, label) {
        if (!editMode) return '';
        return '<button type="button" class="sam-fc-del-btn" data-del-path="'+esc(path)+'" title="'+(label||'删除')+'">✕</button>';
    }
    function fullCard(q, title, rowsHtml, bodyHtml, headExtra) {
        var qc = q ? parseRarity(q) : '';
        var badge = qc ? '<div class="sam-fc-q q-'+qc+'">'+qc+'</div>' : '';
        var head = '<div class="sam-fc-head"><div class="sam-fc-title">'+esc(title)+'</div>'+(headExtra||'')+badge+'</div>';
        return '<div class="sam-full-card'+(qc?' q-'+qc:'')+'">'+head+(rowsHtml?'<div class="sam-fc-rows">'+rowsHtml+'</div>':'')+(bodyHtml||'')+'</div>';
    }
    function fcRow(k, v, path, editMode, type) {
        if (editMode && path && !isReadonlyPath(path)) {
            var val = (type === 'number') ? safeNum(v,0) : v;
            return '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+editInput(path, val, type||'text')+'</span></div>';
        }
        var vs = (v === null || v === undefined) ? '-' : ((typeof v === 'object') ? JSON.stringify(v) : safeStr(v));
        return '<div class="sam-row"><span class="k">'+esc(k)+'</span><span class="v">'+esc(vs)+'</span></div>';
    }
    /* 全宽左对齐块: 标签在上, 内容独占整行(效果/描述等长文本用) */
    function fcBody(label, contentHtml, extraClass) {
        return '<div class="sam-fc-block">'
            + '<div class="sam-fc-label">'+esc(label)+'</div>'
            + '<div class="sam-fc-content '+(extraClass||'')+'">'+contentHtml+'</div>'
            + '</div>';
    }
    /* 可伸缩全宽块: <details> 折叠(原始属性等大块用) */
    function fcBodyCollapsible(label, contentHtml, extraClass, openByDefault) {
        return '<details class="sam-fc-collapse '+(extraClass||'')+'" '+(openByDefault?'open':'')+'>'
            + '<summary class="sam-fc-collapse-sum">'+esc(label)+'</summary>'
            + '<div class="sam-fc-content '+(extraClass||'')+'">'+contentHtml+'</div>'
            + '</details>';
    }
    /* 栏目级可伸缩块: title(含emoji) + 内容; 默认展开 */
    function secBlock(title, contentHtml, openByDefault, headExtra) {
        return '<details class="sam-sec" '+(openByDefault === false ? '' : 'open')+'>'
            + '<summary class="sam-sec-sum"><span class="sam-sec-title">'+esc(title)+'</span>'+(headExtra||'')+'</summary>'
            + '<div class="sam-sec-body">'+(contentHtml||'')+'</div>'
            + '</details>';
    }

    /* ===== 32b. 删除NPC(写回MVU) ===== */
    function deleteNpc(name) {
        if (!name) return;
        var ok = writeBackMvu(function(statData) {
            if (statData && statData.关系列表 && statData.关系列表[name]) {
                delete statData.关系列表[name];
                try { console.log('%c[主神终端] ✅ NPC已删除: '+name, 'color:#86efac'); } catch(e){}
            }
        });
        if (ok) { try { closeModal(); } catch(e){} renderAll(); }
    }

    /* ===== 32b2. 删除世界条目(探索点/势力等, 写回MVU) =====
       fullKey: 完整路径如 "世界.探索.城镇废墟" / "世界.势力.黑鹰团"
       parentPath: 父对象路径如 "世界.探索" / "世界.势力"
       key: 末段名, 用于提示
    */
    function deleteWorldEntry(fullKey, parentPath, key) {
        if (!fullKey) return;
        var ok = writeBackMvu(function(statData) {
            // 通用按点路径删除: 沿路径走到最后第二段, 删末段
            var parts = fullKey.split('.');
            var obj = statData;
            for (var i = 0; i < parts.length - 1; i++) {
                if (!obj || typeof obj !== 'object') return;
                obj = obj[parts[i]];
            }
            if (obj && typeof obj === 'object' && obj.hasOwnProperty(parts[parts.length-1])) {
                delete obj[parts[parts.length-1]];
                try { console.log('%c[主神终端] ✅ 世界条目已删除: '+fullKey, 'color:#86efac'); } catch(e){}
            }
        });
        if (ok) { samToast('success', '已删除: ' + (key || fullKey)); renderAll(); }
        else samToast('error', '删除失败: MVU写回不可用');
    }

    /* ===== 32c. 装备/道具操作按钮(穿戴/脱下/存放/取回/删除) ===== */
    function actBtn(label, action, path, kind, type, key) {
        return '<button class="sam-act-btn" data-act="'+esc(action)+'" data-path="'+esc(path)+'" data-kind="'+esc(kind)+'" data-type="'+esc(String(type==null?'':type))+'" data-key="'+esc(key||'')+'">'+esc(label)+'</button>';
    }
    /* 装备操作按钮: 状态0(装备箱)=穿戴/存放/删除; 状态1(战术栏)=脱下/存放/删除; 状态2(仓库)=穿戴/取回/删除; 类型8(特殊)无按钮
       editMode 为 true 时才生成删除按钮(否则仅显示穿戴/脱下/存放/取回) */
    function equipActionButtons(path, status, type, editMode) {
        if (type === 8) return ''; // 特殊装备: 无限制也无按钮
        var key = path.split('.').pop();
        var delBtn = editMode ? actBtn('删除','delete',path,'equip',type,key) : '';
        if (status === 0) return actBtn('穿戴','wear',path,'equip',type,key)+actBtn('存放','store',path,'equip',type,key)+delBtn;
        if (status === 1) return actBtn('脱下','remove',path,'equip',type,key)+actBtn('存放','store',path,'equip',type,key)+delBtn;
        if (status === 2) return actBtn('穿戴','wear',path,'equip',type,key)+actBtn('取回','takeback',path,'equip',type,key)+delBtn;
        return '';
    }
    /* 道具操作按钮: 状态0(道具箱)=穿戴/存放/删除; 状态1(战术栏)=脱下/存放/删除; 状态2(仓库)=穿戴/取回/删除
       editMode 为 true 时才生成删除按钮 */
    function itemActionButtons(path, status, editMode) {
        var key = path.split('.').pop();
        var delBtn = editMode ? actBtn('删除','delete',path,'item','',key) : '';
        if (status === 0) return actBtn('穿戴','wear',path,'item','',key)+actBtn('存放','store',path,'item','',key)+delBtn;
        if (status === 1) return actBtn('脱下','remove',path,'item','',key)+actBtn('存放','store',path,'item','',key)+delBtn;
        if (status === 2) return actBtn('穿戴','wear',path,'item','',key)+actBtn('取回','takeback',path,'item','',key)+delBtn;
        return '';
    }
    function samToast(type, msg) {
        try {
            if (typeof toastr !== 'undefined' && toastr[type]) { toastr[type]('[主神终端] '+msg); return; }
        } catch(e){}
        try { console.log('%c[主神终端] '+msg, 'color:'+(type==='success'?'#86efac':type==='warning'?'#fbbf24':type==='error'?'#f87171':'#8b95a6')); } catch(e){}
    }
    /* ===== 32c2. 商城市场区: 归一化/解析/购物车/渲染/执行 =====
       移植自 打开商店代码.html, 删除同伴交易(空间币互转+多收件人分账),
       仅保留主角单人购物. 区域改为 装备|道具|技能|血统(4类).
       装备区遵循"左类型nav + 右物品list"布局; 其余区为单列list. */
    // ---- 字段归一化层(ES5改写) ----
    function shopPick(obj) {
        for (var i = 1; i < arguments.length; i++) {
            var k = arguments[i];
            var v = obj[k];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
    }
    function shopPickNum(obj) {
        var v = shopPick.apply(null, arguments);
        if (v === undefined) return undefined;
        var n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
        return isNaN(n) ? undefined : n;
    }
    // 装备类型(数字0-8)→槽位label, 复用 EQUIP_SLOTS 映射表
    function shopEquipTypeLabel(typeNum) {
        var n = parseInt(typeNum, 10);
        if (isNaN(n)) return '装备';
        for (var i = 0; i < EQUIP_SLOTS.length; i++) {
            if (EQUIP_SLOTS[i].type === n) return EQUIP_SLOTS[i].label;
        }
        return '装备';
    }
    // 技能类型(数字0-2)→中文label: 0-主动 1-被动 2-特殊
    function shopSkillTypeLabel(typeNum) {
        var n = parseInt(typeNum, 10);
        if (n === 1) return '被动';
        if (n === 2) return '特殊';
        return '主动';
    }
    function shopNormalizeTags() {
        var tags = [];
        var add = function(value) {
            if (!value) return;
            if (Array.isArray(value)) { value.forEach(add); return; }
            String(value).split(/[;；,，、|]/).forEach(function(s) {
                var t = s.trim();
                if (t && tags.indexOf(t) < 0) tags.push(t);
            });
        };
        for (var i = 0; i < arguments.length; i++) add(arguments[i]);
        return tags;
    }
    // 兜底: 商城商品若标签中无来源关键词(主神/系统/手工), 强制注入"主神空间"标签
    // 原因: 商城在主神空间运行, 售出商品天然为合法资产; AI偶尔漏写来源标签时兜底, 保证享受免除自适应压缩
    var SHOP_SOURCE_KEYWORDS = ['主神', '系统', '手工'];
    function shopEnsureSourceTag(rawTags) {
        var arr = shopNormalizeTags(rawTags);
        var hasSource = arr.some(function(t) {
            return SHOP_SOURCE_KEYWORDS.some(function(kw) { return String(t).indexOf(kw) >= 0; });
        });
        if (!hasSource) arr.push('主神空间');
        return arr;
    }
    function shopNormalizeDamageAttr(value) {
        var text = String(value || '').trim();
        if (!text) return undefined;
        if (text === '物理' || text === '法术' || text === '真实') return text;
        if (/真|穿透|无视/.test(text)) return '真实';
        if (/物理|斩|刺|钝|枪|弹|箭|刀|剑/.test(text)) return '物理';
        return '法术';
    }
    function shopNormalizeSlotType(value) {
        var text = String(value || '').trim();
        if (text === '法器' || text === '法术武器') return '武器';
        return text || undefined;
    }
    // passive_stats 统一解析成 { hp_bonus, atk_bonus, ... }(支持结构化对象与字符串两种格式)
    function shopNormalizePassiveStats(raw) {
        var out = {};
        if (!raw) return out;
        if (typeof raw === 'object' && !Array.isArray(raw)) {
            var keyMap = {
                hp_bonus:           ['hp_bonus','HP上限','HP加成','生命上限','HP','hp'],
                mp_bonus:           ['mp_bonus','MP上限','MP加成','法力上限','MP','mp'],
                atk_bonus:          ['atk_bonus','ATK加成','ATK','攻击','力量加成'],
                def_bonus:          ['def_bonus','DEF加成','DEF','防御','防御加成'],
                spell_atk_bonus:    ['spell_atk_bonus','法术ATK加成','法术ATK','法攻','法术攻击'],
                spell_power_bonus:  ['spell_power_bonus','法术强度加成','法术强度','法强'],
                mdef_bonus:          ['mdef_bonus','MDEF加成','魔法防御加成','MDEF','魔防'],
                saving_throw_bonus: ['saving_throw_bonus','豁免','豁免加成']
            };
            for (var std in keyMap) {
                if (!keyMap.hasOwnProperty(std)) continue;
                var v = shopPick.apply(null, [raw].concat(keyMap[std]));
                if (v !== undefined) out[std] = parseInt(v, 10) || 0;
            }
            return out;
        }
        if (typeof raw === 'string') {
            var attrMap = {
                hp_bonus:           /HP上限|HP加成|hp_bonus|生命上限|HP/i,
                mp_bonus:           /MP上限|MP加成|mp_bonus|法力上限|MP/i,
                atk_bonus:          /atk_bonus|攻击加成|ATK加成|ATK(?!加成)/i,
                def_bonus:          /def_bonus|防御加成|DEF加成|DEF/i,
                spell_atk_bonus:    /spell_atk_bonus|法术ATK加成|法术ATK|法攻/i,
                spell_power_bonus:  /spell_power_bonus|法术强度加成|法术强度|法强/i,
                mdef_bonus:          /mdef_bonus|MDEF加成|魔法防御加成|MDEF|魔防/i,
                saving_throw_bonus: /saving_throw_bonus|豁免加成|豁免/i
            };
            for (var s2 in attrMap) {
                if (!attrMap.hasOwnProperty(s2)) continue;
                var m = raw.match(new RegExp(attrMap[s2].source + '[\\s]*[\\+＋]([\\d]+)', 'i'));
                if (m) out[s2] = parseInt(m[1], 10);
            }
        }
        return out;
    }
    function shopNormalizeSkill(raw) {
        var rawCat = shopPick(raw, '类型','category');
        // 保留原始数字(匹配角色侧 skill_item.类型: clampNum(0,0,2))
        var catNum = (typeof rawCat === 'number') ? rawCat
            : (typeof rawCat === 'string' && /^\d+$/.test(String(rawCat))) ? parseInt(String(rawCat), 10)
            : 0;
        var category = shopSkillTypeLabel(catNum);
        var item = {
            name:        shopPick(raw, 'name','名称','技能名','技能名称') || '未命名',
            level:       shopPickNum(raw, 'level','等级','数值等级'),
            rating:      shopPick(raw, 'rating','品级','品质','评级'),
            price:       parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            category_num: catNum,
            category:    category,                          // 类型label(主动/被动/特殊)
            cost:        shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP'),  // 新结构: 字符串如 '8MP'
            effects:     shopPick(raw, '效果','effect','技能效果'),  // 新结构: 对象 {主动:'对单体造成3d6火焰伤害'}
            description: shopPick(raw, 'description','描述','技能描述','说明'),
            tags:        shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
        return item;
    }
    function shopNormalizeBloodline(raw) {
        var rawAttrs = shopPick(raw, '原始属性','基础属性','属性');  // 新结构: 对象 {力量:4, 体质:4}
        var rawEffects = shopPick(raw, '效果','特殊效果','特效');    // 新结构: 对象 {被动:'每回合回复5%HP'}
        var item = {
            name:       shopPick(raw, 'name','名称','血统名','血统名称') || '未命名',
            level:      shopPickNum(raw, 'level','等级','数值等级'),
            rating:     shopPick(raw, 'rating','品级','品质','评级'),
            price:      parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            raw_attrs:  rawAttrs,
            effects:    rawEffects,
            description: shopPick(raw, 'description','描述','血统描述','说明','效果'),
            tags:        shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
        return item;
    }
    // 升级列表归一化: 按所属大类(血统/技能/装备)保留原始结构 + 替换目标
    function shopNormalizeUpgrade(raw) {
        var rawType = shopPick(raw, '类型','type');
        var typeNum = (typeof rawType === 'number') ? rawType
            : (typeof rawType === 'string' && /^\d+$/.test(String(rawType))) ? parseInt(String(rawType), 10) : 0;
        return {
            name:           shopPick(raw, 'name','名称') || '未命名',
            level:          shopPickNum(raw, 'level','等级','数值等级'),
            rating:         shopPick(raw, 'rating','品级','品质','评级'),
            price:          parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            replace_target: shopPick(raw, 'replace_target','替换目标') || '',
            category:       shopPick(raw, 'category','所属大类') || '',
            category_num:   typeNum,
            slot_type:      shopEquipTypeLabel(typeNum),
            slot_type_num:  typeNum,
            cost:           shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP') || '',
            raw_attrs:      shopPick(raw, '原始属性','基础属性','属性'),
            effects:        shopPick(raw, '效果','特效','特殊效果'),
            description:    shopPick(raw, 'description','描述','说明'),
            '描述':         shopPick(raw, 'description','描述','说明'),
            tags:           shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
    }
    function shopNormalizeEquip(raw) {
        var rawType = shopPick(raw, '类型','type','槽位','部位','slot_type');
        // 保留原始数字(匹配角色侧 equip_item.类型: clampNum(0,0,8))
        var typeNum = (typeof rawType === 'number') ? rawType
            : (typeof rawType === 'string' && /^\d+$/.test(String(rawType))) ? parseInt(String(rawType), 10)
            : 0;
        var slotType = shopEquipTypeLabel(typeNum);
        var item = {
            name:      shopPick(raw, 'name','名称','装备名','装备名称') || '未命名',
            level:     shopPickNum(raw, 'level','等级','数值等级'),
            rating:    shopPick(raw, 'rating','品级','品质','评级'),
            price:     parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            slot_type: slotType,
            slot_type_num: typeNum,
            raw_attrs: shopPick(raw, '原始属性','基础属性','属性'),  // 新结构: 对象 {力量:1, 体质:2}
            effects:   shopPick(raw, '效果','特效','special_effect','特殊效果','特性'),  // 新结构: 对象 {被动:'物理防御+3'}
            cost:      shopPick(raw, '消耗','mp_cost','MP消耗','法力消耗','mp','MP') || '',
            '描述':    shopPick(raw, '描述','description','说明'),
            tags:      shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
        return item;
    }
    function shopNormalizeConsume(raw) {
        return {
            name:            shopPick(raw, 'name','名称','道具名','物品名') || '未命名',
            level:           shopPickNum(raw, 'level','等级','数值等级'),
            rating:          shopPick(raw, 'rating','品级','品质','评级'),
            price:           parseInt(String(shopPick(raw, 'price','价格','售价','价钱') || '0').replace(/[^0-9]/g,''), 10) || 0,
            consumable_type: shopPick(raw, 'consumable_type','类型','道具类型','分类') || '道具',
            charges:         shopPickNum(raw, 'charges','数量','次数','使用次数'),
            effects:         shopPick(raw, '效果','usage','使用效果'),  // 新结构: 对象 {使用:'恢复2d4+2HP'}
            description:     shopPick(raw, 'description','描述','说明'),
            tags:            shopEnsureSourceTag(shopPick(raw, 'tags','标签'))
        };
    }
    // 标准化整个商城数据: 产出 { 装备区:{typeLabel:[...]}, 技能区:{typeLabel:[...]}, 道具区:{typeLabel:[...]}, 血统区:[] }
    // 新结构: 商城.装备列表/技能列表/血统列表/道具列表 均为扁平数组
    // 装备/技能/道具按「类型」分组到子对象, 供左nav按类型切换; 血统为纯数组
    function shopNormalizeMarketData(raw) {
        var out = { 装备区:{}, 道具区:{}, 技能区:{}, 血统区:[], 升级区:[] };
        if (!raw || typeof raw !== 'object') return out;
        // 装备列表(扁平数组) → 按 类型(数字0-8) 分组到 {槽位label: [...]}
        var equips = raw['装备列表'];
        if (Array.isArray(equips)) {
            for (var i = 0; i < equips.length; i++) {
                if (!equips[i] || typeof equips[i] !== 'object') continue;
                var e = shopNormalizeEquip(equips[i]);
                var sl = e.slot_type || '装备';
                if (!out.装备区[sl]) out.装备区[sl] = [];
                out.装备区[sl].push(e);
            }
        }
        // 技能列表(扁平数组) → 按 类型(数字0-2) 分组到 {类型label: [...]}
        var skills = raw['技能列表'];
        if (Array.isArray(skills)) {
            for (var j = 0; j < skills.length; j++) {
                if (!skills[j] || typeof skills[j] !== 'object') continue;
                var s = shopNormalizeSkill(skills[j]);
                var sc = s.category || '主动';
                if (!out.技能区[sc]) out.技能区[sc] = [];
                out.技能区[sc].push(s);
            }
        }
        // 道具列表(扁平数组) → 按 类型(字符串, 如恢复/战术/特殊) 分组到 {类型label: [...]}
        var consumables = raw['道具列表'];
        if (Array.isArray(consumables)) {
            for (var ci = 0; ci < consumables.length; ci++) {
                if (!consumables[ci] || typeof consumables[ci] !== 'object') continue;
                var c = shopNormalizeConsume(consumables[ci]);
                var ct = c.consumable_type || '道具';
                if (!out.道具区[ct]) out.道具区[ct] = [];
                out.道具区[ct].push(c);
            }
        }
        // 血统列表(扁平数组)
        var bloods = raw['血统列表'];
        if (Array.isArray(bloods)) {
            for (var bi = 0; bi < bloods.length; bi++) {
                if (bloods[bi] && typeof bloods[bi] === 'object') out.血统区.push(shopNormalizeBloodline(bloods[bi]));
            }
        }
        // 升级列表(扁平数组, 无子分组)
        var upgrades = raw['升级列表'];
        if (Array.isArray(upgrades)) {
            for (var ui = 0; ui < upgrades.length; ui++) {
                if (upgrades[ui] && typeof upgrades[ui] === 'object') out.升级区.push(shopNormalizeUpgrade(upgrades[ui]));
            }
        }
        return out;
    }
    // ---- 变量转换层: 标准化条目 → MVU变量格式 ----
    function shopParsePercent(value) {
        if (value === undefined || value === null) return 0;
        if (typeof value === 'number') return value;
        var text = String(value);
        return parseFloat(text) || 0;
    }
    // 转换归一化商品 → 角色侧变量(技能: 类型输出数字0-2匹配skill_item)
    function shopToSkillVar(item) {
        var out = {
            等级: item.level,
            品质: item.rating,
            类型: item.category_num != null ? item.category_num : 0,
            消耗: item.cost || '',
            效果: item.effects || {},
            描述: item.description || ''
        };
        if (item.tags && item.tags.length) out.标签 = item.tags;
        return out;
    }
    // 转换归一化商品 → 角色侧变量(血统: 原始属性/效果均为对象)
    function shopToBloodlineVar(item) {
        var out = {
            等级: item.level,
            品质: item.rating,
            原始属性: item.raw_attrs || {},
            效果: item.effects || {},
            描述: item.description || ''
        };
        if (item.tags && item.tags.length) out.标签 = item.tags;
        return out;
    }
    // 转换归一化商品 → 角色侧变量(装备: 类型输出数字0-8匹配equip_item, 状态默认未装备=0)
    function shopToEquipVar(item, slot) {
        var out = {
            类型: item.slot_type_num != null ? item.slot_type_num : 0,
            状态: 0,
            品质: item.rating,
            标签: (item.tags && item.tags.length) ? item.tags : [],
            原始属性: item.raw_attrs || {},
            效果: item.effects || {},
            描述: item['描述'] || '',
            消耗: item.cost || ''
        };
        return out;
    }
    // 转换归一化商品 → 角色侧变量(道具: 类型字符串, 数量合并, 效果对象)
    function shopToConsumeVar(item, qty) {
        var out = {
            品质: item.rating,
            类型: item.consumable_type || '道具',
            数量: qty,
            标签: (item.tags && item.tags.length) ? item.tags : [],
            效果: item.effects || {},
            描述: item.description || '',
            状态: 0
        };
        return out;
    }
    // 重算衍生属性(体力/精神 + 血统被动 + 已装备DEF/MDEF)
    function shopRecalcDerived(character) {
        if (!character) return;
        var base = character.基础属性 || {};
        var old = character.衍生属性 || {};
        var oldHpMax = Math.max(Number(old.HP上限 || old.HP || 1), 1);
        var oldMpMax = Math.max(Number(old.MP上限 || old.MP || 1), 1);
        var hpRatio = Math.min(1, Math.max(0, Number(old.HP || 0) / oldHpMax));
        var mpRatio = Math.min(1, Math.max(0, Number(old.MP || 0) / oldMpMax));
        var bonus = { HP加成:0, MP加成:0, ATK加成:0, DEF加成:0, 法术ATK加成:0, 法术强度加成:0, MDEF加成:0, 豁免加成:0 };
        var bloods = character.血统 || {};
        for (var bn in bloods) {
            if (!bloods.hasOwnProperty(bn)) continue;
            var ps = bloods[bn] ? bloods[bn].被动属性 : null;
            if (!ps) continue;
            for (var bk in bonus) {
                if (!bonus.hasOwnProperty(bk)) continue;
                var val = (bk === '法术强度加成') ? shopParsePercent(ps[bk]) : Number(ps[bk] || 0);
                bonus[bk] += Number.isFinite(val) ? val : 0;
            }
        }
        var equipDef = 0, equipMdef = 0;
        var eqs = character.装备 || {};
        for (var en in eqs) {
            if (!eqs.hasOwnProperty(en)) continue;
            var eq = eqs[en];
            if (!eq || eq.状态 !== '已装备') continue;
            equipDef  += Number(eq.DEF || 0);
            equipMdef += Number(eq.MDEF || 0);
        }
        var hpMax = Math.max(1, Number(base.体力 || 0) * 5 + bonus.HP加成);
        var mpMax = Math.max(0, Number(base.精神 || 0) * 5 + bonus.MP加成);
        var derived = {};
        for (var ok in old) { if (old.hasOwnProperty(ok)) derived[ok] = old[ok]; }
        derived.HP上限 = hpMax;
        derived.HP = Math.max(1, Math.min(hpMax, Math.round(hpMax * hpRatio)));
        derived.MP上限 = mpMax;
        derived.MP = Math.max(0, Math.min(mpMax, Math.round(mpMax * mpRatio)));
        derived.ATK = Math.floor(Number(base.力量 || 0) / 5) + bonus.ATK加成;
        derived.DEF = equipDef + bonus.DEF加成;
        derived.MDEF = equipMdef + bonus.MDEF加成;
        derived.法术ATK = Math.floor(Number(base.智力 || 0) / 5) + bonus.法术ATK加成;
        derived.法术强度 = shopParsePercent(bonus.法术强度加成) / 100;
        if (bonus.豁免加成) derived.豁免加成 = bonus.豁免加成;
        character.衍生属性 = derived;
    }
    // ---- 商城状态(模块级, 切聊天/重渲染时持久) ----
    var shopMarketData = null;     // 归一化后的市场数据(4区)
    var shopActiveTab = '';        // 当前区域: 装备|道具|技能|血统
    var shopActiveSlot = '';       // 当前装备区槽位
    var shopBloodCount = 0;        // 当前玩家已拥有血统数(用于商城血统区上限判定)
    var shopBloodLimit = 3;        // 血统数量上限(取自 共同.血统限制数)
    var shopCart = [];             // 购物车(主角单人, 每项 {item副本, _cat, _slot, quantity})
    var shopRefreshing = false;    // 刷新商品进行中(模块级标志, 切聊天/重渲染时持久, 避免按钮状态丢失)
    // 保存并恢复 .sam-shop-list 滚动位置(参考持有面板 renderAll 的 scrollTop 保持模式)
    // 原因: renderAll 重建面板后, 内部 .sam-shop-list(max-height:340px; overflow-y:auto)
    // 的 scrollTop 会归零, 导致点+/-按钮或选卡片时商品列表跳回顶部
    function shopPreserveScroll(fn) {
        var $list = $('#samsara-panel .sam-shop-list');
        var saved = $list.length ? ($list[0].scrollTop || 0) : 0;
        if (typeof fn === 'function') fn();
        if (saved > 0) {
            var $newList = $('#samsara-panel .sam-shop-list');
            if ($newList.length) {
                try { $newList[0].scrollTop = saved; } catch(e){}
                var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
                if (raf) raf(function(){ try { $newList[0].scrollTop = saved; } catch(e){} });
            }
        }
    }
    // 局部刷新商城市场区(tabs+content+footer), 不重建入口栏目的需求输入框, 避免AutoComplete绑定已移除输入框报错
    function shopRefreshMarket() {
        shopPreserveScroll(function() {
            var $market = $('#samsara-panel .sam-shop-market');
            if ($market.length) { var sd = getStatData(); var coin = sd && sd.主角 ? safeNum(sd.主角.空间币, 0) : 0; $market.html(shopRenderTabs() + shopRenderContent(coin) + shopRenderFooter(coin)); }
            else renderAll();
        });
    }
    function shopCartCost() {
        var sum = 0;
        for (var i = 0; i < shopCart.length; i++) {
            sum += Number(shopCart[i].price || 0) * Number(shopCart[i].quantity || 1);
        }
        return sum;
    }
    // 剩余余额 = 原始余额 - 购物车已选合计(用于禁用判定/预检/购物车条展示)
    function shopRemain(coin) { return coin - shopCartCost(); }
    function shopIsSelected(name, cat, slot) {
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name !== name || shopCart[i]._cat !== cat) continue;
            // 道具区: 卡片按类型(恢复/战术/特殊)分组渲染(slot非空), 但数量控件写入购物车的 _slot 恒为空,
            // 若仍按 slot 精确匹配会导致"已选/已选×N"角标永远不显示(选中态丢失)。
            // 故道具区选中身份仅按 name+cat 判定(与 shopGetQty 一致), 忽略 slot。
            if (cat === '道具区') return true;
            if (shopCart[i]._slot === (slot||'')) return true;
        }
        return false;
    }
    // 读取道具区数量(用于回填输入框, 避免全量 renderAll 后归零)
    function shopGetQty(name, cat) {
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name === name && shopCart[i]._cat === cat) return shopCart[i].quantity || 0;
        }
        return 0;
    }
    function shopToggleSelect(item, cat, slot) {
        var idx = -1;
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name === item.name && shopCart[i]._cat === cat && shopCart[i]._slot === (slot||'')) { idx = i; break; }
        }
        if (idx > -1) shopCart.splice(idx, 1);
        else {
            var copy = {};
            for (var k2 in item) { if (item.hasOwnProperty(k2)) copy[k2] = item[k2]; }
            copy._cat = cat; copy._slot = slot || ''; copy.quantity = 1;
            shopCart.push(copy);
        }
        shopRefreshMarket();
    }
    function shopSetQty(name, cat, qty) {
        var s = null, idx = -1;
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name === name && shopCart[i]._cat === cat) { s = shopCart[i]; idx = i; break; }
        }
        if (qty <= 0) { if (idx > -1) shopCart.splice(idx, 1); }
        else if (s) { s.quantity = qty; }
        else {
            // 道具区已改为分组对象, 需遍历全部分组查找
            var found = shopFindItems('道具区', '', name);
            found = found.length ? found[0] : null;
            if (found) {
                var c2 = {}; for (var k3 in found) { if (found.hasOwnProperty(k3)) c2[k3] = found[k3]; }
                c2._cat = cat; c2._slot = ''; c2.quantity = qty;
                shopCart.push(c2);
            }
        }
        shopRefreshMarket();
    }
    // ---- 渲染层 ----
    function shopRatingClass(r) {
        if (!r) return '';
        if (String(r).indexOf('SS') === 0) return 'r-SS';
        if (r === 'S') return 'r-S';
        return 'r-' + r;
    }
    function shopChip(label, value) {
        return '<span class="sam-shop-chip"><b>'+esc(label)+':</b> '+esc(value)+'</span>';
    }
    // 对象展开成 chip 列表(如 原始属性 {力量:1, 体质:2} → [力量:1][体质:2])
    function shopObjChips(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
        var html = '';
        for (var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            var v = obj[k];
            if (v === undefined || v === null || v === '') continue;
            html += shopChip(k, v);
        }
        return html;
    }
    // 对象展开成 detail 块(如 效果 {主动:'对单体造成3d6伤害'} → 效果: 主动=对单体造成3d6伤害)
    function shopObjDetails(label, obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
        var parts = [];
        for (var k2 in obj) {
            if (!obj.hasOwnProperty(k2)) continue;
            var v2 = obj[k2];
            if (v2 === undefined || v2 === null || v2 === '') continue;
            parts.push(esc(k2)+'：'+esc(String(v2)));
        }
        if (!parts.length) return '';
        return '<div class="sam-shop-item-detail"><b>'+esc(label)+':</b> '+parts.join('；')+'</div>';
    }
    function shopSigned(v) {
        var n = Number(v);
        if (Number.isFinite(n)) return n > 0 ? '+'+n : String(n);
        return String(v);
    }
    var SHOP_STAT_LABELS = { hp_bonus:'HP', mp_bonus:'MP', atk_bonus:'ATK', def_bonus:'DEF', spell_atk_bonus:'法术ATK', spell_power_bonus:'法术强度', mdef_bonus:'MDEF', saving_throw_bonus:'豁免' };
    function shopStatChips(stats) {
        var html = '';
        for (var key in SHOP_STAT_LABELS) {
            if (!SHOP_STAT_LABELS.hasOwnProperty(key)) continue;
            if (stats && stats[key] !== undefined && stats[key] !== null) {
                html += shopChip(SHOP_STAT_LABELS[key], shopSigned(stats[key]));
            }
        }
        return html;
    }
    function shopTagChips(tags) {
        if (!tags || !tags.length) return '';
        var html = '';
        for (var i = 0; i < tags.length; i++) html += shopChip('标签', tags[i]);
        return html;
    }
    function shopSpecialSummary(benefits, drawbacks) {
        var bt = (benefits && benefits.length) ? benefits.join('；') : '无';
        var dt = (drawbacks && drawbacks.length) ? drawbacks.join('；') : '无';
        return '增益：'+bt+'；副作用：'+dt;
    }
    function shopDetail(label, value) {
        if (value === undefined || value === null || value === '') return '';
        return '<div class="sam-shop-item-detail"><b>'+esc(label)+':</b> '+esc(String(value))+'</div>';
    }
    // 卡片头部(name + 品质徽章, 共同品质色)
    function shopCardHead(item) {
        var qc = parseRarity(item.rating);
        return '<div class="sam-shop-item-head"><div class="sam-shop-item-name">'+esc(item.name)+'</div>'
            + '<div class="sam-shop-item-meta q-'+qc+'">'+esc(item.rating || '')+'</div></div>';
    }
    function shopCardFoot(item, isConsume) {
        var curQty = isConsume ? shopGetQty(item.name, '道具区') : 0;
        var qtyHtml = isConsume ? '<div class="sam-shop-qty">'
            + '<button type="button" class="sam-shop-qty-btn" data-shop-qty-btn="minus" data-name="'+esc(item.name)+'">−</button>'
            + '<input type="number" class="sam-shop-qty-inp" min="0" value="'+curQty+'" data-name="'+esc(item.name)+'">'
            + '<button type="button" class="sam-shop-qty-btn" data-shop-qty-btn="plus" data-name="'+esc(item.name)+'">+</button></div>' : '';
        return '<div class="sam-shop-item-foot"><div class="sam-shop-price">'+(item.price ? item.price.toLocaleString() : '0')+'</div>'+qtyHtml+'</div>';
    }
    // attrs: 仅保留 原始属性/消耗(技能)/标签; 类型与效果已在上方Tab条和details区展示, 不重复
    function shopBuildSkillCard(item) {
        var attrs = '';
        if (item.cost) attrs += shopChip('消耗', item.cost);
        attrs += shopObjChips(item.raw_attrs);    // 技能可能带原始属性加成
        attrs += shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDetail('描述', item.description);
        return shopCardHead(item) + '<div class="sam-shop-item-attrs">'+attrs+'</div>' + details + shopCardFoot(item, false);
    }
    function shopBuildBloodlineCard(item) {
        var attrs = shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDetail('描述', item.description);
        return shopCardHead(item) + '<div class="sam-shop-item-attrs">'+attrs+'</div>' + details + shopCardFoot(item, false);
    }
    function shopBuildEquipCard(item) {
        var attrs = '';
        if (item.cost) attrs += shopChip('消耗', item.cost);
        attrs += shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDetail('描述', item['描述']);
        return shopCardHead(item) + '<div class="sam-shop-item-attrs">'+attrs+'</div>' + details + shopCardFoot(item, false);
    }
    function shopBuildUpgradeCard(item) {
        var attrs = '';
        if (item.replace_target) attrs += shopChip('替换', item.replace_target);
        if (item.category) attrs += shopChip('大类', item.category);
        attrs += shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDetail('描述', item.description);
        return shopCardHead(item) + '<div class="sam-shop-item-attrs">'+attrs+'</div>' + details + shopCardFoot(item, false);
    }
    function shopBuildConsumeCard(item) {
        var attrs = shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDetail('描述', item.description);
        return shopCardHead(item) + '<div class="sam-shop-item-attrs">'+attrs+'</div>' + details + shopCardFoot(item, true);
    }
    // 区域Tab条
    function shopRenderTabs() {
        var cats = [
            { key:'装备区', label:'装备', data: shopMarketData ? shopMarketData['装备区'] : null },
            { key:'道具区', label:'道具', data: shopMarketData ? shopMarketData['道具区'] : null },
            { key:'技能区', label:'技能', data: shopMarketData ? shopMarketData['技能区'] : null },
            { key:'血统区', label:'血统', data: shopMarketData ? shopMarketData['血统区'] : null },
            { key:'升级区', label:'升级服务', data: shopMarketData ? shopMarketData['升级区'] : null }
        ];
        var html = '<div class="sam-shop-tabs">';
        for (var i = 0; i < cats.length; i++) {
            var c = cats[i];
            var cnt = 0;
            if ((c.key === '装备区' || c.key === '技能区' || c.key === '道具区') && c.data) { for (var s in c.data) { if (c.data.hasOwnProperty(s) && c.data[s].length) cnt += c.data[s].length; } }
            else if (Array.isArray(c.data)) cnt = c.data.length;
            // 空列表: 不渲染该Tab按钮(例如道具列表为[]时, 道具按钮隐藏)
            if (!cnt) continue;
            var active = (shopActiveTab === c.key) || (!shopActiveTab && i === 0);
            html += '<button type="button" class="sam-shop-tab'+(active?' active':'')+'" data-shop-tab="'+esc(c.key)+'">'+esc(c.label)
                + '<span class="sam-shop-tab-cnt">'+cnt+'</span></button>';
        }
        html += '</div>';
        return html;
    }
    // 渲染当前区域内容(顶部nav + 中部list, 已无外层market容器——由 renderShopTab 统一包裹)
    // coin 用于卡片禁用判定(余额不足时灰调)
    function shopRenderContent(coin) {
        if (!shopMarketData) return '<div class="sam-shop-list"><div class="sam-shop-empty">尚未刷新商品, 请在上方商城入口写入需求后点击「刷新商品」</div></div>';
        var cat = shopActiveTab || '装备区';
        // 装备区/技能区/道具区: 顶部nav(类型) + 中部list(按类型分组)
        if (cat === '装备区' || cat === '技能区' || cat === '道具区') {
            var groups = shopMarketData[cat] || {};
            var groupKeys = [];
            for (var g in groups) { if (groups.hasOwnProperty(g) && groups[g].length) groupKeys.push(g); }
            if (!groupKeys.length) return '<div class="sam-shop-nav"></div><div class="sam-shop-list"><div class="sam-shop-empty">'+esc(cat.replace('区',''))+'区暂无商品</div></div>';
            var activeSlot = shopActiveSlot && groups[shopActiveSlot] ? shopActiveSlot : groupKeys[0];
            if (shopActiveSlot !== activeSlot) shopActiveSlot = activeSlot;
            var navHtml = '';
            for (var i = 0; i < groupKeys.length; i++) {
                var sk = groupKeys[i];
                var cnt = groups[sk].length;
                navHtml += '<button type="button" class="sam-shop-nav-btn'+(sk === activeSlot ? ' active' : '')+'" data-shop-slot="'+esc(sk)+'">'+esc(sk)+'<span class="sam-shop-nav-cnt">'+cnt+'</span></button>';
            }
            var listHtml = shopRenderGroupList(groups[activeSlot] || [], cat, activeSlot, coin);
            return '<div class="sam-shop-nav">'+navHtml+'</div><div class="sam-shop-list">'+listHtml+'</div>';
        }
        // 血统区: 纯list(无nav, 单列布局)
        var items = shopMarketData[cat] || [];
        if (!items.length) return '<div class="sam-shop-list"><div class="sam-shop-empty">'+esc(cat.replace('区',''))+'区暂无商品</div></div>';
        var listHtml3 = '';
        for (var j = 0; j < items.length; j++) {
            listHtml3 += shopRenderItemCard(items[j], cat, '', coin);
        }
        return '<div class="sam-shop-list">'+listHtml3+'</div>';
    }
    // 分组列表渲染(装备区/技能区/道具区通用: 按类型分组后的单组列表)
    function shopRenderGroupList(items, cat, slot, coin) {
        if (!items || !items.length) return '<div class="sam-shop-empty">此分类暂无商品</div>';
        var html = '';
        for (var i = 0; i < items.length; i++) {
            html += shopRenderItemCard(items[i], cat, slot, coin);
        }
        return html;
    }
    // 单卡片渲染(含选中态/禁用态/数量回填/已选角标)
    function shopRenderItemCard(item, cat, slot, coin) {
        var inner = '';
        var isConsume = (cat === '道具区');
        if (cat === '技能区') inner = shopBuildSkillCard(item);
        else if (cat === '血统区') inner = shopBuildBloodlineCard(item);
        else if (cat === '装备区') inner = shopBuildEquipCard(item);
        else if (cat === '升级区') inner = shopBuildUpgradeCard(item);
        else if (isConsume) inner = shopBuildConsumeCard(item);
        else inner = shopBuildSkillCard(item);
        var isSelected = shopIsSelected(item.name, cat, slot);
        var sel = isSelected ? ' selected' : '';
        // 禁用判定: 已选中的不灰(允许调整数量/取消); 未选中且单件价格>余额 → 灰调禁用
        // 道具区按"1件价格"判定(可后续加数量); 其他区按单件价格
        var unitPrice = Number(item.price || 0);
        // 禁用判定基于"剩余余额"(原始余额-已选合计), 避免叠加选中后仍可继续点
        var remain = shopRemain(coin);
        var unaffordable = (!isSelected && remain < unitPrice);
        // 血统区上限判定: 当前血统数 >= 限制数时, 未选中的血统商品全部灰显不可购买(已选的仍允许调整)
        var bloodFull = (cat === '血统区' && !isSelected && shopBloodCount >= shopBloodLimit);
        var disReason = bloodFull ? 'bloodfull' : (unaffordable ? 'unaffordable' : '');
        var dis = disReason ? ' disabled' : '';
        var dataAttrs = ' data-name="'+esc(item.name)+'" data-cat="'+esc(cat)+'" data-slot="'+esc(slot||'')+'" data-dis-reason="'+disReason+'"';
        // 已选角标(选中时显示); 道具区角标文案带数量
        var cornerLabel = isSelected ? (isConsume ? ('已选 ×'+(shopGetQty(item.name, cat)||0)) : '已选') : '';
        var cornerHtml = '<span class="sam-shop-sel-corner">'+esc(cornerLabel)+'</span>';
        return '<div class="sam-shop-item'+sel+dis+'"'+dataAttrs+'>'+inner+cornerHtml+'</div>';
    }
    // 底部购物车条
    function shopRenderFooter(coin) {
        var cartCount = shopCart.length;
        var cost = shopCartCost();
        var remain = coin - cost;
        var insufficient = (remain < 0);
        var remainCls = insufficient ? ' insufficient' : '';
        var infoHtml = '';
        if (!cartCount) {
            infoHtml = '已选 <b>0</b> 项 · 合计 <b>0</b> · 剩余 <b>'+(coin ? coin.toLocaleString() : '0')+'</b>';
        } else if (insufficient) {
            infoHtml = '<span class="sam-shop-foot-warn">⚠️ 空间币不足! 已选 '+cartCount+' 项 · 合计 '+cost.toLocaleString()+' · 剩余 <span class="sam-shop-foot-remain insufficient">'+remain.toLocaleString()+'</span></span>';
        } else {
            infoHtml = '已选 <b>'+cartCount+'</b> 项 · 合计 <b>'+cost.toLocaleString()+'</b> · 剩余 <span class="sam-shop-foot-remain'+remainCls+'"><b>'+remain.toLocaleString()+'</b></span>';
        }
        var disabled = (!cartCount || insufficient) ? ' disabled' : '';
        var btnText = cartCount ? '授权执行交易' : '请先选择商品';
        return '<div class="sam-shop-foot"><div class="sam-shop-foot-info">'+infoHtml+'</div>'
            + '<button type="button" class="sam-shop-exec-btn" data-shop-exec'+disabled+'>'+btnText+'</button></div>';
    }
    // ---- 执行层: 提交交易(/send 文本|/trigger + 写回MVU) ----
    function shopGetLastMessageId() {
        try {
            var win = GS_PARENT || window;
            var helper = win.TavernHelper || {};
            var ctx = (win.SillyTavern && typeof win.SillyTavern.getContext === 'function') ? win.SillyTavern.getContext() : null;
            var fn = helper.getLastMessageId || win.getLastMessageId || (ctx ? ctx.getLastMessageId : null);
            var id = typeof fn === 'function' ? Number(fn.call(ctx || win)) : NaN;
            if (Number.isFinite(id)) return id;
            if (ctx && Array.isArray(ctx.chat)) return ctx.chat.length - 1;
        } catch(e) {}
        return 0;
    }
    function shopReadMessageById(messageId) {
        try {
            var win = GS_PARENT || window;
            if (typeof win.getChatMessages !== 'function') return null;
            var messages = win.getChatMessages(messageId);
            if (messages && messages.length) {
                return messages[messages.length - 1] || messages[0];
            }
        } catch(e) {}
        return null;
    }
    function shopWaitForCreatedUserMessage(afterId, timeout) {
        timeout = timeout || 10000;
        var start = Date.now();
        return new Promise(function(resolve, reject) {
            function check() {
                if (Date.now() - start > timeout) { reject(new Error('未能定位交易记录楼层')); return; }
                try {
                    var latestId = shopGetLastMessageId();
                    var found = false;
                    var pending = latestId - afterId;
                    if (pending <= 0) { setTimeout(check, 80); return; }
                    var checked = 0;
                    var next = function(id) {
                        if (id > latestId) {
                            if (!found) setTimeout(check, 80);
                            return;
                        }
                        var msg = shopReadMessageById(id);
                        if (msg && msg.role === 'user') { resolve(id); return; }
                        next(id + 1);
                    };
                    next(afterId + 1);
                } catch(e) { setTimeout(check, 80); }
            }
            check();
        });
    }
    function shopTriggerSlash(cmd) {
        return new Promise(function(resolve, reject) {
            try {
                var win = GS_PARENT || window;
                // 优先 triggerSlash(酒馆原生)
                if (typeof win.triggerSlash === 'function') { resolve(win.triggerSlash(cmd)); return; }
                if (typeof win.SillyTavern === 'object' && win.SillyTavern && typeof win.SillyTavern.triggerSlash === 'function') { resolve(win.SillyTavern.triggerSlash(cmd)); return; }
                // 兜底: 注册的 STScriptParser / executeSlashCommand
                if (typeof win.executeSlashCommand === 'function') { resolve(win.executeSlashCommand(cmd)); return; }
                if (typeof win.registeredSlashCommands !== 'undefined') {
                    // /send 走 sendToInputBox 自动发送替代
                    reject(new Error('triggerSlash 不可用'));
                    return;
                }
                reject(new Error('triggerSlash 不可用'));
            } catch(e) { reject(e); }
        });
    }
    // 构建交易: 在 stat_data 副本上执行扣币/入包, 返回 { statData, purchaseLog }
    function shopBuildTransaction(statData) {
        var character = statData.主角;
        if (!character) throw new Error('主角数据不存在');
        var total = shopCartCost();
        if (Number(character.空间币 || 0) < total) throw new Error('主角空间币不足');
        character.空间币 = Number(character.空间币 || 0) - total;
        if (!character.装备) character.装备 = {};
        if (!character.技能) character.技能 = {};
        if (!character.血统) character.血统 = {};
        if (!character.背包) character.背包 = {};
        var itemStrs = [];
        for (var i = 0; i < shopCart.length; i++) {
            var item = shopCart[i];
            var qty = item.quantity || 1;
            if (item._cat === '技能区') {
                character.技能[item.name] = shopToSkillVar(item);
            } else if (item._cat === '血统区') {
                character.血统[item.name] = shopToBloodlineVar(item);
            } else if (item._cat === '装备区') {
                var nextEq = shopToEquipVar(item, item._slot);
                character.装备[item.name] = nextEq;
            } else if (item._cat === '道具区') {
                var old = character.背包[item.name];
                var nextCon = shopToConsumeVar(item, qty);
                if (old && typeof old === 'object') nextCon.数量 = Number(old.数量 || 0) + qty;
                var merged = {};
                if (old && typeof old === 'object') { for (var ok2 in old) { if (old.hasOwnProperty(ok2)) merged[ok2] = old[ok2]; } }
                for (var nk in nextCon) { if (nextCon.hasOwnProperty(nk)) merged[nk] = nextCon[nk]; }
                character.背包[item.name] = merged;
            } else if (item._cat === '升级区') {
                // 升级商品: 按所属大类决定写入哪个角色字段; 替换目标决定回收哪个旧物品
                var upCat = item.category || '';
                var tgtName = item.replace_target || item.name;
                if (upCat === '血统') {
                    if (character.血统[tgtName]) delete character.血统[tgtName];
                    character.血统[item.name] = shopToBloodlineVar(item);
                } else if (upCat === '技能') {
                    if (character.技能[tgtName]) delete character.技能[tgtName];
                    character.技能[item.name] = shopToSkillVar(item);
                } else if (upCat === '装备') {
                    var oldEquip = character.装备[tgtName];
                    var newEquip = shopToEquipVar(item, '');
                    if (oldEquip && typeof oldEquip === 'object' && oldEquip.状态 != null) newEquip.状态 = oldEquip.状态;
                    if (character.装备[tgtName]) delete character.装备[tgtName];
                    character.装备[item.name] = newEquip;
                }
            }
            var qtyStr = qty > 1 ? ' ×'+qty : '';
            itemStrs.push(item.name + qtyStr + '（Lv.'+item.level+' '+(item.rating||'')+'）');
        }
        shopRecalcDerived(character);
        // 从 stat_data.商城 移除已购买商品(持久化售出状态)
        shopRemovePurchasedFromLibrary(statData, shopCart);
        return { statData: statData, purchaseLog: '主角兑换了 ' + itemStrs.join('、') };
    }
    // 从商品库移除已购物品: 新结构 商城.装备列表/技能列表/血统列表/道具列表 均为扁平数组
    // 所有区域(含道具区)统一"整件移除"——买走的商品直接从商品库消失, 不做数量递减
    // (商店语义: 玩家买走的即下架, 不再陈列; 道具原数量字段仅作展示, 不作为可购上限)
    function shopRemovePurchasedFromLibrary(statData, cart) {
        if (!statData.商城) return;
        var lib = statData.商城;
        // 收集已购物品名(全部整件移除)
        var removeNames = {};
        for (var i = 0; i < cart.length; i++) {
            removeNames[cart[i].name] = true;
        }
        // 新结构: 4个扁平数组, 逐个过滤(整件移除)
        var listKeys = ['装备列表','技能列表','血统列表','道具列表','升级列表'];
        for (var ki = 0; ki < listKeys.length; ki++) {
            var key = listKeys[ki];
            if (Array.isArray(lib[key])) {
                lib[key] = shopFilterLibArray(lib[key], removeNames);
            }
        }
    }
    // 商品库数组过滤(整件移除): 按名称移除已购物品, 其余保留
    function shopFilterLibArray(arr, removeNames) {
        if (!Array.isArray(arr) || !removeNames) return arr || [];
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            var nm = String(shopPick(it, '名称','name','道具名','物品名') || '');
            if (removeNames[nm]) continue;
            out.push(it);
        }
        return out;
    }
    // 返回对象上第一个匹配的 key 名(供原地修改数量字段)
    function shopPickKey(obj) {
        for (var i = 1; i < arguments.length; i++) {
            var k = arguments[i];
            if (obj && obj[k] !== undefined) return k;
        }
        return null;
    }
    function shopHandleExec() {
        var sd = getStatData();
        if (!sd) { samToast('error', '数据未就绪'); return; }
        if (!shopCart.length) { samToast('warning', '请先选择商品'); return; }
        var coin = safeNum(sd.主角 && sd.主角.空间币, 0);
        if (coin < shopCartCost()) { samToast('error', '空间币不足, 无法执行交易'); return; }
        // 1) 在 stat_data 副本上构建交易结果(扣币/入包/商品库一次性移除全部已购)
        var result;
        try {
            // 深拷贝 stat_data, 避免污染原对象
            var snapshot = (_ && _.cloneDeep) ? _.cloneDeep(sd) : JSON.parse(JSON.stringify(sd));
            result = shopBuildTransaction(snapshot);
        } catch(e) {
            samToast('error', '交易构建失败: '+e.message);
            return;
        }
        var $execBtn = $('.sam-shop-exec-btn');
        if ($execBtn.length) { $execBtn.prop('disabled', true).text('执行中...'); }
        // 2) ★ 同步优先直写 MVU(原子操作): 立即把交易结果写回, 商品库一次性移除全部已购物品
        //    旧流程先 /trigger 触发AI回复, AI的[mvu_update]会覆盖我们的写回(导致只删1个),
        //    改为: 先直写MVU(不可被覆盖) → 清空购物车 → 再 /send 记录文本(不触发AI)
        var writeOk = writeBackMvu(function(statData) {
            // 用构建好的交易结果整体覆盖主角字段 + 商城商品库
            var rs = result.statData;
            if (rs.主角) statData.主角 = rs.主角;
            if (rs.商城) statData.商城 = rs.商城;
        });
        if (!writeOk) {
            samToast('error', '交易失败: MVU写回不可用');
            if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
            return;
        }
        // 3) 清空购物车 + 刷新UI(立即反映商品库已移除已购)
        shopCart = [];
        // 重新读取商品库以同步本地缓存(shopMarketData), 避免显示已售商品
        var freshSd = getStatData();
        if (freshSd && freshSd.商城 && freshSd.商城) {
            shopMarketData = shopNormalizeMarketData(freshSd.商城);
            if (!shopTabHasData(shopActiveTab)) shopActiveTab = shopPickFirstAvailableTab();
        } else {
            shopMarketData = null;
        }
        samToast('success', '交易已完成');
        renderAll();
        // 4) /send 记录交易文本(仅创建用户楼层, 不带 /trigger, 不触发AI回复, 避免AI的mvu_update覆盖商品库)
        var msg = result.purchaseLog + '。';
        try {
            shopTriggerSlash('/send ' + msg).then(function() {
                if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
            }).catch(function(eSend) {
                try { console.warn('[主神终端] /send 记录失败(交易已生效):', eSend.message); } catch(e2){}
                if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
            });
        } catch(eSync) {
            try { console.warn('[主神终端] /send 异常(交易已生效):', eSync.message); } catch(e2){}
            if ($execBtn.length) { $execBtn.prop('disabled', false).text('授权执行交易'); }
        }
    }
    /* ===== 32d. 商城: 刷新商品(调正文AI generateRaw, 按新ZOD结构生成商品库) =====
       - 二次校验 战斗中/不在主神空间(按钮已禁用, 此处兜底)
       - 通过 generateRaw 调用正文AI, 让其按新结构(YAML式)输出4个商品列表
       - 解析返回文本 → 写入 stat_data.商城(经ZOD校验归一化) + 重置本地缓存 + renderAll
       - 刷新中用模块级 shopRefreshing 标志驱动渲染: 置 true 后 renderAll 即隐藏原列表、
         改显示"正在请求…可关闭或等待"提示且按钮/输入框置灰; 切聊天/关再开面板均不丢失
         (标志为模块级, 不随 renderAll 重建而清零)
       - AI 成功 → 清缓存重渲染 + toast"商品列表已刷新, 共N件"; 失败/解析空 → toast +
         保留 shopMarketData 使原列表恢复显示; 两路径均置 shopRefreshing=false 解除锁定 */
    // 32d-1. 定位正文AI接口 generateRaw(跨作用域: 当前/父/TavernHelper)
    function shopGetAI() {
        var win = GS_PARENT || window;
        try {
            if (typeof win.generateRaw === 'function') return win.generateRaw;
        } catch (e) {}
        try {
            if (typeof generateRaw === 'function') return generateRaw;
        } catch (e2) {}
        try {
            if (win.TavernHelper && typeof win.TavernHelper.generateRaw === 'function') return win.TavernHelper.generateRaw;
        } catch (e3) {}
        return null;
    }
    // 32d-2. 统一封装AI调用(返回Promise, 兼容同步/异步)
    function shopCallAI(systemPrompt, userMsg) {
        return new Promise(function (resolve, reject) {
            var fn = shopGetAI();
            if (!fn) { reject(new Error('未找到正文AI接口 generateRaw')); return; }
            try {
                var p = fn({
                    ordered_prompts: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: userMsg }
                    ]
                });
                Promise.resolve(p).then(function (r) { resolve(r); }).catch(function (e) { reject(e); });
            } catch (e) { reject(e); }
        });
    }
    // 32d-3. 解析AI返回的YAML式文本 → { 血统列表:[], 技能列表:[], 装备列表:[], 道具列表:[] }
    //   容错: 兼容 ```yaml / ``` 代码围栏; 字段名大小写不敏感; 行内 {a:1,b:2} 与 ['a','b'] 内联语法
    //   严格匹配ZOD新结构: 血统(原始属性/效果) 技能(类型0-2) 装备(类型0-8) 道具(类型str/数量)
    function shopParseMarketText(text) {
        var result = { 血统列表: [], 技能列表: [], 装备列表: [], 道具列表: [], 升级列表: [] };
        if (!text || typeof text !== 'string') return result;
        // 剥离代码围栏
        var cleaned = text.replace(/```(?:ya?ml|json)?/gi, '').replace(/```/g, '');
        var lines = cleaned.split('\n');
        // 内联对象/数组解析: {a:1, b:2} → {a:1,b:2}; ['a','b'] → ['a','b']
        function parseInline(raw) {
            if (raw == null) return null;
            var s = String(raw).trim();
            if (!s) return null;
            // 行内 {...}
            if (/^\{.*\}$/.test(s)) {
                try { return JSON.parse(s.replace(/'/g, '"')); } catch (e) {}
                // 手动拆分 键:值 对
                var obj = {};
                var inner = s.slice(1, -1);
                var parts = inner.split(',');
                for (var i = 0; i < parts.length; i++) {
                    var kv = parts[i].split(':');
                    if (kv.length >= 2) {
                        var k = kv[0].trim().replace(/['"]/g, '');
                        var v = parts[i].slice(kv[0].length + 1).trim().replace(/['"]/g, '');
                        if (k) obj[k] = v;
                    }
                }
                return Object.keys(obj).length ? obj : null;
            }
            // 行内 [...]
            if (/^\[.*\]$/.test(s)) {
                try { return JSON.parse(s.replace(/'/g, '"')); } catch (e2) {}
                var innerA = s.slice(1, -1);
                var arr = innerA.split(',').map(function(x) { return x.trim().replace(/['"]/g, ''); }).filter(Boolean);
                return arr.length ? arr : null;
            }
            return null;
        }
        function num(v, def) { var n = parseFloat(v); return isFinite(n) ? n : (def || 0); }
        function str(v) {
            var s = (v == null) ? '' : String(v).trim();
            // 剥离 YAML 字符串外层配对引号(双引号或单引号), 如 "材料" → 材料
            if (s.length >= 2 && (s.charAt(0) === '"' || s.charAt(0) === "'") && s.charAt(s.length - 1) === s.charAt(0)) {
                s = s.slice(1, -1);
            }
            return s;
        }
        function tags(v) {
            var p = parseInline(v);
            if (Array.isArray(p)) return p.map(function(x) { return String(x); });
            if (typeof v === 'string' && v.trim()) return v.split(/[,，、]/).map(function(x){return x.trim();}).filter(Boolean);
            return [];
        }
        function objMap(v) {
            var p = parseInline(v);
            return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
        }
        // 值为数字的对象(用于 原始属性: {力量:3,...} 需数值化)
        function numMap(v) {
            var p = parseInline(v);
            if (!p || typeof p !== 'object' || Array.isArray(p)) return {};
            var out = {};
            for (var key in p) {
                if (!Object.prototype.hasOwnProperty.call(p, key)) continue;
                var n = parseFloat(p[key]);
                out[key] = isFinite(n) ? n : 0;
            }
            return out;
        }
        // 缩进式YAML解析: 按列表头(血统列表/技能列表/...)分段, 每段内 - 项为新条目, 同级缩进键为字段
        var listKeys = ['血统列表', '技能列表', '装备列表', '道具列表', '升级列表'];
        var curList = null;     // 当前所在列表名(result的key)
        var curItem = null;     // 当前正在填充的条目对象
        var itemIndent = -1;    // 当前条目的 - 行缩进
        function flushItem() {
            if (curItem && curList && Array.isArray(result[curList])) {
                if (curItem.名称) result[curList].push(curItem);
            }
            curItem = null;
            itemIndent = -1;
        }
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            // 跳过空行与注释
            if (!line.trim() || /^\s*#/.test(line)) continue;
            // 顶层列表头(无缩进或极小缩进的 "xxx列表:")
            var headM = line.match(/^\s{0,2}(血统列表|技能列表|装备列表|道具列表|升级列表)\s*:\s*$/);
            if (headM) {
                flushItem();
                curList = headM[1];
                continue;
            }
            // 列表项起始: 行内含 "  - " 前缀
            var itemM = line.match(/^(\s*)-\s+(.*)$/);
            if (itemM && curList) {
                flushItem();
                curItem = {};
                itemIndent = itemM[1].length;
                // 行内可能带 名称: xxx
                var rest = itemM[2];
                var inlineKV = rest.match(/^([^\s:]+)\s*:\s*(.*)$/);
                if (inlineKV) {
                    var _pv = parseInline(inlineKV[2]);
                    curItem[inlineKV[1]] = _pv !== null ? _pv : str(inlineKV[2]);
                }
                continue;
            }
            // 字段行: 缩进大于列表头, 形如 "  字段: 值"
            var fieldM = line.match(/^(\s+)([^\s:]+)\s*:\s*(.*)$/);
            if (fieldM && curItem && curList) {
                var k = fieldM[2];
                var v = fieldM[3];
                var fieldIndent = fieldM[1].length;
                // 多行对象字段: 效果/原始属性 值为空时, 向下收集更深层缩进的 key:value 对
                // (AI 常将嵌套对象展开为多行 YAML 而非行内 {k:v}, 需前瞻收集)
                if (!v.trim() && (k === '效果' || k === '原始属性')) {
                    var subObj = {};
                    var j2 = i + 1;
                    for (; j2 < lines.length; j2++) {
                        var subLine = lines[j2];
                        if (!subLine.trim() || /^\s*#/.test(subLine)) continue;
                        if (/^\s*-\s+/.test(subLine)) break;
                        var subM = subLine.match(/^(\s+)([^\s:]+)\s*:\s*(.*)$/);
                        if (!subM || subM[1].length <= fieldIndent) break;
                        if (subM[2]) subObj[subM[2]] = str(subM[3]);
                    }
                    if (k === '原始属性') {
                        var numObj = {};
                        for (var nk in subObj) { if (subObj.hasOwnProperty(nk)) { var nn = parseFloat(subObj[nk]); numObj[nk] = isFinite(nn) ? nn : 0; } }
                        curItem[k] = numObj;
                    } else {
                        curItem[k] = subObj;
                    }
                    i = j2 - 1;
                    continue;
                }
                // 数值字段
                if (k === '价格' || k === '数量') {
                    curItem[k] = num(v, k === '数量' ? 1 : 0);
                } else if (k === '类型') {
                    // 技能(0-2)/装备(0-8)为数字, 道具为字符串
                    var tn = parseInt(v, 10);
                    if (curList === '技能列表' || curList === '装备列表') {
                        curItem[k] = isFinite(tn) ? tn : 0;
                    } else {
                        curItem[k] = str(v);
                    }
                } else if (k === '原始属性') {
                    curItem[k] = numMap(v);
                } else if (k === '效果') {
                    curItem[k] = objMap(v);
                } else if (k === '标签') {
                    curItem[k] = tags(v);
                } else if (k === '品质' || k === '消耗' || k === '描述' || k === '名称') {
                    curItem[k] = str(v);
                } else {
                    // 未知字段原样保留
                    curItem[k] = parseInline(v) !== null ? parseInline(v) : str(v);
                }
                continue;
            }
        }
        flushItem();
        return result;
    }
    // 32d-4. 构造玩家上下文摘要(供AI参考玩家构筑与层级)
    function shopBuildPlayerContext(sd) {
        var p = sd.主角 || {};
        var parts = [];
        if (p.种族) parts.push('种族: ' + p.种族);
        if (Array.isArray(p.身份) && p.身份.length) parts.push('身份: ' + p.身份.join('/'));
        if (Array.isArray(p.职业) && p.职业.length) parts.push('职业: ' + p.职业.join('/'));
        if (p.层级) parts.push('层级: ' + p.层级);
        if (p.空间币 != null) parts.push('空间币: ' + p.空间币);

        // ★ 核心辅助函数：提取物品的所有关键信息，拼接成紧凑的单行文本，既全面又省 Token
        function formatDict(dict) {
            var keys = Object.keys(dict || {});
            if (keys.length === 0) return '无';
            
            return keys.map(function(k) {
                var v = dict[k] || {};
                var info = [];
                
                if (v.品质) info.push(v.品质 + '级');
                if (v.数量 != null) info.push('数量:' + v.数量);
                if (v.消耗) info.push('消耗:' + v.消耗);
                // 属性和效果是对象，用 JSON.stringify 拍平显示
                if (v.原始属性 && Object.keys(v.原始属性).length > 0) info.push('属性:' + JSON.stringify(v.原始属性));
                if (v.效果 && Object.keys(v.效果).length > 0) info.push('效果:' + JSON.stringify(v.效果));
                if (v.描述) info.push('描述:' + v.描述);
                
                // 输出格式例: "  - 御剑术 [F级 | 消耗:8MP | 效果:{"主动":"..."} | 描述:...]"
                return '  - ' + k + ' [' + info.join(' | ') + ']';
            }).join('\n');
        }

        // 已有装备/技能/血统名称(帮助AI避免重复+贴合构筑)
        var blData = p.血统 || {};
        if (Object.keys(blData).length) parts.push('已有血统:\n' + formatDict(blData));
        
        var skData = p.技能 || {};
        if (Object.keys(skData).length) parts.push('已有技能:\n' + formatDict(skData));
        
        var eqData = p.装备 || {};
        if (Object.keys(eqData).length) parts.push('已有装备:\n' + formatDict(eqData));
        
        var invData = p.背包 || {};
        if (Object.keys(invData).length) parts.push('已有物品:\n' + formatDict(invData));

        var statusData = p.状态 || {};
        if (Object.keys(statusData).length) parts.push('已有状态:\n' + formatDict(statusData));
        
        // 世界/任务上下文
        var w = sd.世界 || {};
        if (w.当前世界) parts.push('当前世界: ' + w.当前世界);
        
        return parts.join('\n');
    }
    // 32d-4-1. 获取世界书内容
    async function getWorldBookContent(searchTitle) {
        var win = GS_PARENT; 

        if (!win.EjsTemplate || typeof win.EjsTemplate.evalTemplate !== 'function') {
            console.error('[主神终端] 致命错误：未找到 EjsTemplate.evalTemplate 扩展接口！');
            return null;
        }
        
        try {
            // 4. 因为上面的 ceshiBUG 加了 async，这里的 await 才完全合法
            var env = await win.EjsTemplate.prepareContext({ targetTitle: searchTitle });
            var code = '<%- await getwi(targetTitle) %>';
            var content = await win.EjsTemplate.evalTemplate(code, env);
            
            if (content && content.trim() !== '') {
                return content + '\n';
            }
            return null;
        } catch (error) {
            console.error('[主神终端] 世界书读取异常:', searchTitle, error);
            return null;
        }
    }
    // 32d-5. 主入口: 刷新商品
    function handleShopRefresh(reqText, worldBookContent) {
        var sd = getStatData();
        if (!sd) { samToast('error', '数据未就绪'); return; }
        var sys = sd.系统状态 || {};
        if (sys.是否战斗中 === true) { samToast('warning', '战斗中无法交易, 请在安全区域后再试'); return; }
        if (sys.是否在主神空间 !== true) { samToast('warning', '需返回主神空间后才能开启商城交易'); return; }
        // 检查AI接口
        if (!shopGetAI()) { samToast('error', '未检测到正文AI接口 generateRaw'); return; }
        // 防重入: 已在刷新中则忽略
        if (shopRefreshing) return;
        // 进入刷新中状态(模块级标志, 切换界面/重渲染仍保持禁用); 立即重渲染以隐藏列表+显示提示
        shopRefreshing = true;
        renderAll();
        // —— 判断是否为精准搜索 ——
        var hasReq = (reqText && reqText.trim() !== '');
        // —— 系统提示词: 主神兑换终端设定 + 新结构说明 ——
        var sysPrompt = ''
            + '你是「主神兑换终端」的商品生成子系统。玩家在主神空间开启商城, 需要你生成一批可购买商品。\n'
            + '世界观: 轮回战场, 玩家穿越各副本世界完成任务, 在主神空间用「空间币」兑换装备/技能/血统/道具。\n'
            + '【系统设定】\n'
            + worldBookContent + '\n'
            + '【生成约束】\n'
            + '1. 贴合度: 根据玩家当前的构筑（偏向物理/近战/生存）、层级和购买力生成。\n'
            + '2. 品质控制:\n'
            + '   - 生成的商品应以 玩家当前层级级和 +1级为主，最多允许出现 1~2 个 +2级作为诱惑。绝对禁止生成 +3级及以上商品。\n'
            + '   - 避免与玩家已有物品功能完全重复。\n'
            + '3. 升级重铸机制: 仔细检阅【当前玩家数据】，挑选玩家现有的低阶血统、技能或装备，生成高阶强化版本放入「升级列表」。必须直接生成升级后的完整成品面板，绝对禁止采用词条增量打补丁！必须提供精准的 `替换目标`，以便系统进行回收替换。同一目标可提供多个选项。\n'
            + (hasReq
                ? '4. 核心聚焦: 玩家提出了明确的【核心需求】。商品生成必须以此为绝对中心。允许某些分类为空（不生成）。若生成其他类型的商品，必须与核心需求构成【流派联动】（例如需求是"狙击枪"，则配套生成"隐身技能"、"穿甲弹药道具"等）。总数控制在 16~24 个。\n'
                : '4. 均衡刷新: 一次生成约 18~28 个商品，血统/技能/装备/道具 各 4~6 项，升级列表 2~4 项。\n')
            + '5. 商品职责隔离:\n'
            + '   - 【血统列表】: 仅生成玩家未拥有的独立血统体系。若属于玩家已有血统的同源强化、进化、觉醒版本，必须进入升级列表。\n'
            + '   - 【升级列表】: 仅处理玩家当前已有血统、技能、装备的强化、升阶、重铸或觉醒。必须填写准确替换目标。\n'
            + '   - 同一目标禁止同时作为普通商品与升级商品出现。\n'
            + '6. 修炼类道具规则:\n'
            + '   - 【道具列表】允许生成秘籍、功法、心法、修炼资料等成长型道具。\n'
            + '   - 修炼类道具属于学习媒介，不直接生成技能或被动效果；购买后需通过修炼过程生成对应成长型状态。\n'
            + '   - 若商品描述为功法、修真秘籍、内功心法、魔法研究资料、身体强化方案等，应优先作为【道具】生成，而非【技能】。\n'
            + '   - 技能列表仅用于角色已经掌握、可直接使用的能力，不用于记录学习材料或成长路径。\n'
            + '   - 技能列表禁止生成需要长期学习、修炼积累或改变生命结构才能获得的体系能力。\n'
            + '   - 品质参考:\n'
            + '      * 普通武学、基础训练类秘籍: F-E级\n'
            + '      * 高深武学、内功心法、特殊技艺传承: D-C级\n'
            + '      * 修炼体系、生命进化、长期身体改造类秘籍: 通常不低于D级，依据实际成长潜力评估\n'
            + '   - 禁止将长期修炼体系压缩为单个技能出售，例如禁止把“修真功法”“血脉觉醒法”“内功心法”直接生成技能。\n'
            + '【严格输出格式】\n'
            + '仅输出 YAML 文本, 不要解释、不要 markdown 代码围栏。顶层为五个列表键: 血统列表 / 技能列表 / 装备列表 / 道具列表 / 升级列表, 每项以 "  - " 开头。\n'
            + '字段类型必须严格遵守:\n'
            + '  - 品质: 字符串, 仅可选 F / E / D / C / B / A / S / SS / SSS\n'
            + '  - 标签: 行内数组 [\'标签1\', \'标签2\'...]\n'
            + '  - 原始属性: 行内对象, 血统必须完整包含六项（力量、敏捷、体质、精神、感知、魅力），每项最低值为1；装备仅写非0项\n'
            + '  - 效果: 行内对象 {效果名: \'描述\'}, 键为字符串, 值为字符串描述\n'
            + '  - 价格: 数字(空间币)\n'
            + '  - 描述/消耗: 字符串\n'
            + '  - 类型:\n'
            + '      技能列表.类型 = 数字 0(主动) / 1(被动) / 2(特殊)\n'
            + '      装备列表.类型 = 数字 0(武器) / 1(手套) / 2(头部) / 3(胸部) / 4(腿部) / 5(鞋子) / 6(披风) / 7(饰品) / 8(特殊)\n'
            + '      道具列表.类型 = 字符串(消耗品/材料/特殊等, 同类型需复用且不得细分)\n'
            + '  - 替换目标: 字符串 (仅【升级列表】内商品必填，必须与玩家当前拥有的原物品名称一字不差！)\n'
            + '  - 所属大类: 字符串 (仅【升级列表】内商品必填，仅限填写: 血统 / 技能 / 装备)\n'
            + '  - 道具列表.数量 = 数字(该商品可购入的库存份数, ≥1)\n'
            + '对象键禁止使用英文句点，口径类X.Ymm统一写作X·Y（例：5.56mm弹药→5·56弹药）;\n'

        // —— 用户提示词: 玩家上下文 + 需求 + 输出模板示例 ——
        var playerCtx = shopBuildPlayerContext(sd);
        var userPrompt = '\n【当前玩家数据】\n' + (playerCtx || '(无)') + '\n';
        userPrompt += '\n【输出结构】\n'
            + '血统列表:\n'
            + '  - 名称: 血统名\n'
            + '    品质: E\n'
            + '    标签: ["[主神空间]", "强化"]\n'
            + '    原始属性: {"力量": 8, "敏捷": 8, "体质": 10, "精神": 6, "感知": 8, "魅力": 5}\n'
            + '    效果: {体能充沛: 基础生命恢复速度小幅提升}\n'
            + '    描述: 简短描述\n'
            + '    价格: 450\n'
            + '技能列表:\n'
            + '  - 名称: 技能名\n'
            + '    品质: F\n'
            + '    类型: 0\n'
            + '    标签: ["[主神空间]", "被动"]\n'
            + '    效果: {射击校准: 射击检定+5}\n'
            + '    描述: 简短描述\n'
            + '    消耗: 无\n'
            + '    价格: 80\n'
            + '装备列表:\n'
            + '  - 名称: 装备名\n'
            + '    品质: F\n'
            + '    类型: 0\n'
            + '    标签: ["[主神空间]", "科技"]\n'
            + '    原始属性: {"DEF": 2}\n'
            + '    效果: {防弹: 对实弹伤害额外减免2点}\n'
            + '    描述: 简短描述\n'
            + '    消耗: 无\n'
            + '    价格: 50\n'
            + '道具列表:\n'
            + '  - 名称: 道具名\n'
            + '    品质: F\n'
            + '    类型: 消耗品\n'
            + '    数量: 3\n'
            + '    标签: ["[主神空间]", "辅助"]\n'
            + '    效果: {急救: 恢复10HP}\n'
            + '    描述: 简短描述\n'
            + '    价格: 50\n'
            + '升级列表:\n'
            + '  - 名称: 进阶装备/技能/血统名称 (例: M16A2突击步枪·改)\n'
            + '    替换目标: 原有物品确切名称 (例: M16A2突击步枪)\n'
            + '    所属大类: 装备 (必填: 血统/技能/装备)\n'
            + '    品质: E\n'
            + '    类型: 0\n'
            + '    标签: ["[主神空间]", "科技", "升级"]\n'
            + '    原始属性: {"DEF": 4}\n'
            + '    效果: {防弹: 强化减伤效果至4点}\n'
            + '    描述: 回收旧型号进行重铸升阶后的成品\n'
            + '    消耗: 无\n'
            + '    价格: 300\n'
// 🌟 核心优化：动态结尾指令
if (hasReq) {
    userPrompt += '\n【本次核心商品需求】\n  ' + reqText + '\n';
    userPrompt += '\n现在请基于上述核心需求进行精准检索与配套生成（允许部分列表为空），仅输出 YAML:\n';
} else {
    userPrompt += '\n现在请执行商城日常刷新，仔细检阅玩家数据生成升级方案。仅输出 YAML:\n';
}
            // console.log('系统提示词:', sysPrompt, '\n用户提示词:', userPrompt);
        shopCallAI(sysPrompt, userPrompt).then(function (out) {
            var parsed = shopParseMarketText(out);
            // 统计生成数量
            var total = (parsed.血统列表.length + parsed.技能列表.length + parsed.装备列表.length + parsed.道具列表.length + parsed.升级列表.length);
            if (total === 0) {
                // 解析失败: 退出刷新中态, 恢复原列表显示, 弹提示
                shopRefreshing = false;
                renderAll();
                samToast('error', 'AI返回内容无法解析为商品, 已恢复原商品列表');
                return;
            }
            // 写回 stat_data.商城(经 shopNormalizeMarketData 归一化前, 先写入原始结构; ZOD会校验)
            var ok = writeBackMvu(function (statData) {
                statData.商城 = {
                    血统列表: parsed.血统列表,
                    技能列表: parsed.技能列表,
                    装备列表: parsed.装备列表,
                    道具列表: parsed.道具列表,
                    升级列表: parsed.升级列表
                };
            });
            // 退出刷新中态
            shopRefreshing = false;
            if (ok) {
                shopMarketData = null;   // 触发 renderAll 时从 stat_data 重新归一化
                shopCart = [];
                shopActiveTab = '';
                shopActiveSlot = '';
                renderAll();
                samToast('success', '商品列表已刷新, 共生成 ' + total + ' 件商品');
            } else {
                renderAll();
                samToast('error', '商品已生成但MVU写回失败, 已恢复原商品列表');
            }
        }).catch(function (e) {
            // 失败: 退出刷新中态, 恢复原商品列表显示, 弹提示
            shopRefreshing = false;
            renderAll();
            samToast('error', 'AI生成失败, 已恢复原商品列表: ' + (e && e.message ? e.message : e));
        });
    }
    /* 统一处理装备/道具操作 */
    function handleItemAction(action, path, kind, typeStr, key) {
        if (!action || !path) return;
        var type = Number(typeStr);
        var sd = getStatData();
        if (!sd || !sd.主角) { samToast('error', '数据未就绪'); return; }
        var isEquip = (kind === 'equip');
        var dict = isEquip ? (sd.主角.装备 || {}) : (sd.主角.背包 || {});
        var basePath = isEquip ? '主角.装备' : '主角.背包';
        // 删除: 直接从字典移除
        if (action === 'delete') {
            var ok = writeBackMvu(function(statData) {
                var d = isEquip ? (statData.主角.装备||{}) : (statData.主角.背包||{});
                if (d[key] !== undefined) delete d[key];
            });
            if (ok) { samToast('success', (isEquip?'装备':'道具')+'已删除: '+key); renderAll(); }
            else samToast('error', '删除失败: MVU写回不可用');
            return;
        }
        // 目标状态映射
        var targetStatus;
        if (action === 'wear') targetStatus = 1;
        else if (action === 'remove') targetStatus = 0;
        else if (action === 'store') targetStatus = 2;
        else if (action === 'takeback') targetStatus = 0;
        else { samToast('error', '未知操作: '+action); return; }
        // 穿戴前的限制校验 (上限配置来自模块级常量 EQUIP_SLOTS / ITEM_SLOT_CAP)
        if (action === 'wear') {
            if (isEquip) {
                // 查 EQUIP_SLOTS 取该类型 cap: cap>=2 满则拒绝; cap===1 替换同类型已装备; cap===0 无限制
                var slotCfg = null;
                for (var si = 0; si < EQUIP_SLOTS.length; si++) { if (EQUIP_SLOTS[si].type === type) { slotCfg = EQUIP_SLOTS[si]; break; } }
                var cap = slotCfg ? slotCfg.cap : 0;
                var slotLabel = slotCfg ? slotCfg.label : '装备';
                if (cap >= 2) {
                    // 多槽位类型(武器2/饰品2): 满则拒绝
                    var wCount = 0;
                    Object.keys(dict).forEach(function(k){ if (Number(dict[k].类型)===type && Number(dict[k].状态)===1) wCount++; });
                    if (wCount >= cap) { samToast('warning', '身上'+slotLabel+'已满('+cap+'件), 先脱下现有'+slotLabel+'后再尝试'); return; }
                } else if (cap === 1) {
                    // 单槽位类型(手套/头部/.../披风): 替换同类型已装备
                    var replaced = [];
                    Object.keys(dict).forEach(function(k){
                        if (k !== key && Number(dict[k].类型) === type && Number(dict[k].状态) === 1) replaced.push(k);
                    });
                    if (replaced.length > 0) {
                        var okR = writeBackMvu(function(statData) {
                            var d = statData.主角.装备 || {};
                            replaced.forEach(function(k){ if (d[k]) d[k].状态 = 0; });
                            if (d[key]) d[key].状态 = 1;
                        });
                        if (okR) { samToast('success', '已穿戴: '+key+(replaced.length?' (替换:'+replaced.join(',')+')':'')); renderAll(); }
                        else samToast('error', '穿戴失败: MVU写回不可用');
                        return;
                    }
                }
                // cap === 0 (特殊): 无限制, 直接走通用穿戴流程
            } else {
                // 道具战术栏限 ITEM_SLOT_CAP 个
                var iCount = 0;
                Object.keys(dict).forEach(function(k){ if (Number(dict[k].状态)===1) iCount++; });
                if (iCount >= ITEM_SLOT_CAP) { samToast('warning', '身上负重已满('+ITEM_SLOT_CAP+'个道具), 先卸载现有道具后再尝试'); return; }
            }
        }
        // 通用: 设目标状态
        var ok2 = writeBackMvu(function(statData) {
            var d = isEquip ? (statData.主角.装备||{}) : (statData.主角.背包||{});
            if (d[key]) d[key].状态 = targetStatus;
        });
        if (ok2) {
            var actLabel = {wear:'穿戴',remove:'脱下',store:'存放',takeback:'取回'}[action];
            samToast('success', actLabel+'成功: '+key);
            renderAll();
        } else {
            samToast('error', '操作失败: MVU写回不可用');
        }
    }

    /* ===== 32d. 形态激活(写回MVU) ===== */
    function handleFormActivate(formName) {
        if (!formName) return;
        var sd = getStatData();
        if (!sd || !sd.主角) { samToast('error', '数据未就绪'); return; }
        var p = sd.主角;
        var cf = p.当前形态 || {};
        // 已激活的形态(当前生效)不可重复激活
        if (cf.激活 === true && safeStr(cf.名称) === formName) {
            samToast('warning', '该形态已激活: ' + formName);
            return;
        }
        // 冷却未归零不可激活(只有归零才能重新激活)
        var forms = p.形态库 || {};
        var f = forms[formName] || {};
        var cdM = safeStr(f.冷却).match(/^(\d+)\s*\/\s*(\d+)/);
        var cdCur = cdM ? (parseInt(cdM[1], 10) || 0) : 0;
        if (cdCur > 0) {
            samToast('warning', '冷却中, 无法激活: ' + formName + ' (剩余' + cdCur + '回合)');
            return;
        }
        // 写回: 设当前形态 + 该形态冷却3回合(不清理其他形态冷却)
        var ok = writeBackMvu(function(statData) {
            var pp = statData.主角;
            if (!pp) return;
            // 设当前形态
            pp.当前形态 = { 激活: true, 名称: formName };
            // 该形态冷却置为 3/3 回合(不触碰其他形态的冷却)
            var ff = pp.形态库 || {};
            if (ff[formName]) {
                ff[formName].冷却 = '3/3 回合';
            }
        });
        if (ok) {
            samToast('success', '形态已激活: ' + formName + ' (冷却3回合)');
            renderAll();
        } else {
            samToast('error', '激活失败: MVU写回不可用');
        }
    }

    /* ===== 32e. 形态取消激活(写回MVU) ===== */
    function handleFormDeactivate(formName) {
        if (!formName) return;
        var sd = getStatData();
        if (!sd || !sd.主角) { samToast('error', '数据未就绪'); return; }
        var p = sd.主角;
        var cf = p.当前形态 || {};
        // 只有当前激活的就是这个形态才能取消
        if (!(cf.激活 === true && safeStr(cf.名称) === formName)) {
            samToast('warning', '该形态未激活, 无需取消: ' + formName);
            return;
        }
        // 写回: 当前形态设为未激活 + 清空名称(冷却不动, 按原倒数继续走)
        var ok = writeBackMvu(function(statData) {
            var pp = statData.主角;
            if (!pp) return;
            pp.当前形态 = { 激活: false, 名称: '' };
        });
        if (ok) {
            samToast('success', '已取消形态: ' + formName);
            renderAll();
        } else {
            samToast('error', '取消失败: MVU写回不可用');
        }
    }

    /* ===== 32f. R21-传闻交易: 通用确认弹窗(替代原生 confirm) =====
       samConfirm(title, body, onOk) → 渲染模态框, onOk 在用户点确认时同步调用
    */
    function samConfirm(title, body, onOk) {
        // 复用 #samsara-modal 遮罩层(z-index:1000000, 已带 blur 背景, 高于面板999998)
        // 这样确认框不会被主界面/面板挡住
        var $m = $('#samsara-modal');
        if (!$m.length) { $('body').append('<div id="samsara-modal"></div>'); }
        $m = $('#samsara-modal');
        var box = '<div class="sam-confirm-box">'
            + '<div class="sam-confirm-title">'+esc(title)+'</div>'
            + '<div class="sam-confirm-body">'+esc(body)+'</div>'
            + '<div class="sam-confirm-actions">'
            + '<button type="button" class="sam-confirm-btn cancel">取消</button>'
            + '<button type="button" class="sam-confirm-btn ok">确认</button>'
            + '</div></div>';
        $m.html(box).addClass('open');
        // 按钮点击: 取消/确认 → 关闭弹窗; 确认则回调 onOk
        $m.off('click.samConfirm').on('click.samConfirm', '.sam-confirm-btn', function(e) {
            e.stopPropagation();
            var isOk = $(this).hasClass('ok');
            $m.removeClass('open').empty();
            if (isOk && typeof onOk === 'function') {
                try { onOk(); } catch(err) { console.error('[主神终端] samConfirm onOk error:', err); }
            }
        });
        // 点遮罩(弹窗外部)取消
        $m.off('click.samConfirmBg').on('click.samConfirmBg', function(e) {
            if (e.target === this) { $m.removeClass('open').empty(); }
        });
    }

    /* ===== 32g. R21-传闻交易: 发送文字到 SillyTavern 输入框 =====
       sendToInputBox(text, autoSend):
         - autoSend=true: 填入并点击发送按钮
         - autoSend=false: 仅追加到输入框(不自动发送), 若已存在则不重复追加
       返回 true=成功, false=未找到输入框
       参考 创世状态栏.txt sendToChat/sendMessageToChat
    */
    function sendToInputBox(text, autoSend) {
        try {
            var win = GS_PARENT || window;
            var $jq = (win.jQuery || window.jQuery || $);
            if (!$jq) return false;
            var $ta = $jq(win.document || document).find('#send_textarea');
            if (!$ta.length) return false;
            if (autoSend) {
                // 自动发送模式: 覆盖输入框 + 触发 input + 点击发送按钮
                var textarea = $ta[0];
                textarea.value = String(text || '');
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                var sendBtn = (win.document || document).getElementById('send_but');
                if (sendBtn) sendBtn.click();
                return true;
            }
            // 追加模式: 不覆盖已有内容, 若已包含相同文本则跳过
            var cur = $ta.val() || '';
            if (cur.indexOf(text) !== -1) return true;
            $ta.val((cur.trim() ? cur + ' ' : '') + text);
            $ta.trigger('input');
            return true;
        } catch (err) {
            console.error('[主神终端] sendToInputBox 失败:', err);
            return false;
        }
    }

    /* ===== 32h. R21-传闻交易: 删除单条传闻(写回MVU) =====
       sectionKey: '街头巷议' | '情报交易' | '布告与檄文'
       name: 传闻的 key(名字)
    */
    function handleRumorDelete(sectionKey, name) {
        if (!sectionKey || !name) return;
        var ok = writeBackMvu(function(statData) {
            if (!statData || !statData.传闻 || !statData.传闻[sectionKey]) return;
            if (statData.传闻[sectionKey][name]) {
                delete statData.传闻[sectionKey][name];
                try { console.log('%c[主神终端] ✅ 传闻已删除: '+sectionKey+'/'+name, 'color:#86efac'); } catch(e){}
            }
        });
        if (ok) { samToast('success', '已删除传闻: ' + name); renderAll(); }
        else samToast('error', '删除失败: MVU写回不可用');
    }

    /* ===== 32i. R21-传闻交易: 清空指定分类的全部传闻(写回MVU) ===== */
    function handleRumorClearSection(sectionKey) {
        if (!sectionKey) return;
        var ok = writeBackMvu(function(statData) {
            if (!statData || !statData.传闻) return;
            statData.传闻[sectionKey] = {};
            try { console.log('%c[主神终端] ✅ 已清空传闻分类: '+sectionKey, 'color:#86efac'); } catch(e){}
        });
        if (ok) { samToast('success', '已清空分类: ' + sectionKey); renderAll(); }
        else samToast('error', '清空失败: MVU写回不可用');
    }

    /* ===== 32j. R21-传闻交易: 删除全部传闻(街头巷议+情报交易+布告与檄文) ===== */
    function handleRumorClearAll() {
        var ok = writeBackMvu(function(statData) {
            if (!statData || !statData.传闻) return;
            statData.传闻 = { 街头巷议: {}, 情报交易: {}, 布告与檄文: {} };
            try { console.log('%c[主神终端] ✅ 已删除全部传闻', 'color:#86efac'); } catch(e){}
        });
        if (ok) { samToast('success', '已删除全部传闻'); renderAll(); }
        else samToast('error', '删除失败: MVU写回不可用');
    }

    /* ===== 33. 保存编辑(写回MVU) ===== */
    function saveEdits() {
        var $panel = $('#samsara-panel');
        var changes = [];
        // 先把仍在编辑态(没失焦)的输入框暂存进pendingEdits
        $panel.find('.sam-edit-active').each(function() { flushStagedDisplay($(this)); });
        // 从pendingEdits收集变更(点击即编辑的暂存区)
        Object.keys(pendingEdits).forEach(function(path) {
            if (isReadonlyPath(path)) return;
            changes.push({ path: path, val: pendingEdits[path].val });
        });
        // toggle 字段(开关也写进pendingEdits了, 兜底再扫一次)
        $panel.find('.sam-toggle-switch[data-toggle="field"]').each(function() {
            var $el = $(this);
            var path = $el.data('path');
            if (!path) return;
            if (isReadonlyPath(path)) return;
            if (pendingEdits[path]) return; // 已暂存则跳过
            changes.push({path: path, val: $el.hasClass('on')});
        });
        if (changes.length === 0) {
            try { console.log('%c[主神终端] 无变更', 'color:#8b95a6'); } catch(e){}
            pendingEdits = {};
            setEditMode(false);
            closeModal();
            renderAll();
            return;
        }
        var ok = writeBackMvu(function(statData) {
            changes.forEach(function(c) {
                try {
                    if (_ && _.set) _.set(statData, c.path, c.val);
                    else setByPathFallback(statData, c.path, c.val);
                } catch(e) { console.warn('[主神终端] 写入路径失败:', c.path, e); }
            });
        });
        if (ok) {
            pendingEdits = {};
            // 退出编辑模式
            setEditMode(false);
            closeModal();
            setTimeout(renderAll, 300);
        } else {
            showModal('保存失败', '<div class="sam-empty">MVU写回API不可用,请检查环境</div>');
        }
    }
    function setByPathFallback(obj, path, value) {
        var keys = path.split('.');
        var cur = obj;
        for (var i = 0; i < keys.length - 1; i++) {
            if (cur[keys[i]] === undefined) cur[keys[i]] = {};
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    /* ===== 34. 启动器 ===== */
    function init() {
        initSamsaraCSS();
        initSamsaraDOM();
        renderAll();
        try {
            if (localStorage.getItem(SAM_CONFIG.open) === '1') {
                var $panel = $('#samsara-panel');
                var $ball = $('#samsara-ball');
                if (!isMobile()) {
                    var r = $ball[0].getBoundingClientRect();
                    var vw = GS_PARENT.innerWidth, vh = GS_PARENT.innerHeight;
                    var pw = $panel.outerWidth() || 720;
                    var nl = Math.max(20, Math.min(vw - pw - 20, r.left > vw/2 ? r.left - pw - 20 : r.left + 60));
                    var nt = Math.max(20, Math.min(vh - 700, r.top));
                    $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
                } else {
                    $panel.css({left:'', top:'', right:'', bottom:'', margin:''});
                }
                $panel.css('display','flex').addClass('open');
                $ball.hide();
            }
        } catch (e) {}

        var win = getMvuGlobal();
        // ★ 防抖刷新: 500ms 内多次事件只触发一次 renderAll
        //   - 留时间给"辅助计算脚本"重算属性(避免读到旧值)
        //   - 合并连续事件(删多层/连续swipe/多次变量更新)避免逐次重绘卡顿
        //   - renderAll 为纯读, 不写回 MVU, 故无死循环风险
        var _refreshTimer = null;
        var debouncedRefresh = function() {
            if (_refreshTimer) clearTimeout(_refreshTimer);
            _refreshTimer = setTimeout(function() {
                _refreshTimer = null;
                if ($('#samsara-panel').hasClass('open') && !isEditMode()) renderAll();
            }, 500);
        };
        try {
            // 1) MVU 变量更新结束 → 刷新(原 updateFunc, 改用防抖版)
            if (win && win.Mvu && win.Mvu.events) {
                $(document).off('VARIABLE_UPDATE_ENDED.sam');
                $(document).on('VARIABLE_UPDATE_ENDED.sam', debouncedRefresh);
                if (typeof eventOn === 'function') eventOn(win.Mvu.events.VARIABLE_UPDATE_ENDED, debouncedRefresh);
            }
            // 2) 酒馆原生事件: 删楼层/切swipe/切聊天 → MVU 快照回退或切换, 需刷新
            //    MVU 事件体系只覆盖"变量更新", 不覆盖"楼层变更", 故须补酒馆事件
            if (typeof tavern_events !== 'undefined') {
                if (tavern_events.MESSAGE_DELETED && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_DELETED, debouncedRefresh);
                if (tavern_events.MESSAGE_SWIPED  && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_SWIPED,  debouncedRefresh);
                if (tavern_events.CHAT_CHANGED    && typeof eventOn === 'function') eventOn(tavern_events.CHAT_CHANGED,    debouncedRefresh);
            }
        } catch (e) {}
        // DOM守护定时器: 球/面板被移除则重建
        window.samsaraGuardTimer = setInterval(function() {
            if (!document.getElementById('samsara-ball') || !document.getElementById('samsara-panel')) {
                initSamsaraDOM();
                renderAll();
            }
        }, 15000);
        try { (window.parent || window).__悬浮球状态栏_loaded__ = true; } catch(e) { window.__悬浮球状态栏_loaded__ = true; }
        // 注: 数据刷新定时器已移至 renderAll() 的"终端未响应"分支内按需启动, 收到数据后自动清除, 避免无谓刷新影响滚动与性能
        try { console.log('%c[主神终端] ✅ v2 初始化完成,监听因果链...', 'color:#86efac;font-weight:bold'); } catch(e){}
    }

    (function bootstrap() {
        if ($ && document.body) init();
        else setTimeout(bootstrap, 200);
    })();

    try { $(window).on('unload.sam', samPreClean); } catch (e) {}
})();
