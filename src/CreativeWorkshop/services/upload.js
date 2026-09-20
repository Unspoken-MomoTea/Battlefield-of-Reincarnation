const ALLOWED_KINDS = new Set(['worldbook', 'regex', 'preset', 'script', 'data']);

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

  return {
    schema_version: 1,
    artifacts: [
      {
        kind,
        name,
        ...(kind === 'script' ? { scope: scriptScope } : {}),
        format: isJson ? 'json' : 'text',
        content: parsed,
      },
    ],
  };
}
