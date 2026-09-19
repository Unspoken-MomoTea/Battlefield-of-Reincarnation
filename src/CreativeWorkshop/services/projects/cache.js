import {
  deleteInstalledProject, getInstalledProject, getInstalledProjects, putInstalledProject,
} from '../storage.js';
import { verifyBundleAgainstManifest } from './integrity.js';
import { createOfflinePackage, MAX_OFFLINE_BYTES, parseOfflinePackageText } from './offline.js';

function baseRecord(project, manifest, bundle, previous, source) {
  const now = Date.now();
  return {
    id: project.id, name: project.name, category: project.category, version: Number(project.version),
    manifest, bundle, source, installedAt: previous?.installedAt ?? now, updatedAt: now,
    applied: previous?.applied ?? false, appliedVersion: previous?.appliedVersion ?? null,
    appliedAt: previous?.appliedAt ?? null, targetCharacterName: previous?.targetCharacterName ?? null,
    installTargets: previous?.installTargets ?? null, applyError: previous?.applyError ?? '',
  };
}

export async function cacheRemoteProject(workshopApi, projectId) {
  const [detail, bundle] = await Promise.all([workshopApi.getProject(projectId), workshopApi.downloadProject(projectId)]);
  await verifyBundleAgainstManifest(bundle, detail.manifest, detail.project);
  const previous = await getInstalledProject(projectId);
  const record = baseRecord(detail.project, detail.manifest, bundle, previous, 'remote');
  await putInstalledProject(record);
  return record;
}

export async function importOfflineProject(file) {
  if (!file || typeof file.text !== 'function') throw new Error('请选择有效的 .rwpack 文件');
  if (Number(file.size || 0) > MAX_OFFLINE_BYTES) throw new Error('离线包超过 6 MB 限制');
  const parsed = await parseOfflinePackageText(await file.text());
  const previous = await getInstalledProject(parsed.project.id);
  if (previous?.applied) throw new Error('这个作品已经安装到酒馆，请先卸载后再导入离线包');
  if (previous && Number(previous.version) > Number(parsed.project.version)) {
    throw new Error(`本地已有更高版本 v${previous.version}，不会被较旧离线包覆盖`);
  }
  const record = {
    ...baseRecord(parsed.project, parsed.manifest, parsed.bundle, previous, 'offline'),
    applied: false, appliedVersion: null, appliedAt: null,
    targetCharacterName: null, installTargets: null, applyError: '',
  };
  await putInstalledProject(record);
  return record;
}

export async function exportCachedProject(projectId) {
  const installed = await getInstalledProject(projectId);
  if (!installed) throw new Error('本地没有这个作品');
  return createOfflinePackage(installed);
}

export async function checkCachedProjectUpdate(workshopApi, projectId) {
  const installed = await getInstalledProject(projectId);
  if (!installed) return { installed: false, updateAvailable: false };
  const remote = await workshopApi.getProjectVersion(projectId);
  return {
    installed: true, localVersion: installed.version,
    appliedVersion: installed.appliedVersion ?? null, remoteVersion: remote.version,
    updateAvailable: remote.version > installed.version,
  };
}

export const listCachedProjects = () => getInstalledProjects();

export async function removeCachedProject(projectId) {
  const installed = await getInstalledProject(projectId);
  if (installed?.applied) throw new Error('请先卸载这个作品，再删除本地缓存');
  await deleteInstalledProject(projectId);
}
