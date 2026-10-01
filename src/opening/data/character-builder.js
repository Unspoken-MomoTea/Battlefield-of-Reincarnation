import { getOpeningSelection, setOpeningSelection } from './selection-store.js';

export function saveCharacterBuild(build = {}) {
  const current = getOpeningSelection().selected.character || {};
  const character = {
    ...current,
    ...build,
  };
  setOpeningSelection('selected.character', character);
  return character;
}

export function savePartnerBuild(partner = {}) {
  const partners = Array.isArray(partner)
    ? [...partner]
    : (partner && Object.keys(partner).length ? [{ ...partner }] : []);

  setOpeningSelection('selected.partner', partners);
  return partners;
}
