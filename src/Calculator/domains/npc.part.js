// NPC 生命周期计算领域
// 负责后台人物、关系、NPC 清理与层级同步。

export function calculatorNpcLifecycle(statData, before) {
  if (!statData) return;
  return { handled: true };
}
