const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script/世界推进系统.js'), 'utf8');
const handlers = new Map(), timers = new Map();
let nextTimer = 0, runs = 0, handled = '', fingerprint='["sandbox",1,0,"prose"]';
const add=(name,fn,first=false)=>{
    const list=handlers.get(name)||[];
    if(first)list.unshift(fn);else list.push(fn);
    handlers.set(name,list);
    return()=>{const current=handlers.get(name)||[],next=current.filter(item=>item!==fn);if(next.length)handlers.set(name,next);else handlers.delete(name);};
};
const emit=async(name,...args)=>{for(const fn of [...(handlers.get(name)||[])])await fn(...args);};
const host = {
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    eventOn:(name,fn)=>add(name,fn,false),
    eventMakeFirst:(name,fn)=>add(name,fn,true),
    Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'},getMvuData:()=>({})},
    Samsara:{terminal:{apiReady:()=>true}}
};
const sandbox = {
    window:{parent:host,addEventListener:()=>{}}, console, AbortController,
    setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},
    clearTimeout:id=>timers.delete(id),
    Mvu:host.Mvu,
    tavern_events:{
        CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete',
        GENERATION_ENDED:'generation',MESSAGE_RECEIVED:'received'
    },
    eventOn:(name,fn)=>add(name,fn,false),
    eventMakeFirst:(name,fn)=>add(name,fn,true),
    getChatMessages:()=>[],getCurrentChatId:()=> 'sandbox'
};
vm.runInNewContext(source,sandbox);
const engine = host.Samsara.worldEngine;
assert.equal(handlers.get('mvu')?.length,2,'MVU must have replay-first listener plus ordinary world scheduling listener');
assert.match(String(handlers.get('mvu')[0]),/handleWorldReplayVariableEvent/,'world replay must run before ordinary/auxiliary VARIABLE_UPDATE_ENDED listeners');
assert.equal(handlers.get('generation')?.length,1,'generation completion must be a first-class auto-progress trigger');
assert.equal(handlers.get('received')?.length,1,'message receipt must be a fallback auto-progress trigger');
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

(async()=>{
    // 真实正文事件本身必须足以启动世界推进；不能再依赖 VARIABLE_UPDATE_ENDED 才“点火”。
    await emit('generation',1);
    await emit('received',1,'normal');
    assert.equal(timers.size,1,'generation/message duplicate events must debounce to one run');
    flush();
    assert.equal(runs,1,'assistant prose completion must start automatic progression without an MVU event');

    // 随后到达的变量完成事件先过恢复监听，再过普通调度；同一楼仍不能重复推进。
    await emit('mvu',{},{});
    flush();
    assert.equal(runs,1,'MVU completion after a prose-triggered run must not duplicate the same floor');

    fingerprint='["sandbox",2,0,"next-prose"]';
    await emit('mvu',{},{});
    await emit('chat');
    flush();
    assert.equal(runs,1,'context changes must cancel scheduled progression');
    engine.dispose();
    assert.equal(handlers.size,0);
    console.log('PASS prose-first triggers, first-priority replay hook, MVU fallback/dedupe, context cancellation and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
