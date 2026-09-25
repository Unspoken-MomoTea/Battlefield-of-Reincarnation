const assert=require('node:assert/strict');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function stateWithHistory(count=17){
  const backend=emptyState();
  for(let i=1;i<=count;i++)backend.历史['推进·'+i]={时间:'第'+i+'日',事实:'第'+i+'次世界推进的已确认摘要',关联事件:[]};
  backend.事件['城内例行巡逻']={描述:'卫队维持城内日常巡逻。',时间:'第30日',条件:'',前因:[],状态:'进行中',默认走向:'继续巡逻',结果:'',公开征兆:'卫兵正常换岗。',地点:'城内',分类:'当前事件',更新时间:'第30日'};
  backend.势力地区['城内中央区']={类型:'地区',描述:'城内主要居民区。',目标:'维持秩序',进展:'巡逻持续。',下次检查:'',关联事件:['城内例行巡逻'],公开动态:'街面秩序稳定。'};
  backend.势力地区['城防卫队']={类型:'势力',描述:'负责城内日常治安。',目标:'维持秩序',进展:'维持常规轮值。',下次检查:'',关联事件:['城内例行巡逻'],公开动态:'卫队正常执勤。'};
  return {
    世界:{名称:'历史安全测试',时间:'第30日',地点:'城内',稳定:100,后台:backend,因果轨道:{当前阶段:'局势延续',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{城防卫队:{实力:'C',领地:'城内',描述:'负责城内日常治安。',声望:0}},探索:{},法则:[],货币:{},历法:{}},
    设置:{单一世界:true},系统状态:{是否在主神空间:false},资产:{},关系列表:{},
    传闻:{街头巷议:{a:{来源:'路人',内容:'城内平静',可信度:'或许可信'}},情报交易:{a:{卖家:'斥候',情报评级:'F',摘要:'道路畅通',要价:'10',真实内幕:'属实'}},布告与檄文:{a:{发布者:'卫队',内容:'照常巡逻',张贴位置:'城门'}}}
  };
}

(async()=>{
  // 历史总结是附加维护：第18次推进的 L0 叶子应先成功落库；后续长期总结失败也不能撤销主推进或该叶子。
  {
    let current=stateWithHistory(),calls=0;
    const message={message_id:80,role:'assistant',message:'今天局势继续稳定。'};
    const host={
      localStorage:{getItem:()=>null,setItem:()=>{}},
      getCurrentChatId:()=> 'history-safety',getChatMessages:()=>[message],
      Mvu:{getMvuData:()=>({stat_data:clone(current)}),replaceMvuData:async raw=>{current=clone(raw.stat_data);}},
      Samsara:{terminal:{apiReady:()=>true,request:async()=>{
        calls++;
        return calls===1?JSON.stringify({
          摘要:'本轮世界正常推进。',
          势力地区:[{名称:'城内中央区',操作:'更新',类型:'地区',描述:'城内主要居民区。',目标:'维持秩序',进展:'本轮完成一次例行换岗。',关联事件:['城内例行巡逻'],公开动态:'街面巡逻完成换岗。'}]
        }):'这不是合法的历史总结 JSON';
      }},validateWorldState:stat=>clone(stat)},
      document:{addEventListener:()=>{},removeEventListener:()=>{}},toastr:{error:()=>{}}
    };
    const engine=new Engine(host);engine.worldbook=async()=>[];engine.config.enabled=true;engine.config.requireMacroBackbone=false;engine.config.retryAttempts=1;engine.config.contextTurns=1;
    assert.equal(await engine.run(),true,'主世界推进成功时，附加历史总结失败不得把run改成失败');
    assert.equal(calls,2,'本轮写入第18个推进叶子后应尝试一次历史总结');
    assert.equal(Object.hasOwn(current.世界.后台,'运行记录'),false,'主推进不应再重复持久化推演记录');
    assert.equal(current.世界.后台.历史['推进·80']?.事实,'本轮世界正常推进。','长期总结失败也不得丢失本轮近期历史叶子');
    assert.equal(Object.keys(current.世界.后台.历史总结||{}).length,0,'失败的总结不得写入半成品节点');
    assert.match(engine.lastHistoryMaintenance,/稍后重试/,'失败应留下可重试状态，而不是破坏主推进');
  }

  // 正文历史开关是本地持久设置，默认关；开启后重建引擎仍保持。
  {
    let stored='';
    const storage={getItem:()=>stored||null,setItem:(_key,value)=>{stored=String(value);}};
    const host={localStorage:storage,document:{addEventListener:()=>{},removeEventListener:()=>{}},Samsara:{terminal:{apiReady:()=>false}}};
    const first=new Engine(host);
    assert.equal(first.config.sendHistoryToProse,false,'正文历史默认必须关闭');
    assert.equal(first.setSendHistoryToProse(true),true);
    assert.equal(JSON.parse(stored).sendHistoryToProse,true,'开启状态必须保存到世界推进本地配置');
    const second=new Engine(host);
    assert.equal(second.config.sendHistoryToProse,true,'重新加载世界推进后必须恢复开关状态');
  }

  console.log('world-engine history memory safety tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
