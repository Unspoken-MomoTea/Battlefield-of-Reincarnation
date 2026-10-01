// 任务相关守卫与计算领域
// 负责任务生成锁、系统任务保护等规则迁移。

export function calculatorTaskGuard(statData) {
  if (!statData) return;
  return { handled: true };
}
