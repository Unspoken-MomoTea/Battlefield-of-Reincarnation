import { isAllowedOfflineCategory, verifyBundleAgainstManifest } from './integrity.js';

export const MAX_OFFLINE_BYTES = 6 * 1024 * 1024;
const OFFLINE_FORMAT = 'reincarnation-workshop-project';
const OFFLINE_VERSION = 1;

function safeFilename(value) {
  const cleaned = String(value || '轮回战场创意工坊')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
    .trim()
    .slice(0, 80);
  return cleaned || '轮回战场创意工坊';
}

export async function createOfflinePackage(installed) {
  if (!installed?.id || !installed?.manifest || !installed?.bundle) throw new Error('本地缓存记录不完整，无法导出');
  await verifyBundleAgainstManifest(installed.bundle, installed.manifest, { id: installed.id, version: installed.version });
  const payload = {
    format: OFFLINE_FORMAT, version: OFFLINE_VERSION, exported_at: Date.now(),
    project: { id: installed.id, name: installed.name, category: installed.category, version: installed.version },
    manifest: installed.manifest, bundle: installed.bundle,
  };
  const text = JSON.stringify(payload);
  if (new TextEncoder().encode(text).byteLength > MAX_OFFLINE_BYTES) throw new Error('离线包超过 6 MB 限制');
  return {
    blob: new Blob([text], { type: 'application/vnd.reincarnation-workshop+json' }),
    filename: `${safeFilename(installed.name)}-v${installed.version}.rwpack`,
  };
}

export async function parseOfflinePackageText(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_OFFLINE_BYTES) throw new Error('离线包大小无效');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('离线包不是有效 JSON'); }
  if (parsed?.format !== OFFLINE_FORMAT || parsed?.version !== OFFLINE_VERSION) throw new Error('不支持的离线包格式或版本');
  const project = parsed.project;
  if (!project || typeof project.id !== 'string' || !project.id || typeof project.name !== 'string' ||
      !isAllowedOfflineCategory(project.category) || !Number.isInteger(Number(project.version)) || Number(project.version) < 1) {
    throw new Error('离线包项目资料无效');
  }
  await verifyBundleAgainstManifest(parsed.bundle, parsed.manifest, project);
  return parsed;
}
