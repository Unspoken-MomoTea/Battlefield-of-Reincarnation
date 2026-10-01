const state = {
  selected: {
    character: null,
    partner: [],
    bloodline: null,
    equipment: [],
    skills: [],
    worldbookCharacters: [],
  },
  products: [],
};

export function getOpeningSelection() {
  return state;
}

export function setOpeningSelection(path, value) {
  const keys = path.split('.');
  let target = state;
  while (keys.length > 1) {
    const key = keys.shift();
    target[key] ??= {};
    target = target[key];
  }
  target[keys[0]] = value;
}

export function resetOpeningSelection() {
  state.selected = {
    character: null,
    partner: [],
    bloodline: null,
    equipment: [],
    skills: [],
    worldbookCharacters: [],
  };
}
