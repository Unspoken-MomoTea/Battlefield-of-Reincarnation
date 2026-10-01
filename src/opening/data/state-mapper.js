/**
 * 开局构筑 -> 正式状态映射层。
 *
 * 不负责写入 MVU，只负责整理结构，供宿主状态系统调用。
 */

export function mapOpeningBuild(build = {}) {
  const selected = build.selected || build;
  return {
    character: selected.character || null,
    partner: Array.isArray(selected.partner) ? selected.partner : (selected.partner ? [selected.partner] : []),
    bloodline: selected.bloodline || null,
    equipment: selected.equipment || build.equipment || build.selections?.equipment || [],
    skills: selected.skills || build.skills || build.selections?.skills || [],
    products: build.products || selected.products || build.selections?.store || [],
    worldbookCharacters: selected.worldbookCharacters || build.worldbookCharacters || [],
    source: 'opening',
    timestamp: Date.now(),
  };
}

window.SamsaraOpeningMapper = { mapOpeningBuild };
