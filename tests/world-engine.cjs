const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../script/世界推进系统.js');
const source = fs.readFileSync(file, 'utf8');
const {SamsaraWorldEngine: Engine, applyPatches, emptyState, RECORDS, parseReply, compileWorldResult, WORLD_RESULT_SCHEMA, projectWorldContext, compactWorldLifecycle, calendarDate, repairExplorationGranularity, sortWorldEvents, eventScheduleLabel, staleActiveEvents, temporalAnomalies} = require(file);
const clone = x => JSON.parse(JSON.stringify(x));
const fresh = () => ({世界:{名称:'测试世界',时间:'2026年9月7日清晨',地点:'测试地点',后台:emptyState(),势力:{},探索:{},因果轨道:{偏移记录:{}}},系统状态:{是否在主神空间:false},设置:{},任务:{列表:{调查:{状态:'进行中'}},副本成就:{发现:{状态:'未达成'}}},关系列表:{},传闻:{}});
const add = (path,value) => ({op:'add',path,value});
let tests = 0;
async function test(name, fn) { await fn(); tests++; console.log('PASS '+name); }
(async () => {
    await test('calendar uses 2026 when an era year is unreadable but month and day are available', () => {
        assert.deepEqual(calendarDate('大业十三年-08月-12日-午时四刻'),{y:2026,m:8,d:12,key:'2026-8-12',fallbackYear:true,customCalendar:false});
        assert.deepEqual(calendarDate('08月12日-午时'),{y:2026,m:8,d:12,key:'2026-8-12',fallbackYear:true});
        assert.deepEqual(calendarDate('斗罗历2634年-03月-15日-上午'),{y:2634,m:3,d:15,key:'2634-3-15',fallbackYear:false,customCalendar:false});
        assert.deepEqual(calendarDate('2026-09-08'),{y:2026,m:9,d:8,key:'2026-9-8',fallbackYear:false,customCalendar:false});
        assert.equal(calendarDate('近期'),null);
        assert.equal(calendarDate('大业十三年-02月-30日'),null);
    });
    await test('world event ordering follows causal macro order when dates are unavailable', () => {
        const records={
            '终局节点':{...RECORDS.事件,描述:'终局',分类:'宏观节点',状态:'待发生',时间:''},
            '起始节点':{...RECORDS.事件,描述:'起始',分类:'宏观节点',状态:'待发生',时间:''},
            '中间节点':{...RECORDS.事件,描述:'中间',分类:'宏观节点',状态:'待发生',时间:''}
        };
        const sorted=sortWorldEvents(records,{故事线:'起始节点 -> 中间节点 -> 终局节点'});
        assert.deepEqual(sorted.map(([name])=>name),['起始节点','中间节点','终局节点']);
    });
    await test('event schedule labels never surface bare vague time tokens', () => {
        assert.equal(eventScheduleLabel({时间:'2010年-04月-13日-下午'}),'2010年-04月-13日-下午');
        assert.equal(eventScheduleLabel({时间:'近期',条件:'主角团离开校园'}),'条件触发 · 主角团离开校园');
        assert.equal(eventScheduleLabel({时间:'',前因:['校舍突围战']}),'前置节点后 · 校舍突围战');
        assert.equal(eventScheduleLabel({时间:'',条件:''}),'时间待补');
    });
    await test('world lifecycle archives stale finished events and expires propagation without touching active references', () => {
        const stat=fresh();
        stat.世界.时间='2026年9月8日晚上';
        stat.世界.后台.事件={
            '旧战斗':{...RECORDS.事件,描述:'旧战斗已经结束',时间:'2026年9月7日清晨',状态:'已完成',分类:'近期节点'},
            '刚结束':{...RECORDS.事件,描述:'刚刚结束',时间:'2026年9月8日晚上',状态:'已完成',分类:'当前事件'},
            '关键前因':{...RECORDS.事件,描述:'仍被后续事件引用',时间:'2026年9月7日清晨',状态:'已完成',分类:'宏观节点'},
            '后续行动':{...RECORDS.事件,描述:'仍在推进',时间:'2026年9月8日晚上',状态:'进行中',分类:'近期节点',前因:['关键前因']}
        };
        stat.世界.后台.传播={
            '过期广播':{...RECORDS.传播,关联事件:['旧战斗'],内容:'旧广播',状态:'传播中',到期时间:'2026年9月8日上午'},
            '明确结束':{...RECORDS.传播,内容:'已经失效',状态:'已结束'},
            '仍在传播':{...RECORDS.传播,内容:'仍有效',状态:'传播中',到期时间:'2026年9月9日上午'}
        };
        const report=compactWorldLifecycle(stat);
        assert.equal(stat.世界.后台.事件['旧战斗'],undefined);
        assert.ok(stat.世界.后台.历史['归档·旧战斗']);
        assert.ok(stat.世界.后台.事件['刚结束']);
        assert.ok(stat.世界.后台.事件['关键前因']);
        assert.ok(stat.世界.后台.事件['后续行动']);
        assert.equal(stat.世界.后台.传播['过期广播'],undefined);
        assert.equal(stat.世界.后台.传播['明确结束'],undefined);
        assert.ok(stat.世界.后台.传播['仍在传播']);
        assert.deepEqual(report.归档事件,['旧战斗']);
        assert.deepEqual(report.回收传播,['过期广播','明确结束']);
    });
    await test('stale active local events are surfaced for mandatory lifecycle review', () => {
        const stat=fresh();
        stat.世界.时间='斗罗历2643年-12月-20日-酉时二刻';
        stat.世界.后台.事件={
            '九年前巡逻':{...RECORDS.事件,描述:'旧巡逻',时间:'斗罗历2634年-03月-18日-上午',状态:'进行中',分类:'当前事件'},
            '八年前追踪':{...RECORDS.事件,描述:'旧追踪',时间:'斗罗历2635年-03月-16日-下午',状态:'进行中',分类:'当前事件'},
            '今日封锁':{...RECORDS.事件,描述:'今日封锁',时间:'斗罗历2643年-12月-20日-上午',状态:'进行中',分类:'当前事件'}
        };
        assert.deepEqual(staleActiveEvents(stat).map(x=>x.名称),['九年前巡逻','八年前追踪']);
    });
    await test('old finished events detach soft person links and archive instead of staying hot forever', () => {
        const stat=fresh();
        stat.世界.时间='2026年10月20日上午';
        stat.世界.后台.事件.旧调查={...RECORDS.事件,描述:'旧调查已结束',时间:'2026年9月1日上午',状态:'已完成',分类:'近期节点'};
        stat.世界.后台.人物.卫兵={...RECORDS.人物,所属世界:'测试世界',行动:'值勤',关联事件:['旧调查']};
        const report=compactWorldLifecycle(stat);
        assert.equal(stat.世界.后台.事件.旧调查,undefined);
        assert.deepEqual(stat.世界.后台.人物.卫兵.关联事件,[]);
        assert.ok(stat.世界.后台.历史['归档·旧调查']);
        assert.ok(report.归档事件.includes('旧调查'));
    });
    await test('temporal anomaly scanner catches completed events and backend updates written beyond world time', () => {
        const stat=fresh();
        stat.世界.时间='斗罗历2643年-12月-20日-酉时二刻';
        stat.世界.后台.事件.未来完成={...RECORDS.事件,描述:'不应提前完成',时间:'斗罗历2644年-01月-01日',状态:'已完成',分类:'近期节点'};
        stat.世界.后台.人物.未来人物={...RECORDS.人物,所属世界:'测试世界',行动:'未来动作',更新时间:'斗罗历2644年-12月-20日'};
        const list=temporalAnomalies(stat);
        assert.ok(list.some(x=>x.类型==='事件'&&x.名称==='未来完成'));
        assert.ok(list.some(x=>x.类型==='人物'&&x.名称==='未来人物'));
    });
    await test('world context exposes only hot history and recent causal offsets while preserving the full MVU ledger', () => {
        const stat=fresh();
        stat.世界.稳定=73;
        stat.世界.后台.历史={};
        for(let i=0;i<40;i++)stat.世界.后台.历史['历史'+i]={时间:'2026年9月'+String(i+1)+'日',事实:'事实'+i,关联事件:[]};
        stat.世界.因果轨道={当前阶段:'当前阶段',故事线:'A -> B -> C',下一节点:'B',偏移记录:{}};
        for(let i=0;i<12;i++)stat.世界.因果轨道.偏移记录['偏移'+i]={描述:'偏移描述'+i,引发者:'角色'+i,影响程度:i%2===0?-2:1};
        const before=clone(stat.世界.因果轨道.偏移记录);
        const ctx=projectWorldContext(stat);
        const historyKeys=Object.keys(ctx.世界.后台.历史);
        const offsetKeys=Object.keys(ctx.世界.因果轨道.偏移记录);
        assert.equal(historyKeys.length,24);
        assert.equal(historyKeys[0],'历史16');
        assert.equal(historyKeys.at(-1),'历史39');
        assert.deepEqual(offsetKeys,['偏移4','偏移5','偏移6','偏移7','偏移8','偏移9','偏移10','偏移11']);
        assert.deepEqual(ctx.世界.因果轨道.偏移摘要,{记录总数:12,隐藏旧记录数:4,累计影响:-6,当前稳定:73});
        assert.deepEqual(stat.世界.因果轨道.偏移记录,before);
    });
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

    await test('event structure self-heals legacy categories and obvious local macro inflation', async () => {
        const x=setup(async()=>JSON.stringify({summary:'结构修复',patches:[]}));
        x.change(s=>{
            s.世界.后台.事件={
                '校园突围与校车集结':{...RECORDS.事件,分类:'宏观节点',描述:'幸存者集结并夺取校车逃离校园。',地点:'藤美学园-正门',状态:'待发生',时间:'2026年9月7日中午'},
                '床主大桥封锁线':{...RECORDS.事件,分类:'宏观节点',描述:'幸存者抵达床主大桥并寻找绕行路线。',地点:'床主大桥',状态:'待发生',时间:'2026年9月7日下午'},
                '高城家据点保卫战':{...RECORDS.事件,分类:'宏观节点',描述:'主要庇护据点遭大规模尸潮围攻并改变后续生存阶段。',地点:'高城宅邸',状态:'待发生',时间:'2026年9月8日'},
                '天台门扉突破':{...RECORDS.事件,分类:'近期事件',描述:'天台入口铁门被撞开。',地点:'主教学楼-天台入口',状态:'进行中',时间:'2026年9月7日上午'},
                '医务室劫掠危机':{...RECORDS.事件,分类:'近期事件',描述:'张彪·狂暴分支正冲向医务室。',地点:'主教学楼-二楼-医务室',状态:'进行中',时间:'2026年9月7日上午'}
            };
            s.世界.后台.人物['张彪·狂暴分支']={...RECORDS.人物,所属世界:'测试世界',行动:'冲向医务室'};
        });
        assert.equal(await x.engine.run(),true);
        const events=x.get().世界.后台.事件;
        assert.equal(events['校园突围与校车集结'].分类,'近期节点');
        assert.equal(events['床主大桥封锁线'].分类,'近期节点');
        assert.equal(events['高城家据点保卫战'].分类,'宏观节点');
        assert.equal(events['天台门扉突破'].分类,'当前事件');
        assert.equal(events['医务室劫掠危机'].分类,'当前事件');
        assert.deepEqual(x.get().世界.后台.人物['张彪·狂暴分支'].关联事件,['医务室劫掠危机']);
    });
    await test('macro acceptance demotes obvious local actions before counting backbone nodes', async () => {
        let calls=0;
        const x=setup(async()=>{
            calls++;
            if(calls===1)return JSON.stringify({summary:'局部事件冒充宏观',patches:[
                add('/世界/后台/事件/校园突围与校车集结',{描述:'夺取校车离开校园',地点:'藤美学园-正门',分类:'宏观节点',状态:'待发生',时间:'2026年9月7日中午'}),
                add('/世界/后台/事件/床主大桥封锁线',{描述:'抵达大桥并寻找绕路',地点:'床主大桥',分类:'宏观节点',状态:'待发生',时间:'2026年9月7日下午'}),
                add('/世界/后台/事件/医务室会合',{描述:'在医务室完成会合',地点:'主教学楼-医务室',分类:'宏观节点',状态:'待发生',时间:'2026年9月7日下午'})
            ]});
            return JSON.stringify({summary:'真正宏观骨架',patches:[
                add('/世界/后台/事件/高城据点阶段',{描述:'主要庇护据点建立并改变幸存者生存阶段',地点:'床主市',分类:'宏观节点',状态:'待发生',时间:'2026年9月8日'}),
                add('/世界/后台/事件/战略级基础设施失效',{描述:'更大范围战略级灾难导致通讯和电子基础设施失效',地点:'全国范围',分类:'宏观节点',状态:'待发生',时间:'爆发后数日'}),
                add('/世界/后台/事件/社会秩序长期崩溃',{描述:'地区社会秩序进入长期崩溃和流亡阶段',地点:'关东地区',分类:'宏观节点',状态:'待发生',时间:'爆发后一周内'})
            ]});
        });
        x.engine.config.requireMacroBackbone=true;x.engine.config.retryAttempts=2;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,2);
        assert.match(x.engine.lastRetryLog[0].错误,/宏观事件不足/);
        const events=x.get().世界.后台.事件;
        assert.equal(events['校园突围与校车集结'],undefined);
        assert.equal(Object.values(events).filter(e=>e.分类==='宏观节点'&&e.状态==='待发生').length,3);
    });
    await test('valid macro storyline still repairs a stale next-node pointer', async () => {
        const x=setup(async()=>JSON.stringify({summary:'同步下一宏观',patches:[]}));
        x.change(s=>{
            s.世界.后台.事件={
                A:{...RECORDS.事件,分类:'宏观节点',描述:'阶段A',状态:'待发生',时间:'2026年9月8日'},
                B:{...RECORDS.事件,分类:'宏观节点',描述:'阶段B',状态:'待发生',时间:'2026年9月10日'},
                C:{...RECORDS.事件,分类:'宏观节点',描述:'阶段C',状态:'待发生',时间:'2026年9月14日'}
            };
            s.世界.因果轨道={当前阶段:'危机中',故事线:'A -> B -> C',下一节点:'C',偏移记录:{}};
        });
        assert.equal(await x.engine.run(),true);
        assert.equal(x.get().世界.因果轨道.下一节点,'A');
    });
    await test('macro storyline deterministically links empty macro predecessors', async () => {
        const x=setup(async()=>JSON.stringify({summary:'宏观链',patches:[]}));
        x.change(s=>{
            s.世界.后台.事件={
                A:{...RECORDS.事件,分类:'宏观节点',描述:'地区阶段A',状态:'待发生',时间:'2026年9月8日'},
                B:{...RECORDS.事件,分类:'宏观节点',描述:'地区阶段B',状态:'待发生',时间:'2026年9月10日'},
                C:{...RECORDS.事件,分类:'宏观节点',描述:'地区阶段C',状态:'待发生',时间:'2026年9月14日'}
            };
            s.世界.因果轨道={当前阶段:'',故事线:'A -> B -> C',下一节点:'A',偏移记录:{}};
        });
        assert.equal(await x.engine.run(),true);
        assert.deepEqual(x.get().世界.后台.事件.B.前因,['A']);
        assert.deepEqual(x.get().世界.后台.事件.C.前因,['B']);
    });
    await test('causal projection is rebuilt only from macro events, never from current-scene details', async () => {
        const x=setup(async()=>JSON.stringify({summary:'同步宏观轨道',patches:[]}));
        x.change(s=>{
            s.世界.因果轨道={当前阶段:'死体危机爆发',故事线:'藤美学园陷落',下一节点:'城市撤离',偏移记录:{}};
            s.世界.后台.事件={
                '校医室混乱':{...RECORDS.事件,分类:'当前事件',描述:'眼前混乱',状态:'进行中',时间:'2026年9月7日上午'},
                '夺取校巴':{...RECORDS.事件,分类:'近期节点',描述:'局部撤离动作',状态:'待发生',时间:'2026年9月7日中午'},
                '城市撤离':{...RECORDS.事件,分类:'宏观节点',描述:'主角团离开当前城市核心区',状态:'待发生',时间:'2026年9月8日'},
                '战略级灾难':{...RECORDS.事件,分类:'宏观节点',描述:'世界级基础设施失效',状态:'待发生',时间:'2026年9月10日'},
                '秩序全面崩溃':{...RECORDS.事件,分类:'宏观节点',描述:'社会秩序进入下一阶段',状态:'待发生',时间:'2026年9月14日'}
            };
        });
        assert.equal(await x.engine.run(),true);
        const orbit=x.get().世界.因果轨道;
        assert.match(orbit.故事线,/城市撤离.*战略级灾难.*秩序全面崩溃/);
        assert.doesNotMatch(orbit.故事线,/校医室混乱|夺取校巴/);
        assert.equal(orbit.下一节点,'城市撤离');
    });
    await test('world stable mode, both clocks, awards and achievement rollback protected', () => {
        const stat = fresh(); stat.设置.世界超稳 = true; stat.任务.副本成就.发现.状态 = '已达成';
        for (const p of ['/世界/时间','/系统状态/游玩天数','/任务/列表/调查/奖励','/世界/因果轨道/偏移记录/偏移']) assert.throws(() => applyPatches(stat,[add(p,1)]),/禁止/);
        assert.throws(() => applyPatches(stat,[{op:'replace',path:'/任务/副本成就/发现/状态',value:'未达成'}]),/回退/);
    });
    await test('task-world intelligence trades cannot be newly priced in space coins', () => {
        const stat=fresh();
        assert.throws(()=>applyPatches(stat,[add('/传闻/情报交易/异端动向',{卖家:'匿名商人',情报评级:'D',摘要:'异常者踪迹',要价:'500空间币',真实内幕:'目标位于二楼'})]),/本地货币/);
        stat.系统状态.是否在主神空间=true;stat.世界.名称='主神空间';
        const next=applyPatches(stat,[add('/传闻/情报交易/异端动向',{卖家:'终端',情报评级:'D',摘要:'异常者踪迹',要价:'500空间币',真实内幕:'目标位于二楼'})]);
        assert.equal(next.传闻.情报交易.异端动向.要价,'500空间币');
    });
    await test('numeric and enum validation cannot be silently clamped', () => {
        assert.throws(() => applyPatches(fresh(),[add('/世界/势力/商会',{实力:'F',领地:'城',描述:'商会',声望:1001})]),/1000/);
        assert.throws(() => applyPatches(fresh(),[add('/世界/探索/遗迹',{风险:'F',探索度:101,描述:'遗迹',隐藏真相:''})]),/探索品质或进度越界：遗迹.*探索度=101/);
        assert.throws(() => applyPatches(fresh(),[add('/世界/探索/遗迹',{风险:'Ⅲ',探索度:30,描述:'遗迹',隐藏真相:''})]),/风险=Ⅲ.*只允许 F\/E\/D\/C\/B\/A\/S\/SS\/SSS/);
        assert.throws(() => applyPatches(fresh(),[{op:'replace',path:'/任务/列表/调查/状态',value:'已发奖'}]),/任务状态/);
        assert.equal(parseReply('<world_update>{"summary":"无变化","patches":[]}</world_update>').patches.length,0);
    });
    await test('new exploration and faction WorldResult records get valid settlement defaults when optional quality is omitted', () => {
        const stat=fresh();
        const compiled=compileWorldResult(stat,{
            摘要:'建立结算台账',
            探索:[{名称:'古代遗迹',探索度:30,描述:'已确认外围结构'}],
            势力:[{名称:'港口商会',领地:'港区',描述:'控制主要仓储',声望:500}]
        });
        const next=applyPatches(stat,compiled.patches);
        assert.equal(next.世界.探索.古代遗迹.风险,'F');
        assert.equal(next.世界.探索.古代遗迹.探索度,30);
        assert.equal(next.世界.势力.港口商会.实力,'F');
        assert.equal(next.世界.势力.港口商会.声望,500);
    });
    function setup(request, validateWorldState=clone) {
        let stat = fresh(), text = '玩家调查了城门。', chat = 'chat-1', toasts = [];
        const host = {localStorage:{getItem:()=>null,setItem:()=>{}},toastr:{error:(message,title)=>toasts.push({message:String(message),title:String(title||'')})},Samsara:{validateWorldState,terminal:{apiReady:()=>true,request}},getCurrentChatId:()=>chat,getChatMessages:()=>[{message_id:3,message:text,role:'assistant'}]};
        let writes = 0;
        host.Mvu = {getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async data => {writes++; stat = clone(data.stat_data);}};
        const engine = new Engine(host); engine.config.enabled = true; engine.config.requireMacroBackbone = false; engine.config.retryAttempts = 0; engine.worldbook = async () => [];
        return {engine,host,get:()=>stat,writes:()=>writes,toasts:()=>clone(toasts),change:fn=>fn(stat),chat:()=>{chat='chat-2';},text:v=>{text=v;}};
    }
    await test('numeric world time capacity uses real cross-month calendar distance', async () => {
        const x=setup(async()=>JSON.stringify({摘要:'无变化'}));
        x.change(s=>{s.世界.时间='2026年3月1日上午';s.世界.后台.已处理时间='2026年2月28日上午';});
        const request=await x.engine.buildRequest(x.engine.snapshot());
        assert.equal(JSON.parse(request.input).本轮时间容量.小时,24);
    });
    await test('final world-engine failure surfaces through Tavern toastr without writing MVU', async () => {
        const x=setup(async()=>{throw new Error('HTTP 400: invalid argument');});
        await assert.rejects(()=>x.engine.run(),/HTTP 400/);
        assert.equal(x.writes(),0);
        assert.equal(x.toasts().length,1);
        assert.equal(x.toasts()[0].title,'世界推进失败');
        assert.match(x.toasts()[0].message,/HTTP 400: invalid argument/);
    });
    await test('legacy model replies cannot mutate tasks and old event task links stay out of projected context', async () => {
        const x=setup(async()=>JSON.stringify({summary:'兼容回复',patches:[{op:'replace',path:'/任务/列表/调查/状态',value:'失败'}]}));
        assert.equal(await x.engine.run(),true);
        assert.equal(x.get().任务.列表.调查.状态,'进行中');
        const stat=fresh();
        stat.世界.后台.事件.事件={...RECORDS.事件,关联任务:['秘密任务名称']};
        assert.equal(projectWorldContext(stat).世界.后台.事件.事件.关联任务,undefined);
        assert.deepEqual(stat.世界.后台.事件.事件.关联任务,['秘密任务名称']);
        assert.equal(JSON.stringify(WORLD_RESULT_SCHEMA).includes('关联任务'),false);
    });
    await test('WorldResult same-run event causes resolve when both events are submitted together', () => {
        const stat=fresh();
        const compiled=compileWorldResult(stat,{
            摘要:'同轮因果',
            事件:[
                {名称:'天台入口攻防',描述:'铁门受冲击',前因:['病毒向高层蔓延'],状态:'进行中',分类:'当前事件',时间:'2026年9月7日上午'},
                {名称:'病毒向高层蔓延',描述:'死体向高层扩散',前因:['藤美学园爆发'],状态:'已完成',分类:'近期节点',时间:'2026年9月7日上午'},
                {名称:'藤美学园爆发',描述:'校园爆发',状态:'进行中',分类:'宏观节点',时间:'2026年9月7日上午'}
            ]
        });
        const next=applyPatches(stat,compiled.patches);
        assert.deepEqual(next.世界.后台.事件.天台入口攻防.前因,['病毒向高层蔓延']);
        assert.ok(next.世界.后台.事件.病毒向高层蔓延);
    });
    await test('exploration reward ledger rejects micro locations and self-heals old child-area records', () => {
        const stat=fresh();
        assert.throws(()=>compileWorldResult(stat,{
            摘要:'错误探索粒度',
            探索:[{名称:'藤美学园-天台',风险:'F',探索度:20,描述:'视野开阔',隐藏真相:''}]
        }),/探索粒度过细.*藤美学园-天台/);
        stat.世界.探索={
            '藤美学园':{风险:'F',探索度:10,描述:'已进入校园',隐藏真相:''},
            '藤美学园-天台':{风险:'F',探索度:20,描述:'视野开阔',隐藏真相:''}
        };
        const repairs=repairExplorationGranularity(stat);
        assert.equal(stat.世界.探索['藤美学园-天台'],undefined);
        assert.equal(stat.世界.探索.藤美学园.探索度,20);
        assert.ok(repairs.some(p=>p.op==='remove'&&p.path==='/世界/探索/藤美学园-天台'));
    });
    await test('WorldResult can update world currency economy fields without touching player balances', () => {
        const stat=fresh();
        stat.世界.货币={体系:'银冠',购买力基准:'普通餐食约3银冠',经济波动:'价格平稳'};
        stat.角色={空间币:999};
        const compiled=compileWorldResult(stat,{
            摘要:'市场变化',
            货币:{经济波动:'北门封锁后粮价明显上涨',购买力基准:'普通餐食约5银冠',玩家余额:'不应接受'}
        });
        assert.ok(WORLD_RESULT_SCHEMA.properties.货币);
        assert.deepEqual(compiled.result.货币,{购买力基准:'普通餐食约5银冠',经济波动:'北门封锁后粮价明显上涨'});
        assert.deepEqual(compiled.patches.map(p=>p.path),['/世界/货币/购买力基准','/世界/货币/经济波动']);
        const next=applyPatches(stat,compiled.patches);
        assert.equal(next.世界.货币.体系,'银冠');
        assert.equal(next.世界.货币.购买力基准,'普通餐食约5银冠');
        assert.equal(next.世界.货币.经济波动,'北门封锁后粮价明显上涨');
        assert.equal(next.角色.空间币,999);
    });
    await test('world calendar metadata is structured and ZOD normalizes day overflow by month length', () => {
        assert.equal(WORLD_RESULT_SCHEMA.properties.历法.type,'object');
        const stat=fresh();
        stat.世界.历法={名称:'测试历',月份天数:[31,28,31],闰年规则:''};
        const compiled=compileWorldResult(stat,{摘要:'历法确认',历法:{名称:'测试历',月份天数:[31,28,31],闰年规则:'无闰月'}});
        assert.ok(compiled.patches.some(p=>p.path==='/世界/历法/闰年规则'&&p.value==='无闰月'));
        const zod=fs.readFileSync(path.join(__dirname,'../script/ZOD脚本.js'),'utf8');
        const start=zod.indexOf('function normalizeWorldTimeByCalendar');
        const end=zod.indexOf('// ==========================================',start);
        assert.ok(start>=0&&end>start);
        const normalize=new Function(zod.slice(start,end)+'; return normalizeWorldTimeByCalendar;')();
        assert.equal(normalize('大业十三年-02月-31日-下午',{月份天数:[31,28,31]}),'大业十三年-03月-03日-下午');
        assert.equal(normalize('2024年-02月-29日-下午',{月份天数:[]}), '2024年-02月-29日-下午');
        assert.equal(normalize('2026年-02月-31日-下午',{月份天数:[]}), '2026年-03月-03日-下午');
        assert.equal(normalize('大业十三年-02月-31日-下午',{月份天数:[]}), '大业十三年-02月-31日-下午','未知作品历法不能借2026规则擅自改日期');
    });
    await test('street rumors normalize classification, dedupe duplicates, and cap at three', () => {
        const stat=fresh();
        const compiled=compileWorldResult(stat,{
            摘要:'传闻兼容',
            传闻:{街头巷议:[
                {名称:'校门惨剧',来源:'学生',内容:'校门发生咬人事件',分类:'事实'},
                {名称:'疯病传闻',来源:'手机简讯',内容:'被咬就会发疯',分类:'猜测'},
                {名称:'操场巨响',来源:'操场幸存者',内容:'操场有车被掀翻',分类:'事实'},
                {名称:'操场异动',来源:'操场幸存者',内容:'操场有车被掀翻',分类:'事实'},
                {名称:'超人出没',来源:'目击学生',内容:'有人像忍者一样移动',分类:'谣言'}
            ]}
        });
        const rumorPatches=compiled.patches.filter(p=>p.path.startsWith('/传闻/街头巷议/'));
        assert.equal(rumorPatches.length,3);
        assert.deepEqual(rumorPatches.map(p=>p.value.可信度),['或许可信','可疑','或许可信']);
        const next=applyPatches(stat,compiled.patches);
        assert.equal(Object.keys(next.传闻.街头巷议).length,3);
    });
    await test('a new manual world run clears previous inspection results but keeps retry accumulation within the run', async () => {
        let calls=0,enteredSecond,releaseSecond;
        const secondEntered=new Promise(resolve=>{enteredSecond=resolve;});
        const secondReply=new Promise(resolve=>{releaseSecond=resolve;});
        const x=setup(async ()=>{
            calls++;
            if(calls===1)return JSON.stringify({摘要:'第一轮',人物:[{名称:'卫兵',行动:'第一轮巡查'}]});
            enteredSecond();
            return secondReply;
        });
        assert.equal(await x.engine.run(),true);
        assert.equal(x.engine.lastWorldResult.摘要,'第一轮');
        assert.ok(x.engine.lastCompiledPatches.length>0);
        x.text('玩家继续向城内移动。');
        const running=x.engine.run();
        await secondEntered;
        assert.equal(x.engine.lastWorldResult,null);
        assert.deepEqual(x.engine.lastCompiledPatches,[]);
        assert.deepEqual(x.engine.lastCompileWarnings,[]);
        assert.equal(x.engine.lastReply,'');
        releaseSecond(JSON.stringify({摘要:'第二轮'}));
        assert.equal(await running,true);
        assert.equal(x.engine.lastWorldResult.摘要,'第二轮');
    });
    await test('WorldResult normalizes partial object-detail arrays instead of rejecting the whole run', () => {
        const stat=fresh();
        const compiled=compileWorldResult(stat,{
            摘要:'地区资源简写',
            势力地区:[{
                名称:'藤美学园',
                资源:['极度匮乏（医疗物资、淡水、载具）'],
                近期变化:['走廊布满血迹']
            }]
        });
        const patch=compiled.patches.find(p=>p.path==='/世界/后台/势力地区/藤美学园');
        assert.ok(patch);
        assert.deepEqual(patch.value.资源,[{名称:'极度匮乏（医疗物资、淡水、载具）',数量:'',用途:'',限制:''}]);
        assert.deepEqual(patch.value.近期变化,[{时间:'',事实:'走廊布满血迹',关联事件:''}]);
        const next=applyPatches(stat,compiled.patches);
        assert.equal(next.世界.后台.势力地区.藤美学园.资源[0].名称,'极度匮乏（医疗物资、淡水、载具）');
    });
    await test('WorldResult ignores task and achievement mutations while preserving relationship updates', () => {
        const stat=fresh();
        stat.关系列表.卫兵={好感度:0};
        const parsed=parseReply(JSON.stringify({
            摘要:'职责隔离',
            任务状态:{调查:'失败'},
            成就状态:{发现:'已达成'},
            关系:{卫兵:5}
        }));
        assert.equal(Object.hasOwn(parsed.worldResult,'任务状态'),false);
        assert.equal(Object.hasOwn(parsed.worldResult,'成就状态'),false);
        assert.deepEqual(parsed.worldResult.关系,[{名称:'卫兵',操作:'更新',好感度:5}]);
        const compiled=compileWorldResult(stat,parsed.worldResult);
        const next=applyPatches(stat,compiled.patches);
        assert.equal(next.任务.列表.调查.状态,'进行中');
        assert.equal(next.任务.副本成就.发现.状态,'未达成');
        assert.equal(next.关系列表.卫兵.好感度,5);
    });
    await test('new active and pending events require a concrete or causal time anchor', () => {
        assert.throws(()=>compileWorldResult(fresh(),{
            摘要:'模糊时间',
            事件:[{名称:'远期节点',描述:'阶段变化',分类:'宏观节点',状态:'待发生',时间:'近期'}]
        }),/事件时间锚点/);
        assert.throws(()=>compileWorldResult(fresh(),{
            摘要:'空时间',
            事件:[{名称:'当前危机',描述:'危机正在发生',分类:'当前事件',状态:'进行中'}]
        }),/事件时间锚点/);
        assert.doesNotThrow(()=>compileWorldResult(fresh(),{
            摘要:'因果时间',
            事件:[{名称:'远期节点',描述:'阶段变化',分类:'宏观节点',状态:'待发生',时间:'前置节点完成后当日傍晚'}]
        }));
    });
    await test('current stage is the single persisted world-movement description', () => {
        const stat=fresh();
        stat.世界.因果轨道.当前阶段='旧阶段短标签';
        const compiled=compileWorldResult(stat,{
            摘要:'世界推进',
            因果:{当前阶段:'北门进入全面戒严，守备队已开始逐人核验通行身份。'}
        });
        const next=applyPatches(stat,compiled.patches);
        assert.equal(next.世界.因果轨道.当前阶段,'北门进入全面戒严，守备队已开始逐人核验通行身份。');
        assert.equal(Object.hasOwn(next.世界.后台,'公开摘要'),false);
        assert.equal(Object.hasOwn(next.世界.后台,'正文承接'),false);
    });
    await test('legacy public summary migrates once into causal current stage and legacy handoff is removed', () => {
        const stat=fresh();
        stat.世界.因果轨道.当前阶段='爆发初期';
        stat.世界.后台.公开摘要='死体病毒已经席卷藤美学园，校园秩序全面崩溃。';
        stat.世界.后台.正文承接=[{来源:'旧结构',触达方式:'旧结构',可见事实:'旧结构',当前场景影响:'旧结构'}];
        const next=applyPatches(stat,[]);
        assert.equal(next.世界.因果轨道.当前阶段,'死体病毒已经席卷藤美学园，校园秩序全面崩溃。');
        assert.equal(Object.hasOwn(next.世界.后台,'公开摘要'),false);
        assert.equal(Object.hasOwn(next.世界.后台,'正文承接'),false);
    });
    await test('new writes cannot mark events or backend updates in the future as already-real facts', () => {
        const stat=fresh();stat.世界.时间='斗罗历2643年-12月-20日-酉时二刻';
        assert.throws(()=>applyPatches(stat,[add('/世界/后台/事件/未来完成',{...RECORDS.事件,描述:'未来完成',时间:'斗罗历2644年-01月-01日',状态:'已完成',分类:'近期节点'})]),/超过当前世界时间/);
        assert.throws(()=>applyPatches(stat,[add('/世界/后台/人物/未来人',{...RECORDS.人物,所属世界:'测试世界',行动:'未来行动',更新时间:'斗罗历2644年-01月-01日'})]),/超过当前世界时间/);
    });
    await test('WorldResult compiler owns paths, escaping and upsert selection', () => {
        const stat=fresh();
        stat.世界.后台.人物.卫兵={...RECORDS.人物,所属世界:'测试世界',行动:'待命'};
        const compiled=compileWorldResult(stat,{
            摘要:'业务结果',
            事件:[{名称:'A/B',描述:'新的地区级警报',分类:'宏观节点',状态:'待发生',时间:'2026年9月8日'}],
            人物:[{名称:'卫兵',行动:'前往城门'}],
            因果:{宏观顺序:['A/B','第二阶段','第三阶段']}
        });
        assert.ok(compiled.patches.some(p=>p.path==='/世界/后台/事件/A~1B'&&p.op==='add'));
        assert.ok(compiled.patches.some(p=>p.path==='/世界/后台/人物/卫兵'&&p.op==='replace'));
        assert.ok(compiled.patches.every(p=>!String(p.path).includes('//')));
        const next=applyPatches(stat,compiled.patches.filter(p=>!p.path.startsWith('/世界/因果轨道/故事线')));
        assert.equal(next.世界.后台.事件['A/B'].描述,'新的地区级警报');
        assert.equal(next.世界.后台.人物.卫兵.行动,'前往城门');
    });
    await test('new WorldResult reply parses without patches while legacy replies remain compatible', () => {
        const modern=parseReply(JSON.stringify({摘要:'推进完成',事件:[{名称:'警报',描述:'警报扩散'}]}));
        assert.equal(modern.kind,'world_result');
        assert.equal(modern.worldResult.摘要,'推进完成');
        assert.equal(modern.worldResult.事件[0].名称,'警报');
        const legacy=parseReply(JSON.stringify({summary:'旧协议',patches:[]}));
        assert.equal(legacy.kind,'legacy_patches');
        assert.deepEqual(legacy.patches,[]);
    });
    await test('WorldResult parser keeps the first complete JSON object when providers append trailing output', () => {
        const first=JSON.stringify({摘要:'第一份有效结果',事件:[{名称:'前因',描述:'已发生',状态:'已完成'},{名称:'后果',描述:'正在发生',前因:['前因'],状态:'进行中'}]});
        const second=JSON.stringify({摘要:'不应混入的第二对象'});
        const parsed=parseReply(first+'\n'+second);
        assert.equal(parsed.kind,'world_result');
        assert.equal(parsed.worldResult.摘要,'第一份有效结果');
        assert.deepEqual(parsed.worldResult.事件.map(x=>x.名称),['前因','后果']);
        assert.throws(()=>parseReply('{"摘要":"破损","事件":[}'),/无法解析/);
    });
    await test('WorldResult parser accepts named-object maps without silently dropping entities', () => {
        const parsed=parseReply(JSON.stringify({
            摘要:'对象映射格式',
            事件:{
                '藤美学园爆发':{描述:'校园全面失序',分类:'宏观节点',状态:'进行中',时间:'2010年-04月-13日-上午'},
                '床主市大混乱':{描述:'城市社会秩序彻底崩溃',分类:'宏观节点',状态:'待发生',时间:'2010年-04月-13日-傍晚'}
            },
            人物:{
                '毒岛冴子':{所在世界:'学园默示录',地点:'二楼走廊',目标:'寻找生还者',行动:'向楼梯间推进',已知信息:'死体头部是弱点',下次检查条件:'到达楼梯间'}
            },
            传播:{
                '校门口的惨剧':{来源:'逃命学生',范围:'藤美学园校内',时间:'2010年-04月-13日-09:30',关联事件:'藤美学园爆发',内容:'校门口发生咬人事件'}
            },
            因果:{宏观顺序:['藤美学园爆发','床主市大混乱','后续阶段']}
        }));
        assert.equal(parsed.kind,'world_result');
        assert.deepEqual(parsed.worldResult.事件.map(x=>x.名称),['藤美学园爆发','床主市大混乱']);
        assert.equal(parsed.worldResult.人物[0].名称,'毒岛冴子');
        assert.equal(parsed.worldResult.人物[0].所属世界,'学园默示录');
        assert.deepEqual(parsed.worldResult.人物[0].认知,['死体头部是弱点']);
        assert.equal(parsed.worldResult.人物[0].下次检查,'到达楼梯间');
        assert.equal(parsed.worldResult.传播[0].名称,'校门口的惨剧');
        assert.deepEqual(parsed.worldResult.传播[0].关联事件,['藤美学园爆发']);
    });
    await test('WorldResult parser unwraps common structured-provider envelopes without retry', () => {
        for(const wrapper of ['WorldResult','world_result','world_update','result']){
            const parsed=parseReply(JSON.stringify({[wrapper]:{摘要:'已解包',事件:[{名称:'节点',描述:'变化'}]}}));
            assert.equal(parsed.kind,'world_result');
            assert.equal(parsed.worldResult.摘要,'已解包');
            assert.equal(parsed.worldResult.事件[0].名称,'节点');
        }
    });
    await test('world request asks terminal for structured WorldResult at low temperature', async () => {
        let options;
        const x=setup(async (_system,_input,opt)=>{options=opt;return JSON.stringify({摘要:'无变化'});});
        assert.equal(await x.engine.run(),true);
        assert.equal(options.structured,'auto');
        assert.equal(options.schemaName,'samsara_world_result_v1');
        assert.equal(options.temperature,0.3);
        assert.equal(options.schema.type,'object');
        assert.ok(options.schema.properties.事件);
        assert.equal(WORLD_RESULT_SCHEMA.properties.事件.type,'array');
        assert.equal(WORLD_RESULT_SCHEMA.properties.公开摘要,undefined);
        assert.equal(WORLD_RESULT_SCHEMA.properties.正文承接,undefined);
        assert.equal(WORLD_RESULT_SCHEMA.properties.因果.properties.当前阶段.type,'string');
        assert.equal(WORLD_RESULT_SCHEMA.properties.货币.type,'object');
        assert.deepEqual(Object.keys(WORLD_RESULT_SCHEMA.properties.货币.properties),['体系','购买力基准','经济波动']);
        assert.deepEqual(WORLD_RESULT_SCHEMA.properties.探索.items.properties.风险.enum,['F','E','D','C','B','A','S','SS','SSS']);
        assert.equal(WORLD_RESULT_SCHEMA.properties.探索.items.properties.探索度.minimum,0);
        assert.equal(WORLD_RESULT_SCHEMA.properties.探索.items.properties.探索度.maximum,100);
        assert.deepEqual(WORLD_RESULT_SCHEMA.properties.势力.items.properties.实力.enum,['F','E','D','C','B','A','S','SS','SSS']);
        assert.equal(WORLD_RESULT_SCHEMA.properties.势力.items.properties.声望.minimum,-5000);
        assert.equal(WORLD_RESULT_SCHEMA.properties.势力.items.properties.声望.maximum,10000);
        assert.deepEqual(WORLD_RESULT_SCHEMA.properties.异端.items.properties.状态.enum,['活跃','死亡']);
        assert.equal(WORLD_RESULT_SCHEMA.properties.异端.items.properties.来源,undefined,'异端身份字段由任务锁维护，世界引擎只更新生死状态');
    });
    await test('active alien roster members are mandatory world-person activities and dead aliens cannot resurrect', async () => {
        let calls=0,inputs=[];
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            if(calls===1)return JSON.stringify({摘要:'首轮遗漏异端活动'});
            return JSON.stringify({
                摘要:'补齐异端活动',
                人物:[{
                    名称:'异端甲',
                    所属世界:'测试世界',
                    地点:'北门外废仓',
                    目标:'截获进入城区的关键人物',
                    行动:'伪装成难民观察北门守卫换岗规律',
                    更新时间:'2026年9月7日清晨',
                    公开动态:'北门外有一名陌生难民长时间观察岗哨。'
                }]
            });
        });
        x.change(s=>{
            s.世界.异端雷达={当前模式:'干涉局',名单:{
                异端甲:{来源:'原创',经历:'潜伏专家',阵营:'篡夺者',职业:'刺客',层级:'Ⅱ',状态:'活跃'},
                异端乙:{来源:'原创',经历:'已阵亡',阵营:'篡夺者',职业:'战士',层级:'Ⅱ',状态:'死亡'}
            }};
            s.世界.后台.人物.异端乙={...RECORDS.人物,所属世界:'测试世界',地点:'旧战场',目标:'已死亡却仍有目标',行动:'不应继续行动'};
        });
        x.engine.config.requireMacroBackbone=false;x.engine.config.retryAttempts=2;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,2,'首轮遗漏活跃异端活动时必须定点重试');
        const first=JSON.parse(inputs[0]);
        assert.deepEqual(first.本轮必须维持的异端活动.map(x=>x.名称),['异端甲']);
        assert.ok(first.本轮必须维持的异端活动[0].要求.includes('人物'));
        const retry=JSON.parse(inputs[1]).纠错重试;
        assert.match(retry.补充清单.join('\n'),/异端活动\/异端甲/);
        assert.equal(x.get().世界.后台.人物.异端甲.行动,'伪装成难民观察北门守卫换岗规律');
        assert.equal(x.get().世界.后台.人物.异端甲.更新时间,'2026年9月7日清晨');
        assert.equal(x.get().世界.后台.人物.异端乙,undefined,'死亡异端后台人物必须被程序清除，禁止诈尸');
        assert.equal(x.writes(),1);
    });
    await test('world engine may end an active alien without demanding another activity record', async () => {
        let calls=0;
        const x=setup(async()=>{calls++;return JSON.stringify({摘要:'异端确认死亡',异端:[{名称:'异端甲',状态:'死亡'}]});});
        x.change(s=>{
            s.世界.异端雷达={当前模式:'干涉局',名单:{
                异端甲:{来源:'原创',经历:'潜伏',阵营:'篡夺者',职业:'刺客',层级:'Ⅱ',状态:'活跃'}
            }};
            s.世界.后台.人物.异端甲={...RECORDS.人物,所属世界:'测试世界',地点:'北门',目标:'潜伏',行动:'跟踪',更新时间:'旧时间'};
        });
        x.engine.config.requireMacroBackbone=false;x.engine.config.retryAttempts=1;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,1);
        assert.equal(x.get().世界.异端雷达.名单.异端甲.状态,'死亡');
        assert.equal(x.get().世界.后台.人物.异端甲,undefined,'异端死亡后同轮即停止后台人物活动');
    });
    await test('dead alien person proposals are ignored even if the model tries to recreate them', () => {
        const stat=fresh();
        stat.世界.异端雷达={当前模式:'干涉局',名单:{
            死亡异端:{来源:'原创',经历:'已阵亡',阵营:'篡夺者',职业:'战士',层级:'Ⅱ',状态:'死亡'}
        }};
        const compiled=compileWorldResult(stat,{
            摘要:'错误复活尝试',
            人物:[{名称:'死亡异端',所属世界:'测试世界',地点:'战场',目标:'继续作战',行动:'重新站起来'}],
            异端:[{名称:'死亡异端',状态:'活跃'}]
        });
        assert.equal(compiled.patches.some(p=>p.path.includes('/后台/人物/死亡异端')),false);
        assert.equal(compiled.patches.some(p=>p.path.includes('/异端雷达/名单/死亡异端/状态')),false,'死亡异端不得被改回活跃');
        assert.match(compiled.warnings.join('\n'),/死亡异端.*禁止恢复|异端已死亡/);
        assert.match(compiled.warnings.join('\n'),/死亡异端状态不可逆/);
    });
    await test('world run forces stale active events and legacy future timestamps to be repaired before commit', async () => {
        let calls=0,inputs=[];
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            return JSON.stringify({
                摘要:'清理陈旧世界状态',
                因果:{当前阶段:'旧巡逻与旧追踪均已成为历史，当前边境哨卡已恢复按现行任务运转。'},
                事件:[
                    {名称:'九年前巡逻',状态:'已完成',结果:'巡逻任务早已结束。',更新时间:'斗罗历2643年-12月-20日-酉时二刻'},
                    {名称:'八年前追踪',状态:'已完成',结果:'魂兽追踪早已结束。',更新时间:'斗罗历2643年-12月-20日-酉时二刻'},
                    {名称:'未来完成',时间:'斗罗历2643年-12月-20日-下午',状态:'已完成',结果:'已按当前时间校正。'},
                ],
                人物:[{名称:'未来人物',行动:'正在处理当前事务',更新时间:'斗罗历2643年-12月-20日-酉时二刻'}]
            });
        });
        x.change(s=>{
            s.世界.时间='斗罗历2643年-12月-20日-酉时二刻';
            s.世界.后台.事件={
                '九年前巡逻':{...RECORDS.事件,描述:'旧巡逻',时间:'斗罗历2634年-03月-18日-上午',状态:'进行中',分类:'当前事件'},
                '八年前追踪':{...RECORDS.事件,描述:'旧追踪',时间:'斗罗历2635年-03月-16日-下午',状态:'进行中',分类:'当前事件'},
                '未来完成':{...RECORDS.事件,描述:'未来时间污染',时间:'斗罗历2644年-01月-01日',状态:'已完成',分类:'近期节点'}
            };
            s.世界.后台.人物.未来人物={...RECORDS.人物,所属世界:'测试世界',行动:'未来动作',更新时间:'斗罗历2644年-12月-20日'};
        });
        x.engine.config.requireMacroBackbone=false;x.engine.config.retryAttempts=1;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,1);
        const payload=JSON.parse(inputs[0]);
        assert.deepEqual(payload.本轮必须复核的超期活动事件.map(x=>x.名称),['九年前巡逻','八年前追踪']);
        assert.ok(payload.本轮必须修复的时间越界记录.some(x=>x.名称==='未来完成'));
        assert.ok(payload.本轮必须修复的时间越界记录.some(x=>x.名称==='未来人物'));
        assert.equal(x.get().世界.后台.事件['九年前巡逻'],undefined,'已解决的陈旧局部事件应立即转入历史冷档');
        assert.equal(x.get().世界.后台.事件['八年前追踪'],undefined,'已解决的陈旧局部事件应立即转入历史冷档');
        assert.equal(x.get().世界.后台.事件.未来完成.时间,'斗罗历2643年-12月-20日-下午');
        assert.equal(x.get().世界.后台.人物.未来人物.更新时间,'斗罗历2643年-12月-20日-酉时二刻');
        assert.equal(x.get().世界.因果轨道.当前阶段,'旧巡逻与旧追踪均已成为历史，当前边境哨卡已恢复按现行任务运转。');
        assert.equal(Object.hasOwn(x.get().世界.后台,'正文承接'),false);
    });
    await test('existing vague or empty event schedules are explicitly requested and repaired', async () => {
        let calls=0,inputs=[];
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            return JSON.stringify({
                摘要:'补全旧事件时间',
                事件:[
                    {名称:'旧宏观A',时间:'2026年9月8日下午'},
                    {名称:'旧宏观B',时间:'旧宏观A完成后当日傍晚'}
                ]
            });
        });
        x.change(s=>{
            s.世界.后台.事件={
                旧宏观A:{...RECORDS.事件,描述:'A',分类:'宏观节点',状态:'待发生',时间:''},
                旧宏观B:{...RECORDS.事件,描述:'B',分类:'宏观节点',状态:'待发生',时间:'近期',前因:['旧宏观A']},
                旧宏观C:{...RECORDS.事件,描述:'C',分类:'宏观节点',状态:'待发生',时间:'2026年9月10日'}
            };
            s.世界.因果轨道={当前阶段:'',故事线:'旧宏观A -> 旧宏观B -> 旧宏观C',下一节点:'旧宏观A',偏移记录:{}};
        });
        x.engine.config.requireMacroBackbone=true;x.engine.config.retryAttempts=1;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,1);
        const payload=JSON.parse(inputs[0]);
        assert.deepEqual(payload.本轮必须补全的事件时间锚点.map(x=>x.名称),['旧宏观A','旧宏观B']);
        assert.equal(x.get().世界.后台.事件.旧宏观A.时间,'2026年9月8日下午');
        assert.equal(x.get().世界.后台.事件.旧宏观B.时间,'旧宏观A完成后当日傍晚');
    });
    await test('retry merges accepted WorldResult and requests only the missing business slice', async () => {
        let calls=0,inputs=[];
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            if(calls===1)return JSON.stringify({
                摘要:'人物与一个宏观已确认',
                人物:[{名称:'卫兵',所属世界:'测试世界',行动:'巡查北门'}],
                事件:[{名称:'宏观A',描述:'地区进入第一阶段',分类:'宏观节点',状态:'待发生',时间:'2026年9月8日'}],
                因果:{宏观顺序:['宏观A']}
            });
            return JSON.stringify({
                摘要:'只补缺失宏观',
                事件:[
                    {名称:'宏观B',描述:'地区级基础设施发生阶段变化',分类:'宏观节点',状态:'待发生',时间:'2026年9月10日'},
                    {名称:'宏观C',描述:'社会秩序进入长期重组阶段',分类:'宏观节点',状态:'待发生',时间:'2026年9月14日'}
                ],
                因果:{宏观顺序:['宏观A','宏观B','宏观C']}
            });
        });
        x.engine.config.requireMacroBackbone=true;x.engine.config.retryAttempts=2;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,2);
        assert.equal(x.writes(),1);
        assert.equal(x.get().世界.后台.人物.卫兵.行动,'巡查北门');
        assert.equal(Object.values(x.get().世界.后台.事件).filter(e=>e.分类==='宏观节点'&&e.状态==='待发生').length,3);
        assert.match(inputs[1],/已接受业务结果/);
        assert.match(inputs[1],/只补充或修正/);
        const retry=JSON.parse(inputs[1]).纠错重试;
        assert.deepEqual(retry.已接受业务结果.事件.map(x=>x.名称),['宏观A']);
        assert.match(retry.补充清单.join('\n'),/还需补充至少2个待发生宏观节点/);
        assert.match(retry.补充清单.join('\n'),/因果\.宏观顺序/);
        assert.match(x.get().世界.因果轨道.故事线,/宏观A.*宏观B.*宏观C/);
    });
    await test('retry keeps valid slices, rejects only the bad entity, and asks AI for both correction and missing macro nodes', async () => {
        let calls=0,inputs=[];
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            if(calls===1)return JSON.stringify({
                摘要:'首轮大部分有效',
                人物:[{名称:'卫兵',所属世界:'测试世界',行动:'巡查北门'}],
                事件:[{名称:'宏观A',描述:'城区进入戒严阶段',分类:'宏观节点',状态:'待发生',时间:'2026年9月8日'}],
                探索:[{名称:'学校-教室',风险:'D',探索度:10,描述:'玩家查看了教室'}],
                因果:{宏观顺序:['宏观A']}
            });
            return JSON.stringify({
                摘要:'修正探索并补齐宏观',
                探索:[{名称:'学校',风险:'D',探索度:10,描述:'玩家已确认学校内部局部情况'}],
                事件:[
                    {名称:'宏观B',描述:'城区交通网络中断',分类:'宏观节点',状态:'待发生',时间:'2026年9月10日'},
                    {名称:'宏观C',描述:'幸存者势力形成稳定据点',分类:'宏观节点',状态:'待发生',时间:'2026年9月14日'}
                ],
                因果:{宏观顺序:['宏观A','宏观B','宏观C']}
            });
        });
        x.engine.config.requireMacroBackbone=true;x.engine.config.retryAttempts=2;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,2);
        assert.equal(x.writes(),1,'失败首轮不得提前写入正式 MVU');
        const retry=JSON.parse(inputs[1]).纠错重试;
        assert.equal(retry.已接受业务结果.探索.length,0,'非法探索实体不得污染暂存结果');
        assert.equal(retry.已接受业务结果.人物.some(x=>x.名称==='卫兵'),true,'正确人物必须保留');
        assert.equal(retry.已接受业务结果.事件.some(x=>x.名称==='宏观A'),true,'正确宏观节点必须保留');
        const plan=retry.补充清单.join('\n');
        assert.match(plan,/探索\/学校-教室.*探索粒度过细/);
        assert.match(plan,/还需补充至少2个待发生宏观节点/);
        assert.equal(x.get().世界.后台.人物.卫兵.行动,'巡查北门');
        assert.equal(x.get().世界.探索.学校.探索度,10);
        assert.equal(x.get().世界.探索['学校-教室'],undefined);
        assert.equal(Object.values(x.get().世界.后台.事件).filter(e=>e.分类==='宏观节点'&&e.状态==='待发生').length,3);
    });
    await test('full Schema normalization rejects only the affected staged slice', async () => {
        let calls=0,inputs=[];
        const validateWorldState=stat=>{
            const checked=clone(stat);
            const guard=checked.世界?.后台?.人物?.卫兵;
            if(guard?.行动==='不规范行动')guard.行动='规范行动';
            return checked;
        };
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            if(calls===1)return JSON.stringify({
                摘要:'首轮含一个会被Schema改写的人物',
                人物:[{名称:'卫兵',所属世界:'测试世界',行动:'不规范行动'}],
                探索:[{名称:'学校',风险:'D',探索度:10,描述:'学校已确认'}]
            });
            return JSON.stringify({
                摘要:'只修正人物',
                人物:[{名称:'卫兵',所属世界:'测试世界',行动:'规范行动'}]
            });
        },validateWorldState);
        x.engine.config.requireMacroBackbone=false;x.engine.config.retryAttempts=1;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,2);
        assert.equal(x.writes(),1);
        const retry=JSON.parse(inputs[1]).纠错重试;
        assert.equal(retry.已接受业务结果.人物.length,0,'会被完整Schema改写的人物不得进入暂存');
        assert.equal(retry.已接受业务结果.探索.some(x=>x.名称==='学校'),true,'无关的合法探索必须保留');
        assert.match(retry.补充清单.join('\n'),/人物\/卫兵.*字段未通过完整 Schema 校验/);
        assert.equal(x.get().世界.后台.人物.卫兵.行动,'规范行动');
        assert.equal(x.get().世界.探索.学校.探索度,10);
    });
    await test('new prompt separates business reasoning from storage protocol', async () => {
        const x=setup(async()=>''),r=await x.engine.buildRequest(x.engine.snapshot());
        assert.match(r.system,/WorldResult/);
        assert.match(r.system,/生活自足/);
        assert.match(r.system,/时间容量/);
        assert.match(r.system,/信息不对称/);
        assert.match(r.system,/不输出[^\n]*JSON Pointer/);
        assert.doesNotMatch(r.system,/补丁只用 add\/replace\/remove|路径为相对 stat_data/);
        assert.doesNotMatch(r.system,/\/世界\/后台\/\{事件\|人物/);
        const payload=JSON.parse(r.input);
        assert.ok(payload.输入语义);
        assert.ok(payload.本轮时间容量);
        assert.equal(payload.正文可见投影规则.当前地点,'测试地点');
        assert.match(payload.正文可见投影规则.要求,/当前阶段.*故事线.*下一节点.*偏移记录/);
        assert.match(payload.正文可见投影规则.要求,/当前事件.*公开征兆.*可见影响/);
    });
    await test('world prompt includes the canonical WorldResult schema even when API structured output falls back', async () => {
        const x=setup(async()=>''),r=await x.engine.buildRequest(x.engine.snapshot());
        assert.match(r.system,/【WorldResult 标准字段结构】/);
        assert.match(r.system,/API.*json_object.*plain.*仍必须严格遵守/i);
        assert.match(r.system,/"事件"\s*:\s*\{[\s\S]{0,120}"type"\s*:\s*"array"/);
        assert.match(r.system,/"资源"\s*:\s*\{[\s\S]{0,120}"type"\s*:\s*"array"/);
        assert.doesNotMatch(r.system,/"任务状态"\s*:/);
        assert.doesNotMatch(r.system,/"成就状态"\s*:/);
        assert.match(r.system,/资源.*对象数组.*名称.*数量.*用途.*限制/);
        assert.match(r.system,/任务.*成就.*不读取.*不更新/);
        assert.match(r.system,/货币与经济/);
        assert.match(r.system,/体系.*购买力基准.*经济波动/);
        assert.match(r.system,/玩家持币余额.*不由 WorldResult 写入/);
        assert.match(r.system,/世界\.探索与世界\.势力.*空间币结算/);
        assert.match(r.system,/WorldResult\.探索必须是数组/);
        assert.match(r.system,/风险:"F"\|"E"\|"D"\|"C"\|"B"\|"A"\|"S"\|"SS"\|"SSS"/);
        assert.match(r.system,/探索度:number\(0~100\)/);
        assert.match(r.system,/WorldResult\.势力必须是数组/);
        assert.match(r.system,/声望:number\(-5000~10000\)/);
        assert.match(r.system,/禁止天台、教室、走廊、楼梯/);
        assert.match(r.system,/声望锚点-5000敌对.*10000崇拜/);
        assert.match(r.system,/货币体系不是跨界后永久锁死/);
        assert.match(r.system,/历法一致性/);
        assert.match(r.system,/不要输出“名称→对象”的 map 简写/);
        assert.match(r.system,/已完成.*历史锚点|历史锚点.*已完成/);
        assert.match(r.system,/传播.*到期.*回收|过期传播.*回收/);
        assert.match(r.system,/所有.*待发生.*进行中.*事件.*时间锚点/);
        assert.match(r.system,/不得.*近期.*稍后.*未来.*待定/);
        assert.match(r.system,/因果轨道\.当前阶段/);
        assert.match(r.system,/当前事件.*公开征兆.*可见影响/);
    });
    await test('world request projects only world-relevant MVU, keeps assets and character capabilities, and excludes user prose', async () => {
        const x=setup(async()=>JSON.stringify({摘要:'无变化'}));
        x.change(s=>{
            s.商城={技能列表:[{名称:'不应发送'}]};
            s.设置={API:{key:'secret'},单一世界:false,世界超稳:true};
            s.资产={
                '机动装甲A':{
                    类型:'载具',主体规模:3,完整度:86,状态:'待命',
                    能源:{类型:'电池',当前:60,上限:100,描述:'可短程出击'},
                    消耗单元:{导弹:{余量:4,上限:8,加成:['远程']}},
                    建设序列:{维护:{阶段:'进阶',功能:'维修',加成:['自检'],产出:'无',下次产出日期:'2026年9月9日',下次产出游天:99}},
                    驻扎人员:{玛雅:'驾驶员'},待办事件:['更换装甲板']
                },
                '安全屋':{类型:'固定地产',主体规模:2,完整度:100,状态:'正常',建设序列:{},驻扎人员:{幸存者A:'暂住'},待办事件:[]}
            };
            s.角色={
                种族:'人类',身份:['轮回者'],职业:{术士:{类型:'战斗',特性:['诅咒'],来源:'主神空间'}},层级:'Ⅱ',
                HP_MAX:100,HP:80,THP:0,EP_MAX:100,EP:70,
                最终属性:{ATK:999},
                血统:{魔眼:{品质:'C',原始属性:{精神:'C'},效果:{远视:'可跨区域观察'},描述:'魔眼'}},
                技能:{血咒:{品质:'B',类型:0,标签:['诅咒','远程'],效果:{追咒:'取得媒介后可远程施咒'},描述:'远程诅咒',消耗:'20EP'}},
                状态:{负伤:{类型:'减益',品质:'F',持续:'1天',来源:'战斗',原始属性:{体质:'F'},效果:{行动受限:'移动减慢'}}},
                装备:{
                    穿戴甲:{品质:'C',类型:3,标签:['防护'],原始属性:{体质:'D'},效果:{防弹:'降低枪击伤害'},描述:'护甲',消耗:'无',状态:1},
                    背包备用甲:{品质:'C',类型:3,标签:[],原始属性:{},效果:{},描述:'备用',消耗:'无',状态:0},
                    仓库甲:{品质:'A',类型:3,标签:[],原始属性:{},效果:{},描述:'仓库',消耗:'无',状态:2}
                },
                道具:{
                    通讯器:{品质:'D',类型:'工具',数量:1,标签:['通讯'],效果:{远程联络:'可跨城区通信'},描述:'通讯器',状态:0},
                    手雷:{品质:'D',类型:'消耗品',数量:2,标签:['爆炸'],效果:{爆炸:'范围杀伤'},描述:'手雷',状态:1},
                    仓库核弹:{品质:'SSS',类型:'道具',数量:1,标签:[],效果:{},描述:'不应发送',状态:2}
                },
                形态库:{狼形:{层级:'Ⅲ',状态:'完好',冷却:'无',原始属性:{力量:'C'},标签:['高速'],效果:{追踪:'强化嗅觉'},技能:{},描述:'狼形'}},
                当前形态:{激活:false,名称:''},
                空间币:999999
            };
            s.关系列表.玛雅={
                在场:false,种族:'精灵',身份:['从者'],职业:{弓手:{类型:'战斗',特性:['远射'],来源:'故乡'}},层级:'Ⅱ',
                HP_MAX:90,HP:90,THP:0,EP_MAX:120,EP:100,最终属性:{ATK:888},
                状态:{警戒:{类型:'增益',品质:'F',持续:'持续',来源:'自身',原始属性:{},效果:{警觉:'难以被偷袭'}}},
                血统:{自然之子:{品质:'C',原始属性:{},效果:{感知:'感知自然异常'},描述:'自然亲和'}},
                技能:{鹰眼:{品质:'C',类型:1,标签:['侦察'],效果:{远视:'远距离观察'},描述:'侦察技能',消耗:'无'}},
                装备:{长弓:{品质:'C',类型:0,标签:['远程'],原始属性:{},效果:{狙击:'远距离射击'},描述:'长弓',消耗:'无',状态:1},备用刀:{品质:'D',类型:0,标签:[],原始属性:{},效果:{},描述:'备用',消耗:'无',状态:0}},
                道具:{信号弹:{品质:'D',类型:'工具',数量:2,标签:['信号'],效果:{求援:'远程示警'},描述:'信号弹',状态:0}},
                形态库:{},当前形态:{激活:false,名称:''},
                性格:'冷静',喜爱:'森林与弓术',外貌:'银发',着装:'轻甲',是否队友:true,好感度:25,态度:'信任并保护玩家',背景故事:'来自森林王国',数量:1
            };
        });
        x.host.getChatMessages=()=>[
            {message_id:1,message:'玩家秘密计划：我要埋伏玛雅。',role:'user',is_user:true},
            {message_id:2,message:'玛雅在远处观察到城市上空的黑烟。',role:'assistant',is_user:false},
            {message_id:3,message:'玩家输入：这段不应进入世界模型。',role:'user',is_user:true}
        ];
        x.host.getCurrentChatId=()=> 'chat-1';
        const snap=x.engine.snapshot();
        snap.message={message_id:3,message:'玩家输入：这段不应进入世界模型。',role:'assistant',is_user:false};
        snap.id=3;snap.text=snap.message.message;snap.fingerprint=JSON.stringify(['chat-1',3,0,'manual']);
        const r=await x.engine.buildRequest(snap);
        const p=JSON.parse(r.input),ctx=p.当前变量;
        assert.ok(ctx.资产['机动装甲A']);
        assert.equal(ctx.资产['机动装甲A'].建设序列.维护.下次产出游天,undefined);
        assert.equal(ctx.任务,undefined);
        assert.equal(ctx.商城,undefined);
        assert.equal(ctx.设置,undefined);
        assert.equal(ctx.角色.最终属性,undefined);
        assert.equal(ctx.角色.空间币,undefined);
        assert.ok(ctx.角色.血统.魔眼);
        assert.ok(ctx.角色.技能.血咒);
        assert.ok(ctx.角色.状态.负伤);
        assert.ok(ctx.角色.装备.穿戴甲);
        assert.equal(ctx.角色.装备.背包备用甲,undefined);
        assert.equal(ctx.角色.装备.仓库甲,undefined);
        assert.ok(ctx.角色.道具.通讯器);
        assert.ok(ctx.角色.道具.手雷);
        assert.equal(ctx.角色.道具.仓库核弹,undefined);
        assert.equal(ctx.角色.血统.魔眼.原始属性,undefined);
        assert.equal(ctx.关系列表.玛雅.最终属性,undefined);
        assert.equal(ctx.关系列表.玛雅.性格,'冷静');
        assert.equal(ctx.关系列表.玛雅.喜爱,'森林与弓术');
        assert.equal(ctx.关系列表.玛雅.着装,'轻甲');
        assert.equal(ctx.关系列表.玛雅.态度,'信任并保护玩家');
        assert.equal(ctx.关系列表.玛雅.背景故事,'来自森林王国');
        assert.ok(ctx.关系列表.玛雅.技能.鹰眼);
        assert.ok(ctx.关系列表.玛雅.装备.长弓);
        assert.equal(ctx.关系列表.玛雅.装备.备用刀,undefined);
        assert.deepEqual(p.正文楼层.map(f=>f.正文),['玛雅在远处观察到城市上空的黑烟。']);
        assert.doesNotMatch(r.input,/玩家秘密计划|玩家输入：这段不应进入世界模型/);
    });
    await test('terminal API contains structured-output negotiation with plain fallback', () => {
        const sourceText=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
        assert.match(sourceText,/response_format/);
        assert.match(sourceText,/json_schema/);
        assert.match(sourceText,/json_object/);
        assert.match(sourceText,/options\.temperature/);
        assert.match(sourceText,/structured/);
    });
    await test('terminal structured mode falls back, caches capability, and recovers from stale cache', async () => {
        const sourceText=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
        const start=sourceText.indexOf('    var API_STRUCTURED_MODE_CACHE');
        const end=sourceText.indexOf('    /* 是否启用额外模型通道',start);
        const snippet=sourceText.slice(start,end);
        const calls=[];
        const fakeFetch=async (_url,opt)=>{
            const body=JSON.parse(opt.body);calls.push(body.response_format?.type||'plain');
            if(calls.length===1)return {ok:false,status:400,statusText:'Bad Request',text:async()=> 'unsupported response_format json_schema'};
            if(calls.length===3)return {ok:false,status:400,statusText:'Bad Request',text:async()=> 'unsupported response_format json_object'};
            return {ok:true,status:200,statusText:'OK',json:async()=>({choices:[{message:{content:'{"摘要":"ok"}'}}]})};
        };
        const apiChat=new Function('getApiConfig','fetch',snippet+'; return apiChat;')(
            ()=>({enabled:true,apiUrl:'https://example.invalid/v1',apiKey:'',model:'demo'}),fakeFetch
        );
        const options={structured:'auto',schemaName:'samsara_world_result_v1',schema:{type:'object',properties:{摘要:{type:'string'}}},temperature:0.3};
        assert.equal(await apiChat('JSON only','test',options),'{"摘要":"ok"}');
        assert.deepEqual(calls,['json_schema','json_object']);
        assert.equal(await apiChat('JSON only','test',options),'{"摘要":"ok"}');
        assert.deepEqual(calls,['json_schema','json_object','json_object','plain']);
        assert.equal(await apiChat('JSON only','test',options),'{"摘要":"ok"}');
        assert.deepEqual(calls,['json_schema','json_object','json_object','plain','plain']);
    });
    await test('terminal structured mode downgrades generic upstream INVALID_ARGUMENT before failing plain mode', async () => {
        const sourceText=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
        const start=sourceText.indexOf('    var API_STRUCTURED_MODE_CACHE');
        const end=sourceText.indexOf('    /* 是否启用额外模型通道',start);
        const snippet=sourceText.slice(start,end);
        const calls=[];
        const wrapped400='{"error":{"message":"upstream status 400: {\\\"error\\\":{\\\"code\\\":400,\\\"message\\\":\\\"Request contains an invalid argument.\\\",\\\"status\\\":\\\"INVALID_ARGUMENT\\\"}}","type":"invalid_request_error","param":null,"code":"invalid_argument"}}';
        const fakeFetch=async (_url,opt)=>{
            const body=JSON.parse(opt.body);calls.push(body.response_format?.type||'plain');
            if(calls.length<3)return {ok:false,status:400,statusText:'Bad Request',text:async()=>wrapped400};
            return {ok:true,status:200,statusText:'OK',json:async()=>({choices:[{message:{content:'{"摘要":"plain ok"}'}}]})};
        };
        const apiChat=new Function('getApiConfig','fetch',snippet+'; return apiChat;')(
            ()=>({enabled:true,apiUrl:'https://example.invalid/v1',apiKey:'',model:'demo-generic-400'}),fakeFetch
        );
        const options={structured:'auto',schemaName:'samsara_world_result_v1',schema:{type:'object',properties:{摘要:{type:'string'}}},temperature:0.3};
        assert.equal(await apiChat('JSON only','test',options),'{"摘要":"plain ok"}');
        assert.deepEqual(calls,['json_schema','json_object','plain']);

        const plainCalls=[];
        const always400=async (_url,opt)=>{
            const body=JSON.parse(opt.body);plainCalls.push(body.response_format?.type||'plain');
            return {ok:false,status:400,statusText:'Bad Request',text:async()=>wrapped400};
        };
        const apiChatFails=new Function('getApiConfig','fetch',snippet+'; return apiChat;')(
            ()=>({enabled:true,apiUrl:'https://example.invalid/v1',apiKey:'',model:'demo-generic-400-fail'}),always400
        );
        await assert.rejects(()=>apiChatFails('JSON only','test',options),/HTTP 400/);
        assert.deepEqual(plainCalls,['json_schema','json_object','plain']);
    });
    await test('model causal patches accept whole objects and normalize common 因校轨道 typo', async () => {
        const x=setup(async()=>JSON.stringify({summary:'修复因果轨道',patches:[
            {op:'replace',path:'/世界/因果轨道',value:{当前阶段:'爆发日',故事线:'撤离 -> 灾变 -> 崩溃',下一节点:'撤离',偏移记录:{}}},
            {op:'replace',path:'/世界/因校轨道/故事线',value:'撤离 -> 灾变 -> 崩溃'}
        ]}));
        assert.equal(await x.engine.run(),true);
        assert.equal(x.get().世界.因果轨道.当前阶段,'爆发日');
        assert.equal(x.get().世界.因果轨道.故事线,'撤离 -> 灾变 -> 崩溃');
        assert.equal(x.get().世界.因果轨道.下一节点,'撤离');
    });
    await test('macro-deficient model replies retry and only commit once a real backbone exists', async () => {
        let calls=0,inputs=[];
        const x=setup(async (_system,input)=>{
            calls++;inputs.push(input);
            if(calls<3)return JSON.stringify({summary:'仍只处理眼前剧情',patches:[add('/世界/后台/事件/当前混乱',{描述:'当前混乱',分类:'当前事件',状态:'进行中'})]});
            return JSON.stringify({summary:'已补齐宏观骨架',patches:[
                add('/世界/后台/事件/城市撤离',{描述:'城市撤离',分类:'宏观节点',状态:'待发生',时间:'2026年9月8日'}),
                add('/世界/后台/事件/战略级灾难',{描述:'战略级灾难',分类:'宏观节点',状态:'待发生',时间:'2026年9月10日'}),
                add('/世界/后台/事件/秩序崩溃',{描述:'秩序崩溃',分类:'宏观节点',状态:'待发生',时间:'2026年9月14日'})
            ]});
        });
        x.engine.config.requireMacroBackbone=true;
        x.engine.config.retryAttempts=3;
        assert.equal(await x.engine.run(),true);
        assert.equal(calls,3);
        assert.equal(x.writes(),1);
        assert.match(inputs[1],/宏观事件不足/);
        assert.match(inputs[1],/仍只处理眼前剧情/);
        assert.equal(Object.values(x.get().世界.后台.事件).filter(e=>e.分类==='宏观节点'&&e.状态==='待发生').length,3);
        assert.match(x.get().世界.因果轨道.故事线,/城市撤离.*战略级灾难.*秩序崩溃/);
    });
    await test('retry limit defaults to three and persists from request-inspection setting', () => {
        const engine=new Engine({localStorage:{getItem:()=>null,setItem:()=>{}},Samsara:{}});
        assert.equal(engine.config.retryAttempts,3);
        const sourceText=fs.readFileSync(file,'utf8');
        assert.match(sourceText,/data-retries/);
        assert.match(sourceText,/失败重试次数/);
    });
    await test('request inspection names business/compiler correction instead of model patches', () => {
        const sourceText=fs.readFileSync(file,'utf8');
        assert.match(sourceText,/只纠正 WorldResult 业务结果\/编译校验/);
        assert.doesNotMatch(sourceText,/只纠正模型回复\/补丁/);
    });
    await test('master switch off blocks manual world progression', async () => {
        let calls=0;
        const x=setup(async()=>{calls++;return JSON.stringify({summary:'不应执行',patches:[]});});
        x.engine.config.enabled=false;
        assert.equal(await x.engine.run(),false);
        assert.equal(calls,0);
        assert.equal(x.writes(),0);
    });
    await test('an already-processed floor may self-repair when its macro backbone is still missing', async () => {
        const x=setup(async()=>JSON.stringify({summary:'补齐缺失宏观',patches:[
            add('/世界/后台/事件/宏观A',{描述:'宏观A',分类:'宏观节点',状态:'待发生',时间:'2026年9月8日'}),
            add('/世界/后台/事件/宏观B',{描述:'宏观B',分类:'宏观节点',状态:'待发生',时间:'2026年9月10日'}),
            add('/世界/后台/事件/宏观C',{描述:'宏观C',分类:'宏观节点',状态:'待发生',时间:'2026年9月14日'})
        ]}));
        x.engine.config.requireMacroBackbone=true;x.engine.config.retryAttempts=0;
        const fp=x.engine.snapshot().fingerprint;
        x.change(s=>{s.世界.后台.已处理楼层=fp;s.世界.后台.已处理时间=s.世界.时间;});
        assert.equal(await x.engine.run(),true);
        assert.equal(x.writes(),1);
        assert.equal(Object.values(x.get().世界.后台.事件).filter(e=>e.分类==='宏观节点').length,3);
    });
    await test('successful run persists once; same floor cannot double award', async () => {
        let calls = 0;
        const x = setup(async () => {calls++;return '{"summary":"无变化","patches":[]}';});
        assert.equal(await x.engine.run(),true); assert.equal(await x.engine.run(),false);
        assert.equal(calls,1); assert.equal(x.writes(),1); assert.equal(x.get().世界.后台.运行记录.length,1);
    });
    await test('legacy patch protocol can still update causal current stage but cannot restore removed public summary', async () => {
        const x=setup(async()=>JSON.stringify({summary:'守卫开始巡逻',patches:[add('/世界/因果轨道/当前阶段','守卫开始逐步封锁城门，城内通行明显收紧。')]}));
        assert.equal(await x.engine.run(),true);
        assert.equal(x.get().世界.因果轨道.当前阶段,'守卫开始逐步封锁城门，城内通行明显收紧。');
        assert.equal(Object.hasOwn(x.get().世界.后台,'公开摘要'),false);
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
    await test('macro planning works without any worldbook and treats model canon knowledge as primary', async () => {
        const x=setup(async()=>''),e=x.engine;
        e.worldbook=Engine.prototype.worldbook;
        const r=await e.buildRequest(e.snapshot()),payload=JSON.parse(r.input);
        assert.deepEqual(payload.世界书,[]);
        assert.equal(payload.推演阶段.宏观优先,true);
        assert.match(r.system,/模型已有的原著知识/);
        assert.match(r.system,/世界书.*补充|补充.*世界书/);
        assert.match(r.system,/没有世界书.*不得/);
    });
    await test('timeline request exposes the next macro boundary for interval simulation', async () => {
        const x=setup(async()=>''),e=x.engine;
        x.change(stat=>{
            stat.世界.因果轨道={当前阶段:'危机爆发',故事线:'危机爆发 -> 城市撤离 -> 战略级灾难',下一节点:'城市撤离',偏移记录:{}};
            stat.世界.后台.事件={
                '当前混乱':{...RECORDS.事件,分类:'当前事件',状态:'进行中',时间:'2026年9月7日清晨',描述:'当前混乱'},
                '城市撤离':{...RECORDS.事件,分类:'宏观节点',状态:'待发生',时间:'2026年9月10日清晨',描述:'城市撤离'},
                '战略级灾难':{...RECORDS.事件,分类:'宏观节点',状态:'待发生',时间:'2026年10月1日清晨',描述:'战略级灾难'}
            };
        });
        const payload=JSON.parse((await e.buildRequest(e.snapshot())).input);
        assert.equal(payload.时间线调度.下一宏观节点.名称,'城市撤离');
        assert.equal(payload.时间线调度.桥接区间.起点,'2026年9月7日清晨');
        assert.equal(payload.时间线调度.桥接区间.终点,'2026年9月10日清晨');
        assert.equal(payload.推演阶段.近期细节边界,'城市撤离');
    });
    await test('missing macro timeline force-reads enabled chronology backbone without opening unrelated lore', async () => {
        const x=setup(async()=>''),e=x.engine;
        e.worldbook=Engine.prototype.worldbook;
        e.host.getCharWorldbookNames=()=>({primary:'设定',additional:[]});
        e.host.getWorldbook=()=>[
            {uid:1,name:'世界年表',content:'后续存在跨国战略灾难与电磁脉冲影响。',strategy:{type:'selective',keys:['核爆','EMP']}},
            {uid:2,name:'高城沙耶',content:'人物详档',strategy:{type:'selective',keys:['高城沙耶']}},
            {uid:3,name:'当前地点',content:'城门资料',strategy:{type:'selective',keys:['城门']}}
        ];
        const r=await e.buildRequest(e.snapshot()),payload=JSON.parse(r.input);
        assert.deepEqual(payload.世界书.map(x=>x.名称),['世界年表','当前地点']);
        assert.equal(r.manifest.读取判定.find(x=>x.名称==='世界年表').原因,'宏观资料补充');
        assert.match(r.system,/原著确定性大事件/);
        x.change(stat=>{
            for(const name of ['远期A','远期B','远期C'])stat.世界.后台.事件[name]={...RECORDS.事件,分类:'宏观节点',状态:'待发生',时间:'2026年10月'+(10+Object.keys(stat.世界.后台.事件).length)+'日',描述:name};
        });
        const complete=await e.buildRequest(e.snapshot());
        assert.equal(JSON.parse(complete.input).世界书.some(x=>x.名称==='世界年表'),false);
    });
    await test('world-engine-enabled MVU exposes readonly rumor shapes and only permits purchased-intel consumption', () => {
        const src=fs.readFileSync(path.join(__dirname,'../World Book/[mvu_update]变量更新规则.txt'),'utf8');
        const enabledStart=src.indexOf('<%_ if (isWorldEngineEnabled && !isCombat) { _%>');
        const enabledEnd=src.indexOf('<%_ } else if (!isCombat) { _%>',enabledStart);
        const enabled=src.slice(enabledStart,enabledEnd);
        assert.match(src,/\/传闻\/街头巷议/);
        assert.match(src,/\/传闻\/布告与檄文/);
        assert.match(enabled,/街头巷议:[\s\S]*来源:str;内容:str;可信度:酒话\|可疑\|或许可信/);
        assert.match(enabled,/布告与檄文:[\s\S]*发布者:str;内容:str;张贴位置:str/);
        assert.match(enabled,/严禁把标题对应的value写成纯字符串/);
        assert.match(enabled,/禁止对\/传闻\/街头巷议及其子节点输出insert、replace、remove/);
        assert.match(enabled,/仅当本轮正文明确完成某条已有情报交易时[\s\S]*remove/);
        assert.match(enabled,/转化为【任务】或【探索】/);
        assert.match(src,/insert\/replace单条“\/传闻\/街头巷议\/\[标题\]”时，value必须是完整object/);
        assert.match(src,/只读字段:[^\n]*\/世界\/货币/);
        const currencyStart=src.indexOf('    货币: ');
        const currencyGuard=src.lastIndexOf('<%_ if (!isWorldEngineEnabled) { _%>',currencyStart);
        const explorationStart=src.indexOf('    探索:',currencyStart);
        assert.ok(currencyGuard>=0&&currencyGuard<currencyStart&&explorationStart>currencyStart,'世界引擎开启时普通MVU必须隐藏货币更新规则');
        assert.match(src,/只读字段:[^\n]*\/世界\/探索/);
        assert.match(src,/只读字段:[^\n]*\/世界\/势力/);
        assert.doesNotMatch(src,/历法/,'普通 MVU 提示词不得暴露程序内部历法');
        const exploreStart=src.indexOf('    探索:');
        const exploreGuard=src.lastIndexOf('<%_ if (!isWorldEngineEnabled) { _%>',exploreStart);
        assert.ok(exploreGuard>=0&&exploreGuard<exploreStart,'世界引擎开启时普通MVU必须隐藏探索/势力可写规则');
        const commonAnchor=src.indexOf('&P_传闻通用');
        const guard=src.lastIndexOf('<%_ if (!isWorldEngineEnabled) { _%>',commonAnchor);
        assert.ok(guard>=0&&guard<commonAnchor,'世界引擎开启时不再注入“为空补传闻”的冲突规则');
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
        const host={localStorage:{getItem:()=>JSON.stringify({builtinDefaultPromptVersionApplied:1,preset:'自定义总则\n【世界推进】\n我的世界规则\n【势力与地区】\n旧版势力规则'}),setItem:()=>{}},Samsara:{}};
        const engine=new Engine(host);
        assert.match(engine.config.preset,/【世界推进】\n我的世界规则/);
        assert.match(engine.config.preset,/【世界演进准则】/);
        assert.match(engine.config.preset,/【因果轨道与偏移】/);
        assert.match(engine.config.preset,/【探索与势力】\n旧版势力规则/);
        assert.doesNotMatch(engine.config.preset,/【势力与地区】/);
        assert.match(engine.config.preset,/【信息传播】/);
    });
    await test('editable prompt presets can permanently remove default segments after legacy migration', () => {
        let saved='';
        const host={localStorage:{getItem:()=>JSON.stringify({builtinDefaultPromptVersionApplied:1,presetEditorVersion:2,preset:'【自定义段】\n只保留这一段'}),setItem:(_,v)=>{saved=v;}},Samsara:{}};
        const engine=new Engine(host);
        assert.equal(engine.config.preset,'【自定义段】\n只保留这一段');
        assert.doesNotMatch(engine.config.preset,/【世界推进】/);
        engine.setPreset('【另一段】\n新的正文');
        assert.equal(engine.config.preset,'【另一段】\n新的正文');
        assert.equal(JSON.parse(saved).presetEditorVersion,2);
        assert.doesNotMatch(JSON.parse(saved).preset,/【信息传播】/);
    });
    await test('built-in default prompt document is seeded, visible, and applied on first load', () => {
        let stored='';
        const host={localStorage:{getItem:()=>null,setItem:(_,v)=>{stored=v;}},Samsara:{}};
        const engine=new Engine(host),docs=engine.getPromptDocuments(),doc=docs.find(x=>x.id==='builtin-default');
        assert.ok(doc&&doc.builtin,'内置默认文档必须始终存在');
        assert.equal(doc.name,'默认设置');
        assert.equal(engine.config.activePromptDocumentId,'builtin-default');
        assert.equal(engine.config.builtinDefaultPromptVersionApplied,6);
        assert.equal(engine.config.contextTurns,3);
        assert.equal(engine.config.activationMode,'respect_activation');
        assert.equal(engine.config.selectedEntries.length,24);
        assert.equal(engine.config.selectedEntries[0],'["轮回战场V3.6.1","915830"]');
        assert.equal(engine.config.selectedEntries.at(-1),'["轮回战场V3.6.1","559085"]');
        assert.match(engine.config.preset,/以当前世界的已确认状态、本轮实际剧情/);
        assert.doesNotMatch(engine.config.preset,/【任务与剧本】/,'内置默认文档不能停留在旧提示词版本');
        assert.equal(engine.config.preset,doc.settings.preset,'内置默认文档必须直接绑定当前 DEFAULT_PRESET');
        assert.match(engine.config.preset,/【时间容量与信息边界】/);
        assert.match(engine.config.preset,/因果轨道\.当前阶段/);
        assert.match(engine.config.preset,/当前事件.*公开征兆.*可见影响/);
        assert.match(engine.config.preset,/场外人物动态/);
        assert.match(engine.config.preset,/活跃.*异端.*每轮|异端.*活跃.*每轮/);
        assert.doesNotMatch(engine.config.preset,/正文承接/);
        assert.doesNotMatch(engine.config.preset,/公开摘要/);
        assert.equal(engine.deletePromptDocument('builtin-default'),false,'内置默认文档不可删除');
        assert.ok(JSON.parse(stored).promptDocuments.some(x=>x.id==='builtin-default'));
    });
    await test('legacy personal default no longer shadows the versioned built-in default', () => {
        const legacySettings={preset:'【旧个人默认】\n旧内容',contextTurns:8,activationMode:'force_selected',selectedEntries:['["旧书","1"]']};
        const host={localStorage:{getItem:()=>JSON.stringify({
            builtinDefaultPromptVersionApplied:2,
            activePromptDocumentId:'builtin-default',
            userDefaultPromptSettings:legacySettings,
            promptDocuments:[]
        }),setItem:()=>{}},Samsara:{}};
        const engine=new Engine(host);
        const builtin=engine.getPromptDocuments().find(x=>x.id==='builtin-default');
        const personal=engine.getPromptDocuments().find(x=>x.id==='user-default');
        assert.ok(builtin&&personal,'旧个人默认应迁移为独立个人文档');
        assert.doesNotMatch(builtin.settings.preset,/旧个人默认/);
        assert.match(builtin.settings.preset,/因果轨道\.当前阶段/);
        assert.doesNotMatch(builtin.settings.preset,/正文承接|公开摘要/);
        assert.equal(personal.settings.preset,'【旧个人默认】\n旧内容');
        assert.equal(engine.config.activePromptDocumentId,'builtin-default');
        assert.equal(engine.config.preset,builtin.settings.preset,'使用内置默认时版本升级必须应用最新代码模板');
    });
    await test('prompt documents save import apply and delete complete prompt settings', () => {
        let stored='';
        const host={localStorage:{getItem:()=>null,setItem:(_,v)=>{stored=v;}},Samsara:{}};
        const engine=new Engine(host);
        const settings={preset:'【世界推进】\n文档A',contextTurns:9,activationMode:'force_selected',selectedEntries:['["设定","7"]']};
        const first=engine.savePromptDocument('文档A',settings);
        assert.equal(engine.config.activePromptDocumentId,first.id);
        assert.equal(engine.getPromptDocuments().length,2);
        assert.ok(engine.getPromptDocuments().some(x=>x.id==='builtin-default'));
        const imported=engine.importPromptDocument(JSON.stringify({type:'samsara-world-prompt-document',version:1,name:'文档B',settings:{preset:'【自定义】\n导入内容',contextTurns:4,activationMode:'respect_activation',selectedEntries:[]}}));
        assert.equal(engine.getPromptDocuments().length,3);
        assert.equal(engine.config.activePromptDocumentId,first.id,'导入不应偷偷应用文档');
        engine.applyPromptSettings(imported.settings);
        engine.config.activePromptDocumentId=imported.id;engine.saveConfig();
        assert.equal(engine.config.preset,'【自定义】\n导入内容');
        assert.equal(engine.config.contextTurns,4);
        assert.deepEqual(engine.config.selectedEntries,[]);
        assert.equal(engine.deletePromptDocument(imported.id),true);
        assert.equal(engine.getPromptDocuments().length,2);
        assert.ok(JSON.parse(stored).promptDocuments.length===2);
        assert.ok(JSON.parse(stored).promptDocuments.some(x=>x.id==='builtin-default'));
    });
    await test('built-in default worldbook selections survive versioned worldbook renames', async () => {
        const host={
            localStorage:{getItem:()=>null,setItem:()=>{}},Samsara:{},
            getCharWorldbookNames:()=>({primary:'轮回战场V3.7.0',additional:[]}),
            getWorldbook:name=>name==='轮回战场V3.7.0'?[
                {uid:915830,name:'默认应勾选',content:'默认资料',enabled:true,strategy:{type:'constant'}},
                {uid:999999,name:'默认不应勾选',content:'额外资料',enabled:true,strategy:{type:'constant'}}
            ]:[]
        };
        const engine=new Engine(host);
        const catalogue=await engine.catalogue();
        assert.equal(catalogue.length,2);
        const books=await engine.worldbook('');
        assert.deepEqual(books.map(x=>x.名称),['默认应勾选'],'旧文档保存的 V3.6.1 条目应在 V3.7.0 同ID世界书中继续命中');
    });
    await test('worldbook catalogue includes character chat-bound and globally enabled books with deduped sources', async () => {
        const host={
            localStorage:{getItem:()=>null,setItem:()=>{}},Samsara:{},
            getCharWorldbookNames:()=>({primary:'主书',additional:['附书','共享书']}),
            getChatWorldbookName:()=> '聊天书',
            getGlobalWorldbookNames:()=>['全局外挂书','共享书'],
            getWorldbook:name=>[{uid:1,name:name+'条目',content:name+'内容',enabled:true,strategy:{type:'constant'}}]
        };
        const engine=new Engine(host);
        const list=await engine.catalogue(),books=[...new Set(list.map(x=>x.book))];
        assert.deepEqual(books,['主书','附书','共享书','聊天书','全局外挂书']);
        assert.deepEqual(list.find(x=>x.book==='共享书').sources,['角色附加','全局启用']);
        assert.equal(list.find(x=>x.book==='聊天书').sources[0],'聊天绑定');
        assert.equal(list.find(x=>x.book==='全局外挂书').sources[0],'全局启用');
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
    await test('status bar routes world button by master switch without a redundant world-engine settings button', () => {
        const source=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
        assert.match(source,/data-toggle=["']world-engine["']/);
        assert.match(source,/engine\.isConfigured\(\)/);
        assert.match(source,/renderWorldTab\(sd\)/);
        assert.match(source,/case ['"]world['"]:[\s\S]{0,500}renderWorldTab\(sd\)/);
        assert.match(source,/enableApi:\s*function\s*\(/);
        assert.doesNotMatch(source,/data-act=["']world-engine-settings["']/);
        assert.doesNotMatch(source,/click\.samWorldEngineSettings/);
    });
    await test('switching chat clears request-inspection memory instead of showing the previous save', () => {
        const engine=new Engine({localStorage:{getItem:()=>null,setItem:()=>{}},Samsara:{}});
        engine.lastRequest={input:'旧档纠错重试'};
        engine.previewRequest={input:'旧档预览'};
        engine.lastReply='旧档回复';
        engine.lastFailure='旧档失败';
        engine.lastWorldResult={摘要:'旧档'};
        engine.lastCompiledPatches=[{path:'/旧档'}];
        engine.lastCompileWarnings=['旧档'];
        engine.lastRetryLog=[{重试:1,错误:'旧档'}];
        engine.lastAttemptCount=2;
        engine.resetInspection();
        assert.equal(engine.lastRequest,null);
        assert.equal(engine.previewRequest,null);
        assert.equal(engine.lastReply,'');
        assert.equal(engine.lastFailure,'');
        assert.equal(engine.lastWorldResult,null);
        assert.deepEqual(engine.lastCompiledPatches,[]);
        assert.deepEqual(engine.lastCompileWarnings,[]);
        assert.deepEqual(engine.lastRetryLog,[]);
        assert.equal(engine.lastAttemptCount,0);
        assert.match(source,/CHAT_CHANGED[\s\S]{0,350}resetInspection\(\)/);
    });
    await test('world events page groups events instead of rendering one flat name-sorted list', () => {
        assert.match(source,/this\.tab===['"]世界事件['"][\s\S]{0,350}timelineCards\(list\)/);
    });
    await test('terminal handoff restores saved state and close does not disable engine', () => {
        let restored;
        const host = {localStorage:{getItem:()=>null},Samsara:{terminal:{suspend:()=>({open:true,scroll:82}),restore:s=>restored=s}}};
        const engine = new Engine(host); engine.config.enabled=true;
        engine.createPanel=()=>{engine.panel={hidden:true};}; engine.render=()=>{};
        engine.open(); engine.open(); engine.close(); engine.close();
        assert.deepEqual(restored,{open:true,scroll:82}); assert.equal(engine.config.enabled,true);
    });
    await test('single-world mode hides achievements from prose and disables achievement generation and settlement grants', () => {
        const vars=fs.readFileSync(path.join(__dirname,'../World Book/[variables]当前变量.txt'),'utf8');
        const taskStart=vars.indexOf('// 3. 任务列表');
        const taskEnd=vars.indexOf('// 4. 角色基础信息',taskStart);
        const renderTasks=new Function('current','data','isOneWorld','_',vars.slice(taskStart,taskEnd));
        const lodash={cloneDeep:clone,omitBy:(obj,pred)=>Object.fromEntries(Object.entries(obj||{}).filter(([,v])=>!pred(v))),mapValues:(obj,fn)=>Object.fromEntries(Object.entries(obj||{}).map(([k,v])=>[k,fn(v)])),omit:(obj,keys)=>Object.fromEntries(Object.entries(obj||{}).filter(([k])=>!keys.includes(k)))};
        const data={任务:{列表:{主线:{状态:'进行中'}},副本成就:{隐藏成就:{状态:'未达成',奖励:'F级盲盒·测试'}}}};
        const current={};renderTasks(current,data,true,lodash);
        assert.equal(current.任务.副本成就,undefined);

        const god=fs.readFileSync(path.join(__dirname,'../World Book/【主神任务】[mvu_plot].txt'),'utf8');
        assert.match(god,/单一世界.*禁止生成副本成就/);
        assert.match(god,/<%_ if \(!isSingleWorld\) \{ _%>[\s\S]*副本成就奖励梯度/);

        const trial=fs.readFileSync(path.join(__dirname,'../World Book/【试炼任务】[mvu_plot].txt'),'utf8');
        assert.match(trial,/单一世界.*不得生成副本成就/);

        const godUi=fs.readFileSync(path.join(__dirname,'../Regular/主神任务美化.html'),'utf8');
        assert.match(godUi,/isSingleWorldMode[\s\S]*q\.achievements\s*=\s*\[\]/);
        assert.match(godUi,/if \(!singleWorld\) \{[\s\S]*q\.achievements\.forEach/);

        const trialUi=fs.readFileSync(path.join(__dirname,'../Regular/试炼任务美化.html'),'utf8');
        assert.match(trialUi,/if \(expectedSingle\)[\s\S]*stat_data\.任务\.副本成就/);

        const settlement=fs.readFileSync(path.join(__dirname,'../Regular/结算任务美化.html'),'utf8');
        assert.match(settlement,/function isSingleWorldMode/);
        assert.match(settlement,/if \(isSingleWorldMode\(\)\) return \[\];/);
        assert.match(settlement,/if \(!isSingleWorldSettlement\)[\s\S]*achievementTasks\.forEach/);

        const settlementPrompt=fs.readFileSync(path.join(__dirname,'../World Book/【结算任务】[mvu_plot].txt'),'utf8');
        assert.match(settlementPrompt,/单一世界没有副本成就：禁止读取、统计、展示副本成就任务，禁止发放成就盲盒/);
        const taskRules=fs.readFileSync(path.join(__dirname,'../World Book/⚙️任务与委托系统.txt'),'utf8');
        assert.match(taskRules,/单一世界不存在副本成就与成就盲盒/);
        assert.match(taskRules,/<%_ if \(!_.get\(rule_data, '设置\.单一世界', false\)\) \{ _%>[\s\S]*副本成就:/);

        const aux=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');
        assert.match(aux,/singleWorldAchievementClear/);
        assert.match(aux,/expectedAchievements = singleWorld \? \{\} : \(lock\.achievements \|\| \{\}\)/);
    });
    await test('actual settlement function clears ordinary world only, keeps relationships and both clocks', () => {
        const html=fs.readFileSync(path.join(__dirname,'../Regular/结算任务美化.html'),'utf8');
        const snippet=html.slice(html.indexOf('function applySettlementFinalization('),html.indexOf('function writeSettlementToMvu('));
        const finalize = new Function(`const rawText='轮回清算协议'; const hasSettlementHeader=()=>true; const isFullSettlement=()=>true; const isTrialPassed=()=>false; const trialTasks=[]; const readReincarnatorTier=()=> 'Ⅰ'; const settlementBaselineTier='Ⅰ'; ${snippet}; return applySettlementFinalization;`)();
        for (const single of [false,true]) {
            const stat=fresh(); stat.设置.单一世界=single; stat.系统状态.游玩天数=12;
            stat.关系列表.旅伴={好感度:10}; stat.世界.因果轨道.当前阶段='当前世界仍在持续推进。';
            stat.任务.列表.结束={状态:'可结算'};
            stat.任务.副本成就={旧成就:{状态:'已达成',奖励:'F级盲盒·测试世界'}};
            const time=stat.世界.时间;
            finalize({stat_data:stat},true);
            assert.equal(stat.世界.时间,time); assert.equal(stat.系统状态.游玩天数,12);
            assert.equal(stat.关系列表.旅伴.好感度,10);
            assert.equal(stat.任务.列表.结束,undefined);
            if (single) {assert.equal(stat.世界.因果轨道.当前阶段,'当前世界仍在持续推进。'); assert.ok(stat.任务.列表.调查); assert.deepEqual(stat.任务.副本成就,{}); assert.equal(stat.系统状态.是否在主神空间,false);}
            else {assert.deepEqual(stat.世界.后台,{});assert.deepEqual(stat.任务.副本成就,{});assert.equal(stat.系统状态.是否在主神空间,true);}
        }
        const historical=fresh(), before=clone(historical);
        finalize({stat_data:historical},false); assert.deepEqual(historical,before);
    });
    await test('relationship deletion retires matching backend person but never touches alien radar', () => {
        const source=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');
        const start=source.indexOf('function syncRemovedRelationshipPeople(');
        const end=source.indexOf('/**',start+20);
        const sync=new Function(source.slice(start,end)+';return syncRemovedRelationshipPeople;')();

        const before=fresh();
        before.关系列表={
            '玛 雅':{好感度:20},
            '异端甲':{好感度:-50},
            '保留者':{好感度:10}
        };
        before.世界.后台.人物={
            '玛雅':{...RECORDS.人物,所属世界:'测试世界',行动:'持续后台行动'},
            '异端甲':{...RECORDS.人物,所属世界:'测试世界',行动:'潜伏'},
            '纯后台NPC':{...RECORDS.人物,所属世界:'测试世界',行动:'巡逻'}
        };
        before.世界.异端雷达={当前模式:'混沌局',名单:{
            '异端甲':{来源:'原创',经历:'潜伏',阵营:'篡夺者',职业:'刺客',层级:'Ⅱ',状态:'活跃'}
        }};

        const after=clone(before);
        after.关系列表={保留者:{好感度:10}};
        const removed=sync(after,before);

        assert.deepEqual(removed.sort(),['异端甲','玛雅'].sort());
        assert.equal(after.世界.后台.人物.玛雅,undefined,'规范化同名后台人物应同步删除');
        assert.equal(after.世界.后台.人物.异端甲,undefined,'普通后台人物记录即使同名异端也应退休');
        assert.ok(after.世界.后台.人物.纯后台NPC,'从未进入关系列表的纯场外NPC不得误删');
        assert.ok(after.世界.异端雷达.名单.异端甲,'异端雷达名单必须完全独立，不随关系列表删除');
    });
    await test('alien death is irreversible and removes relationship plus backend activity while keeping radar history', () => {
        const source=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');
        const start=source.indexOf('function syncAlienLifecycle(');
        const end=source.indexOf('/**',start+20);
        const sync=new Function('console',source.slice(start,end)+';return syncAlienLifecycle;')({log:()=>{},warn:()=>{}});

        const before=fresh();
        before.世界.异端雷达={当前模式:'干涉局',名单:{
            异端甲:{来源:'原创',经历:'潜伏',阵营:'篡夺者',职业:'刺客',层级:'Ⅱ',状态:'活跃'},
            异端乙:{来源:'原创',经历:'阵亡',阵营:'篡夺者',职业:'战士',层级:'Ⅱ',状态:'死亡'}
        }};
        before.关系列表.异端甲={HP:100,状态:{},在场:true,好感度:-100};
        before.世界.后台.人物.异端甲={...RECORDS.人物,所属世界:'测试世界',行动:'潜伏'};
        before.世界.后台.人物.异端乙={...RECORDS.人物,所属世界:'测试世界',行动:'错误残留'};

        const after=clone(before);
        after.关系列表.异端甲.HP=0;
        after.世界.异端雷达.名单.异端乙.状态='活跃'; // 尝试把已死亡异端改回活跃
        const report=sync(after,before);

        assert.equal(after.世界.异端雷达.名单.异端甲.状态,'死亡','关系实体确认死亡时程序应同步异端雷达');
        assert.equal(after.世界.异端雷达.名单.异端乙.状态,'死亡','死亡异端状态不可逆');
        assert.equal(after.关系列表.异端甲,undefined,'死亡异端不再作为普通NPC发送给正文');
        assert.equal(after.世界.后台.人物.异端甲,undefined);
        assert.equal(after.世界.后台.人物.异端乙,undefined);
        assert.ok(after.世界.异端雷达.名单.异端甲,'雷达保留死亡记录用于历史追踪');
        assert.ok(report.死亡.includes('异端甲')&&report.死亡.includes('异端乙'));
    });
    await test('auxiliary callback skips duration ticks for engine commit but processes subsequent prose', () => {
        const source=fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8');
        const snippet=source.slice(source.indexOf('function onUpdateData('),source.indexOf('// ===== 轻量路径工具'));
        const names=['syncRemovedRelationshipPeople','syncAlienLifecycle','guardTaskGenerationLock','guardPersistedSystemTaskOwner','guardProtectedFields','clampNativeNpcToWorldTier','recalcAllCharacters','checkTrialEligibility','updatePlayDays','autoHarvestAssets','cleanupZeroQuantityItems','processStatusDuration','cleanupDeadNPCs','calcWorldStability','processCombatAndCooldowns'];
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
        for (const name of ['[variables]当前变量.txt','[mvu_update]变量更新规则.txt','⚙️额外思考.txt','【主神任务】[mvu_plot].txt','【试炼任务】[mvu_plot].txt','【结算任务】[mvu_plot].txt','⚙️任务与委托系统.txt']) {
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
    await test('dedicated world API takes precedence over terminal API and never silently falls back', async () => {
        let terminalCalls=0,enableCalls=0,fetchCalls=[];
        const storage={value:'',getItem:()=>storage.value||null,setItem:(_,v)=>{storage.value=v;}};
        const host={
            localStorage:storage,
            Samsara:{terminal:{
                apiReady:()=>true,
                enableApi:()=>{enableCalls++;return true;},
                request:async()=>{terminalCalls++;return 'terminal';}
            }},
            fetch:async(url,options)=>{
                fetchCalls.push({url,options});
                return {ok:true,status:200,statusText:'OK',json:async()=>({choices:[{message:{content:'dedicated'}}]})};
            }
        };
        const engine=new Engine(host);
        engine.setDedicatedApi({enabled:true,apiUrl:'https://api.example.test/v1',model:'world-model'});
        engine.setEnabled(true);
        assert.equal(engine.usesDedicatedApi(),true);
        assert.equal(engine.isAvailable(),true);
        assert.equal(enableCalls,0,'启用世界推进时专属API不得顺手开启主神终端API');
        assert.equal(await engine.requestAI('system','user',{}),'dedicated');
        assert.equal(terminalCalls,0,'专属API启用时不得调用 terminal.request');
        assert.equal(fetchCalls[0].url,'https://api.example.test/v1/chat/completions');
        engine.setDedicatedApi({enabled:false});
        assert.equal(await engine.requestAI('system','user',{}),'terminal');
        assert.equal(terminalCalls,1,'关闭专属API后才允许回退主神终端API');
    });
    await test('current-variable projection hides all backend data when world engine is inactive', () => {
        const source=fs.readFileSync(path.join(__dirname,'../World Book/[variables]当前变量.txt'),'utf8');
        const start=source.indexOf('if (current.世界) {',source.indexOf('// 后台完整状态'));
        const end=source.indexOf('// 世界超稳模式:',start);
        const render=new Function('current','data','readonly','_','isWorldEngineEnabled',source.slice(start,end));
        const lodash={get:(v,p,d)=>p.split('.').reduce((a,k)=>a?.[k],v)??d};
        const stat=fresh();
        stat.世界.因果轨道={当前阶段:'北门已经进入戒严阶段。',故事线:'封锁升级 -> 城区戒严 -> 战时管制',下一节点:'城区戒严',偏移记录:{秘密偏移:{描述:'隐藏',引发者:'幕后者',影响程度:-10}}};
        stat.世界.后台.事件={
            北门身份核验:{...RECORDS.事件,描述:'后台完整描述不得暴露',时间:'2026年9月7日上午',状态:'进行中',地点:'测试地点',分类:'当前事件',公开征兆:'守卫正在逐人检查证件。',可见影响:[{时间:'当前',地点:'测试地点',影响:'出城速度明显下降。'}],默认走向:'隐藏未来走向',条件:'隐藏条件'},
            远期政变:{...RECORDS.事件,描述:'隐藏宏观未来',时间:'2026年10月1日',状态:'待发生',地点:'王都',分类:'宏观节点',公开征兆:'不应提前显示'}
        };
        stat.世界.异端雷达={当前模式:'干涉局',名单:{
            异端甲:{来源:'原创',经历:'潜伏专家',阵营:'篡夺者',职业:'刺客',层级:'Ⅱ',状态:'活跃'},
            异端亡者:{来源:'原创',经历:'已阵亡',阵营:'篡夺者',职业:'战士',层级:'Ⅱ',状态:'死亡'}
        }};
        stat.世界.后台.人物={
            异端甲:{...RECORDS.人物,所属世界:'测试世界',地点:'遥远城南',目标:'观察玩家去向',行动:'混在人群中跟踪北门出入者',公开动态:'一名陌生旅人正在远处布置后续行动',状态:'潜伏',更新时间:'2026年9月6日下午',关联事件:[]},
            异端亡者:{...RECORDS.人物,所属世界:'测试世界',地点:'墓地',目标:'不应存在',行动:'诈尸'},
            守备官:{...RECORDS.人物,所属世界:'测试世界',地点:'测试地点',目标:'维持封锁',行动:'核查通行文件',公开动态:'守备官正在北门指挥检查',状态:'值勤',更新时间:'2026年9月7日上午',关联事件:['北门身份核验']},
            纯冷NPC:{...RECORDS.人物,所属世界:'测试世界',地点:'遥远村庄',目标:'种田',行动:'长期无关行动'}
        };
        stat.关系列表.守备官={好感度:10,在场:false};
        stat.世界.历法={名称:'隐藏历',月份天数:[31,28,31],闰年规则:''};
        for (const engineOn of [false,true]) {
            for (const space of [false,true]) {
                stat.系统状态.是否在主神空间=space;
                const current={世界:clone(stat.世界)},readonly={世界:{}};
                render(current,stat,readonly,lodash,engineOn);
                assert.equal(current.世界.后台,undefined);
                assert.equal(current.世界.历法,undefined,'正文/普通AI当前变量不得看到内部历法');
                if(engineOn&&!space){
                    assert.deepEqual(current.世界.因果轨道,stat.世界.因果轨道,'世界推进开启时非战斗正文应保留完整因果轨道，维持长期方向与偏移记忆');
                    assert.equal(current.世界.异端雷达.名单.异端甲.状态,'活跃','异端雷达本身继续对正文可见');
                    assert.deepEqual(readonly.世界.当前事件,[{
                        名称:'北门身份核验',
                        状态:'进行中',
                        时间:'2026年9月7日上午',
                        地点:'测试地点',
                        公开征兆:'守卫正在逐人检查证件。',
                        可见影响:[{时间:'当前',地点:'测试地点',影响:'出城速度明显下降。'}]
                    }]);
                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='异端甲'&&x.异端===true&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文人物动态');
                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='守备官'&&x.异端===false),'相关普通后台人物应进入正文人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='异端亡者'),false,'死亡异端不得进入正文动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='纯冷NPC'),false,'无关系、无当前事件、远离当前地点的冷人物不占正文Token');
                }else{
                    assert.equal(readonly.世界.当前事件,undefined);
                    assert.equal(readonly.世界.场外人物动态,undefined);
                    if(!space&&!engineOn)assert.equal(current.世界.因果轨道.故事线,'封锁升级 -> 城区戒严 -> 战时管制','关闭世界推进后沿用原因果轨道结构');
                }
                const visible=JSON.stringify([current,readonly]);
                assert.equal(visible.includes('隐藏宏观未来'),false);
                assert.equal(visible.includes('隐藏未来走向'),false);
                assert.equal(visible.includes('隐藏条件'),false);
            }
        }
    });
    await test('正文思考协议 consumes current stage and safe current-event projection without resimulating backend', () => {
        const think=fs.readFileSync(path.join(__dirname,'../World Book/⚙️额外思考.txt'),'utf8');
        assert.match(think,/因果轨道\.当前阶段/);
        assert.match(think,/故事线/);
        assert.match(think,/下一节点/);
        assert.match(think,/偏移记录/);
        assert.match(think,/叙事方向|方向约束/);
        assert.match(think,/不代表.*预知|不得.*预知/);
        assert.match(think,/当前事件/);
        assert.match(think,/场外人物动态/);
        assert.match(think,/目标.*行动|行动.*目标/);
        assert.match(think,/异端.*活动|活跃异端/);
        assert.match(think,/人物动态.*不代表.*知情|不得.*人物动态.*角色知情/);
        assert.match(think,/公开征兆/);
        assert.match(think,/可见影响/);
        assert.match(think,/必须自然体现/);
        assert.match(think,/不得重新推演.*后台/);
        assert.doesNotMatch(think,/正文承接/);
    });
    await test('terminal settings do not claim shared API when world engine uses a dedicated API', () => {
        const terminalSource=fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8');
        assert.match(terminalSource,/worldEngine\.usesDedicatedApi/);
        assert.match(terminalSource,/等待世界推进专属 API 配置/);
        assert.match(terminalSource,/世界推进「设置」中完成专属 API 配置/);
        assert.doesNotMatch(terminalSource,/data-act="world-engine-settings"/,'状态栏设置面板不再提供世界推进设置按钮');
        assert.doesNotMatch(terminalSource,/世界推进已开启，额外 API 已自动启用/);
        assert.doesNotMatch(terminalSource,/世界推进暂停|世界推进可使用自托管 API/,'共享 API 文案不得把专属世界推进误判为暂停或共用');
    });
    await test('updated JS and embedded settlement scripts compile', () => {
        new vm.Script(source);
        new vm.Script(fs.readFileSync(path.join(__dirname,'../script/悬浮球状态栏.js'),'utf8'));
        new vm.Script(fs.readFileSync(path.join(__dirname,'../script/辅助计算脚本.js'),'utf8'));
        for (const htmlName of ['结算任务美化.html','主神任务美化.html','试炼任务美化.html']) {
            const html=fs.readFileSync(path.join(__dirname,'../Regular',htmlName),'utf8');
            for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
        }
        const zod=fs.readFileSync(path.join(__dirname,'../script/ZOD脚本.js'),'utf8').replace(/^import .*;$/m,'').replace('export const Schema','const Schema');
        new vm.Script(zod);
    });
    console.log(`${tests} tests passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
