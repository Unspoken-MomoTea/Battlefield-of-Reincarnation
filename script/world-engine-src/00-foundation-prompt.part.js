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
Step 5 · 结算玩家影响：只按<user>已确认行为结算探索、势力与重大因果偏移；必要时重构宏观骨架。
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
        version:16,
        builtin:true,
        name:'默认设置',
        exportedAt:'2026-09-11T12:30:00.000Z',
        createdAt:'2026-09-08T13:09:45.350Z',
        updatedAt:'2026-09-11T12:30:00.000Z',
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
7. 因果：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；负值=因果破坏，正值=修复/强化。世界超稳不新增偏移；旧轨道失效时同轮重构宏观顺序。
8. 公开与基础：当前事件公开字段只写已成为现实且可合理感知的信息。货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护。`;
    const WORLD_STABILITY_DEFENSE_STAGES = [
        {min:90,title:'因果警觉',rule:'异常线索、调查、误会与既有敌意开始沿合理因果链向轮回者及其直接关系网汇聚；仍以自然事件表现，不形成公开围剿。'},
        {min:80,title:'定向排异',rule:'藏身处、计划、联系人、资源链与行动路径持续受压；压力优先集中到轮回者本人及其直接关系网。'},
        {min:70,title:'因果追猎',rule:'原生强者、组织与主线冲突逐步被因果收束引向轮回者；据点、盟友、补给与撤退路线开始被系统性破坏。'},
        {min:60,title:'全面围剿',rule:'多个原生势力可基于各自合理动机同时追捕、封锁或攻击轮回者；普通安全生活基本结束。'},
        {min:50,title:'世界武器化',rule:'战争、灾害、怪物潮与原生顶级强者可沿因果链压向轮回者活动区；世界开始接受区域毁灭与大规模误伤作为清除代价。'},
        {min:40,title:'猎杀现实',rule:'环境、空间、时间与残存原生规则都可成为猎杀载体；世界接受永久区域毁灭，只求把入侵源一并埋葬。'},
        {min:30,title:'献祭式清除',rule:'世界进入免疫风暴，可牺牲主线人物、城市、国家乃至文明结构换取清除轮回者。'},
        {min:10,title:'终焉围猎',rule:'毁灭性事件持续向轮回者及其停留区域收束；长期停留会把灾难引向当前位置。'},
        {min:1,title:'同归于尽',rule:'世界放弃自保，主动牺牲法则、时间线与现实结构清除轮回者。'},
        {min:0,title:'世界毁灭',rule:'因果链、世界法则、时间线与现实结构均已终止，不再生成常规世界推进。'}
    ];
    function worldStabilityPrompt(stat) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        return `【世界自救 · ${stage.title}】\n当前稳定值：${stable}。${stage.rule}\n排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;
    }
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
    }