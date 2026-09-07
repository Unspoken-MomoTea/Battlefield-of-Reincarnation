const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../script/世界推进系统.js');
const source = fs.readFileSync(file, 'utf8');
const {SamsaraWorldEngine: Engine, applyPatches, emptyState, RECORDS, parseReply} = require(file);
const clone = x => JSON.parse(JSON.stringify(x));
const fresh = () => ({世界:{名称:'测试世界',时间:'2026年9月7日清晨',后台:emptyState(),势力:{},探索:{},因果轨道:{偏移记录:{}}},系统状态:{是否在主神空间:false},设置:{},任务:{列表:{调查:{状态:'进行中'}},副本成就:{发现:{状态:'未达成'}}},关系列表:{},传闻:{}});
const add = (path,value) => ({op:'add',path,value});
let tests = 0;
async function test(name, fn) { await fn(); tests++; console.log('PASS '+name); }
(async () => {
    await test('all changed entities commit together; original snapshot stays unchanged', () => {
        const stat = fresh();
        const event = {...RECORDS.事件,描述:'补给延误',时间:'2026年9月8日',前因:[]};
        const next = applyPatches(stat,[add('/世界/后台/事件/延误',event),add('/世界/后台/历史/报告',{时间:stat.世界.时间,事实:'报告已送达',关联事件:['延误']})]);
        assert.equal(next.世界.后台.事件.延误.描述,'补给延误'); assert.deepEqual(stat.世界.后台.事件,{});
        assert.throws(() => applyPatches(stat,[add('/世界/后台/事件/延误',event),add('/角色/空间币',100)]),/禁止写入/);
        assert.deepEqual(stat.世界.后台.事件,{});
    });
    await test('causal links reject missing parents and cycles', () => {
        assert.throws(() => applyPatches(fresh(),[add('/世界/后台/事件/A',{...RECORDS.事件,前因:['B']})]),/不存在/);
        assert.throws(() => applyPatches(fresh(),[add('/世界/后台/事件/A',{...RECORDS.事件,前因:['B']}),add('/世界/后台/事件/B',{...RECORDS.事件,前因:['A']})]),/循环/);
    });
    await test('backend records accept partial model objects while preserving strict detail shapes', () => {
        const stat=fresh();
        const partial={所属世界:'测试世界',地点:'城门',行动:'调查'};
        const next=applyPatches(stat,[add('/世界/后台/人物/卫兵',partial)]);
        assert.equal(next.世界.后台.人物.卫兵.行动,'调查');
        assert.equal(next.世界.后台.人物.卫兵.公开动态,'');
        assert.deepEqual(next.世界.后台.人物.卫兵.关联事件,[]);
        const updated=applyPatches(next,[add('/世界/后台/人物/卫兵',{行动:'返回哨所'})]);
        assert.equal(updated.世界.后台.人物.卫兵.所属世界,'测试世界');
        assert.equal(updated.世界.后台.人物.卫兵.地点,'城门');
        assert.equal(updated.世界.后台.人物.卫兵.行动,'返回哨所');
        assert.throws(()=>applyPatches(stat,[add('/世界/后台/人物/卫兵',{所属世界:'测试世界',行程:[{行动:'缺少日期及其他字段'}]})]),/完整/);
    });
    await test('legacy partial backend records self-heal before validating a new patch', () => {
        const stat=fresh();
        stat.世界.后台.人物.旧人物={所属世界:'测试世界',地点:'旧校舍',行动:'等待'};
        stat.世界.后台.势力地区.旧地区={类型:'地区',描述:'封锁中'};
        const next=applyPatches(stat,[add('/世界/后台/人物/新人',{所属世界:'测试世界',行动:'巡逻'})]);
        assert.equal(next.世界.后台.人物.旧人物.公开动态,'');
        assert.deepEqual(next.世界.后台.人物.旧人物.关联事件,[]);
        assert.equal(next.世界.后台.势力地区.旧地区.公开动态,'');
        assert.deepEqual(next.世界.后台.势力地区.旧地区.关联事件,[]);
    });
    await test('history immutable, dangerous paths rejected, partial records normalized', () => {
        const stat = fresh(); stat.世界.后台.历史.旧事 = {...RECORDS.历史};
        assert.throws(() => applyPatches(stat,[{op:'replace',path:'/世界/后台/历史/旧事',value:RECORDS.历史}]),/只允许新增/);
        assert.throws(() => applyPatches(stat,[add('/世界/后台/事件/__proto__',RECORDS.事件)]),/非法/);
        const next=applyPatches(stat,[add('/世界/后台/事件/空',{描述:'待调查事件'})]);
        assert.equal(next.世界.后台.事件.空.描述,'待调查事件');
        assert.equal(next.世界.后台.事件.空.状态,'待发生');
    });
    await test('backend replace behaves as safe upsert for missing records and optional detail fields', () => {
        const stat=fresh();
        stat.世界.异端雷达={名单:{'张彪·狂暴分支':{来源:'原创',经历:'',阵营:'篡夺者',职业:'',层级:'Ⅰ',状态:'活跃'}}};
        let next=applyPatches(stat,[{op:'replace',path:'/世界/后台/事件/校医室聚集/开始时间',value:'2026年9月7日上午'}]);
        assert.equal(next.世界.后台.事件.校医室聚集.描述,'校医室聚集');
        assert.equal(next.世界.后台.事件.校医室聚集.开始时间,'2026年9月7日上午');
        next=applyPatches(next,[{op:'replace',path:'/世界/后台/人物/张彪~1狂暴分支',value:{所属世界:'测试世界',行动:'追踪目标'}}]);
        assert.equal(next.世界.后台.人物['张彪·狂暴分支'].行动,'追踪目标');
        assert.equal(next.世界.后台.人物['张彪/狂暴分支'],undefined);
    });

    await test('incomplete causal projection is rebuilt from existing world events without inventing new facts', async () => {
        const x=setup(async()=>JSON.stringify({summary:'同步宏观轨道',patches:[]}));
        x.change(s=>{
            s.世界.因果轨道={当前阶段:'死体危机爆发',故事线:'藤美学园陷落',下一节点:'集结主角团',偏移记录:{}};
            s.世界.后台.事件={
                '死体危机爆发':{...RECORDS.事件,描述:'危机爆发',状态:'进行中',时间:'2026年9月7日上午'},
                '异端介入':{...RECORDS.事件,描述:'异端进入学校',状态:'进行中',时间:'2026年9月7日上午'},
                '主角团集结':{...RECORDS.事件,描述:'核心角色开始汇合',状态:'待发生',时间:'2026年9月7日中午'}
            };
        });
        assert.equal(await x.engine.run(),true);
        const orbit=x.get().世界.因果轨道;
        assert.match(orbit.故事线,/死体危机爆发.*异端介入.*主角团集结/);
        assert.equal(orbit.下一节点,'主角团集结');
    });
    await test('world stable mode, both clocks, awards and achievement rollback protected', () => {
        const stat = fresh(); stat.设置.世界超稳 = true; stat.任务.副本成就.发现.状态 = '已达成';
        for (const p of ['/世界/时间','/系统状态/游玩天数','/任务/列表/调查/奖励','/世界/因果轨道/偏移记录/偏移']) assert.throws(() => applyPatches(stat,[add(p,1)]),/禁止/);
        assert.throws(() => applyPatches(stat,[{op:'replace',path:'/任务/副本成就/发现/状态',value:'未达成'}]),/回退/);
    });
    await test('numeric and enum validation cannot be silently clamped', () => {
        assert.throws(() => applyPatches(fresh(),[add('/世界/势力/商会',{实力:'F',领地:'城',描述:'商会',声望:1001})]),/1000/);
        assert.throws(() => applyPatches(fresh(),[add('/世界/探索/遗迹',{风险:'F',探索度:101,描述:'遗迹',隐藏真相:''})]),/越界/);
        assert.throws(() => applyPatches(fresh(),[{op:'replace',path:'/任务/列表/调查/状态',value:'已发奖'}]),/任务状态/);
        assert.equal(parseReply('<world_update>{"summary":"无变化","patches":[]}</world_update>').patches.length,0);
    });
    function setup(request) {
        let stat = fresh(), text = '玩家调查了城门。', chat = 'chat-1';
        const host = {localStorage:{getItem:()=>null,setItem:()=>{}},Samsara:{validateWorldState:clone,terminal:{apiReady:()=>true,request}},getCurrentChatId:()=>chat,getChatMessages:()=>[{message_id:3,message:text,role:'assistant'}]};
        let writes = 0;
        host.Mvu = {getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async data => {writes++; stat = clone(data.stat_data);}};
        const engine = new Engine(host); engine.worldbook = async () => [];
        return {engine,get:()=>stat,writes:()=>writes,change:fn=>fn(stat),chat:()=>{chat='chat-2';},text:v=>{text=v;}};
    }
    await test('successful run persists once; same floor cannot double award', async () => {
        let calls = 0;
        const x = setup(async () => {calls++;return '{"summary":"无变化","patches":[]}';});
        assert.equal(await x.engine.run(),true); assert.equal(await x.engine.run(),false);
        assert.equal(calls,1); assert.equal(x.writes(),1); assert.equal(x.get().世界.后台.运行记录.length,1);
    });
    await test('model add can update preinitialized public summary and commit through run', async () => {
        const x=setup(async()=>JSON.stringify({summary:'守卫开始巡逻',patches:[add('/世界/后台/公开摘要','守卫开始巡逻。')]}));
        assert.equal(await x.engine.run(),true);
        assert.equal(x.get().世界.后台.公开摘要,'守卫开始巡逻。');
        assert.equal(x.writes(),1);
    });
    await test('worldbook blue/green activation, secondary keys and force mode use actual scanned prose', async () => {
        const x=setup(async()=>''),e=x.engine;
        e.worldbook=Engine.prototype.worldbook;
        e.host.getCharWorldbookNames=()=>({primary:'设定',additional:[]});
        e.host.getWorldbook=()=>[
            {uid:1,name:'常驻',content:'常驻内容',strategy:{type:'constant'}},
            {uid:2,name:'城门',content:'城门内容',strategy:{type:'selective',keys:['城门']}},
            {uid:3,name:'未命中',content:'隐藏内容',strategy:{type:'selective',keys:['海港']}},
            {uid:4,name:'禁用',content:'禁用内容',enabled:false,strategy:{type:'constant'}},
            {uid:5,name:'次要条件',content:'附加内容',strategy:{type:'selective',keys:['城门'],keys_secondary:{keys:['卫兵'],logic:'and_all'}}}
        ];
        const r=await e.buildRequest(e.snapshot());
        assert.deepEqual(JSON.parse(r.input).世界书.map(x=>x.名称),['常驻','城门']);
        assert.equal(r.manifest.读取判定.find(x=>x.名称==='次要条件').读取,false);
        e.config.activationMode='force_selected';
        e.config.selectedEntries=[JSON.stringify(['设定','4'])];
        assert.deepEqual((await e.worldbook('')).map(x=>x.名称),['禁用']);
    });
    await test('world engine isolates MVU/output prompt books even in force mode and exposes timeline scheduling needs', async () => {
        const x=setup(async()=>''),e=x.engine;
        e.worldbook=Engine.prototype.worldbook;
        e.host.getCharWorldbookNames=()=>({primary:'设定',additional:[]});
        e.host.getWorldbook=()=>[
            {uid:1,name:'[variables]当前变量',content:'变量投影',strategy:{type:'constant'}},
            {uid:2,name:'[mvu_update]变量更新规则',content:'更新协议',strategy:{type:'constant'}},
            {uid:3,name:'⚙️额外思考',content:'正文思考',strategy:{type:'constant'}},
            {uid:4,name:'世界年表',content:'世界设定',strategy:{type:'constant'}}
        ];
        e.config.activationMode='force_selected';
        e.config.selectedEntries=['1','2','3','4'].map(id=>JSON.stringify(['设定',id]));
        const r=await e.buildRequest(e.snapshot()),payload=JSON.parse(r.input);
        assert.deepEqual(payload.世界书.map(x=>x.名称),['世界年表']);
        for(const name of ['[variables]当前变量','[mvu_update]变量更新规则','⚙️额外思考']){
            const row=r.manifest.读取判定.find(x=>x.名称===name);
            assert.equal(row.读取,false);assert.match(row.原因,/隔离/);
        }
        assert.equal(payload.时间线调度.需要初始化,true);
        assert.equal(payload.时间线调度.需要补充远期,true);
        assert.equal(payload.时间线调度.当前时间锚点,'2026年9月7日清晨');
        x.change(stat=>stat.世界.后台.事件.第二夜={...RECORDS.事件,分类:'近期节点',时间:'圣杯战争第二夜',描述:'夜间冲突'});
        const semantic=JSON.parse((await e.buildRequest(e.snapshot())).input).时间线调度.需语义复核节点;
        assert.equal(semantic[0].名称,'第二夜');
    });
    await test('recent changes are current-run only and old finished events are compacted into history', async () => {
        const x=setup(async()=>JSON.stringify({summary:'本轮更新',patches:[add('/世界/后台/人物/卫兵',{...RECORDS.人物,所属世界:'测试世界',行动:'巡逻'})]}));
        x.change(s=>{
            s.世界.后台.最近变化=[{时间:'旧时间',类别:'事件',名称:'旧变化',操作:'更新',字段:'状态',内容:'旧记录'}];
            for(let i=0;i<205;i++)s.世界.后台.事件['旧事件'+i]={...RECORDS.事件,描述:'已经结束的旧事件'+i,时间:'2026年8月'+String(i%28+1)+'日',状态:'已完成',结果:'事件已经结束'};
            s.世界.后台.剧本.旧剧本={...RECORDS.剧本,描述:'旧版兼容数据',关联事件:['旧事件0']};
        });
        await x.engine.run();
        const state=x.get().世界.后台;
        assert.equal(state.最近变化.some(c=>c.名称==='旧变化'),false);
        assert.equal(state.最近变化.some(c=>c.名称==='卫兵'),true);
        assert.ok(Object.keys(state.事件).length<=180);
        assert.ok(Object.keys(state.历史).some(name=>name.startsWith('归档·旧事件')));
        assert.equal(state.事件.旧事件0,undefined);assert.deepEqual(state.剧本.旧剧本.关联事件,['旧事件0']);
    });
    await test('engine-owned and legacy paths from model replies are ignored instead of aborting the whole run', async () => {
        const x=setup(async()=>JSON.stringify({summary:'正常推进',patches:[
            add('/系统状态/待播报记录','不应由世界引擎写入'),
            add('/世界/后台/运行记录',[{时间:'伪造'}]),
            add('/世界/后台/剧本/旧节点',{描述:'旧模型误写'}),
            add('/世界/后台/人物/卫兵',{所属世界:'测试世界',行动:'继续巡逻'})
        ]}));
        assert.equal(await x.engine.run(),true);
        assert.equal(x.writes(),1);
        assert.equal(x.get().系统状态.待播报记录,undefined);
        assert.equal(x.get().世界.后台.运行记录.length,1);
        assert.equal(x.get().世界.后台.剧本.旧节点,undefined);
        assert.equal(x.get().世界.后台.人物.卫兵.公开动态,'');
    });
    await test('reply wrappers are accepted without repairing malformed JSON or unsafe writes', () => {
        assert.equal(parseReply('这是结果：\n'+JSON.stringify({summary:'正常',patches:[]})+'\n结束').summary,'正常');
        assert.throws(()=>parseReply('{"summary":"破损","patches":[}'),/无法解析/);
        const stat=fresh();stat.世界.后台.历史.事实={...RECORDS.历史};
        assert.throws(()=>applyPatches(stat,[add('/世界/后台/历史/事实',RECORDS.历史)]),/只允许新增/);
        assert.throws(()=>applyPatches(stat,[add('/世界/时间','明天')]),/禁止/);
    });
    await test('due events cannot be silently ignored; failed scheduling is atomic', async () => {
        const x=setup(async()=>JSON.stringify({summary:'无变化',patches:[]}));
        x.change(s=>s.世界.后台.事件.到期={...RECORDS.事件,时间:'2026年9月6日清晨'});
        await assert.rejects(()=>x.engine.run(),/到期事件未处理/);
        assert.equal(x.writes(),0);
        assert.equal(x.get().世界.后台.事件.到期.状态,'待发生');
    });
    await test('explicit old storyline imports as safe skeleton events without forcing same-run scheduling', async () => {
        const x=setup(async()=>JSON.stringify({summary:'先建立主线骨架',patches:[]}));
        x.change(s=>s.世界.因果轨道={故事线:'调查 → 封锁 → 援军',下一节点:'封锁',偏移记录:{}});
        const r=await x.engine.buildRequest(x.engine.snapshot());
        assert.deepEqual(r.manifest.导入节点,['封锁','援军']);
        assert.equal(JSON.parse(r.input).当前变量.世界.后台.事件.援军.前因[0],'封锁');
        assert.equal(await x.engine.run(),true);
        assert.equal(x.writes(),1);
        assert.equal(x.get().世界.后台.事件.封锁.状态,'待发生');
        assert.equal(x.get().世界.后台.事件.援军.状态,'待发生');
    });
    await test('recent changes carry actual story dates and readable entity names', async () => {
        const x=setup(async()=>JSON.stringify({summary:'卫兵开始调查',patches:[add('/世界/后台/人物/卫兵',{...RECORDS.人物,行动:'调查商路'})]}));
        await x.engine.run();const change=x.get().世界.后台.最近变化[0];
        assert.equal(change.名称,'卫兵');assert.equal(change.时间,'2026年9月7日清晨');assert.equal(change.内容,'调查商路');
    });
    await test('space and settlement block manual and auto execution; single-world next turn resumes', async () => {
        const x = setup(async () => '{"summary":"无变化","patches":[]}');
        x.change(s=>s.系统状态.是否在主神空间=true); assert.equal(await x.engine.run(),false);
        x.change(s=>{s.系统状态.是否在主神空间=false;s.设置.单一世界=true;});
        x.text('轮回清算协议'); assert.equal(await x.engine.run(),false);
        x.text('结算后继续调查'); assert.equal(await x.engine.run(),true);
    });
    await test('unrelated MVU changes during request are rebased instead of discarding world progress', async () => {
        let resolve,started;const ready=new Promise(r=>started=r);
        const x=setup(()=>{started();return new Promise(r=>resolve=r);});
        x.change(s=>s.角色={HP:10});
        const pending=x.engine.run();await ready;
        x.change(s=>s.角色.HP=9);
        resolve(JSON.stringify({summary:'世界继续推进',patches:[add('/世界/后台/事件/警报',{描述:'警报响起',状态:'进行中'})]}));
        assert.equal(await pending,true);
        assert.equal(x.get().角色.HP,9);
        assert.equal(x.get().世界.后台.事件.警报.状态,'进行中');
    });
    await test('late responses after chat switch, cancellation, world-time change, or settlement never commit', async () => {
        for (const kind of ['chat','cancel','world-time','settle']) {
            let resolve, started;
            const ready = new Promise(r=>started=r);
            const x = setup(() => {started();return new Promise(r=>resolve=r);});
            const pending = x.engine.run(); await ready;
            if (kind==='chat') x.chat();
            if (kind==='cancel') x.engine.cancel();
            if (kind==='world-time') x.change(s=>s.世界.时间='2026年9月8日');
            if (kind==='settle') x.change(s=>{s.系统状态.是否在主神空间=true;s.世界.后台={};});
            resolve('{"summary":"迟到","patches":[]}');
            await assert.rejects(pending); assert.equal(x.writes(),0);
        }
    });
    await test('saved prompt presets recover required structural segments without overwriting custom bodies', () => {
        const host={localStorage:{getItem:()=>JSON.stringify({preset:'自定义总则\n【世界推进】\n我的世界规则'}),setItem:()=>{}},Samsara:{}};
        const engine=new Engine(host);
        assert.match(engine.config.preset,/【世界推进】\n我的世界规则/);
        assert.match(engine.config.preset,/【世界演进准则】/);
        assert.match(engine.config.preset,/【因果轨道与偏移】/);
        assert.match(engine.config.preset,/【信息传播】/);
    });
    await test('world advance master switch enables extra API and only becomes effective when model API is ready', () => {
        let apiEnabled=false,enableCalls=0,disableCalls=0,saved='';
        const host={
            localStorage:{getItem:()=>null,setItem:(_,v)=>{saved=v;}},
            Samsara:{terminal:{
                apiReady:()=>apiEnabled,
                enableApi:()=>{enableCalls++;apiEnabled=true;},
                disableApi:()=>{disableCalls++;apiEnabled=false;}
            }}
        };
        const engine=new Engine(host);
        assert.equal(engine.isConfigured(),false);
        assert.equal(engine.isEnabled(),false);
        engine.setEnabled(true);
        assert.equal(enableCalls,1);
        assert.equal(engine.isConfigured(),true);
        assert.equal(engine.isEnabled(),true);
        assert.equal(JSON.parse(saved).enabled,true);
        engine.setEnabled(false);
        assert.equal(engine.isConfigured(),false);
        assert.equal(engine.isEnabled(),false);
        assert.equal(disableCalls,0);
        assert.equal(apiEnabled,true);
    });
    await test('persisted world advance re-enables extra API on startup but falls back until a model is ready', () => {
        let enableCalls=0;
        const host={localStorage:{getItem:()=>JSON.stringify({enabled:true}),setItem:()=>{}},Samsara:{terminal:{apiReady:()=>false,enableApi:()=>{enableCalls++;}}}};
        const engine=new Engine(host);
        assert.equal(engine.isConfigured(),true);
        assert.equal(engine.isEnabled(),false);
        assert.equal(enableCalls,1);
    });
    await test('status bar routes world button by master switch and exposes world advance setting', () => {
        const source=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
        assert.match(source,/data-toggle=["']world-engine["']/);
        assert.match(source,/engine\.isConfigured\(\)/);
        assert.match(source,/renderWorldTab\(sd\)/);
        assert.match(source,/case ['"]world['"]:[\s\S]{0,500}renderWorldTab\(sd\)/);
        assert.match(source,/enableApi:\s*function\s*\(/);
    });
    await test('terminal handoff restores saved state and close does not disable engine', () => {
        let restored;
        const host = {localStorage:{getItem:()=>null},Samsara:{terminal:{suspend:()=>({open:true,scroll:82}),restore:s=>restored=s}}};
        const engine = new Engine(host); engine.config.enabled=true;
        engine.createPanel=()=>{engine.panel={hidden:true};}; engine.render=()=>{};
        engine.open(); engine.open(); engine.close(); engine.close();
        assert.deepEqual(restored,{open:true,scroll:82}); assert.equal(engine.config.enabled,true);
    });
    await test('actual settlement function clears ordinary world only, keeps relationships and both clocks', () => {
        const html=fs.readFileSync(path.join(__dirname,'../Regular/结算任务美化.html'),'utf8');
        const snippet=html.slice(html.indexOf('function applySettlementFinalization('),html.indexOf('function writeSettlementToMvu('));
        const finalize = new Function(`const rawText='轮回清算协议'; const hasSettlementHeader=()=>true; const isFullSettlement=()=>true; const isTrialPassed=()=>false; const trialTasks=[]; const readReincarnatorTier=()=> 'Ⅰ'; const settlementBaselineTier='Ⅰ'; ${snippet}; return applySettlementFinalization;`)();
        for (const single of [false,true]) {
            const stat=fresh(); stat.设置.单一世界=single; stat.系统状态.游玩天数=12;
            stat.关系列表.旅伴={好感度:10}; stat.世界.后台.公开摘要='仍在推进';
            stat.任务.列表.结束={状态:'可结算'};
            const time=stat.世界.时间;
            finalize({stat_data:stat},true);
            assert.equal(stat.世界.时间,time); assert.equal(stat.系统状态.游玩天数,12);
            assert.equal(stat.关系列表.旅伴.好感度,10);
            assert.equal(stat.任务.列表.结束,undefined);
            if (single) {assert.equal(stat.世界.后台.公开摘要,'仍在推进'); assert.ok(stat.任务.列表.调查); assert.equal(stat.系统状态.是否在主神空间,false);}
            else {assert.deepEqual(stat.世界.后台,{});assert.equal(stat.系统状态.是否在主神空间,true);}
        }
        const historical=fresh(), before=clone(historical);
        finalize({stat_data:historical},false); assert.deepEqual(historical,before);
    });
    await test('auxiliary callback skips duration ticks for engine commit but processes subsequent prose', () => {
        const source=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');
        const snippet=source.slice(source.indexOf('function onUpdateData('),source.indexOf('// ===== 轻量路径工具'));
        const names=['guardTaskGenerationLock','guardPersistedSystemTaskOwner','guardProtectedFields','clampNativeNpcToWorldTier','recalcAllCharacters','checkTrialEligibility','updatePlayDays','autoHarvestAssets','cleanupZeroQuantityItems','processStatusDuration','cleanupDeadNPCs','calcWorldStability','processCombatAndCooldowns'];
        const calls={}; const stubs=Object.fromEntries(names.map(name=>[name,()=>{calls[name]=(calls[name]||0)+1;}]));
        const update=new Function('stubs',`let isProcessing=false,isInitLog=false;const {${names.join(',')}}=stubs;${snippet};return onUpdateData;`)(stubs);
        const stat=fresh();stat.角色={};stat.世界.后台.已处理楼层='commit-1';
        const after={stat_data:stat,__samsaraWorldCommit:'commit-1'};
        update(after,{stat_data:clone(stat)});
        assert.equal(calls.calcWorldStability,1);assert.equal(calls.processCombatAndCooldowns,undefined);assert.equal(calls.processStatusDuration,undefined);
        update(after,clone(after));
        assert.equal(calls.processCombatAndCooldowns,1);assert.equal(calls.processStatusDuration,1);
    });
    await test('worldbook templates compile including protected public projection', () => {
        for (const name of ['[variables]当前变量.txt','[mvu_update]变量更新规则.txt','⚙️额外思考.txt']) {
            const source=fs.readFileSync(path.join(__dirname,'../World Book',name),'utf8');
            let compiled='';
            for (const tag of source.matchAll(/<%([\s\S]*?)%>/g)) {
                const inner=tag[1].replace(/[_-]$/,'');
                compiled += /^[=-]/.test(inner) ? `void (${inner.slice(1)});\n` : inner.replace(/^_/, '')+'\n';
            }
            new vm.Script(compiled);
        }
    });
    await test('browser bootstrap can use lexical sandbox interfaces and release subscriptions', () => {
        let stopped=0;
        const host={document:{addEventListener:()=>{},removeEventListener:()=>{}},localStorage:{getItem:()=>null}};
        const root={parent:host,addEventListener:()=>{}};
        const sandbox={window:root,setTimeout,clearTimeout,AbortController,console,
            Mvu:{events:{VARIABLE_UPDATE_ENDED:'mvu'}},
            tavern_events:{CHAT_CHANGED:'chat',MESSAGE_SWIPED:'swipe',MESSAGE_DELETED:'delete'},
            eventOn:()=>({stop:()=>stopped++}), getChatMessages:()=>[],getCurrentChatId:()=> 'sandbox',
            getCharWorldbookNames:()=>({primary:'book'}),getWorldbook:()=>[]};
        vm.runInNewContext(source,sandbox);
        assert.equal(host.Samsara.worldEngine.fn('getCurrentChatId')(),'sandbox');
        host.Samsara.worldEngine.dispose(); assert.equal(stopped,4);
    });
    await test('current-variable projection removes private plans and suppresses space digest', () => {
        const source=fs.readFileSync(path.join(__dirname,'../World Book/[variables]当前变量.txt'),'utf8');
        const start=source.indexOf('if (current.世界) {',source.indexOf('// 后台完整状态'));
        const end=source.indexOf('// 世界超稳模式:',start);
        const render=new Function('current','data','readonly','_',source.slice(start,end));
        const lodash={get:(v,p,d)=>p.split('.').reduce((a,k)=>a?.[k],v)??d};
        const stat=fresh();stat.世界.后台.公开摘要='城门戒严';stat.世界.后台.事件.秘密={结果:'隐藏真相'};
        for (const space of [false,true]) {
            stat.系统状态.是否在主神空间=space;
            const current={世界:clone(stat.世界)},readonly={世界:{}};
            render(current,stat,readonly,lodash);
            assert.equal(current.世界.后台,undefined);
            assert.equal(readonly.世界.后台公开动态,space?undefined:'城门戒严');
            assert.equal(JSON.stringify([current,readonly]).includes('隐藏真相'),false);
        }
    });
    await test('updated JS and embedded settlement scripts compile', () => {
        new vm.Script(source);
        new vm.Script(fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8'));
        const html=fs.readFileSync(path.join(__dirname,'../Regular/结算任务美化.html'),'utf8');
        for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
        const zod=fs.readFileSync(path.join(__dirname,'../script/ZOD脚本.js'),'utf8').replace(/^import .*;$/m,'').replace('export const Schema','const Schema');
        new vm.Script(zod);
    });
    console.log(`${tests} tests passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
