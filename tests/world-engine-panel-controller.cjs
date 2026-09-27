const assert=require('node:assert/strict');

class FakeElement {
  constructor(tag='div'){
    this.tagName=String(tag).toUpperCase();this.dataset={};this.attributes={};this.children=[];this.parentNode=null;
    this.hidden=false;this.isConnected=false;this.listeners={};this.innerHTML='';this.textContent='';
    this.style={setProperty:(name,value,priority)=>{this._style=this._style||{};this._style[name]=[value,priority];}};
    this.classList={add:()=>{},remove:()=>{},contains:()=>false};
  }
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name]??null;}
  hasAttribute(name){return Object.hasOwn(this.attributes,name);}
  addEventListener(type,listener){(this.listeners[type]||(this.listeners[type]=[])).push(listener);}
  removeEventListener(type,listener){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==listener);}
  appendChild(child){child.parentNode=this;this.children.push(child);if(this.isConnected)child._connect();return child;}
  _connect(){this.isConnected=true;for(const child of this.children)child._connect?.();}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;this.isConnected=false;}
  attachShadow(options){this.shadowMode=options?.mode;this.shadowRoot=new FakeElement('#shadow-root');this.shadowRoot.parentNode=this;if(this.isConnected)this.shadowRoot._connect();return this.shadowRoot;}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  contains(node){if(node===this)return true;return this.children.some(child=>child.contains?.(node));}
  closest(selector){return selector==='button'?this:null;}
  matches(){return false;}
}
class FakeDocument {
  constructor(){this.body=new FakeElement('body');this.body._connect();this.listeners={};}
  createElement(tag){return new FakeElement(tag);}
  addEventListener(type,listener){(this.listeners[type]||(this.listeners[type]=[])).push(listener);}
  removeEventListener(type,listener){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==listener);}
}

const document=new FakeDocument();
const host={
  document,
  localStorage:{getItem:()=>null,setItem:()=>{}},
  getCurrentChatId:()=> 'panel-controller-test',
  getChatMessages:()=>[],
  Mvu:{getMvuData:()=>({stat_data:{}}),replaceMvuData:async()=>{}},
  Samsara:{terminal:{apiReady:()=>false,suspend:()=>null,restore:()=>{}}}
};
const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');
const engine=new Engine(host);

assert.equal(engine.services?.panelController?.constructor?.name,'WorldPanelController');
assert.doesNotThrow(()=>engine.createPanel(),'public createPanel seam must create the panel through the controller');
assert.ok(engine.mount,'panel mount must be created');
assert.equal(engine.mount.id,'sam-world-engine-host');
assert.equal(engine.mount.shadowMode,'open','world engine UI must stay inside an open Shadow DOM');
assert.equal(engine.mount.parentNode,document.body,'panel mount must attach to document.body');
assert.equal(engine.style.parentNode,engine.mount.shadowRoot,'base style must live inside the Shadow DOM');
assert.equal(engine.panel.parentNode,engine.mount.shadowRoot,'world engine panel must live inside the Shadow DOM');
for(const type of ['click','input','change'])assert.ok((engine.panel.listeners[type]||[]).length>=1,'panel controller must bind '+type+' routing');

let rendered=0;
engine.render=()=>{rendered++;};
const tabButton=new FakeElement('button');
tabButton.dataset.tab='传闻';
(engine.panel.listeners.click||[])[0]({target:tabButton});
assert.equal(engine.tab,'传闻','tab click must keep using the public engine state');
assert.equal(engine.filter,'全部');
assert.equal(engine.query,'');
assert.equal(engine.calendarMode,'today');
assert.equal(engine.eventLimit,12);
assert.equal(rendered,1,'tab navigation must trigger one render');

engine.dispose();
assert.equal(engine.mount?.isConnected??false,false,'dispose must detach the panel mount');

console.log('world-engine panel controller regression tests passed');
