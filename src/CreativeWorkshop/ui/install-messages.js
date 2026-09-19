const CONFLICT_LABELS = {
  character_mismatch: issue => `当前角色不是安装目标角色“${issue.expected}”`,
  worldbook_name_collision: issue => `共享世界书已有同名条目“${issue.name}”`,
  regex_id_collision: issue => `发现残留的同项目正则“${issue.name || issue.id}”`,
  preset_name_collision: issue => `已有同名预设“${issue.name}”，安装时会先备份后替换`,
};

const HEALTH_LABELS = {
  not_applied: () => '作品尚未安装',
  character_mismatch: issue => `当前角色不是安装目标角色“${issue.expected}”`,
  version_drift: issue => `缓存 v${issue.cachedVersion}，当前仍应用 v${issue.appliedVersion}`,
  worldbook_entry_missing: issue => `缺少世界书条目“${issue.name}”`,
  worldbook_entry_modified: issue => `世界书条目“${issue.name}”已被修改`,
  worldbook_entry_stale: issue => `存在旧的工坊世界书条目“${issue.name}”`,
  worldbook_binding_missing: () => '共享世界书已从当前角色解绑',
  regex_missing: issue => `缺少正则“${issue.name || issue.id}”`,
  regex_modified: issue => `正则“${issue.name || issue.id}”已被修改`,
  regex_stale: issue => `存在旧的工坊正则“${issue.name || issue.id}”`,
  preset_missing: issue => `缺少预设“${issue.name}”`,
  preset_modified: issue => `预设“${issue.name}”已被修改`,
  preset_stale: issue => `存在旧的工坊预设“${issue.name}”`,
};

function lines(items, labels) {
  return items.map((item, index) => {
    const render = labels[item.type];
    return `${index + 1}. ${render ? render(item) : item.type}`;
  });
}

export function formatInstallConflicts(items) {
  return lines(items, CONFLICT_LABELS).join('\n');
}

export function formatInstallHealth(health) {
  if (health.healthy) return '安装状态正常';
  return lines(health.issues, HEALTH_LABELS).join('\n');
}
