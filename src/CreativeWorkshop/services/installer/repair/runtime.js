import { applyProject } from '../apply.js';
import { inspectInstalledProject } from './inspect.js';
import { saveRepairState } from './registry.js';

export async function inspectProjectInstallation({ adapter, storage }, projectId) {
  const installed = await storage.getInstalledProject(projectId);
  if (!installed) throw new Error('本地没有这个作品');
  const health = await inspectInstalledProject(adapter, installed);
  const record = await saveRepairState(storage, installed, health);
  return { health, record };
}

export async function repairInstalledProject({ adapter, storage }, projectId) {
  const installed = await storage.getInstalledProject(projectId);
  if (!installed) throw new Error('本地没有这个作品');

  const before = await inspectInstalledProject(adapter, installed);
  if (!before.repairable) {
    const mismatch = before.issues.find(item => item.type === 'character_mismatch');
    if (mismatch) throw new Error(`该作品安装在角色“${mismatch.expected}”，请切回该角色后再修复`);
    throw new Error('当前安装状态无法自动修复');
  }

  await applyProject({ adapter, storage }, projectId);
  const applied = await storage.getInstalledProject(projectId);
  const health = await inspectInstalledProject(adapter, applied);
  const record = await saveRepairState(storage, applied, health, { repaired: true });
  return { health, record };
}
