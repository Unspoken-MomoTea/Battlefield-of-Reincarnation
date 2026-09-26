const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

const layerPaths=[
  path.join(__dirname,'../script/world-engine-src/59-history-memory-editor.part.js'),
  path.join(__dirname,'../src/WorldEngine/domains/WorldHistoryService.part.js'),
  path.join(__dirname,'../src/WorldEngine/ui/WorldEditorController.part.js'),
];
for(const layerPath of layerPaths)assert.ok(fs.existsSync(layerPath),'history memory editor class source must exist');
const layer=layerPaths.map(file=>fs.readFileSync(file,'utf8')).join('\n');
assert.match(layer,/data-action="history-anchor-edit"/,'recent history anchors must expose an edit action');
assert.match(layer,/data-action="history-summary-edit"/,'long-term history summaries must expose an edit action');
assert.match(layer,/data-history-field="fact"/,'anchor editor must expose the confirmed fact');
assert.match(layer,/data-history-field="related"/,'anchor editor must expose related events');
assert.match(layer,/data-history-field="summary"/,'summary editor must expose the summary text');
assert.match(layer,/data-history-field="start"/,'summary editor must expose its start time');
assert.match(layer,/data-history-field="end"/,'summary editor must expose its end time');
assert.doesNotMatch(layer,/data-history-field="level"|data-history-field="children"/,'summary tree level and child references must stay program-owned');

(async()=>{
  const backend=emptyState();
  backend.历史={
    '异端降临与法则畸变':{时间:'2004-01-30-夜晚',事实:'原始历史事实。',关联事件:['异端降临']}
  };
  backend.历史总结={
    'H1-000001':{层级:1,摘要:'原始长期总结。',子项:['历史:异端降临与法则畸变'],起始时间:'2004-01-01',结束时间:'2004-01-30',起始序位:1,结束序位:12,创建时间:'2004-01-30'}
  };
  const message={message_id:23,role:'assistant',message:'正文结束。'};
  let current={stat_data:{
    世界:{名称:'测试世界',时间:'2004-01-31-凌晨',地点:'冬木市',稳定:100,后台:backend,因果轨道:{当前阶段:'测试',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{},历法:{}},
    设置:{单一世界:true},系统状态:{是否在主神空间:false},资产:{},角色:{},关系列表:{},任务:{列表:{}},传闻:{街头巷议:{},情报交易:{},布告与檄文:{}}
  }};
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    getCurrentChatId:()=> 'history-memory-editor-test',
    getChatMessages:()=>[message],
    Mvu:{
      getMvuData:()=>clone(current),
      replaceMvuData:async data=>{
        assert.equal(host.__samsaraUIMutation,true,'manual history edits must be marked as UI mutations');
        current=clone(data);
      }
    },
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    toastr:{error:()=>{}}
  };
  const engine=new Engine(host);engine.render=()=>{};
  assert.equal(typeof engine.setHistoryAnchorRecord,'function','engine must provide a history anchor edit API');
  assert.equal(typeof engine.setHistorySummaryRecord,'function','engine must provide a long-term summary edit API');

  const fingerprint=engine.snapshot().fingerprint;
  current.__samsaraWorldReplay={version:1,fingerprint,operations:[]};

  await engine.setHistoryAnchorRecord('异端降临与法则畸变',{
    时间:'2004-01-30-深夜',
    事实:'多名异端已自主降临冬木市，法则畸变被玩家手动校正为已确认事实。',
    关联事件:['异端降临','圣杯战争']
  });
  const anchor=current.stat_data.世界.后台.历史['异端降临与法则畸变'];
  assert.equal(anchor.时间,'2004-01-30-深夜');
  assert.match(anchor.事实,/玩家手动校正/);
  assert.deepEqual(anchor.关联事件,['异端降临','圣杯战争']);
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='set'&&op.path.join('/')==='世界/后台/历史/异端降临与法则畸变'&&/玩家手动校正/.test(op.value.事实)),'same-floor replay must preserve manual anchor corrections');

  const beforeSummary=clone(current.stat_data.世界.后台.历史总结['H1-000001']);
  await engine.setHistorySummaryRecord('H1-000001',{
    摘要:'玩家修正：早期异端降临已经永久改变冬木市的法则结构。',
    起始时间:'2004-01-01-凌晨',
    结束时间:'2004-01-30-深夜'
  });
  const summary=current.stat_data.世界.后台.历史总结['H1-000001'];
  assert.match(summary.摘要,/玩家修正/);
  assert.equal(summary.起始时间,'2004-01-01-凌晨');
  assert.equal(summary.结束时间,'2004-01-30-深夜');
  assert.equal(summary.层级,beforeSummary.层级,'manual editing must not mutate summary tree level');
  assert.deepEqual(summary.子项,beforeSummary.子项,'manual editing must not mutate child references');
  assert.equal(summary.起始序位,beforeSummary.起始序位,'manual editing must keep ordering metadata intact');
  assert.equal(summary.结束序位,beforeSummary.结束序位,'manual editing must keep ordering metadata intact');
  assert.ok(current.__samsaraWorldReplay.operations.some(op=>op.op==='set'&&op.path.join('/')==='世界/后台/历史总结/H1-000001'&&/玩家修正/.test(op.value.摘要)),'same-floor replay must preserve manual summary corrections');

  await assert.rejects(()=>engine.setHistoryAnchorRecord('异端降临与法则畸变',{时间:'2004-01-30',事实:'',关联事件:[]}),/事实不能为空/);
  await assert.rejects(()=>engine.setHistorySummaryRecord('H1-000001',{摘要:'',起始时间:'',结束时间:''}),/摘要不能为空/);
  console.log('PASS recent and long-term history memory can be edited without damaging the summary tree');
})().catch(error=>{console.error(error);process.exitCode=1;});
