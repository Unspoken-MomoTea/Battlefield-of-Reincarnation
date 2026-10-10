import assert from 'node:assert/strict';
import test from 'node:test';
import {createMarketDealView} from '../views/market-deal-view.js';

class Node {
  constructor(tag='div',name='',text=''){
    this.tag=tag;this.textContent=String(text);this.children=[];
    this.hidden=false;this.dataset={};this.handlers={};this.value='';
    this.classes=new Set(name.split(/\s+/u).filter(Boolean));
    this.classList={
      add:key=>this.classes.add(key),
      toggle:(key,force)=>{if(force)this.classes.add(key);else this.classes.delete(key);},
    };
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(key,fn){this.handlers[key]=fn;}
  click(){return this.handlers.click?.();}
  remove(){}
}
const element=(tag,name,text)=>new Node(tag,name,text);
const button=(label,name,fn)=>{
  const node=new Node('button',name,label);
  if(fn)node.addEventListener('click',fn);
  return node;
};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('public negotiated orders and private bids are presented under All/My tabs',async()=>{
  const nodes={
    marketOrderViews:[new Node('button'),new Node('button')],
    marketOrderCreate:new Node('button'),
    marketSwapCreate:new Node('button'),
    marketOrderRefresh:new Node('button'),
    marketOrderExamples:new Node('button'),
    marketOrdersList:new Node(),marketOrdersEditor:new Node(),
  };
  nodes.marketOrderViews[0].dataset.marketOrderView='all';
  nodes.marketOrderViews[1].dataset.marketOrderView='mine';
  const deal={
    id:'deal:test',title:'招募一名治疗伙伴',wanted:'不要求准确角色姓名',
    status:'active',bid_count:2,
    owner:{id:7,display_name:'订单发布者'},
    offer:{coins:500,assets:[{kind:'item',name:'S级权限凭证',quantity:1,data:{品质:'S'}}]},
  };
  let readPublic=0,readMy=0,claims=0,submitted=0;
  const marketService={
    async listDeals(){readPublic++;return{items:[deal]};},
    async getDeal(){return{deal,owner:false,bids:[]};},
    async myDeals(){readMy++;return{
      deals:[],my_bids:[],
      pending_deal_transfers:[{
        id:'refund:bid',offer:{coins:75,assets:[]},
      }],
    };},
    async receiveDealTransfer(){claims++;},
    async inventory(){return{inHub:true,coin:700,assets:[]};},
    async createDeal(){submitted++;},
  };
  const view=createMarketDealView({
    nodes,element,button,empty:(target,text)=>target.replaceChildren(new Node('p','',text)),
    notifyError:error=>{throw error;},
    confirmDialog:async()=>false,
    marketService,getAuth:()=>({user:{id:9}}),
  });
  view.bind();
  await view.render();
  assert.equal(readPublic,1);
  assert.equal(nodes.marketSwapCreate.hidden,true);
  assert.equal(nodes.marketOrderExamples.hidden,true);
  assert.equal(nodes.marketOrdersList.children[0].children[0].children[0].textContent,'招募一名治疗伙伴');
  assert.equal(nodes.marketOrdersEditor.children[0].children[0].children[0].textContent,'招募一名治疗伙伴');
  nodes.marketOrderViews[1].click();
  await flush();
  assert.equal(readMy,1);
  assert.equal(nodes.marketOrdersList.children[0].children[0].children[1].children[0].textContent,'75 空间币');
  assert.equal(claims,0,'viewing pending claims must not alter MVU');
  assert.equal(submitted,0,'the order board must not auto-fill matching assets');
});

function allText(node) {
  return [String(node?.textContent || ''),
    ...(node?.children || []).map(allText)].join(' ');
}
function walk(node, predicate, matches=[]) {
  if (node && predicate(node)) matches.push(node);
  for (const child of node?.children || []) walk(child,predicate,matches);
  return matches;
}

test('negotiated order assets use structured quality-colored fields, without computed true attributes or raw JSON',async()=>{
  const nodes={
    marketOrderViews:[new Node('button'),new Node('button')],
    marketOrderCreate:new Node('button'),
    marketSwapCreate:new Node('button'),
    marketOrderRefresh:new Node('button'),
    marketOrderExamples:new Node('button'),
    marketOrdersList:new Node(),marketOrdersEditor:new Node(),
  };
  nodes.marketOrderViews[0].dataset.marketOrderView='all';
  nodes.marketOrderViews[1].dataset.marketOrderView='mine';
  const deal={
    id:'deal:structured',title:'寻找一位拥有很长名字的治疗型角色，在战斗和探索时可以提供持续恢复',
    wanted:'名字不限，但希望拥有群体治疗、快速解毒和解除诅咒的能力。',
    status:'active',bid_count:0,owner:{id:9,display_name:'测试玩家'},
    offer:{coins:1,assets:[{
      kind:'item',name:'古代符文结晶',quantity:1,
      data:{
        名称:'古代符文结晶',品质:'D',描述:'非常非常长的物品描述，需要自动换行，而不是从右侧溢出。',
        原始属性:{力量:'F',敏捷:'D'},
        额外效果:{名称:'护盾',真属性:{敏捷:900},最终属性:{敏捷:777},持续时间:'30秒'},
        真属性:{力量:999},最终属性:{力量:888},HP_MAX:100,
      },
    }]},
  };
  const service={
    async listDeals(){return {items:[deal]};},
    async getDeal(){return {deal,owner:true,bids:[]};},
    async myDeals(){return {deals:[],my_bids:[],pending_deal_transfers:[]};},
  };
  const view=createMarketDealView({
    nodes,element,button,empty:(node,message)=>node.replaceChildren(new Node('p','',message)),
    notifyError:error=>{throw error;},
    confirmDialog:async()=>false,
    marketService:service,getAuth:()=>({user:{id:9}}),
  });
  await view.render();
  const pane=nodes.marketOrdersEditor;
  const text=allText(pane);
  assert.match(text,/原始属性/u);
  assert.match(text,/敏捷/u);
  assert.match(text,/持续时间/u);
  assert.match(text,/30秒/u);
  assert.doesNotMatch(text,/真属性|最终属性|HP_MAX|900|777|999|888/u);
  assert.equal(walk(pane,node=>node.tag==='pre').length,0,'raw JSON must never be rendered');
  assert.ok(walk(pane,node=>node.classes.has('rw-ah-deal-attr-row')).length>=3);
  const ranked=walk(pane,node=>node.classes.has('rw-ah-quality-name'));
  assert.ok(ranked.some(node=>node.dataset.quality==='D'));
  assert.ok(ranked.some(node=>node.dataset.quality==='F'));
  assert.ok(walk(pane,node=>node.tag==='details').length>0,'assets can be expanded');
});

test('order picker has labeled asset selection, quantity, useful placeholders and never shows blank giant controls',async()=>{
  const nodes={
    marketOrderViews:[],marketOrderCreate:new Node('button'),
    marketSwapCreate:new Node('button'),marketOrderRefresh:new Node('button'),
    marketOrderExamples:new Node('button'),
    marketOrdersList:new Node(),marketOrdersEditor:new Node(),
  };
  const service={
    async inventory(){return {inHub:true,coin:900,assets:[{
      kind:'item',key:'药剂',name:'恢复药剂',quantity:3,
      quality:'E',data:{名称:'恢复药剂',品质:'E'},
    }]};},
  };
  const view=createMarketDealView({
    nodes,element,button,empty:()=>{},notifyError:error=>{throw error;},
    confirmDialog:async()=>false,
    marketService:service,getAuth:()=>({user:{id:9}}),
  });
  view.bind();
  nodes.marketOrderCreate.click();
  await flush();
  const pane=nodes.marketOrdersEditor;
  assert.ok(walk(pane,node=>node.tag==='textarea').length,'freeform description uses multiline control');
  const pickButtons=walk(pane,node=>node.textContent==='+ 添加一种资产');
  assert.equal(pickButtons.length,1);
  pickButtons[0].click();
  const selects=walk(pane,node=>node.tag==='select');
  assert.ok(selects.some(node=>node.classes.has('rw-ah-deal-control')));
  assert.match(allText(pane),/选择资产/u);
  assert.ok(walk(pane,node=>node.classes.has('rw-ah-deal-asset-row')).length, 'asset picker row displayed');
});
