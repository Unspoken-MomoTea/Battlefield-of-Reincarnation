const ALLOWED_KINDS = new Set(['worldbook', 'regex', 'preset', 'script', 'data']);
const MAX_BUNDLE_BYTES = 4_000_000;

export function buildUploadBundle(project, fileName, rawText, selectedKind = 'data', options = {}) {
  const name = String(fileName || '').trim();
  if (!name) throw new Error('文件名不能为空');
  const isJson = name.toLowerCase().endsWith('.json');

  let parsed = rawText;
  if (isJson) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('选择的 JSON 文件无法解析');
    }
  }

  if (
    isJson &&
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    parsed.schema_version === 1 &&
    Array.isArray(parsed.artifacts)
  ) {
    return parsed;
  }

  const kind = selectedKind;
  if (!ALLOWED_KINDS.has(kind)) throw new Error(`不支持的 artifact 类型：${kind}`);
  const scriptScope = String(options.scriptScope || 'character');
  if (kind === 'script' && !['character', 'preset', 'global'].includes(scriptScope)) {
    throw new Error(`不支持的脚本作用域：${scriptScope}`);
  }
  const originalConflicts = Array.isArray(options.originalConflicts)
    ? structuredClone(options.originalConflicts)
    : [];
  if (kind !== 'worldbook' && originalConflicts.length) {
    throw new Error('只有世界书 artifact 可以声明原版世界书冲突');
  }

  return {
    schema_version: 1,
    artifacts: [
      {
        kind,
        name,
        ...(kind === 'script' ? { scope: scriptScope } : {}),
        ...(kind === 'worldbook' && originalConflicts.length
          ? { original_conflicts: originalConflicts }
          : {}),
        format: isJson ? 'json' : 'text',
        content: parsed,
      },
    ],
  };
}


export function combineUploadBundles(bundles) {
  if (!Array.isArray(bundles)) throw new Error('版本内容队列无效');
  const artifacts = [];
  for (const bundle of bundles) {
    if (!bundle || bundle.schema_version !== 1 || !Array.isArray(bundle.artifacts)) {
      throw new Error('待上传内容不是有效的 bundle v1');
    }
    artifacts.push(...bundle.artifacts.map(artifact => structuredClone(artifact)));
  }
  if (!artifacts.length) throw new Error('请至少添加一个内容文件');
  if (artifacts.length > 32) throw new Error('单个版本最多允许 32 个 artifact');
  const combined = { schema_version: 1, artifacts };
  const byteSize = new TextEncoder().encode(JSON.stringify(combined)).byteLength;
  if (byteSize > MAX_BUNDLE_BYTES) throw new Error('单个版本超过 4 MB 限制');
  return combined;
}
