import {
  deleteInstalledProject, getInstalledProject, getInstalledProjects, putInstalledProject,
} from '../storage.js';
import { validateDownloadedBundle, verifyBundleAgainstManifest } from './integrity.js';
import { sha256Hex } from './sha256.js';
import { createOfflinePackage, MAX_OFFLINE_BYTES, parseOfflinePackageText } from './offline.js';
import { withWorkshopMutation } from '../installer/mutation-lock.js';

function baseRecord(project, manifest, bundle, previous, source) {
  const now = Date.now();
  return {
    id: project.id, name: project.name, category: project.category, version: Number(project.version),
    summary: typeof project.summary === 'string' ? project.summary : (previous?.summary || ''),
    tags: Array.isArray(project.tags) ? structuredClone(project.tags) : structuredClone(previous?.tags || []),
    ownerName: typeof project.owner_name === 'string' ? project.owner_name : (previous?.ownerName || ''),
    hasCover: project.has_cover === undefined ? Boolean(previous?.hasCover) : Boolean(project.has_cover),
    coverUrl: typeof project.cover_url === 'string'
      ? project.cover_url
      : (previous?.coverUrl || ''),
    dependencies: Array.isArray(project.dependencies)
      ? structuredClone(project.dependencies)
      : Array.isArray(manifest?.project?.dependencies)
        ? structuredClone(manifest.project.dependencies)
        : [],
    manifest, bundle, source, installedAt: previous?.installedAt ?? now, updatedAt: now,
    applied: previous?.applied ?? false, appliedVersion: previous?.appliedVersion ?? null,
    appliedAt: previous?.appliedAt ?? null, targetCharacterName: previous?.targetCharacterName ?? null,
    appliedDependencies: previous?.appliedDependencies ?? (previous?.applied ? structuredClone(previous.dependencies ?? []) : null),
    installTargets: previous?.installTargets ?? null, applyError: previous?.applyError ?? '',
    restoreWarnings: previous?.restoreWarnings ?? [],
    unrestoredOriginals: previous?.unrestoredOriginals ?? [],
    repairState: previous?.repairState ?? null,
  };
}

function isRetryableIntegrityMismatch(error) {
  return error instanceof Error && /(?:大小校验失败|SHA-256 校验失败)/u.test(error.message);
}

export async function fetchVerifiedRemoteProject(workshopApi, projectId) {
  const detail = await workshopApi.getProject(projectId);
  const version = Number(detail?.project?.version);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('远程作品版本无效');
  }

  let bundle = await workshopApi.downloadProject(projectId, version);
  try {
    await verifyBundleAgainstManifest(bundle, detail.manifest, detail.project);
  } catch (error) {
    if (!isRetryableIntegrityMismatch(error)) throw error;
    bundle = await workshopApi.downloadProject(projectId, version, { cacheBust: true });
    await verifyBundleAgainstManifest(bundle, detail.manifest, detail.project);
  }

  return { detail, bundle };
}

export const cacheRemoteProject = (workshopApi, projectId) => withWorkshopMutation(() => cacheRemoteProjectUnlocked(workshopApi, projectId));

async function cacheRemoteProjectUnlocked(workshopApi, projectId) {
  const { detail, bundle } = await fetchVerifiedRemoteProject(workshopApi, projectId);
  const previous = await getInstalledProject(projectId);
  const record = baseRecord(detail.project, detail.manifest, bundle, previous, 'remote');
  if (record.hasCover && typeof workshopApi.getProjectCoverUrl === 'function') {
    record.coverUrl = workshopApi.getProjectCoverUrl(projectId);
  }
  await putInstalledProject(record);
  return record;
}

export const importOfflineProject = file => withWorkshopMutation(() => importOfflineProjectUnlocked(file));

async function importOfflineProjectUnlocked(file) {
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


export const saveLocalTestProject = project => withWorkshopMutation(async () => {
  if (!project?.id || !project?.name || !project?.category || !project?.bundle) {
    throw new Error('本地测试作品资料不完整');
  }
  const localId = `local-test:${project.id}`;
  const version = Number(project.version || 1);
  const bundle = structuredClone(project.bundle);
  const artifacts = Array.isArray(bundle?.artifacts) ? bundle.artifacts : [];
  if (!artifacts.length) {
    throw new Error('本地测试内容无效：没有可保存的作品内容，请重新打开编辑器后再试');
  }
  validateDownloadedBundle(bundle);
  const previous = await getInstalledProject(localId);
  const manifestArtifacts = await Promise.all(artifacts.map(async artifact => {
    const text = artifact.format === 'text' ? artifact.content : JSON.stringify(artifact.content);
    const bytes = new TextEncoder().encode(text);
    return {
      kind: artifact.kind,
      name: artifact.name,
      format: artifact.format,
      ...(artifact.scope ? { scope: artifact.scope } : {}),
      ...(artifact.original_conflicts ? { original_conflicts: artifact.original_conflicts } : {}),
      byte_size: bytes.byteLength,
      sha256: await sha256Hex(text),
    };
  }));
  const manifest = {
    schema_version: 1,
    project: {
      id: localId,
      name: project.name,
      category: project.category,
      version,
      dependencies: Array.isArray(project.dependencies) ? structuredClone(project.dependencies) : [],
    },
    artifact_count: artifacts.length,
    total_bytes: manifestArtifacts.reduce((sum, artifact) => sum + artifact.byte_size, 0),
    artifacts: manifestArtifacts,
    resource_overrides: structuredClone(bundle.resource_overrides || []),
  };
  // manifest 由当前 bundle 同步构造，前面已完成结构校验和单次 SHA-256 计算；
  // 不再对同一份本地数据重复做第二轮完整哈希。
  const record = baseRecord({
    id: localId,
    name: `${project.name}（本地测试）`,
    category: project.category,
    version,
    summary: project.summary || '',
    tags: Array.isArray(project.tags) ? structuredClone(project.tags) : [],
    dependencies: project.dependencies || [],
    has_cover: Boolean(project.coverDataUrl),
    cover_url: project.coverDataUrl || '',
  }, manifest, bundle, previous, 'local-test');
  const next = {
    ...record,
    remoteProjectId: project.id,
    submittedProjectId: project.submittedProjectId ?? previous?.submittedProjectId ?? null,
  };
  await putInstalledProject(next);
  return next;
});

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

export const updateRemoteProject = (workshopApi, installer, projectId) => withWorkshopMutation(token => updateRemoteProjectUnlocked(workshopApi, installer, projectId, token));

async function updateRemoteProjectUnlocked(workshopApi, installer, projectId, token) {
  const previous = await getInstalledProject(projectId);
  if (!previous) throw new Error('本地没有这个作品，请先下载');

  try {
    const cached = await cacheRemoteProjectUnlocked(workshopApi, projectId);
    if (!previous.applied) return cached;
    await installer.apply(projectId, token);
    return getInstalledProject(projectId);
  } catch (error) {
    await putInstalledProject(previous);
    throw error;
  }
}

export const removeCachedProject = projectId => withWorkshopMutation(() => removeCachedProjectUnlocked(projectId));

async function removeCachedProjectUnlocked(projectId) {
  const installed = await getInstalledProject(projectId);
  if (installed?.applied) throw new Error('请先卸载这个作品，再删除本地缓存');
  await deleteInstalledProject(projectId);
}
