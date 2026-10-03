import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeMvuEntry } from '../views/discover/mvu-preview.js';

test('opening partner summary exposes identity, rank and nested content counts', () => {
  const summary = summarizeMvuEntry({
    kind: 'opening_partner',
    name: '白鸦',
    artifact_name: '白鸦.opening.json',
    content: {
      kind: 'opening_partner',
      name: '白鸦',
      profile: { 性格: '冷静' },
      build: {
        种族: '人类',
        身份: ['侦察兵', '佣兵'],
        层级: 'Ⅱ',
        好感度: 35,
        是否队友: true,
        血统: { 夜鸦: {} },
        技能: { 潜行: {}, 突袭: {} },
        装备: { 匕首: {} },
      },
    },
  });

  assert.equal(summary.typeLabel, '开局伙伴');
  assert.equal(summary.title, '白鸦');
  assert.deepEqual(summary.identity, ['侦察兵', '佣兵']);
  assert.equal(summary.rank, 'Ⅱ');
  assert.equal(summary.race, '人类');
  assert.equal(summary.skills, 2);
  assert.equal(summary.equipment, 1);
  assert.equal(summary.favorability, 35);
  assert.equal(summary.teammate, true);
});

test('store summary reports category totals and gives a semantic title', () => {
  const summary = summarizeMvuEntry({
    kind: 'store_catalog',
    artifact_name: '七咒之戒.store.json',
    content: {
      kind: 'store_catalog',
      catalog: {
        equipments: [{ name: 'A' }, { name: 'B' }],
        items: [{ name: 'C' }],
        skills: [{ name: 'D' }],
      },
    },
  });

  assert.equal(summary.typeLabel, '开局商店');
  assert.equal(summary.title, '七咒之戒');
  assert.deepEqual(summary.storeCounts, { equipments: 2, items: 1, skills: 1, total: 4 });
});

test('generic data remains available as raw data instead of disappearing', () => {
  const summary = summarizeMvuEntry({
    kind: 'generic_data',
    artifact_name: 'custom.json',
    content: { hello: 'world' },
  });

  assert.equal(summary.typeLabel, '数据');
  assert.equal(summary.title, 'custom');
});


test('detail views render structured content before update history and no longer label MVU as other content', async () => {
  const fs = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const discover = fs.readFileSync(
    fileURLToPath(new URL('../views/discover.js', import.meta.url)),
    'utf8',
  );
  const admin = fs.readFileSync(
    fileURLToPath(new URL('../views/admin/projects.js', import.meta.url)),
    'utf8',
  );
  const contentPreview = fs.readFileSync(
    fileURLToPath(new URL('../views/discover/content-preview.js', import.meta.url)),
    'utf8',
  );

  assert.ok(
    discover.indexOf('renderContentPreview(doc, detail)')
      < discover.indexOf('renderChangePreview(doc, detail.change_preview'),
  );
  assert.ok(
    admin.indexOf('renderContentPreview(doc, detail)')
      < admin.indexOf('renderChangePreview(doc, detail.change_preview'),
  );
  assert.doesNotMatch(contentPreview, /textContent: '其他内容'/u);
  assert.match(contentPreview, /renderMvuPreview\(doc, dataEntries\)/u);
});
