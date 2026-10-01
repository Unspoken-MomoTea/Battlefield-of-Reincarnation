/*
 * 辅助计算运行时生命周期
 *
 * 后续迁移原 script/辅助计算脚本.js 的事件监听、初始化、清理逻辑。
 */

(function(global){
  'use strict';

  if (global.SamsaraCalculatorRuntime) return;

  global.SamsaraCalculatorRuntime = {
    version: '1.0.0',
    startedAt: Date.now(),
    subscriptions: [],
    addCleanup(fn){
      if (typeof fn === 'function') this.subscriptions.push(fn);
    },
    stop(){
      for (const fn of this.subscriptions.splice(0)) {
        try { fn(); } catch (_) {}
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
