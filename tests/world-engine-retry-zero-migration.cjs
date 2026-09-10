const assert=require('node:assert/strict');
const path=require('node:path');
const file=path.join(__dirname,'../script/世界推进系统.js');
const {SamsaraWorldEngine:Engine}=require(file);
const host={localStorage:{getItem:()=>JSON.stringify({retryAttempts:0}),setItem:()=>{}},Samsara:{}};
const engine=new Engine(host);
assert.equal(engine.config.retryAttempts,1,'旧版额外重试=0 应迁移为新版最大总尝试=1');
console.log('world-engine retry zero migration acceptance passed');
