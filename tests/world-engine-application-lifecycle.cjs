const assert=require('node:assert/strict');

const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

const handlers={};
const removedListeners=[];
let unsubscribeCount=0;
const document={
  addEventListener(type,listener){handlers['document:'+type]=listener;},
  removeEventListener(type,listener){removedListeners.push([type,listener]);}
};
const host={
  document,
  localStorage:{getItem:()=>null,setItem:()=>{}},
  eventOn(event,callback){handlers[event]=callback;return ()=>{unsubscribeCount++;};},
  Mvu:{events:{VARIABLE_UPDATE_ENDED:'variable-update-ended'}},
  tavern_events:{CHAT_CHANGED:'chat-changed',MESSAGE_SWIPED:'message-swiped',MESSAGE_DELETED:'message-deleted'},
  Samsara:{terminal:{
    apiReady:()=>false,
    suspend:()=>{host.suspended=(host.suspended||0)+1;return 'terminal-ticket';},
    restore:value=>{host.restored=value;}
  }}
};

const engine=new Engine(host);
assert.equal(engine.services?.applicationLifecycle?.constructor?.name,'WorldEngineLifecycleController','service container must expose the application lifecycle controller');

let renders=0,schedules=0,cancels=0,resets=0;
engine.render=()=>{renders++;};
engine.schedule=()=>{schedules++;};
engine.snapshot=()=>({stat:{世界:{},系统状态:{}},fingerprint:'["chat",1,0,"x"]'});
engine.blocked=()=> '';
engine.cancel=()=>{cancels++;};
engine.resetInspection=()=>{resets++;};

engine.init();
assert.equal(typeof handlers['variable-update-ended'],'function','init must bind MVU variable updates');
for(const event of ['chat-changed','message-swiped','message-deleted'])assert.equal(typeof handlers[event],'function','init must bind '+event);
assert.equal(typeof handlers['document:keydown'],'function','init must bind Escape handling');

handlers['variable-update-ended']({stat_data:{世界:{},系统状态:{}}},{});
assert.equal(renders,1,'variable update must refresh the panel once');
assert.equal(schedules,1,'variable update must preserve delayed scheduling');

handlers['chat-changed']();
assert.equal(cancels,1,'context switch must cancel in-flight work');
assert.equal(resets,1,'context switch must clear request inspection state');
assert.equal(engine.status,'已切换上下文');
assert.equal(renders,2,'context switch must refresh the panel');

let panelRemoved=0,styleRemoved=0,mountRemoved=0;
engine.createPanel=()=>{
  if(!engine.panel)engine.panel={hidden:true,remove(){panelRemoved++;}};
  return engine.panel;
};
engine.style={remove(){styleRemoved++;}};
engine.mount={remove(){mountRemoved++;}};

engine.open();
assert.equal(engine.isOpen(),true);
assert.equal(host.suspended,1,'opening the world engine must suspend the terminal UI');
assert.equal(engine.returnState,'terminal-ticket');
engine.close();
assert.equal(engine.isOpen(),false);
assert.equal(host.restored,'terminal-ticket','closing the world engine must restore the terminal UI');
assert.equal(engine.returnState,null);

engine.toggle();
assert.equal(engine.isOpen(),true,'toggle must open a closed panel');
let stopped=false;
handlers['document:keydown']({key:'Escape',stopImmediatePropagation(){stopped=true;}});
assert.equal(stopped,true,'Escape must stop propagation while the world panel is open');
assert.equal(engine.isOpen(),false,'Escape must close the world panel');

engine.open();
engine.dispose();
assert.equal(engine.disposed,true);
assert.ok(cancels>=2,'dispose must cancel in-flight work');
assert.equal(unsubscribeCount,4,'dispose must run all MVU/tavern unsubscriptions');
assert.ok(removedListeners.some(([type])=>type==='keydown'),'dispose must remove the keydown handler');
assert.equal(panelRemoved,1,'dispose must remove the panel');
assert.equal(styleRemoved,1,'dispose must remove the style node');
assert.equal(mountRemoved,1,'dispose must remove the Shadow DOM mount');

console.log('world-engine application lifecycle regression tests passed');
