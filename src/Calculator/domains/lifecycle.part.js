// 通用生命周期计算领域
// 管理计算模块初始化、状态清理与防重复执行规则。

export function calculatorLifecycleGuard(runtime) {
  if (!runtime) return;
  runtime.lifecycleReady = true;
}
