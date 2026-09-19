import { workshopApi } from './api.js';
import { workshopInstaller } from './installer.js';
import { deleteInstalledProject, getInstalledProject, getInstalledProjects, putInstalledProject } from './storage.js';

const ALLOWED_KINDS = new Set(['worldbook', 'regex', 'preset', 'data']);
const ALLOWED_FORMATS = new Set(['json', 'text']);
const OFFLINE_FORMAT = 'reincarnation-workshop-project';
const OFFLINE_VERSION = 1;
const MAX_OFFLINE_BYTES = 6 * 1024 * 1024;

function artifactContentText(artifact) {
  return artifact.format === 'text' ? artifact.content : JSON.stringify(artifact.content);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

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

export async function verifyBundleAgainstManifest(bundle, manifest, expectedProject = null) {
  validateDownloadedBundle(bundle);
  if (!manifest || typeof manifest !== 'object' || manifest.schema_version !== 1) {
    throw new Error('作品 manifest 无效');
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== bundle.artifacts.length) {
    throw new Error('作品 manifest 与 bundle 数量不一致');
  }
  if (Number(manifest.artifact_count) !== bundle.artifacts.length) {
    throw new Error('作品 manifest 的 artifact_count 不一致');
  }
  if (expectedProject) {
    if (manifest.project?.id !== expectedProject.id || Number(manifest.project?.version) !== Number(expectedProject.version)) {
      throw new Error('作品 manifest 与项目版本不一致');
    }
  }

  let totalBytes = 0;
  for (let index = 0; index < bundle.artifacts.length; index += 1) {
    const artifact = bundle.artifacts[index];
    const declared = manifest.artifacts[index];
    if (
      !declared ||
      declared.kind !== artifact.kind ||
      declared.format !== artifact.format ||
      declared.name !== artifact.name
    ) {
      throw new Error(`artifact“${artifact.name}”与 manifest 描述不一致`);
    }
    const contentText = artifactContentText(artifact);
    const byteSize = new TextEncoder().encode(contentText).byteLength;
    totalBytes += byteSize;
    if (Number(declared.byte_size) !== byteSize) {
      throw new Error(`artifact“${artifact.name}”大小校验失败`);
    }
    if (!/^[a-f0-9]{64}$/u.test(String(declared.sha256 || ''))) {
      throw new Error(`artifact“${artifact.name}”缺少有效 SHA-256`);
    }
    if ((await sha256Hex(contentText)) !== declared.sha256) {
      throw new Error(`artifact“${artifact.name}”SHA-256 校验失败`);
    }
  }
  if (Number(manifest.total_bytes) !== totalBytes) {
    throw new Error('作品 manifest 的总大小校验失败');
  }
  return bundle;
}

function safeFilename(value) {
  const cleaned = String(value || '轮回战场创意工坊')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
    .trim()
    .slice(0, 80);
  return cleaned || '轮回战场创意工坊';
}

export async function createOfflinePackage(installed) {
  if (!installed?.id || !installed?.manifest || !installed?.bundle) {
    throw new Error('本地缓存记录不完整，无法导出');
  }
  await verifyBundleAgainstManifest(installed.bundle, installed.manifest, {
    id: installed.id,
    version: installed.version,
  });
  const payload = {
    format: OFFLINE_FORMAT,
    version: OFFLINE_VERSION,
    exported_at: Date.now(),
    project: {
      id: installed.id,
      name: installed.name,
      category: installed.category,
      version: installed.version,
    },
    manifest: installed.manifest,
    bundle: installed.bundle,
  };
  const text = JSON.stringify(payload);
  if (new TextEncoder().encode(text).byteLength > MAX_OFFLINE_BYTES) {
    throw new Error('离线包超过 6 MB 限制');
  }
  return {
    blob: new Blob([text], { type: 'application/vnd.reincarnation-workshop+json' }),
    filename: `${safeFilename(installed.name)}-v${installed.version}.rwpack`,
  };
}

export async function parseOfflinePackageText(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_OFFLINE_BYTES) {
    throw new Error('离线包大小无效');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('离线包不是有效 JSON');
  }
  if (parsed?.format !== OFFLINE_FORMAT || parsed?.version !== OFFLINE_VERSION) {
    throw new Error('不支持的离线包格式或版本');
  }
  const project = parsed.project;
  if (
    !project ||
    typeof project.id !== 'string' ||
    !project.id ||
    typeof project.name !== 'string' ||
    !ALLOWED_KINDS.has(project.category) && project.category !== 'mixed' ||
    !Number.isInteger(Number(project.version)) ||
    Number(project.version) < 1
  ) {
    throw new Error('离线包项目资料无效');
  }
  await verifyBundleAgainstManifest(parsed.bundle, parsed.manifest, project);
  return parsed;
}

export class ProjectService {
  list(query = '', category = '', offset = 0, tag = '') {
    return workshopApi.listProjects(query, category, offset, tag);
  }

  detail(projectId) {
    return workshopApi.getProject(projectId);
  }

  async cache(projectId) {
    const [detail, bundle] = await Promise.all([
      workshopApi.getProject(projectId),
      workshopApi.downloadProject(projectId),
    ]);
    await verifyBundleAgainstManifest(bundle, detail.manifest, detail.project);
    const previous = await getInstalledProject(projectId);
    const now = Date.now();
    const record = {
      id: detail.project.id,
      name: detail.project.name,
      category: detail.project.category,
      version: detail.project.version,
      manifest: detail.manifest,
      bundle,
      source: 'remote',
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

  async importOffline(file) {
    if (!file || typeof file.text !== 'function') throw new Error('请选择有效的 .rwpack 文件');
    if (Number(file.size || 0) > MAX_OFFLINE_BYTES) throw new Error('离线包超过 6 MB 限制');
    const parsed = await parseOfflinePackageText(await file.text());
    const previous = await getInstalledProject(parsed.project.id);
    if (previous?.applied) throw new Error('这个作品已经安装到酒馆，请先卸载后再导入离线包');
    if (previous && Number(previous.version) > Number(parsed.project.version)) {
      throw new Error(`本地已有更高版本 v${previous.version}，不会被较旧离线包覆盖`);
    }
    const now = Date.now();
    const record = {
      id: parsed.project.id,
      name: parsed.project.name,
      category: parsed.project.category,
      version: Number(parsed.project.version),
      manifest: parsed.manifest,
      bundle: parsed.bundle,
      source: 'offline',
      installedAt: previous?.installedAt ?? now,
      updatedAt: now,
      applied: false,
      appliedVersion: null,
      appliedAt: null,
      targetCharacterName: null,
      installTargets: null,
      applyError: '',
    };
    await putInstalledProject(record);
    return record;
  }

  async exportCached(projectId) {
    const installed = await getInstalledProject(projectId);
    if (!installed) throw new Error('本地没有这个作品');
    return createOfflinePackage(installed);
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
