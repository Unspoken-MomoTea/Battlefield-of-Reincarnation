const ALLOWED_KINDS = new Set(['worldbook', 'regex', 'preset', 'script', 'data']);
const ALLOWED_FORMATS = new Set(['json', 'text']);

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
    if (artifact.kind === 'worldbook' && artifact.original_conflicts !== undefined) {
      if (!Array.isArray(artifact.original_conflicts)) {
        throw new Error(`artifact“${artifact.name}”原版冲突声明无效`);
      }
      for (const conflict of artifact.original_conflicts) {
        if (!conflict || !['disable', 'replace'].includes(conflict.action) || !conflict.target) {
          throw new Error(`artifact“${artifact.name}”原版冲突声明无效`);
        }
        if (!String(conflict.target.uid ?? '').trim() && !String(conflict.target.name ?? '').trim()) {
          throw new Error(`artifact“${artifact.name}”原版冲突目标无效`);
        }
      }
    }
    if (artifact.kind === 'script') {
      const scope = String(artifact.scope || 'character');
      if (!['character', 'preset', 'global'].includes(scope)) {
        throw new Error(`artifact“${artifact.name}”脚本作用域无效`);
      }
    }
  }
  return bundle;
}

export async function verifyBundleAgainstManifest(bundle, manifest, expectedProject = null) {
  validateDownloadedBundle(bundle);
  if (!manifest || typeof manifest !== 'object' || manifest.schema_version !== 1) throw new Error('作品 manifest 无效');
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== bundle.artifacts.length) throw new Error('作品 manifest 与 bundle 数量不一致');
  if (Number(manifest.artifact_count) !== bundle.artifacts.length) throw new Error('作品 manifest 的 artifact_count 不一致');
  if (expectedProject && (manifest.project?.id !== expectedProject.id || Number(manifest.project?.version) !== Number(expectedProject.version))) {
    throw new Error('作品 manifest 与项目版本不一致');
  }

  let totalBytes = 0;
  for (let index = 0; index < bundle.artifacts.length; index += 1) {
    const artifact = bundle.artifacts[index];
    const declared = manifest.artifacts[index];
    if (!declared || declared.kind !== artifact.kind || declared.format !== artifact.format || declared.name !== artifact.name) {
      throw new Error(`artifact“${artifact.name}”与 manifest 描述不一致`);
    }
    if (artifact.kind === 'script' && String(declared.scope || 'character') !== String(artifact.scope || 'character')) {
      throw new Error(`artifact“${artifact.name}”脚本作用域与 manifest 不一致`);
    }
    if (artifact.kind === 'worldbook') {
      const declaredConflicts = JSON.stringify(declared.original_conflicts || []);
      const actualConflicts = JSON.stringify(artifact.original_conflicts || []);
      if (declaredConflicts !== actualConflicts) {
        throw new Error(`artifact“${artifact.name}”原版冲突声明与 manifest 不一致`);
      }
    }
    const contentText = artifactContentText(artifact);
    const byteSize = new TextEncoder().encode(contentText).byteLength;
    totalBytes += byteSize;
    if (Number(declared.byte_size) !== byteSize) throw new Error(`artifact“${artifact.name}”大小校验失败`);
    if (!/^[a-f0-9]{64}$/u.test(String(declared.sha256 || ''))) throw new Error(`artifact“${artifact.name}”缺少有效 SHA-256`);
    if ((await sha256Hex(contentText)) !== declared.sha256) throw new Error(`artifact“${artifact.name}”SHA-256 校验失败`);
  }
  if (Number(manifest.total_bytes) !== totalBytes) throw new Error('作品 manifest 的总大小校验失败');
  return bundle;
}

export function isAllowedOfflineCategory(category) {
  return category === 'character' || category === 'extension';
}
