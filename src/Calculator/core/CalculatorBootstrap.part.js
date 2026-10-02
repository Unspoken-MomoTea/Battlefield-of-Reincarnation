

    // 初始化事件注册；所有订阅由 Runtime 持有，工坊热更新前可安全停止旧实例。
    const init = async () => {
        await waitGlobalInitialized('Mvu');
        initializeTurnMessageBaseline();
        var subscription = eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdateData);
        trackCalculatorSubscription(subscription);
        try { CALCULATOR_HOST.__辅助计算脚本_loaded__ = true; } catch (_) {}
        try { toastr.success('[辅助计算脚本] 脚本已加载 '); } catch (_) {}
    };

    try {
        var pagehideHandler = function () { calculatorPreClean(); };
        if (window && typeof window.addEventListener === 'function') {
            window.addEventListener('pagehide', pagehideHandler);
            trackCalculatorSubscription({ stop: function () { try { window.removeEventListener('pagehide', pagehideHandler); } catch (_) {} } });
        }
    } catch (_) {}

    $(init);
})();
