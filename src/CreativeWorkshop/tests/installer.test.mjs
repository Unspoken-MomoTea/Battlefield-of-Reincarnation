import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHARED_WORLDBOOK_NAME,
  createWorkshopInstaller,
  normalizeRegexArtifact,
  normalizeWorldbookArtifact,
} from '../services/installer.js';

function memoryStorage(project) {
  let value = structuredClone(project);
  return {
    getInstalledProject: async id => (value?.id === id ? structuredClone(value) : undefined),
    putInstalledProject: async next => { value = structuredClone(next); },
    current: () => structuredClone(value),
  };
}

function fakeAdapter() {
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

function project(artifacts) {
  return {
    id: 'project-1',
    name: '测试作品',
    category: 'mixed',
    version: 2,
    bundle: { schema_version: 1, artifacts },
    applied: false,
    installedAt: 1,
    updatedAt: 1,
  };
}

test('worldbook parser accepts common SillyTavern export shape', () => {
  const entries = normalizeWorldbookArtifact({
    entries: {
      0: {
        comment: '条目一',
        content: '内容',
        constant: true,
        disable: false,
        probability: 80,
      },
    },
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, '条目一');
  assert.equal(entries[0].strategy.type, 'constant');
  assert.equal(entries[0].probability, 80);
});

test('regex parser namespaces ids so uninstall never removes unrelated regexes', () => {
  const regexes = normalizeRegexArtifact(
    [{ scriptName: '示例', findRegex: 'foo', replaceString: 'bar', placement: [1, 2] }],
    { id: 'abc', name: '作品' },
    0,
    '正则.json',
  );
  assert.equal(regexes[0].id, 'rw:abc:0:0');
  assert.equal(regexes[0].script_name, '[工坊] 作品 · 示例');
  assert.equal(regexes[0].source.user_input, true);
  assert.equal(regexes[0].source.ai_output, true);
});

test('apply and uninstall preserve unrelated worldbook entries and regexes', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set(SHARED_WORLDBOOK_NAME, [{ name: '玩家条目', extra: { custom: true } }]);
  adapter.state.binding.additional = ['玩家世界书'];

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: '世界书.json',
      format: 'json',
      content: { entries: { 0: { comment: '工坊条目', content: 'hello', constant: true } } },
    },
    {
      kind: 'regex',
      name: '正则.json',
      format: 'json',
      content: [{ scriptName: '工坊正则', findRegex: 'foo', replaceString: 'bar' }],
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  const applied = await installer.apply('project-1');
  assert.equal(applied.applied, true);
  assert.equal(applied.targetCharacterName, '测试角色');
  assert.ok(adapter.state.binding.additional.includes(SHARED_WORLDBOOK_NAME));
  assert.equal(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME).length, 2);
  assert.equal(adapter.state.regexes.length, 2);
  assert.ok(adapter.state.regexes.some(regex => regex.id === 'manual'));

  await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.binding.additional, ['玩家世界书']);
  assert.deepEqual(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME), [{ name: '玩家条目', extra: { custom: true } }]);
  assert.deepEqual(adapter.state.regexes, [{ id: 'manual', script_name: '玩家正则' }]);
  assert.equal(storage.current().applied, false);
});

test('apply rolls back all prior mutations if a later preset write fails', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set(SHARED_WORLDBOOK_NAME, [{ name: '原条目' }]);
  adapter.state.binding.additional = [SHARED_WORLDBOOK_NAME];
  const targetPreset = '[创意工坊] 测试作品 · 预设.json';
  adapter.state.presets.set(targetPreset, { original: true });
  adapter.state.failPreset = targetPreset;

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: '世界书.json',
      format: 'json',
      content: { entries: { 0: { comment: '新条目', content: 'new', constant: true } } },
    },
    { kind: 'preset', name: '预设.json', format: 'json', content: { settings: { temperature: 1 } } },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await assert.rejects(() => installer.apply('project-1'), /preset write failed/u);
  assert.deepEqual(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME), [{ name: '原条目' }]);
  assert.deepEqual(adapter.state.presets.get(targetPreset), { original: true });
  assert.equal(storage.current().applied, false);
  assert.match(storage.current().applyError, /preset write failed/u);
});

test('an applied project cannot be uninstalled from a different character', async () => {
  const adapter = fakeAdapter();
  const storage = memoryStorage({
    ...project([]),
    applied: true,
    targetCharacterName: '角色A',
    installTargets: { worldbook: SHARED_WORLDBOOK_NAME, regexIds: [], presets: [] },
  });
  adapter.state.character = '角色B';
  const installer = createWorkshopInstaller({ adapter, storage });
  await assert.rejects(() => installer.uninstall('project-1'), /角色A/u);
});
