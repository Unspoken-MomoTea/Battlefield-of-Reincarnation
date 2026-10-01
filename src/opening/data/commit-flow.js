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
  return getOpeningSelection();
}

export function exportOpeningBuild() {
  return structuredClone(getOpeningSelection());
}
