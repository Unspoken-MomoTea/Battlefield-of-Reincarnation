import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectInstalledProject, repairInstalledProject } from '../services/installer/repair.js';
import { createWorkshopInstaller } from '../services/installer.js';
import { SHARED_WORLDBOOK_NAME } from '../services/installer/constants.js';
import { fakeAdapter, memoryStorage, project } from './support/installer-fixture.mjs';

function repairProject() {
  return project([
    {
      kind: 'worldbook', name: '世界书.json', format: 'json',
      content: { entries: { 0: { comment: '工坊条目', content: 'hello', constant: true } } },
    },
    {
      kind: 'regex', name: '正则.json', format: 'json',
      content: [{ scriptName: '工坊正则', findRegex: 'foo', replaceString: 'bar' }],
    },
    {
      kind: 'preset', name: '预设.json', format: 'json',
      content: { settings: { temperature: 0.8 } },
    },
  ]);
}

test('health inspection detects missing or modified owned resources only', async () => {
  const adapter = fakeAdapter();
  const storage = memoryStorage(repairProject());
  const installer = createWorkshopInstaller({ adapter, storage });
  await installer.apply('project-1');

  adapter.state.worldbooks.set(SHARED_WORLDBOOK_NAME, [
    { name: '玩家条目', content: 'keep' },
  ]);
  adapter.state.regexes = [
    { id: 'manual', script_name: '玩家正则' },
    { id: 'rw:project-1:1:0', script_name: '被改坏', find_regex: 'wrong', replace_string: '' },
  ];
  const presetName = storage.current().installTargets.presets[0];
  adapter.state.presets.delete(presetName);

  const result = await inspectInstalledProject(adapter, storage.current());
  assert.equal(result.healthy, false);
  assert.deepEqual(
    result.issues.map(item => item.type).sort(),
    ['preset_missing', 'regex_modified', 'worldbook_entry_missing'].sort(),
  );
});

test('repair restores project owned resources while preserving unrelated user resources', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set(SHARED_WORLDBOOK_NAME, [{ name: '玩家条目', content: 'keep' }]);
  const storage = memoryStorage(repairProject());
  const installer = createWorkshopInstaller({ adapter, storage });
  await installer.apply('project-1');

  adapter.state.worldbooks.set(SHARED_WORLDBOOK_NAME, [{ name: '玩家条目', content: 'keep' }]);
  adapter.state.regexes = [{ id: 'manual', script_name: '玩家正则' }];
  const presetName = storage.current().installTargets.presets[0];
  adapter.state.presets.delete(presetName);

  const repaired = await repairInstalledProject({ adapter, storage }, 'project-1');
  assert.equal(repaired.health.healthy, true);
  assert.ok(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME).some(entry => entry.name === '玩家条目'));
  assert.ok(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME).some(entry => entry.extra?.reincarnationWorkshop?.sourceId === 'project-1'));
  assert.ok(adapter.state.regexes.some(regex => regex.id === 'manual'));
  assert.ok(adapter.state.regexes.some(regex => regex.id === 'rw:project-1:1:0'));
  assert.ok(adapter.state.presets.has(presetName));
  assert.ok(storage.current().repairState.lastRepairedAt > 0);
});

test('health inspection refuses a character scoped repair on the wrong character', async () => {
  const adapter = fakeAdapter();
  adapter.state.character = '角色B';
  const installed = repairProject();
  installed.applied = true;
  installed.appliedVersion = installed.version;
  installed.targetCharacterName = '角色A';
  installed.installTargets = { worldbook: SHARED_WORLDBOOK_NAME, regexIds: ['rw:project-1:1:0'], presets: [] };

  const result = await inspectInstalledProject(adapter, installed);
  assert.equal(result.healthy, false);
  assert.deepEqual(result.issues.map(item => item.type), ['character_mismatch']);
  assert.equal(result.repairable, false);
});


test('health inspection detects edited original conflict entries and repair preserves the edit while disabling it again', async () => {
  const adapter = fakeAdapter();
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 77, name: '原版规则', enabled: true, content: 'original' },
  ]);
  adapter.state.binding.primary = '角色原世界书';

  const storage = memoryStorage(project([
    {
      kind: 'worldbook',
      name: 'DLC世界书.json',
      format: 'json',
      original_conflicts: [{
        action: 'disable',
        target: { worldbook: '角色原世界书', uid: '77', name: '原版规则' },
      }],
      content: {
        entries: { 0: { comment: 'DLC规则', content: 'replacement', constant: true } },
      },
    },
  ]));
  const installer = createWorkshopInstaller({ adapter, storage });

  await installer.apply('project-1');
  adapter.state.worldbooks.set('角色原世界书', [
    { uid: 77, name: '原版规则', enabled: false, content: 'player edit' },
  ]);

  const before = await inspectInstalledProject(adapter, storage.current());
  assert.ok(before.issues.some(item => item.type === 'original_conflict_modified'));

  const repaired = await repairInstalledProject({ adapter, storage }, 'project-1');
  assert.equal(repaired.health.healthy, true);
  assert.deepEqual(adapter.state.worldbooks.get('角色原世界书'), [
    { uid: 77, name: '原版规则', enabled: false, content: 'player edit' },
  ]);
  assert.equal(storage.current().installTargets.originalWorldbookChanges[0].userModified, true);
});
