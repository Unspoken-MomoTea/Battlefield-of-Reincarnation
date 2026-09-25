import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkshopInstaller, SHARED_WORLDBOOK_NAME } from '../services/installer.js';
import { fakeAdapter, project } from './support/installer-fixture.mjs';

function fixture(...projects) {
  const records = new Map(projects.map(value => [value.id, structuredClone(value)]));
  const storage = {
    getInstalledProject: async id => structuredClone(records.get(id)),
    getInstalledProjects: async () => structuredClone([...records.values()]),
    putInstalledProject: async value => records.set(value.id, structuredClone(value)),
  };
  const adapter = fakeAdapter();
  return { records, storage, adapter, installer: createWorkshopInstaller({ storage, adapter }) };
}
const mod = (id, extra = {}) => project([
  { kind: 'worldbook', name: 'book.json', content: [{ name: id, content: id }] },
  { kind: 'regex', name: 'regex.json', content: [{ scriptName: id, findRegex: id, replaceString: 'x', placement: [2] }] },
], { id, name: id, ...extra });

const characterMod = (id, extra = {}) => project([
  {
    kind: 'worldbook',
    name: `${id}.worldbook.json`,
    format: 'json',
    content: {
      entries: [{
        name: `[角色] ${id}`,
        enabled: true,
        strategy: { type: 'selective', keys: [id] },
        position: { type: 'after_character_definition', role: 'system', order: 600 },
        content: `${id}-v1`,
      }],
    },
  },
  {
    kind: 'data',
    name: `${id}.character.json`,
    format: 'json',
    content: { schema_version: 2, kind: 'world_character', name: id, profile: { name: id } },
  },
], { id, name: id, category: 'character', ...extra });

function characterOrders(adapter) {
  return (adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME) || [])
    .filter(entry => /^\[角色\]\s/u.test(String(entry.name || '')))
    .map(entry => ({
      id: entry.extra?.reincarnationWorkshop?.sourceId,
      order: entry.position?.order,
      content: entry.content,
    }));
}

test('concurrent installs from separate installer instances preserve both mods', async () => {
  const { installer, storage, adapter } = fixture(mod('a'), mod('b'));
  const second = createWorkshopInstaller({ storage, adapter });
  await Promise.all([installer.apply('a'), second.apply('b')]);
  assert.deepEqual(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME).map(e => e.name), ['a', 'b']);
  assert.equal(adapter.state.regexes.length, 3);
  await installer.uninstall('a');
  assert.deepEqual(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME).map(e => e.name), ['b']);
  assert.ok(adapter.state.regexes.some(e => e.id.startsWith('rw:b:')));
});

test('failed install rolls back without losing the next queued mod', async () => {
  const broken = mod('a');
  broken.bundle.resource_overrides = [{ kind: 'regex', state: 'disabled', target: { id: 'missing', scope: 'character' } }];
  const { installer, adapter } = fixture(broken, mod('b'));
  const results = await Promise.allSettled([installer.apply('a'), installer.apply('b')]);
  assert.deepEqual(results.map(r => r.status), ['rejected', 'fulfilled']);
  assert.deepEqual(adapter.state.worldbooks.get(SHARED_WORLDBOOK_NAME).map(e => e.name), ['b']);
});

test('character mods use contiguous 601+ orders, preserve update position, and compact after uninstall', async () => {
  const { installer, adapter, records } = fixture(
    characterMod('a'),
    characterMod('b'),
    characterMod('c'),
    characterMod('d'),
  );

  await installer.apply('a');
  await installer.apply('b');
  await installer.apply('c');
  assert.deepEqual(characterOrders(adapter).map(item => [item.id, item.order]), [
    ['a', 601],
    ['b', 602],
    ['c', 603],
  ]);

  records.get('b').version = 3;
  records.get('b').bundle.artifacts[0].content.entries[0].content = 'b-v2';
  await installer.apply('b');
  assert.deepEqual(characterOrders(adapter).map(item => [item.id, item.order]), [
    ['a', 601],
    ['b', 602],
    ['c', 603],
  ]);
  assert.equal(characterOrders(adapter).find(item => item.id === 'b').content, 'b-v2');

  await installer.uninstall('b');
  assert.deepEqual(characterOrders(adapter).map(item => [item.id, item.order]), [
    ['a', 601],
    ['c', 602],
  ]);

  await installer.apply('d');
  assert.deepEqual(characterOrders(adapter).map(item => [item.id, item.order]), [
    ['a', 601],
    ['c', 602],
    ['d', 603],
  ]);
});

test('base cannot be uninstalled while an applied mod depends on it, including after caching a new version', async () => {
  const { installer, records } = fixture(mod('base'), mod('dependent', { dependencies: [{ project_id: 'base', min_version: 1 }] }));
  await installer.apply('base');
  await installer.apply('dependent');
  records.get('dependent').dependencies = [];
  records.get('dependent').version = 3;
  await assert.rejects(installer.uninstall('base'), /dependent/);
  assert.equal(records.get('base').applied, true);
  await installer.uninstall('dependent');
  await installer.uninstall('base');
  assert.equal(records.get('base').applied, false);
});

test('resource override cannot disable another mod regex or script, including repair', async () => {
  const a = mod('a');
  a.bundle.artifacts.push({ kind: 'script', name: 'a.js', format: 'text', scope: 'character', content: 'void 0;' });
  const { installer, adapter, records } = fixture(a, mod('b'));
  await installer.apply('a');
  await installer.apply('b');
  const regexId = adapter.state.regexes.find(r => r.id.startsWith('rw:a:')).id;
  const scriptId = adapter.state.scripts.character.find(s => s.id.startsWith('rw:a:')).id;
  records.get('b').bundle.resource_overrides = [
    { kind: 'regex', state: 'disabled', target: { id: regexId, scope: 'character' } },
    { kind: 'script', state: 'disabled', target: { id: scriptId, scope: 'character' } },
  ];
  const result = await installer.preflight('b');
  assert.deepEqual(result.blocking.map(i => i.type), ['original_regex_target_invalid', 'original_script_target_invalid']);
  await assert.rejects(installer.repair('b'), /当前无法修复/);
  assert.equal(adapter.state.scripts.character.find(s => s.id === scriptId).enabled, true);
});
