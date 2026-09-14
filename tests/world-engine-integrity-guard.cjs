const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
function loadAssembledEngine(){
  const builder=fs.readFileSync(path.join(root,'tools','build-world-engine.py'),'utf8');
  const tuple=(builder.match(/PARTS = \(([\s\S]*?)\)\r?\n\r?\n/)||[])[1]||'';
  const parts=[...tuple.matchAll(/'([^']+\.part\.js)'/g)].map(match=>match[1]);
  assert.ok(parts.length>=13,'builder must expose world-engine parts');
  const source=parts.map(name=>fs.readFileSync(path.join(root,'script','world-engine-src',name),'utf8')).join('');
  const mod={exports:{}};
  const compile=new Function('module','exports','require','__filename','__dirname',source);
  compile(mod,mod.exports,require,path.join(root,'script','世界推进系统.js'),path.join(root,'script'));
  return mod.exports;
}

const {SamsaraWorldEngine:Engine,applyPatches,emptyState,RECORDS,compileWorldResult,WORLD_RESULT_SCHEMA}=loadAssembledEngine();
const clone=value=>JSON.parse(JSON.stringify(value));
const add=(p,value)=>({op:'add',path:p,value});
function fresh(){
  return {
    世界:{名称:'测试世界',时间:'2008年07月17日-07:00',地点:'测试地点',稳定:100,后台:emptyState(),因果轨道:{当前阶段:'测试阶段',故事线:'A -> B -> C',下一节点:'B',偏移记录:{}},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{},历法:{}},
    设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

(async()=>{
  {
    const stat=fresh();
    assert.throws(
      ()=>applyPatches(stat,[add('/世界/后台/人物/测试者',{...RECORDS.人物,所属世界:'测试世界',地点:'测试地点',目标:'等待',行动:'等待',更新时间:'2008年07月17日-07:50'})]),
      /时间事实超过当前世界时间/,
      'precise person clocks must still reject future writes when both sides provide HH:mm'
    );
    assert.doesNotThrow(()=>applyPatches(stat,[add('/世界/后台/人物/测试者',{...RECORDS.人物,所属世界:'测试世界',地点:'测试地点',目标:'等待',行动:'等待',更新时间:'2008年07月17日-07:00'})]));
  }

  {
    const stat=fresh();
    stat.世界.时间='1349年-06月-28日-上午';
    assert.doesNotThrow(()=>applyPatches(stat,[add('/世界/后台/事件/同日午后事件',{
      ...RECORDS.事件,描述:'同一天稍晚发生的宏观活动',分类:'当前事件',状态:'进行中',时间:'1349年-06月-28日-下午',更新时间:'1349年-06月-28日-下午'
    })]),'macro facts on the same calendar day must not be rejected only because their coarse daypart is later');
    assert.throws(()=>applyPatches(stat,[add('/世界/后台/事件/次日事件',{
      ...RECORDS.事件,描述:'真正跨日的未来事实',分类:'当前事件',状态:'进行中',时间:'1349年-06月-29日-上午',更新时间:'1349年-06月-29日-上午'
    })]),/时间事实超过当前世界时间/,'macro facts on a later calendar day must still be rejected');
  }

  {
    const impact=WORLD_RESULT_SCHEMA.properties.因果.properties.偏移记录.items.properties.影响程度;
    assert.equal(Object.hasOwn(impact,'minimum'),false,'causal impact magnitude must not be rejected by JSON Schema');
    assert.equal(Object.hasOwn(impact,'maximum'),false,'causal impact magnitude must be soft-normalized instead of rejected by JSON Schema');

    const stat=fresh();
    const over=compileWorldResult(stat,{摘要:'过量扣减',因果:{偏移记录:[{名称:'主线断裂',描述:'关键人物命运已经发生不可逆改写，原主线无法按原方式收束',引发者:'测试者',影响程度:-13}]}});
    const afterOver=applyPatches(stat,over.patches);
    assert.equal(afterOver.世界.因果轨道.偏移记录['主线断裂'].影响程度,-12,'out-of-range causal impact must be clamped without rejecting the world update');

    const splitStat=fresh();
    const split=compileWorldResult(splitStat,{摘要:'拆分同一根因',因果:{偏移记录:[
      {名称:'生命共生的契约',描述:'同一契约已经改变魔力来源并形成连锁影响',引发者:'珊瑚',影响程度:-8},
      {名称:'召唤仪式的频率干扰',描述:'同一契约造成召唤余波与灵基变化',引发者:'珊瑚',影响程度:-4},
      {名称:'异质召唤的余波',描述:'同一契约的后续影响继续扩散',引发者:'珊瑚',影响程度:-2}
    ]}});
    const afterSplit=applyPatches(splitStat,split.patches);
    assert.deepEqual(Object.keys(afterSplit.世界.因果轨道.偏移记录),['生命共生的契约'],'same-root chain fragments must be softly coalesced instead of rejected or stacked');
    assert.equal(afterSplit.世界.因果轨道.偏移记录['生命共生的契约'].影响程度,-8);

    const idleBombStat=fresh();
    const idleBomb=compileWorldResult(idleBombStat,{摘要:'只有危险物品，没有现实改变',因果:{偏移记录:[{
      名称:'高危装置携带',描述:'只是持有极端高危装置，尚未使用，也未造成任何关键人物、事件、势力或主线结果变化',引发者:'测试者',影响程度:-12
    }]}});
    const afterIdleBomb=applyPatches(idleBombStat,idleBomb.patches);
    assert.equal(Object.keys(afterIdleBomb.世界.因果轨道.偏移记录).length,0,'mere capability, intent or possession without a realized plot consequence must not create a causal offset');

    assert.doesNotThrow(()=>compileWorldResult(fresh(),{摘要:'真实重大偏移',因果:{偏移记录:[{名称:'关键人物命运改写',描述:'关键人物已经发生不可逆命运变化，原主线无法按原方式收束',引发者:'测试者',影响程度:-8}]}}));
  }

  {
    const state=fresh();
    const message={message_id:1,role:'assistant',message:'当前剧情已经确认到这里。'};
    const host={
      localStorage:{getItem:()=>null,setItem:()=>{}},getCurrentChatId:()=> 'integrity-guard-test',getChatMessages:()=>[message],
      getCharWorldbookNames:()=>({primary:'测试世界书',additional:[]}),getWorldbook:()=>[],
      Mvu:{getMvuData:()=>({stat_data:clone(state)}),replaceMvuData:async()=>{}},
      Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:stat=>clone(stat)},
      document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
    };
    const engine=new Engine(host);engine.config.contextTurns=1;engine.config.enabled=true;engine.worldbook=async()=>[];
    const request=await engine.buildRequest(engine.snapshot());
    assert.match(request.system,/【因果偏移与时间(?:硬)?约束】/,'mandatory request must carry the causal/time invariant block');
    assert.match(request.system,/偏移记录不是.*剧情(?:日志|总结|小结)/,'prompt must explicitly prevent using causal offsets as mini plot summaries');
    assert.match(request.system,/持有.*高危装置.*(?:尚未|未).*不产生偏移/,'prompt must explain that unrealized catastrophic capability creates no causal offset');
    assert.match(request.system,/同一.*根因.*只记一条/,'prompt must prohibit chain-splitting the same root cause');
    assert.match(request.system,/预测|风险|可能/,'prompt must forbid charging stability for speculative consequences');
    assert.match(request.system,/软(?:归一化|处理)|不触发重试/,'causal offset cleanup must be described as soft processing rather than a retry trigger');
    assert.match(request.system,/同一自然日|跨日/,'time prompt must describe the day-granular macro chronology rule');
  }

  console.log('world-engine integrity guard regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
