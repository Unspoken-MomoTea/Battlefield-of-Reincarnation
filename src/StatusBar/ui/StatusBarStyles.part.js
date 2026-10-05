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
            width: 470px; max-width: 94vw; height: 82vh; height: 82dvh; max-height: 800px; min-height: 280px;
            display: none; flex-direction: column;
            background: var(--sam-bg); border: 1px solid var(--sam-border); border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.3);
            backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            color: var(--sam-text); font-family: 'Segoe UI', system-ui, sans-serif; overflow: hidden;
        }
        /* 中等屏幕: 居中显示(不贴右) */
        @media (max-width: 1100px) and (min-width: 769px) {
            #samsara-panel {
                left: 0 !important; right: 0 !important; margin: 0 auto !important;
                top: 6% !important;
            }
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
        .sam-reincarnator { display:flex; padding:8px 12px; gap:10px; border-bottom:1px solid var(--sam-border); flex-shrink:0; align-items:center; }
        .sam-reincarnator-left { display:flex; align-items:center; gap:10px; flex:0 1 auto; min-width:0; }
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
        .sam-reincarnator-text { display:flex; flex-direction:column; min-width:0; flex:1 1 auto; gap:5px; }
        /* 战斗状态徽章: 红色脉冲, 平时不渲染(由JS按 是否战斗中 输出) */
        .sam-reincarnator-combat { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:bold; color:#fff; background:linear-gradient(135deg, rgba(228,88,125,0.92), rgba(170,38,66,0.9)); border:1px solid var(--sam-hp); border-radius:10px; padding:2px 10px; letter-spacing:0.5px; box-shadow:0 0 8px rgba(228,88,125,0.5); animation:samCombatPulse 1.4s ease-in-out infinite; }
        @keyframes samCombatPulse { 0%,100% { box-shadow:0 0 7px rgba(228,88,125,0.45); } 50% { box-shadow:0 0 16px rgba(228,88,125,0.85); } }
        /* 层级: 品质描边徽章(文字色由 .q-X 提供, 边框跟随 currentColor) - 独立成行
           固定深色底保证浅色主题下浅色品质文字(F/E)依旧高对比可读 */
        .sam-reincarnator-tier { align-self:flex-start; display:inline-flex; align-items:baseline; font-weight:900; line-height:1; color:var(--sam-accent); padding:3px 12px; border:2px solid currentColor; border-radius:9px; background:rgba(15,18,28,0.78); box-shadow:0 1px 4px rgba(0,0,0,0.35), inset 0 0 8px rgba(0,0,0,0.3); }
        .sam-reincarnator-tier-num { font-size:19px; text-shadow:0 1px 2px rgba(0,0,0,0.65); }
        .sam-reincarnator-tier-suf { font-size:11px; opacity:0.8; margin-left:1px; text-shadow:0 1px 2px rgba(0,0,0,0.65); }
        /* 种族: 次要标签 - 独立成行 */
        .sam-reincarnator-race { align-self:flex-start; display:inline-flex; align-items:center; font-size:12px; font-weight:bold; color:var(--sam-text); line-height:1.2; padding:3px 9px; background:rgba(255,255,255,0.05); border:1px solid var(--sam-border); border-radius:8px; }
        /* 形态: 金色发光标签 */
        .sam-reincarnator-form { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:bold; color:var(--sam-thp); line-height:1.2; padding:2px 9px; background:rgba(229,193,102,0.1); border:1px solid rgba(229,193,102,0.4); border-radius:8px; box-shadow:0 0 7px rgba(229,193,102,0.18); }
        .sam-reincarnator-form-name { font-size:13px; }
        /* 右侧HP/EP/THP三排 */
        /* 右侧HP/EP/THP三排 */
        .sam-reincarnator-bars { 
            flex: 1 1 auto;             /* 允许伸缩，自动填充剩余空间 */
            display: flex; 
            flex-direction: column; 
            gap: 5px; 
            min-width: 150px;           /* 设定一个最小宽度，防止被左侧挤没 */
            max-width: 210px;           /* 👈 核心修改：将最大宽度限制在 200px 左右，这就是黄金比例 */
            margin-left: auto;          /* 把它推到最右侧 */
        }
        .sam-reincarnator-bars .stat-bar-box { min-width: 0; }
        .stat-labels { display:flex; justify-content:space-between; font-size:11px; font-weight:bold; margin-bottom:2px; color:var(--sam-sub); }
        .bar-track { width:100%; height:13px; background:var(--sam-dark); border-radius:6px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.08); }
        .bar-fill { height:100%; position:absolute; top:0; left:0; border-radius:6px; transition:width 0.5s cubic-bezier(0.2,0.8,0.2,1); }
        .fill-hp { background:var(--sam-hp); z-index:1; }
        .fill-thp { background:var(--sam-thp); z-index:2; opacity:0.85; box-shadow:0 0 6px var(--sam-thp); }
        .fill-ep { background:var(--sam-ep); }
        .fill-thp2 { background:var(--sam-thp); }
        /* THP行(顶部角色): 临时护盾/额外生命值, 无进度条, 外框包裹, 略向下偏移 */
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
        /* 进阶按钮: 由辅助计算脚本维护的“是否可试炼”控制；源力灌注与申请进阶并列。 */
        .sam-tier-actions { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:4px; }
        .sam-tier-adv-btn, .sam-tier-infuse-btn { padding:5px 14px; font-size:12px; font-weight:900; border:1px solid; border-radius:6px; cursor:pointer; transition:all 0.18s; letter-spacing:1px; }
        .sam-tier-adv-btn.apply { border-color:#7a1f1f; color:#e04848; background:rgba(122,31,31,0.18); text-shadow:0 0 4px rgba(224,72,72,0.5); }
        .sam-tier-adv-btn.apply:hover { background:#7a1f1f; color:#fff; box-shadow:0 0 10px rgba(224,72,72,0.7); }
        .sam-tier-adv-btn.start { margin-top:4px; align-self:flex-start; border-color:#d4af37; color:#fff7d6; background:linear-gradient(135deg, rgba(212,175,55,0.25), rgba(255,247,214,0.12)); text-shadow:0 0 5px rgba(255,247,214,0.8); box-shadow:0 0 8px rgba(212,175,55,0.5); }
        .sam-tier-adv-btn.start:hover { background:linear-gradient(135deg, #d4af37, #fff7d6); color:#2a2300; box-shadow:0 0 14px rgba(255,247,214,0.9); }
        .sam-tier-infuse-btn { border-color:#7c5cff; color:#c9c0ff; background:rgba(124,92,255,0.14); text-shadow:0 0 5px rgba(124,92,255,0.55); }
        .sam-tier-infuse-btn:hover { background:#7c5cff; color:#fff; box-shadow:0 0 12px rgba(124,92,255,0.75); }
        .sam-tier-prog.npc { margin:7px 0 3px; padding:6px 8px; }
        .sam-tier-prog.npc .sam-tier-side { font-size:15px; min-width:28px; }
        .sam-tier-prog.npc .sam-tier-bar { height:11px; }
        /* 副本成就: 已达成卡片金色描边高亮 + 头部达成徽章 */
        .sam-ach-item.done .sam-full-card { border-left-color:#d4af37; box-shadow:0 0 8px rgba(212,175,55,0.25); }
        .sam-ach-item.done .sam-fc-title { color:var(--sam-thp, #e5c166); }
        .sam-ach-done-chip { flex:0 0 auto; font-size:10px; font-weight:900; color:#d4af37; border:1px solid rgba(212,175,55,0.55); background:rgba(212,175,55,0.12); border-radius:8px; padding:1px 8px; white-space:nowrap; letter-spacing:0.5px; }
        /* 血统/形态/技能卡片删除按钮: 编辑模式显示在卡片头部右侧 */
        .sam-fc-del-btn { margin-left:auto; width:22px; height:22px; flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; font-size:13px; line-height:1; cursor:pointer; color:var(--sam-hp); background:rgba(228,72,72,0.12); border:1px solid rgba(228,72,72,0.45); border-radius:6px; transition:all 0.18s; }
        .sam-fc-del-btn:hover { background:var(--sam-hp); color:#fff; box-shadow:0 0 8px rgba(228,72,72,0.6); }
        @media (max-width:768px) {
            /* 手机端 tier 进度条紧凑化(面板主适配规则在下方 @media max-width:768px 统一处理) */
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
        .sam-shop-credential-mini { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:5px; padding:5px 8px; margin-bottom:6px; background:rgba(143,159,255,0.06); border:1px solid var(--sam-border); border-radius:8px; font-size:11px; line-height:1.25; }
        .sam-shop-credential-mini .lbl { color:var(--sam-sub); margin-right:2px; }
        .sam-shop-credential-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border:1px solid var(--sam-border); border-radius:10px; color:var(--sam-accent); background:var(--sam-card); font-weight:800; }
        .sam-shop-credential-empty { color:var(--sam-sub); opacity:0.75; }
        .sam-shop-warn { font-size:12px; color:var(--sam-hp); padding:8px 10px; background:rgba(228,88,125,0.10); border:1px solid rgba(228,88,125,0.35); border-radius:6px; margin-bottom:8px; line-height:1.5; }
        .sam-shop-ok { font-size:12px; color:#56bf7b; padding:8px 10px; background:rgba(86,191,123,0.10); border:1px solid rgba(86,191,123,0.35); border-radius:6px; margin-bottom:8px; line-height:1.5; }
        /* 商城入口: 输入框独占一排(手机端不被挤窄); 目标下拉框 + 刷新按钮占下一排 */
        .sam-shop-entry { display:flex; flex-direction:column; gap:8px; }
        .sam-shop-entry .sam-shop-req { width:100%; box-sizing:border-box; background:var(--sam-input-bg, rgba(0,0,0,0.25)); border:1px solid var(--sam-border); border-radius:6px; padding:8px 10px; font-size:12px; color:var(--sam-fg, #d1d8e0); outline:none; transition:border-color 0.15s, box-shadow 0.15s; }
        .sam-shop-entry .sam-shop-req:focus { border-color:var(--sam-thp, #e5c166); box-shadow:0 0 0 2px rgba(229,193,102,0.18); }
        .sam-shop-entry .sam-shop-req::placeholder { color:var(--sam-sub, #7a8499); opacity:0.9; }
        .sam-shop-entry-actions { display:flex; align-items:stretch; gap:8px; flex-wrap:wrap; }
        .sam-shop-refresh-btn { flex:1 1 auto; display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:0 14px; border:1px solid rgba(229,193,102,0.5); border-radius:6px; background:linear-gradient(135deg, rgba(212,175,55,0.18), rgba(255,247,214,0.08)); color:var(--sam-thp, #e5c166); font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap; transition:transform 0.15s, box-shadow 0.15s, background 0.15s; }
        .sam-shop-refresh-btn:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(229,193,102,0.25); background:linear-gradient(135deg, rgba(212,175,55,0.28), rgba(255,247,214,0.14)); }
        .sam-shop-refresh-btn:active { transform:translateY(0); }
        .sam-shop-refresh-btn[disabled] { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
        /* ★ 多角色商城: 目标角色下拉框 */
        .sam-shop-entry .sam-shop-actor-select { flex:0 0 auto; min-width:92px; max-width:140px; background:var(--sam-input-bg, rgba(0,0,0,0.25)); border:1px solid var(--sam-border); border-radius:6px; padding:6px 8px; font-size:12px; color:var(--sam-fg, #d1d8e0); outline:none; cursor:pointer; }
        .sam-shop-actor-select:focus { border-color:var(--sam-thp, #e5c166); box-shadow:0 0 0 2px rgba(229,193,102,0.18); }
        .sam-shop-actor-select[disabled] { opacity:0.5; cursor:not-allowed; }
        .sam-shop-actor-label { flex:0 0 auto; align-self:center; font-size:11px; color:var(--sam-sub, #7a8499); white-space:nowrap; }
        /* "停止刷新"按钮: 仅在刷新中表示层显示, 用于打破卡死的AI请求 */
        .sam-shop-stop-btn { margin-top:4px; padding:7px 14px; border:1px solid rgba(228,72,72,0.55); border-radius:6px; background:linear-gradient(135deg, rgba(228,72,72,0.18), rgba(255,180,180,0.06)); color:#ffb3b3; font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap; transition:transform 0.15s, box-shadow 0.15s, background 0.15s; }
        .sam-shop-stop-btn:hover { transform:translateY(-1px); box-shadow:0 3px 8px rgba(228,72,72,0.28); background:linear-gradient(135deg, rgba(228,72,72,0.28), rgba(255,180,180,0.12)); }
        .sam-shop-stop-btn:active { transform:translateY(0); }
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
        .sam-hold-tab { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:8px 4px 7px; background:var(--sam-card); border:1px solid var(--sam-border); border-radius:10px; cursor:pointer; transition:all 0.18s; position:relative; overflow:visible; line-height:1.1; }
        .sam-hold-tab:hover { border-color:var(--sam-accent); transform:translateY(-1px); }
        .sam-hold-tab.active { background:linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.04)); border-color:var(--sam-accent); box-shadow:0 0 0 1px var(--sam-border), 0 0 12px rgba(0,0,0,0.18); }
        .sam-hold-tab .sam-hold-tab-ico { font-size:17px; line-height:1; filter:grayscale(0.35); transition:filter 0.18s; }
        .sam-hold-tab.active .sam-hold-tab-ico { filter:grayscale(0); }
        .sam-hold-tab .sam-hold-tab-lbl { font-size:11px; color:var(--sam-text); white-space:nowrap; transition:color 0.18s; }
        .sam-hold-tab.active .sam-hold-tab-lbl { color:var(--sam-accent); font-weight:bold; }
        .sam-hold-tab .sam-hold-tab-cnt { position:absolute; top:-5px; right:-4px; min-width:16px; height:16px; padding:0 4px; font-size:10px; font-weight:bold; line-height:16px; text-align:center; color:var(--sam-dark); background:var(--sam-accent); border-radius:9px; box-shadow:0 0 6px color-mix(in srgb, var(--sam-accent) 45%, transparent); }
        .sam-hold-tab .sam-hold-tab-cnt:empty, .sam-hold-tab .sam-hold-tab-cnt.zero { display:none; }
        /* 持有面板专属分类行: 每个子Tab下方按物品类型二次筛选(全部+已有类型); 背包为空时内容为空不占位 */
        .sam-hold-types-wrap:empty { display:none; margin:0; padding:0; }
        /* 分类行: 强制单行横向滚动(类型再多也不换行/不竖排), 左右留padding避免首尾胶囊阴影被裁切 */
        .sam-hold-types { display:flex; flex-wrap:nowrap; gap:4px; padding:2px 10px 8px; margin-bottom:4px; border-bottom:1px dashed var(--sam-border); overflow-x:auto; overflow-y:hidden; flex-shrink:0; -webkit-overflow-scrolling:touch; }
        /* 注意: 此处不可写 scrollbar-width(thin等), Chromium 121+ 会因此忽略 ::-webkit-scrollbar 自定义样式而回退系统灰滚动条 */
        .sam-hold-types::-webkit-scrollbar { height:4px; }
        .sam-hold-types::-webkit-scrollbar-track { background:transparent; }
        .sam-hold-types::-webkit-scrollbar-thumb { background:var(--sam-border); border-radius:2px; }
        .sam-hold-type { flex:0 0 auto; display:inline-flex; align-items:center; gap:3px; padding:3px 10px; font-size:11px; color:var(--sam-sub); background:transparent; border:1px solid transparent; border-radius:12px; cursor:pointer; white-space:nowrap; transition:all 0.15s; line-height:1.2; }
        .sam-hold-type:hover { color:var(--sam-accent); }
        .sam-hold-type.active { color:#0d1220; background:var(--sam-accent); border-color:var(--sam-accent); box-shadow:0 0 10px color-mix(in srgb, var(--sam-accent) 35%, transparent); font-weight:bold; }
        .sam-hold-type .sam-hold-type-cnt { font-size:10px; opacity:0.75; }
        /* 持有面板内容区 */
        .sam-hold-content { padding:2px 2px 6px; }
        .sam-hold-hint { display:inline-flex; align-items:center; gap:4px; font-size:10px; color:var(--sam-sub); background:rgba(0,0,0,0.25); border:1px solid var(--sam-border); border-radius:10px; padding:2px 9px; margin-bottom:8px; opacity:0.85; }
        /* 上方归类Tab条 + 中部list(滚动) + 底部购物车栏(常驻) 三段式固定布局 */
        .sam-shop-market { display:flex; flex-direction:column; gap:0; flex:1; min-height:0; }
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
        /* 血统融合进行中: 🧬 放大缩小缓动(非旋转), 与商城刷新的旋转图标区分 */
        .sam-fusion-pulse { display:inline-block; font-size:26px; line-height:1; transform-origin:center; animation:samFusionPulse 1.4s ease-in-out infinite; }
        @keyframes samFusionPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.25); } }
        /* 商品卡片(参考 开局.html .item-card 选中/禁用模式) */
        .sam-shop-item { background:var(--sam-card); border:1px solid var(--sam-border); border-radius:8px; padding:10px; cursor:pointer; transition:all 0.15s; position:relative; overflow:visible; }
        .sam-shop-item::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--sam-border); opacity:0; transition:opacity 0.15s; border-radius:8px 0 0 8px; }
        .sam-shop-item:hover:not(.disabled) { border-color:var(--sam-accent); transform:translateY(-1px); }
        .sam-shop-item:hover:not(.disabled)::before { opacity:0.6; }
        /* 选中态: 边框亮起(主题主色) + 辉光 + 左条加粗 */
        .sam-shop-item.selected { background:linear-gradient(180deg, var(--sam-card), rgba(0,0,0,0.04)); border-color:var(--sam-accent); box-shadow:0 0 0 1px var(--sam-border), 0 0 12px rgba(0,0,0,0.18); }
        .sam-shop-item.selected::before { background:var(--sam-accent); opacity:1; width:4px; }
        /* 右下角"已选"角标(默认隐藏, 选中时显示) */
        .sam-shop-item .sam-shop-sel-corner { position:absolute; right:-1px; bottom:-1px; background:var(--sam-accent); color:var(--sam-dark); font-size:10px; font-weight:bold; padding:2px 8px; border-top-left-radius:6px; border-bottom-right-radius:8px; box-shadow:0 0 6px rgba(0,0,0,0.25); display:none; letter-spacing:0.5px; line-height:1.4; }
        .sam-shop-item.selected .sam-shop-sel-corner { display:block; }
        /* 禁用态(余额不足): 灰调 + 不可点击 + hover无变化 */
        .sam-shop-item.disabled { opacity:0.45; cursor:not-allowed; filter:grayscale(0.7); }
        .sam-shop-item.disabled:hover { transform:none; box-shadow:none; border-color:var(--sam-border); }
        .sam-shop-item.disabled:hover::before { opacity:0; }
        .sam-shop-item-head { display:flex; align-items:flex-start; justify-content:space-between; gap:6px; margin-bottom:6px; min-width:0; }
        .sam-shop-item-name { font-weight:bold; font-size:13px; color:var(--sam-text); line-height:1.25; min-width:0; overflow-wrap:anywhere; }
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
        .sam-shop-chip { font-size:10px; padding:1px 6px; border-radius:8px; background:var(--sam-dark); border:1px solid var(--sam-border); color:var(--sam-text); line-height:1.4; }
        .sam-shop-chip b { color:var(--sam-accent); font-weight:normal; }
        .sam-shop-item-detail { font-size:11px; color:var(--sam-text); padding:4px 0 2px; border-top:1px dashed var(--sam-border); line-height:1.5; }
        .sam-shop-item-detail b { color:var(--sam-accent); }
        /* 形态/形态升级 技能子列表: 外层"技能(N)"折叠块(顶部分隔线) + 内层各技能子折叠块 */
        details.sam-shop-sk-list { margin-top:6px; }
        details.sam-shop-sk-list > .sam-fc-collapse-sum { border-top:1px dashed var(--sam-border); padding-top:4px; }
        details.sam-shop-sk-item { margin-bottom:4px; margin-left:6px; }
        details.sam-shop-sk-item > .sam-fc-collapse-sum { color:var(--sam-text); font-size:11px; }
        details.sam-shop-sk-item > .sam-fc-content { padding-left:6px; }
        .sam-shop-item-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:6px; }
        .sam-shop-price { font-size:13px; font-weight:bold; color:var(--sam-thp, #e5c166); text-shadow:0 0 5px rgba(229,193,102,0.4); }
        /* 商城商品卡：结构化分区，效果逐条展示 */
        #samsara-panel .sam-shop-item { display:flex; flex-direction:column; }
        #samsara-panel .sam-shop-section { margin-top:8px; }
        #samsara-panel .sam-shop-section-title { margin-bottom:5px; color:var(--sam-sub); font-size:10.5px; font-weight:700; letter-spacing:.04em; }
        #samsara-panel .sam-shop-basic-block { padding-top:7px; border-top:1px solid color-mix(in srgb,var(--sam-border) 72%,transparent); }
        #samsara-panel .sam-shop-item-attrs { display:flex; flex-wrap:wrap; gap:5px; margin-top:0; }
        #samsara-panel .sam-shop-effect-list { display:grid; gap:6px; }
        #samsara-panel .sam-shop-effect-card { padding:7px 8px; border:1px solid var(--sam-border); border-radius:7px; background:color-mix(in srgb,var(--sam-card) 78%,transparent); }
        #samsara-panel .sam-shop-effect-card-name { margin-bottom:3px; color:var(--sam-text); font-size:11.5px; font-weight:700; line-height:1.35; }
        #samsara-panel .sam-shop-effect-card-text { color:var(--sam-sub); font-size:11.5px; line-height:1.55; white-space:normal; overflow-wrap:anywhere; word-break:break-word; }
        #samsara-panel .sam-shop-description-block { padding:7px 8px; border-left:2px solid color-mix(in srgb,var(--sam-accent) 55%,var(--sam-border)); border-radius:0 6px 6px 0; background:color-mix(in srgb,var(--sam-card) 48%,transparent); }
        #samsara-panel .sam-shop-description-block .sam-shop-section-title { margin-bottom:3px; }
        #samsara-panel .sam-shop-description-text { color:var(--sam-sub); font-size:11.5px; line-height:1.5; white-space:normal; overflow-wrap:anywhere; word-break:break-word; }
        #samsara-panel .sam-shop-item-foot { margin-top:10px; padding-top:8px; border-top:1px solid var(--sam-border); flex-wrap:wrap; }

        .sam-shop-qty { display:flex; align-items:center; gap:2px; }
        .sam-shop-qty-btn { width:22px; height:22px; border:1px solid var(--sam-border); border-radius:4px; background:var(--sam-dark); color:var(--sam-text); font-size:12px; cursor:pointer; line-height:1; }
        .sam-shop-qty-btn:hover { border-color:var(--sam-accent); color:var(--sam-accent); }
        .sam-shop-qty-inp { width:36px; height:22px; text-align:center; border:1px solid var(--sam-border); border-radius:4px; background:var(--sam-dark); color:var(--sam-text); font-size:11px; outline:none; }
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
        .sam-main { position:relative; display:flex; flex:1; min-height:0; overflow:hidden; }
        .sam-main::before { content:""; position:absolute; left:0; top:0; width:58px; height:11px; z-index:4; pointer-events:none; background:linear-gradient(to bottom,var(--sam-dark) 0%,transparent 100%); opacity:.88; }
        .sam-main::after { content:"⌄"; position:absolute; left:0; bottom:0; width:58px; height:20px; z-index:4; pointer-events:none; display:flex; align-items:flex-end; justify-content:center; box-sizing:border-box; padding-bottom:2px; color:var(--sam-sub); font-size:10px; line-height:1; background:linear-gradient(to top,var(--sam-dark) 32%,transparent 100%); opacity:.86; text-shadow:0 1px 2px rgba(0,0,0,.35); }
        .sam-tab-rail { flex:0 0 58px; display:flex; flex-direction:column; border-right:1px solid var(--sam-border); background:var(--sam-dark); overflow-x:hidden; overflow-y:scroll; min-height:0; overscroll-behavior-y:contain; scrollbar-gutter:stable; scrollbar-width:thin; scrollbar-color:var(--sam-border) rgba(255,255,255,.04); touch-action:pan-y; -webkit-overflow-scrolling:touch; }
        .sam-tab-rail > * { flex-shrink:0; }
        .sam-tab-rail::-webkit-scrollbar { width:6px; }
        .sam-tab-rail::-webkit-scrollbar-track { background:rgba(255,255,255,.04); }
        .sam-tab-rail::-webkit-scrollbar-thumb { background:var(--sam-border); border-radius:3px; }
        .sam-tab-rail:hover::-webkit-scrollbar-thumb { background:var(--sam-accent); }
        .sam-tab-btn { flex:0 0 auto; padding:8px 2px; text-align:center; font-size:11px; font-weight:bold; cursor:pointer; border-left:3px solid transparent; color:var(--sam-sub); transition:all 0.2s; line-height:1.2; }
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
.sam-asset-owner-chip { display:inline-flex; align-items:center; max-width:180px; padding:1px 7px; border-radius:9px; border:1px solid var(--sam-border); background:var(--sam-hover); color:var(--sam-text); font-size:10px; line-height:1.5; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sam-asset-owner-chip.player { color:var(--sam-accent); border-color:var(--sam-accent); }
        .sam-asset-owner-chip.unowned { color:var(--sam-sub); border-style:dashed; }
        .sam-asset-owner-list { display:flex; align-items:center; justify-content:flex-end; gap:4px; flex-wrap:wrap; min-width:0; }
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
        .sam-asset-todo-item { font-size:12px; color:var(--sam-text); line-height:1.5; padding:5px 9px 5px 12px; position:relative; background:rgba(229,193,102,0.06); border-radius:5px; border-left:2px solid var(--sam-thp); }
        /* 待办事件可点击: 点击填入输入框 */
        .sam-asset-todo-item.clickable { display:flex; align-items:center; gap:6px; cursor:pointer; transition:background 0.15s, border-color 0.15s; }
        .sam-asset-todo-item.clickable:hover { background:rgba(229,193,102,0.18); border-left-color:var(--sam-hp); }
        .sam-asset-todo-item.clickable:active { transform:scale(0.98); }
        .sam-asset-todo-text { flex:1 1 auto; word-break:break-word; }
        .sam-asset-todo-go { flex:0 0 auto; font-size:11px; opacity:0.45; transition:opacity 0.15s; }
        .sam-asset-todo-item.clickable:hover .sam-asset-todo-go { opacity:1; }
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
        /* 世界稳定度：0~120，100为正常基准线。 */
        .sam-world-stability { padding:8px 0 5px; }
        .sam-world-stability-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:5px; font-size:11px; }
        .sam-world-stability-head .k { color:var(--sam-sub); }
        .sam-world-stability-head .v { color:var(--sam-text); font-weight:900; font-size:12px; }
        .sam-world-stability-track { position:relative; height:12px; border-radius:7px; overflow:hidden; background:rgba(0,0,0,0.3); border:1px solid rgba(143,159,255,0.18); box-shadow:inset 0 1px 4px rgba(0,0,0,0.42); }
        .sam-world-stability-fill { height:100%; min-width:0; border-radius:6px; background:linear-gradient(90deg, var(--sam-hp), var(--sam-accent)); box-shadow:0 0 9px var(--sam-accent); transition:width .25s ease; }
        .sam-world-stability-fill.over { background:linear-gradient(90deg, var(--sam-accent), var(--sam-thp)); box-shadow:0 0 10px var(--sam-thp); }
        .sam-world-stability-mark100 { position:absolute; left:83.333333%; top:-2px; bottom:-2px; width:2px; background:rgba(255,255,255,0.82); box-shadow:0 0 5px rgba(255,255,255,0.65); pointer-events:none; }
        .sam-world-stability-scale { position:relative; height:14px; margin-top:2px; color:var(--sam-sub); font-size:9px; line-height:14px; }
        .sam-world-stability-scale .s0 { position:absolute; left:0; }
        .sam-world-stability-scale .s100 { position:absolute; left:83.333333%; transform:translateX(-50%); color:var(--sam-text); }
        .sam-world-stability-scale .s120 { position:absolute; right:0; }
        .sam-alien-list { display:flex; flex-direction:column; gap:6px; }
        .sam-alien-item { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 9px; border:1px solid rgba(143,159,255,0.12); border-radius:6px; background:rgba(0,0,0,0.14); }
        .sam-alien-main { min-width:0; }
        .sam-alien-name { color:var(--sam-text); font-size:12px; font-weight:800; }
        .sam-alien-meta { margin-top:2px; color:var(--sam-sub); font-size:10.5px; word-break:break-word; }
        .sam-alien-state { flex:0 0 auto; padding:2px 7px; border-radius:9px; font-size:10px; font-weight:800; border:1px solid currentColor; }
        .sam-alien-state.waiting { color:var(--sam-sub); }
        .sam-alien-state.active { color:#56bf7b; background:rgba(86,191,123,0.08); }
        .sam-alien-state.dead { color:var(--sam-hp); opacity:0.7; }
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
        .sam-nd-tier { font-size:13px; font-weight:900; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:rgba(15,18,28,0.78); border:2px solid currentColor; box-shadow:0 1px 3px rgba(0,0,0,0.3); text-shadow:0 1px 2px rgba(0,0,0,0.6); }
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
        /* ===== 武器攻击面板(角色衍生属性 + NPC详情最终属性) ===== */
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
        .sam-npc-loot { position:absolute; top:4px; z-index:2; padding:3px 8px; font-size:10px; font-weight:bold; color:#f87171; background:rgba(248,113,113,0.12); border:1px solid rgba(248,113,113,0.4); border-radius:5px; cursor:pointer; line-height:1.4; white-space:nowrap; }
        .sam-npc-loot:hover { background:rgba(248,113,113,0.28); box-shadow:0 0 8px rgba(248,113,113,0.3); }
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
        .sam-loot-btn { min-height:40px; padding:10px 18px; font-size:13px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid var(--sam-border); transition:all 0.18s; }
        .sam-loot-btn.cancel { background:rgba(143,159,255,0.1); color:var(--sam-text); }
        .sam-loot-btn.cancel:hover { background:rgba(143,159,255,0.22); }
        .sam-loot-btn.confirm { background:rgba(248,113,113,0.15); color:#f87171; border-color:rgba(248,113,113,0.5); }
        .sam-loot-btn.confirm:hover:not(:disabled) { background:rgba(248,113,113,0.4); color:#fff; box-shadow:0 0 10px rgba(248,113,113,0.4); }
        .sam-loot-btn.confirm:disabled { opacity:0.4; cursor:not-allowed; }

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
        .sam-ed-wrap .sam-edit-active[type="textarea"], .sam-ed-wrap textarea.sam-edit-active { width:100%; min-height:90px; resize:vertical; font-family:monospace; line-height:1.5; white-space:pre; }
        /* textarea 多行显示态(保留换行缩进, 避免JSON被折叠成乱码) */
        .sam-ed-wrap.pre-wrap { display:block; }
        .sam-ed-pre { display:block; margin:0; padding:6px 8px; background:var(--sam-hover); border:1px solid var(--sam-border); border-radius:4px; font-family:monospace; font-size:11px; line-height:1.5; white-space:pre-wrap; word-break:break-word; color:var(--sam-text); max-height:240px; overflow:auto; }
        .sam-ed-wrap .sam-edit-active:focus { outline:none; }
        .sam-ed-wrap .sam-edit-active[type="number"] { max-width:90px; }
        /* 在.card-meta等紧凑容器里也保持inline */
        .sam-card-meta .sam-ed-wrap, .sam-card-meta .sam-ed-val { display:inline; }
        .sam-edit-badge { position:fixed; top:8px; right:50%; transform:translateX(50%); background:var(--sam-accent); color:#fff; padding:3px 12px; border-radius:12px; font-size:11px; font-weight:bold; z-index:999999; box-shadow:0 0 10px var(--sam-accent); }
        .sam-save-btn { position:fixed; bottom:10px; left:10px; z-index:999999; padding:3px 9px; border-radius:10px; border:none; background:var(--sam-accent); color:#fff; font-size:10px; font-weight:bold; cursor:pointer; box-shadow:0 1px 6px rgba(0,0,0,0.4); }
        .sam-save-btn:hover { transform:scale(1.05); }
        /* NPC档案(弹窗内)编辑模式: 提示条 + 弹窗内保存按钮(modal 内 fixed 定位仍相对视口, 可用) */
        .sam-nd-edit-tip { margin:10px 0 4px; padding:5px 10px; font-size:11px; color:var(--sam-accent); background:rgba(143,159,255,0.10); border:1px dashed var(--sam-accent); border-radius:6px; text-align:center; }
        .sam-nd-save { position:static; display:block; margin:8px auto 2px; padding:6px 22px; font-size:12px; }
        .sam-nd-save:hover { transform:scale(1.06); }
        /* NPC档案编辑行: 值单元格内嵌编辑控件 */
        .sam-nd-row .v .sam-ed-wrap { font-weight:normal; }
        .sam-npc-bar .num-ed { display:inline-flex; align-items:center; gap:2px; min-width:54px; }
        .sam-npc-bar .num-ed .sam-ed-wrap .sam-ed-val { font-weight:bold; }
        .sam-npc-bar .mx.readonly { color:var(--sam-sub); font-size:11px; }
        /* 头部徽章区内嵌开关: 缩小开关尺寸避免撑爆 */
        .sam-nd-badge.edit-toggle { display:inline-flex; align-items:center; gap:4px; }
        .sam-nd-badge.edit-toggle .sam-toggle-switch { width:30px; height:15px; border-radius:8px; }
        .sam-nd-badge.edit-toggle .sam-toggle-switch .knob { width:11px; height:11px; top:2px; }
        .sam-nd-badge.edit-toggle .sam-toggle-switch.on .knob { left:17px; }
        /* 人物档案文本块内的 textarea 编辑控件占满块宽 */
        .sam-nd-block-ct .sam-ed-wrap { display:block; }
        .sam-nd-block-ct .sam-ed-wrap.pre-wrap { display:block; }
        .sam-nd-block-ct .sam-ed-pre { max-height:180px; }

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
        .sam-card-list.sam-card-list-1col { grid-template-columns:1fr; }
        .sam-card-list > * { min-width:0; }
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
        /* 层级字母(顶部角色层级 / 进度条左右层级 / NPC层级): 按档着色, 与品质徽章同色板 */
        .sam-reincarnator-tier.q-F,.sam-tier-side.q-F,.sam-npc-tier.q-F,.sam-nd-tier.q-F { color:var(--sam-q-f); }
        .sam-reincarnator-tier.q-E,.sam-tier-side.q-E,.sam-npc-tier.q-E,.sam-nd-tier.q-E { color:var(--sam-q-e); }
        .sam-reincarnator-tier.q-D,.sam-tier-side.q-D,.sam-npc-tier.q-D,.sam-nd-tier.q-D { color:var(--sam-q-d); }
        .sam-reincarnator-tier.q-C,.sam-tier-side.q-C,.sam-npc-tier.q-C,.sam-nd-tier.q-C { color:var(--sam-q-c); }
        .sam-reincarnator-tier.q-B,.sam-tier-side.q-B,.sam-npc-tier.q-B,.sam-nd-tier.q-B { color:var(--sam-q-b); }
        .sam-reincarnator-tier.q-A,.sam-tier-side.q-A,.sam-npc-tier.q-A,.sam-nd-tier.q-A { color:var(--sam-q-a); }
        .sam-reincarnator-tier.q-S,.sam-tier-side.q-S,.sam-npc-tier.q-S,.sam-nd-tier.q-S { color:var(--sam-q-s); text-shadow:0 0 4px rgba(234,179,8,0.5); }
        .sam-reincarnator-tier.q-SS,.sam-tier-side.q-SS,.sam-npc-tier.q-SS,.sam-nd-tier.q-SS { color:var(--sam-q-ss); text-shadow:0 0 5px rgba(239,68,68,0.6); }
        .sam-reincarnator-tier.q-SSS,.sam-tier-side.q-SSS,.sam-npc-tier.q-SSS,.sam-nd-tier.q-SSS { color:var(--sam-q-sss); text-shadow:0 0 6px rgba(236,72,153,0.7); }
        /* ★ 职业记录渲染: 折叠面板 {职业名:{类型,特性[],来源}} */
        .sam-occ-panel { margin:4px 0; border:1px solid var(--sam-border); border-radius:8px; background:rgba(143,159,255,0.04); overflow:hidden; }
        .sam-occ-summary { list-style:none; cursor:pointer; padding:8px 10px; font-weight:bold; font-size:13px; color:var(--sam-text); display:flex; align-items:center; gap:8px; flex-wrap:wrap; user-select:none; }
        .sam-occ-summary::-webkit-details-marker { display:none; }
        .sam-occ-summary::before { content:'▸'; font-size:10px; color:var(--sam-sub); display:inline-block; transition:transform .15s; }
        .sam-occ-panel[open] > .sam-occ-summary::before { content:'▾'; }
        .sam-occ-sumtitle { display:inline-flex; align-items:center; }
        .sam-occ-sumcount { font-size:11px; font-weight:normal; color:var(--sam-sub); padding:1px 7px; border-radius:9px; background:rgba(143,159,255,0.10); border:1px solid rgba(143,159,255,0.16); }
        .sam-occ-sumrow { display:inline-flex; flex-wrap:wrap; gap:4px; margin-left:auto; }
        .sam-occ-sumname { font-size:11px; font-weight:normal; padding:1px 4px 1px 8px; border-radius:9px; background:rgba(143,159,255,0.07); border:1px solid rgba(143,159,255,0.14); display:inline-flex; align-items:center; gap:5px; color:var(--sam-text); }
        .sam-occ-sumtype { font-size:9px; font-weight:bold; padding:0 6px; border-radius:7px; border:1px solid; }
        .sam-occ-sumtype.战斗 { color:#e57373; border-color:#e57373; }
        .sam-occ-sumtype.生活 { color:#66bb6a; border-color:#66bb6a; }
        .sam-occ-sumtype.辅助 { color:#7dbde0; border-color:#7dbde0; }
        .sam-occ-body { padding:8px 10px; display:flex; flex-direction:column; gap:8px; border-top:1px dashed var(--sam-border); }
        .sam-occ-card { padding:9px 12px; border:1px solid var(--sam-border); border-left:3px solid var(--sam-accent); border-radius:8px; background:var(--sam-bg); }
        .sam-occ-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .sam-occ-name { font-size:14px; font-weight:bold; color:var(--sam-text); }
        .sam-occ-type { font-size:10px; font-weight:bold; padding:2px 10px; border-radius:10px; border:1px solid; white-space:nowrap; }
        .sam-occ-type.战斗 { color:#e57373; border-color:#e57373; background:rgba(229,115,115,0.14); }
        .sam-occ-type.生活 { color:#66bb6a; border-color:#66bb6a; background:rgba(102,187,106,0.14); }
        .sam-occ-type.辅助 { color:#7dbde0; border-color:#7dbde0; background:rgba(125,189,224,0.14); }
        .sam-occ-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
        .sam-occ-tag { font-size:10px; padding:2px 9px; border-radius:10px; background:rgba(143,159,255,0.10); color:var(--sam-sub); border:1px solid rgba(143,159,255,0.18); }
        .sam-occ-src { font-size:10px; color:var(--sam-sub); margin-top:7px; padding-top:6px; border-top:1px dashed rgba(143,159,255,0.12); display:flex; align-items:center; gap:3px; }
        .sam-occ-inline { display:inline-flex; flex-wrap:wrap; gap:5px; align-items:center; }
        .sam-occ-chip { font-size:11px; padding:2px 4px 2px 8px; border-radius:10px; border:1px solid var(--sam-border); background:rgba(143,159,255,0.05); color:var(--sam-text); display:inline-flex; align-items:center; gap:5px; }
        .sam-occ-chip .sam-occ-sumtype { font-size:9px; padding:1px 5px; border-radius:7px; }
        /* ★ 职业结构化编辑器(编辑模式): 逐职业卡片+类型下拉+特性/来源输入+删除按钮+"添加职业"按钮 */
        .sam-occ-edit { display:flex; flex-direction:column; gap:7px; margin:4px 0; }
        .sam-occ-edit-card { padding:8px 10px; border:1px solid var(--sam-border); border-left:3px solid var(--sam-accent); border-radius:6px; background:rgba(143,159,255,0.04); }
        .sam-occ-edit-head { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
        .sam-occ-edit-row { display:flex; align-items:center; gap:6px; margin-top:4px; }
        .sam-occ-edit-row .k { font-size:11px; color:var(--sam-sub); min-width:32px; text-align:right; white-space:nowrap; }
        .sam-occ-field { flex:1; background:var(--sam-input-bg); border:1px solid var(--sam-border); color:var(--sam-text); padding:3px 6px; border-radius:3px; font-size:12px; min-width:0; }
        .sam-occ-field:focus { outline:none; border-color:var(--sam-accent); box-shadow:0 0 4px var(--sam-accent); }
        .sam-occ-edit-name { font-weight:bold; }
        .sam-occ-edit-type { flex:0 0 auto; min-width:70px; cursor:pointer; }
        .sam-occ-edit-tags { font-size:11px; }
        .sam-occ-edit-src { font-size:11px; }
        .sam-occ-del-btn { flex:0 0 auto; width:24px; height:24px; line-height:22px; text-align:center; border-radius:50%; border:1px solid var(--sam-hp); background:rgba(239,68,68,0.10); color:var(--sam-hp); cursor:pointer; font-size:12px; font-weight:bold; transition:background 0.12s,transform 0.1s; }
        .sam-occ-del-btn:hover { background:var(--sam-hp); color:#fff; transform:translateY(-1px); }
        .sam-occ-del-btn:active { transform:translateY(0); }
        .sam-occ-add-btn { margin-top:6px; padding:5px 12px; font-size:12px; font-weight:bold; border-radius:5px; border:1px dashed var(--sam-accent); background:rgba(143,159,255,0.08); color:var(--sam-accent); cursor:pointer; transition:background 0.12s,transform 0.1s; }
        .sam-occ-add-btn:hover { background:var(--sam-accent); color:#fff; border-style:solid; transform:translateY(-1px); }
        .sam-occ-add-btn:active { transform:translateY(0); }
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
        /* 数值徽章: 自适应多列, 容器变窄时自动从多列降到 1 列, 不再溢出右侧 */
        .sam-stat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(70px,1fr)); gap:4px; margin-top:4px; }
        .sam-stat-cell { text-align:center; padding:3px 2px; background:rgba(0,0,0,0.2); border-radius:3px; }
        /* 容器太窄时(手机/弹窗右栏)强制 2 列, 再窄则 1 列 */
        @media (max-width:480px) { .sam-stat-grid { grid-template-columns:repeat(2,1fr); } }
        @media (max-width:340px) { .sam-stat-grid { grid-template-columns:1fr; } }
        /* 持有面板 / 商城卡片网格: PC 端自动多列(220-260px 一卡), 手机端单列, 避免整宽过大或有空床宽 */
        .sam-list-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:8px; }
        .sam-list-grid .sam-full-card { margin-bottom:0; }
        .sam-list-grid .sam-empty { grid-column:1/-1; }
        @media (max-width:768px) { .sam-list-grid { display:flex; flex-direction:column; gap:6px; } }
        /* 商城持有双栏(装备背包/道具背包 多项时 PC 双栏, 手机单列) */
        .sam-shop-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:8px; }
        .sam-shop-grid .sam-shop-item { margin-bottom:0; }
        @media (max-width:768px) { .sam-shop-grid { display:flex; flex-direction:column; gap:8px; } }
        .sam-stat-cell .sn { font-size:9px; color:var(--sam-sub); }
        .sam-stat-cell .sv { font-size:13px; font-weight:bold; color:var(--sam-text); }

        /* 设置弹窗 */
        .sam-settings-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .sam-theme-card { padding:10px 6px; text-align:center; border-radius:8px; cursor:pointer; border:2px solid transparent; transition:all 0.2s; }
        .sam-theme-card:hover { transform:scale(1.03); }
        .sam-theme-card.active { border-color:var(--sam-accent); box-shadow:0 0 10px var(--sam-accent); }
        .sam-theme-card .swatch { width:100%; height:24px; border-radius:4px; margin-bottom:6px; }
        .sam-theme-card .name { font-size:13px; font-weight:bold; }
        .sam-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-top:1px solid var(--sam-border); }
        .sam-toggle-switch { width:44px; height:22px; border-radius:11px; background:var(--sam-dark); border:1px solid var(--sam-border); position:relative; cursor:pointer; transition:background 0.2s; }
        .sam-toggle-switch.on { background:var(--sam-accent); }
        .sam-toggle-switch .knob { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:left 0.2s; }
        .sam-toggle-switch.on .knob { left:24px; }

        /* ===== MVU 变量更新方式 ===== */
        .sam-varmode-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
        .sam-varmode-btn { width:100%; padding:9px 10px; text-align:left; border:1px solid var(--sam-border); border-radius:7px; background:var(--sam-card); color:var(--sam-text); cursor:pointer; transition:all .16s; font:inherit; }
        .sam-varmode-btn:hover { border-color:var(--sam-accent); transform:translateY(-1px); }
        .sam-varmode-btn.active { border-color:var(--sam-accent); background:rgba(143,159,255,.12); box-shadow:0 0 8px rgba(143,159,255,.18); }
        .sam-varmode-btn[disabled] { opacity:.55; cursor:wait; transform:none; }
        .sam-varmode-btn .ttl { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:900; }
        .sam-varmode-btn .tag { font-size:9px; padding:1px 5px; border:1px solid var(--sam-border); border-radius:7px; color:var(--sam-accent); }
        .sam-varmode-btn .desc { margin-top:4px; font-size:10px; line-height:1.45; color:var(--sam-sub); }
        .sam-varmode-status { min-height:17px; margin-top:6px; font-size:10px; line-height:1.45; color:var(--sam-sub); }
        .sam-varmode-status.ok { color:#56bf7b; }
        .sam-varmode-status.err { color:var(--sam-hp); }
        @media (max-width:520px) { .sam-varmode-grid { grid-template-columns:1fr; } }

        /* ===== API 配置区块(移植自 Zsd网游论坛) ===== */
        .sam-api-section { padding-top:6px; }
        .sam-api-block-label { font-size:12px; font-weight:bold; color:var(--sam-sub); margin:10px 0 4px; }
        .sam-api-field { margin-bottom:6px; }
        .sam-api-field > label { display:block; font-size:11px; color:var(--sam-sub); margin-bottom:2px; }
        .sam-api-input { width:100%; box-sizing:border-box; background:var(--sam-input-bg); border:1px solid var(--sam-border); color:var(--sam-text); padding:5px 8px; border-radius:5px; font-size:12px; outline:none; transition:border-color 0.15s,box-shadow 0.15s; }
        .sam-api-input:focus { border-color:var(--sam-accent); box-shadow:0 0 0 2px rgba(143,159,255,0.18); }
        .sam-api-input::placeholder { color:var(--sam-sub); opacity:0.6; }
        .sam-api-select { width:100%; box-sizing:border-box; background:var(--sam-input-bg); border:1px solid var(--sam-border); color:var(--sam-text); padding:5px 8px; border-radius:5px; font-size:12px; outline:none; cursor:pointer; }
        .sam-api-select:focus { border-color:var(--sam-accent); }
        .sam-api-row { display:flex; gap:6px; align-items:stretch; }
        .sam-api-row > .sam-api-input,
        .sam-api-row > .sam-api-select { flex:1 1 auto; min-width:0; }
        .sam-api-btn { flex:0 0 auto; padding:5px 10px; font-size:11px; font-weight:bold; border-radius:5px; border:1px solid var(--sam-border); background:rgba(143,159,255,0.12); color:var(--sam-text); cursor:pointer; transition:background 0.15s,border-color 0.15s,transform 0.1s; white-space:nowrap; }
        .sam-api-btn:hover { background:var(--sam-accent); border-color:var(--sam-accent); color:#fff; transform:translateY(-1px); }
        .sam-api-btn:active { transform:translateY(0); }
        .sam-api-btn.danger { border-color:var(--sam-hp); color:var(--sam-hp); background:rgba(228,88,125,0.12); }
        .sam-api-btn.danger:hover { background:var(--sam-hp); color:#fff; }
        .sam-api-btn.save { border-color:#27ae60; color:#2ecc71; background:rgba(46,204,113,0.12); }
        .sam-api-btn.save:hover { background:#27ae60; color:#fff; }
        .sam-api-btn[disabled] { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
        .sam-api-status { font-size:11px; color:var(--sam-sub); margin-top:2px; line-height:1.4; }
        .sam-api-status.warn { color:var(--sam-thp); }
        .sam-api-status.err { color:var(--sam-hp); }
        .sam-api-status.ok { color:#56bf7b; }

        @media (max-width:768px) {
            #samsara-ball { top:calc(70px + env(safe-area-inset-top, 0px)) !important; bottom:auto !important; right:calc(16px + env(safe-area-inset-right, 0px)) !important; width:30px !important; height:30px !important; }
            /* 手机端：上下贴边自适应固定视口，内部由 .sam-tab-content 滚动 */
            /* 手机端: 上下贴边自适应固定视口, 内部由 .sam-tab-content 滚动。
               优先用 100dvh(动态视口高度)以避开浏览器地址栏/底部工具栏遮挡;
               不支持 dvh 的浏览器自动回退到 100vh 版本。同时显式给出 top/bottom,
               便于被 env(safe-area-inset-*) 兜住任务栏安全区。 */
            #samsara-panel {
                top: calc(8px + env(safe-area-inset-top, 0px)) !important;
                /* bottom 用 dvh 兜底而非 env(safe-area-inset-bottom): 浏览器工具栏/地址栏不属于
                   系统 safe-area, env() 测不到它; 用动态视口 dvh 自动收缩才能避开。
                   dvh 不支持时回退 vh(老浏览器 layout viewport, 至少不会被遮到看不见)。 */
                bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;
                left: 0 !important; right: 0 !important;
                margin: 0 auto !important; width: 94vw !important; max-width: 440px !important;
                /* 高度顺序: vh 在前作 fallback, dvh 在后覆盖(支持时优先动态视口, 浏览器
                   地址栏/工具栏显隐会自动收缩面板高度, 不再被挡)。 */
                height: calc(100vh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
                height: calc(100dvh - 16px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
                min-height: 0 !important; max-height: none !important;
                border-radius: 12px !important;
            }
            /* 面板内部滚动容器同样对底部安全区补齐, 避免内容被浏览器底栏遮住 */
            .sam-tab-content {
                padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
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
            .sam-reincarnator { padding:6px 8px; gap:6px; }
            .sam-avatar { width:64px; height:80px; font-size:22px; }
            .sam-ava-ph .sam-ava-ico { font-size:22px; }
            .sam-ava-ph .sam-ava-hint { font-size:8px; }
            .sam-reincarnator-tier { padding:2px 8px; }
            .sam-reincarnator-tier-num { font-size:16px; }
            .sam-reincarnator-race { font-size:11px; padding:2px 7px; }
            .sam-reincarnator-bars { gap:4px; max-width:none; flex:1; margin-left:10px; }
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
        /* ===== 血统融合舱 UI ===== */
        .sam-fusion-wrap { display:flex; flex-direction:column; gap:14px; }
        .sam-fusion-head { display:flex; align-items:center; gap:10px; padding:10px 12px; background:linear-gradient(135deg,rgba(143,159,255,0.12),rgba(0,0,0,0.15)); border:1px solid var(--sam-border); border-radius:8px; }
        .sam-fusion-head .ico { font-size:22px; }
        .sam-fusion-head .ttl { font-weight:600; letter-spacing:0.5px; }
        .sam-fusion-head .sub { font-size:11px; color:var(--sam-sub); margin-left:auto; text-align:right; line-height:1.4; }
        .sam-fusion-pair { display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:start; }
        .sam-fusion-col { display:flex; flex-direction:column; gap:6px; min-width:0; }
        .sam-fusion-col-label { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--sam-sub); }
        .sam-fusion-col-label .tag { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; font-weight:700; font-size:11px; color:#0a0e14; }
        .sam-fusion-col-label .tag.a { background:var(--sam-accent); }
        .sam-fusion-col-label .tag.b { background:var(--sam-hp); }
        .sam-fusion-col-label .role { font-weight:600; color:var(--sam-fg); }
        .sam-fusion-col-label .note { color:var(--sam-sub); font-size:10px; margin-left:auto; }
        .sam-fusion-select { width:100%; padding:6px 8px; background:var(--sam-card); color:var(--sam-fg); border:1px solid var(--sam-border); border-radius:6px; font-size:12px; box-sizing:border-box; }
        .sam-fusion-preview { min-height:60px; }
        .sam-fusion-preview .sam-full-card { margin-bottom:0; }
        .sam-fusion-preview-empty { padding:14px 10px; text-align:center; color:var(--sam-sub); font-size:12px; border:1px dashed var(--sam-border); border-radius:6px; }
        .sam-fusion-arrow { display:flex; align-items:center; justify-content:center; font-size:22px; color:var(--sam-accent); opacity:0.7; animation:samFusionPulse 1.8s ease-in-out infinite; padding-top:24px; }
        @keyframes samFusionPulse { 0%,100%{transform:scale(1);opacity:0.7;} 50%{transform:scale(1.15);opacity:1;} }
        .sam-fusion-rule { padding:10px 12px; background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.18)); border:1px solid var(--sam-border); border-radius:8px; }
        .sam-fusion-rule-title { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .sam-fusion-rule-title .name { font-weight:600; font-size:13px; color:var(--sam-thp); }
        .sam-fusion-rule-title .pill { font-size:10px; padding:2px 8px; border-radius:10px; background:var(--sam-accent); color:#0a0e14; font-weight:600; }
        .sam-fusion-rule-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .sam-fusion-rule-card { padding:8px 10px; background:var(--sam-card); border:1px solid var(--sam-border); border-left:3px solid var(--sam-sub); border-radius:6px; }
        .sam-fusion-rule-card .rhead { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .sam-fusion-rule-card .rname { font-weight:600; font-size:12px; }
        .sam-fusion-rule-card .rw { font-size:10px; padding:1px 6px; border-radius:8px; background:rgba(143,159,255,0.18); color:var(--sam-sub); }
        .sam-fusion-rule-card .rlist { list-style:none; margin:0; padding:0; }
        .sam-fusion-rule-card .rlist li { font-size:11px; color:var(--sam-fg); padding:2px 0 2px 10px; position:relative; line-height:1.5; }
        .sam-fusion-rule-card .rlist li::before { content:'▸'; position:absolute; left:0; color:var(--sam-accent); }
        .sam-fusion-rule-card.r-good { border-left-color:var(--sam-lb); }
        .sam-fusion-rule-card.r-bad { border-left-color:var(--sam-hp); }
        .sam-fusion-rule-card.r-mid { border-left-color:var(--sam-thp); }
        .sam-fusion-actions { display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-top:4px; }
        .sam-fusion-direct-hint { flex:1; text-align:left; font-size:11px; line-height:1.4; }
        @media (max-width:560px){
            .sam-fusion-pair { grid-template-columns:1fr; }
            .sam-fusion-arrow { transform:rotate(90deg); padding:4px 0; }
            .sam-fusion-rule-grid { grid-template-columns:1fr; }
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

    