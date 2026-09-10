const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const delivery = path.join(__dirname, '../script/世界推进系统.js');
const uiSource = fs.readFileSync(path.join(__dirname, '../script/world-engine-src/50-engine-ui.part.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(__dirname, '../script/world-engine-src/40-engine-runtime.part.js'), 'utf8');
const {SamsaraWorldEngine: Engine, emptyState} = require(delivery);
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => ({
  世界:{名称:'测试世界',时间:'2026年9月10日傍晚',地点:'灰港',后台:emptyState(),势力:{},探索:{},因果轨道:{偏移记录:{}}},
  系统状态:{是否在主神空间:false},设置:{},关系列表:{},传闻:{}
});

(async () => {
  let stat=fresh();
  const host={
    localStorage:{getItem:()=>null,setItem:()=>{}},
    SillyTavern:{name1:'测试玩家'},
    Samsara:{terminal:{apiReady:()=>true,request:async()=>''}},
    getCurrentChatId:()=> 'chat-transparency',
    getChatMessages:()=>[{message_id:1,role:'assistant',message:'城门已经关闭。'}]
  };
  host.Mvu={getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async data=>{stat=clone(data.stat_data);}};
  host.getCharWorldbookNames=()=>({primary:'轮回战场V3.6.4'});
  host.getWorldbook=()=>[
    {uid:101,name:'世界规则',content:'<世界规则>灰港宵禁已经生效。</世界规则>',strategy:{type:'constant'}},
    {uid:202,name:'未选择资料',content:'绝对不应发送的候选资料',strategy:{type:'constant'}}
  ];

  const engine=new Engine(host);
  engine.config.enabled=true;
  engine.config.requireMacroBackbone=false;
  engine.config.contextTurns=1;
  engine.config.selectedEntries=[JSON.stringify(['轮回战场V3.6.4','101'])];
  engine.worldbook=Engine.prototype.worldbook;

  const request=await engine.buildRequest(engine.snapshot());
  const payload=JSON.parse(request.input);

  assert.deepEqual(payload.世界书,['<世界规则>灰港宵禁已经生效。</世界规则>'], 'AI input should receive only evaluated worldbook content');
  assert.equal(typeof payload.世界书[0],'string');
  assert.doesNotMatch(request.input,/"条目ID"/,'worldbook entry ids are local metadata and must not be sent to AI');
  assert.doesNotMatch(request.input,/"世界书"\s*:\s*"轮回战场V3\.6\.4"/,'worldbook names must not be nested into AI content');
  assert.doesNotMatch(request.input,/未选择资料|绝对不应发送的候选资料/,'unchecked worldbook entries must not be sent');

  assert.equal(request.manifest.世界书条目.length,1,'local inspection may retain metadata for actually read entries');
  assert.equal(request.manifest.世界书条目[0].名称,'世界规则');
  assert.ok(request.manifest.读取判定.some(item=>item.名称==='未选择资料'&&item.读取===false),'internal activation report may retain rejected candidates');

  assert.match(request.system,/【世界引擎核心约束】/,'core constraints remain mandatory');
  assert.doesNotMatch(request.system,/【本轮执行顺序】/,'editable execution pipeline must not be duplicated by a fixed second pipeline');
  assert.match(runtimeSource,/世界书:books\.map\(b=>String\(b\.内容\|\|''\)\)\.filter\(Boolean\)/,'runtime sends content-only worldbook payload');

  assert.match(uiSource,/固定系统注入/,'prompt workspace must expose mandatory injected blocks');
  assert.match(uiSource,/CORE_WORLD_RULES/,'prompt workspace shows core constraints from the real source constant');
  assert.match(uiSource,/NPC_BUILD_AUDIT_RULES/,'prompt workspace shows conditional NPC audit rules');
  assert.match(uiSource,/const readChecks=\(m\.读取判定\|\|\[\]\)\.filter\(item=>item\.读取===true\)/,'request inspection only presents actually read worldbook decisions');
  assert.doesNotMatch(uiSource,/资料清单与命中判定（点击展开）/,'ambiguous all-candidate inspection label must be removed');

  console.log('world-engine request transparency acceptance passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
