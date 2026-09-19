import { workshopApi } from './api.js';
import { workshopInstaller } from './installer.js';
import { deleteInstalledProject, getInstalledProject, getInstalledProjects, putInstalledProject } from './storage.js';

const ALLOWED_KINDS = new Set(['worldbook', 'regex', 'preset', 'data']);
const ALLOWED_FORMATS = new Set(['json', 'text']);

export function validateDownloadedBundle(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle) || bundle.schema_version !== 1) {
    throw new Error('下载的作品包结构无效');
  }
  if (!Array.isArray(bundle.artifacts) || !bundle.artifacts.length || bundle.artifacts.length > 32) {
    throw new Error('下载的作品包 artifact 数量无效');
  }
  for (const [index, artifact] of bundle.artifacts.entries()) {
    if (!artifact || typeof artifact !== 'object' || !ALLOWED_KINDS.has(artifact.kind)) {
      throw new Error(`第 ${index + 1} 个 artifact 类型不受支持`);
    }
    if (!ALLOWED_FORMATS.has(artifact.format) || typeof artifact.name !== 'string' || !artifact.name.trim()) {
      throw new Error(`第 ${index + 1} 个 artifact 描述无效`);
    }
    if (artifact.format === 'text' && typeof artifact.content !== 'string') {
      throw new Error(`artifact“${artifact.name}”文本内容无效`);
    }
    if (artifact.format === 'json' && artifact.content === undefined) {
      throw new Error(`artifact“${artifact.name}”JSON 内容缺失`);
    }
  }
  return bundle;
}

export class ProjectService {
  list(query = '', category = '', offset = 0) {
    return workshopApi.listProjects(query, category, offset);
  }

  detail(projectId) {
    return workshopApi.getProject(projectId);
  }

  async cache(projectId) {
    const [detail, bundle] = await Promise.all([
      workshopApi.getProject(projectId),
      workshopApi.downloadProject(projectId),
    ]);
    validateDownloadedBundle(bundle);
    const previous = await getInstalledProject(projectId);
    const now = Date.now();
    const record = {
      id: detail.project.id,
      name: detail.project.name,
      category: detail.project.category,
      version: detail.project.version,
      manifest: detail.manifest,
      bundle,
      installedAt: previous?.installedAt ?? now,
      updatedAt: now,
      applied: previous?.applied ?? false,
      appliedVersion: previous?.appliedVersion ?? null,
      appliedAt: previous?.appliedAt ?? null,
      targetCharacterName: previous?.targetCharacterName ?? null,
      installTargets: previous?.installTargets ?? null,
      applyError: previous?.applyError ?? '',
    };
    await putInstalledProject(record);
    return record;
  }

  async checkUpdate(projectId) {
    const installed = await getInstalledProject(projectId);
    if (!installed) return { installed: false, updateAvailable: false };
    const remote = await workshopApi.getProjectVersion(projectId);
    return {
      installed: true,
      localVersion: installed.version,
      appliedVersion: installed.appliedVersion ?? null,
      remoteVersion: remote.version,
      updateAvailable: remote.version > installed.version,
    };
  }

  installed() {
    return getInstalledProjects();
  }

  apply(projectId) {
    return workshopInstaller.apply(projectId);
  }

  uninstall(projectId) {
    return workshopInstaller.uninstall(projectId);
  }

  async removeCached(projectId) {
    const installed = await getInstalledProject(projectId);
    if (installed?.applied) throw new Error('请先卸载这个作品，再删除本地缓存');
    await deleteInstalledProject(projectId);
  }
}

export const projectService = new ProjectService();
