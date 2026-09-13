const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

// interval=2 means progression on reply rounds 1,3,5...; repeated MVU updates on one reply never count as extra rounds.
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

function fingerprint(chat,id){return JSON.stringify([chat,id,0,'digest-'+id]);}
function snapshot(chat,id,{handled='',combat=false,world='测试世界'}={}){
  return {
    fingerprint:fingerprint(chat,id),
    stat:{系统状态:{是否战斗中:combat},世界:{名称:world,后台:{已处理楼层:handled}}},
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
assert.equal(cycle.autoProgressShouldSchedule(first),false,'repeated MVU updates on the same reply must not count twice');
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',2,{handled:first.fingerprint})),false,'interval=2 should skip the second reply');
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',2,{handled:first.fingerprint})),false,'same skipped reply must still count only once');
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',3,{handled:first.fingerprint})),true,'interval=2 should progress on the third reply');
cycle.markAutoProgressRun(snapshot('chat',3,{handled:first.fingerprint}));
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',4,{handled:fingerprint('chat',3)})),false,'after a successful run the next reply starts a new interval');
assert.equal(cycle.autoProgressShouldSchedule(snapshot('chat',5,{handled:fingerprint('chat',3)})),true,'default cadence should continue as 1,3,5...');

const restored=makeEngine({autoProgress:true,autoProgressInterval:2}).engine;
const handled=fingerprint('chat',7);
assert.equal(restored.autoProgressShouldSchedule(snapshot('chat',7,{handled})),false,'reload on an already processed reply must not repeat progression');
assert.equal(restored.autoProgressShouldSchedule(snapshot('chat',8,{handled})),false,'first new reply after a persisted progression is one interval round');
assert.equal(restored.autoProgressShouldSchedule(snapshot('chat',9,{handled})),true,'second new reply after persisted progression becomes due');
assert.equal(restored.autoProgressShouldSchedule(snapshot('other-chat',1,{handled})),true,'a different chat must start its own cycle instead of inheriting the previous chat counter');

const every=makeEngine({autoProgress:true,autoProgressInterval:1}).engine;
const everyFirst=snapshot('each',1);assert.equal(every.autoProgressShouldSchedule(everyFirst),true);every.markAutoProgressRun(everyFirst);
assert.equal(every.autoProgressShouldSchedule(snapshot('each',2,{handled:everyFirst.fingerprint})),true,'interval=1 should progress every eligible reply');

const combatCounter=makeEngine({autoProgress:true,autoProgressInterval:2}).engine;
combatCounter.isEnabled=()=>true;
combatCounter.snapshot=()=>snapshot('combat-chat',1,{combat:true});
combatCounter.schedule();
assert.equal(combatCounter.autoProgressLastSeenFingerprint,'','combat replies must not consume the auto-progress interval');
assert.equal(combatCounter.timer,undefined,'combat should not arm an auto-progress timer');

assert.match(source,/data-auto-progress-toggle-top/,'top header must expose the auto progress toggle');
assert.match(source,/run\.insertAdjacentElement\('beforebegin',button\)/,'auto progress toggle should sit immediately before the manual progress button');
assert.doesNotMatch(source,/mountAutoProgressSetting\(\)/,'auto progress toggle must no longer be mounted as a settings-page card');
assert.match(source,/data-auto-progress-interval/,'request inspection must expose the auto progress interval');
assert.match(source,/2 = 第1、3、5…次正文后推进/,'interval=2 semantics must be explicit in the UI');
assert.match(source,/自动推进已关闭，此设置不参与调度/,'interval UI must be screened off when auto progress is disabled');
assert.match(source,/if\(this\.blocked\(snapshot\)\)return;\s*if\(!this\.autoProgressShouldSchedule\(snapshot\)\)return;/,'combat/block checks must happen before interval accounting');
console.log('PASS top auto-progress toggle, interval cadence, dedupe and combat pause');
