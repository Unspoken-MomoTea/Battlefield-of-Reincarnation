import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';


import {
  buildDedicatedArtifacts,
  dedicatedInitialValues,
  projectCategoryForSelection,
  resolvePublishMode,
  worldCharacterTemplate,
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

test('world character uses one freeform template panel and no MVU-only fields', () => {
  const artifacts = buildDedicatedArtifacts({
    world_name: '测试人物',
    world_keywords: '别名A, 别名B',
    world_content: '{{角色姓名}}:\n  基本信息:\n    种族: 人类\n\n  背景设定:\n    出身: 王都',
  }, 'world_character', '作品');
  assert.deepEqual(artifacts.map(item => item.kind), ['worldbook', 'data']);
  assert.deepEqual(artifacts[0].content.entries[0].strategy.keys, ['测试人物', '别名A', '别名B']);
  assert.deepEqual(artifacts[0].content.entries[0].position, {
    type: 'after_character_definition',
    role: 'system',
    order: 600,
  });
  assert.equal(artifacts[0].content.entries[0].probability, 100);
  assert.match(artifacts[0].content.entries[0].content, /^测试人物:/u);
  assert.match(artifacts[0].content.entries[0].content, /背景设定:/u);
  assert.equal(artifacts[1].content.schema_version, 2);
  assert.equal(artifacts[1].content.profile.content.includes('职业'), false);
  assert.equal('occupation' in artifacts[1].content.profile, false);
  assert.equal('identities' in artifacts[1].content.profile, false);
  assert.equal('rank' in artifacts[1].content.profile, false);
});

test('world character default template is freeform lore instead of MVU character fields', () => {
  const template = worldCharacterTemplate();
  assert.match(template, /^\{\{角色姓名\}\}:/u);
  assert.match(template, /基本信息:/u);
  assert.match(template, /背景设定:/u);
  assert.match(template, /外貌描写:/u);
  assert.match(template, /身体数据:/u);
  assert.match(template, /性格特征:/u);
  assert.match(template, /目标动机:/u);
  assert.match(template, /战斗能力:/u);
  assert.match(template, /个人物品:/u);
  assert.doesNotMatch(template, /^\s*身份:/mu);
  assert.doesNotMatch(template, /^\s*职业:/mu);
  assert.doesNotMatch(template, /^\s*层级:/mu);
});

test('legacy world character descriptor migrates into the freeform content panel without losing data', () => {
  const values = dedicatedInitialValues([{
    kind: 'data',
    content: {
      kind: 'world_character',
      name: '旧人物',
      profile: {
        name: '旧人物',
        aliases: ['旧别名'],
        race: '人类',
        identities: ['调查员'],
        occupation: '剑士',
        rank: 'Ⅲ',
        personality: '冷静',
        appearance: '黑发',
        background: '旧背景',
        notes: '旧补充',
      },
    },
  }], 'world_character', '作品');

  assert.equal(values.world_name, '旧人物');
  assert.equal(values.world_keywords, '旧别名');
  assert.match(values.world_content, /种族: 人类/u);
  assert.match(values.world_content, /身份: 调查员/u);
  assert.match(values.world_content, /职业: 剑士/u);
  assert.match(values.world_content, /层级: Ⅲ/u);
  assert.match(values.world_content, /旧背景/u);
  assert.match(values.world_content, /旧补充/u);
  assert.equal('world_identity' in values, false);
  assert.equal('world_occupation' in values, false);
  assert.equal('world_rank' in values, false);
});

test('dedicated editor removes world-character MVU fields and exposes optional partner worldbook', () => {
  const source = fs.readFileSync(new URL('../views/author/dedicated-editor.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /name="world_identity"|['"]world_identity['"]/u);
  assert.doesNotMatch(source, /name="world_occupation"|['"]world_occupation['"]/u);
  assert.doesNotMatch(source, /name="world_rank"|['"]world_rank['"]/u);
  assert.doesNotMatch(source, /['"]world_background['"]|['"]world_notes['"]/u);
  assert.match(source, /['"]world_content['"]/u);
  assert.match(source, /填写世界书/u);
  assert.match(source, /['"]opening_worldbook_keywords['"]/u);
  assert.match(source, /['"]opening_worldbook_content['"]/u);
  assert.doesNotMatch(source, /partnerWorldbookFromForm/u);
  assert.doesNotMatch(source, /修改上方基础资料时，前序会同步更新/u);
  assert.match(source, /关键词 \/ 别名/u);
  assert.match(source, /世界书内容/u);
  assert.match(source, /不附带世界书/u);
});

test('opening character uses 8 point startup budget and auto F-E-D quality from rank', () => {
  const asset = buildDedicatedArtifacts({
    opening_name: '开局角色',
    opening_race: '精灵',
    opening_identity: '轮回者',
    opening_rank: 'Ⅱ',
    opening_bloodline_name: '元素血脉',
    opening_attributes: { 力量: 0, 敏捷: 1, 体质: 2, 精神: 4, 魅力: 1 },
    opening_bloodline_effect_name: '元素亲和',
    opening_bloodline_effect_desc: '元素技能效果提升。',
    opening_bloodline_desc: '元素侧血统。',
    opening_skills: [
      {
        name: '火球',
        type: '0',
        effectName: '爆炎',
        effectDesc: '造成火焰伤害。',
        desc: '基础火系技能。',
        consume: 'EP 10',
      },
      {
        name: '元素感知',
        type: '1',
        effectName: '',
        effectDesc: '感知元素波动。',
        desc: '',
        consume: '',
      },
    ],
  }, 'opening_character', '作品')[0].content;

  assert.equal(asset.kind, 'opening_character');
  assert.equal(asset.build.层级, 'Ⅱ');
  assert.equal(asset.build.血统.元素血脉.品质, 'E');
  assert.equal(asset.build.技能.火球.品质, 'E');
  assert.equal(asset.build.技能.元素感知.品质, 'E');
  assert.deepEqual(asset.build.血统.元素血脉.原始属性, {
    力量: 'F',
    敏捷: 'E',
    体质: 'D',
    精神: 'B',
    魅力: 'E',
  });
  assert.equal(asset.build.技能.火球.效果.爆炎, '造成火焰伤害。');
  assert.equal('职业' in asset.build, false);
  assert.equal('装备' in asset.build, false);
  assert.equal('状态' in asset.build, false);
  assert.equal('形态库' in asset.build, false);
});

test('opening character rejects more than 8 allocation points', () => {
  assert.throws(
    () => buildDedicatedArtifacts({
      opening_name: '超点角色',
      opening_rank: 'Ⅰ',
      opening_bloodline_name: '人类血统',
      opening_attributes: { 力量: 8, 敏捷: 1, 体质: 0, 精神: 0, 魅力: 0 },
    }, 'opening_character', '作品'),
    /9 \/ 8/u,
  );
});

test('opening partner gets 16 point budget, auto D quality at rank III and can carry equipment', () => {
  const asset = buildDedicatedArtifacts({
    opening_name: '伙伴',
    opening_rank: 'Ⅲ',
    opening_personality: '沉稳',
    opening_likes: '茶',
    opening_background: '旧友',
    opening_bloodline_name: '强化血统',
    opening_attributes: { 力量: 4, 敏捷: 4, 体质: 4, 精神: 2, 魅力: 2 },
    opening_skills: [{ name: '护卫', type: '1', effectName: '', effectDesc: '', desc: '', consume: '' }],
    opening_partner_equipment: [{
      name: '伙伴长剑',
      品质: 'D',
      类型: 0,
      原始属性: { ATK: 'A' },
      效果: { 护主: '保护队友。' },
      描述: '伙伴装备',
    }],
  }, 'opening_partner', '作品')[0].content;

  assert.equal(asset.kind, 'opening_partner');
  assert.equal(asset.profile.性格, '沉稳');
  assert.equal(asset.build.层级, 'Ⅲ');
  assert.equal(asset.build.血统.强化血统.品质, 'D');
  assert.equal(asset.build.技能.护卫.品质, 'D');
  assert.equal(asset.build.装备.伙伴长剑.品质, 'D');
  assert.equal(asset.build.装备.伙伴长剑.原始属性.ATK, 'A');
});

test('opening partner worldbook reuses the freeform character template and green-light keywords', () => {
  const rawContent = '{{角色姓名}}:\n  基本信息:\n    性别: 女\n    种族: 精灵\n\n  背景设定:\n    出身: 月林';
  const artifacts = buildDedicatedArtifacts({
    opening_name: '伙伴',
    opening_race: '人类',
    opening_identity: 'MVU身份不应注入世界书',
    opening_rank: 'Ⅱ',
    opening_personality: 'MVU性格不应注入世界书',
    opening_background: 'MVU背景不应注入世界书',
    opening_bloodline_name: '精灵血统',
    opening_worldbook_enabled: true,
    opening_worldbook_keywords: '银月, 月林向导',
    opening_worldbook_content: rawContent,
  }, 'opening_partner', '作品');

  assert.deepEqual(artifacts.map(item => item.kind), ['data', 'worldbook']);
  assert.equal(artifacts[0].content.worldbook.format, 'freeform');
  assert.deepEqual(artifacts[0].content.worldbook.aliases, ['银月', '月林向导']);
  assert.equal(artifacts[0].content.worldbook.content, rawContent);
  const entry = artifacts[1].content.entries[0];
  assert.equal(entry.strategy.type, 'selective');
  assert.deepEqual(entry.strategy.keys, ['伙伴', '银月', '月林向导']);
  assert.deepEqual(entry.position, {
    type: 'after_character_definition',
    role: 'system',
    order: 600,
  });
  assert.match(entry.content, /^伙伴:/u);
  assert.match(entry.content, /性别: 女/u);
  assert.match(entry.content, /出身: 月林/u);
  assert.doesNotMatch(entry.content, /MVU身份/u);
  assert.doesNotMatch(entry.content, /MVU性格/u);
  assert.doesNotMatch(entry.content, /MVU背景/u);
});

test('opening partner does not emit worldbook when toggle is off or content is blank', () => {
  const base = {
    opening_name: '伙伴',
    opening_rank: 'Ⅰ',
    opening_bloodline_name: '人类血统',
  };
  assert.deepEqual(
    buildDedicatedArtifacts({ ...base, opening_worldbook_enabled: false, opening_worldbook_keywords: '不会使用', opening_worldbook_content: '不会发布' }, 'opening_partner', '作品').map(item => item.kind),
    ['data'],
  );
  assert.deepEqual(
    buildDedicatedArtifacts({ ...base, opening_worldbook_enabled: true, opening_worldbook_content: '   ' }, 'opening_partner', '作品').map(item => item.kind),
    ['data'],
  );
});

test('opening partner rejects more than 16 allocation points', () => {
  assert.throws(
    () => buildDedicatedArtifacts({
      opening_name: '超点伙伴',
      opening_rank: 'Ⅲ',
      opening_bloodline_name: '强化血统',
      opening_attributes: { 力量: 8, 敏捷: 8, 体质: 1, 精神: 0, 魅力: 0 },
    }, 'opening_partner', '作品'),
    /17 \/ 16/u,
  );
});

test('ranks above III normalize to I and therefore F build quality', () => {
  const asset = buildDedicatedArtifacts({
    opening_name: '超阶',
    opening_rank: 'Ⅸ',
    opening_bloodline_name: '测试血统',
  }, 'opening_partner', '作品')[0].content;
  assert.equal(asset.build.层级, 'Ⅰ');
  assert.equal(asset.build.血统.测试血统.品质, 'F');
});

test('store catalog accepts F-E-D, price <= 1000, quantities, and at most two effects', () => {
  const store = {
    equipments: [{
      id: 'eq-1',
      name: '测试剑',
      tier: 'D',
      cost: 1000,
      type: 17,
      source: '创意工坊',
      tags: ['刀剑', '物理'],
      attrs: { ATK: 'A' },
      effects: { 锋利: '更容易造成伤害。', 破甲: '削弱护甲。' },
      desc: '测试装备',
      consume: '无',
    }],
    items: [{
      id: 'item-1',
      name: '测试药剂',
      tier: 'E',
      cost: 300,
      type: '特殊',
      quantity: 3,
      source: '创意工坊',
      tags: ['治疗', '消耗'],
      effects: {},
      desc: '测试道具',
      consume: '药剂1支',
      cd: '0',
    }],
    skills: [{
      id: 'skill-1',
      name: '测试技能',
      tier: 'F',
      cost: 50,
      type: 2,
      source: '创意工坊',
      tags: ['辅助', '特殊'],
      effects: { 测试效果: '产生测试效果。' },
      desc: '测试技能描述',
      consume: 'EP 5',
    }],
  };
  const artifact = buildDedicatedArtifacts({ store_catalog: store }, 'store_catalog', '商店')[0];
  assert.equal(artifact.content.catalog.items[0].quantity, 3);
  assert.equal(Object.keys(artifact.content.catalog.equipments[0].effects).length, 2);
  assert.equal(artifact.content.catalog.equipments[0].attrs.ATK, 'A');
  assert.equal(artifact.content.catalog.equipments[0].type, 17);
  assert.deepEqual(artifact.content.catalog.equipments[0].tags, ['刀剑', '物理']);
  assert.equal(artifact.content.catalog.items[0].type, '特殊');
  assert.equal(artifact.content.catalog.items[0].consume, '药剂1支');
  assert.equal(artifact.content.catalog.items[0].cd, '0');
  assert.equal(artifact.content.catalog.skills[0].type, 2);
  assert.deepEqual(artifact.content.catalog.skills[0].tags, ['辅助', '特殊']);
  assert.equal(artifact.content.catalog.skills[0].consume, 'EP 5');

  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], cost: 1001 }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /不超过 1000/u,
  );
  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], tier: 'C' }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /F、E、D/u,
  );
  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], type: 18 }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /类型必须是开局装备分类 0-17/u,
  );

  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [], items: [{ ...store.items[0], type: '不存在' }], skills: [] },
    }, 'store_catalog', '坏商店'),
    /类型必须是消耗、材料或特殊/u,
  );
  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [], items: [], skills: [{ ...store.skills[0], type: 9 }] },
    }, 'store_catalog', '坏商店'),
    /类型必须是主动、被动或特殊/u,
  );

  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], tier: 'F', cost: 49 }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /下限 50/u,
  );
  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], tier: 'E', cost: 299 }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /下限 300/u,
  );
  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: { equipments: [{ ...store.equipments[0], tier: 'D', cost: 699 }], items: [], skills: [] },
    }, 'store_catalog', '坏商店'),
    /下限 700/u,
  );

  assert.throws(
    () => buildDedicatedArtifacts({
      store_catalog: {
        equipments: [{
          ...store.equipments[0],
          effects: { 一: '1', 二: '2', 三: '3' },
        }],
        items: [],
        skills: [],
      },
    }, 'store_catalog', '坏商店'),
    /最多只能填写 2 条效果/u,
  );
});

test('dedicated update values recover point allocation, skills, partner equipment and store catalog', () => {
  const values = dedicatedInitialValues([{
    kind: 'data',
    content: {
      kind: 'opening_partner',
      name: '角色',
      build: {
        层级: 'Ⅲ',
        血统: {
          人类强化: {
            品质: 'D',
            原始属性: { 力量: 'B', 敏捷: 'F', 体质: 'E', 精神: 'F', 魅力: 'F' },
            效果: { 强健: '体能更好。' },
            描述: '强化人类。',
          },
        },
        技能: {
          技能一: { 品质: 'D', 类型: 0, 效果: { A: 'A' }, 描述: '一', 消耗: 'EP 5' },
          技能二: { 品质: 'D', 类型: 1, 效果: {}, 描述: '二', 消耗: '无' },
        },
        装备: {
          长剑: { 品质: 'D', 类型: 0, 原始属性: { ATK: 'D' }, 效果: {}, 描述: '' },
        },
      },
    },
  }], 'opening_partner', '作品');

  assert.equal(values.opening_rank, 'Ⅲ');
  assert.equal(values.opening_bloodline_name, '人类强化');
  assert.equal(values.opening_attributes.力量, 4);
  assert.equal(values.opening_skills.length, 2);
  assert.equal(values.opening_skills[0].name, '技能一');
  assert.equal(values.opening_skills[1].name, '技能二');
  assert.equal(values.opening_partner_equipment[0].name, '长剑');
  assert.equal(values.opening_worldbook_enabled, false);
  assert.equal(values.opening_worldbook_keywords, '');
  assert.equal(values.opening_worldbook_content, '');

  const worldbookValues = dedicatedInitialValues([{
    kind: 'data',
    content: {
      kind: 'opening_partner',
      name: '世界书伙伴',
      profile: { 性格: '安静', 喜爱: '书', 背景故事: '旧友' },
      worldbook: { content: '额外背景设定' },
      build: { 层级: 'Ⅰ', 种族: '人类', 身份: ['同伴'], 血统: {}, 技能: {}, 装备: {} },
    },
  }], 'opening_partner', '作品');
  assert.equal(worldbookValues.opening_worldbook_enabled, true);
  assert.equal(worldbookValues.opening_worldbook_keywords, '');
  assert.equal(worldbookValues.opening_worldbook_content, '额外背景设定');

  const freeformWorldbookValues = dedicatedInitialValues([{
    kind: 'data',
    content: {
      kind: 'opening_partner',
      name: '自由伙伴',
      worldbook: {
        format: 'freeform',
        aliases: ['别名A', '别名B'],
        content: '{{角色姓名}}:\n  背景设定:\n    出身: 海港',
      },
      build: { 层级: 'Ⅰ', 种族: '人类', 身份: [], 血统: {}, 技能: {}, 装备: {} },
    },
  }], 'opening_partner', '作品');
  assert.equal(freeformWorldbookValues.opening_worldbook_enabled, true);
  assert.equal(freeformWorldbookValues.opening_worldbook_keywords, '别名A, 别名B');
  assert.match(freeformWorldbookValues.opening_worldbook_content, /\{\{角色姓名\}\}:/u);
  assert.match(freeformWorldbookValues.opening_worldbook_content, /出身: 海港/u);

  const storeValues = dedicatedInitialValues([{
    kind: 'data',
    content: { kind: 'store_catalog', catalog: { equipments: [], items: [{ id: 'x', name: '物品' }], skills: [] } },
  }], 'store_catalog', '商店');
  assert.equal(storeValues.store_catalog.items[0].name, '物品');
});


test('dynamic opening skills still serialize at most two entries', () => {
  const asset = buildDedicatedArtifacts({
    opening_name: '动态技能角色',
    opening_rank: 'Ⅱ',
    opening_bloodline_name: '测试血统',
    opening_skills: [
      { name: '一', type: '0', effectName: 'A', effectDesc: '1' },
      { name: '二', type: '1', effectName: 'B', effectDesc: '2' },
      { name: '三', type: '2', effectName: 'C', effectDesc: '3' },
    ],
  }, 'opening_character', '作品')[0].content;
  assert.deepEqual(Object.keys(asset.build.技能), ['一', '二']);
  assert.equal(asset.build.技能.一.品质, 'E');
  assert.equal(asset.build.技能.二.品质, 'E');
});
