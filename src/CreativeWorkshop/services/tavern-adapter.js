import { resolveHostWindow } from '../config.js';

function accessibleWindows() {
  const windows = [];
  let candidate = window;
  while (candidate) {
    windows.push(candidate);
    try {
      const parent = candidate.parent;
      if (!parent || parent === candidate) break;
      void parent.document;
      candidate = parent;
    } catch {
      break;
    }
  }
  const host = resolveHostWindow();
  if (!windows.includes(host)) windows.push(host);
  return windows.reverse();
}

function findFunction(name) {
  for (const candidate of accessibleWindows()) {
    try {
      if (typeof candidate[name] === 'function') return candidate[name].bind(candidate);
      if (typeof candidate.TavernHelper?.[name] === 'function') return candidate.TavernHelper[name].bind(candidate.TavernHelper);
    } catch {}
  }
  throw new Error(`当前酒馆环境缺少 Tavern Helper API：${name}`);
}

function call(name, ...args) {
  return findFunction(name)(...args);
}

export function createTavernAdapter() {
  return {
    getCurrentCharacterName: () => call('getCurrentCharacterName'),
    getWorldbookNames: () => call('getWorldbookNames'),
    getWorldbook: name => call('getWorldbook', name),
    createOrReplaceWorldbook: (name, entries) =>
      call('createOrReplaceWorldbook', name, entries, { render: 'immediate' }),
    deleteWorldbook: name => call('deleteWorldbook', name),
    getCharWorldbookNames: () => call('getCharWorldbookNames', 'current'),
    rebindCharWorldbooks: binding => call('rebindCharWorldbooks', 'current', binding),
    getCharacterRegexes: () => call('getTavernRegexes', { type: 'character', name: 'current' }),
    replaceCharacterRegexes: regexes => call('replaceTavernRegexes', regexes, { type: 'character', name: 'current' }),
    getScriptTrees: scope => call('getScriptTrees', { type: scope }),
    replaceScriptTrees: (trees, scope) => call('replaceScriptTrees', trees, { type: scope }),
    getPresetNames: () => call('getPresetNames'),
    getPreset: name => call('getPreset', name),
    createOrReplacePreset: (name, preset) => call('createOrReplacePreset', name, preset, { render: 'none' }),
    deletePreset: name => call('deletePreset', name),
  };
}
