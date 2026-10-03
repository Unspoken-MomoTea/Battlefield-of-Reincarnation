import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPublicContentPreview } from '../src/projects/public-preview.js';

function previewFor(content, name = 'data.json') {
  return buildPublicContentPreview({
    schema_version: 1,
    artifacts: [{
      kind: 'data',
      name,
      format: 'json',
      content,
    }],
  });
}

test('public preview exposes structured opening partner MVU data instead of only a text blob', () => {
  const preview = previewFor({
    schema_version: 1,
    kind: 'opening_partner',
    name: '白鸦',
    profile: {
      性格: '冷静',
      喜爱: '甜食',
      外貌: '银发红瞳',
      背景故事: '来自边境。',
    },
    build: {
      种族: '人类',
      身份: ['侦察兵'],
      层级: 'Ⅱ',
      好感度: 35,
      是否队友: true,
      血统: {
        夜鸦: {
          品质: 'E',
          原始属性: { 力量: 'F', 敏捷: 'C' },
          效果: { 夜视: '可在黑暗中视物' },
          描述: '夜鸦血统',
        },
      },
      技能: {
        潜行: { 品质: 'E', 类型: 0, 效果: { 隐匿: '降低存在感' }, 描述: '潜入', 消耗: '5MP' },
      },
      装备: {
        匕首: { 品质: 'E', 类型: 6, 标签: ['轻型'], 原始属性: { 敏捷: 'D' }, 效果: {}, 描述: '短刃', 消耗: '无' },
      },
    },
  }, '白鸦.opening.json');

  assert.equal(preview.data_entries.length, 1);
  assert.equal(preview.data_entries[0].kind, 'opening_partner');
  assert.equal(preview.data_entries[0].name, '白鸦');
  assert.equal(preview.data_entries[0].artifact_name, '白鸦.opening.json');
  assert.equal(preview.data_entries[0].content.build.好感度, 35);
  assert.equal(preview.counts.data, 1);
  assert.equal(preview.counts.opening_partner, 1);
});

test('public preview exposes structured store catalog MVU data and semantic counts', () => {
  const preview = previewFor({
    schema_version: 1,
    kind: 'store_catalog',
    catalog: {
      equipments: [{ name: '七咒之戒', tier: 'D', type: 16, cost: 700, tags: ['饰品'], attrs: { 精神: 'C' }, effects: { 咒印: '强化诅咒' }, description: '戒指', consume: '无' }],
      items: [{ name: '血瓶', tier: 'F', type: '消耗', quantity: 2, cost: 50, tags: [], effects: {}, description: '恢复生命', consume: '一次性', cd: '无' }],
      skills: [{ name: '影步', tier: 'E', type: 0, cost: 300, tags: [], effects: { 位移: '短距离移动' }, description: '位移技能', consume: '10MP' }],
    },
  }, '七咒之戒.store.json');

  assert.equal(preview.data_entries[0].kind, 'store_catalog');
  assert.equal(preview.data_entries[0].content.catalog.equipments[0].name, '七咒之戒');
  assert.equal(preview.counts.store_catalog, 1);
});
