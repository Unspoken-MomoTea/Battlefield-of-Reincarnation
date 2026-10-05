const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const runtime=require(path.join(root,'script','世界推进系统.js'));
const {SamsaraWorldEngine:Engine,emptyState}=runtime;
const clone=value=>JSON.parse(JSON.stringify(value));

function baseState(){
  return {
    世界:{
      名称:'手动推进测试',时间:'2026年-10月-05日-上午',地点:'第一层城镇',稳定:100,
      后台:emptyState(),势力:{},探索:{},因果轨道:{当前阶段:'准备攻略',故事线:'',下一节点:'',偏移记录:{}},
      异端雷达:{名单:{}},货币:{},历法:{},法则:[]
    },
    系统状态:{是否在主神空间:false,是否战斗中:false},设置:{},任务:{列表:{}},资产:{},关系列表:{},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  };
}

(async()=>{
  let raw={stat_data:baseState()};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'manual-advance',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'攻略组仍在准备第一层 Boss。'}],
    Mvu:{
      getMvuData:()=>clone(raw),
      replaceMvuData:async next=>{raw=clone(next);}
    },
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''},validateWorldState:x=>x},
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
  };
  const engine=new Engine(host);
  assert.equal(engine.services.manualAdvance?.constructor?.name,'WorldManualAdvanceFeature');

  const initial=engine.snapshot();
  const before=clone(initial.stat),after=clone(before);
  after.世界.时间='2026年-10月-05日-中午';
  after.世界.后台.事件['第一层Boss战']={
    分类:'当前事件',状态:'进行中',描述:'攻略组已开始 Boss 战',时间:after.世界.时间,
    地点:'Boss房',参与者:['攻略组'],前因:[],关联任务:[],可见影响:['城镇开始流传攻略成功的消息']
  };
  after.世界.后台.已处理楼层=initial.fingerprint;
  after.世界.后台.已处理时间=before.世界.时间;

  const replay=engine.services.replay.buildPackage(before,after,initial.fingerprint);
  assert.ok(replay&&Array.isArray(replay.operations)&&replay.operations.length>0);
  assert.ok(Array.isArray(replay.rerunBaseline)&&replay.rerunBaseline.length>0,'world commit must retain pre-advance values for rerun');
  raw={stat_data:clone(after),__samsaraWorldReplay:clone(replay)};

  engine.worldReplayManualForce=true;
  const rerun=engine.snapshot();
  engine.worldReplayManualForce=false;
  assert.equal(rerun.manualRerun?.restored,true,'manual rerun should restore the pre-advance baseline in memory');
  assert.equal(rerun.stat.世界.时间,before.世界.时间,'manual rerun must not stack a second time advance on the rejected result');
  assert.equal(rerun.stat.世界.后台.事件['第一层Boss战'],undefined,'manual rerun should remove events created only by the rejected advance');
  assert.equal(rerun.stat.世界.后台.已处理楼层,'','manual rerun must reopen the current floor');

  // A later manual edit on a path changed by the world run is newer user intent.
  // The guarded rollback must not erase it even though other untouched world-run changes roll back.
  raw.stat_data.世界.后台.事件['第一层Boss战'].描述='玩家手动改成：仍在战前会议';
  engine.worldReplayManualForce=true;
  const withManualEdit=engine.snapshot();
  engine.worldReplayManualForce=false;
  assert.equal(withManualEdit.stat.世界.后台.事件['第一层Boss战'].描述,'玩家手动改成：仍在战前会议','manual edits after the run must survive rerun baseline restoration');
  assert.equal(withManualEdit.stat.世界.时间,before.世界.时间,'unmodified world-run fields should still roll back');

  engine.manualAdvanceInstruction='暂时不要开 Boss 战，重点维护攻略组准备。';
  const request={input:JSON.stringify({说明:'test'}),manifest:{}};
  const decorated=await engine.services.manualAdvance.afterBuildRequest(request,{manualRerun:{restored:true}});
  const payload=JSON.parse(decorated.input);
  assert.equal(payload.本轮人工指导.模式,'重新推演当前楼层');
  assert.equal(payload.本轮人工指导.要求,'暂时不要开 Boss 战，重点维护攻略组准备。');
  assert.match(payload.本轮人工指导.执行规则,/仅对本轮有效/);
  assert.equal(decorated.manifest.人工指导.启用,true);

  const panelSource=fs.readFileSync(path.join(root,'src/WorldEngine/ui/WorldPanelController.part.js'),'utf8');
  const featureSource=fs.readFileSync(path.join(root,'src/WorldEngine/domains/WorldManualAdvanceFeature.part.js'),'utf8');
  assert.match(panelSource,/manualAdvance\?\.trigger/,'manual button must route through the guidance dialog feature');
  assert.match(featureSource,/本次推进指导/);
  assert.match(featureSource,/留空则按正常规则推进/);

  console.log('PASS manual world advance can guide and rerun the current floor from its pre-advance baseline');
})().catch(error=>{console.error(error);process.exitCode=1;});
