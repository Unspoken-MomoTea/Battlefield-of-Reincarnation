const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../script/世界推进系统.js');
const source = fs.readFileSync(file, 'utf8');
const {SamsaraWorldEngine: Engine, emptyState, WORLD_RESULT_SCHEMA} = require(file);
const clone = value => JSON.parse(JSON.stringify(value));

function baseState(){
  return {
    世界:{名称:'学园默示录',时间:'2010年-04月-13日-上午',地点:'藤美学园',后台:emptyState(),势力:{},探索:{},异端雷达:{名单:{}},因果轨道:{当前阶段:'',故事线:'',下一节点:'',偏移记录:{}}},
    系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

function setup(responses, validate){
  let current=baseState(),calls=0,writes=0,inputs=[];
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    Samsara:{validateWorldState:validate,terminal:{apiReady:()=>true,request:async (_system,input)=>{inputs.push(input);return responses[Math.min(calls++,responses.length-1)];}}},
    getCurrentChatId:()=> 'schema-retry-diagnostics',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'藤美学园内仍处于病毒爆发初期。'}]
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}};
  const engine=new Engine(host);engine.config.enabled=true;engine.config.requireMacroBackbone=false;engine.worldbook=async()=>[];
  return {engine,get:()=>current,calls:()=>calls,writes:()=>writes,inputs};
}

(async()=>{
  const eventSchema=WORLD_RESULT_SCHEMA.properties.事件.items.properties;
  assert.deepEqual(eventSchema.状态.enum,['待发生','进行中','已完成','已取消'],'事件状态应由 Canonical Schema 直接约束');
  assert.deepEqual(eventSchema.分类.enum,['当前事件','近期节点','宏观节点'],'事件分类应由 Canonical Schema 直接约束');
  const offsetSchema=WORLD_RESULT_SCHEMA.properties.因果.properties.偏移记录.items.properties.影响程度;
  assert.equal(offsetSchema.minimum,-100);assert.equal(offsetSchema.maximum,120);
  const streetSchema=WORLD_RESULT_SCHEMA.properties.传闻.properties.街头巷议.items.properties.可信度;
  assert.deepEqual(streetSchema.enum,['酒话','可疑','或许可信'],'WorldResult Schema 应直接暴露街头巷议合法三档');
  const intelSchema=WORLD_RESULT_SCHEMA.properties.传闻.properties.情报交易.items.properties.情报评级;
  assert.deepEqual(intelSchema.enum,['F','E','D','C','B','A','S','SS','SSS','日常','战略'],'情报评级应与 MVU Schema 对齐');

  const tolerantValidate=stat=>{
    const next=clone(stat);
    for(const item of Object.values(next.传闻?.街头巷议||{})){
      if(item.可信度==='低')item.可信度='酒话';
      else if(item.可信度==='高')item.可信度='或许可信';
    }
    return next;
  };
  const rumorReply=JSON.stringify({摘要:'更新校园传闻',传闻:{街头巷议:[{名称:'狂犬病爆发说',操作:'更新',来源:'藤美学园幸存学生',内容:'被咬伤的人会迅速变异。',可信度:'低'}]}});
  const a=setup([rumorReply],tolerantValidate);a.engine.config.retryAttempts=1;
  assert.equal(await a.engine.run(),true,'ZOD 可安全归正的可信度别名不应触发重试');
  assert.equal(a.calls(),1);assert.equal(a.writes(),1);
  assert.equal(a.get().传闻.街头巷议['狂犬病爆发说'].可信度,'酒话');

  const rewriteValidate=stat=>{
    const next=clone(stat),person=next.世界?.后台?.人物?.卫兵;
    if(person?.行动==='含糊行动')person.行动='规范行动';
    return next;
  };
  const bad=JSON.stringify({摘要:'第一次',人物:[{名称:'卫兵',操作:'更新',地点:'校门',目标:'警戒',行动:'含糊行动',状态:'活跃',更新时间:'2010年-04月-13日-上午'}]});
  const good=JSON.stringify({摘要:'第二次',人物:[{名称:'卫兵',操作:'更新',行动:'规范行动'}]});
  const b=setup([bad,good],rewriteValidate);b.engine.config.retryAttempts=2;
  assert.equal(await b.engine.run(),true);
  assert.equal(b.calls(),2);
  assert.match(b.engine.lastRetryLog[0].错误,/部分业务片段未通过/);
  assert.ok(Array.isArray(b.engine.lastRetryLog[0].片段)&&b.engine.lastRetryLog[0].片段.length===1,'重试日志应保留结构化分片原因');
  assert.match(b.engine.lastRetryLog[0].片段[0].原因,/\/世界\/后台\/人物\/卫兵\/行动/,'应定位到具体发生归一变化的字段');
  assert.match(b.engine.lastRetryLog[0].片段[0].原因,/含糊行动/);
  assert.match(b.engine.lastRetryLog[0].片段[0].原因,/规范行动/);
  const retry=JSON.parse(b.inputs[1]).纠错重试;
  assert.equal(retry.当前尝试,2);
  assert.equal(retry.最大尝试次数,2);
  for(const key of ['当前总尝试','最大总尝试','当前额外重试','额外重试上限'])assert.equal(retry[key],undefined);

  assert.match(source,/最大尝试次数/,'UI 应直接使用包含首次请求的总尝试次数');
  assert.match(source,/1 = 只请求一次/);
  assert.doesNotMatch(source,/失败后额外重试/);

  console.log('world-engine schema/retry diagnostics acceptance passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
