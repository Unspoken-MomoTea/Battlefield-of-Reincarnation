const state = {
  character: {
    name: '',
    race: '',
    occupation: '',
    bloodline: '',
    attributes: {},
  },
  partner: [],
  selections: {
    store: [],
    equipment: [],
    skills: [],
  },
  worldbookCharacters: [],
};

export function getOpeningState() {
  return state;
}

export function resetOpeningState() {
  state.character = { name: '', race: '', occupation: '', bloodline: '', attributes: {} };
  state.partner = [];
  state.selections = { store: [], equipment: [], skills: [] };
  state.worldbookCharacters = [];
}

window.SamsaraOpeningState = { getOpeningState, resetOpeningState };
