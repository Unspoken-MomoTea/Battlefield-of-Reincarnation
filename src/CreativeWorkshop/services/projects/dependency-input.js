export function parseDependencyText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const byId = new Map();
  for (const token of raw.split(/[,，\n]/u).map(value => value.trim()).filter(Boolean)) {
    const [projectPart, versionPart] = token.split('@');
    const projectId = String(projectPart || '').trim();
    const minVersion = versionPart === undefined || versionPart === ''
      ? 1
      : Number(versionPart);

    if (!projectId) throw new Error('依赖项目 ID 不能为空');
    if (!Number.isInteger(minVersion) || minVersion < 1) {
      throw new Error(`依赖“${token}”的最低版本无效`);
    }
    byId.set(projectId, Math.max(minVersion, byId.get(projectId) ?? 0));
  }

  return [...byId.entries()]
    .map(([project_id, min_version]) => ({ project_id, min_version }))
    .sort((a, b) => a.project_id.localeCompare(b.project_id));
}

export function formatDependencyText(dependencies) {
  return (Array.isArray(dependencies) ? dependencies : [])
    .map(item => `${item.project_id}@${Number(item.min_version || 1)}`)
    .join(', ');
}
