const assert = require('node:assert/strict');
const {SamsaraWorldEngine: Engine, emptyState, RECORDS} = require('../script/世界推进系统.js');
const clone = value => JSON.parse(JSON.stringify(value));
const names = ['城市秩序崩溃', '区域政权更替', '大陆战争爆发'];
const events = names.map((名称, i) => ({
  名称, 分类:'宏观节点', 状态:'待发生', 时间:`2026年9月${16 + i * 3}日`,
  描述:['全市公共基础设施崩溃，社会秩序进入失序阶段。', '地区政权更替，势力格局发生阶段变化。', '大陆战争爆发，各国进入战时阶段。'][i],
  前因:i ? [names[i - 1]] : [], 更新时间:'2026年9月14日'
}));

function setup(records = {}, replyFor = () => ({摘要:'仅建立未来规划。',事件:events,因果:{宏观顺序:names}})) {
  let current = {
    世界:{名称:'测试世界',时间:'2026年9月14日',地点:'城市',稳定:100,
      后台:{...emptyState(),事件:clone(records)},势力:{},探索:{},异端雷达:{名单:{}},
      因果轨道:{当前阶段:'当前局势',故事线:'',下一节点:'',偏移记录:{}}},
    设置:{},系统状态:{是否在主神空间:false},关系列表:{},传闻:{},资产:{}
  };
  let calls = 0, writes = 0;
  const requests = [];
  const host = {
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'macro-first-request',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'城内暂时平静，没有经过额外时间。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request:async(system,input)=>{
      calls++;
      requests.push({system,payload:JSON.parse(input)});
      return JSON.stringify(replyFor(calls));
    }}},
    Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async data=>{writes++;current=clone(data.stat_data);}}
  };
  const engine = new Engine(host);
  engine.config.enabled = true;
  engine.config.retryAttempts = 1;
  engine.config.requireMacroBackbone = true;
  engine.worldbook = async()=>[];
  return {engine,requests,read:()=>current,calls:()=>calls,writes:()=>writes};
}
function record(event, overrides = {}) {
  const {名称, ...fields} = event;
  return {...clone(RECORDS.事件),...fields,...overrides};
}
async function requirement(x) {
  const request = await x.engine.buildRequest(x.engine.snapshot());
  return {request,payload:JSON.parse(request.input),task:JSON.parse(request.input).本轮必须完成的宏观骨架};
}

(async()=>{
  const empty = setup();
  // 自定义提示词或旧设置不能遮住程序的首轮交付约束，也不必重置用户配置。
  empty.engine.config.preset = '只推进当前区间，无变化只写摘要。';
  empty.engine.config.structurePrompt = '只输出 WorldResult JSON。';
  const first = await requirement(empty);
  assert.equal(first.task.至少补充节点数,3);
  assert.deepEqual(first.task.已有可推进宏观节点,[]);
  assert.match(first.request.system,/【本轮宏观骨架交付】/);
  assert.match(first.task.交付要求.join('\n'),/WorldResult\.事件.*实际建立节点/);
  assert.match(first.task.交付要求.join('\n'),/会合、撤离、赶路、局部争夺\/突破/);
  assert.match(first.task.交付要求.join('\n'),/因果\.宏观顺序/);
  assert.match(first.task.交付要求.join('\n'),/无明确前因使用 \[\]/);
  assert.match(first.task.规划与发生,/时间未推进/);
  assert.match(first.task.规划与发生,/可排在下一宏观边界之后/);
  assert.match(first.task.规划与发生,/不得为凑数提前原著日期/);
  assert.equal(first.payload.本轮时间容量.等级,'首轮初始化');
  assert.match(first.request.system,/【原著\/数据库时间轴硬约束】/);

  assert.equal(await empty.engine.run(),true,'无额外时间流逝时，应允许首轮建立未来骨架');
  assert.equal(empty.calls(),1);
  assert.equal(empty.writes(),1);
  assert.equal(empty.requests[0].payload.本轮必须完成的宏观骨架.至少补充节点数,3);
  assert.equal(empty.read().世界.时间,'2026年9月14日');
  assert.deepEqual(Object.values(empty.read().世界.后台.事件).map(e=>e.状态),['待发生','待发生','待发生']);
  assert.equal(empty.read().世界.因果轨道.故事线,names.join(' -> '));

  const partial = setup({
    [names[0]]:record(events[0],{状态:'进行中',时间:'2026年9月14日'}),
    旧政权终结:record(events[1],{状态:'已完成',时间:'2026年9月13日'}),
    取消的战争:record(events[2],{状态:'已取消'}),
    天台会合:record(events[0],{描述:'小队在天台会合。',地点:'天台'})
  });
  const part = await requirement(partial);
  assert.equal(part.task.至少补充节点数,2,'进行中计入，已完成/已取消/被降级的局部事件不计入');
  assert.deepEqual(part.task.已有可推进宏观节点,[{名称:names[0],状态:'进行中'}]);
  assert.equal(part.payload.当前变量.世界.后台.事件.天台会合.分类,'近期节点');
  assert.match(part.task.验收,/结束或取消已有宏观节点.*补足/);

  const full = setup(Object.fromEntries(events.map(e=>[e.名称,record(e)])));
  const complete = await requirement(full);
  assert.equal(complete.task,undefined,'已有完整骨架时不要求每轮再造3个节点');
  assert.doesNotMatch(complete.request.system,/【本轮宏观骨架交付】/);

  partial.engine.config.requireMacroBackbone = false;
  const disabled = await requirement(partial);
  assert.equal(disabled.task,undefined,'关闭强制骨架时不插入必交要求');
  assert.doesNotMatch(disabled.request.system,/【本轮宏观骨架交付】/);

  const retry = setup({}, attempt=>attempt===1
    ? {摘要:'先建立一个节点。',事件:[events[0]]}
    : {摘要:'补齐其余节点。',事件:events.slice(1),因果:{宏观顺序:names}});
  retry.engine.config.retryAttempts = 2;
  assert.equal(await retry.engine.run(),true,'首次回复仍遗漏时，纠错继续保留已接受结果');
  assert.equal(retry.calls(),2);
  assert.equal(retry.writes(),1);
  const correction = retry.requests[1].payload.纠错重试;
  assert.deepEqual(correction.已接受业务结果.事件.map(e=>e.名称),[names[0]]);
  assert.match(correction.补充清单.join('\n'),/还需补充至少2个/);
  assert.deepEqual(correction.补充清单.slice(1),first.task.交付要求.slice(1),'首次请求与纠错的事件/排期/因果标准保持一致');
  assert.equal(Object.keys(retry.read().世界.后台.事件).length,3);
  console.log('world-engine first-request macro planning passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
