const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'../script/世界推进系统.js');
const {SamsaraWorldEngine:Engine,emptyState}=require(file);
const clone=value=>JSON.parse(JSON.stringify(value));

(async()=>{
  const store={};
  let current={stat_data:{
    世界:{名称:'快照世界',时间:'2026年9月29日',地点:'旧港',稳定:88,后台:emptyState(),势力:{旧港守备:{实力:'D',领地:'旧港',描述:'守备',声望:20}},探索:{},异端雷达:{名单:{}},因果轨道:{当前阶段:'旧港警戒',故事线:'',下一节点:'',偏移记录:{}}},
    资产:{旧港仓库:{类型:'地产',描述:'旧港仓库'}},
    关系列表:{向导:{好感度:15,态度:'信任'}},
    传闻:{街头巷议:{旧港传闻:{来源:'码头',内容:'旧港戒严。',可信度:'或许可信'}},情报交易:{},布告与檄文:{}},
    任务:{列表:{主线:{状态:'进行中'}}},
    角色:{HP:100},
    系统状态:{是否在主神空间:false},
    设置:{}
  }};
  const host={
    localStorage:{getItem:key=>store[key]||null,setItem:(key,value)=>{store[key]=String(value);}},
    getCurrentChatId:()=> 'snapshot-chat',
    getChatMessages:()=>[{message_id:7,role:'assistant',message:'旧港局势继续。'}],
    Samsara:{validateWorldState:clone,terminal:{apiReady:()=>false}},
    Mvu:{getMvuData:()=>clone(current),replaceMvuData:async value=>{current=clone(value);}},
    document:{addEventListener:()=>{},removeEventListener:()=>{}}
  };
  const engine=new Engine(host);
  assert.equal(engine.services.snapshots?.constructor?.name,'WorldSnapshotService');
  const saved=engine.services.snapshots.create('旧港节点');
  assert.equal(saved.name,'旧港节点');
  assert.equal(engine.services.snapshots.list().length,1);

  current.stat_data.世界.时间='2026年10月5日';
  current.stat_data.世界.地点='新港';
  current.stat_data.世界.势力={新港舰队:{实力:'B',领地:'新港',描述:'舰队',声望:300}};
  current.stat_data.资产={新港基地:{类型:'地产',描述:'新港基地'}};
  current.stat_data.关系列表.向导={好感度:99,态度:'狂热'};
  current.stat_data.传闻.街头巷议={新港传闻:{来源:'新港',内容:'新港获胜。',可信度:'或许可信'}};
  current.stat_data.任务.列表.主线.状态='已完成';
  current.stat_data.角色.HP=1;

  assert.equal(await engine.services.snapshots.restore(saved.id),true);
  assert.equal(current.stat_data.世界.时间,'2026年9月29日');
  assert.equal(current.stat_data.世界.地点,'旧港');
  assert.ok(current.stat_data.世界.势力.旧港守备);
  assert.ok(current.stat_data.资产.旧港仓库);
  assert.equal(current.stat_data.关系列表.向导.好感度,15);
  assert.ok(current.stat_data.传闻.街头巷议.旧港传闻);
  assert.equal(current.stat_data.任务.列表.主线.状态,'已完成','世界快照不得回滚任务系统');
  assert.equal(current.stat_data.角色.HP,1,'世界快照不得回滚玩家角色数值');
  assert.equal(current.stat_data.世界.后台.已处理楼层,'','恢复快照后应允许当前楼层重新建立推进锚点');

  assert.equal(engine.services.snapshots.remove(saved.id),true);
  assert.equal(engine.services.snapshots.list().length,0);

  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/保存世界快照/);
  assert.match(source,/data-world-snapshot-name/);
  assert.match(source,/data-action="world-snapshot-restore"/);

  console.log('PASS world snapshot saves/restores world-owned state without rolling back player task/character state');
})().catch(error=>{console.error(error);process.exitCode=1;});
