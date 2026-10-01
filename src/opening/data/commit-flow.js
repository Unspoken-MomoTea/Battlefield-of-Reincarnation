import { getOpeningSelection, setOpeningSelection } from './selection-store.js';

function updateSelection(path, value) {
  setOpeningSelection(path, value);
  return getOpeningSelection();
}

export function saveOpeningCharacter(character) {
  return updateSelection('selected.character', character || null);
}

export function saveOpeningPartner(partner) {
  return updateSelection('selected.partner', partner || []);
}

export function saveOpeningBuild(build = {}) {
  if (build.character !== undefined) updateSelection('selected.character', build.character);
  if (build.partner !== undefined) updateSelection('selected.partner', build.partner);
  if (build.bloodline !== undefined) updateSelection('selected.bloodline', build.bloodline);
  if (build.equipment !== undefined) updateSelection('selected.equipment', build.equipment);
  if (build.skills !== undefined) updateSelection('selected.skills', build.skills);
  if (build.worldbookCharacters !== undefined) updateSelection('selected.worldbookCharacters', build.worldbookCharacters);
  if (build.products !== undefined) updateSelection('products', build.products);
  return getOpeningSelection();
}

export function exportOpeningBuild() {
  return structuredClone(getOpeningSelection());
}

/**
 * 开局最终提交出口。
 *
 * 当前只负责冻结开局构筑数据并广播事件，
 * 不直接修改正式角色数据库，避免开局组件和状态系统耦合。
 * 后续由角色/背包系统监听 opening:commit。
 */
export function commitOpening() {
  const build = exportOpeningBuild();

  window.dispatchEvent(new CustomEvent('opening:commit', {
    detail: {
      build,
      timestamp: Date.now(),
    },
  }));

  return build;
}
