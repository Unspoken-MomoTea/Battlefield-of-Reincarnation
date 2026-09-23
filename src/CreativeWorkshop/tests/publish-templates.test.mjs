import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDedicatedArtifacts,
  resolvePublishMode,
} from '../views/author/publish-templates.js';

function form(values = {}) {
  return { get: key => values[key] ?? '' };
}

test('publish mode maps character and store templates independently', () => {
  assert.equal(resolvePublishMode('character', 'world_character', ''), 'world_character');
  assert.equal(resolvePublishMode('character', 'opening_character', ''), 'opening_character');
  assert.equal(resolvePublishMode('character', 'opening_partner', ''), 'opening_partner');
  assert.equal(resolvePublishMode('extension', '', 'store_catalog'), 'store_catalog');
  assert.equal(resolvePublishMode('extension', '', 'extension'), 'extension');
});

test('world character form generates a worldbook entry and descriptor only', () => {
  const artifacts = buildDedicatedArtifacts(form({
    world_name: '测试人物',
    world_keywords: '别名A, 别名B',
    world_race: '人类',
    world_identity: '队长,调查员',
    world_occupation: '剑士',
    world_rank: 'Ⅲ',
    world_personality: '冷静',
    world_appearance: '黑发',
    world_background: '背景',
    world_notes: '补充',
  }), 'world_character', '作品');
  assert.deepEqual(artifacts.map(item => item.kind), ['worldbook', 'data']);
  assert.deepEqual(artifacts[0].content.entries[0].strategy.keys, ['测试人物', '别名A', '别名B']);
  assert.match(artifacts[0].content.entries[0].content, /种族：人类/u);
  assert.equal(artifacts[1].content.kind, 'world_character');
});

test('opening character form generates only opening data without worldbook regex or script', () => {
  const artifacts = buildDedicatedArtifacts(form({
    opening_name: '开局角色',
    opening_race: '精灵',
    opening_identity: '轮回者',
    opening_occupation: '法师',
    opening_rank: 'Ⅱ',
    opening_skills: '{"火球":{"品质":"E"}}',
  }), 'opening_character', '作品');
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].kind, 'data');
  assert.equal(artifacts[0].content.kind, 'opening_character');
  assert.equal(artifacts[0].content.build.技能.火球.品质, 'E');
});

test('opening partner form carries persona and build in one data artifact', () => {
  const artifacts = buildDedicatedArtifacts(form({
    opening_name: '伙伴',
    opening_personality: '沉稳',
    opening_likes: '茶',
    opening_background: '旧友',
  }), 'opening_partner', '作品');
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].content.kind, 'opening_partner');
  assert.equal(artifacts[0].content.profile.性格, '沉稳');
  assert.equal(artifacts[0].content.build.种族, '人类');
});

test('store form generates store catalog data only', () => {
  const artifacts = buildDedicatedArtifacts(form({
    store_equipments: '[{"id":"e1","name":"剑"}]',
    store_items: '[]',
    store_skills: '[]',
  }), 'store_catalog', '商店');
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].kind, 'data');
  assert.equal(artifacts[0].content.kind, 'store_catalog');
  assert.equal(artifacts[0].content.catalog.equipments[0].id, 'e1');
});
