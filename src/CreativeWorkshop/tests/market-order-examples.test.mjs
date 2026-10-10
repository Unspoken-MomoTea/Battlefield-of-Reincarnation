import assert from 'node:assert/strict';
import test from 'node:test';
import { marketOrderPreviewExamples } from '../views/market-order-examples.js';
import { createMarketView } from '../views/market.js';

class Node {
  constructor(tag = 'div', className = '', textContent = '') {
    this.tag = tag;
    this.textContent = String(textContent);
    this.children = [];
    this.hidden = false;
    this.dataset = {};
    this.handlers = {};
    this.classes = new Set(className.split(/\s+/u).filter(Boolean));
    this.classList = {
      add: name => this.classes.add(name),
      toggle: (name, force) => {
        if (force ?? !this.classes.has(name)) this.classes.add(name);
        else this.classes.delete(name);
      },
    };
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  click() { this.handlers.click?.(); }
}
const element = (tag, className, text) => new Node(tag, className, text);
const button = (label, className, handler) => {
  const node = new Node('button', className, label);
  if (handler) node.addEventListener('click', handler);
  return node;
};
const flush = () => new Promise(resolve => setImmediate(resolve));

test('samples cover flexible role, skill, item, equipment and bloodline intents but cannot be traded', () => {
  const buys = marketOrderPreviewExamples('buy', 1_000);
  const swaps = marketOrderPreviewExamples('swap', 1_000);
  assert.equal(buys.length, 3);
  assert.equal(swaps.length, 3);
  assert.ok(buys.some(x => x.asset_kind === 'teammate' && /不限姓名/u.test(x.asset_name)));
  assert.ok(swaps.some(x => x.wanted.kind === 'teammate'));
  assert.ok(swaps.some(x => x.offered.kind === 'bloodline'));
  for (const sample of [...buys, ...swaps]) {
    assert.equal(sample.demo, true);
    assert.ok(sample.id.startsWith('demo:'));
    assert.ok(sample.expires_at > 1_000);
    assert.ok(sample.note.length > 10);
  }
});

test('testing-channel samples render through orders tab and never submit real trades', async () => {
  const nodes = {
    marketModes: [], marketPanels: [], marketCategories: [],
    marketOrderViews: [new Node('button'), new Node('button')],
    marketOrderCreate: new Node('button'),
    marketSwapCreate: new Node('button'),
    marketOrderRefresh: new Node('button'),
    marketOrderExamples: new Node('button'),
    marketOrdersList: new Node(),
    marketOrdersEditor: new Node(),
    marketSummary: new Node(),
  };
  nodes.marketOrderViews[0].dataset.marketOrderView = 'buy';
  nodes.marketOrderViews[1].dataset.marketOrderView = 'swap';
  let reads = 0;
  let writes = 0;
  const marketService = {
    listBuyOrders: async () => { reads++; return { items: [] }; },
    listSwaps: async () => { reads++; return { items: [] }; },
    inventory: async () => ({assets:[],coin:0,inHub:true}),
    fillBuyOrder: async () => { writes++; throw new Error('demo trade forbidden'); },
    acceptSwap: async () => { writes++; throw new Error('demo swap forbidden'); },
  };
  const view = createMarketView({
    nodes, element, button,
    empty: (root, text) => root.replaceChildren(new Node('span', '', text)),
    notifyError: error => { throw error; },
    confirmDialog: async () => false,
    host: {}, marketService, getAuth: () => ({user: {id: 1}}),
    showExamples: true,
  });
  await view.openOrders();
  assert.equal(reads, 1, 'real query only on opening public orders');
  nodes.marketOrderExamples.click();
  await flush();
  assert.equal(nodes.marketOrdersList.children.length, 3);
  assert.ok(nodes.marketOrdersList.children.every(x => x.classes.has('is-demo')));
  assert.ok(nodes.marketOrdersEditor.children[0].classes.has('rw-ah-example-detail'));
  nodes.marketOrderViews[1].click();
  await flush();
  assert.equal(nodes.marketOrdersList.children.length, 3);
  assert.equal(nodes.marketOrdersEditor.children[0].children[0].textContent, '订单示例 · 仅供预览');
  assert.equal(reads, 1, 'switching sample types must never query D1');
  assert.equal(writes, 0);
  nodes.marketOrderExamples.click();
  await flush();
  assert.equal(reads, 2, 'return to real swaps resumes public order query');
});

test('example button is hidden outside testing channel', () => {
  const nodes = {marketOrderExamples: new Node('button')};
  createMarketView({
    nodes, element, button, empty: () => {},
    notifyError: error => { throw error; },
    confirmDialog: async () => false,
    marketService: {}, host: {}, getAuth: () => ({user:{id:1}}),
    showExamples:false,
  });
  assert.equal(nodes.marketOrderExamples.hidden, true);
});
