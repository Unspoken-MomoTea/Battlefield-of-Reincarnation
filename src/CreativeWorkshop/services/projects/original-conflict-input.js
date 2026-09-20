export function parseOriginalConflictText(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  const rows = text
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);

  if (rows.length > 100) throw new Error('原版冲突声明最多允许 100 条');

  const seen = new Set();
  return rows.map((line, index) => {
    const parts = line.split(/[|｜]/u).map(part => part.trim());
    if (parts.length < 2 || parts.length > 3) {
      throw new Error(`第 ${index + 1} 行原版冲突格式无效，请使用“世界书名 | UID | 条目名”`);
    }

    const [worldbook, middle = '', last = ''] = parts;
    if (!worldbook) throw new Error(`第 ${index + 1} 行缺少世界书名`);

    let uid = '';
    let name = '';
    if (parts.length === 2) {
      name = middle;
    } else {
      uid = middle;
      name = last;
    }
    if (!uid && !name) {
      throw new Error(`第 ${index + 1} 行至少需要 UID 或条目名`);
    }

    const key = `${worldbook}\u0000${uid ? `uid:${uid}` : `name:${name}`}`;
    if (seen.has(key)) throw new Error(`第 ${index + 1} 行与前面的原版冲突声明重复`);
    seen.add(key);

    return {
      action: 'disable',
      target: {
        worldbook,
        ...(uid ? { uid } : {}),
        ...(name ? { name } : {}),
      },
    };
  });
}

export function formatOriginalConflictText(conflicts) {
  if (!Array.isArray(conflicts)) return '';
  return conflicts
    .filter(item => item?.target?.worldbook && (item.target.uid || item.target.name))
    .map(item => [
      String(item.target.worldbook || ''),
      String(item.target.uid || ''),
      String(item.target.name || ''),
    ].join(' | '))
    .join('\n');
}
