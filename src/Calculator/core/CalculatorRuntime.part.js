/*
 * 辅助计算运行时生命周期
 *
 * 管理初始化、防重复加载和热更新清理。
 */
(function(global){
  'use strict';

  if (global.SamsaraCalculatorRuntime) return;

  const runtime = {
    version: '1.0.0',
    startedAt: Date.now(),
    subscriptions: [],
    initialized: false,
    addCleanup(fn){
      if (typeof fn === 'function') this.subscriptions.push(fn);
    },
    init(){
      if (this.initialized) return;
      this.initialized = true;
      this.domains = global.SamsaraCalculatorDomains || {};
    },
    recalculate(statData){
      this.init();
      this.domains.attributes?.recalculate?.(statData);
      this.domains.combat?.process?.(statData);
      this.domains.world?.calculate?.(statData);
    },
    stop(){
      for (const fn of this.subscriptions.splice(0)) {
        try { fn(); } catch (_) {}
      }
      this.initialized = false;
    }
  };

  global.SamsaraCalculatorRuntime = runtime;
})(typeof window !== 'undefined' ? window : globalThis);
