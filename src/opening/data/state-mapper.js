/**
 * 开局构筑 -> 正式状态映射层。
 *
 * 不负责写入 MVU，只负责整理结构，供宿主状态系统调用。
 */

export function mapOpeningBuild(build = {}) {
  return {
    character: build.character || null,
    partner: build.partner || [],
    equipment: build.equipment || build.selections?.equipment || [],
    skills: build.skills || build.selections?.skills || [],
    products: build.products || build.selections?.store || [],
    worldbookCharacters: build.worldbookCharacters || [],
    source: 'opening',
    timestamp: Date.now(),
  };
}

window.SamsaraOpeningMapper = { mapOpeningBuild };
