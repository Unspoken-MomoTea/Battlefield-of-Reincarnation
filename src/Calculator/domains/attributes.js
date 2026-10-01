/*
 * 辅助计算 - 属性领域
 *
 * 从旧版 script/辅助计算脚本.js 迁移的第一块领域边界。
 * 后续把五维、衍生属性、层级修正逐步迁入这里。
 */

export function recalculateAttributes(statData) {
  if (!statData || !statData.角色) return false;

  // 保留领域入口，避免迁移过程中改变旧计算流程。
  // 实际公式迁移后在此实现。
  return true;
}
