import assert from 'node:assert/strict';
import test from 'node:test';

import { scanPublishResources } from '../services/publish-resources.js';

test('publish resource scan exposes all active and inactive entries from active sources plus regexes and scripts', async () => {
  const books = {
    角色主书: [
      { uid: 1, comment: '常驻规则', content: 'blue', enabled: true, constant: true },
      { uid: 2, comment: '关闭条目', content: 'off', enabled: false, constant: true },
    ],
    角色附加: [
      { uid: 3, comment: '附加关闭', content: 'off', enabled: false },
    ],
    聊天书: [
      { uid: 4, comment: '关键词条目', content: 'green', enabled: true, constant: false, key: ['测试'] },
    ],
    全局书: [
      { uid: 5, comment: '向量条目', content: 'vector', enabled: true, vectorized: true },
    ],
    未启用书: [
      { uid: 6, comment: '不应出现', content: 'hidden', enabled: true },
    ],
  };

  const adapter = {
    getCharWorldbookNames: async () => ({ primary: '角色主书', additional: ['角色附加'] }),
    getChatWorldbookName: async () => '聊天书',
    getGlobalWorldbookNames: async () => ['全局书'],
    getWorldbook: async name => books[name] || [],
    getCharacterRegexes: async () => [
      { id: 'enabled-regex', script_name: '启用正则', enabled: true, find_regex: 'foo', replace_string: 'bar' },
      { id: 'disabled-regex', script_name: '关闭正则', enabled: false, find_regex: 'x', replace_string: 'y' },
      { id: 'rw:other:0:0', script_name: '其他工坊正则', enabled: true, find_regex: 'skip' },
    ],
    getScriptTrees: async scope => scope === 'character'
      ? [
          { id: 'enabled-script', name: '启用脚本', enabled: true, content: 'on' },
          { id: 'disabled-script', name: '关闭脚本', enabled: false, content: 'off' },
          { id: 'rw:other:script:0', name: '其他工坊脚本', enabled: true, content: 'skip' },
        ]
      : [],
    getCurrentCharacterName: async () => '测试角色',
  };

  const result = await scanPublishResources(adapter);

  assert.equal(result.characterName, '测试角色');
  assert.deepEqual(result.worldbooks.map(item => item.name), ['角色主书', '角色附加', '聊天书', '全局书']);
  assert.equal(result.worldbooks[0].entries.length, 2);
  assert.equal(result.worldbooks[0].entries[0].name, '常驻规则');
  assert.equal(result.worldbooks[0].entries[0].strategy_label, '常驻');
  assert.equal(result.worldbooks[0].entries[0].content, 'blue');
  assert.equal(result.worldbooks[0].entries[1].enabled, false);
  assert.equal(result.worldbooks[1].entries[0].name, '附加关闭');
  assert.equal(result.worldbooks[1].entries[0].enabled, false);
  assert.equal(result.worldbooks[2].entries[0].strategy_label, '关键词');
  assert.equal(result.worldbooks[3].entries[0].strategy_label, '向量化');
  assert.deepEqual(result.regexes.map(item => [item.id, item.enabled]), [
    ['enabled-regex', true],
    ['disabled-regex', false],
  ]);
  assert.deepEqual(result.scripts.map(item => [item.id, item.enabled]), [
    ['enabled-script', true],
    ['disabled-script', false],
  ]);
});
