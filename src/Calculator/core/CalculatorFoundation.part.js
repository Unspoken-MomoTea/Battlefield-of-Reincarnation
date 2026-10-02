// 辅助计算脚本唯一开发源码由 src/Calculator 生成。
(function () {
    'use strict';

    var CALCULATOR_VERSION = '1.0.1';
    var CALCULATOR_HOST = (function () {
        var host = window;
        try {
            while (host.parent && host.parent !== host) { void host.parent.document; host = host.parent; }
        } catch (_) {}
        return host;
    })();
    var GS_PARENT = CALCULATOR_HOST;
    var CALCULATOR_LOADER = CALCULATOR_HOST.SamsaraCalculatorLoader || {};

    class CalculatorRuntimeLifecycle {
        constructor(host, loader) {
            this.host = host;
            this.version = CALCULATOR_VERSION;
            this.ref = String(loader && loader.ref || '');
            this.sha = String(loader && loader.sha || '');
            this.url = String(loader && loader.url || '');
            this.startedAt = Date.now();
            this.subscriptions = [];
        }
        track(subscription) {
            if (subscription && typeof subscription.stop === 'function') this.subscriptions.push(subscription);
            return subscription;
        }
        stopSubscriptions() {
            var current = this.subscriptions.splice(0);
            for (var i = 0; i < current.length; i++) {
                try { current[i].stop(); } catch (_) {}
            }
        }
        stop() { this.stopSubscriptions(); }
    }

    function calculatorPreClean() {
        try {
            var previous = CALCULATOR_HOST.SamsaraCalculatorRuntime;
            if (previous && typeof previous.stopSubscriptions === 'function') previous.stopSubscriptions();
            else if (previous && typeof previous.stop === 'function') previous.stop();
            try { CALCULATOR_HOST.__辅助计算脚本_loaded__ = false; } catch (_) {}
        } catch (error) {
            try { console.warn('[辅助计算脚本] 热更新预清理失败:', error && error.message ? error.message : error); } catch (_) {}
        }
    }
    calculatorPreClean();

    var CALCULATOR_RUNTIME = new CalculatorRuntimeLifecycle(CALCULATOR_HOST, CALCULATOR_LOADER);
    CALCULATOR_HOST.SamsaraCalculatorRuntime = CALCULATOR_RUNTIME;
    CALCULATOR_HOST.Samsara = CALCULATOR_HOST.Samsara || {};
    CALCULATOR_HOST.Samsara.CalculatorInfo = {
        version: CALCULATOR_VERSION,
        ref: CALCULATOR_RUNTIME.ref,
        sha: CALCULATOR_RUNTIME.sha,
        url: CALCULATOR_RUNTIME.url,
        startedAt: CALCULATOR_RUNTIME.startedAt
    };
    function trackCalculatorSubscription(subscription) {
        return CALCULATOR_RUNTIME.track(subscription);
    }

