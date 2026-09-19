export async function saveRepairState(storage, installed, health, { repaired = false } = {}) {
  const now = Date.now();
  const next = {
    ...installed,
    repairState: {
      ...(installed.repairState ?? {}),
      lastCheckedAt: now,
      lastRepairedAt: repaired ? now : installed.repairState?.lastRepairedAt ?? null,
      healthy: Boolean(health.healthy),
      repairable: Boolean(health.repairable),
      issues: health.issues.map(item => ({ ...item })),
    },
    updatedAt: now,
  };
  await storage.putInstalledProject(next);
  return next;
}
