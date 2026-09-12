const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script/世界推进系统.js'), 'utf8');
const handlers = new Map(), timers = new Map();
let nextTimer = 0, runs = 0;
const host = {
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    Samsara:{terminal:{apiReady:()=>true}}
};
const sandbox = {
    window:{parent:host,addEventListener:()=>{}}, console, AbortController,
    setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},
    clearTimeout:id=>timers.delete(id),
    Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'}},
    tavern_events:{CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete'},
    eventOn:(name,fn)=>{handlers.set(name,fn);return ()=>handlers.delete(name);},
    getChatMessages:()=>[],getCurrentChatId:()=> 'sandbox'
};
vm.runInNewContext(source,sandbox);
const engine = host.Samsara.worldEngine;
assert.equal(typeof handlers.get('mvu'),'function','lexical MVU event interface must survive every constructor');
assert.equal(handlers.size,4);
assert.equal(timers.size,0,'initialization must finish instead of retrying forever');
assert.equal(engine.fn('getCurrentChatId')(),'sandbox');
engine.config.enabled = true;
engine.render = () => {};
engine.snapshot = () => ({stat:{世界:{名称:'测试世界'},系统状态:{是否在主神空间:false}},message:{role:'assistant'},text:'正文'});
engine.run = async () => {runs++;};
function flush() {const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}
handlers.get('mvu')();
handlers.get('mvu')();
assert.equal(timers.size,1,'completion events must debounce');
flush();
assert.equal(runs,1,'variable completion must start automatic progression');
handlers.get('mvu')();
handlers.get('chat')();
flush();
assert.equal(runs,1,'context changes must cancel scheduled progression');
engine.dispose();
assert.equal(handlers.size,0);
console.log('PASS sandbox event bootstrap, automatic scheduling, debounce, context cancellation and cleanup');
