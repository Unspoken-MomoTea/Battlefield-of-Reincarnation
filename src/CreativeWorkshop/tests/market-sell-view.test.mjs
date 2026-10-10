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
  get options() { return this.children.filter(child => child?.tag === 'option'); }
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

test('category switch requests the right kind and ignores previous-category subtype selections', async () => {
  const nodes = {
    marketModes: [], marketPanels: [],
    marketCategories: ['','equipment','item','skill'].map(kind => {
      const node = new Node('button');
      node.dataset.marketKind = kind;
      return node;
    }),
    marketSubtype: new Node('select'),
    marketList: new Node(), marketCount: new Node(),
    marketSummary: new Node(), marketInspector: new Node(),
  };
  const requests = [];
  const items = [
    {key:'catalog:skill:flash',kind:'skill',name:'闪电术',quality:'F',subtype:'法术',
      lowest_price:10,total_stock:1,listing_count:1,seller_count:1,asset:{kind:'skill',name:'闪电术',data:{品质:'F'}}},
    {key:'catalog:item:herb',kind:'item',name:'草药',quality:'F',subtype:'材料',
      lowest_price:20,total_stock:1,listing_count:1,seller_count:1,asset:{kind:'item',name:'草药',data:{品质:'F'}}},
    {key:'catalog:equipment:armor',kind:'equipment',name:'铠甲',quality:'F',subtype:'护甲',
      lowest_price:30,total_stock:1,listing_count:1,seller_count:1,asset:{kind:'equipment',name:'铠甲',data:{品质:'F'}}},
  ];
  const marketService = {
    async catalog(filters) {
      requests.push({...filters});
      const matched=items.filter(item=>(!filters.kind||item.kind===filters.kind)
        &&(!filters.subtype||item.subtype===filters.subtype));
      return {items:matched,counts:{equipment:1,item:1,skill:1},
        facets:{qualities:[{value:'F',count:3}],
          subtypes:[...new Set(matched.map(item=>item.subtype))].map(value=>({value,count:1}))},
        next_offset:null};
    },
    async inventory(){return {inHub:true,coin:0,canTrade:true};},
    async catalogDetail(){return {catalog:null};},
  };
  const view=createMarketView({nodes,element,button,
    empty:(target,message)=>target.replaceChildren(new Node('span','',message)),
    notifyError:error=>{throw error;},confirmDialog:async()=>true,
    host:{},marketService,getAuth:()=>({user:{id:1}})});
  await view.refresh();
  assert.equal(nodes.marketList.querySelectorAll('.rw-ah-result-row').length,3);
  // A subtype that was valid under the old category must not hide the new one.
  nodes.marketSubtype.value='法术';
  nodes.marketCategories[2].click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.at(-1).kind,'item');
  assert.equal(requests.at(-1).subtype,'');
  assert.equal(nodes.marketList.querySelectorAll('.rw-ah-result-row').length,1);
  nodes.marketCategories[1].click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.at(-1).kind,'equipment');
  assert.equal(nodes.marketList.querySelectorAll('.rw-ah-result-row').length,1);
  nodes.marketCategories[0].click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.at(-1).kind,'');
  assert.equal(nodes.marketList.querySelectorAll('.rw-ah-result-row').length,3);
});

test('header refresh fetches active order board instead of unrelated product list', async () => {
  const nodes = {
    marketModes: [],marketPanels:[],marketCategories:[],
    marketOrdersList:new Node(),marketOrdersEditor:new Node(),
    marketOrderViews:[],marketOrderCreate:new Node(),marketOrderRefresh:new Node(),
    marketSummary:new Node(),
  };
  let orderCalls=0,catalogCalls=0;
  const service={
    async listDeals(){orderCalls++;return {items:[],next_offset:null};},
    async catalog(){catalogCalls++;return {items:[]};},
    async inventory(){return {inHub:true,canTrade:true,coin:0};},
  };
  const view=createMarketView({nodes,element,button,
    empty:(target,message)=>target.replaceChildren(new Node('span','',message)),
    notifyError:error=>{throw error;},confirmDialog:async()=>false,
    host:{},marketService:service,getAuth:()=>({user:{id:1}})});
  await view.openOrders();
  assert.equal(orderCalls,1);
  await view.refresh();
  assert.equal(orderCalls,2);
  assert.equal(catalogCalls,0);
});

test('header refresh bypasses the personal auction cache instead of re-reading products', async () => {
  const nodes={marketModes:[],marketPanels:[],marketCategories:[],
    marketMineViews:[],marketMineContent:new Node(),marketSummary:new Node()};
  let mineCalls=0,catalogCalls=0;
  const service={
    async mine(){mineCalls++;return {wallet:{balance:0},listings:[]};},
    async catalog(){catalogCalls++;return {items:[]};},
    async inventory(){return {inHub:true,canTrade:true,coin:0};},
  };
  const view=createMarketView({nodes,element,button,
    empty:(target,message)=>target.replaceChildren(new Node('span','',message)),
    notifyError:error=>{throw error;},confirmDialog:async()=>false,
    host:{},marketService:service,getAuth:()=>({user:{id:1}})});
  await view.openMine();
  assert.equal(mineCalls,1);
  await view.refresh();
  assert.equal(mineCalls,2);
  assert.equal(catalogCalls,0);
});

test('header refresh invalidates the visible commodity cache and reloads a changed listing', async () => {
  const nodes={marketModes:[],marketPanels:[],marketCategories:[],
    marketList:new Node(),marketCount:new Node(),marketSummary:new Node(),marketInspector:new Node()};
  let calls=0;
  const service={
    async catalog(){
      calls++;
      return {items:[{key:'catalog:item:1',kind:'item',name:calls===1?'旧商品':'新商品',
        quality:'F',lowest_price:1,total_stock:1,listing_count:1,seller_count:1,
        asset:{kind:'item',name:calls===1?'旧商品':'新商品',data:{品质:'F'}}}],
        counts:{item:1},facets:{qualities:[],subtypes:[]},next_offset:null};
    },
    async inventory(){return {inHub:true,canTrade:true,coin:0};},
    async catalogDetail(){return {};},
  };
  const view=createMarketView({nodes,element,button,
    empty:(target,message)=>target.replaceChildren(new Node('span','',message)),
    notifyError:error=>{throw error;},confirmDialog:async()=>true,
    host:{},marketService:service,getAuth:()=>({user:{id:1}})});
  await view.refresh();
  assert.equal(calls,1);
  await view.refresh();
  assert.equal(calls,2);
  const row=nodes.marketList.querySelectorAll('.rw-ah-result-row')[0];
  assert.equal(row.children[0].children[0].children[0].textContent,'新商品');
});
