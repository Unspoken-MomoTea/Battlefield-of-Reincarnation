import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDedicatedArtifacts,
  dedicatedInitialValues,
  projectCategoryForSelection,
  resolvePublishMode,
} from '../views/author/publish-templates.js';

test('unified category maps store to extension backend and character to subtypes', () => {
  assert.equal(resolvePublishMode('extension'), 'extension');
  assert.equal(resolvePublishMode('store_catalog'), 'store_catalog');
  assert.equal(resolvePublishMode('character', 'world_character'), 'world_character');
  assert.equal(resolvePublishMode('character', 'opening_character'), 'opening_character');
  assert.equal(resolvePublishMode('character', 'opening_partner'), 'opening_partner');
  assert.equal(projectCategoryForSelection('store_catalog'), 'extension');
  assert.equal(projectCategoryForSelection('extension'), 'extension');
  assert.equal(projectCategoryForSelection('character'), 'character');
});

test('world character form generates worldbook plus descriptor', () => {
  const artifacts = buildDedicatedArtifacts({
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
  }, 'world_character', '作品');
  assert.deepEqual(artifacts.map(item => item.kind), ['worldbook', 'data']);
  assert.deepEqual(artifacts[0].content.entries[0].strategy.keys, ['测试人物', '别名A', '别名B']);
  assert.match(artifacts[0].content.entries[0].content, /种族：人类/u);
  assert.equal(artifacts[1].content.kind, 'world_character');
});

test('opening character is limited to rank I-III, one bloodline and two form-driven skills', () => {
  const artifacts = buildDedicatedArtifacts({
    opening_name: '开局角色',
    opening_race: '精灵',
    opening_identity: '轮回者',
    opening_occupation_name: '法师',
    opening_occupation_type: '战斗',
    opening_occupation_traits: '施法,元素',
    opening_occupation_source: '学院',
    opening_rank: 'Ⅱ',
    opening_bloodline_name: '元素血脉',
    opening_bloodline_quality: 'D',
    opening_bloodline_attr_力量: 'F',
    opening_bloodline_attr_敏捷: 'F',
    opening_bloodline_attr_体质: 'E',
    opening_bloodline_attr_精神: 'D',
    opening_bloodline_attr_魅力: 'E',
    opening_bloodline_effect_name: '元素亲和',
    opening_bloodline_effect_desc: '元素技能效果提升。',
    opening_bloodline_desc: '元素侧血统。',
    opening_skill_1_name: '火球',
    opening_skill_1_quality: 'E',
    opening_skill_1_type: '0',
    opening_skill_1_effect_name: '爆炎',
    opening_skill_1_effect_desc: '造成火焰伤害。',
    opening_skill_1_desc: '基础火系技能。',
    opening_skill_1_consume: 'EP 10',
    opening_skill_2_name: '元素感知',
    opening_skill_2_quality: 'F',
    opening_skill_2_type: '1',
    opening_skill_2_effect_desc: '感知元素波动。',
  }, 'opening_character', '作品');

  const asset = artifacts[0].content;
  assert.equal(artifacts.length, 1);
  assert.equal(asset.kind, 'opening_character');
  assert.equal(asset.build.层级, 'Ⅱ');
  assert.deepEqual(Object.keys(asset.build.血统), ['元素血脉']);
  assert.deepEqual(Object.keys(asset.build.技能), ['火球', '元素感知']);
  assert.deepEqual(asset.build.职业.法师, {
    类型: '战斗',
    特性: ['施法', '元素'],
    来源: '学院',
  });
  assert.equal(asset.build.血统.元素血脉.原始属性.精神, 'D');
  assert.equal(asset.build.技能.火球.效果.爆炎, '造成火焰伤害。');
  assert.equal('装备' in asset.build, false);
  assert.equal('状态' in asset.build, false);
  assert.equal('形态库' in asset.build, false);
});

test('opening ranks above III are normalized back to I', () => {
  const asset = buildDedicatedArtifacts({
    opening_name: '超阶',
    opening_rank: 'Ⅸ',
  }, 'opening_partner', '作品')[0].content;
  assert.equal(asset.build.层级, 'Ⅰ');
});

test('opening partner keeps persona and uses the same constrained build', () => {
  const asset = buildDedicatedArtifacts({
    opening_name: '伙伴',
    opening_rank: 'Ⅲ',
    opening_personality: '沉稳',
    opening_likes: '茶',
    opening_background: '旧友',
  }, 'opening_partner', '作品')[0].content;
  assert.equal(asset.kind, 'opening_partner');
  assert.equal(asset.profile.性格, '沉稳');
  assert.equal(asset.build.层级, 'Ⅲ');
  assert.deepEqual(asset.build.血统, {});
  assert.deepEqual(asset.build.技能, {});
});

test('store catalog accepts repeatable form output with only F-E-D and price <= 1000', () => {
  const store = {
    equipments: [{
      id: 'eq-1',
      name: '测试剑',
      tier: 'D',
      cost: 1000,
      type: 0,
      source: '创意工坊',
      tags: [],
      attrs: { ATK: 'D' },
      effects: { 锋利: '更容易造成伤害。' },
      desc: '测试装备',
      consume: '无',
    }],
    items: [{
      id: 'item-1',
      name: '测试药剂',
      tier: 'E',
      cost: 200,
      type: '特殊',
      quantity: 3,
      source: '创意工坊',
      tags: [],
      effects: {},
      desc: '测试道具',
      consume: '无',
      cd: '0',
    }],
    skills: [],
  };
  const artifact = buildDedicatedArtifacts({ store_catalog: store }, 'store_catalog', '商店')[0];
  assert.equal(artifact.kind, 'data');
  assert.equal(artifact.content.kind, 'store_catalog');
  assert.equal(artifact.content.catalog.items[0].quantity, 3);
  assert.equal(artifact.content.catalog.equipments[0].attrs.ATK, 'D');

  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], cost: 1001 }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /0-1000/u,
  );
  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], tier: 'C' }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /F、E、D/u,
  );
});

test('dedicated update values recover bloodline, two skills and store catalog without JSON textareas', () => {
  const values = dedicatedInitialValues([{
    kind: 'data',
    content: {
      kind: 'opening_character',
      name: '角色',
      build: {
        层级: 'Ⅲ',
        血统: {
          人类强化: {
            品质: 'E',
            原始属性: { 力量: 'E', 敏捷: 'F', 体质: 'E', 精神: 'F', 魅力: 'F' },
            效果: { 强健: '体能更好。' },
            描述: '强化人类。',
          },
        },
        技能: {
          技能一: { 品质: 'E', 类型: 0, 效果: { A: 'A' }, 描述: '一', 消耗: 'EP 5' },
          技能二: { 品质: 'F', 类型: 1, 效果: {}, 描述: '二', 消耗: '无' },
        },
      },
    },
  }], 'opening_character', '作品');
  assert.equal(values.opening_rank, 'Ⅲ');
  assert.equal(values.opening_bloodline_name, '人类强化');
  assert.equal(values.opening_bloodline_attr_力量, 'E');
  assert.equal(values.opening_skill_1_name, '技能一');
  assert.equal(values.opening_skill_2_name, '技能二');

  const storeValues = dedicatedInitialValues([{
    kind: 'data',
    content: { kind: 'store_catalog', catalog: { equipments: [], items: [{ id: 'x', name: '物品' }], skills: [] } },
  }], 'store_catalog', '商店');
  assert.equal(storeValues.store_catalog.items[0].name, '物品');
});
