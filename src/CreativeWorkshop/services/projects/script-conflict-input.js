const SCRIPT_SCOPES = new Set(['character', 'preset', 'global']);

export function parseOriginalScriptConflictText(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  const rows = text
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);

  if (rows.length > 100) throw new Error('原脚本冲突声明最多允许 100 条');

  const seen = new Set();
  return rows.map((line, index) => {
    const parts = line.split(/[|｜]/u).map(part => part.trim());
    if (parts.length < 2 || parts.length > 4) {
      throw new Error(`第 ${index + 1} 行脚本冲突格式无效，请使用“作用域 | ID | 脚本名 | 文件夹名”`);
    }

    const [scope, id = '', name = '', folder = ''] = parts.length === 2
      ? [parts[0], '', parts[1], '']
      : parts.length === 3
        ? [parts[0], parts[1], parts[2], '']
        : parts;

    if (!SCRIPT_SCOPES.has(scope)) {
      throw new Error(`第 ${index + 1} 行脚本作用域必须是 character、preset 或 global`);
    }
    if (!id && !name) {
      throw new Error(`第 ${index + 1} 行至少需要脚本 ID 或脚本名`);
    }

    const key = `${scope}\u0000${id ? `id:${id}` : `name:${name}`}\u0000${folder}`;
    if (seen.has(key)) throw new Error(`第 ${index + 1} 行与前面的脚本冲突声明重复`);
    seen.add(key);

    return {
      action: 'disable',
      target: {
        scope,
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(folder ? { folder } : {}),
      },
    };
  });
}

export function formatOriginalScriptConflictText(conflicts) {
  if (!Array.isArray(conflicts)) return '';
  return conflicts
    .filter(item => item?.target?.scope && (item.target.id || item.target.name))
    .map(item => [
      String(item.target.scope || ''),
      String(item.target.id || ''),
      String(item.target.name || ''),
      String(item.target.folder || ''),
    ].join(' | '))
    .join('\n');
}
