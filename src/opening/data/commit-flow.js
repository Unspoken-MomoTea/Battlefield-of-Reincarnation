import { getOpeningSelection, setOpeningSelection } from './selection-store.js';

export function saveOpeningCharacter(character) {
  const current = getOpeningSelection();
  const next = { ...current, character: character || null };
  setOpeningSelection(next);
  return next;
}

export function saveOpeningPartner(partner) {
  const current = getOpeningSelection();
  const next = { ...current, partner: partner || null };
  setOpeningSelection(next);
  return next;
}

export function exportOpeningBuild() {
  return structuredClone(getOpeningSelection());
}
