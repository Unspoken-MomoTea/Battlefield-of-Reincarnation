const CONFLICT_LABELS = {
  original_state_conflict: issue => issue.message,
  dependency_character_mismatch: issue => `依赖“${issue.name}”安装在其他角色“${issue.expected}”，当前角色不可用`,
  dependency_missing: issue => `缺少依赖项目 ${issue.project_id}（要求至少 v${issue.min_version}）`,
  dependency_not_applied: issue => `依赖“${issue.name || issue.project_id}”只有本地缓存，尚未安装到酒馆`,
  dependency_version_too_low: issue => `依赖“${issue.name || issue.project_id}”当前应用 v${issue.applied_version}，要求至少 v${issue.min_version}`,
  character_mismatch: issue => `当前角色不是安装目标角色“${issue.expected}”`,
  original_conflict_target_invalid: issue => `原版冲突目标不能指向工坊共享世界书“${issue.worldbookName}”`,
  original_conflict_target_missing: issue => `未找到原版世界书条目“${issue.name}”，安装会继续并跳过这条状态规则`,
  original_conflict_target_ambiguous: issue => `原版世界书条目“${issue.name}”匹配到 ${issue.count} 项，安装会继续并跳过这条状态规则`,
  original_regex_target_missing: issue => `找不到需要控制状态的原正则“${issue.name}”`,
  original_regex_target_ambiguous: issue => `原正则“${issue.name}”匹配到 ${issue.count} 项，请作者指定正则 ID 或匹配表达式`,
  original_regex_target_invalid: issue => `原正则状态规则不能指向工坊 Mod 安装的正则“${issue.name}”`,
  original_script_target_missing: issue => `找不到需要控制状态的原脚本“${issue.name}”（${issue.scope}）`,
  original_script_target_ambiguous: issue => `原脚本“${issue.name}”匹配到 ${issue.count} 项，请作者指定脚本 ID 或文件夹名`,
  original_script_target_invalid: issue => `原脚本冲突不能指向工坊 Mod 安装的脚本“${issue.name}”`,
  worldbook_name_collision: issue => `共享世界书已有同名条目“${issue.name}”`,
  regex_id_collision: issue => `发现残留的同项目正则“${issue.name || issue.id}”`,
  script_id_collision: issue => `发现脚本 ID 冲突“${issue.name || issue.id}”（${issue.scope}）`,
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
  script_missing: issue => `缺少酒馆助手脚本“${issue.name || issue.id}”（${issue.scope}）`,
  script_modified: issue => `酒馆助手脚本“${issue.name || issue.id}”已被修改（${issue.scope}）`,
  script_stale: issue => `存在旧的工坊脚本“${issue.name || issue.id}”（${issue.scope}）`,
  original_worldbook_missing: issue => `原世界书“${issue.worldbookName}”已不存在`,
  original_conflict_entry_missing: issue => `原版条目“${issue.name}”已不存在（${issue.worldbookName}）`,
  original_conflict_state_mismatch: issue => `原版条目“${issue.name}”当前状态与作品要求不一致（${issue.worldbookName}）`,
  original_conflict_reenabled: issue => `原版条目“${issue.name}”被重新启用（${issue.worldbookName}）`,
  original_regex_missing: issue => `原正则“${issue.name}”已不存在`,
  original_regex_state_mismatch: issue => `原正则“${issue.name}”当前状态与作品要求不一致`,
  original_regex_modified: issue => `原正则“${issue.name}”安装后被修改`,
  original_conflict_modified: issue => `原版条目“${issue.name}”安装后被修改（${issue.worldbookName}）`,
  original_script_missing: issue => `原脚本“${issue.name}”已不存在（${issue.scope}）`,
  original_script_state_mismatch: issue => `原脚本“${issue.name}”当前状态与作品要求不一致（${issue.scope}）`,
  original_script_reenabled: issue => `原脚本“${issue.name}”被重新启用（${issue.scope}）`,
  original_script_modified: issue => `原脚本“${issue.name}”安装后被修改（${issue.scope}）`,
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
