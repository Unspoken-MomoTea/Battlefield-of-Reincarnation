const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

// interval=2 means progression on reply rounds 1,3,5...; repeated events on one reply never count as extra rounds.
function makeEngine(saved={}){
  let stored=null;
  const host={
    localStorage:{
      getItem:()=>JSON.stringify(saved),
      setItem:(_,value)=>{stored=JSON.parse(value);}
    }
  };
  const engine=new Engine(host,host);
  return {engine,stored:()=>stored};
}

function fingerprint(chat,id,digest='digest-'+id,swipe=0){return JSON.stringify([chat,id,swipe,digest]);}
function snapshot(chat,id,{handled='',combat=false,world='测试世界',populated=!!handled,digest='digest-'+id,swipe=0}={}){
  const backend={已处理楼层:handled,事件:populated?{'已建立世界状态':{状态:'进行中'}}:{},人物:{},势力地区:{},历史:{},传播:{},最近变化:[],运行记录:[]};
  return {
    fingerprint:fingerprint(chat,id,digest,swipe),
    stat:{系统状态:{是否战斗中:combat},世界:{名称:world,后台:backend}},
    text:combat?'战斗正文':'普通正文',
    message:{role:'assistant'}
  };
}

const fresh=makeEngine();
assert.equal(fresh.engine.config.autoProgress,true,'auto progress should default to enabled to preserve existing behavior');
assert.equal(fresh.engine.config.autoProgressInterval,2,'auto progress interval should default to 2 reply rounds');
assert.equal(fresh.stored()?.autoProgress,true,'default auto progress should be persisted');
assert.equal(fresh.stored()?.autoProgressInterval,2,'default interval should be persisted together with auto progress');

const migrated=makeEngine({autoProgress:true});
assert.equal(migrated.engine.config.autoProgressInterval,2,'existing config without interval should migrate to 2');
assert.equal(migrated.stored()?.autoProgressInterval,2,'interval migration should persist');
assert.equal(makeEngine({autoProgressInterval:99}).engine.config.autoProgressInterval,20,'interval should be clamped to UI maximum');
assert.equal(makeEngine({autoProgressInterval:0}).engine.config.autoProgressInterval,1,'interval should be clamped to UI minimum');

const disabled=makeEngine({autoProgress:false,autoProgressInterval:2});
assert.equal(disabled.engine.config.autoProgress,false,'saved auto progress=false must be respected');

const battleSnapshot=snapshot('chat',1,{combat:true});
assert.equal(disabled.engine.blocked(battleSnapshot),'战斗中，世界推进暂停','combat must block all world progression, including manual run');
assert.equal(disabled.engine.blocked(snapshot('chat',1)),'','normal world state should not be blocked by combat policy');

const cycle=makeEngine({autoProgress:true,autoProgressInterval:2}).engine;
const first=snapshot('chat',1);
assert.equal(cycle.autoProgressShouldSchedule(first),true,'first eligible reply should progress immediately');
cycle.markAutoProgressRun(first);
first.stat.世界.后台.已处理楼层=first.fingerprint;
assert.equal(cycle.autoProgressShouldSchedule(first),false,'repeated events on the same reply must not count twice');

const regeneratedFirst=snapshot('chat',1,{handled:first.fingerprint,populated:true,digest:'regenerated-first'});
assert.equal(cycle.autoProgressShouldSchedule(regeneratedFirst),true,'regenerating a due floor must rerun that floor even when interval=2');
assert.equal(cycle.autoProgressRoundsSinceRun,0,'same-floor regeneration must not consume a new cadence round');
cycle.markAutoProgressRun(regeneratedFirst);

const second=snapshot('chat',2,{handled:regeneratedFirst.fingerprint});
assert.equal(cycle.autoProgressShouldSchedule(second),false,'interval=2 should skip the second reply');
assert.equal(cycle.autoProgressShouldSchedule(second),false,'same skipped reply must still count only once');
const regeneratedSecond=snapshot('chat',2,{handled:regeneratedFirst.fingerprint,digest:'regenerated-second'});
assert.equal(cycle.autoProgressShouldSchedule(regeneratedSecond),false,'regenerating an interval-skipped floor must not turn it into a due floor');
assert.equal(cycle.autoProgressRoundsSinceRun,1,'same-floor regeneration of a skipped floor must not consume another cadence round');

const third=snapshot('chat',3,{handled:regeneratedFirst.fingerprint});
assert.equal(cycle.autoProgressShouldSchedule(third),true,'interval=2 should progress on the third reply');
cycle.markAutoProgressRun(third);
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',4,{handled:third.fingerprint})),false,'after a successful run the next reply starts a new interval');
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',5,{handled:third.fingerprint})),true,'default cadence should continue as 1,3,5...');

const restored=makeEngine({autoProgress:true,autoProgressInterval:2}).engine;
const handled=fingerprint('chat',7);
assert.equal(restored.autoProgressShouldSchedule(snapshot('chat',7,{handled})),false,'reload on an already processed reply with real backend data must not repeat progression');
assert.equal(restored.autoProgressShouldSchedule(snapshot('chat',8,{handled})),false,'first new reply after a persisted progression is one interval round');
assert.equal(restored.autoProgressShouldSchedule(snapshot('chat',9,{handled})),true,'second new reply after persisted progression becomes due');
assert.equal(restored.autoProgressShouldSchedule(snapshot('other-chat',1,{handled})),true,'a different chat must start its own cycle instead of inheriting the previous chat counter');

const opening=makeEngine({autoProgress:true,autoProgressInterval:2}).engine;
const staleOpeningHandled=fingerprint('opening',0);
const openingFirst=snapshot('opening',1,{handled:staleOpeningHandled,populated:false});
assert.equal(opening.autoProgressShouldSchedule(openingFirst),true,'empty world backend must make the opening assistant reply progress immediately even when a stale handled marker exists');
opening.markAutoProgressRun(openingFirst);
assert.equal(opening.autoProgressShouldSchedule(snapshot('opening',2,{handled:openingFirst.fingerprint,populated:false})),false,'after a real run, the same in-memory cycle must resume interval counting even if that run produced no persistent event');

const every=makeEngine({autoProgress:true,autoProgressInterval:1}).engine;
const everyFirst=snapshot('each',1);assert.equal(every.autoProgressShouldSchedule(everyFirst),true);every.markAutoProgressRun(everyFirst);
assert.equal(every.autoProgressShouldSchedule(snapshot('each',2,{handled:everyFirst.fingerprint})),true,'interval=1 should progress every eligible reply');

const combatCounter=makeEngine({autoProgress:true,autoProgressInterval:2}).engine;
combatCounter.isEnabled=()=>true;
combatCounter.snapshot=()=>snapshot('combat-chat',1,{combat:true});
combatCounter.schedule();
assert.equal(combatCounter.autoProgressLastSeenFingerprint,'','combat replies must not consume the auto-progress interval');
assert.ok(combatCounter.timer,'automatic scheduling must defer reading the final persisted combat state');
combatCounter.cancel();

assert.match(source,/data-auto-progress-toggle-top/,'top header must expose the auto progress toggle');
assert.match(source,/run\.insertAdjacentElement\('beforebegin',button\)/,'auto progress toggle should sit immediately before the manual progress button');
assert.doesNotMatch(source,/mountAutoProgressSetting\(\)/,'auto progress toggle must no longer be mounted as a settings-page card');
assert.match(source,/data-auto-progress-interval/,'request inspection must expose the auto progress interval');
assert.match(source,/2 = 第1、3、5…次正文后推进/,'interval=2 semantics must be explicit in the UI');
assert.match(source,/自动推进已关闭，此设置不参与调度/,'interval UI must be screened off when auto progress is disabled');
assert.match(source,/GENERATION_ENDED/,'assistant generation completion must be wired into automatic progression');
assert.match(source,/MESSAGE_RECEIVED/,'message receipt must be wired as an automatic progression fallback');
assert.match(source,/autoProgressSameFloor/,'same-floor regeneration must have explicit cadence semantics');
console.log('PASS prose triggers, interval cadence, same-floor regeneration, opening bootstrap, dedupe and combat pause');
