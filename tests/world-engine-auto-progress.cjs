const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
const {SamsaraWorldEngine:Engine}=require('../script/世界推进系统.js');

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

const fresh=makeEngine();
assert.equal(fresh.engine.config.autoProgress,true,'auto progress should default to enabled to preserve existing behavior');
assert.equal(fresh.stored()?.autoProgress,true,'default auto progress should be persisted');

const disabled=makeEngine({autoProgress:false});
assert.equal(disabled.engine.config.autoProgress,false,'saved auto progress=false must be respected');

const battleSnapshot={
  stat:{系统状态:{是否战斗中:true},世界:{名称:'测试世界'}},
  text:'战斗正文',
  message:{role:'assistant'}
};
assert.equal(disabled.engine.blocked(battleSnapshot),'战斗中，世界推进暂停','combat must block all world progression, including manual run');

const normalSnapshot={
  stat:{系统状态:{是否战斗中:false},世界:{名称:'测试世界'}},
  text:'普通正文',
  message:{role:'assistant'}
};
assert.equal(disabled.engine.blocked(normalSnapshot),'','normal world state should not be blocked by combat policy');

assert.match(source,/schedule\(\) \{\s*if\(this\.config\.autoProgress!==true\)/,'automatic scheduler must honor the independent auto progress switch');
assert.match(source,/data-auto-progress-toggle/,'settings UI must expose the auto progress toggle');
assert.match(source,/战斗中无论此开关状态如何都暂停推进/,'settings UI must explain combat pause behavior');
console.log('PASS auto progress toggle and combat pause');
