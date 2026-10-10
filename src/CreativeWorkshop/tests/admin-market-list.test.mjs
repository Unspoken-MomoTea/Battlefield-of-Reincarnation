import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminMarketView } from '../views/admin/market.js';
import { workshopTemplate } from '../ui/template.js';
import { WORKSHOP_CSS } from '../ui/styles.js';

class Node {
  constructor(tag='div',name='',content=''){
    this.tagName=tag; this.className=name; this.textContent=String(content);
    this.children=[];this.handlers={};
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  addEventListener(event,fn){this.handlers[event]=fn;}
}
const element=(...args)=>new Node(...args);
const button=(label,cls,fn)=>{
  const node=new Node('button',cls,label);
  node.addEventListener('click',fn);
  return node;
};
function content(node){
  return [node?.textContent||'',...(node?.children||[]).map(content)].join(' ');
}

test('moderator Bazaar lists one full-width row per auction, not card grid',async()=>{
  const nodes={
    adminMarketView:{value:'listings'},
    adminMarketSearch:{value:''},
    adminMarketStatus:{value:'active'},
    adminMarketRisk:{checked:false},
    adminMarketList:new Node(),
  };
  let query;
  const items=[
    {id:'system:credential:F',asset:{kind:'item',name:'F级权限凭证'},status:'active',unit_price:99,
      remaining_quantity:10,created_at:1,expires_at:0,
      seller:{id:2,display_name:'系统柜台'},risk:{}},
    {id:'user:listing',asset:{kind:'bloodline',name:'精灵血统'},status:'active',unit_price:200,
      remaining_quantity:1,created_at:1,expires_at:Date.now()+1e5,
      seller:{id:4,display_name:'玩家甲'},risk:{suspicious:true,reasons:['异常价格']}},
  ];
  const view=createAdminMarketView({
    nodes,element,button,
    empty:(root,text)=>root.replaceChildren(new Node('p','',text)),
    workshopApi:{listAdminMarket:async args=>{query=args;return{items}}},
    host:{},confirmDialog:async()=>false,
  });
  await view.refresh();
  assert.equal(query.status,'active');
  const rows=nodes.adminMarketList.children;
  assert.equal(rows.length,3,'single header followed by two rows');
  assert.match(rows[0].className,/rw-admin-market-header/u);
  assert.equal(rows[0].children.length,6);
  for(const row of rows.slice(1)){
    assert.match(row.className,/rw-admin-market-row/u);
    assert.doesNotMatch(row.className,/rw-card|rw-market-admin-card/u);
    assert.equal(row.children.length,6,'compact six-column row');
  }
  assert.match(content(rows[1]),/F级权限凭证/u);
  assert.match(content(rows[1]),/道具/u);
  assert.match(content(rows[1]),/剩余 10/u);
  assert.match(content(rows[2]),/血统/u);
  assert.match(content(rows[2]),/异常价格/u);
  assert.match(content(rows[2]),/强制下架/u);
});

test('moderator market defaults to active status and responsive list CSS, not tiles',()=>{
  const html=workshopTemplate('2.0.57');
  assert.match(html,/value="active" selected>进行中<\/option>/u);
  assert.match(html,/value="all">全部状态<\/option>/u);
  assert.match(html,/class="rw-admin-market-list" data-role="admin-market-list"/u);
  assert.match(WORKSHOP_CSS,/\.rw-admin-market-row\{display:grid/u);
  assert.match(WORKSHOP_CSS,/@media\(max-width:760px\)[\s\S]*?\.rw-admin-market-header\{display:none\}/u);
});
