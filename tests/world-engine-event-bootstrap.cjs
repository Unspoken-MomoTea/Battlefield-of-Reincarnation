const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script/世界推进系统.js'), 'utf8');
const handlers = new Map(), timers = new Map();
let nextTimer = 0, runs = 0, handled = '', fingerprint='["sandbox",1,0,"prose"]';
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
    tavern_events:{
        CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete',
        GENERATION_ENDED:'generation',MESSAGE_RECEIVED:'received'
    },
    eventOn:(name,fn)=>{handlers.set(name,fn);return ()=>handlers.delete(name);},
    getChatMessages:()=>[],getCurrentChatId:()=> 'sandbox'
};
vm.runInNewContext(source,sandbox);
const engine = host.Samsara.worldEngine;
assert.equal(typeof handlers.get('mvu'),'function','lexical MVU event interface must survive every constructor');
assert.equal(typeof handlers.get('generation'),'function','generation completion must be a first-class auto-progress trigger');
assert.equal(typeof handlers.get('received'),'function','message receipt must be a fallback auto-progress trigger');
assert.equal(handlers.size,6);
assert.equal(timers.size,0,'initialization must finish instead of retrying forever');
assert.equal(engine.fn('getCurrentChatId')(),'sandbox');
engine.config.enabled = true;
engine.render = () => {};
engine.snapshot = () => ({
    fingerprint,
    stat:{
        世界:{名称:'测试世界',后台:{已处理楼层:handled,事件:{},人物:{},势力地区:{},历史:{},传播:{},最近变化:[],运行记录:[]}},
        系统状态:{是否在主神空间:false,是否战斗中:false}
    },
    message:{role:'assistant'},text:'正文'
});
engine.run = async () => {
    runs++;
    const current=engine.snapshot();
    handled=current.fingerprint;
    engine.markAutoProgressRun(current);
    return true;
};
function flush() {
    const callbacks=[...timers.values()];
    timers.clear();
    callbacks.forEach(fn=>fn());
}

// 真实正文事件本身必须足以启动世界推进；不能再依赖 VARIABLE_UPDATE_ENDED 才“点火”。
handlers.get('generation')(1);
handlers.get('received')(1,'normal');
assert.equal(timers.size,1,'generation/message duplicate events must debounce to one run');
flush();
assert.equal(runs,1,'assistant prose completion must start automatic progression without an MVU event');

// 随后到达的变量完成事件只做同步/补跑检查，不得把同一楼再跑一遍。
handlers.get('mvu')();
flush();
assert.equal(runs,1,'MVU completion after a prose-triggered run must not duplicate the same floor');

fingerprint='["sandbox",2,0,"next-prose"]';
handlers.get('mvu')();
handlers.get('chat')();
flush();
assert.equal(runs,1,'context changes must cancel scheduled progression');
engine.dispose();
assert.equal(handlers.size,0);
console.log('PASS prose-first triggers, MVU fallback/dedupe, context cancellation and cleanup');
