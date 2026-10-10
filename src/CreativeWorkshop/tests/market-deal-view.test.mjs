import assert from 'node:assert/strict';
import test from 'node:test';
import {createMarketDealView} from '../views/market-deal-view.js';

class Node {
  constructor(tag='div',name='',text=''){
    this.tag=tag;this.textContent=String(text);this.children=[];
    this.hidden=false;this.dataset={};this.handlers={};this.value='';
    this.classes=new Set(name.split(/\\s+/u).filter(Boolean));
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
  assert.equal(nodes.marketOrdersList.children[0].children[0].textContent,'招募一名治疗伙伴');
  assert.equal(nodes.marketOrdersEditor.children[0].children[0].textContent,'招募一名治疗伙伴');
  nodes.marketOrderViews[1].click();
  await flush();
  assert.equal(readMy,1);
  assert.equal(nodes.marketOrdersList.children[0].children[0].children[1].children[0].textContent,'75 空间币');
  assert.equal(claims,0,'viewing pending claims must not alter MVU');
  assert.equal(submitted,0,'the order board must not auto-fill matching assets');
});
