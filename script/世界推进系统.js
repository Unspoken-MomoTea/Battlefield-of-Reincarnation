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
    // P1-C 诊断只需要稳定的近似量级；不同模型 tokenizer 不同，只有 API usage 才视为精确 token。
    function estimateTokens(value) {
        const source=typeof value==='string'?value:JSON.stringify(value??'');
        if(!source)return 0;
        let eastAsian=0,nonAscii=0,ascii=0;
        for(const ch of source){
            const cp=ch.codePointAt(0);
            const east=(cp>=0x3400&&cp<=0x9fff)||(cp>=0xf900&&cp<=0xfaff)||(cp>=0x3040&&cp<=0x30ff)||(cp>=0x31f0&&cp<=0x31ff)||(cp>=0xac00&&cp<=0xd7af)||(cp>=0x3100&&cp<=0x312f)||(cp>=0xff00&&cp<=0xffef);
            if(east)eastAsian++;
            else if(cp<=0x7f)ascii++;
            else nonAscii++;
        }
        return Math.max(1,Math.ceil(eastAsian*1.08+nonAscii+ascii/3.8));
    }
    function formatTokenCount(count,estimated=true) {
        const n=Math.max(0,Math.round(Number(count)||0));
        let value=String(n);
        if(n>=1000){
            const digits=n>=100000?0:n>=10000?1:2;
            value=(n/1000).toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1')+'k';
        }
        return (estimated?'≈':'')+value+' tk';
    }
    function normalizeTokenUsage(usage) {
        if(!plain(usage))return null;
        const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.round(Number(value)):null;
        const inputTokens=finite(usage.prompt_tokens??usage.input_tokens??usage.promptTokens??usage.inputTokens);
        const outputTokens=finite(usage.completion_tokens??usage.output_tokens??usage.completionTokens??usage.outputTokens);
        let totalTokens=finite(usage.total_tokens??usage.totalTokens);
        if(totalTokens===null&&inputTokens!==null&&outputTokens!==null)totalTokens=inputTokens+outputTokens;
        return inputTokens===null&&outputTokens===null&&totalTokens===null?null:{inputTokens,outputTokens,totalTokens};
    }
    function requestTokenTelemetry(system,input,schema) {
        const systemText=String(system||''),inputText=String(input||'');
        let payload=null;try{payload=JSON.parse(inputText);}catch(_){}
        const systemParts=systemText.split(/\n(?=【)/).filter(Boolean).map((part,index)=>({
            名称:(part.match(/^【([^】]+)】/)||[])[1]||'system '+(index+1),
            估算Tokens:estimateTokens(part)
        }));
        const userParts=plain(payload)?Object.entries(payload).filter(([,value])=>value!==undefined).map(([name,value])=>({
            名称:name,估算Tokens:estimateTokens(JSON.stringify({[name]:value},null,2))
        })):[];
        const systemTokens=estimateTokens(systemText),userTokens=estimateTokens(inputText);
        return {
            估算:true,
            请求估算Tokens:systemTokens+userTokens,
            System估算Tokens:systemTokens,
            User估算Tokens:userTokens,
            Schema估算Tokens:estimateTokens(JSON.stringify(schema||{},null,2)),
            System分段:systemParts,
            User分段:userParts
        };
    }
    function digest(text) {
        let a = 2166136261, b = 5381;
        for (let i=0;i<text.length;i++) { a = Math.imul(a ^ text.charCodeAt(i),16777619); b = Math.imul(b,33) ^ text.charCodeAt(i); }
        return (a >>> 0).toString(16) + (b >>> 0).toString(16) + ':' + text.length;
    }
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
    const CONFIG = 'samsara_world_engine_v1';
    const STATUS_THEME_CONFIG = 'samsara_theme_v2';
    // 六主题只在这里维护色值。CSS 只消费语义 token，避免羊皮/樱白等主题再堆局部补丁。
    const WORLD_UI_THEMES = Object.freeze({
        night:Object.freeze({scheme:'dark',shell:'#0e1320',main:'#101824',surface:'#151e2c',card:'#1b2636',cardHover:'#213044',input:'#111a27',line:'#344357',ink:'#edf3f8',sub:'#bac6d4',accent:'#9aa8ff',accentSoft:'#9aa8ff24',gold:'#d9b978',mint:'#7dcbbb',head:'#111a27',nav:'#0c1420',notice:'#251f18',action:'#9aa8ff',actionInk:'#111827'}),
        crimson:Object.freeze({scheme:'dark',shell:'#170d12',main:'#1b1016',surface:'#24131a',card:'#301923',cardHover:'#3a1f2b',input:'#180d13',line:'#5b2f3a',ink:'#fff2f5',sub:'#d8b8c0',accent:'#ff7670',accentSoft:'#ff767024',gold:'#ffb347',mint:'#e49aac',head:'#230f16',nav:'#180a10',notice:'#2d1b13',action:'#ff7670',actionInk:'#2a0e13'}),
        indigo:Object.freeze({scheme:'dark',shell:'#0d1024',main:'#11152d',surface:'#171b39',card:'#20254a',cardHover:'#292f5a',input:'#0e1229',line:'#373d72',ink:'#f0f2ff',sub:'#bec3e8',accent:'#8b78ff',accentSoft:'#8b78ff25',gold:'#ffd166',mint:'#65c9c3',head:'#11162f',nav:'#0a0d20',notice:'#29231a',action:'#8b78ff',actionInk:'#101426'}),
        parchment:Object.freeze({scheme:'light',shell:'#e8dcc3',main:'#f1e7d2',surface:'#fff7e7',card:'#f4e6ca',cardHover:'#eddcbc',input:'#fffaf0',line:'#c9ad79',ink:'#392b18',sub:'#6c5432',accent:'#855a16',accentSoft:'#855a1620',gold:'#7a5215',mint:'#4f6f3d',head:'#5c4325',nav:'#6b5030',notice:'#f2dfb9',action:'#d9a441',actionInk:'#2b1a08'}),
        sakura:Object.freeze({scheme:'light',shell:'#f4dce4',main:'#fff0f5',surface:'#fff9fb',card:'#fbe3eb',cardHover:'#f6d8e3',input:'#fffafd',line:'#ddb6c5',ink:'#432532',sub:'#765466',accent:'#a63f69',accentSoft:'#a63f6922',gold:'#8a5624',mint:'#446f62',head:'#6c3148',nav:'#7b3d55',notice:'#f7e2d3',action:'#ee8eb3',actionInk:'#3b1e2a'}),
        matcha:Object.freeze({scheme:'light',shell:'#dcebd4',main:'#eef5e8',surface:'#fbfdf8',card:'#e3efd9',cardHover:'#d8e8cc',input:'#fbfff7',line:'#b7cbaa',ink:'#263823',sub:'#53694f',accent:'#3e7746',accentSoft:'#3e774622',gold:'#73591f',mint:'#39725f',head:'#31563a',nav:'#284630',notice:'#edf0ce',action:'#79b77e',actionInk:'#17311f'})
    });
    const WORLD_TONE_KEYS = new Set(Object.keys(WORLD_UI_THEMES));
    const WORLD_UI_THEME_CSS = Object.entries(WORLD_UI_THEMES).map(([tone,theme])=>{
        const vars=Object.entries(theme).filter(([key])=>key!=='scheme').map(([key,value])=>'--we-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+value).join(';');
        return '#sam-world-engine[data-tone="'+tone+'"]{'+vars+';color-scheme:'+theme.scheme+'}';
    }).join('\n');
    const WORLD_FONT_SCALES = {
        standard:{name:'标准',size:'16px',desc:'正文约15px，辅助字不低于13px'},
        large:{name:'大字',size:'18px',desc:'正文约17px，辅助字约14-15px'},
        xlarge:{name:'特大',size:'20px',desc:'正文约19px，远距离阅读'}
    };
    const PATH = '后台';
    const EVENT_TARGET = 180;
    const HISTORY_TARGET = 200;
    const RECENT_FINISHED_EVENT_TARGET = 8;
    const FINISHED_EVENT_GRACE_HOURS = 24;
    const HOT_HISTORY_TARGET = 24;
    const HOT_OFFSET_TARGET = 8;
    const HOT_PROPAGATION_TARGET = 24;
    const HOT_PERSON_TARGET = 24;
    const HOT_PERSON_RECENT_HOURS = 72;
    const COLD_TEMP_PERSON_GRACE_HOURS = 30 * 24;
    const COLD_TEMP_PERSON_TARGET = 32;
    const TERMINAL_PERSON_STATUS = /^(?:已结束|结束|已离场|离场|已离开|离开|退休|已退休|失效|已失效|消失|已消失|死亡)$/;
    const TECHNICAL_BOOK = [/^\[variables\]/i,/^\[mvu_update\]/i,/^output_format_/i,/^⚙️额外思考(?:\.|$)/,/^行动选项_/i,/^【(?:主神任务|结算任务|试炼任务|选择世界)】/];
    const isTechnicalBook = title => TECHNICAL_BOOK.some(rule => rule.test(String(title || '').trim()));
    // 聊天接口返回原始消息，不会应用酒馆的显示正则。发送和关键词扫描共用此抽取结果。
    function extractWorldProse(value) {
        let source=String(value??'').replace(/\r\n?/g,'\n');
        source=source.replace(/<!--[\s\S]*?(?:-->|$)/g,'\n');
        source=source.replace(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>[\s\S]*?(?:<\/details>|$)/gi,
            (block,title)=>/思考|思维链|变量|更新|检定|结算|状态栏|thinking|reasoning|analysis/i.test(title)?'\n':block);
        const hidden=new Set(['think','thinking','reasoning','analysis','konatan_planning','dm_think','chain_of_thought',
            'updatevariable','jsonpatch','variables','status_current_variables','user_status_readonly',
            'worldresult','options','statusplaceholder',
            'action','summary','update','scene_time','pic','dicecombat','dicecheck','enemyoverview',
            'summonoverview','lootlog','experiencelog','questcontract','merchantstore','combatsnapshot',
            'ash-review','acu-review','ash_review','acu_review','ash_note','acu_note','ash-review-slot',
            'script','style','head','iframe']); // 'combatresult','craftresult','checkresult',
        // 部分正文模型通过 assistant prefill 注入隐藏块的开始标签，最终楼层只会保存结束标签。
        // 仅对思考类标签启用“首个隐藏标签为孤立结束标签”的兼容，避免误吞变量/面板前的正常正文。
        const prefillHidden=new Set(['think','thinking','reasoning','analysis','konatan_planning','dm_think','chain_of_thought']);
        // 按标签栈移除整个技术块，支持嵌套与属性；未闭合技术块的剩余内容也不发送。
        const tags=/<\s*(\/?)\s*([a-z_][\w-]*)\b[^>]*>/gi;
        const stack=[];let text='',cursor=0,match,seenHiddenTag=false;
        while((match=tags.exec(source))){
            const name=match[2].toLowerCase();
            if(!hidden.has(name))continue;
            const closing=!!match[1];
            // assistant prefill 可能把 <thinking>/<konatan_planning~> 等开始标签放在保存文本之外。
            // 若本楼第一个隐藏边界就是对应结束标签，则从消息开头到该标签都属于隐藏思考。
            if(closing&&!stack.length&&!seenHiddenTag&&prefillHidden.has(name)){
                cursor=tags.lastIndex;
                seenHiddenTag=true;
                continue;
            }
            seenHiddenTag=true;
            if(!stack.length)text+=source.slice(cursor,match.index);
            if(closing){
                const at=stack.lastIndexOf(name);
                if(at>=0)stack.length=at;
            }else if(!/\/\s*>$/.test(match[0]))stack.push(name);
            cursor=tags.lastIndex;
            if(!stack.length)text+='\n';
        }
        if(!stack.length)text+=source.slice(cursor);
        // 代码面板不属于已演出剧情；无语言标记的纯叙事围栏仍可兼容。
        text=text.replace(/^[ \t]*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm,
            (_block,_fence,language,body)=>{
                if(/^(?:json\w*|ya?ml|html|xml|javascript|js|typescript|ts|css|python|diff)\b/i.test(language.trim()))return '\n';
                try{const data=JSON.parse(body);if(data&&typeof data==='object')return '\n';}catch(_){}
                return body;
            });
        // 对应参考助手 bodyTagsText 为空的模式：始终清洗整楼，不按正文标签截取。
        try{const data=JSON.parse(text);if(data&&typeof data==='object')return '';}catch(_){}
        return text.replace(/<[^>]+>/g,tag=>/^<user>$/i.test(tag)?tag:'')
            .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    }
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
        const y=+m[1],month=+m[2],day=+m[3];
        if(!Number.isInteger(y)||!Number.isInteger(month)||!Number.isInteger(day)||month<1||month>12||day<1)return null;
        const date=new Date(0);
        date.setUTCFullYear(y,month-1,day);date.setUTCHours(0,0,0,0);
        // 数字年月日按真实公历天序计算，避免 2月28日→3月1日 被旧“每月31天”近似拉成96小时。
        // 非公历/相对语义本来就不会匹配这里，继续由语义复核处理。
        if(date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
        const part=source.match(/凌晨|黎明|清晨|早晨|上午|中午|午后|下午|傍晚|入夜|晚上|深夜/);
        const hour={凌晨:2,黎明:5,清晨:6,早晨:8,上午:10,中午:12,午后:14,下午:15,傍晚:18,入夜:19,晚上:20,深夜:23};
        let dayHour=part?hour[part[0]]:0;
        const branch=source.match(/([子丑寅卯辰巳午未申酉戌亥])时(?:([一二三四1234])刻)?/);
        if(branch){
            const branchHour={子:23,丑:1,寅:3,卯:5,辰:7,巳:9,午:11,未:13,申:15,酉:17,戌:19,亥:21};
            const quarterMap={一:1,二:2,三:3,四:4,'1':1,'2':2,'3':3,'4':4};
            dayHour=branchHour[branch[1]]+(quarterMap[branch[2]]||0)*0.25;
        }
        return date.getTime()/3600000+dayHour;
    }
    function worldTimeCapacity(previous,current) {
        const from=String(previous||'').trim(),to=String(current||'').trim();
        const a=worldDateKey(from),b=worldDateKey(to);
        if(!from)return {起点:'首次运行/无上次引擎时间',终点:to,小时:null,等级:'首轮初始化',允许:'先建立宏观骨架；近期细节只依据当前事实，不假定额外耗时。'};
        if(a!==null&&b!==null){
            const hours=Math.max(0,b-a);
            if(hours<=0)return {起点:from,终点:to,小时:0,等级:'未推进',允许:'只能记录本轮新确认事实、即时反应或同步结果；不得完成需要时间的后台事项。'};
            if(hours<=2)return {起点:from,终点:to,小时:hours,等级:'短时段',允许:'只够当面短谈、通讯、案头事务或同区域短途移动；大型行动只能准备或启动。'};
            if(hours<=12)return {起点:from,终点:to,小时:hours,等级:'数小时',允许:'允许同城区移动、有限调查/准备、一次工作阶段；跨城或大规模调动通常不能完成。'};
            if(hours<=24)return {起点:from,终点:to,小时:hours,等级:'半天至一天',允许:'允许完成一套日常事务、一次较完整阶段或城区迁移；长期工程与远距行动仍需分段。'};
            return {起点:from,终点:to,小时:hours,等级:'数日以上',允许:'可推进长途行程、物资转运、据点/组织事项的多个阶段，但仍按因果与资源逐步推进。'};
        }
        return {起点:from,终点:to,小时:null,等级:'作品内时间',允许:'按作品内时间语义保守估计行动容量；无法确认跨度时只推进一步，不直接跳到长期结果。'};
    }
    // 仅供日历显示：优先使用可识别数字年份；作品纪年无法识别年份但能识别月日时，用 2026 作为显示年。
    // 若世界.历法提供月份天数，则以该历法为准，不再套用公历月长。
    function calendarDate(value, calendar) {
        const source=String(value||'').trim();
        const full=source.match(/(?:^|[^\d])(\d{1,4})\s*年\s*-?\s*(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/)||source.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
        let y,month,d,fallbackYear=false;
        if(full){
            y=+full[1];month=+full[2];d=+full[3];
        }else{
            const md=source.match(/(?:^|[^\d])(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/)||source.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})(?!\d)/);
            if(!md)return null;
            y=2026;month=+md[1];d=+md[2];fallbackYear=true;
        }
        const custom=Array.isArray(calendar?.月份天数)?calendar.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
        if(custom.length){
            if(month<1||month>custom.length||d<1||d>custom[month-1])return null;
            return {y,m:month,d,key:y+'-'+month+'-'+d,fallbackYear,customCalendar:true};
        }
        const date=new Date(0);
        date.setFullYear(y,month-1,d);date.setHours(0,0,0,0);
        if(date.getFullYear()!==y||date.getMonth()!==month-1||date.getDate()!==d)return null;
        return {y,m:month,d,key:y+'-'+month+'-'+d,fallbackYear,customCalendar:false};
    }
    const DEFAULT_PRESET = `你是轮回战场的世界引擎。只推进正文场景之外仍在运行的世界，并保持事件、场景、人物、势力、传播、资产与因果一致。
【执行流程】
Step 1 · 取事实：按“当前变量/本轮已确认剧情 > 明确世界书 > 模型常识”读取；已确认差异优先。
Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。
Step 3 · 推区间：严格按本轮时间容量，先处理到期/进行中事项，再把未完事项推进合理一步；计划不是事实，不越过下一宏观边界。
Step 4 · 现场到人物：先更新当前区间内确实变化的地区现场，再决定人物行动。人物受地点、路程、能力、认知、职责、资产与地区条件约束；同场正文未决时停在交互前。活跃异端每轮复核。
Step 5 · 结算玩家影响：只按<user>已确认行为结算探索与势力；只有重大因果改变才记偏移，必要时重构宏观骨架。
Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。
Step 7 · 输出差分：只输出本轮新增或变化的 WorldResult；无业务变化只写摘要。
【执行检查】
时间/路程可实现；人物知识有来源；同一人物同一时段只在一处；不替<user>行动；不复述已演出琐事；世界不会因<user>停下而暂停。`;
    const BUILTIN_DEFAULT_SELECTED_ENTRIES = [
            "[\"轮回战场V3.6.1\",\"915830\"]",
            "[\"轮回战场V3.6.1\",\"196248\"]",
            "[\"轮回战场V3.6.1\",\"503929\"]",
            "[\"轮回战场V3.6.1\",\"931853\"]",
            "[\"轮回战场V3.6.1\",\"446543\"]",
            "[\"轮回战场V3.6.1\",\"381583\"]",
            "[\"轮回战场V3.6.1\",\"965161\"]",
            "[\"轮回战场V3.6.1\",\"556346\"]",
            "[\"轮回战场V3.6.1\",\"122086\"]",
            "[\"轮回战场V3.6.1\",\"2\"]",
            "[\"轮回战场V3.6.1\",\"562289\"]",
            "[\"轮回战场V3.6.1\",\"937185\"]",
            "[\"轮回战场V3.6.1\",\"612483\"]",
            "[\"轮回战场V3.6.1\",\"544521\"]",
            "[\"轮回战场V3.6.1\",\"454622\"]",
            "[\"轮回战场V3.6.1\",\"671885\"]",
            "[\"轮回战场V3.6.1\",\"345604\"]",
            "[\"轮回战场V3.6.1\",\"558862\"]",
            "[\"轮回战场V3.6.1\",\"78614\"]",
            "[\"轮回战场V3.6.1\",\"229663\"]",
            "[\"轮回战场V3.6.1\",\"985921\"]",
            "[\"轮回战场V3.6.1\",\"625413\"]",
            "[\"轮回战场V3.6.1\",\"8412\"]",
            "[\"轮回战场V3.6.1\",\"559085\"]"
        ];
    const BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS = new Set(['任务与委托系统']);
    const USER_DEFAULT_PROMPT_DOCUMENT_ID='user-default';
    const BUILTIN_DEFAULT_PROMPT_DOCUMENT = {
        id:'builtin-default',
        type:'samsara-world-prompt-document',
        version:14,
        builtin:true,
        name:'默认设置',
        exportedAt:'2026-09-10T00:00:00.000Z',
        createdAt:'2026-09-08T13:09:45.350Z',
        updatedAt:'2026-09-10T00:00:00.000Z',
        settings:{
            // 直接引用当前 DEFAULT_PRESET，避免以后修改默认提示词却忘记同步“默认设置”文档。
            preset:normalizeEditablePreset(DEFAULT_PRESET),
            contextTurns:3,
            activationMode:'respect_activation',
            selectedEntries:copy(BUILTIN_DEFAULT_SELECTED_ENTRIES)
        }
    };
    const BUILTIN_DEFAULT_PROMPT_VERSION = BUILTIN_DEFAULT_PROMPT_DOCUMENT.version;
    const CORE_WORLD_RULES = `【世界引擎核心约束】
1. 事实：当前变量与已确认剧情 > 明确世界书 > 模型常识；计划不是事实，已确认差异不得被原著常识覆盖。
2. 宏观与时间：只用世界.时间计算本世界进展；宏观顺序保持3~5个阶段级节点，细节只推进到下一宏观边界。待发生/进行中事件必须有可排序时间或明确因果时间；无法确认跨度时只推进一步。
3. 现场与认知：现场群体与环境事实属于势力地区，同一现场事实不得复制进人物。先更新地区现场再决定人物行动；人物只能依据在场、既有认知或传播链行动，不得全知反应。
4. 人物边界：活跃异端每轮复核，死亡不可恢复；普通人物只保留真正热记录。不得替<user>建立后台行动。主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。普通副本返回主神空间后停止本世界推演；单一世界局部结算不重置世界。
5. 资产：顶层资产是唯一资产账簿；所属对象为数组，多主体可共管，空数组表示无主，含<user>表示玩家拥有/共管。可按已确认场外事实新增、更新、转移或移除资产；删除保护中的同名资产不得自动重建。正文/MVU已结算的当前场景变化只同步，不重复结算。
6. 玩家台账：探索只结算<user>实际到达、调查或可靠获知的整体区域；探索度以0/10/30/60/90/100为阶段锚点且无因不回退。势力声望只因<user>真实关系结果变化，同一结果只结算一次，单轮绝对变化≤1000，超过500仅限重大事件。
7. 因果：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；影响程度负值表示偏离原轨道，正值表示修复/强化。世界超稳时不新增偏移；旧轨道失效时同轮重构宏观顺序。
8. 公开与基础：当前事件公开字段只写已成为现实且可合理感知的信息。货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护。`;
    function splitPresetSegments(value) {
        return String(value||'').split(/\n(?=【)/).filter(Boolean).map(part=>{
            const m=part.match(/^【([^】]+)】\s*\n?/);
            return m?{title:m[1],body:part.slice(m[0].length)}:{title:'',body:part};
        });
    }
    function cleanSegmentTitle(value) {
        return String(value||'').replace(/[【】\r\n]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
    }
    function segmentText(segment) {
        const title=cleanSegmentTitle(segment.title);
        return title?'【'+title+'】\n'+String(segment.body||'').trim():String(segment.body||'').trim();
    }
    function normalizeEditablePreset(value) {
        return splitPresetSegments(value).map(segment=>({
            title:cleanSegmentTitle(segment.title),
            body:String(segment.body||'')
        })).map(segmentText).filter(Boolean).join('\n');
    }
    function parseSelectedEntryKey(value) {
        try{
            const parsed=JSON.parse(String(value||''));
            return Array.isArray(parsed)&&parsed.length>=2?[String(parsed[0]||''),String(parsed[1]??'')]:null;
        }catch(_){return null;}
    }
    function normalizeWorldbookIdentity(value) {
        let name=String(value||'').trim().toLowerCase();
        const versionAt=name.search(/(?:\bv(?:er(?:sion)?)?|版本)?\s*\d+(?:\.\d+){1,3}/i);
        if(versionAt>0)name=name.slice(0,versionAt);
        return name.replace(/[\s_\-·.]+/g,'');
    }
    function normalizeWorldbookEntryTitle(value) {
        return String(value||'').trim().replace(/^⚙(?:\uFE0F)?\s*/u,'').trim();
    }
    function selectedEntryMatches(entry, selectedEntries) {
        if(!Array.isArray(selectedEntries))return entry?.enabled!==false;
        const exact=JSON.stringify([String(entry?.book||''),String(entry?.id??'')]);
        if(selectedEntries.includes(exact))return true;
        const entryBook=normalizeWorldbookIdentity(entry?.book),entryId=String(entry?.id??'');
        for(const raw of selectedEntries){
            const ref=parseSelectedEntryKey(raw);if(!ref||ref[1]!==entryId)continue;
            if(ref[0]==='*'||(entryBook&&normalizeWorldbookIdentity(ref[0])===entryBook))return true;
        }
        return false;
    }
    function ensurePresetStructure(value) {
        const current=splitPresetSegments(value||DEFAULT_PRESET).map(segment=>segment.title==='势力与地区'?{...segment,title:'探索与势力'}:segment);
        const defaults=splitPresetSegments(DEFAULT_PRESET);
        const titles=new Set(current.map(s=>s.title).filter(Boolean));
        for(const segment of defaults)if(segment.title&&!titles.has(segment.title))current.push(segment);
        return current.map(segmentText).filter(Boolean).join('\n');
    }    const RECORDS = {
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
        人物: {状态:'',更新时间:'',开始时间:'',预计结束:'',行程:[{开始:'',结束:'',地点:'',行动:'',状态:'',结果:''}],承诺:[{对象:'',内容:'',期限:'',解除条件:''}],待决事项:[{问题:'',选项:[],等待:''}],关系变化:[{对象:'',关系:'',变化:'',时间:''}],认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:'',背景关联:[{类型:'',名称:'',关系:''}]},
        势力地区: {更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}]},
        剧本: {状态:'',来源:'',更新时间:'',期限:'',完成条件:'',失败条件:'',结果:'',参与者:[],地点:[],阻碍:[],阶段:[{名称:'',状态:'',时间:'',说明:'',前置阶段:''}]},
        历史:{},传播:{更新时间:'',到期时间:'',受众:[],引发行动:[]}
    };
    const MODEL_RECORDS = Object.fromEntries(Object.entries(RECORDS).filter(([name])=>name!=='剧本'));
    const MODEL_DETAILS = copy(DETAILS);
    delete MODEL_DETAILS.剧本;
    delete MODEL_DETAILS.事件.关联任务;
    for (const key of ['承诺','待决事项','关系变化']) delete MODEL_DETAILS.人物[key];

    function derivePersonWorldContext(stat, personName, playerName='') {
        const backend=stat?.世界?.[PATH]||{},people=backend.人物||{},areas=backend.势力地区||{};
        const key=value=>String(value||'').toLowerCase().replace(/[\/／·・._\-\s]+/g,'');
        const normalizedName=key(personName);
        const pair=Object.entries(people).find(([name])=>key(name)===normalizedName);
        const person=pair?.[1]||{},location=String(person.地点||'').trim();
        const related=(a,b)=>{
            const x=key(a),y=key(b);if(!x||!y)return false;
            return x===y||x.includes(y)||y.includes(x);
        };
        const areaPair=Object.entries(areas)
            .filter(([,area])=>plain(area)&&area.类型!=='势力'&&related(location,area?.名称||''))
            .sort((a,b)=>String(b[0]).length-String(a[0]).length)[0]
            ||Object.entries(areas)
                .filter(([name,area])=>plain(area)&&area.类型!=='势力'&&related(location,name))
                .sort((a,b)=>String(b[0]).length-String(a[0]).length)[0];
        const areaName=String(areaPair?.[0]||''),area=areaPair?.[1]||{};
        const relationByKey=new Map(Object.entries(stat?.关系列表||{}).map(([name,record])=>[key(name),{名称:name,记录:record}]));
        const alienByKey=new Map(Object.entries(stat?.世界?.异端雷达?.名单||{}).map(([name,record])=>[key(name),record]));
        const playerKeys=new Set([playerName,'{{user}}','<user>','玩家'].filter(Boolean).map(key));
        const nearby=Object.entries(people)
            .filter(([name,other])=>{
                const otherKey=key(name);if(!plain(other)||otherKey===normalizedName||playerKeys.has(otherKey))return false;
                if(alienByKey.get(otherKey)?.状态==='死亡')return false;
                const otherLocation=String(other.地点||'').trim();if(!otherLocation)return false;
                return areaName?related(otherLocation,areaName):related(otherLocation,location);
            })
            .map(([name,other])=>{
                const profile=relationByKey.get(key(name));
                const relation=profile?.记录||{};
                const identity=Array.isArray(relation.身份)?relation.身份[0]:String(relation.身份||'');
                return {
                    名称:String(name),
                    关系:key(other.地点)===key(location)?'贴身':'同地区',
                    身份:identity,
                    行动:String(other.行动||other.公开动态||relation.态度||''),
                    可查看档案:!!profile,
                    档案名称:String(profile?.名称||''),
                    档案类型:profile?'正式档案':'现场标签'
                };
            })
            .slice(0,8);
        const objectList=(value,limit=8)=>Array.isArray(value)?value.filter(plain).slice(0,limit).map(copy):[];
        return {
            地区:areaName,
            地区动态:String(area.公开动态||area.进展||''),
            控制方:String(area.控制方||''),
            争夺方:Array.isArray(area.争夺方)?area.争夺方.filter(Boolean).slice(0,6):[],
            环境状态:Array.isArray(area.环境状态)?area.环境状态.filter(Boolean).slice(0,6):[],
            背景关联:objectList(person.背景关联,8),
            关联事件:Array.isArray(person.关联事件)?person.关联事件.filter(Boolean).slice(0,8):[],
            身边人物:nearby,
            现场群体:objectList(area.现场群体,8)
        };
    }

    function collectEventRefs(state) {
        const refs=new Set();
        for(const event of Object.values(state.事件||{}))for(const id of event.前因||[])refs.add(id);
        for(const category of ['人物','势力地区','传播'])for(const record of Object.values(state[category]||{}))for(const id of record.关联事件||[])refs.add(id);
        return refs;
    }
    function detachEventSoftRefs(state,eventName) {
        const changed=[];
        for(const category of ['人物','势力地区','传播']){
            for(const [name,record] of Object.entries(state?.[category]||{})){
                if(!Array.isArray(record?.关联事件)||!record.关联事件.includes(eventName))continue;
                record.关联事件=record.关联事件.filter(id=>id!==eventName);
                changed.push(category+'/'+name);
            }
        }
        return changed;
    }
    function archiveFinishedEvent(stat,state,name,event,archived) {
        let key='归档·'+name,seq=2;
        while(Object.hasOwn(state.历史||{},key))key='归档·'+name+'#'+seq++;
        state.历史=state.历史||{};
        state.历史[key]={
            时间:event.更新时间||event.预计结束||event.时间||stat.世界.时间||'',
            事实:event.结果||event.描述||(event.状态==='已取消'?'事件已取消':'事件已结束'),
            关联事件:[]
        };
        delete state.事件[name];
        archived.push(name);
    }
    function propagationEnded(record,nowKey) {
        if(!plain(record))return true;
        const status=String(record.状态||'').trim();
        if(/^(?:已结束|结束|已停止|停止|已失效|失效|已过期|过期|传播结束)$/.test(status))return true;
        const expiry=worldDateKey(record.到期时间);
        return expiry!==null&&nowKey!==null&&expiry<=nowKey;
    }
    function pruneSoftRefsToColdFinishedEvents(state,now) {
        if(now===null)return [];
        const cold=new Set();
        for(const [name,event] of Object.entries(state?.事件||{})){
            if(!['已完成','已取消'].includes(event?.状态))continue;
            const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
            if(endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)cold.add(name);
        }
        if(!cold.size)return [];
        const changed=[];
        for(const eventName of cold)changed.push(...detachEventSoftRefs(state,eventName));
        // 已结束且同样进入冷区的事件之间不再互相作为热前因引用；
        // 活跃/未来事件的前因仍保留，因此不会破坏仍在推进的因果链。
        for(const [name,event] of Object.entries(state?.事件||{})){
            if(!cold.has(name)||!Array.isArray(event?.前因)||!event.前因.some(id=>cold.has(id)))continue;
            event.前因=event.前因.filter(id=>!cold.has(id));
            changed.push('事件/'+name);
        }
        return changed;
    }
    function compactFinishedEvents(stat,target=EVENT_TARGET) {
        const state=stat?.世界?.[PATH]; if(!state?.事件)return [];
        const archived=[],now=worldDateKey(stat?.世界?.时间);
        pruneSoftRefsToColdFinishedEvents(state,now);
        const protectedNames=new Set(storyStages(stat?.世界?.因果轨道?.故事线));
        let refs=collectEventRefs(state);
        const finished=()=>Object.entries(state.事件||{}).filter(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name)&&!protectedNames.has(name));
        // 有明确时间的旧结束事件，在经过一个世界日后直接冷归档；刚刚结束的内容至少保留到下一阶段。
        for(const [name,event] of finished()){
            const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
            if(now!==null&&endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)archiveFinishedEvent(stat,state,name,event,archived);
        }
        // 无法比较作品内时间时，用“最多保留最近8条结束事件”兜底，避免长期无限增长。
        refs=collectEventRefs(state);
        let candidates=finished();
        while(candidates.length>RECENT_FINISHED_EVENT_TARGET){
            const [name,event]=candidates[0];
            archiveFinishedEvent(stat,state,name,event,archived);
            refs=collectEventRefs(state);candidates=finished();
        }
        // 旧存档超大时继续沿用硬上限兜底，只回收无引用的结束事件。
        while(Object.keys(state.事件||{}).length>target){
            refs=collectEventRefs(state);
            const candidate=Object.entries(state.事件||{}).find(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name));
            if(!candidate)break;
            archiveFinishedEvent(stat,state,candidate[0],candidate[1],archived);
        }
        const historyKeys=Object.keys(state.历史||{});
        if(historyKeys.length>HISTORY_TARGET)for(const key of historyKeys.slice(0,historyKeys.length-HISTORY_TARGET))delete state.历史[key];
        return archived;
    }
    function compactWorldLifecycle(stat) {
        const state=stat?.世界?.[PATH];
        if(!state)return {归档事件:[],回收传播:[],回收人物:[]};
        const now=worldDateKey(stat?.世界?.时间),removed=[];
        for(const [name,record] of Object.entries(state.传播||{})){
            if(propagationEnded(record,now)){delete state.传播[name];removed.push(name);}
        }
        const archived=compactFinishedEvents(stat);
        const removedPeople=pruneColdTemporaryPeople(stat);
        return {归档事件:archived,回收传播:removed,回收人物:removedPeople};
    }
    function storyStages(value) {
        return String(value||'').split(/\s*(?:→|⇒|->|=>|\n)\s*/).map(x=>x.trim()).filter(x=>x&&!/^(待初始化|无|未知)$/.test(x));
    }
    const VAGUE_EVENT_TIME=/^(?:近期|稍后|未来|之后|待定|未定|未知|不详|待确认|时间未定|日期未定)$/;
    function eventTimeAnchor(event) {
        return String(event?.时间||event?.开始时间||'').trim();
    }
    function eventScheduleLabel(event) {
        const raw=eventTimeAnchor(event);
        if(raw&&!VAGUE_EVENT_TIME.test(raw))return raw;
        const condition=String(event?.条件||'').trim();
        if(condition)return '条件触发 · '+condition;
        const predecessors=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
        if(predecessors.length)return '前置节点后 · '+predecessors.join('、');
        return '时间待补';
    }
    const STALE_CURRENT_EVENT_HOURS=7*24;
    const STALE_NEAR_EVENT_HOURS=30*24;
    function staleActiveEvents(stat) {
        const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
        const out=[];
        for(const [名称,event] of Object.entries(stat?.世界?.[PATH]?.事件||{})){
            if(event?.状态!=='进行中'||event?.分类==='宏观节点')continue;
            const touched=worldDateKey(event.更新时间||event.时间||event.开始时间);
            if(touched===null)continue;
            const threshold=event.分类==='当前事件'?STALE_CURRENT_EVENT_HOURS:STALE_NEAR_EVENT_HOURS;
            const age=now-touched;
            if(age>threshold)out.push({名称,分类:event.分类,状态:event.状态,时间:event.时间||event.开始时间||'',更新时间:event.更新时间||'',已陈旧小时:age,说明:'局部活动长期停留在进行中；应结束/取消，或确认仍持续并更新到当前世界时间、当前进展与下次检查。'});
        }
        return out;
    }
    function temporalAnomalies(stat) {
        const now=worldDateKey(stat?.世界?.时间);if(now===null)return [];
        const state=stat?.世界?.[PATH]||{},out=[];
        const push=(类型,名称,字段,值,原因)=>{
            const key=worldDateKey(值);if(key!==null&&key>now)out.push({类型,名称,字段,值:String(值||''),原因});
        };
        for(const [name,event] of Object.entries(state.事件||{})){
            if(['进行中','已完成'].includes(event?.状态))push('事件',name,'时间',event.时间||event.开始时间,'已发生/进行中的事件不能晚于当前世界时间');
            if(event?.更新时间)push('事件',name,'更新时间',event.更新时间,'事件更新时间不能晚于当前世界时间');
        }
        for(const [name,person] of Object.entries(state.人物||{}))if(person?.更新时间)push('人物',name,'更新时间',person.更新时间,'人物当前动态不能来自未来');
        for(const [name,area] of Object.entries(state.势力地区||{})){
            if(area?.更新时间)push('势力地区',name,'更新时间',area.更新时间,'地区当前状态不能来自未来');
            for(const change of area?.近期变化||[])if(change?.时间)push('势力地区',name,'近期变化.时间',change.时间,'已经发生的地区变化不能来自未来');
        }
        for(const [name,item] of Object.entries(state.历史||{}))if(item?.时间)push('历史',name,'时间',item.时间,'历史事实不能晚于当前世界时间');
        for(const [name,item] of Object.entries(state.传播||{}))if(item?.时间)push('传播',name,'时间',item.时间,'已经开始传播的信息不能晚于当前世界时间');
        return out;
    }
    function validateTemporalWrites(before,next,patches) {
        const touched=new Set();
        for(const patch of patches||[]){
            let parts;try{parts=tokens(patch.path);}catch(_){continue;}
            if(parts[0]!=='世界'||parts[1]!==PATH)continue;
            if(['事件','人物','势力地区','历史','传播'].includes(parts[2])&&parts[3])touched.add(parts[2]+'\u0000'+parts[3]);
        }
        if(!touched.size)return;
        const all=temporalAnomalies(next);
        const hit=all.find(item=>touched.has(item.类型+'\u0000'+item.名称));
        if(hit)throw new Error('时间事实超过当前世界时间：'+hit.类型+'/'+hit.名称+' '+hit.字段+'='+hit.值+'；'+hit.原因);
    }
    function eventDisplayBucket(event) {
        if(event?.状态==='进行中')return 0;
        if(event?.状态==='待发生'&&event?.分类==='当前事件')return 1;
        if(event?.状态==='待发生'&&event?.分类==='近期节点')return 2;
        if(event?.状态==='待发生'&&event?.分类==='宏观节点')return 3;
        if(event?.状态==='已完成')return 4;
        if(event?.状态==='已取消')return 5;
        return 6;
    }
    function sortWorldEvents(records,orbit={}) {
        const storyIndex=new Map(storyStages(orbit?.故事线).map((name,index)=>[nameKey(name),index]));
        return Object.entries(records||{}).sort((a,b)=>{
            const bucket=eventDisplayBucket(a[1])-eventDisplayBucket(b[1]);if(bucket)return bucket;
            if(a[1]?.分类==='宏观节点'&&b[1]?.分类==='宏观节点'){
                const ai=storyIndex.get(nameKey(a[0])),bi=storyIndex.get(nameKey(b[0]));
                if(ai!==undefined||bi!==undefined){
                    if(ai===undefined)return 1;
                    if(bi===undefined)return -1;
                    if(ai!==bi)return ai-bi;
                }
            }
            const da=worldDateKey(a[1]?.时间||a[1]?.开始时间),db=worldDateKey(b[1]?.时间||b[1]?.开始时间);
            if(da!==db)return (da??Infinity)-(db??Infinity);
            return String(a[0]).localeCompare(String(b[0]),'zh-CN');
        });
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
        const patches=[];
        let line=[];
        const existingValid=existing.length>=3&&existing.length<=5&&existing.every(name=>macroNames.has(name));
        if(existingValid)line=existing.slice(0,5);
        else {
            // 因果轨道只能由宏观事件投影。宏观事实不足时宁可等待模型补齐，
            // 也不能拿当前事件/近期节点凑出一条“看似完整”的故事线。
            if(macroEntries.length<3)return patches;
            const chosen=[],seen=new Set();
            const take=name=>{if(name&&macroNames.has(name)&&!seen.has(name)){seen.add(name);chosen.push(name);}};
            take(orbit.当前阶段);
            for(const [name] of macroEntries)take(name);
            if(chosen.length<3)return patches;
            line=chosen.slice(0,5);
            const story=line.join(' -> ');
            if(orbit.故事线!==story){orbit.故事线=story;patches.push({op:'replace',path:'/世界/因果轨道/故事线',value:story});}
        }
        const nextName=line.find(name=>(stat.世界[PATH].事件[name]||{}).状态==='待发生')||'';
        if(orbit.下一节点!==nextName){orbit.下一节点=nextName;patches.push({op:'replace',path:'/世界/因果轨道/下一节点',value:nextName});}
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
        const macroOpen=macro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
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
            需要补充远期:macroOpen.length<3,
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
        return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 剧本:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };
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
    function stableNameIn(bucket,name) {
        if(!plain(bucket))return '';
        if(Object.hasOwn(bucket,name))return name;
        const key=nameKey(name),matches=Object.keys(bucket).filter(item=>nameKey(item)===key);
        return matches.length===1?matches[0]:'';
    }
    function worldLocationRelated(a,b) {
        const x=nameKey(a),y=nameKey(b);if(!x||!y)return false;
        return x===y||x.includes(y)||y.includes(x);
    }
    function personActivityMeta(stat,name,person) {
        const relations=stat?.关系列表||{},roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const events=stat?.世界?.[PATH]?.事件||{},worldTime=String(stat?.世界?.时间||''),currentLocation=String(stat?.世界?.地点||'');
        const formalName=stableNameIn(relations,name),alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
        const activeAlien=!!(alien&&alien.状态!=='死亡'),deadAlien=!!(alien&&alien.状态==='死亡');
        const liveEntries=Object.entries(events).filter(([,event])=>event&&['待发生','进行中'].includes(event.状态));
        const liveNames=new Set(liveEntries.map(([eventName])=>eventName));
        const linked=Array.isArray(person?.关联事件)&&person.关联事件.some(eventName=>liveNames.has(eventName));
        const participant=liveEntries.some(([,event])=>(event.参与者||[]).some(item=>nameKey(item)===nameKey(name)));
        const here=!!(person?.地点&&currentLocation&&worldLocationRelated(person.地点,currentLocation));
        const now=worldDateKey(worldTime),updated=worldDateKey(person?.更新时间);
        const ageHours=now!==null&&updated!==null?now-updated:null;
        const recent=sameWorldTimeAnchor(person?.更新时间,worldTime)||(ageHours!==null&&ageHours>=0&&ageHours<=HOT_PERSON_RECENT_HOURS);
        const checkAt=worldDateKey(person?.下次检查);
        const dueSoon=now!==null&&checkAt!==null&&checkAt>=now-HOT_PERSON_RECENT_HOURS&&checkAt<=now+7*24;
        const terminal=TERMINAL_PERSON_STATUS.test(String(person?.状态||'').trim());
        return {formalName,activeAlien,deadAlien,linked,participant,here,recent,dueSoon,terminal,ageHours};
    }
    function projectHotWorldPeople(stat,limit=HOT_PERSON_TARGET) {
        const people=stat?.世界?.[PATH]?.人物||{},rows=[];
        for(const [name,person] of Object.entries(people)){
            if(!plain(person))continue;
            const meta=personActivityMeta(stat,name,person);
            if(meta.deadAlien)continue;
            const hot=meta.activeAlien||(!meta.terminal&&(meta.linked||meta.participant||meta.here||meta.dueSoon||meta.recent));
            if(!hot)continue;
            const score=(meta.activeAlien?1000:0)+(meta.linked||meta.participant?600:0)+(meta.here?450:0)+(meta.dueSoon?320:0)+(meta.recent?220:0)+(meta.formalName?20:0);
            rows.push({name,person,meta,score});
        }
        rows.sort((a,b)=>b.score-a.score||String(a.name).localeCompare(String(b.name),'zh-CN'));
        const aliens=rows.filter(row=>row.meta.activeAlien),ordinary=rows.filter(row=>!row.meta.activeAlien).slice(0,Math.max(0,Number(limit)||0));
        return Object.fromEntries([...aliens,...ordinary].map(row=>[row.name,copy(row.person)]));
    }
    function pruneColdTemporaryPeople(stat) {
        const people=stat?.世界?.[PATH]?.人物;if(!plain(people))return [];
        const removed=[];
        const entries=Object.entries(people);
        for(const [name,person] of entries){
            if(!plain(person))continue;
            const meta=personActivityMeta(stat,name,person);
            const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
            if(protectedNow)continue;
            const stale=meta.ageHours!==null&&meta.ageHours>COLD_TEMP_PERSON_GRACE_HOURS;
            if(meta.terminal||stale){delete people[name];removed.push(name);}
        }
        const cold=Object.entries(people).filter(([name,person])=>{
            if(!plain(person))return false;
            const meta=personActivityMeta(stat,name,person);
            const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
            const recentlyActive=meta.ageHours!==null&&meta.ageHours>=0&&meta.ageHours<=COLD_TEMP_PERSON_GRACE_HOURS;
            return !protectedNow&&!recentlyActive;
        });
        while(cold.length>COLD_TEMP_PERSON_TARGET){
            const [name]=cold.shift();
            if(Object.hasOwn(people,name)){delete people[name];removed.push(name);}
        }
        return removed;
    }
    function alienRosterMatch(stat,name) {
        const roster=stat?.世界?.异端雷达?.名单||{},matched=stableNameIn(roster,name);
        return matched?{名称:matched,记录:roster[matched]}:null;
    }
    function pruneDeadAlienPeople(stat) {
        const people=stat?.世界?.[PATH]?.人物,roster=stat?.世界?.异端雷达?.名单;
        if(!plain(people)||!plain(roster))return [];
        const removed=[];
        for(const [alienName,alien] of Object.entries(roster)){
            if(alien?.状态!=='死亡')continue;
            const personName=stableNameIn(people,alienName);
            if(personName){delete people[personName];removed.push(personName);}
        }
        return removed;
    }
    function activeAlienActivityRequirements(stat) {
        if((stat?.设置||{}).单一世界)return [];
        const roster=stat?.世界?.异端雷达?.名单||{},people=stat?.世界?.[PATH]?.人物||{},required=[];
        for(const [alienName,alien] of Object.entries(roster)){
            if(!alien||alien.状态==='死亡')continue;
            const personName=stableNameIn(people,alienName)||alienName,person=people[personName]||{};
            required.push({
                名称:personName,雷达名称:alienName,来源:String(alien.来源||''),经历:String(alien.经历||''),阵营:String(alien.阵营||''),职业:String(alien.职业||''),层级:String(alien.层级||''),
                当前活动:{地点:String(person.地点||''),目标:String(person.目标||''),行动:String(person.行动||''),更新时间:String(person.更新时间||'')},
                要求:'本轮必须在 WorldResult.人物 中提交该异端的活动复核；至少给出非空地点、目标、行动，并将更新时间精确写为当前世界时间。若本轮已确认其死亡，则只把异端状态更新为死亡，不再提交人物活动。'
            });
        }
        return required;
    }
    function seedMissingAlienPeople(stat,required) {
        const state=stat?.世界?.[PATH],patches=[];if(!state)return patches;
        const people=state.人物||(state.人物={});
        for(const item of required||[]){
            if(stableNameIn(people,item.名称))continue;
            const relationName=stableNameIn(stat.关系列表||{},item.雷达名称),relation=relationName?(stat.关系列表||{})[relationName]:null;
            const seed=normalizeBackendRecord('人物',{所属世界:stat.世界?.名称||'',地点:String(relation?.地点||''),目标:'',行动:'',公开动态:''});
            people[item.名称]=seed;
            patches.push({op:'add',path:pointer(['世界',PATH,'人物',item.名称]),value:copy(seed)});
        }
        return patches;
    }
    function ensureActiveAlienActivity(next,required,acceptedResult,worldTime) {
        const roster=next?.世界?.异端雷达?.名单||{},people=next?.世界?.[PATH]?.人物||{},proposals=acceptedResult?.人物||[],missing=[];
        for(const item of required||[]){
            const rosterName=stableNameIn(roster,item.雷达名称||item.名称),alien=rosterName?roster[rosterName]:null;
            if(!alien||alien.状态==='死亡')continue;
            const personName=stableNameIn(people,item.名称)||stableNameIn(people,rosterName),person=personName?people[personName]:null;
            const proposal=proposals.find(p=>nameKey(p.名称)===nameKey(item.名称)||nameKey(p.名称)===nameKey(rosterName));
            const complete=person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim()&&String(person.更新时间||'').trim()===String(worldTime||'').trim();
            if(!proposal||!complete)missing.push(rosterName||item.名称);
        }
        if(missing.length)throw new Error('异端活动未复核：'+missing.join('、')+'；活跃异端每轮都必须提交人物活动，写明地点、目标、行动，并把更新时间精确写为当前世界时间；若已死亡则更新异端状态为死亡');
    }
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
        // v3 → v4：旧“公开摘要”直接迁移为因果轨道.当前阶段描述，然后删除两份重复交接字段。
        const legacySummary=String(state.公开摘要||'').trim();
        if(legacySummary){
            if(!plain(stat.世界.因果轨道))stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}};
            stat.世界.因果轨道.当前阶段=legacySummary;
        }
        delete state.公开摘要;
        delete state.正文承接;
        state.版本=Math.max(4,Number(state.版本)||0);
        for(const category of Object.keys(RECORDS)){
            if(!plain(state[category]))state[category]={};
            for(const [name,value] of Object.entries(state[category])){
                if(plain(value))state[category][name]=normalizeBackendRecord(category,value);
            }
        }
        pruneDeadAlienPeople(stat);
        return stat;
    }
    const EVENT_CATEGORIES=new Set(['当前事件','近期节点','宏观节点']);
    const LOCAL_EVENT_WORDS=/(?:天台|教室|办公室|医务室|走廊|楼梯|楼层|入口|门扉|校门|校车|桥头|大桥|房间|仓库|食堂|街口|小巷|会合|汇合|集结|夺取|抢夺|突破|开门|绕行|护送|搜索|调查)/;
    const MACRO_EVENT_WORDS=/(?:世界级|全国|跨国|地区级灾难|城市级灾难|战略级|核(?:打击|爆|武器)|EMP|电磁脉冲|战争|政权|社会秩序|基础设施(?:失效|崩溃)|大规模迁移|长期流亡|生存阶段|篇章转折|据点(?:建立|失守|沦陷|崩溃|保卫)|文明|国家|大陆)/;
    function eventText(name,event) {
        return [name,event?.描述,event?.条件,event?.默认走向,event?.结果,event?.公开征兆,event?.地点].filter(Boolean).join(' ');
    }
    function obviouslyLocalMacro(name,event) {
        const text=eventText(name,event);
        if(MACRO_EVENT_WORDS.test(text))return false;
        const fineLocation=/(?:天台|教室|办公室|医务室|走廊|楼梯|楼层|入口|门扉|校门|校车|桥头|大桥|房间|仓库|食堂|街口|小巷)/.test(String(event?.地点||'')+' '+String(name||''));
        return fineLocation&&LOCAL_EVENT_WORDS.test(text);
    }
    function normalizedEventCategory(name,event) {
        const raw=String(event?.分类||'').trim();
        if(raw==='宏观节点')return obviouslyLocalMacro(name,event)?(event?.状态==='进行中'?'当前事件':'近期节点'):'宏观节点';
        if(raw==='当前事件')return '当前事件';
        if(raw==='近期节点')return event?.状态==='进行中'?'当前事件':'近期节点';
        if(raw==='近期事件'||raw==='主线节点'||!EVENT_CATEGORIES.has(raw))return event?.状态==='进行中'?'当前事件':'近期节点';
        return raw;
    }
    function normalizeEventLayers(stat) {
        const events=stat?.世界?.[PATH]?.事件||{},patches=[];
        for(const [name,event] of Object.entries(events)){
            const category=normalizedEventCategory(name,event);
            if(event.分类!==category){
                event.分类=category;
                patches.push({op:'replace',path:'/世界/后台/事件/'+String(name).replace(/~/g,'~0').replace(/\//g,'~1')+'/分类',value:category});
            }
        }
        return patches;
    }
    function explicitPersonAliases(name) {
        const full=String(name||'').trim(), short=full.split(/[·・／/]/)[0].trim();
        return [...new Set([full,short].filter(x=>x.length>=2))];
    }
    function repairExplicitEventLinks(stat) {
        const state=stat?.世界?.[PATH],patches=[]; if(!state)return patches;
        const events=state.事件||{},people=state.人物||{};
        for(const [eventName,event] of Object.entries(events)){
            const haystack=eventText(eventName,event);
            const participants=Array.isArray(event.参与者)?event.参与者.slice():[];
            let participantsChanged=false;
            for(const personName of Object.keys(people)){
                const explicit=participants.some(x=>nameKey(x)===nameKey(personName))||explicitPersonAliases(personName).some(alias=>haystack.includes(alias));
                if(!explicit)continue;
                if(!participants.some(x=>nameKey(x)===nameKey(personName))){
                    participants.push(personName);participantsChanged=true;
                }
                const person=people[personName],links=Array.isArray(person.关联事件)?person.关联事件:[];
                if(!links.includes(eventName)){
                    person.关联事件=[...links,eventName];
                    patches.push({op:'replace',path:'/世界/后台/人物/'+String(personName).replace(/~/g,'~0').replace(/\//g,'~1')+'/关联事件',value:copy(person.关联事件)});
                }
            }
            if(participantsChanged){
                event.参与者=participants;
                patches.push({op:'replace',path:'/世界/后台/事件/'+String(eventName).replace(/~/g,'~0').replace(/\//g,'~1')+'/参与者',value:copy(participants)});
            }
        }
        return patches;
    }
    function repairMacroPredecessors(stat) {
        const state=stat?.世界?.[PATH],orbit=stat?.世界?.因果轨道||{},patches=[]; if(!state)return patches;
        const stages=storyStages(orbit.故事线).filter(name=>state.事件?.[name]?.分类==='宏观节点'&&state.事件[name].状态!=='已取消');
        for(let i=1;i<stages.length;i++){
            const prev=stages[i-1],name=stages[i],event=state.事件[name],parents=Array.isArray(event.前因)?event.前因:[];
            if(!parents.includes(prev)){
                event.前因=[...parents,prev];
                patches.push({op:'replace',path:'/世界/后台/事件/'+String(name).replace(/~/g,'~0').replace(/\//g,'~1')+'/前因',value:copy(event.前因)});
            }
        }
        return patches;
    }

    const MODEL_IGNORED_PATHS = [
        /^\/任务(?:\/|$)/,
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
    function retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]) {
        let payload;try{payload=JSON.parse(baseInput);}catch(_){payload={原始请求:baseInput};}
        const plan=Array.isArray(retryPlan)?retryPlan.filter(Boolean).map(String):[];
        payload.纠错重试={
            当前尝试:attempt+1,
            最大尝试次数:maxAttempts,
            上次拒绝原因:String(error?.message||error||''),
            上次模型回复:String(lastReply||'').slice(-12000),
            已接受业务结果:acceptedResult?copy(acceptedResult):undefined,
            补充清单:plan.length?copy(plan):undefined,
            要求:acceptedResult
                ?(plan.length
                    ?'严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。'
                    :'只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。')
                :'修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。'
        };
        if(payload.纠错重试.已接受业务结果===undefined)delete payload.纠错重试.已接受业务结果;
        if(payload.纠错重试.补充清单===undefined)delete payload.纠错重试.补充清单;
        return JSON.stringify(payload,null,2);
    }
    // 允许世界叙事、世界经济与共享资产账簿；玩家属性、持币余额、奖励发放和时钟仍不在写入名单内。
    function allowed(parts, stat) {
        const [a,b,c,d] = parts;
        if (a === '世界' && b === PATH) {
            if (c === '剧本') return false;
            if (!Object.hasOwn(RECORDS, c) || !d) return false;
            if (c === '历史') return parts.length === 4;
            return parts.length === 4 || (parts.length === 5 && (Object.hasOwn(RECORDS[c], parts[4]) || Object.hasOwn(DETAILS[c],parts[4])));
        }
        if (a === '世界' && b === '因果轨道') {
            if (['当前阶段','故事线','下一节点'].includes(c)) return parts.length === 3;
            return !(stat.设置 || {}).世界超稳 && c === '偏移记录' && parts.length === 4;
        }
        if (a === '世界' && b === '货币') return parts.length === 3 && Object.hasOwn(CURRENCY_FIELDS,c);
        if (a === '世界' && b === '历法') return parts.length === 3 && Object.hasOwn(CALENDAR_FIELDS,c);
        if (a === '世界' && ['势力','探索'].includes(b)) return parts.length === 3 || (parts.length === 4 && Object.hasOwn(b === '势力' ? {实力:0,领地:0,描述:0,声望:0} : {风险:0,探索度:0,描述:0,隐藏真相:0},d));
        if (a === '世界' && b === '异端雷达') return parts.length === 5 && c === '名单' && parts[4] === '状态' && !(stat.设置 || {}).单一世界;
        if (a === '传闻' && ['街头巷议','情报交易','布告与檄文'].includes(b)) return parts.length === 3;
        if (a === '资产') return parts.length === 2 && !!b;
        // 只允许修改变量AI已经建立的 NPC；禁止通过世界引擎创建关系列表对象。
        if (a === '关系列表') return parts.length === 3 && RELATION_SYNC_KEYS.has(c) && !!get(stat,[a,b]);
        if (a === '任务') return parts.length === 4 && ['列表','副本成就'].includes(b) && d === '状态' && !!get(stat,[a,b,c]);
        return false;
    }
    const CURRENCY_FIELDS={体系:'',购买力基准:'',经济波动:''};
    const CALENDAR_FIELDS={名称:'',月份天数:[],闰年规则:''};
    const QUALITY_RANKS=['F','E','D','C','B','A','S','SS','SSS'];
    const RUMOR_CREDIBILITY=['酒话','可疑','或许可信'];
    const INTEL_RATINGS=[...QUALITY_RANKS,'日常','战略'];
    function normalizeRumorCredibility(value) {
        const raw=String(value??'').trim();
        if(RUMOR_CREDIBILITY.includes(raw))return raw;
        if(/^(?:可信|属实|真实|确实|高|较高|很高|基本属实)$/.test(raw))return '或许可信';
        if(/^(?:不可信|虚假|谣言|低|较低|很低|纯属谣言)$/.test(raw))return '酒话';
        return '可疑';
    }
    const EXISTING = {
        势力: {实力:'F',领地:'',描述:'',声望:0}, 探索:{风险:'F',探索度:0,描述:'',隐藏真相:''},
        偏移记录:{描述:'',引发者:'',影响程度:0},
        街头巷议:{来源:'',内容:'',可信度:''}, 情报交易:{卖家:'',情报评级:'',摘要:'',要价:'',真实内幕:''},
        布告与檄文:{发布者:'',内容:'',张贴位置:''},
        名单:{来源:'',经历:'',阵营:'',职业:'',层级:'',状态:''}
    };
    const RELATION_RANKS=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    const RELATION_QUALITIES=['F','E','D','C','B','A','S','SS','SSS'];
    const RELATION_SYNC_FIELDS={
        在场:false,种族:'',身份:[],职业:{},层级:'Ⅰ',HP:0,THP:0,EP:0,
        状态:{},血统:{},装备:{},技能:{},形态库:{},当前形态:{},
        性格:'',喜爱:'',外貌:'',着装:'',是否队友:false,好感度:0,态度:'',背景故事:''
    };
    const RELATION_SYNC_KEYS=new Set(Object.keys(RELATION_SYNC_FIELDS));
    const RELATION_COMPONENT_FIELDS=new Set(['职业','状态','血统','装备','技能','形态库']);
    // 只有会永久改变角色战斗构筑的字段要求进入审计名单；状态/当前形态及档案文字仍可因真实剧情变化正常同步。
    const RELATION_AUDIT_ONLY_FIELDS=new Set(['职业','血统','装备','技能','形态库']);
    const RELATION_ATTR_KEYS=['力量','敏捷','体质','精神','魅力','ATK','DEF','MATK','MDEF','AP'];
    const RELATION_ATTR5=['力量','敏捷','体质','精神','魅力'];
    const NPC_BUILD_AUDIT_LIMIT=4;
    const WORLD_RESULT_LISTS=['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'];
    const WORLD_RESULT_RUMORS=['街头巷议','情报交易','布告与檄文'];
    const RESULT_OPERATIONS=new Set(['更新','移除','撤销本轮']);
    function schemaFromSample(sample) {
        if(Array.isArray(sample))return {type:'array',items:sample.length?schemaFromSample(sample[0]):{type:'string'}};
        if(plain(sample)){
            const properties=Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,schemaFromSample(value)]));
            return {type:'object',properties,additionalProperties:false};
        }
        if(typeof sample==='number')return {type:'number'};
        if(typeof sample==='boolean')return {type:'boolean'};
        return {type:'string'};
    }
    function namedEntitySchema(sample,operations=['更新','撤销本轮'],requiredFields=[]) {
        const properties={名称:{type:'string',minLength:1},操作:{type:'string',enum:operations}};
        for(const [key,value] of Object.entries(sample||{}))properties[key]=schemaFromSample(value);
        return {type:'object',properties,required:['名称',...requiredFields],additionalProperties:false};
    }
    const FACTION_RESULT_SCHEMA=namedEntitySchema(EXISTING.势力);
    FACTION_RESULT_SCHEMA.properties.实力={type:'string',enum:copy(QUALITY_RANKS)};
    FACTION_RESULT_SCHEMA.properties.声望={type:'number',minimum:-5000,maximum:10000};
    const EXPLORATION_RESULT_SCHEMA=namedEntitySchema(EXISTING.探索);
    EXPLORATION_RESULT_SCHEMA.properties.风险={type:'string',enum:copy(QUALITY_RANKS)};
    EXPLORATION_RESULT_SCHEMA.properties.探索度={type:'number',minimum:0,maximum:100};
    const EVENT_RESULT_SCHEMA=namedEntitySchema({...RECORDS.事件,...MODEL_DETAILS.事件});
    EVENT_RESULT_SCHEMA.properties.状态={type:'string',enum:['待发生','进行中','已完成','已取消']};
    EVENT_RESULT_SCHEMA.properties.分类={type:'string',enum:Array.from(EVENT_CATEGORIES)};
    const OFFSET_RESULT_SCHEMA=namedEntitySchema(EXISTING.偏移记录);
    OFFSET_RESULT_SCHEMA.properties.影响程度={type:'number',minimum:-100,maximum:120};
    const STREET_RUMOR_RESULT_SCHEMA=namedEntitySchema(EXISTING.街头巷议,['更新','移除','撤销本轮'],['来源','内容','可信度']);
    STREET_RUMOR_RESULT_SCHEMA.properties.可信度={type:'string',enum:copy(RUMOR_CREDIBILITY)};
    const INTEL_TRADE_RESULT_SCHEMA=namedEntitySchema(EXISTING.情报交易,['更新','移除','撤销本轮'],['卖家','情报评级','摘要','要价','真实内幕']);
    INTEL_TRADE_RESULT_SCHEMA.properties.情报评级={type:'string',enum:copy(INTEL_RATINGS)};
    const relationQualitySchema=()=>({type:'string',enum:copy(RELATION_QUALITIES)});
    const relationTagsSchema=()=>({type:'array',maxItems:24,items:{type:'string'}});
    const relationStringMapSchema=()=>({type:'object',additionalProperties:{type:'string'}});
    const relationRawAttrSchema=(requireFive=false,allowNumbers=false)=>{
        const properties={};
        for(const key of RELATION_ATTR_KEYS)properties[key]=allowNumbers?{anyOf:[relationQualitySchema(),{type:'number'}]}:relationQualitySchema();
        return {type:'object',additionalProperties:false,properties,required:requireFive?copy(RELATION_ATTR5):undefined};
    };
    const RELATION_SKILL_SCHEMA={type:'object',additionalProperties:false,required:['品质','类型','标签','效果','描述','消耗'],properties:{
        品质:relationQualitySchema(),类型:{type:'integer',minimum:0,maximum:2},标签:relationTagsSchema(),
        效果:relationStringMapSchema(),描述:{type:'string'},消耗:{type:'string'}
    }};
    const RELATION_OCCUPATION_SCHEMA={type:'object',additionalProperties:false,required:['类型','特性','来源'],properties:{
        类型:{type:'string',enum:['战斗','生活','辅助']},特性:relationTagsSchema(),来源:{type:'string'}
    }};
    const RELATION_BLOODLINE_SCHEMA={type:'object',additionalProperties:false,required:['品质','标签','原始属性','效果','描述'],properties:{
        品质:relationQualitySchema(),标签:relationTagsSchema(),原始属性:relationRawAttrSchema(true,false),
        效果:relationStringMapSchema(),描述:{type:'string'}
    }};
    const RELATION_EQUIP_SCHEMA={type:'object',additionalProperties:false,required:['品质','类型','标签','原始属性','效果','描述','消耗','状态'],properties:{
        品质:relationQualitySchema(),类型:{type:'integer',minimum:0,maximum:8},标签:relationTagsSchema(),
        原始属性:relationRawAttrSchema(false,false),效果:relationStringMapSchema(),描述:{type:'string'},消耗:{type:'string'},
        状态:{type:'integer',minimum:0,maximum:2}
    }};
    const RELATION_STATUS_SCHEMA={type:'object',additionalProperties:false,required:['类型','品质','持续','来源','原始属性','效果'],properties:{
        类型:{type:'string',enum:['增益','减益','特殊']},品质:relationQualitySchema(),持续:{type:'string'},来源:{type:'string'},
        原始属性:relationRawAttrSchema(false,true),效果:{type:'string'}
    }};
    const RELATION_FORM_SCHEMA={type:'object',additionalProperties:false,required:['层级','消耗','冷却','状态','标签','原始属性','效果','技能','描述'],properties:{
        层级:{type:'string',enum:copy(RELATION_RANKS)},消耗:{type:'string'},冷却:{type:'string'},状态:{type:'string'},标签:relationTagsSchema(),
        原始属性:relationRawAttrSchema(true,false),效果:relationStringMapSchema(),
        技能:{type:'object',additionalProperties:copy(RELATION_SKILL_SCHEMA),maxProperties:8},描述:{type:'string'}
    }};
    const RELATION_CURRENT_FORM_SCHEMA={type:'object',additionalProperties:false,required:['激活','名称'],properties:{激活:{type:'boolean'},名称:{type:'string'}}};
    const ASSET_RESULT_SCHEMA={
        type:'object',additionalProperties:false,required:['名称'],properties:{
            名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','移除','撤销本轮']},
            所属对象:{type:'array',items:{type:'string',minLength:1},maxItems:12},类型:{type:'string'},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},
            能源:{anyOf:[{type:'object',additionalProperties:false,properties:{类型:{type:'string'},当前:{type:'number'},上限:{type:'number'},描述:{type:'string'}}},{type:'null'}]},
            消耗单元:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{余量:{type:'number'},上限:{type:'number'},加成:{type:'array',items:{type:'string'}}}},{type:'null'}]}},
            建设序列:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{阶段:{type:'string',enum:['基础','进阶','专业','顶尖','禁忌']},功能:{type:'string'},加成:{type:'array',items:{type:'string'}},产出:{type:'string'}}},{type:'null'}]}},
            驻扎人员:{type:'object',additionalProperties:{anyOf:[{type:'string'},{type:'null'}]}},
            待办事件:{type:'array',items:{type:'string'}}
        }
    };
    const WORLD_RESULT_SCHEMA={
        type:'object',
        additionalProperties:false,
        required:['摘要'],
        properties:{
            摘要:{type:'string'},
            货币:{type:'object',additionalProperties:false,properties:{
                体系:{type:'string'},
                购买力基准:{type:'string'},
                经济波动:{type:'string'}
            }},
            历法:{type:'object',additionalProperties:false,properties:{
                名称:{type:'string'},
                月份天数:{type:'array',maxItems:24,items:{type:'integer',minimum:1,maximum:99}},
                闰年规则:{type:'string'}
            }},
            事件:{type:'array',maxItems:30,items:EVENT_RESULT_SCHEMA},
            人物:{type:'array',maxItems:25,items:namedEntitySchema({...RECORDS.人物,...MODEL_DETAILS.人物})},
            势力地区:{type:'array',maxItems:20,items:namedEntitySchema({...RECORDS.势力地区,...MODEL_DETAILS.势力地区})},
            历史:{type:'array',maxItems:12,items:namedEntitySchema(RECORDS.历史,['更新','撤销本轮'])},
            传播:{type:'array',maxItems:20,items:namedEntitySchema({...RECORDS.传播,...MODEL_DETAILS.传播},['更新','移除','撤销本轮'])},
            因果:{type:'object',additionalProperties:false,properties:{
                当前阶段:{type:'string'},
                宏观顺序:{type:'array',minItems:0,maxItems:5,items:{type:'string'}},
                偏移记录:{type:'array',maxItems:10,items:OFFSET_RESULT_SCHEMA}
            }},
            势力:{type:'array',maxItems:15,items:FACTION_RESULT_SCHEMA},
            探索:{type:'array',maxItems:20,items:EXPLORATION_RESULT_SCHEMA},
            资产:{type:'array',maxItems:20,items:ASSET_RESULT_SCHEMA},
            异端:{type:'array',maxItems:15,items:{type:'object',additionalProperties:false,required:['名称','状态'],properties:{名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','撤销本轮']},状态:{type:'string',enum:['活跃','死亡']}}}},
            传闻:{type:'object',additionalProperties:false,properties:{
                街头巷议:{type:'array',maxItems:3,items:STREET_RUMOR_RESULT_SCHEMA},
                情报交易:{type:'array',maxItems:3,items:INTEL_TRADE_RESULT_SCHEMA},
                布告与檄文:{type:'array',maxItems:3,items:namedEntitySchema(EXISTING.布告与檄文,['更新','移除','撤销本轮'],['发布者','内容','张贴位置'])}
            }},
            关系:{type:'array',maxItems:25,items:{type:'object',additionalProperties:false,required:['名称'],properties:{
                名称:{type:'string',minLength:1},操作:{type:'string',enum:['更新','撤销本轮']},
                在场:{type:'boolean'},种族:{type:'string'},身份:relationTagsSchema(),
                职业:{type:'object',additionalProperties:copy(RELATION_OCCUPATION_SCHEMA),maxProperties:12},
                层级:{type:'string',enum:copy(RELATION_RANKS)},HP:{type:'number',minimum:0,maximum:99999999},
                THP:{type:'number',minimum:0,maximum:99999999},EP:{type:'number',minimum:0,maximum:99999999},
                状态:{type:'object',additionalProperties:copy(RELATION_STATUS_SCHEMA),maxProperties:12},
                血统:{type:'object',additionalProperties:copy(RELATION_BLOODLINE_SCHEMA),maxProperties:2},
                装备:{type:'object',additionalProperties:copy(RELATION_EQUIP_SCHEMA),maxProperties:6},
                技能:{type:'object',additionalProperties:copy(RELATION_SKILL_SCHEMA),maxProperties:4},
                形态库:{type:'object',additionalProperties:copy(RELATION_FORM_SCHEMA),maxProperties:4},
                当前形态:copy(RELATION_CURRENT_FORM_SCHEMA),
                性格:{type:'string'},喜爱:{type:'string'},外貌:{type:'string'},着装:{type:'string'},
                是否队友:{type:'boolean'},好感度:{type:'number',minimum:-100,maximum:100},态度:{type:'string'},背景故事:{type:'string'}
            }}}
        }
    };
    function sampleForWorldResultList(key) {
        if(key==='事件')return {...RECORDS.事件,...MODEL_DETAILS.事件};
        if(key==='人物')return {...RECORDS.人物,...MODEL_DETAILS.人物};
        if(key==='势力地区')return {...RECORDS.势力地区,...MODEL_DETAILS.势力地区};
        if(key==='历史')return RECORDS.历史;
        if(key==='传播')return {...RECORDS.传播,...MODEL_DETAILS.传播};
        if(key==='势力')return EXISTING.势力;
        if(key==='探索')return EXISTING.探索;
        if(key==='异端')return EXISTING.名单;
        return {};
    }
    function detailTextField(sample) {
        for(const key of ['名称','事实','行动','影响','内容','说明','问题','对象','地点']){
            if(Object.hasOwn(sample||{},key)&&typeof sample[key]==='string')return key;
        }
        return Object.keys(sample||{}).find(key=>typeof sample[key]==='string')||'';
    }
    function normalizeStructuredDetail(value,sample) {
        const out=copy(sample||{});
        if(plain(value)){
            for(const key of Object.keys(sample||{})){
                if(Object.hasOwn(value,key))out[key]=normalizeResultField(value[key],sample[key]);
            }
            return out;
        }
        if(value!==undefined&&value!==null&&value!==''){
            const key=detailTextField(sample);
            if(key)out[key]=normalizeResultField(value,sample[key]);
        }
        return out;
    }
    function normalizeResultField(value,sample) {
        if(Array.isArray(sample)){
            const list=Array.isArray(value)?value:(value===undefined||value===null||value===''?[]:[value]);
            if(sample.length&&plain(sample[0]))return list.filter(item=>item!==undefined&&item!==null&&item!=='').map(item=>normalizeStructuredDetail(item,sample[0]));
            return list.map(copy);
        }
        if(plain(sample)){
            if(!plain(value))return copy(sample);
            const out=copy(sample);
            for(const key of Object.keys(sample))if(Object.hasOwn(value,key))out[key]=normalizeResultField(value[key],sample[key]);
            return out;
        }
        if(typeof sample==='number'){
            const number=Number(value);
            return Number.isFinite(number)?number:value;
        }
        if(typeof sample==='boolean')return typeof value==='boolean'?value:!!value;
        if(typeof sample==='string'&&value!==undefined&&value!==null)return String(value);
        return copy(value);
    }
    function normalizeNamedResultList(value,sample,allowedOps=['更新','撤销本轮']) {
        const sampleKeys=Object.keys(sample||{}),singleField=sampleKeys.length===1?sampleKeys[0]:'';
        const list=Array.isArray(value)?value:plain(value)?Object.entries(value).map(([name,item])=>{
            if(plain(item))return Object.assign({名称:name},copy(item));
            if(singleField&&item!==undefined&&item!==null)return {名称:name,[singleField]:copy(item)};
            return null;
        }).filter(Boolean):[];
        const fields=new Set(sampleKeys),map=new Map();
        const aliases={
            所在世界:'所属世界',
            已知信息:'认知',
            下次检查条件:'下次检查',
            事实:'内容'
        };
        for(const source of list){
            if(!plain(source))continue;
            const raw=copy(source);
            for(const [from,to] of Object.entries(aliases)){
                if(fields.has(to)&&Object.hasOwn(raw,from)&&!Object.hasOwn(raw,to))raw[to]=raw[from];
            }
            if(fields.has('可信度')&&!Object.hasOwn(raw,'可信度')){
                const rumorClass=String(raw.分类||'').trim();
                raw.可信度=({'事实':'或许可信','猜测':'可疑','谣言':'酒话','酒话':'酒话','可疑':'可疑','或许可信':'或许可信'})[rumorClass]||'可疑';
            }
            const name=String(raw.名称??raw.name??'').trim();
            if(!name)continue;
            const item={名称:name};
            const operation=String(raw.操作||'更新');
            item.操作=allowedOps.includes(operation)?operation:'更新';
            for(const key of fields)if(Object.hasOwn(raw,key))item[key]=normalizeResultField(raw[key],sample[key]);
            const id=nameKey(name),prev=map.get(id);
            if(item.操作==='撤销本轮'){map.delete(id);continue;}
            map.set(id,prev?Object.assign(prev,item):item);
        }
        return Array.from(map.values());
    }
    function normalizeAssetResultList(value) {
        const sourceList=Array.isArray(value)?value:plain(value)?Object.entries(value).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,操作:item==='移除'?'移除':'更新'}):[];
        const map=new Map(),stringFields=['类型','状态'],numberFields=['主体规模','完整度'];
        const normalizeOwners=value=>{
            const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];
            for(const raw of source){const owner=String(raw??'').trim();if(!owner||owner==='无主'||out.includes(owner))continue;out.push(owner);}
            return out.slice(0,12);
        };
        const normalizeMap=(value,kind)=>{
            if(!plain(value))return {};
            const out={};
            for(const [name,raw] of Object.entries(value)){
                if(forbidden.has(name))continue;
                if(raw===null){out[name]=null;continue;}
                if(kind==='person'){
                    if(typeof raw==='string')out[name]=raw;
                    continue;
                }
                if(!plain(raw))continue;
                const item={};
                if(kind==='unit'){
                    for(const key of ['余量','上限'])if(Object.hasOwn(raw,key)){const n=Number(raw[key]);if(Number.isFinite(n))item[key]=n;}
                    if(Array.isArray(raw.加成))item.加成=raw.加成.filter(x=>typeof x==='string');
                }else{
                    if(Object.hasOwn(raw,'阶段'))item.阶段=String(raw.阶段||'');
                    for(const key of ['功能','产出'])if(Object.hasOwn(raw,key))item[key]=String(raw[key]??'');
                    if(Array.isArray(raw.加成))item.加成=raw.加成.filter(x=>typeof x==='string');
                }
                out[name]=item;
            }
            return out;
        };
        const mergeItem=(previous,item)=>{
            if(!previous)return item;
            const merged=Object.assign({},previous,item);
            for(const field of ['消耗单元','建设序列','驻扎人员']){
                if(plain(previous[field])&&plain(item[field]))merged[field]=Object.assign({},previous[field],item[field]);
            }
            if(plain(previous.能源)&&plain(item.能源))merged.能源=Object.assign({},previous.能源,item.能源);
            return merged;
        };
        for(const source of sourceList){
            if(!plain(source))continue;
            const name=String(source.名称??source.name??'').trim();if(!name||forbidden.has(name))continue;
            const operation=['更新','移除','撤销本轮'].includes(source.操作)?source.操作:'更新';
            const id=nameKey(name);
            if(operation==='撤销本轮'){map.delete(id);continue;}
            const item={名称:name,操作:operation};
            if(Object.hasOwn(source,'所属对象'))item.所属对象=normalizeOwners(source.所属对象);
            for(const field of stringFields)if(Object.hasOwn(source,field))item[field]=String(source[field]??'');
            for(const field of numberFields)if(Object.hasOwn(source,field)){const n=Number(source[field]);item[field]=Number.isFinite(n)?n:source[field];}
            if(Object.hasOwn(source,'能源')){
                if(source.能源===null)item.能源=null;
                else if(plain(source.能源)){
                    item.能源={};
                    for(const field of ['类型','描述'])if(Object.hasOwn(source.能源,field))item.能源[field]=String(source.能源[field]??'');
                    for(const field of ['当前','上限'])if(Object.hasOwn(source.能源,field)){const n=Number(source.能源[field]);if(Number.isFinite(n))item.能源[field]=n;}
                }
            }
            if(Object.hasOwn(source,'消耗单元'))item.消耗单元=normalizeMap(source.消耗单元,'unit');
            if(Object.hasOwn(source,'建设序列'))item.建设序列=normalizeMap(source.建设序列,'build');
            if(Object.hasOwn(source,'驻扎人员'))item.驻扎人员=normalizeMap(source.驻扎人员,'person');
            if(Object.hasOwn(source,'待办事件'))item.待办事件=Array.isArray(source.待办事件)?source.待办事件.filter(x=>typeof x==='string'):[];
            map.set(id,mergeItem(map.get(id),item));
        }
        return Array.from(map.values());
    }
    function normalizeRelationResultList(value) {
        const list=Array.isArray(value)?value:[],map=new Map();
        for(const source of list){
            if(!plain(source))continue;
            const name=String(source.名称??source.name??'').trim();if(!name)continue;
            const item={名称:name,操作:source.操作==='撤销本轮'?'撤销本轮':'更新'};
            for(const key of RELATION_SYNC_KEYS){
                if(!Object.hasOwn(source,key))continue;
                const raw=source[key];
                if(['在场','是否队友'].includes(key))item[key]=typeof raw==='boolean'?raw:!!raw;
                else if(['HP','THP','EP','好感度'].includes(key)){const n=Number(raw);item[key]=Number.isFinite(n)?n:raw;}
                else if(key==='身份')item[key]=Array.isArray(raw)?raw.filter(x=>typeof x==='string'):raw;
                else if(RELATION_COMPONENT_FIELDS.has(key)||key==='当前形态')item[key]=copy(raw);
                else item[key]=raw==null?'':String(raw);
            }
            const id=nameKey(name),prev=map.get(id);
            if(item.操作==='撤销本轮'){map.delete(id);continue;}
            map.set(id,prev?Object.assign(prev,item):item);
        }
        return Array.from(map.values());
    }
    function normalizeWorldResult(value) {
        if(!plain(value))throw new Error('WorldResult 必须是 JSON 对象');
        const result={摘要:String(value.摘要??value.summary??'世界继续推进')};
        const legacyStage=(Object.hasOwn(value,'公开摘要')||Object.hasOwn(value,'public_summary'))?String(value.公开摘要??value.public_summary??'').trim():'';
        result.货币={};
        if(plain(value.货币)){
            for(const key of Object.keys(CURRENCY_FIELDS))if(Object.hasOwn(value.货币,key))result.货币[key]=String(value.货币[key]??'');
        }
        result.历法={};
        if(plain(value.历法)){
            if(Object.hasOwn(value.历法,'名称'))result.历法.名称=String(value.历法.名称??'');
            if(Array.isArray(value.历法.月份天数))result.历法.月份天数=value.历法.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24);
            if(Object.hasOwn(value.历法,'闰年规则'))result.历法.闰年规则=String(value.历法.闰年规则??'');
        }
        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索']){
            const operations=(key==='传播')?['更新','移除','撤销本轮']:['更新','撤销本轮'];
            result[key]=normalizeNamedResultList(value[key],sampleForWorldResultList(key),operations);
        }
        result.资产=normalizeAssetResultList(value.资产);
        result.异端=(Array.isArray(value.异端)?value.异端:[]).filter(plain).map(item=>({
            名称:String(item.名称||'').trim(),
            操作:item.操作==='撤销本轮'?'撤销本轮':'更新',
            状态:['活跃','死亡'].includes(item.状态)?item.状态:''
        })).filter(item=>item.名称&&item.状态);
        result.因果={};
        const causal=plain(value.因果)?value.因果:{};
        if(Object.hasOwn(causal,'当前阶段'))result.因果.当前阶段=String(causal.当前阶段||'');
        else if(legacyStage)result.因果.当前阶段=legacyStage;
        if(Array.isArray(causal.宏观顺序))result.因果.宏观顺序=causal.宏观顺序.map(x=>String(x||'').trim()).filter(Boolean).slice(0,5);
        result.因果.偏移记录=normalizeNamedResultList(causal.偏移记录,EXISTING.偏移记录,['更新','撤销本轮']);
        result.传闻={};
        const rumors=plain(value.传闻)?value.传闻:{};
        for(const key of WORLD_RESULT_RUMORS){
            let list=normalizeNamedResultList(rumors[key],EXISTING[key],['更新','移除','撤销本轮']);
            if(key==='街头巷议'){
                for(const item of list)if(Object.hasOwn(item,'可信度'))item.可信度=normalizeRumorCredibility(item.可信度);
                const seen=new Set(),deduped=[];
                for(const item of list){
                    const signature=String(item.内容||'').replace(/\s+/g,' ').trim();
                    if(signature&&seen.has(signature))continue;
                    if(signature)seen.add(signature);
                    deduped.push(item);
                    if(deduped.length>=3)break;
                }
                list=deduped;
            }
            result.传闻[key]=list;
        }
        const relationSource=plain(value.关系)&&!Array.isArray(value.关系)
            ?Object.entries(value.关系).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,好感度:item})
            :value.关系;
        result.关系=normalizeRelationResultList(relationSource);
        return result;
    }
    function mergeNamedResultLists(base,incoming) {
        const map=new Map();
        for(const item of base||[])map.set(nameKey(item.名称),copy(item));
        for(const item of incoming||[]){
            const id=nameKey(item.名称);
            if(item.操作==='撤销本轮'){map.delete(id);continue;}
            map.set(id,Object.assign(map.get(id)||{},copy(item)));
        }
        return Array.from(map.values());
    }
    function mergeWorldResults(base,incoming) {
        const a=base?normalizeWorldResult(base):normalizeWorldResult({摘要:''});
        const b=normalizeWorldResult(incoming);
        const result={摘要:[a.摘要,b.摘要].filter(Boolean).filter((x,i,list)=>list.indexOf(x)===i).join('；')};
        result.货币=Object.assign({},a.货币||{},b.货币||{});
        result.历法=Object.assign({},a.历法||{},b.历法||{});
        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'])result[key]=mergeNamedResultLists(a[key],b[key]);
        result.因果={
            偏移记录:mergeNamedResultLists(a.因果?.偏移记录,b.因果?.偏移记录)
        };
        if(Object.hasOwn(b.因果||{},'当前阶段'))result.因果.当前阶段=b.因果.当前阶段;
        else if(Object.hasOwn(a.因果||{},'当前阶段'))result.因果.当前阶段=a.因果.当前阶段;
        if(Array.isArray(b.因果?.宏观顺序)&&b.因果.宏观顺序.length)result.因果.宏观顺序=copy(b.因果.宏观顺序);
        else if(Array.isArray(a.因果?.宏观顺序))result.因果.宏观顺序=copy(a.因果.宏观顺序);
        result.传闻={};
        for(const key of WORLD_RESULT_RUMORS)result.传闻[key]=mergeNamedResultLists(a.传闻?.[key],b.传闻?.[key]);
        return result;
    }
    function worldResultFragments(value) {
        const result=normalizeWorldResult(value),fragments=[];
        const push=(label,body)=>fragments.push({label,result:Object.assign({摘要:''},body)});
        for(const [key,value] of Object.entries(result.货币||{}))push('货币/'+key,{货币:{[key]:copy(value)}});
        for(const [key,value] of Object.entries(result.历法||{}))push('历法/'+key,{历法:{[key]:copy(value)}});
        for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端']){
            for(const item of result[key]||[])push(key+'/'+item.名称,{[key]:[copy(item)]});
        }
        if(Object.hasOwn(result.因果||{},'当前阶段'))push('因果/当前阶段',{因果:{当前阶段:result.因果.当前阶段}});
        if(Array.isArray(result.因果?.宏观顺序)&&result.因果.宏观顺序.length)push('因果/宏观顺序',{因果:{宏观顺序:copy(result.因果.宏观顺序)}});
        for(const item of result.因果?.偏移记录||[])push('因果/偏移记录/'+item.名称,{因果:{偏移记录:[copy(item)]}});
        for(const key of WORLD_RESULT_RUMORS)for(const item of result.传闻?.[key]||[])push('传闻/'+key+'/'+item.名称,{传闻:{[key]:[copy(item)]}});
        for(const item of result.关系||[])push('关系/'+item.名称,{关系:[copy(item)]});
        return {摘要:result.摘要,fragments};
    }
    function shortSchemaValue(value) {
        if(value===undefined)return 'undefined';
        let raw;try{raw=JSON.stringify(value);}catch(_){raw=String(value);}
        if(raw===undefined)raw=String(value);
        return raw.length>140?raw.slice(0,137)+'…':raw;
    }
    function firstSchemaDifference(before,after,parts) {
        if(same(before,after))return null;
        if(plain(before)&&plain(after)){
            const keys=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));
            for(const key of keys){
                const diff=firstSchemaDifference(before[key],after[key],parts.concat(key));
                if(diff)return diff;
            }
        }
        if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
            for(let i=0;i<before.length;i++){
                const diff=firstSchemaDifference(before[i],after[i],parts.concat(String(i)));
                if(diff)return diff;
            }
        }
        return {parts,before,after};
    }
    function schemaMismatchError(beforeState,afterState,patchPath) {
        const parts=tokens(patchPath),before=get(beforeState,parts),after=get(afterState,parts);
        const diff=firstSchemaDifference(before,after,parts)||{parts,before,after};
        return new Error('字段未通过完整 Schema 校验：'+pointer(diff.parts)+'（'+shortSchemaValue(diff.before)+' → '+shortSchemaValue(diff.after)+'）');
    }
    function stageWorldResult(stat,accepted,incoming,validate) {
        const split=worldResultFragments(incoming);
        let staged=accepted?mergeWorldResults(accepted,{摘要:split.摘要}):normalizeWorldResult({摘要:split.摘要});
        let pending=split.fragments.map(unit=>Object.assign({},unit,{error:null})),progress=true;
        while(pending.length&&progress){
            progress=false;
            const nextPending=[];
            for(const unit of pending){
                const candidate=mergeWorldResults(staged,unit.result);
                try{
                    const compiled=compileWorldResult(stat,candidate);
                    const built=materializeWorldUpdate(stat,[],compiled.patches);
                    if(typeof validate==='function'){
                        const checked=validate(built.next);
                        for(const patch of compiled.patches){
                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw schemaMismatchError(built.next,checked,patch.path);
                        }
                    }
                    staged=candidate;
                    progress=true;
                }catch(error){
                    unit.error=error;
                    nextPending.push(unit);
                }
            }
            pending=nextPending;
        }
        return {
            accepted:staged,
            rejected:pending.map(unit=>({片段:unit.label,原因:String(unit.error?.message||unit.error||'业务片段未通过校验')}))
        };
    }
    function retryPlanForFailure(error,rejected=[]) {
        const plan=[];
        for(const item of rejected||[])plan.push(item.片段+'：'+item.原因);
        const message=String(error?.message||error||'');
        let match=message.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\+待发生），当前仅(\d+)个（进行中(\d+)个，待发生(\d+)个）/);
        if(match){
            const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0),missing=Math.max(0,3-current);
            plan.push('宏观骨架：当前可推进宏观节点'+current+'个（进行中'+active+'、待发生'+future+'），还需补充至少'+missing+'个真正的待发生宏观节点；会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。新增宏观事件必须给出可执行的时间/条件/前因。');
            plan.push('因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序，使用最终3~5个仍可推进的宏观节点名称形成顺序。');
        }else if(/因果轨道未形成有效宏观投影/.test(message)){
            plan.push('因果轨道：不要重写已接受事件，只补写 因果.宏观顺序；长度必须3~5，且每个名称都必须对应已建立且未取消的宏观节点。');
        }else if((match=message.match(/到期事件未处理：([^。]+)/))){
            plan.push('到期事件/'+match[1]+'：本轮必须明确启动该事件，或更新本轮复核日期、阻碍条件与下次检查。');
        }else if((match=message.match(/事件时间锚点缺失或过于模糊：([^；]+)/))){
            plan.push('事件/'+match[1]+'：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。');
        }else if((match=message.match(/事件时间锚点仍未补全：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('事件/'+name+'：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。');
        }else if((match=message.match(/超期活动事件仍未复核：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('事件/'+name+'：该局部活动已远超正常持续窗口。若实际早已结束则改为已完成并补结果；若失效则已取消；只有确实仍持续时才保留进行中，并把更新时间写为当前世界时间、更新当前描述并填写下次检查。');
        }else if((match=message.match(/时间越界记录仍未修复：([^；]+)/))){
            plan.push('时间一致性：修复这些已经发生的记录，任何已完成/进行中事件、人物更新时间、地区已发生变化、历史与传播都不得晚于当前世界时间：'+match[1]);
        }else if((match=message.match(/异端活动未复核：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('异端活动/'+name+'：在 WorldResult.人物 中补写该活跃异端本轮的地点、目标、行动，并把更新时间精确写为当前世界时间；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。');
        }else if((match=message.match(/NPC构筑审计未推进：([^；]+)/))){
            for(const name of match[1].split('、').filter(Boolean))plan.push('NPC构筑审计/'+name+'：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。');
        }else if(message&&!rejected.length){
            plan.push('整体校验：'+message);
        }
        return Array.from(new Set(plan.filter(Boolean)));
    }
    function makeRetryFailure(rejected,globalError) {
        const reasons=[];
        if(rejected?.length)reasons.push('部分业务片段未通过：'+rejected.map(x=>x.片段).join('、'));
        if(globalError)reasons.push(String(globalError.message||globalError));
        const error=new Error(reasons.join('；')||'WorldResult 未通过业务校验');
        error.retryPlan=retryPlanForFailure(globalError,rejected);
        error.rejectedSlices=copy(rejected||[]);
        return error;
    }
    const MICRO_EXPLORATION_SEGMENT=/^(?:天台|教室|走廊|楼梯|楼层|办公室|医务室|校医室|房间|寝室|宿舍房间|洗手间|浴室|食堂|门厅|入口|出口|校门|桥头|街口|小巷)$/;
    function explorationGranularity(name) {
        const raw=String(name||'').trim();
        if(!raw)return {invalid:true,parent:''};
        if(MICRO_EXPLORATION_SEGMENT.test(raw))return {invalid:true,parent:''};
        const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
        if(parts.length>1&&MICRO_EXPLORATION_SEGMENT.test(parts.at(-1)))return {invalid:true,parent:parts.slice(0,-1).join('-')};
        return {invalid:false,parent:''};
    }
    function repairExplorationGranularity(stat) {
        const bucket=stat?.世界?.探索;if(!plain(bucket))return [];
        const patches=[];
        for(const name of Object.keys(bucket)){
            const info=explorationGranularity(name);if(!info.invalid||!info.parent)continue;
            const child=bucket[name],parent=bucket[info.parent];
            const merged=plain(parent)
                ? Object.assign(copy(EXISTING.探索),copy(parent),{探索度:Math.max(Number(parent.探索度)||0,Number(child?.探索度)||0)})
                : Object.assign(copy(EXISTING.探索),{
                    风险:String(child?.风险||'F'),
                    探索度:Number(child?.探索度)||0,
                    描述:'由旧版子区域探索记录合并，待补充整体地标描述',
                    隐藏真相:''
                });
            bucket[info.parent]=merged;delete bucket[name];
            patches.push({op:parent?'replace':'add',path:pointer(['世界','探索',info.parent]),value:copy(merged)});
            patches.push({op:'remove',path:pointer(['世界','探索',name])});
        }
        return patches;
    }
    function resultFields(item,sample) {
        const out={};
        for(const key of Object.keys(sample||{}))if(Object.hasOwn(item,key))out[key]=copy(item[key]);
        return out;
    }
    function validateStringArray(value,label) {
        if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string[]');
    }
    function validateStringMap(value,label) {
        if(!plain(value)||Object.values(value).some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string map');
    }
    function validateQuality(value,label) {
        if(!RELATION_QUALITIES.includes(String(value||'')))throw new Error(label+' 只允许 '+RELATION_QUALITIES.join('/'));
    }
    function validateRawAttributes(value,label,{requireFive=false,allowNumbers=false}={}) {
        if(!plain(value))throw new Error(label+' 必须是对象');
        for(const key of Object.keys(value)){
            if(!RELATION_ATTR_KEYS.includes(key))throw new Error(label+' 含非法属性 '+key);
            if(allowNumbers&&typeof value[key]==='number'&&Number.isFinite(value[key])){
                if(value[key]===0)throw new Error(label+'.'+key+' 数值0应省略，避免ZOD清洗后产生无效差异');
                continue;
            }
            validateQuality(value[key],label+'.'+key);
        }
        if(requireFive)for(const key of RELATION_ATTR5)if(!Object.hasOwn(value,key))throw new Error(label+' 缺少基础属性 '+key);
    }
    function validateComponentShape(field,value,name='NPC') {
        if(!plain(value))throw new Error(name+' '+field+' 必须是对象');
        const assertFields=(item,keys,label)=>{for(const key of keys)if(!Object.hasOwn(item,key))throw new Error(label+' 缺少字段 '+key);};
        for(const [entryName,item] of Object.entries(value)){
            const label=name+' '+field+'.'+entryName;
            if(!entryName||!plain(item))throw new Error(label+' 必须是完整对象');
            if(field==='职业'){
                assertFields(item,['类型','特性','来源'],label);
                if(!['战斗','生活','辅助'].includes(item.类型))throw new Error(label+' 类型无效');
                validateStringArray(item.特性,label+'.特性');
                if(typeof item.来源!=='string')throw new Error(label+'.来源 必须是 string');
            }else if(field==='技能'){
                assertFields(item,['品质','类型','标签','效果','描述','消耗'],label);
                validateQuality(item.品质,label+'.品质');
                if(!Number.isInteger(item.类型)||item.类型<0||item.类型>2)throw new Error(label+'.类型 只能是0/1/2');
                validateStringArray(item.标签,label+'.标签');validateStringMap(item.效果,label+'.效果');
                if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
            }else if(field==='血统'){
                assertFields(item,['品质','标签','原始属性','效果','描述'],label);
                validateQuality(item.品质,label+'.品质');validateStringArray(item.标签,label+'.标签');
                validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});validateStringMap(item.效果,label+'.效果');
                if(typeof item.描述!=='string')throw new Error(label+'.描述 必须是 string');
            }else if(field==='装备'){
                assertFields(item,['品质','类型','标签','原始属性','效果','描述','消耗','状态'],label);
                validateQuality(item.品质,label+'.品质');
                if(!Number.isInteger(item.类型)||item.类型<0||item.类型>8)throw new Error(label+'.类型 只能是0~8');
                if(!Number.isInteger(item.状态)||item.状态<0||item.状态>2)throw new Error(label+'.状态 只能是0/1/2');
                validateStringArray(item.标签,label+'.标签');validateRawAttributes(item.原始属性,label+'.原始属性');
                validateStringMap(item.效果,label+'.效果');
                if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
            }else if(field==='状态'){
                assertFields(item,['类型','品质','持续','来源','原始属性','效果'],label);
                if(!['增益','减益','特殊'].includes(item.类型))throw new Error(label+'.类型无效');
                validateQuality(item.品质,label+'.品质');validateRawAttributes(item.原始属性,label+'.原始属性',{allowNumbers:true});
                if(typeof item.持续!=='string'||typeof item.来源!=='string'||typeof item.效果!=='string')throw new Error(label+' 持续/来源/效果必须是 string');
            }else if(field==='形态库'){
                assertFields(item,['层级','消耗','冷却','状态','标签','原始属性','效果','技能','描述'],label);
                if(!RELATION_RANKS.includes(item.层级))throw new Error(label+'.层级无效');
                validateStringArray(item.标签,label+'.标签');validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});
                validateStringMap(item.效果,label+'.效果');
                for(const key of ['消耗','冷却','状态','描述'])if(typeof item[key]!=='string')throw new Error(label+'.'+key+' 必须是 string');
                validateComponentShape('技能',item.技能,label);
            }
        }
    }
    function validateRelationSyncValue(field,value,npc,name='NPC') {
        if(field==='在场'||field==='是否队友'){if(typeof value!=='boolean')throw new Error(name+' '+field+' 必须是 boolean');return;}
        if(['种族','性格','喜爱','外貌','着装','态度','背景故事'].includes(field)){if(typeof value!=='string')throw new Error(name+' '+field+' 必须是 string');return;}
        if(field==='身份'){validateStringArray(value,name+' 身份');return;}
        if(field==='层级'){if(!RELATION_RANKS.includes(value))throw new Error(name+' 层级只允许 '+RELATION_RANKS.join('/'));return;}
        if(RELATION_COMPONENT_FIELDS.has(field)){validateComponentShape(field,value,name);return;}
        if(field==='当前形态'){
            if(!plain(value)||typeof value.激活!=='boolean'||typeof value.名称!=='string')throw new Error(name+' 当前形态必须是 {激活:boolean,名称:string}');
            return;
        }
        if(['HP','THP','EP','好感度'].includes(field)){
            if(typeof value!=='number'||!Number.isFinite(value))throw new Error(name+' '+field+' 必须是有效数字');
            if(field==='好感度'&&(value<-100||value>100))throw new Error(name+' 好感度范围 -100~100');
            if(field!=='好感度'&&value<0)throw new Error(name+' '+field+' 不能小于0');
            if(field==='HP'&&Number.isFinite(Number(npc?.HP_MAX))&&value>Number(npc.HP_MAX))throw new Error(name+' HP 不能超过 HP_MAX');
            if(field==='EP'&&Number.isFinite(Number(npc?.EP_MAX))&&value>Number(npc.EP_MAX))throw new Error(name+' EP 不能超过 EP_MAX');
        }
    }
    function materializeRelationComponent(field,value) {
        const out=copy(value);
        if(['血统','装备','状态','形态库'].includes(field)&&plain(out)){
            for(const item of Object.values(out)){
                if(!plain(item))continue;
                item.真属性={};
            }
        }
        return out;
    }
    function mergeRelationComponent(field,oldValue,incoming) {
        if(!RELATION_COMPONENT_FIELDS.has(field))return materializeRelationComponent(field,incoming);
        const merged=plain(oldValue)?copy(oldValue):{};
        for(const [name,item] of Object.entries(incoming||{}))merged[name]=materializeRelationComponent(field,{[name]:item})[name];
        return merged;
    }

    const ASSET_DEFAULTS={所属对象:[],类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};
    const ASSET_ENERGY_DEFAULTS={类型:'',当前:0,上限:0,描述:''};
    const ASSET_UNIT_DEFAULTS={余量:0,上限:0,加成:[]};
    const ASSET_BUILD_DEFAULTS={阶段:'基础',功能:'',加成:[],产出:'',下次产出日期:'',下次产出游天:0};
    function materializeAssetRecord(oldValue,item,isNew=false) {
        const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);
        const normalizeOwners=value=>{const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];for(const raw of source){const owner=String(raw??'').trim();if(!owner||owner==='无主'||out.includes(owner))continue;out.push(owner);}return out.slice(0,12);};
        // 旧资产没有所属对象时兼容为玩家资产；显式空数组则表示无主。
        asset.所属对象=Object.hasOwn(oldAsset,'所属对象')?normalizeOwners(oldAsset.所属对象):['<user>'];
        if(isNew){
            if(!Object.hasOwn(item,'所属对象'))throw new Error('新资产必须明确所属对象数组；无主资产请使用空数组：'+item.名称);
            if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);
        }
        if(Object.hasOwn(item,'所属对象'))asset.所属对象=normalizeOwners(item.所属对象);
        for(const field of ['类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);
        if(Object.hasOwn(item,'能源')){
            if(item.能源===null)delete asset.能源;
            else asset.能源=Object.assign(copy(ASSET_ENERGY_DEFAULTS),plain(oldAsset.能源)?copy(oldAsset.能源):{},plain(item.能源)?copy(item.能源):{});
        }
        const mergeNamedMap=(field,defaults)=>{
            if(!Object.hasOwn(item,field))return;
            const merged=plain(oldAsset[field])?copy(oldAsset[field]):{};
            for(const [name,value] of Object.entries(item[field]||{})){
                if(forbidden.has(name))continue;
                if(value===null){delete merged[name];continue;}
                const previous=plain(merged[name])?copy(merged[name]):{};
                merged[name]=Object.assign(copy(defaults),previous,copy(value));
            }
            if(Object.keys(merged).length)asset[field]=merged;else delete asset[field];
        };
        mergeNamedMap('消耗单元',ASSET_UNIT_DEFAULTS);
        mergeNamedMap('建设序列',ASSET_BUILD_DEFAULTS);
        if(Object.hasOwn(item,'驻扎人员')){
            const merged=plain(oldAsset.驻扎人员)?copy(oldAsset.驻扎人员):{};
            for(const [name,value] of Object.entries(item.驻扎人员||{})){
                if(forbidden.has(name))continue;
                if(value===null)delete merged[name];else merged[name]=String(value??'');
            }
            asset.驻扎人员=merged;
        }
        if(Object.hasOwn(item,'待办事件'))asset.待办事件=copy(item.待办事件||[]);
        if(!plain(asset.建设序列))asset.建设序列={};
        if(!plain(asset.驻扎人员))asset.驻扎人员={};
        if(!Array.isArray(asset.待办事件))asset.待办事件=[];
        return asset;
    }

    function compileWorldResult(stat,value) {
        const result=normalizeWorldResult(value),patches=[],warnings=[];
        const exists=parts=>get(stat,canonicalizeParts(parts,stat));
        const addEntity=(parts,item,sample,options={})=>{
            if(item.操作==='撤销本轮')return;
            let actual=canonicalizeParts(parts,stat),old=get(stat,actual);
            if(item.操作==='移除'){
                if(old!==undefined&&options.removable)patches.push({op:'remove',path:pointer(actual)});
                return;
            }
            const record=resultFields(item,sample);
            if(options.person&&!old&&!Object.hasOwn(record,'所属世界'))record.所属世界=stat.世界?.名称||'';
            if(options.event&&!Object.hasOwn(record,'描述'))record.描述=item.名称;
            if(options.event){
                const mergedEvent=Object.assign(copy(RECORDS.事件),plain(old)?old:{},record);
                if(['待发生','进行中'].includes(mergedEvent.状态)){
                    const anchor=eventTimeAnchor(mergedEvent);
                    if(!anchor||VAGUE_EVENT_TIME.test(anchor))throw new Error('事件时间锚点缺失或过于模糊：'+item.名称+'；请填写具体世界时间/时段，或明确相对/因果时间（如“爆发后数日”“前置节点完成后当日傍晚”），禁止空值和“近期/稍后/未来/待定/未知”');
                }
            }
            if(!Object.keys(record).length){warnings.push('忽略空业务记录：'+item.名称);return;}
            patches.push({op:old===undefined?'add':'replace',path:pointer(actual),value:record});
        };
        for(const [key,value] of Object.entries(result.货币||{})){
            const parts=['世界','货币',key],old=get(stat,parts);
            if(old!==value)patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value});
        }
        for(const [key,value] of Object.entries(result.历法||{})){
            const parts=['世界','历法',key],old=get(stat,parts);
            if(!same(old,value))patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value:copy(value)});
        }
        for(const item of result.事件)addEntity(['世界',PATH,'事件',item.名称],item,{...RECORDS.事件,...MODEL_DETAILS.事件},{event:true});
        const plannedDead=new Set((result.异端||[]).filter(item=>item.操作!=='撤销本轮'&&item.状态==='死亡').map(item=>nameKey(item.名称)));
        for(const item of result.人物){
            const alien=alienRosterMatch(stat,item.名称);
            if((alien&&alien.记录?.状态==='死亡')||plannedDead.has(nameKey(item.名称))){warnings.push('异端已死亡，禁止恢复后台人物：'+item.名称);continue;}
            addEntity(['世界',PATH,'人物',item.名称],item,{...RECORDS.人物,...MODEL_DETAILS.人物},{person:true});
        }
        for(const item of result.势力地区)addEntity(['世界',PATH,'势力地区',item.名称],item,{...RECORDS.势力地区,...MODEL_DETAILS.势力地区});
        for(const item of result.传播)addEntity(['世界',PATH,'传播',item.名称],item,{...RECORDS.传播,...MODEL_DETAILS.传播},{removable:true});
        for(const item of result.历史){
            if(item.操作==='撤销本轮')continue;
            let name=item.名称,parts=['世界',PATH,'历史',name],record=resultFields(item,RECORDS.历史);
            if(!Object.keys(record).length){warnings.push('忽略空历史记录：'+name);continue;}
            if(get(stat,parts)!==undefined){
                const old=get(stat,parts);
                if(same(normalizeBackendRecord('历史',record,old),old))continue;
                let n=2;while(get(stat,['世界',PATH,'历史',name+'#'+n])!==undefined)n++;
                name=name+'#'+n;parts=['世界',PATH,'历史',name];
            }
            patches.push({op:'add',path:pointer(parts),value:record});
        }
        const causal=result.因果||{};
        if(Object.hasOwn(causal,'当前阶段')){
            const parts=['世界','因果轨道','当前阶段'],old=get(stat,parts);
            patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value:causal.当前阶段});
        }
        if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length>=3&&causal.宏观顺序.length<=5){
            const parts=['世界','因果轨道','故事线'],story=causal.宏观顺序.join(' -> '),old=get(stat,parts);
            patches.push({op:old===undefined?'add':'replace',path:pointer(parts),value:story});
        } else if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length)warnings.push('宏观顺序不足3个，等待补齐后再投影因果轨道');
        for(const item of causal.偏移记录||[]){
            if((stat.设置||{}).世界超稳){warnings.push('世界超稳：忽略偏移 '+item.名称);continue;}
            addEntity(['世界','因果轨道','偏移记录',item.名称],item,EXISTING.偏移记录);
        }
        for(const item of result.势力)addEntity(['世界','势力',item.名称],item,EXISTING.势力);
        for(const item of result.资产||[]){
            if(item.操作==='撤销本轮')continue;
            const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;
            const tombstoneName=stableNameIn(stat?.世界?.[PATH]?.资产墓碑||{},item.名称);
            if(!target&&item.操作!=='移除'&&tombstoneName)throw new Error('资产已被用户或MVU删除，受删除保护，世界引擎不得重建：'+item.名称);
            if(item.操作==='移除'){
                if(target)patches.push({op:'remove',path:pointer(['资产',target])});
                else warnings.push('资产对象不存在，忽略移除：'+item.名称);
                continue;
            }
            const finalName=target||item.名称;
            const record=materializeAssetRecord(existing,item,!target);
            if(existing&&same(existing,record))continue;
            patches.push({op:target?'replace':'add',path:pointer(['资产',finalName]),value:record});
        }
        for(const item of result.探索){
            const granularity=explorationGranularity(item.名称);
            if(granularity.invalid)throw new Error('探索粒度过细：'+item.名称+'。世界.探索只记录整体地标/区域'+(granularity.parent?'，请改为“'+granularity.parent+'”并把微观进展累加到主区域':'，禁止把天台、教室、走廊、房间等子区域作为独立探索项'));
            const old=(stat.世界?.探索||{})[item.名称];
            if(old&&Object.hasOwn(item,'探索度')&&Number(item.探索度)<Number(old.探索度||0))throw new Error('探索度不能无因回退：'+item.名称+' '+old.探索度+' -> '+item.探索度);
            addEntity(['世界','探索',item.名称],item,EXISTING.探索);
        }
        if(!(stat.设置||{}).单一世界)for(const item of result.异端){
            if(item.操作==='撤销本轮')continue;
            const roster=stat.世界?.异端雷达?.名单||{},target=stableNameIn(roster,item.名称);
            if(!target){warnings.push('异端名单对象不存在，禁止世界引擎新增：'+item.名称);continue;}
            const oldStatus=roster[target]?.状态;
            if(oldStatus==='死亡'&&item.状态!=='死亡'){warnings.push('死亡异端状态不可逆：'+target);continue;}
            if(oldStatus===item.状态)continue;
            patches.push({op:'replace',path:pointer(['世界','异端雷达','名单',target,'状态']),value:item.状态});
        } else if(result.异端.length)warnings.push('单一世界：忽略异端雷达更新');
        for(const key of WORLD_RESULT_RUMORS)for(const item of result.传闻[key])addEntity(['传闻',key,item.名称],item,EXISTING[key],{removable:true});
        const auditNames=new Set(npcBuildAudit(stat).map(item=>nameKey(item.名称)));
        for(const item of result.关系||[]){
            if(item.操作==='撤销本轮')continue;
            const target=stableNameIn(stat.关系列表||{},item.名称);
            if(!target){warnings.push('关系对象不存在，禁止世界引擎新建：'+item.名称);continue;}
            const npc=stat.关系列表[target],fields=resultFields(item,RELATION_SYNC_FIELDS);
            if(!Object.keys(fields).length){warnings.push('忽略空关系更新：'+target);continue;}
            for(const [field,value] of Object.entries(fields)){
                if(RELATION_AUDIT_ONLY_FIELDS.has(field)&&!auditNames.has(nameKey(target))){
                    warnings.push('NPC当前不在构筑审计名单，忽略构筑字段：'+target+'/'+field);
                    continue;
                }
                validateRelationSyncValue(field,value,npc,target);
                const nextValue=RELATION_COMPONENT_FIELDS.has(field)?mergeRelationComponent(field,npc?.[field],value):materializeRelationComponent(field,value);
                if(RELATION_COMPONENT_FIELDS.has(field)){
                    const count=Object.keys(nextValue||{}).length;
                    const limit=field==='血统'?2:field==='装备'?6:field==='技能'?4:field==='形态库'?4:12;
                    if(count>limit)throw new Error(target+' '+field+' 数量超过NPC生成规则上限 '+limit);
                }
                if(same(npc?.[field],nextValue))continue;
                patches.push({op:npc?.[field]===undefined?'add':'replace',path:pointer(['关系列表',target,field]),value:copy(nextValue)});
            }
        }
        return {result,patches,warnings};
    }

    function validateState(stat) {
        const state = stat.世界[PATH];
        for (const [category, template] of Object.entries(RECORDS)) {
            if (!plain(state[category]) || Object.keys(state[category]).length > 300) throw new Error(category + '记录过多或结构错误');
            for (const [name,value] of Object.entries(state[category])) {
                if (forbidden.has(name)) throw new Error('非法记录名');
                checkRecord(value,template,DETAILS[category]);
                checkDetails(value,DETAILS[category]);
            }
        }
        for (const [name,event] of Object.entries(state.事件)) {
            if (!['待发生','进行中','已完成','已取消'].includes(event.状态)) throw new Error('非法事件状态：'+name+' = '+String(event.状态||'空')+'；只允许 待发生/进行中/已完成/已取消');
            if (!EVENT_CATEGORIES.has(event.分类)) throw new Error('非法事件分类：'+name+' = '+String(event.分类||'空'));
            if (event.前因.some(id => !Object.hasOwn(state.事件,id))) throw new Error('事件前因不存在：' + name);
        }
        const calendar=plain(stat.世界?.历法)?stat.世界.历法:{};
        const monthDays=Array.isArray(calendar.月份天数)?calendar.月份天数:[];
        if(monthDays.length>24||monthDays.some(n=>!Number.isInteger(Number(n))||Number(n)<1||Number(n)>99))throw new Error('世界历法月份天数无效');
        const hasMonthDay=value=>/\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日/.test(String(value||''));
        if(monthDays.length&&hasMonthDay(stat.世界.时间)&&!calendarDate(stat.世界.时间,calendar))throw new Error('世界时间违反历法月长：'+stat.世界.时间);
        if(monthDays.length){
            for(const [name,event] of Object.entries(state.事件)){
                for(const value of [event.时间,event.开始时间,event.结束时间]){
                    if(hasMonthDay(value)&&!calendarDate(value,calendar))throw new Error('事件日期违反世界历法：'+name+' = '+value);
                }
            }
        }
        const range = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
        for (const [name,item] of Object.entries(stat.世界.势力 || {})) if (!QUALITY_RANKS.includes(item.实力) || !range(item.声望,-5000,10000)) throw new Error('势力品质或声望越界：'+name+'，实力='+String(item.实力)+'，声望='+String(item.声望)+'；实力只允许 '+QUALITY_RANKS.join('/')+'，声望范围 -5000~10000');
        for (const [name,item] of Object.entries(stat.世界.探索 || {})) if (!QUALITY_RANKS.includes(item.风险) || !range(item.探索度,0,100)) throw new Error('探索品质或进度越界：'+name+'，风险='+String(item.风险)+'，探索度='+String(item.探索度)+'；风险只允许 '+QUALITY_RANKS.join('/')+'，探索度范围 0~100');
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
            if (patch.op === 'remove' && !(p[0] === '传闻' || (p[1] === PATH && p[2] === '传播') || (p[0] === '资产' && p.length === 2))) throw new Error('仅可移除过期传播、传闻与已彻底消失的资产，其他记录使用状态结束');
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
                    if(p[0]==='传闻'&&p[1]==='情报交易'&&!(next.系统状态||{}).是否在主神空间&&next.世界?.名称!=='主神空间'&&/空间币/.test(String(value.要价||'')))throw new Error('任务世界情报交易必须使用本地货币，不能使用空间币');
                }
                else if (old !== undefined && (typeof old !== typeof value || Array.isArray(old) !== Array.isArray(value))) throw new Error('字段类型发生改变');
                if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('数值无效');
                if (p[0] === '世界' && p[1] === '因果轨道' && p.length === 3 && typeof value !== 'string') throw new Error('因果摘要必须是文本');
                if (p[0] === '任务' && p[1] === '副本成就' && old === '已达成' && value !== old) throw new Error('不能回退已达成成就');
                if(p[0]==='关系列表'&&p.length===3)validateRelationSyncValue(p[2],value,next.关系列表?.[p[1]],p[1]);
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
        normalizeEventLayers(next);
        validateTemporalWrites(stat,next,patches);
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
        normalizeBackendState(work);compactWorldLifecycle(work);
        const appliedSeeds=(seedPatches||[]).filter(p=>get(work,canonicalizeParts(tokens(p.path),work))===undefined);
        let next=applyPatches(work,appliedSeeds);
        next=applyPatches(next,modelPatches||[]);
        const explorationPatches=repairExplorationGranularity(next);
        const layerPatches=normalizeEventLayers(next);
        const causalPatches=repairCausalProjection(next);
        const predecessorPatches=repairMacroPredecessors(next);
        const linkPatches=repairExplicitEventLinks(next);
        compactWorldLifecycle(next);
        validateState(next);
        const repairPatches=[...explorationPatches,...layerPatches,...causalPatches,...predecessorPatches,...linkPatches];
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
    }
    function unscheduledEvents(stat) {
        return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
            if(!['待发生','进行中'].includes(event?.状态))return false;
            const anchor=eventTimeAnchor(event);
            return !anchor||VAGUE_EVENT_TIME.test(anchor);
        }).map(([名称,event])=>({名称,分类:event.分类,状态:event.状态,条件:event.条件,前因:copy(event.前因||[]),当前时间:eventTimeAnchor(event)}));
    }
    function ensureEventTimeAnchors(next,required=[]) {
        const missing=[];
        for(const item of required||[]){
            const event=next?.世界?.[PATH]?.事件?.[item.名称];
            if(!event||!['待发生','进行中'].includes(event.状态))continue;
            const anchor=eventTimeAnchor(event);
            if(!anchor||VAGUE_EVENT_TIME.test(anchor))missing.push(item.名称);
        }
        if(missing.length)throw new Error('事件时间锚点仍未补全：'+missing.join('、')+'；请逐项补写具体世界日期/时段，或明确相对/因果时间，禁止空值和“近期/稍后/未来/待定/未知”');
    }
    function ensureStaleActiveHandled(next,required=[],worldTime='') {
        const now=worldDateKey(worldTime),state=next?.世界?.[PATH];
        const unresolved=[],resolved=[];
        for(const item of required||[]){
            const event=state?.事件?.[item.名称];
            if(!event)continue;
            if(['已完成','已取消'].includes(event.状态)){resolved.push(item.名称);continue;}
            const updated=worldDateKey(event.更新时间);
            if(event.状态==='进行中'&&updated!==null&&now!==null&&updated===now&&String(event.下次检查||'').trim())continue;
            unresolved.push(item.名称);
        }
        if(unresolved.length)throw new Error('超期活动事件仍未复核：'+unresolved.join('、')+'；局部事件跨越过长时间仍标记进行中，必须结束/取消，或更新到当前时间并填写下次检查');
        // 对“本轮刚刚确认早已结束”的陈旧局部事件绕过24小时展示宽限：
        // 清理人物/地区/传播的软引用；若没有活跃事件继续依赖它，则立即压成历史。
        for(const name of resolved){
            const event=state?.事件?.[name];if(!event)continue;
            detachEventSoftRefs(state,name);
            const hardRef=Object.entries(state.事件||{}).some(([other,record])=>other!==name&&!['已完成','已取消'].includes(record?.状态)&&Array.isArray(record?.前因)&&record.前因.includes(name));
            if(!hardRef)archiveFinishedEvent(next,state,name,event,[]);
        }
    }
    function ensureTemporalAnomaliesResolved(next,required=[]) {
        if(!(required||[]).length)return;
        const remaining=temporalAnomalies(next);
        const keys=new Set((required||[]).map(item=>item.类型+'\u0000'+item.名称));
        const bad=remaining.filter(item=>keys.has(item.类型+'\u0000'+item.名称));
        if(bad.length)throw new Error('时间越界记录仍未修复：'+bad.map(item=>item.类型+'/'+item.名称+'('+item.字段+'='+item.值+')').join('、'));
    }
    function ensureMacroBackbone(next,timeline,required=true) {
        if(!required||!timeline?.需要补充远期)return;
        const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
        const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');
        const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
        const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
        if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');
        const stages=storyStages(next?.世界?.因果轨道?.故事线);
        const names=new Set(allMacro.map(([name])=>name));
        if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
    }

    function progressionAnchorChanged(before,after) {
        return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
    }
    function firstCompleteJsonObject(source) {
        const text=String(source||''),start=text.indexOf('{');
        if(start<0)return '';
        let depth=0,inString=false,escaped=false;
        for(let i=start;i<text.length;i++){
            const ch=text[i];
            if(inString){
                if(escaped)escaped=false;
                else if(ch==='\\')escaped=true;
                else if(ch==='"')inString=false;
                continue;
            }
            if(ch==='"'){inString=true;continue;}
            if(ch==='{')depth++;
            else if(ch==='}'){
                depth--;
                if(depth===0)return text.slice(start,i+1);
                if(depth<0)return '';
            }
        }
        return '';
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
            const candidate=firstCompleteJsonObject(source);
            try {if(!candidate)throw error;result=JSON.parse(candidate);}
            catch(_){throw new Error('返回 JSON 无法解析：'+error.message+'；原始回复保留在请求检查。');}
        }
        if(!plain(result))throw new Error('回复必须是一个 JSON 对象');
        for(const key of ['WorldResult','world_result','world_update','result']){
            if(plain(result[key])&&Object.keys(result).length===1){result=result[key];break;}
        }
        if(Array.isArray(result.patches)&&typeof result.summary==='string'){
            return {kind:'legacy_patches',summary:result.summary,patches:result.patches};
        }
        const worldResult=normalizeWorldResult(result);
        return {kind:'world_result',summary:worldResult.摘要,worldResult};
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
    function omitKeys(value,keys=[]) {
        if(!plain(value))return copy(value);
        const out=copy(value);
        for(const key of keys)delete out[key];
        return out;
    }
    function projectAbilityMap(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item))continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectEquipped(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item)||Number(item.状态)!==1)continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectCarriedItems(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item)||Number(item.状态)===2)continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectForms(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item))continue;
            out[name]=omitKeys(item,['原始属性','最终属性','强化','真属性']);
        }
        return out;
    }
    function projectAuditComponentMap(value,{equipment=false}={}) {
        if(!plain(value))return {};
        const out={};
        for(const [name,item] of Object.entries(value)){
            if(!plain(item))continue;
            if(equipment&&Number(item.状态)===2)continue;
            const clean=omitKeys(item,['最终属性','强化','真属性']);
            if(plain(clean.技能)){
                clean.技能=Object.fromEntries(Object.entries(clean.技能).filter(([,skill])=>plain(skill)).map(([skillName,skill])=>[skillName,omitKeys(skill,['最终属性','强化','真属性'])]));
            }
            out[name]=clean;
        }
        return out;
    }
    function projectCharacterForAudit(value) {
        const source=plain(value)?value:{},out={};
        for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事']){
            if(Object.hasOwn(source,key))out[key]=copy(source[key]);
        }
        const 状态=projectAuditComponentMap(source.状态),血统=projectAuditComponentMap(source.血统),技能=projectAuditComponentMap(source.技能);
        const 装备=projectAuditComponentMap(source.装备,{equipment:true}),形态库=projectAuditComponentMap(source.形态库);
        if(Object.keys(状态).length)out.状态=状态;
        if(Object.keys(血统).length)out.血统=血统;
        if(Object.keys(技能).length)out.技能=技能;
        if(Object.keys(装备).length)out.装备=装备;
        if(Object.keys(形态库).length)out.形态库=形态库;
        if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
        return out;
    }
    function sameWorldTimeAnchor(a,b) {
        const x=String(a||'').trim(),y=String(b||'').trim();if(!x||!y)return false;
        if(x===y)return true;
        const shorter=x.length<=y.length?x:y,longer=x.length<=y.length?y:x;
        return shorter.length>=8&&longer.includes(shorter);
    }
    function npcBuildText(value) {
        try{return JSON.stringify(value||{});}catch(_){return String(value||'');}
    }
    function npcBuildAssessment(stat,name,npc) {
        if(!plain(npc)||Number(npc.HP)<=0)return null;
        const rank=Math.max(0,RELATION_RANKS.indexOf(String(npc.层级||'Ⅰ')));
        const profileText=[...(Array.isArray(npc.身份)?npc.身份:[]),...Object.keys(npc.职业||{}),npc.背景故事,npc.态度].filter(Boolean).join(' ');
        const bossHint=/(?:boss|首领|领主|头目|魔王|王者|宗主|掌门|教皇|最终敌人|最终对手)/i.test(profileText);
        const level=(bossHint||rank>=5)?'首领/Boss级':rank>=2?'精英级':'杂兵级';
        const minimum=level==='首领/Boss级'?{血统:1,装备:3,技能:2}:level==='精英级'?{血统:1,装备:2,技能:1}:{血统:1,装备:1,技能:0};
        const counts={血统:Object.keys(npc.血统||{}).length,装备:Object.values(npc.装备||{}).filter(item=>plain(item)&&Number(item.状态)!==2).length,技能:Object.keys(npc.技能||{}).length,状态:Object.keys(npc.状态||{}).length,形态:Object.keys(npc.形态库||{}).length};
        const gaps=[],suggest=new Set();
        for(const field of ['种族','身份','职业','外貌','着装','性格','喜爱','背景故事','态度']){
            const value=npc[field],missing=Array.isArray(value)?!value.length:plain(value)?!Object.keys(value).length:!String(value||'').trim();
            if(missing){gaps.push('资料缺失/'+field);suggest.add(field);}
        }
        for(const field of ['血统','装备','技能']){
            if(counts[field]<minimum[field]){gaps.push(field+'不足 '+counts[field]+'/'+minimum[field]);suggest.add(field);}
        }
        const combatText=npcBuildText({职业:npc.职业,血统:npc.血统,装备:npc.装备,技能:npc.技能,状态:npc.状态,形态库:npc.形态库});
        if(level!=='杂兵级'){
            const offense=/(?:伤害|攻击|斩|刺|射击|爆破|火力|ATK|MATK|杀伤|输出|毒|灼烧|雷击|炮击)/i.test(combatText);
            const survival=/(?:防御|护盾|减伤|恢复|治疗|格挡|护甲|屏障|再生|吸收|DEF|MDEF|生存)/i.test(combatText);
            const control=/(?:控制|位移|突进|冲刺|束缚|眩晕|减速|沉默|击退|牵引|冻结|召唤|机动|封锁|禁锢)/i.test(combatText);
            if(!offense){gaps.push('缺主要杀伤手段');suggest.add('技能');suggest.add('装备');}
            if(!survival){gaps.push('缺防御/生存手段');suggest.add('技能');suggest.add('装备');suggest.add('状态');}
            if(!control){gaps.push('缺机动/控制手段');suggest.add('技能');suggest.add('形态库');}
        }
        if(level==='首领/Boss级'){
            const stage=counts.形态>0||/(?:阶段|二阶段|变身|形态|解放|觉醒|狂暴|转阶段|状态切换)/i.test(combatText);
            if(!stage){gaps.push('缺Boss阶段/形态/状态变化机制');suggest.add('形态库');suggest.add('状态');suggest.add('技能');}
        }
        return {名称:name,审计级别:level,层级:String(npc.层级||'Ⅰ'),当前组件:counts,缺口:gaps,建议字段:Array.from(suggest),当前构筑:projectCharacterForAudit(npc)};
    }
    function npcBuildAudit(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
        const relations=stat?.关系列表||{},backend=stat?.世界?.[PATH]||{},people=backend.人物||{},events=backend.事件||{},roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
        const currentLocation=String(stat?.世界?.地点||''),worldTime=String(stat?.世界?.时间||'');
        const activeEventNames=new Set(Object.entries(events).filter(([,e])=>e&&['待发生','进行中'].includes(e.状态)&&['当前事件','近期节点'].includes(e.分类)).map(([eventName])=>eventName));
        const currentParticipants=new Set();
        for(const [eventName,event] of Object.entries(events)){
            if(!activeEventNames.has(eventName))continue;
            for(const p of event?.参与者||[])currentParticipants.add(nameKey(p));
        }
        const rows=[];
        for(const [name,npc] of Object.entries(relations)){
            const assessment=npcBuildAssessment(stat,name,npc);if(!assessment||!assessment.缺口.length)continue;
            const backendName=stableNameIn(people,name),person=backendName?people[backendName]:null;
            const alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
            const activeAlien=!!(alien&&alien.状态!=='死亡');
            const linked=!!(person&&(person.关联事件||[]).some(eventName=>activeEventNames.has(eventName)))||currentParticipants.has(nameKey(name));
            const here=!!npc.在场||!!(person&&currentLocation&&String(person.地点||'')&&(String(person.地点).includes(currentLocation)||currentLocation.includes(String(person.地点))));
            const updated=!!(person&&sameWorldTimeAnchor(person.更新时间,worldTime));
            if(!activeAlien&&!linked&&!here&&!updated)continue;
            const reasons=[];
            if(activeAlien)reasons.push('活跃异端');
            if(linked)reasons.push('当前/近期事件参与者');
            if(here)reasons.push(npc.在场?'当前在场':'当前地点相关');
            if(updated)reasons.push('本轮人物动态已更新');
            const levelWeight=assessment.审计级别==='首领/Boss级'?40:assessment.审计级别==='精英级'?20:0;
            const priority=(activeAlien?80:0)+(linked?60:0)+(here?40:0)+(updated?20:0)+levelWeight+assessment.缺口.length;
            rows.push({...assessment,触发依据:reasons,__priority:priority});
        }
        return rows.sort((a,b)=>b.__priority-a.__priority||a.名称.localeCompare(b.名称,'zh-CN')).slice(0,Math.max(0,Number(limit)||0)).map(item=>{const out={...item};delete out.__priority;return out;});
    }
    function ensureNpcBuildAuditProgress(next,required=[],acceptedResult) {
        if(!(required||[]).length)return;
        const proposals=acceptedResult?.关系||[],failed=[];
        for(const before of required){
            const target=stableNameIn(next?.关系列表||{},before.名称);
            if(!target)continue;
            const after=npcBuildAssessment(next,target,next.关系列表[target]);
            if(!after)continue;
            const proposal=proposals.find(item=>nameKey(item.名称)===nameKey(before.名称));
            const touched=proposal&&before.建议字段.some(field=>Object.hasOwn(proposal,field));
            if(!touched||after.缺口.length>=before.缺口.length)failed.push(before.名称);
        }
        if(failed.length)throw new Error('NPC构筑审计未推进：'+failed.join('、')+'；每个列出的审计对象本轮至少补齐一个真实缺口，禁止只改好感、HP或无关字段');
    }

    function projectCharacterForWorld(value) {
        const source=plain(value)?value:{},out={};
        for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事','数量']){
            if(Object.hasOwn(source,key))out[key]=copy(source[key]);
        }
        const 状态=projectAbilityMap(source.状态),血统=projectAbilityMap(source.血统),技能=projectAbilityMap(source.技能);
        const 装备=projectEquipped(source.装备),道具=projectCarriedItems(source.道具),形态库=projectForms(source.形态库);
        if(Object.keys(状态).length)out.状态=状态;
        if(Object.keys(血统).length)out.血统=血统;
        if(Object.keys(技能).length)out.技能=技能;
        if(Object.keys(装备).length)out.装备=装备;
        if(Object.keys(道具).length)out.道具=道具;
        if(Object.keys(形态库).length)out.形态库=形态库;
        if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
        return out;
    }
    function projectAssetsForWorld(value) {
        if(!plain(value))return {};
        const out={};
        for(const [name,asset] of Object.entries(value)){
            if(!plain(asset))continue;
            const item=copy(asset);
            if(plain(item.建设序列)){
                for(const seq of Object.values(item.建设序列||{})){
                    if(!plain(seq))continue;
                    delete seq.下次产出日期;
                    delete seq.下次产出游天;
                }
            }
            out[name]=item;
        }
        return out;
    }
    function tailRecord(value,limit) {
        if(!plain(value))return {};
        return Object.fromEntries(Object.entries(value).slice(-Math.max(0,Number(limit)||0)).map(([key,item])=>[key,copy(item)]));
    }
    function projectCausalOrbitForWorld(value,currentStability) {
        const orbit=plain(value)?value:{},entries=Object.entries(orbit.偏移记录||{});
        const recent=entries.slice(-HOT_OFFSET_TARGET);
        const total=entries.reduce((sum,[,item])=>sum+(Number(item?.影响程度)||0),0);
        return {
            当前阶段:orbit.当前阶段,
            故事线:orbit.故事线,
            下一节点:orbit.下一节点,
            偏移记录:Object.fromEntries(recent.map(([name,item])=>[name,copy(item)])),
            偏移摘要:{
                记录总数:entries.length,
                隐藏旧记录数:Math.max(0,entries.length-recent.length),
                累计影响:total,
                当前稳定:currentStability
            }
        };
    }
    function projectWorldContext(stat) {
        const src=plain(stat)?stat:{},world=plain(src.世界)?src.世界:{},backend=plain(world[PATH])?world[PATH]:{};
        const projectedBackend={
            版本:backend.版本,
            已处理时间:backend.已处理时间,
            事件:copy(backend.事件||{}),
            人物:projectHotWorldPeople(src),
            势力地区:copy(backend.势力地区||{}),
            历史:tailRecord(backend.历史,HOT_HISTORY_TARGET),
            传播:tailRecord(backend.传播,HOT_PROPAGATION_TARGET)
        };
        // 旧档中可能仍有事件→任务引用；后台不再消费任务数据。
        for(const event of Object.values(projectedBackend.事件))if(plain(event))delete event.关联任务;
        // 早期世界引擎曾误加地区“资源点”。保留旧存档兼容，但不再发送给模型；资产只读取现有顶层资产账簿。
        for(const area of Object.values(projectedBackend.势力地区||{}))if(plain(area))delete area.资源点;
        const out={
            世界:{
                时间:world.时间,
                地点:world.地点,
                名称:world.名称,
                位格:world.位格,
                难度:world.难度,
                稳定:world.稳定,
                法则:copy(world.法则||[]),
                货币:copy(world.货币||{}),
                历法:copy(world.历法||{}),
                探索:copy(world.探索||{}),
                势力:copy(world.势力||{}),
                因果轨道:projectCausalOrbitForWorld(world.因果轨道,world.稳定),
                异端雷达:copy(world.异端雷达||{}),
                [PATH]:projectedBackend
            },
            角色:projectCharacterForWorld(src.角色),
            关系列表:{},
            资产:projectAssetsForWorld(src.资产),
            资产删除保护:Object.keys(backend.资产墓碑||{}).filter(name=>!stableNameIn(src.资产||{},name)).slice(-50),
            传闻:copy(src.传闻||{}),
            系统状态:{
                是否战斗中:!!src.系统状态?.是否战斗中,
                是否在主神空间:!!src.系统状态?.是否在主神空间
            },
            世界模式:{
                单一世界:!!src.设置?.单一世界,
                世界超稳:!!src.设置?.世界超稳
            }
        };
        for(const [name,person] of Object.entries(src.关系列表||{}))out.关系列表[name]=projectCharacterForWorld(person);
        if(!Object.keys(out.角色||{}).length)delete out.角色;
        if(!Object.keys(out.关系列表).length)delete out.关系列表;
        if(!Object.keys(out.资产).length)delete out.资产;
        if(!out.资产删除保护.length)delete out.资产删除保护;
        if(!Object.keys(out.传闻).length)delete out.传闻;
        return out;
    }
    function protocol() {
        const schemaText=JSON.stringify(WORLD_RESULT_SCHEMA,null,2);
        return `只输出一个 WorldResult JSON 对象；不要输出 Markdown、解释、思考过程、<thinking> 或 JSON Pointer。
省略业务字段表示无变化；已有实体只写本轮变化字段，新增实体写足以建立该实体的确定事实；实体用“名称”关联。
“操作”默认“更新”；“移除”只用于 Schema 允许删除的记录；“撤销本轮”只用于纠错重试。
字段语义遵循【世界引擎核心约束】；字段结构和值域只以以下 Schema 为准。WorldResult 之外的任务、世界时间、玩家属性/货币/击杀等不要输出。
关系只更新已存在的关系列表对象；不得为玩家建立后台人物记录。

【Canonical WorldResult JSON Schema】
${schemaText}`;
    }
    const NPC_BUILD_AUDIT_RULES=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度或重做角色。
1. 不改人物层级、HP_MAX/EP_MAX；不覆盖已完整组件，不用改名制造重复能力。
2. 最低构筑：杂兵=血统1/装备1/技能可0；精英=血统1/装备2/技能1；Boss=血统1/装备3/技能2；上限为血统2/装备6/技能4。精英需有杀伤、生存、机动/控制，Boss另有阶段或形态机制。
3. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
4. 只用 WorldResult.关系 更新既有 NPC；只提交新增/修正项。不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
5. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、层级和已演出能力一致的缺口，资料不足时做最小补全。`;    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';
            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastAttemptTelemetry=[]; this.lastTransportInfo=null; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];
            this.config = {
                enabled:false,
                preset:DEFAULT_PRESET,
                retryAttempts:3,
                requireMacroBackbone:true,
                presetEditorVersion:0,
                promptDocuments:[],
                fontScale:'standard',
                dedicatedApi:{enabled:false,apiUrl:'',apiKey:'',model:'',apiPresets:[],fetchedModels:[]}
            };
            try { Object.assign(this.config, JSON.parse(host.localStorage.getItem(CONFIG) || '{}')); } catch (_) {}
            const hadLegacyTone=Object.hasOwn(this.config,'tone');
            delete this.config.tone;
            if(Number(this.config.presetEditorVersion||0)<2)this.config.preset=ensurePresetStructure(this.config.preset);
            else this.config.preset=normalizeEditablePreset(this.config.preset);
            this.config.presetEditorVersion=2;
            if(!Array.isArray(this.config.promptDocuments))this.config.promptDocuments=[];
            this.config.promptDocuments=this.config.promptDocuments
                .filter(doc=>plain(doc)&&typeof doc.name==='string'&&plain(doc.settings)&&typeof doc.settings.preset==='string'&&doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id&&doc.name!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)
                .slice(0,58);
            // 旧版“保存为默认设置”曾直接覆盖内置默认。v3 起把这份本地内容迁移为独立个人文档，
            // 内置“默认设置”始终绑定代码中的最新 DEFAULT_PRESET，不再被 localStorage 遮蔽。
            if(plain(this.config.userDefaultPromptSettings)&&typeof this.config.userDefaultPromptSettings.preset==='string'){
                const legacySettings={
                    structurePrompt:typeof this.config.userDefaultPromptSettings.structurePrompt==='string'?this.config.userDefaultPromptSettings.structurePrompt:undefined,
                    preset:normalizeEditablePreset(this.config.userDefaultPromptSettings.preset),
                    contextTurns:Math.max(1,Math.min(100,Number(this.config.userDefaultPromptSettings.contextTurns)||3)),
                    activationMode:this.config.userDefaultPromptSettings.activationMode==='force_selected'?'force_selected':'respect_activation',
                    selectedEntries:Array.isArray(this.config.userDefaultPromptSettings.selectedEntries)?copy(this.config.userDefaultPromptSettings.selectedEntries):null
                };
                const personal=this.config.promptDocuments.find(doc=>doc.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                if(!personal)this.config.promptDocuments.unshift({id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,name:'个人默认设置',createdAt:'',updatedAt:'',settings:copy(legacySettings)});
            }
            this.config.promptDocuments=this.config.promptDocuments.filter(doc=>doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id).slice(0,59);
            this.config.promptDocuments.unshift(copy(BUILTIN_DEFAULT_PROMPT_DOCUMENT));
            {
                const appliedVersion=Number(this.config.builtinDefaultPromptVersionApplied||0);
                if(appliedVersion<BUILTIN_DEFAULT_PROMPT_VERSION){
                    // 首次安装自动应用；已在使用内置默认的用户随版本升级。
                    // 自定义文档/个人默认不会被强制覆盖，但内置默认文档本身始终升级到最新代码模板。
                    const shouldApply=appliedVersion===0||this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                    if(shouldApply){
                        const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;
                        this.config.structurePrompt=settings.structurePrompt;
                        this.config.preset=normalizeEditablePreset(settings.preset);
                        this.config.presetEditorVersion=2;
                        this.config.contextTurns=settings.contextTurns;
                        this.config.activationMode=settings.activationMode;
                        this.config.selectedEntries=copy(settings.selectedEntries);
                        this.config.activePromptDocumentId=BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                        this.config.builtinDefaultWorldbookExclusionsApplied=[];
                    }
                    this.config.builtinDefaultPromptVersionApplied=BUILTIN_DEFAULT_PROMPT_VERSION;
                    this.saveConfig();
                }
            }
            {
                const retryLimit=Number(this.config.retryAttempts);
                this.config.retryAttempts=Math.max(1,Math.min(5,Number.isFinite(retryLimit)?retryLimit:3));
            }
            if(!Object.hasOwn(this.config,'requireMacroBackbone'))this.config.requireMacroBackbone=true;
            if(!['standard','large','xlarge'].includes(this.config.fontScale))this.config.fontScale='standard';
            this.config.dedicatedApi=this.normalizeDedicatedApi(this.config.dedicatedApi);
            this.apiModeCache={};
            if(hadLegacyTone)this.saveConfig();
            if(this.config.enabled&&!this.usesDedicatedApi()){
                const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            }
        }
        fn(name) {
            for (const obj of [this.env, this.host, this.host.TavernHelper]) if (obj && typeof obj[name] === 'function') return obj[name].bind(obj);
            return null;
        }
        notifyFailure(message) {
            const raw=String(message||'世界推进失败').trim();
            if(!raw||/^(?:请求已取消|上下文已经切换|已切换上下文)/.test(raw))return false;
            const shown=raw.length>900?raw.slice(0,897)+'…':raw;
            const toast=(this.host&&this.host.toastr)||(this.env&&this.env.toastr)||(this.host&&this.host.parent&&this.host.parent.toastr);
            if(toast&&typeof toast.error==='function'){
                try{toast.error(shown,'世界推进失败');return true;}catch(_){}
            }
            try{console.error('[世界推进] '+shown);}catch(_){}
            return false;
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
        saveConfig() {
            try{this.host.localStorage?.setItem?.(CONFIG,JSON.stringify(this.config));}catch(_){}
        }
        normalizeDedicatedApi(value) {
            const api=plain(value)?value:{};
            return {
                enabled:api.enabled===true,
                apiUrl:String(api.apiUrl||'').trim(),
                apiKey:String(api.apiKey||''),
                model:String(api.model||'').trim(),
                apiPresets:Array.isArray(api.apiPresets)?api.apiPresets.filter(plain).map(p=>({
                    name:String(p.name||'').trim().slice(0,80),
                    apiUrl:String(p.apiUrl||'').trim(),
                    apiKey:String(p.apiKey||''),
                    model:String(p.model||'').trim()
                })).filter(p=>p.name).slice(0,30):[],
                fetchedModels:Array.isArray(api.fetchedModels)?api.fetchedModels.map(String).filter(Boolean).slice(0,500):[]
            };
        }
        usesDedicatedApi() { return this.config.dedicatedApi?.enabled===true; }
        dedicatedApiReady() {
            const api=this.config.dedicatedApi||{};
            return api.enabled===true&&!!String(api.apiUrl||'').trim()&&!!String(api.model||'').trim();
        }
        apiSourceLabel() { return this.usesDedicatedApi()?'世界推进专属 API':'主神终端额外模型'; }
        setDedicatedApi(patch) {
            const current=this.normalizeDedicatedApi(this.config.dedicatedApi);
            const next=this.normalizeDedicatedApi(Object.assign({},current,plain(patch)?patch:{}));
            if(patch&&Object.hasOwn(patch,'apiUrl')&&String(patch.apiUrl||'').trim()!==current.apiUrl)next.fetchedModels=[];
            this.config.dedicatedApi=next;
            this.saveConfig();
            return next;
        }
        saveDedicatedApiPreset(name) {
            const clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请输入 API 预设名称');
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
            const entry={name:clean,apiUrl:api.apiUrl,apiKey:api.apiKey,model:api.model};
            const idx=api.apiPresets.findIndex(p=>p.name===clean);
            if(idx>=0)api.apiPresets[idx]=entry;else api.apiPresets.unshift(entry);
            api.apiPresets=api.apiPresets.slice(0,30);
            this.config.dedicatedApi=api;this.saveConfig();return entry;
        }
        deleteDedicatedApiPreset(name) {
            const clean=String(name||'').trim(),api=this.normalizeDedicatedApi(this.config.dedicatedApi);
            const before=api.apiPresets.length;api.apiPresets=api.apiPresets.filter(p=>p.name!==clean);
            this.config.dedicatedApi=api;this.saveConfig();return before!==api.apiPresets.length;
        }
        applyDedicatedApiPreset(name) {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi),preset=api.apiPresets.find(p=>p.name===String(name||''));
            if(!preset)throw new Error('API 预设不存在');
            api.apiUrl=preset.apiUrl;api.apiKey=preset.apiKey;api.model=preset.model;api.fetchedModels=[];
            this.config.dedicatedApi=api;this.saveConfig();return api;
        }
        dedicatedEndpoint(kind='chat') {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
            let endpoint=String(api.apiUrl||'').trim().replace(/\/+$/,'');
            if(!endpoint)throw new Error('请先填写专属 API 地址');
            if(kind==='models'){
                if(/\/chat\/completions$/i.test(endpoint))endpoint=endpoint.replace(/\/chat\/completions$/i,'/models');
                else if(/\/v1$/i.test(endpoint))endpoint+='/models';
                else if(/\/v1\//i.test(endpoint))endpoint=endpoint.replace(/\/v1\/.*$/i,'/v1/models');
                else endpoint+=/\/v\d+$/i.test(endpoint)?'/models':'/v1/models';
                return endpoint;
            }
            if(/\/chat\/completions$/i.test(endpoint))return endpoint;
            if(/\/v1$/i.test(endpoint))return endpoint+'/chat/completions';
            if(/\/v1\//i.test(endpoint))return endpoint.replace(/\/v1\/.*$/i,'/v1/chat/completions');
            return endpoint+(/\/v\d+$/i.test(endpoint)?'/chat/completions':'/v1/chat/completions');
        }
        async fetchDedicatedModels() {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi),fetcher=this.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const headers={};if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const response=await fetcher(this.dedicatedEndpoint('models'),{headers});
            if(!response.ok){
                let body='';try{body=await response.text();}catch(_){}
                throw new Error('加载模型失败：HTTP '+response.status+(body?' / '+body.slice(0,240):''));
            }
            const body=await response.json();
            const raw=Array.isArray(body?.data)?body.data:Array.isArray(body?.models)?body.models:[];
            const models=raw.map(item=>typeof item==='string'?item:item?.id||item?.name).filter(Boolean).map(String);
            if(!models.length)throw new Error('API 返回的模型列表为空');
            api.fetchedModels=Array.from(new Set(models)).sort().slice(0,500);
            if(api.model&&!api.fetchedModels.includes(api.model))api.fetchedModels.unshift(api.model);
            this.config.dedicatedApi=api;this.saveConfig();return api.fetchedModels;
        }
        structuredUnsupported(status,body) {
            const code=Number(status),text=String(body||'');
            return [400,404,415,422].includes(code)&&/response[_ -]?format|json[_ -]?schema|json[_ -]?object|unknown (?:field|parameter)|unrecognized|unsupported|not supported|invalid.*schema|INVALID_ARGUMENT|invalid[_ -]?argument/i.test(text);
        }
        async requestDedicatedApi(system,input,options={}) {
            const api=this.normalizeDedicatedApi(this.config.dedicatedApi),fetcher=this.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!this.dedicatedApiReady())throw new Error('世界推进专属 API 已启用，但地址或模型未配置完整');
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const endpoint=this.dedicatedEndpoint('chat'),headers={'Content-Type':'application/json'};
            if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const cacheKey=endpoint+'|'+api.model,wants=options.structured==='auto'&&plain(options.schema);
            const cached=wants?this.apiModeCache[cacheKey]:'';
            const modes=!wants?['plain']:cached==='json_schema'?['json_schema','json_object','plain']:cached==='json_object'?['json_object','plain']:cached==='plain'?['plain']:['json_schema','json_object','plain'];
            let lastError='';const modeAttempts=[];
            for(const mode of modes){
                modeAttempts.push(mode);
                const body={
                    model:api.model,
                    messages:[{role:'system',content:String(system||'')},{role:'user',content:String(input||'')}],
                    stream:false,
                    temperature:Number.isFinite(Number(options.temperature))?Number(options.temperature):0.3
                };
                if(mode==='json_schema')body.response_format={type:'json_schema',json_schema:{name:String(options.schemaName||'samsara_world_result').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64),strict:false,schema:options.schema}};
                else if(mode==='json_object')body.response_format={type:'json_object'};
                const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:options.signal});
                if(!response.ok){
                    let err='';try{err=await response.text();}catch(_){}
                    lastError='HTTP '+response.status+': '+response.statusText+(err?' / '+err.slice(0,300):'');
                    if(mode!=='plain'&&this.structuredUnsupported(response.status,err)){delete this.apiModeCache[cacheKey];continue;}
                    this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:null};
                    throw new Error(lastError);
                }
                const data=await response.json(),message=data?.choices?.[0]?.message;
                const raw=message?.content;
                const content=typeof raw==='string'?raw:(plain(raw)?JSON.stringify(raw):message?.parsed?JSON.stringify(message.parsed):'');
                if(!content)throw new Error('专属 API 返回内容为空');
                if(wants)this.apiModeCache[cacheKey]=mode;
                this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:normalizeTokenUsage(data?.usage)};
                return content;
            }
            throw new Error(lastError||'专属 API 不支持当前结构化输出模式');
        }
        async requestAI(system,input,options={}) {
            if(this.usesDedicatedApi()){
                const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
                this.lastTransportInfo={接口:'世界推进专属 API',模型:api.model,结构化模式:'请求中',尝试模式:[],usage:null};
                return this.requestDedicatedApi(system,input,options);
            }
            const terminal=this.host.Samsara&&this.host.Samsara.terminal;
            if(!terminal||typeof terminal.request!=='function'||!terminal.apiReady?.())throw new Error('请在主神终端设置中启用额外模型并选择模型');
            this.lastTransportInfo={接口:'主神终端额外模型',模型:'',结构化模式:options.structured==='auto'?'auto（由主神终端协商）':'plain',尝试模式:[],usage:null};
            return terminal.request(system,input,options);
        }
        setPreset(text) {
            if (typeof text !== 'string' || text.length > 30000) throw new Error('预设限30000字');
            this.config.preset = normalizeEditablePreset(text);
            this.config.presetEditorVersion=2;
            this.saveConfig();
        }
        readPromptEditor() {
            const panel=this.panel;
            const list=panel&&panel.querySelector('[data-segment-list]');
            const rows=list?Array.from(list.querySelectorAll('[data-segment-row]')):[];
            const preset=list?rows.map(row=>segmentText({
                title:row.querySelector('[data-segment-title]')?.value||'',
                body:row.querySelector('[data-segment]')?.value||''
            })).filter(Boolean).join('\n'):this.config.preset;
            const floors=panel&&panel.querySelector('[data-floors]');
            const activation=panel&&panel.querySelector('[data-activation]');
            const books=panel?Array.from(panel.querySelectorAll('[data-book]')):[];
            return {
                preset,
                structurePrompt:panel?.querySelector('[data-structure-prompt]')?.value??this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim(),
                contextTurns:Math.max(1,Math.min(100,Number(floors?.value??this.config.contextTurns)||6)),
                activationMode:activation?.value||this.config.activationMode||'respect_activation',
                selectedEntries:books.length
                    ?books.filter(e=>e.checked&&!e.disabled).map(e=>e.value)
                    :(Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):null)
            };
        }
        applyPromptSettings(settings) {
            if(!plain(settings)||typeof settings.preset!=='string'||settings.preset.length>30000)throw new Error('预设文档内容无效或超过30000字');
            if(settings.structurePrompt!==undefined&&(typeof settings.structurePrompt!=='string'||settings.structurePrompt.length>30000))throw new Error('结构提示词限30000字');
            this.config.structurePrompt=settings.structurePrompt;
            this.config.preset=normalizeEditablePreset(settings.preset);
            this.config.presetEditorVersion=2;
            this.config.contextTurns=Math.max(1,Math.min(100,Number(settings.contextTurns)||6));
            this.config.activationMode=settings.activationMode==='force_selected'?'force_selected':'respect_activation';
            if(Array.isArray(settings.selectedEntries))this.config.selectedEntries=settings.selectedEntries.filter(x=>typeof x==='string');
            else delete this.config.selectedEntries;
            this.saveConfig();
            return this.config;
        }
        getPromptDocuments() {
            if(!Array.isArray(this.config.promptDocuments))this.config.promptDocuments=[];
            return this.config.promptDocuments;
        }
        savePromptDocument(name,settings,activate=true) {
            const clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请先填写预设文档名称');
            if(clean===BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)throw new Error('“默认设置”是内置文档，请换一个名称保存自定义版本');
            const docs=this.getPromptDocuments(),now=new Date().toISOString();
            let doc=docs.find(item=>!item.builtin&&item.id===this.config.activePromptDocumentId&&item.name===clean)||docs.find(item=>!item.builtin&&item.name===clean);
            if(doc){
                doc.name=clean;doc.updatedAt=now;doc.settings=copy(settings);
            }else{
                doc={id:'prompt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:clean,createdAt:now,updatedAt:now,settings:copy(settings)};
                docs.unshift(doc);
            }
            this.config.promptDocuments=docs.slice(0,60);
            if(activate)this.config.activePromptDocumentId=doc.id;
            this.saveConfig();
            return doc;
        }
        deletePromptDocument(id) {
            if(id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)return false;
            const before=this.getPromptDocuments().length;
            this.config.promptDocuments=this.getPromptDocuments().filter(doc=>doc.id!==id);
            if(this.config.activePromptDocumentId===id)delete this.config.activePromptDocumentId;
            this.saveConfig();
            return before!==this.config.promptDocuments.length;
        }
        importPromptDocument(raw) {
            let parsed;try{parsed=JSON.parse(String(raw||''));}catch(_){throw new Error('导入文件不是有效 JSON');}
            const settings=plain(parsed.settings)?parsed.settings:parsed;
            if(typeof settings.preset!=='string')throw new Error('导入文件缺少 preset');
            if(settings.preset.length>30000)throw new Error('导入预设超过30000字');
            const name=String(parsed.name||settings.name||'导入预设').trim().slice(0,80)||'导入预设';
            const normalized={
                structurePrompt:typeof settings.structurePrompt==='string'?settings.structurePrompt:undefined,
                preset:normalizeEditablePreset(settings.preset),
                contextTurns:Math.max(1,Math.min(100,Number(settings.contextTurns)||6)),
                activationMode:settings.activationMode==='force_selected'?'force_selected':'respect_activation',
                selectedEntries:Array.isArray(settings.selectedEntries)?settings.selectedEntries.filter(x=>typeof x==='string'):null
            };
            return this.savePromptDocument(name,normalized,false);
        }
        exportPromptDocument(id) {
            const doc=this.getPromptDocuments().find(item=>item.id===id);
            if(!doc)throw new Error('预设文档不存在');
            const BlobCtor=this.host.Blob||(typeof Blob!=='undefined'?Blob:null);
            const URLApi=this.host.URL||(typeof URL!=='undefined'?URL:null);
            if(!BlobCtor||!URLApi?.createObjectURL)throw new Error('当前环境不支持文件导出');
            const payload={type:'samsara-world-prompt-document',version:1,name:doc.name,exportedAt:new Date().toISOString(),settings:copy(doc.settings)};
            const blob=new BlobCtor([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
            const href=URLApi.createObjectURL(blob),a=this.host.document.createElement('a');
            a.href=href;a.download=doc.name.replace(/[\\/:*?"<>|]+/g,'_')+'.world-prompt.json';a.style.display='none';
            this.host.document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URLApi.revokeObjectURL(href),1000);
        }
        isConfigured() { return !!this.config.enabled; }
        isAvailable() {
            if(this.usesDedicatedApi())return this.dedicatedApiReady();
            const terminal=this.host.Samsara&&this.host.Samsara.terminal;
            return !!(terminal&&typeof terminal.apiReady==='function'&&terminal.apiReady());
        }
        isEnabled() { return this.isConfigured()&&this.isAvailable(); }
        setEnabled(value) {
            const on=!!value;
            this.config.enabled=on;
            if(on&&!this.usesDedicatedApi()){
                const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            } else if(!on) {
                this.cancel();
                if(this.isOpen())this.close();
            }
            this.saveConfig();
            this.status=on?(this.isAvailable()?'世界推进已开启':(this.usesDedicatedApi()?'世界推进已开启 · 等待专属 API 配置':'世界推进已开启 · 等待额外模型配置')):'世界推进已关闭';
            this.render();
            return this.isEnabled();
        }
        cancel() { ++this.generation; this.pending = false; clearTimeout(this.timer); if (this.controller) this.controller.abort(); }
        applyBuiltinDefaultWorldbookExclusions(catalogue) {
            if(this.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id||!Array.isArray(catalogue)||!catalogue.length)return false;
            const applied=new Set(Array.isArray(this.config.builtinDefaultWorldbookExclusionsApplied)?this.config.builtinDefaultWorldbookExclusionsApplied:[]);
            let selected=Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):[];
            let progressed=false,changed=false;
            for(const title of BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS){
                if(applied.has(title))continue;
                const matches=catalogue.filter(entry=>normalizeWorldbookEntryTitle(entry.title)===title);
                if(!matches.length)continue;
                const before=selected.length;
                selected=selected.filter(raw=>!matches.some(entry=>selectedEntryMatches(entry,[raw])));
                applied.add(title);progressed=true;
                if(selected.length!==before)changed=true;
            }
            if(!progressed)return false;
            this.config.selectedEntries=selected;
            this.config.builtinDefaultWorldbookExclusionsApplied=Array.from(applied);
            const builtin=this.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id);
            if(builtin?.settings)builtin.settings.selectedEntries=copy(selected);
            this.saveConfig();
            return changed;
        }
        async catalogue() {
            const get=this.fn('getWorldbook');
            if(!get)return [];
            const sources=new Map(),addSource=(book,label)=>{
                const name=String(book||'').trim();if(!name)return;
                if(!sources.has(name))sources.set(name,new Set());
                sources.get(name).add(label);
            };
            const namesFn=this.fn('getCharWorldbookNames');
            if(namesFn){
                const names=await namesFn('current')||{};
                addSource(names.primary,'角色主书');
                for(const book of names.additional||[])addSource(book,'角色附加');
            }
            const chatFn=this.fn('getChatWorldbookName');
            if(chatFn){
                try{addSource(await chatFn('current'),'聊天绑定');}catch(_){}
            }
            const globalFn=this.fn('getGlobalWorldbookNames');
            if(globalFn){
                try{for(const book of await globalFn()||[])addSource(book,'全局启用');}catch(_){}
            }
            const result=[];
            for(const [book,labels] of sources){
                const entries=await get(book)||[];
                entries.forEach((e,i)=>{
                    const title=e.name||e.comment||'未命名';
                    result.push({
                        book,id:String(e.uid??e.id??i),title,sources:Array.from(labels),
                        technical:isTechnicalBook(title),enabled:e.enabled!==false&&!e.disable&&!e.disabled,
                        mode:e.strategy?.type||e.type||(e.constant===false?'selective':'constant'),
                        keys:e.strategy?.keys||e.keys||e.key||[],
                        secondary:e.strategy?.keys_secondary||e.keys_secondary||e.secondary_keys||{},
                        content:e.content||''
                    });
                });
            }
            this.applyBuiltinDefaultWorldbookExclusions(result);
            return result;
        }
        async worldbook(scan='', options={}) {
            const catalogue=await this.catalogue(),output=[];
            this.bookCatalogue=catalogue;
            const report=[];this.readReport=report;
            for(const e of catalogue){
                const selected=!e.technical&&selectedEntryMatches(e,this.config.selectedEntries);
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
            const structuralFixes=normalizeEventLayers(state);
            const lifecycle=compactWorldLifecycle(state);
            const alienActivity=activeAlienActivityRequirements(state);
            const seedPatches=importStory(state);
            // 缺少后台人物的活跃异端只在本次请求副本中放一个空壳，帮助模型明确这是待补活动；
            // 不把空壳作为正式 seed patch，避免与本轮模型真正创建的人物记录发生 add/add 冲突。
            seedMissingAlienPeople(state,alienActivity);
            for(const patch of seedPatches){const parts=tokens(patch.path);if(parts[2]==='事件')state.世界[PATH].事件[parts.at(-1)]=patch.value;}
            structuralFixes.push(...normalizeEventLayers(state));
            structuralFixes.push(...repairCausalProjection(state));
            structuralFixes.push(...repairMacroPredecessors(state));
            structuralFixes.push(...repairExplicitEventLinks(state));
            if(state.设置)delete state.设置.API;
            delete state.商城;
            // 旧剧本数据只为兼容存档保留，不进入新世界调度请求。
            state.世界[PATH].剧本={};
            const count=Math.max(1,Math.min(100,Number(this.config.contextTurns)||6));
            const id=Number(base.message.message_id??base.message.id);
            // 先清洗所有历史候选，再取最近 N 条非空正文；技术楼层再多也不会挤掉正文名额。
            const messages=await this.fn('getChatMessages')('0-'+id);
            const isAssistant=m=>{
                const role=String(m?.role||'').toLowerCase();
                if(!m||m.is_hidden||m.is_user===true||role==='user'||role==='system')return false;
                return role==='assistant'||!role;
            };
            const floors=messages.filter(m=>Number(m.message_id??m.id)<=id&&isAssistant(m))
                .sort((a,b)=>Number(a.message_id??a.id)-Number(b.message_id??b.id))
                .map(m=>({楼层:m.message_id??m.id,角色:'assistant',正文:extractWorldProse(m.message??m.mes??'')}))
                .filter(f=>f.正文).slice(-count);
            if(!floors.length)throw new Error('未读到可用AI正文：楼层为空或仅含思考、变量更新与面板，请检查聊天内容');
            const timeline=timelineState(state);
            const needBackbone=timeline.需要初始化||timeline.需要补充远期;
            const proseScan=floors.map(f=>f.正文).join('\n');
            const chronologyScan=needBackbone?[state.世界.名称,'原著','时间线','时间轴','年表','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' '):'';
            const books=await this.worldbook([proseScan,chronologyScan].filter(Boolean).join('\n'),{timelineBackbone:needBackbone});
            const now=worldDateKey(state.世界.时间);
            const due=Object.entries(state.世界[PATH].事件).filter(([,e])=>e.状态==='待发生'&&now!==null&&worldDateKey(e.时间||e.开始时间)!==null&&worldDateKey(e.时间||e.开始时间)<=now).map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因,说明:'时间已到；逐项核验条件与前因，符合则转进行中；未符合必须更新下次检查并解释阻碍，不得无声跳过。'}));
            const unscheduled=unscheduledEvents(state);
            const staleActive=staleActiveEvents(state);
            const timeAnomalies=temporalAnomalies(state);
            const capacity=worldTimeCapacity(state.世界[PATH].已处理时间,state.世界.时间);
            const npcAudit=npcBuildAudit(state);
            const input=JSON.stringify({
                输入语义:{
                    世界书:'可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。',
                    当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期历史与近期因果偏移。资产通过WorldResult.资产与同一顶层账簿双向同步；旧历史/旧偏移仍可留在MVU冷存档但默认不进入本轮上下文。未提供的任务/商城/纯结算数据不属于本引擎职责。',
                    正文楼层:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。',
                    程序结构修复:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。',
                    时间线调度:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。',
                    WorldResult:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。',
                    角色管理:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。'
                },
                世界书:books.map(b=>String(b.内容||'')).filter(Boolean),
                当前变量:projectWorldContext(state),
                角色管理:npcAudit.length?{NPC构筑审计:npcAudit}:undefined,
                正文楼层:floors,
                程序结构修复:structuralFixes,
                本轮时间容量:capacity,
                时间线调度:timeline,
                推演阶段:{宏观优先:true,宏观骨架状态:needBackbone?'需要建立或补足':'已具备可用宏观骨架',近期细节边界:timeline.下一宏观节点?.名称||'先建立下一宏观节点',知识来源:'当前确认事实 > 明确世界书设定（若有） > 模型已有原著/世界知识 > 谨慎推断'},
                正文可见投影规则:{
                    当前时间:state.世界.时间,
                    当前地点:state.世界.地点,
                    要求:'非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。'
                },
                可选宏观资料补充:needBackbone,
                本轮必须复核的到期事件:due,
                本轮必须补全的事件时间锚点:unscheduled,
                本轮必须复核的超期活动事件:staleActive,
                本轮必须修复的时间越界记录:timeAnomalies,
                本轮必须维持的异端活动:alienActivity,
                生命周期整理:lifecycle,
                说明:'当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。'
            },null,2);
            const system=this.config.preset+'\n\n'+CORE_WORLD_RULES+(npcAudit.length?'\n\n'+NPC_BUILD_AUDIT_RULES:'')+'\n\n【WorldResult 业务输出协议】\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\n\n【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));
            if(system.length+input.length>240000)throw new Error('请求超过内部安全上限（'+formatTokenCount(estimateTokens(system)+estimateTokens(input),true)+'），请减少所选条目或正文层数');
            return {system,input,schema:copy(WORLD_RESULT_SCHEMA),seedPatches,due,unscheduled,staleActive,timeAnomalies,alienActivity,npcAudit:copy(npcAudit),timeline:copy(timeline),manifest:{输出协议:'WorldResult v1',结构化输出:'auto',接口来源:this.apiSourceLabel(),读取判定:copy(books.report||[]),世界书读取:{实际读取:books.length,检查条目:(books.report||[]).length,跳过:Math.max(0,(books.report||[]).length-books.length)},世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,估算Tokens:estimateTokens(b.内容)})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,估算Tokens:estimateTokens(f.正文)})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),待补时间锚点:unscheduled.map(e=>e.名称),超期活动事件:staleActive.map(e=>e.名称),时间越界记录:timeAnomalies.map(e=>e.类型+'/'+e.名称),程序结构修复:copy(structuralFixes),生命周期整理:copy(lifecycle),NPC构筑审计:npcAudit.map(x=>({名称:x.名称,审计级别:x.审计级别,缺口:copy(x.缺口)})),本轮时间容量:copy(capacity),可选宏观资料补充:needBackbone,观测:requestTokenTelemetry(system,input,WORLD_RESULT_SCHEMA)}};
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
            this.busy = true; const token = this.generation; let timeout, timedOut=false;
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
                    const needsScheduleRepair=unscheduledEvents(recoveryStat).length>0;
                    const needsLifecycleRepair=staleActiveEvents(recoveryStat).length>0||temporalAnomalies(recoveryStat).length>0;
                    const needsAlienRepair=activeAlienActivityRequirements(recoveryStat).some(item=>{
                        const personName=stableNameIn(recoveryStat.世界?.[PATH]?.人物||{},item.名称),person=personName?recoveryStat.世界[PATH].人物[personName]:null;
                        return !person||!String(person.地点||'').trim()||!String(person.目标||'').trim()||!String(person.行动||'').trim()||String(person.更新时间||'').trim()!==String(recoveryStat.世界?.时间||'').trim();
                    });
                    if(!needsMacroRepair&&!needsScheduleRepair&&!needsLifecycleRepair&&!needsAlienRepair){this.status='本楼层已处理，不重复结算';return false;}
                    this.status=needsMacroRepair?'检测到宏观骨架不完整 · 修复本楼层':needsScheduleRepair?'检测到事件时间锚点缺失 · 修复本楼层':needsAlienRepair?'检测到异端活动缺失 · 修复本楼层':'检测到生命周期或时间异常 · 修复本楼层';
                }
                if (!this.isAvailable()) throw new Error(this.usesDedicatedApi()?'请在世界推进「设置」中完成专属 API 地址与模型配置':'请在主神终端设置中启用额外模型并选择模型');
                const validate = this.host.Samsara && this.host.Samsara.validateWorldState;
                if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');

                this.resetInspection();
                this.status = '正在读取世界资料'; this.render();
                const request=await this.buildRequest(base);
                if(token!==this.generation)throw new Error('请求已取消');

                const configuredAttempts=Number(this.config.retryAttempts),maxAttempts=Math.max(1,Math.min(5,Number.isFinite(configuredAttempts)?configuredAttempts:3));
                let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];

                while(attempt<maxAttempts){
                    if(token!==this.generation)throw new Error('请求已取消');
                    this.controller=new AbortController();
                    timedOut=false;
                    clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;this.controller.abort();},300000);
                    const attemptInput=attempt===0?request.input:retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan);
                    const actualRequest=copy(request);
                    actualRequest.input=attemptInput;
                    actualRequest.manifest=Object.assign({},copy(request.manifest),{
                        观测:requestTokenTelemetry(request.system,attemptInput,request.schema),
                        尝试序号:attempt+1,
                        最大尝试次数:maxAttempts,
                        失败记录:copy(this.lastRetryLog)
                    });
                    actualRequest.manifest.观测.请求类型=attempt===0?'首次请求':'纠错重试';
                    this.lastAttemptCount=attempt+1;
                    this.lastRequest=actualRequest;
                    this.status=attempt===0?'六模块联合推演中':'纠错重试 '+(attempt+1)+'/'+maxAttempts;
                    this.render();

                    let received='',attemptTelemetry=null;
                    const attemptStarted=Date.now();this.lastTransportInfo=null;
                    try{
                        received=String(await this.requestAI(request.system,attemptInput,{signal:this.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature:0.3}));
                        clearTimeout(timeout);
                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');
                        this.lastReply=received;this.lastFailure='';
                        const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},usage=transport.usage||null,observation=actualRequest.manifest.观测;
                        Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未知',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed,输出估算Tokens:estimateTokens(received)});
                        if(usage){observation.实际输入Tokens=usage.inputTokens;observation.实际输出Tokens=usage.outputTokens;observation.实际总Tokens=usage.totalTokens;}
                        attemptTelemetry={尝试:attempt+1,结果:'待验收',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:observation.输出估算Tokens,API输入Tokens:usage?.inputTokens??null,API输出Tokens:usage?.outputTokens??null,API总Tokens:usage?.totalTokens??null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed};
                        this.lastAttemptTelemetry.push(attemptTelemetry);

                        const reply=parseReply(received);
                        let legacyPatches=[],rejectedSlices=[];
                        if(reply.kind==='world_result'){
                            const staged=stageWorldResult(base.stat,acceptedWorldResult,reply.worldResult,validate);
                            acceptedWorldResult=staged.accepted;
                            rejectedSlices=staged.rejected;
                            reply.summary=acceptedWorldResult.摘要||reply.summary;
                        } else {
                            legacyPatches=sanitizeModelPatches(normalizeModelPatches(reply.patches));
                        }
                        const compileFor=sourceStat=>{
                            const patches=[],warnings=[];
                            if(acceptedWorldResult){
                                const compiled=compileWorldResult(sourceStat,acceptedWorldResult);
                                patches.push(...compiled.patches);warnings.push(...compiled.warnings);
                            }
                            if(legacyPatches.length)patches.push(...legacyPatches);
                            return {patches,warnings};
                        };
                        let sourceStat=base.stat,compiled=compileFor(sourceStat),modelPatches=compiled.patches;
                        this.lastWorldResult=acceptedWorldResult?copy(acceptedWorldResult):null;
                        this.lastCompiledPatches=copy(modelPatches);
                        this.lastCompileWarnings=copy(compiled.warnings);
                        let built=materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                        let next=built.next;
                        let globalError=null;
                        try{
                            ensureDueHandled(next,request.due,base.stat.世界.时间);
                            ensureEventTimeAnchors(next,request.unscheduled);
                            ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                            ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                            ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                            ensureNpcBuildAuditProgress(next,request.npcAudit,acceptedWorldResult);
                            ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                        }catch(error){globalError=error;}
                        if(rejectedSlices.length||globalError)throw makeRetryFailure(rejectedSlices,globalError);

                        const current=this.snapshot();
                        if(token!==this.generation||this.controller.signal.aborted||current.fingerprint!==base.fingerprint||this.blocked(current))throw new Error('上下文已经切换，本次结果已丢弃');
                        if(progressionAnchorChanged(base.stat,current.stat))throw new Error('推演期间世界时间或副本锚点发生变化，请重新运行');

                        if(!same(current.stat,base.stat)){
                            sourceStat=current.stat;
                            compiled=compileFor(sourceStat);modelPatches=compiled.patches;
                            this.lastCompiledPatches=copy(modelPatches);
                            this.lastCompileWarnings=copy(compiled.warnings);
                            built=materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                            next=built.next;
                            let currentGlobalError=null;
                            try{
                                ensureDueHandled(next,request.due,base.stat.世界.时间);
                                ensureEventTimeAnchors(next,request.unscheduled);
                                ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                            }catch(error){currentGlobalError=error;}
                            if(currentGlobalError)throw makeRetryFailure([],currentGlobalError);
                        }
                        const committedPatches=built.appliedSeeds.concat(modelPatches,built.repairPatches);

                        if (!(next.设置 || {}).世界超稳) {
                            const offsets=(next.世界.因果轨道||{}).偏移记录||{};
                            const total=Object.values(offsets).reduce((n,r)=>n+(Number(r.影响程度)||0),0);
                            next.世界.稳定=Math.max(0,Math.min(120,100+total));
                        }
                        next.世界[PATH].已处理楼层=base.fingerprint;
                        next.世界[PATH].已处理时间=base.stat.世界.时间;
                        const changes=committedPatches.map(p=>{
                            const parts=tokens(p.path),back=parts[1]===PATH,asset=parts[0]==='资产';
                            return {时间:base.stat.世界.时间,类别:asset?'资产':back?parts[2]:parts[1],名称:asset?parts[1]:back?parts[3]:parts[2],字段:asset?'资产':parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.状态||p.value.内容||'记录已更新'):''};
                        });
                        next.世界[PATH].最近变化=changes.slice(-100);
                        const sourceOld=Object.assign(emptyState(),sourceStat.世界[PATH]||{});
                        next.世界[PATH].运行记录=sourceOld.运行记录.concat([{时间:base.stat.世界.时间,摘要:reply.summary,补丁数:committedPatches.length,尝试次数:attempt+1}]).slice(-20);

                        const checked=validate(next);
                        for(const patch of committedPatches){
                            if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                        }
                        reply.patches=committedPatches;
                        prepared={reply,next,current};
                        if(attemptTelemetry)attemptTelemetry.结果='接受';
                        break;
                    }catch(error){
                        clearTimeout(timeout);
                        if(attemptTelemetry){attemptTelemetry.结果='拒绝';attemptTelemetry.原因=String(error.message||error);}
                        else{
                            const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},observation=actualRequest.manifest.观测;
                            Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未返回',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed});
                            this.lastAttemptTelemetry.push({尝试:attempt+1,结果:'请求失败',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:0,API输入Tokens:null,API输出Tokens:null,API总Tokens:null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed,原因:String(error.message||error)});
                        }
                        lastError=error;
                        lastRejectedReply=received||this.lastReply||'';
                        lastRetryPlan=Array.isArray(error?.retryPlan)&&error.retryPlan.length?copy(error.retryPlan):retryPlanForFailure(error,[]);
                        const rejectedByModel=!!received&&retryableModelFailure(error);
                        if(rejectedByModel)this.lastRetryLog.push({尝试:attempt+1,错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                        const canRetry=rejectedByModel&&attempt+1<maxAttempts;
                        if(!canRetry)throw error;
                        attempt++;
                        this.status='回复未通过 · 自动纠错 '+(attempt+1)+'/'+maxAttempts;
                        this.render();
                    }
                }

                if(!prepared)throw lastError||new Error('世界推演未生成可写入结果');
                this.committing=true;
                const result=prepared.current.raw;
                result.stat_data=prepared.next;
                result.__samsaraWorldCommit=base.fingerprint;
                await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                this.status='已更新 · '+prepared.reply.summary+(this.lastRetryLog.length?' · 前序失败'+this.lastRetryLog.length+'次':'');
                return true;
            } catch (error) {
                const failureMessage=error.name==='AbortError'?(timedOut?'请求超时（300秒）':'请求已取消'):String(error.message||error);
                this.lastFailure=failureMessage;
                const retryNote=this.lastRetryLog?.length?' · 已记录失败'+this.lastRetryLog.length+'次':'';
                this.status=(this.committing?'写入未确认 · ':'未写入 · ')+failureMessage+retryNote;
                if(!(error.name==='AbortError'&&!timedOut))this.notifyFailure(this.status);
                throw error;
            } finally {
                clearTimeout(timeout); if(this.controller)this.controller=null; this.committing=false; this.busy=false; this.render();
                if (this.pending) { this.pending = false; this.schedule(); }
            }
        }
        getState() { return copy(Object.assign(emptyState(),this.snapshot().stat.世界[PATH] || {})); }
        resetInspection() {
            this.lastRequest=null;this.previewRequest=null;this.lastReply='';this.lastFailure='';
            this.lastRetryLog=[];this.lastAttemptCount=0;this.lastAttemptTelemetry=[];this.lastTransportInfo=null;this.lastWorldResult=null;this.lastCompiledPatches=[];this.lastCompileWarnings=[];
        }
        statusTone() {
            try {
                const tone=this.host.localStorage.getItem(STATUS_THEME_CONFIG);
                if(WORLD_TONE_KEYS.has(tone))return tone;
            } catch (_) {}
            return 'night';
        }
        syncStatusTone() {
            const tone=this.statusTone();
            if(this.panel)this.panel.dataset.tone=tone;
            return tone;
        }
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
            for (const key of ['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_DELETED']) bind(events[key], () => { this.cancel(); this.resetInspection(); this.status = '已切换上下文'; this.render(); });
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
            this.promptEditing=false;
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
                '#sam-world-engine button.we-btn{border:1px solid #ffffff23;border-radius:6px;background:#ffffff05;padding:7px 13px;font-size:12px}#sam-world-engine button.we-primary{background:var(--gold);border-color:var(--gold);color:#20232a;font-weight:700}#sam-world-engine .we-layout{display:flex;min-height:0;flex:1}#sam-world-engine nav{width:173px;flex-shrink:0;padding:22px 12px;background:#121a24;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:5px}#sam-world-engine nav .we-navtitle{font-size:10px;color:var(--sub);letter-spacing:3px;padding:0 13px 15px}#sam-world-engine nav button{display:flex;align-items:center;gap:11px;padding:11px 13px;border:1px solid transparent;border-radius:6px;text-align:left;background:none;color:var(--sub);font-size:13px}#sam-world-engine nav button .we-tab-icon{display:inline-flex;flex:0 0 20px;width:20px;height:20px;align-items:center;justify-content:center;font:400 16px/1 "Segoe UI Symbol","Noto Sans Symbols 2",system-ui,sans-serif;transform:none!important}#sam-world-engine nav button[aria-selected=true]{background:#d9b97812;color:var(--gold);border-color:#d9b97824}#sam-world-engine nav button:hover{background:#ffffff08;color:var(--ink)}',
                '#sam-world-engine main{flex:1;min-width:0;overflow:auto;padding:27px 30px 36px;scrollbar-width:thin;scrollbar-color:#526070 transparent}#sam-world-engine .we-eyebrow{font-size:10px;letter-spacing:3px;color:var(--gold);margin-bottom:7px}#sam-world-engine h1{font-size:30px;letter-spacing:2px;margin:0 0 8px;font-weight:600}#sam-world-engine h2{font-size:14px;font-weight:600;margin:0;letter-spacing:1px}#sam-world-engine h3{font-size:14px;margin:0 0 7px}#sam-world-engine p{margin:7px 0;white-space:pre-wrap;overflow-wrap:anywhere}#sam-world-engine .we-muted{color:var(--sub);font-size:12px}#sam-world-engine .we-hero{display:flex;gap:25px;justify-content:space-between;align-items:center;padding:0 0 23px;border-bottom:1px solid var(--line)}#sam-world-engine .we-hero .we-date{min-width:180px;text-align:right;color:var(--gold);font-size:16px}#sam-world-engine .we-hero .we-date small{display:block;color:var(--sub);font-size:11px;margin-top:5px}',
                '#sam-world-engine .we-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:18px 0 25px;background:linear-gradient(100deg,#1a2634,#141f2b);border:1px solid var(--line);border-radius:9px}#sam-world-engine .we-metric{padding:15px 20px;border-right:1px solid var(--line)}#sam-world-engine .we-metric:last-child{border:0}#sam-world-engine .we-metric strong{display:block;font-size:25px;font-weight:500;color:var(--ink);line-height:1.4}#sam-world-engine .we-metric small{color:var(--sub);font-size:11px;letter-spacing:1px}',
                '#sam-world-engine .we-columns{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(245px,1fr);gap:23px;align-items:start}#sam-world-engine .we-section{margin-bottom:23px;min-width:0}#sam-world-engine .we-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}#sam-world-engine .we-section-head small{color:var(--sub);font-size:11px}#sam-world-engine .we-card{border:1px solid var(--line);border-radius:8px;background:#18222f;padding:16px 18px;margin:9px 0;overflow:hidden}#sam-world-engine .we-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}#sam-world-engine .we-card-top h3{margin:0}#sam-world-engine .we-card p{font-size:13px;color:#b8c4d3}#sam-world-engine .we-pill{display:inline-block;font-size:10px;line-height:1.6;padding:2px 7px;border:1px solid #7dcbbb30;border-radius:4px;color:var(--mint);background:#7dcbbb09;white-space:nowrap}#sam-world-engine .we-pill.future{color:var(--gold);border-color:#d9b97830;background:#d9b97809}#sam-world-engine .we-pill.dim{color:var(--sub);border-color:var(--line);background:transparent}#sam-world-engine .we-meta{display:flex;gap:8px 15px;flex-wrap:wrap;color:var(--sub);font-size:11px;margin-top:9px}#sam-world-engine .we-chips{display:flex;flex-wrap:wrap;gap:5px}',
                '#sam-world-engine .we-timeline{border-left:1px solid #d9b97838;margin-left:5px;padding-left:20px}#sam-world-engine .we-timeline .we-card{position:relative;overflow:visible}#sam-world-engine .we-timeline .we-card:before{content:"";position:absolute;left:-26px;top:20px;width:9px;height:9px;background:var(--gold);border:2px solid #101720;border-radius:50%}#sam-world-engine .we-avatar{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#496575,#243440);color:#c1dedc;font-size:15px;flex-shrink:0}#sam-world-engine .we-person{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line)}#sam-world-engine .we-person:last-child{border:0}#sam-world-engine .we-person>div:last-child{flex:1;min-width:0}#sam-world-engine .we-person strong{font-size:13px}#sam-world-engine .we-person p{font-size:12px;color:#acb8c8;margin:3px 0}',
                '#sam-world-engine .we-context-list{display:grid;gap:8px}#sam-world-engine .we-context-row{width:100%;display:grid;grid-template-columns:minmax(56px,auto) minmax(0,1fr);align-items:start;gap:10px;padding:11px 12px;border:1px solid var(--we-line,var(--line));border-radius:9px;background:var(--we-card,#18222f);text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine button.we-context-row:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-context-kind{color:var(--we-accent,var(--gold));font-size:var(--we-fs-tiny,11px);font-weight:700;letter-spacing:.06em}#sam-world-engine .we-context-copy{min-width:0}#sam-world-engine .we-context-copy b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-context-copy small{display:block;margin-top:2px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-small,12px)}#sam-world-engine .we-scene-hero{padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-scene-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}#sam-world-engine .we-scene-head h3{margin:0}#sam-world-engine .we-scene-head small{color:var(--we-sub,var(--sub))}#sam-world-engine .we-scene-hero>p{margin:8px 0 0;color:var(--we-sub,var(--sub))}#sam-world-engine .we-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:11px}#sam-world-engine .we-scene-lane{min-width:0;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);padding:11px}#sam-world-engine .we-scene-lane-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}#sam-world-engine .we-scene-lane-head b{font-size:var(--we-fs-small,12px)}#sam-world-engine .we-scene-lane-head span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-scene-item{display:block;width:100%;padding:9px 8px;border:0;border-top:1px solid var(--we-line,var(--line));background:transparent;text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine .we-scene-item:first-of-type{border-top:0}#sam-world-engine button.we-scene-item:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-scene-item b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-scene-item small{display:block;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px);margin-top:2px}#sam-world-engine .we-scene-item p{margin:4px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;line-height:1.5!important}#sam-world-engine .we-scene-label,#sam-world-engine .we-person-label{cursor:default}#sam-world-engine .we-roster-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#sam-world-engine .we-roster-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;width:100%;min-width:0;padding:11px 12px;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);text-align:left;color:var(--we-ink,var(--ink))}#sam-world-engine .we-roster-person:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-roster-person.active{border-color:var(--we-accent,var(--gold));box-shadow:0 0 0 2px color-mix(in srgb,var(--we-accent,var(--gold)) 18%,transparent)}#sam-world-engine .we-roster-copy{min-width:0}#sam-world-engine .we-roster-copy b{display:block;font-size:var(--we-fs-body,13px);overflow-wrap:anywhere}#sam-world-engine .we-roster-copy small{display:block;margin-top:2px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-roster-copy em{display:block;margin-top:5px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-small,12px);font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sam-world-engine .we-area-scene-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}#sam-world-engine .we-area-detail{display:grid;gap:14px}#sam-world-engine .we-area-facts{min-width:0;padding:14px 16px;border:1px solid var(--we-line,var(--line));border-radius:11px;background:var(--we-card,#18222f)}#sam-world-engine .we-area-archive{padding:0 2px}#sam-world-engine .we-explore-index{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:900px){#sam-world-engine .we-roster-list,#sam-world-engine .we-scene-grid,#sam-world-engine .we-area-scene-grid{grid-template-columns:1fr}}',
                '#sam-world-engine .we-change{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px}#sam-world-engine .we-change time{color:var(--gold);font-size:10px}#sam-world-engine .we-change p{margin:2px 0;color:var(--sub)}#sam-world-engine .we-progress{height:4px;background:#ffffff0a;border-radius:4px;margin:10px 0 6px;overflow:hidden}#sam-world-engine .we-progress>i{display:block;height:100%;background:var(--mint);border-radius:4px}#sam-world-engine .we-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;align-items:start}#sam-world-engine dl{margin:12px 0;display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px 14px;font-size:12px}#sam-world-engine dt{color:var(--sub)}#sam-world-engine dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}#sam-world-engine details{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}#sam-world-engine summary{cursor:pointer;color:var(--gold);font-size:11px;list-style:none}#sam-world-engine summary:before{content:"＋ ";}#sam-world-engine details[open]>summary:before{content:"− ";}',
                '#sam-world-engine .we-calendar{background:#18222f;border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:20px}#sam-world-engine .we-calhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}#sam-world-engine .we-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}#sam-world-engine .we-days span{color:var(--sub);font-size:10px;padding:4px}#sam-world-engine .we-days button{position:relative;padding:7px 0;border:1px solid transparent;border-radius:5px;background:none;font-size:11px;min-width:0}#sam-world-engine .we-days button.today{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-days button.selected{background:#d9b97824}#sam-world-engine .we-days button.has-event:after{content:"";position:absolute;bottom:2px;left:calc(50% - 2px);width:4px;height:4px;background:var(--mint);border-radius:50%}#sam-world-engine .we-days button:hover{background:#ffffff0b}',
                '#sam-world-engine .we-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:18px 0}#sam-world-engine .we-tools input{min-width:150px;flex:1;background:#17212d;border:1px solid var(--line);border-radius:6px;color:var(--ink);padding:8px 12px;font-size:12px}#sam-world-engine .we-tools button{border:1px solid var(--line);background:none;border-radius:5px;padding:6px 10px;font-size:11px}#sam-world-engine .we-tools button.active{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-empty{padding:24px 15px;text-align:center;border:1px dashed #ffffff19;border-radius:8px;color:var(--sub);font-size:12px}#sam-world-engine .we-empty b{display:block;color:#bec9d6;margin-bottom:5px;font-weight:500}#sam-world-engine .we-notice{padding:12px 16px;border-left:2px solid var(--gold);background:#d9b97808;margin:15px 0;color:#d4c4a6;font-size:12px}#sam-world-engine textarea{width:100%;min-height:48vh;background:#121b26;color:var(--ink);border:1px solid #ffffff24;border-radius:8px;padding:18px;line-height:1.9;resize:vertical}#sam-world-engine footer{padding:8px 24px;border-top:1px solid var(--line);font-size:10px;color:var(--sub);display:flex;justify-content:space-between;gap:15px}#sam-world-engine footer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
                '@media(max-width:1000px){#sam-world-engine .we-columns{grid-template-columns:1fr}#sam-world-engine nav{width:145px}#sam-world-engine main{padding:20px}#sam-world-engine .we-calendar{max-width:400px}}@media(max-width:640px){#sam-world-engine{inset:0;border-radius:0}#sam-world-engine header{padding:0 12px;height:58px;gap:6px}#sam-world-engine .we-brand{font-size:13px;letter-spacing:1px}#sam-world-engine .we-brand small{display:none}#sam-world-engine .we-layout{flex-direction:column}#sam-world-engine nav{width:100%;flex-direction:row;overflow-x:auto;padding:8px;gap:3px;border-right:0;border-bottom:1px solid var(--line)}#sam-world-engine nav .we-navtitle{display:none}#sam-world-engine nav button{white-space:nowrap;padding:7px 10px;font-size:11px}#sam-world-engine nav button .we-tab-icon{display:none}#sam-world-engine main{padding:18px 14px}#sam-world-engine .we-hero{gap:12px;align-items:flex-start}#sam-world-engine h1{font-size:23px}#sam-world-engine .we-hero .we-date{min-width:110px;font-size:12px}#sam-world-engine .we-metric{padding:10px}#sam-world-engine .we-metric strong{font-size:20px}#sam-world-engine .we-grid{grid-template-columns:1fr}#sam-world-engine footer{padding:8px 12px}#sam-world-engine footer small{display:none}}'
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
                #sam-world-engine .we-card-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}
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
                #sam-world-engine .we-timeline-group{margin:0 0 14px}
                #sam-world-engine .we-timeline-group-title{display:flex;align-items:center;gap:7px;margin:8px 0 6px;color:#6f7b8c;font-size:10px;font-weight:700;letter-spacing:1.2px}
                #sam-world-engine .we-timeline-group-title:after{content:"";height:1px;background:#e2e6e4;flex:1}
                #sam-world-engine .we-timeline-group-title small{order:2;padding:1px 5px;border-radius:999px;background:#ecefea;color:#87909a;font-size:9px;letter-spacing:0}
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
                #sam-world-engine .we-world-ranks{display:flex;flex-wrap:wrap;gap:8px 20px;margin:0 0 10px;color:var(--sub);font-size:13px}
                #sam-world-engine .we-world-ranks b{color:var(--we-ink,var(--ink));font-weight:600;margin-left:6px}
                #sam-world-engine .we-hero>div:first-child{min-width:0}
                #sam-world-engine .we-reading-section summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-weight:600}
                #sam-world-engine .we-reading-section summary small{font-weight:400;color:var(--sub)}
                #sam-world-engine .we-reading{max-width:80ch;margin:18px auto 4px;line-height:1.85;min-width:0}
                #sam-world-engine .we-reading article+article{border-top:1px solid var(--line);padding-top:18px;margin-top:18px}
                #sam-world-engine .we-reading article>small{color:var(--sub)}
                #sam-world-engine .we-reading p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.85}
                #sam-world-engine .we-alien-count{margin:0 0 14px;align-items:center}
                #sam-world-engine .we-world-focus{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(285px,.75fr);gap:12px;margin-bottom:12px}
                #sam-world-engine .we-world-focus .we-section{height:100%;margin:0;border-color:#cfd9db;background:#fff;box-shadow:0 4px 14px #2231420b}
                #sam-world-engine .we-world-focus-main .we-section{border-left:4px solid #4f7d6d}
                #sam-world-engine .we-world-focus-next .we-section{border-left:4px solid #b28a4a}
                #sam-world-engine .we-kpi-compact{margin-bottom:12px}
                #sam-world-engine .we-kpi-compact .we-kpi{background:#fff;border-color:#cfd9db;box-shadow:0 3px 12px #22314208}
                #sam-world-engine .we-dashboard{grid-template-columns:minmax(0,1fr) minmax(285px,325px)}
                #sam-world-engine .we-dashboard .we-section{border-color:#d2dcdd;background:#fff}
                #sam-world-engine .we-timeline-board{box-shadow:none}
                #sam-world-engine .we-ledger-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:0 0 12px}
                #sam-world-engine .we-ledger-stat{min-width:0;padding:11px 13px;border:1px solid #d8e0e1;border-radius:11px;background:#fff}
                #sam-world-engine .we-ledger-stat small{display:block;color:#8a929c;font-size:9px;letter-spacing:.8px}
                #sam-world-engine .we-ledger-stat strong{display:block;margin:2px 0;font:600 21px/1.15 Georgia,serif;color:#30455d}
                #sam-world-engine .we-ledger-stat span{display:block;color:#7b8490;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-explore-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,330px);gap:12px;align-items:start}
                #sam-world-engine .we-explore-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
                #sam-world-engine .we-explore-card{display:block;width:100%;min-width:0;padding:13px;border:1px solid #d6dfe0;border-radius:12px;background:#fff;text-align:left;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}
                #sam-world-engine .we-explore-card:hover{border-color:#b9c9c7;box-shadow:0 5px 16px #22314210;transform:translateY(-1px)}
                #sam-world-engine .we-explore-card.active{border-color:#b28a4a;box-shadow:0 0 0 2px #d9b97825}
                #sam-world-engine .we-explore-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
                #sam-world-engine .we-explore-head>div{min-width:0}
                #sam-world-engine .we-explore-head small{display:block;color:#8b949d;font-size:9px}
                #sam-world-engine .we-explore-head h3{margin:2px 0 0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-risk-badge{flex:0 0 auto;padding:2px 7px;border:1px solid #d7dfe0;border-radius:999px;background:#f7f8f5;color:#536476;font-size:9px}
                #sam-world-engine .we-explore-score{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin:11px 0 5px}
                #sam-world-engine .we-explore-score strong{font:600 23px/1 Georgia,serif;color:#31475f}
                #sam-world-engine .we-explore-score strong small{display:inline;font:500 10px/1 system-ui;color:#7b8793}
                #sam-world-engine .we-explore-score span{font-size:10px;color:#8b6a33}
                #sam-world-engine .we-explore-bar{height:6px;overflow:hidden;border-radius:999px;background:#e8eceb}
                #sam-world-engine .we-explore-bar>i{display:block;height:100%;border-radius:999px;background:#6f9d8c}
                #sam-world-engine .we-explore-meta{display:flex;flex-wrap:wrap;gap:5px 9px;margin-top:9px;color:#788491;font-size:9px}
                #sam-world-engine .we-explore-card p{margin:8px 0 0;color:#657185;font-size:10px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
                #sam-world-engine .we-area-side{position:sticky;top:0}
                #sam-world-engine .we-area-hero{padding:2px 0 10px;border-bottom:1px solid #e2e7e6}
                #sam-world-engine .we-area-hero small{color:#8a939d;font-size:9px}
                #sam-world-engine .we-area-hero h3{margin:2px 0 8px;font-size:17px}
                #sam-world-engine .we-area-progress{display:grid;grid-template-columns:auto minmax(0,1fr);gap:11px;align-items:center}
                #sam-world-engine .we-area-progress>strong{font:600 31px/1 Georgia,serif;color:#30465f}
                #sam-world-engine .we-area-progress>div>span{display:flex;justify-content:space-between;color:#7b8791;font-size:9px;margin-bottom:5px}
                #sam-world-engine .we-area-progress em{font-style:normal;color:#8b6a33}
                #sam-world-engine .we-area-note{margin-top:10px;padding:9px 10px;border-radius:9px;background:#f5f7f3;color:#647180;font-size:10px;line-height:1.6}
                #sam-world-engine .we-faction-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
                #sam-world-engine .we-faction-card{display:block;width:100%;padding:12px 13px;border:1px solid #d6dfe0;border-radius:11px;background:#fff;text-align:left}
                #sam-world-engine .we-faction-card.active{border-color:#b28a4a;box-shadow:0 0 0 2px #d9b97822}
                #sam-world-engine .we-faction-card .we-card-top h3{font-size:13px}
                #sam-world-engine .we-rep{display:flex;justify-content:space-between;gap:8px;margin:8px 0 4px;font-size:10px;color:#788491}
                #sam-world-engine .we-rep b{color:#8b6a33}
                #sam-world-engine .we-preset-toolbar{position:sticky;top:-1px;z-index:8;display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 14px;padding:12px 14px;border:1px solid #c7d2d4;border-radius:13px;background:#fffdf9f2;backdrop-filter:blur(10px);box-shadow:0 8px 22px #22314212}
                #sam-world-engine .we-preset-toolbar>div:first-child{display:flex;flex-direction:column;min-width:0}
                #sam-world-engine .we-preset-toolbar b{font-size:14px;color:#2c3e50}
                #sam-world-engine .we-preset-toolbar small{font-size:10px;color:var(--sub)}
                #sam-world-engine .we-preset-toolbar>div:last-child{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
                #sam-world-engine .we-doc-create{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:8px;margin-bottom:10px}
                #sam-world-engine .we-doc-create input{min-width:0;padding:8px 10px;border:1px solid #d4dcdd;border-radius:9px;background:#fff;color:var(--ink)}
                #sam-world-engine .we-doc-list{display:grid;gap:7px}
                #sam-world-engine .we-doc-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid #d9e1e1;border-radius:10px;background:#fafbf8}
                #sam-world-engine .we-doc-row>div{min-width:0}
                #sam-world-engine .we-doc-row b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                #sam-world-engine .we-doc-row small{display:block;color:var(--sub);font-size:10px;margin-top:2px}
                #sam-world-engine .we-doc-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;background:#e8f1ec;color:#4f7d6d;font:700 9px/1.6 system-ui}
                #sam-world-engine .we-doc-actions{display:flex;gap:5px}
                #sam-world-engine .we-doc-actions button,#sam-world-engine .we-segment-actions button{border:1px solid #d2dbdc;border-radius:7px;background:#fff;padding:5px 8px;color:#556579;font-size:10px}
                #sam-world-engine .we-doc-actions button:hover,#sam-world-engine .we-segment-actions button:hover{border-color:#b28a4a;color:#76592b;background:#fbf4e8}
                #sam-world-engine .we-segment-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:var(--sub);font-size:11px}
                #sam-world-engine .we-segment-list{display:grid;gap:10px}
                #sam-world-engine .we-segment{border:1px solid #d3dddd;border-radius:12px;background:#fbfcf9;overflow:hidden}
                #sam-world-engine .we-segment-head{display:grid;grid-template-columns:minmax(140px,1fr) auto auto;gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid #dce4e4;background:#f1f5f2}
                #sam-world-engine .we-segment-head input{min-width:0;border:0;border-bottom:1px solid #c6d1d2;background:transparent;padding:4px 2px;font-weight:700;color:#31445d}
                #sam-world-engine .we-segment-head input:focus{outline:none;border-bottom-color:#b28a4a}
                #sam-world-engine .we-segment-head small{color:var(--sub);font-size:10px}
                #sam-world-engine .we-segment-actions{display:flex;gap:4px}
                #sam-world-engine .we-segment>summary{padding:12px;cursor:pointer;color:var(--we-ink)}
                #sam-world-engine .we-segment textarea{display:block;width:100%;min-height:170px;height:210px;border:0;border-radius:0;background:#fff;padding:12px 13px;resize:vertical}
                /* ===== 世界引擎独立外观：跟随主神终端六色调；未设置时回退暗夜 ===== */
                ${WORLD_UI_THEME_CSS}
                #sam-world-engine[data-tone]{
                    --ink:var(--we-ink);--sub:var(--we-sub);--line:var(--we-line);--gold:var(--we-gold);--mint:var(--we-mint);
                    --we-chrome-ink:#f7fbff;--we-chrome-sub:#c9d3dd;--we-nav-ink:#d6dee7;
                    --we-chrome-control:#ffffff0d;--we-chrome-control-hover:#ffffff18;--we-chrome-border:#ffffff2d;
                    --we-fs-root:16px;--we-fs-body:15px;--we-fs-small:13px;--we-fs-tiny:13px;--we-fs-control:14px;
                    --we-fs-h1:29px;--we-fs-h2:19px;--we-fs-h3:16px;--we-fs-metric:26px;--we-fs-hero:32px;
                    background:var(--we-shell)!important;color:var(--we-ink)!important;border-color:var(--we-line)!important;
                    font-size:var(--we-fs-root)!important;line-height:1.72!important;text-rendering:optimizeLegibility;-webkit-font-smoothing:auto
                }
                #sam-world-engine[data-font-scale="large"]{
                    --we-fs-root:18px;--we-fs-body:17px;--we-fs-small:15px;--we-fs-tiny:14px;--we-fs-control:16px;
                    --we-fs-h1:33px;--we-fs-h2:22px;--we-fs-h3:18px;--we-fs-metric:30px;--we-fs-hero:35px
                }
                #sam-world-engine[data-font-scale="xlarge"]{
                    --we-fs-root:20px;--we-fs-body:19px;--we-fs-small:17px;--we-fs-tiny:15px;--we-fs-control:18px;
                    --we-fs-h1:36px;--we-fs-h2:24px;--we-fs-h3:20px;--we-fs-metric:34px;--we-fs-hero:39px
                }
                .we-causal{min-width:0;overflow-wrap:anywhere}
                .we-stability{display:flex;align-items:center;justify-content:space-between;gap:12px}
                .we-stability strong{display:block;font-size:var(--we-fs-hero);line-height:1.3;color:var(--we-ink)}
                .we-stability>span{font-size:var(--we-fs-small);color:var(--we-sub);text-align:right}
                .we-causal meter{display:block;width:100%;height:14px;margin:12px 0;accent-color:var(--we-mint)}
                .we-causal meter::-webkit-meter-bar{background:var(--we-card);border:1px solid var(--we-line);border-radius:9px}
                .we-causal meter::-webkit-meter-optimum-value{background:var(--we-mint)}
                .we-offset-heading,.we-offset-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
                .we-offset-heading{margin-top:16px;font-weight:600}
                .we-offset-heading span,.we-offset small{color:var(--we-sub);font-size:var(--we-fs-small)}
                .we-offset{margin-top:10px;padding:12px;border:1px solid var(--we-line);border-radius:12px;background:var(--we-card)}
                .we-offset-head span{flex-shrink:0;font-weight:700;color:var(--we-ink)}
                .we-offset p{margin:8px 0;font-size:var(--we-fs-body)}
                .we-offset-more summary{cursor:pointer;margin-top:12px;color:var(--we-ink)}
                #sam-world-engine[data-tone] header{background:linear-gradient(120deg,var(--we-head),var(--we-nav))!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] .we-brand i{color:var(--we-action)!important}
                #sam-world-engine[data-tone] .we-brand small{color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] header button.we-btn{background:var(--we-chrome-control)!important;border-color:var(--we-chrome-border)!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] header button.we-btn:hover{background:var(--we-chrome-control-hover)!important;border-color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] header button.we-primary{background:var(--we-action)!important;border-color:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] nav{background:var(--we-nav)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] nav button{color:var(--we-nav-ink)!important}
                #sam-world-engine[data-tone] nav button:hover{background:var(--we-chrome-control-hover)!important;color:var(--we-chrome-ink)!important}
                #sam-world-engine[data-tone] nav button[aria-selected=true]{background:var(--we-action)!important;border-color:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] main{background:var(--we-main)!important;color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-hero,
                #sam-world-engine[data-tone] .we-section,
                #sam-world-engine[data-tone] .we-world-focus .we-section,
                #sam-world-engine[data-tone] .we-dashboard .we-section{background:var(--we-surface)!important;border-color:var(--we-line)!important;box-shadow:none!important}
                #sam-world-engine[data-tone] .we-card,
                #sam-world-engine[data-tone] .we-kpi,
                #sam-world-engine[data-tone] .we-kpi-compact .we-kpi,
                #sam-world-engine[data-tone] .we-ledger-stat,
                #sam-world-engine[data-tone] .we-explore-card,
                #sam-world-engine[data-tone] .we-faction-card,
                #sam-world-engine[data-tone] .we-doc-row,
                #sam-world-engine[data-tone] .we-segment,
                #sam-world-engine[data-tone] .we-book{background:var(--we-card)!important;border-color:var(--we-line)!important;color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-card:hover,
                #sam-world-engine[data-tone] button.we-card:hover,
                #sam-world-engine[data-tone] .we-explore-card:hover,
                #sam-world-engine[data-tone] .we-faction-card:hover,
                #sam-world-engine[data-tone] .we-brief-row:hover,
                #sam-world-engine[data-tone] .we-person-compact:hover{background:var(--we-card-hover)!important}
                #sam-world-engine[data-tone] .we-card p,
                #sam-world-engine[data-tone] .we-person p,
                #sam-world-engine[data-tone] .we-pulse p,
                #sam-world-engine[data-tone] .we-next-node p,
                #sam-world-engine[data-tone] .we-explore-card p{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-kpi strong,
                #sam-world-engine[data-tone] .we-ledger-stat strong,
                #sam-world-engine[data-tone] .we-explore-score strong,
                #sam-world-engine[data-tone] .we-area-progress>strong{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-kpi small,
                #sam-world-engine[data-tone] .we-kpi span,
                #sam-world-engine[data-tone] .we-ledger-stat small,
                #sam-world-engine[data-tone] .we-ledger-stat span,
                #sam-world-engine[data-tone] .we-explore-head small,
                #sam-world-engine[data-tone] .we-explore-meta,
                #sam-world-engine[data-tone] .we-area-hero small{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-tools input,
                #sam-world-engine[data-tone] select,
                #sam-world-engine[data-tone] .we-config-row input,
                #sam-world-engine[data-tone] .we-doc-create input,
                #sam-world-engine[data-tone] .we-segment-head input,
                #sam-world-engine[data-tone] textarea,
                #sam-world-engine[data-tone] .we-setting-input{background:var(--we-input)!important;color:var(--we-ink)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-tools button,
                #sam-world-engine[data-tone] .we-doc-actions button,
                #sam-world-engine[data-tone] .we-segment-actions button,
                #sam-world-engine[data-tone] .we-setting-btn{background:var(--we-card)!important;color:var(--we-ink)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-tools button.active,
                #sam-world-engine[data-tone] .we-setting-btn.active{border-color:var(--we-accent)!important;color:var(--we-accent)!important;background:var(--we-accent-soft)!important}
                #sam-world-engine[data-tone] .we-empty{background:var(--we-card)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-empty b{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-notice{background:var(--we-notice)!important;color:var(--we-ink)!important;border-left-color:var(--we-gold)!important}
                #sam-world-engine[data-tone] footer{background:var(--we-nav)!important;color:var(--we-chrome-sub)!important}
                #sam-world-engine[data-tone] .we-timeline .we-card:before{border-color:var(--we-surface)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title:after{background:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-explore-bar{background:color-mix(in srgb,var(--we-line) 70%,transparent)!important}
                #sam-world-engine[data-tone] .we-explore-bar>i{background:var(--we-mint)!important}
                #sam-world-engine[data-tone] .we-risk-badge{background:var(--we-input)!important;color:var(--we-sub)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-preset-toolbar{background:var(--we-surface)!important;border-color:var(--we-line)!important;box-shadow:none!important}
                #sam-world-engine[data-tone] .we-segment-head{background:var(--we-card)!important;border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-book-row,
                #sam-world-engine[data-tone] .we-brief-row,
                #sam-world-engine[data-tone] .we-section-head,
                #sam-world-engine[data-tone] .we-area-hero{border-color:var(--we-line)!important}
                #sam-world-engine[data-tone] .we-next-node>span{background:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] button.we-next-node:hover{background:var(--we-card-hover)!important}
                #sam-world-engine[data-tone] .we-next-node small,
                #sam-world-engine[data-tone] .we-person-copy small,
                #sam-world-engine[data-tone] .we-link-btn,
                #sam-world-engine[data-tone] .we-explore-score span,
                #sam-world-engine[data-tone] .we-area-progress em,
                #sam-world-engine[data-tone] .we-rep b{color:var(--we-gold)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title,
                #sam-world-engine[data-tone] .we-timeline-group-title small,
                #sam-world-engine[data-tone] .we-brief-row>span:last-child,
                #sam-world-engine[data-tone] .we-person-copy em,
                #sam-world-engine[data-tone] .we-area-progress>div>span{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title small{background:var(--we-card)!important}
                #sam-world-engine[data-tone] .we-preset-toolbar b{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] summary:hover{color:var(--we-accent)!important}
                #sam-world-engine[data-tone] .we-card.is-jump{outline-color:var(--we-action)!important;background:var(--we-accent-soft)!important}
                /* 全面字号系统：字号设置必须作用于整个面板，而不是只影响继承 root 字号的按钮 */
                #sam-world-engine[data-tone] main{font-size:var(--we-fs-body)!important}
                #sam-world-engine[data-tone] .we-brand{font-size:var(--we-fs-h3)!important;line-height:1.2!important}
                #sam-world-engine[data-tone] .we-hero .we-date{font-size:var(--we-fs-h3)!important;line-height:1.45!important}
                #sam-world-engine[data-tone] .we-world-ranks{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] header button,
                #sam-world-engine[data-tone] nav button,
                #sam-world-engine[data-tone] main button,
                #sam-world-engine[data-tone] main input,
                #sam-world-engine[data-tone] main select,
                #sam-world-engine[data-tone] main textarea{font-size:var(--we-fs-control)!important}
                #sam-world-engine[data-tone] h1{font-size:var(--we-fs-h1)!important;line-height:1.28!important}
                #sam-world-engine[data-tone] h2{font-size:var(--we-fs-h2)!important;line-height:1.35!important}
                #sam-world-engine[data-tone] h3,
                #sam-world-engine[data-tone] .we-explore-head h3,
                #sam-world-engine[data-tone] .we-faction-card .we-card-top h3,
                #sam-world-engine[data-tone] .we-area-hero h3{font-size:var(--we-fs-h3)!important;line-height:1.4!important}
                #sam-world-engine[data-tone] main p,
                #sam-world-engine[data-tone] .we-card p,
                #sam-world-engine[data-tone] .we-person p,
                #sam-world-engine[data-tone] .we-pulse p,
                #sam-world-engine[data-tone] .we-next-node p,
                #sam-world-engine[data-tone] .we-explore-card p,
                #sam-world-engine[data-tone] .we-prose,
                #sam-world-engine[data-tone] .we-area-note,
                #sam-world-engine[data-tone] .we-rep{font-size:var(--we-fs-body)!important;line-height:1.68!important}
                #sam-world-engine[data-tone] .we-muted,
                #sam-world-engine[data-tone] dl,
                #sam-world-engine[data-tone] summary,
                #sam-world-engine[data-tone] .we-meta,
                #sam-world-engine[data-tone] .we-hero .we-date small,
                #sam-world-engine[data-tone] .we-metric small,
                #sam-world-engine[data-tone] .we-section-head small,
                #sam-world-engine[data-tone] .we-date-filter,
                #sam-world-engine[data-tone] .we-brief-row>b,
                #sam-world-engine[data-tone] .we-person-copy strong,
                #sam-world-engine[data-tone] .we-book-title small,
                #sam-world-engine[data-tone] .we-read-state,
                #sam-world-engine[data-tone] .we-segment-toolbar{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] small,
                #sam-world-engine[data-tone] footer,
                #sam-world-engine[data-tone] .we-brand small,
                #sam-world-engine[data-tone] nav .we-navtitle,
                #sam-world-engine[data-tone] .we-eyebrow,
                #sam-world-engine[data-tone] .we-pill,
                #sam-world-engine[data-tone] .we-change time,
                #sam-world-engine[data-tone] .we-days span,
                #sam-world-engine[data-tone] .we-pulse-mark,
                #sam-world-engine[data-tone] .we-timeline-group-title,
                #sam-world-engine[data-tone] .we-timeline-group-title small,
                #sam-world-engine[data-tone] .we-next-node small,
                #sam-world-engine[data-tone] .we-brief-row>span:last-child,
                #sam-world-engine[data-tone] .we-person-copy small,
                #sam-world-engine[data-tone] .we-person-copy em,
                #sam-world-engine[data-tone] .we-link-btn,
                #sam-world-engine[data-tone] .we-ledger-stat small,
                #sam-world-engine[data-tone] .we-ledger-stat span,
                #sam-world-engine[data-tone] .we-explore-head small,
                #sam-world-engine[data-tone] .we-risk-badge,
                #sam-world-engine[data-tone] .we-explore-score strong small,
                #sam-world-engine[data-tone] .we-explore-score span,
                #sam-world-engine[data-tone] .we-explore-meta,
                #sam-world-engine[data-tone] .we-area-hero small,
                #sam-world-engine[data-tone] .we-area-progress>div>span,
                #sam-world-engine[data-tone] .we-preset-toolbar small,
                #sam-world-engine[data-tone] .we-doc-row small,
                #sam-world-engine[data-tone] .we-doc-badge,
                #sam-world-engine[data-tone] .we-segment-head small,
                #sam-world-engine[data-tone] .we-setting-copy small,
                #sam-world-engine[data-tone] .we-api-grid label,
                #sam-world-engine[data-tone] .we-source-badge{font-size:var(--we-fs-tiny)!important;line-height:1.55!important}
                #sam-world-engine[data-tone] .we-kpi strong,
                #sam-world-engine[data-tone] .we-ledger-stat strong,
                #sam-world-engine[data-tone] .we-explore-score strong{font-size:var(--we-fs-metric)!important}
                #sam-world-engine[data-tone] .we-area-progress>strong{font-size:var(--we-fs-hero)!important}
                #sam-world-engine[data-tone] textarea.we-raw{font-size:var(--we-fs-small)!important}
                #sam-world-engine[data-tone] .we-person strong,
                #sam-world-engine[data-tone] .we-preset-toolbar b,
                #sam-world-engine[data-tone] .we-setting-copy b{font-size:var(--we-fs-body)!important}
                #sam-world-engine[data-tone] .we-doc-actions button,
                #sam-world-engine[data-tone] .we-segment-actions button{font-size:var(--we-fs-tiny)!important}
                /* 区域档案说明卡跟随主题，避免暗色下出现刺眼白框和灰字 */
                #sam-world-engine[data-tone] .we-area-note{
                    background:var(--we-input)!important;color:var(--we-ink)!important;border:1px solid var(--we-line)!important;
                    font-weight:500!important
                }
                /* 设置页 */
                #sam-world-engine .we-setting-row{display:grid;grid-template-columns:minmax(150px,1fr) minmax(220px,1.2fr);gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--we-line,var(--line))}
                #sam-world-engine .we-setting-row:last-child{border-bottom:0}
                #sam-world-engine .we-setting-copy b{display:block;font-size:14px}
                #sam-world-engine .we-setting-copy small{display:block;color:var(--we-sub,var(--sub));font-size:11px;margin-top:3px}
                #sam-world-engine .we-setting-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}
                #sam-world-engine .we-setting-btn{border:1px solid var(--we-line,var(--line));border-radius:8px;padding:7px 10px}
                #sam-world-engine .we-api-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
                #sam-world-engine .we-api-grid label{display:flex;flex-direction:column;gap:5px;color:var(--we-sub,var(--sub));font-size:11px}
                #sam-world-engine .we-api-grid label.wide{grid-column:1/-1}
                #sam-world-engine .we-setting-input{width:100%;min-width:0;padding:9px 10px;border:1px solid var(--we-line,var(--line));border-radius:8px}
                #sam-world-engine .we-api-toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:10px 0}
                #sam-world-engine .we-api-toolbar select,#sam-world-engine .we-api-toolbar input{min-width:160px;flex:1}
                #sam-world-engine .we-source-badge{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border-radius:999px;border:1px solid var(--we-line,var(--line));background:var(--we-card,#fff);font-size:11px}
                #sam-world-engine .we-source-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--we-mint,var(--mint))}
                #sam-world-engine .we-switch{display:inline-flex;align-items:center;gap:8px}
                #sam-world-engine .we-switch-track{width:42px;height:23px;border-radius:999px;background:var(--we-line,var(--line));padding:3px;transition:background .15s}
                #sam-world-engine .we-switch-track i{display:block;width:17px;height:17px;border-radius:50%;background:#fff;transition:transform .15s}
                #sam-world-engine .we-switch.on .we-switch-track{background:var(--we-accent,var(--gold))}
                #sam-world-engine .we-switch.on .we-switch-track i{transform:translateX(19px)}
                @media(max-width:1100px){
                    #sam-world-engine .we-world-focus{grid-template-columns:1fr}
                    #sam-world-engine .we-dashboard{grid-template-columns:1fr}
                    #sam-world-engine .we-explore-layout{grid-template-columns:1fr}
                    #sam-world-engine .we-area-side{position:static}
                    #sam-world-engine .we-command-side{position:static;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
                    #sam-world-engine .we-command-side>.we-section{margin-bottom:0}
                    #sam-world-engine .we-calendar-layout{grid-template-columns:minmax(220px,260px) minmax(0,1fr)}
                }
                @media(max-width:760px){
                    #sam-world-engine{--we-safe-top:max(env(safe-area-inset-top,0px),24px);--we-safe-right:env(safe-area-inset-right,0px);--we-safe-bottom:env(safe-area-inset-bottom,0px);--we-safe-left:env(safe-area-inset-left,0px);inset:0!important;height:100vh!important;height:100dvh!important;border-radius:0}
                    #sam-world-engine header{padding:var(--we-safe-top) max(12px,var(--we-safe-right)) 0 max(12px,var(--we-safe-left));height:calc(56px + var(--we-safe-top));min-height:calc(56px + var(--we-safe-top));gap:6px}
                    #sam-world-engine .we-brand{font-size:13px;letter-spacing:1px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                    #sam-world-engine .we-brand small{display:none}
                    #sam-world-engine nav{padding:7px max(9px,var(--we-safe-right)) 7px max(9px,var(--we-safe-left));min-height:46px}
                    #sam-world-engine nav button{padding:7px 10px}
                    #sam-world-engine nav button .we-tab-icon{display:none}
                    #sam-world-engine main{padding:12px max(10px,var(--we-safe-right)) calc(24px + var(--we-safe-bottom)) max(10px,var(--we-safe-left))}
                    #sam-world-engine .we-hero{align-items:flex-start;padding:14px}
                    #sam-world-engine h1{font-size:21px}
                    #sam-world-engine .we-hero .we-date{min-width:105px;font-size:11px}
                    #sam-world-engine .we-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
                    #sam-world-engine .we-ledger-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
                    #sam-world-engine .we-explore-grid,#sam-world-engine .we-faction-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-preset-toolbar{align-items:flex-start}
                    #sam-world-engine .we-doc-create{grid-template-columns:1fr 1fr}
                    #sam-world-engine .we-doc-create input{grid-column:1/-1}
                    #sam-world-engine .we-doc-row{grid-template-columns:1fr}
                    #sam-world-engine .we-doc-actions{flex-wrap:wrap}
                    #sam-world-engine .we-segment-head{grid-template-columns:1fr auto}
                    #sam-world-engine .we-segment-head small{display:none}
                    #sam-world-engine .we-segment-actions{grid-column:1/-1}
                    #sam-world-engine .we-command-side{display:block}
                    #sam-world-engine .we-command-side>.we-section{margin-bottom:10px}
                    #sam-world-engine .we-calendar-layout{grid-template-columns:1fr}
                    #sam-world-engine .we-calendar-slot{position:static}
                    #sam-world-engine .we-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-section{padding:13px}
                    #sam-world-engine footer{padding:7px max(10px,var(--we-safe-right)) calc(7px + var(--we-safe-bottom)) max(10px,var(--we-safe-left))}
                    #sam-world-engine footer small{display:none}
                    #sam-world-engine .we-setting-row{grid-template-columns:1fr}
                    #sam-world-engine .we-setting-actions{justify-content:flex-start}
                    #sam-world-engine .we-api-grid{grid-template-columns:1fr}
                    #sam-world-engine .we-api-grid label.wide{grid-column:auto}
                }
                @media(max-height:400px){
                    #sam-world-engine header{height:calc(40px + var(--we-safe-top,0px));min-height:calc(40px + var(--we-safe-top,0px))}
                    #sam-world-engine nav{padding:3px 8px;min-height:36px}
                    #sam-world-engine footer{padding:2px 12px}
                    #sam-world-engine main{padding:8px}
                }
            `;
            this.panel=doc.createElement('section');this.panel.id='sam-world-engine';this.panel.hidden=true;
            this.panel.dataset.tone=this.statusTone();this.panel.dataset.fontScale=this.config.fontScale||'standard';
            this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','世界引擎');
            this.panel.innerHTML='<header><div class="we-brand"><i>◈</i>世界引擎<small>WORLD CHRONICLE</small></div><button class="we-btn we-primary" data-action="run">推进世界</button><button class="we-btn" data-action="close" aria-label="返回主神终端">返回 ↗</button></header><div class="we-layout"><nav></nav><main></main></div><footer><span></span><small>剧情时间驱动 · 由主神终端「世界推进」总开关控制</small></footer>';
            this.panel.addEventListener('click',event=>{
                const button=event.target.closest('button');if(!button)return;
                const a=button.dataset.action;
                if(button.dataset.directory){this.directoryTab=button.dataset.directory;this.render();return;}
                if(button.dataset.area){this.selectedArea=button.dataset.area;this.directoryTab='探索';this.render();return;}
                if(button.dataset.faction){this.selectedFaction=button.dataset.faction;this.directoryTab='势力';this.render();return;}
                if(button.dataset.jumpPerson){this.selectedPerson=button.dataset.jumpPerson;this.tab='角色管理';this.filter='全部';this.query='';this.selectedDate='';this.render(true);return;}
                if(button.dataset.jumpEvent){
                    this.jumpEvent=button.dataset.jumpEvent;this.tab='世界推进';this.filter='全部';this.query='';
                    const world=this.snapshot().stat.世界,event=world[PATH]?.事件?.[this.jumpEvent],calendar=world.历法;
                    const date=calendarDate(event?.时间||event?.开始时间,calendar),today=calendarDate(world.时间,calendar);
                    const monthsPerYear=Array.isArray(calendar?.月份天数)&&calendar.月份天数.length?calendar.月份天数.length:12;
                    this.selectedDate=date?.key||'';this.calendarMode=date?'date':'undated';
                    this.monthOffset=date&&today?(date.y-today.y)*monthsPerYear+date.m-today.m:0;
                    this.eventLimit=Number.MAX_SAFE_INTEGER;this.render(true);return;
                }
                if(button.dataset.person){this.selectedPerson=button.dataset.person;this.render();return;}
                if(a==='close')this.close();
                else if(a==='run'){
                    if(this.busy){if(!this.committing){this.cancel();this.status='已请求停止';this.render();}}
                    else this.run().catch(()=>{});
                }
                else if(a==='cancel'){this.cancel();this.status='已请求停止';this.render();}
                else if(a==='save'){
                    const settings=this.readPromptEditor();
                    this.applyPromptSettings(settings);
                    this.promptDraft=null;
                    this.status='提示词与资料范围已保存';
                    this.panel.querySelector('footer span').textContent=this.status;
                }
                else if(a==='prompt-edit'){
                    this.promptEditing=!this.promptEditing;
                    button.textContent=this.promptEditing?'锁定编辑':'开启编辑';button.setAttribute('aria-pressed',String(this.promptEditing));
                    this.panel.querySelectorAll('[data-segment-title],[data-segment],[data-structure-prompt]').forEach(el=>el.readOnly=!this.promptEditing);
                    this.panel.querySelectorAll('[data-action^="segment-"]').forEach(el=>el.disabled=!this.promptEditing);
                }
                else if(a==='save-default'){
                    const settings=this.readPromptEditor();this.applyPromptSettings(settings);
                    this.config.userDefaultPromptSettings=copy(settings);
                    const docs=this.getPromptDocuments();
                    let doc=docs.find(d=>d.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                    const now=new Date().toISOString();
                    if(doc){doc.settings=copy(settings);doc.updatedAt=now;}
                    else docs.push({id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,name:'个人默认设置',createdAt:now,updatedAt:now,settings:copy(settings)});
                    this.config.activePromptDocumentId=USER_DEFAULT_PROMPT_DOCUMENT_ID;
                    this.saveConfig();this.status='已保存为个人默认设置';this.panel.querySelector('footer span').textContent=this.status;
                }
                else if(a==='segment-add'){
                    if(!this.promptEditing)return;
                    const list=this.panel.querySelector('[data-segment-list]');if(!list)return;
                    const row=this.host.document.createElement('details');row.open=true;row.className='we-segment';row.setAttribute('data-segment-row','');
                    row.innerHTML='<summary>新分段</summary><div class="we-segment-head"><input data-segment-title aria-label="分段标题" placeholder="分段标题（可留空）"><small>新分段</small><span class="we-segment-actions"><button type="button" data-action="segment-up" title="上移">↑</button><button type="button" data-action="segment-down" title="下移">↓</button><button type="button" data-action="segment-delete" title="删除">删除</button></span></div><textarea data-segment data-title="" aria-label="新分段正文" placeholder="输入这一段的提示词正文…"></textarea>';
                    list.appendChild(row);row.querySelector('[data-segment-title]').focus();
                }
                else if(a==='segment-up'||a==='segment-down'){
                    if(!this.promptEditing)return;
                    const row=button.closest('[data-segment-row]'),parent=row?.parentElement;if(!row||!parent)return;
                    if(a==='segment-up'&&row.previousElementSibling)parent.insertBefore(row,row.previousElementSibling);
                    if(a==='segment-down'&&row.nextElementSibling)parent.insertBefore(row.nextElementSibling,row);
                }
                else if(a==='segment-delete'){if(!this.promptEditing)return;button.closest('[data-segment-row]')?.remove();}
                else if(a==='doc-save'){
                    try{
                        const settings=this.readPromptEditor(),name=this.panel.querySelector('[data-doc-name]')?.value||'';
                        this.applyPromptSettings(settings);
                        const doc=this.savePromptDocument(name,settings);this.promptDraft=null;
                        this.status='已保存预设文档：'+doc.name;this.render(true);
                    }catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                }
                else if(a==='doc-apply'){
                    const doc=this.getPromptDocuments().find(item=>item.id===button.dataset.docId);if(!doc)return;
                    this.applyPromptSettings(doc.settings);this.config.activePromptDocumentId=doc.id;
                    if(doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                        this.config.builtinDefaultWorldbookExclusionsApplied=[];
                        this.applyBuiltinDefaultWorldbookExclusions(this.bookCatalogue||[]);
                    }
                    this.saveConfig();this.promptDraft=null;
                    this.status='已应用预设文档：'+doc.name+(Array.isArray(doc.settings?.selectedEntries)&&!(this.bookCatalogue||[]).length?' · 世界书勾选将在加载目录后显示':'');
                    this.render(true);
                }
                else if(a==='doc-export'){
                    try{this.exportPromptDocument(button.dataset.docId);this.status='预设文档已导出';this.panel.querySelector('footer span').textContent=this.status;}
                    catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                }
                else if(a==='doc-delete'){
                    this.promptDraft=this.readPromptEditor();
                    const doc=this.getPromptDocuments().find(item=>item.id===button.dataset.docId);
                    if(this.deletePromptDocument(button.dataset.docId)){this.status='已删除预设文档'+(doc?'：'+doc.name:'');this.render(true);}
                }
                else if(a==='doc-import'){
                    this.promptDraft=this.readPromptEditor();
                    const input=this.panel.querySelector('[data-doc-import]');if(input){input.value='';input.click();}
                }
                else if(a==='books'){
                    this.promptDraft=this.readPromptEditor();
                    this.catalogue().then(list=>{this.bookCatalogue=list;this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(a==='book-all'||a==='book-none'){this.panel.querySelectorAll('[data-book]').forEach(e=>{e.checked=a==='book-all'&&!e.disabled;});}
                else if(a==='preview'){
                    const settings=this.tab==='提示词预设'?this.readPromptEditor():null;
                    if(settings)this.applyPromptSettings(settings);
                    this.promptDraft=null;
                    this.buildRequest(this.snapshot()).then(r=>{this.previewRequest=r;this.tab='请求检查';this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(button.dataset.fontOption){
                    const scale=button.dataset.fontOption;
                    if(WORLD_FONT_SCALES[scale]){this.config.fontScale=scale;this.panel.dataset.fontScale=scale;this.saveConfig();this.status='界面字号已切换为 '+WORLD_FONT_SCALES[scale].name;this.render(true);}
                }
                else if(a==='dedicated-toggle'){
                    this.cancel();
                    const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
                    api.enabled=!api.enabled;this.config.dedicatedApi=api;
                    if(!api.enabled&&this.isConfigured()){
                        const terminal=this.host.Samsara&&this.host.Samsara.terminal;
                        if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
                    }
                    this.saveConfig();
                    this.status=api.enabled?'已启用世界推进专属 API · 不再使用主神终端 API':'已关闭专属 API · 回退使用主神终端 API';
                    this.render(true);
                }
                else if(a==='dedicated-models'){
                    this.status='正在加载专属 API 模型列表';this.panel.querySelector('footer span').textContent=this.status;
                    this.fetchDedicatedModels().then(list=>{this.status='已加载 '+list.length+' 个模型';this.render(true);}).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;});
                }
                else if(a==='dedicated-preset-save'){
                    try{
                        const name=this.panel.querySelector('[data-dedicated-preset-name]')?.value||'';
                        const entry=this.saveDedicatedApiPreset(name);
                        this.status='已保存 API 预设：'+entry.name;this.render(true);
                    }catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                }
                else if(a==='dedicated-preset-delete'){
                    const name=this.panel.querySelector('[data-dedicated-preset]')?.value||'';
                    if(!name){this.status='请先选择要删除的 API 预设';this.panel.querySelector('footer span').textContent=this.status;}
                    else if(this.deleteDedicatedApiPreset(name)){this.status='已删除 API 预设：'+name;this.render(true);}
                }
                else if(a==='month'){
                    this.monthOffset=(this.monthOffset||0)+Number(button.dataset.step);
                    const world=this.snapshot().stat.世界,calendar=world.历法,today=calendarDate(world.时间,calendar);
                    if(today){
                        const custom=Array.isArray(calendar?.月份天数)?calendar.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                        if(custom.length){
                            let y=today.y,m=today.m+this.monthOffset;
                            while(m<1){m+=custom.length;y--;}
                            while(m>custom.length){m-=custom.length;y++;}
                            this.selectedDate=y+'-'+m+'-1';
                        }else{
                            const date=new Date(0);date.setFullYear(today.y,today.m-1+this.monthOffset,1);
                            this.selectedDate=date.getFullYear()+'-'+(date.getMonth()+1)+'-1';
                        }
                    }
                    this.calendarMode='date';this.eventLimit=12;this.render();
                }
                else if(a==='date'){this.selectedDate=button.dataset.date;this.calendarMode='date';this.eventLimit=12;this.render();}
                else if(a==='clear-date'){this.selectedDate='';this.calendarMode='all';this.eventLimit=12;this.render();}
                else if(a==='today'){this.selectedDate=undefined;this.calendarMode='today';this.monthOffset=0;this.eventLimit=12;this.render();}
                else if(a==='undated'){this.selectedDate='';this.calendarMode='undated';this.eventLimit=12;this.render();}
                else if(a==='more-events'){this.eventLimit=(this.eventLimit||12)+12;this.render();}
                else if(button.dataset.filter){this.filter=button.dataset.filter;this.render();}
                else if(button.dataset.tab){this.tab=button.dataset.tab;this.filter='全部';this.query='';this.selectedDate=undefined;this.calendarMode='today';this.monthOffset=0;this.eventLimit=12;this.render(true);}
            });
            this.panel.addEventListener('input',event=>{
                if(event.target.matches('[data-search]')){
                    const caret=event.target.selectionStart;this.query=event.target.value;this.render();
                    const input=this.panel.querySelector('[data-search]');input.focus();input.setSelectionRange(caret,caret);
                }else if(event.target.matches('[data-segment-title]')){
                    const row=event.target.closest('[data-segment-row]'),body=row?.querySelector('[data-segment]');
                    if(body)body.dataset.title=cleanSegmentTitle(event.target.value);
                }
            });
            this.panel.addEventListener('change',event=>{
                if(event.target.matches('[data-retries]')){
                    const value=Math.max(1,Math.min(5,Number(event.target.value)||1));
                    this.config.retryAttempts=value;event.target.value=value;this.saveConfig();
                    this.status='最大尝试次数已设为 '+value+' 次';
                    this.panel.querySelector('footer span').textContent=this.status;
                }else if(event.target.matches('[data-doc-import]')){
                    const input=event.target,file=input.files&&input.files[0];if(!file)return;
                    Promise.resolve(file.text()).then(raw=>{
                        const doc=this.importPromptDocument(raw);
                        this.status='已导入预设文档：'+doc.name;this.render(true);
                    }).catch(e=>{this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}).finally(()=>{input.value='';});
                }
                else if(event.target.matches('[data-dedicated-field]')){
                    const field=event.target.dataset.dedicatedField,value=event.target.value||'';
                    if(['apiUrl','apiKey','model'].includes(field)){
                        this.setDedicatedApi({[field]:value});
                        this.status='专属 API 配置已保存';this.panel.querySelector('footer span').textContent=this.status;
                    }
                }
                else if(event.target.matches('[data-dedicated-preset]')){
                    const name=event.target.value||'';
                    if(name){
                        try{this.applyDedicatedApiPreset(name);this.status='已应用 API 预设：'+name;this.render(true);}
                        catch(e){this.status=e.message;this.panel.querySelector('footer span').textContent=this.status;}
                    }
                }
            });
            isolated.appendChild(this.panel);
            doc.body.appendChild(this.mount);
        }
        render(force) {
            if(!this.isOpen())return;
            let snapshot,state=emptyState(),reason='';
            try{
                snapshot=this.snapshot();
                snapshot.stat.世界[PATH]=Object.assign(emptyState(),snapshot.stat.世界[PATH]||{});
                normalizeBackendState(snapshot.stat);normalizeEventLayers(snapshot.stat);repairCausalProjection(snapshot.stat);
                state=Object.assign(state,snapshot.stat.世界[PATH]||{});
                reason=this.blocked(snapshot);
            }catch(e){reason=e.message;}
            const s=snapshot?snapshot.stat:{},w=s.世界||{},orbit=w.因果轨道||{};
            this.syncStatusTone();
            this.panel.dataset.fontScale=this.config.fontScale||'standard';
            if(this.tab==='总览')this.tab='世界推进';
            const main=this.panel.querySelector('main'),scroll=main.scrollTop;
            const opened=new Set(Array.from(main.querySelectorAll('details[open]')).map(d=>d.dataset.detail));
            this.panel.querySelector('footer span').textContent=this.status;
            const availabilityReason=this.isConfigured()&&!this.isAvailable()
                ?(this.usesDedicatedApi()?'专属 API 未准备好：请在「设置」中填写 API 地址并选择模型':'主神终端额外模型未准备好：请在主神终端设置中配置 API 地址并选择模型')
                :'';
            const runButton=this.panel.querySelector('[data-action=run]');
            const stopping=this.busy&&!!this.controller?.signal.aborted;
            runButton.disabled=this.busy?(this.committing||stopping):!!reason||!!availabilityReason;
            runButton.textContent=this.busy?(this.committing?'保存中…':stopping?'停止中…':'停止推进'):'推进世界';
            runButton.setAttribute('aria-label',runButton.textContent);

            const tabs=[['世界推进','◈'],['角色管理','♙'],['探索与势力','⌖'],['世界事件','▤'],['传闻','◎'],['提示词预设','✎'],['请求检查','⌕'],['运行记录','≋'],['设置','⚙']];
            this.panel.querySelector('nav').innerHTML='<div class="we-navtitle">世界档案</div>'+tabs.map(([t,i])=>'<button data-tab="'+t+'" aria-selected="'+(this.tab===t)+'"><span class="we-tab-icon" aria-hidden="true">'+i+'</span>'+t+'</button>').join('');
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
            const parseDate=value=>calendarDate(value,w.历法);
            const contextKey=JSON.stringify([snapshot?.fingerprint?JSON.parse(snapshot.fingerprint)[0]:null,w.名称]);
            if(this.calendarContext!==contextKey){this.calendarContext=contextKey;this.selectedDate=undefined;this.calendarMode="today";this.monthOffset=0;}
            if(this.selectedDate===undefined||this.calendarMode==="today")this.selectedDate=parseDate(w.时间)?.key||"";
            if(this.calendarMode==='date'){
                const anchor=parseDate(w.时间),selected=parseDate(this.selectedDate);
                const monthsPerYear=Array.isArray(w.历法?.月份天数)&&w.历法.月份天数.length?w.历法.月份天数.length:12;
                if(anchor&&selected)this.monthOffset=(selected.y-anchor.y)*monthsPerYear+selected.m-anchor.m;
            }
            const dateLabel=str=>{const d=parseDate(str);return d?d.m+'月'+d.d+'日':str||'时间待补';};
            const events=sortWorldEvents(state.事件,orbit);
            const active=events.filter(([,e])=>e.状态==='进行中'),future=events.filter(([,e])=>e.状态==='待发生');
            const relationRoster=s.关系列表||{};
            const relationNamesByKey=new Map(entries(relationRoster).map(([name])=>[nameKey(name),name]));
            const peopleAll=new Map(entries(state.人物));entries(relationRoster).forEach(([n,p])=>{if(!peopleAll.has(n))peopleAll.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const userName=String(this.host.SillyTavern?.name1||this.env.SillyTavern?.name1||this.host.SillyTavern?.getContext?.()?.name1||this.host.name1||'').trim();
            const playerAliases=new Set([userName,'{{user}}','<user>','玩家'].filter(Boolean).map(nameKey));
            const deadAlienAliases=new Set(entries(w.异端雷达?.名单).filter(([,alien])=>alien?.状态==='死亡').map(([name])=>nameKey(name)));
            const people=new Map(Array.from(peopleAll).filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name))));
            const formalPeople=new Map(entries(relationRoster)
                .filter(([name])=>!playerAliases.has(nameKey(name))&&!deadAlienAliases.has(nameKey(name)))
                .map(([name,rel])=>{
                    const backend=Array.from(people).find(([otherName])=>nameKey(otherName)===nameKey(name))?.[1];
                    return [name,backend||{状态:rel.在场?'在场':'场外',公开动态:rel.态度||'',地点:'',目标:'',行动:''}];
                }));
            const backstagePeople=Array.from(people).filter(([name])=>!relationNamesByKey.has(nameKey(name)));
            const person=(name,p,full=false)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                return '<article class="'+(full?'we-card':'we-person')+'">'+(!full?'<div class="we-avatar">'+text(name.slice(0,1))+'</div>':'')+'<div><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(p.状态||(rel.在场?'在场':'场外'),'dim')+'</div><p>'+text(p.行动||p.公开动态||rel.态度||'尚无行动记录')+'</p><div class="we-meta"><span>⌖ '+text(p.地点||'地点未明')+'</span>'+(p.预计结束?'<span>至 '+text(dateLabel(p.预计结束))+'</span>':'')+'</div>'+(full?fields({档案类型:profileName?'正式关系人物':'世界活动人物',目标:p.目标,当前时间段:[p.开始时间,p.预计结束].filter(Boolean).join(' → '),下次检查:p.下次检查,所属世界:p.所属世界,好感度:rel.好感度})+details('person-'+name,{行程:p.行程,认知:p.认知,认知来源:p.认知来源,登场条件:p.登场条件,关联事件:p.关联事件,更新时间:p.更新时间,人物背景:rel.背景故事},'行程 · 认知 · 关联事件'):'')+'</div></article>';
            };
            const compactPerson=(name,p)=>{
                const profileName=relationNamesByKey.get(nameKey(name))||'';
                const rel=profileName?relationRoster[profileName]||{}:{};
                const targetName=profileName||name;
                const inner='<span class="we-avatar">'+text(name.slice(0,1))+'</span><span class="we-person-copy"><strong>'+text(name)+'</strong><small>'+text(p.地点||'地点未明')+'</small><em>'+text(p.行动||p.公开动态||rel.态度||'暂无新动态')+'</em></span>';
                return '<button class="we-person-compact" data-jump-person="'+text(targetName)+'" title="'+text(profileName?'查看正式人物档案':'查看世界人物动态；不会创建关系列表档案')+'">'+inner+'</button>';
            };
            const contextRows=context=>{
                const rows=[];
                for(const link of context?.背景关联||[])rows.push('<div class="we-context-row"><span class="we-context-kind">'+text(link.类型||'关联')+'</span><span class="we-context-copy"><b>'+text(link.名称||'未命名关联')+'</b><small>'+text(link.关系||'持续关联')+'</small></span></div>');
                for(const eventName of context?.关联事件||[])rows.push('<button class="we-context-row" data-jump-event="'+text(eventName)+'"><span class="we-context-kind">事件</span><span class="we-context-copy"><b>'+text(eventName)+'</b><small>查看关联世界事件 →</small></span></button>');
                return rows.length?'<div class="we-context-list">'+rows.join('')+'</div>':empty('暂无背景关联','世界引擎只记录持续的组织/社交关系与事件关联，不重复人物背景故事。');
            };
            const sceneLane=(title,items,kind)=>{
                const list=Array.isArray(items)?items:[];
                const body=list.map(item=>{
                    if(kind==='person'){
                        const meta=[item.关系,item.身份,item.档案类型||'世界人物'].filter(Boolean).join(' · ');
                        const inner='<b>'+text(item.名称)+'</b><small>'+text(meta||'现场标签')+'</small>'+(item.行动?'<p>'+text(item.行动)+'</p>':'');
                        return item.可查看档案&&item.档案名称
                            ?'<button class="we-scene-item" data-jump-person="'+text(item.档案名称)+'">'+inner+'</button>'
                            :'<article class="we-scene-item we-scene-label">'+inner+'</article>';
                    }
                    if(kind==='group')return '<article class="we-scene-item"><b>'+text(item.名称||'未命名群体')+'</b><small>'+text([item.规模,item.身份].filter(Boolean).join(' · ')||'现场群体')+'</small>'+(item.动态?'<p>'+text(item.动态)+'</p>':'')+'</article>';
                    return '';
                }).join('');
                return '<div class="we-scene-lane"><div class="we-scene-lane-head"><b>'+text(title)+'</b><span>'+list.length+'</span></div>'+(body||'<div class="we-muted">暂无记录</div>')+'</div>';
            };
            const sceneContextBody=context=>{
                const hasScene=!!(context&&(context.地区||context.身边人物?.length||context.现场群体?.length));
                if(!hasScene)return empty('暂无身边发展','人物尚未匹配到可用的地区现场；不会为填充面板而虚构周边信息。');
                const control=[context.控制方?'控制 · '+context.控制方:'',context.争夺方?.length?'争夺 · '+context.争夺方.join('、'):''].filter(Boolean).join(' · ');
                return '<div class="we-scene-hero"><div class="we-scene-head"><div><small>当前世界现场</small><h3>'+text(context.地区||'未命名地区')+'</h3></div><small>'+text(control||'控制关系未记录')+'</small></div>'+(context.地区动态?'<p>'+text(context.地区动态)+'</p>':'')+(context.环境状态?.length?'<div class="we-chips">'+context.环境状态.map(x=>pill(x,'dim')).join('')+'</div>':'')+'</div><div class="we-scene-grid">'+sceneLane('身边人物',context.身边人物,'person')+sceneLane('现场群体',context.现场群体,'group')+'</div>';
            };
            const areaSceneBody=record=>{
                const groups=Array.isArray(record?.现场群体)?record.现场群体:[];
                if(!groups.length)return '';
                return sceneLane('现场群体',groups,'group');
            };
            const eventCard=(name,e)=>'<article class="we-card" data-event-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3><div class="we-card-tags">'+pill(e.分类||'近期节点',e.分类==='宏观节点'?'future':'dim')+pill(e.状态,e.状态==='待发生'?'future':e.状态==='进行中'?'':'dim')+'</div></div><div class="we-meta"><span>◷ '+text(eventScheduleLabel(e))+'</span><span>⌖ '+text(e.地点||'地点未明')+'</span></div><p>'+text(e.公开征兆||e.描述||'等待明确事件内容')+'</p>'+details('event-'+name,{事件描述:e.描述,分类:e.分类,前因:e.前因,触发条件:e.条件,参与者:e.参与者,预计结束:e.预计结束,下次检查:e.下次检查,可见影响:e.可见影响,默认走向:e.默认走向,已确认结果:e.结果,更新时间:e.更新时间},'因果关联与事件详情')+'</article>';
            const timelineCards=list=>{
                const groups=[
                    ['当前进行',list.filter(([,e])=>e.状态==='进行中'||(e.状态==='待发生'&&e.分类==='当前事件'))],
                    ['近期桥接',list.filter(([,e])=>e.状态!=='进行中'&&e.状态==='待发生'&&e.分类==='近期节点')],
                    ['宏观锚点',list.filter(([,e])=>e.状态!=='进行中'&&e.状态==='待发生'&&e.分类==='宏观节点')],
                    ['已结束',list.filter(([,e])=>['已完成','已取消'].includes(e.状态))]
                ];
                const assigned=new Set(groups.flatMap(([,items])=>items.map(([name])=>name)));
                groups.push(['待归类记录',list.filter(([name])=>!assigned.has(name))]);
                return groups.filter(([,items])=>items.length).map(([title,items])=>'<div class="we-timeline-group"><div class="we-timeline-group-title">'+text(title)+'<small>'+items.length+'</small></div>'+items.map(([n,e])=>eventCard(n,e)).join('')+'</div>').join('');
            };
            const matched=(name,obj)=>!this.query||(name+' '+Object.values(obj).filter(v=>typeof v==='string').join(' ')).toLowerCase().includes(this.query.toLowerCase());
            const calendarCandidates=events.filter(([n,e])=>matched(n,e)&&((this.filter||'全部')==='全部'||e.状态===this.filter));
            const tools=(filters=[])=>'<div class="we-tools"><input data-search aria-label="搜索档案" placeholder="搜索名称、地点或内容…" value="'+text(this.query||'')+'">'+filters.map(f=>'<button data-filter="'+f+'" class="'+((this.filter||'全部')===f?'active':'')+'">'+f+'</button>').join('')+'</div>';
            const calendar=()=>{
                const today=parseDate(w.时间);
                if(!today){const semantic=events.filter(([,e])=>!parseDate(e.时间||e.开始时间)&&String(e.时间||e.开始时间||'').trim()).slice(0,12);return '<div class="we-calendar"><h3>作品内时间轴</h3><p class="we-muted">当前锚点 · '+text(w.时间||'尚无副本时间')+'</p>'+(semantic.length?'<div class="we-timeline">'+semantic.map(([n,e])=>'<p><b>'+text(e.时间||e.开始时间)+'</b><br>'+text(n)+'</p>').join('')+'</div>':'<p class="we-muted">暂无带作品内时间标记的事件</p>')+'</div>';}
                const customMonths=Array.isArray(w.历法?.月份天数)?w.历法.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                let y=today.y,m=today.m+(this.monthOffset||0),first=0,count=0;
                if(customMonths.length){
                    while(m<1){m+=customMonths.length;y--;}
                    while(m>customMonths.length){m-=customMonths.length;y++;}
                    count=customMonths[m-1];
                }else{
                    const month=new Date(0);month.setFullYear(today.y,today.m-1+(this.monthOffset||0),1);month.setHours(0,0,0,0);
                    y=month.getFullYear();m=month.getMonth()+1;first=(month.getDay()+6)%7;
                    const last=new Date(month);last.setMonth(last.getMonth()+1,0);count=last.getDate();
                }
                const marked=new Map();
                calendarCandidates.forEach(([,e])=>{const key=parseDate(e.时间||e.开始时间)?.key;if(key)marked.set(key,(marked.get(key)||0)+1);});
                let cells=['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'<span></span>'.repeat(first);
                for(let d=1;d<=count;d++){const key=y+'-'+m+'-'+d;cells+='<button data-action="date" data-date="'+key+'" aria-label="'+key+'" aria-pressed="'+(this.selectedDate===key)+'" title="'+key+' · '+(marked.get(key)||0)+' 个匹配事件" class="'+(today.key===key?'today ':'')+(marked.has(key)?'has-event ':'')+(this.selectedDate===key?'selected':'')+'">'+d+'</button>';}
                return '<div class="we-calendar"><div class="we-calhead"><button class="we-btn" data-action="month" data-step="-1" aria-label="上月">‹</button><strong>'+y+' 年 '+m+' 月</strong><button class="we-btn" data-action="month" data-step="1" aria-label="下月">›</button></div><div class="we-days">'+cells+'</div><div class="we-meta"><span>'+text(customMonths.length?(w.历法?.名称||'作品历法')+' · 本月 '+count+' 天':'公历显示 · 本月 '+count+' 天')+'</span><span>金框 · 当前日期</span><span>绿点 · 已排定事件</span></div></div>';
            };
            const radar=w.异端雷达||{};
            const alienAlive=entries(radar.名单).filter(([,a])=>a&&a.状态!=='死亡').length;
            const showRadar=!(s.设置||{}).单一世界&&!(s.系统状态||{}).是否在主神空间;
            const prose=v=>'<div class="we-reading">'+(Array.isArray(v)?v:[v]).map((paragraph,i)=>'<article>'+(Array.isArray(v)?'<small>法则 '+(i+1)+'</small>':'')+'<p>'+text(paragraph)+'</p></article>').join('')+'</div>';
            const hero='<div class="we-hero"><div><div class="we-eyebrow">SAMSARA / WORLD ARCHIVE</div><h1>'+text(w.名称&&w.名称!=='待初始化'?w.名称:'世界尚未建立')+'</h1><div class="we-world-ranks"><span>位格 <b>'+text(w.位格||'未记录')+'</b></span><span>难度 <b>'+text(w.难度||'未记录')+'</b></span></div><div class="we-muted">'+text(w.地点||'地点待确认')+' · '+text(orbit.当前阶段&&orbit.当前阶段!=='待初始化'?orbit.当前阶段:'等待篇章开启')+'</div></div><div class="we-date">'+text(w.时间||'副本日期待确认')+'<small>累计游玩 '+text((s.系统状态||{}).游玩天数||0)+' 天 · '+(reason?'推进暂停':'副本进行中')+'</small></div></div>';
            let html=hero+(reason?'<div class="we-notice">'+text(reason)+'</div>':'')+(availabilityReason?'<div class="we-notice">'+text(availabilityReason)+'</div>':'');
            if(this.tab==='世界推进'){
                const offsets=entries(orbit.偏移记录);
                const stable=w.稳定!==null&&w.稳定!==''&&Number.isFinite(Number(w.稳定))?Number(w.稳定):null;
                const signed=n=>(n>0?'+':'')+n;
                const offsetCard=([name,r])=>{
                    const impact=r?.影响程度!==null&&r?.影响程度!==''&&Number.isFinite(Number(r?.影响程度))?Number(r.影响程度):null;
                    return '<article class="we-offset"><div class="we-offset-head"><b>'+text(name)+'</b><span>'+text(impact===null?'影响未记录':signed(impact))+'</span></div><p>'+text(r?.描述||'暂无偏移描述')+'</p><small>引发者 · '+text(r?.引发者||'未记录')+' · '+(impact===null?'待确认':impact<0?'偏离原轨道':impact>0?'修复 / 强化原轨道':'无数值变化')+'</small></article>';
                };
                const causalHtml='<div class="we-causal"><div class="we-stability"><div><small>世界稳定值</small><strong data-world-stability>'+text(stable===null?'未记录':stable)+'</strong></div><span>'+((s.设置||{}).世界超稳?'世界超稳 · 禁止新增偏移':'原轨道基准 100')+'</span></div>'
                    +(stable===null?'':'<meter min="0" max="120" value="'+Math.max(0,Math.min(120,stable))+'" aria-label="世界稳定值">'+stable+'</meter>')
                    +'<p class="we-muted">读取当前变量，不在面板重算。负向偏移使原轨道更不稳定，正向偏移修复或强化原轨道。</p>'
                    +'<div class="we-offset-heading">偏移记录 <span>'+offsets.length+' 条</span></div>'
                    +(offsets.length?offsets.slice(0,3).map(offsetCard).join('')+(offsets.length>3?'<details class="we-offset-more"><summary>展开其余 '+(offsets.length-3)+' 条偏移</summary>'+offsets.slice(3).map(offsetCard).join('')+'</details>':''):empty('暂无因果偏移','关键人物命运、重大事件或势力格局实质改变后记录。'))+'</div>';
                const shown=calendarCandidates.filter(([,e])=>this.calendarMode==='undated'?!parseDate(e.时间||e.开始时间):!this.selectedDate||parseDate(e.时间||e.开始时间)?.key===this.selectedDate);
                const macroCount=events.filter(([,e])=>e.分类==='宏观节点').length;
                const timelineView=snapshot?timelineState(s):null;
                const nextMacroName=timelineView?.下一宏观节点?.名称||'';
                const nextPair=nextMacroName?events.find(([n,e])=>n===nextMacroName&&e.分类==='宏观节点')||null:null;
                const nextNode=nextPair?.[0]||'等待宏观节点';
                const nextEvent=nextPair?.[1]||null;
                const compactPeople=Array.from(people).filter(([,p])=>p.行动||p.公开动态||p.地点).slice(0,4);
                html+='<div class="we-world-focus">'
                    +'<div class="we-world-focus-main">'+section('世界动向',orbit.当前阶段&&orbit.当前阶段!=='待初始化'?'<div class="we-pulse"><span class="we-pulse-mark">LIVE</span><p>'+text(orbit.当前阶段)+'</p></div>':empty('阶段待确认','世界推进会把当前世界局势直接写入因果轨道.当前阶段。'),'因果轨道 · 当前阶段')+'</div>'
                    +'<div class="we-world-focus-next">'+section('下一宏观节点',(nextEvent?'<button class="we-next-node" data-jump-event="'+text(nextNode)+'" title="点击定位到时间线中的对应宏观事件">':'<div class="we-next-node">')+'<span>→</span><div><h3>'+text(nextNode)+'</h3><p>'+text(nextEvent?.公开征兆||nextEvent?.描述||'本轮需要先建立真实宏观节点')+'</p><small>'+text(nextEvent?.时间||nextEvent?.开始时间||'时间待确认')+(nextEvent?' · 点击定位 →':'')+'</small></div>'+(nextEvent?'</button>':'</div>'),'因果边界')+'</div>'
                    +'</div>';
                html+='<div class="we-kpi-grid we-kpi-compact">'
                    +'<div class="we-kpi"><small>正在发生</small><strong>'+active.length+'</strong><span>当前活动事件</span></div>'
                    +'<div class="we-kpi"><small>近期桥接</small><strong>'+events.filter(([,e])=>e.分类==='近期节点'&&e.状态==='待发生').length+'</strong><span>下一宏观边界之前</span></div>'
                    +'<div class="we-kpi"><small>宏观锚点</small><strong>'+macroCount+'</strong><span>'+text(orbit.当前阶段||'阶段待确认')+'</span></div>'
                    +'<div class="we-kpi"><small>场外人物</small><strong>'+people.size+'</strong><span>'+future.length+' 个未来事件</span></div>'
                    +'</div>';
                html+='<div class="we-dashboard"><div class="we-command-main">'
                    +'<section class="we-section we-timeline-board" data-detail="world-calendar"><div class="we-section-head"><h2>事件时间线</h2><small>'+events.length+' 事件 · '+future.length+' 未来 · '+macroCount+' 宏观</small></div><div class="we-calendar-layout"><div class="we-calendar-slot">'+calendar()+'</div><div class="we-timeline-slot">'+tools(['全部','进行中','待发生','已完成','已取消'])+'<div class="we-tools"><span>'+text(this.calendarMode==='undated'?'未定日 / 作品内时间':this.selectedDate||'全部日期')+'</span><button data-action="today">回到今天</button><button data-action="clear-date">全部日期</button><button data-action="undated">未定日事件</button></div>'+'<div class="we-timeline">'+(timelineCards(shown.slice(0,this.eventLimit||12))||empty('没有符合条件的事件'))+'</div>'+(shown.length>(this.eventLimit||12)?'<button class="we-btn" data-action="more-events">显示更多（共 '+shown.length+' 项）</button>':'')+'</div></div></section>'
                    +'</div><aside class="we-command-side">'
                    +section('货币与经济',exists(w.货币)?fields({货币体系:w.货币?.体系,购买力基准:w.货币?.购买力基准,经济波动:w.货币?.经济波动}):empty('尚无货币资料','世界推进会在设定或经济局势明确时维护。'),'世界推进维护')
                    +(exists(w.法则)?section('世界法则',prose(w.法则),'当前生效规则 · '+(Array.isArray(w.法则)?w.法则.length:1)+' 条'):'')
                    +section('因果状态',causalHtml,'稳定与轨道偏移')
                    +section('人物动向',(compactPeople.length?'<div class="we-people-strip">'+compactPeople.map(([n,p])=>compactPerson(n,p)).join('')+'</div><button class="we-link-btn" data-tab="角色管理">查看人物名册 →</button>':empty('暂无人物动态')),'重点 NPC')
                    +'</aside></div>';
            }else if(this.tab==='角色管理'){
                if(showRadar&&alienAlive>0)html+='<div class="we-meta we-alien-count">异端存活数量 <b>'+alienAlive+'</b></div>';

                const alienByKey=new Map(entries(radar.名单).map(([name,record])=>[nameKey(name),{名称:name,记录:record}]));
                const rolePeople=[
                    ...Array.from(formalPeople).map(([n,p])=>[n,p,{正式:true,异端:alienByKey.has(nameKey(n))}]),
                    ...backstagePeople.map(([n,p])=>[n,p,{正式:false,异端:alienByKey.has(nameKey(n))}])
                ];
                const list=rolePeople.filter(([n,p,meta])=>{
                    const searchable=meta.正式?Object.assign({},p,relationRoster[n]||{}):p;
                    if(!matched(n,searchable))return false;
                    if((this.filter||'全部')==='全部')return true;
                    const present=meta.正式&&!!relationRoster[n]?.在场;
                    return this.filter==='在场'?present:!present;
                });
                const chosen=list.find(([n])=>n===this.selectedPerson)||list[0];
                const chosenMeta=chosen?.[2]||{};
                const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
                const chosenRelation=chosenMeta.正式&&plain(relationRoster[chosen?.[0]])?relationRoster[chosen[0]]:null;
                const chosenAudit=chosenRelation?npcBuildAssessment(s,chosen[0],chosenRelation):null;
                const chosenAlien=chosen?alienByKey.get(nameKey(chosen[0]))?.记录:null;
                const auditPanel=chosenAudit?section('NPC构筑审计',
                    '<div class="we-card"><div class="we-card-top"><h3>'+text(chosenAudit.审计级别)+'</h3>'+pill(chosenAudit.缺口.length?'待补强':'构筑完整',chosenAudit.缺口.length?'future':'dim')+'</div>'
                    +fields({层级:chosenAudit.层级,当前组件:chosenAudit.当前组件})
                    +(chosenAudit.缺口.length?'<div class="we-chips">'+chosenAudit.缺口.map(x=>pill(x,'future')).join('')+'</div><p class="we-muted">进入世界推进请求的热人物会由后台优先补齐缺口；难度脚本只负责已有组件的品质调整。</p>':'<p class="we-muted">当前构筑已达到本层级审计最低要求。</p>')+'</div>',
                    '仅正式关系人物 · 复用NPC生成规则'
                ):'';
                const backgroundPanel=chosen?section('背景关联',contextRows(chosenContext),(chosenContext?.背景关联?.length||0)+' 关系 · '+(chosenContext?.关联事件?.length||0)+' 事件'):'';
                const surroundingsPanel=chosen?section('身边发展',sceneContextBody(chosenContext),'剧情推演现场标签 · 只读派生'):'';
                const alienPanel=chosenAlien?section('异端档案',fields({来源:chosenAlien.来源,经历:chosenAlien.经历,阵营:chosenAlien.阵营,职业:chosenAlien.职业,层级:chosenAlien.层级,状态:chosenAlien.状态}),'异端雷达 · 只读'):'';
                const formalCount=rolePeople.filter(([, ,meta])=>meta.正式).length;
                const worldCount=rolePeople.length-formalCount;
                const roster=list.length?'<div class="we-roster-list">'+list.map(([n,p,meta])=>{
                    const rel=meta.正式?relationRoster[n]||{}:{};
                    const present=meta.正式&&!!rel.在场;
                    const status=present?'在场':p.状态||'场外';
                    const source=meta.正式?'正式档案':meta.异端?'异端 · 世界人物':'世界人物';
                    const summary=p.行动||p.公开动态||rel.态度||'等待下一次世界推演';
                    return '<button class="we-roster-person '+(chosen?.[0]===n?'active':'')+'" data-person="'+text(n)+'"><span class="we-roster-copy"><b>'+text(n)+'</b><small>⌖ '+text(p.地点||'地点未明')+' · '+text(status)+'</small><em>'+text(summary)+'</em></span>'+pill(source,meta.异端?'future':'dim')+'</button>';
                }).join('')+'</div>':empty('没有符合条件的人物','调整筛选或等待世界人物进入活动范围。');
                html+=tools(['全部','在场','场外'])+'<div class="we-columns"><div>'
                    +section('人物名册',roster,'正式 '+formalCount+' · 世界人物 '+worldCount)
                    +(chosen?section('身份与当前行动',person(chosen[0],chosen[1],true),chosenMeta.正式?'正式关系人物':'世界后台人物')+surroundingsPanel+section('日程与行动',fields({行程:chosen[1].行程,开始时间:chosen[1].开始时间,预计结束:chosen[1].预计结束,下次检查:chosen[1].下次检查}))+auditPanel:empty('尚未选择人物'))
                    +'</div><aside>'+backgroundPanel+alienPanel+(chosen?[['情报',chosen[1].认知来源||chosen[1].认知],['近期动向',chosen[1].公开动态]].filter(([,v])=>exists(v)).map(([label,v])=>section(label,value(v))).join(''):'')+'</aside></div>';
            }else if(this.tab==='探索与势力'){
                const regionRecords=state.势力地区||{};
                const exploration=entries(w.探索).map(([name,ledger])=>[name,{...(regionRecords[name]||{}),...ledger,类型:'探索'}]);
                const factionList=entries(w.势力).map(([name,ledger])=>[name,{...(regionRecords[name]||{}),...ledger,类型:'势力'}]);
                const projectedNames=new Set([...exploration.map(([n])=>n),...factionList.map(([n])=>n)]);
                const backstageAreas=entries(regionRecords).filter(([name,r])=>r.类型!=='势力'&&!projectedNames.has(name));
                const dir=this.directoryTab||'探索';
                const progressStage=value=>{
                    const n=Math.max(0,Math.min(100,Number(value)||0));
                    if(n>=100)return '核心';
                    if(n>=90)return '掌控';
                    if(n>=60)return '深入';
                    if(n>=30)return '熟悉';
                    if(n>=10)return '浅尝';
                    return '无知';
                };
                const repStage=value=>{
                    const n=Number(value)||0;
                    if(n<=-5000)return '敌对';
                    if(n<=-1000)return '仇视';
                    if(n<500)return '冷淡';
                    if(n<2000)return '中立';
                    if(n<5000)return '友好';
                    if(n<10000)return '崇敬';
                    return '崇拜';
                };
                const riskRank=value=>Math.max(0,['F','E','D','C','B','A','S','SS','SSS'].indexOf(String(value||'F')));
                const totalProgress=exploration.reduce((sum,[,r])=>sum+(Number(r.探索度)||0),0);
                const deepCount=exploration.filter(([,r])=>(Number(r.探索度)||0)>=60).length;
                const highRiskCount=exploration.filter(([,r])=>riskRank(r.风险)>=4).length;
                const contestedCount=exploration.filter(([,r])=>Array.isArray(r.争夺方)?r.争夺方.length>0:!!r.争夺方).length;
                const chosenArea=exploration.find(([n])=>n===this.selectedArea)||exploration[0];
                const chosenFaction=factionList.find(([n])=>n===this.selectedFaction)||factionList[0];
                const factionWeight=factionList.reduce((sum,[,r])=>sum+Math.max(0,Number(r.声望)||0)/100,0);
                const friendlyCount=factionList.filter(([,r])=>(Number(r.声望)||0)>=2000).length;
                const hostileCount=factionList.filter(([,r])=>(Number(r.声望)||0)<=-1000).length;

                html+='<div class="we-notice">这里显示的是结算台账，不是地图数据库：只有 <b>世界.探索</b> 中的整体地标才计探索收益；后台尚未投影的地区不会出现在探索名录中。势力声望同样只记录势力对玩家的真实关系结算。</div>';
                html+='<div class="we-tools">'+['探索','热点','势力'].map(t=>'<button data-directory="'+t+'" class="'+(dir===t?'active':'')+'">'+t+'</button>').join('')+'</div>';

                if(dir==='探索'){
                    html+='<div class="we-ledger-strip">'
                        +'<div class="we-ledger-stat"><small>已记录地标</small><strong>'+exploration.length+'</strong><span>仅玩家已获得的探索台账</span></div>'
                        +'<div class="we-ledger-stat"><small>探索结算权重</small><strong>'+totalProgress+'%</strong><span>最终结算最多计入 300%</span></div>'
                        +'<div class="we-ledger-stat"><small>深入以上</small><strong>'+deepCount+'</strong><span>探索度 ≥ 60</span></div>'
                        +'<div class="we-ledger-stat"><small>高风险 / 争夺</small><strong>'+highRiskCount+' / '+contestedCount+'</strong><span>B级以上风险 · 存在争夺方</span></div>'
                        +'</div>';
                    const cards=exploration.map(([n,r])=>{
                        const progress=Math.max(0,Math.min(100,Number(r.探索度)||0));
                        const control=r.控制方||'控制权未明';
                        const environment=Array.isArray(r.环境状态)?(r.环境状态.length?r.环境状态.length+'项':'未记录'):r.环境状态||'未记录';
                        return '<button class="we-explore-card '+(chosenArea?.[0]===n?'active':'')+'" data-area="'+text(n)+'">'
                            +'<div class="we-explore-head"><div><small>探索地标</small><h3>'+text(n)+'</h3></div><span class="we-risk-badge">风险 '+text(r.风险||'F')+'</span></div>'
                            +'<div class="we-explore-score"><strong>'+progress+'<small>%</small></strong><span>'+text(progressStage(progress))+'</span></div>'
                            +'<div class="we-explore-bar"><i style="width:'+progress+'%"></i></div>'
                            +'<div class="we-explore-meta"><span>控制 · '+text(control)+'</span><span>环境 · '+text(environment)+'</span></div>'
                            +'<p>'+text(r.描述||r.公开动态||'尚无区域描述')+'</p>'
                            +'</button>';
                    }).join('');
                    const areaDetail=chosenArea?(()=>{
                        const [n,r]=chosenArea;
                        const backstage=regionRecords[n]||{};
                        return '<div class="we-area-detail"><div class="we-area-facts">'+fields({风险:r.风险,控制方:r.控制方||'未明',争夺方:r.争夺方,环境状态:r.环境状态})+'<div class="we-area-note">'+text(r.描述||'暂无已确认的玩家探索描述。')+'</div></div>'
                            +areaSceneBody(backstage)
                            +'<div class="we-area-archive">'+(exists(backstage.进展)||exists(backstage.公开动态)||exists(backstage.资源)||exists(backstage.近期变化)?details('area-world-'+n,{世界进展:backstage.进展,公开动态:backstage.公开动态,资源:backstage.资源,近期变化:backstage.近期变化},'世界地区档案'):'')
                            +(exists(r.隐藏真相)?details('area-truth-'+n,{隐藏真相:r.隐藏真相},'主持人档案'):'')+'</div></div>';
                    })():empty('暂无探索地标','只有已经投影到世界.探索的整体区域才会出现在这里。');
                    html+=section('探索结算名录','<div class="we-explore-grid we-explore-index">'+(cards||empty('暂无探索地标','等待玩家实际发现整体区域。'))+'</div>','总权重 '+totalProgress+'% · 结算上限 300%');
                    html+=section('区域档案',areaDetail,'地区现场与后台档案 · 点击上方地标切换');
                    if(backstageAreas.length){
                        html+=section('后台未投影地区','<details><summary>'+backstageAreas.length+' 个世界地区尚未计入玩家探索奖励</summary>'+backstageAreas.map(([n,r])=>'<div class="we-brief-row"><b>'+text(n)+'</b><span>'+text(r.进展||r.公开动态||r.描述||'后台运行中')+'</span></div>').join('')+'</details>','仅主持人参考 · 不计探索收益');
                    }
                }else if(dir==='热点'){
                    const hotspots=events.filter(([,e])=>e.状态==='进行中');
                    html+='<div class="we-ledger-strip">'
                        +'<div class="we-ledger-stat"><small>进行中热点</small><strong>'+hotspots.length+'</strong><span>当前世界正在发生</span></div>'
                        +'<div class="we-ledger-stat"><small>涉及已探索地标</small><strong>'+hotspots.filter(([,e])=>exploration.some(([n])=>String(e.地点||'').includes(n))).length+'</strong><span>可直接关联探索台账</span></div>'
                        +'<div class="we-ledger-stat"><small>近期桥接</small><strong>'+events.filter(([,e])=>e.分类==='近期节点'&&e.状态==='待发生').length+'</strong><span>当前到下一宏观节点</span></div>'
                        +'<div class="we-ledger-stat"><small>宏观节点</small><strong>'+events.filter(([,e])=>e.分类==='宏观节点'&&e.状态==='待发生').length+'</strong><span>未来边界</span></div>'
                        +'</div>';
                    html+=section('当前热点',hotspots.map(([n,e])=>eventCard(n,e)).join('')||empty('暂无进行中的热点','世界当前没有进行中的事件。'));
                }else{
                    html+='<div class="we-ledger-strip">'
                        +'<div class="we-ledger-stat"><small>已知势力</small><strong>'+factionList.length+'</strong><span>进入声望结算台账</span></div>'
                        +'<div class="we-ledger-stat"><small>声望结算权重</small><strong>'+Math.min(3,factionWeight).toFixed(1)+'×</strong><span>仅正声望 ÷ 100 汇总 · 上限 300%</span></div>'
                        +'<div class="we-ledger-stat"><small>友好以上</small><strong>'+friendlyCount+'</strong><span>声望 ≥ 2000</span></div>'
                        +'<div class="we-ledger-stat"><small>仇视以上</small><strong>'+hostileCount+'</strong><span>声望 ≤ -1000</span></div>'
                        +'</div>';
                    const factionCards=factionList.map(([n,r])=>{
                        const rep=Number(r.声望)||0,stage=repStage(rep),width=Math.min(100,Math.max(0,rep)/100);
                        return '<button class="we-faction-card '+(chosenFaction?.[0]===n?'active':'')+'" data-faction="'+text(n)+'"><div class="we-card-top"><h3>'+text(n)+'</h3><span class="we-risk-badge">实力 '+text(r.实力||'F')+'</span></div>'
                            +'<div class="we-rep"><span>声望 '+rep+'</span><b>'+text(stage)+'</b></div><div class="we-explore-bar"><i style="width:'+width+'%"></i></div>'
                            +'<div class="we-muted">'+(rep>0?'正声望奖励权重 '+(rep/100).toFixed(1)+'×（合计上限 3×）':'空间币奖励：0（声望不为正）')+'</div>'
                            +'<p>'+text(r.描述||r.目标||'暂无势力描述')+'</p><small>'+text(r.领地||'领地未记录')+'</small></button>';
                    }).join('');
                    const factionDetail=chosenFaction?'<h3>'+text(chosenFaction[0])+'</h3>'+fields({实力:chosenFaction[1].实力,声望:chosenFaction[1].声望,关系阶段:repStage(chosenFaction[1].声望),领地:chosenFaction[1].领地,目标:chosenFaction[1].目标,描述:chosenFaction[1].描述,当前进展:chosenFaction[1].进展}):empty('暂无势力记录');
                    html+=section('势力结算名录','<div class="we-explore-layout"><div class="we-faction-grid">'+(factionCards||empty('暂无已知势力'))+'</div><aside class="we-area-side">'+section('势力档案',factionDetail,'点击左侧势力切换')+'</aside></div>','声望只反映势力对玩家的真实关系');
                }
            }else if(this.tab==='世界事件'){
                const list=events.filter(([n,e])=>matched(n,e)&&((this.filter||'全部')==='全部'||e.状态===this.filter));
                html+=tools(['全部','进行中','待发生','已完成','已取消'])+section('世界事件','<div class="we-timeline">'+(timelineCards(list)||empty('没有符合条件的世界事件','按当前事件、近期节点和宏观节点组织。'))+'</div>','按状态层级与因果顺序排列');
            }else if(this.tab==='传闻'){
                html+=tools();
                for(const category of ['街头巷议','情报交易','布告与檄文'])html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
                html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            }else if(this.tab==='运行记录'){
                if(showRadar&&exists(radar.当前模式))html+=section('干涉模式','<article class="we-card"><p>'+text(radar.当前模式)+'</p></article>');

                html+=section('推演记录',(state.运行记录||[]).slice().reverse().map(r=>'<article class="we-card"><div class="we-card-top"><h3>'+text(r.时间)+'</h3>'+pill(r.补丁数+' 项变化','dim')+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚未执行推演'));
                html+=section('历史锚点',entries(state.历史).reverse().map(([n,r])=>'<article class="we-card"><div class="we-meta">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无已确认的历史锚点'));
            }else if(this.tab==='设置'){
                const api=this.normalizeDedicatedApi(this.config.dedicatedApi);
                const fontButtons=Object.entries(WORLD_FONT_SCALES).map(([key,item])=>'<button class="we-setting-btn '+(this.config.fontScale===key?'active':'')+'" data-font-option="'+key+'">'+text(item.name)+' · '+text(item.size)+'</button>').join('');
                const presets=api.apiPresets.map(p=>'<option value="'+text(p.name)+'">'+text(p.name)+'</option>').join('');
                const modelOptions=Array.from(new Set([api.model,...api.fetchedModels].filter(Boolean))).map(model=>'<option value="'+text(model)+'"></option>').join('');
                const terminalReady=!!(this.host.Samsara?.terminal?.apiReady?.());
                const sourceState=this.usesDedicatedApi()
                    ?(this.dedicatedApiReady()?'专属 API 已就绪':'专属 API 已接管，但配置尚不完整')
                    :(terminalReady?'使用主神终端额外模型':'主神终端额外模型尚未准备好');
                html+=section('界面字号','<div class="we-setting-row"><div class="we-setting-copy"><b>界面字号</b><small>色调跟随主神终端；这里仅调整世界推进自己的文字大小。</small></div><div class="we-setting-actions">'+fontButtons+'</div></div>','色调跟随主神终端 · 默认标准 16px');
                html+=section('模型接口',
                    '<div class="we-setting-row"><div class="we-setting-copy"><b>当前调用来源</b><small>'+text(sourceState)+'</small></div><div class="we-setting-actions"><span class="we-source-badge">'+text(this.apiSourceLabel())+'</span></div></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>世界推进专属 API</b><small>开启后世界推进只走这里，不再调用状态栏 / 主神终端的 API；即使配置不完整也不会偷偷回退。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(api.enabled?'on':'')+'" data-action="dedicated-toggle"><span>'+text(api.enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>'
                    +(api.enabled
                        ?'<div class="we-api-toolbar"><select class="we-setting-input" data-dedicated-preset><option value="">— 选择已保存 API 预设 —</option>'+presets+'</select><input class="we-setting-input" data-dedicated-preset-name maxlength="80" placeholder="预设名称"><button class="we-setting-btn" data-action="dedicated-preset-save">保存预设</button><button class="we-setting-btn" data-action="dedicated-preset-delete">删除预设</button></div>'
                         +'<div class="we-api-grid"><label class="wide">API 地址<input class="we-setting-input" data-dedicated-field="apiUrl" value="'+text(api.apiUrl)+'" placeholder="https://example.com/v1"></label><label class="wide">API Key<input class="we-setting-input" data-dedicated-field="apiKey" type="password" value="'+text(api.apiKey)+'" autocomplete="off" placeholder="sk-..."></label><label>模型<input class="we-setting-input" data-dedicated-field="model" list="we-dedicated-models" value="'+text(api.model)+'" placeholder="输入或加载模型名"><datalist id="we-dedicated-models">'+modelOptions+'</datalist></label><label>模型目录<span class="we-setting-actions"><button class="we-setting-btn" data-action="dedicated-models">加载模型 / 测试连接</button></span></label></div>'
                         +'<p class="we-muted">接口按 OpenAI-compatible /v1/chat/completions 与 /v1/models 方式连接，并保留 JSON Schema → JSON Object → 普通文本的结构化兼容降级。</p>'
                        :'<div class="we-notice">当前关闭专属 API。世界推进继续使用主神终端「额外模型配置」；这里不会复制或读取状态栏里的 API Key。</div>')
                    ,'接口配置只存本地 localStorage，不写入 MVU');
            }else if(this.tab==='提示词预设'){
                const promptView=this.promptDraft||{
                    preset:this.config.preset,
                    structurePrompt:this.config.structurePrompt,
                    contextTurns:this.config.contextTurns||6,
                    activationMode:this.config.activationMode||'respect_activation',
                    selectedEntries:Array.isArray(this.config.selectedEntries)?copy(this.config.selectedEntries):null
                };
                const docs=this.getPromptDocuments(),activeDoc=docs.find(doc=>doc.id===this.config.activePromptDocumentId);
                html+='<div class="we-preset-toolbar"><div><b>提示词工作台</b><small>主要操作固定在顶部，不需要再滚到页面底部寻找保存。</small></div><div><button class="we-btn we-primary" data-action="save">保存当前设置</button><button class="we-btn" data-action="save-default">保存为个人默认</button><button class="we-btn" data-action="preview">预览下一次请求</button></div></div>';
                html+=section('预设文档','<div class="we-doc-create"><input data-doc-name maxlength="80" placeholder="文档名称，例如：原著推进·标准" value="'+text(activeDoc?.builtin?'':activeDoc?.name||'')+'"><button class="we-btn we-primary" data-action="doc-save">保存为文档</button><button class="we-btn" data-action="doc-import">导入文档</button><input data-doc-import type="file" accept=".json,application/json" hidden></div>'+
                    (docs.length?'<div class="we-doc-list">'+docs.map(doc=>'<div class="we-doc-row"><div><b>'+text(doc.name)+(doc.builtin?' <span class="we-doc-badge">内置默认</span>':'')+'</b><small>'+text(doc.updatedAt?new Date(doc.updatedAt).toLocaleString():'未记录时间')+(doc.id===this.config.activePromptDocumentId?' · 当前应用':'')+'</small></div><span class="we-doc-actions"><button data-action="doc-apply" data-doc-id="'+text(doc.id)+'">应用</button><button data-action="doc-export" data-doc-id="'+text(doc.id)+'">导出</button>'+(doc.builtin?'':'<button data-action="doc-delete" data-doc-id="'+text(doc.id)+'">删除</button>')+'</span></div>').join('')+'</div>':empty('还没有预设文档','保存当前设置后，可以在这里应用、导出或删除。')),'内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存当前分段、结构说明与资料范围，不会覆盖内置模板');
                html+='<div class="we-notice">世界书目录会读取角色主书、角色附加书、当前聊天绑定书和酒馆全局启用书。蓝绿灯表示条目触发方式；“实际读取”仍以请求检查中的本次清单为准。</div>';
                const groups=new Map();
                for(const e of this.bookCatalogue||[]){if(!groups.has(e.book))groups.set(e.book,[]);groups.get(e.book).push(e);}
                const selectedEntries=Array.isArray(promptView.selectedEntries)?promptView.selectedEntries:null;
                const selected=e=>!e.technical&&selectedEntryMatches(e,selectedEntries);
                html+=section('资料读取范围','<div class="we-config-row"><label>正文窗口 <input data-floors type="number" min="1" max="100" value="'+text(promptView.contextTurns||6)+'"> 层</label><label>读取方式 <select data-activation><option value="respect_activation" '+(promptView.activationMode!=='force_selected'?'selected':'')+'>遵循蓝绿灯</option><option value="force_selected" '+(promptView.activationMode==='force_selected'?'selected':'')+'>强制读取勾选项</option></select></label></div><p class="we-muted">遵循蓝绿灯：蓝灯常驻，绿灯扫描上述正文窗口关键词；禁用项不读。强制模式可纳入普通禁用项，但 [variables]、[mvu_update]、正文额外思考及任务/输出技术条目始终隔离。未绑定且未全局启用的世界书不会被自动读取。</p><div class="we-tools"><button data-action="books">加载 / 刷新目录</button><button data-action="book-all">全选</button><button data-action="book-none">全不选</button></div>'+
                    (groups.size?Array.from(groups).map(([book,list])=>'<details class="we-book" open><summary>'+text(book)+' <small>'+text((list[0]?.sources||[]).join(' · ')||'已绑定')+' · '+list.filter(selected).length+' / '+list.length+' 项已勾选</small></summary><div class="we-book-list">'+list.map(e=>{
                        const report=(this.readReport||[]).find(r=>r.世界书===e.book&&r.条目ID===e.id);
                        return '<label class="we-book-row"><input type="checkbox" data-book value="'+text(JSON.stringify([e.book,e.id]))+'" '+(selected(e)?'checked':'')+' '+(e.technical?'disabled':'')+'><span class="we-lamp '+(e.technical?'gray':e.mode==='constant'?'blue':e.mode==='selective'?'green':'gray')+'" title="'+text(e.technical?'技术条目 · 已隔离':e.mode==='constant'?'蓝灯 · 常驻':e.mode==='selective'?'绿灯 · 关键词触发':'其他激活方式')+'"></span><span class="we-book-title"><b>'+text(e.title)+'</b><small>'+text(e.technical?'技术条目 · 世界引擎不读取':(e.mode==='constant'?'常驻':e.mode==='selective'?'关键词：'+(Array.isArray(e.keys)?e.keys.map(k=>typeof k==='string'?k:'正则条件').join('、'):e.keys):e.mode)+(e.enabled?'':' · 已禁用'))+'</small></span><small class="we-read-state">'+text(report?'上次检查：'+report.原因:e.technical?'固定隔离':'尚未检查')+'</small></label>';
                    }).join('')+'</div></details>').join(''):empty('尚未加载目录','点击“加载 / 刷新目录”读取当前绑定和全局启用的世界书。')));
                const segments=splitPresetSegments(promptView.preset);
                html+=section('分段提示词','<div class="we-segment-toolbar"><span>默认只读，展开查看；开启编辑后可修改。</span><button class="we-btn" data-action="prompt-edit" aria-pressed="'+!!this.promptEditing+'">'+(this.promptEditing?'锁定编辑':'开启编辑')+'</button><button class="we-btn" data-action="segment-add" '+(this.promptEditing?'':'disabled')+'>＋ 新增分段</button></div><div class="we-segment-list" data-segment-list>'+segments.map((part,i)=>'<details class="we-segment" data-segment-row><summary>'+text(part.title||'未命名分段')+' <small>'+formatTokenCount(estimateTokens(part.body),true)+'</small></summary><div class="we-segment-head"><input '+(this.promptEditing?'':'readonly')+' data-segment-title aria-label="分段标题 '+i+'" placeholder="分段标题（可留空）" value="'+text(part.title)+'"><small>'+formatTokenCount(estimateTokens(part.body),true)+'</small><span class="we-segment-actions"><button type="button" '+(this.promptEditing?'':'disabled')+' data-action="segment-up" title="上移">↑</button><button type="button" '+(this.promptEditing?'':'disabled')+' data-action="segment-down" title="下移">↓</button><button type="button" '+(this.promptEditing?'':'disabled')+' data-action="segment-delete" title="删除">删除</button></span></div><textarea '+(this.promptEditing?'':'readonly')+' data-segment="'+i+'" data-title="'+text(part.title)+'" aria-label="预设分段 '+i+'">'+text(part.body)+'</textarea></details>').join('')+'</div><p class="we-muted">这些分段属于可编辑工作层，可以新增、删除或调整顺序。世界引擎的安全边界与 WorldResult 核心协议仍由程序独立注入，不依赖某个可编辑分段是否存在。</p>');
                html+=section('固定系统注入','<div class="we-notice">最终 system 拼装顺序：可编辑分段 → 世界引擎核心约束 → 按需 NPC 构筑审计 → WorldResult 业务输出协议 → Canonical Schema。这里展示的是程序强制层，不会另生成第二套执行流程。</div><details class="we-segment"><summary>世界引擎核心约束 · 固定只读</summary><textarea readonly>'+text(CORE_WORLD_RULES)+'</textarea></details><details class="we-segment"><summary>角色管理 · NPC构筑审计 · 条件注入</summary><textarea readonly>'+text(NPC_BUILD_AUDIT_RULES)+'</textarea><p class="we-muted">只有本轮存在 NPC 构筑审计对象时才实际加入 system；没有审计对象时不会发送。</p></details>','不可编辑 · 与实际 system 共用同一常量');
                html+=section('WorldResult 输出协议','<details class="we-segment"><summary>WorldResult 协议说明 · 点击展开</summary><textarea data-structure-prompt '+(this.promptEditing?'':'readonly')+'>'+text(promptView.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'</textarea></details><details class="we-segment"><summary>程序字段 Schema · 只读</summary><textarea readonly>'+text(JSON.stringify(WORLD_RESULT_SCHEMA,null,2))+'</textarea></details><p class="we-muted">协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，核心约束与条件审计见上方“固定系统注入”，修改说明不会改变变量结构。</p>');
            }else if(this.tab==='请求检查'){
                const fold=(title,body)=>'<details class="we-inspect"><summary>'+text(title)+'</summary><div class="we-inspect-body">'+body+'</div></details>';
                const raw=(label,v)=>fold(label,'<textarea class="we-raw" readonly>'+text(v)+'</textarea>');
                const readable=(name,v)=>Array.isArray(v)?v.map((item,i)=>fold((item.名称||item.楼层!==undefined&&(item.角色+' · 第 '+item.楼层+' 层')||name+' '+(i+1)),fields(item))).join(''):fields(plain(v)?v:{内容:v});
                const retryLog=(this.lastRetryLog||[]).map(item=>{
                    const slices=Array.isArray(item.片段)?item.片段:[],plans=Array.isArray(item.补充清单)?item.补充清单:[];
                    const details=slices.length?'<p><b>具体原因</b><br>'+slices.map(x=>text(x.片段)+'：'+text(x.原因)).join('<br>')+'</p>':'';
                    const guidance=plans.length?'<p><b>下一次纠错要求</b><br>'+plans.map(text).join('<br>')+'</p>':'';
                    return '<div class="we-change"><time>#'+text(item.尝试)+'</time><div><b>模型回复被拒绝</b><p>'+text(item.错误)+'</p>'+details+guidance+'</div></div>';
                }).join('');
                const tokenLabel=(value,estimated=true)=>Number.isFinite(Number(value))?formatTokenCount(Number(value),estimated):'—';
                html+=section('失败自动重试','<div class="we-config-row"><label>最大尝试次数 <input data-retries type="number" min="1" max="5" value="'+text(this.config.retryAttempts??3)+'"> 次</label><span class="we-muted">包含首次请求。1 = 只请求一次；5 = 最多总共尝试 5 次。只纠正 WorldResult 业务结果/编译校验，危险越权、上下文变化和写入未确认不会自动重试。</span></div>'+(this.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(this.lastAttemptCount)+' 次；每次模型业务拒绝都会在下方完整保留，包括最后一次失败。</p>':'')+(retryLog||''));
                html+='<div class="we-tools"><button data-action="preview">生成下一次请求预览（不调用 API）</button></div>';
                for(const [label,r] of [['最近实际发送',this.lastRequest],['下一次请求预览',this.previewRequest]]){
                    if(!r){html+=section(label,empty('暂无'+label));continue;}
                    const m=r.manifest||{},books=m.世界书条目||[],floors=m.正文楼层||[],obs=m.观测||requestTokenTelemetry(r.system,r.input,r.schema||WORLD_RESULT_SCHEMA);
                    const readChecks=(m.读取判定||[]).filter(item=>item.读取===true);
                    const exactInput=obs.实际输入Tokens!=null,exactOutput=obs.实际输出Tokens!=null;
                    let body='<div class="we-request-summary">'+pill(m.输出协议||'WorldResult v1','dim')+pill('结构化 '+(obs.结构化实际模式||m.结构化输出||'auto'),'dim')+pill(obs.接口来源||m.接口来源||this.apiSourceLabel(),'dim')+pill(books.length+' 条世界书','dim')+pill(floors.length+' 层正文','dim')+pill((exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true))+' 输入','dim')+(obs.输出估算Tokens!=null?pill((exactOutput?tokenLabel(obs.实际输出Tokens,false):tokenLabel(obs.输出估算Tokens,true))+' 输出','dim'):'')+(m.尝试序号?pill('尝试 '+m.尝试序号,'dim'):'')+(m.最大尝试次数!==undefined?pill('最多尝试 '+m.最大尝试次数,'dim'):'')+'</div>';
                    const userTokenFields=Object.fromEntries((obs.User分段||[]).map(item=>[item.名称,tokenLabel(item.估算Tokens,true)]));
                    body+='<p class="we-muted">带“≈”的 tk 只是本地容量粗估，不等于服务商真实 token；主神终端通道拿不到 usage 时无法确认精确总量。总输入 = System + 下列 User 分项；这里不再重复显示 User 总项或 Schema 子项。专属 API 返回 usage 时仅总输入/输出改用服务端实际 token。</p>';
                    body+=fold('Token 构成（点击展开）',fields(Object.assign({总输入:exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true),System:tokenLabel(obs.System估算Tokens,true)},userTokenFields,{接口:obs.接口来源||m.接口来源||'',模型:obs.模型||'',模式尝试:Array.isArray(obs.模式尝试)&&obs.模式尝试.length?obs.模式尝试.join(' → '):'',耗时:Number.isFinite(Number(obs.耗时毫秒))?(Number(obs.耗时毫秒)/1000).toFixed(2).replace(/\.00$/,'')+' s':''}))+fold('system 分段',fields({分段:(obs.System分段||[]).map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))})));
                    body+=fold('本轮实际读取资料（点击展开）',(readChecks.length?readable('条目',readChecks):empty('本轮未读取世界书','没有勾选命中或强制读取的世界书条目。'))+fold('实际读取世界书',fields({条目:books.map(item=>item.名称+' · '+tokenLabel(item.估算Tokens,true))}))+fold('实际正文楼层',fields({楼层:floors.map(f=>'第 '+f.楼层+' 层 · '+f.角色+' · '+tokenLabel(f.估算Tokens,true))}))+fold('时间容量',fields(m.本轮时间容量||{})));
                    body+=fold('输出契约 · JSON Schema',raw('samsara_world_result_v1',JSON.stringify(r.schema||WORLD_RESULT_SCHEMA,null,2)));
                    body+=fold('system · 分段阅读',r.system.split(/\n(?=【)/).map((part,i)=>fold((part.match(/^【([^】]+)】/)||[])[1]||'身份 / 协议 '+(i+1),'<div class="we-prose">'+text(part)+'</div>')).join(''))+raw('system · 实际发送原文',r.system);
                    let payload;try{payload=JSON.parse(r.input);}catch(_){payload={正文:r.input};}
                    body+=fold('user · 分段阅读',Object.entries(payload).map(([name,v])=>fold(name,readable(name,v))).join(''))+raw('user · 实际发送原文',r.input);
                    html+=section(label,body);
                }
                if(this.lastWorldResult)html+=section('最近 WorldResult · 业务层',raw('模型已接受并累计的业务结果',JSON.stringify(this.lastWorldResult,null,2)));
                if((this.lastCompiledPatches||[]).length)html+=section('程序编译补丁 · 存储层',raw('由 WorldResult Compiler 生成，模型不直接控制这些路径',JSON.stringify(this.lastCompiledPatches,null,2)));
                if((this.lastCompileWarnings||[]).length)html+=section('编译警告',(this.lastCompileWarnings||[]).map(w=>'<div class="we-notice">'+text(w)+'</div>').join(''));
                if(this.lastFailure)html+='<div class="we-notice">'+text(this.lastFailure)+'</div>';
                if(this.lastReply){const lastAttempt=(this.lastAttemptTelemetry||[]).at(-1),replyTk=lastAttempt?.API输出Tokens!=null?formatTokenCount(lastAttempt.API输出Tokens,false):formatTokenCount(estimateTokens(this.lastReply),true);html+=section('副 API 原始回复 · '+replyTk,raw('查看模型返回原文（用于定位格式问题）',this.lastReply));}
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
    // 可选策略层：NPC 构筑审计默认关闭；同时吸收主变量 Schema 的派生缓存，并提供可执行的事件纠错信息。
    let NPC_BUILD_AUDIT_FEATURE_ENABLED=false;
    const npcBuildAuditBeforeFeatureSwitch=npcBuildAudit;
    npcBuildAudit=function(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
        if(!NPC_BUILD_AUDIT_FEATURE_ENABLED)return [];
        return npcBuildAuditBeforeFeatureSwitch(stat,limit);
    };

    const validateStateBeforeActionableEventRefs=validateState;
    validateState=function(stat) {
        const events=stat?.世界?.[PATH]?.事件||{};
        if(plain(events)){
            for(const [name,event] of Object.entries(events)){
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(events,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
        }
        return validateStateBeforeActionableEventRefs(stat);
    };

    const retryPlanBeforeActionableEventRefs=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        const plan=retryPlanBeforeActionableEventRefs(error,rejected).map(line=>String(line)
            .replace('新增宏观事件必须给出可执行的时间/条件/前因。','新增宏观事件必须给出明确时间锚点；条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。')
            .replace('因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序，使用最终3~5个仍可推进的宏观节点名称形成顺序。','因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的事件名称，不要写当前阶段、当前事件或近期节点。')
            .replace('且每个名称都必须对应已建立且未取消的宏观节点。','且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。'));
        if(/事件前因(?:不存在|非法自引用)/.test(messages))plan.push('事件前因：按报错中的“事件 <- 非法前因”定点修正；前因数组只放事件名称，同轮链式节点必须先建立前置节点，无明确前因写 []。');
        if(/字段未通过完整 Schema 校验/.test(messages))plan.push('Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const makeRetryFailureBeforeConcreteReasons=makeRetryFailure;
    makeRetryFailure=function(rejected,globalError) {
        const error=makeRetryFailureBeforeConcreteReasons(rejected,globalError);
        const details=(rejected||[]).map(item=>item?.片段&&item?.原因?item.片段+'：'+item.原因:'').filter(Boolean);
        if(details.length){
            const summary=String(error.message||'WorldResult 未通过业务校验').split('\n\n具体原因\n')[0];
            error.message=summary+'\n\n具体原因\n'+details.join('\n');
        }
        return error;
    };

    const WORLD_STATE_DERIVED_SCHEMA_KEYS=new Set(['真属性','最终属性','强化']);
    function syncWorldStateDerivedSchemaFields(target,checked) {
        if(Array.isArray(target)&&Array.isArray(checked)){
            const count=Math.min(target.length,checked.length);
            for(let i=0;i<count;i++)syncWorldStateDerivedSchemaFields(target[i],checked[i]);
            return;
        }
        if(!plain(target)||!plain(checked))return;
        for(const key of WORLD_STATE_DERIVED_SCHEMA_KEYS){
            if(Object.hasOwn(checked,key))target[key]=checked[key]===undefined?undefined:copy(checked[key]);
            else if(Object.hasOwn(target,key))delete target[key];
        }
        for(const key of Object.keys(checked)){
            if(WORLD_STATE_DERIVED_SCHEMA_KEYS.has(key)||!Object.hasOwn(target,key))continue;
            syncWorldStateDerivedSchemaFields(target[key],checked[key]);
        }
    }
    function alignWorldStateSchemaOrder(checked,target) {
        if(Array.isArray(checked))return checked.map((value,index)=>alignWorldStateSchemaOrder(value,Array.isArray(target)?target[index]:undefined));
        if(plain(checked)&&plain(target)){
            const out={};
            for(const key of Object.keys(target))if(Object.hasOwn(checked,key))out[key]=alignWorldStateSchemaOrder(checked[key],target[key]);
            for(const key of Object.keys(checked))if(!Object.hasOwn(out,key))out[key]=alignWorldStateSchemaOrder(checked[key],target[key]);
            return out;
        }
        return checked;
    }

    const SamsaraWorldEngineBeforeNpcAuditSwitch=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeNpcAuditSwitch {
        constructor(host,env) {
            super(host,env);
            const hadSetting=Object.hasOwn(this.config,'npcBuildAuditEnabled');
            this.config.npcBuildAuditEnabled=this.config.npcBuildAuditEnabled===true;
            this.syncNpcBuildAuditFeature();
            if(!hadSetting)this.saveConfig();
        }
        syncNpcBuildAuditFeature() {
            NPC_BUILD_AUDIT_FEATURE_ENABLED=this.config.npcBuildAuditEnabled===true;
            return NPC_BUILD_AUDIT_FEATURE_ENABLED;
        }
        isNpcBuildAuditEnabled() { return this.config.npcBuildAuditEnabled===true; }
        setNpcBuildAuditEnabled(value) {
            const wasBusy=!!this.busy;
            if(wasBusy)this.cancel();
            this.config.npcBuildAuditEnabled=value===true;
            this.syncNpcBuildAuditFeature();
            this.saveConfig();
            this.status=(this.config.npcBuildAuditEnabled?'NPC构筑审计已启用':'NPC构筑审计已关闭')+(wasBusy?' · 已停止当前推演':'');
            this.render(true);
            return this.config.npcBuildAuditEnabled;
        }
        async buildRequest(base) {
            this.syncNpcBuildAuditFeature();
            return super.buildRequest(base);
        }
        async run() {
            this.syncNpcBuildAuditFeature();
            const samsara=this.host&&this.host.Samsara,validate=samsara&&samsara.validateWorldState;
            if(typeof validate!=='function')return super.run();
            const wrapped=function(stat){
                const checked=validate.call(samsara,stat);
                syncWorldStateDerivedSchemaFields(stat,checked);
                return alignWorldStateSchemaOrder(checked,stat);
            };
            samsara.validateWorldState=wrapped;
            try{return await super.run();}
            finally{if(samsara.validateWorldState===wrapped)samsara.validateWorldState=validate;}
        }
        createPanel() {
            super.createPanel();
            if(!this.panel||this.panel.__npcAuditToggleBound)return;
            Object.defineProperty(this.panel,'__npcAuditToggleBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="npc-audit-toggle"]');
                if(!button||!this.panel.contains(button))return;
                this.setNpcBuildAuditEnabled(!this.isNpcBuildAuditEnabled());
            });
        }
        render(force) {
            const result=super.render(force);
            this.renderNpcBuildAuditSetting();
            return result;
        }
        renderNpcBuildAuditSetting() {
            if(!this.panel)return;
            const enabled=this.isNpcBuildAuditEnabled(),main=this.panel.querySelector('main');
            if(!main)return;
            const old=main.querySelector('[data-npc-audit-setting]');
            if(old)old.remove();
            if(this.tab==='设置'){
                const block=this.host.document.createElement('section');
                block.className='we-section';block.setAttribute('data-npc-audit-setting','');
                block.innerHTML='<div class="we-section-head"><h2>NPC构筑审计</h2><small>备选功能 · 默认关闭</small></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>自动补全热 NPC 构筑</b><small>关闭时不扫描或补写职业、血统、装备、技能、形态；关系仍按实际剧情正常稀疏同步。开启后才对热 NPC 执行构筑缺口审计。</small></div>'
                    +'<div class="we-setting-actions"><button class="we-setting-btn we-switch '+(enabled?'on':'')+'" data-action="npc-audit-toggle" aria-pressed="'+enabled+'"><span>'+(enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>';
                const sections=Array.from(main.children),modelSection=sections.find(section=>section.querySelector?.('h2')?.textContent?.trim()==='模型接口');
                main.insertBefore(block,modelSection||null);
            }else if(this.tab==='角色管理'&&!enabled){
                for(const note of main.querySelectorAll('.we-muted')){
                    if(note.textContent.includes('进入世界推进请求的热人物会由后台优先补齐缺口'))note.textContent='自动构筑审计当前关闭；此处只显示诊断，可在“设置”中临时启用自动补全。';
                }
            }
        }
    };
    // CommonJS 入口仅供离线测试，浏览器脚本不依赖打包器。
    if (typeof module !== 'undefined' && module.exports) { module.exports = {SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS,compileWorldResult,normalizeWorldResult,mergeWorldResults,WORLD_RESULT_SCHEMA,projectWorldContext,compactWorldLifecycle,calendarDate,repairExplorationGranularity,sortWorldEvents,eventScheduleLabel,staleActiveEvents,temporalAnomalies,activeAlienActivityRequirements,pruneDeadAlienPeople,extractWorldProse,derivePersonWorldContext,projectHotWorldPeople,WORLD_UI_THEMES,WORLD_FONT_SCALES,estimateTokens,formatTokenCount,normalizeTokenUsage,requestTokenTelemetry}; return; }
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
    if (typeof getChatWorldbookName === 'function') runtime.getChatWorldbookName = (...args) => getChatWorldbookName(...args);
    if (typeof getGlobalWorldbookNames === 'function') runtime.getGlobalWorldbookNames = (...args) => getGlobalWorldbookNames(...args);
    if (typeof getWorldbook === 'function') runtime.getWorldbook = (...args) => getWorldbook(...args);
    host.Samsara = host.Samsara || {};
    if (host.Samsara.worldEngine) host.Samsara.worldEngine.dispose();
    const engine = new SamsaraWorldEngine(host,runtime);
    host.Samsara.WorldEngine = SamsaraWorldEngine;
    host.Samsara.worldEngine = engine; engine.init();
    root.addEventListener('unload', () => engine.dispose(), {once:true});
})(typeof window !== 'undefined' ? window : globalThis);
