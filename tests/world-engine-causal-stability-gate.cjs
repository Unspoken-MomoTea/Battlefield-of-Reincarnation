const assert=require('node:assert/strict');
const {compileWorldResult,applyPatches,emptyState}=require('../script/世界推进系统.js');

function fresh(){
  return {
    世界:{
      名称:'测试世界',时间:'2026年9月14日傍晚',地点:'旧城区',稳定:100,后台:emptyState(),
      因果轨道:{当前阶段:'局势仍处于初期',故事线:'A -> B -> C',下一节点:'B',偏移记录:{}},
      异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{},历法:{}
    },
    设置:{单一世界:false},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

{
  const stat=fresh();
  const compiled=compileWorldResult(stat,{摘要:'局部暴露',因果:{偏移记录:[{
    名称:'觉醒波动的泄露',
    描述:'袜柱的觉醒未能完全隐蔽，导致其位置被异端提前感知，增加了初期生存难度。',
    引发者:'袜柱',影响程度:-1
  }]}});
  const next=applyPatches(stat,compiled.patches);
  assert.deepEqual(next.世界.因果轨道.偏移记录,{},'位置暴露、敌人提前感知、初期生存难度等局部后果不得进入世界稳定台账');
}

{
  const stat=fresh();
  const compiled=compileWorldResult(stat,{摘要:'真实主线偏移',因果:{偏移记录:[{
    名称:'关键人物命运改写',
    描述:'关键人物已经永久死亡，原定主线收束方式失效，下一宏观节点无法按原计划成立。',
    引发者:'测试者',影响程度:-8
  }]}});
  const next=applyPatches(stat,compiled.patches);
  assert.equal(next.世界.因果轨道.偏移记录['关键人物命运改写'].影响程度,-8,'真正改变关键人物命运和主线可行性的偏移必须保留');
}

{
  const stat=fresh();
  const compiled=compileWorldResult(stat,{摘要:'异常污染扩大',因果:{偏移记录:[{
    名称:'跨世界污染扩散',
    描述:'异常污染已经持续扩大并跨出原封锁区，形成新的跨区域污染带。',
    引发者:'异常源',影响程度:-1
  }]}});
  const next=applyPatches(stat,compiled.patches);
  assert.equal(next.世界.因果轨道.偏移记录['跨世界污染扩散'].影响程度,-1,'-1 只应在真实异常污染等世界尺度锚点下成立');
}

{
  const stat=fresh();
  stat.世界.因果轨道.偏移记录['旧的局部暴露']={
    描述:'位置被敌人提前感知，导致短期行动更困难并增加初期生存难度。',引发者:'测试者',影响程度:-1
  };
  stat.世界.稳定=99;
  const compiled=compileWorldResult(stat,{摘要:'本轮无新因果偏移'});
  const next=applyPatches(stat,compiled.patches);
  assert.equal(next.世界.因果轨道.偏移记录['旧的局部暴露'],undefined,'历史中明确属于局部战术后果的错误稳定偏移应自动清理');
  assert.ok(compiled.warnings.some(line=>/清理局部稳定偏移/.test(line)),'清理旧错误偏移时应留下可诊断警告');
}

console.log('PASS world stability only accepts realized world-scale causal offsets');
