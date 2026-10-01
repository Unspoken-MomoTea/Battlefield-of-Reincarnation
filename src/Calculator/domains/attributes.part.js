// 辅助计算 - 属性领域
(function (global) {
  'use strict';

  global.SamsaraCalculatorDomains = global.SamsaraCalculatorDomains || {};

  global.SamsaraCalculatorDomains.attributes = {
    recalculate(statData) {
      if (!statData || !statData.角色) return false;
      // 属性重算入口，原脚本迁移时保持同一调用边界。
      return true;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
