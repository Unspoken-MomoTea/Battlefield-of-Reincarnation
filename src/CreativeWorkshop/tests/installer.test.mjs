import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SHARED_WORLDBOOK_NAME,
  createWorkshopInstaller,
  normalizeRegexArtifact,
  normalizeWorldbookArtifact,
  safePresetName,
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
    scripts: {
      character: [{ type: 'script', id: 'manual-script', name: '玩家脚本', enabled: true, content: 'manual' }],
      preset: [],
      global: [],
    },
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
    getScriptTrees: scope => structuredClone(state.scripts[scope] ?? []),
    replaceScriptTrees: (trees, scope) => { state.scripts[scope] = structuredClone(trees); },
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
  const targetPreset = '[创意工坊] 测试作品 · 预设.json · project--2';
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

test('uninstall restores a preset that existed before workshop installation', async () => {
  const adapter = fakeAdapter();
  const targetPreset = '[创意工坊] 测试作品 · 预设.json · project--1';
  adapter.state.presets.set(targetPreset, { original: true });
  const storage = memoryStorage(project([
    { kind: 'preset', name: '预设.json', format: 'json', content: { settings: { temperature: 0.8 } } },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  assert.deepEqual(adapter.state.presets.get(targetPreset), { settings: { temperature: 0.8 } });
  await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.presets.get(targetPreset), { original: true });
});


test('preset names are namespaced by project id and artifact index', () => {
  const first = safePresetName({ id: 'aaaaaaaa-1111', name: '同名作品' }, '同名预设.json', 0);
  const second = safePresetName({ id: 'bbbbbbbb-2222', name: '同名作品' }, '同名预设.json', 0);
  const third = safePresetName({ id: 'aaaaaaaa-1111', name: '同名作品' }, '同名预设.json', 1);
  assert.notEqual(first, second);
  assert.notEqual(first, third);
  assert.match(first, /aaaaaaaa-1$/u);
  assert.ok(first.length <= 120);
});


test('Tavern Helper script artifacts install enabled, update in place, and uninstall without touching user scripts', async () => {
  const adapter = fakeAdapter();
  const storage = memoryStorage(project([
    {
      kind: 'script',
      name: '状态栏.js',
      format: 'text',
      scope: 'character',
      content: "console.log('v1')",
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  const first = await installer.apply('project-1');
  assert.equal(first.applied, true);
  assert.equal(first.installTargets.scripts.character.length, 1);
  assert.equal(adapter.state.scripts.character.length, 2);
  const installedScript = adapter.state.scripts.character.find(item => item.id !== 'manual-script');
  assert.ok(installedScript);
  assert.equal(installedScript.enabled, true);
  assert.equal(installedScript.content, "console.log('v1')");
  assert.equal(installedScript.data.reincarnationWorkshop.projectId, 'project-1');

  await storage.putInstalledProject({
    ...storage.current(),
    version: 3,
    bundle: {
      schema_version: 1,
      artifacts: [{
        kind: 'script',
        name: '状态栏.js',
        format: 'text',
        scope: 'character',
        content: "console.log('v2')",
      }],
    },
  });
  await installer.apply('project-1');

  const updatedOwned = adapter.state.scripts.character.filter(item => item.id !== 'manual-script');
  assert.equal(updatedOwned.length, 1);
  assert.equal(updatedOwned[0].content, "console.log('v2')");
  assert.equal(updatedOwned[0].data.reincarnationWorkshop.projectVersion, 3);
  assert.ok(adapter.state.scripts.character.some(item => item.id === 'manual-script'));

  await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.scripts.character, [
    { type: 'script', id: 'manual-script', name: '玩家脚本', enabled: true, content: 'manual' },
  ]);
});

test('script tree mutations roll back when a later install step fails', async () => {
  const adapter = fakeAdapter();
  const targetPreset = '[创意工坊] 测试作品 · 预设.json · project--2';
  adapter.state.failPreset = targetPreset;
  const originalScripts = structuredClone(adapter.state.scripts.character);
  const storage = memoryStorage(project([
    {
      kind: 'script',
      name: '状态栏.js',
      format: 'text',
      scope: 'character',
      content: "console.log('new')",
    },
    {
      kind: 'preset',
      name: '预设.json',
      format: 'json',
      content: { settings: { temperature: 0.8 } },
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await assert.rejects(() => installer.apply('project-1'), /preset write failed/u);
  assert.deepEqual(adapter.state.scripts.character, originalScripts);
});


test('worldbook original conflicts are recorded and restored on uninstall', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 7, name: '原版规则', enabled: true, content: 'original' },
  ]);
  adapter.state.binding.primary = '角色原世界书';

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: 'DLC世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'replace',
        target: { worldbook: '角色原世界书', uid: '7', name: '原版规则' },
      }],
      content: {
        entries: {
          0: { comment: 'DLC替代规则', content: 'replacement', constant: true },
        },
      },
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  const applied = await installer.apply('project-1');
  const disabled = adapter.state.worldbooks.get('角色原世界书')[0];
  assert.equal(disabled.enabled, false);
  assert.equal(applied.installTargets.originalWorldbookChanges.length, 1);
  assert.equal(applied.installTargets.originalWorldbookChanges[0].beforeEntry.enabled, true);

  await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.worldbooks.get('角色原世界书'), [
    { uid: 7, name: '原版规则', enabled: true, content: 'original' },
  ]);
});

test('uninstall never overwrites an original worldbook entry edited by the player after install', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 8, name: '原版规则', enabled: true, content: 'original' },
  ]);
  adapter.state.binding.primary = '角色原世界书';

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: 'DLC世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'disable',
        target: { worldbook: '角色原世界书', uid: '8' },
      }],
      content: {
        entries: {
          0: { comment: '补充规则', content: 'addon', constant: true },
        },
      },
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 8, name: '原版规则', enabled: false, content: 'player edited while dlc installed' },
  ]);

  const removed = await installer.uninstall('project-1');
  assert.deepEqual(
    adapter.state.worldbooks.get('角色原世界书')[0],
    { uid: 8, name: '原版规则', enabled: true, content: 'player edited while dlc installed' },
  );
  assert.equal(removed.unrestoredOriginals.length, 0);
  assert.match(removed.restoreWarnings[0], /仅恢复原启用状态/u);
});

test('updating a project can remove an old original conflict and restore the original entry', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 9, name: '原版规则', enabled: true, content: 'original' },
  ]);
  adapter.state.binding.primary = '角色原世界书';

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: 'DLC世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'disable',
        target: { worldbook: '角色原世界书', uid: '9' },
      }],
      content: {
        entries: { 0: { comment: 'DLC规则', content: 'v1', constant: true } },
      },
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  assert.equal(adapter.state.worldbooks.get('角色原世界书')[0].enabled, false);

  await storage.putInstalledProject({
    ...storage.current(),
    version: 3,
    bundle: {
      schema_version: 1,
      artifacts: [{
        kind: 'worldbook',
        name: 'DLC世界书.json',
        format: 'json',
        content: {
          entries: { 0: { comment: 'DLC规则', content: 'v2', constant: true } },
        },
      }],
    },
  });

  await installer.apply('project-1');
  assert.deepEqual(adapter.state.worldbooks.get('角色原世界书'), [
    { uid: 9, name: '原版规则', enabled: true, content: 'original' },
  ]);
  assert.equal(storage.current().installTargets.originalWorldbookChanges.length, 0);
});


test('original conflict uninstall restores a previously disabled entry to disabled', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 10, name: '原版已关闭规则', enabled: false, content: 'original' },
  ]);
  adapter.state.binding.primary = '角色原世界书';

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: 'DLC世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'disable',
        target: { worldbook: '角色原世界书', uid: '10' },
      }],
      content: {
        entries: { 0: { comment: 'DLC规则', content: 'addon', constant: true } },
      },
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 10, name: '原版已关闭规则', enabled: false, content: 'player edit' },
  ]);

  await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.worldbooks.get('角色原世界书'), [
    { uid: 10, name: '原版已关闭规则', enabled: false, content: 'player edit' },
  ]);
});


test('script replacement declarations disable originals and restore them on uninstall', async () => {
  const adapter = fakeAdapter();
  const storage = memoryStorage(project([
    {
      kind: 'script',
      name: '替代状态栏.js',
      format: 'text',
      scope: 'character',
      original_conflicts: [{
        action: 'replace',
        target: { scope: 'character', id: 'manual-script', name: '玩家脚本' },
      }],
      content: "console.log('replacement')",
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  const applied = await installer.apply('project-1');
  const original = adapter.state.scripts.character.find(item => item.id === 'manual-script');
  assert.equal(original.enabled, false);
  assert.equal(original.content, 'manual');
  assert.equal(applied.installTargets.originalScriptChanges.length, 1);
  assert.ok(adapter.state.scripts.character.some(item => String(item.id).startsWith('rw:project-1:script:')));

  await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.scripts.character, [
    { type: 'script', id: 'manual-script', name: '玩家脚本', enabled: true, content: 'manual' },
  ]);
});

test('uninstall preserves player edits to a replaced script and only restores enabled state', async () => {
  const adapter = fakeAdapter();
  const storage = memoryStorage(project([
    {
      kind: 'script',
      name: '替代状态栏.js',
      format: 'text',
      scope: 'character',
      original_conflicts: [{
        action: 'disable',
        target: { scope: 'character', id: 'manual-script' },
      }],
      content: "console.log('replacement')",
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  const original = adapter.state.scripts.character.find(item => item.id === 'manual-script');
  original.content = 'player edited while extension active';
  original.enabled = false;

  const removed = await installer.uninstall('project-1');
  assert.deepEqual(adapter.state.scripts.character, [
    {
      type: 'script',
      id: 'manual-script',
      name: '玩家脚本',
      enabled: true,
      content: 'player edited while extension active',
    },
  ]);
  assert.match(removed.restoreWarnings.join('\n'), /仅恢复原启用状态/u);
});


test('updating a project can remove a script replacement and restore the original script', async () => {
  const adapter = fakeAdapter();
  const storage = memoryStorage(project([
    {
      kind: 'script',
      name: '替代状态栏.js',
      format: 'text',
      scope: 'character',
      original_conflicts: [{
        action: 'replace',
        target: { scope: 'character', id: 'manual-script' },
      }],
      content: "console.log('v1')",
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  assert.equal(
    adapter.state.scripts.character.find(item => item.id === 'manual-script').enabled,
    false,
  );

  await storage.putInstalledProject({
    ...storage.current(),
    version: 3,
    bundle: {
      schema_version: 1,
      artifacts: [{
        kind: 'script',
        name: '替代状态栏.js',
        format: 'text',
        scope: 'character',
        content: "console.log('v2')",
      }],
    },
  });
  await installer.apply('project-1');

  assert.equal(
    adapter.state.scripts.character.find(item => item.id === 'manual-script').enabled,
    true,
  );
  assert.equal(storage.current().installTargets.originalScriptChanges.length, 0);
});


test('unified resource state overrides can enable or disable original worldbooks regexes and scripts and restore them', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 88, name: '默认关闭规则', enabled: false, content: 'original' },
  ]);
  adapter.state.binding.primary = '角色原世界书';
  adapter.state.regexes = [
    { id: 'manual', script_name: '玩家正则', enabled: true, find_regex: 'foo', replace_string: 'bar' },
  ];
  adapter.state.scripts.character = [
    { type: 'script', id: 'manual-script', name: '玩家脚本', enabled: true, content: 'manual' },
  ];

  const storage = memoryStorage(project([
    { kind: 'data', name: 'state-only.txt', format: 'text', content: 'state rules' },
  ]));
  await storage.putInstalledProject({
    ...storage.current(),
    bundle: {
      schema_version: 1,
      artifacts: [{ kind: 'data', name: 'state-only.txt', format: 'text', content: 'state rules' }],
      resource_overrides: [
        {
          kind: 'worldbook',
          state: 'enabled',
          target: { worldbook: '角色原世界书', uid: '88', name: '默认关闭规则' },
        },
        {
          kind: 'regex',
          state: 'disabled',
          target: { scope: 'character', id: 'manual', name: '玩家正则', find_regex: 'foo' },
        },
        {
          kind: 'script',
          state: 'disabled',
          target: { scope: 'character', id: 'manual-script', name: '玩家脚本' },
        },
      ],
    },
  });

  const installer = createWorkshopInstaller({ adapter, storage });
  const applied = await installer.apply('project-1');

  assert.equal(adapter.state.worldbooks.get('角色原世界书')[0].enabled, true);
  assert.equal(adapter.state.regexes[0].enabled, false);
  assert.equal(adapter.state.scripts.character[0].enabled, false);
  assert.equal(applied.installTargets.originalWorldbookChanges[0].desiredState, 'enabled');
  assert.equal(applied.installTargets.originalRegexChanges[0].desiredState, 'disabled');
  assert.equal(applied.installTargets.originalScriptChanges[0].desiredState, 'disabled');

  await installer.uninstall('project-1');

  assert.equal(adapter.state.worldbooks.get('角色原世界书')[0].enabled, false);
  assert.equal(adapter.state.regexes[0].enabled, true);
  assert.equal(adapter.state.scripts.character[0].enabled, true);
});

test('removing a saved resource state override on update restores the original state', async () => {
  const adapter = fakeAdapter();
  adapter.state.regexes = [
    { id: 'manual', script_name: '玩家正则', enabled: true, find_regex: 'foo', replace_string: 'bar' },
  ];
  const storage = memoryStorage(project([
    { kind: 'data', name: 'state-only.txt', format: 'text', content: 'v1' },
  ]));
  await storage.putInstalledProject({
    ...storage.current(),
    bundle: {
      schema_version: 1,
      artifacts: [{ kind: 'data', name: 'state-only.txt', format: 'text', content: 'v1' }],
      resource_overrides: [{
        kind: 'regex',
        state: 'disabled',
        target: { scope: 'character', id: 'manual', name: '玩家正则', find_regex: 'foo' },
      }],
    },
  });

  const installer = createWorkshopInstaller({ adapter, storage });
  await installer.apply('project-1');
  assert.equal(adapter.state.regexes[0].enabled, false);

  await storage.putInstalledProject({
    ...storage.current(),
    version: 3,
    bundle: {
      schema_version: 1,
      artifacts: [{ kind: 'data', name: 'state-only.txt', format: 'text', content: 'v2' }],
    },
  });

  await installer.apply('project-1');
  assert.equal(adapter.state.regexes[0].enabled, true);
  assert.equal(storage.current().installTargets.originalRegexChanges.length, 0);
});
