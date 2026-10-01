/* ===== 34. 启动器 ===== */
    function init() {
        initSamsaraCSS();
        initSamsaraDOM();
        // 仅共享调用能力，密钥仍由终端管理。面板交接不修改正式开关。
        GS_PARENT.Samsara = GS_PARENT.Samsara || {};
        GS_PARENT.Samsara.terminal = {
            request: function(system, input, options) { return apiChat(system, input, options); },
            apiReady: function() { return isApiConfigEnabled() && !!getApiConfig().model; },
            currentModel: function() { return safeStr(getApiConfig().model).trim(); },
            models: function() { return apiAvailableModels(getApiConfig()); },
            enableApi: function() {
                saveApiConfig(function(cfg) { cfg.enabled = true; });
                return isApiConfigEnabled();
            },
            suspend: function() {
                var panel = $('#samsara-panel');
                var state = { open: panel.hasClass('open'), scroll: $('#sam-tab-content').scrollTop() || 0 };
                panel.hide(); $('#samsara-ball').hide();
                return state;
            },
            restore: function(state) {
                if (state && state.open) {
                    if (!isEditMode()) renderAll();
                    $('#samsara-panel').css('display', 'flex').addClass('open');
                    $('#samsara-ball').hide();
                    $('#sam-tab-content').scrollTop(state.scroll || 0);
                } else { $('#samsara-ball').show(); }
            }
        };
        if (GS_PARENT.Samsara.worldEngine && typeof GS_PARENT.Samsara.worldEngine.isConfigured === 'function' && GS_PARENT.Samsara.worldEngine.isConfigured()) {
            var _worldUsesDedicated = typeof GS_PARENT.Samsara.worldEngine.usesDedicatedApi === 'function' && GS_PARENT.Samsara.worldEngine.usesDedicatedApi();
            if (!_worldUsesDedicated) GS_PARENT.Samsara.terminal.enableApi();
        }
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
                if (typeof eventOn === 'function') trackStatusBarSubscription(eventOn(win.Mvu.events.VARIABLE_UPDATE_ENDED, debouncedRefresh));
            }
            // 2) 酒馆原生事件: 删楼层/切swipe/切聊天 → MVU 快照回退或切换, 需刷新
            //    MVU 事件体系只覆盖"变量更新", 不覆盖"楼层变更", 故须补酒馆事件
            if (typeof tavern_events !== 'undefined') {
                if (tavern_events.MESSAGE_DELETED && typeof eventOn === 'function') trackStatusBarSubscription(eventOn(tavern_events.MESSAGE_DELETED, debouncedRefresh));
                if (tavern_events.MESSAGE_SWIPED  && typeof eventOn === 'function') trackStatusBarSubscription(eventOn(tavern_events.MESSAGE_SWIPED,  debouncedRefresh));
                if (tavern_events.CHAT_CHANGED    && typeof eventOn === 'function') trackStatusBarSubscription(eventOn(tavern_events.CHAT_CHANGED,    debouncedRefresh));
            }
        } catch (e) {}
        // DOM守护定时器: 球/面板被移除则重建
        window.samsaraGuardTimer = setInterval(function() {
            if (!document.getElementById('samsara-ball') || !document.getElementById('samsara-panel')) {
                initSamsaraDOM();
                renderAll();
                if (GS_PARENT.Samsara.worldEngine && GS_PARENT.Samsara.worldEngine.isOpen()) GS_PARENT.Samsara.terminal.suspend();
            }
        }, 15000);
        if (GS_PARENT.Samsara.worldEngine && GS_PARENT.Samsara.worldEngine.isOpen()) GS_PARENT.Samsara.terminal.suspend();
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
