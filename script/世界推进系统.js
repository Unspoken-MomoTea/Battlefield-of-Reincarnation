/* 轮回战场 · 世界引擎
 * 从参考异步助手迁移：旧状态回读、增量补丁、分层投影、楼层隔离、后台调度。
 * 专用实现：六个业务模块共用一次推演；MVU 是唯一持久状态；复用主神终端 API。
 * 在酒馆脚本库中独立加载。接口位于父窗口 Samsara.worldEngine。
 */
(function (root) {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    function digest(text) {
        let a = 2166136261, b = 5381;
        for (let i=0;i<text.length;i++) { a = Math.imul(a ^ text.charCodeAt(i),16777619); b = Math.imul(b,33) ^ text.charCodeAt(i); }
        return (a >>> 0).toString(16) + (b >>> 0).toString(16) + ':' + text.length;
    }
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
    const CONFIG = 'samsara_world_engine_v1';
    const PATH = '后台';
    const EVENT_TARGET = 180;
    const HISTORY_TARGET = 200;
    const TECHNICAL_BOOK = [/^\[variables\]/i,/^\[mvu_update\]/i,/^output_format_/i,/^⚙️额外思考(?:\.|$)/,/^行动选项_/i,/^【(?:主神任务|结算任务|试炼任务|选择世界)】/];
    const isTechnicalBook = title => TECHNICAL_BOOK.some(rule => rule.test(String(title || '').trim()));
    function isTimelineBackboneEntry(title) {
        const name=String(title||'').replace(/\s+/g,'');
        if(/(?:变量|输出格式|更新规则|COT|思考|风格|助手|状态栏)/i.test(name))return false;
        return /(?:校历|世界年表|事件年表|原著年表|时间线|时间轴|大事记|大事件摘要|历史大事件|剧情大纲|剧情章节|章节控制器|主线年表)/i.test(name);
    }
    function worldDateKey(value) {
        const source=String(value||'');
        let m=source.match(/(\d{1,4})\s*年\s*-?\s*(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/);
        if(!m)m=source.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
        if(!m)return null;
        const part=source.match(/凌晨|黎明|清晨|早晨|上午|中午|午后|下午|傍晚|入夜|晚上|深夜/);
        const hour={凌晨:2,黎明:5,清晨:6,早晨:8,上午:10,中午:12,午后:14,下午:15,傍晚:18,入夜:19,晚上:20,深夜:23};
        return (+m[1]*372 + +m[2]*31 + +m[3])*24+(part?hour[part[0]]:0);
    }
    const DEFAULT_PRESET = `你是轮回战场的世界演进主持者。以当前世界的已确认状态、本轮实际剧情、模型已有的世界/原著知识，以及存在时可用的世界书补充设定为依据，统一处理六个模块：
【世界推进】世界推进的首要职责是维护“宏观世界演进”，不是替正文重复每个细节。世界.因果轨道是3~5个宏观大事件的简明投影，后台.事件则是它的展开版调度图；事件分类固定使用“当前事件 / 近期节点 / 宏观节点”（旧存档兼容可暂留“主线节点”）。
先建立宏观骨架：原著世界优先结合当前已确认事实与模型已有的原著知识，推导当前时间之后仍应存在的关键篇章转折、世界级灾难、战争/政权变化、基础设施级失效、关键人物命运与主角团重大迁移；世界书若存在则作为额外设定、同人差异和时间资料的补充校正，若没有世界书也必须正常推演。原创/衍生世界则依据当前世界法则、既有历史与势力格局推导宏观节点。
再做区间桥接：确定“当前时间之后的下一个宏观节点”，只把当前时间 → 该宏观节点之间需要实际发生的内容展开为当前事件与近期节点；角色管理、势力变化、探索线索、传闻传播均服务于这段区间。下一个宏观节点之后的内容保持宏观锚点，不提前拆成大量琐碎行动。到达宏观边界后，再滚动展开下一段。过去事实约束未来，未来计划不得记成已发生事实。
【世界演进准则】原著世界必须结合当前时间锚点、当前地点、当前剧情阶段、已知角色状态、原著人物行动规律、世界势力动态与模型已有的原著知识；据此先判断宏观剧情与世界事件，再推演当前到下一宏观节点之间的人物行动、势力变化和局部剧情。世界书不是必需前提；若存在且与模型一般知识冲突，以当前变量与明确世界书设定为准。原创/衍生世界基于当前世界法则、本土势力动态和已发生历史持续推演。通用原则：世界持续运行，不因<user>未行动而暂停。
【因果轨道与偏移】世界.因果轨道是后台事件图的宏观投影，不是第二套独立剧情。故事线必须维持3~5个默认大事件节点，用“ -> ”串联并覆盖当前阶段前后；下一节点是下一个宏观边界或检查点。仅在章节切换、地图切换、关键任务完成或重大剧情事件发生时更新。只有关键人物命运、重大事件、势力格局或主线被玩家/其他人物实质改变时才写偏移记录，日常、战斗动作、交易、对话不记偏移。偏移记录写明描述、引发者、影响程度；负值表示使原轨道更不稳定，正值表示修复/强化原轨道。新增偏移后若原主线无法继续，立即重构故事线与下一节点；否则保留原轨道。世界超稳时不得新增偏移。
【角色管理】维护场外人物所在世界、地点、目标、行动、已知信息、行程及下次检查条件。场外行动受路程、资源、能力及认知限制。在场人物以正文为准，不能替玩家行动或裁决未结束战斗；不得为<user>建立或推进后台行动日程。人物记录与关系列表按稳定名字关联，不编造整套人物属性。
【探索与势力】处理势力目标、资源、冲突、地区变化、探索线索。声望变化必须有真实行为依据，不能因为经过时间自动涨落。未知探索点保留在内部地区记录，发现后才投影到世界.探索。
【任务联动】任务不是第二套剧情树。仅依据后台事件的实际结果更新已有任务或成就状态；主神任务、晋升试炼的创建、奖励定义与发奖由原系统负责。旧后台.剧本只作存档兼容，不新增、不更新，也不依赖阶段推进。
【信息传播】世界引擎负责场外传闻与传播链。事件产生街头巷议、付费情报或公告，区分事实、猜测、谣言；记录传播来源、范围、时间和关联事件。人物只有获得信息后才能据此行动。传闻可产生新事件，但禁止无因果地每轮刷新。进入城镇、营地、聚集地等非战斗区域时，只有确有新传播事实才维护1~3条街头巷议并淘汰失效旧闻；处于交易区、酒馆、黑市等真实情报交易场所时，可维护1~2条付费情报，字段必须包含卖家、情报评级、购买前摘要、带本地货币单位的要价和仅AI可见的真实内幕；任务世界不得使用空间币定价。到达主要城镇或新大区域时，公告/檄文必须有真实发布者并关联当前势力。当前场景内用户刚刚直接购买情报的支付、remove及转化为任务/探索由普通MVU处理，世界引擎下一轮只同步其场外传播后果，不重复扣款或重复创建任务。
只使用世界.时间计算本世界进展；系统状态.游玩天数仅作只读参考。时间未变也可记录本轮新事实，但不得虚构耗时进度。跨多个日期需按依赖顺序补算，先处理到期事件再生成后果。
事件分待发生、进行中、已完成、已取消；受玩家当前互动影响而尚无结果时保持进行中。宏观远期节点允许时间未定，禁止捏造精确日期。
世界超稳时保持默认宏观轨道，不新增偏移。单一世界的局部结算不能重置世界。普通副本返回主神空间后停止本世界推演。
初始化时依据当前设定建立必要的近远期节点；无依据的记录保持空。没有变化就返回空补丁。公开摘要只包含当前可观察的事实、征兆和已知线索，隐藏真相和未来结局留在后台。`;
    const CORE_WORLD_RULES = `【世界引擎核心约束】
1. 宏观优先：因果轨道是3~5个大事件的摘要窗口，后台.事件是其展开版。每轮先检查宏观骨架是否成立，再处理细节；不得用当前地点的多个小行动冒充宏观节点。
2. 知识来源：当前变量与已确认剧情优先级最高；有世界书时用其补充/校正作品设定与同人差异；没有世界书时必须使用模型已有的原著/世界知识继续建立宏观事件，不能因资料条目缺失而只写眼前剧情。
3. 区间桥接：宏观骨架存在后，以“当前时间 → 下一宏观节点”为本轮细节推演边界。当前事件、近期节点、场外人物行动、势力变化、探索与传播只展开到这个边界；更远未来保持宏观节点，等边界接近后再展开。
4. 世界推演：原著世界结合当前时间锚点、地点、剧情阶段、已知角色状态、原著人物行动规律、世界势力动态与已知原著进程；原创/衍生世界依据世界法则、本土势力与历史持续运行。世界不会因为<user>没行动而暂停。
5. 偏移：玩家或其他人物只有实质改变关键人物命运、重大事件结果、势力格局或主线可行性时才写偏移。偏移导致默认宏观事件不再成立时，同轮修订宏观事件图、故事线与下一节点；日常动作、普通交易或对话不记偏移。
6. 职责隔离：场外人物、势力、未来事件与传播由世界引擎负责；正文/MVU只负责当前场景直接事实与即时消费。旧后台.剧本不参与调度。用户可编辑分段提示词，但以上核心约束始终生效。`
    function splitPresetSegments(value) {
        return String(value||'').split(/\n(?=【)/).filter(Boolean).map(part=>{
            const m=part.match(/^【([^】]+)】\s*\n?/);
            return m?{title:m[1],body:part.slice(m[0].length)}:{title:'',body:part};
        });
    }
    function segmentText(segment) {
        return segment.title?'【'+segment.title+'】\n'+String(segment.body||'').trim():String(segment.body||'').trim();
    }
    function ensurePresetStructure(value) {
        const current=splitPresetSegments(value||DEFAULT_PRESET).map(segment=>segment.title==='势力与地区'?{...segment,title:'探索与势力'}:segment);
        const defaults=splitPresetSegments(DEFAULT_PRESET);
        const titles=new Set(current.map(s=>s.title).filter(Boolean));
        for(const segment of defaults)if(segment.title&&!titles.has(segment.title))current.push(segment);
        return current.map(segmentText).filter(Boolean).join('\n');
    }
    const RECORDS = {
        事件: { 描述:'', 时间:'', 条件:'', 前因:[], 状态:'待发生', 默认走向:'', 结果:'', 公开征兆:'', 地点:'' },
        人物: { 所属世界:'', 地点:'', 目标:'', 行动:'', 认知:[], 下次检查:'', 关联事件:[], 公开动态:'' },
        势力地区: { 类型:'地区', 描述:'', 目标:'', 进展:'', 下次检查:'', 关联事件:[], 公开动态:'' },
        剧本: { 描述:'', 关联任务:[], 前置条件:'', 下一节点:'', 关联事件:[], 公开动态:'' },
        历史: { 时间:'', 事实:'', 关联事件:[] },
        传播: { 关联事件:[], 来源:'', 范围:'', 时间:'', 内容:'', 真相:'', 状态:'传播中' }
    };
    // 可选明细兼容第一版记录：对应参考助手的行程、承诺、认知、资源及任务阶段。
    const DETAILS = {
        事件: {分类:'',开始时间:'',预计结束:'',更新时间:'',下次检查:'',参与者:[],关联任务:[],可见影响:[{时间:'',地点:'',影响:''}]},
        人物: {状态:'',更新时间:'',开始时间:'',预计结束:'',行程:[{开始:'',结束:'',地点:'',行动:'',状态:'',结果:''}],承诺:[{对象:'',内容:'',期限:'',解除条件:''}],待决事项:[{问题:'',选项:[],等待:''}],关系变化:[{对象:'',关系:'',变化:'',时间:''}],认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:''},
        势力地区: {更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[]},
        剧本: {状态:'',来源:'',更新时间:'',期限:'',完成条件:'',失败条件:'',结果:'',参与者:[],地点:[],阻碍:[],阶段:[{名称:'',状态:'',时间:'',说明:'',前置阶段:''}]},
        历史:{},传播:{更新时间:'',到期时间:'',受众:[],引发行动:[]}
    };
    const MODEL_RECORDS = Object.fromEntries(Object.entries(RECORDS).filter(([name])=>name!=='剧本'));
    const MODEL_DETAILS = copy(DETAILS);
    delete MODEL_DETAILS.剧本;
    for (const key of ['承诺','待决事项','关系变化']) delete MODEL_DETAILS.人物[key];

    function collectEventRefs(state) {
        const refs=new Set();
        for(const event of Object.values(state.事件||{}))for(const id of event.前因||[])refs.add(id);
        for(const category of ['人物','势力地区','传播'])for(const record of Object.values(state[category]||{}))for(const id of record.关联事件||[])refs.add(id);
        return refs;
    }
    function compactFinishedEvents(stat,target=EVENT_TARGET) {
        const state=stat?.世界?.[PATH]; if(!state?.事件)return [];
        const archived=[];
        while(Object.keys(state.事件).length>target){
            const refs=collectEventRefs(state);
            const candidate=Object.entries(state.事件).find(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name));
            if(!candidate)break;
            const [name,event]=candidate;
            let key='归档·'+name,seq=2;
            while(Object.hasOwn(state.历史||{},key))key='归档·'+name+'#'+seq++;
            state.历史=state.历史||{};
            state.历史[key]={时间:event.时间||event.更新时间||stat.世界.时间||'',事实:event.结果||event.描述||(event.状态==='已取消'?'事件已取消':'事件已结束'),关联事件:[]};
            delete state.事件[name]; archived.push(name);
        }
        const historyKeys=Object.keys(state.历史||{});
        if(historyKeys.length>HISTORY_TARGET)for(const key of historyKeys.slice(0,historyKeys.length-HISTORY_TARGET))delete state.历史[key];
        return archived;
    }
    function storyStages(value) {
        return String(value||'').split(/\s*(?:→|⇒|->|=>|\n)\s*/).map(x=>x.trim()).filter(x=>x&&!/^(待初始化|无|未知)$/.test(x));
    }
    function repairCausalProjection(stat) {
        const orbit=stat.世界.因果轨道||(stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}});
        const existing=storyStages(orbit.故事线);
        const macroEntries=Object.entries(stat.世界[PATH]?.事件||{})
            .filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消')
            .map((item,index)=>({item,index,key:worldDateKey(item[1].时间||item[1].开始时间)}))
            .sort((a,b)=>(a.key??Infinity)-(b.key??Infinity)||a.index-b.index)
            .map(x=>x.item);
        const macroNames=new Set(macroEntries.map(([name])=>name));
        if(existing.length>=3&&existing.length<=5&&existing.every(name=>macroNames.has(name)))return [];
        // 因果轨道只能由宏观事件投影。宏观事实不足时宁可等待模型补齐，
        // 也不能拿当前事件/近期节点凑出一条“看似完整”的故事线。
        if(macroEntries.length<3)return [];
        const chosen=[],seen=new Set();
        const take=name=>{if(name&&macroNames.has(name)&&!seen.has(name)){seen.add(name);chosen.push(name);}};
        take(orbit.当前阶段);
        for(const [name] of macroEntries)take(name);
        if(chosen.length<3)return [];
        const line=chosen.slice(0,5),patches=[];
        const story=line.join(' -> ');
        if(orbit.故事线!==story){orbit.故事线=story;patches.push({op:'replace',path:'/世界/因果轨道/故事线',value:story});}
        const nextName=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='待发生')||orbit.下一节点||'';
        if(nextName&&orbit.下一节点!==nextName){orbit.下一节点=nextName;patches.push({op:'replace',path:'/世界/因果轨道/下一节点',value:nextName});}
        const current=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='进行中');
        if(current&&(!orbit.当前阶段||orbit.当前阶段==='待初始化')){orbit.当前阶段=current;patches.push({op:'replace',path:'/世界/因果轨道/当前阶段',value:current});}
        return patches;
    }
    function timelineState(stat) {
        const state=stat.世界[PATH],events=Object.entries(state.事件||{}),now=worldDateKey(stat.世界.时间);
        const waiting=events.filter(([,e])=>['待发生','进行中'].includes(e.状态));
        const near=events.filter(([,e])=>['当前事件','近期节点'].includes(e.分类));
        const macro=events.filter(([,e])=>e.分类==='宏观节点');
        const macroFuture=macro.filter(([,e])=>e.状态==='待发生');
        const expand=macroFuture.filter(([,e])=>{const t=worldDateKey(e.时间||e.开始时间);return now!==null&&t!==null&&t>=now&&t-now<=7*24;});
        const semantic=waiting.filter(([,e])=>String(e.时间||e.开始时间||'').trim()&&worldDateKey(e.时间||e.开始时间)===null);
        const orbit=stat.世界.因果轨道||{},orbitStages=storyStages(orbit.故事线);
        const macroNames=new Set(macro.map(([name])=>name));
        const orbitProjectionInvalid=orbitStages.length<3||orbitStages.length>5||orbitStages.some(name=>!macroNames.has(name));
        const orbitMacro=macroFuture.find(([name])=>name===orbit.下一节点);
        const datedMacro=macroFuture.map((item,index)=>({item,index,key:worldDateKey(item[1].时间||item[1].开始时间)}))
            .filter(x=>x.key!==null&&(now===null||x.key>=now))
            .sort((a,b)=>a.key-b.key||a.index-b.index);
        const nextPair=orbitMacro||datedMacro[0]?.item||macroFuture[0]||null;
        const nextMacro=nextPair?{
            名称:nextPair[0],
            时间:nextPair[1].时间||nextPair[1].开始时间||'',
            分类:nextPair[1].分类||'',
            条件:nextPair[1].条件||'',
            前因:nextPair[1].前因||[],
            来源:'宏观事件图'
        }:null;
        return {
            当前时间锚点:stat.世界.时间,
            因果轨道节点数:orbitStages.length,
            因果轨道需重建:orbitProjectionInvalid,
            需要初始化:near.length===0&&macro.length===0,
            当前活动事件数:waiting.filter(([,e])=>e.状态==='进行中').length,
            近期节点数:near.length,
            宏观节点数:macro.length,
            需要补充远期:macroFuture.length<3,
            下一宏观节点:nextMacro,
            桥接区间:{
                起点:stat.世界.时间,
                终点:nextMacro?.时间||'待建立宏观节点',
                边界事件:nextMacro?.名称||''
            },
            需要展开的宏观节点:expand.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因})),
            需语义复核节点:semantic.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,下次检查:e.下次检查})),
            说明:'先用因果轨道、当前事实与模型已有世界/原著知识建立宏观骨架；世界书若存在只作补充校正。随后仅展开当前时间到下一宏观节点之间的近期事件、人物、势力与传播。非公历或作品内时间按作品语义比较，不强行改写为公历。'
        };
    }
    function emptyState() {
        return { 版本:2, 已处理楼层:'', 已处理时间:'', 公开摘要:'', 事件:{}, 人物:{}, 势力地区:{}, 剧本:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[] };
    }
    // 只拆显式分隔的阶段，不把自然语言段落猜成多个事件，也不凭空分配日期。
    function importStory(stat) {
        const orbit=stat.世界.因果轨道||{},events=stat.世界.后台?.事件||{};
        if(Object.values(events).some(e=>e.分类==='主线节点'))return [];
        const stages=storyStages(orbit.故事线);
        if(stages.length<2||stages.length>30)return [];
        const index=stages.findIndex(n=>n===orbit.下一节点);
        const remaining=index>=0?stages.slice(index):stages;
        let previous='';
        return remaining.filter(name=>!Object.hasOwn(events,name)).map(name=>{
            const value={...copy(RECORDS.事件),描述:name,分类:'主线节点',前因:previous?[previous]:[],条件:previous?'前置节点「'+previous+'」达到进入本阶段所需的条件':'待依据世界设定与正文明确触发条件',下次检查:'本轮首次排程'};
            previous=name;
            return {op:'add',path:'/世界/后台/事件/'+name.replace(/~/g,'~0').replace(/\//g,'~1'),value};
        });
    }
    function tokens(path) {
        if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('补丁路径必须以 / 开头');
        const parts = path.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (parts.some(p => !p || forbidden.has(p))) throw new Error('补丁路径含非法键');
        return parts;
    }
    function get(obj, parts) {
        return parts.reduce((v, key) => v != null && Object.prototype.hasOwnProperty.call(v, key) ? v[key] : undefined, obj);
    }
    function pointer(parts) {
        return '/'+parts.map(p=>String(p).replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
    }
    const nameKey=value=>String(value||'').toLowerCase().replace(/[\\/／·・._\-\s]+/g,'');
    function canonicalizeParts(parts,stat) {
        const p=parts.slice();
        if(p[0]==='世界'&&p[1]===PATH&&p[3]&&['人物','事件','势力地区'].includes(p[2])){
            const pools=[];
            const state=stat?.世界?.[PATH]||{};
            if(plain(state[p[2]]))pools.push(...Object.keys(state[p[2]]));
            if(p[2]==='人物'){
                pools.push(...Object.keys(stat?.关系列表||{}));
                pools.push(...Object.keys(stat?.世界?.异端雷达?.名单||{}));
            }
            const key=nameKey(p[3]),matches=[...new Set(pools)].filter(name=>nameKey(name)===key);
            if(matches.length===1)p[3]=matches[0];
        }
        return p;
    }
    function bootstrapBackendParent(stat,parts) {
        if(parts[0]!=='世界'||parts[1]!==PATH||parts.length!==5)return;
        const category=parts[2],name=parts[3];
        if(!['事件','人物','势力地区','传播'].includes(category))return;
        const bucket=stat.世界[PATH][category]||(stat.世界[PATH][category]={});
        if(Object.hasOwn(bucket,name))return;
        const seed=category==='事件'?{描述:name}:category==='人物'?{所属世界:stat.世界.名称||'',地点:'',行动:''}:{};
        bucket[name]=normalizeBackendRecord(category,seed);
    }
    function canUpsertMissing(parts,stat) {
        if(parts[0]==='世界'&&parts[1]===PATH){
            if(parts[2]==='历史'||parts[2]==='剧本')return false;
            if(parts.length===4&&['事件','人物','势力地区','传播'].includes(parts[2]))return true;
            if(parts.length===5&&['事件','人物','势力地区','传播'].includes(parts[2])&&!!get(stat,parts.slice(0,4)))return true;
        }
        if(parts[0]==='世界'&&parts[1]==='因果轨道'&&parts[2]==='偏移记录'&&parts.length===4)return true;
        if(parts[0]==='世界'&&['势力','探索'].includes(parts[1])&&parts.length===3)return true;
        if(parts[0]==='传闻'&&['街头巷议','情报交易','布告与檄文'].includes(parts[1])&&parts.length===3)return true;
        return false;
    }
    function checkRecord(value, template, optional = {}) {
        if(!plain(value))throw new Error('记录必须是完整对象，不能是文本或数组');
        const missing=Object.keys(template).filter(k=>!Object.hasOwn(value,k));
        const unknown=Object.keys(value).filter(k=>!Object.hasOwn(template,k)&&!Object.hasOwn(optional,k));
        if(missing.length||unknown.length)throw new Error('记录字段不完整或不受支持：'+(missing.length?'缺少 '+missing.join('、'):'')+(unknown.length?'；未知 '+unknown.join('、'):''));
        for (const [key, base] of Object.entries(template)) {
            const v = value[key];
            if (Array.isArray(base) ? !Array.isArray(v) || v.some(x => typeof x !== 'string') : typeof v !== typeof base) throw new Error('记录字段类型错误：' + key);
        }
    }
    function checkDetails(value, optional) {
        for (const [key, base] of Object.entries(optional)) {
            if (!Object.hasOwn(value,key)) continue;
            const v=value[key];
            if (Array.isArray(base)) {
                if (!Array.isArray(v)) throw new Error('明细需为列表：'+key);
                if (base.length) v.forEach(item=>checkRecord(item,base[0]));
                else if (v.some(item=>typeof item !== 'string')) throw new Error('明细需为文本列表：'+key);
            } else if (typeof v !== typeof base) throw new Error('明细类型错误：'+key);
        }
    }
    // LLM 常会只返回本轮实际变化的字段。后台整记录在安全边界内自动补默认值/合并旧值，
    // 未知字段直接丢弃；可选明细若提供，仍按完整明细结构严格校验。
    function normalizeBackendRecord(category,value,old) {
        if(!plain(value)||!Object.hasOwn(RECORDS,category))return value;
        const template=RECORDS[category],optional=DETAILS[category]||{};
        const out=Object.assign(copy(template),plain(old)?copy(old):{});
        for(const [key,item] of Object.entries(value)){
            if(Object.hasOwn(template,key)||Object.hasOwn(optional,key))out[key]=copy(item);
        }
        return out;
    }
    function normalizeBackendState(stat) {
        const state=stat?.世界?.[PATH]; if(!state)return stat;
        for(const category of Object.keys(RECORDS)){
            if(!plain(state[category]))state[category]={};
            for(const [name,value] of Object.entries(state[category])){
                if(plain(value))state[category][name]=normalizeBackendRecord(category,value);
            }
        }
        return stat;
    }
    const MODEL_IGNORED_PATHS = [
        /^\/系统状态\/待播报记录$/,
        /^\/世界\/后台\/(?:版本|已处理楼层|已处理时间|运行记录|最近变化)(?:\/|$)/,
        /^\/世界\/后台\/剧本(?:\/|$)/
    ];
    function sanitizeModelPatches(patches) {
        if(!Array.isArray(patches))return patches;
        return patches.filter(p=>!(plain(p)&&typeof p.path==='string'&&MODEL_IGNORED_PATHS.some(rule=>rule.test(p.path))));
    }
    function normalizeModelPatches(patches) {
        if(!Array.isArray(patches))return patches;
        const out=[],esc=value=>String(value).replace(/~/g,'~0').replace(/\//g,'~1');
        for(const raw of patches){
            if(!plain(raw)){out.push(raw);continue;}
            const patch=copy(raw);
            if(typeof patch.path==='string')patch.path=patch.path.replace(/^\/世界\/因校轨道(?=\/|$)/,'/世界/因果轨道');
            if(patch.path==='/世界/因果轨道'&&patch.op!=='remove'&&plain(patch.value)){
                for(const key of ['当前阶段','故事线','下一节点']){
                    if(Object.hasOwn(patch.value,key))out.push({op:'add',path:'/世界/因果轨道/'+key,value:copy(patch.value[key])});
                }
                if(plain(patch.value.偏移记录))for(const [name,value] of Object.entries(patch.value.偏移记录)){
                    out.push({op:'add',path:'/世界/因果轨道/偏移记录/'+esc(name),value:copy(value)});
                }
                continue;
            }
            if(patch.path==='/世界/因果轨道/偏移记录'&&patch.op!=='remove'&&plain(patch.value)){
                for(const [name,value] of Object.entries(patch.value))out.push({op:'add',path:'/世界/因果轨道/偏移记录/'+esc(name),value:copy(value)});
                continue;
            }
            out.push(patch);
        }
        return out;
    }
    function retryableModelFailure(error) {
        const message=String(error?.message||error||'');
        if(!message)return false;
        if(/^(?:请求已取消|上下文已经切换|推演期间世界时间或副本锚点发生变化|请在主神终端设置|请加载更新后的|禁止写入：)/.test(message))return false;
        if(error?.name==='AbortError')return false;
        return true;
    }
    function retryInput(baseInput,error,lastReply,attempt,maxRetries) {
        let payload;try{payload=JSON.parse(baseInput);}catch(_){payload={原始请求:baseInput};}
        payload.纠错重试={
            当前重试:attempt,
            最大重试次数:maxRetries,
            上次拒绝原因:String(error?.message||error||''),
            上次模型回复:String(lastReply||'').slice(-12000),
            要求:'重新输出完整 <world_update>。保留已确认事实，只修正导致拒绝的路径、结构、字段、因果关系或宏观事件缺失；不要解释错误。'
        };
        return JSON.stringify(payload,null,2);
    }
    // 仅允许世界叙事字段；数值属性、货币、奖励发放和时钟不在写入名单内。
    function allowed(parts, stat) {
        const [a,b,c,d] = parts;
        if (a === '世界' && b === PATH) {
            if (parts.length === 3 && c === '公开摘要') return true;
            if (c === '剧本') return false;
            if (!Object.hasOwn(RECORDS, c) || !d) return false;
            if (c === '历史') return parts.length === 4;
            return parts.length === 4 || (parts.length === 5 && (Object.hasOwn(RECORDS[c], parts[4]) || Object.hasOwn(DETAILS[c],parts[4])));
        }
        if (a === '世界' && b === '因果轨道') {
            if (['当前阶段','故事线','下一节点'].includes(c)) return parts.length === 3;
            return !(stat.设置 || {}).世界超稳 && c === '偏移记录' && parts.length === 4;
        }
        if (a === '世界' && ['势力','探索'].includes(b)) return parts.length === 3 || (parts.length === 4 && Object.hasOwn(b === '势力' ? {实力:0,领地:0,描述:0,声望:0} : {风险:0,探索度:0,描述:0,隐藏真相:0},d));
        if (a === '世界' && b === '异端雷达') return parts.length === 4 && c === '名单' && !(stat.设置 || {}).单一世界;
        if (a === '传闻' && ['街头巷议','情报交易','布告与檄文'].includes(b)) return parts.length === 3;
        // 人物动态在后台.人物中管理；直接关系变动只允许既有人物的好感度。
        if (a === '关系列表') return parts.length === 3 && c === '好感度' && !!get(stat,[a,b]);
        if (a === '任务') return parts.length === 4 && ['列表','副本成就'].includes(b) && d === '状态' && !!get(stat,[a,b,c]);
        return false;
    }
    const EXISTING = {
        势力: {实力:'',领地:'',描述:'',声望:0}, 探索:{风险:'',探索度:0,描述:'',隐藏真相:''},
        偏移记录:{描述:'',引发者:'',影响程度:0},
        街头巷议:{来源:'',内容:'',可信度:''}, 情报交易:{卖家:'',情报评级:'',摘要:'',要价:'',真实内幕:''},
        布告与檄文:{发布者:'',内容:'',张贴位置:''},
        名单:{来源:'',经历:'',阵营:'',职业:'',层级:'',状态:''}
    };
    function validateState(stat) {
        const state = stat.世界[PATH];
        if (typeof state.公开摘要 !== 'string' || state.公开摘要.length > 5000) throw new Error('公开摘要限 5000 字');
        for (const [category, template] of Object.entries(RECORDS)) {
            if (!plain(state[category]) || Object.keys(state[category]).length > 300) throw new Error(category + '记录过多或结构错误');
            for (const [name,value] of Object.entries(state[category])) {
                if (forbidden.has(name)) throw new Error('非法记录名');
                checkRecord(value,template,DETAILS[category]);
                checkDetails(value,DETAILS[category]);
            }
        }
        for (const [name,event] of Object.entries(state.事件)) {
            if (!['待发生','进行中','已完成','已取消'].includes(event.状态)) throw new Error('非法事件状态');
            if (event.前因.some(id => !Object.hasOwn(state.事件,id))) throw new Error('事件前因不存在：' + name);
        }
        const ranks = ['F','E','D','C','B','A','S','SS','SSS'];
        const range = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
        for (const item of Object.values(stat.世界.势力 || {})) if (!ranks.includes(item.实力) || !range(item.声望,-5000,10000)) throw new Error('势力品质或声望越界');
        for (const item of Object.values(stat.世界.探索 || {})) if (!ranks.includes(item.风险) || !range(item.探索度,0,100)) throw new Error('探索品质或进度越界');
        for (const item of Object.values((stat.世界.因果轨道 || {}).偏移记录 || {})) if (!range(item.影响程度,-100,120)) throw new Error('因果偏移越界');
        for (const item of Object.values(stat.关系列表 || {})) if (!range(item.好感度,-100,100)) throw new Error('人物好感越界');
        for (const item of Object.values((stat.任务 || {}).列表 || {})) if (!['进行中','可交付','可结算','失败'].includes(item.状态)) throw new Error('任务状态无效');
        for (const item of Object.values((stat.任务 || {}).副本成就 || {})) if (!['未达成','已达成'].includes(item.状态)) throw new Error('成就状态无效');
        for (const category of ['街头巷议','情报交易','布告与檄文']) {
            const items = Object.values((stat.传闻 || {})[category] || {});
            if (items.length > 3) throw new Error('每类当前传闻最多3条');
            if (category === '街头巷议' && items.some(i => !['酒话','可疑','或许可信'].includes(i.可信度))) throw new Error('传闻可信度无效');
        }
        const visiting = new Set(), visited = new Set();
        function visit(name) {
            if (visiting.has(name)) throw new Error('事件前因形成循环');
            if (visited.has(name)) return;
            visiting.add(name); state.事件[name].前因.forEach(visit); visiting.delete(name); visited.add(name);
        }
        Object.keys(state.事件).forEach(visit);
        for (const category of ['人物','势力地区','传播']) {
            for (const record of Object.values(state[category])) if (record.关联事件.some(id => !Object.hasOwn(state.事件,id))) throw new Error('关联事件不存在');
        }
    }
    function applyPatches(stat, patches) {
        if (!Array.isArray(patches) || patches.length > 100) throw new Error('每轮最多 100 条补丁');
        const next = copy(stat);
        next.世界[PATH] = Object.assign(emptyState(), next.世界[PATH] || {});
        normalizeBackendState(next);
        for (const patch of patches) {
            if (!plain(patch) || !['add','replace','remove'].includes(patch.op)) throw new Error('不支持的补丁操作');
            let p = canonicalizeParts(tokens(patch.path),next);
            patch.path=pointer(p);
            if (!allowed(p,next)) throw new Error('禁止写入：' + patch.path);
            bootstrapBackendParent(next,p);
            const old = get(next,p);
            if (p[1] === PATH && p[2] === '历史' && (patch.op !== 'add' || old !== undefined)) throw new Error('历史只允许新增');
            // 世界模型经常把“首次设置”写成 replace；对允许创建的世界记录按 upsert 处理。
            if (patch.op !== 'add' && old === undefined && !canUpsertMissing(p,next)) throw new Error('目标不存在：' + patch.path);
            if (patch.op === 'remove' && !(p[0] === '传闻' || (p[1] === PATH && p[2] === '传播'))) throw new Error('仅可移除过期传播与传闻，其他记录使用状态结束');
            let value=patch.value;
            if (patch.op !== 'remove') {
                if (value === undefined) throw new Error('缺少补丁值');
                const category = p.length === 3 ? p[1] : p.length === 4 ? p[2] : '';
                if(p[0]==='世界'&&p[1]===PATH&&p.length===4&&Object.hasOwn(RECORDS,category)){
                    value=normalizeBackendRecord(category,value,old);
                    checkRecord(value,RECORDS[category],DETAILS[category]);
                    checkDetails(value,DETAILS[category]);
                } else if (EXISTING[category]) {
                    const schema=EXISTING[category];
                    if(plain(value)){
                        const merged=Object.assign(copy(schema),plain(old)?copy(old):{});
                        for(const key of Object.keys(schema))if(Object.hasOwn(value,key))merged[key]=copy(value[key]);
                        value=merged;
                    }
                    checkRecord(value,schema);
                }
                else if (old !== undefined && (typeof old !== typeof value || Array.isArray(old) !== Array.isArray(value))) throw new Error('字段类型发生改变');
                if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('数值无效');
                if (p[0] === '世界' && p[1] === '因果轨道' && p.length === 3 && typeof value !== 'string') throw new Error('因果摘要必须是文本');
                if (p[0] === '任务' && p[1] === '副本成就' && old === '已达成' && value !== old) throw new Error('不能回退已达成成就');
                if (p[p.length-1] === '好感度' && Math.abs(value - old) > 20) throw new Error('单轮好感变动超过20');
            }
            let parent = next;
            for (const key of p.slice(0,-1)) {
                if (parent[key] === undefined) parent[key] = {};
                if (!plain(parent[key])) throw new Error('父路径不是对象');
                parent = parent[key];
            }
            if (patch.op === 'remove') delete parent[p.at(-1)]; else parent[p.at(-1)] = copy(value);
        }
        normalizeBackendState(next);
        validateState(next);
        for (const [name,item] of Object.entries(next.世界.势力 || {})) {
            const old = (stat.世界.势力 || {})[name];
            if (Math.abs(item.声望 - (old ? old.声望 : 0)) > 1000) throw new Error('单轮声望变动超过1000');
        }
        return next;
    }
    function materializeWorldUpdate(stat,seedPatches,modelPatches) {
        const work=copy(stat);
        work.世界[PATH]=Object.assign(emptyState(),work.世界[PATH]||{});
        normalizeBackendState(work);compactFinishedEvents(work);
        const appliedSeeds=(seedPatches||[]).filter(p=>get(work,canonicalizeParts(tokens(p.path),work))===undefined);
        let next=applyPatches(work,appliedSeeds);
        compactFinishedEvents(next);
        next=applyPatches(next,modelPatches||[]);
        compactFinishedEvents(next);
        const repairPatches=repairCausalProjection(next);
        return {next,appliedSeeds,repairPatches};
    }
    function ensureDueHandled(next,dueList,worldTime) {
        for(const due of dueList||[]){
            const event=next.世界[PATH].事件[due.名称];
            if(!event)continue;
            if(event.状态==='待发生'&&(event.更新时间!==worldTime||!event.下次检查||!event.条件)){
                throw new Error('到期事件未处理：'+due.名称+'。需启动事件，或记录本轮复核日期、阻碍条件与下次检查。');
            }
        }
    }    function ensureMacroBackbone(next,timeline,required=true) {
        if(!required||!timeline?.需要补充远期)return;
        const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
        const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
        if(futureMacro.length<3)throw new Error('宏观事件不足：需要至少3个待发生宏观节点，当前仅'+futureMacro.length+'个');
        const stages=storyStages(next?.世界?.因果轨道?.故事线);
        const names=new Set(allMacro.map(([name])=>name));
        if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
    }

    function progressionAnchorChanged(before,after) {
        return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
    }
    function parseReply(text) {
        let source=String(text).trim();
        const block=source.match(/<world_update\s*>([\s\S]*?)<\/world_update>/i);
        if(block)source=block[1].trim();
        const fence=source.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
        if(fence)source=fence[1].trim();
        let result;
        try {result=JSON.parse(source);}
        catch(error){
            const begin=source.indexOf('{'),end=source.lastIndexOf('}');
            try {if(begin<0||end<begin)throw error;result=JSON.parse(source.slice(begin,end+1));}
            catch(_){throw new Error('返回 JSON 无法解析：'+error.message+'；原始回复保留在请求检查。');}
        }
        if(!plain(result)||!Array.isArray(result.patches)||typeof result.summary!=='string')throw new Error('回复需包含文本 summary 和数组 patches；原始回复保留在请求检查。');
        return result;
    }
    function activation(entry, scan, force) {
        if(!String(entry.content||'').trim())return {read:false,reason:'内容为空'};
        if(force)return {read:true,reason:'强制读取'};
        if(!entry.enabled)return {read:false,reason:'条目禁用'};
        if(entry.mode==='constant')return {read:true,reason:'蓝灯常驻'};
        if(entry.mode!=='selective')return {read:false,reason:'不支持的激活方式，需显式强制读取'};
        const list=v=>Array.isArray(v)?v:typeof v==='string'?v.split(',').map(x=>x.trim()).filter(Boolean):[];
        const match=k=>{
            if(k instanceof RegExp){k.lastIndex=0;return k.test(scan);}
            if(plain(k)){try{return new RegExp(k.pattern||k.source||k.regex,k.flags||'').test(scan);}catch(_){return false;}}
            return !!String(k||'')&&scan.includes(String(k));
        };
        if(!list(entry.keys).some(match))return {read:false,reason:'绿灯未命中关键词'};
        const second=entry.secondary||{},keys=list(second.keys||second),hits=keys.map(match);
        const ok=!keys.length||(second.logic==='and_all'?hits.every(Boolean):second.logic==='not_all'?!hits.every(Boolean):second.logic==='not_any'?!hits.some(Boolean):hits.some(Boolean));
        return {read:ok,reason:ok?'绿灯已命中':'绿灯次要条件未满足'};
    }
    function protocol() {
        return `返回 <world_update>{"summary":"简短说明本轮已确认变化与待确认事项","patches":[]}</world_update>，不得输出推理过程。
补丁只用 add/replace/remove，路径为相对 stat_data 的 JSON Pointer，实例名中的 / 写成 ~1，~ 写成 ~0。add 设置对象成员（已有成员也可设置），replace 修改已有成员。后台整记录允许只提交本轮确认的字段，引擎会自动补缺省字段并与旧记录合并；可选明细数组中的单条对象仍需字段完整。空输入或条件不成立可返回空数组。
后台可写根：/世界/后台/{事件|人物|势力地区|历史|传播}/{稳定名称}。记录字段模板：${JSON.stringify(MODEL_RECORDS)}。
后台.剧本为旧档兼容只读，不得新增或更新。历史对模型只增不改不删；事件由模型通过状态结束，引擎会在记录过多时把无引用的已完成/已取消事件压缩进历史后回收。关联事件和前因必须指向实际存在的活动事件，前因不能循环。人物所属世界必须明确。
公开摘要默认已存在，用 {"op":"replace","path":"/世界/后台/公开摘要","value":"本轮公开变化"} 更新，限5000字，仅包含已发生的公开影响与可见征兆，不能泄露隐藏计划。
兼容投影允许：/世界/因果轨道/{当前阶段|故事线|下一节点}、/世界/因果轨道/偏移记录/{名}；/世界/{势力|探索}/{名}；/世界/异端雷达/名单/{名}；/传闻/{街头巷议|情报交易|布告与檄文}/{名}。记录完整字段模板：${JSON.stringify(EXISTING)}。
已有势力/探索可修改单个字段。声望范围 -5000~10000，单次至多1000；探索度0~100，品质 F/E/D/C/B/A/S/SS/SSS。街头可信度仅酒话/可疑/或许可信。三类传闻各最多3条。异端层级Ⅰ~Ⅸ，状态遵循旧变量及世界书。
关系仅允许修改既有 /关系列表/{名}/好感度，范围-100~100，单轮至多20。人物目标行动认知写后台.人物，不改人物战斗属性。
任务仅允许修改既有 /任务/列表/{名}/状态 或 /任务/副本成就/{名}/状态；任务状态进行中/可交付/可结算/失败，成就未达成/已达成。禁止回退已达成成就。不得创建主神任务、晋升试炼或发放奖励。
禁止修改世界时间、世界身份、系统状态、玩家属性、击杀计数、装备、货币、奖励。不要输出 /系统状态/待播报记录、/世界/后台/运行记录、/世界/后台/最近变化、/世界/后台/已处理楼层、/世界/后台/已处理时间 或旧 /世界/后台/剧本 补丁，这些由程序维护。正文和现有变量已经确认的变化不要重复加算，尤其好感与声望。未来走向写后台事件，不能当作当前事实投影。`;
    }
    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.lastRetryLog=[]; this.lastAttemptCount=0;
            this.config = { enabled:false, preset:DEFAULT_PRESET, retryAttempts:3, requireMacroBackbone:true };
            try { Object.assign(this.config, JSON.parse(host.localStorage.getItem(CONFIG) || '{}')); } catch (_) {}
            this.config.preset=ensurePresetStructure(this.config.preset);
            this.config.retryAttempts=Math.max(0,Math.min(5,Number(this.config.retryAttempts) || 0));
            if(!Object.hasOwn(this.config,'requireMacroBackbone'))this.config.requireMacroBackbone=true;
            if(this.config.enabled){
                const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            }
        }
        fn(name) {
            for (const obj of [this.env, this.host, this.host.TavernHelper]) if (obj && typeof obj[name] === 'function') return obj[name].bind(obj);
            return null;
        }
        snapshot() {
            const mvu = this.env.Mvu || this.host.Mvu;
            const getMessages = this.fn('getChatMessages');
            if (!mvu || !getMessages) throw new Error('等待 MVU 与酒馆消息接口');
            const message = getMessages(-1)[0];
            if (!message) throw new Error('当前没有消息');
            const id = message.message_id != null ? message.message_id : message.id;
            if (!Number.isInteger(Number(id))) throw new Error('当前楼层编号无效');
            const raw = mvu.getMvuData({type:'message',message_id:Number(id)});
            if (!raw || !raw.stat_data || !raw.stat_data.世界) throw new Error('当前楼层尚未初始化 MVU');
            const context = this.host.SillyTavern && this.host.SillyTavern.getContext ? this.host.SillyTavern.getContext() : {};
            const chatFn = this.fn('getCurrentChatId');
            const chat = chatFn ? chatFn() : context.chatId;
            if (chat == null) throw new Error('无法确认当前聊天标识');
            const text = String(message.message != null ? message.message : message.mes || '');
            const fingerprint = JSON.stringify([String(chat),Number(id),message.swipe_id || 0,digest(text)]);
            return {mvu,raw:copy(raw),stat:copy(raw.stat_data),id:Number(id),text,fingerprint,message};
        }
        blocked(snapshot) {
            const s = snapshot.stat;
            if ((s.系统状态 || {}).是否在主神空间 || s.世界.名称 === '主神空间') return '当前位于主神空间，副本推进暂停';
            if (!s.世界.名称 || s.世界.名称 === '待初始化') return '等待副本初始化';
            if (/轮回清算协议/.test(snapshot.text)) return '结算楼层由结算美化程序处理';
            if (snapshot.message.is_user || snapshot.message.role === 'user') return '等待正文完成';
            return '';
        }
        saveConfig() { this.host.localStorage.setItem(CONFIG,JSON.stringify(this.config)); }
        setPreset(text) {
            if (typeof text !== 'string' || text.length > 30000) throw new Error('预设限30000字');
            this.config.preset = ensurePresetStructure(text); this.saveConfig();
        }
        isConfigured() { return !!this.config.enabled; }
        isAvailable() {
            const terminal=this.host.Samsara&&this.host.Samsara.terminal;
            return !!(terminal&&typeof terminal.apiReady==='function'&&terminal.apiReady());
        }
        isEnabled() { return this.isConfigured()&&this.isAvailable(); }
        setEnabled(value) {
            const on=!!value;
            this.config.enabled=on;
            if(on){
                const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            } else {
                this.cancel();
                if(this.isOpen())this.close();
            }
            this.saveConfig();
            this.status=on?(this.isAvailable()?'世界推进已开启':'世界推进已开启 · 等待额外模型配置'):'世界推进已关闭';
            this.render();
            return this.isEnabled();
        }
        cancel() { ++this.generation; this.pending = false; clearTimeout(this.timer); if (this.controller) this.controller.abort(); }
        async catalogue() {
            const namesFn=this.fn('getCharWorldbookNames'),get=this.fn('getWorldbook');
            // 世界书只是可选补充资料。无限流世界即使没有绑定世界书，也必须能依靠模型已有知识完成宏观推演。
            if(!namesFn||!get) return [];
            const names=await namesFn('current')||{}, result=[];
            for(const book of [...new Set([names.primary,...(names.additional||[])].filter(Boolean))]){
                const entries=await get(book)||[];
                entries.forEach((e,i)=>{const title=e.name||e.comment||'未命名';result.push({book,id:String(e.uid??e.id??i),title,technical:isTechnicalBook(title),enabled:e.enabled!==false&&!e.disable&&!e.disabled,mode:e.strategy?.type||e.type||(e.constant===false?'selective':'constant'),keys:e.strategy?.keys||e.keys||e.key||[],secondary:e.strategy?.keys_secondary||e.keys_secondary||e.secondary_keys||{},content:e.content||''});});
            }
            return result;
        }
        async worldbook(scan='', options={}) {
            const catalogue=await this.catalogue(),output=[];
            this.bookCatalogue=catalogue;
            const report=[];this.readReport=report;
            for(const e of catalogue){
                const key=JSON.stringify([e.book,e.id]);
                const selected=!e.technical&&(this.config.selectedEntries ? this.config.selectedEntries.includes(key) : e.enabled);
                const timelineBackbone=!!options.timelineBackbone&&selected&&e.enabled&&isTimelineBackboneEntry(e.title);
                const decision=e.technical?{read:false,reason:'世界引擎技术条目已隔离'}:timelineBackbone?{read:true,reason:'宏观资料补充'}:selected?activation(e,scan,this.config.activationMode==='force_selected'):{read:false,reason:'未勾选'};
                report.push({世界书:e.book,条目ID:e.id,名称:e.title,灯:e.mode==='constant'?'蓝灯':e.mode==='selective'?'绿灯':'其他',读取:decision.read,原因:decision.reason});
                if(!decision.read)continue;
                let content=e.content;
                if(content.includes('<%')){
                    const ejs=this.host.EjsTemplate;
                    if(!ejs?.evalTemplate||!ejs?.prepareContext)throw new Error('所选世界书含动态模板，需要 EJS 扩展：'+e.title);
                    content=await ejs.evalTemplate(content,await ejs.prepareContext({}));
                }
                output.push({世界书:e.book,条目ID:e.id,名称:e.title,内容:content});
            }
            Object.defineProperty(output,'report',{value:report});
            return output;
        }
        async buildRequest(base) {
            const state=copy(base.stat);
            state.世界[PATH]=Object.assign(emptyState(),state.世界[PATH]||{});
            normalizeBackendState(state);
            compactFinishedEvents(state);
            const seedPatches=importStory(state);
            for(const patch of seedPatches)state.世界[PATH].事件[tokens(patch.path).at(-1)]=patch.value;
            if(state.设置)delete state.设置.API;
            delete state.商城;
            // 旧剧本数据只为兼容存档保留，不进入新世界调度请求。
            state.世界[PATH].剧本={};
            const count=Math.max(1,Math.min(100,Number(this.config.contextTurns)||6));
            const id=Number(base.message.message_id??base.message.id);
            const messages=await this.fn('getChatMessages')(Math.max(0,id-count+1)+'-'+id);
            const floors=messages.filter(m=>Number(m.message_id??m.id)<=id).slice(-count).map(m=>({楼层:m.message_id??m.id,角色:m.role||(m.is_user?'user':'assistant'),正文:m.message??m.mes??''}));
            if(!floors.length)throw new Error('未读到正文楼层，请检查聊天读取接口');
            const timeline=timelineState(state);
            const needBackbone=timeline.需要初始化||timeline.需要补充远期;
            const proseScan=floors.map(f=>f.正文).join('\n');
            const chronologyScan=needBackbone?[state.世界.名称,'原著','时间线','时间轴','年表','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' '):'';
            const books=await this.worldbook([proseScan,chronologyScan].filter(Boolean).join('\n'),{timelineBackbone:needBackbone});
            const now=worldDateKey(state.世界.时间);
            const due=Object.entries(state.世界[PATH].事件).filter(([,e])=>e.状态==='待发生'&&now!==null&&worldDateKey(e.时间||e.开始时间)!==null&&worldDateKey(e.时间||e.开始时间)<=now).map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因,说明:'时间已到；逐项核验条件与前因，符合则转进行中；未符合必须更新下次检查并解释阻碍，不得无声跳过。'}));
            const input=JSON.stringify({世界书:books,当前变量:state,正文楼层:floors,时间线调度:timeline,推演阶段:{宏观优先:true,宏观骨架状态:needBackbone?'需要建立或补足':'已具备可用宏观骨架',近期细节边界:timeline.下一宏观节点?.名称||'先建立下一宏观节点',知识来源:'当前确认事实 > 明确世界书设定（若有） > 模型已有原著/世界知识 > 谨慎推断'},可选宏观资料补充:needBackbone,本轮必须复核的到期事件:due,待拆分旧故事线:state.世界.因果轨道,说明:'当前变量为已确认事实，不重复结算；只用世界.时间推进。世界书为空不构成阻塞。'},null,2);
            const system=this.config.preset+'\n\n'+CORE_WORLD_RULES+'\n\n'+protocol()+'\n可选明细字段：'+JSON.stringify(MODEL_DETAILS)+'\n【节点调度】后台.事件是唯一调度图，因果轨道是它的宏观摘要。按两个阶段工作：\nA. 宏观骨架：先检查“时间线调度.需要初始化 / 需要补充远期 / 因果轨道需重建”。原著世界首先使用当前确认事实与模型已有的原著知识识别后续确定性大事件；世界书如有则用于补充、校正同人差异和时间资料，没有世界书也不得停止宏观推演或退化为只写当前剧情。宏观节点应是篇章转折、跨地区灾难、战争/政权变化、基础设施级失效、关键人物命运、主角团重大迁移等真正改变世界状态的边界；至少维持3个有依据的待发生宏观节点。准确公历时间不确定时使用作品内相对时间，不为排程捏造日期。\nB. 区间桥接：读取“时间线调度.下一宏观节点 / 桥接区间”。只展开当前时间到该边界之间的当前事件、近期节点、场外人物、势力地区、探索与传播；所有细节都应解释这段时间世界如何走向下一宏观节点，或解释偏移为何使它改变。下一宏观节点之后保持宏观层，不提前生成大量人物日程和琐碎事件。若尚无下一宏观节点，先完成阶段A，再生成必要桥接细节。\n原著世界推演规则沿用额外思考中的世界推演：结合当前时间锚点、当前地点、当前剧情阶段、已知角色状态、原著人物行动规律、世界势力动态；推演人物行动、势力变化、剧情推进、世界事件。原创/衍生世界基于当前世界法则与本土势力动态持续推演。世界持续运行，不因<user>未行动而暂停。\n每轮仍需复核到期事件、人物行程与语义时间节点。时间到且条件成立就启动，已有结果才完成；未满足条件记录真实阻碍和下次检查。事件后果联动场外人物、势力地区、传播以及已有任务状态。后台.剧本不参与调度。'
            if(system.length+input.length>240000)throw new Error('请求超过24万字，请减少所选条目或正文层数');
            return {system,input,seedPatches,due,timeline:copy(timeline),manifest:{读取判定:copy(books.report||[]),世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,字符数:b.内容.length})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,字符数:f.正文.length})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),可选宏观资料补充:needBackbone,请求字符数:system.length+input.length}};
        }
        schedule() {
            if (this.disposed || this.committing || !this.isEnabled()) return;
            if (this.busy) { this.pending = true; return; }
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.run().catch(() => {}), 900);
        }
        async run() {
            if (this.disposed || this.busy) return false;
            if (!this.isConfigured()) { this.status='世界推进已关闭'; this.render(); return false; }
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            this.busy = true; const token = this.generation; let timeout;
            try {
                const base = this.snapshot(), reason = this.blocked(base);
                if (reason) { this.status = reason; return false; }
                const old = Object.assign(emptyState(),base.stat.世界[PATH] || {});
                if (old.已处理楼层 === base.fingerprint) {
                    const recoveryStat=copy(base.stat);
                    recoveryStat.世界[PATH]=Object.assign(emptyState(),recoveryStat.世界[PATH]||{});
                    normalizeBackendState(recoveryStat);
                    const recoveryTimeline=timelineState(recoveryStat);
                    const needsMacroRepair=this.config.requireMacroBackbone!==false&&(recoveryTimeline.需要补充远期||recoveryTimeline.因果轨道需重建);
                    if(!needsMacroRepair){this.status='本楼层已处理，不重复结算';return false;}
                    this.status='检测到宏观骨架不完整 · 修复本楼层';
                }
                if (!terminal || !terminal.apiReady()) throw new Error('请在主神终端设置中启用额外模型并选择模型');
                const validate = this.host.Samsara && this.host.Samsara.validateWorldState;
                if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');

                this.status = '正在读取世界资料'; this.render();
                const request=await this.buildRequest(base);
                if(token!==this.generation)throw new Error('请求已取消');

                const maxRetries=Math.max(0,Math.min(5,Number(this.config.retryAttempts)||0));
                this.lastRetryLog=[];this.lastAttemptCount=0;this.lastReply='';this.lastFailure='';
                let attempt=0,lastError=null,lastRejectedReply='',prepared=null;

                while(attempt<=maxRetries){
                    if(token!==this.generation)throw new Error('请求已取消');
                    this.controller=new AbortController();
                    clearTimeout(timeout);timeout=setTimeout(()=>this.controller.abort(),120000);
                    const attemptInput=attempt===0?request.input:retryInput(request.input,lastError,lastRejectedReply,attempt,maxRetries);
                    const actualRequest=copy(request);
                    actualRequest.input=attemptInput;
                    actualRequest.manifest=Object.assign({},copy(request.manifest),{
                        尝试序号:attempt+1,
                        最大失败重试:maxRetries,
                        失败记录:copy(this.lastRetryLog)
                    });
                    this.lastRequest=actualRequest;
                    this.status=attempt===0?'六模块联合推演中':'纠错重试 '+attempt+'/'+maxRetries;
                    this.render();

                    let received='';
                    try{
                        received=String(await terminal.request(request.system,attemptInput,{signal:this.controller.signal}));
                        clearTimeout(timeout);
                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');
                        this.lastReply=received;this.lastFailure='';

                        const reply=parseReply(received);
                        reply.patches=sanitizeModelPatches(normalizeModelPatches(reply.patches));
                        const modelPatches=reply.patches;
                        let sourceStat=base.stat;
                        let built=materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                        let next=built.next;
                        ensureDueHandled(next,request.due,base.stat.世界.时间);
                        ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);

                        const current=this.snapshot();
                        if(token!==this.generation||this.controller.signal.aborted||current.fingerprint!==base.fingerprint||this.blocked(current))throw new Error('上下文已经切换，本次结果已丢弃');
                        if(progressionAnchorChanged(base.stat,current.stat))throw new Error('推演期间世界时间或副本锚点发生变化，请重新运行');

                        if(!same(current.stat,base.stat)){
                            sourceStat=current.stat;
                            built=materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                            next=built.next;
                            ensureDueHandled(next,request.due,base.stat.世界.时间);
                            ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                        }
                        const committedPatches=built.appliedSeeds.concat(modelPatches,built.repairPatches);

                        if (!(next.设置 || {}).世界超稳) {
                            const offsets=(next.世界.因果轨道||{}).偏移记录||{};
                            const total=Object.values(offsets).reduce((n,r)=>n+(Number(r.影响程度)||0),0);
                            next.世界.稳定=Math.max(0,Math.min(120,100+total));
                        }
                        next.世界[PATH].已处理楼层=base.fingerprint;
                        next.世界[PATH].已处理时间=base.stat.世界.时间;
                        const changes=committedPatches.filter(p=>p.path!=='/世界/后台/公开摘要').map(p=>{
                            const parts=tokens(p.path),back=parts[1]===PATH;
                            return {时间:base.stat.世界.时间,类别:back?parts[2]:parts[1],名称:back?parts[3]:parts[2],字段:parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.内容||'记录已更新'):''};
                        });
                        next.世界[PATH].最近变化=changes.slice(-100);
                        const sourceOld=Object.assign(emptyState(),sourceStat.世界[PATH]||{});
                        next.世界[PATH].运行记录=sourceOld.运行记录.concat([{时间:base.stat.世界.时间,摘要:reply.summary,补丁数:committedPatches.length,尝试次数:attempt+1}]).slice(-20);

                        const checked=validate(next);
                        for(const patch of committedPatches){
                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw new Error('字段未通过完整 Schema 校验：'+patch.path);
                        }
                        reply.patches=committedPatches;
                        prepared={reply,next,current};
                        this.lastAttemptCount=attempt+1;
                        break;
                    }catch(error){
                        clearTimeout(timeout);
                        lastError=error;
                        lastRejectedReply=received||this.lastReply||'';
                        const canRetry=!!received&&retryableModelFailure(error)&&attempt<maxRetries;
                        if(!canRetry)throw error;
                        this.lastRetryLog.push({重试:attempt+1,错误:String(error.message||error)});
                        attempt++;
                        this.status='回复未通过 · 自动纠错 '+attempt+'/'+maxRetries;
                        this.render();
                    }
                }

                if(!prepared)throw lastError||new Error('世界推演未生成可写入结果');
                this.committing=true;
                const result=prepared.current.raw;
                result.stat_data=prepared.next;
                result.__samsaraWorldCommit=base.fingerprint;
                await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                this.status='已更新 · '+prepared.reply.summary+(this.lastRetryLog.length?' · 重试'+this.lastRetryLog.length+'次':'');
                return true;
            } catch (error) {
                this.lastFailure=error.message;
                const retryNote=this.lastRetryLog?.length?' · 已重试'+this.lastRetryLog.length+'次':'';
                this.status=(this.committing?'写入未确认 · ':'未写入 · ')+(error.name==='AbortError'?'请求已取消或超时':error.message)+retryNote;
                throw error;
            } finally {
                clearTimeout(timeout); if(this.controller)this.controller=null; this.committing=false; this.busy=false; this.render();
                if (this.pending) { this.pending = false; this.schedule(); }
            }
        }
        getState() { return copy(Object.assign(emptyState(),this.snapshot().stat.世界[PATH] || {})); }
        init() {
            const on = this.fn('eventOn');
            const mvu = this.env.Mvu || this.host.Mvu;
            if (!on || !mvu || !mvu.events) { this.initTimer = setTimeout(() => { if (!this.disposed) this.init(); },500); return; }
            const bind = (event,callback) => { if (event) { const off = on(event,callback); if (typeof off === 'function') this.unsub.push(off); else if (off && off.stop) this.unsub.push(() => off.stop()); } };
            bind(mvu.events.VARIABLE_UPDATE_ENDED, () => {
                try { if (this.blocked(this.snapshot())) this.cancel(); } catch (_) { this.cancel(); }
                this.render(); this.schedule();
            });
            const events = this.env.tavern_events || this.host.tavern_events || {};
            for (const key of ['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_DELETED']) bind(events[key], () => { this.cancel(); this.status = '已切换上下文'; this.render(); });
            this.keyHandler = event => { if (event.key === 'Escape' && this.isOpen()) { event.stopImmediatePropagation(); this.close(); } };
            this.host.document.addEventListener('keydown',this.keyHandler,true);
        }
        isOpen() { return !!this.panel && !this.panel.hidden; }
        open() {
            if (this.isOpen()) return;
            this.createPanel();
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            if (terminal) this.returnState = terminal.suspend();
            this.panel.hidden = false; this.render();
        }
        close() {
            if (!this.isOpen()) return;
            this.panel.hidden = true;
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            if (terminal) terminal.restore(this.returnState);
            this.returnState = null;
        }
        toggle() { this.isOpen() ? this.close() : this.open(); }
        createPanel() {
            if (this.panel && this.panel.isConnected) return;
            const doc=this.host.document;
            this.style=doc.createElement('style');
            this.style.textContent = [
                '#sam-world-engine[hidden]{display:none!important}',
                '#sam-world-engine{--ink:#dce5ef;--sub:#8897aa;--line:#ffffff12;--gold:#d9b978;--mint:#7dcbbb;position:fixed;inset:4vh max(2vw,calc((100vw - 1440px)/2));z-index:999999;background:#101720;color:var(--ink);border:1px solid #53606a;border-radius:14px;box-shadow:0 30px 120px #000b;display:flex;flex-direction:column;overflow:hidden;font:14px/1.65 system-ui,"Microsoft YaHei",sans-serif}',
                '#sam-world-engine *{box-sizing:border-box}#sam-world-engine button,#sam-world-engine input,#sam-world-engine textarea{font:inherit}#sam-world-engine button{cursor:pointer;color:inherit}#sam-world-engine button:focus-visible,#sam-world-engine input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}#sam-world-engine button:disabled{opacity:.4;cursor:default}',
                '#sam-world-engine header{height:62px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:0 25px;border-bottom:1px solid var(--line);background:#131c27}#sam-world-engine .we-brand{font-size:16px;letter-spacing:3px;font-weight:650;flex:1}#sam-world-engine .we-brand i{color:var(--gold);font-style:normal;margin-right:12px}#sam-world-engine .we-brand small{font-size:10px;color:var(--sub);letter-spacing:2px;margin-left:16px}',
                '#sam-world-engine button.we-btn{border:1px solid #ffffff23;border-radius:6px;background:#ffffff05;padding:7px 13px;font-size:12px}#sam-world-engine button.we-primary{background:var(--gold);border-color:var(--gold);color:#20232a;font-weight:700}#sam-world-engine .we-layout{display:flex;min-height:0;flex:1}#sam-world-engine nav{width:173px;flex-shrink:0;padding:22px 12px;background:#121a24;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:5px}#sam-world-engine nav .we-navtitle{font-size:10px;color:var(--sub);letter-spacing:3px;padding:0 13px 15px}#sam-world-engine nav button{display:flex;align-items:center;gap:11px;padding:11px 13px;border:1px solid transparent;border-radius:6px;text-align:left;background:none;color:var(--sub);font-size:13px}#sam-world-engine nav button span{width:20px;font-size:16px}#sam-world-engine nav button[aria-selected=true]{background:#d9b97812;color:var(--gold);border-color:#d9b97824}#sam-world-engine nav button:hover{background:#ffffff08;color:var(--ink)}',
                '#sam-world-engine main{flex:1;min-width:0;overflow:auto;padding:27px 30px 36px;scrollbar-width:thin;scrollbar-color:#526070 transparent}#sam-world-engine .we-eyebrow{font-size:10px;letter-spacing:3px;color:var(--gold);margin-bottom:7px}#sam-world-engine h1{font-size:30px;letter-spacing:2px;margin:0 0 8px;font-weight:600}#sam-world-engine h2{font-size:14px;font-weight:600;margin:0;letter-spacing:1px}#sam-world-engine h3{font-size:14px;margin:0 0 7px}#sam-world-engine p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}#sam-world-engine .we-muted{color:var(--sub);font-size:12px}#sam-world-engine .we-hero{display:flex;gap:25px;justify-content:space-between;align-items:center;padding:0 0 23px;border-bottom:1px solid var(--line)}#sam-world-engine .we-hero .we-date{min-width:180px;text-align:right;color:var(--gold);font-size:16px}#sam-world-engine .we-hero .we-date small{display:block;color:var(--sub);font-size:11px;margin-top:5px}',
                '#sam-world-engine .we-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:18px 0 25px;background:linear-gradient(100deg,#1a2634,#141f2b);border:1px solid var(--line);border-radius:9px}#sam-world-engine .we-metric{padding:15px 20px;border-right:1px solid var(--line)}#sam-world-engine .we-metric:last-child{border:0}#sam-world-engine .we-metric strong{display:block;font-size:25px;font-weight:500;color:var(--ink);line-height:1.4}#sam-world-engine .we-metric small{color:var(--sub);font-size:11px;letter-spacing:1px}',
                '#sam-world-engine .we-columns{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(245px,1fr);gap:23px;align-items:start}#sam-world-engine .we-section{margin-bottom:23px;min-width:0}#sam-world-engine .we-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}#sam-world-engine .we-section-head small{color:var(--sub);font-size:11px}#sam-world-engine .we-card{border:1px solid var(--line);border-radius:8px;background:#18222f;padding:16px 18px;margin:9px 0;overflow:hidden}#sam-world-engine .we-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}#sam-world-engine .we-card-top h3{margin:0}#sam-world-engine .we-card p{font-size:13px;color:#b8c4d3}#sam-world-engine .we-pill{display:inline-block;font-size:10px;line-height:1.6;padding:2px 7px;border:1px solid #7dcbbb30;border-radius:4px;color:var(--mint);background:#7dcbbb09;white-space:nowrap}#sam-world-engine .we-pill.future{color:var(--gold);border-color:#d9b97830;background:#d9b97809}#sam-world-engine .we-pill.dim{color:var(--sub);border-color:var(--line);background:transparent}#sam-world-engine .we-meta{display:flex;gap:8px 15px;flex-wrap:wrap;color:var(--sub);font-size:11px;margin-top:9px}#sam-world-engine .we-chips{display:flex;flex-wrap:wrap;gap:5px}',
                '#sam-world-engine .we-timeline{border-left:1px solid #d9b97838;margin-left:5px;padding-left:20px}#sam-world-engine .we-timeline .we-card{position:relative;overflow:visible}#sam-world-engine .we-timeline .we-card:before{content:"";position:absolute;left:-26px;top:20px;width:9px;height:9px;background:var(--gold);border:2px solid #101720;border-radius:50%}#sam-world-engine .we-avatar{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#496575,#243440);color:#c1dedc;font-size:15px;flex-shrink:0}#sam-world-engine .we-person{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)}#sam-world-engine .we-person:last-child{border:0}#sam-world-engine .we-person>div:last-child{flex:1;min-width:0}#sam-world-engine .we-person strong{font-size:13px}#sam-world-engine .we-person p{font-size:12px;color:#acb8c8;margin:3px 0}',
                '#sam-world-engine .we-change{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px}#sam-world-engine .we-change time{color:var(--gold);font-size:10px}#sam-world-engine .we-change p{margin:2px 0;color:var(--sub)}#sam-world-engine .we-progress{height:4px;background:#ffffff0a;border-radius:4px;margin:10px 0 6px;overflow:hidden}#sam-world-engine .we-progress>i{display:block;height:100%;background:var(--mint);border-radius:4px}#sam-world-engine .we-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;align-items:start}#sam-world-engine dl{margin:12px 0;display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px 14px;font-size:12px}#sam-world-engine dt{color:var(--sub)}#sam-world-engine dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}#sam-world-engine details{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}#sam-world-engine summary{cursor:pointer;color:var(--gold);font-size:11px;list-style:none}#sam-world-engine summary:before{content:"＋ ";}#sam-world-engine details[open]>summary:before{content:"− ";}',
                '#sam-world-engine .we-calendar{background:#18222f;border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:20px}#sam-world-engine .we-calhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}#sam-world-engine .we-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}#sam-world-engine .we-days span{color:var(--sub);font-size:10px;padding:4px}#sam-world-engine .we-days button{position:relative;padding:7px 0;border:1px solid transparent;border-radius:5px;background:none;font-size:11px;min-width:0}#sam-world-engine .we-days button.today{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-days button.selected{background:#d9b97824}#sam-world-engine .we-days button.has-event:after{content:"";position:absolute;bottom:2px;left:calc(50% - 2px);width:4px;height:4px;background:var(--mint);border-radius:50%}#sam-world-engine .we-days button:hover{background:#ffffff0b}',
                '#sam-world-engine .we-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:18px 0}#sam-world-engine .we-tools input{min-width:150px;flex:1;background:#17212d;border:1px solid var(--line);border-radius:6px;color:var(--ink);padding:8px 12px;font-size:12px}#sam-world-engine .we-tools button{border:1px solid var(--line);background:none;border-radius:5px;padding:6px 10px;font-size:11px}#sam-world-engine .we-tools button.active{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-empty{padding:24px 15px;text-align:center;border:1px dashed #ffffff19;border-radius:8px;color:var(--sub);font-size:12px}#sam-world-engine .we-empty b{display:block;color:#bec9d6;margin-bottom:5px;font-weight:500}#sam-world-engine .we-notice{padding:12px 16px;border-left:2px solid var(--gold);background:#d9b97808;margin:15px 0;color:#d4c4a6;font-size:12px}#sam-world-engine textarea{width:100%;min-height:48vh;background:#121b26;color:var(--ink);border:1px solid #ffffff24;border-radius:8px;padding:18px;line-height:1.9;resize:vertical}#sam-world-engine footer{padding:8px 24px;border-top:1px solid var(--line);font-size:10px;color:var(--sub);display:flex;justify-content:space-between;gap:15px}#sam-world-engine footer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
                '@media(max-width:1000px){#sam-world-engine .we-columns{grid-template-columns:1fr}#sam-world-engine nav{width:145px}#sam-world-engine main{padding:20px}#sam-world-engine .we-calendar{max-width:400px}}@media(max-width:640px){#sam-world-engine{inset:0;border-radius:0}#sam-world-engine header{padding:0 12px;height:58px;gap:6px}#sam-world-engine .we-brand{font-size:13px;letter-spacing:1px}#sam-world-engine .we-brand small{display:none}#sam-world-engine .we-layout{flex-direction:column}#sam-world-engine nav{width:100%;flex-direction:row;overflow-x:auto;padding:8px;gap:3px;border-right:0;border-bottom:1px solid var(--line)}#sam-world-engine nav .we-navtitle{display:none}#sam-world-engine nav button{white-space:nowrap;padding:7px 10px;font-size:11px}#sam-world-engine nav button span{display:none}#sam-world-engine main{padding:18px 14px}#sam-world-engine .we-hero{gap:12px;align-items:flex-start}#sam-world-engine h1{font-size:23px}#sam-world-engine .we-hero .we-date{min-width:110px;font-size:12px}#sam-world-engine .we-metric{padding:10px}#sam-world-engine .we-metric strong{font-size:20px}#sam-world-engine .we-grid{grid-template-columns:1fr}#sam-world-engine footer{padding:8px 12px}#sam-world-engine footer small{display:none}}'
            ].join('\n');
            this.mount=doc.createElement('div');
            this.mount.id='sam-world-engine-host';
            this.mount.style.setProperty('all','initial','important');
            const isolated=this.mount.attachShadow({mode:'open'});
            isolated.appendChild(this.style);
            // 明确占据视口高度，避免宿主 flex/弹窗规则在短屏挤掉正文。
            this.style.textContent += `
                #sam-world-engine{
                    top:2vh!important;bottom:auto!important;height:96vh!important;height:96dvh!important;max-height:none!important;min-height:0!important;
                    --ink:#243248;--sub:#6f7b8c;--line:#dfe4e7;--gold:#b28a4a;--mint:#4f7d6d;
                    background:#e8ece9;color:var(--ink);border-color:#344554;border-radius:18px;box-shadow:0 28px 90px #17212d55
                }
                #sam-world-engine header{
                    height:64px;background:linear-gradient(120deg,#1d2a39,#273d4c);color:#f7f3e8;border-bottom:0;padding:0 24px
                }
                #sam-world-engine .we-brand i{color:#d7b46d}
                #sam-world-engine .we-brand small{color:#aebbc5}
                #sam-world-engine button.we-btn{border-color:#ffffff28;background:#ffffff0a}
                #sam-world-engine button.we-primary{background:#d5b06b;border-color:#d5b06b;color:#22303e}
                #sam-world-engine .we-layout{display:grid!important;grid-template-rows:auto minmax(0,1fr);min-height:0!important;flex:1 1 0!important;overflow:hidden}
                #sam-world-engine nav{
                    width:100%!important;flex-direction:row!important;align-items:center;gap:6px;padding:9px 20px;background:#223342;border-right:0;border-bottom:1px solid #ffffff12;overflow-x:auto;min-height:51px
                }
                #sam-world-engine nav .we-navtitle{display:none}
                #sam-world-engine nav button{
                    flex:0 0 auto;padding:8px 13px;border-radius:999px;background:transparent;color:#aeb9c2;border-color:transparent;font-size:12px
                }
                #sam-world-engine nav button span{width:auto;font-size:13px}
                #sam-world-engine nav button:hover{background:#ffffff0c;color:#fff}
                #sam-world-engine nav button[aria-selected=true]{background:#d5b06b;color:#21303d;border-color:#d5b06b;font-weight:700}
                #sam-world-engine main{
                    display:block!important;height:auto!important;min-height:0!important;flex:1 1 0!important;overflow:auto!important;
                    padding:20px clamp(16px,2.2vw,30px) 34px;background:
                    radial-gradient(circle at 88% 0,#f6eee1 0,transparent 34%),
                    linear-gradient(135deg,#edf1ee,#e8ece9 55%,#f3f0e8)
                }
                #sam-world-engine .we-hero{
                    padding:18px 20px;margin-bottom:12px;border:1px solid #dbe1e2;border-left:4px solid var(--gold);border-radius:16px;background:#fbfaf6;box-shadow:0 7px 24px #2535460b
                }
                #sam-world-engine .we-eyebrow{color:#87662f}
                #sam-world-engine h1{font-family:Georgia,"SimSun",serif;font-size:27px;letter-spacing:1px}
                #sam-world-engine h2{font-family:Georgia,"SimSun",serif;font-size:17px;letter-spacing:.5px}
                #sam-world-engine .we-hero .we-date{color:#80612e}
                #sam-world-engine .we-section{
                    margin-bottom:14px;padding:16px;border:1px solid #dfe4e5;border-radius:15px;background:#fffdf8;box-shadow:0 7px 22px #22314209
                }
                #sam-world-engine .we-section-head{margin-bottom:12px;padding-bottom:9px;border-bottom:1px solid #ecefed}
                #sam-world-engine .we-section-head h2{display:flex;align-items:center;gap:8px}
                #sam-world-engine .we-section-head h2:before{content:"";width:3px;height:16px;border-radius:3px;background:var(--gold);flex:none}
                #sam-world-engine .we-card{background:#f6f8f7;border:0;border-radius:10px;padding:13px 15px;margin:7px 0;box-shadow:none;transition:background .15s ease,transform .15s ease}
                #sam-world-engine button.we-card:hover,#sam-world-engine .we-card:hover{background:#f1f4f2}
                #sam-world-engine .we-section .we-card details{border-top:1px solid #e4e8e7}
                #sam-world-engine .we-card p,#sam-world-engine .we-person p{color:#657185}
                #sam-world-engine .we-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 14px}
                #sam-world-engine .we-kpi{min-width:0;padding:13px 15px;border:1px solid #dce2e3;border-radius:13px;background:#f9f8f3}
                #sam-world-engine .we-kpi small{display:block;color:#7e8793;font-size:10px;letter-spacing:1px}
                #sam-world-engine .we-kpi strong{display:block;margin:3px 0 1px;font:600 24px/1.1 Georgia,serif;color:#31445d}
                #sam-world-engine .we-kpi span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7b8491;font-size:10px}
                #sam-world-engine .we-dashboard{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,310px);gap:14px;align-items:start}
                #sam-world-engine .we-command-main,#sam-world-engine .we-command-side{min-width:0}
                #sam-world-engine .we-command-side{position:sticky;top:0}
                #sam-world-engine .we-pulse{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}
                #sam-world-engine .we-pulse p{margin:0;color:#4f5f70;font-size:13px;line-height:1.8}
                #sam-world-engine .we-pulse-mark{margin-top:2px;padding:2px 6px;border-radius:4px;background:#4f7d6d;color:#fff;font:700 9px/1.5 system-ui;letter-spacing:1px}
                #sam-world-engine .we-calendar-layout{display:grid;grid-template-columns:minmax(235px,275px) minmax(0,1fr);gap:18px;align-items:start}
                #sam-world-engine .we-calendar{margin:0;background:transparent;border:0;border-radius:0;padding:4px 2px}
                #sam-world-engine .we-calendar-slot{position:sticky;top:0}
                #sam-world-engine .we-timeline-slot{min-width:0}
                #sam-world-engine .we-timeline-slot>.we-tools{margin:0 0 10px}
                #sam-world-engine .we-timeline{margin-left:4px;padding-left:15px}
                #sam-world-engine .we-timeline .we-card{padding:11px 13px}
                #sam-world-engine .we-timeline .we-card:before{left:-21px;top:17px;width:7px;height:7px;border-color:#fffdf8}
                #sam-world-engine .we-date-filter{font-size:11px;color:var(--sub)}
                #sam-world-engine .we-next-node{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px}
                #sam-world-engine button.we-next-node{width:100%;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;border-radius:9px;transition:background .15s ease,transform .15s ease}
                #sam-world-engine button.we-next-node:hover{background:#f4f1e9;transform:translateX(2px)}
                #sam-world-engine .we-card.is-jump{outline:2px solid #c49a50;outline-offset:2px;background:#fbf4e5}
                #sam-world-engine .we-next-node>span{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#d5b06b;color:#21303d;font-weight:800}
                #sam-world-engine .we-next-node h3{margin:1px 0 4px}
                #sam-world-engine .we-next-node p{font-size:12px;color:#657185}
                #sam-world-engine .we-next-node small{color:#94753d;font-size:10px}
                #sam-world-engine .we-brief-row{display:grid;width:100%;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;text-align:left;border:0;border-bottom:1px solid #e7e9e7;background:transparent;padding:9px 2px}
                #sam-world-engine .we-brief-row:last-child{border-bottom:0}
                #sam-world-engine .we-brief-row{transition:background .15s ease,padding-left .15s ease}
                #sam-world-engine .we-brief-row:hover{padding-left:7px}
                #sam-world-engine .we-brief-row>b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
                #sam-world-engine .we-brief-row>span:last-child{grid-column:1/-1;color:#707b89;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-brief-row:hover{background:#f4f5f1}
                #sam-world-engine .we-people-strip{display:grid;gap:5px}
                #sam-world-engine .we-person-compact{display:grid;grid-template-columns:32px minmax(0,1fr);gap:9px;align-items:center;width:100%;padding:7px;border:0;border-radius:9px;background:transparent;text-align:left}
                #sam-world-engine .we-person-compact{transition:background .15s ease,transform .15s ease}
                #sam-world-engine .we-person-compact:hover{background:#f3f5f1;transform:translateX(2px)}
                #sam-world-engine .we-person-compact .we-avatar{width:32px;height:32px;background:linear-gradient(145deg,#526c7c,#314656)}
                #sam-world-engine .we-person-copy{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 7px;min-width:0}
                #sam-world-engine .we-person-copy strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-person-copy small{font-size:9px;color:#94753d;white-space:nowrap}
                #sam-world-engine .we-person-copy em{grid-column:1/-1;font-style:normal;font-size:10px;color:#75808d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-link-btn{width:100%;margin-top:8px;border:0;background:transparent;color:#8b6a33;text-align:right;font-size:10px;padding:4px}
                #sam-world-engine .we-link-btn:hover{text-decoration:underline}
                #sam-world-engine .we-change{grid-template-columns:58px 1fr;padding:8px 0}
                #sam-world-engine .we-tools{margin:12px 0;gap:6px}
                #sam-world-engine .we-tools input{background:#f7f8f5;color:var(--ink);border-color:#d8dfdf;border-radius:9px}
                #sam-world-engine .we-tools button{border-color:#d9dfdf;background:#f8f9f6;border-radius:999px}
                #sam-world-engine .we-tools button.active{border-color:#b28a4a;background:#f4ead8;color:#795b2b}
                #sam-world-engine dl{grid-template-columns:92px minmax(0,1fr)}
                #sam-world-engine .we-empty{border-color:#dde2e1;background:#fafaf7}
                #sam-world-engine .we-empty b{color:#6f7b8c}
                #sam-world-engine .we-notice{color:#725f3d;background:#f7edda;border-left-color:#b28a4a;border-radius:0 10px 10px 0}
                #sam-world-engine textarea{background:#fbfaf6;color:var(--ink);border-color:#d8deda}
                #sam-world-engine footer{flex-shrink:0;background:#1f2d3a;color:#9eabb6;border-top:0;padding:7px 20px}
                #sam-world-engine .we-config-row{display:flex;flex-wrap:wrap;gap:18px;align-items:center}
                #sam-world-engine .we-config-row input{width:70px}
                #sam-world-engine select,#sam-world-engine .we-config-row input{font:inherit;padding:7px;border:1px solid #d8ddd8;border-radius:7px;background:#fff;color:var(--ink)}
                #sam-world-engine .we-book{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fffdf8}
                #sam-world-engine .we-book-list{max-height:320px;overflow:auto;margin-top:10px}
                #sam-world-engine .we-book-row{display:flex;gap:10px;align-items:center;padding:11px 4px;border-bottom:1px solid var(--line);cursor:pointer}
                #sam-world-engine .we-book-title{flex:1;min-width:0;overflow-wrap:anywhere}
                #sam-world-engine .we-book-title small{display:block;color:var(--sub);font-size:11px}
                #sam-world-engine .we-read-state{max-width:135px;color:var(--sub);font-size:11px}
                #sam-world-engine .we-lamp{width:9px;height:9px;border-radius:50%;flex-shrink:0}
                #sam-world-engine .we-lamp.blue{background:#5794dd;box-shadow:0 0 0 4px #5794dd16}
                #sam-world-engine .we-lamp.green{background:#58a879;box-shadow:0 0 0 4px #58a87916}
                #sam-world-engine .we-lamp.gray{background:#a1a6ad}
                #sam-world-engine .we-request-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
                #sam-world-engine .we-inspect-body{max-height:440px;overflow:auto;padding:10px 3px;overscroll-behavior:contain}
                #sam-world-engine .we-prose{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}
                #sam-world-engine textarea.we-raw{min-height:180px;height:280px;max-height:400px;font:12px/1.8 monospace;white-space:pre-wrap}
                #sam-world-engine [data-segment]{min-height:180px;height:240px}
                #sam-world-engine summary{font-size:12px;line-height:1.7;transition:color .15s ease}
                #sam-world-engine summary:hover{color:#7d5f2d}
                @media(max-width:1100px){
                    #sam-world-engine .we-dashboard{grid-template-columns:1fr}
                    #sam-world-engine .we-command-side{position:static;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
                    #sam-world-engine .we-command-side>.we-section{margin-bottom:0}
                    #sam-world-engine .we-calendar-layout{grid-template-columns:minmax(220px,260px) minmax(0,1fr)}
                }
                @media(max-width:760px){
                    #sam-world-engine{top:0!important;height:100vh!important;height:100dvh!important;border-radius:0}
                    #sam-world-engine header{padding:0 12px;height:56px;gap:6px}
                    #sam-world-engine .we-brand{font-size:13px;letter-spacing:1px}
                    #sam-world-engine .we-brand small{display:none}
                    #sam-world-engine nav{padding:7px 9px;min-height:46px}
                    #sam-world-engine nav button{padding:7px 10px}
                    #sam-world-engine nav button span{display:none}
                    #sam-world-engine main{padding:12px 10px 24px}
                    #sam-world-engine .we-hero{align-items:flex-start;padding:14px}
                    #sam-world-engine h1{font-size:21px}
                    #sam-world-engine .we-hero .we-date{min-width:105px;font-size:11px}
                    #sam-world-engine .we-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
                    #sam-world-engine .we-command-side{display:block}
                    #sam-world-engine .we-command-side>.we-section{margin-bottom:10px}
                    #sam-world-engine .we-calendar-layout{grid-template-columns:1fr}
                    #sam-world-engine .we-calendar-slot{position:static}
                    #sam-world-engine .we-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-section{padding:13px}
                    #sam-world-engine footer{padding:7px 10px}
                    #sam-world-engine footer small{display:none}
                }
                @media(max-height:400px){
                    #sam-world-engine header{height:40px}
                    #sam-world-engine nav{padding:3px 8px;min-height:36px}
                    #sam-world-engine footer{padding:2px 12px}
                    #sam-world-engine main{padding:8px}
                }
            `;
            this.panel=doc.createElement('section');this.panel.id='sam-world-engine';this.panel.hidden=true;
            this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','世界引擎');
            this.panel.innerHTML='<header><div class="we-brand"><i>◈</i>世界引擎<small>WORLD CHRONICLE</small></div><button class="we-btn we-primary" data-action="run">推进世界</button><button class="we-btn" data-action="close" aria-label="返回主神终端">返回 ↗</button></header><div class="we-layout"><nav></nav><main></main></div><footer><span></span><small>剧情时间驱动 · 由主神终端「世界推进」总开关控制</small></footer>';
            this.panel.addEventListener('click',event=>{
                const button=event.target.closest('button');if(!button)return;
                const a=button.dataset.action;
                if(button.dataset.directory){this.directoryTab=button.dataset.directory;this.render();return;}
                if(button.dataset.faction){this.selectedFaction=button.dataset.faction;this.render();return;}
                if(button.dataset.jumpPerson){this.selectedPerson=button.dataset.jumpPerson;this.tab='角色管理';this.filter='全部';this.query='';this.selectedDate='';this.render(true);return;}
                if(button.dataset.jumpEvent){this.jumpEvent=button.dataset.jumpEvent;this.tab='世界推进';this.filter='全部';this.query=this.jumpEvent;this.selectedDate='';this.render(true);return;}
                if(button.dataset.person){this.selectedPerson=button.dataset.person;this.render();return;}
                if(a==='close')this.close();
                else if(a==='run')this.run().catch(()=>{});
                else if(a==='cancel'){this.cancel();this.status='已请求停止';this.render();}
                else if(a==='save'){
                    this.setPreset(Array.from(this.panel.querySelectorAll('[data-segment]')).map(e=>e.dataset.title?'【'+e.dataset.title+'】\n'+e.value:e.value).join('\n'));
                    this.config.contextTurns=Math.max(1,Math.min(100,Number(this.panel.querySelector('[data-floors]').value)||6));
                    this.config.activationMode=this.panel.querySelector('[data-activation]').value;
                    if(this.bookCatalogue)this.config.selectedEntries=Array.from(this.panel.querySelectorAll('[data-book]:checked')).map(e=>e.value);
                    this.saveConfig();this.status='预设与资料范围已保存';
                    this.panel.querySelector('footer span').textContent=this.status;
                }
                else if(a==='books'){
                    const drafts=Array.from(this.panel.querySelectorAll('[data-segment], [data-floors], [data-activation]')).map(e=>({selector:e.hasAttribute('data-segment')?'[data-segment="'+e.dataset.segment+'"]':e.hasAttribute('data-floors')?'[data-floors]':'[data-activation]',value:e.value}));
                    const checked=new Map(Array.from(this.panel.querySelectorAll('[data-book]')).map(e=>[e.value,e.checked]));
                    this.catalogue().then(list=>{this.bookCatalogue=list;this.render(true);for(const d of drafts){const el=this.panel.querySelector(d.selector);if(el)el.value=d.value;}this.panel.querySelectorAll('[data-book]').forEach(e=>{if(checked.has(e.value))e.checked=checked.get(e.value);});}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(a==='book-all'||a==='book-none'){this.panel.querySelectorAll('[data-book]').forEach(e=>{e.checked=a==='book-all'&&!e.disabled;});}
                else if(a==='preview'){this.buildRequest(this.snapshot()).then(r=>{this.previewRequest=r;this.tab='请求检查';this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});}
                else if(a==='month'){this.monthOffset=(this.monthOffset||0)+Number(button.dataset.step);this.render();}
                else if(a==='date'){this.selectedDate=this.selectedDate===button.dataset.date?'':button.dataset.date;this.render();}
                else if(a==='clear-date'){this.selectedDate='';this.render();}
                else if(button.dataset.filter){this.filter=button.dataset.filter;this.render();}
                else if(button.dataset.tab){this.tab=button.dataset.tab;this.filter='全部';this.query='';this.selectedDate='';this.render(true);}
            });
            this.panel.addEventListener('input',event=>{
                if(event.target.matches('[data-search]')){
                    const caret=event.target.selectionStart;this.query=event.target.value;this.render();
                    const input=this.panel.querySelector('[data-search]');input.focus();input.setSelectionRange(caret,caret);
                }
            });
            this.panel.addEventListener('change',event=>{
                if(event.target.matches('[data-retries]')){
                    const value=Math.max(0,Math.min(5,Number(event.target.value)||0));
                    this.config.retryAttempts=value;event.target.value=value;this.saveConfig();
                    this.status='失败重试次数已设为 '+value+' 次';
                    this.panel.querySelector('footer span').textContent=this.status;
                }
            });
            isolated.appendChild(this.panel);
            doc.body.appendChild(this.mount);
        }
        render(force) {
            if(!this.isOpen())return;
            let snapshot,state=emptyState(),reason='';
            try{snapshot=this.snapshot();state=Object.assign(state,snapshot.stat.世界[PATH]||{});reason=this.blocked(snapshot);}catch(e){reason=e.message;}
            const s=snapshot?snapshot.stat:{},w=s.世界||{},orbit=w.因果轨道||{};
            if(this.tab==='总览')this.tab='世界推进';
            const main=this.panel.querySelector('main'),scroll=main.scrollTop;
            const opened=new Set(Array.from(main.querySelectorAll('details[open]')).map(d=>d.dataset.detail));
            this.panel.querySelector('footer span').textContent=this.status;
            const availabilityReason=this.isConfigured()&&!this.isAvailable()?'额外模型未准备好：请在主神终端设置中配置 API 地址并选择模型':'';
            this.panel.querySelector('[data-action=run]').disabled=this.busy||!!reason||!!availabilityReason;
            this.panel.querySelector('[data-action=run]').textContent=this.busy?'推演中…':'推进世界';
            const tabs=[['世界推进','◈'],['角色管理','♙'],['探索与势力','⌖'],['任务与事件','▤'],['传闻','◌'],['提示词预设','✎'],['请求检查','⌕'],['运行记录','≋']];
            this.panel.querySelector('nav').innerHTML='<div class="we-navtitle">世界档案</div>'+tabs.map(([t,i])=>'<button data-tab="'+t+'" aria-selected="'+(this.tab===t)+'"><span>'+i+'</span>'+t+'</button>').join('');
            if(this.tab==='提示词预设'&&main.querySelector('textarea')&&!force)return;
            const text=v=>escape(v==null?'':v);
            const exists=v=>v!==''&&v!=null&&(!Array.isArray(v)||v.length)&&(!plain(v)||Object.keys(v).length);
            const pill=(v,kind='')=>'<span class="we-pill '+kind+'">'+text(v)+'</span>';
            const empty=(title,desc='首次推演后，会在这里呈现有依据的世界记录。')=>'<div class="we-empty"><b>'+text(title)+'</b>'+text(desc)+'</div>';
            const value=v=>Array.isArray(v)?(v.every(x=>!plain(x))?'<div class="we-chips">'+v.map(x=>pill(x,'dim')).join('')+'</div>':v.map(x=>'<div class="we-card">'+fields(x)+'</div>').join('')):plain(v)?fields(v):text(v);
            const fields=obj=>'<dl>'+Object.entries(obj||{}).filter(([,v])=>exists(v)).map(([k,v])=>'<dt>'+text(k)+'</dt><dd>'+value(v)+'</dd>').join('')+'</dl>';
            const details=(id,obj,title='查看完整档案')=>Object.values(obj).some(exists)?'<details data-detail="'+text(id)+'"'+(opened.has(id)?' open':'')+'><summary>'+text(title)+'</summary>'+fields(obj)+'</details>':'';
            const section=(title,body,hint='')=>'<section class="we-section"><div class="we-section-head"><h2>'+text(title)+'</h2><small>'+text(hint)+'</small></div>'+body+'</section>';
            const entries=obj=>Object.entries(obj||{});
            const parseDate=str=>{const m=String(str||'').match(/(\d+)\s*年\s*-?\s*(\d+)\s*月\s*-?\s*(\d+)\s*日/);return m?{y:+m[1],m:+m[2],d:+m[3],key:+m[1]+'-'+(+m[2])+'-'+(+m[3])}:null;};
            const dateLabel=str=>{const d=parseDate(str);return d?d.m+'月'+d.d+'日':str||'日期未定';};
            const events=entries(state.事件).sort((a,b)=>{const da=parseDate(a[1].时间||a[1].开始时间),db=parseDate(b[1].时间||b[1].开始时间);return (da?da.y*372+da.m*31+da.d:Infinity)-(db?db.y*372+db.m*31+db.d:Infinity);});
            const active=events.filter(([,e])=>e.状态==='进行中'),future=events.filter(([,e])=>e.状态==='待发生');
            const tasks=entries((s.任务||{}).列表),achievements=entries((s.任务||{}).副本成就);
            const peopleAll=new Map(entries(state.人物));entries(s.关系列表).forEach(([n,p])=>{if(!peopleAll.has(n))peopleAll.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const userName=String(this.host.SillyTavern?.name1||this.env.SillyTavern?.name1||this.host.SillyTavern?.getContext?.()?.name1||this.host.name1||'').trim();
            const playerAliases=new Set([userName,'{{user}}','<user>','玩家'].filter(Boolean).map(nameKey));
            const people=new Map(Array.from(peopleAll).filter(([name])=>!playerAliases.has(nameKey(name))));
            const person=(name,p,full=false)=>{
                const rel=(s.关系列表||{})[name]||{};
                return '<article class="'+(full?'we-card':'we-person')+'">'+(!full?'<div class="we-avatar">'+text(name.slice(0,1))+'</div>':'')+'<div><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(p.状态||(rel.在场?'在场':'场外'),'dim')+'</div><p>'+text(p.行动||p.公开动态||rel.态度||'尚无行动记录')+'</p><div class="we-meta"><span>⌖ '+text(p.地点||'地点未明')+'</span>'+(p.预计结束?'<span>至 '+text(dateLabel(p.预计结束))+'</span>':'')+'</div>'+(full?fields({目标:p.目标,当前时间段:[p.开始时间,p.预计结束].filter(Boolean).join(' → '),下次检查:p.下次检查,所属世界:p.所属世界,好感度:rel.好感度})+details('person-'+name,{行程:p.行程,认知:p.认知,认知来源:p.认知来源,登场条件:p.登场条件,关联事件:p.关联事件,更新时间:p.更新时间,人物背景:rel.背景故事},'行程 · 认知 · 关联事件'):'')+'</div></article>';
            };
            const compactPerson=(name,p)=>{
                const rel=(s.关系列表||{})[name]||{};
                return '<button class="we-person-compact" data-jump-person="'+text(name)+'"><span class="we-avatar">'+text(name.slice(0,1))+'</span><span class="we-person-copy"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span></button>';
            };
            const eventCard=(name,e)=>'<article class="we-card" data-event-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(e.状态,e.状态==='待发生'?'future':e.状态==='进行中'?'':'dim')+'</div><div class="we-meta"><span>◷ '+text(e.时间||e.开始时间||'日期未定')+'</span><span>⌖ '+text(e.地点||'地点未明')+'</span></div><p>'+text(e.公开征兆||e.描述||'等待明确事件内容')+'</p>'+details('event-'+name,{事件描述:e.描述,分类:e.分类,前因:e.前因,触发条件:e.条件,参与者:e.参与者,关联任务:e.关联任务,预计结束:e.预计结束,下次检查:e.下次检查,可见影响:e.可见影响,默认走向:e.默认走向,已确认结果:e.结果,更新时间:e.更新时间},'因果关联与事件详情')+'</article>';
            const taskCard=(name,t)=>{
                const linked=events.filter(([,e])=>(e.关联任务||[]).includes(name)),completed=['可结算','已达成'].includes(t.状态);
                const linkedNames=linked.map(([n])=>n),activeLinked=linked.filter(([,e])=>['进行中','待发生'].includes(e.状态)).length;
                return '<article class="we-card"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(t.状态||'进行中',completed?'':'future')+'</div><p>'+text(t.目标||t.说明||'等待目标记录')+'</p><div class="we-meta"><span>'+text(completed?'完成条件已满足':linked.length?linked.length+' 个关联事件 · '+activeLinked+' 个待处理':'进度依据实际剧情确认')+'</span></div>'+details('task-'+name,{来源:t.委托方,难度:t.难度,关联事件:linkedNames,奖励:t.奖励,惩罚:t.惩罚,交付:t.交付},'任务与关联事件')+'</article>';
            };
            const matched=(name,obj)=>!this.query||(name+' '+Object.values(obj).filter(v=>typeof v==='string').join(' ')).toLowerCase().includes(this.query.toLowerCase());
            const tools=(filters=[])=>'<div class="we-tools"><input data-search aria-label="搜索档案" placeholder="搜索名称、地点或内容…" value="'+text(this.query||'')+'">'+filters.map(f=>'<button data-filter="'+f+'" class="'+((this.filter||'全部')===f?'active':'')+'">'+f+'</button>').join('')+'</div>';
            const calendar=()=>{
                const today=parseDate(w.时间);
                if(!today){const semantic=events.filter(([,e])=>!parseDate(e.时间||e.开始时间)&&String(e.时间||e.开始时间||'').trim()).slice(0,12);return '<div class="we-calendar"><h3>作品内时间轴</h3><p class="we-muted">当前锚点 · '+text(w.时间||'尚无副本时间')+'</p>'+(semantic.length?'<div class="we-timeline">'+semantic.map(([n,e])=>'<p><b>'+text(e.时间||e.开始时间)+'</b><br>'+text(n)+'</p>').join('')+'</div>':'<p class="we-muted">暂无带作品内时间标记的事件</p>')+'</div>';}
                const month=new Date(0);month.setFullYear(today.y,today.m-1+(this.monthOffset||0),1);month.setHours(0,0,0,0);
                const y=month.getFullYear(),m=month.getMonth()+1,first=(month.getDay()+6)%7;
                const last=new Date(month);last.setMonth(last.getMonth()+1,0);const count=last.getDate();
                const marked=new Set(events.map(([,e])=>parseDate(e.时间||e.开始时间)?.key).filter(Boolean));
                let cells=['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'<span></span>'.repeat(first);
                for(let d=1;d<=count;d++){const key=y+'-'+m+'-'+d;cells+='<button data-action="date" data-date="'+key+'" aria-label="'+key+'" class="'+(today.key===key?'today ':'')+(marked.has(key)?'has-event ':'')+(this.selectedDate===key?'selected':'')+'">'+d+'</button>';}
                return '<div class="we-calendar"><div class="we-calhead"><button class="we-btn" data-action="month" data-step="-1" aria-label="上月">‹</button><strong>'+y+' 年 '+m+' 月</strong><button class="we-btn" data-action="month" data-step="1" aria-label="下月">›</button></div><div class="we-days">'+cells+'</div><div class="we-meta"><span>金框 · 当前日期</span><span>绿点 · 已排定事件</span></div></div>';
            };
            const hero='<div class="we-hero"><div><div class="we-eyebrow">SAMSARA / WORLD ARCHIVE</div><h1>'+text(w.名称&&w.名称!=='待初始化'?w.名称:'世界尚未建立')+'</h1><div class="we-muted">'+text(w.地点||'地点待确认')+' · '+text(orbit.当前阶段&&orbit.当前阶段!=='待初始化'?orbit.当前阶段:'等待篇章开启')+'</div></div><div class="we-date">'+text(w.时间||'副本日期待确认')+'<small>累计游玩 '+text((s.系统状态||{}).游玩天数||0)+' 天 · '+(reason?'推进暂停':'副本进行中')+'</small></div></div>';
            let html=hero+(reason?'<div class="we-notice">'+text(reason)+'</div>':'')+(availabilityReason?'<div class="we-notice">'+text(availabilityReason)+'</div>':'');
            if(this.tab==='世界推进'){
                const changes=(state.最近变化||[]).slice(-6).reverse();
                const changeHtml=changes.map(c=>'<div class="we-change"><time>'+text(dateLabel(c.时间))+'</time><div><b>'+text(c.名称||c.类别)+' · '+text(c.操作)+'</b><p>'+text(c.内容||c.字段)+'</p></div></div>').join('');
                const shown=events.filter(([n,e])=>matched(n,e)&&((this.filter||'全部')==='全部'||e.状态===this.filter)&&(!this.selectedDate||parseDate(e.时间||e.开始时间)?.key===this.selectedDate));
                const runningTasks=tasks.filter(([,t])=>['进行中','可交付'].includes(t.状态));
                const macroCount=events.filter(([,e])=>e.分类==='宏观节点').length;
                const macroFuture=events.filter(([,e])=>e.分类==='宏观节点'&&e.状态==='待发生');
                const orbitMacroPair=macroFuture.find(([n])=>n===orbit.下一节点);
                const nextPair=orbitMacroPair||macroFuture[0]||null;
                const nextNode=nextPair?.[0]||'等待宏观节点';
                const nextEvent=nextPair?.[1]||null;
                const compactPeople=Array.from(people).filter(([,p])=>p.行动||p.公开动态||p.地点).slice(0,4);
                html+='<div class="we-kpi-grid">'
                    +'<div class="we-kpi"><small>活动事件</small><strong>'+active.length+'</strong><span>'+future.length+' 个待发生</span></div>'
                    +'<div class="we-kpi"><small>宏观节点</small><strong>'+macroCount+'</strong><span>'+text(orbit.当前阶段||'阶段待确认')+'</span></div>'
                    +'<div class="we-kpi"><small>任务推进</small><strong>'+runningTasks.length+'</strong><span>'+tasks.length+' 个任务记录</span></div>'
                    +'<div class="we-kpi"><small>场外人物</small><strong>'+people.size+'</strong><span>只统计 NPC</span></div>'
                    +'</div>';
                html+='<div class="we-dashboard"><div class="we-command-main">'
                    +section('世界动向',state.公开摘要?'<div class="we-pulse"><span class="we-pulse-mark">LIVE</span><p>'+text(state.公开摘要)+'</p></div>':empty('尚无公开动态','推进成功后，这里的结果会提供给正文 AI。'),'本轮可见变化')
                    +'<section class="we-section we-timeline-board" data-detail="world-calendar"><div class="we-section-head"><h2>时间线与日历</h2><small>'+events.length+' 事件 · '+future.length+' 未来 · '+macroCount+' 宏观</small></div><div class="we-calendar-layout"><div class="we-calendar-slot">'+calendar()+'</div><div class="we-timeline-slot">'+tools(['全部','进行中','待发生','已完成','已取消'])+(this.selectedDate?'<p class="we-date-filter">筛选 '+text(this.selectedDate)+' <button class="we-btn" data-action="clear-date">显示全部</button></p>':'')+'<div class="we-timeline">'+(shown.slice(0,12).map(([n,e])=>eventCard(n,e)).join('')||empty('没有符合条件的事件'))+'</div>'+(shown.length>12?'<p class="we-muted">当前仅展示前 12 个匹配节点，可用筛选缩小范围。</p>':'')+'</div></div></section>'
                    +section('近期变化',changeHtml||empty('本轮无变化记录'),'最近一次成功推进')
                    +'</div><aside class="we-command-side">'
                    +section('下一关键节点',(nextEvent?'<button class="we-next-node" data-jump-event="'+text(nextNode)+'" title="点击定位到时间线中的对应宏观事件">':'<div class="we-next-node">')+'<span>→</span><div><h3>'+text(nextNode)+'</h3><p>'+text(nextEvent?.公开征兆||nextEvent?.描述||'本轮需要先建立真实宏观节点')+'</p><small>'+text(nextEvent?.时间||nextEvent?.开始时间||'时间待确认')+(nextEvent?' · 点击定位 →':'')+'</small></div>'+(nextEvent?'</button>':'</div>'),'因果轨道')
                    +section('任务进展',(runningTasks.slice(0,3).map(([n,t])=>'<button class="we-brief-row" data-tab="任务与事件"><b>'+text(n)+'</b>'+pill(t.状态||'进行中','future')+'<span>'+text(t.目标||t.说明||'')+'</span></button>').join('')||empty('暂无进行中任务')),'优先显示进行中 / 可交付')
                    +section('人物动态',(compactPeople.length?'<div class="we-people-strip">'+compactPeople.map(([n,p])=>compactPerson(n,p)).join('')+'</div><button class="we-link-btn" data-tab="角色管理">查看人物名册 →</button>':empty('暂无人物动态')),'只显示重点 NPC')
                    +'</aside></div>';
            }else if(this.tab==='角色管理'){
                const list=Array.from(people).filter(([n,p])=>matched(n,p)&&((this.filter||'全部')==='全部'||(this.filter==='在场'?!!(s.关系列表||{})[n]?.在场:!(s.关系列表||{})[n]?.在场)));
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                html+=tools(['全部','在场','场外'])+'<div class="we-columns"><div>'+section('人物名册','<div class="we-tools">'+list.map(([n])=>'<button data-person="'+text(n)+'" class="'+(chosen?.[0]===n?'active':'')+'">'+text(n)+'</button>').join('')+'</div>')+(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true))+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查})):empty('没有符合条件的人物'))+'</div><aside>'+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';
            }else if(this.tab==='探索与势力'){
                const records=new Map(entries(state.势力地区));
                entries(w.势力).forEach(([name,r])=>records.set(name,{...r,...records.get(name),类型:'势力'}));
                entries(w.探索).forEach(([name,r])=>{if(!records.has(name))records.set(name,{...r,类型:'地区'});});
                const all=Array.from(records),areas=all.filter(([,r])=>r.类型!=='势力'),factions=all.filter(([,r])=>r.类型==='势力');
                const selected=factions.find(([n])=>n===this.selectedFaction)||factions[0];
                const dir=this.directoryTab||'探索';
                html+=section('探索名录','<div class="we-tools">'+['探索','热点','势力'].map(t=>'<button data-directory="'+t+'" class="'+(dir===t?'active':'')+'">'+t+'</button>').join('')+'</div>'+
                    (dir==='探索'?areas.map(([n,r])=>'<details><summary>'+text(n)+' · '+text(r.控制方||'控制权未明')+'</summary>'+fields({描述:r.描述,控制方:r.控制方,争夺方:r.争夺方,探索度:r.探索度,环境:r.环境状态})+'</details>').join(''):
                    dir==='热点'?events.filter(([,e])=>e.状态==='进行中').map(([n,e])=>eventCard(n,e)).join(''):
                    factions.map(([n,r])=>'<button class="we-brief-row" data-faction="'+text(n)+'"><b>'+text(n)+'</b><span>'+text(r.目标||r.描述||'目标未记录')+'</span></button>').join(''))||empty('暂无名录记录'));
                html+='<div class="we-columns"><div>'+section('势力格局','<div class="we-grid">'+factions.map(([n,r])=>'<button class="we-card" data-faction="'+text(n)+'"><h3>'+text(n)+'</h3><p>'+text(r.目标||r.描述||'目标未记录')+'</p><small>'+text(r.领地||'领地未记录')+'</small></button>').join('')+'</div><p class="we-muted">只显示已知势力与控制关系，不推测未记录的联盟或敌对。</p>')+'</div><aside>'+section('势力档案',selected?'<h3>'+text(selected[0])+'</h3>'+fields(selected[1]):empty('本轮没有势力记录'))+'</aside></div>';
                html+=section('各地情势',areas.map(([n,r])=>'<details><summary>'+text(n)+' · '+text(r.进展||r.公开动态||r.描述||'情势待确认')+'</summary>'+fields(r)+'</details>').join('')||empty('本轮没有地区记录'));
            }else if(this.tab==='任务与事件'){
                html+=section('世界事件节点',events.map(([n,e])=>eventCard(n,e)).join('')||empty('尚未排定事件节点','世界引擎会围绕当前时间锚点建立活动、近期与宏观节点；任务直接关联这些事件。'));
                html+=tools(['全部','进行中','可交付','可结算','失败'])+section('当前任务','<div class="we-grid">'+tasks.filter(([n,t])=>matched(n,t)&&((this.filter||'全部')==='全部'||t.状态===this.filter)).map(([n,t])=>taskCard(n,t)).join('')+'</div>');
                html+=section('副本成就','<div class="we-grid">'+achievements.filter(([n,t])=>matched(n,t)).map(([n,t])=>taskCard(n,t)).join('')+'</div>',achievements.filter(([,t])=>t.状态==='已达成').length+'/'+achievements.length+' 已达成');
            }else if(this.tab==='传闻'){
                html+=tools();
                for(const category of ['街头巷议','情报交易','布告与檄文'])html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
                html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            }else if(this.tab==='运行记录'){
                html+='<div class="we-tools"><button data-action="cancel">停止当前请求</button></div>'+section('推演记录',(state.运行记录||[]).slice().reverse().map(r=>'<article class="we-card"><div class="we-card-top"><h3>'+text(r.时间)+'</h3>'+pill(r.补丁数+' 项变化','dim')+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚未执行推演'));
                html+=section('历史锚点',entries(state.历史).reverse().map(([n,r])=>'<article class="we-card"><div class="we-meta">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无已确认的历史锚点'));
            }else if(this.tab==='提示词预设'){
                html+='<div class="we-notice">先保存设置，再生成请求预览验证。蓝绿灯表示条目触发方式，“实际读取”以请求检查中的本次清单为准。</div>';
                const groups=new Map();
                for(const e of this.bookCatalogue||[]){if(!groups.has(e.book))groups.set(e.book,[]);groups.get(e.book).push(e);}
                const selected=e=>!e.technical&&(this.config.selectedEntries?this.config.selectedEntries.includes(JSON.stringify([e.book,e.id])):e.enabled);
                html+=section('资料读取范围','<div class="we-config-row"><label>正文窗口 <input data-floors type="number" min="1" max="100" value="'+(this.config.contextTurns||6)+'"> 层</label><label>读取方式 <select data-activation><option value="respect_activation" '+(this.config.activationMode!=='force_selected'?'selected':'')+'>遵循蓝绿灯</option><option value="force_selected" '+(this.config.activationMode==='force_selected'?'selected':'')+'>强制读取勾选项</option></select></label></div><p class="we-muted">遵循蓝绿灯：蓝灯常驻，绿灯扫描上述正文窗口的关键词；禁用项不读。世界推进的宏观骨架不依赖世界书：没有世界书时直接使用当前事实与模型已有的原著/世界知识。若时间轴未初始化或待发生宏观节点少于3个，已启用且标题明确属于校历、年表、时间线、大事记、大事件摘要、剧情大纲/章节控制的条目会临时作为「宏观资料补充」读取，供模型校正；补足后恢复普通绿灯。强制模式可纳入普通禁用项，但 [variables]、[mvu_update]、正文额外思考及任务/输出技术条目始终隔离。</p><div class="we-tools"><button data-action="books">加载 / 刷新目录</button><button data-action="book-all">全选</button><button data-action="book-none">全不选</button></div>'+
                    (groups.size?Array.from(groups).map(([book,list])=>'<details class="we-book" open><summary>'+text(book)+' <small>'+list.filter(selected).length+' / '+list.length+' 项已保存勾选</small></summary><div class="we-book-list">'+list.map(e=>{
                        const report=(this.readReport||[]).find(r=>r.世界书===e.book&&r.条目ID===e.id);
                        return '<label class="we-book-row"><input type="checkbox" data-book value="'+text(JSON.stringify([e.book,e.id]))+'" '+(selected(e)?'checked':'')+' '+(e.technical?'disabled':'')+'><span class="we-lamp '+(e.technical?'gray':e.mode==='constant'?'blue':e.mode==='selective'?'green':'gray')+'" title="'+text(e.technical?'技术条目 · 已隔离':e.mode==='constant'?'蓝灯 · 常驻':e.mode==='selective'?'绿灯 · 关键词触发':'其他激活方式')+'"></span><span class="we-book-title"><b>'+text(e.title)+'</b><small>'+text(e.technical?'技术条目 · 世界引擎不读取':(e.mode==='constant'?'常驻':e.mode==='selective'?'关键词：'+(Array.isArray(e.keys)?e.keys.map(k=>typeof k==='string'?k:'正则条件').join('、'):e.keys):e.mode)+(e.enabled?'':' · 已禁用'))+'</small></span><small class="we-read-state">'+text(report?'上次检查：'+report.原因:e.technical?'固定隔离':'尚未检查')+'</small></label>';
                    }).join('')+'</div></details>').join(''):empty('尚未加载目录','点击加载；预览会按已保存设置实际读取，并报告命中或跳过原因。')));
                html+=section('分段提示词',splitPresetSegments(this.config.preset).map((part,i)=>'<details data-detail="preset-'+i+'"><summary>'+text(part.title||'身份与总则')+' · '+part.body.length+' 字</summary><textarea data-segment="'+i+'" data-title="'+text(part.title)+'" aria-label="预设分段 '+i+'">'+text(part.body)+'</textarea></details>').join('')+'<p class="we-muted">分段标题是结构锚点，由系统固定保存；你只编辑正文。即使某段正文被清空，核心约束仍会单独注入，不会让调度结构失效。</p>');
                html+='<div class="we-tools"><button class="we-btn we-primary" data-action="save">保存预设与范围</button><button class="we-btn" data-action="preview">预览下一次请求</button></div>';
            }else if(this.tab==='请求检查'){
                const fold=(title,body)=>'<details class="we-inspect"><summary>'+text(title)+'</summary><div class="we-inspect-body">'+body+'</div></details>';
                const raw=(label,v)=>fold(label,'<textarea class="we-raw" readonly>'+text(v)+'</textarea>');
                const readable=(name,v)=>Array.isArray(v)?v.map((item,i)=>fold((item.名称||item.楼层!==undefined&&(item.角色+' · 第 '+item.楼层+' 层')||name+' '+(i+1)),fields(item))).join(''):fields(plain(v)?v:{内容:v});
                const retryLog=(this.lastRetryLog||[]).map(item=>'<div class="we-change"><time>#'+text(item.重试)+'</time><div><b>模型回复被拒绝</b><p>'+text(item.错误)+'</p></div></div>').join('');
                html+=section('失败自动重试','<div class="we-config-row"><label>失败重试次数 <input data-retries type="number" min="0" max="5" value="'+text(this.config.retryAttempts??3)+'"> 次</label><span class="we-muted">首次请求失败后，最多再请求这么多次；默认 3，最大 5。只纠正模型回复/补丁，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(this.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(this.lastAttemptCount)+' 次。</p>':'')+(retryLog||''));
                html+='<div class="we-tools"><button data-action="preview">生成下一次请求预览（不调用 API）</button></div>';
                for(const [label,r] of [['最近实际发送',this.lastRequest],['下一次请求预览',this.previewRequest]]){
                    if(!r){html+=section(label,empty('暂无'+label));continue;}
                    const m=r.manifest,books=m.世界书条目||[],floors=m.正文楼层||[];
                    let body='<div class="we-request-summary">'+pill(books.length+' 条世界书','dim')+pill(floors.length+' 层正文','dim')+pill(m.请求字符数+' 字符','dim')+(m.尝试序号?pill('尝试 '+m.尝试序号,'dim'):'')+(m.最大失败重试!==undefined?pill('最多重试 '+m.最大失败重试,'dim'):'')+'</div>';
                    body+=fold('资料清单与命中判定（点击展开）',readable('条目',m.读取判定||books)+fold('实际正文楼层',fields({楼层:floors.map(f=>f.楼层+' · '+f.角色+' · '+f.字符数+'字')})));
                    body+=fold('system · 分段阅读',r.system.split(/\n(?=【)/).map((part,i)=>fold((part.match(/^【([^】]+)】/)||[])[1]||'身份 / 协议 '+(i+1),'<div class="we-prose">'+text(part)+'</div>')).join(''))+raw('system · 完整原文',r.system);
                    let payload;try{payload=JSON.parse(r.input);}catch(_){payload={正文:r.input};}
                    body+=fold('user · 分段阅读',Object.entries(payload).map(([name,v])=>fold(name,readable(name,v))).join(''))+raw('user · 完整原文',r.input);
                    html+=section(label,body);
                }
                if(this.lastFailure)html+='<div class="we-notice">'+text(this.lastFailure)+'</div>';
                if(this.lastReply)html+=section('副 API 原始回复',raw('查看模型返回原文（用于定位格式问题）',this.lastReply));
            }
            main.innerHTML=html;main.scrollTop=force?0:scroll;
            if(this.jumpEvent){
                const jumpName=this.jumpEvent;
                const target=Array.from(main.querySelectorAll('[data-event-card]')).find(el=>el.dataset.eventCard===jumpName);
                if(target){
                    target.classList.add('is-jump');
                    target.scrollIntoView({behavior:'smooth',block:'center'});
                    setTimeout(()=>target.classList.remove('is-jump'),1200);
                }
                this.jumpEvent='';
            }
        }
        dispose() {
            this.close(); this.disposed = true; this.cancel(); clearTimeout(this.initTimer);
            this.unsub.forEach(off => off()); this.unsub = [];
            if (this.keyHandler) this.host.document.removeEventListener('keydown',this.keyHandler,true);
            if (this.panel) this.panel.remove(); if (this.style) this.style.remove();
            if (this.mount) this.mount.remove();
        }
    }
    // CommonJS 入口仅供离线测试，浏览器脚本不依赖打包器。
    if (typeof module !== 'undefined' && module.exports) { module.exports = {SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS}; return; }
    const host = root.parent && root.parent !== root ? root.parent : root;
    // 酒馆脚本沙箱中的助手接口可能是词法全局，不一定挂在 iframe.window 上。
    const runtime = {
        get Mvu() { return typeof Mvu !== 'undefined' ? Mvu : root.Mvu || host.Mvu; },
        get tavern_events() { return typeof tavern_events !== 'undefined' ? tavern_events : root.tavern_events || host.tavern_events; }
    };
    if (typeof eventOn === 'function') runtime.eventOn = (...args) => eventOn(...args);
    if (typeof getChatMessages === 'function') runtime.getChatMessages = (...args) => getChatMessages(...args);
    if (typeof getCurrentChatId === 'function') runtime.getCurrentChatId = (...args) => getCurrentChatId(...args);
    if (typeof getCharWorldbookNames === 'function') runtime.getCharWorldbookNames = (...args) => getCharWorldbookNames(...args);
    if (typeof getWorldbook === 'function') runtime.getWorldbook = (...args) => getWorldbook(...args);
    host.Samsara = host.Samsara || {};
    if (host.Samsara.worldEngine) host.Samsara.worldEngine.dispose();
    const engine = new SamsaraWorldEngine(host,runtime);
    host.Samsara.WorldEngine = SamsaraWorldEngine;
    host.Samsara.worldEngine = engine; engine.init();
    root.addEventListener('unload', () => engine.dispose(), {once:true});
})(typeof window !== 'undefined' ? window : globalThis);
