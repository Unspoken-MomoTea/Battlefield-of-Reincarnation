import assert from 'node:assert/strict';
import test from 'node:test';

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  };
}

globalThis.window = new EventTarget();

let receivedBuild = null;
window.Samsara = {
  applyOpeningBuild(build) {
    receivedBuild = build;
  },
};

const {
  getOpeningSelection,
  resetOpeningSelection,
} = await import('../data/selection-store.js');
const {
  saveCharacterBuild,
  savePartnerBuild,
} = await import('../data/character-builder.js');
const {
  installShopItem,
  removeShopItem,
} = await import('../data/shop-runtime.js');
await import('../data/state-receiver.js');
await import('../data/host-adapter.js');
const { commitOpening } = await import('../data/state-bridge.js');

test('opening build reaches the host through one canonical selection state', () => {
  resetOpeningSelection();
  receivedBuild = null;

  saveCharacterBuild({
    name: '测试轮回者',
    race: '人类',
    attributes: { 力量: 'D' },
  });
  savePartnerBuild({ name: '测试伙伴', race: '精灵' });
  installShopItem({ id: 'item-1', name: '恢复药', type: 'item', cost: 10 });

  commitOpening();

  assert.ok(receivedBuild, 'host receives the committed opening build');
  assert.equal(receivedBuild.character.name, '测试轮回者');
  assert.deepEqual(receivedBuild.character.attributes, { 力量: 'D' });
  assert.deepEqual(receivedBuild.partner, [{ name: '测试伙伴', race: '精灵' }]);
  assert.deepEqual(receivedBuild.products, [
    { id: 'item-1', name: '恢复药', type: 'item', cost: 10 },
  ]);

  removeShopItem('item-1');
  assert.deepEqual(getOpeningSelection().products, []);

  installShopItem({ id: 'item-2', name: '绷带' });
  resetOpeningSelection();
  assert.deepEqual(getOpeningSelection().products, [], 'reset clears opening products');
});
