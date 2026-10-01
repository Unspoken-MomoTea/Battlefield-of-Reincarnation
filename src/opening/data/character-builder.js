import { getOpeningState } from './opening-state.js';

export function saveCharacterBuild(build = {}) {
  const state = getOpeningState();
  state.character = {
    ...state.character,
    ...build,
  };
  return state.character;
}

export function savePartnerBuild(partner = {}) {
  const state = getOpeningState();
  state.partner = {
    ...state.partner,
    ...partner,
  };
  return state.partner;
}
