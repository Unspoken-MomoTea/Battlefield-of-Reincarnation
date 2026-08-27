/* 
 * ========================================================================== */
(function () {
    'use strict';
    try { console.log('%c[诡事录命盘] 模块已加载', 'color:#c8a052;font-weight:bold'); } catch (e) {}

    /* ===== 1. 父窗口重定向（复刻 helper.js，保证注入酒馆主界面）===== */
    var GS_PARENT = (function () {
        try { if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) return window.parent; } catch (e) {}
        try { if (window.top && window.top !== window && window.top.document && window.top.document.body) return window.top; } catch (e) {}
        return window;
    })();
    var $ = (GS_PARENT.jQuery || GS_PARENT.$ || window.jQuery || window.$);
    var jQuery = $;
    var document = GS_PARENT.document;
    try { console.log('[诡事录命盘] 目标窗口:', GS_PARENT === window ? '自身(主文档)' : '父窗口(酒馆主界面)', '| jQuery:', !!$, '| body?', !!(document && document.body)); } catch (e) {}

    /* ===== 2. 预清理旧实例 ===== */
    (function guishiPreClean() {
        try {
            if (window.jQuery || $) {
                jQuery('#guishi-ball, #guishi-ball-panel, #guishi-ball-style, #guishi-portrait-viewer, #global-guishi-mvu-modal, #global-guishi-sub-modal').remove();
                jQuery(document).off('.guishiball');
                jQuery('body').off('.guishiball');
            }
        } catch (e) { console.warn('[诡事录命盘] 预清理失败:', e.message); }
    })();

    /* ===== 3. 配置 / 状态 ===== */
    window.GUISHI_BALL_CONFIG = {
        storageTheme: 'guishi_ball_theme_v1',
        storageTab: 'guishi_ball_tab_v1',
        storageBallPos: 'guishi_ball_pos_v1',
        storageOpen: 'guishi_ball_open_v1'
    };
    var gsState = (window.guishiBallState = window.guishiBallState || { theme: 'dark', tab: 'gs-tab-info', open: false });
    try { var _t = localStorage.getItem(window.GUISHI_BALL_CONFIG.storageTheme); if (_t) gsState.theme = _t; } catch (e) {}
    window.GUISHI_LAST_VALID = window.GUISHI_LAST_VALID || null;

    /* 预设立绘：按要求留空 */
    var PRESET_PORTRAITS = {};

    /* ===== 4. 数据读取：g(obj, path, default) ===== */
    function g(obj, path, def) {
        if (obj == null) return (def === undefined ? '' : def);
        var parts = String(path).split('.');
        var cur = obj;
        for (var i = 0; i < parts.length; i++) {
            if (cur == null) return (def === undefined ? '' : def);
            cur = cur[parts[i]];
        }
        return (cur === undefined || cur === null) ? (def === undefined ? '' : def) : cur;
    }
    function getMvuGlobal() {
        if (typeof window.Mvu !== 'undefined') return window;
        try { if (window.parent && typeof window.parent.Mvu !== 'undefined') return window.parent; } catch (e) {}
        try { if (window.top && typeof window.top.Mvu !== 'undefined') return window.top; } catch (e) {}
        return null;
    }
    function getStatData() {
        var win = getMvuGlobal();
        if (win && win.Mvu && typeof win.Mvu.getMvuData === 'function') {
            try {
                var r = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
                var sd = (r && r.stat_data) ? r.stat_data : r;
                if (sd && typeof sd === 'object' && Object.keys(sd).length > 0) {
                    if (sd['主角'] || sd['装备栏'] || sd['物品栏'] || sd['里世界论坛'] || sd['世界']) {
                        try { window.GUISHI_LAST_VALID = JSON.parse(JSON.stringify(sd)); } catch (e) {}
                        return sd;
                    }
                }
            } catch (e) { console.warn('[诡事录命盘] 读取MVU数据失败:', e.message); }
        }
        if (typeof getAllVariables === 'function') {
            try {
                var av = getAllVariables();
                var sd2 = (av && av.stat_data) ? av.stat_data : av;
                if (sd2 && typeof sd2 === 'object' && (sd2['主角'] || sd2['装备栏'] || sd2['物品栏'])) {
                    try { window.GUISHI_LAST_VALID = JSON.parse(JSON.stringify(sd2)); } catch (e) {}
                    return sd2;
                }
            } catch (e) {}
        }
        if (window.GUISHI_LAST_VALID) return window.GUISHI_LAST_VALID;
        return {};
    }
    function getFinalPortraitUrl(name, rawUrl) {
        try {
            var preset = PRESET_PORTRAITS[name];
            var base = rawUrl || preset || '';
            if (Object.prototype.toString.call(base) === '[object Array]') return base.slice();
            if (typeof base === 'string' && base.length) {
                var arr = base.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
                return arr.length ? arr : [];
            }
            return [];
        } catch (e) { return []; }
    }

    /* ====================================================================== */
    /* ============================ 主入口 ================================= */
    /* ====================================================================== */
    function guishiBallMain() {

        /* ---------- 4a. 注入样式（命盘·阵法，复刻原状态栏）---------- */
        (function () {
            var existing = document.getElementById('guishi-ball-style');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            var s = document.createElement('style');
            s.id = 'guishi-ball-style';
            s.textContent = `
/* ========== 命盘·阵法 主题变量（与原《诡事录状态栏》一致）========== */
:root {
  --g:   #c8a052;   /* 古金 */
  --g2:  #e8d090;   /* 古金亮 */
  --gD:  #6b3a10;   /* 古金深 */
  --ci:  #9b1c1c;   /* 朱砂红 */
  --ciB: #c8302a;   /* 朱砂亮红 */
  --ink: #3a2010;
  --pale:#f0e2c8;   /* 米白文字 */
  --d:   #0a0303;   /* 墨黑 */
  --d2:  #1a0c0a;   /* 墨黑次级 */
  --d3:  #261010;
  --ft:  'STKaiti','KaiTi','楷体','STXingkai','华文行楷',serif;   /* 题头楷体 */
  --fb:  'STSong','SimSun','宋体',serif;                          /* 正文宋体 */
}
[data-theme="light"] {
  --pale:#2a1206; --d:#f3e9d6; --d2:#efe2c8; --d3:#e8d8b8;
  --ci:#9b1c1c; --ciB:#b91c1c; --g:#8a6a2a; --g2:#6f531c; --ink:#5a3a20;
}
#guishi-ball-panel, #guishi-ball { box-sizing: border-box; }
#guishi-ball-panel *, #guishi-ball * { box-sizing: border-box; }

/* ========== 悬浮球：罗盘·符箓 ========== */
:root { --gs-ball-size: 60px; }
#guishi-ball {
  position: fixed; top: 90px; right: 20px;
  width: var(--gs-ball-size); height: var(--gs-ball-size);
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #2a0d0d 0%, #160606 65%, #050202 100%);
  border: 2px solid var(--g);
  box-shadow: 0 0 18px rgba(200,48,42,.6), 0 0 28px rgba(200,160,82,.25), 0 4px 12px rgba(0,0,0,.75);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 999990; color: var(--g2);
  transition: transform .25s, box-shadow .25s, border-color .25s;
  user-select: none; -webkit-user-select: none; touch-action: none;
  animation: gsBallPulse 3.6s ease-in-out infinite;
}
#guishi-ball:hover { transform: scale(1.12); border-color: var(--ciB); }
#guishi-ball:active { transform: scale(0.96); }
#guishi-ball svg { pointer-events: none; display:block; filter: drop-shadow(0 0 5px rgba(200,160,82,.85)); }
@keyframes gsBallPulse {
  0%,100% { box-shadow: 0 0 12px rgba(155,28,28,.45), 0 0 20px rgba(200,160,82,.18), 0 4px 12px rgba(0,0,0,.75); }
  50%     { box-shadow: 0 0 22px rgba(200,48,42,.8),  0 0 32px rgba(232,208,144,.35), 0 4px 12px rgba(0,0,0,.75); }
}

/* ========== 面板：墨黑卷轴 + 朱金边 + 阵法背景 + 流光金边 ========== */
#guishi-ball-panel {
  position: fixed !important; right: 22px; bottom: 22px;
  width: 470px; max-width: 94vw; height: 82vh; max-height: 800px;
  min-height: 0 !important; z-index: 999995;
  display: none; flex-direction: column; padding: 0 !important;
  border-radius: 6px; border: 2px solid rgba(200,154,62,.5);
  font-family: var(--fb); color: var(--pale);
  background:
    radial-gradient(ellipse 65% 55% at 50% 42%, rgba(155,28,28,.18), transparent 68%),
    radial-gradient(ellipse 85% 65% at 50% 94%, rgba(200,154,62,.08), transparent 72%),
    radial-gradient(circle at 50% 50%, var(--d2) 0%, var(--d) 55%, #030101 100%);
  box-shadow: 0 0 0 1px rgba(200,154,62,.2), 0 0 15px rgba(200,154,62,.3), inset 0 0 80px rgba(0,0,0,.9), 0 14px 44px rgba(0,0,0,.85);
  overflow: hidden;
}
/* 八卦阵法背景 */
#guishi-ball-panel::before {
  content: ""; position: absolute; inset: 0; opacity: .13; pointer-events: none; z-index: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><g stroke='%23c8a052' fill='none' stroke-width='1.5' opacity='0.6'><circle cx='120' cy='120' r='100' stroke-dasharray='10 5'/><circle cx='120' cy='120' r='80'/><path d='M120 20 L120 220 M20 120 L220 120 M49 49 L191 191 M49 191 L191 49'/><polygon points='120,40 176,160 64,160'/><polygon points='120,200 64,80 176,80'/></g></svg>");
  background-size: 240px 240px; background-position: center;
}
/* 四角朱砂光晕 */
#guishi-ball-panel::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(circle at 20px 20px, rgba(155,28,28,.32), transparent 55px),
    radial-gradient(circle at calc(100% - 20px) 20px, rgba(155,28,28,.32), transparent 55px),
    radial-gradient(circle at 20px calc(100% - 20px), rgba(155,28,28,.32), transparent 55px),
    radial-gradient(circle at calc(100% - 20px) calc(100% - 20px), rgba(155,28,28,.32), transparent 55px);
}
/* 流光金边 */
#guishi-ball-panel .gs-flow {
  position: absolute; inset: 0; z-index: 1; pointer-events: none; border-radius: 6px; opacity: .85; padding: 2px;
  background: conic-gradient(from var(--flw,0deg), rgba(232,208,144,0) 0%, rgba(232,208,144,.08) 10%, rgba(255,240,200,.45) 17%, #fff 21%, rgba(255,240,200,.45) 25%, rgba(232,208,144,.08) 32%, rgba(232,208,144,0) 40%, rgba(232,208,144,0) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude;
  animation: gsFlwSpin 6s linear infinite;
}
@property --flw { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes gsFlwSpin { to { --flw: 360deg; } }

#guishi-ball-panel.open { display: flex; animation: gsPanelIn .32s cubic-bezier(0.16,1,0.3,1); }
@keyframes gsPanelIn { from { opacity: 0; transform: scale(.92) translateY(22px); } to { opacity: 1; transform: none; } }

/* 卷轴顶部 */
.gs-panel-header {
  flex: 0 0 auto; position: relative; z-index: 3; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 10px 14px; border-bottom: 1px solid rgba(200,154,62,.2);
  background: linear-gradient(90deg, rgba(20,10,5,.85) 0%, transparent 100%);
}
.gs-panel-title {
  font-family: var(--ft); font-weight: 900; font-size: 19px; letter-spacing: .2em; color: var(--g2);
  text-shadow: 0 0 15px rgba(200,154,62,.8);
  background: -webkit-linear-gradient(top, #fff, var(--g2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.8));
}
.gs-theme-controls { display: flex; gap: 6px; }
.gs-box-btn {
  background: rgba(10,3,3,.7); border: 1px solid var(--g); color: var(--g2);
  width: 28px; height: 28px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 14px; transition: all .25s; box-shadow: 0 0 5px rgba(200,160,82,.25);
}
.gs-box-btn:hover { background: var(--ci); color: #fff; box-shadow: 0 0 10px rgba(200,48,42,.5); }
.gs-close-btn {
  background: rgba(155,28,28,.22); border: 1px solid var(--ciB); color: #fff;
  width: 28px; height: 28px; border-radius: 4px; font-size: 16px; font-weight: bold;
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; flex: 0 0 auto;
}
.gs-close-btn:hover { background: var(--ciB); transform: rotate(90deg); }

/* 主体：左符栏 + 右内容 */
.gs-panel-body { flex: 1 1 auto; display: flex; min-height: 0; position: relative; z-index: 2; }
.gs-tab-rail {
  flex: 0 0 auto; width: 58px; padding: 10px 6px; display: flex; flex-direction: column; gap: 8px; align-items: center;
  border-right: 1px solid rgba(200,154,62,.2);
  background: linear-gradient(180deg, rgba(0,0,0,.55), transparent);
  overflow-y: auto; overflow-x: hidden;
}
.gs-tab-rail::-webkit-scrollbar { width: 0; }
#guishi-ball-panel .gs-tab-rail .tab-btn {
  flex: none !important; width: 44px; height: 44px; min-width: 44px;
  padding: 0 !important; margin: 0 !important; font-size: 20px;
  display: flex; align-items: center; justify-content: center; border-radius: 5px; line-height: 1;
  background: rgba(10,3,3,.6); border: 1px solid rgba(200,160,82,.3);
  color: rgba(200,160,80,.6); cursor: pointer; transition: all .3s; text-shadow: 0 2px 4px rgba(0,0,0,.8);
}
#guishi-ball-panel .gs-tab-rail .tab-btn:hover { color: var(--g); border-color: var(--g); }
#guishi-ball-panel .gs-tab-rail .tab-btn.active {
  color: var(--g2); border-color: var(--ciB);
  background: linear-gradient(135deg, rgba(155,28,28,.4), rgba(200,48,42,.15));
  box-shadow: inset 0 0 8px rgba(200,48,42,.3), 0 0 8px rgba(200,160,82,.3); transform: translateX(2px);
}
.gs-tab-contents {
  flex: 1 1 auto; min-width: 0; position: relative; z-index: 2;
  overflow-y: auto; overflow-x: hidden; padding: 12px 14px 16px;
  scrollbar-width: thin; scrollbar-color: rgba(200,154,62,.5) transparent;
  font-family: var(--fb); font-size: 15px; color: var(--pale); font-weight: 700;
}
.gs-tab-contents::-webkit-scrollbar { width: 6px; }
.gs-tab-contents::-webkit-scrollbar-thumb { background: rgba(200,154,62,.5); border-radius: 3px; }
.gs-tab-contents::-webkit-scrollbar-track { background: transparent; }

.tab-content { display: none; animation: gsFadeIn .4s cubic-bezier(0.175,0.885,0.32,1.275) both; }
.tab-content.active { display: block; }
@keyframes gsFadeIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }

/* ========== 顶部立绘 + 状态条（核心信息）========== */
#guishi-ball-panel .gs-top { display: flex; padding: 4px 0 10px; gap: 12px; position: relative; z-index: 2; flex: none; }
#guishi-ball-panel .gs-ava { width: 78px; height: 98px; position: relative; flex: none; box-shadow: 0 0 15px rgba(200,154,62,.4); cursor: zoom-in; }
#guishi-ball-panel .gs-ava img { width: 100%; height: 100%; object-fit: cover; display: block; clip-path: polygon(6% 0,94% 0,100% 6%,100% 94%,94% 100%,6% 100%,0 94%,0 6%); border-radius: 2px; }
#guishi-ball-panel .gs-ava.empty img { display: none; }
#guishi-ball-panel .gs-ava:not(.empty) .gs-ava-ph { display: none; }
#guishi-ball-panel .gs-ava-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: rgba(200,160,80,.5); font-family: var(--ft); font-size: 13px; clip-path: polygon(6% 0,94% 0,100% 6%,100% 94%,94% 100%,6% 100%,0 94%,0 6%); background: #1a0c0a; }
#guishi-ball-panel .gs-ava::after { content: ""; position: absolute; inset: -2px; background: linear-gradient(135deg,var(--gD),var(--g),var(--g2),var(--g),var(--gD)); clip-path: polygon(6% 0,94% 0,100% 6%,100% 94%,94% 100%,6% 100%,0 94%,0 6%); z-index: -1; opacity: .9; animation: gsAvaShine 3s ease-in-out infinite; }
@keyframes gsAvaShine { 0%,100% { opacity: .6; filter: drop-shadow(0 0 8px var(--g)); } 50% { opacity: 1; filter: drop-shadow(0 0 15px var(--g2)); } }
#guishi-ball-panel .gs-ava-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: none; width: 78px; }
#guishi-ball-panel .gs-ava-custom { width: 78px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: var(--g2); cursor: pointer; border: 1px solid rgba(200,154,62,.4); border-radius: 4px; background: rgba(20,10,5,.6); transition: all .3s; box-shadow: 0 2px 5px rgba(0,0,0,.5); flex: none; }
#guishi-ball-panel .gs-ava-custom:hover { color: #fff; border-color: var(--g2); box-shadow: 0 0 15px rgba(200,154,62,.4); }
#guishi-ball-panel .gs-bars { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 2px; min-width: 0; }
#guishi-ball-panel .gs-bar { display: flex; align-items: center; gap: 8px; }
#guishi-ball-panel .gs-bar-lbl { width: 56px; font-family: var(--ft); font-size: 13px; font-weight: 900; letter-spacing: .05em; color: var(--g); text-shadow: 0 0 8px rgba(0,0,0,.8); text-align: left; flex: none; }
#guishi-ball-panel .gs-bar-trk { flex: 1; height: 16px; background: rgba(0,0,0,.55); box-shadow: inset 0 2px 6px rgba(0,0,0,.6), 0 0 0 1px rgba(200,154,62,.3); border-radius: 8px; overflow: hidden; position: relative; min-width: 0; }
#guishi-ball-panel .gs-bar-fill { height: 100%; border-radius: 8px; transition: width .6s ease; position: relative; }
#guishi-ball-panel .gs-bar-fill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.3), transparent 55%, rgba(0,0,0,.35)); border-radius: 8px; }
#guishi-ball-panel .gs-bar-num { position: absolute; right: 7px; top: -1px; font-family: var(--ft); font-size: 12px; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.9); z-index: 2; font-weight: 900; }
#guishi-ball-panel .fill-hp { background: linear-gradient(90deg,#4a0000,#c02020,#ff4040,#c02020); }
#guishi-ball-panel .fill-mp { background: linear-gradient(90deg,#001e4a,#2068c0,#40a0ff,#2068c0); }
#guishi-ball-panel .fill-st { background: linear-gradient(90deg,#3a2000,#c08020,#ffc040,#c08020); }
#guishi-ball-panel .fill-sn { background: linear-gradient(90deg,#2a004a,#8030c0,#c060ff,#8030c0); }
/* 四维 */
#guishi-ball-panel .gs-cbattrib { margin-top: 8px; padding: 8px 10px; border: 1px solid rgba(200,160,82,.3); border-radius: 6px; background: linear-gradient(180deg, rgba(200,160,82,.06), rgba(0,0,0,0)); }
#guishi-ball-panel .gs-cbattrib-hd { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: var(--g2); font-family: var(--ft); font-weight: 900; letter-spacing: 1px; border-bottom: 1px solid rgba(200,160,82,.2); padding-bottom: 3px; }
#guishi-ball-panel .gs-cbattrib-g { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; }
#guishi-ball-panel .gs-cba { text-align: center; padding: 4px 2px; border: 1px solid rgba(200,160,82,.2); border-radius: 5px; background: rgba(200,160,82,.05); }
#guishi-ball-panel .gs-cba-k { font-size: 11px; color: #9a7e5a; font-family: var(--ft); }
#guishi-ball-panel .gs-cba-v { font-size: 17px; font-weight: 900; color: var(--g2); font-family: var(--ft); }

/* ========== 信息行（info-cell）/ 章节标题（sec-tit）========== */
#guishi-ball-panel .info-col { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
#guishi-ball-panel .info-cell { padding: 11px 13px; display: flex; align-items: flex-start; gap: 12px; background: linear-gradient(135deg, rgba(40,15,10,.6), rgba(20,8,5,.7), rgba(40,15,10,.6)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 4px 8px rgba(0,0,0,.5); border-radius: 4px; }
#guishi-ball-panel .info-cell .ik { font-family: var(--ft); font-size: 14px; color: var(--g); letter-spacing: .08em; min-width: 92px; text-align: left; font-weight: 900; text-shadow: 0 0 5px rgba(0,0,0,1); flex: none; }
#guishi-ball-panel .info-cell .iv { font-family: var(--fb); font-size: 15px; color: var(--pale); line-height: 1.6; flex: 1; font-weight: 700; word-break: break-all; }
#guishi-ball-panel .sec-tit { font-family: var(--ft); font-size: 18px; color: var(--g2); letter-spacing: .15em; padding-left: .3em; margin: 14px 0 10px; font-weight: 900; display: flex; align-items: center; gap: 10px; text-shadow: 0 0 10px rgba(200,154,62,.5); text-align: left; }
#guishi-ball-panel .sec-tit::before { content: ""; width: 5px; height: 20px; background: linear-gradient(180deg, var(--g2), var(--ci)); display: inline-block; border-radius: 2px; flex: none; }
#guishi-ball-panel .sec-tit::after { content: ""; flex: 1; height: 2px; background: linear-gradient(90deg, rgba(200,154,62,.5), transparent); }
#guishi-ball-panel .sec-tit:first-child { margin-top: 0; }

/* ========== 能力 / 物品 卡片（card-row / card）========== */
#guishi-ball-panel .card-row { display: flex; flex-wrap: wrap; gap: 10px; }
#guishi-ball-panel .card { width: calc(50% - 5px); padding: 14px 12px; cursor: pointer; background: linear-gradient(160deg, rgba(45,15,10,.7), rgba(20,8,5,.8), rgba(45,15,10,.7)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 4px 12px rgba(0,0,0,.5); transition: all .3s; border-radius: 4px; }
#guishi-ball-panel .card:hover { background: linear-gradient(160deg, rgba(65,22,15,.8), rgba(30,12,8,.9), rgba(65,22,15,.8)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.5), 0 6px 20px rgba(0,0,0,.7); transform: translateY(-2px); }
#guishi-ball-panel .card .c-name { font-family: var(--ft); font-size: 16px; color: var(--g2); letter-spacing: .08em; font-weight: 900; text-shadow: 0 0 10px rgba(200,154,62,.5); text-align: left; }

/* ========== 装备格（equip-grid / equip-slot）========== */
#guishi-ball-panel .equip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
#guishi-ball-panel .equip-slot { padding: 14px 12px; text-align: left; cursor: pointer; background: rgba(20,10,8,.6); border: 2px dashed rgba(200,160,82,.3); transition: all .3s; border-radius: 6px; }
#guishi-ball-panel .equip-slot.has-item { background: linear-gradient(160deg, rgba(45,15,10,.8), rgba(20,8,5,.9), rgba(45,15,10,.8)); border: 2px solid rgba(200,160,82,.5); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 5px 15px rgba(0,0,0,.6); }
#guishi-ball-panel .equip-slot.has-item:hover { border-color: var(--g2); transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,.8), inset 0 0 15px rgba(200,160,82,.3); }
#guishi-ball-panel .equip-slot-title { font-family: var(--ft); font-size: 13px; color: rgba(200,160,80,.8); margin-bottom: 6px; letter-spacing: .12em; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,1); }
#guishi-ball-panel .equip-slot-name { font-family: var(--ft); font-size: 16px; color: var(--g2); font-weight: 900; text-shadow: 0 0 8px rgba(200,154,62,.5); }
#guishi-ball-panel .equip-slot.empty .equip-slot-name { color: rgba(200,160,80,.3); }

/* ========== 人物 / 伴侣 长框（npcframe）========== */
#guishi-ball-panel .npcframe { width: 100%; padding: 14px; margin-bottom: 10px; cursor: pointer;
  background: linear-gradient(160deg, rgba(35,12,8,.8), rgba(18,6,4,.9), rgba(35,12,8,.8)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 6px 16px rgba(0,0,0,.6); transition: all .3s; position: relative; border-radius: 4px; }
#guishi-ball-panel .npcframe:hover { background: linear-gradient(160deg, rgba(55,18,10,.9), rgba(25,8,4,.95), rgba(55,18,10,.9)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.4), 0 8px 24px rgba(0,0,0,.8); transform: translateY(-2px); }
#guishi-ball-panel .npcframe .nf-name { font-family: var(--ft); font-size: 18px; color: var(--g2); letter-spacing: .08em; font-weight: 900; text-shadow: 0 0 12px rgba(200,154,62,.6); margin-bottom: 5px; text-align: left; }
#guishi-ball-panel .npcframe .nf-sub { font-family: var(--fb); font-size: 14px; color: rgba(200,180,150,.85); font-weight: 700; margin-bottom: 4px; text-align: left; }
#guishi-ball-panel .npcframe .rel-text { color: #d880d8; text-shadow: 0 0 5px rgba(216,128,216,.5); font-weight: 900; }
/* 小状态条（人物/伴侣卡片内）*/
#guishi-ball-panel .mini-bars { display: flex; flex-direction: column; gap: 3px; margin: 8px 0 6px; }
#guishi-ball-panel .mini-bar { display: flex; align-items: center; gap: 5px; font-family: var(--ft); font-size: 13px; font-weight: 900; }
#guishi-ball-panel .mini-bar .ml { width: 48px; color: rgba(200,160,80,.95); text-align: left; text-shadow: 0 0 5px rgba(0,0,0,1); flex: none; }
#guishi-ball-panel .mini-bar .mt { flex: 1; height: 8px; background: rgba(0,0,0,.7); border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,.8), 0 0 0 1px rgba(200,154,62,.2); min-width: 0; }
#guishi-ball-panel .mini-bar .mf { height: 100%; border-radius: 4px; transition: width .5s; }
#guishi-ball-panel .mini-bar .mn { width: 28px; text-align: right; color: rgba(255,255,255,.85); text-shadow: 0 0 5px rgba(0,0,0,1); flex: none; }
/* 好感度条 */
#guishi-ball-panel .fav-row { display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; background: rgba(20,5,5,.4); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2); border-radius: 4px; margin-top: 6px; margin-bottom: 4px; }
#guishi-ball-panel .fav-row .ftit { font-family: var(--ft); font-size: 13px; color: var(--g); font-weight: 900; letter-spacing: .08em; text-shadow: 0 1px 2px rgba(0,0,0,1); text-align: left; }
#guishi-ball-panel .fav-trk { width: 100%; height: 13px; background: rgba(0,0,0,.6); box-shadow: inset 0 2px 6px rgba(0,0,0,.8), 0 0 0 1px rgba(200,154,62,.3); border-radius: 7px; position: relative; overflow: hidden; }
#guishi-ball-panel .fav-fill { height: 100%; border-radius: 7px; transition: width .5s ease; position: relative; }
#guishi-ball-panel .fav-fill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.25), transparent 50%, rgba(0,0,0,.3)); border-radius: 7px; }
#guishi-ball-panel .fav-fill-red { background: linear-gradient(90deg,#600000,#b01010,#e02020); }
#guishi-ball-panel .fav-fill-pink { background: linear-gradient(90deg,#801030,#d03060,#ff80b0); box-shadow: 0 0 10px rgba(255,128,176,.6); }
#guishi-ball-panel .fav-num { position: absolute; right: 7px; top: -1px; font-family: var(--ft); font-size: 11px; color: #fff; font-weight: 900; text-shadow: 0 1px 4px rgba(0,0,0,.9); z-index: 2; }

/* ========== 世界情报：论坛 / 邸报 / 通讯 ========== */
#guishi-ball-panel .world-time-box { text-align: center; padding: 12px 14px; margin-bottom: 12px; background: linear-gradient(180deg, rgba(20,10,5,.6), rgba(0,0,0,.2)); border: 1px solid rgba(200,154,62,.2); border-radius: 4px; }
#guishi-ball-panel .world-time-box .wt-lbl { font-family: var(--ft); color: var(--g); font-size: 13px; letter-spacing: .1em; font-weight: 900; }
#guishi-ball-panel .world-time-box .wt-val { font-family: var(--ft); font-size: 18px; color: var(--g2); font-weight: 900; text-shadow: 0 0 12px rgba(200,154,62,.6); }
#guishi-ball-panel .forum-block { margin-bottom: 12px; padding: 14px 16px; cursor: pointer; background: linear-gradient(160deg, rgba(35,15,10,.8), rgba(20,8,5,.9), rgba(35,15,10,.8)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 6px 16px rgba(0,0,0,.6); border-radius: 6px; transition: all .3s; }
#guishi-ball-panel .forum-block:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1px rgba(200,154,62,.4), 0 8px 24px rgba(0,0,0,.8); }
#guishi-ball-panel .forum-block .fb-tit { font-family: var(--ft); font-size: 20px; color: var(--g2); letter-spacing: .15em; text-align: left; font-weight: 900; text-shadow: 0 0 15px rgba(200,154,62,.6); }
#guishi-ball-panel .forum-block .fb-sub { font-family: var(--fb); font-size: 13px; color: rgba(200,160,80,.7); text-align: left; letter-spacing: .15em; margin-top: 5px; font-weight: 700; }
#guishi-ball-panel .news-entry { display: block; padding: 16px 18px; margin-bottom: 12px; background: linear-gradient(180deg,#e8d8b0 0%,#d4c090 50%,#c8b880 100%); color: #2a1a10; border: 2px solid #6a4a20; border-radius: 5px; box-shadow: 0 5px 14px rgba(0,0,0,.5), inset 0 0 40px rgba(80,40,15,.15); cursor: pointer; transition: all .25s; }
#guishi-ball-panel .news-entry:hover { transform: translateY(-2px); box-shadow: 0 9px 22px rgba(0,0,0,.6); }
#guishi-ball-panel .news-entry-tit { font-family: var(--ft); font-size: 22px; font-weight: 900; letter-spacing: .15em; color: #3a1505; text-shadow: 1px 1px 0 rgba(255,255,255,.5); }
#guishi-ball-panel .news-entry-sub { font-family: var(--fb); font-size: 13px; color: #6a4a20; margin-top: 6px; letter-spacing: .1em; font-weight: 700; }
#guishi-ball-panel .chat-wrap { margin-top: 14px; padding: 12px; background: linear-gradient(135deg, rgba(5,20,25,.8), rgba(0,10,15,.9)); box-shadow: inset 0 0 0 1px rgba(0,200,255,.2), 0 5px 15px rgba(0,0,0,.6); border-radius: 4px; }
#guishi-ball-panel .chat-wrap .ch { font-family: var(--ft); font-size: 17px; color: #0cf; font-weight: 900; margin-bottom: 10px; text-shadow: 0 0 8px rgba(0,200,255,.6); text-align: left; letter-spacing: .1em; }
#guishi-ball-panel .cmsg { margin-bottom: 6px; padding: 8px 12px; background: rgba(0,40,50,.6); font-family: var(--fb); font-size: 14px; color: #def; font-weight: 700; border-radius: 3px; border-left: 3px solid #0cf; text-align: left; }
#guishi-ball-panel .cmsg b { color: #0ff; font-family: var(--ft); font-weight: 900; }

/* 空提示 */
#guishi-ball-panel .gs-empty { color: rgba(200,160,80,.4); text-align: left; padding: 26px; font-family: var(--ft); font-weight: 900; letter-spacing: .2em; }

/* ========== 全局弹窗（复刻 .gs-mbox 观感）========== */
.global-guishi-modal-overlay, .global-guishi-sub-modal-overlay {
  display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  width: 100vw; height: 100vh; background: rgba(0,0,0,.95);
  backdrop-filter: blur(4px); z-index: 999999;
  justify-content: center; align-items: center; padding: 20px;
  color: var(--pale); font-family: var(--fb);
}
.global-guishi-sub-modal-overlay { z-index: 9999999; background: rgba(0,0,0,.85); }
.global-guishi-modal-content, .global-guishi-sub-modal-content {
  position: relative; width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto;
  padding: 20px 24px; border-radius: 6px;
  background: linear-gradient(180deg, var(--d3), var(--d2), var(--d));
  border: 2px solid var(--g);
  box-shadow: 0 0 0 2px rgba(0,0,0,1), 0 20px 60px rgba(0,0,0,1), inset 0 0 60px rgba(0,0,0,.7);
  scrollbar-width: thin; scrollbar-color: rgba(200,154,62,.5) transparent;
  animation: gsModalPop .38s cubic-bezier(0.175,0.885,0.32,1.275);
}
.global-guishi-sub-modal-content { max-width: 420px; border-color: var(--ciB); box-shadow: 0 0 0 2px rgba(0,0,0,1), 0 0 40px rgba(200,48,42,.45), inset 0 0 60px rgba(0,0,0,.7); }
.global-guishi-modal-content::-webkit-scrollbar, .global-guishi-sub-modal-content::-webkit-scrollbar { width: 6px; }
.global-guishi-modal-content::-webkit-scrollbar-thumb, .global-guishi-sub-modal-content::-webkit-scrollbar-thumb { background: rgba(200,154,62,.5); border-radius: 3px; }
@keyframes gsModalPop { 0% { transform: scale(.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.gs-modal-close {
  position: absolute; top: 10px; right: 15px; cursor: pointer;
  font-family: var(--ft); font-size: 24px; color: var(--ci); font-weight: 900; transition: all .3s; text-shadow: 0 0 5px rgba(0,0,0,1); z-index: 10;
}
.gs-modal-close:hover { color: var(--ciB); transform: scale(1.2); }
.gs-modal-title {
  font-family: var(--ft); font-size: 22px; color: var(--g2); letter-spacing: .15em;
  margin-bottom: 16px; font-weight: 900; text-shadow: 0 0 15px rgba(200,154,62,.6);
  text-align: left; border-bottom: 1px dashed rgba(200,154,62,.4); padding-bottom: 10px;
}
/* 弹窗内：信息行 / 进度 / 好感 / 论坛帖 / 邸报 / 能力折叠 */
.global-guishi-modal-content .mod-col, .global-guishi-sub-modal-content .mod-col { display: flex; flex-direction: column; gap: 10px; }
.global-guishi-modal-content .mod-row, .global-guishi-sub-modal-content .mod-row { display: flex; align-items: flex-start; gap: 12px; padding: 11px 15px; background: linear-gradient(135deg, rgba(40,15,10,.6), rgba(20,8,5,.7), rgba(40,15,10,.6)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 3px 8px rgba(0,0,0,.5); border-radius: 4px; }
.global-guishi-modal-content .mod-row .mk, .global-guishi-sub-modal-content .mod-row .mk { font-family: var(--ft); font-size: 14px; color: var(--g); letter-spacing: .08em; min-width: 100px; text-align: left; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,1); flex: none; }
.global-guishi-modal-content .mod-row .mv, .global-guishi-sub-modal-content .mod-row .mv { font-family: var(--fb); font-size: 15px; color: var(--pale); line-height: 1.6; flex: 1; font-weight: 700; word-break: break-all; }
.global-guishi-modal-content .prog-row, .global-guishi-sub-modal-content .prog-row { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: linear-gradient(135deg, rgba(40,15,10,.6), rgba(20,8,5,.7), rgba(40,15,10,.6)); box-shadow: inset 0 0 0 1px rgba(200,154,62,.2), 0 3px 8px rgba(0,0,0,.5); border-radius: 4px; }
.global-guishi-modal-content .prog-row .ptit, .global-guishi-sub-modal-content .prog-row .ptit { display: flex; justify-content: space-between; align-items: center; font-family: var(--ft); font-size: 14px; font-weight: 900; }
.global-guishi-modal-content .prog-row .ptit-lbl, .global-guishi-sub-modal-content .prog-row .ptit-lbl { color: var(--g); letter-spacing: .08em; text-shadow: 0 2px 4px rgba(0,0,0,1); }
.global-guishi-modal-content .prog-row .ptit-num, .global-guishi-sub-modal-content .prog-row .ptit-num { color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.9); }
.global-guishi-modal-content .gs-bar-trk, .global-guishi-sub-modal-content .gs-bar-trk { flex: 1; height: 12px; background: rgba(0,0,0,.55); box-shadow: inset 0 2px 6px rgba(0,0,0,.6), 0 0 0 1px rgba(200,154,62,.3); border-radius: 7px; overflow: hidden; position: relative; }
.global-guishi-modal-content .gs-bar-fill, .global-guishi-sub-modal-content .gs-bar-fill { height: 100%; border-radius: 7px; position: relative; }
.global-guishi-modal-content .gs-bar-fill::after, .global-guishi-sub-modal-content .gs-bar-fill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.25), transparent 55%, rgba(0,0,0,.35)); border-radius: 7px; }
.global-guishi-modal-content .fill-hp,.global-guishi-modal-content .fill-mp,.global-guishi-modal-content .fill-st,.global-guishi-modal-content .fill-sn,
.global-guishi-sub-modal-content .fill-hp,.global-guishi-sub-modal-content .fill-mp,.global-guishi-sub-modal-content .fill-st,.global-guishi-sub-modal-content .fill-sn { height: 100%; border-radius: 7px; }
.global-guishi-modal-content .fpost-wrap, .global-guishi-sub-modal-content .fpost-wrap { margin-bottom: 12px; padding: 14px 16px; background: linear-gradient(135deg, rgba(15,25,20,.8), rgba(5,15,10,.9)); box-shadow: inset 0 0 0 1px rgba(0,255,136,.2), 0 4px 10px rgba(0,0,0,.5); border-radius: 4px; }
.global-guishi-modal-content .fpost-wrap .fpt, .global-guishi-sub-modal-content .fpost-wrap .fpt { font-family: var(--ft); font-size: 16px; color: #ff8866; font-weight: 900; margin-bottom: 6px; text-shadow: 0 0 5px rgba(255,100,50,.5); text-align: left; }
.global-guishi-modal-content .fpost-wrap .fpb, .global-guishi-sub-modal-content .fpost-wrap .fpb { font-family: var(--fb); font-size: 15px; color: #cceeec; line-height: 1.6; font-weight: 700; margin-bottom: 10px; text-align: left; }
.global-guishi-modal-content .freply-box, .global-guishi-sub-modal-content .freply-box { padding: 10px 12px; background: rgba(0,40,50,.6); box-shadow: inset 0 0 0 1px rgba(0,200,200,.2); border-radius: 3px; }
.global-guishi-modal-content .freply-box .fr, .global-guishi-sub-modal-content .freply-box .fr { font-family: var(--fb); font-size: 14px; color: #def; line-height: 1.5; margin-bottom: 4px; font-weight: 700; text-align: left; }
.global-guishi-modal-content .freply-box .fr b, .global-guishi-sub-modal-content .freply-box .fr b { color: #0ff; font-family: var(--ft); font-weight: 900; }
.global-guishi-modal-content .news-paper, .global-guishi-sub-modal-content .news-paper { background: linear-gradient(180deg,#e8d8b0 0%,#d4c090 30%,#e0cfa0 60%,#c8b880 100%); padding: 18px 20px; font-family: var(--fb); color: #2a1a10; box-shadow: inset 0 0 50px rgba(0,0,0,.55); border-radius: 4px; }
.global-guishi-modal-content .news-paper .news-paper-hd, .global-guishi-sub-modal-content .news-paper .news-paper-hd { font-family: var(--ft); font-size: 14px; color: #5a3a20; text-align: left; letter-spacing: .12em; font-weight: 900; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid rgba(80,40,15,.35); }
.global-guishi-modal-content .news-paper .news-art-tit, .global-guishi-sub-modal-content .news-paper .news-art-tit { font-family: var(--ft); font-size: 22px; font-weight: 900; color: #3a1505; text-align: left; letter-spacing: .06em; margin: 4px 0 12px; }
.global-guishi-modal-content .news-paper .news-art-body, .global-guishi-sub-modal-content .news-paper .news-art-body { font-family: var(--fb); font-size: 15px; line-height: 1.8; font-weight: 700; color: #1a0a05; text-align: justify; }
.global-guishi-modal-content .news-paper .news-empty, .global-guishi-sub-modal-content .news-paper .news-empty { font-family: var(--ft); color: #5a3a20; text-align: center; padding: 30px 12px; font-weight: 900; letter-spacing: .15em; }
.global-guishi-modal-content .modal-portrait, .global-guishi-sub-modal-content .modal-portrait { width: 100%; max-height: 320px; object-fit: contain; border-radius: 6px; margin-bottom: 16px; border: 2px solid rgba(200,154,62,.3); background: rgba(5,4,6,.8); box-shadow: 0 5px 15px rgba(0,0,0,.6); display: block; }
.global-guishi-modal-content .abi-det, .global-guishi-sub-modal-content .abi-det { background: linear-gradient(135deg, rgba(40,15,10,.6), rgba(20,8,5,.7)); border: 1px solid rgba(200,154,62,.3); border-radius: 4px; margin-bottom: 8px; overflow: hidden; transition: all .3s; }
.global-guishi-modal-content .abi-det summary, .global-guishi-sub-modal-content .abi-det summary { padding: 11px 14px; font-family: var(--ft); font-size: 15px; color: var(--g2); font-weight: 900; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; text-shadow: 0 0 5px rgba(0,0,0,1); outline: none; }
.global-guishi-modal-content .abi-det summary::-webkit-details-marker, .global-guishi-sub-modal-content .abi-det summary::-webkit-details-marker { display: none; }
.global-guishi-modal-content .abi-det summary::after, .global-guishi-sub-modal-content .abi-det summary::after { content: "▼"; font-size: 12px; color: var(--g); transition: transform .3s; }
.global-guishi-modal-content .abi-det[open] summary::after, .global-guishi-sub-modal-content .abi-det[open] summary::after { transform: rotate(180deg); }
.global-guishi-modal-content .abi-det[open] summary, .global-guishi-sub-modal-content .abi-det[open] summary { border-bottom: 1px dashed rgba(200,154,62,.3); background: rgba(20,8,5,.5); }
.global-guishi-modal-content .abi-content, .global-guishi-sub-modal-content .abi-content { padding: 8px 0; display: flex; flex-direction: column; gap: 8px; }
.global-guishi-modal-content .sec-tit, .global-guishi-sub-modal-content .sec-tit { font-family: var(--ft); font-size: 17px; color: var(--g2); letter-spacing: .12em; margin: 12px 0 8px; font-weight: 900; display: flex; align-items: center; gap: 8px; text-shadow: 0 0 8px rgba(200,154,62,.5); text-align: left; }
.global-guishi-modal-content .sec-tit::before, .global-guishi-sub-modal-content .sec-tit::before { content: ""; width: 4px; height: 18px; background: linear-gradient(180deg, var(--g2), var(--ci)); display: inline-block; border-radius: 2px; flex: none; }
.global-guishi-modal-content .sec-tit::after, .global-guishi-sub-modal-content .sec-tit::after { content: ""; flex: 1; height: 2px; background: linear-gradient(90deg, rgba(200,154,62,.5), transparent); }
.global-guishi-modal-content .nsfw-sect, .global-guishi-sub-modal-content .nsfw-sect { margin-top: 14px; padding: 14px 16px; background: linear-gradient(135deg, rgba(110,20,40,.4), rgba(50,10,20,.5), rgba(110,20,40,.4)); box-shadow: inset 0 0 0 1px rgba(220,100,140,.3), 0 5px 15px rgba(0,0,0,.6); border-radius: 4px; }
.global-guishi-modal-content .nsfw-sect .nst, .global-guishi-sub-modal-content .nsfw-sect .nst { font-family: var(--ft); font-size: 17px; color: #f090b0; letter-spacing: .12em; font-weight: 900; margin-bottom: 10px; text-shadow: 0 0 10px rgba(220,100,140,.5); text-align: left; }
.global-guishi-modal-content .nsfw-sect .row2, .global-guishi-sub-modal-content .nsfw-sect .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.global-guishi-modal-content .nsfw-sect .ncell, .global-guishi-sub-modal-content .nsfw-sect .ncell { padding: 10px 12px; background: rgba(20,5,10,.6); box-shadow: inset 0 0 0 1px rgba(220,100,140,.2); border-radius: 3px; }
.global-guishi-modal-content .nsfw-sect .nk, .global-guishi-sub-modal-content .nsfw-sect .nk { font-family: var(--ft); font-size: 14px; color: #f0a0c0; font-weight: 900; display: block; margin-bottom: 4px; text-align: left; }
.global-guishi-modal-content .nsfw-sect .nv, .global-guishi-sub-modal-content .nsfw-sect .nv { font-family: var(--fb); font-size: 14px; color: #f0d0e0; line-height: 1.5; font-weight: 700; }

/* 立绘放大查看 */
#guishi-portrait-viewer {
  display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(5,2,2,.94); backdrop-filter: blur(14px); z-index: 999999999;
  justify-content: center; align-items: center; cursor: zoom-out;
}
#guishi-portrait-viewer.show { display: flex; animation: gsPvFade .2s ease; }
@keyframes gsPvFade { from { opacity: 0; } to { opacity: 1; } }
#guishi-pv-img {
  max-width: 88vw; max-height: 86vh; object-fit: contain;
  border: 2px solid var(--g); border-radius: 6px;
  box-shadow: 0 0 60px rgba(155,28,28,.5), 0 0 120px rgba(200,160,82,.2);
  display: block; animation: gsPvImg .22s cubic-bezier(.22,.68,0,1.2);
}
@keyframes gsPvImg { from { transform: scale(.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }
#guishi-pv-label { margin-top: 10px; color: var(--g2); font-size: 1em; font-weight: bold; text-shadow: 0 0 10px rgba(200,48,42,.6); letter-spacing: .08em; font-family: var(--ft); }

/* 亮色覆盖 */
[data-theme="light"] #guishi-ball-panel { background: radial-gradient(ellipse 65% 55% at 50% 42%, rgba(155,28,28,.1), transparent 68%), radial-gradient(circle at 50% 50%, var(--d2) 0%, var(--d) 55%, #efe2c8 100%); }
#guishi-ball-panel[data-theme="light"] .gs-tab-rail { background: linear-gradient(180deg, rgba(0,0,0,.12), transparent); }

/* 手机端 ≤768px */
@media (max-width: 768px) {
  :root { --gs-ball-size: 52px; }
  #guishi-ball { top: calc(78px + env(safe-area-inset-top, 0px)) !important; right: calc(14px + env(safe-area-inset-right, 0px)) !important; }
  #guishi-ball svg { width: 30px; height: 30px; }
  #guishi-ball-panel {
    top: 7vh !important; left: 0 !important; right: 0 !important; bottom: auto !important; margin: 0 auto !important;
    width: 94vw !important; max-width: 440px !important; height: 84vh !important; max-height: 700px !important;
    border-radius: 8px !important;
  }
  .gs-panel-header { padding-top: max(10px, env(safe-area-inset-top, 0px)); }
  .gs-tab-rail { width: 52px; padding: 8px 4px; gap: 6px; }
  #guishi-ball-panel .gs-tab-rail .tab-btn { width: 42px; height: 42px; font-size: 19px; }
  #guishi-ball-panel .gs-ava { width: 66px; height: 84px; }
  #guishi-ball-panel .gs-ava-col { width: 66px; }
  #guishi-ball-panel .gs-ava-custom { width: 66px; }
  #guishi-ball-panel .card { width: 100%; }
  .global-guishi-modal-content { width: 92vw !important; max-width: 420px !important; max-height: 84vh !important; padding: 16px !important; }
  .global-guishi-sub-modal-content { width: 92vw !important; max-width: 400px !important; }
}
`;
            document.head.appendChild(s);
            try { console.log('[诡事录命盘] 样式已注入 head'); } catch (e) {}
        })();

        /* ---------- 4b. 注入 球 + 面板 + 立绘查看器 ---------- */
        (function () {
            /* 命盘·阵法 八卦罗盘 SVG */
            var BALL_SVG = '<svg viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">'
                + '<circle cx="50" cy="50" r="44" fill="none" stroke="#c8a052" stroke-width="3"/>'
                + '<circle cx="50" cy="50" r="34" fill="none" stroke="#9b1c1c" stroke-width="2"/>'
                + '<circle cx="50" cy="50" r="24" fill="none" stroke="#e8d090" stroke-width="1.5"/>'
                + '<path d="M50 8 L50 92 M8 50 L92 50 M20 20 L80 80 M20 80 L80 20" stroke="#c8a052" stroke-width="1.5" opacity="0.7"/>'
                + '<circle cx="50" cy="50" r="5" fill="#c8302a"/>'
                + '<polygon points="50,30 64,50 50,70 36,50" fill="none" stroke="#e8d090" stroke-width="2"/>'
                + '</svg>';

            /* 八个标签：👤核心信息 / 🔮核心能力 / ⚔️武装 / 📦储物 / 💕伴侣 / 📡人物 / 🌐世界情报 / ✉️通讯
               标签 ID 严格使用 gs-* 命名空间，与 yilu/aelderan 完全隔离。 */
            var RAIL = [
                ['gs-tab-info',    '👤', '核心信息'],
                ['gs-tab-ability', '📜', '核心能力'],
                ['gs-tab-equip',   '⚔️', '武装'],
                ['gs-tab-storage', '🎒', '储物'],
                ['gs-tab-partner', '💕', '伴侣'],
                ['gs-tab-npc',     '🏮', '人物'],
                ['gs-tab-world',   '✉️', '世界情报'],
                ['gs-tab-comm',    '📞', '通讯']
            ];
            var railHtml = '';
            for (var i = 0; i < RAIL.length; i++) {
                railHtml += '<div class="tab-btn' + (i === 0 ? ' active' : '') + '" data-target="' + RAIL[i][0] + '" title="' + RAIL[i][2] + '">' + RAIL[i][1] + '</div>';
            }

            /* 清理可能残留的旧元素，再注入（保证幂等） */
            var oldBall = document.getElementById('guishi-ball'); if (oldBall && oldBall.parentNode) oldBall.parentNode.removeChild(oldBall);
            var oldPanel = document.getElementById('guishi-ball-panel'); if (oldPanel && oldPanel.parentNode) oldPanel.parentNode.removeChild(oldPanel);
            var oldPV = document.getElementById('guishi-portrait-viewer'); if (oldPV && oldPV.parentNode) oldPV.parentNode.removeChild(oldPV);

            var tpl = ''
                + '<div id="guishi-ball" title="诡事录·命盘 (点击展开)" style="position:fixed !important;top:90px;right:20px;width:60px;height:60px;z-index:999990 !important;display:flex !important;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle at 32% 28%,#2a0d0d 0%,#160606 65%,#050202 100%) !important;border:2px solid #c8a052 !important;box-shadow:0 0 18px rgba(200,48,42,.6),0 0 28px rgba(200,160,82,.25),0 4px 12px rgba(0,0,0,.75) !important;cursor:pointer;color:#e8d090 !important;">' + BALL_SVG + '</div>'
                + '<div id="guishi-ball-panel">'
                  + '<div class="gs-flow"></div>'
                  + '<div class="gs-panel-header">'
                    + '<div class="gs-panel-title">☬ 诡事档案</div>'
                    + '<div class="gs-theme-controls">'
                      + '<div class="gs-box-btn btn-dark" title="墨卷(暗)">🌙</div>'
                      + '<div class="gs-box-btn btn-light" title="素绢(亮)">☀️</div>'
                    + '</div>'
                    + '<div class="gs-close-btn" title="收起为命盘球">✕</div>'
                  + '</div>'
                  + '<div class="gs-panel-body">'
                    + '<div class="gs-tab-rail">' + railHtml + '</div>'
                    + '<div class="gs-tab-contents">' + buildTabContents() + '</div>'
                  + '</div>'
                + '</div>'
                + '<div id="guishi-portrait-viewer">'
                  + '<div style="display:flex;flex-direction:column;align-items:center;max-width:92vw;max-height:94vh;">'
                    + '<img id="guishi-pv-img" src="" alt="立绘">'
                    + '<div id="guishi-pv-label"></div>'
                  + '</div>'
                + '</div>';

            document.body.insertAdjacentHTML('beforeend', tpl);
            try {
                var _b = document.getElementById('guishi-ball');
                var _r = _b ? _b.getBoundingClientRect() : null;
                console.log('%c[诡事录命盘] UI注入完成 → 球存在?', 'color:#86efac;font-weight:bold', !!_b, '| 面板存在?', !!document.getElementById('guishi-ball-panel'));
                if (_b && _r) console.log('[诡事录命盘] 球位置 rect:', JSON.stringify({ top: Math.round(_r.top), left: Math.round(_r.left), w: Math.round(_r.width), h: Math.round(_r.height) }), '| 视口:', GS_PARENT.innerWidth + 'x' + GS_PARENT.innerHeight);
            } catch (e) {}
        })();
    } /* ===== end guishiBallMain ===== */

    /* ====================================================================== */
    /* ====================== 面板内容模板（8 标签） ======================= */
    /* ====================================================================== */
    function buildTabContents() {
        return ''
        /* ---- 1. 核心信息：立绘 + 气血/灵韵/体魄/精神 + 四维 + 基本信息 ---- */
        + '<div class="tab-content gs-tab-info active">'
          + '<div class="gs-top">'
            + '<div class="gs-ava-col"><div class="gs-ava empty" title="点击放大立绘"><img class="gs-ava-img" src="" alt="主角立绘"><div class="gs-ava-ph">立绘未录</div></div><div class="gs-ava-custom" title="自定义主角立绘（链接/本地图片）">🏮</div></div>'
            + '<div class="gs-bars">'
              + '<div class="gs-bar"><div class="gs-bar-lbl">🩸 气血</div><div class="gs-bar-trk"><div class="gs-bar-fill fill-hp" data-bar="hp"></div><span class="gs-bar-num" data-num="hp">—</span></div></div>'
              + '<div class="gs-bar"><div class="gs-bar-lbl">✨ 灵韵</div><div class="gs-bar-trk"><div class="gs-bar-fill fill-mp" data-bar="mp"></div><span class="gs-bar-num" data-num="mp">—</span></div></div>'
              + '<div class="gs-bar"><div class="gs-bar-lbl">💪 体魄</div><div class="gs-bar-trk"><div class="gs-bar-fill fill-st" data-bar="st"></div><span class="gs-bar-num" data-num="st">—</span></div></div>'
              + '<div class="gs-bar"><div class="gs-bar-lbl">🧘 精神</div><div class="gs-bar-trk"><div class="gs-bar-fill fill-sn" data-bar="sn"></div><span class="gs-bar-num" data-num="sn">—</span></div></div>'
              + '<div class="gs-cbattrib">'
                + '<div class="gs-cbattrib-hd">⚔️ 战斗属性 · 四维</div>'
                + '<div class="gs-cbattrib-g">'
                  + '<div class="gs-cba"><div class="gs-cba-k">力</div><div class="gs-cba-v" data-cba="str">—</div></div>'
                  + '<div class="gs-cba"><div class="gs-cba-k">体</div><div class="gs-cba-v" data-cba="vit">—</div></div>'
                  + '<div class="gs-cba"><div class="gs-cba-k">气</div><div class="gs-cba-v" data-cba="qi">—</div></div>'
                  + '<div class="gs-cba"><div class="gs-cba-k">感</div><div class="gs-cba-v" data-cba="gan">—</div></div>'
                + '</div>'
              + '</div>'
            + '</div>'
          + '</div>'
          + '<div class="info-col gs-hero-info"></div>'
        + '</div>'

        /* ---- 2. 核心能力 ---- */
        + '<div class="tab-content gs-tab-ability">'
          + '<div class="sec-tit">📜 神 通 法 门</div>'
          + '<div class="gs-ability-pane"></div>'
        + '</div>'

        /* ---- 3. 武装 ---- */
        + '<div class="tab-content gs-tab-equip">'
          + '<div class="sec-tit">📿 随 身 法 器</div>'
          + '<div class="gs-equip-pane"></div>'
        + '</div>'

        /* ---- 4. 储物 ---- */
        + '<div class="tab-content gs-tab-storage">'
          + '<div class="sec-tit">🎒 袖 里 乾 坤</div>'
          + '<div class="gs-storage-pane"></div>'
        + '</div>'

        /* ---- 5. 伴侣 ---- */
        + '<div class="tab-content gs-tab-partner">'
          + '<div class="sec-tit">💞 红 线 阴 契</div>'
          + '<div class="gs-partner-pane"></div>'
        + '</div>'

        /* ---- 6. 人物 ---- */
        + '<div class="tab-content gs-tab-npc">'
          + '<div class="gs-npc-pane"></div>'
        + '</div>'

        /* ---- 7. 世界情报（论坛 + 邸报）---- */
        + '<div class="tab-content gs-tab-world">'
          + '<div class="world-time-box"><div class="wt-lbl">🕰️ 当 前 时 辰</div><div class="wt-val gs-world-time">—</div></div>'
          + '<div class="gs-world-pane"></div>'
        + '</div>'

        /* ---- 8. 通讯 ---- */
        + '<div class="tab-content gs-tab-comm">'
          + '<div class="sec-tit">📱 私 人 通 讯</div>'
          + '<div class="gs-comm-pane"></div>'
        + '</div>';
    }

    /* ====================================================================== */
    /* ============================ 弹窗辅助 =============================== */
    /* ====================================================================== */
    function showGlobalModal(title, bodyHtml) {
        try {
            jQuery('#global-guishi-mvu-modal').remove();
            var ov = document.createElement('div');
            ov.className = 'global-guishi-modal-overlay';
            ov.id = 'global-guishi-mvu-modal';
            ov.innerHTML = '<div class="global-guishi-modal-content"><div class="gs-modal-close">✕</div><div class="gs-modal-title">' + (title || '') + '</div>' + (bodyHtml || '') + '</div>';
            document.body.appendChild(ov);
            jQuery(ov).on('click.guishiball', '.gs-modal-close', function () { jQuery(ov).remove(); });
            jQuery(ov).on('click.guishiball', function (e) { if (e.target === ov) jQuery(ov).remove(); });
        } catch (e) { console.warn('[诡事录命盘] showGlobalModal:', e.message); }
    }
    function showPortraitViewer(url, label) {
        try {
            var pv = document.getElementById('guishi-portrait-viewer');
            if (!pv) return;
            var img = document.getElementById('guishi-pv-img');
            var lbl = document.getElementById('guishi-pv-label');
            if (img) img.src = url;
            if (lbl) lbl.textContent = label || '';
            pv.classList.add('show');
            jQuery(pv).off('click.guishiPv').on('click.guishiPv', function () { pv.classList.remove('show'); });
        } catch (e) {}
    }

    /* ====================================================================== */
    /* ============================ 数据渲染 =============================== */
    /* ====================================================================== */
    function openHeroPortraitUp() {
        var body = '<div style="display:flex;gap:8px;margin-bottom:10px;"><input type="text" id="guishi-hero-url" placeholder="粘贴图片URL……" style="flex:1;font-family:var(--fb);font-size:14px;padding:9px;background:rgba(0,0,0,.7);color:var(--pale);border:1px solid rgba(200,154,62,.4);border-radius:3px;"></div>'
            + '<div style="display:flex;gap:8px;"><button type="button" id="guishi-hero-url-btn" style="flex:1;padding:9px;cursor:pointer;background:linear-gradient(180deg,var(--ciB),var(--ci));color:#fff;border:1px solid rgba(255,100,100,.3);border-radius:3px;font-family:var(--ft);font-weight:900;">📥 载入链接</button><button type="button" id="guishi-hero-file-btn" style="flex:1;padding:9px;cursor:pointer;background:linear-gradient(180deg,var(--ciB),var(--ci));color:#fff;border:1px solid rgba(255,100,100,.3);border-radius:3px;font-family:var(--ft);font-weight:900;">📂 选择文件</button></div>'
            + '<input type="file" id="guishi-hero-file" accept="image/*" style="display:none;">'
            + '<div style="margin-top:10px;"><button type="button" id="guishi-hero-clear-btn" style="width:100%;padding:8px;cursor:pointer;background:rgba(40,15,10,.6);color:var(--g);border:1px solid rgba(200,154,62,.3);border-radius:3px;font-family:var(--ft);font-weight:900;">🗑️ 清除自定义立绘</button></div>'
            + '<div style="margin-top:8px;font-size:12px;color:rgba(200,160,80,.7);font-family:var(--ft);">本地图片不做大小限制（仅受浏览器存储上限约束）。</div>';
        showGlobalModal('🏮 自定义主角立绘', body);
        jQuery('#guishi-hero-url-btn').off('click.guishiball').on('click.guishiball', function () { var u = (jQuery('#guishi-hero-url').val() || '').trim(); if (!u) return; saveHeroPortrait(u); });
        jQuery('#guishi-hero-file-btn').off('click.guishiball').on('click.guishiball', function () { jQuery('#guishi-hero-file').click(); });
        jQuery('#guishi-hero-file').off('change.guishiball').on('change.guishiball', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function (ev) { saveHeroPortrait(ev.target.result); }; rd.readAsDataURL(f); });
        jQuery('#guishi-hero-clear-btn').off('click.guishiball').on('click.guishiball', function () { saveHeroPortrait(''); });
    }
    function saveHeroPortrait(dataUrl) {
        try { if (dataUrl) localStorage.setItem('guishi_hero_portrait', dataUrl); else localStorage.removeItem('guishi_hero_portrait'); } catch (e) { try { console.warn('[诡事录命盘] 立绘存储失败:', e.message); } catch (x) {} }
        jQuery('#global-guishi-mvu-modal').remove();
        try { populateCharacterData(); } catch (e) {}
    }
    function esc(s) {
        if (s === undefined || s === null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function num(v, def) { var n = Number(v); return isNaN(n) ? (def === undefined ? 0 : def) : n; }
    function encData(obj) { return encodeURIComponent(JSON.stringify(obj)); }
    function decData(str) { try { return JSON.parse(decodeURIComponent(str)); } catch (e) { return null; } }

    /* 章节标题 */
    function secTit(html) { return '<div class="sec-tit">' + html + '</div>'; }
    function emptyHint(msg) { return '<div class="gs-empty">—— ' + msg + ' ——</div>'; }

    /* 小状态条（人物/伴侣卡片内），复刻 miniBars */
    function miniBars(stVals) {
        var colors = ['fill-hp', 'fill-mp', 'fill-st', 'fill-sn'];
        var labels = ['气血', '灵韵', '体魄', '精神'];
        var keys = ['血量', '蓝量', '体力', '精神稳定度'];
        var h = '<div class="mini-bars">';
        for (var i = 0; i < keys.length; i++) {
            var raw = stVals ? stVals[keys[i]] : null;
            var v = 0, txt = '0';
            if (keys[i] === '血量' || keys[i] === '蓝量' || keys[i] === '体力') {
                var c = num(g(stVals, keys[i] + '.当前', 0)), m = num(g(stVals, keys[i] + '.最大', 0));
                v = m > 0 ? Math.max(0, Math.min(100, Math.round(c / m * 100))) : 0;
                txt = c + '/' + m;
            } else {
                v = Math.max(0, Math.min(100, num(raw, 0)));
                txt = String(v);
            }
            h += '<div class="mini-bar"><span class="ml">' + labels[i] + '</span><div class="mt"><div class="mf ' + colors[i] + '" style="width:' + v + '%"></div></div><span class="mn">' + txt + '</span></div>';
        }
        h += '</div>';
        return h;
    }
    /* 好感度条，复刻 makFavRow */
    function favRow(val) {
        var v = Math.max(0, Math.min(100, num(val, 0)));
        var cls = v >= 100 ? 'fav-fill-pink' : 'fav-fill-red';
        return '<div class="fav-row"><div class="ftit">💖 好感度</div><div class="fav-trk"><div class="fav-fill ' + cls + '" style="width:' + v + '%"></div><div class="fav-num">' + v + '/100</div></div></div>';
    }
    /* 弹窗信息行，复刻 makModalRow */
    function modalRow(k, v) {
        var em = EMOJI_MAP[k] || '';
        return '<div class="mod-row"><div class="mk">' + em + ' ' + esc(k) + '</div><div class="mv">' + (function () { var s = v; return (typeof s === 'string' && s.length > 0) ? esc(s) : '—'; })() + '</div></div>';
    }
    /* 弹窗进度行，复刻 makProgRow */
    function modalProgRow(prog) {
        var p = Math.max(0, Math.min(100, num(prog, 0)));
        return '<div class="prog-row"><div class="ptit"><span class="ptit-lbl">📈 进阶进度</span><span class="ptit-num">' + p + '/100</span></div><div class="gs-bar-trk"><div class="gs-bar-fill fill-sn" style="width:' + p + '%"></div></div></div>';
    }
    /* 弹窗内核心能力折叠，复刻 buildModalAbis */
    function buildModalAbis(core) {
        if (!core || typeof core !== 'object' || Object.keys(core).length === 0) return '';
        var keys = Object.keys(core);
        var h = '<div class="sec-tit" style="font-size:17px;margin-top:14px;">📜 核心能力</div>';
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i], v = core[k] || {};
            h += '<details class="abi-det"><summary>✨ ' + esc(k) + '</summary><div class="abi-content">';
            h += modalRow('能力类别', g(v, '类型', '—'));
            h += modalRow('能力描述', g(v, '描述', '—'));
            h += '</div></details>';
        }
        return h;
    }

    var EMOJI_MAP = {
        '姓名': '👤', '年龄': '⏳', '性别': '⚧️', '评级': '🏅', '称号': '🏷️', '身份': '🎭', '所属势力': '🏛️', '外貌': '👁️', '穿着': '👘', '当前状态': '🩸', '所在地': '📍',
        '内心话': '💭', '在场状态': '👣', '与主角关系': '🔗',
        '能力名称': '✨', '能力类别': '🏷️', '能力描述': '📖',
        '物品名称': '📦', '类别': '🏷️', '品级': '⭐', '来源': '📍', '能力': '⚡', '简介': '📝',
        '武器名称': '⚔️', '武器类别': '🏷️', '武器品级': '⭐', '武器来源': '📍', '武器能力': '⚡', '武器简介': '📝'
    };

    function setBarEl(panel, key, pct, txt) {
        var bar = panel.querySelector('[data-bar="' + key + '"]');
        if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
        var n = panel.querySelector('[data-num="' + key + '"]');
        if (n) n.textContent = txt;
    }

    function populateCharacterData() {
        var sd = getStatData();
        var panel = document.getElementById('guishi-ball-panel');
        if (!panel) return;

        /* ===== 立绘 + 状态条 + 四维 + 基本信息（核心信息）===== */
        var hero = g(sd, '主角', {});
        var bi = g(hero, '基本信息', {});
        var imgUrl = g(hero, '图床url', '');
        var portraitUrls = getFinalPortraitUrl(g(bi, '姓名', ''), imgUrl);
        var heroCustom = '';
        try { heroCustom = localStorage.getItem('guishi_hero_portrait') || ''; } catch (e) {}
        var avaBox = panel.querySelector('.gs-top .gs-ava');
        var avaImg = panel.querySelector('.gs-ava-img');
        if (avaBox && avaImg) {
            if (heroCustom) {
                avaImg.src = heroCustom;
                avaBox.classList.remove('empty');
                try { avaImg.dataset.gsUrls = JSON.stringify([heroCustom]); } catch (e) {}
            } else if (portraitUrls.length > 0) {
                avaImg.src = portraitUrls[0];
                avaBox.classList.remove('empty');
                try { avaImg.dataset.gsUrls = JSON.stringify(portraitUrls); } catch (e) {}
            } else {
                avaImg.removeAttribute('src');
                avaBox.classList.add('empty');
            }
        }
        var st = g(hero, '状态值', {});
        var hpC = num(g(st, '血量.当前', 0)), hpM = num(g(st, '血量.最大', 0));
        var mpC = num(g(st, '蓝量.当前', 0)), mpM = num(g(st, '蓝量.最大', 0));
        var stC = num(g(st, '体力.当前', 0)), stM = num(g(st, '体力.最大', 0));
        var mind = Math.max(0, Math.min(100, num(g(st, '精神稳定度', 0))));
        setBarEl(panel, 'hp', hpM > 0 ? hpC / hpM * 100 : 0, hpC + '/' + hpM);
        setBarEl(panel, 'mp', mpM > 0 ? mpC / mpM * 100 : 0, mpC + '/' + mpM);
        setBarEl(panel, 'st', stM > 0 ? stC / stM * 100 : 0, stC + '/' + stM);
        setBarEl(panel, 'sn', mind, String(mind));
        var attrs = g(hero, '战斗面板.属性', {});
        var cbaMap = { str: '力量', vit: '体力', qi: '真气', gan: '感知' };
        for (var ck in cbaMap) {
            var el = panel.querySelector('[data-cba="' + ck + '"]');
            if (el) el.textContent = g(attrs, cbaMap[ck], '—');
        }
        /* 基本信息 info-cell */
        var heroInfo = panel.querySelector('.gs-hero-info');
        if (heroInfo) {
            var ks = ['姓名', '年龄', '性别', '称号', '评级', '身份', '所属势力', '外貌', '穿着', '所在地', '当前状态'];
            var hh = '';
            for (var i = 0; i < ks.length; i++) {
                var v = bi[ks[i]];
                hh += '<div class="info-cell"><div class="ik">' + (EMOJI_MAP[ks[i]] || '') + ' ' + ks[i] + '</div><div class="iv">' + ((typeof v === 'string' && v.length > 0) ? esc(v) : '—') + '</div></div>';
            }
            heroInfo.innerHTML = hh;
        }

        /* ===== 核心能力（card）===== */
        renderAbilityPane(panel, g(hero, '能力列表', {}));
        /* ===== 武装（equip-slot）===== */
        renderEquipPane(panel, g(hero, '装备栏', {}));
        /* ===== 储物（card）===== */
        renderStoragePane(panel, g(hero, '物品栏', {}));
        /* ===== 伴侣（npcframe）===== */
        renderPartnerPane(panel, g(sd, '伴侣', {}));
        /* ===== 人物（npcframe，分在场/不在场）===== */
        renderNpcPane(panel, g(sd, '人物', {}));
        /* ===== 世界情报（论坛 + 邸报）===== */
        renderWorldPane(panel, sd);
        /* ===== 通讯 ===== */
        renderCommPane(panel, g(sd, '通讯', {}));
    }

    /* --- 核心能力 --- */
    function renderAbilityPane(panel, list) {
        var box = panel.querySelector('.gs-ability-pane'); if (!box) return;
        if (!list || typeof list !== 'object' || Object.keys(list).length === 0) { box.innerHTML = emptyHint('暂 无 神 通'); return; }
        var names = Object.keys(list), html = '<div class="card-row">';
        for (var i = 0; i < names.length; i++) {
            var n = names[i], v = list[n] || {};
            var info = { type: 'skill', name: n, 类别: g(v, '类型', '—'), 进阶进度: g(v, '进阶进度', 0), 描述: g(v, '描述', '—') };
            html += '<div class="card gs-click" data-info="' + encData(info) + '"><div class="c-name">✨ ' + esc(n) + '</div></div>';
        }
        html += '</div>';
        box.innerHTML = html;
    }
    /* --- 武装 --- */
    function renderEquipPane(panel, list) {
        var box = panel.querySelector('.gs-equip-pane'); if (!box) return;
        var slots = ['武器', '防具', '法器', '饰品1', '饰品2', '特殊物品'];
        if (!list || typeof list !== 'object') list = {};
        var slotMap = {};
        var keys = Object.keys(list);
        for (var i = 0; i < keys.length; i++) {
            var cat = g(list[keys[i]], '类别', '');
            if (slots.indexOf(cat) >= 0 && !slotMap[cat]) slotMap[cat] = keys[i];
        }
        var hasAny = keys.length > 0;
        if (!hasAny && Object.keys(slotMap).length === 0) {
            /* 数据里没有按 类别 分槽，退化为按物品名直接列出 */
        }
        var html = '<div class="equip-grid">';
        var placed = {};
        for (var s = 0; s < slots.length; s++) {
            var sl = slots[s], n = slotMap[sl];
            if (n) {
                var v = list[n] || {};
                var info = { type: 'equip', name: n, 类别: g(v, '类别', sl), 品级: g(v, '品级', '—'), 来源: g(v, '来源', '—'), 能力: g(v, '能力', '—'), 简介: g(v, '简介', '—') };
                html += '<div class="equip-slot has-item gs-click" data-info="' + encData(info) + '"><div class="equip-slot-title">' + sl + '</div><div class="equip-slot-name">⚔️ ' + esc(n) + '</div></div>';
                placed[n] = true;
            } else {
                html += '<div class="equip-slot empty"><div class="equip-slot-title">' + sl + '</div><div class="equip-slot-name">空 缺</div></div>';
            }
        }
        html += '</div>';
        /* 未归类入固定槽位的装备追加在后面 */
        var extra = '';
        for (var k = 0; k < keys.length; k++) {
            var kn = keys[k];
            if (placed[kn]) continue;
            var vv = list[kn] || {};
            var info2 = { type: 'equip', name: kn, 类别: g(vv, '类别', '—'), 品级: g(vv, '品级', '—'), 来源: g(vv, '来源', '—'), 能力: g(vv, '能力', '—'), 简介: g(vv, '简介', '—') };
            extra += '<div class="equip-slot has-item gs-click" data-info="' + encData(info2) + '" style="margin-top:10px"><div class="equip-slot-title">' + esc(g(vv, '类别', '其它')) + '</div><div class="equip-slot-name">⚔️ ' + esc(kn) + '</div></div>';
        }
        if (extra) html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">' + extra + '</div>';
        if (!hasAny) html = emptyHint('随 身 无 物');
        box.innerHTML = html;
    }
    /* --- 储物 --- */
    function renderStoragePane(panel, list) {
        var box = panel.querySelector('.gs-storage-pane'); if (!box) return;
        if (!list || typeof list !== 'object' || Object.keys(list).length === 0) { box.innerHTML = emptyHint('囊 中 羞 涩'); return; }
        var names = Object.keys(list), html = '<div class="card-row">';
        for (var i = 0; i < names.length; i++) {
            var n = names[i], v = list[n] || {};
            var info = { type: 'bag', name: n, 类别: g(v, '类别', '—'), 品级: g(v, '品级', '—'), 来源: g(v, '来源', '—'), 能力: g(v, '能力', '—'), 简介: g(v, '简介', '—') };
            html += '<div class="card gs-click" data-info="' + encData(info) + '"><div class="c-name">📦 ' + esc(n) + '</div></div>';
        }
        html += '</div>';
        box.innerHTML = html;
    }
    /* --- 人物卡片（伴侣/人物共用）--- */
    function charFrame(icon, n, v) {
        var rel = g(v, '与主角关系', '—');
        var present = g(v, '在场状态', '?');
        var urls = getFinalPortraitUrl(n, g(v, '基本信息.图床url', '') || g(v, '图床url', ''));
        var info = {
            type: 'char', name: n, icon: icon,
            portrait: urls.length ? urls[0] : '',
            姓名: n, 与主角关系: rel, 在场状态: present,
            年龄: g(v, '基本信息.年龄', ''), 性别: g(v, '基本信息.性别', ''), 称号: g(v, '基本信息.称号', ''),
            评级: g(v, '基本信息.评级', ''), 身份: g(v, '基本信息.身份', ''), 所属势力: g(v, '基本信息.所属势力', ''),
            外貌: g(v, '基本信息.外貌', ''), 穿着: g(v, '基本信息.穿着', ''), 当前状态: g(v, '基本信息.当前状态', ''),
            所在地: g(v, '基本信息.所在地', ''), 内心话: g(v, '内心话', ''), 好感度: g(v, '好感度', ''),
            状态值: g(v, '状态值', {}), 核心能力: g(v, '核心能力', {}),
            NSFW数据: g(v, 'NSFW数据', null), NSFW状态: g(v, 'NSFW状态', '')
        };
        return '<div class="npcframe gs-click" data-info="' + encData(info) + '">'
            + '<div class="nf-name">' + icon + ' ' + esc(n) + '</div>'
            + '<div class="nf-sub">👣 ' + esc(present) + ' · <span class="rel-text">🔗 ' + esc(rel) + '</span></div>'
            + miniBars(g(v, '状态值', {}))
            + favRow(g(v, '好感度', 0))
            + '</div>';
    }
    /* --- 伴侣 --- */
    function renderPartnerPane(panel, list) {
        var box = panel.querySelector('.gs-partner-pane'); if (!box) return;
        if (!list || typeof list !== 'object' || Object.keys(list).length === 0) { box.innerHTML = emptyHint('暂 无 红 线'); return; }
        var names = Object.keys(list), html = '';
        for (var i = 0; i < names.length; i++) html += charFrame('💞', names[i], list[names[i]] || {});
        box.innerHTML = html;
    }
    /* --- 人物（在场/不在场）--- */
    function renderNpcPane(panel, list) {
        var box = panel.querySelector('.gs-npc-pane'); if (!box) return;
        if (!list || typeof list !== 'object' || Object.keys(list).length === 0) { box.innerHTML = emptyHint('暂 无 因 果 线'); return; }
        var names = Object.keys(list), pres = [], abs = [];
        for (var i = 0; i < names.length; i++) {
            var n = names[i], stt = String(g(list[n], '在场状态', '不在场'));
            if (stt.indexOf('在场') >= 0 && stt.indexOf('不') < 0) pres.push(n); else abs.push(n);
        }
        var h = '';
        if (pres.length) { h += secTit('🏮 命 轨 交 汇 · 在 场'); for (var p = 0; p < pres.length; p++) h += charFrame('👤', pres[p], list[pres[p]] || {}); }
        if (abs.length) { h += secTit('🌫️ 因 果 未 至 · 不 在 场'); for (var a = 0; a < abs.length; a++) h += charFrame('👤', abs[a], list[abs[a]] || {}); }
        box.innerHTML = h || emptyHint('暂 无 因 果 线');
    }
    /* --- 世界情报（论坛 + 邸报）--- */
    function renderWorldPane(panel, sd) {
        var tEl = panel.querySelector('.gs-world-time'); if (tEl) tEl.textContent = g(sd, '世界.当前时间', '—');
        var box = panel.querySelector('.gs-world-pane'); if (!box) return;
        var inner = g(sd, '里世界论坛', {}), outer = g(sd, '表世界论坛', {});
        var inN = g(sd, '里世界新闻', {}), outN = g(sd, '表世界新闻', {});
        var ik = Object.keys(inner || {}), ok = Object.keys(outer || {});
        var ink = Object.keys(inN || {}), onk = Object.keys(outN || {});
        var h = '';
        var fi = { type: 'forum', side: '内', tit: '🌙 江 湖 论 坛', sub: '暗 面 · ' + ik.length + ' 帖', data: inner };
        var fo = { type: 'forum', side: '外', tit: '☀️ 天 涯 论 坛', sub: '表 世 界 · ' + ok.length + ' 帖', data: outer };
        h += '<div class="forum-block gs-click" data-info="' + encData(fi) + '"><div class="fb-tit">🌙 江 湖 论 坛</div><div class="fb-sub">暗 面 · ' + ik.length + ' 帖</div></div>';
        h += '<div class="forum-block gs-click" data-info="' + encData(fo) + '"><div class="fb-tit">☀️ 天 涯 论 坛</div><div class="fb-sub">表 世 界 · ' + ok.length + ' 帖</div></div>';
        var ni = { type: 'news', side: '内', tit: '🌑 暗 面 新 闻', sub: '里 世 界 诡 闻 · ' + ink.length + ' 条', data: inN };
        var no = { type: 'news', side: '外', tit: '📡 实 时 新 闻', sub: '表 世 界 时 讯 · ' + onk.length + ' 条', data: outN };
        h += '<div class="news-entry gs-click" data-info="' + encData(ni) + '"><div class="news-entry-tit">🌑 暗 面 新 闻</div><div class="news-entry-sub">里 世 界 诡 闻 · ' + ink.length + ' 条 待 阅</div></div>';
        h += '<div class="news-entry gs-click" data-info="' + encData(no) + '"><div class="news-entry-tit">📡 实 时 新 闻</div><div class="news-entry-sub">表 世 界 时 讯 · ' + onk.length + ' 条 待 阅</div></div>';
        box.innerHTML = h;
    }
    /* --- 通讯 --- */
    function renderCommPane(panel, comm) {
        var box = panel.querySelector('.gs-comm-pane'); if (!box) return;
        var priv = g(comm, '私人通讯', {});
        if (!priv || typeof priv !== 'object' || Object.keys(priv).length === 0) { box.innerHTML = '<div class="chat-wrap"><div class="ch">📱 【 私 人 通 讯 · 密 文 】</div><div class="cmsg" style="color:rgba(200,160,80,.5);text-align:center;">暂无通讯记录</div></div>'; return; }
        var ck = Object.keys(priv);
        var h = '<div class="chat-wrap"><div class="ch">📱 【 私 人 通 讯 · 密 文 】</div>';
        for (var i = 0; i < ck.length; i++) {
            var p = ck[i], ms = priv[p] || {};
            var tk = Object.keys(ms);
            for (var j = 0; j < tk.length; j++) {
                h += '<div class="cmsg"><b>👤 ' + esc(p) + '</b> /' + esc(tk[j]) + '/ ：' + esc(ms[tk[j]]) + '</div>';
            }
        }
        h += '</div>';
        box.innerHTML = h;
    }

    /* ====================================================================== */
    /* ============================ 弹窗内容生成 =========================== */
    /* ====================================================================== */
    function buildModal(info) {
        try {
            if (!info || !info.type) return null;
            if (info.type === 'skill') {
                return { title: '✨ 神通·' + info.name, body: '<div class="mod-col">' + modalRow('能力名称', info.name) + modalRow('能力类别', info.类别) + modalProgRow(info.进阶进度) + modalRow('能力描述', info.描述) + '</div>' };
            }
            if (info.type === 'bag') {
                return { title: '📦 囊中物·' + info.name, body: '<div class="mod-col">' + modalRow('物品名称', info.name) + modalRow('类别', info.类别) + modalRow('品级', info.品级) + modalRow('来源', info.来源) + modalRow('能力', info.能力) + modalRow('简介', info.简介) + '</div>' };
            }
            if (info.type === 'equip') {
                return { title: '⚔️ 法器·' + info.name, body: '<div class="mod-col">' + modalRow('武器名称', info.name) + modalRow('武器类别', info.类别) + modalRow('武器品级', info.品级) + modalRow('武器来源', info.来源) + modalRow('武器能力', info.能力) + modalRow('武器简介', info.简介) + '</div>' };
            }
            if (info.type === 'char') {
                var body = '';
                if (info.portrait) body += '<img class="modal-portrait" src="' + esc(info.portrait) + '">';
                body += '<div class="mod-col">';
                var ks2 = ['年龄', '性别', '称号', '评级', '身份', '所属势力', '外貌', '穿着', '当前状态', '所在地'];
                for (var i = 0; i < ks2.length; i++) {
                    var val = info[ks2[i]];
                    if (val !== '' && val != null) body += modalRow(ks2[i], val);
                }
                if (info.与主角关系 && info.与主角关系 !== '—') body += modalRow('与主角关系', info.与主角关系);
                if (info.内心话) body += modalRow('内心话', info.内心话);
                body += '</div>';
                if (info.核心能力 && typeof info.核心能力 === 'object' && Object.keys(info.核心能力).length) body += buildModalAbis(info.核心能力);
                if (info.NSFW数据 && typeof info.NSFW数据 === 'object' && Object.keys(info.NSFW数据).length) {
                    var nk = Object.keys(info.NSFW数据);
                    body += '<div class="nsfw-sect"><div class="nst">【 💋 私 密 档 案 】</div><div class="row2">';
                    for (var n = 0; n < nk.length; n++) body += '<div class="ncell"><span class="nk">🔥 ' + esc(nk[n]) + '</span><span class="nv">' + esc(info.NSFW数据[nk[n]]) + '</span></div>';
                    body += '<div class="ncell" style="grid-column:1/-1"><span class="nk">🌡️ NSFW状态</span><span class="nv">' + esc(info.NSFW状态 || '正常') + '</span></div></div></div>';
                }
                return { title: (info.icon || '🎭') + ' ' + info.name, body: body };
            }
            if (info.type === 'forum') {
                var src = info.data || {};
                var fk = Object.keys(src);
                var fb = '';
                if (!fk.length) fb = '<div class="gs-empty">暂 无 帖 子</div>';
                for (var f = 0; f < fk.length; f++) {
                    var post = src[fk[f]] || {};
                    var content = g(post, '帖子内容', '');
                    var replies = g(post, '评论列表', {});
                    var rk = Object.keys(replies || {});
                    var rh = '';
                    for (var r = 0; r < rk.length; r++) rh += '<div class="fr"><b>' + esc(rk[r]) + '</b>：' + esc(replies[rk[r]]) + '</div>';
                    if (!rh) rh = '<div class="fr" style="color:rgba(200,160,80,.4);">暂无回复</div>';
                    fb += '<div class="fpost-wrap"><div class="fpt">💬 【' + esc(fk[f]) + '】</div><div class="fpb">' + esc(content) + '</div><div class="freply-box"><div style="font-family:var(--ft);font-size:13px;color:rgba(0,200,200,.8);margin-bottom:6px;font-weight:900;text-align:left;">—— 🔽 回 复 ——</div>' + rh + '</div></div>';
                }
                return { title: info.tit, body: fb };
            }
            if (info.type === 'news') {
                var nsrc = info.data || {};
                var nk2 = Object.keys(nsrc);
                var nb = '<div class="news-paper">';
                if (!nk2.length) {
                    nb += '<div class="news-empty">—— 暂 无 异 闻 ——</div>';
                } else {
                    var sub = info.side === '内' ? '里 世 界' : '表 世 界';
                    nb += '<div class="news-paper-hd">📰 ' + sub + ' 诡 闻 · 共 ' + nk2.length + ' 条</div>';
                    for (var nn = 0; nn < nk2.length; nn++) {
                        var raw = nsrc[nk2[nn]];
                        var ncontent = '';
                        if (raw != null) ncontent = typeof raw === 'string' ? raw : (raw['内容'] || raw['content'] || '');
                        nb += '<div class="news-art-tit">' + esc(nk2[nn]) + '</div><div class="news-art-body">' + esc(ncontent) + '</div>';
                    }
                }
                nb += '</div>';
                return { title: info.tit, body: nb };
            }
        } catch (e) { console.warn('[诡事录命盘] buildModal:', e.message); }
        return null;
    }

    /* ====================================================================== */
    /* ============================ 事件绑定 =============================== */
    /* ====================================================================== */
    function bindUIEvents() {
        /* 标签切换 */
        jQuery(document).off('click.guishiball', '.tab-btn').on('click.guishiball', '.tab-btn', function () {
            var container = jQuery(this).closest('#guishi-ball-panel');
            var targetClass = jQuery(this).attr('data-target');
            container.find('.tab-btn').removeClass('active');
            jQuery(this).addClass('active');
            container.find('.tab-content').removeClass('active');
            container.find('.' + targetClass).addClass('active');
        });
        /* 主题切换 */
        jQuery(document).off('click.guishiball', '.btn-dark').on('click.guishiball', '.btn-dark', function () { gsState.theme = 'dark'; applyTheme(); });
        jQuery(document).off('click.guishiball', '.btn-light').on('click.guishiball', '.btn-light', function () { gsState.theme = 'light'; applyTheme(); });
        /* 卡片点击 → 弹窗（统一委托）*/
        jQuery(document).off('click.guishiball', '.gs-click').on('click.guishiball', '.gs-click', function () {
            var info = decData(jQuery(this).attr('data-info'));
            if (!info) return;
            var m = buildModal(info);
            if (m) showGlobalModal(m.title, m.body);
        });
        /* 主角立绘点击放大 */
        jQuery(document).off('click.guishiball', '.gs-ava').on('click.guishiball', '.gs-ava', function (e) {
            e.stopPropagation();
            var img = jQuery(this).find('.gs-ava-img');
            if (!img.length) return;
            try { var urls = JSON.parse(img.attr('data-gs-urls') || '[]'); if (urls.length) { showPortraitViewer(urls[0], ''); return; } } catch (err) {}
            var src = img.attr('src'); if (src) showPortraitViewer(src, '');
        });
        /* 主角立绘自定义按钮（🏮）：打开上传弹窗，支持URL或本地图片（无大小限制）*/
        jQuery(document).off('click.guishiball', '.gs-ava-custom').on('click.guishiball', '.gs-ava-custom', function (e) { e.stopPropagation(); try { openHeroPortraitUp(); } catch (err) {} });
        /* 弹窗内立绘放大 */
        jQuery(document).off('click.guishiball', '.modal-portrait').on('click.guishiball', '.modal-portrait', function (e) {
            e.stopPropagation();
            if (this.src) showPortraitViewer(this.src, '');
        });
    }

    /* ====================================================================== */
    /* ======================= 开/关 / 拖动 / 主题 ========================= */
    /* ====================================================================== */
    function applyTheme() {
        var panel = document.getElementById('guishi-ball-panel');
        if (!panel) return;
        if (gsState.theme === 'light') panel.setAttribute('data-theme', 'light');
        else panel.removeAttribute('data-theme');
        try { localStorage.setItem(window.GUISHI_BALL_CONFIG.storageTheme, gsState.theme); } catch (e) {}
    }
    function isMobile() {
        try { var mm = (GS_PARENT && GS_PARENT.matchMedia) ? GS_PARENT.matchMedia('(max-width: 768px)') : null; if (mm && mm.matches) return true; } catch (e) {}
        var vw = (GS_PARENT && GS_PARENT.innerWidth) || (document.documentElement && document.documentElement.clientWidth) || 1024;
        return vw < 768;
    }
    function openPanel() {
        var p = document.getElementById('guishi-ball-panel'); var b = document.getElementById('guishi-ball');
        if (!p) return;
        if (isMobile()) { p.style.left = ''; p.style.top = ''; p.style.right = ''; p.style.bottom = ''; p.style.margin = ''; }
        else {
            var vw = (GS_PARENT && GS_PARENT.innerWidth) || (document.documentElement && document.documentElement.clientWidth) || 800;
            var vh = (GS_PARENT && GS_PARENT.innerHeight) || (document.documentElement && document.documentElement.clientHeight) || 600;
            var pw = Math.min(470, vw - 4); var ph = Math.min(Math.round(vh * 0.82), 800, vh - 4);
            var br = b ? b.getBoundingClientRect() : null;
            var left = br ? br.left : Math.max(2, vw - pw - 22); var top = br ? br.top : Math.max(2, vh - ph - 22);
            left = Math.max(2, Math.min(vw - pw - 2, left)); top = Math.max(2, Math.min(vh - ph - 2, top));
            p.style.left = left + 'px'; p.style.top = top + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto';
        }
        p.classList.add('open'); if (b) b.style.display = 'none'; gsState.open = true;
        try { localStorage.setItem(window.GUISHI_BALL_CONFIG.storageOpen, '1'); } catch (e) {}
        try { populateCharacterData(); } catch (e) {}
        try { setupPanelDrag(); } catch (e) {}
    }
    function closePanel() {
        var p = document.getElementById('guishi-ball-panel'); var b = document.getElementById('guishi-ball');
        if (p) {
            if (!isMobile() && b) {
                var vw = (GS_PARENT && GS_PARENT.innerWidth) || (document.documentElement && document.documentElement.clientWidth) || 800;
                var vh = (GS_PARENT && GS_PARENT.innerHeight) || (document.documentElement && document.documentElement.clientHeight) || 600;
                var r = p.getBoundingClientRect(); var size = b.offsetWidth || 60;
                var bl = Math.max(2, Math.min(vw - size - 2, r.left)); var bt = Math.max(2, Math.min(vh - size - 2, r.top));
                b.style.left = bl + 'px'; b.style.top = bt + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto';
                try { localStorage.setItem(window.GUISHI_BALL_CONFIG.storageBallPos, bl + ',' + bt); } catch (e) {}
            }
            p.classList.remove('open');
        }
        if (b) b.style.display = 'flex'; gsState.open = false;
        try { localStorage.setItem(window.GUISHI_BALL_CONFIG.storageOpen, '0'); } catch (e) {}
    }
    function setupBallDrag() {
        var ball = document.getElementById('guishi-ball');
        if (!ball || ball.dataset.guishiDragBound) return;
        ball.dataset.guishiDragBound = '1';
        var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, moved = false;
        var setBallPos = function (l, t) {
            try {
                ball.style.setProperty('right', 'auto', 'important');
                ball.style.setProperty('bottom', 'auto', 'important');
                ball.style.setProperty('left', l + 'px', 'important');
                ball.style.setProperty('top', t + 'px', 'important');
            } catch (e) {}
        };
        var move = function (e) {
            if (!dragging) return;
            var p = e.touches ? e.touches[0] : e;
            var dx = p.clientX - sx, dy = p.clientY - sy;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                moved = true;
                var size = ball.offsetWidth || 60;
                var vw = (GS_PARENT && GS_PARENT.innerWidth) || (document.documentElement && document.documentElement.clientWidth) || 800;
                var vh = (GS_PARENT && GS_PARENT.innerHeight) || (document.documentElement && document.documentElement.clientHeight) || 600;
                setBallPos(Math.max(2, Math.min(vw - size - 2, ox + dx)), Math.max(2, Math.min(vh - size - 2, oy + dy)));
            }
            if (e.touches && e.cancelable) e.preventDefault();
        };
        var up = function () {
            dragging = false;
            document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
            document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
            setTimeout(function () { moved = false; }, 50);
        };
        var down = function (e) {
            var p = e.touches ? e.touches[0] : e;
            sx = p.clientX; sy = p.clientY;
            var r = ball.getBoundingClientRect(); ox = r.left; oy = r.top;
            dragging = true;
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
            document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
        };
        ball.addEventListener('mousedown', down); ball.addEventListener('touchstart', down, { passive: false });
        ball.addEventListener('click', function () { if (!moved) openPanel(); });
        try {
            var pos = localStorage.getItem(window.GUISHI_BALL_CONFIG.storageBallPos);
            if (pos) { var arr = pos.split(','); if (arr.length === 2) { var lx = parseInt(arr[0], 10), ty = parseInt(arr[1], 10); if (!isNaN(lx) && !isNaN(ty)) setBallPos(lx, ty); } }
        } catch (e) {}
    }
    function setupPanelDrag() {
        var panel = document.getElementById('guishi-ball-panel');
        if (!panel) return;
        var header = panel.querySelector('.gs-panel-header');
        if (!header || header.dataset.guishiDragBound) return;
        header.dataset.guishiDragBound = '1';
        var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        var down = function (e) {
            if (e.target && e.target.closest && e.target.closest('.gs-close-btn, .gs-theme-controls')) return;
            if (isMobile()) return;
            var p = e.touches ? e.touches[0] : e;
            sx = p.clientX; sy = p.clientY;
            var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
            dragging = true;
            document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
            document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
            if (e.touches) e.preventDefault();
        };
        var move = function (e) {
            if (!dragging) return;
            var p = e.touches ? e.touches[0] : e;
            var dx = p.clientX - sx, dy = p.clientY - sy;
            var vw = (GS_PARENT && GS_PARENT.innerWidth) || (document.documentElement && document.documentElement.clientWidth) || 800;
            var vh = (GS_PARENT && GS_PARENT.innerHeight) || (document.documentElement && document.documentElement.clientHeight) || 600;
            var pw = panel.offsetWidth, ph = panel.offsetHeight;
            var nl = Math.max(2, Math.min(vw - pw - 2, ox + dx)), nt = Math.max(2, Math.min(vh - ph - 2, oy + dy));
            panel.style.left = nl + 'px'; panel.style.top = nt + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
            if (e.touches && e.cancelable) e.preventDefault();
        };
        var up = function () { dragging = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up); };
        header.addEventListener('mousedown', down); header.addEventListener('touchstart', down, { passive: false });
    }

    /* ====================================================================== */
    /* ============================ 初始化 ================================= */
    /* ====================================================================== */
    function reInjectGuard() {
        if (!document.getElementById('guishi-ball') || !document.getElementById('guishi-ball-panel')) {
            try { console.warn('[诡事录命盘] 检测到元素丢失，重新注入'); guishiBallMain(); bindUIEvents(); setupBallDrag(); applyTheme(); } catch (e) { console.error('[诡事录命盘] 重新注入失败:', e); }
        }
    }

    function init() {
        bindUIEvents();
        setupBallDrag();
        applyTheme();
        jQuery(document).on('click.guishiball', '.gs-close-btn', closePanel);
        jQuery(document).on('click.guishiball', '.gs-tab-rail .tab-btn', function () {
            try { localStorage.setItem(window.GUISHI_BALL_CONFIG.storageTab, jQuery(this).attr('data-target')); } catch (e) {}
        });
        try { populateCharacterData(); } catch (e) { console.error('[诡事录命盘] 渲染失败:', e); }
        /* 恢复保存的标签 */
        try {
            var savedTab = localStorage.getItem(window.GUISHI_BALL_CONFIG.storageTab);
            if (savedTab) { var btn = document.querySelector('#guishi-ball-panel .gs-tab-rail .tab-btn[data-target="' + savedTab + '"]'); if (btn) jQuery(btn).trigger('click.guishiball'); }
        } catch (e) {}
        /* 恢复打开状态 */
        try { if (localStorage.getItem(window.GUISHI_BALL_CONFIG.storageOpen) === '1') openPanel(); } catch (e) {}

        /* 轮询渲染（首 8 次） */
        var count = 0;
        var poll = setInterval(function () { try { populateCharacterData(); reInjectGuard(); } catch (e) {} if (++count > 8) clearInterval(poll); }, 600);

        /* 防抖 + 事件订阅（Mvu VARIABLE_UPDATE_ENDED + 酒馆 MESSAGE_RECEIVED） */
        var debounced = (function () { var t = null; return function () { if (t) clearTimeout(t); t = setTimeout(function () { try { populateCharacterData(); } catch (e) {} t = null; }, 400); }; })();
        try {
            if (typeof eventOn !== 'undefined') {
                var win = getMvuGlobal();
                if (win && win.Mvu && win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED) eventOn(win.Mvu.events.VARIABLE_UPDATE_ENDED, debounced);
                else if (typeof Mvu !== 'undefined' && Mvu.events && Mvu.events.VARIABLE_UPDATE_ENDED) eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, debounced);
                if (typeof tavern_events !== 'undefined' && tavern_events.MESSAGE_RECEIVED) eventOn(tavern_events.MESSAGE_RECEIVED, debounced);
            }
        } catch (e) { console.warn('[诡事录命盘] 事件订阅失败:', e); }

        /* 长周期重新注入守护（每 15s 检查一次元素是否丢失） */
        setInterval(function () { try { reInjectGuard(); } catch (e) {} }, 15000);

        try { console.log('%c[诡事录命盘] ✅ 初始化完成', 'color:#86efac;font-weight:bold'); } catch (e) {}
    }

    /* ====================================================================== */
    /* ====================== 引导：等待 jQuery + body ===================== */
    /* ====================================================================== */
    (function guishiBallBootstrap() {
        if ($ && document.body) {
            try { console.log('[诡事录命盘] 启动初始化...'); guishiBallMain(); init(); }
            catch (e) { console.error('[诡事录命盘] ❌ 启动错误:', e); }
        } else {
            try { console.warn('[诡事录命盘] 等待就绪: jQuery?', !!$, 'body?', !!(document && document.body)); } catch (e) {}
            setTimeout(guishiBallBootstrap, 200);
        }
    })();

    /* 卸载时清理 */
    try {
        jQuery(window).on('unload.guishiball', function () {
            jQuery('#guishi-ball, #guishi-ball-panel, #guishi-ball-style, #guishi-portrait-viewer, #global-guishi-mvu-modal, #global-guishi-sub-modal').remove();
            jQuery(document).off('.guishiball');
        });
    } catch (e) {}
})();
