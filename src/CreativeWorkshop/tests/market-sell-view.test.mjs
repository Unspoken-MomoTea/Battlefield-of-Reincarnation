import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketView } from '../views/market.js';

class Node {
  constructor(tag = 'div', classes = '', text = '') {
    this.tag = tag;
    this.classes = new Set(String(classes).split(/\s+/u).filter(Boolean));
    this.classList = {
      add: value => this.classes.add(value),
      toggle: (value, enabled) => {
        if (enabled === undefined) {
          if (this.classes.has(value)) this.classes.delete(value);
          else this.classes.add(value);
        } else if (enabled) this.classes.add(value);
        else this.classes.delete(value);
      },
    };
    this.textContent = String(text);
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.value = '';
    this.hidden = false;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  querySelectorAll(selector) {
    const className = String(selector).replace(/^\./u, '');
    const hits = [];
    const visit = root => {
      for (const child of root.children) {
        if (!(child instanceof Node)) continue;
        if (child.classes.has(className)) hits.push(child);
        visit(child);
      }
    };
    visit(this);
    return hits;
  }
  querySelector(selector) {
    const tag = String(selector).toLowerCase();
    const visit = node => {
      for (const child of node.children) {
        if (!(child instanceof Node)) continue;
        if (child.tag === tag) return child;
        const match = visit(child);
        if (match) return match;
      }
      return null;
    };
    return visit(this);
  }
  click() { return this.listeners.get('click')?.(); }
}

const element = (tag, classes, text) => new Node(tag, classes, text);
const button = (text, classes, onClick) => {
  const node = new Node('button', classes, text);
  if (onClick) node.addEventListener('click', onClick);
  return node;
};

test('selling asset changes display immediately despite stalled market and wallet requests', async () => {
  let catalogRequests = 0;
  let mineRequests = 0;
  let quoteRequests = 0;
  const nodes = {
    marketModes: [],
    marketPanels: [],
    marketCategories: [],
    marketSellList: new Node(),
    marketSellCount: new Node(),
    marketSellEditor: new Node(),
    marketSummary: new Node(),
  };
  const assets = ['长剑', '药剂'].map((name, index) => ({
    kind: index ? 'item' : 'equipment',
    key: name,
    name,
    quantity: 1,
    quality: 'E',
    data: { 名称: name, 品质: 'E', 描述: '测试资产', 数量: 1 },
  }));
  const never = () => new Promise(() => {});
  const marketService = {
    inventory: async () => ({ assets, inHub: true, canTrade: true, coin: 500 }),
    catalogSnapshot: () => { catalogRequests += 1; return never(); },
    catalog: () => { throw new Error('asset selection must not query market catalog'); },
    catalogDetail: () => never(),
    mine: () => { mineRequests += 1; return never(); },
    quoteAuction: () => { quoteRequests += 1; return never(); },
    quoteBuyback: () => { quoteRequests += 1; return never(); },
  };
  const view = createMarketView({
    nodes, element, button,
    empty: (target, message) => target.replaceChildren(new Node('span', '', message)),
    notifyError: error => { throw error; },
    confirmDialog: async () => true,
    host: {}, marketService,
    getAuth: () => ({ user: { id: 1 } }),
  });
  await view.openSell();
  const entries = nodes.marketSellList.querySelectorAll('.rw-ah-inventory-row');
  assert.equal(entries.length, 2);
  entries[0].click();
  const first = nodes.marketSellEditor.children[0];
  assert.equal(first.querySelector('h3'), null, 'sell details should not repeat the selected item name');
  assert.ok(first.querySelectorAll('.rw-ah-sell-form').length);
  assert.equal(first.querySelectorAll('.rw-market-kind').length, 0, 'category tag repeats the inventory row');
  assert.equal(first.querySelectorAll('.rw-market-quality').length, 0, 'quality tag repeats the asset data');
  const warning = first.querySelectorAll('.rw-market-notice').find(node => node.textContent === '');
  assert.equal(warning?.hidden, true, 'the blank yellow warning must be hidden');
  const qualityRow = first.querySelectorAll('.rw-ah-data-row')
    .find(row => row.children[0].textContent === '品质');
  assert.ok(qualityRow, 'asset data should retain a quality row');
  assert.equal(qualityRow.children[1].textContent, 'E');
  assert.equal(qualityRow.children[1].dataset.quality, 'E', 'quality should use the rank color mapping');
  entries[1].click();
  const second = nodes.marketSellEditor.children[0];
  assert.equal(second.querySelector('h3'), null, 'next selection must not restore duplicate headings');
  assert.ok(second.querySelectorAll('.rw-ah-data-row')
    .some(row => row.children[0].textContent === '品质'));
  assert.equal(nodes.marketSellList.querySelectorAll('.rw-ah-inventory-row')[0], entries[0],
    'selecting must not recreate all inventory rows');
  assert.equal(catalogRequests, 1, 'single background catalog warmup');
  assert.equal(mineRequests, 1, 'shared in-flight mine request');
  assert.equal(quoteRequests, 0, 'preview quotes are not fetched in the click handler');
});

test('sell quota shows only the current save listing count without an empty warning strip', async () => {
  const nodes = {
    marketModes: [], marketPanels: [], marketCategories: [],
    marketSellList: new Node(), marketSellCount: new Node(),
    marketSellEditor: new Node(), marketSummary: new Node(),
  };
  const asset = {
    kind: 'item', key: '药剂', name: '药剂', quantity: 1, quality: 'E',
    data: { 名称: '药剂', 数量: 1, 品质: 'E' },
  };
  const marketService = {
    inventory: async () => ({ assets: [asset], inHub: true, canTrade: true, coin: 1000 }),
    mine: async () => ({
      active_listing_count: 0, active_listing_limit: 10,
      listings: [], wallet: { balance: 0 },
    }),
    catalogSnapshot: async () => ({ items: [] }),
    quoteAuction: () => new Promise(() => {}),
    quoteBuyback: () => new Promise(() => {}),
  };
  const view = createMarketView({
    nodes, element, button,
    empty: (node, message) => node.replaceChildren(new Node('span', '', message)),
    notifyError: error => { throw error; },
    confirmDialog: async () => true, host: {}, marketService,
    getAuth: () => ({ user: { id: 1 } }),
  });
  await view.openSell();
  nodes.marketSellList.querySelectorAll('.rw-ah-inventory-row')[0].click();
  await Promise.resolve();
  await Promise.resolve();
  const editor = nodes.marketSellEditor.children[0];
  const slots = editor.querySelectorAll('.rw-ah-listing-slots')[0];
  assert.equal(slots.textContent, '在售挂单 0 / 10');
  assert.equal(editor.querySelectorAll('.rw-market-notice')
    .find(node => node.textContent === '')?.hidden, true);
});
