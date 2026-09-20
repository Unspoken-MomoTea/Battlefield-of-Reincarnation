export function memoryStorage(project) {
  let value = structuredClone(project);
  return {
    getInstalledProject: async id => (value?.id === id ? structuredClone(value) : undefined),
    putInstalledProject: async next => { value = structuredClone(next); },
    current: () => structuredClone(value),
  };
}

export function fakeAdapter() {
  const state = {
    character: '测试角色',
    worldbooks: new Map(),
    binding: { primary: null, additional: [] },
    regexes: [{ id: 'manual', script_name: '玩家正则' }],
    presets: new Map(),
    failPreset: '',
  };
  return {
    state,
    getCurrentCharacterName: () => state.character,
    getWorldbookNames: () => [...state.worldbooks.keys()],
    getWorldbook: name => structuredClone(state.worldbooks.get(name) ?? []),
    createOrReplaceWorldbook: (name, entries) => { state.worldbooks.set(name, structuredClone(entries)); },
    deleteWorldbook: name => { state.worldbooks.delete(name); },
    getCharWorldbookNames: () => structuredClone(state.binding),
    rebindCharWorldbooks: binding => { state.binding = structuredClone(binding); },
    getCharacterRegexes: () => structuredClone(state.regexes),
    replaceCharacterRegexes: regexes => { state.regexes = structuredClone(regexes); },
    getPresetNames: () => [...state.presets.keys()],
    getPreset: name => structuredClone(state.presets.get(name)),
    createOrReplacePreset: (name, preset) => {
      if (name === state.failPreset) throw new Error('preset write failed');
      state.presets.set(name, structuredClone(preset));
    },
    deletePreset: name => { state.presets.delete(name); },
  };
}

export function project(artifacts, overrides = {}) {
  return {
    id: 'project-1',
    name: '测试作品',
    category: 'extension',
    version: 2,
    bundle: { schema_version: 1, artifacts },
    applied: false,
    installedAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}
