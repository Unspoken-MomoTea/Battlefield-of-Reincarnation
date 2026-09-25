const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const root=path.join(__dirname,'..');
const mutationPath=path.join(root,'script/world-engine-src/editor/00-world-mutations.part.js');
const eventEditorPath=path.join(root,'script/world-engine-src/editor/10-event-editor.part.js');
const personEditorPath=path.join(root,'script/world-engine-src/editor/20-person-editor.part.js');
for(const file of [mutationPath,eventEditorPath,personEditorPath])assert.ok(fs.existsSync(file),path.relative(root,file)+' must exist as a focused editor module');

const eventEditor=fs.readFileSync(eventEditorPath,'utf8');
const personEditor=fs.readFileSync(personEditorPath,'utf8');
assert.match(eventEditor,/data-action="world-edit-mode"/,'event timeline must expose one explicit edit-mode toggle');
assert.match(eventEditor,/data-world-event-edit/,'event cards must expose inline editing only while edit mode is active');
assert.match(eventEditor,/world-event-delete-confirm/,'event deletion must require in-panel confirmation');
assert.doesNotMatch(eventEditor,/globalThis\.prompt|globalThis\.confirm|window\.prompt|window\.confirm/,'event editing must stay inside the world-engine panel');
assert.match(personEditor,/data-world-person-edit/,'world activity records must expose an inline editor');
assert.match(personEditor,/世界活动记录/,'person editor must describe that it edits only world-engine activity data');
assert.doesNotMatch(personEditor,/好感度|背景故事|血统|装备|技能/,'world person editor must not edit formal profile fields owned by the status bar');

function eventRecord(overrides={}){
  return {
    ...clone(RECORDS.事件),
    分类:'当前事件',
    状态:'进行中',
    描述:'旧事件描述',
    时间:'2026年09月26日-上午',
    开始时间:'2026年09月26日-上午',
    预计结束:'2026年09月26日-中午',
    更新时间:'2026年09月26日-上午',
    下次检查:'2026年09月26日-中午',
    参与者:['卫兵'],
    关联任务:[],
    可见影响:[],
    ...overrides
  };
}
function personRecord(overrides={}){
  return {
    ...clone(RECORDS.人物),
    所属世界:'测试世界',
    状态:'活跃',
    地点:'北门',
    目标:'守住北门',
    行动:'维持封锁',
    认知:['北门已封锁'],
    认知来源:[],
    关联事件:['旧事件'],
    公开动态:'卫兵正在盘查行人。',
    更新时间:'2026年09月26日-上午',
    开始时间:'2026年09月26日-上午',
    预计结束:'2026年09月26日-中午',
    下次检查:'2026年09月26日-中午',
    行程:[],
    背景关联:[],
    ...overrides
  };
}

(async()=>{
  const backend=emptyState();
  backend.事件['旧事件']=eventRecord();
  backend.事件['后续事件']=eventRecord({分类:'近期节点',状态:'待发生',描述:'后续',前因:['旧事件'],关联事件:undefined});
  backend.人物.卫兵=personRecord();
  backend.势力地区.北门={...clone(RECORDS.势力地区),类型:'地区',描述:'北门',关联事件:['旧事件'],更新时间:'2026年09月26日-上午',控制方:'守军',争夺方:[],资源:[],内部派系:[],近期变化:[],环境状态:[],现场群体:[]};
  backend.传播.警报={...clone(RECORDS.传播),关联事件:['旧事件'],来源:'守军',范围:'北门',时间:'2026年09月26日-上午',内容:'封锁警报',真相:'确有封锁',状态:'传播中',更新时间:'2026年09月26日-上午',到期时间:'',受众:[],引发行动:[]};
  backend.历史.旧闻={...clone(RECORDS.历史),时间:'2026年09月26日-上午',事实:'旧事件已经发生。',关联事件:['旧事件']};

  let current={stat_data:{
    世界:{名称:'测试世界',时间:'2026年09月26日-上午',地点:'北门',稳定:100,后台:backend,势力:{},探索:{},历法:{},法则:[],货币:{},因果轨道:{当前阶段:'封锁',故事线:'',下一节点:'旧事件',偏移记录:{}},异端雷达:{名单:{}}},
    系统状态:{是否在主神空间:false},设置:{},任务:{列表:{}},资产:{},
    关系列表:{卫兵:{背景故事:'正式人物资料只能由状态栏编辑',态度:'警惕',好感度:5}},
    传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  }};
  const message={message_id:41,role:'assistant',message:'北门封锁仍在持续。'};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'world-editor-test',
    getChatMessages:()=>[message],
    Mvu:{
      getMvuData:()=>clone(current),
      replaceMvuData:async data=>{
        assert.equal(host.__samsaraUIMutation,true,'manual world edits must be marked as UI mutations so auto-progress does not fire');
        current=clone(data);
      }
    },
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    toastr:{error:()=>{}}
  };
  const engine=new Engine(host);engine.render=()=>{};

  assert.equal(typeof engine.setWorldEventRecord,'function');
  assert.equal(typeof engine.removeWorldEventRecord,'function');
  assert.equal(typeof engine.setWorldPersonRecord,'function');
  assert.equal(typeof engine.removeWorldPersonRecord,'function');

  const fingerprint=engine.snapshot().fingerprint;
  current.__samsaraWorldReplay={version:1,fingerprint,operations:[
    {op:'set',path:['世界','后台','事件','旧事件'],value:clone(current.stat_data.世界.后台.事件.旧事件)},
    {op:'set',path:['世界','后台','人物','卫兵'],value:clone(current.stat_data.世界.后台.人物.卫兵)}
  ]};

  await engine.setWorldEventRecord('旧事件','修正事件',{
    ...clone(current.stat_data.世界.后台.事件.旧事件),
    描述:'玩家手动修正后的事件描述',
    分类:'当前事件',
    状态:'进行中',
    地点:'北门广场',
    前因:[]
  });
  const state1=current.stat_data;
  assert.equal(state1.世界.后台.事件.旧事件,undefined,'renaming an event must remove the old key');
  assert.match(state1.世界.后台.事件.修正事件.描述,/手动修正/);
  assert.deepEqual(state1.世界.后台.事件.后续事件.前因,['修正事件'],'renaming must update event predecessor references');
  assert.deepEqual(state1.世界.后台.人物.卫兵.关联事件,['修正事件'],'renaming must update world-person references');
  assert.deepEqual(state1.世界.后台.势力地区.北门.关联事件,['修正事件'],'renaming must update area/faction references');
  assert.deepEqual(state1.世界.后台.传播.警报.关联事件,['修正事件'],'renaming must update propagation references');
  assert.deepEqual(state1.世界.后台.历史.旧闻.关联事件,['修正事件'],'renaming must update history references');
  assert.equal(state1.世界.因果轨道.下一节点,'修正事件','renaming must keep the causal next-node pointer valid');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='remove'&&op.path.join('/')==='世界/后台/事件/旧事件'),'same-floor replay must forget the old event key');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='set'&&op.path.join('/')==='世界/后台/事件/修正事件'),'same-floor replay must preserve the corrected event');

  const formalBefore=clone(state1.关系列表.卫兵);
  await engine.setWorldPersonRecord('卫兵',{
    ...clone(state1.世界.后台.人物.卫兵),
    地点:'南门',
    目标:'调查错误情报',
    行动:'重新核验通行名单',
    公开动态:'卫兵已转移到南门。',
    关联事件:['修正事件']
  });
  assert.equal(current.stat_data.世界.后台.人物.卫兵.地点,'南门');
  assert.equal(current.stat_data.世界.后台.人物.卫兵.行动,'重新核验通行名单');
  assert.deepEqual(current.stat_data.关系列表.卫兵,formalBefore,'editing a formal person from world management must never touch the formal status-bar profile');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='set'&&op.path.join('/')==='世界/后台/人物/卫兵'&&op.value.地点==='南门'),'same-floor replay must preserve corrected world-person activity');

  await engine.removeWorldEventRecord('修正事件');
  assert.equal(current.stat_data.世界.后台.事件.修正事件,undefined);
  assert.deepEqual(current.stat_data.世界.后台.事件.后续事件.前因,[],'deleting an event must detach predecessor references');
  assert.deepEqual(current.stat_data.世界.后台.人物.卫兵.关联事件,[],'deleting an event must detach person references');
  assert.deepEqual(current.stat_data.世界.后台.势力地区.北门.关联事件,[],'deleting an event must detach area references');
  assert.deepEqual(current.stat_data.世界.后台.传播.警报.关联事件,[],'deleting an event must detach propagation references');
  assert.deepEqual(current.stat_data.世界.后台.历史.旧闻.关联事件,[],'deleting an event must detach history references');
  assert.equal(current.stat_data.世界.因果轨道.下一节点,'','deleting the selected next node must clear the dangling pointer');

  await engine.removeWorldPersonRecord('卫兵');
  assert.equal(current.stat_data.世界.后台.人物.卫兵,undefined,'world activity record must be removable');
  assert.deepEqual(current.stat_data.关系列表.卫兵,formalBefore,'removing world activity must leave the formal status-bar profile intact');

  await assert.rejects(()=>engine.setWorldPersonRecord('不存在',{地点:'哪里'}),/世界活动记录不存在/);
  console.log('PASS world event/person editor APIs correct only world-engine variables and keep replay/reference integrity');
})().catch(error=>{console.error(error);process.exitCode=1;});
