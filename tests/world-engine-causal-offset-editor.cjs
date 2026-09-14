const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

(async()=>{
  const message={message_id:7,role:'assistant',message:'正文已经完成。'};
  let current={stat_data:{
    世界:{名称:'测试世界',时间:'2026年9月14日傍晚',地点:'旧城区',稳定:91,后台:emptyState(),因果轨道:{当前阶段:'测试',故事线:'A -> B -> C',下一节点:'B',偏移记录:{
      '觉醒波动的泄露':{描述:'位置被异端提前感知，增加了初期生存难度。',引发者:'袜柱',影响程度:-1},
      '关键人物命运改写':{描述:'关键人物已经永久死亡，原主线无法按原方式成立。',引发者:'测试者',影响程度:-8}
    }},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{},历法:{}},
    设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  }};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'causal-editor-test',
    getChatMessages:()=>[message],
    Mvu:{
      getMvuData:()=>clone(current),
      replaceMvuData:async data=>{
        assert.equal(host.__samsaraUIMutation,true,'手动编辑写回必须标记为 UI 操作，避免触发自动世界推进');
        current=clone(data);
      }
    },
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    toastr:{error:()=>{}}
  };
  const engine=new Engine(host);engine.render=()=>{};
  const fingerprint=engine.snapshot().fingerprint;
  current.__samsaraWorldCommit=fingerprint;
  current.__samsaraWorldReplay={version:1,fingerprint,operations:[
    {op:'set',path:['世界','因果轨道','偏移记录','觉醒波动的泄露'],value:clone(current.stat_data.世界.因果轨道.偏移记录['觉醒波动的泄露'])},
    {op:'set',path:['世界','因果轨道','偏移记录','关键人物命运改写'],value:clone(current.stat_data.世界.因果轨道.偏移记录['关键人物命运改写'])},
    {op:'set',path:['世界','稳定'],value:91}
  ]};

  await engine.removeCausalOffsetRecord('觉醒波动的泄露');
  assert.equal(current.stat_data.世界.因果轨道.偏移记录['觉醒波动的泄露'],undefined,'删除按钮必须真正删除偏移记录');
  assert.equal(current.stat_data.世界.稳定,92,'删除错误的 -1 偏移后必须立即按剩余偏移重算稳定值');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='remove'&&op.path.join('/')==='世界/因果轨道/偏移记录/觉醒波动的泄露'),'同楼 replay 必须同步删除，避免重新处理变量时把手动删除的脏记录恢复回来');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='set'&&op.path.join('/')==='世界/稳定'&&op.value===92),'replay 必须同步新的稳定值');

  await engine.setCausalOffsetRecord('关键人物命运改写','关键人物命运修正',{描述:'关键人物仍永久退场，但影响范围经玩家校正后低于原估计。',引发者:'测试者',影响程度:-5});
  assert.equal(current.stat_data.世界.因果轨道.偏移记录['关键人物命运改写'],undefined,'重命名编辑必须移除旧键');
  assert.equal(current.stat_data.世界.因果轨道.偏移记录['关键人物命运修正'].影响程度,-5,'编辑必须写入新的影响程度');
  assert.equal(current.stat_data.世界.稳定,95,'编辑影响程度后必须立即重算稳定值');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='set'&&op.path.join('/')==='世界/因果轨道/偏移记录/关键人物命运修正'&&op.value.影响程度===-5),'replay 必须同步编辑后的偏移');

  await assert.rejects(()=>engine.setCausalOffsetRecord('关键人物命运修正','关键人物命运修正',{描述:'无效',引发者:'测试者',影响程度:0}),/影响程度必须/,'0 影响应通过删除记录处理，不允许保留无意义偏移');
  console.log('PASS causal offset edit/delete controls persist data, recalculate stability and keep replay consistent');
})().catch(error=>{console.error(error);process.exitCode=1;});
