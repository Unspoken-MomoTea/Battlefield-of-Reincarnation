/* 轮回战场 · 世界引擎
 * 从参考异步助手迁移：旧状态回读、增量补丁、分层投影、楼层隔离、后台调度。
 * 专用实现：六个业务模块共用一次推演；MVU 是唯一持久状态；复用主神终端 API。
 * 在酒馆脚本库中独立加载。接口位于父窗口 Samsara.worldEngine。
 */
(function (root) {
    'use strict';
    const WORLD_ENGINE_VERSION='2.0.10';
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
    class WorldTokenTelemetry {
        estimate(value) {
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
        format(count,estimated=true) {
            const n=Math.max(0,Math.round(Number(count)||0));
            let value=String(n);
            if(n>=1000){
                const digits=n>=100000?0:n>=10000?1:2;
                value=(n/1000).toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1')+'k';
            }
            return (estimated?'≈':'')+value+' tk';
        }
        normalizeUsage(usage) {
            if(!plain(usage))return null;
            const finite=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.round(Number(value)):null;
            const inputTokens=finite(usage.prompt_tokens??usage.input_tokens??usage.promptTokens??usage.inputTokens);
            const outputTokens=finite(usage.completion_tokens??usage.output_tokens??usage.completionTokens??usage.outputTokens);
            let totalTokens=finite(usage.total_tokens??usage.totalTokens);
            if(totalTokens===null&&inputTokens!==null&&outputTokens!==null)totalTokens=inputTokens+outputTokens;
            return inputTokens===null&&outputTokens===null&&totalTokens===null?null:{inputTokens,outputTokens,totalTokens};
        }
        request(system,input,schema) {
            const systemText=String(system||''),inputText=String(input||'');
            let payload=null;try{payload=JSON.parse(inputText);}catch(_){}
            const systemParts=systemText.split(/\n(?=【)/).filter(Boolean).map((part,index)=>({
                名称:(part.match(/^【([^】]+)】/)||[])[1]||'system '+(index+1),
                估算Tokens:this.estimate(part)
            }));
            const userParts=plain(payload)?Object.entries(payload).filter(([,value])=>value!==undefined).map(([name,value])=>({
                名称:name,估算Tokens:this.estimate(JSON.stringify({[name]:value},null,2))
            })):[];
            const systemTokens=this.estimate(systemText),userTokens=this.estimate(inputText);
            return {
                估算:true,
                请求估算Tokens:systemTokens+userTokens,
                System估算Tokens:systemTokens,
                User估算Tokens:userTokens,
                Schema估算Tokens:this.estimate(JSON.stringify(schema||{},null,2)),
                System分段:systemParts,
                User分段:userParts
            };
        }
    }

    const DEFAULT_WORLD_TOKEN_TELEMETRY=new WorldTokenTelemetry();
    let ACTIVE_WORLD_TOKEN_TELEMETRY=DEFAULT_WORLD_TOKEN_TELEMETRY;
    function estimateTokens(value){return ACTIVE_WORLD_TOKEN_TELEMETRY.estimate(value);}
    function formatTokenCount(count,estimated=true){return ACTIVE_WORLD_TOKEN_TELEMETRY.format(count,estimated);}
    function normalizeTokenUsage(usage){return ACTIVE_WORLD_TOKEN_TELEMETRY.normalizeUsage(usage);}
    function requestTokenTelemetry(system,input,schema){return ACTIVE_WORLD_TOKEN_TELEMETRY.request(system,input,schema);}
    class WorldProseExtractor {
        extract(value) {
            let source=String(value??'').replace(/\r\n?/g,'\n');
            source=source.replace(/<!--[\s\S]*?(?:-->|$)/g,'\n');
            source=source.replace(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>[\s\S]*?(?:<\/details>|$)/gi,
                (block,title)=>/思考|思维链|变量|更新|检定|结算|状态栏|thinking|reasoning|analysis/i.test(title)?'\n':block);
            const hidden=new Set(['think','thinking','reasoning','analysis','konatan_planning','dm_think','chain_of_thought',
                'updatevariable','jsonpatch','variables','status_current_variables','user_status_readonly',
                'worldresult','options','statusplaceholder',
                'action','summary','update','scene_time','pic','dicecombat','dicecheck','enemyoverview',
                'summonoverview','lootlog','experiencelog','questcontract','merchantstore','combatsnapshot',
                'combatresult','craftresult','checkresult',
                'ash-review','acu-review','ash_review','acu_review','ash_note','acu_note','ash-review-slot',
                'script','style','head','iframe']);
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
    }

    const DEFAULT_WORLD_PROSE_EXTRACTOR=new WorldProseExtractor();
    let ACTIVE_WORLD_PROSE_EXTRACTOR=DEFAULT_WORLD_PROSE_EXTRACTOR;
    function extractWorldProse(value){return ACTIVE_WORLD_PROSE_EXTRACTOR.extract(value);}
    const DEFAULT_PRESET = `你是轮回战场的世界引擎。只推进正文场景之外仍在运行的世界，并保持事件、场景、人物、势力、传播、资产与因果一致。
【执行流程】
Step 1 · 取事实：按“当前变量/本轮已确认剧情 > 明确世界书 > 模型常识”读取；已确认差异优先。
Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。
Step 3 · 推区间：严格按本轮时间容量，先处理到期/进行中事项，再把未完事项推进合理一步；计划不是事实，不越过下一宏观边界。
Step 4 · 现场到人物：先更新当前区间内确实变化的地区现场，再决定人物行动。人物受地点、路程、能力、认知、职责、资产与地区条件约束。模型看到正文楼层/当前变量不等于人物知情；场外人物若因<user>新行为改变目标或行动，必须已有相应认知，或本轮经观察、目击、通讯、传播获得并同步人物.认知/认知来源；没有来源则维持原目标/行动，只推进其自身事务。同场正文未决时停在交互前。活跃异端只有在活动缺失、复核到期、关联事件/所在地区变化或长期未复核时才更新；无触发时沿用既有目标与行动，禁止为了刷新而凭空改策。
Step 5 · 结算玩家影响：只按<user>已确认行为结算探索、势力与重大因果偏移；这是客观世界结算，不得据此让未获知情报的场外人物自动追踪、伏击或改策。必要时重构宏观骨架。
Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。
Step 7 · 输出差分：先按“历史摘要”规则写摘要，再只输出本轮新增或变化的 WorldResult；无业务变化也要客观说明本轮没有新增世界事实。
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
    const CORE_WORLD_RULES = `【世界引擎核心约束】
1. 事实：当前变量与已确认剧情 > 明确世界书 > 模型常识；计划不是事实，已确认差异不得被原著常识覆盖。
2. 宏观与时间：只用世界.时间计算本世界进展；宏观顺序保持3~5个阶段级节点，细节只推进到下一宏观边界。待发生/进行中事件必须有可排序时间或明确因果时间；无法确认跨度时只推进一步。
3. 现场与认知：现场群体与环境事实属于势力地区，同一现场事实不得复制进人物。先更新地区现场再决定人物行动；模型看到正文楼层、当前变量和<user>已确认行为，只代表世界事实，不等于任何场外人物知情。人物只能依据在场观察、既有认知、可信通讯/传播链行动；若因<user>新行为改变目标或行动，必须有可追溯的认知来源（已有或本轮写入人物.认知/认知来源），没有来源不得针对<user>即时反应。
4. 人物边界：活跃异端按触发条件复核，未触发时延续既有活动；死亡不可恢复。普通人物只保留真正热记录。不得替<user>建立后台行动。主神任务、晋升试炼、任务状态、副本成就不读取、不更新、不据此驱动世界。普通副本返回主神空间后停止本世界推演；单一世界局部结算不重置世界。
5. 资产：仅限固定地产、大型载具或要塞；药剂、材料、消耗品、钥匙、剧情物品、单兵装备/形态不得写入资产。顶层资产是唯一资产账簿；所属对象为数组，可按已确认场外事实新增、更新、转移或移除；删除保护中的同名资产不得重建，正文/MVU已结算变化不重复结算。
6. 玩家台账：探索只结算<user>实际到达、调查或可靠获知的整体区域；探索度以0/10/30/60/90/100为阶段锚点且无因不回退。势力声望只因<user>真实关系结果变化，同一结果只结算一次，单轮绝对变化≤1000，超过500仅限重大事件。
7. 因果：只在关键人物命运、重大事件结果、势力格局或主线可行性实质改变时记偏移；负值=因果破坏，正值=修复/强化。世界超稳不新增偏移；旧轨道失效时同轮重构宏观顺序。
8. 公开与基础：当前事件公开字段只写已成为现实且可合理感知的信息。货币只随真实流通体系变化，任务世界不用空间币作本地货币；历法只在可靠设定明确时维护。
9. 历史摘要：摘要只写本轮已确认的主体、动作、结果、关键状态变化与持续影响；区分计划、进行与完成，禁止“已建立骨架”“已完成推演”“局势暗涌”等运行话术或空泛概括。`;
    const DEFAULT_MACRO_PROMPT = `【本轮宏观骨架交付】
先完成输入“本轮必须完成的宏观骨架”，再推演近期细节。至少3个可推进宏观节点是合并后的交付底线，进行中+待发生合计。未来规划可以跨越下一宏观边界，实际发生与细节推进不能越界；只输出差分不意味着可以省略尚未建立的骨架。提交前检查事件实体、分类、状态、时间、前因与因果.宏观顺序相互对应。`;
    const DEFAULT_STABILITY_PROMPT_TEMPLATE = `【世界自救 · {{阶段}}】
当前稳定值：{{稳定值}}。{{规则}}
排异必须借世界观内合理载体发生，优先针对造成异常的轮回者及其据点、关系网、资源与行动路径；NPC仍只能依据自身认知和传播链行动，不得凭空全知。法则越破不代表主动排异越弱。`;
    const BUILTIN_DEFAULT_PROMPT_DOCUMENT = {
        id:'builtin-default',
        type:'samsara-world-prompt-document',
        version:22,
        builtin:true,
        name:'默认设置',
        exportedAt:'2026-09-14T13:00:00.000Z',
        createdAt:'2026-09-08T13:09:45.350Z',
        updatedAt:'2026-09-28T15:45:00.000Z',
        settings:{
            corePrompt:CORE_WORLD_RULES,
            macroPrompt:DEFAULT_MACRO_PROMPT,
            stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
            preset:normalizeEditablePreset(DEFAULT_PRESET),
            contextTurns:3,
            activationMode:'respect_activation',
            selectedEntries:copy(BUILTIN_DEFAULT_SELECTED_ENTRIES)
        }
    };
    const BUILTIN_DEFAULT_PROMPT_VERSION = BUILTIN_DEFAULT_PROMPT_DOCUMENT.version;
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
    function worldStabilityPrompt(stat, template=DEFAULT_STABILITY_PROMPT_TEMPLATE) {
        if(stat?.设置?.世界超稳===true)return '';
        const raw=Number(stat?.世界?.稳定),stable=Number.isFinite(raw)?Math.max(0,Math.min(120,raw)):100;
        if(stable>=100)return '';
        const stage=WORLD_STABILITY_DEFENSE_STAGES.find(item=>stable>=item.min)||WORLD_STABILITY_DEFENSE_STAGES.at(-1);
        const source=String(template??DEFAULT_STABILITY_PROMPT_TEMPLATE);
        if(!source.trim())return '';
        return source.split('{{阶段}}').join(stage.title).split('{{稳定值}}').join(String(stable)).split('{{规则}}').join(stage.rule);
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
    function ensurePresetStructure(value) {
        const current=splitPresetSegments(value||DEFAULT_PRESET).map(segment=>segment.title==='势力与地区'?{...segment,title:'探索与势力'}:segment);
        const defaults=splitPresetSegments(DEFAULT_PRESET);
        const titles=new Set(current.map(s=>s.title).filter(Boolean));
        for(const segment of defaults)if(segment.title&&!titles.has(segment.title))current.push(segment);
        return current.map(segmentText).filter(Boolean).join('\n');
    }    const WORLD_TECHNICAL_BOOK_PATTERNS=[/^\[variables\]/i,/^\[mvu_update\]/i,/^output_format_/i,/^⚙️额外思考(?:\.|$)/,/^行动选项_/i,/^【(?:主神任务|结算任务|试炼任务|选择世界)】/];

    class WorldKnowledgeSelectionPolicy {
        parseKey(value) {
            try{
                const parsed=JSON.parse(String(value||''));
                return Array.isArray(parsed)&&parsed.length>=2?[String(parsed[0]||''),String(parsed[1]??'')]:null;
            }catch(_){return null;}
        }
        normalizeIdentity(value) {
            let name=String(value||'').trim().toLowerCase();
            const versionAt=name.search(/(?:\bv(?:er(?:sion)?)?|版本)?\s*\d+(?:\.\d+){1,3}/i);
            if(versionAt>0)name=name.slice(0,versionAt);
            return name.replace(/[\s_\-·.]+/g,'');
        }
        normalizeTitle(value) {
            return String(value||'').trim().replace(/^⚙(?:\uFE0F)?\s*/u,'').trim();
        }
        matches(entry,selectedEntries) {
            if(!Array.isArray(selectedEntries))return entry?.enabled!==false;
            const exact=JSON.stringify([String(entry?.book||''),String(entry?.id??'')]);
            if(selectedEntries.includes(exact))return true;
            const entryBook=this.normalizeIdentity(entry?.book),entryId=String(entry?.id??'');
            for(const raw of selectedEntries){
                const ref=this.parseKey(raw);if(!ref||ref[1]!==entryId)continue;
                if(ref[0]==='*'||(entryBook&&this.normalizeIdentity(ref[0])===entryBook))return true;
            }
            return false;
        }
        isTechnical(title) {
            return WORLD_TECHNICAL_BOOK_PATTERNS.some(rule=>rule.test(String(title||'').trim()));
        }
        isTimelineBackbone(title) {
            const name=String(title||'').replace(/\s+/g,'');
            if(/(?:变量|输出格式|更新规则|COT|思考|风格|助手|状态栏)/i.test(name))return false;
            return /(?:校历|世界年表|事件年表|原著年表|时间线|时间轴|大事记|大事件摘要|历史大事件|剧情大纲|剧情章节|章节控制器|主线年表)/i.test(name);
        }
    }

    const DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY=new WorldKnowledgeSelectionPolicy();
    let ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;
    function parseSelectedEntryKey(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.parseKey(value);}
    function normalizeWorldbookIdentity(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.normalizeIdentity(value);}
    function normalizeWorldbookEntryTitle(value){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.normalizeTitle(value);}
    function selectedEntryMatches(entry,selectedEntries){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.matches(entry,selectedEntries);}
    function isTechnicalBook(title){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.isTechnical(title);}
    function isTimelineBackboneEntry(title){return ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY.isTimelineBackbone(title);}
    class WorldRecordCatalog {
        constructor(){
            this.npcAuditLevels=['杂兵级','精英级','首领/Boss级'];
            this.records={
                事件:{描述:'',时间:'',条件:'',前因:[],状态:'待发生',默认走向:'',结果:'',公开征兆:'',地点:''},
                人物:{所属世界:'',审计级别:'',地点:'',目标:'',行动:'',认知:[],下次检查:'',关联事件:[],公开动态:''},
                势力地区:{类型:'地区',描述:'',目标:'',进展:'',下次检查:'',关联事件:[],公开动态:''},
                历史:{时间:'',事实:'',关联事件:[]},
                传播:{关联事件:[],来源:'',范围:'',时间:'',内容:'',真相:'',状态:'传播中'}
            };
            this.details={
                事件:{分类:'',开始时间:'',预计结束:'',更新时间:'',下次检查:'',参与者:[],关联任务:[],可见影响:[{时间:'',地点:'',影响:''}]},
                人物:{状态:'',更新时间:'',开始时间:'',预计结束:'',行程:[{开始:'',结束:'',地点:'',行动:'',状态:'',结果:''}],承诺:[{对象:'',内容:'',期限:'',解除条件:''}],待决事项:[{问题:'',选项:[],等待:''}],关系变化:[{对象:'',关系:'',变化:'',时间:''}],认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:'',背景关联:[{类型:'',名称:'',关系:''}]},
                势力地区:{更新时间:'',控制方:'',争夺方:[],资源:[{名称:'',数量:'',用途:'',限制:''}],内部派系:[{名称:'',立场:'',行动:'',影响:''}],近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}]},
                历史:{},
                传播:{更新时间:'',到期时间:'',受众:[],引发行动:[]}
            };
            this.modelRecords=copy(this.records);
            this.modelDetails=copy(this.details);
            for(const key of ['承诺','待决事项','关系变化'])delete this.modelDetails.人物[key];
        }
    }

    class WorldEntityIdentityPolicy {
        key(value){
            return String(value||'').toLowerCase().replace(/[\\/／·・._\-\s]+/g,'');
        }
        stableNameIn(bucket,name){
            if(!plain(bucket))return '';
            if(Object.hasOwn(bucket,name))return name;
            const key=this.key(name),matches=Object.keys(bucket).filter(item=>this.key(item)===key);
            return matches.length===1?matches[0]:'';
        }
        locationRelated(a,b){
            const x=this.key(a),y=this.key(b);if(!x||!y)return false;
            return x===y||x.includes(y)||y.includes(x);
        }
    }

    const DEFAULT_WORLD_RECORD_CATALOG=new WorldRecordCatalog();
    const DEFAULT_WORLD_ENTITY_IDENTITY_POLICY=new WorldEntityIdentityPolicy();

    const NPC_AUDIT_LEVELS=DEFAULT_WORLD_RECORD_CATALOG.npcAuditLevels;
    const RECORDS=DEFAULT_WORLD_RECORD_CATALOG.records;
    const DETAILS=DEFAULT_WORLD_RECORD_CATALOG.details;
    const MODEL_RECORDS=DEFAULT_WORLD_RECORD_CATALOG.modelRecords;
    const MODEL_DETAILS=DEFAULT_WORLD_RECORD_CATALOG.modelDetails;

    const nameKey=value=>DEFAULT_WORLD_ENTITY_IDENTITY_POLICY.key(value);
    function stableNameIn(bucket,name){return DEFAULT_WORLD_ENTITY_IDENTITY_POLICY.stableNameIn(bucket,name);}
    function worldLocationRelated(a,b){return DEFAULT_WORLD_ENTITY_IDENTITY_POLICY.locationRelated(a,b);}
    class WorldStateFactory {
        emptyBackend() {
            return {版本:5,已处理楼层:'',已处理时间:'',事件:{},人物:{},势力地区:{},历史:{},历史总结:{},传播:{},最近变化:[],资产墓碑:{}};
        }
    }

    const DEFAULT_WORLD_STATE_FACTORY=new WorldStateFactory();
    function emptyState(){return DEFAULT_WORLD_STATE_FACTORY.emptyBackend();}

    const WORLD_MODEL_IGNORED_PATHS = [
        /^\/任务(?:\/|$)/,
        /^\/系统状态\/待播报记录$/,
        /^\/世界\/后台\/(?:版本|已处理楼层|已处理时间|运行记录|最近变化)(?:\/|$)/,
        /^\/世界\/后台\/剧本(?:\/|$)/
    ];

    class WorldPatchPolicy {
        tokens(path) {
            if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('补丁路径必须以 / 开头');
            const parts = path.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
            if (parts.some(p => !p || forbidden.has(p))) throw new Error('补丁路径含非法键');
            return parts;
        }

        get(obj,parts) {
            return parts.reduce((v,key)=>v!=null&&Object.prototype.hasOwnProperty.call(v,key)?v[key]:undefined,obj);
        }

        pointer(parts) {
            return '/'+parts.map(p=>String(p).replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
        }

        canonicalizeParts(parts,stat) {
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

        bootstrapBackendParent(stat,parts) {
            if(parts[0]!=='世界'||parts[1]!==PATH||parts.length!==5)return;
            const category=parts[2],name=parts[3];
            if(!['事件','人物','势力地区','传播'].includes(category))return;
            const bucket=stat.世界[PATH][category]||(stat.世界[PATH][category]={});
            if(Object.hasOwn(bucket,name))return;
            const seed=category==='事件'?{描述:name}:category==='人物'?{所属世界:stat.世界.名称||'',地点:'',行动:''}:{};
            bucket[name]=this.normalizeBackendRecord(category,seed);
        }

        canUpsertMissing(parts,stat) {
            if(parts[0]==='世界'&&parts[1]===PATH){
                if(parts[2]==='历史'||parts[2]==='剧本')return false;
                if(parts.length===4&&['事件','人物','势力地区','传播'].includes(parts[2]))return true;
                if(parts.length===5&&['事件','人物','势力地区','传播'].includes(parts[2])&&!!this.get(stat,parts.slice(0,4)))return true;
            }
            if(parts[0]==='世界'&&parts[1]==='因果轨道'&&parts[2]==='偏移记录'&&parts.length===4)return true;
            if(parts[0]==='世界'&&['势力','探索'].includes(parts[1])&&parts.length===3)return true;
            if(parts[0]==='传闻'&&['街头巷议','情报交易','布告与檄文'].includes(parts[1])&&parts.length===3)return true;
            return false;
        }

        checkRecord(value,template,optional={}) {
            if(!plain(value))throw new Error('记录必须是完整对象，不能是文本或数组');
            const missing=Object.keys(template).filter(k=>!Object.hasOwn(value,k));
            const unknown=Object.keys(value).filter(k=>!Object.hasOwn(template,k)&&!Object.hasOwn(optional,k));
            if(missing.length||unknown.length)throw new Error('记录字段不完整或不受支持：'+(missing.length?'缺少 '+missing.join('、'):'')+(unknown.length?'；未知 '+unknown.join('、'):''));
            for(const [key,base] of Object.entries(template)){
                const v=value[key];
                if(Array.isArray(base)?!Array.isArray(v)||v.some(x=>typeof x!=='string'):typeof v!==typeof base)throw new Error('记录字段类型错误：'+key);
            }
        }

        checkDetails(value,optional) {
            for(const [key,base] of Object.entries(optional)){
                if(!Object.hasOwn(value,key))continue;
                const v=value[key];
                if(Array.isArray(base)){
                    if(!Array.isArray(v))throw new Error('明细需为列表：'+key);
                    if(base.length)v.forEach(item=>this.checkRecord(item,base[0]));
                    else if(v.some(item=>typeof item!=='string'))throw new Error('明细需为文本列表：'+key);
                }else if(typeof v!==typeof base)throw new Error('明细类型错误：'+key);
            }
        }

        normalizeBackendRecord(category,value,old) {
            if(!plain(value)||!Object.hasOwn(RECORDS,category))return value;
            const template=RECORDS[category],optional=DETAILS[category]||{};
            const out=Object.assign(copy(template),plain(old)?copy(old):{});
            for(const [key,item] of Object.entries(value)){
                if(Object.hasOwn(template,key)||Object.hasOwn(optional,key))out[key]=copy(item);
            }
            return out;
        }

        sanitizeModelPatches(patches) {
            if(!Array.isArray(patches))return patches;
            return patches.filter(p=>!(plain(p)&&typeof p.path==='string'&&WORLD_MODEL_IGNORED_PATHS.some(rule=>rule.test(p.path))));
        }

        normalizeModelPatches(patches) {
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

        removable(parts) {
            const [a,b,c]=parts;
            if(a==='传闻')return true;
            if(a==='世界'&&b===PATH&&c==='传播')return true;
            if(a==='资产'&&parts.length===2)return true;
            return a==='世界'&&b==='因果轨道'&&c==='偏移记录'&&parts.length===4;
        }

        allowed(parts,stat,op='') {
            const [a,b,c,d]=parts;
            if(a==='世界'&&b===PATH){
                if(c==='剧本')return false;
                if(!Object.hasOwn(RECORDS,c)||!d)return false;
                if(c==='历史')return parts.length===4;
                return parts.length===4||(parts.length===5&&(Object.hasOwn(RECORDS[c],parts[4])||Object.hasOwn(DETAILS[c],parts[4])));
            }
            if(a==='世界'&&b==='因果轨道'){
                if(['当前阶段','故事线','下一节点'].includes(c))return parts.length===3;
                if(c==='偏移记录'&&parts.length===4&&op==='remove')return true;
                return !(stat.设置||{}).世界超稳&&c==='偏移记录'&&parts.length===4;
            }
            if(a==='世界'&&b==='时间')return parts.length===2;
            if(a==='世界'&&b==='货币')return parts.length===3&&Object.hasOwn(CURRENCY_FIELDS,c);
            if(a==='世界'&&b==='历法')return parts.length===3&&Object.hasOwn(CALENDAR_FIELDS,c);
            if(a==='世界'&&['势力','探索'].includes(b))return parts.length===3||(parts.length===4&&Object.hasOwn(b==='势力'?{实力:0,领地:0,描述:0,声望:0}:{风险:0,探索度:0,描述:0,隐藏真相:0},d));
            if(a==='世界'&&b==='异端雷达')return parts.length===5&&c==='名单'&&parts[4]==='状态'&&!(stat.设置||{}).单一世界;
            if(a==='传闻'&&['街头巷议','情报交易','布告与檄文'].includes(b))return parts.length===3;
            if(a==='资产')return parts.length===2&&!!b;
            if(a==='关系列表')return parts.length===3&&RELATION_SYNC_KEYS.has(c)&&!!this.get(stat,[a,b]);
            if(a==='任务')return parts.length===4&&['列表','副本成就'].includes(b)&&d==='状态'&&!!this.get(stat,[a,b,c]);
            return false;
        }
    }

    const DEFAULT_WORLD_PATCH_POLICY=new WorldPatchPolicy();
    let ACTIVE_WORLD_PATCH_POLICY=DEFAULT_WORLD_PATCH_POLICY;
    function tokens(path){return ACTIVE_WORLD_PATCH_POLICY.tokens(path);}
    function get(obj,parts){return ACTIVE_WORLD_PATCH_POLICY.get(obj,parts);}
    function pointer(parts){return ACTIVE_WORLD_PATCH_POLICY.pointer(parts);}
    function canonicalizeParts(parts,stat){return ACTIVE_WORLD_PATCH_POLICY.canonicalizeParts(parts,stat);}
    function bootstrapBackendParent(stat,parts){return ACTIVE_WORLD_PATCH_POLICY.bootstrapBackendParent(stat,parts);}
    function canUpsertMissing(parts,stat){return ACTIVE_WORLD_PATCH_POLICY.canUpsertMissing(parts,stat);}
    function checkRecord(value,template,optional={}){return ACTIVE_WORLD_PATCH_POLICY.checkRecord(value,template,optional);}
    function checkDetails(value,optional){return ACTIVE_WORLD_PATCH_POLICY.checkDetails(value,optional);}
    function normalizeBackendRecord(category,value,old){return ACTIVE_WORLD_PATCH_POLICY.normalizeBackendRecord(category,value,old);}
    function sanitizeModelPatches(patches){return ACTIVE_WORLD_PATCH_POLICY.sanitizeModelPatches(patches);}
    function normalizeModelPatches(patches){return ACTIVE_WORLD_PATCH_POLICY.normalizeModelPatches(patches);}
    function allowed(parts,stat,op=''){return ACTIVE_WORLD_PATCH_POLICY.allowed(parts,stat,op);}
    const WORLD_TIME_MACHINE_DESCRIPTION='精确到月日时使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段仅限：凌晨/黎明/清晨/早晨/上午/中午/午后/下午/傍晚/入夜/晚上/深夜；只能确定季节/阶段时可保留粗粒度。';
    const WORLD_DAYPART_ALIASES=Object.freeze({
        '清早':'清晨',
        '早上':'早晨',
        '黄昏':'傍晚',
        '夜晚':'晚上',
        '夜间':'晚上',
        '夜里':'晚上',
        '晚间':'晚上'
    });

    class WorldTimePolicy {
        normalizeDaypartAlias(value) {
            let source=String(value||'');
            for(const [alias,canonical] of Object.entries(WORLD_DAYPART_ALIASES))source=source.replaceAll(alias,canonical);
            return source;
        }

        key(value) {
            const source=this.normalizeDaypartAlias(value);
            let m=source.match(/(\d{1,4})\s*年\s*-?\s*(\d{1,2})\s*月\s*-?\s*(\d{1,2})\s*日/);
            if(!m)m=source.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
            if(!m)return null;
            const y=+m[1],month=+m[2],day=+m[3];
            if(!Number.isInteger(y)||!Number.isInteger(month)||!Number.isInteger(day)||month<1||month>12||day<1)return null;
            const date=new Date(0);
            date.setUTCFullYear(y,month-1,day);date.setUTCHours(0,0,0,0);
            if(date.getUTCFullYear()!==y||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;

            const exact=source.match(/(?:^|[日T\s_-])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?/);
            if(exact){
                const hour=Number(exact[1]),minute=Number(exact[2]),second=Number(exact[3]||0);
                if(!Number.isInteger(hour)||hour<0||hour>23)return null;
                return date.getTime()/3600000+hour+minute/60+second/3600;
            }

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

        capacity(previous,current) {
            const from=String(previous||'').trim(),to=String(current||'').trim();
            const a=this.key(from),b=this.key(to);
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

        calendarDate(value,calendar) {
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

        dayKey(value) {
            const key=this.key(value);
            return key===null?null:Math.floor(key/24);
        }

        hasExactClock(value) {
            return /(?:^|[日T\s_-])(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?/.test(String(value||''));
        }
        unset(value) {
            const raw=String(value??'').trim();
            return !raw||raw==='待初始化';
        }

        identity(value) {
            return String(value??'').trim().replace(/[\s·・_—–-]+/g,'');
        }

        claimsMonthDay(value) {
            const source=String(value??'').trim();
            return !!source&&/月/.test(source)&&/(?:第\s*)?\d{1,2}\s*日/.test(source);
        }

        calendarFor(stat,result) {
            return plain(result?.历法)?result.历法:(plain(stat?.世界?.历法)?stat.世界.历法:{});
        }

        assertCalendarCompatibleTimeValue(stat,result,value,label='时间') {
            const raw=String(value??'').trim();
            if(!this.claimsMonthDay(raw))return;
            if(this.calendarDate(raw,this.calendarFor(stat,result)))return;
            throw new Error(label+'格式无法用于日历：'+raw+'。精确到月日时请使用 {yyy}年-{mm}月-{dd}日-{时间段}；不要用月份名称替代数字月。');
        }

        assertCalendarCompatibleWorldResultTimes(stat,result) {
            const temporalKeys=new Set(['时间','开始时间','预计结束','更新时间','到期时间','下次检查','开始','结束','期限','获知时间']);
            const walk=(value,path=[])=>{
                if(Array.isArray(value)){for(let i=0;i<value.length;i++)walk(value[i],path.concat(i));return;}
                if(!plain(value))return;
                for(const [key,child] of Object.entries(value)){
                    const nextPath=path.concat(key);
                    if(typeof child==='string'&&temporalKeys.has(key))this.assertCalendarCompatibleTimeValue(stat,result,child,nextPath.join('.'));
                    else if(child&&typeof child==='object')walk(child,nextPath);
                }
            };
            walk(result);
            return result;
        }

        inferFromCurrentActivities(result) {
            const candidates=new Map();
            for(const item of result?.人物||[]){
                if(!plain(item)||item.操作==='撤销本轮')continue;
                const activeFacts=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
                const raw=String(item.更新时间||'').trim();
                if(!activeFacts||!raw)continue;
                const key=this.identity(raw);if(key&&!candidates.has(key))candidates.set(key,raw);
            }
            return candidates.size===1?Array.from(candidates.values())[0]:'';
        }

        resolveProposal(stat,result) {
            const explicit=String(result?.时间||'').trim();
            if(explicit)return explicit;
            if(!this.unset(stat?.世界?.时间))return '';
            return this.inferFromCurrentActivities(result);
        }

        assertNotBackwards(stat,nextTime) {
            const current=String(stat?.世界?.时间||'').trim();
            if(this.unset(current)||!nextTime)return;
            const before=this.key(current),after=this.key(nextTime);
            if(before!==null&&after!==null&&after<before)throw new Error('世界时间不可回退：'+current+' -> '+nextTime);
        }

        prepareCompile(stat,result) {
            const proposal=this.resolveProposal(stat,result);
            if(proposal)result.时间=proposal;
            this.assertCalendarCompatibleWorldResultTimes(stat,result);
            if(proposal)this.assertNotBackwards(stat,proposal);
            if(!proposal)return {proposal:'',result,validationStat:stat};
            const validationStat=copy(stat);
            if(!plain(validationStat.世界))validationStat.世界={};
            validationStat.世界.时间=proposal;
            return {proposal,result,validationStat};
        }

        finalizeCompile(originalStat,proposal,compiled) {
            if(!proposal)return compiled;
            const old=originalStat?.世界?.时间;
            if(String(old??'')!==proposal)compiled.patches.unshift({op:old===undefined?'add':'replace',path:'/世界/时间',value:proposal});
            compiled.result.时间=proposal;
            return compiled;
        }
    }

    const DEFAULT_WORLD_TIME_POLICY=new WorldTimePolicy();
    let ACTIVE_WORLD_TIME_POLICY=DEFAULT_WORLD_TIME_POLICY;
    function worldDateKey(value){return ACTIVE_WORLD_TIME_POLICY.key(value);}
    function worldTimeCapacity(previous,current){return ACTIVE_WORLD_TIME_POLICY.capacity(previous,current);}
    function calendarDate(value,calendar){return ACTIVE_WORLD_TIME_POLICY.calendarDate(value,calendar);}
    class WorldDueEventPolicy {
        constructor(timePolicy=DEFAULT_WORLD_TIME_POLICY){this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;}

        reviewPoint(event) {
            const nextCheck=String(event?.下次检查||'').trim();
            if(nextCheck)return {原文:nextCheck,键:this.timePolicy.key(nextCheck),来源:'下次检查'};
            const planned=String(event?.时间||event?.开始时间||'').trim();
            return {原文:planned,键:this.timePolicy.key(planned),来源:'计划时间'};
        }

        review(stat) {
            const now=this.timePolicy.key(stat?.世界?.时间);if(now===null)return [];
            const events=stat?.世界?.[PATH]?.事件||{},due=[];
            for(const [名称,event] of Object.entries(events)){
                if(!plain(event)||event.状态!=='待发生')continue;
                const review=this.reviewPoint(event);
                if(review.来源==='下次检查'&&review.键!==null&&review.键>now)continue;
                if(review.来源==='计划时间'&&(review.键===null||review.键>now))continue;
                due.push({
                    名称,
                    时间:String(event.时间||event.开始时间||''),
                    下次检查:String(event.下次检查||''),
                    条件:String(event.条件||''),
                    前因:copy(event.前因||[]),
                    复核依据:review.来源,
                    说明:'软提醒：该事件已到计划/复核时间。条件与前因满足则转为进行中；若暂不发生，可保持待发生并优先填写新的“下次检查”。“条件”只表示事件触发条件，不要改写成延期阻碍。未处理不会导致本轮世界推进被驳回。'
                });
            }
            return due;
        }

        ensureHandled(_next,_dueList,_worldTime) {
            return [];
        }
    }

    const DEFAULT_WORLD_DUE_EVENT_POLICY=new WorldDueEventPolicy();
    function dueEventReviewPoint(event){return DEFAULT_WORLD_DUE_EVENT_POLICY.reviewPoint(event);}
    function relaxedDueEvents(stat){return DEFAULT_WORLD_DUE_EVENT_POLICY.review(stat);}
    // 世界活动交付：异端只是世界中的一类人物，不能成为唯一会变化的后台对象。
    const WORLD_ACTIVITY_DELIVERY_RULES=`【世界活动交付 · 非异端世界必须推进】
1. 世界推进不是“异端模拟器”。每轮按：进行中/到期事件 → 势力与地区现场 → 普通热人物 → 传播 → 异端复核 的顺序推演；异端不能替代其它世界活动。
2. 新世界或旧存档缺少世界现场时，本轮必须建立至少1个与当前地点/阶段相关的地区，并建立至少1个正在发生的当前事件/近期节点。势力为空时应优先补充一个当前真正参与局势的真实势力/组织；若建立势力，同名写入 WorldResult.势力（顶层实力/领地/声望档案）与 WorldResult.势力地区（类型=势力的动态现场）。势力初始化属于软目标，不能为了补档案编造组织，也不得因势力片段验收失败拖垮其它真实世界推进。
3. 每轮世界推进至少提交1项“非异端实质变化”：进行中事件推进/转态、势力或地区状态变化、普通人物自身事务推进三者之一。只改更新时间、下次检查、重复原文或只补未来宏观规划不算实质变化。
4. 变化幅度服从本轮时间容量。时间未推进时只推进即时反应/同步结果；数小时、跨日或数日时再按容量推进更大的行动。不得为了满足本条凭空制造重大事件。
5. 如果某类对象确实没有可变化事项，优先推进另外两类；只有世界本身已经终止/冻结的明确设定才允许没有非异端变化，普通“正文没有提到”不是停摆理由。`;

    class WorldActivityPolicy {
        semanticRecord(record,kind) {
            const out=plain(record)?copy(record):{};
            delete out.更新时间;
            delete out.下次检查;
            if(kind==='事件'&&out.分类==='宏观节点'&&out.状态==='待发生')return null;
            return out;
        }

        recordMap(records,kind,excludeNames=new Set()) {
            const out={};
            for(const [name,record] of Object.entries(records||{})){
                if(excludeNames.has(nameKey(name)))continue;
                const semantic=this.semanticRecord(record,kind);
                if(semantic!==null)out[nameKey(name)]=semantic;
            }
            return out;
        }

        counts(stat) {
            const backend=stat?.世界?.[PATH]||{},areas=backend.势力地区||{},events=backend.事件||{},people=backend.人物||{};
            const alienKeys=new Set(Object.keys(stat?.世界?.异端雷达?.名单||{}).map(nameKey));
            return {
                地区数:Object.values(areas).filter(record=>plain(record)&&String(record.类型||'地区')!=='势力').length,
                动态势力数:Object.values(areas).filter(record=>plain(record)&&String(record.类型||'地区')==='势力').length,
                顶层势力数:Object.keys(stat?.世界?.势力||{}).length,
                进行中世界事件数:Object.values(events).filter(record=>plain(record)&&record.状态==='进行中'&&record.分类!=='宏观节点').length,
                普通人物数:Object.entries(people).filter(([name,record])=>plain(record)&&!alienKeys.has(nameKey(name))).length
            };
        }

        requirement(stat) {
            const backend=stat?.世界?.[PATH]||{},counts=this.counts(stat);
            const alienKeys=new Set(Object.keys(stat?.世界?.异端雷达?.名单||{}).map(nameKey));
            return {
                世界:String(stat?.世界?.名称||''),
                当前时间:String(stat?.世界?.时间||''),
                当前地点:String(stat?.世界?.地点||''),
                当前数量:counts,
                初始化缺口:{
                    地区:counts.地区数<1,
                    势力:counts.动态势力数<1||counts.顶层势力数<1,
                    当前事件:counts.进行中世界事件数<1
                },
                必须非异端实质变化:true,
                基线:{
                    事件:this.recordMap(backend.事件,'事件'),
                    势力地区:this.recordMap(backend.势力地区,'势力地区'),
                    普通人物:this.recordMap(backend.人物,'人物',alienKeys),
                    势力:this.recordMap(stat?.世界?.势力||{},'势力')
                }
            };
        }

        changed(next,requirement) {
            const backend=next?.世界?.[PATH]||{},alienKeys=new Set(Object.keys(next?.世界?.异端雷达?.名单||{}).map(nameKey));
            const after={
                事件:this.recordMap(backend.事件,'事件'),
                势力地区:this.recordMap(backend.势力地区,'势力地区'),
                普通人物:this.recordMap(backend.人物,'人物',alienKeys),
                势力:this.recordMap(next?.世界?.势力||{},'势力')
            },changed=[];
            for(const category of Object.keys(after)){
                const before=requirement?.基线?.[category]||{},current=after[category]||{};
                const names=new Set([...Object.keys(before),...Object.keys(current)]);
                for(const name of names)if(!same(before[name],current[name])){changed.push(category+'/'+name);break;}
            }
            return changed;
        }

        ensureDelivery(next,requirement) {
            if(!requirement||next?.系统状态?.是否在主神空间)return [];
            const counts=this.counts(next),issues=[];
            if(requirement.初始化缺口?.地区&&counts.地区数<1)issues.push('缺少地区现场：至少建立1个与当前地点/阶段相关的地区');
            if(requirement.初始化缺口?.当前事件&&counts.进行中世界事件数<1)issues.push('缺少正在发生的世界事件：至少建立1个进行中的当前事件/近期节点，未来宏观节点不能替代');
            const changed=this.changed(next,requirement);
            if(requirement.必须非异端实质变化&&!changed.length)issues.push('本轮只有异端/维护/未来规划，没有任何非异端世界侧实质变化；必须推进事件、势力地区、顶层势力或普通人物至少一项');
            if(issues.length)throw new Error('世界活动不足：'+issues.join('；'));
            return changed;
        }

        repairRequired(stat) {
            const requirement=this.requirement(stat),counts=requirement.当前数量;
            return counts.地区数<1||counts.进行中世界事件数<1;
        }
    }

    const DEFAULT_WORLD_ACTIVITY_POLICY=new WorldActivityPolicy();
    function worldActivitySemanticRecord(record,kind){return DEFAULT_WORLD_ACTIVITY_POLICY.semanticRecord(record,kind);}
    function worldActivityMap(records,kind,excludeNames=new Set()){return DEFAULT_WORLD_ACTIVITY_POLICY.recordMap(records,kind,excludeNames);}
    function worldActivityCounts(stat){return DEFAULT_WORLD_ACTIVITY_POLICY.counts(stat);}
    function worldActivityRequirement(stat){return DEFAULT_WORLD_ACTIVITY_POLICY.requirement(stat);}
    function worldActivityChanged(next,requirement){return DEFAULT_WORLD_ACTIVITY_POLICY.changed(next,requirement);}
    function ensureWorldActivityDelivery(next,requirement){return DEFAULT_WORLD_ACTIVITY_POLICY.ensureDelivery(next,requirement);}
    function worldActivityRepairRequired(stat){return DEFAULT_WORLD_ACTIVITY_POLICY.repairRequired(stat);}
    const VAGUE_EVENT_TIME=/^(?:近期|稍后|未来|之后|待定|未定|未知|不详|待确认|时间未定|日期未定)$/;
    const STALE_CURRENT_EVENT_HOURS=7*24;
    const STALE_NEAR_EVENT_HOURS=30*24;
    class WorldTimelinePolicy {
        constructor(timePolicy=DEFAULT_WORLD_TIME_POLICY){this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;}
        storyStages(value) {
            return String(value||'').split(/\s*(?:→|⇒|->|=>|\n)\s*/).map(x=>x.trim()).filter(x=>x&&!/^(待初始化|无|未知)$/.test(x));
        }
        importStory(stat) {
            const orbit=stat.世界.因果轨道||{},events=stat.世界[PATH]?.事件||{};
            if(Object.values(events).some(e=>e.分类==='主线节点'))return [];
            const stages=this.storyStages(orbit.故事线);
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
        timelineState(stat) {
            const state=stat.世界[PATH],events=Object.entries(state.事件||{}),now=this.timePolicy.key(stat.世界.时间);
            const waiting=events.filter(([,e])=>['待发生','进行中'].includes(e.状态));
            const near=events.filter(([,e])=>['当前事件','近期节点'].includes(e.分类));
            const macro=events.filter(([,e])=>e.分类==='宏观节点');
            const macroFuture=macro.filter(([,e])=>e.状态==='待发生');
            const macroOpen=macro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
            const expand=macroFuture.filter(([,e])=>{const t=this.timePolicy.key(e.时间||e.开始时间);return now!==null&&t!==null&&t>=now&&t-now<=7*24;});
            const semantic=waiting.filter(([,e])=>String(e.时间||e.开始时间||'').trim()&&this.timePolicy.key(e.时间||e.开始时间)===null);
            const orbit=stat.世界.因果轨道||{},orbitStages=this.storyStages(orbit.故事线);
            const macroNames=new Set(macro.map(([name])=>name));
            const orbitProjectionInvalid=orbitStages.length<3||orbitStages.length>5||orbitStages.some(name=>!macroNames.has(name));
            const orbitMacro=macroFuture.find(([name])=>name===orbit.下一节点);
            const datedMacro=macroFuture.map((item,index)=>({item,index,key:this.timePolicy.key(item[1].时间||item[1].开始时间)}))
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
                桥接区间:{起点:stat.世界.时间,终点:nextMacro?.时间||'待建立宏观节点',边界事件:nextMacro?.名称||''},
                需要展开的宏观节点:expand.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因})),
                需语义复核节点:semantic.map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,下次检查:e.下次检查})),
                说明:'先用因果轨道、当前事实与模型已有世界/原著知识建立宏观骨架；世界书若存在只作补充校正。随后仅展开当前时间到下一宏观节点之间的近期事件、人物、势力与传播。非公历或作品内时间按作品语义比较，不强行改写为公历。'
            };
        }
        sameTimeAnchor(a,b) {
            const x=String(a||'').trim(),y=String(b||'').trim();if(!x||!y)return false;
            if(x===y)return true;
            const shorter=x.length<=y.length?x:y,longer=x.length<=y.length?y:x;
            return shorter.length>=8&&longer.includes(shorter);
        }
        eventTimeAnchor(event) {
            return String(event?.时间||event?.开始时间||'').trim();
        }
        eventScheduleLabel(event) {
            const raw=this.eventTimeAnchor(event);
            if(raw&&!VAGUE_EVENT_TIME.test(raw))return raw;
            const condition=String(event?.条件||'').trim();
            if(condition)return '条件触发 · '+condition;
            const predecessors=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
            if(predecessors.length)return '前置节点后 · '+predecessors.join('、');
            return '时间待补';
        }
        staleActiveEvents(stat) {
            const now=this.timePolicy.key(stat?.世界?.时间);if(now===null)return [];
            const out=[];
            for(const [名称,event] of Object.entries(stat?.世界?.[PATH]?.事件||{})){
                if(event?.状态!=='进行中'||event?.分类==='宏观节点')continue;
                const touched=this.timePolicy.key(event.更新时间||event.时间||event.开始时间);
                if(touched===null)continue;
                const threshold=event.分类==='当前事件'?STALE_CURRENT_EVENT_HOURS:STALE_NEAR_EVENT_HOURS;
                const age=now-touched;
                if(age>threshold)out.push({名称,分类:event.分类,状态:event.状态,时间:event.时间||event.开始时间||'',更新时间:event.更新时间||'',已陈旧小时:age,说明:'局部活动长期停留在进行中；应结束/取消，或确认仍持续并更新到当前世界时间、当前进展与下次检查。'});
            }
            return out;
        }
        temporalAnomalies(stat) {
            const nowRaw=String(stat?.世界?.时间||''),nowKey=this.timePolicy.key(nowRaw),nowDay=this.timePolicy.dayKey(nowRaw);
            if(nowDay===null)return [];
            const nowExact=this.timePolicy.hasExactClock(nowRaw),state=stat?.世界?.[PATH]||{},out=[];
            const push=(类型,名称,字段,值,原因)=>{
                const valueRaw=String(值||''),valueKey=this.timePolicy.key(valueRaw),valueDay=this.timePolicy.dayKey(valueRaw);
                if(valueDay===null)return;
                if(valueDay>nowDay){out.push({类型,名称,字段,值:valueRaw,原因});return;}
                if(valueDay<nowDay||类型!=='人物'||!nowExact||!this.timePolicy.hasExactClock(valueRaw))return;
                if(nowKey!==null&&valueKey!==null&&valueKey>nowKey)out.push({类型,名称,字段,值:valueRaw,原因});
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
        validateTemporalWrites(before,next,patches) {
            const touched=new Set();
            for(const patch of patches||[]){
                let parts;try{parts=tokens(patch.path);}catch(_){continue;}
                if(parts[0]!=='世界'||parts[1]!==PATH)continue;
                if(['事件','人物','势力地区','历史','传播'].includes(parts[2])&&parts[3])touched.add(parts[2]+'\u0000'+parts[3]);
            }
            if(!touched.size)return;
            // Preserve the remaining rumor runtime decorator on the public compatibility seam.
            const all=temporalAnomalies(next);
            const hit=all.find(item=>touched.has(item.类型+'\u0000'+item.名称));
            if(hit)throw new Error('时间事实超过当前世界时间：'+hit.类型+'/'+hit.名称+' '+hit.字段+'='+hit.值+'；'+hit.原因);
        }
        eventDisplayBucket(event) {
            if(event?.状态==='进行中')return 0;
            if(event?.状态==='待发生'&&event?.分类==='当前事件')return 1;
            if(event?.状态==='待发生'&&event?.分类==='近期节点')return 2;
            if(event?.状态==='待发生'&&event?.分类==='宏观节点')return 3;
            if(event?.状态==='已完成')return 4;
            if(event?.状态==='已取消')return 5;
            return 6;
        }
        sortWorldEvents(records,orbit={}) {
            const storyIndex=new Map(this.storyStages(orbit?.故事线).map((name,index)=>[nameKey(name),index]));
            return Object.entries(records||{}).sort((a,b)=>{
                const bucket=this.eventDisplayBucket(a[1])-this.eventDisplayBucket(b[1]);if(bucket)return bucket;
                if(a[1]?.分类==='宏观节点'&&b[1]?.分类==='宏观节点'){
                    const ai=storyIndex.get(nameKey(a[0])),bi=storyIndex.get(nameKey(b[0]));
                    if(ai!==undefined||bi!==undefined){
                        if(ai===undefined)return 1;
                        if(bi===undefined)return -1;
                        if(ai!==bi)return ai-bi;
                    }
                }
                const da=this.timePolicy.key(a[1]?.时间||a[1]?.开始时间),db=this.timePolicy.key(b[1]?.时间||b[1]?.开始时间);
                if(da!==db)return (da??Infinity)-(db??Infinity);
                return String(a[0]).localeCompare(String(b[0]),'zh-CN');
            });
        }
    }
    const DEFAULT_WORLD_TIMELINE_POLICY=new WorldTimelinePolicy();
    let ACTIVE_WORLD_TIMELINE_POLICY=DEFAULT_WORLD_TIMELINE_POLICY;
    function storyStages(value){return ACTIVE_WORLD_TIMELINE_POLICY.storyStages(value);}
    function importStory(stat){return ACTIVE_WORLD_TIMELINE_POLICY.importStory(stat);}
    function timelineState(stat){return ACTIVE_WORLD_TIMELINE_POLICY.timelineState(stat);}
    function sameWorldTimeAnchor(a,b){return ACTIVE_WORLD_TIMELINE_POLICY.sameTimeAnchor(a,b);}
    function eventTimeAnchor(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventTimeAnchor(event);}
    function eventScheduleLabel(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventScheduleLabel(event);}
    function staleActiveEvents(stat){return ACTIVE_WORLD_TIMELINE_POLICY.staleActiveEvents(stat);}
    function temporalAnomalies(stat){return ACTIVE_WORLD_TIMELINE_POLICY.temporalAnomalies(stat);}
    function validateTemporalWrites(before,next,patches){return ACTIVE_WORLD_TIMELINE_POLICY.validateTemporalWrites(before,next,patches);}
    function eventDisplayBucket(event){return ACTIVE_WORLD_TIMELINE_POLICY.eventDisplayBucket(event);}
    function sortWorldEvents(records,orbit={}){return ACTIVE_WORLD_TIMELINE_POLICY.sortWorldEvents(records,orbit);}
    const SOFT_MAINTENANCE_RULES=`【分级验收 · 软维护不拒绝整轮】
1. Schema、非法状态、因果引用损坏、明确原著/数据库日期冲突仍属于硬错误；事件排期补全、传闻补齐与传播复核属于软维护，不得仅因软维护未完成而拒绝整轮已合格结果。
2. 事件已有具体时间、有效条件或明确前因任一项，即视为已有可用时间锚点；条件/前因属于合法相对或因果时间，不要求重复补写日期。
3. 公开传闻为空时优先补1条真实世界信息；未补到的分类保留为下轮维护项，不要求为了凑齐传闻重写已经合格的事件、人物、因果等模块。此条取代“空分类本轮必须补2条”的硬验收含义。
4. 纠错只修真正的硬错误或被拒绝片段；已经通过的片段沿用，不要整包重写。`;

    class WorldSoftMaintenancePolicy {
        constructor(timeline=DEFAULT_WORLD_TIMELINE_POLICY){this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;}

        eventHasUsableSchedule(event) {
            if(!plain(event))return false;
            const raw=this.timeline.eventTimeAnchor(event);
            if(raw&&!VAGUE_EVENT_TIME.test(raw))return true;
            const condition=String(event.条件||'').trim();
            if(condition&&!/^(?:无|暂无|无条件|未知|待定|未定|不详|待确认)$/.test(condition))return true;
            return Array.isArray(event.前因)&&event.前因.some(Boolean);
        }

        unscheduledEvents(stat) {
            return Object.entries(stat?.世界?.[PATH]?.事件||{}).filter(([,event])=>{
                if(!['待发生','进行中'].includes(event?.状态))return false;
                return !this.eventHasUsableSchedule(event);
            }).map(([名称,event])=>({
                名称,分类:event.分类,状态:event.状态,条件:event.条件,
                前因:copy(event.前因||[]),当前时间:this.timeline.eventScheduleLabel(event)
            }));
        }

        ensureEventTimeAnchors(next,required=[]) {
            const missing=[];
            for(const item of required||[]){
                const event=next?.世界?.[PATH]?.事件?.[item.名称];
                if(!event||!['待发生','进行中'].includes(event.状态))continue;
                if(!this.eventHasUsableSchedule(event))missing.push(item.名称);
            }
            return missing;
        }
    }

    const DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY=new WorldSoftMaintenancePolicy();
    let ACTIVE_WORLD_SOFT_MAINTENANCE_POLICY=DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY;
    function eventHasUsableSchedule(event){return ACTIVE_WORLD_SOFT_MAINTENANCE_POLICY.eventHasUsableSchedule(event);}
    class WorldChronologyPolicy {
        constructor(){this.guard=null;}

        setGuard(worldTime,books=[]){
            this.guard={worldTime:String(worldTime||''),books:Array.isArray(books)?books.map(String):[]};
            return this.guard;
        }

        clearGuard(){this.guard=null;}

        compactName(value) {
            return String(value||'').toLowerCase().replace(/[《》【】\[\]()（）“”‘’'"·・:：,，。.!！?？\s_\-\/\\]+/g,'');
        }

        evidenceForEvent(eventName,texts) {
            const name=String(eventName||'').trim();if(!name)return null;
            const datePattern=/(\d{1,4}\s*年\s*-?\s*\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/g;
            let best=null;
            for(const rawText of texts||[]){
                const text=String(rawText||'');if(!text)continue;
                let at=text.indexOf(name),fromIndex=0;
                while(at>=0){
                    const left=Math.max(0,at-180),right=Math.min(text.length,at+name.length+180),window=text.slice(left,right),center=at-left+name.length/2;
                    datePattern.lastIndex=0;let match;
                    while((match=datePattern.exec(window))){
                        const key=worldDateKey(match[0]);if(key===null)continue;
                        const distance=Math.abs((match.index+match[0].length/2)-center);
                        if(!best||distance<best.distance)best={raw:match[0],key,distance};
                    }
                    fromIndex=at+Math.max(1,name.length);at=text.indexOf(name,fromIndex);
                }
            }
            return best;
        }

        shiftDeclared(stat,result,eventName) {
            const target=this.compactName(eventName);if(!target)return false;
            const records=[];
            for(const [name,item] of Object.entries(stat?.世界?.因果轨道?.偏移记录||{}))records.push({名称:name,...(plain(item)?item:{})});
            for(const item of result?.因果?.偏移记录||[])if(plain(item))records.push(item);
            return records.some(item=>{
                if(Number(item?.影响程度)===0)return false;
                const marker=this.compactName(item?.名称),desc=String(item?.描述||''),signal=String(item?.名称||'')+' '+desc;
                const directlyRelated=(marker&&(marker.includes(target)||target.includes(marker)))||desc.includes(String(eventName||''));
                if(!directlyRelated)return false;
                const scheduleShift=/(提前|提早|延后|推迟|改期|时序|时间线|日期|进程|节点)/;
                const plotShift=/(失效|取消|中止|终止|不再发生|无法(?:按|照)?原定|原定.*(?:失效|改变)|改写|替代|分歧|偏离|阻止|避免|主线.*(?:改变|失效|重构)|剧情.*(?:改变|失效|重构))/;
                return scheduleShift.test(signal)||plotShift.test(signal);
            });
        }

        validate(stat,result) {
            const guard=this.guard;if(!guard?.books?.length)return result;
            const events=stat?.世界?.[PATH]?.事件||{};
            for(const event of result?.事件||[]){
                if(!plain(event)||event.操作==='撤销本轮')continue;
                const storedName=stableNameIn(events,String(event.名称||'')),stored=storedName?events[storedName]:null;
                const category=String(event.分类||stored?.分类||'');
                const status=String(event.状态||stored?.状态||'待发生');
                if(category!=='宏观节点'||status!=='待发生')continue;
                if(!Object.hasOwn(event,'时间')&&!Object.hasOwn(event,'开始时间'))continue;
                const evidence=this.evidenceForEvent(event.名称,guard.books);if(!evidence)continue;
                if(this.shiftDeclared(stat,result,event.名称))continue;
                const proposedRaw=String(event.时间||event.开始时间||'').trim(),proposed=worldDateKey(proposedRaw);
                if(proposed===null)throw new Error('宏观节点日期未服从原著/数据库时间锚点：'+event.名称+'；资料明确为 '+evidence.raw+'，不得改成模糊或不可比较时间。若已确认因果偏移改变了该节点的日期、成立条件或是否发生，必须同轮提交明确关联该节点的因果.偏移记录并只重构受影响节点。');
                if(Math.floor(proposed/24)!==Math.floor(evidence.key/24))throw new Error('宏观节点日期与原著/数据库时间锚点冲突：'+event.名称+' 提交 '+proposedRaw+'，资料明确为 '+evidence.raw+'；不得为了推进剧情提前或压缩原著时间。若已确认因果偏移改变了该节点的日期、成立条件或是否发生，必须同轮提交明确关联该节点的因果.偏移记录并只重构受影响节点。');
            }
            return result;
        }

        retryGuidance(error,rejected=[]) {
            const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
            if(!/宏观节点日期(?:未服从|与).*原著\/数据库时间锚点/.test(messages))return '';
            return DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE.format('retryGuideChronology');
        }
    }

    const DEFAULT_WORLD_CHRONOLOGY_POLICY=new WorldChronologyPolicy();
    class WorldLifecycleService {
        personActivityMeta(stat,name,person) {
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
        pruneColdTemporaryPeople(stat) {
            const people=stat?.世界?.[PATH]?.人物;if(!plain(people))return [];
            const removed=[];
            for(const [name,person] of Object.entries(people)){
                if(!plain(person))continue;
                const meta=this.personActivityMeta(stat,name,person);
                const protectedNow=!!(meta.formalName||meta.activeAlien||meta.linked||meta.participant||meta.here||meta.dueSoon);
                if(protectedNow)continue;
                const stale=meta.ageHours!==null&&meta.ageHours>COLD_TEMP_PERSON_GRACE_HOURS;
                if(meta.terminal||stale){delete people[name];removed.push(name);}
            }
            const cold=Object.entries(people).filter(([name,person])=>{
                if(!plain(person))return false;
                const meta=this.personActivityMeta(stat,name,person);
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
        pruneDeadAlienPeople(stat) {
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
        collectEventRefs(state) {
            const refs=new Set();
            for(const event of Object.values(state.事件||{}))for(const id of event.前因||[])refs.add(id);
            for(const category of ['人物','势力地区','传播'])for(const record of Object.values(state[category]||{}))for(const id of record.关联事件||[])refs.add(id);
            return refs;
        }
        detachEventSoftRefs(state,eventName) {
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
        archiveFinishedEvent(stat,state,name,event,archived) {
            // 历史锚点是永久已确认事实，不再按固定数量删除；旧事实由分层历史总结退出热上下文。
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
        propagationEnded(record,nowKey) {
            if(!plain(record))return true;
            const status=String(record.状态||'').trim();
            if(/^(?:已结束|结束|已停止|停止|已失效|失效|已过期|过期|传播结束)$/.test(status))return true;
            const expiry=worldDateKey(record.到期时间);
            return expiry!==null&&nowKey!==null&&expiry<=nowKey;
        }
        pruneSoftRefsToColdFinishedEvents(state,now) {
            if(now===null)return [];
            const cold=new Set();
            for(const [name,event] of Object.entries(state?.事件||{})){
                if(!['已完成','已取消'].includes(event?.状态))continue;
                const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
                if(endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)cold.add(name);
            }
            if(!cold.size)return [];
            const changed=[];
            for(const eventName of cold)changed.push(...this.detachEventSoftRefs(state,eventName));
            // 冷结束事件之间不再互相作为热前因；活跃/未来事件对旧事实的前因引用继续保护归档。
            for(const [name,event] of Object.entries(state?.事件||{})){
                if(!cold.has(name)||!Array.isArray(event?.前因)||!event.前因.some(id=>cold.has(id)))continue;
                event.前因=event.前因.filter(id=>!cold.has(id));
                changed.push('事件/'+name);
            }
            return changed;
        }
        compactFinishedEvents(stat,target=EVENT_TARGET) {
            const state=stat?.世界?.[PATH]; if(!state?.事件)return [];
            const archived=[],now=worldDateKey(stat?.世界?.时间);
            this.pruneSoftRefsToColdFinishedEvents(state,now);
            const protectedNames=new Set(storyStages(stat?.世界?.因果轨道?.故事线));
            let refs=this.collectEventRefs(state);
            const finished=()=>Object.entries(state.事件||{}).filter(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name)&&!protectedNames.has(name));
            // 有明确时间的旧结束事件，在经过一个世界日后直接冷归档；刚结束内容至少保留到下一阶段。
            for(const [name,event] of finished()){
                const endedAt=worldDateKey(event.更新时间||event.预计结束||event.时间);
                if(now!==null&&endedAt!==null&&now-endedAt>=FINISHED_EVENT_GRACE_HOURS)this.archiveFinishedEvent(stat,state,name,event,archived);
            }
            refs=this.collectEventRefs(state);
            let candidates=finished();
            while(candidates.length>RECENT_FINISHED_EVENT_TARGET){
                const [name,event]=candidates[0];
                this.archiveFinishedEvent(stat,state,name,event,archived);
                refs=this.collectEventRefs(state);candidates=finished();
            }
            while(Object.keys(state.事件||{}).length>target){
                refs=this.collectEventRefs(state);
                const candidate=Object.entries(state.事件||{}).find(([name,event])=>['已完成','已取消'].includes(event.状态)&&!refs.has(name));
                if(!candidate)break;
                this.archiveFinishedEvent(stat,state,candidate[0],candidate[1],archived);
            }
            return archived;
        }
        compact(stat) {
            const state=stat?.世界?.[PATH];
            if(!state)return {归档事件:[],回收传播:[],回收人物:[],回收探索:[]};
            const now=worldDateKey(stat?.世界?.时间),removedPropagation=[];
            for(const [name,record] of Object.entries(state.传播||{})){
                if(this.propagationEnded(record,now)){delete state.传播[name];removedPropagation.push(name);}
            }
            const archived=this.compactFinishedEvents(stat);
            const removedPeople=[...this.pruneDeadAlienPeople(stat),...this.pruneColdTemporaryPeople(stat)];
            return {
                归档事件:archived,
                回收传播:removedPropagation,
                回收人物:[...new Set(removedPeople)],
                // 探索是玩家长期台账：离开区域后不再由 lifecycle 回收。
                回收探索:[]
            };
        }
    }
    const DEFAULT_WORLD_LIFECYCLE_SERVICE=new WorldLifecycleService();
    let ACTIVE_WORLD_LIFECYCLE_SERVICE=DEFAULT_WORLD_LIFECYCLE_SERVICE;
    function personActivityMeta(stat,name,person){return ACTIVE_WORLD_LIFECYCLE_SERVICE.personActivityMeta(stat,name,person);}
    function pruneColdTemporaryPeople(stat){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneColdTemporaryPeople(stat);}
    function pruneDeadAlienPeople(stat){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneDeadAlienPeople(stat);}
    function collectEventRefs(state){return ACTIVE_WORLD_LIFECYCLE_SERVICE.collectEventRefs(state);}
    function detachEventSoftRefs(state,eventName){return ACTIVE_WORLD_LIFECYCLE_SERVICE.detachEventSoftRefs(state,eventName);}
    function archiveFinishedEvent(stat,state,name,event,archived){return ACTIVE_WORLD_LIFECYCLE_SERVICE.archiveFinishedEvent(stat,state,name,event,archived);}
    function propagationEnded(record,nowKey){return ACTIVE_WORLD_LIFECYCLE_SERVICE.propagationEnded(record,nowKey);}
    function pruneSoftRefsToColdFinishedEvents(state,now){return ACTIVE_WORLD_LIFECYCLE_SERVICE.pruneSoftRefsToColdFinishedEvents(state,now);}
    function compactFinishedEvents(stat,target=EVENT_TARGET){return ACTIVE_WORLD_LIFECYCLE_SERVICE.compactFinishedEvents(stat,target);}
    function compactWorldLifecycle(stat){return ACTIVE_WORLD_LIFECYCLE_SERVICE.compact(stat);}
    const ALIEN_ACTIVITY_STALE_HOURS=24;

    class WorldPersonActivityService {
        constructor(engine=null,timePolicy=DEFAULT_WORLD_TIME_POLICY){this.engine=engine;this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;}

        deriveContext(stat,personName,playerName='') {
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

        projectHot(stat,limit=HOT_PERSON_TARGET) {
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

        alienRosterMatch(stat,name) {
            const roster=stat?.世界?.异端雷达?.名单||{},matched=stableNameIn(roster,name);
            return matched?{名称:matched,记录:roster[matched]}:null;
        }

        alienActivityReviewReasons(stat,item) {
            const people=stat?.世界?.[PATH]?.人物||{};
            const personName=stableNameIn(people,item?.名称)||stableNameIn(people,item?.雷达名称),person=personName?people[personName]:null;
            const reasons=[];
            const factsComplete=!!(person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim());
            if(!factsComplete)reasons.push('活动档案缺失');

            const now=worldDateKey(stat?.世界?.时间),updated=worldDateKey(person?.更新时间),nextCheck=worldDateKey(person?.下次检查);
            if(now!==null&&nextCheck!==null&&nextCheck<=now)reasons.push('下次检查到期');
            if(factsComplete&&now!==null&&updated!==null&&now-updated>=ALIEN_ACTIVITY_STALE_HOURS)reasons.push('活动已超过24小时未复核');

            const linkedEvents=new Set(Array.isArray(person?.关联事件)?person.关联事件.filter(Boolean):[]);
            const location=String(person?.地点||'').trim();
            for(const change of stat?.世界?.[PATH]?.最近变化||[]){
                if(!plain(change))continue;
                const category=String(change.类别||change.类型||'').trim(),name=String(change.名称||'').trim();
                if(name&&/事件/.test(category)&&linkedEvents.has(name))reasons.push('关联事件变化');
                if(name&&/(?:势力地区|地区)/.test(category)&&location&&worldLocationRelated(location,name))reasons.push('所在地区变化');
            }
            return Array.from(new Set(reasons));
        }

        activeAlienRequirements(stat) {
            if((stat?.设置||{}).单一世界)return [];
            const roster=stat?.世界?.异端雷达?.名单||{},people=stat?.世界?.[PATH]?.人物||{},required=[];
            for(const [alienName,alien] of Object.entries(roster)){
                if(!alien||alien.状态==='死亡')continue;
                const personName=stableNameIn(people,alienName)||alienName,person=people[personName]||{};
                const item={
                    名称:personName,雷达名称:alienName,来源:String(alien.来源||''),经历:String(alien.经历||''),阵营:String(alien.阵营||''),职业:String(alien.职业||''),层级:String(alien.层级||''),
                    当前活动:{地点:String(person.地点||''),目标:String(person.目标||''),行动:String(person.行动||''),更新时间:String(person.更新时间||'')}
                };
                const reasons=this.alienActivityReviewReasons(stat,item);
                if(!reasons.length)continue;
                item.触发原因=reasons;
                item.要求='仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。';
                required.push(item);
            }
            return required;
        }

        seedMissingAlienPeople(stat,required) {
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

        ensureActiveAlienActivity(next,required,acceptedResult,worldTime) {
            const roster=next?.世界?.异端雷达?.名单||{},people=next?.世界?.[PATH]?.人物||{},proposals=acceptedResult?.人物||[],missing=[];
            const canonicalTime=String(next?.世界?.时间||worldTime||'').trim();
            for(const item of required||[]){
                const rosterName=stableNameIn(roster,item.雷达名称||item.名称),alien=rosterName?roster[rosterName]:null;
                if(!alien||alien.状态==='死亡')continue;
                const personName=stableNameIn(people,item.名称)||stableNameIn(people,rosterName),person=personName?people[personName]:null;
                const proposal=proposals.find(p=>nameKey(p.名称)===nameKey(item.名称)||nameKey(p.名称)===nameKey(rosterName));
                const submitted=proposal&&String(proposal.地点||'').trim()&&String(proposal.目标||'').trim()&&String(proposal.行动||'').trim();
                const factsComplete=person&&String(person.地点||'').trim()&&String(person.目标||'').trim()&&String(person.行动||'').trim();
                const timeComplete=!canonicalTime||sameWorldTimeAnchor(person?.更新时间,canonicalTime);
                if(!submitted||!factsComplete||!timeComplete)missing.push(rosterName||item.名称);
            }
            if(missing.length)throw new Error('异端活动未复核：'+missing.join('、')+'；仅本轮触发复核的活跃异端需要提交地点、目标、行动，人物更新时间由程序使用世界时间统一记录。未触发者沿用既有活动，不得为了刷新而凭空改策；若已死亡则更新异端状态为死亡');
        }

        normalizeAlienActivityTimestamps(stat,value) {
            const result=normalizeWorldResult(value);
            const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
            const plannedDead=new Set((result.异端||[])
                .filter(item=>item?.操作!=='撤销本轮'&&item?.状态==='死亡')
                .map(item=>nameKey(item.名称)));
            const proposedTime=this.timePolicy.resolveProposal(stat,result);
            const worldTime=String(proposedTime||stat?.世界?.时间||'').trim();
            if(Array.isArray(result.人物)){
                for(const item of result.人物){
                    if(!plain(item)||item.操作==='撤销本轮')continue;
                    const rosterName=stableNameIn(roster,item.名称),alien=rosterName?roster[rosterName]:null;
                    if(!alien||alien.状态==='死亡'||plannedDead.has(nameKey(rosterName||item.名称)))continue;
                    const submitted=String(item.地点||'').trim()&&String(item.目标||'').trim()&&String(item.行动||'').trim();
                    if(!submitted)continue;
                    if(worldTime)item.更新时间=worldTime;
                    else delete item.更新时间;
                }
            }
            return result;
        }

        validateRecord(stat,name,record){
            if(!plain(record))throw new Error('世界活动记录无效：'+name);
            const backend=this.engine.services.mutations.backend(stat),events=backend.事件||{};
            for(const eventName of record.关联事件||[])if(!Object.hasOwn(events,eventName))throw new Error('关联事件不存在：'+eventName);
        }
        get(name){
            if(!this.engine)return null;
            const people=this.engine.snapshot().stat?.世界?.[PATH]?.人物||{};
            const stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }

        async save(name,record){
            if(!this.engine)throw new Error('人物活动服务未绑定引擎');
            name=String(name||'').trim();if(!name)throw new Error('人物名称不能为空');
            return this.engine.services.mutations.commit(stat=>{
                const mutations=this.engine.services.mutations,backend=mutations.backend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))throw new Error('世界活动记录不存在：'+name);
                const current=people[stable];
                const next=normalizeBackendRecord('人物',record,current);
                next.认知=mutations.textList(next.认知);
                next.关联事件=mutations.textList(next.关联事件);
                next.行程=mutations.jsonList(next.行程,'行程');
                next.认知来源=mutations.jsonList(next.认知来源,'认知来源');
                next.背景关联=mutations.jsonList(next.背景关联,'背景关联');
                this.validateRecord(stat,stable,next);
                people[stable]=next;
                return {name:stable};
            },'已修正世界活动记录：'+name);
        }

        async remove(name){
            if(!this.engine)return false;
            name=String(name||'').trim();if(!name)return false;
            return this.engine.services.mutations.commit(stat=>{
                const backend=this.engine.services.mutations.backend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))return null;
                delete people[stable];
                return {deleted:stable};
            },'已删除世界活动记录：'+name);
        }
    }

    const DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE=new WorldPersonActivityService();
    let ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE=DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE;
    function derivePersonWorldContext(stat,personName,playerName=''){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.deriveContext(stat,personName,playerName);}
    function projectHotWorldPeople(stat,limit=HOT_PERSON_TARGET){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.projectHot(stat,limit);}
    function alienRosterMatch(stat,name){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.alienRosterMatch(stat,name);}
    function alienActivityReviewReasons(stat,item){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.alienActivityReviewReasons(stat,item);}
    function activeAlienActivityRequirements(stat){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.activeAlienRequirements(stat);}
    function seedMissingAlienPeople(stat,required){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.seedMissingAlienPeople(stat,required);}
    function ensureActiveAlienActivity(next,required,acceptedResult,worldTime){return ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE.ensureActiveAlienActivity(next,required,acceptedResult,worldTime);}
    class WorldTaskAwarenessService {
        projectList(value) {
            if(!plain(value))return {};
            const out={};
            for(const [name,task] of Object.entries(value)){
                if(!plain(task))continue;
                const projected={};
                for(const key of ['委托方','目标','隐藏真相','难度','交付','状态']){
                    if(Object.hasOwn(task,key))projected[key]=copy(task[key]);
                }
                if(Object.keys(projected).length)out[name]=projected;
            }
            return out;
        }

        validateReferences(stat,result) {
            const taskNames=new Set(Object.keys(stat?.任务?.列表||{}));
            for(const event of result?.事件||[]){
                if(!Array.isArray(event?.关联任务))continue;
                for(const taskName of event.关联任务){
                    const name=String(taskName||'').trim();
                    if(name&&!taskNames.has(name))throw new Error('事件/'+String(event.名称||'未命名')+'：关联任务不存在：'+name);
                }
            }
            return result;
        }
    }

    const DEFAULT_WORLD_TASK_AWARENESS_SERVICE=new WorldTaskAwarenessService();
    let NPC_BUILD_AUDIT_FEATURE_ENABLED=false;

    class WorldNpcAuditService {
        projectComponentMap(value,{equipment=false}={}) {
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item))continue;
                if(equipment&&Number(item.状态)===2)continue;
                const clean=copy(item);
                for(const key of ['最终属性','强化','真属性'])delete clean[key];
                if(plain(clean.技能)){
                    clean.技能=Object.fromEntries(Object.entries(clean.技能).filter(([,skill])=>plain(skill)).map(([skillName,skill])=>{
                        const projected=copy(skill);
                        for(const key of ['最终属性','强化','真属性'])delete projected[key];
                        return [skillName,projected];
                    }));
                }
                out[name]=clean;
            }
            return out;
        }

        projectCharacter(value) {
            const source=plain(value)?value:{},out={};
            for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事']){
                if(Object.hasOwn(source,key))out[key]=copy(source[key]);
            }
            const 状态=this.projectComponentMap(source.状态),血统=this.projectComponentMap(source.血统),技能=this.projectComponentMap(source.技能);
            const 装备=this.projectComponentMap(source.装备,{equipment:true}),形态库=this.projectComponentMap(source.形态库);
            if(Object.keys(状态).length)out.状态=状态;
            if(Object.keys(血统).length)out.血统=血统;
            if(Object.keys(技能).length)out.技能=技能;
            if(Object.keys(装备).length)out.装备=装备;
            if(Object.keys(形态库).length)out.形态库=形态库;
            if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
            return out;
        }

        buildText(value) {
            try{return JSON.stringify(value||{});}catch(_){return String(value||'');}
        }

        inferNarrativeLevel(npc) {
            const profileText=[...(Array.isArray(npc?.身份)?npc.身份:[]),...Object.keys(npc?.职业||{}),npc?.背景故事,npc?.态度].filter(Boolean).join(' ');
            if(/(?:boss|首领|领主|头目|魔王|王者|宗主|掌门|教皇|最终敌人|最终对手)/i.test(profileText))return '首领/Boss级';
            return /(?:精英|精锐|王牌|核心战力|强敌)/i.test(profileText)?'精英级':'杂兵级';
        }

        narrativeLevel(stat,name,npc) {
            const people=stat?.世界?.[PATH]?.人物||{},backendName=stableNameIn(people,name),person=backendName?people[backendName]:null;
            const explicit=String(person?.审计级别||'').trim();
            if(NPC_AUDIT_LEVELS.includes(explicit))return explicit;
            const roster=(stat?.设置||{}).单一世界?{}:(stat?.世界?.异端雷达?.名单||{});
            const alienName=stableNameIn(roster,name),alien=alienName?roster[alienName]:null;
            if(alien&&alien.状态!=='死亡')return '首领/Boss级';
            return this.inferNarrativeLevel(npc);
        }

        assessment(stat,name,npc) {
            if(!plain(npc)||Number(npc.HP)<=0||npc.是否队友===true)return null;
            const level=this.narrativeLevel(stat,name,npc);
            const minimum=level==='首领/Boss级'?{血统:1,装备:6,技能:4}:level==='精英级'?{血统:1,装备:4,技能:2}:{血统:1,装备:2,技能:1};
            const counts={
                血统:Object.keys(npc.血统||{}).length,
                装备:Object.values(npc.装备||{}).filter(item=>plain(item)&&Number(item.状态)===1).length,
                技能:Object.keys(npc.技能||{}).length,
                状态:Object.keys(npc.状态||{}).length,
                形态:Object.keys(npc.形态库||{}).length
            };
            const gaps=[],suggest=new Set();
            for(const field of ['种族','身份','职业','外貌','着装','性格','喜爱','背景故事','态度']){
                const value=npc[field],missing=Array.isArray(value)?!value.length:plain(value)?!Object.keys(value).length:!String(value||'').trim();
                if(missing){gaps.push('资料缺失/'+field);suggest.add(field);}
            }
            for(const field of ['血统','装备','技能']){
                if(counts[field]<minimum[field]){gaps.push(field+'不足 '+counts[field]+'/'+minimum[field]);suggest.add(field);}
            }
            const combatText=this.buildText({职业:npc.职业,血统:npc.血统,装备:npc.装备,技能:npc.技能,状态:npc.状态,形态库:npc.形态库});
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
            return {名称:name,审计级别:level,层级:String(npc.层级||'Ⅰ'),当前组件:counts,缺口:gaps,建议字段:Array.from(suggest),当前构筑:this.projectCharacter(npc)};
        }

        audit(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
            if(!NPC_BUILD_AUDIT_FEATURE_ENABLED)return [];
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
                const assessment=this.assessment(stat,name,npc);if(!assessment||!assessment.缺口.length)continue;
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

        normalizeNewEquipment(stat,result) {
            for(const relation of result?.关系||[]){
                if(!plain(relation?.装备))continue;
                const target=stableNameIn(stat?.关系列表||{},relation.名称);
                const npc=target?stat.关系列表[target]:null;
                if(!plain(npc))continue;
                for(const [equipName,equip] of Object.entries(relation.装备)){
                    if(!plain(equip))continue;
                    if(!stableNameIn(npc.装备||{},equipName))equip.状态=1;
                }
            }
            return result;
        }

        ensureProgress(next,required=[],acceptedResult) {
            if(!(required||[]).length)return;
            const proposals=Array.isArray(acceptedResult?.关系)?acceptedResult.关系:[],details=[];
            for(const before of required||[]){
                const target=stableNameIn(next?.关系列表||{},before.名称);
                if(!target)continue;
                const after=this.assessment(next,target,next.关系列表[target]);
                if(!after)continue;
                const proposal=proposals.find(item=>nameKey(item?.名称)===nameKey(before.名称));
                const touched=proposal&&(before.建议字段||[]).some(field=>Object.hasOwn(proposal,field));
                if(touched&&after.缺口.length<before.缺口.length)continue;
                const submitted=proposal?Object.keys(proposal).filter(field=>!['名称','操作'].includes(field)):[];
                const unresolved=(after.缺口||[]).length?after.缺口:before.缺口||[];
                const suggested=(after.建议字段||before.建议字段||[]).filter(Boolean);
                details.push(
                    before.名称+'：未解决缺口：'+(unresolved.length?unresolved.join('、'):'未识别')
                    +'；建议修复字段：'+(suggested.length?suggested.join('、'):'无')
                    +'；本轮实际提交：'+(submitted.length?submitted.join('、'):'无')
                );
            }
            if(details.length)throw new Error('NPC构筑审计未推进：\n'+details.map(item=>' - '+item).join('\n')+'\n修复要求：每个列出的审计对象本轮至少补齐一个真实缺口；禁止只改好感、HP或无关字段。');
        }
    }

    const DEFAULT_WORLD_NPC_AUDIT_SERVICE=new WorldNpcAuditService();
    let ACTIVE_WORLD_NPC_AUDIT_SERVICE=DEFAULT_WORLD_NPC_AUDIT_SERVICE;
    function projectAuditComponentMap(value,options={}){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.projectComponentMap(value,options);}
    function projectCharacterForAudit(value){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.projectCharacter(value);}
    function npcBuildText(value){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.buildText(value);}
    function npcBuildAssessment(stat,name,npc){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.assessment(stat,name,npc);}
    function npcBuildAudit(stat,limit=NPC_BUILD_AUDIT_LIMIT){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.audit(stat,limit);}
    function ensureNpcBuildAuditProgress(next,required=[],acceptedResult){return ACTIVE_WORLD_NPC_AUDIT_SERVICE.ensureProgress(next,required,acceptedResult);}
    const EVENT_CATEGORIES=new Set(['当前事件','近期节点','宏观节点']);
    const LOCAL_EVENT_ACTION_WORDS=/(?:会合|汇合|集结|争夺|夺取|抢夺|突破|突围|开门|绕行|护送|搜索|调查|巡逻|防守|攻防|撤离|潜入|救援|搬运|封锁|交涉)/;
    const GENERIC_MICRO_LOCATION_ROOT=/^(?:房间|房室|大厅|走廊|通道|楼梯|楼层|入口|出口|出入口|屋顶|平台|仓库|餐厅|卫生间|浴室|车厢|甲板|舱室)$/;
    const GENERIC_MICRO_LOCATION_CHILD=/(?:室|房|厅|间|廊|梯|层|入口|出口|门|口|台|舱|仓|库|堂|巷|通道|甲板|屋顶)$/;
    const MACRO_EVENT_WORDS=/(?:世界级|全国|跨国|地区级灾难|城市级灾难|战略级|核(?:打击|爆|武器)|EMP|电磁脉冲|战争|政权|社会秩序|基础设施(?:失效|崩溃)|大规模迁移|长期流亡|生存阶段|篇章转折|据点(?:建立|失守|沦陷|崩溃|保卫)|文明|国家|大陆)/;
    function looksFineGrainedLocation(value) {
        const raw=String(value||'').trim();if(!raw)return false;
        if(GENERIC_MICRO_LOCATION_ROOT.test(raw))return true;
        const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
        if(parts.length<2)return false;
        const leaf=parts.at(-1);
        return leaf.length<=16&&GENERIC_MICRO_LOCATION_CHILD.test(leaf);
    }

    class WorldStateNormalizer {
        normalizeBackendState(stat) {
            const state=stat?.世界?.[PATH]; if(!state)return stat;
            const legacySummary=String(state.公开摘要||'').trim();
            if(legacySummary){
                if(!plain(stat.世界.因果轨道))stat.世界.因果轨道={当前阶段:'',故事线:'',下一节点:'',偏移记录:{}};
                stat.世界.因果轨道.当前阶段=legacySummary;
            }
            delete state.公开摘要;
            delete state.正文承接;
            delete state.运行记录;
            state.版本=Math.max(5,Number(state.版本)||0);
            if(!plain(state.历史总结))state.历史总结={};
            for(const category of Object.keys(RECORDS)){
                if(!plain(state[category]))state[category]={};
                for(const [name,value] of Object.entries(state[category])){
                    if(plain(value))state[category][name]=normalizeBackendRecord(category,value);
                }
            }
            pruneDeadAlienPeople(stat);
            return stat;
        }
        eventText(name,event) {
            return [name,event?.描述,event?.条件,event?.默认走向,event?.结果,event?.公开征兆,event?.地点].filter(Boolean).join(' ');
        }
        obviouslyLocalMacro(name,event) {
            const text=this.eventText(name,event);
            if(MACRO_EVENT_WORDS.test(text))return false;
            const fineLocation=looksFineGrainedLocation(event?.地点)||looksFineGrainedLocation(name);
            return fineLocation&&LOCAL_EVENT_ACTION_WORDS.test(text);
        }
        normalizedEventCategory(name,event) {
            const raw=String(event?.分类||'').trim();
            if(raw==='宏观节点')return this.obviouslyLocalMacro(name,event)?(event?.状态==='进行中'?'当前事件':'近期节点'):'宏观节点';
            if(raw==='当前事件')return '当前事件';
            if(raw==='近期节点')return event?.状态==='进行中'?'当前事件':'近期节点';
            if(raw==='近期事件'||raw==='主线节点'||!EVENT_CATEGORIES.has(raw))return event?.状态==='进行中'?'当前事件':'近期节点';
            return raw;
        }
        normalizeEventLayers(stat) {
            const events=stat?.世界?.[PATH]?.事件||{},patches=[];
            for(const [name,event] of Object.entries(events)){
                const category=this.normalizedEventCategory(name,event);
                if(event.分类!==category){
                    event.分类=category;
                    patches.push({op:'replace',path:pointer(['世界',PATH,'事件',name,'分类']),value:category});
                }
            }
            return patches;
        }
        explicitPersonAliases(name) {
            const full=String(name||'').trim(),short=full.split(/[·・／/]/)[0].trim();
            return [...new Set([full,short].filter(x=>x.length>=2))];
        }
        repairExplicitEventLinks(stat) {
            const state=stat?.世界?.[PATH],patches=[]; if(!state)return patches;
            const events=state.事件||{},people=state.人物||{};
            for(const [eventName,event] of Object.entries(events)){
                const haystack=this.eventText(eventName,event);
                const participants=Array.isArray(event.参与者)?event.参与者.slice():[];
                let participantsChanged=false;
                for(const personName of Object.keys(people)){
                    const explicit=participants.some(x=>nameKey(x)===nameKey(personName))
                        ||this.explicitPersonAliases(personName).some(alias=>haystack.includes(alias));
                    if(!explicit)continue;
                    if(!participants.some(x=>nameKey(x)===nameKey(personName))){
                        participants.push(personName);participantsChanged=true;
                    }
                    const person=people[personName],links=Array.isArray(person.关联事件)?person.关联事件:[];
                    if(!links.includes(eventName)){
                        person.关联事件=[...links,eventName];
                        patches.push({op:'replace',path:pointer(['世界',PATH,'人物',personName,'关联事件']),value:copy(person.关联事件)});
                    }
                }
                if(participantsChanged){
                    event.参与者=participants;
                    patches.push({op:'replace',path:pointer(['世界',PATH,'事件',eventName,'参与者']),value:copy(participants)});
                }
            }
            return patches;
        }
        repairMacroPredecessors(stat) {
            const state=stat?.世界?.[PATH],orbit=stat?.世界?.因果轨道||{},patches=[]; if(!state)return patches;
            const stages=storyStages(orbit.故事线).filter(name=>state.事件?.[name]?.分类==='宏观节点'&&state.事件[name].状态!=='已取消');
            for(let i=1;i<stages.length;i++){
                const prev=stages[i-1],name=stages[i],event=state.事件[name],parents=Array.isArray(event.前因)?event.前因:[];
                if(!parents.includes(prev)){
                    event.前因=[...parents,prev];
                    patches.push({op:'replace',path:pointer(['世界',PATH,'事件',name,'前因']),value:copy(event.前因)});
                }
            }
            return patches;
        }
    }

    const DEFAULT_WORLD_STATE_NORMALIZER=new WorldStateNormalizer();
    let ACTIVE_WORLD_STATE_NORMALIZER=DEFAULT_WORLD_STATE_NORMALIZER;
    function normalizeBackendState(stat){return ACTIVE_WORLD_STATE_NORMALIZER.normalizeBackendState(stat);}
    function normalizeEventLayers(stat){return ACTIVE_WORLD_STATE_NORMALIZER.normalizeEventLayers(stat);}
    function repairExplicitEventLinks(stat){return ACTIVE_WORLD_STATE_NORMALIZER.repairExplicitEventLinks(stat);}
    function repairMacroPredecessors(stat){return ACTIVE_WORLD_STATE_NORMALIZER.repairMacroPredecessors(stat);}
    const WORLD_CAUSAL_CHAIN_HINT=/(?:余波|后续|进一步|继续|继而|因此|由此|连锁|衍生|扩散|扩大|反应|吸引力|同一(?:契约|事件|行为|根因))/;
    const WORLD_CAUSAL_SPECULATION_HINT=/(?:可能|或许|预计|预期|将会|或将|未来(?:会|可能|将)|潜在|恐怕|有望|计划|打算|准备)/;
    const WORLD_CAUSAL_NO_EFFECT_HINT=/(?:尚未|还未|并未|未曾|没有|仅仅|只是).{0,18}(?:发生|执行|实施|使用|启动|造成|导致|改变|影响|生效)|(?:尚未|还未|并未|未曾|没有).{0,18}(?:结果|变化|后果)/;
    const WORLD_CAUSAL_REALIZED_HINT=/(?:已经|已然|已被|已使|已让|导致|造成|致使|使得|迫使|结果|改写|改变|破坏|摧毁|死亡|失去|退出|完成|失败|成功|被捕|被杀|被夺|被毁|封锁|崩溃|断裂|清除|修复)/;
    const WORLD_CAUSAL_RESPONSE_HINT=/(?:稳定值(?:持续)?下降|世界排异(?:反应|升级|增强)?|排异强度)/;
    const WORLD_CAUSAL_SCALE_HINTS=[
        /(?:关键人物|核心人物|重要人物|关键角色|核心角色).{0,28}(?:命运|死亡|阵亡|被杀|永久|不可逆|退场|失去|背叛|被捕|失踪|改写|改变|修复)/,
        /(?:死亡|阵亡|被杀|永久|不可逆|退场|被捕|失踪|改写|改变|修复).{0,28}(?:关键人物|核心人物|重要人物|关键角色|核心角色)/,
        /(?:重大|关键|宏观|主线).{0,8}(?:事件|节点|战役|战争|仪式|计划|灾难).{0,32}(?:改变|改写|失败|成功|取消|终止|提前|延后|崩溃|完成|毁灭|修复|失效)/,
        /(?:势力|阵营|政权|国家|帝国|王国|组织|军团|城市|地区).{0,32}(?:格局|覆灭|崩溃|瓦解|分裂|易主|政变|失守|沦陷|吞并|解体|重组|修复)/,
        /(?:主线|故事线|世界格局|下一节点|原定(?:走向|结局)).{0,32}(?:改变|改写|断裂|失效|无法|偏离|重构|修复|恢复)/,
        /(?:异常污染|跨世界污染|污染|世界裂隙|跨世界异常|异常侵蚀|世界侵蚀).{0,32}(?:扩大|扩散|蔓延|加剧|持续|清除|消除|修复|收束|封闭)/,
        /(?:异端|入侵者).{0,28}(?:全部|彻底|主要|核心).{0,16}(?:清除|消灭|死亡|覆灭).{0,36}(?:跨世界干涉|异常污染|世界裂隙|世界结构|主线|世界格局).{0,24}(?:消失|解除|恢复|修复|收束|封闭)/,
        /(?:跨世界干涉|异常污染|世界裂隙|世界结构|主线|世界格局).{0,24}(?:因|由于).{0,20}(?:异端|入侵者).{0,24}(?:清除|消灭|死亡|覆灭).{0,20}(?:消失|解除|恢复|修复|收束|封闭)/,
        /(?:不可逆|永久).{0,20}(?:命运|主线|重大事件|关键事件|势力格局|世界格局)/
    ];
    const WORLD_CAUSAL_CLEAR_LOCAL_HINT=/(?:位置(?:暴露|泄露|被发现|被感知)|被(?:敌人|异端|对手).{0,16}(?:发现|察觉|感知|盯上|追踪|锁定)|异端.{0,16}(?:知道|获知|发现|察觉|感知).{0,16}(?:玩家|轮回者|位置|行踪|能力|身份)|提前感知|引起警觉|提高.{0,10}难度|增加.{0,10}难度|生存难度|行动难度|追杀压力|短期.{0,8}(?:困难|不利)|局部战斗|普通战斗|受伤|轻伤|逃脱|脱险|暂时受阻|临时受阻)/;

    class WorldCausalService {
        constructor(engine=null,patchPolicy=DEFAULT_WORLD_PATCH_POLICY){this.engine=engine;this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;}
        clampImpact(value) {
            const impact=Number(value);
            if(!Number.isFinite(impact))return null;
            if(impact===0)return 0;
            return impact<0?Math.max(-12,impact):Math.min(15,impact);
        }
        offsetText(item) {
            return [item?.名称,item?.描述].filter(Boolean).join(' ');
        }
        softNormalizeOffsets(stat,result) {
            const items=Array.isArray(result?.因果?.偏移记录)?result.因果.偏移记录:null;
            if(!items||!items.length)return [];
            const existing=stat?.世界?.因果轨道?.偏移记录||{},prepared=[];
            for(const raw of items){
                if(!plain(raw))continue;
                const item=copy(raw);
                if(item.操作==='撤销本轮'){prepared.push(item);continue;}
                const existingName=stableNameIn(existing,item.名称),isNew=!existingName;
                if(Object.hasOwn(item,'影响程度')){
                    const impact=this.clampImpact(item.影响程度);
                    if(impact===null){
                        if(isNew)continue;
                        delete item.影响程度;
                    }else if(isNew&&impact===0)continue;
                    else item.影响程度=impact;
                }else if(isNew)continue;
                const text=this.offsetText(item);
                if(isNew&&WORLD_CAUSAL_NO_EFFECT_HINT.test(text))continue;
                if(isNew&&WORLD_CAUSAL_SPECULATION_HINT.test(text)&&!WORLD_CAUSAL_REALIZED_HINT.test(text))continue;
                if(isNew&&Number(item.影响程度)<0&&WORLD_CAUSAL_RESPONSE_HINT.test(text))continue;
                prepared.push(item);
            }

            const removed=new Set(),groups=new Map();
            for(let i=0;i<prepared.length;i++){
                const item=prepared[i];
                if(!plain(item)||item.操作==='撤销本轮'||!Object.hasOwn(item,'影响程度'))continue;
                const actor=String(item.引发者||'').trim().toLowerCase();
                const impact=Number(item.影响程度);
                if(!actor||!Number.isFinite(impact)||impact===0)continue;
                const key=actor+'|'+(impact<0?'negative':'positive'),group=groups.get(key)||[];
                group.push({index:i,item,text:this.offsetText(item),impact});groups.set(key,group);
            }
            for(const group of groups.values()){
                const chained=group.filter(entry=>WORLD_CAUSAL_CHAIN_HINT.test(entry.text));
                if(chained.length<2)continue;
                let winner=chained[0];
                for(const entry of chained.slice(1))if(Math.abs(entry.impact)>Math.abs(winner.impact))winner=entry;
                for(const entry of chained)if(entry.index!==winner.index)removed.add(entry.index);
            }
            let normalized=prepared.filter((_,index)=>!removed.has(index));
            const budgets=new Map();
            normalized=normalized.filter(item=>{
                if(!plain(item)||item.操作==='撤销本轮'||!Object.hasOwn(item,'影响程度'))return true;
                const actor=String(item.引发者||'').trim().toLowerCase(),impact=Number(item.影响程度);
                if(!actor||!Number.isFinite(impact)||impact===0)return true;
                const sign=impact<0?'negative':'positive',key=actor+'|'+sign;
                let remaining=budgets.has(key)?budgets.get(key):(impact<0?12:15);
                const magnitude=Math.min(Math.abs(impact),remaining);
                remaining=Math.max(0,remaining-magnitude);budgets.set(key,remaining);
                if(magnitude<=0)return false;
                item.影响程度=impact<0?-magnitude:magnitude;
                return true;
            });
            result.因果.偏移记录=normalized;
            return normalized;
        }
        hasWorldScaleEvidence(item) {
            const text=this.offsetText(item);
            return !!text&&WORLD_CAUSAL_SCALE_HINTS.some(rule=>rule.test(text));
        }
        filterNewOffsetsByWorldScale(stat,result) {
            const items=result?.因果?.偏移记录;
            if(!Array.isArray(items)||!items.length)return [];
            const existing=stat?.世界?.因果轨道?.偏移记录||{},dropped=[];
            result.因果.偏移记录=items.filter(item=>{
                if(!plain(item)||item.操作==='撤销本轮')return true;
                if(stableNameIn(existing,item.名称))return true;
                if(this.hasWorldScaleEvidence(item))return true;
                dropped.push(item.名称);
                return false;
            });
            return dropped;
        }
        prepareResult(stat,result) {
            const dropped=this.filterNewOffsetsByWorldScale(stat,result);
            this.softNormalizeOffsets(stat,result);
            return dropped;
        }
        staleLocalOffsetRepairs(stat,result) {
            const bucket=stat?.世界?.因果轨道?.偏移记录||{},protectedNames=new Set();
            for(const item of result?.因果?.偏移记录||[]){
                if(plain(item)&&this.hasWorldScaleEvidence(item))protectedNames.add(nameKey(item.名称));
            }
            const patches=[],names=[];
            for(const [name,record] of Object.entries(bucket)){
                const impact=Number(record?.影响程度)||0;
                if(!impact||protectedNames.has(nameKey(name)))continue;
                const text=this.offsetText(Object.assign({名称:name},record));
                if(!WORLD_CAUSAL_CLEAR_LOCAL_HINT.test(text)||WORLD_CAUSAL_SCALE_HINTS.some(rule=>rule.test(text)))continue;
                patches.push({op:'remove',path:this.patchPolicy.pointer(['世界','因果轨道','偏移记录',name])});
                names.push(name);
            }
            return {patches,names};
        }
        repairProjection(stat) {
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
                // 因果轨道只能由宏观事件投影；事实不足时等待模型补齐，不拿近期事件凑骨架。
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
            if(current&&(!orbit.当前阶段||orbit.当前阶段==='待初始化')){
                orbit.当前阶段=current;
                patches.push({op:'replace',path:'/世界/因果轨道/当前阶段',value:current});
            }
            return patches;
        }
        get(name){return this.engine?.snapshot?.().stat?.世界?.因果轨道?.偏移记录?.[String(name||'').trim()]||null;}
        recalculateStability(stat) {
            if(!plain(stat?.世界))return null;
            if(stat.设置?.世界超稳===true){stat.世界.稳定=100;return 100;}
            const bucket=stat.世界?.因果轨道?.偏移记录||{};
            const total=Object.values(plain(bucket)?bucket:{}).reduce((sum,item)=>sum+(Number(item?.影响程度)||0),0);
            const stable=Math.max(0,Math.min(120,100+total));
            stat.世界.稳定=stable;
            return stable;
        }
        replaySamePath(left,right) {
            return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>String(item)===String(right[index]));
        }
        syncReplay(raw,fingerprint,oldName,newName,record,deleted,stable) {
            const replay=raw?.__samsaraWorldReplay;
            if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return;
            const oldPath=['世界','因果轨道','偏移记录',String(oldName||'')];
            const newPath=['世界','因果轨道','偏移记录',String(newName||'')];
            const stabilityPath=['世界','稳定'];
            replay.operations=replay.operations.filter(operation=>{
                const path=operation?.path;
                return !this.replaySamePath(path,oldPath)&&!this.replaySamePath(path,newPath)&&!this.replaySamePath(path,stabilityPath);
            });
            if(deleted){
                replay.operations.push({op:'remove',path:oldPath});
            }else{
                if(String(oldName)!==String(newName))replay.operations.push({op:'remove',path:oldPath});
                replay.operations.push({op:'set',path:newPath,value:copy(record)});
            }
            replay.operations.push({op:'set',path:stabilityPath,value:stable});
        }
        async commit(mutator,status){
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            if(!plain(stat?.世界?.因果轨道))stat.世界.因果轨道={};
            if(!plain(stat.世界.因果轨道.偏移记录))stat.世界.因果轨道.偏移记录={};
            const outcome=mutator(stat.世界.因果轨道.偏移记录);
            if(!outcome)return false;
            const stable=this.recalculateStability(stat);
            this.syncReplay(next,snapshot.fingerprint,outcome.oldName,outcome.newName,outcome.record,outcome.deleted,stable);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.status=status||'因果偏移已更新';
            engine.render(true);
            return true;
        }
        async save(oldName,newName,record){
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName||!plain(record))throw new Error('偏移名称和记录不能为空');
            const impact=Number(record.影响程度);
            if(!Number.isFinite(impact)||impact===0||impact<-12||impact>15)throw new Error('影响程度必须为 -12~-1 或 +1~+15');
            return this.commit(bucket=>{
                if(!Object.hasOwn(bucket,oldName))throw new Error('偏移记录不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(bucket,newName))throw new Error('偏移名称已存在：'+newName);
                const next={描述:String(record.描述||'').trim(),引发者:String(record.引发者||'').trim(),影响程度:impact};
                if(newName!==oldName)delete bucket[oldName];
                bucket[newName]=next;
                return {oldName,newName,record:next,deleted:false};
            },'已编辑因果偏移 · 稳定值已重算');
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.commit(bucket=>{
                if(!Object.hasOwn(bucket,name))return null;
                delete bucket[name];
                return {oldName:name,newName:name,record:null,deleted:true};
            },'已删除因果偏移 · 稳定值已重算');
        }
    }
    const DEFAULT_WORLD_CAUSAL_SERVICE=new WorldCausalService();
    let ACTIVE_WORLD_CAUSAL_SERVICE=DEFAULT_WORLD_CAUSAL_SERVICE;
    function repairCausalProjection(stat){return ACTIVE_WORLD_CAUSAL_SERVICE.repairProjection(stat);}
    const CURRENCY_FIELDS={体系:'',购买力基准:'',经济波动:''};
    const CALENDAR_FIELDS={名称:'',月份天数:[],闰年规则:''};
    const QUALITY_RANKS=['F','E','D','C','B','A','S','SS','SSS'];
    const RUMOR_CREDIBILITY=['酒话','可疑','或许可信'];
    const INTEL_RATINGS=[...QUALITY_RANKS,'日常','战略'];
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
    class WorldRelationSyncPolicy {
        validateStringArray(value,label) {
            if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string[]');
        }
        validateStringMap(value,label) {
            if(!plain(value)||Object.values(value).some(x=>typeof x!=='string'))throw new Error(label+' 必须是 string map');
        }
        validateQuality(value,label) {
            if(!RELATION_QUALITIES.includes(String(value||'')))throw new Error(label+' 只允许 '+RELATION_QUALITIES.join('/'));
        }
        validateRawAttributes(value,label,{requireFive=false,allowNumbers=false}={}) {
            if(!plain(value))throw new Error(label+' 必须是对象');
            for(const key of Object.keys(value)){
                if(!RELATION_ATTR_KEYS.includes(key))throw new Error(label+' 含非法属性 '+key);
                if(allowNumbers&&typeof value[key]==='number'&&Number.isFinite(value[key])){
                    if(value[key]===0)throw new Error(label+'.'+key+' 数值0应省略，避免ZOD清洗后产生无效差异');
                    continue;
                }
                this.validateQuality(value[key],label+'.'+key);
            }
            if(requireFive)for(const key of RELATION_ATTR5)if(!Object.hasOwn(value,key))throw new Error(label+' 缺少基础属性 '+key);
        }
        validateComponentShape(field,value,name='NPC') {
            if(!plain(value))throw new Error(name+' '+field+' 必须是对象');
            const assertFields=(item,keys,label)=>{for(const key of keys)if(!Object.hasOwn(item,key))throw new Error(label+' 缺少字段 '+key);};
            for(const [entryName,item] of Object.entries(value)){
                const label=name+' '+field+'.'+entryName;
                if(!entryName||!plain(item))throw new Error(label+' 必须是完整对象');
                if(field==='职业'){
                    assertFields(item,['类型','特性','来源'],label);
                    if(!['战斗','生活','辅助'].includes(item.类型))throw new Error(label+' 类型无效');
                    this.validateStringArray(item.特性,label+'.特性');
                    if(typeof item.来源!=='string')throw new Error(label+'.来源 必须是 string');
                }else if(field==='技能'){
                    assertFields(item,['品质','类型','标签','效果','描述','消耗'],label);
                    this.validateQuality(item.品质,label+'.品质');
                    if(!Number.isInteger(item.类型)||item.类型<0||item.类型>2)throw new Error(label+'.类型 只能是0/1/2');
                    this.validateStringArray(item.标签,label+'.标签');this.validateStringMap(item.效果,label+'.效果');
                    if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
                }else if(field==='血统'){
                    assertFields(item,['品质','标签','原始属性','效果','描述'],label);
                    this.validateQuality(item.品质,label+'.品质');this.validateStringArray(item.标签,label+'.标签');
                    this.validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});this.validateStringMap(item.效果,label+'.效果');
                    if(typeof item.描述!=='string')throw new Error(label+'.描述 必须是 string');
                }else if(field==='装备'){
                    assertFields(item,['品质','类型','标签','原始属性','效果','描述','消耗','状态'],label);
                    this.validateQuality(item.品质,label+'.品质');
                    if(!Number.isInteger(item.类型)||item.类型<0||item.类型>8)throw new Error(label+'.类型 只能是0~8');
                    if(!Number.isInteger(item.状态)||item.状态<0||item.状态>2)throw new Error(label+'.状态 只能是0/1/2');
                    this.validateStringArray(item.标签,label+'.标签');this.validateRawAttributes(item.原始属性,label+'.原始属性');
                    this.validateStringMap(item.效果,label+'.效果');
                    if(typeof item.描述!=='string'||typeof item.消耗!=='string')throw new Error(label+' 描述/消耗必须是 string');
                }else if(field==='状态'){
                    assertFields(item,['类型','品质','持续','来源','原始属性','效果'],label);
                    if(!['增益','减益','特殊'].includes(item.类型))throw new Error(label+'.类型无效');
                    this.validateQuality(item.品质,label+'.品质');this.validateRawAttributes(item.原始属性,label+'.原始属性',{allowNumbers:true});
                    if(typeof item.持续!=='string'||typeof item.来源!=='string'||typeof item.效果!=='string')throw new Error(label+' 持续/来源/效果必须是 string');
                }else if(field==='形态库'){
                    assertFields(item,['层级','消耗','冷却','状态','标签','原始属性','效果','技能','描述'],label);
                    if(!RELATION_RANKS.includes(item.层级))throw new Error(label+'.层级无效');
                    this.validateStringArray(item.标签,label+'.标签');this.validateRawAttributes(item.原始属性,label+'.原始属性',{requireFive:true});
                    this.validateStringMap(item.效果,label+'.效果');
                    for(const key of ['消耗','冷却','状态','描述'])if(typeof item[key]!=='string')throw new Error(label+'.'+key+' 必须是 string');
                    this.validateComponentShape('技能',item.技能,label);
                }
            }
        }
        validateRelationSyncValue(field,value,npc,name='NPC') {
            if(field==='在场'||field==='是否队友'){if(typeof value!=='boolean')throw new Error(name+' '+field+' 必须是 boolean');return;}
            if(['种族','性格','喜爱','外貌','着装','态度','背景故事'].includes(field)){if(typeof value!=='string')throw new Error(name+' '+field+' 必须是 string');return;}
            if(field==='身份'){this.validateStringArray(value,name+' 身份');return;}
            if(field==='层级'){if(!RELATION_RANKS.includes(value))throw new Error(name+' 层级只允许 '+RELATION_RANKS.join('/'));return;}
            if(RELATION_COMPONENT_FIELDS.has(field)){this.validateComponentShape(field,value,name);return;}
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
        materializeRelationComponent(field,value) {
            const out=copy(value);
            if(['血统','装备','状态','形态库'].includes(field)&&plain(out)){
                for(const item of Object.values(out)){
                    if(!plain(item))continue;
                    item.真属性={};
                }
            }
            return out;
        }
        mergeRelationComponent(field,oldValue,incoming) {
            if(!RELATION_COMPONENT_FIELDS.has(field))return this.materializeRelationComponent(field,incoming);
            const merged=plain(oldValue)?copy(oldValue):{};
            for(const [name,item] of Object.entries(incoming||{}))merged[name]=this.materializeRelationComponent(field,{[name]:item})[name];
            return merged;
        }

        assertComponentLimit(field,value,name='NPC') {
            if(!RELATION_COMPONENT_FIELDS.has(field))return;
            const count=Object.keys(value||{}).length;
            const limit=field==='血统'?2:field==='装备'?6:field==='技能'?4:field==='形态库'?4:12;
            if(count>limit)throw new Error(name+' '+field+' 数量超过NPC生成规则上限 '+limit);
        }
    }

    const DEFAULT_WORLD_RELATION_SYNC_POLICY=new WorldRelationSyncPolicy();
    const WORLD_ASSET_TYPES=['固定地产','大型载具','要塞'];
    const WORLD_ASSET_TYPE_SET=new Set(WORLD_ASSET_TYPES);
    const ITEMLIKE_ASSET_NAME=/(?:纹章|免疫|抗性|初解|技能|能力|药剂?|药水|圣水|解药|血清|试剂|瓶|钥匙|摇把|手柄|材料|矿石|零件|部件|残骸|卷轴|食物|口粮|弹药|消耗品|道具|护符|符文|芯片|样本)$/i;

    const ASSET_DEFAULTS={所属对象:[],类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};
    const ASSET_ENERGY_DEFAULTS={类型:'',当前:0,上限:0,描述:''};
    const ASSET_UNIT_DEFAULTS={余量:0,上限:0,加成:[]};
    const ASSET_BUILD_DEFAULTS={阶段:'基础',功能:'',加成:[],产出:'',下次产出日期:'',下次产出游天:0};

    class WorldAssetMaterializationPolicy {
        validateScope(item,isNew=false) {
            if(!isNew)return;
            const type=String(item?.类型||'').trim(),name=String(item?.名称||'').trim();
            if(!WORLD_ASSET_TYPE_SET.has(type))throw new Error('新资产类型非法：'+(name||'未命名')+'；资产只允许固定地产、大型载具或要塞，普通道具/材料/消耗品不得进入资产账簿');
            if(ITEMLIKE_ASSET_NAME.test(name))throw new Error('疑似道具被误写为资产：'+name+'；请写入角色道具/装备/形态等对应字段，不得写入资产');
        }

        normalizeOwners(value) {
            const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];
            for(const raw of source){
                const owner=String(raw??'').trim();
                if(!owner||owner==='无主'||out.includes(owner))continue;
                out.push(owner);
            }
            return out.slice(0,12);
        }

        materializeRecord(oldValue,item,isNew=false) {
            const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);
            // 旧资产没有所属对象时兼容为玩家资产；显式空数组则表示无主。
            asset.所属对象=Object.hasOwn(oldAsset,'所属对象')?this.normalizeOwners(oldAsset.所属对象):['<user>'];
            if(isNew){
                if(!Object.hasOwn(item,'所属对象'))throw new Error('新资产必须明确所属对象数组；无主资产请使用空数组：'+item.名称);
                if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);
            }
            if(Object.hasOwn(item,'所属对象'))asset.所属对象=this.normalizeOwners(item.所属对象);
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
    }

    const DEFAULT_WORLD_ASSET_MATERIALIZATION_POLICY=new WorldAssetMaterializationPolicy();
    const EXPLORATION_PROJECTION_RULES='【玩家探索投影硬约束】实际到达整体区域时至少记录10%探索；远方后台地区不自动投影；离开区域后仍保留探索台账。';
    const MICRO_EXPLORATION_ROOT=/^(?:房间|房室|大厅|走廊|通道|楼梯|楼层|入口|出口|出入口|屋顶|平台|仓库|餐厅|卫生间|浴室|车厢|甲板|舱室)$/;
    const MICRO_EXPLORATION_CHILD=/(?:室|房|厅|间|廊|梯|层|入口|出口|门|口|台|舱|仓|库|堂|巷|通道|甲板|屋顶)$/;
    function isMicroExplorationSegment(segment,nested=false) {
        const value=String(segment||'').trim();if(!value)return false;
        if(MICRO_EXPLORATION_ROOT.test(value))return true;
        return nested&&value.length<=16&&MICRO_EXPLORATION_CHILD.test(value);
    }
    class WorldExplorationService {
        constructor(engine=null){this.engine=engine;}
        snapshot(){
            const stat=this.engine?.snapshot?.().stat||{},world=stat.世界||{},backend=world?.[PATH]||{};
            return {探索:copy(world.探索||{}),势力:copy(world.势力||{}),势力地区:copy(backend.势力地区||{})};
        }
        granularity(name) {
            const raw=String(name||'').trim();
            if(!raw)return {invalid:true,parent:''};
            if(isMicroExplorationSegment(raw,false))return {invalid:true,parent:''};
            const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
            if(parts.length>1&&isMicroExplorationSegment(parts.at(-1),true))return {invalid:true,parent:parts.slice(0,-1).join('-')};
            return {invalid:false,parent:''};
        }
        validateItem(stat,item) {
            const granularity=this.granularity(item?.名称);
            if(granularity.invalid)throw new Error('探索粒度过细：'+item.名称+'。世界.探索只记录整体地标/区域'+(granularity.parent?'，请改为“'+granularity.parent+'”并把微观进展累加到主区域':'，禁止把建筑内部、单个房室、楼层、出入口等微观子区域作为独立探索项'));
            const old=(stat?.世界?.探索||{})[item.名称];
            if(old&&Object.hasOwn(item,'探索度')&&Number(item.探索度)<Number(old.探索度||0))throw new Error('探索度不能无因回退：'+item.名称+' '+old.探索度+' -> '+item.探索度);
            return granularity;
        }
        repairGranularity(stat) {
            const bucket=stat?.世界?.探索;if(!plain(bucket))return [];
            const patches=[];
            for(const name of Object.keys(bucket)){
                const info=this.granularity(name);if(!info.invalid||!info.parent)continue;
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
        locationContainsArea(location,areaName) {
            const locationKey=nameKey(location),areaKey=nameKey(areaName);
            return !!locationKey&&!!areaKey&&(locationKey===areaKey||locationKey.includes(areaKey));
        }
        ensureCurrentProjection(stat,result) {
            if(stat?.系统状态?.是否在主神空间)return result;
            const location=String(stat?.世界?.地点||'').trim();if(!location)return result;
            const areas=new Map(Object.entries(stat?.世界?.[PATH]?.势力地区||{}).map(([name,record])=>[nameKey(name),{名称:name,记录:record}]));
            for(const item of result?.势力地区||[]){
                if(!plain(item)||item.操作==='撤销本轮')continue;
                const id=nameKey(item.名称),old=areas.get(id);
                areas.set(id,{名称:old?.名称||item.名称,记录:Object.assign({},old?.记录||{},item)});
            }
            const current=Array.from(areas.values())
                .filter(item=>plain(item.记录)&&String(item.记录.类型||'地区')!=='势力'&&this.locationContainsArea(location,item.名称))
                .sort((a,b)=>nameKey(b.名称).length-nameKey(a.名称).length)[0];
            if(!current||this.granularity(current.名称).invalid)return result;
            const bucket=stat?.世界?.探索||{},existingName=stableNameIn(bucket,current.名称),existing=existingName?bucket[existingName]:null;
            const list=Array.isArray(result.探索)?result.探索:(result.探索=[]);
            const index=list.findIndex(item=>plain(item)&&nameKey(item.名称)===nameKey(current.名称));
            const explicit=index>=0?list[index]:null,progress=Math.max(10,Number(existing?.探索度)||0,Number(explicit?.探索度)||0);
            if(existing&&progress===Number(existing.探索度||0)&&!explicit)return result;
            const item={
                名称:current.名称,操作:'更新',
                风险:String(explicit?.风险||existing?.风险||'F'),
                探索度:Math.min(100,progress),
                描述:String(explicit?.描述||existing?.描述||current.记录.描述||current.记录.公开动态||current.记录.进展||('已实际到达'+current.名称+'。')),
                隐藏真相:String(explicit?.隐藏真相||existing?.隐藏真相||'')
            };
            if(index>=0)list.splice(index,1,item);else list.push(item);
            return result;
        }
        record(kind,name){
            const source=this.snapshot(),bucket=kind==='faction'?source.势力:source.探索;
            const actual=stableNameIn(bucket,String(name||'').trim());if(!actual)return null;
            const backendName=stableNameIn(source.势力地区,actual),backend=backendName?source.势力地区[backendName]:null;
            return {kind,name:actual,ledger:copy(bucket[actual]),backendName,backend:plain(backend)?copy(backend):null};
        }
        normalizeRank(value,label){
            const rank=String(value||'').trim().toUpperCase();
            if(!QUALITY_RANKS.includes(rank))throw new Error(label+'必须是 '+QUALITY_RANKS.join(' / '));
            return rank;
        }
        async saveRecord(kind,oldName,newName,payload){
            if(!['exploration','faction'].includes(kind))throw new Error('未知探索/势力编辑类型');
            const engine=this.engine,oldKey=String(oldName||'').trim(),nextName=String(newName||'').trim();
            if(!nextName)throw new Error(kind==='faction'?'势力名称不能为空':'探索地标名称不能为空');
            if(kind==='exploration'){
                const granularity=this.granularity(nextName);
                if(granularity.invalid)throw new Error('探索粒度过细：'+nextName+(granularity.parent?'；请改为“'+granularity.parent+'”':''));
            }
            const input=plain(payload)?payload:{},ledgerInput=plain(input.ledger)?input.ledger:{},backendInput=plain(input.backend)?input.backend:{};
            const ok=await engine.services.mutations.commit(stat=>{
                const world=stat.世界||(stat.世界={}),backend=engine.services.mutations.backend(stat),bucket=kind==='faction'?(world.势力||(world.势力={})):(world.探索||(world.探索={}));
                const actual=stableNameIn(bucket,oldKey);if(!actual)throw new Error(kind==='faction'?'势力记录不存在：'+oldKey:'探索记录不存在：'+oldKey);
                const conflict=stableNameIn(bucket,nextName);
                if(conflict&&conflict!==actual)throw new Error('名称已存在：'+nextName);
                const current=plain(bucket[actual])?copy(bucket[actual]):{};
                let nextLedger;
                if(kind==='faction'){
                    nextLedger=Object.assign(copy(EXISTING.势力),current,{
                        实力:this.normalizeRank(ledgerInput.实力??current.实力??'F','势力实力'),
                        声望:Math.max(-5000,Math.min(10000,Number(ledgerInput.声望??current.声望)||0)),
                        领地:String(ledgerInput.领地??current.领地??'').trim(),
                        描述:String(ledgerInput.描述??current.描述??'').trim()
                    });
                }else{
                    nextLedger=Object.assign(copy(EXISTING.探索),current,{
                        风险:this.normalizeRank(ledgerInput.风险??current.风险??'F','探索风险'),
                        探索度:Math.max(0,Math.min(100,Number(ledgerInput.探索度??current.探索度)||0)),
                        描述:String(ledgerInput.描述??current.描述??'').trim(),
                        隐藏真相:String(ledgerInput.隐藏真相??current.隐藏真相??'').trim()
                    });
                }
                if(actual!==nextName)delete bucket[actual];
                bucket[nextName]=nextLedger;

                const areas=backend.势力地区||(backend.势力地区={}),areaName=stableNameIn(areas,actual)||stableNameIn(areas,nextName);
                const expectedFaction=kind==='faction';
                const existingArea=areaName&&plain(areas[areaName])?copy(areas[areaName]):null;
                const sameType=existingArea?(String(existingArea.类型||'地区')==='势力')===expectedFaction:true;
                if(sameType){
                    const area=Object.assign(copy(RECORDS.势力地区),existingArea||{},copy(backendInput),{类型:expectedFaction?'势力':'地区'});
                    area.描述=String(backendInput.描述??area.描述??nextLedger.描述??'').trim();
                    area.目标=String(backendInput.目标??area.目标??'').trim();
                    area.进展=String(backendInput.进展??area.进展??'').trim();
                    area.下次检查=String(backendInput.下次检查??area.下次检查??'').trim();
                    area.公开动态=String(backendInput.公开动态??area.公开动态??'').trim();
                    if(Object.hasOwn(backendInput,'控制方'))area.控制方=String(backendInput.控制方||'').trim();
                    if(Object.hasOwn(backendInput,'争夺方'))area.争夺方=engine.services.mutations.textList(backendInput.争夺方);
                    if(Object.hasOwn(backendInput,'环境状态'))area.环境状态=engine.services.mutations.textList(backendInput.环境状态);
                    if(areaName&&areaName!==nextName)delete areas[areaName];
                    areas[nextName]=area;
                }
                return true;
            },kind==='faction'?'势力档案已手动修正':'探索档案已手动修正');
            if(ok){
                if(kind==='faction')engine.selectedFaction=nextName;else engine.selectedArea=nextName;
                engine.render(true);
            }
            return ok;
        }
        async removeRecord(kind,name){
            if(!['exploration','faction'].includes(kind))throw new Error('未知探索/势力编辑类型');
            const engine=this.engine,key=String(name||'').trim();
            const ok=await engine.services.mutations.commit(stat=>{
                const world=stat.世界||(stat.世界={}),backend=engine.services.mutations.backend(stat),bucket=kind==='faction'?(world.势力||(world.势力={})):(world.探索||(world.探索={}));
                const actual=stableNameIn(bucket,key);if(!actual)return false;
                delete bucket[actual];
                const areas=backend.势力地区||(backend.势力地区={}),areaName=stableNameIn(areas,actual);
                if(areaName&&plain(areas[areaName])){
                    const isFaction=String(areas[areaName].类型||'地区')==='势力';
                    if(isFaction===(kind==='faction'))delete areas[areaName];
                }
                return true;
            },kind==='faction'?'势力档案已删除':'探索档案已删除');
            if(ok){
                if(kind==='faction')engine.selectedFaction='';else engine.selectedArea='';
                engine.render(true);
            }
            return ok;
        }
        prepareResult(stat,result){return this.ensureCurrentProjection(stat,result);}
    }
    const DEFAULT_WORLD_EXPLORATION_SERVICE=new WorldExplorationService();
    let ACTIVE_WORLD_EXPLORATION_SERVICE=DEFAULT_WORLD_EXPLORATION_SERVICE;
    function explorationGranularity(name){return ACTIVE_WORLD_EXPLORATION_SERVICE.granularity(name);}
    function repairExplorationGranularity(stat){return ACTIVE_WORLD_EXPLORATION_SERVICE.repairGranularity(stat);}
    class WorldResultContract {
        constructor(){this.schema=this.build();}
        schemaFromSample(sample) {
            if(Array.isArray(sample))return {type:'array',items:sample.length?this.schemaFromSample(sample[0]):{type:'string'}};
            if(plain(sample)){
                const properties=Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,this.schemaFromSample(value)]));
                return {type:'object',properties,additionalProperties:false};
            }
            if(typeof sample==='number')return {type:'number'};
            if(typeof sample==='boolean')return {type:'boolean'};
            return {type:'string'};
        }
        namedEntitySchema(sample,operations=['更新','撤销本轮'],requiredFields=[]) {
            const properties={名称:{type:'string',minLength:1},操作:{type:'string',enum:operations}};
            for(const [key,value] of Object.entries(sample||{}))properties[key]=this.schemaFromSample(value);
            return {type:'object',properties,required:['名称',...requiredFields],additionalProperties:false};
        }
        instruction() {
            return `只输出一个 WorldResult JSON 对象；不要输出 Markdown、解释、思考过程、<thinking> 或 JSON Pointer。
省略业务字段表示无变化；已有实体只写本轮变化字段，新增实体写足以建立该实体的确定事实；实体用“名称”关联。
“操作”默认“更新”；“移除”只用于 Schema 允许删除的记录；“撤销本轮”只用于纠错重试。
字段语义遵循【世界引擎核心约束】；字段结构和值域只以以下 Schema 为准。WorldResult 之外的任务、世界时间、玩家属性/货币/击杀等不要输出。
关系只更新已存在的关系列表对象；不得为玩家建立后台人物记录。`;
        }
        protocol() {
            return this.instruction()+'\n\n【Canonical WorldResult JSON Schema】\n'+JSON.stringify(this.schema,null,2);
        }
        build(){
        const FACTION_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.势力);
        FACTION_RESULT_SCHEMA.properties.实力={type:'string',enum:copy(QUALITY_RANKS)};
        FACTION_RESULT_SCHEMA.properties.声望={type:'number',minimum:-5000,maximum:10000};
        const EXPLORATION_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.探索);
        EXPLORATION_RESULT_SCHEMA.properties.风险={type:'string',enum:copy(QUALITY_RANKS)};
        EXPLORATION_RESULT_SCHEMA.properties.探索度={type:'number',minimum:0,maximum:100};
        const EVENT_RESULT_SCHEMA=this.namedEntitySchema({...RECORDS.事件,...MODEL_DETAILS.事件});
        EVENT_RESULT_SCHEMA.properties.状态={type:'string',enum:['待发生','进行中','已完成','已取消']};
        EVENT_RESULT_SCHEMA.properties.分类={type:'string',enum:Array.from(EVENT_CATEGORIES)};
        for(const key of ['时间','开始时间','预计结束','更新时间','下次检查'])if(EVENT_RESULT_SCHEMA.properties[key])EVENT_RESULT_SCHEMA.properties[key].description=WORLD_TIME_MACHINE_DESCRIPTION;
        const PERSON_RESULT_SCHEMA=this.namedEntitySchema({...RECORDS.人物,...MODEL_DETAILS.人物});
        PERSON_RESULT_SCHEMA.properties.审计级别={type:'string',enum:copy(NPC_AUDIT_LEVELS)};
        const OFFSET_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.偏移记录);
        OFFSET_RESULT_SCHEMA.properties.影响程度={type:'number'};
        const STREET_RUMOR_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.街头巷议,['更新','移除','撤销本轮'],['来源','内容','可信度']);
        STREET_RUMOR_RESULT_SCHEMA.properties.可信度={type:'string',enum:copy(RUMOR_CREDIBILITY)};
        const INTEL_TRADE_RESULT_SCHEMA=this.namedEntitySchema(EXISTING.情报交易,['更新','移除','撤销本轮'],['卖家','情报评级','摘要','要价','真实内幕']);
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
        所属对象:{type:'array',items:{type:'string',minLength:1},maxItems:12},类型:{type:'string',enum:copy(WORLD_ASSET_TYPES)},主体规模:{type:'number',minimum:1,maximum:10},完整度:{type:'number',minimum:0,maximum:100},状态:{type:'string'},
        能源:{anyOf:[{type:'object',additionalProperties:false,properties:{类型:{type:'string'},当前:{type:'number'},上限:{type:'number'},描述:{type:'string'}}},{type:'null'}]},
        消耗单元:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{余量:{type:'number'},上限:{type:'number'},加成:{type:'array',items:{type:'string'}}}},{type:'null'}]}},
        建设序列:{type:'object',additionalProperties:{anyOf:[{type:'object',additionalProperties:false,properties:{阶段:{type:'string',enum:['基础','进阶','专业','顶尖','禁忌']},功能:{type:'string'},加成:{type:'array',items:{type:'string'}},产出:{type:'string'}}},{type:'null'}]}},
        驻扎人员:{type:'object',additionalProperties:{anyOf:[{type:'string'},{type:'null'}]}},
        待办事件:{type:'array',items:{type:'string'}}
        }
        };
        const schema={
        type:'object',
        additionalProperties:false,
        required:['摘要'],
        properties:{
        摘要:{type:'string'},
        时间:{type:'string',minLength:1,description:'当前世界时间。'+WORLD_TIME_MACHINE_DESCRIPTION},
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
        人物:{type:'array',maxItems:25,items:PERSON_RESULT_SCHEMA},
        势力地区:{type:'array',maxItems:20,items:this.namedEntitySchema({...RECORDS.势力地区,...MODEL_DETAILS.势力地区})},
        历史:{type:'array',maxItems:12,items:this.namedEntitySchema(RECORDS.历史,['更新','撤销本轮'])},
        传播:{type:'array',maxItems:20,items:this.namedEntitySchema({...RECORDS.传播,...MODEL_DETAILS.传播},['更新','移除','撤销本轮'])},
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
        街头巷议:{type:'array',maxItems:6,items:STREET_RUMOR_RESULT_SCHEMA},
        情报交易:{type:'array',maxItems:6,items:INTEL_TRADE_RESULT_SCHEMA},
        布告与檄文:{type:'array',maxItems:6,items:this.namedEntitySchema(EXISTING.布告与檄文,['更新','移除','撤销本轮'],['发布者','内容','张贴位置'])}
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
        this.schemas={
            faction:FACTION_RESULT_SCHEMA,exploration:EXPLORATION_RESULT_SCHEMA,event:EVENT_RESULT_SCHEMA,person:PERSON_RESULT_SCHEMA,
            offset:OFFSET_RESULT_SCHEMA,streetRumor:STREET_RUMOR_RESULT_SCHEMA,intelTrade:INTEL_TRADE_RESULT_SCHEMA,
            relationSkill:RELATION_SKILL_SCHEMA,relationOccupation:RELATION_OCCUPATION_SCHEMA,relationBloodline:RELATION_BLOODLINE_SCHEMA,
            relationEquip:RELATION_EQUIP_SCHEMA,relationStatus:RELATION_STATUS_SCHEMA,relationForm:RELATION_FORM_SCHEMA,
            relationCurrentForm:RELATION_CURRENT_FORM_SCHEMA,asset:ASSET_RESULT_SCHEMA
        };
        return schema;
        }
    }
    const WORLD_RESULT_CONTRACT=new WorldResultContract();
    // Transitional aliases: legacy features still decorate component schemas at startup.
    const FACTION_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.faction;
    const EXPLORATION_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.exploration;
    const EVENT_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.event;
    const PERSON_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.person;
    const OFFSET_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.offset;
    const STREET_RUMOR_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.streetRumor;
    const INTEL_TRADE_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.intelTrade;
    const RELATION_SKILL_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationSkill;
    const RELATION_OCCUPATION_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationOccupation;
    const RELATION_BLOODLINE_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationBloodline;
    const RELATION_EQUIP_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationEquip;
    const RELATION_STATUS_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationStatus;
    const RELATION_FORM_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationForm;
    const RELATION_CURRENT_FORM_SCHEMA=WORLD_RESULT_CONTRACT.schemas.relationCurrentForm;
    const ASSET_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schemas.asset;
    const WORLD_RESULT_SCHEMA=WORLD_RESULT_CONTRACT.schema;
    function protocol(){return WORLD_RESULT_CONTRACT.protocol();}
    class WorldResultNormalizer {
        rumorCredibility(value) {
            const raw=String(value??'').trim();
            if(RUMOR_CREDIBILITY.includes(raw))return {value:raw,recognized:true,raw};
            if(/^(?:可信|属实|真实|确实|高|较高|很高|基本属实)$/.test(raw))return {value:'或许可信',recognized:true,raw};
            if(/^(?:不可信|虚假|谣言|低|较低|很低|纯属谣言)$/.test(raw))return {value:'酒话',recognized:true,raw};
            return {value:'可疑',recognized:false,raw};
        }
        normalizeRumorCredibility(value) {
            return this.rumorCredibility(value).value;
        }
        assertRumorCredibility(value) {
            const parsed=this.rumorCredibility(value);
            if(!parsed.recognized)throw new Error('传闻可信度无效：'+(parsed.raw||'空')+'；只允许 酒话/可疑/或许可信，或可识别的可信/不可信同义描述');
            return parsed.value;
        }
        sampleForWorldResultList(key) {
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
        detailTextField(sample) {
            for(const key of ['名称','事实','行动','影响','内容','说明','问题','对象','地点']){
                if(Object.hasOwn(sample||{},key)&&typeof sample[key]==='string')return key;
            }
            return Object.keys(sample||{}).find(key=>typeof sample[key]==='string')||'';
        }
        normalizeStructuredDetail(value,sample) {
            const out=copy(sample||{});
            if(plain(value)){
                for(const key of Object.keys(sample||{})){
                    if(Object.hasOwn(value,key))out[key]=this.normalizeResultField(value[key],sample[key]);
                }
                return out;
            }
            if(value!==undefined&&value!==null&&value!==''){
                const key=this.detailTextField(sample);
                if(key)out[key]=this.normalizeResultField(value,sample[key]);
            }
            return out;
        }
        normalizeResultField(value,sample) {
            if(Array.isArray(sample)){
                const list=Array.isArray(value)?value:(value===undefined||value===null||value===''?[]:[value]);
                if(sample.length&&plain(sample[0]))return list.filter(item=>item!==undefined&&item!==null&&item!=='').map(item=>this.normalizeStructuredDetail(item,sample[0]));
                return list.map(copy);
            }
            if(plain(sample)){
                if(!plain(value))return copy(sample);
                const out=copy(sample);
                for(const key of Object.keys(sample))if(Object.hasOwn(value,key))out[key]=this.normalizeResultField(value[key],sample[key]);
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
        normalizeNamedResultList(value,sample,allowedOps=['更新','撤销本轮']) {
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
                for(const key of fields)if(Object.hasOwn(raw,key))item[key]=this.normalizeResultField(raw[key],sample[key]);
                const id=nameKey(name),prev=map.get(id);
                if(item.操作==='撤销本轮'){map.delete(id);continue;}
                map.set(id,prev?Object.assign(prev,item):item);
            }
            return Array.from(map.values());
        }
        normalizeAssetResultList(value) {
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
        normalizeRelationResultList(value) {
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
        normalizeWorldResult(value) {
            if(!plain(value))throw new Error('WorldResult 必须是 JSON 对象');
            const result={摘要:String(value.摘要??value.summary??'世界继续推进')};
            if(Object.hasOwn(value,'时间')){const time=String(value.时间??'').trim();if(time)result.时间=time;}
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
                result[key]=this.normalizeNamedResultList(value[key],this.sampleForWorldResultList(key),operations);
            }
            result.资产=this.normalizeAssetResultList(value.资产);
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
            result.因果.偏移记录=this.normalizeNamedResultList(causal.偏移记录,EXISTING.偏移记录,['更新','撤销本轮']);
            result.传闻={};
            const rumors=plain(value.传闻)?value.传闻:{};
            for(const key of WORLD_RESULT_RUMORS){
                let list=this.normalizeNamedResultList(rumors[key],EXISTING[key],['更新','移除','撤销本轮']);
                if(key==='街头巷议'){
                    for(const item of list)if(Object.hasOwn(item,'可信度'))item.可信度=this.normalizeRumorCredibility(item.可信度);
                    const seen=new Set(),deduped=[];
                    for(const item of list){
                        const signature=String(item.内容||'').replace(/\s+/g,' ').trim();
                        if(item.操作==='更新'&&signature&&seen.has(signature))continue;
                        if(item.操作==='更新'&&signature)seen.add(signature);
                        deduped.push(item);
                    }
                    list=deduped;
                }
                result.传闻[key]=list;
            }
            const relationSource=plain(value.关系)&&!Array.isArray(value.关系)
                ?Object.entries(value.关系).map(([name,item])=>plain(item)?Object.assign({名称:name},copy(item)):{名称:name,好感度:item})
                :value.关系;
            result.关系=this.normalizeRelationResultList(relationSource);
            return result;
        }
        mergeNamedResultLists(base,incoming) {
            const map=new Map();
            for(const item of base||[])map.set(nameKey(item.名称),copy(item));
            for(const item of incoming||[]){
                const id=nameKey(item.名称);
                if(item.操作==='撤销本轮'){map.delete(id);continue;}
                map.set(id,Object.assign(map.get(id)||{},copy(item)));
            }
            return Array.from(map.values());
        }
        mergeWorldResults(base,incoming) {
            const a=base?this.normalizeWorldResult(base):this.normalizeWorldResult({摘要:''});
            const b=this.normalizeWorldResult(incoming);
            const result={摘要:[a.摘要,b.摘要].filter(Boolean).filter((x,i,list)=>list.indexOf(x)===i).join('；')};
            if(Object.hasOwn(b,'时间'))result.时间=b.时间;else if(Object.hasOwn(a,'时间'))result.时间=a.时间;
            result.货币=Object.assign({},a.货币||{},b.货币||{});
            result.历法=Object.assign({},a.历法||{},b.历法||{});
            for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端','关系'])result[key]=this.mergeNamedResultLists(a[key],b[key]);
            result.因果={
                偏移记录:this.mergeNamedResultLists(a.因果?.偏移记录,b.因果?.偏移记录)
            };
            if(Object.hasOwn(b.因果||{},'当前阶段'))result.因果.当前阶段=b.因果.当前阶段;
            else if(Object.hasOwn(a.因果||{},'当前阶段'))result.因果.当前阶段=a.因果.当前阶段;
            if(Array.isArray(b.因果?.宏观顺序)&&b.因果.宏观顺序.length)result.因果.宏观顺序=copy(b.因果.宏观顺序);
            else if(Array.isArray(a.因果?.宏观顺序))result.因果.宏观顺序=copy(a.因果.宏观顺序);
            result.传闻={};
            for(const key of WORLD_RESULT_RUMORS)result.传闻[key]=this.mergeNamedResultLists(a.传闻?.[key],b.传闻?.[key]);
            return result;
        }
    }
    const DEFAULT_WORLD_RESULT_NORMALIZER=new WorldResultNormalizer();
    function normalizeWorldResult(value){return DEFAULT_WORLD_RESULT_NORMALIZER.normalizeWorldResult(value);}
    function mergeWorldResults(base,incoming){return DEFAULT_WORLD_RESULT_NORMALIZER.mergeWorldResults(base,incoming);}
    class WorldResultPatchCompilationService {
        constructor(normalizer,exploration,causal,patchPolicy,npcAudit,people,taskLedger,chronology,timePolicy,relationSync,assetPolicy){
            this.normalizer=normalizer||DEFAULT_WORLD_RESULT_NORMALIZER;
            this.exploration=exploration||DEFAULT_WORLD_EXPLORATION_SERVICE;
            this.causal=causal||DEFAULT_WORLD_CAUSAL_SERVICE;
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.npcAudit=npcAudit||DEFAULT_WORLD_NPC_AUDIT_SERVICE;
            this.people=people||DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE;
            this.taskLedger=taskLedger||DEFAULT_WORLD_TASK_AWARENESS_SERVICE;
            this.chronology=chronology||DEFAULT_WORLD_CHRONOLOGY_POLICY;
            this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;
            this.relationSync=relationSync||DEFAULT_WORLD_RELATION_SYNC_POLICY;
            this.assetPolicy=assetPolicy||DEFAULT_WORLD_ASSET_MATERIALIZATION_POLICY;
        }
        resultFields(item,sample) {
            const out={};
            for(const key of Object.keys(sample||{}))if(Object.hasOwn(item,key))out[key]=copy(item[key]);
            return out;
        }
        compile(stat,value) {
            const originalStat=stat,initial=this.normalizer.normalizeWorldResult(value),timing=this.timePolicy.prepareCompile(originalStat,initial);
            stat=timing.validationStat;
            const prepared=this.people.normalizeAlienActivityTimestamps(stat,timing.result);
            const result=this.normalizer.normalizeWorldResult(prepared),patches=[],warnings=[];
            this.npcAudit.normalizeNewEquipment(stat,result);
            const droppedCausalOffsets=this.causal.prepareResult(stat,result);
            this.chronology.validate(stat,result);
            this.taskLedger.validateReferences(stat,result);
            this.exploration.prepareResult(stat,result);
            const exists=parts=>this.patchPolicy.get(stat,this.patchPolicy.canonicalizeParts(parts,stat));
            const addEntity=(parts,item,sample,options={})=>{
                if(item.操作==='撤销本轮')return;
                let actual=this.patchPolicy.canonicalizeParts(parts,stat),old=this.patchPolicy.get(stat,actual);
                if(item.操作==='移除'){
                    if(old!==undefined&&options.removable)patches.push({op:'remove',path:this.patchPolicy.pointer(actual)});
                    return;
                }
                const record=this.resultFields(item,sample);
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
                patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(actual),value:record});
            };
            for(const [key,value] of Object.entries(result.货币||{})){
                const parts=['世界','货币',key],old=this.patchPolicy.get(stat,parts);
                if(old!==value)patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value});
            }
            for(const [key,value] of Object.entries(result.历法||{})){
                const parts=['世界','历法',key],old=this.patchPolicy.get(stat,parts);
                if(!same(old,value))patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value:copy(value)});
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
                let name=item.名称,parts=['世界',PATH,'历史',name],record=this.resultFields(item,RECORDS.历史);
                if(!Object.keys(record).length){warnings.push('忽略空历史记录：'+name);continue;}
                if(this.patchPolicy.get(stat,parts)!==undefined){
                    const old=this.patchPolicy.get(stat,parts);
                    if(same(this.patchPolicy.normalizeBackendRecord('历史',record,old),old))continue;
                    let n=2;while(this.patchPolicy.get(stat,['世界',PATH,'历史',name+'#'+n])!==undefined)n++;
                    name=name+'#'+n;parts=['世界',PATH,'历史',name];
                }
                patches.push({op:'add',path:this.patchPolicy.pointer(parts),value:record});
            }
            const causal=result.因果||{};
            if(Object.hasOwn(causal,'当前阶段')){
                const parts=['世界','因果轨道','当前阶段'],old=this.patchPolicy.get(stat,parts);
                patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value:causal.当前阶段});
            }
            if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length>=3&&causal.宏观顺序.length<=5){
                const parts=['世界','因果轨道','故事线'],story=causal.宏观顺序.join(' -> '),old=this.patchPolicy.get(stat,parts);
                patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value:story});
            } else if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length)warnings.push('宏观顺序不足3个，等待补齐后再投影因果轨道');
            for(const item of causal.偏移记录||[]){
                if((stat.设置||{}).世界超稳){warnings.push('世界超稳：忽略偏移 '+item.名称);continue;}
                addEntity(['世界','因果轨道','偏移记录',item.名称],item,EXISTING.偏移记录);
            }
            for(const item of result.势力)addEntity(['世界','势力',item.名称],item,EXISTING.势力);
            for(const item of result.资产||[]){
                if(item.操作==='撤销本轮')continue;
                const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;
                if(!target&&item.操作!=='移除')this.assetPolicy.validateScope(item,true);
                const tombstoneName=stableNameIn(stat?.世界?.[PATH]?.资产墓碑||{},item.名称);
                if(!target&&item.操作!=='移除'&&tombstoneName)throw new Error('资产已被用户或MVU删除，受删除保护，世界引擎不得重建：'+item.名称);
                if(item.操作==='移除'){
                    if(target)patches.push({op:'remove',path:this.patchPolicy.pointer(['资产',target])});
                    else warnings.push('资产对象不存在，忽略移除：'+item.名称);
                    continue;
                }
                const finalName=target||item.名称;
                const record=this.assetPolicy.materializeRecord(existing,item,!target);
                if(existing&&same(existing,record))continue;
                patches.push({op:target?'replace':'add',path:this.patchPolicy.pointer(['资产',finalName]),value:record});
            }
            for(const item of result.探索){
                this.exploration.validateItem(stat,item);
                addEntity(['世界','探索',item.名称],item,EXISTING.探索);
            }
            if(!(stat.设置||{}).单一世界)for(const item of result.异端){
                if(item.操作==='撤销本轮')continue;
                const roster=stat.世界?.异端雷达?.名单||{},target=stableNameIn(roster,item.名称);
                if(!target){warnings.push('异端名单对象不存在，禁止世界引擎新增：'+item.名称);continue;}
                const oldStatus=roster[target]?.状态;
                if(oldStatus==='死亡'&&item.状态!=='死亡'){warnings.push('死亡异端状态不可逆：'+target);continue;}
                if(oldStatus===item.状态)continue;
                patches.push({op:'replace',path:this.patchPolicy.pointer(['世界','异端雷达','名单',target,'状态']),value:item.状态});
            } else if(result.异端.length)warnings.push('单一世界：忽略异端雷达更新');
            for(const key of WORLD_RESULT_RUMORS)for(const item of result.传闻[key])addEntity(['传闻',key,item.名称],item,EXISTING[key],{removable:true});
            const auditNames=new Set(this.npcAudit.audit(stat).map(item=>nameKey(item.名称)));
            for(const item of result.关系||[]){
                if(item.操作==='撤销本轮')continue;
                const target=stableNameIn(stat.关系列表||{},item.名称);
                if(!target){warnings.push('关系对象不存在，禁止世界引擎新建：'+item.名称);continue;}
                const npc=stat.关系列表[target],fields=this.resultFields(item,RELATION_SYNC_FIELDS);
                if(!Object.keys(fields).length){warnings.push('忽略空关系更新：'+target);continue;}
                for(const [field,value] of Object.entries(fields)){
                    if(RELATION_AUDIT_ONLY_FIELDS.has(field)&&!auditNames.has(nameKey(target))){
                        warnings.push('NPC当前不在构筑审计名单，忽略构筑字段：'+target+'/'+field);
                        continue;
                    }
                    this.relationSync.validateRelationSyncValue(field,value,npc,target);
                    const nextValue=RELATION_COMPONENT_FIELDS.has(field)?this.relationSync.mergeRelationComponent(field,npc?.[field],value):this.relationSync.materializeRelationComponent(field,value);
                    this.relationSync.assertComponentLimit(field,nextValue,target);
                    if(same(npc?.[field],nextValue))continue;
                    patches.push({op:npc?.[field]===undefined?'add':'replace',path:this.patchPolicy.pointer(['关系列表',target,field]),value:copy(nextValue)});
                }
            }
            const causalRepairs=this.causal.staleLocalOffsetRepairs(stat,result);
            const occupiedCausalPaths=new Set(patches.map(patch=>patch.path));
            for(const patch of causalRepairs.patches)if(!occupiedCausalPaths.has(patch.path))patches.push(patch);
            if(droppedCausalOffsets.length)warnings.push('忽略非世界尺度因果偏移：'+droppedCausalOffsets.join('、'));
            if(causalRepairs.names.length)warnings.push('清理局部稳定偏移：'+causalRepairs.names.join('、'));
            return this.timePolicy.finalizeCompile(originalStat,timing.proposal,{result,patches,warnings});
        }


    }
    const DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE=new WorldResultPatchCompilationService(
        DEFAULT_WORLD_RESULT_NORMALIZER,
        DEFAULT_WORLD_EXPLORATION_SERVICE,
        DEFAULT_WORLD_CAUSAL_SERVICE,
        DEFAULT_WORLD_PATCH_POLICY,
        DEFAULT_WORLD_NPC_AUDIT_SERVICE,
        DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE,
        DEFAULT_WORLD_TASK_AWARENESS_SERVICE,
        DEFAULT_WORLD_CHRONOLOGY_POLICY,
        DEFAULT_WORLD_TIME_POLICY,
        DEFAULT_WORLD_RELATION_SYNC_POLICY,
        DEFAULT_WORLD_ASSET_MATERIALIZATION_POLICY
    );
    const RUMOR_LIVELINESS_TOPICS=['悬赏线索','商路动向','势力情报','遗迹坐标','人物行踪','黑市消息','宝物传闻','怪物异动','深渊异变','种族摩擦','物价波动'];
    const RUMOR_LIVELINESS_RULES=`【传闻与传播 · 常驻活跃层】
1. 街头巷议、情报交易、布告与檄文各自展示最近3条；某类为空时本轮补2条。单条约60字，除非影响重大，不围绕<user>。
   可直接追加新名称，程序会在合并后自动滚动淘汰最旧条目，不需要为容量主动提交「操作:移除」。沿用原名称视为刷新该条传闻，并优先保留；仅在传闻本身已失效、撤销或需要明确删除时使用「操作:移除」。
2. 街头巷议随当前地区、说书人/目击者和局势替换1~2条；情报交易有卖家时更新1~2条，购买、付款与消费性删除由MVU按正文结果处理；布告与檄文随当前地区与发布势力替换。
3. 后台传播是人物知情与公开传闻的因果链。新可传播事实建立或推进传播；关联事件变化、传播陈旧或到期时复核范围、受众、内容与引发行动，结束/过期传播不复活。
4. 优先话题：${RUMOR_LIVELINESS_TOPICS.join(' / ')}。`;
    const RUMOR_THROTTLE_RULES=`【传闻刷新节流 · 取代前述“每轮替换”要求】
1. 公开传闻默认保持不变。只有“传闻维护.本轮公开传闻动作”要求更新时才写传闻；禁止为了制造活跃感、凑数量或普通小事每轮改写。
2. 触发只包括：某分类为空需补1条；已有传播链因关联事件新进展、到期或超过72小时而需复核；本轮刚建立/更新且尚未建立传播链、具有公开征兆/可见影响的新事件。旧事件不会因为仍然存在而反复触发。普通行动、普通战斗、轻微状态或数值变化不触发刷新。
3. 单次触发每个分类最多更新1条。优先刷新与本次事实直接相关的同名传闻；否则追加1条，由程序自动滚动淘汰最旧条目。没有触发时三类传闻都保持原样，不提交无变化更新。
4. 传闻与传播属于软维护。单个传闻/传播片段格式错误或本轮未维护完成时，丢弃该片段并保留其它已验收结果；不得仅为传闻/传播重新调用整轮世界推进。
5. 情报交易的购买、付款、消费性删除仍由MVU/变量AI处理；世界引擎只维护其世界侧信息来源。`;
    const RUMOR_WORLD_SOURCE_RULES=`【信息传播 · 世界侧事实】
1. 传闻与传播描述世界里正在流通的信息；正文只用于确认事实与时间，不是直接传播源。禁止把正文中的个人行动、战斗细节、私密对话、能力或收益直接改写成传闻。
2. 直接取材仅限“传闻维护.世界侧可传播事实”、已有传播链与既有公开传闻。私密事实只有形成目击、公开后果、调查发现、公告或主动泄露等现实渠道后才能传播。
3. 公开内容不得超过来源与受众当时可知范围；后台真相不进入公开内容。传播必须有时间与空间路径，不能无因瞬间扩散到全世界。
4. 公开传闻默认保持不变；仅在空分类、传播链需复核或出现新的世界侧公开事实时按需更新，每个触发每类最多1条。
5. 普通行动、普通战斗、轻微状态或数值变化本身不触发传闻；只有其公开后果已经进入世界侧事实池时才可传播。
6. 传闻/传播属于软维护，单个片段失败不得让整轮世界推进重跑。情报交易的购买、付款与消费性删除由MVU按正文结果处理；世界引擎只维护世界侧信息来源。`;
    const RUMOR_PRESET_STEP_OLD='Step 6 · 更新传播：只维护本轮真实变化的传播、货币与历法；结束/过期传播不复活。';
    const RUMOR_PRESET_STEP_NEW='Step 6 · 信息传播：传闻是常驻活跃层；三类公开传闻为空时补2条，并随地区、卖家、发布势力与局势替换。新可传播事实建立或推进传播链，关联事件变化、陈旧或到期时复核。';
    const RUMOR_THROTTLE_PRESET_STEP='Step 6 · 信息传播：公开传闻默认保持不变；仅在空分类、传播链需复核或出现新的公开可传播事实时按需更新，每个触发每类最多1条。传闻/传播属于软维护，失败不重跑整轮。';
    const RUMOR_PUBLIC_CATEGORIES=['街头巷议','情报交易','布告与檄文'];
    const RUMOR_VISIBLE_LIMIT=3;
    const RUMOR_STALE_HOURS=72;
    class WorldRumorService {
        constructor(engine){this.engine=engine;}
        upgradePreset(value){
            let source=String(value||'');
            if(source.includes(RUMOR_PRESET_STEP_OLD))source=source.replace(RUMOR_PRESET_STEP_OLD,RUMOR_PRESET_STEP_NEW);
            if(!source.includes(RUMOR_THROTTLE_PRESET_STEP)&&source.includes(RUMOR_PRESET_STEP_NEW))source=source.replace(RUMOR_PRESET_STEP_NEW,RUMOR_THROTTLE_PRESET_STEP);
            return source;
        }
        requirements(stat=this.engine?.snapshot().stat||{}){
            const required=this.baseRequirements(stat),facts=this.publicFacts(stat),fresh=facts.filter(item=>item.新近).slice(-6);
            // Preserve the old throttle candidate window as well as the final world-side facts view.
            required.可传播候选事件=required.可传播候选事件.filter(item=>String(item.更新时间||'').trim()===required.世界时间.trim()).slice(-2);
            const empty=RUMOR_PUBLIC_CATEGORIES.filter(category=>Number(required.公开传闻[category].当前数量)===0),review=required.本轮必须复核的传播链,reasons=[];
            if(empty.length)reasons.push('空分类：'+empty.join('、'));
            if(review.length)reasons.push('传播复核：'+review.map(item=>item.名称).join('、'));
            if(fresh.length)reasons.push('新世界公开事实：'+fresh.map(item=>item.名称).join('、'));
            required.世界侧可传播事实=facts;
            required.本轮新公开事实=fresh;
            required.刷新原因=reasons;
            required.本轮公开传闻动作=reasons.length?'按需更新；每个触发每类最多1条':'保持不变';
            delete required.当前地点;
            return required;
        }
        classifyFailures(rejected){
            const hard=[],soft=[];
            for(const item of rejected||[])(/^(?:传闻\/|传播\/)/.test(String(item?.片段||''))?soft:hard).push(item);
            return soft.length?{rejected:hard,softRejected:soft}:{rejected:hard};
        }
        validatePublicState(stat){
            // Capacity is a rolling window. Validate the same visible tail as the former shadow-state wrapper.
            const items=Object.values(stat?.传闻?.街头巷议||{}).slice(-RUMOR_VISIBLE_LIMIT);
            if(items.some(item=>!['酒话','可疑','或许可信'].includes(item.可信度)))throw new Error('传闻可信度无效');
        }
        finishPatches(stat,patches){
            this.refreshTouchedOrder(stat,patches);
            this.trimCapacity(stat);
            return stat;
        }
        trimCapacity(stat) {
            const removed=[];
            for(const category of RUMOR_PUBLIC_CATEGORIES){
                const bucket=stat?.传闻?.[category];
                if(!plain(bucket))continue;
                const overflow=Math.max(0,Object.keys(bucket).length-RUMOR_VISIBLE_LIMIT);
                for(const name of Object.keys(bucket).slice(0,overflow)){
                    delete bucket[name];
                    removed.push(category+'/'+name);
                }
            }
            return removed;
        }
        refreshTouchedOrder(stat,patches=[]) {
            for(const patch of patches||[]){
                if(!plain(patch)||patch.op==='remove')continue;
                const parts=tokens(patch.path);
                if(parts.length!==3||parts[0]!=='传闻'||!RUMOR_PUBLIC_CATEGORIES.includes(parts[1]))continue;
                const bucket=stat?.传闻?.[parts[1]];
                if(!plain(bucket))continue;
                const name=stableNameIn(bucket,parts[2])||parts[2];
                if(!Object.hasOwn(bucket,name))continue;
                const value=bucket[name];
                delete bucket[name];
                bucket[name]=value;
            }
        }
        eventTouchedKey(event) {
            return worldDateKey(event?.更新时间||event?.预计结束||event?.开始时间||event?.时间);
        }
        baseRequirements(stat) {
            const backend=stat?.世界?.[PATH]||{},rumors=stat?.传闻||{},events=backend.事件||{},propagation=backend.传播||{};
            const worldTime=String(stat?.世界?.时间||''),now=worldDateKey(worldTime);
            const publicState={};
            for(const category of RUMOR_PUBLIC_CATEGORIES){
                const bucket=plain(rumors?.[category])?rumors[category]:{};
                const count=Object.keys(bucket).length;
                publicState[category]={当前数量:count,为空补足:count===0?1:0};
            }
            const review=[];
            for(const [名称,record] of Object.entries(propagation)){
                if(!plain(record)||!/^传播中$/.test(String(record.状态||'').trim()))continue;
                const reasons=[],updatedText=String(record.更新时间||'').trim(),touched=worldDateKey(updatedText||record.时间),expiry=worldDateKey(record.到期时间);
                let semantic=false;
                if(!updatedText)reasons.push('缺少更新时间');
                if(expiry!==null&&now!==null&&expiry<=now){reasons.push('已到期');semantic=true;}
                if(touched!==null&&now!==null&&now-touched>=RUMOR_STALE_HOURS){reasons.push('超过72小时未复核');semantic=true;}
                const changedEvents=[];
                for(const eventName of Array.isArray(record.关联事件)?record.关联事件:[]){
                    const event=events[eventName];if(!plain(event))continue;
                    const eventTouched=this.eventTouchedKey(event);
                    if((eventTouched!==null&&(touched===null||eventTouched>touched))||['已完成','已取消'].includes(event.状态))changedEvents.push(eventName);
                }
                if(changedEvents.length){reasons.push('关联事件已有新进展：'+changedEvents.join('、'));semantic=true;}
                if(!reasons.length)continue;
                review.push({
                    名称,原因:reasons,需语义变化:semantic,
                    当前:{来源:String(record.来源||''),范围:String(record.范围||''),时间:String(record.时间||''),更新时间:updatedText,到期时间:String(record.到期时间||''),内容:String(record.内容||''),状态:String(record.状态||''),受众:copy(record.受众||[]),引发行动:copy(record.引发行动||[]),关联事件:copy(record.关联事件||[])}
                });
            }
            const linked=new Set(Object.values(propagation).flatMap(record=>Array.isArray(record?.关联事件)?record.关联事件:[]));
            const candidates=Object.entries(events).filter(([name,event])=>{
                if(!plain(event)||!['进行中','已完成'].includes(event.状态)||linked.has(name))return false;
                const visible=String(event.公开征兆||'').trim()||(Array.isArray(event.可见影响)&&event.可见影响.length);
                return !!visible;
            }).slice(-6).map(([名称,event])=>({名称,状态:event.状态,地点:String(event.地点||''),公开征兆:String(event.公开征兆||''),更新时间:String(event.更新时间||event.时间||'')}));
            return {
                世界:String(stat?.世界?.名称||''),世界时间:worldTime,当前地点:String(stat?.世界?.地点||''),
                话题:copy(RUMOR_LIVELINESS_TOPICS),公开传闻:publicState,
                本轮必须复核的传播链:review,可传播候选事件:candidates
            };
        }
        maintenanceNeeded(stat) {
            const required=this.requirements(stat);
            return Object.values(required.公开传闻).some(item=>item.当前数量===0)||required.本轮必须复核的传播链.length>0;
        }
        sameTime(value,current){
            const a=String(value||'').trim(),b=String(current||'').trim();
            return !!a&&!!b&&(typeof sameWorldTimeAnchor==='function'?sameWorldTimeAnchor(a,b):a===b);
        }
        publicFacts(stat=this.engine?.snapshot().stat||{}){
            const backend=stat?.世界?.[PATH]||{},now=String(stat?.世界?.时间||'').trim(),facts=[];
            const add=item=>{if(plain(item)&&String(item.公开内容||'').trim())facts.push(item);};
            for(const [名称,event] of Object.entries(backend.事件||{})){
                if(!plain(event)||!['进行中','已完成'].includes(String(event.状态||'')))continue;
                const visible=[String(event.公开征兆||'').trim(),...(Array.isArray(event.可见影响)?event.可见影响.map(x=>String(x?.影响||'').trim()):[])].filter(Boolean);
                if(!visible.length)continue;
                const time=String(event.更新时间||event.时间||'').trim();
                add({类型:'公开事件',名称,地点:String(event.地点||''),时间:time,公开内容:visible.join('；'),关联事件:[名称],新近:this.sameTime(time,now)});
            }
            for(const [名称,person] of Object.entries(backend.人物||{})){
                const text=String(person?.公开动态||'').trim();if(!text)continue;
                const time=String(person?.更新时间||'').trim();
                add({类型:'人物公开动态',名称,时间:time,公开内容:text,关联事件:copy(Array.isArray(person?.关联事件)?person.关联事件:[]),新近:this.sameTime(time,now)});
            }
            for(const [名称,area] of Object.entries(backend.势力地区||{})){
                const text=String(area?.公开动态||'').trim();if(!text)continue;
                const time=String(area?.更新时间||'').trim();
                add({类型:'地区公开动态',名称,时间:time,公开内容:text,新近:this.sameTime(time,now)});
            }
            for(const [名称,faction] of Object.entries(stat?.世界?.势力||{})){
                const text=[faction?.领地,faction?.描述].map(x=>String(x||'').trim()).filter(Boolean).join('；');
                add({类型:'势力公开背景',名称,公开内容:text,新近:false});
            }
            for(const [名称,place] of Object.entries(stat?.世界?.探索||{}))add({类型:'探索公开背景',名称,风险:String(place?.风险||''),公开内容:String(place?.描述||''),新近:false});
            const economy=String(stat?.世界?.货币?.经济波动||'').trim();
            if(economy)add({类型:'经济公开背景',名称:'经济波动',公开内容:economy,新近:false});
            return facts.slice(-24);
        }

        maintenanceIssues(next,required) {
            const result={公开传闻:[],传播链:[]};
            if(!plain(required)||String(next?.世界?.名称||'')!==String(required.世界||'')||String(next?.世界?.时间||'')!==String(required.世界时间||''))return result;
            for(const category of RUMOR_PUBLIC_CATEGORIES){
                const count=Object.keys(plain(next?.传闻?.[category])?next.传闻[category]:{}).length;
                const initial=Number(required?.公开传闻?.[category]?.当前数量)||0;
                if(initial===0&&count===0)result.公开传闻.push(category);
            }
            for(const item of required.本轮必须复核的传播链||[]){
                const record=next?.世界?.[PATH]?.传播?.[item.名称];
                if(!record||propagationEnded(record,worldDateKey(required.世界时间)))continue;
                const updated=String(record.更新时间||'').trim()===String(required.世界时间||'').trim();
                const before=item.当前||{};
                const semantic=['范围','内容','受众','引发行动','状态','到期时间'].some(key=>!same(record?.[key],before?.[key]));
                if(!updated||(item.需语义变化&&!semantic))result.传播链.push(item.名称);
            }
            return result;
        }

    }
    const DEFAULT_WORLD_RUMOR_SERVICE=new WorldRumorService();
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=DEFAULT_WORLD_RUMOR_SERVICE.upgradePreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);
    // Compatibility entry points are stateless; production code uses the container-owned service.
    function rumorMaintenanceRequirements(stat){return DEFAULT_WORLD_RUMOR_SERVICE.requirements(stat);}
    function rumorMaintenanceNeeded(stat){return DEFAULT_WORLD_RUMOR_SERVICE.maintenanceNeeded(stat);}
    function worldPublicRumorFacts(stat){return DEFAULT_WORLD_RUMOR_SERVICE.publicFacts(stat);}
    function rumorWorldSameTime(value,current){return DEFAULT_WORLD_RUMOR_SERVICE.sameTime(value,current);}
    function trimRumorCapacity(stat){return DEFAULT_WORLD_RUMOR_SERVICE.trimCapacity(stat);}
    function refreshTouchedRumorOrder(stat,patches){return DEFAULT_WORLD_RUMOR_SERVICE.refreshTouchedOrder(stat,patches);}
    function softRumorMaintenanceIssues(next,required){return DEFAULT_WORLD_RUMOR_SERVICE.maintenanceIssues(next,required);}
    function ensureRumorLiveliness(next,required){return DEFAULT_WORLD_RUMOR_SERVICE.maintenanceIssues(next,required);}
    class WorldStateIntegrityPolicy {
        constructor(patchPolicy,timePolicy,rumor){
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;
            this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;
        }

        validate(stat) {
            const state=stat.世界[PATH];
            for(const [category,template] of Object.entries(RECORDS)){
                if(!plain(state[category])||Object.keys(state[category]).length>300)throw new Error(category+'记录过多或结构错误');
                for(const [name,value] of Object.entries(state[category])){
                    if(forbidden.has(name))throw new Error('非法记录名');
                    this.patchPolicy.checkRecord(value,template,DETAILS[category]);
                    this.patchPolicy.checkDetails(value,DETAILS[category]);
                }
            }
            for(const [name,event] of Object.entries(state.事件)){
                if(!['待发生','进行中','已完成','已取消'].includes(event.状态))throw new Error('非法事件状态：'+name+' = '+String(event.状态||'空')+'；只允许 待发生/进行中/已完成/已取消');
                if(!EVENT_CATEGORIES.has(event.分类))throw new Error('非法事件分类：'+name+' = '+String(event.分类||'空'));
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(state.事件,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
            const calendar=plain(stat.世界?.历法)?stat.世界.历法:{};
            const monthDays=Array.isArray(calendar.月份天数)?calendar.月份天数:[];
            if(monthDays.length>24||monthDays.some(n=>!Number.isInteger(Number(n))||Number(n)<1||Number(n)>99))throw new Error('世界历法月份天数无效');
            const hasMonthDay=value=>/\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日/.test(String(value||''));
            if(monthDays.length&&hasMonthDay(stat.世界.时间)&&!this.timePolicy.calendarDate(stat.世界.时间,calendar))throw new Error('世界时间违反历法月长：'+stat.世界.时间);
            if(monthDays.length){
                for(const [name,event] of Object.entries(state.事件)){
                    for(const value of [event.时间,event.开始时间,event.结束时间]){
                        if(hasMonthDay(value)&&!this.timePolicy.calendarDate(value,calendar))throw new Error('事件日期违反世界历法：'+name+' = '+value);
                    }
                }
            }
            const range=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
            for(const [name,item] of Object.entries(stat.世界.势力||{}))if(!QUALITY_RANKS.includes(item.实力)||!range(item.声望,-5000,10000))throw new Error('势力品质或声望越界：'+name+'，实力='+String(item.实力)+'，声望='+String(item.声望)+'；实力只允许 '+QUALITY_RANKS.join('/')+'，声望范围 -5000~10000');
            for(const [name,item] of Object.entries(stat.世界.探索||{}))if(!QUALITY_RANKS.includes(item.风险)||!range(item.探索度,0,100))throw new Error('探索品质或进度越界：'+name+'，风险='+String(item.风险)+'，探索度='+String(item.探索度)+'；风险只允许 '+QUALITY_RANKS.join('/')+'，探索度范围 0~100');
            for(const item of Object.values((stat.世界.因果轨道||{}).偏移记录||{}))if(!range(item.影响程度,-100,120))throw new Error('因果偏移越界');
            for(const item of Object.values(stat.关系列表||{}))if(!range(item.好感度,-100,100))throw new Error('人物好感越界');
            for(const item of Object.values((stat.任务||{}).列表||{}))if(!['进行中','可交付','可结算','失败'].includes(item.状态))throw new Error('任务状态无效');
            for(const item of Object.values((stat.任务||{}).副本成就||{}))if(!['未达成','已达成'].includes(item.状态))throw new Error('成就状态无效');
            this.rumor.validatePublicState(stat);

            const visiting=new Set(),visited=new Set();
            const visit=name=>{
                if(visiting.has(name))throw new Error('事件前因形成循环');
                if(visited.has(name))return;
                visiting.add(name);
                state.事件[name].前因.forEach(visit);
                visiting.delete(name);
                visited.add(name);
            };
            Object.keys(state.事件).forEach(visit);
            for(const category of ['人物','势力地区','传播']){
                for(const record of Object.values(state[category]))if(record.关联事件.some(id=>!Object.hasOwn(state.事件,id)))throw new Error('关联事件不存在');
            }
        }
    }

    const DEFAULT_WORLD_STATE_INTEGRITY_POLICY=new WorldStateIntegrityPolicy(DEFAULT_WORLD_PATCH_POLICY,DEFAULT_WORLD_TIME_POLICY,DEFAULT_WORLD_RUMOR_SERVICE);
    class WorldPatchApplicationService {
        constructor(patchPolicy,stateNormalizer,timeline,stateIntegrity,relationSync,rumor){
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.stateNormalizer=stateNormalizer||DEFAULT_WORLD_STATE_NORMALIZER;
            this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;
            this.stateIntegrity=stateIntegrity||DEFAULT_WORLD_STATE_INTEGRITY_POLICY;
            this.relationSync=relationSync||DEFAULT_WORLD_RELATION_SYNC_POLICY;
            this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;
        }

        apply(stat,patches) {
            if(!Array.isArray(patches)||patches.length>100)throw new Error('每轮最多 100 条补丁');
            const next=copy(stat);
            next.世界[PATH]=Object.assign(emptyState(),next.世界[PATH]||{});
            this.stateNormalizer.normalizeBackendState(next);

            for(const patch of patches){
                if(!plain(patch)||!['add','replace','remove'].includes(patch.op))throw new Error('不支持的补丁操作');
                const parts=this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(patch.path),next);
                patch.path=this.patchPolicy.pointer(parts);
                if(!this.patchPolicy.allowed(parts,next,patch.op))throw new Error('禁止写入：'+patch.path);
                this.patchPolicy.bootstrapBackendParent(next,parts);
                const old=this.patchPolicy.get(next,parts);

                if(parts[1]===PATH&&parts[2]==='历史'&&(patch.op!=='add'||old!==undefined))throw new Error('历史只允许新增');
                if(patch.op!=='add'&&old===undefined&&!this.patchPolicy.canUpsertMissing(parts,next))throw new Error('目标不存在：'+patch.path);
                if(patch.op==='remove'&&!this.patchPolicy.removable(parts))throw new Error('仅可移除过期传播、传闻、已彻底消失的资产与程序确认的因果脏记录，其他记录使用状态结束');

                let value=patch.value;
                if(patch.op!=='remove'){
                    if(value===undefined)throw new Error('缺少补丁值');
                    const category=parts.length===3?parts[1]:parts.length===4?parts[2]:'';
                    if(parts[0]==='世界'&&parts[1]===PATH&&parts.length===4&&Object.hasOwn(RECORDS,category)){
                        value=this.patchPolicy.normalizeBackendRecord(category,value,old);
                        this.patchPolicy.checkRecord(value,RECORDS[category],DETAILS[category]);
                        this.patchPolicy.checkDetails(value,DETAILS[category]);
                    }else if(EXISTING[category]){
                        const schema=EXISTING[category];
                        if(plain(value)){
                            const merged=Object.assign(copy(schema),plain(old)?copy(old):{});
                            for(const key of Object.keys(schema))if(Object.hasOwn(value,key))merged[key]=copy(value[key]);
                            value=merged;
                        }
                        this.patchPolicy.checkRecord(value,schema);
                        if(parts[0]==='传闻'&&parts[1]==='情报交易'&&!(next.系统状态||{}).是否在主神空间&&next.世界?.名称!=='主神空间'&&/空间币/.test(String(value.要价||'')))throw new Error('任务世界情报交易必须使用本地货币，不能使用空间币');
                    }else if(old!==undefined&&(typeof old!==typeof value||Array.isArray(old)!==Array.isArray(value))){
                        throw new Error('字段类型发生改变');
                    }

                    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('数值无效');
                    if(parts[0]==='世界'&&parts[1]==='因果轨道'&&parts.length===3&&typeof value!=='string')throw new Error('因果摘要必须是文本');
                    if(parts[0]==='任务'&&parts[1]==='副本成就'&&old==='已达成'&&value!==old)throw new Error('不能回退已达成成就');
                    if(parts[0]==='关系列表'&&parts.length===3)this.relationSync.validateRelationSyncValue(parts[2],value,next.关系列表?.[parts[1]],parts[1]);
                    if(parts[parts.length-1]==='好感度'&&Math.abs(value-old)>20)throw new Error('单轮好感变动超过20');
                }

                let parent=next;
                for(const key of parts.slice(0,-1)){
                    if(parent[key]===undefined)parent[key]={};
                    if(!plain(parent[key]))throw new Error('父路径不是对象');
                    parent=parent[key];
                }
                if(patch.op==='remove')delete parent[parts.at(-1)];
                else parent[parts.at(-1)]=copy(value);
            }

            this.stateNormalizer.normalizeBackendState(next);
            this.stateNormalizer.normalizeEventLayers(next);
            this.timeline.validateTemporalWrites(stat,next,patches);
            this.stateIntegrity.validate(next);
            for(const [name,item] of Object.entries(next.世界.势力||{})){
                const old=(stat.世界.势力||{})[name];
                if(Math.abs(item.声望-(old?old.声望:0))>1000)throw new Error('单轮声望变动超过1000');
            }
            return this.rumor.finishPatches(next,patches);
        }
    }

    const DEFAULT_WORLD_PATCH_APPLICATION_SERVICE=new WorldPatchApplicationService(
        DEFAULT_WORLD_PATCH_POLICY,
        DEFAULT_WORLD_STATE_NORMALIZER,
        DEFAULT_WORLD_TIMELINE_POLICY,
        DEFAULT_WORLD_STATE_INTEGRITY_POLICY,
        DEFAULT_WORLD_RELATION_SYNC_POLICY,
        DEFAULT_WORLD_RUMOR_SERVICE
    );
    class WorldStateMaterializationService {
        constructor(stateFactory,stateNormalizer,lifecycle,patchPolicy,patchApplication,exploration,causal,stateIntegrity){
            this.stateFactory=stateFactory||DEFAULT_WORLD_STATE_FACTORY;
            this.stateNormalizer=stateNormalizer||DEFAULT_WORLD_STATE_NORMALIZER;
            this.lifecycle=lifecycle||DEFAULT_WORLD_LIFECYCLE_SERVICE;
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.patchApplication=patchApplication||DEFAULT_WORLD_PATCH_APPLICATION_SERVICE;
            this.exploration=exploration||DEFAULT_WORLD_EXPLORATION_SERVICE;
            this.causal=causal||DEFAULT_WORLD_CAUSAL_SERVICE;
            this.stateIntegrity=stateIntegrity||DEFAULT_WORLD_STATE_INTEGRITY_POLICY;
        }
        validate(stat){return this.stateIntegrity.validate(stat);}
        apply(stat,patches){return this.patchApplication.apply(stat,patches);}
        materialize(stat,seedPatches,modelPatches) {
            const work=copy(stat);
            work.世界[PATH]=Object.assign(this.stateFactory.emptyBackend(),work.世界[PATH]||{});
            this.stateNormalizer.normalizeBackendState(work);
            this.lifecycle.compact(work);
            const appliedSeeds=(seedPatches||[]).filter(p=>this.patchPolicy.get(work,this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(p.path),work))===undefined);
            let next=this.apply(work,appliedSeeds);
            next=this.apply(next,modelPatches||[]);
            const explorationPatches=this.exploration.repairGranularity(next);
            const layerPatches=this.stateNormalizer.normalizeEventLayers(next);
            const causalPatches=this.causal.repairProjection(next);
            const predecessorPatches=this.stateNormalizer.repairMacroPredecessors(next);
            const linkPatches=this.stateNormalizer.repairExplicitEventLinks(next);
            this.lifecycle.compact(next);
            this.validate(next);
            const repairPatches=[...explorationPatches,...layerPatches,...causalPatches,...predecessorPatches,...linkPatches];
            return {next,appliedSeeds,repairPatches};
        }
    }
    const DEFAULT_WORLD_STATE_MATERIALIZATION_SERVICE=new WorldStateMaterializationService(
        DEFAULT_WORLD_STATE_FACTORY,
        DEFAULT_WORLD_STATE_NORMALIZER,
        DEFAULT_WORLD_LIFECYCLE_SERVICE,
        DEFAULT_WORLD_PATCH_POLICY,
        DEFAULT_WORLD_PATCH_APPLICATION_SERVICE,
        DEFAULT_WORLD_EXPLORATION_SERVICE,
        DEFAULT_WORLD_CAUSAL_SERVICE,
        DEFAULT_WORLD_STATE_INTEGRITY_POLICY
    );
    class WorldResultMaterializer {
        constructor(patchCompilation,stateMaterialization){this.patchCompilation=patchCompilation||DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE;this.stateMaterialization=stateMaterialization||DEFAULT_WORLD_STATE_MATERIALIZATION_SERVICE;}
        compileWorldResult(stat,value) { return this.patchCompilation.compile(stat,value); }

        validateBaseState(stat) { return this.stateMaterialization.validate(stat); }
        applyPatches(stat,patches) { return this.stateMaterialization.apply(stat,patches); }
        materializeWorldUpdate(stat,seedPatches,modelPatches) { return this.stateMaterialization.materialize(stat,seedPatches,modelPatches); }
    }
    const DEFAULT_WORLD_RESULT_MATERIALIZER=new WorldResultMaterializer(DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE,DEFAULT_WORLD_STATE_MATERIALIZATION_SERVICE);
    let ACTIVE_WORLD_RESULT_MATERIALIZER=DEFAULT_WORLD_RESULT_MATERIALIZER;
    function compileWorldResult(stat,value){return ACTIVE_WORLD_RESULT_MATERIALIZER.compileWorldResult(stat,value);}
    function validateState(stat){return ACTIVE_WORLD_RESULT_MATERIALIZER.validateBaseState(stat);}
    function applyPatches(stat,patches){return ACTIVE_WORLD_RESULT_MATERIALIZER.applyPatches(stat,patches);}
    function materializeWorldUpdate(stat,seedPatches,modelPatches){return ACTIVE_WORLD_RESULT_MATERIALIZER.materializeWorldUpdate(stat,seedPatches,modelPatches);}
    const WORLD_RETRY_GUIDANCE_DEFAULTS=Object.freeze({
        retryGuideMacroBackbone:'宏观骨架：当前可推进宏观节点{current}个（进行中{active}、待发生{future}），还需补充至少{missing}个真正的宏观节点；已确认正在发生的阶段转折可记进行中，其余新增节点记待发生。会合、撤离、赶路、局部争夺/突破等近期节点不计入宏观骨架，不要反复把它们改标为宏观节点。',
        retryGuideEventDelivery:'事件交付：在 WorldResult.事件 中实际建立节点，分类=宏观节点；描述说明篇章、地区整体局势、战争、势力格局或关键人物命运的一个阶段转折，不能只在摘要或因果轨道里列名字。已有合格节点沿用原名，只提交缺失或变化字段。',
        retryGuideMacroSchedule:'宏观排期：每个新增节点必须给出明确时间锚点；沿用明确资料的日期或时间精度，精确日期未知时使用可理解的相对/因果时间，不写近期/稍后/未来/待定/未知。条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。',
        retryGuideCausalProjection:'因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的不同事件名称，不要写当前阶段、当前事件或近期节点。',
        retryGuideCausalProjectionRepair:'因果轨道：不要重写已接受事件，只补写 因果.宏观顺序；长度必须3~5，且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。',
        retryGuideDueEvent:'到期事件/{name}：本轮必须明确启动该事件，或更新本轮复核日期、阻碍条件与下次检查。',
        retryGuideEventTime:'事件/{name}：补写明确时间锚点；优先具体世界日期/时段，精确日期未知时写相对或因果时间，禁止空值和“近期/稍后/未来/待定/未知”。',
        retryGuideStaleEvent:'事件/{name}：该局部活动已远超正常持续窗口。若实际早已结束则改为已完成并补结果；若失效则已取消；只有确实仍持续时才保留进行中，并把更新时间写为当前世界时间、更新当前描述并填写下次检查。',
        retryGuideTemporalRepair:'时间一致性：修复这些已经发生的记录，任何已完成/进行中事件、人物更新时间、地区已发生变化、历史与传播都不得晚于当前世界时间：{details}',
        retryGuideAlienActivity:'异端活动/{name}：仅对本轮触发复核的该活跃异端补写地点、目标、行动；人物更新时间由程序使用世界时间统一记录；若本轮已确认死亡，则只更新异端状态=死亡，不再提交人物活动。',
        retryGuideNpcAudit:'NPC构筑审计/{name}：只在 WorldResult.关系 中补齐该既有NPC至少一个列出的构筑缺口；优先补职业/血统/装备/技能/状态/形态或缺失档案字段，不得新建NPC、改HP_MAX/EP_MAX或输出真属性/最终属性。',
        retryGuideChronology:'宏观时间轴：只处理已明确到日的原著/数据库日期冲突。若该节点仍成立，沿用明确日期；若已确认因果偏移改变了其日期、成立条件或是否发生，则补齐明确关联该节点的偏移记录并只重构受影响节点。月份、时段、顺序、条件与趋势继续按软约束保守留白，不要为了回归原著强行修正剧情。',
        retryGuidePredecessor:'事件前因：先修复链首缺失或自引用，再重新提交受影响的后继节点。前因数组只放事件名称，且须已存在或同轮成功建立；当前阶段/自然语言原因不算事件，无明确前因写 []。不得为消除报错凭空补造事件。',
        retryGuideSchemaMismatch:'Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。',
        retryGuideRumorEmpty:'传闻维护：{details}。空分类本轮补2条真实世界信息；三类各自展示最近3条，约60字/条，不要无依据围绕<user>。',
        retryGuidePropagationReview:'传播维护：{details}。逐条更新到当前世界时间，并推进范围/受众/内容/引发行动；若传播已结束则结束或移除，不要原样重交。',
        retryGuideTemporalIntegrity:'时间一致性：事件/地区/历史/传播只把“跨到未来自然日”视为硬越界，同日不同上午/下午/HH:mm无需回写；人物只有双方均明确 HH:mm 时才做分钟级校验。未来计划放预计结束、下次检查或待发生事件。',
        retryGuideWorldActivity:'世界活动：先推进非异端世界，再复核异端。至少提交一项进行中事件、势力/地区或普通人物的实质变化；只改更新时间、复述原值或新增未来宏观节点不算。',
        retryGuideWorldScene:'世界现场：若地区为空，建立与当前地点/阶段直接相关的地区。势力为空时可优先补一个当前真正参与局势的真实势力/组织，并同名提交 WorldResult.势力 与 WorldResult.势力地区(类型=势力)；势力属于软目标，若资料不足或势力片段因声望/Schema等规则被拒，不要为补档案反复重交或编造组织。',
        retryGuideCurrentReality:'当前现实：若没有进行中的当前事件/近期节点，从当前阶段与最新正文提炼一个“已经正在发生”的现实局势；不要把未来宏观节点提前结算。'
    });

    class WorldRetryGuidanceService {
        constructor(engine=null){this.engine=engine;}

        template(key) {
            const configured=this.engine?.services?.prompts?.value?.(key);
            if(typeof configured==='string')return configured;
            return String(WORLD_RETRY_GUIDANCE_DEFAULTS[key]??'');
        }

        format(key,vars={}) {
            let text=this.template(key);
            for(const [name,value] of Object.entries(vars||{}))text=text.split('{'+name+'}').join(String(value??''));
            return text;
        }

        macroBackbonePlan(current,active,future) {
            const missing=Math.max(0,3-current);
            return [
                this.format('retryGuideMacroBackbone',{current,active,future,missing}),
                this.format('retryGuideEventDelivery'),
                this.format('retryGuideMacroSchedule'),
                this.format('retryGuideCausalProjection')
            ].filter(Boolean);
        }

        plan(error,rejected=[]) {
            const plan=[];
            for(const item of rejected||[])plan.push(String(item?.片段||'')+'：'+String(item?.原因||''));
            const primary=String(error?.message||error||'');
            const combined=[primary,...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
            let match=primary.match(/宏观事件不足：需要至少3个可推进宏观节点（进行中\+待发生），当前仅(\d+)个（进行中(\d+)个，待发生(\d+)个）/);
            if(match){
                const current=Math.max(0,Number(match[1])||0),active=Math.max(0,Number(match[2])||0),future=Math.max(0,Number(match[3])||0);
                plan.push(...this.macroBackbonePlan(current,active,future));
            }else if(/因果轨道未形成有效宏观投影/.test(primary)){
                plan.push(this.format('retryGuideCausalProjectionRepair'));
            }else if((match=primary.match(/到期事件未处理：([^。]+)/))){
                plan.push(this.format('retryGuideDueEvent',{name:match[1]}));
            }else if((match=primary.match(/事件时间锚点缺失或过于模糊：([^；]+)/))){
                plan.push(this.format('retryGuideEventTime',{name:match[1]}));
            }else if((match=primary.match(/事件时间锚点仍未补全：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideEventTime',{name}));
            }else if((match=primary.match(/超期活动事件仍未复核：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideStaleEvent',{name}));
            }else if((match=primary.match(/时间越界记录仍未修复：([^；]+)/))){
                plan.push(this.format('retryGuideTemporalRepair',{details:match[1]}));
            }else if((match=primary.match(/异端活动未复核：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideAlienActivity',{name}));
            }else if((match=primary.match(/NPC构筑审计未推进：([^；]+)/))){
                for(const name of match[1].split('、').filter(Boolean))plan.push(this.format('retryGuideNpcAudit',{name}));
            }else if(primary&&!rejected.length){
                plan.push('整体校验：'+primary);
            }

            if(/宏观节点日期(?:未服从|与).*原著\/数据库时间锚点/.test(combined))plan.unshift(this.format('retryGuideChronology'));
            if(/事件前因(?:不存在|非法自引用)/.test(combined))plan.push(this.format('retryGuidePredecessor'));
            if(/字段未通过完整 Schema 校验/.test(combined))plan.push(this.format('retryGuideSchemaMismatch'));
            if((match=combined.match(/传闻为空未补足：([^；\n]+)/)))plan.push(this.format('retryGuideRumorEmpty',{details:match[1]}));
            if((match=combined.match(/传播链仍未复核：([^；\n]+)/)))plan.push(this.format('retryGuidePropagationReview',{details:match[1]}));
            if(/时间事实超过当前世界时间|时间越界记录仍未修复/.test(combined))plan.unshift(this.format('retryGuideTemporalIntegrity'));
            if(/世界活动不足：/.test(primary))plan.unshift(
                this.format('retryGuideWorldActivity'),
                this.format('retryGuideWorldScene'),
                this.format('retryGuideCurrentReality')
            );
            return Array.from(new Set(plan.filter(Boolean)));
        }
    }

    const DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE=new WorldRetryGuidanceService();
    class WorldResultStagingService {
        constructor(normalizer,materializer,chronology,retryGuidance,rumor){
            this.normalizer=normalizer||DEFAULT_WORLD_RESULT_NORMALIZER;
            this.materializer=materializer||DEFAULT_WORLD_RESULT_MATERIALIZER;
            this.rumor=rumor||this.materializer.rumor||DEFAULT_WORLD_RUMOR_SERVICE;
            this.chronology=chronology||DEFAULT_WORLD_CHRONOLOGY_POLICY;
            this.retryGuidance=retryGuidance||DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE;
        }

        // Result normalization, merge, fragment splitting, compilation and retry planning are canonical class calls.

        worldResultFragments(value) {
            const rawRumors=plain(value?.传闻)?value.传闻:{},rawRumorErrors={};
            for(const source of Array.isArray(rawRumors.街头巷议)?rawRumors.街头巷议:[]){
                if(!plain(source)||source.操作==='移除'||source.操作==='撤销本轮'||!Object.hasOwn(source,'可信度'))continue;
                try{this.normalizer.assertRumorCredibility(source.可信度);}
                catch(error){rawRumorErrors.街头巷议=error;break;}
            }
            const result=this.normalizer.normalizeWorldResult(value),fragments=[];
            const push=(label,body,error=null)=>fragments.push({label,result:Object.assign({摘要:''},body),error});
            if(Object.hasOwn(result,'时间'))push('时间',{时间:result.时间});
            for(const [key,value] of Object.entries(result.货币||{}))push('货币/'+key,{货币:{[key]:copy(value)}});
            for(const [key,value] of Object.entries(result.历法||{}))push('历法/'+key,{历法:{[key]:copy(value)}});
            for(const key of ['事件','人物','势力地区','历史','传播','势力','探索','资产','异端']){
                for(const item of result[key]||[])push(key+'/'+item.名称,{[key]:[copy(item)]});
            }
            if(Object.hasOwn(result.因果||{},'当前阶段'))push('因果/当前阶段',{因果:{当前阶段:result.因果.当前阶段}});
            if(Array.isArray(result.因果?.宏观顺序)&&result.因果.宏观顺序.length)push('因果/宏观顺序',{因果:{宏观顺序:copy(result.因果.宏观顺序)}});
            for(const item of result.因果?.偏移记录||[])push('因果/偏移记录/'+item.名称,{因果:{偏移记录:[copy(item)]}});
            // 容量约束针对最终分类；新增与移除必须一起验收，不能拆散换新操作。
            for(const key of WORLD_RESULT_RUMORS)if(result.传闻?.[key]?.length)push('传闻/'+key,{传闻:{[key]:copy(result.传闻[key])}},rawRumorErrors[key]||null);
            for(const item of result.关系||[])push('关系/'+item.名称,{关系:[copy(item)]});
            return {摘要:result.摘要,fragments};
        }

        shortSchemaValue(value) {
            if(value===undefined)return 'undefined';
            let raw;try{raw=JSON.stringify(value);}catch(_){raw=String(value);}
            if(raw===undefined)raw=String(value);
            return raw.length>140?raw.slice(0,137)+'…':raw;
        }

        firstSchemaDifference(before,after,parts) {
            if(same(before,after))return null;
            if(plain(before)&&plain(after)){
                const keys=Array.from(new Set([...Object.keys(before),...Object.keys(after)]));
                for(const key of keys){
                    const diff=this.firstSchemaDifference(before[key],after[key],parts.concat(key));
                    if(diff)return diff;
                }
            }
            if(Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
                for(let i=0;i<before.length;i++){
                    const diff=this.firstSchemaDifference(before[i],after[i],parts.concat(String(i)));
                    if(diff)return diff;
                }
            }
            return {parts,before,after};
        }

        schemaMismatchError(beforeState,afterState,patchPath) {
            const parts=tokens(patchPath),before=get(beforeState,parts),after=get(afterState,parts);
            const diff=this.firstSchemaDifference(before,after,parts)||{parts,before,after};
            return new Error('字段未通过完整 Schema 校验：'+pointer(diff.parts)+'（'+this.shortSchemaValue(diff.before)+' → '+this.shortSchemaValue(diff.after)+'）');
        }

        stage(stat,accepted,incoming,validate) {
            const split=this.worldResultFragments(incoming);
            let staged=accepted?this.normalizer.mergeWorldResults(accepted,{摘要:split.摘要}):this.normalizer.normalizeWorldResult({摘要:split.摘要});
            let pending=split.fragments.map(unit=>Object.assign({},unit,{error:unit.error||null})),progress=true;
            while(pending.length&&progress){
                progress=false;
                const nextPending=[];
                for(const unit of pending){
                    if(unit.error){nextPending.push(unit);continue;}
                    const candidate=this.normalizer.mergeWorldResults(staged,unit.result);
                    try{
                        const compiled=this.materializer.compileWorldResult(stat,candidate);
                        const built=this.materializer.materializeWorldUpdate(stat,[],compiled.patches);
                        if(typeof validate==='function'){
                            const checked=validate(built.next);
                            for(const patch of compiled.patches){
                                if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(built.next,tokens(patch.path))))throw this.schemaMismatchError(built.next,checked,patch.path);
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
                ...this.rumor.classifyFailures(pending.map(unit=>({片段:unit.label,原因:String(unit.error?.message||unit.error||'业务片段未通过校验')})))
            };
        }
        // 首次请求与纠错共用同一份交付标准，避免模型失败后才知道宏观骨架的硬要求。

        macroBackbonePlan(current,active,future) {
            return this.retryGuidance.macroBackbonePlan(current,active,future);
        }

        retryPlanForFailure(error,rejected=[]) {
            return this.retryGuidance.plan(error,rejected);
        }

        // UI 和模型请求共用去重视图；原始分片仍保留在日志，未知错误不截断。

        retryFeedback(error,rejected=[],plans=[]) {
            const message=String(error?.message||error||'');
            const summary=rejected?.length?message.split('\n\n具体原因\n')[0]:message;
            const compactReason=value=>{
                const reason=String(value||'');
                return /^事件前因(?:不存在|非法自引用)：/.test(reason)?reason.split('；')[0]:reason;
            };
            const rawIssues=(rejected||[]).map(item=>String(item.片段||'')+'：'+String(item.原因||''));
            const issues=Array.from(new Set((rejected||[]).map(item=>{
                const reason=compactReason(item.原因);
                return /^事件前因(?:不存在|非法自引用)：/.test(reason)?reason:String(item.片段||'')+'：'+reason;
            })));
            const redundant=new Set([...rawIssues,...issues,summary,'整体校验：'+summary,'整体校验：'+message]);
            const actions=Array.from(new Set((plans||[]).filter(Boolean).map(String))).filter(line=>!redundant.has(line));
            return {summary,issues,actions};
        }

        makeRetryFailure(rejected,globalError) {
            const reasons=[];
            if(rejected?.length)reasons.push('部分业务片段未通过（'+rejected.length+'项）');
            if(globalError)reasons.push(String(globalError.message||globalError));
            const error=new Error(reasons.join('；')||'WorldResult 未通过业务校验');
            error.retryPlan=this.retryPlanForFailure(globalError,rejected);
            error.rejectedSlices=copy(rejected||[]);
            const feedback=this.retryFeedback(error,rejected,error.retryPlan);
            error.retryPlan=feedback.actions;
            if(feedback.issues.length)error.message=feedback.summary+'\n\n具体原因\n'+feedback.issues.join('\n');
            return error;
        }
    }
    const DEFAULT_WORLD_RESULT_STAGING=new WorldResultStagingService(DEFAULT_WORLD_RESULT_NORMALIZER,DEFAULT_WORLD_RESULT_MATERIALIZER,DEFAULT_WORLD_CHRONOLOGY_POLICY,DEFAULT_WORLD_RETRY_GUIDANCE_SERVICE);
    let ACTIVE_WORLD_RESULT_STAGING=DEFAULT_WORLD_RESULT_STAGING;
    function worldResultFragments(value){return ACTIVE_WORLD_RESULT_STAGING.worldResultFragments(value);}
    function stageWorldResult(stat,accepted,incoming,validate){return ACTIVE_WORLD_RESULT_STAGING.stage(stat,accepted,incoming,validate);}
    function macroBackbonePlan(current,active,future){return ACTIVE_WORLD_RESULT_STAGING.macroBackbonePlan(current,active,future);}
    function retryPlanForFailure(error,rejected=[]){return ACTIVE_WORLD_RESULT_STAGING.retryPlanForFailure(error,rejected);}
    function retryFeedback(error,rejected=[],plans=[]){return ACTIVE_WORLD_RESULT_STAGING.retryFeedback(error,rejected,plans);}
    function makeRetryFailure(rejected,globalError){return ACTIVE_WORLD_RESULT_STAGING.makeRetryFailure(rejected,globalError);}
    class WorldResultReplyParser {
        firstCompleteJsonObject(source) {
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
        parse(text) {
            let source=String(text).trim();
            const block=source.match(/<world_update\s*>([\s\S]*?)<\/world_update>/i);
            if(block)source=block[1].trim();
            const fence=source.match(/\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/i);
            if(fence)source=fence[1].trim();
            let result;
            try {result=JSON.parse(source);}
            catch(error){
                const candidate=this.firstCompleteJsonObject(source);
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
    }
    const DEFAULT_WORLD_RESULT_REPLY_PARSER=new WorldResultReplyParser();
    let ACTIVE_WORLD_RESULT_REPLY_PARSER=DEFAULT_WORLD_RESULT_REPLY_PARSER;
    function parseReply(text){return ACTIVE_WORLD_RESULT_REPLY_PARSER.parse(text);}
    class WorldValidationPolicy {
        constructor(timeline,duePolicy,activityPolicy,softMaintenancePolicy){this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;this.duePolicy=duePolicy||DEFAULT_WORLD_DUE_EVENT_POLICY;this.activityPolicy=activityPolicy||DEFAULT_WORLD_ACTIVITY_POLICY;this.softMaintenancePolicy=softMaintenancePolicy||DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY;}
        ensureDueHandled(next,dueList,worldTime) { return this.duePolicy.ensureHandled(next,dueList,worldTime); }

        unscheduledEvents(stat) { return this.softMaintenancePolicy.unscheduledEvents(stat); }

        ensureEventTimeAnchors(next,required=[]) { return this.softMaintenancePolicy.ensureEventTimeAnchors(next,required); }

        ensureStaleActiveHandled(next,required=[],worldTime='') {
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

        ensureTemporalAnomaliesResolved(next,required=[]) {
            if(!(required||[]).length)return;
            // Validation must observe runtime decorators applied to temporalAnomalies.
            const remaining=temporalAnomalies(next);
            const keys=new Set((required||[]).map(item=>item.类型+'\u0000'+item.名称));
            const bad=remaining.filter(item=>keys.has(item.类型+'\u0000'+item.名称));
            if(bad.length)throw new Error('时间越界记录仍未修复：'+bad.map(item=>item.类型+'/'+item.名称+'('+item.字段+'='+item.值+')').join('、'));
        }

        ensureMacroBackbone(next,timeline,required=true) {
            if(required&&timeline?.需要补充远期){
                const allMacro=Object.entries(next?.世界?.[PATH]?.事件||{}).filter(([,e])=>e.分类==='宏观节点'&&e.状态!=='已取消');
                const activeMacro=allMacro.filter(([,e])=>e.状态==='进行中');
                const futureMacro=allMacro.filter(([,e])=>e.状态==='待发生');
                const openMacro=allMacro.filter(([,e])=>['进行中','待发生'].includes(e.状态));
                if(openMacro.length<3)throw new Error('宏观事件不足：需要至少3个可推进宏观节点（进行中+待发生），当前仅'+openMacro.length+'个（进行中'+activeMacro.length+'个，待发生'+futureMacro.length+'个）');
                const stages=this.timeline.storyStages(next?.世界?.因果轨道?.故事线);
                const names=new Set(allMacro.map(([name])=>name));
                if(stages.length<3||stages.length>5||stages.some(name=>!names.has(name)))throw new Error('因果轨道未形成有效宏观投影：请用已建立的宏观节点生成3~5节点故事线');
            }
            return this.activityPolicy.ensureDelivery(next,timeline?.世界活动要求);
        }

        progressionAnchorChanged(before,after) {
            return before?.世界?.名称!==after?.世界?.名称||before?.世界?.时间!==after?.世界?.时间||!!before?.系统状态?.是否在主神空间!==!!after?.系统状态?.是否在主神空间;
        }
    }
    const DEFAULT_WORLD_VALIDATION_POLICY=new WorldValidationPolicy(DEFAULT_WORLD_TIMELINE_POLICY,DEFAULT_WORLD_DUE_EVENT_POLICY,DEFAULT_WORLD_ACTIVITY_POLICY,DEFAULT_WORLD_SOFT_MAINTENANCE_POLICY);
    let ACTIVE_WORLD_VALIDATION_POLICY=DEFAULT_WORLD_VALIDATION_POLICY;
    function ensureDueHandled(next,dueList,worldTime){return ACTIVE_WORLD_VALIDATION_POLICY.ensureDueHandled(next,dueList,worldTime);}
    function unscheduledEvents(stat){return ACTIVE_WORLD_VALIDATION_POLICY.unscheduledEvents(stat);}
    function ensureEventTimeAnchors(next,required=[]){return ACTIVE_WORLD_VALIDATION_POLICY.ensureEventTimeAnchors(next,required);}
    function ensureStaleActiveHandled(next,required=[],worldTime=''){return ACTIVE_WORLD_VALIDATION_POLICY.ensureStaleActiveHandled(next,required,worldTime);}
    function ensureTemporalAnomaliesResolved(next,required=[]){return ACTIVE_WORLD_VALIDATION_POLICY.ensureTemporalAnomaliesResolved(next,required);}
    function ensureMacroBackbone(next,timeline,required=true){return ACTIVE_WORLD_VALIDATION_POLICY.ensureMacroBackbone(next,timeline,required);}
    function progressionAnchorChanged(before,after){return ACTIVE_WORLD_VALIDATION_POLICY.progressionAnchorChanged(before,after);}
    // 世界引擎基础样式资源：保持视觉不变，只把大块 CSS 从 UI 类方法中移出。
    function worldEngineBaseStyleText() {
        let css = [
                '#sam-world-engine .we-event-tasks{margin:14px 0;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--we-surface,transparent)}#sam-world-engine .we-event-task{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}#sam-world-engine .we-event-task summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none}#sam-world-engine .we-event-task summary:before{content:"▸";color:var(--sub)}#sam-world-engine .we-event-task[open] summary:before{content:"▾"}#sam-world-engine .we-task-name{flex:1;min-width:0;overflow-wrap:anywhere;font-weight:600}#sam-world-engine .we-event-task summary .we-pill{flex-shrink:0}#sam-world-engine .we-event-task p{overflow-wrap:anywhere}',
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
        css += `
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
                #sam-world-engine .we-world-laws{margin:0;line-height:1.6}
                #sam-world-engine .we-world-laws article+article{padding-top:8px;margin-top:8px}
                #sam-world-engine .we-world-laws p{margin:0;font-size:13px;line-height:1.6}
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
                @media(max-height:420px){#sam-world-engine .we-preset-toolbar{position:static}}
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
                #sam-world-engine .we-segment>.we-muted{margin:0;padding:9px 12px 11px;min-width:0;overflow-wrap:anywhere}
                #sam-world-engine .we-prompt-registry-meta{display:flex;flex-wrap:wrap;gap:4px 14px;min-width:0;padding:0 12px 10px}
                #sam-world-engine .we-prompt-registry-meta small{min-width:0;overflow-wrap:anywhere}
                #sam-world-engine .we-prompt-registry-item>.we-notice{margin:0 12px 10px}
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
                #sam-world-engine[data-tone] .we-explore-score strong,
                #sam-world-engine[data-tone] .we-area-progress>strong{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] .we-kpi small,
                #sam-world-engine[data-tone] .we-kpi span,
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
                #sam-world-engine .we-manual-advance-mask{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:24px;background:#08111bcc;backdrop-filter:blur(5px)}
                #sam-world-engine .we-manual-advance-dialog{width:min(620px,100%);max-height:min(78vh,720px);overflow:auto;padding:20px;border:1px solid var(--we-line,var(--line));border-radius:14px;background:var(--we-card,#fffdf8);color:var(--we-ink,var(--ink));box-shadow:0 24px 80px #0008}
                #sam-world-engine .we-manual-advance-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
                #sam-world-engine .we-manual-advance-head b{display:block;font:600 18px/1.35 Georgia,"SimSun",serif}
                #sam-world-engine .we-manual-advance-head small{display:block;margin-top:3px;color:var(--we-sub,var(--sub));font-size:11px}
                #sam-world-engine .we-manual-advance-dialog>p{margin:8px 0 12px;color:var(--we-sub,var(--sub));font-size:12px}
                #sam-world-engine .we-manual-advance-dialog textarea{min-height:150px;max-height:42vh;padding:12px;background:var(--we-input,#121b26);color:var(--we-ink,var(--ink));border:1px solid var(--we-line,var(--line));border-radius:9px;line-height:1.65}
                #sam-world-engine .we-manual-advance-rerun{margin:0 0 12px;padding:10px 12px;border-left:3px solid var(--we-accent,var(--gold));border-radius:7px;background:color-mix(in srgb,var(--we-accent,var(--gold)) 10%,transparent);font-size:12px}
                #sam-world-engine .we-manual-advance-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
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
        return css;
    }
    class WorldHostAdapter {
        constructor(engine){this.engine=engine;}
        resolve(name){
            const engine=this.engine;
            for(const obj of [engine.env,engine.host,engine.host?.TavernHelper]){
                if(obj&&typeof obj[name]==='function')return obj[name].bind(obj);
            }
            return null;
        }
    }
    class WorldEngineConfigService {
        constructor(engine){this.engine=engine;}
        defaults(){
            return {
                enabled:false,
                preset:DEFAULT_PRESET,
                corePrompt:CORE_WORLD_RULES,
                macroPrompt:DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                retryAttempts:5,
                temperature:0.3,
                fallbackModel:'',
                requireMacroBackbone:true,
                presetEditorVersion:0,
                promptDocuments:[],
                fontScale:'standard',
                sendHistoryToProse:false,
                dedicatedApi:{enabled:false,apiUrl:'',apiKey:'',model:'',apiPresets:[],fetchedModels:[]}
            };
        }
        isConfigured(){return !!this.engine.config.enabled;}
        isAvailable(){
            const engine=this.engine;
            if(engine.usesDedicatedApi())return engine.dedicatedApiReady();
            const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
            return !!(terminal&&typeof terminal.apiReady==='function'&&terminal.apiReady());
        }
        isEnabled(){return this.isConfigured()&&this.isAvailable();}
        setEnabled(value){
            const engine=this.engine,on=!!value;
            engine.config.enabled=on;
            if(on&&!engine.usesDedicatedApi()){
                const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            } else if(!on) {
                engine.cancel();
                if(engine.isOpen())engine.close();
            }
            this.save();
            engine.status=on?(this.isAvailable()?'世界推进已开启':(engine.usesDedicatedApi()?'世界推进已开启 · 等待专属 API 配置':'世界推进已开启 · 等待额外模型配置')):'世界推进已关闭';
            engine.render();
            return this.isEnabled();
        }
        save(){
            const engine=this.engine;
            try{engine.host.localStorage?.setItem?.(CONFIG,JSON.stringify(engine.config));}catch(_){}
            return engine.config;
        }
        initialize(){
            const engine=this.engine,config=this.defaults();
            engine.config=config;
            try{Object.assign(config,JSON.parse(engine.host.localStorage.getItem(CONFIG)||'{}'));}catch(_){}
            const hadLegacyTone=Object.hasOwn(config,'tone');
            delete config.tone;
            if(Number(config.presetEditorVersion||0)<2)config.preset=ensurePresetStructure(config.preset);
            else config.preset=normalizeEditablePreset(config.preset);
            config.presetEditorVersion=2;
            if(typeof config.corePrompt!=='string')config.corePrompt=CORE_WORLD_RULES;
            if(typeof config.macroPrompt!=='string')config.macroPrompt=DEFAULT_MACRO_PROMPT;
            if(typeof config.stabilityPromptTemplate!=='string')config.stabilityPromptTemplate=DEFAULT_STABILITY_PROMPT_TEMPLATE;
            if(!Array.isArray(config.promptDocuments))config.promptDocuments=[];
            config.promptDocuments=config.promptDocuments
                .filter(doc=>plain(doc)&&typeof doc.name==='string'&&plain(doc.settings)&&typeof doc.settings.preset==='string'&&doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id&&doc.name!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)
                .slice(0,58);

            if(plain(config.userDefaultPromptSettings)&&typeof config.userDefaultPromptSettings.preset==='string'){
                const source=config.userDefaultPromptSettings;
                const legacySettings={
                    corePrompt:typeof source.corePrompt==='string'?source.corePrompt:CORE_WORLD_RULES,
                    macroPrompt:typeof source.macroPrompt==='string'?source.macroPrompt:DEFAULT_MACRO_PROMPT,
                    stabilityPromptTemplate:typeof source.stabilityPromptTemplate==='string'?source.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                    npcAuditPrompt:typeof source.npcAuditPrompt==='string'?source.npcAuditPrompt:undefined,
                    structurePrompt:typeof source.structurePrompt==='string'?source.structurePrompt:undefined,
                    preset:normalizeEditablePreset(source.preset),
                    contextTurns:Math.max(1,Math.min(100,Number(source.contextTurns)||3)),
                    activationMode:source.activationMode==='force_selected'?'force_selected':'respect_activation',
                    selectedEntries:Array.isArray(source.selectedEntries)?copy(source.selectedEntries):null
                };
                const personal=config.promptDocuments.find(doc=>doc.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                if(!personal)config.promptDocuments.unshift({
                    id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,
                    name:'个人默认设置',createdAt:'',updatedAt:'',settings:copy(legacySettings)
                });
            }

            config.promptDocuments=config.promptDocuments.filter(doc=>doc.id!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id).slice(0,59);
            config.promptDocuments.unshift(copy(BUILTIN_DEFAULT_PROMPT_DOCUMENT));

            const appliedVersion=Number(config.builtinDefaultPromptVersionApplied||0);
            if(appliedVersion<BUILTIN_DEFAULT_PROMPT_VERSION){
                const shouldApply=appliedVersion===0||config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                if(shouldApply){
                    const settings=BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings;
                    config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;
                    config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;
                    config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;
                    config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;
                    config.structurePrompt=settings.structurePrompt===undefined?WORLD_RESULT_CONTRACT.instruction():settings.structurePrompt;
                    config.preset=normalizeEditablePreset(settings.preset);
                    config.presetEditorVersion=2;
                    config.contextTurns=settings.contextTurns;
                    config.activationMode=settings.activationMode;
                    config.selectedEntries=copy(settings.selectedEntries);
                    config.activePromptDocumentId=BUILTIN_DEFAULT_PROMPT_DOCUMENT.id;
                    config.builtinDefaultWorldbookExclusionsApplied=[];
                }
                config.builtinDefaultPromptVersionApplied=BUILTIN_DEFAULT_PROMPT_VERSION;
                this.save();
            }

            const retryLimit=Number(config.retryAttempts);
            config.retryAttempts=Math.max(1,Math.min(5,Number.isFinite(retryLimit)?retryLimit:5));
            const temperature=Number(config.temperature);
            config.temperature=Math.max(0,Math.min(2,Number.isFinite(temperature)?temperature:0.3));
            config.fallbackModel=String(config.fallbackModel||'').trim().slice(0,160);
            if(!config.retryDefaultFiveMigrated){
                if(config.retryAttempts===3)config.retryAttempts=5;
                config.retryDefaultFiveMigrated=true;
                this.save();
            }

            if(!Object.hasOwn(config,'requireMacroBackbone'))config.requireMacroBackbone=true;
            if(!['standard','large','xlarge'].includes(config.fontScale))config.fontScale='standard';
            config.sendHistoryToProse=config.sendHistoryToProse===true;
            config.dedicatedApi=engine.normalizeDedicatedApi(config.dedicatedApi);
            engine.apiModeCache={};
            if(hadLegacyTone)this.save();

            if(config.enabled&&!engine.usesDedicatedApi()){
                const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
                if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
            }
            return config;
        }
    }
    class WorldRunScheduler {
        constructor(engine){this.engine=engine;}
        cancel(){
            const e=this.engine;
            ++e.generation;
            e.pending=false;
            clearTimeout(e.timer);
            if(e.controller)e.controller.abort();
        }
        schedule(){
            const e=this.engine;
            if(e.disposed||e.committing||!e.isEnabled())return;
            if(e.busy){e.pending=true;return;}
            clearTimeout(e.timer);
            e.timer=setTimeout(()=>e.run().catch(()=>{}),900);
        }
    }
    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.version=WORLD_ENGINE_VERSION; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.lastRequest=null; this.previewRequest=null; this.lastReply=''; this.lastFailure='';
            this.lastRetryLog=[]; this.lastAttemptCount=0; this.lastAttemptTelemetry=[]; this.lastTransportInfo=null; this.lastWorldResult=null; this.lastCompiledPatches=[]; this.lastCompileWarnings=[];
            this.hostAdapter=new WorldHostAdapter(this);
            this.configService=new WorldEngineConfigService(this);
            this.config=this.configService.initialize();
        }
        fn(name) { return this.hostAdapter.resolve(name); }
        notifyFailure(message){return this.runOrchestrator().notifyFailure(message);}
        snapshot() {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.snapshot();
        }
        blocked(snapshot) {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.blocked(snapshot);
        }
        saveConfig() { return this.configService.save(); }
        transportService(){return this._apiTransport||(this._apiTransport=new WorldApiTransportService(this));}
        normalizeDedicatedApi(value){return this.transportService().normalize(value);}
        usesDedicatedApi(){return this.transportService().usesDedicated();}
        dedicatedApiReady(){return this.transportService().ready();}
        apiSourceLabel(){return this.transportService().sourceLabel();}
        setDedicatedApi(patch){return this.transportService().set(patch);}
        saveDedicatedApiPreset(name){return this.transportService().savePreset(name);}
        deleteDedicatedApiPreset(name){return this.transportService().deletePreset(name);}
        applyDedicatedApiPreset(name){return this.transportService().applyPreset(name);}
        dedicatedEndpoint(kind='chat'){return this.transportService().endpoint(kind);}
        fetchDedicatedModels(){return this.transportService().fetchModels();}
        structuredUnsupported(status,body){return this.transportService().structuredUnsupported(status,body);}
        requestDedicatedApi(system,input,options={}){return this.transportService().requestDedicated(system,input,options);}
        requestAI(system,input,options={}){return this.transportService().request(system,input,options);}
        setPreset(text){return this.promptDocumentService().setPreset(text);}
        readPromptEditor(){return this.promptWorkspace?.readSettings?.()||this.promptDocumentService().currentSettings();}
        applyPromptSettings(settings){return this.promptDocumentService().applySettings(settings);}
        promptDocumentService(){return this._promptDocuments||(this._promptDocuments=new WorldPromptDocumentService(this));}
        getPromptDocuments(){return this.promptDocumentService().list();}
        savePromptDocument(name,settings,activate=true){return this.promptDocumentService().save(name,settings,activate);}
        deletePromptDocument(id){return this.promptDocumentService().remove(id);}
        importPromptDocument(raw){return this.promptDocumentService().import(raw);}
        exportPromptDocument(id){return this.promptDocumentService().export(id);}
        isConfigured(){return this.configService.isConfigured();}
        isAvailable(){return this.configService.isAvailable();}
        isEnabled(){return this.configService.isEnabled();}
        setEnabled(value){return this.configService.setEnabled(value);}
        runScheduler(){return this.services?.runScheduler||this._runScheduler||(this._runScheduler=new WorldRunScheduler(this));}
        cancel(){return this.runScheduler().cancel();}
        applyBuiltinDefaultWorldbookExclusions(catalogue){const service=this.services?.knowledge||new WorldKnowledgeService(this);return service.applyBuiltinDefaultWorldbookExclusions(catalogue);}
        async catalogue() {
            const service=this.services?.knowledge||new WorldKnowledgeService(this);
            return service.catalogue();
        }
        async worldbook(scan='', options={}) {
            const service=this.services?.knowledge||new WorldKnowledgeService(this);
            return service.worldbook(scan,options);
        }
        async buildRequest(base) {
            const service=this.services?.requestBuilder||new WorldRequestBuilder(this);
            return service.build(base);
        }
        schedule(){return this.runScheduler().schedule();}
        runOrchestrator(){return this.services?.run||this._runOrchestrator||(this._runOrchestrator=new WorldRunOrchestrator(this));}
        async run(options={}){return this.runOrchestrator().execute(options);}
        getState() {
            const service=this.services?.context||new WorldRuntimeContextService(this);
            return service.backendState();
        }
        resetInspection(){return this.runOrchestrator().resetInspection();}
        statusTone(){return this.services?.panelRenderer?.statusTone?.()||'night';}
        syncStatusTone(){return this.services?.panelRenderer?.syncStatusTone?.()||this.statusTone();}
        init() { return this.services?.applicationLifecycle?.init?.(); }
        isOpen() { return this.services?.applicationLifecycle?.isOpen?.()??false; }
        open() { return this.services?.applicationLifecycle?.open?.(); }
        close() { return this.services?.applicationLifecycle?.close?.(); }
        toggle() { return this.services?.applicationLifecycle?.toggle?.(); }
        createPanel() { return this.services?.panelController?.createPanel?.(); }
        render(force=false) { return this.services?.panelRenderer?.render?.(force); }
        dispose() { return this.services?.applicationLifecycle?.dispose?.(); }
    }
    class WorldEngineLifecycleController {
        constructor(engine){this.engine=engine;}
        init() {
            const e=this.engine,on=e.fn('eventOn');
            const mvu=e.env.Mvu||e.host.Mvu;
            if(!on||!mvu||!mvu.events){
                e.initTimer=setTimeout(()=>{if(!e.disposed)e.init();},500);
                return;
            }
            const bind=(event,callback)=>{
                if(!event)return;
                const off=on(event,callback);
                if(typeof off==='function')e.unsub.push(off);
                else if(off&&off.stop)e.unsub.push(()=>off.stop());
            };
            bind(mvu.events.VARIABLE_UPDATE_ENDED,(variables,before)=>{
                if(e.committing||e.host.__samsaraUIMutation||e.env.__samsaraUIMutation||e.host.parent?.__samsaraUIMutation)return;
                try{
                    const snapshot=e.snapshot();
                    if(plain(variables?.stat_data))snapshot.stat=variables.stat_data;
                    if(e.blocked(snapshot))e.cancel();
                }catch(_){}
                e.render();
                e.schedule();
            });
            const events=e.env.tavern_events||e.host.tavern_events||{};
            for(const key of ['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_DELETED']){
                bind(events[key],()=>{
                    e.cancel();
                    e.resetInspection();
                    e.status='已切换上下文';
                    e.render();
                });
            }
            e.keyHandler=event=>{
                if(event.key==='Escape'&&this.isOpen()){
                    event.stopImmediatePropagation();
                    this.close();
                }
            };
            e.host.document.addEventListener('keydown',e.keyHandler,true);
        }
        isOpen(){const e=this.engine;return !!e.panel&&!e.panel.hidden;}
        open(){
            const e=this.engine;
            if(this.isOpen())return;
            e.createPanel();
            const terminal=e.host.Samsara&&e.host.Samsara.terminal;
            if(terminal)e.returnState=terminal.suspend();
            e.panel.hidden=false;
            e.render();
        }
        close(){
            const e=this.engine;
            e.promptEditing=false;
            if(!this.isOpen())return;
            e.panel.hidden=true;
            const terminal=e.host.Samsara&&e.host.Samsara.terminal;
            if(terminal)terminal.restore(e.returnState);
            e.returnState=null;
        }
        toggle(){return this.isOpen()?this.close():this.open();}
        dispose(){
            const e=this.engine;
            this.close();
            e.disposed=true;
            e.cancel();
            clearTimeout(e.initTimer);
            e.unsub.forEach(off=>off());
            e.unsub=[];
            if(e.keyHandler)e.host.document.removeEventListener('keydown',e.keyHandler,true);
            if(e.panel)e.panel.remove();
            if(e.style)e.style.remove();
            if(e.mount)e.mount.remove();
        }
    }
    // Canonical editable prompt defaults and built-in prompt migrations.
    // Moved from legacy world-engine source parts; behavior intentionally unchanged.

    // Legacy NPC audit prompt retained only to migrate older prompt documents/config defaults.
    const NPC_BUILD_AUDIT_RULES=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度或重做角色。
1. 不改人物层级、HP_MAX/EP_MAX；不覆盖已完整组件，不用改名制造重复能力。
2. 最低构筑：杂兵=血统1/装备1/技能可0；精英=血统1/装备2/技能1；Boss=血统1/装备3/技能2；上限为血统2/装备6/技能4。精英需有杀伤、生存、机动/控制，Boss另有阶段或形态机制。
3. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
4. 只用 WorldResult.关系 更新既有 NPC；只提交新增/修正项。不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
5. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、层级和已演出能力一致的缺口，资料不足时做最小补全。`;

    // ---- migrated from script/world-engine-src/55-npc-narrative-audit.part.js ----
    // NPC 构筑份量与生命层级解耦：份量由人物资料中的剧情定位决定，层级只描述本体强度。
    const NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT=`【角色管理 · NPC构筑审计】
只处理“角色管理.NPC构筑审计”列出的既有 NPC；目标是补真实缺口，不是提难度、改层级或重做角色。
1. 审计级别与人物层级独立，是世界推进私有信息，只允许保存在“世界.后台.人物.审计级别”，禁止写入关系列表/NPC公开面板。新建的非队友NPC首次进入后台人物时，由你按剧情身份、叙事地位、已演出能力与遭遇需求填写杂兵级/精英级/首领/Boss级；活跃异端首次建档默认首领/Boss级；队友不定级、不参与NPC构筑审计。
2. 已有合法私有审计级别时优先沿用。只有角色获得/失去关键力量、战斗职责或剧情地位发生实质变化时，才通过 WorldResult.人物 更新审计级别；普通受伤、单次胜负、临时状态或单纯层级高低不得改级。旧档或漏填时由程序按异端身份及既有身份/职业/背景故事/态度兜底推断。
3. 最低构筑：杂兵=血统1/装备2/技能1；精英=血统1/装备4/技能2；Boss=血统1/装备6/技能4。血统默认1项；只有明确多重血统设定才增加。装备与技能可按真实设定超过最低数，但不得拆分、复制或堆同义能力凑数。最低装备数只统计状态=1的已装备项；状态0/2不计入构筑数量。
4. 审计新增装备统一写状态=1并视为已装备；状态0仅用于剧情明确的随身未装备物，状态2仅用于仓库物，不得用0/2凑最低装备数。
5. 精英需有杀伤、生存、机动/控制手段；Boss另有阶段、形态、状态切换或等价战斗机制。
6. 能力只归一个主要组件：血统=本体条件，装备=实体，技能=执行方式，状态=当前结果，形态=独立战斗模式。
7. 构筑补全只用 WorldResult.关系 更新既有 NPC；审计级别只用 WorldResult.人物 写入世界后台。只提交新增/修正项，不得输出真属性、最终属性或强化缓存；血统/形态五维必须齐全，技能不写基础/衍生属性。
8. 效果必须可结算，不写随机概率词条；每个审计对象至少修复一个与现有身份、职业、剧情定位、层级和已演出能力一致的缺口，资料不足时做最小补全。`;

    // 审计新增装备默认状态=1的编译规则已迁移至 WorldNpcAuditService。

    // 默认审计提示词迁移由 WorldNpcAuditPromptFeature.initialize() 负责。


    // ---- migrated from script/world-engine-src/57-task-awareness.part.js ----
    // 任务感知层：任务.列表是现有 MVU 的唯一正式任务账簿；世界引擎只读消费，不建立第二套后台任务库。
    const TASK_AWARENESS_RULES=`【任务感知 · 只读】
任务列表是世界因果来源之一。世界推进不得创建、删除或修改任务，也不得推进任务状态、交付、结算或奖励；任务影响只通过事件、人物行动、势力地区、探索与传播表现。事件可用“关联任务”引用当前任务.列表中已存在的任务名，作为因果来源；禁止引用不存在的任务。
情报交易由世界引擎生成或刷新；购买、扣款、消费性删除及购买后创建任务由MVU/变量AI处理，世界引擎下一轮只读接续。副本成就、击杀、奖励与惩罚不进入世界推进上下文。`;
    const TASK_WORLD_BOOK_TITLE='任务与委托系统';
    // 旧版曾把正式任务规则从内置默认资料中排除；现在恢复为可读取的权威规则。
    BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS.delete(TASK_WORLD_BOOK_TITLE);

    // 任务只读投影与事件关联校验已迁移至 WorldTaskAwarenessService。\n\n    // 请求、世界书目录恢复已迁移至 WorldTaskAwarenessFeature。


    // ---- migrated from script/world-engine-src/58-chronology-guard.part.js ----
    // 原著/数据库时间轴保护层：宏观节点先服从权威时间资料，再展开区间细节。
    const CHRONOLOGY_GUARD_RULES=`【原著/数据库剧情时间轴约束】
1. 原著/权威资料定义“未被干预时的默认未来”，不是不可改变的剧本。若当前已确认事实与因果偏移不足以改变主线，优先继续推进作品本身正在发生的剧情，再扩展新的世界事件。
2. 已发生事实绝对优先，不能被原著常识覆盖。世界书/数据库对某宏观事件明确到日时，该日级锚点是硬约束；只有已确认剧情已经改变该节点的日期、成立条件或是否发生，且因果.偏移记录明确关联该节点时，才允许改期、取消或重构。
3. 原著只给月份、季节、时段、事件顺序、条件剧情、趋势或大致间隔时，保持同级时间精度并按原著节奏保守留白；这些属于软约束，不为方便排序强造日级日期，也不因合理估计差异反复重试。
4. 原著具有惯性但没有修正力。玩家或世界已经救下、杀死、阻止、摧毁或改写关键条件后，只重构真正受影响的节点；未受影响的原著剧情继续存在。禁止为了“回归原著”强行制造等价死亡、替代事故、无因复活或其它命运补偿。
5. 先判断“如果<user>从现在起不再干预，接下来最自然发生的原著/权威剧情是什么”，再确定“当前世界时间 → 下一宏观节点”的合理时间边界，并在该区间内生成当前事件与近期节点；不能先自创下一场危机，再倒推一个过近日期。
6. 3~5个宏观节点只是滚动规划窗口，不代表必须覆盖完整原著篇章。一个宏观节点只表达一个阶段转折；不得为了凑节点数量，把远行、集结、连续战役或多个独立剧情阶段合并成一个节点。
7. 排期相邻宏观节点前，先检查两者之间现实上需要经历的旅行、准备、组织动员、战役推进与因果发展；若中间包含多个独立阶段，就拆分节点或拉开跨度。`;
    const CHRONOLOGY_PRESET_STEP_OLD='Step 2 · 定边界：确认当前阶段与下一宏观节点；只有篇章、地区、战争、势力或关键人物命运发生阶段变化时才调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_V1='Step 2 · 定边界与日期：以当前世界时间为起点，先按明确世界书/数据库时间资料与原著节奏确定下一宏观节点及合理跨度；只有已确认因果偏移才能改期，再决定是否调整宏观骨架。';
    const CHRONOLOGY_PRESET_STEP_V2='Step 2 · 定边界与日期：以当前世界时间为起点，按明确资料与原著节奏规划接下来3~5个滚动宏观节点；每个节点只表达一个阶段转折，并为相邻节点间的旅行、准备与因果发展留足时间；只有已确认因果偏移才能改期。';
    const CHRONOLOGY_PRESET_STEP_V3='Step 2 · 定剧情与时间边界：以当前世界时间为起点，把原著/权威剧情作为未受干预时的默认未来，按明确资料与原著节奏规划接下来3~5个滚动宏观节点；已确认偏移只重构受影响节点，不强行回归原著。';
    const upgradeChronologyPreset=value=>{
        const text=String(value||'');
        for(const previous of [CHRONOLOGY_PRESET_STEP_OLD,CHRONOLOGY_PRESET_STEP_V1,CHRONOLOGY_PRESET_STEP_V2])if(text.includes(previous))return text.replace(previous,CHRONOLOGY_PRESET_STEP_V3);
        return text;
    };
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings))BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=upgradeChronologyPreset(BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset);

    // 日级时间证据、编译硬校验与纠错动作已迁移至 WorldChronologyPolicy。\n\n    // 时间轴请求装饰与默认预设迁移已迁移至 WorldChronologyFeature。


    // ---- migrated from script/world-engine-src/59-world-integrity-guard.part.js ----
    // 世界完整性保护：统一精确时钟；因果偏移采用软归一化，不因语义或幅度问题拖死整轮推进。
    const WORLD_INTEGRITY_GUARD_RULES=`【因果偏移与时间约束】
1. 时间校验按字段粒度处理：事件、地区、历史、传播等宏观事实只按“自然日”硬校验；同一自然日内的上午/下午/HH:mm差异不算未来越界，只有跨日未来事实才拒绝。
2. 人物当前动态仅在“当前世界时间”和“人物更新时间”双方都明确到 HH:mm 时做分钟级先后校验；任一侧只有清晨/上午/下午等粗粒度时，同日视为合法。当前状态仍优先复用世界.时间原文，未来计划放预计结束、下次检查或待发生事件。
3. 偏移记录不是每轮必填，也不是剧情日志、剧情总结或章节小结。只记录已经发生、已经确认，并且现实结果已经改变关键人物命运、重大事件结果、关键势力格局、主线可行性或异常污染规模的长期偏移；本轮没有这种重大世界级变化时，省略“因果.偏移记录”，不得为了让稳定值变化而硬造记录。
4. 判定依据是已经实现的结果，不是危险程度、能力强弱、计划、意图或潜在上限。即使持有足以影响整个世界的高危装置，只要尚未使用且尚未造成现实结果，就不产生偏移。
5. 同一已确认根因及其连锁后果只记一条，优先更新已有偏移；只有形成新的、独立的长期偏移方向才新增。禁止把同一条因果链拆成剧情小总结连续累计。
6. 预测、风险、可能、潜在或未来尚未发生的后果不产生偏移；位置暴露、敌人警觉、受伤、逃脱、生存/行动难度变化等局部战术后果不产生偏移；稳定下降及其后续世界响应也不能反过来成为新的负偏移。
7. 负值锚点：关键人物命运不可逆改写 -3~-12；重大事件结果不可逆改变 -3~-10；关键势力格局或主线可行性实质破坏 -2~-8；异常污染持续扩大 -1~-10。普通变化不记录。
8. 正值只来自真实修复：关键人物/重大事件修复 +3~+10；异常清除 +1~+15；势力格局或主线结构修复 +2~+8。高于100不能来自普通善行、胜利或奖励。
9. 单条建议范围 -12~-1 或 +1~+15，0 不建新记录；同一引发者同轮负向总量最多 -12、正向总量最多 +15。程序对越界、同根拆分、局部后果或尚未产生现实结果的偏移执行软归一化/忽略，不触发重试，也不驳回本轮其它世界推进结果。
10. 世界.稳定是偏移台账的派生值，由程序汇总；模型不得直接修改，也不需要每轮“更新稳定值”。`;

    // 精确时钟解析、同日粗粒度放行与人物分钟级保护已迁移至 WorldTimePolicy + WorldTimelinePolicy。

    // 因果偏移软归一化与世界尺度过滤已迁移至 WorldCausalService。

    // 时间一致性纠错动作已迁移至 WorldRetryGuidanceService。\n\n    // 请求 manifest / system 装饰已迁移至 WorldIntegrityRequestFeature + WorldPromptRegistry。


    // ---- migrated from script/world-engine-src/59-world-time-ownership.part.js ----
    // 世界时间单一所有权：世界推进 AI 负责初始化/推进世界.时间；变量 AI 的写入在事件层被回滚。
    const WORLD_TIME_RULES=`【世界时间所有权】
1. 世界.时间由世界推进独占维护。顶层“时间”只用于初始化或实际推进当前世界时钟；人物更新时间、事件计划时间不能代替世界时钟。
2. 当前时间为空/待初始化时，先用“最新已确认正文 + 当前阶段 + 当前地点”定位玩家此刻处于任务世界时间线的哪个位置，再对照已读取的时间线/年表/章节资料建立当前时间锚点。下一宏观节点、任务期限和未来事件日期只能作为未来边界，禁止直接拿来当当前时间。
3. 资料只能确定年份、月份、季节、阶段或时段时保持同级精度，不为格式完整编造月日；明确资料与当前剧情无法唯一对应时，宁可保留较粗时间，也不要伪造精确日期。
4. 每轮先对比最新正文与现有世界.时间。正文明确发生过夜、数小时后、次日、跨日旅行，或明确出现新的日期/时段时，必须提交顶层“时间”同步推进；禁止保持旧世界时钟，却把已经发生的事件/人物动态写到旧时钟之后。
5. 精确到月日时统一写 {yyy}年-{mm}月-{dd}日-{时间段}；月份必须为数字。时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。不要输出“夜晚/黄昏/早上”等其它同义词。
6. 时间段是粗粒度时间锚点，不是每轮计数器。没有足够时间流逝跨过当前时段时，省略“时间”并保持原值；只有正文或明确时间资料表明确实经过了合理时长，才推进到后续时段或日期。禁止仅因本轮执行了世界推进就机械跳时段。
7. 世界时间不得回退，也不得把待发生事件的计划时间提前写成当前时间。人物/地区等“更新时间”由程序按本轮最终世界时间统一盖章。从主神空间进入新副本时，程序会先清空世界.时间与旧历法；必须把这视为全新世界的时间初始化，严禁继承上一副本或主神空间“轮回历”的日期。`;

    // 世界时间结果策略、Schema、编译事务与 replay 范围已迁移至 WorldTimePolicy / canonical services。
    // 本文件仅保留可编辑的 WORLD_TIME_RULES 提示词常量。\n

    // ---- migrated from script/world-engine-src/59-editable-module-prompts.part.js ----
    // 提示词工作台最终层：只暴露真正发送给世界 AI 的文字模块；程序 Schema/校验仍由代码负责。
    const WORLD_MODULE_PROMPT_VERSION=7;
    const COMPACT_DEFAULT_PRESET=`你是轮回战场的世界引擎。推进正文之外仍在运行的世界，并优先延续当前作品正在发生的故事；只提交已经发生或需要规划的世界变化。
【执行流程】
1. 取事实：当前变量/已确认剧情 > 明确世界书 > 模型常识。
2. 定剧情：先判断若<user>从现在起不再干预，原著/权威资料接下来最自然会发生什么；它是默认未来，不是不可改变剧本。
3. 定边界并推世界：确认当前阶段、世界时间与下一宏观节点，按可用时间推进事件、地区、人物与势力；世界不会因<user>停下而暂停。
4. 结算影响：记录<user>已经造成的客观后果；足以改线时只重构受影响剧情，未受影响主线继续推进，不替<user>行动。
5. 做维护：只处理本轮确有变化的传播、经济、历法；因果偏移仅在出现重大世界级长期改变时维护。
6. 输出差分：只写新增/变化的 WorldResult；无业务变化只写摘要。`;
    const COMPACT_CORE_WORLD_RULES=`【核心边界】
- 事实优先级：当前变量/已确认剧情 > 明确世界书 > 常识；计划不是事实。
- 原著/权威剧情是未受干预时的默认未来：没有足够已确认因果改变时沿原著主线推进；偏移后只重构受影响节点，禁止为“回归原著”强行制造等价死亡、替代事故、无因复活或其它命运修正。优先推进作品正在发生的故事，再扩展新世界事件。
- 模型知道≠场外人物知道。人物只能依据在场观察、既有认知或可信传播行动；因<user>新行为改策必须有认知来源。
- 活跃异端只在活动缺失、复核到期、关联事件/所在地区变化或长期未复核时更新；无触发时沿用既有目标与行动，不得为了刷新而凭空改策。
- 时间与路程必须可实现；同一人物同一时段只在一处；不替<user>行动，不复述已演出琐事。
- 资产只记录固定地产、大型载具或要塞；单兵物品不写资产。探索只记录<user>实际到达、调查或可靠获知的区域。
- 因果偏移只记已实现的主线级长期变化；没有重大世界偏移就完全不写偏移记录。当前事件公开字段只写现实中可感知的信息。
- 任务结算、奖励、成就、击杀等由对应系统负责。`;
    const COMPACT_MACRO_PROMPT=`【宏观骨架】
需要补骨架时保持3~5个滚动阶段节点；原著/权威剧情作为未受干预时的默认骨架，未受影响节点保持惯性，已确认偏移只重构受影响部分。先定顺序与时间边界，再填近期细节。未来规划可跨边界，实际推进不可越过下一节点；不要把多个独立阶段硬并成一个节点。`;
    const COMPACT_STABILITY_PROMPT_TEMPLATE=`【世界自救 · {{阶段}}】
稳定={{稳定值}}。{{规则}}
排异必须通过世界内合理因果发生；NPC仍受自身认知与传播链限制。`;

    const WORLD_PROMPT_MODULE_DEFS=Object.freeze([
        Object.freeze({key:'task',title:'任务只读',source:'TASK_AWARENESS_RULES',legacy:()=>[TASK_AWARENESS_RULES],fallback:`【任务感知 · 只读】
任务.列表只作世界因果输入；事件可用“关联任务”引用已存在任务。不得创建、删除、改状态、交付或结算任务。情报购买与扣款由MVU处理；成就、击杀、奖励、惩罚不参与世界推进。`}),
        Object.freeze({key:'chronology',title:'原著 / 数据库时间轴',source:'CHRONOLOGY_GUARD_RULES',legacy:()=>[CHRONOLOGY_GUARD_RULES],fallback:`【原著/数据库剧情时间轴约束】
原著/权威剧情是未受干预时的默认未来；无足够因果改变时优先沿原著推进。已发生事实不可覆盖；明确到日的日期硬校验，只有明确关联的已确认偏移可让受影响节点改期、取消或重构。月份、时段、顺序、条件与趋势保持同级精度并作软约束。偏移后只改受影响节点，禁止为了回归原著强行命运修正。3~5个节点只是滚动窗口，不合并独立阶段。`}),
        Object.freeze({key:'maintenance',title:'分级维护',source:'SOFT_MAINTENANCE_RULES',legacy:()=>[SOFT_MAINTENANCE_RULES],fallback:`【分级验收 · 软维护不拒绝整轮】
Schema、非法状态、因果引用、明确日期冲突是硬错误；排期补全、传闻补齐、传播复核可跨轮维护。事件有时间、条件或前因任一即可作为锚点。纠错只改被拒片段，不重写已通过内容。`}),
        Object.freeze({key:'exploration',title:'探索台账',source:'EXPLORATION_PROJECTION_RULES',legacy:()=>[EXPLORATION_PROJECTION_RULES],fallback:`【玩家探索投影硬约束】
<user>实际到达整体区域时探索度至少10%；远方后台地区不自动记入；离开后保留已有探索。`}),
        Object.freeze({key:'integrity',title:'因果与事实时间',source:'WORLD_INTEGRITY_GUARD_RULES',legacy:()=>[WORLD_INTEGRITY_GUARD_RULES],fallback:`【因果偏移与时间约束】
当前事实不得落在世界时间之后；未来计划写预计结束、下次检查或待发生事件。因果偏移不是每轮必填，只记录已实现且改变关键人物命运、重大事件结果、关键势力格局、主线可行性或异常污染规模的长期变化；本轮没有这种重大变化时，省略“因果.偏移记录”，不得为了让稳定值变化而硬造记录。位置暴露、敌人警觉、受伤、逃脱、行动/生存难度变化等局部后果不记。计划、风险、能力上限不记；同根因优先更新同一条。稳定值由程序根据有效偏移汇总，模型不得直接修改。`}),
        Object.freeze({key:'worldTime',title:'世界时间',source:'WORLD_TIME_RULES',legacy:()=>[WORLD_TIME_RULES],fallback:`【世界时间所有权】
世界.时间由世界推进维护。为空时据已确认资料初始化；没有足够时间流逝跨过当前时段就保持原值，不因每轮推进而机械跳时段。精确到月日使用 {yyy}年-{mm}月-{dd}日-{时间段}；时间段只能选：凌晨 / 黎明 / 清晨 / 早晨 / 上午 / 中午 / 午后 / 下午 / 傍晚 / 入夜 / 晚上 / 深夜。只有正文或明确资料表明确实经过合理时长才推进时段/日期；不得回退或把未来计划时间当当前时间。人物/地区更新时间由程序统一盖章。`}),
        Object.freeze({key:'rumor',title:'传闻与传播',source:'RUMOR_THROTTLE_RULES / RUMOR_WORLD_SOURCE_RULES',legacy:()=>[RUMOR_LIVELINESS_RULES,RUMOR_THROTTLE_RULES,RUMOR_WORLD_SOURCE_RULES],fallback:`【信息传播 · 世界侧事实】
传闻只来自“世界侧可传播事实”、已有传播链和既有公开传闻；正文不是直接传播源。私密事实必须先形成目击、公开后果、调查、公告或泄露。公开内容不得超过来源/受众认知，传播按时间与空间扩散。无触发保持原样；空分类、传播复核或新公开事实时按需更新，每个触发每类最多1条。普通行动/战斗本身不触发；传闻失败不重跑整轮。购买、扣款与消费性删除由MVU处理。`})
    ]);
    function worldModulePromptDefaults(){
        return Object.fromEntries(WORLD_PROMPT_MODULE_DEFS.map(item=>[item.key,item.fallback]));
    }
    function normalizeWorldModulePrompts(value){
        const source=plain(value)?value:{};
        const out={};
        for(const item of WORLD_PROMPT_MODULE_DEFS)out[item.key]=typeof source[item.key]==='string'?source[item.key]:item.fallback;
        return out;
    }
    function stripLegacyWorldModulePrompts(system){
        let text=String(system||'');
        for(const item of WORLD_PROMPT_MODULE_DEFS){
            for(const legacy of item.legacy()){
                const block=String(legacy||'');
                if(block)text=text.split(block).join('');
            }
        }
        return text.replace(/\n{3,}/g,'\n\n').trim();
    }
    function appendConfiguredWorldModulePrompts(system,modulePrompts){
        let text=stripLegacyWorldModulePrompts(system);
        const prompts=normalizeWorldModulePrompts(modulePrompts),used=[];
        for(const item of WORLD_PROMPT_MODULE_DEFS){
            const block=String(prompts[item.key]||'').trim();
            if(!block)continue;
            text+=(text?'\n\n':'')+block;
            used.push({key:item.key,title:item.title,source:item.source,估算Tokens:estimateTokens(block)});
        }
        return {system:text,used};
    }

    // 内置默认直接展示精简版；旧用户只在仍使用内置默认时迁移一次，自定义文档不强制覆盖。
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.corePrompt=COMPACT_CORE_WORLD_RULES;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.macroPrompt=COMPACT_MACRO_PROMPT;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.modulePrompts=worldModulePromptDefaults();
    }

    // 运行时读写、预设持久化与最终请求重写已迁移到 WorldPromptRegistry + WorldEngineClassBridge。
    class WorldRuntimeContextService {
        constructor(engine){this.engine=engine;}
        snapshot(){
            const engine=this.engine;
                        const mvu = engine.env.Mvu || engine.host.Mvu;
                        const getMessages = engine.fn('getChatMessages');
                        if (!mvu || !getMessages) throw new Error('等待 MVU 与酒馆消息接口');
                        const message = getMessages(-1)[0];
                        if (!message) throw new Error('当前没有消息');
                        const id = message.message_id != null ? message.message_id : message.id;
                        if (!Number.isInteger(Number(id))) throw new Error('当前楼层编号无效');
                        const raw = mvu.getMvuData({type:'message',message_id:Number(id)});
                        if (!raw || !raw.stat_data || !raw.stat_data.世界) throw new Error('当前楼层尚未初始化 MVU');
                        const context = engine.host.SillyTavern && engine.host.SillyTavern.getContext ? engine.host.SillyTavern.getContext() : {};
                        const chatFn = engine.fn('getCurrentChatId');
                        const chat = chatFn ? chatFn() : context.chatId;
                        if (chat == null) throw new Error('无法确认当前聊天标识');
                        const text = String(message.message != null ? message.message : message.mes || '');
                        const fingerprint = JSON.stringify([String(chat),Number(id),message.swipe_id || 0,digest(text)]);
                        return {mvu,raw:copy(raw),stat:copy(raw.stat_data),id:Number(id),text,fingerprint,message};
        }
        blocked(snapshot){
                        const s = snapshot.stat;
                        if ((s.系统状态 || {}).是否在主神空间 || s.世界.名称 === '主神空间') return '当前位于主神空间，副本推进暂停';
                        if (!s.世界.名称 || s.世界.名称 === '待初始化') return '等待副本初始化';
                        if (/轮回清算协议/.test(snapshot.text)) return '结算楼层由结算美化程序处理';
                        if (snapshot.message.is_user || snapshot.message.role === 'user') return '等待正文完成';
                        return '';
        }
        backendState(){
            return copy(Object.assign(emptyState(),this.snapshot().stat.世界[PATH]||{}));
        }
    }
    class WorldKnowledgeService {
        constructor(engine,selection=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY){this.engine=engine;this.selection=selection||DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;}
        applyBuiltinDefaultWorldbookExclusions(catalogue) {
            const engine=this.engine;
            if(engine.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id||!Array.isArray(catalogue)||!catalogue.length)return false;
            const applied=new Set(Array.isArray(engine.config.builtinDefaultWorldbookExclusionsApplied)?engine.config.builtinDefaultWorldbookExclusionsApplied:[]);
            let selected=Array.isArray(engine.config.selectedEntries)?copy(engine.config.selectedEntries):[];
            let progressed=false,changed=false;
            for(const title of BUILTIN_DEFAULT_WORLD_BOOK_EXCLUSIONS){
                if(applied.has(title))continue;
                const matches=catalogue.filter(entry=>this.selection.normalizeTitle(entry.title)===title);
                if(!matches.length)continue;
                const before=selected.length;
                selected=selected.filter(raw=>!matches.some(entry=>this.selection.matches(entry,[raw])));
                applied.add(title);progressed=true;
                if(selected.length!==before)changed=true;
            }
            if(!progressed)return false;
            engine.config.selectedEntries=selected;
            engine.config.builtinDefaultWorldbookExclusionsApplied=Array.from(applied);
            const builtin=engine.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id);
            if(builtin?.settings)builtin.settings.selectedEntries=copy(selected);
            engine.saveConfig();
            return changed;
        }
        activation(entry,scan,force){
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
        async catalogue(){
            const engine=this.engine,get=engine.fn('getWorldbook');
            if(!get)return [];
            const sources=new Map(),addSource=(book,label)=>{
                const name=String(book||'').trim();if(!name)return;
                if(!sources.has(name))sources.set(name,new Set());
                sources.get(name).add(label);
            };
            const namesFn=engine.fn('getCharWorldbookNames');
            if(namesFn){
                const names=await namesFn('current')||{};
                addSource(names.primary,'角色主书');
                for(const book of names.additional||[])addSource(book,'角色附加');
            }
            const chatFn=engine.fn('getChatWorldbookName');
            if(chatFn){
                try{addSource(await chatFn('current'),'聊天绑定');}catch(_){}
            }
            const globalFn=engine.fn('getGlobalWorldbookNames');
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
                        technical:this.selection.isTechnical(title),enabled:e.enabled!==false&&!e.disable&&!e.disabled,
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
        async worldbook(scan='',options={}){
            const engine=this.engine,catalogue=await engine.catalogue(),output=[];
            engine.bookCatalogue=catalogue;
            const report=[];engine.readReport=report;
            for(const e of catalogue){
                const selected=!e.technical&&this.selection.matches(e,engine.config.selectedEntries);
                const timelineBackbone=!!options.timelineBackbone&&selected&&e.enabled&&this.selection.isTimelineBackbone(e.title);
                const decision=e.technical?{read:false,reason:'世界引擎技术条目已隔离'}:timelineBackbone?{read:true,reason:'宏观资料补充'}:selected?this.activation(e,scan,engine.config.activationMode==='force_selected'):{read:false,reason:'未勾选'};
                report.push({世界书:e.book,条目ID:e.id,名称:e.title,灯:e.mode==='constant'?'蓝灯':e.mode==='selective'?'绿灯':'其他',读取:decision.read,原因:decision.reason});
                if(!decision.read)continue;
                let entryContent=e.content;
                if(entryContent.includes('<%')){
                    const ejs=engine.host.EjsTemplate;
                    if(!ejs?.evalTemplate||!ejs?.prepareContext)throw new Error('所选世界书含动态模板，需要 EJS 扩展：'+e.title);
                    entryContent=await ejs.evalTemplate(entryContent,await ejs.prepareContext({}));
                }
                output.push({世界书:e.book,条目ID:e.id,名称:e.title,内容:entryContent});
            }
            Object.defineProperty(output,'report',{value:report});
            return output;
        }
    }
    class WorldRequestBuilder {
        constructor(engine,proseExtractor=DEFAULT_WORLD_PROSE_EXTRACTOR,telemetry=DEFAULT_WORLD_TOKEN_TELEMETRY){this.engine=engine;this.proseExtractor=proseExtractor||DEFAULT_WORLD_PROSE_EXTRACTOR;this.telemetry=telemetry||DEFAULT_WORLD_TOKEN_TELEMETRY;}
        async build(base){
            const engine=this.engine,proseExtractor=this.proseExtractor,telemetry=this.telemetry;
            return await (async function(base){
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
                            if(state.设置?.世界超稳===true)state.世界.稳定=100;
                            delete state.商城;
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
                                .map(m=>({楼层:m.message_id??m.id,角色:'assistant',正文:proseExtractor.extract(m.message??m.mes??'')}))
                                .filter(f=>f.正文).slice(-count);
                            if(!floors.length)throw new Error('未读到可用AI正文：楼层为空或仅含思考、变量更新与面板，请检查聊天内容');
                            const timeline=timelineState(state);
                            const needBackbone=timeline.需要初始化||timeline.需要补充远期;
                            const openMacro=Object.entries(state.世界[PATH].事件).filter(([,event])=>event.分类==='宏观节点'&&['进行中','待发生'].includes(event.状态));
                            const activeMacroCount=openMacro.filter(([,event])=>event.状态==='进行中').length;
                            const macroRequirement=this.config.requireMacroBackbone!==false&&timeline.需要补充远期?{
                                已有可推进宏观节点:openMacro.map(([名称,event])=>({名称,状态:event.状态})),
                                至少补充节点数:Math.max(0,3-openMacro.length),
                                交付要求:macroBackbonePlan(openMacro.length,activeMacroCount,openMacro.length-activeMacroCount),
                                规划与发生:'本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。',
                                验收:'按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。'
                            }:undefined;
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
                                    当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',
                                    正文楼层:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。',
                                    程序结构修复:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。',
                                    时间线调度:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。',
                                    WorldResult:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。',
                                    角色管理:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。'
                                },
                                本轮必须完成的宏观骨架:macroRequirement,
                                世界书:books.map(b=>String(b.内容||'')).filter(Boolean),
                                当前变量:(this.services?.stateProjector?.world(state)??projectWorldContext(state)),
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
                            const stabilityPrompt=worldStabilityPrompt(state,this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE);
                            const macroPrompt=macroRequirement?(this.config.macroPrompt??DEFAULT_MACRO_PROMPT):'';
                            const corePrompt=this.config.corePrompt??CORE_WORLD_RULES;
                            const system=this.config.preset+(corePrompt?'\n\n'+corePrompt:'')+(macroPrompt?'\n\n'+macroPrompt:'')+(stabilityPrompt?'\n\n'+stabilityPrompt:'')+(npcAudit.length?'\n\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\n\n【WorldResult 业务输出协议】\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\n\n【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));
                            return {system,input,schema:copy(WORLD_RESULT_SCHEMA),seedPatches,due,unscheduled,staleActive,timeAnomalies,alienActivity,npcAudit:copy(npcAudit),timeline:copy(timeline),manifest:{输出协议:'WorldResult v1',结构化输出:'auto',接口来源:this.apiSourceLabel(),读取判定:copy(books.report||[]),世界书读取:{实际读取:books.length,检查条目:(books.report||[]).length,跳过:Math.max(0,(books.report||[]).length-books.length)},世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,估算Tokens:telemetry.estimate(b.内容)})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,估算Tokens:telemetry.estimate(f.正文)})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),待补时间锚点:unscheduled.map(e=>e.名称),超期活动事件:staleActive.map(e=>e.名称),时间越界记录:timeAnomalies.map(e=>e.类型+'/'+e.名称),程序结构修复:copy(structuralFixes),生命周期整理:copy(lifecycle),NPC构筑审计:npcAudit.map(x=>({名称:x.名称,审计级别:x.审计级别,缺口:copy(x.缺口)})),本轮时间容量:copy(capacity),可选宏观资料补充:needBackbone,观测:telemetry.request(system,input,WORLD_RESULT_SCHEMA)}};
            }).call(engine,base);
        }
    }
    // 世界长期历史记忆：每次推进写 L0 叶子，旧叶子逐层压缩；正文读取由独立设置控制。
    const HISTORY_MEMORY_L0_BATCH=12;
    const HISTORY_MEMORY_L0_KEEP=6;
    const HISTORY_MEMORY_L1_BATCH=6;
    const HISTORY_MEMORY_HIGHER_BATCH=3;
    const HISTORY_MEMORY_LEGACY_RAW_CONTEXT=24;
    const HISTORY_MEMORY_LEAF_PREFIX='推进·';
    const HISTORY_MEMORY_SCHEMA={
        type:'object',additionalProperties:false,required:['摘要'],
        properties:{摘要:{type:'string',minLength:1}}
    };
    const HISTORY_MEMORY_SYSTEM=`【世界长期历史压缩】
只总结已确认历史事实。你收到的是按真实先后顺序排列的既有历史节点；任务是把它们融合成一条更高层的世界史记忆，不是续写剧情。
必须保留：时间顺序、主要参与者、原因、关键转折、最终结果，以及仍会影响后续局势的长期后果与重要因果偏移。
可以删除：重复描述、已经失去后续意义的过程细节、UI/调试信息。
禁止：补写未发生剧情、猜测隐藏真相、修改既有结局、制造输入中不存在的日期/人物/关系、把历史事实写成未来计划。
如果输入时间粒度不完整，就保持原有粒度，不自行补全。
只输出 JSON：{"摘要":"..."}`;

    class WorldHistoryMemoryPolicy {
        leafKey(messageId) {
            return HISTORY_MEMORY_LEAF_PREFIX+String(messageId);
        }
        leafEntries(backend) {
            return Object.entries(backend?.历史||{}).filter(([name,item])=>
                String(name||'').startsWith(HISTORY_MEMORY_LEAF_PREFIX)&&plain(item)&&String(item.事实||'').trim()
            );
        }
        leafOrder(name,fallback=0) {
            const raw=String(name||'').slice(HISTORY_MEMORY_LEAF_PREFIX.length),n=Number(raw);
            return Number.isFinite(n)&&n>=0?n:fallback;
        }
        collectedIds(backend) {
            const collected=new Set();
            for(const item of Object.values(backend?.历史总结||{})){
                if(!plain(item)||!Array.isArray(item.子项))continue;
                for(const id of item.子项){const key=String(id||'').trim();if(key)collected.add(key);}
            }
            return collected;
        }
        invalidateAncestors(backend,childId) {
            if(!plain(backend?.历史总结))return [];
            const affected=new Set([String(childId||'')]),removed=[];
            let changed=true;
            while(changed){
                changed=false;
                for(const [name,item] of Object.entries(backend.历史总结||{})){
                    if(!plain(item)||!Array.isArray(item.子项))continue;
                    if(!item.子项.some(id=>affected.has(String(id||''))))continue;
                    delete backend.历史总结[name];
                    affected.add('总结:'+name);
                    removed.push(name);
                    changed=true;
                }
            }
            return removed;
        }
        summaryOrder(item,fallback=0) {
            const n=Number(item?.起始序位);
            return Number.isFinite(n)&&n>0?n:fallback;
        }
        rootsAtLevel(backend,level) {
            const source=plain(backend)?backend:{},collected=this.collectedIds(source);
            if(level===0){
                return this.leafEntries(source).map(([name,item],index)=>({
                    id:'历史:'+name,name,level:0,text:String(item?.事实||'').trim(),
                    timeStart:String(item?.时间||'').trim(),timeEnd:String(item?.时间||'').trim(),
                    lo:this.leafOrder(name,index+1),hi:this.leafOrder(name,index+1)
                })).filter(node=>node.text&&!collected.has(node.id))
                    .sort((a,b)=>a.lo-b.lo||a.name.localeCompare(b.name,'zh-CN'));
            }
            return Object.entries(source.历史总结||{}).filter(([,item])=>plain(item)&&Number(item.层级)===level)
                .map(([name,item],index)=>({
                    id:'总结:'+name,name,level,text:String(item.摘要||'').trim(),
                    timeStart:String(item.起始时间||'').trim(),timeEnd:String(item.结束时间||'').trim(),
                    lo:this.summaryOrder(item,index+1),
                    hi:Number.isFinite(Number(item.结束序位))?Number(item.结束序位):this.summaryOrder(item,index+1)
                })).filter(node=>node.text&&!collected.has(node.id))
                .sort((a,b)=>a.lo-b.lo||a.hi-b.hi||a.name.localeCompare(b.name,'zh-CN'));
        }
        batchForLevel(backend,level) {
            const roots=this.rootsAtLevel(backend,level);
            if(level===0){
                if(roots.length<HISTORY_MEMORY_L0_BATCH+HISTORY_MEMORY_L0_KEEP)return [];
                return roots.slice(0,HISTORY_MEMORY_L0_BATCH);
            }
            const threshold=level===1?HISTORY_MEMORY_L1_BATCH:HISTORY_MEMORY_HIGHER_BATCH;
            if(roots.length<threshold)return [];
            return roots.slice(0,threshold);
        }
        nextKey(backend,level) {
            const prefix='H'+level+'-',used=new Set(Object.keys(backend?.历史总结||{}));
            let max=0;
            for(const name of used){
                if(!String(name).startsWith(prefix))continue;
                const n=Number(String(name).slice(prefix.length));if(Number.isFinite(n))max=Math.max(max,n);
            }
            let seq=max+1,key='';
            do{key=prefix+String(seq++).padStart(6,'0');}while(used.has(key));
            return key;
        }
        parseReply(raw) {
            let source=String(raw||'').trim();
            const fenced=source.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);if(fenced)source=fenced[1].trim();
            let value=null;
            try{value=JSON.parse(source);}catch(_){
                const start=source.indexOf('{'),end=source.lastIndexOf('}');
                if(start>=0&&end>start){try{value=JSON.parse(source.slice(start,end+1));}catch(__){}}
            }
            const summary=String(value?.摘要||value?.summary||'').trim();
            if(!summary)throw new Error(source?'历史总结失败：返回缺少摘要 JSON':'历史总结失败：模型空回');
            return summary;
        }
        prompt(world,batch,outputLevel) {
            const nodes=batch.map((node,index)=>({
                序号:index+1,
                时间:node.timeStart&&node.timeEnd&&node.timeStart!==node.timeEnd?node.timeStart+' → '+node.timeEnd:(node.timeStart||node.timeEnd||''),
                事实:node.text
            }));
            return JSON.stringify({
                世界:String(world?.名称||''),
                输出层级:'L'+outputLevel,
                说明:'按给定顺序压缩；时间字段是权威锚点，不得改写或补造。',
                历史节点:nodes
            },null,2);
        }
        project(backend) {
            const state=plain(backend)?backend:{},raw=state.历史||{},summaries=state.历史总结||{};
            const collected=this.collectedIds(state);
            const allLeaves=this.leafEntries(state);
            const rawRoots=this.rootsAtLevel(state,0);
            const recent=rawRoots.slice(-HISTORY_MEMORY_LEGACY_RAW_CONTEXT);
            const recentMap=Object.fromEntries(recent.map(node=>{
                const key=node.id.slice(3),record=raw[key]||{};
                return [key,{时间:String(record.时间||''),事实:String(record.事实||''),关联事件:Array.isArray(record.关联事件)?copy(record.关联事件):[]}];
            }));
            const rootSummaries=Object.entries(summaries).filter(([name,item])=>plain(item)&&!collected.has('总结:'+name))
                .map(([name,item],index)=>({
                    名称:name,层级:Math.max(1,Number(item.层级)||1),
                    起始时间:String(item.起始时间||''),结束时间:String(item.结束时间||''),摘要:String(item.摘要||''),
                    __order:this.summaryOrder(item,index+1)
                })).filter(item=>item.摘要)
                .sort((a,b)=>a.__order-b.__order||a.层级-b.层级||a.名称.localeCompare(b.名称,'zh-CN'))
                .map(item=>{const out={...item};delete out.__order;return out;});
            return {
                说明:'世界长期叙事与因果记忆；用于保持跨章连续性，不自动等于任何角色已经获知的情报。',
                近期锚点:recentMap,
                长期总结:rootSummaries,
                统计:{
                    原始锚点总数:allLeaves.length,
                    总结节点总数:Object.keys(summaries).length,
                    未收纳锚点数:rawRoots.length,
                    隐藏未压缩锚点数:Math.max(0,rawRoots.length-recent.length),
                    冷归档事实数:Math.max(0,Object.keys(raw).length-allLeaves.length)
                }
            };
        }
        digest(backend) {
            try{return JSON.stringify([backend?.历史||{},backend?.历史总结||{}]);}catch(_){return '';}
        }
    }

    const DEFAULT_WORLD_HISTORY_MEMORY_POLICY=new WorldHistoryMemoryPolicy();
    let ACTIVE_WORLD_HISTORY_MEMORY_POLICY=DEFAULT_WORLD_HISTORY_MEMORY_POLICY;
    function historyMemoryLeafKey(messageId){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.leafKey(messageId);}
    function historyMemoryLeafEntries(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.leafEntries(backend);}
    function historyMemoryLeafOrder(name,fallback=0){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.leafOrder(name,fallback);}
    function historyMemoryCollectedIds(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.collectedIds(backend);}
    function historyMemoryInvalidateAncestors(backend,childId){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.invalidateAncestors(backend,childId);}
    function historyMemorySummaryOrder(item,fallback=0){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.summaryOrder(item,fallback);}
    function historyMemoryRootsAtLevel(backend,level){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.rootsAtLevel(backend,level);}
    function historyMemoryBatchForLevel(backend,level){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.batchForLevel(backend,level);}
    function historyMemoryNextKey(backend,level){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.nextKey(backend,level);}
    function historyMemoryParseReply(raw){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.parseReply(raw);}
    function historyMemoryPrompt(world,batch,outputLevel){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.prompt(world,batch,outputLevel);}
    function projectWorldHistoryMemory(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.project(backend);}
    function historyMemoryDigest(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.digest(backend);}
    class WorldHistoryService {
        constructor(engine,policy=DEFAULT_WORLD_HISTORY_MEMORY_POLICY){this.engine=engine;this.policy=policy||DEFAULT_WORLD_HISTORY_MEMORY_POLICY;}
        project(stat){
            const backend=stat?.世界?.[PATH]||stat||{};
            return this.policy.project(backend);
        }
        setSendToProse(value){
            if(typeof this.engine.setSendHistoryToProse==='function')return this.engine.setSendHistoryToProse(value);
            this.engine.config.sendHistoryToProse=value===true;this.engine.saveConfig?.();return this.engine.config.sendHistoryToProse;
        }
        async summarize(world,batch,level){
            if(typeof this.engine.requestHistoryMemorySummary!=='function')throw new Error('历史记忆服务尚未初始化');
            return this.engine.requestHistoryMemorySummary(world,batch,level);
        }
        backend(){return this.engine.snapshot().stat?.世界?.[PATH]||{};}
        related(value) {
            const source=Array.isArray(value)?value.join('\n'):String(value||'');
            return [...new Set(source.split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
        }
        replaySamePath(left,right) {
            return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>String(item)===String(right[index]));
        }
        syncReplay(raw,fingerprint,path,value) {
            const replay=raw?.__samsaraWorldReplay;
            if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return;
            replay.operations=replay.operations.filter(operation=>!this.replaySamePath(operation?.path,path));
            replay.operations.push({op:'set',path:copy(path),value:copy(value)});
        }
        async commitEdit(kind,name,build,status){
            name=String(name||'').trim();
            if(!name)throw new Error('历史记录名称不能为空');
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data,backend=stat?.世界?.[PATH];
            if(!plain(backend))throw new Error('世界后台不存在');
            const bucketName=kind==='summary'?'历史总结':'历史',bucket=backend[bucketName];
            if(!plain(bucket)||!plain(bucket[name]))throw new Error((kind==='summary'?'长期历史总结':'近期历史锚点')+'不存在：'+name);
            const updated=build(copy(bucket[name]));
            if(!plain(updated))throw new Error('历史编辑结果无效');
            bucket[name]=updated;
            this.syncReplay(next,snapshot.fingerprint,['世界',PATH,bucketName,name],updated);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.lastHistoryMaintenance=status||'历史记忆已手动修正';
            engine.status=status||'历史记忆已手动修正';
            engine.render(true);
            return true;
        }
        async saveAnchor(name,record){
            const time=String(record?.时间||'').trim(),fact=String(record?.事实||'').trim();
            if(!fact)throw new Error('历史事实不能为空');
            const related=this.related(record?.关联事件);
            return this.commitEdit('anchor',name,current=>({...current,时间:time,事实:fact,关联事件:related}),'已修正近期历史锚点');
        }
        async saveSummary(name,record){
            const summary=String(record?.摘要||'').trim();
            if(!summary)throw new Error('长期历史摘要不能为空');
            const start=String(record?.起始时间||'').trim(),end=String(record?.结束时间||'').trim();
            return this.commitEdit('summary',name,current=>({...current,摘要:summary,起始时间:start,结束时间:end}),'已修正长期历史总结');
        }
    }
    class WorldStateProjector {
        constructor(engine=null,taskLedger=DEFAULT_WORLD_TASK_AWARENESS_SERVICE,history=null){this.engine=engine;this.taskLedger=taskLedger||DEFAULT_WORLD_TASK_AWARENESS_SERVICE;this.history=history||null;}
        omitKeys(value,keys=[]){
            if(!plain(value))return copy(value);
            const out=copy(value);
            for(const key of keys)delete out[key];
            return out;
        }
        abilityMap(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item))continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        equipped(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item)||Number(item.状态)!==1)continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        carriedItems(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item)||Number(item.状态)===2)continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        forms(value){
            if(!plain(value))return {};
            const out={};
            for(const [name,item] of Object.entries(value)){
                if(!plain(item))continue;
                out[name]=this.omitKeys(item,['原始属性','最终属性','强化','真属性']);
            }
            return out;
        }
        character(value){
            const source=plain(value)?value:{},out={};
            for(const key of ['在场','种族','身份','职业','层级','HP_MAX','HP','THP','EP_MAX','EP','性格','喜爱','外貌','着装','是否队友','好感度','态度','背景故事','数量']){
                if(Object.hasOwn(source,key))out[key]=copy(source[key]);
            }
            const 状态=this.abilityMap(source.状态),血统=this.abilityMap(source.血统),技能=this.abilityMap(source.技能);
            const 装备=this.equipped(source.装备),道具=this.carriedItems(source.道具),形态库=this.forms(source.形态库);
            if(Object.keys(状态).length)out.状态=状态;
            if(Object.keys(血统).length)out.血统=血统;
            if(Object.keys(技能).length)out.技能=技能;
            if(Object.keys(装备).length)out.装备=装备;
            if(Object.keys(道具).length)out.道具=道具;
            if(Object.keys(形态库).length)out.形态库=形态库;
            if(plain(source.当前形态))out.当前形态=copy(source.当前形态);
            return out;
        }
        assets(value){
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
        tailRecord(value,limit){
            if(!plain(value))return {};
            return Object.fromEntries(Object.entries(value).slice(-Math.max(0,Number(limit)||0)).map(([key,item])=>[key,copy(item)]));
        }
        causalOrbit(value,currentStability){
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
        baseWorld(stat){
            const src=plain(stat)?stat:{},world=plain(src.世界)?src.世界:{},backend=plain(world[PATH])?world[PATH]:{};
            const projectedBackend={
                版本:backend.版本,
                已处理时间:backend.已处理时间,
                事件:copy(backend.事件||{}),
                人物:projectHotWorldPeople(src),
                势力地区:copy(backend.势力地区||{}),
                传播:this.tailRecord(backend.传播,HOT_PROPAGATION_TARGET)
            };
            projectedBackend.历史记忆=this.history?.project?this.history.project(backend):DEFAULT_WORLD_HISTORY_MEMORY_POLICY.project(backend);
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
                    因果轨道:this.causalOrbit(world.因果轨道,world.稳定),
                    异端雷达:copy(world.异端雷达||{}),
                    [PATH]:projectedBackend
                },
                角色:this.character(src.角色),
                关系列表:{},
                资产:this.assets(src.资产),
                资产删除保护:Object.keys(backend.资产墓碑||{}).filter(name=>!stableNameIn(src.资产||{},name)).slice(-50),
                传闻:copy(src.传闻||{}),
                系统状态:{
                    是否战斗中:!!src.系统状态?.是否战斗中,
                    是否在主神空间:!!src.系统状态?.是否在主神空间
                }
            };
            for(const [name,person] of Object.entries(src.关系列表||{}))out.关系列表[name]=this.character(person);
            if(!Object.keys(out.角色||{}).length)delete out.角色;
            if(!Object.keys(out.关系列表).length)delete out.关系列表;
            if(!Object.keys(out.资产).length)delete out.资产;
            if(!out.资产删除保护.length)delete out.资产删除保护;
            if(!Object.keys(out.传闻).length)delete out.传闻;
            const tasks=this.taskLedger.projectList(src?.任务?.列表);
            if(Object.keys(tasks).length)out.任务={列表:tasks};
            return out;
        }
        world(stat){return this.baseWorld(stat);}
    }

    const DEFAULT_WORLD_STATE_PROJECTOR=new WorldStateProjector();
    let ACTIVE_WORLD_STATE_PROJECTOR=DEFAULT_WORLD_STATE_PROJECTOR;
    function requireWorldStateProjector(){
        if(!ACTIVE_WORLD_STATE_PROJECTOR)throw new Error('WorldStateProjector 尚未初始化');
        return ACTIVE_WORLD_STATE_PROJECTOR;
    }
    function omitKeys(value,keys=[]){return requireWorldStateProjector().omitKeys(value,keys);}
    function projectAbilityMap(value){return requireWorldStateProjector().abilityMap(value);}
    function projectEquipped(value){return requireWorldStateProjector().equipped(value);}
    function projectCarriedItems(value){return requireWorldStateProjector().carriedItems(value);}
    function projectForms(value){return requireWorldStateProjector().forms(value);}
    function projectCharacterForWorld(value){return requireWorldStateProjector().character(value);}
    function projectAssetsForWorld(value){return requireWorldStateProjector().assets(value);}
    function projectCausalOrbitForWorld(value,currentStability){return requireWorldStateProjector().causalOrbit(value,currentStability);}
    function projectWorldContext(stat){return requireWorldStateProjector().baseWorld(stat);}

    class WorldResultCompiler {
        constructor(engine,normalizer,materializer,staging,patchPolicy){
            this.engine=engine;
            this.normalizer=normalizer||new WorldResultNormalizer();
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.materializer=materializer||new WorldResultMaterializer(this.normalizer,undefined,undefined,undefined,this.patchPolicy);
            this.staging=staging||new WorldResultStagingService(this.normalizer,this.materializer);
        }
        normalize(value){return this.normalizer.normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return this.staging.stage(stat,accepted,incoming,validate);}
        // All compile preprocessing is now canonical; the global compileWorldResult name is compatibility-only.
        compile(stat,value){return this.materializer.compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return this.materializer.materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return this.patchPolicy.sanitizeModelPatches(this.patchPolicy.normalizeModelPatches(patches));}
    }
    class WorldValidationService {
        constructor(engine,policy,npcAudit){this.engine=engine;this.policy=policy||new WorldValidationPolicy();this.npcAudit=npcAudit||DEFAULT_WORLD_NPC_AUDIT_SERVICE;}
        validate(next,request,acceptedWorldResult,baseStat,options={}){
            const base=baseStat||{};
            // Transitional compatibility: legacy runtime features still decorate these global seams.
            // Their base implementations are owned by WorldValidationPolicy through ACTIVE_WORLD_VALIDATION_POLICY.
            ensureDueHandled(next,request?.due||[],base?.世界?.时间);
            ensureEventTimeAnchors(next,request?.unscheduled||[]);
            ensureStaleActiveHandled(next,request?.staleActive||[],base?.世界?.时间);
            ensureTemporalAnomaliesResolved(next,request?.timeAnomalies||[]);
            ensureActiveAlienActivity(next,request?.alienActivity||[],acceptedWorldResult,base?.世界?.时间);
            if(options.includeNpcAudit!==false&&Array.isArray(request?.npcAudit))this.npcAudit.ensureProgress(next,request.npcAudit,acceptedWorldResult);
            ensureMacroBackbone(next,request?.timeline||{},this.engine.config.requireMacroBackbone!==false);
            return true;
        }
        progressionAnchorChanged(before,current){
            return this.policy.progressionAnchorChanged(before,current);
        }
    }
    class WorldCommitService {
        constructor(engine){this.engine=engine;}
        recentChanges(patches,worldTime){
            return (patches||[]).map(patch=>{
                const parts=tokens(patch.path),back=parts[1]===PATH,asset=parts[0]==='资产';
                return {
                    时间:worldTime,
                    类别:asset?'资产':back?parts[2]:parts[1],
                    名称:asset?parts[1]:back?parts[3]:parts[2],
                    字段:asset?'资产':parts.at(-1),
                    操作:patch.op==='add'?'新增':patch.op==='remove'?'移除':'更新',
                    内容:typeof patch.value==='string'?patch.value:plain(patch.value)
                        ?(patch.value.描述||patch.value.行动||patch.value.事实||patch.value.目标||patch.value.状态||patch.value.内容||'记录已更新')
                        :''
                };
            });
        }
        prepare({next,committedPatches=[],base,acceptedWorldResult=null,reply,validate}){
            const engine=this.engine;
            if(!plain(next)||!base?.stat)throw new Error('世界提交缺少待写入状态');
            if(!(next.设置||{}).世界超稳){
                const offsets=(next.世界?.因果轨道||{}).偏移记录||{};
                const total=Object.values(offsets).reduce((sum,record)=>sum+(Number(record?.影响程度)||0),0);
                next.世界.稳定=Math.max(0,Math.min(120,100+total));
            }
            if(!plain(next.世界?.[PATH]))next.世界[PATH]=emptyState();
            next.世界[PATH].已处理楼层=base.fingerprint;
            next.世界[PATH].已处理时间=base.stat.世界?.时间;
            next.世界[PATH].最近变化=this.recentChanges(committedPatches,base.stat.世界?.时间).slice(-100);

            if(typeof engine.beforeWorldCommit==='function')engine.beforeWorldCommit(next,{
                messageId:base.id,
                fingerprint:base.fingerprint,
                worldResult:acceptedWorldResult,
                reply:copy(reply),
                baseStat:base.stat
            });

            if(typeof validate==='function'){
                const checked=validate(next);
                for(const patch of committedPatches){
                    if(patch.op==='remove')continue;
                    if(!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                }
            }
            const nextReply=copy(reply||{});
            nextReply.patches=copy(committedPatches);
            return {next,reply:nextReply};
        }
        async persist(prepared,base){
            if(!prepared?.current?.raw||!prepared?.current?.mvu||!prepared?.next)throw new Error('世界提交上下文不完整');
            const result=prepared.current.raw;
            result.stat_data=prepared.next;
            const replay=typeof this.engine.buildWorldReplayPackage==='function'
                ?this.engine.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint)
                :null;
            if(replay)result.__samsaraWorldReplay=replay;
            await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
            return result;
        }
    }
    class WorldMutationService {
        constructor(engine){this.engine=engine;}
        snapshot(){return this.engine.snapshot();}
        backend(stat){
            const backend=stat?.世界?.[PATH];
            if(!plain(backend))throw new Error('世界后台不存在');
            return backend;
        }
        textList(value){
            if(Array.isArray(value))return [...new Set(value.map(item=>String(item||'').trim()).filter(Boolean))];
            return [...new Set(String(value||'').split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
        }
        jsonList(value,label='列表'){
            if(Array.isArray(value))return copy(value);
            const raw=String(value||'').trim();
            if(!raw)return [];
            let parsed;
            try{parsed=JSON.parse(raw);}catch(_){throw new Error(label+'必须是合法 JSON 数组');}
            if(!Array.isArray(parsed))throw new Error(label+'必须是 JSON 数组');
            return parsed;
        }
        pathConflict(left,right){
            if(!Array.isArray(left)||!Array.isArray(right))return false;
            const limit=Math.min(left.length,right.length);
            for(let index=0;index<limit;index++)if(String(left[index])!==String(right[index]))return false;
            return true;
        }
        mergeReplay(raw,fingerprint,beforeStat,afterStat){
            const replay=raw?.__samsaraWorldReplay;
            if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return false;
            const engine=this.engine;
            if(!engine||typeof engine.buildWorldReplayPackage!=='function')return false;
            const delta=engine.buildWorldReplayPackage(beforeStat,afterStat,fingerprint);
            if(!plain(delta)||!Array.isArray(delta.operations)||!delta.operations.length)return false;
            for(const incoming of delta.operations){
                replay.operations=replay.operations.filter(existing=>!this.pathConflict(existing?.path,incoming?.path));
                replay.operations.push(copy(incoming));
            }
            return true;
        }
        async commit(mutator,status){
            if(typeof mutator!=='function')return false;
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            this.backend(stat);
            const outcome=mutator(stat);
            if(!outcome)return false;
            this.mergeReplay(next,snapshot.fingerprint,snapshot.stat,stat);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.status=status||'世界推进资料已手动修正';
            engine.render(true);
            return true;
        }
    }
    const WORLD_SNAPSHOT_STORAGE='samsara_world_engine_snapshots_v1';
    const WORLD_SNAPSHOT_PER_CHAT=12;
    const WORLD_SNAPSHOT_STORAGE_LIMIT=36;

    class WorldSnapshotService {
        constructor(engine,mutations=null){this.engine=engine;this.mutations=mutations;}
        storage(){return this.engine?.host?.localStorage||null;}
        chatId(snapshot){
            try{return String(JSON.parse(String(snapshot?.fingerprint||''))?.[0]??'');}catch(_){return '';}
        }
        readAll(){
            let raw=[];
            try{raw=JSON.parse(this.storage()?.getItem?.(WORLD_SNAPSHOT_STORAGE)||'[]');}catch(_){raw=[];}
            return (Array.isArray(raw)?raw:[]).filter(item=>plain(item)&&item.id&&plain(item.data)).slice(0,WORLD_SNAPSHOT_STORAGE_LIMIT);
        }
        writeAll(items){
            const clean=(Array.isArray(items)?items:[]).slice(0,WORLD_SNAPSHOT_STORAGE_LIMIT);
            try{this.storage()?.setItem?.(WORLD_SNAPSHOT_STORAGE,JSON.stringify(clean));}catch(error){throw new Error('保存世界快照失败：'+String(error?.message||error));}
            return clean;
        }
        list(){
            const snapshot=this.engine.snapshot(),chat=this.chatId(snapshot);
            return this.readAll().filter(item=>!chat||String(item.chatId||'')===chat);
        }
        create(name=''){
            const snapshot=this.engine.snapshot(),stat=snapshot.stat||{},world=stat.世界||{},chat=this.chatId(snapshot);
            const cleanName=String(name||'').trim().slice(0,80)||String(world.时间||'世界快照');
            const item={
                id:'ws-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
                name:cleanName,
                createdAt:new Date().toISOString(),
                chatId:chat,
                worldName:String(world.名称||''),
                worldTime:String(world.时间||''),
                data:{
                    世界:copy(stat.世界||{}),
                    资产:copy(stat.资产||{}),
                    关系列表:copy(stat.关系列表||{}),
                    传闻:copy(stat.传闻||{})
                }
            };
            const rest=this.readAll().filter(old=>String(old.id)!==item.id);
            const sameChat=rest.filter(old=>String(old.chatId||'')===chat).slice(0,WORLD_SNAPSHOT_PER_CHAT-1);
            const otherChats=rest.filter(old=>String(old.chatId||'')!==chat);
            this.writeAll([item,...sameChat,...otherChats]);
            return copy(item);
        }
        remove(id){
            const before=this.readAll(),after=before.filter(item=>String(item.id)!==String(id||''));
            if(after.length===before.length)return false;
            this.writeAll(after);return true;
        }
        async restore(id){
            const snapshot=this.engine.snapshot(),chat=this.chatId(snapshot),item=this.readAll().find(entry=>String(entry.id)===String(id||''));
            if(!item)throw new Error('世界快照不存在');
            if(item.chatId&&chat&&String(item.chatId)!==chat)throw new Error('世界快照属于其他聊天，禁止跨聊天恢复');
            if(item.worldName&&snapshot.stat?.世界?.名称&&String(item.worldName)!==String(snapshot.stat.世界.名称))throw new Error('世界快照属于其他世界，禁止直接覆盖');
            const commit=this.mutations?.commit?.bind(this.mutations);
            if(!commit)throw new Error('世界快照恢复服务未初始化');
            return commit(stat=>{
                stat.世界=copy(item.data.世界||stat.世界||{});
                stat.资产=copy(item.data.资产||{});
                stat.关系列表=copy(item.data.关系列表||{});
                stat.传闻=copy(item.data.传闻||{});
                if(!plain(stat.世界?.[PATH]))stat.世界[PATH]=emptyState();
                stat.世界[PATH].已处理楼层='';
                stat.世界[PATH].已处理时间='';
                return true;
            },'已恢复世界快照：'+item.name);
        }
    }
    class WorldEventService {
        constructor(engine){this.engine=engine;}
        retargetReferences(stat,oldName,newName,deleted=false){
            const backend=this.engine.services.mutations.backend(stat);
            const retarget=list=>{
                if(!Array.isArray(list))return [];
                const out=[];
                for(const item of list){
                    const value=String(item||'');
                    if(value!==oldName){if(value&&!out.includes(value))out.push(value);continue;}
                    if(!deleted&&newName&&!out.includes(newName))out.push(newName);
                }
                return out;
            };
            for(const [name,event] of Object.entries(backend.事件||{})){
                if(name===newName&&!deleted)continue;
                if(Array.isArray(event?.前因))event.前因=retarget(event.前因);
            }
            for(const category of ['人物','势力地区','传播','历史']){
                for(const record of Object.values(backend[category]||{})){
                    if(Array.isArray(record?.关联事件))record.关联事件=retarget(record.关联事件);
                }
            }
            const orbit=stat?.世界?.因果轨道;
            if(plain(orbit)&&String(orbit.下一节点||'')===oldName)orbit.下一节点=deleted?'':newName;
        }
        validateGraph(stat){
            const backend=this.engine.services.mutations.backend(stat),events=backend.事件||{};
            for(const [name,event] of Object.entries(events)){
                if(!plain(event))throw new Error('事件记录无效：'+name);
                if(!['待发生','进行中','已完成','已取消'].includes(String(event.状态||'')))throw new Error('事件状态只允许：待发生 / 进行中 / 已完成 / 已取消');
                if(!EVENT_CATEGORIES.has(String(event.分类||'')))throw new Error('事件分类只允许：当前事件 / 近期节点 / 宏观节点');
                if(!Array.isArray(event.前因))throw new Error('事件前因必须是列表');
                if(event.前因.includes(name))throw new Error('事件不能把自己设为前因：'+name);
                for(const cause of event.前因)if(!Object.hasOwn(events,cause))throw new Error('事件前因不存在：'+cause);
            }
            const visiting=new Set(),visited=new Set();
            const visit=name=>{
                if(visiting.has(name))throw new Error('事件前因形成循环');
                if(visited.has(name))return;
                visiting.add(name);
                for(const cause of events[name]?.前因||[])visit(cause);
                visiting.delete(name);visited.add(name);
            };
            Object.keys(events).forEach(visit);
            for(const category of ['人物','势力地区','传播','历史']){
                for(const record of Object.values(backend[category]||{})){
                    if(!Array.isArray(record?.关联事件))continue;
                    for(const eventName of record.关联事件)if(!Object.hasOwn(events,eventName))throw new Error(category+'关联了不存在的事件：'+eventName);
                }
            }
        }
        get(name){
            const events=this.engine.snapshot().stat?.世界?.[PATH]?.事件||{};
            return plain(events?.[name])?events[name]:null;
        }
        async save(oldName,newName,record){
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName)throw new Error('事件名称不能为空');
            if(forbidden.has(newName))throw new Error('事件名称包含非法键');
            return this.engine.services.mutations.commit(stat=>{
                const mutations=this.engine.services.mutations,backend=mutations.backend(stat),events=backend.事件||{};
                const current=events[oldName];
                if(!plain(current))throw new Error('事件不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(events,newName))throw new Error('事件名称已存在：'+newName);
                const next=normalizeBackendRecord('事件',record,current);
                next.前因=mutations.textList(next.前因);
                next.参与者=mutations.textList(next.参与者);
                next.关联任务=mutations.textList(next.关联任务);
                next.可见影响=mutations.jsonList(next.可见影响,'可见影响');
                if(next.前因.includes(oldName)||next.前因.includes(newName))throw new Error('事件不能把自己设为前因');
                if(newName!==oldName)delete events[oldName];
                events[newName]=next;
                if(newName!==oldName)this.retargetReferences(stat,oldName,newName,false);
                this.validateGraph(stat);
                return {oldName,newName};
            },newName===oldName?'已修正世界事件：'+newName:'已重命名并修正世界事件：'+oldName+' → '+newName);
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.engine.services.mutations.commit(stat=>{
                const backend=this.engine.services.mutations.backend(stat),events=backend.事件||{};
                if(!plain(events[name]))return null;
                delete events[name];
                this.retargetReferences(stat,name,'',true);
                this.validateGraph(stat);
                return {deleted:name};
            },'已删除错误世界事件：'+name);
        }
    }
    class WorldRequestService {
        constructor(engine=null){this.engine=engine;}
        build(base){return this.engine.buildRequest(base||this.engine.snapshot());}
        preview(){return this.engine.preview?.();}
        request(system,input,options){return this.engine.requestAI(system,input,options);}
        retryableModelFailure(error){
            const message=String(error?.message||error||'');
            if(!message)return false;
            if(/^(?:请求已取消|上下文已经切换|推演期间世界时间或副本锚点发生变化|请在主神终端设置|请加载更新后的|禁止写入：)/.test(message))return false;
            if(error?.name==='AbortError')return false;
            return true;
        }
        retryRequirement(acceptedResult,retryPlan=[]){
            const prompts=this.engine?.services?.prompts;
            if(prompts?.retryRequirement)return prompts.retryRequirement(acceptedResult,retryPlan);
            if(acceptedResult)return Array.isArray(retryPlan)&&retryPlan.length?WORLD_PROMPT_RETRY_ACCEPTED_PLAN:WORLD_PROMPT_RETRY_ACCEPTED;
            return WORLD_PROMPT_RETRY_FRESH;
        }
        retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]){
            let payload;try{payload=JSON.parse(baseInput);}catch(_){payload={原始请求:baseInput};}
            const feedback=retryFeedback(error,error?.rejectedSlices,Array.isArray(retryPlan)?retryPlan:[]);
            const plan=feedback.actions;
            payload.纠错重试={
                当前尝试:attempt+1,
                最大尝试次数:maxAttempts,
                上次拒绝原因:feedback.summary,
                具体问题:feedback.issues.length?feedback.issues:undefined,
                上次模型回复:String(lastReply||'').slice(-12000),
                已接受业务结果:acceptedResult?copy(acceptedResult):undefined,
                补充清单:plan.length?copy(plan):undefined,
                要求:this.retryRequirement(acceptedResult,this.engine?retryPlan:plan)
            };
            if(payload.纠错重试.已接受业务结果===undefined)delete payload.纠错重试.已接受业务结果;
            if(payload.纠错重试.补充清单===undefined)delete payload.纠错重试.补充清单;
            return JSON.stringify(payload,null,2);
        }
    }

    const DEFAULT_WORLD_REQUEST_SERVICE=new WorldRequestService();
    let ACTIVE_WORLD_REQUEST_SERVICE=DEFAULT_WORLD_REQUEST_SERVICE;
    function retryableModelFailure(error){return ACTIVE_WORLD_REQUEST_SERVICE.retryableModelFailure(error);}
    function retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan=[]){
        return ACTIVE_WORLD_REQUEST_SERVICE.retryInput(baseInput,error,lastReply,attempt,maxAttempts,acceptedResult,retryPlan);
    }

    class WorldApiTransportService {
        constructor(engine,telemetry=DEFAULT_WORLD_TOKEN_TELEMETRY){this.engine=engine;this.telemetry=telemetry||DEFAULT_WORLD_TOKEN_TELEMETRY;this.modeCache=engine.apiModeCache||{};}
        normalize(value){
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
        usesDedicated(){return this.engine.config?.dedicatedApi?.enabled===true;}
        ready(){
            const api=this.engine.config?.dedicatedApi||{};
            return api.enabled===true&&!!String(api.apiUrl||'').trim()&&!!String(api.model||'').trim();
        }
        sourceLabel(){return this.usesDedicated()?'世界推进专属 API':'主神终端额外模型';}
        set(patch){
            const engine=this.engine,current=this.normalize(engine.config.dedicatedApi);
            const next=this.normalize(Object.assign({},current,plain(patch)?patch:{}));
            if(patch&&Object.hasOwn(patch,'apiUrl')&&String(patch.apiUrl||'').trim()!==current.apiUrl)next.fetchedModels=[];
            engine.config.dedicatedApi=next;engine.saveConfig();return next;
        }
        savePreset(name){
            const engine=this.engine,clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请输入 API 预设名称');
            const api=this.normalize(engine.config.dedicatedApi),entry={name:clean,apiUrl:api.apiUrl,apiKey:api.apiKey,model:api.model};
            const idx=api.apiPresets.findIndex(p=>p.name===clean);
            if(idx>=0)api.apiPresets[idx]=entry;else api.apiPresets.unshift(entry);
            api.apiPresets=api.apiPresets.slice(0,30);engine.config.dedicatedApi=api;engine.saveConfig();return entry;
        }
        deletePreset(name){
            const engine=this.engine,clean=String(name||'').trim(),api=this.normalize(engine.config.dedicatedApi);
            const before=api.apiPresets.length;api.apiPresets=api.apiPresets.filter(p=>p.name!==clean);
            engine.config.dedicatedApi=api;engine.saveConfig();return before!==api.apiPresets.length;
        }
        applyPreset(name){
            const engine=this.engine,api=this.normalize(engine.config.dedicatedApi),preset=api.apiPresets.find(p=>p.name===String(name||''));
            if(!preset)throw new Error('API 预设不存在');
            api.apiUrl=preset.apiUrl;api.apiKey=preset.apiKey;api.model=preset.model;api.fetchedModels=[];
            engine.config.dedicatedApi=api;engine.saveConfig();return api;
        }
        endpoint(kind='chat'){
            const api=this.normalize(this.engine.config.dedicatedApi);
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
        async fetchModels(){
            const engine=this.engine,api=this.normalize(engine.config.dedicatedApi),fetcher=engine.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const headers={};if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const response=await fetcher(this.endpoint('models'),{headers});
            if(!response.ok){
                let body='';try{body=await response.text();}catch(_){}
                throw new Error('加载模型失败：HTTP '+response.status+(body?' / '+body.slice(0,240):''));
            }
            const body=await response.json(),raw=Array.isArray(body?.data)?body.data:Array.isArray(body?.models)?body.models:[];
            const models=raw.map(item=>typeof item==='string'?item:item?.id||item?.name).filter(Boolean).map(String);
            if(!models.length)throw new Error('API 返回的模型列表为空');
            api.fetchedModels=Array.from(new Set(models)).sort().slice(0,500);
            if(api.model&&!api.fetchedModels.includes(api.model))api.fetchedModels.unshift(api.model);
            engine.config.dedicatedApi=api;engine.saveConfig();return api.fetchedModels;
        }
        structuredUnsupported(status,body){
            const code=Number(status),text=String(body||'');
            return [400,404,415,422].includes(code)&&/response[_ -]?format|json[_ -]?schema|json[_ -]?object|unknown (?:field|parameter)|unrecognized|unsupported|not supported|invalid.*schema|INVALID_ARGUMENT|invalid[_ -]?argument/i.test(text);
        }
        async requestDedicated(system,input,options={}){
            const engine=this.engine,api=this.normalize(engine.config.dedicatedApi),fetcher=engine.host.fetch||(typeof fetch!=='undefined'?fetch:null);
            if(!this.ready())throw new Error('世界推进专属 API 已启用，但地址或模型未配置完整');
            if(!fetcher)throw new Error('当前环境没有 fetch');
            const endpoint=this.endpoint('chat'),headers={'Content-Type':'application/json'};
            if(api.apiKey.trim())headers.Authorization='Bearer '+api.apiKey.trim();
            const model=String(options.model||api.model||'').trim();
            if(!model)throw new Error('世界推进专属 API 缺少可用模型');
            const cacheKey=endpoint+'|'+model,wants=options.structured==='auto'&&plain(options.schema);
            const cached=wants?this.modeCache[cacheKey]:'';
            const modes=!wants?['plain']:cached==='json_schema'?['json_schema','json_object','plain']:cached==='json_object'?['json_object','plain']:cached==='plain'?['plain']:['json_schema','json_object','plain'];
            let lastError='';const modeAttempts=[];
            for(const mode of modes){
                modeAttempts.push(mode);
                const body={model,messages:[{role:'system',content:String(system||'')},{role:'user',content:String(input||'')}],stream:false,temperature:Number.isFinite(Number(options.temperature))?Number(options.temperature):0.3};
                if(mode==='json_schema')body.response_format={type:'json_schema',json_schema:{name:String(options.schemaName||'samsara_world_result').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64),strict:false,schema:options.schema}};
                else if(mode==='json_object')body.response_format={type:'json_object'};
                const response=await fetcher(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:options.signal});
                if(!response.ok){
                    let err='';try{err=await response.text();}catch(_){}
                    lastError='HTTP '+response.status+': '+response.statusText+(err?' / '+err.slice(0,300):'');
                    if(mode!=='plain'&&this.structuredUnsupported(response.status,err)){delete this.modeCache[cacheKey];continue;}
                    engine.lastTransportInfo={接口:'世界推进专属 API',模型:model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:null};
                    throw new Error(lastError);
                }
                const data=await response.json(),message=data?.choices?.[0]?.message,raw=message?.content;
                const content=typeof raw==='string'?raw:(plain(raw)?JSON.stringify(raw):message?.parsed?JSON.stringify(message.parsed):'');
                if(!content)throw new Error('专属 API 返回内容为空');
                if(wants)this.modeCache[cacheKey]=mode;
                engine.apiModeCache=this.modeCache;
                engine.lastTransportInfo={接口:'世界推进专属 API',模型:model,结构化模式:mode,尝试模式:copy(modeAttempts),usage:this.telemetry.normalizeUsage(data?.usage)};
                return content;
            }
            throw new Error(lastError||'专属 API 不支持当前结构化输出模式');
        }
        async request(system,input,options={}){
            const engine=this.engine;
            if(this.usesDedicated()){
                const api=this.normalize(engine.config.dedicatedApi);
                engine.lastTransportInfo={接口:'世界推进专属 API',模型:String(options.model||api.model||''),结构化模式:'请求中',尝试模式:[],usage:null};
                return this.requestDedicated(system,input,options);
            }
            const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
            if(!terminal||typeof terminal.request!=='function'||!terminal.apiReady?.())throw new Error('请在主神终端设置中启用额外模型并选择模型');
            engine.lastTransportInfo={接口:'主神终端额外模型',模型:String(options.model||terminal.currentModel?.()||''),结构化模式:options.structured==='auto'?'auto（由主神终端协商）':'plain',尝试模式:[],usage:null};
            return terminal.request(system,input,options);
        }
    }
    class WorldPromptDocumentService {
        constructor(engine){this.engine=engine;}
        setPreset(text){
            const engine=this.engine;
            if(typeof text!=='string'||text.length>30000)throw new Error('预设限30000字');
            engine.config.preset=normalizeEditablePreset(text);
            engine.config.presetEditorVersion=2;
            engine.saveConfig();
            return engine.config.preset;
        }
        currentSettings(){
            const engine=this.engine,config=engine.config||{};
            return {
                preset:config.preset,
                corePrompt:config.corePrompt??CORE_WORLD_RULES,
                macroPrompt:config.macroPrompt??DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,
                npcAuditPrompt:config.npcAuditPrompt,
                structurePrompt:config.structurePrompt??WORLD_RESULT_CONTRACT.instruction(),
                contextTurns:Math.max(1,Math.min(100,Number(config.contextTurns)||6)),
                activationMode:config.activationMode||'respect_activation',
                selectedEntries:Array.isArray(config.selectedEntries)?copy(config.selectedEntries):null
            };
        }
        applySettings(settings){
            const engine=this.engine;
            if(!plain(settings)||typeof settings.preset!=='string'||settings.preset.length>30000)throw new Error('预设文档内容无效或超过30000字');
            for(const [name,value] of [['核心约束',settings.corePrompt],['宏观骨架提示词',settings.macroPrompt],['世界自救提示词',settings.stabilityPromptTemplate]]){
                if(value!==undefined&&(typeof value!=='string'||value.length>30000))throw new Error(name+'限30000字');
            }
            if(settings.npcAuditPrompt!==undefined&&(typeof settings.npcAuditPrompt!=='string'||settings.npcAuditPrompt.length>30000))throw new Error('NPC审计提示词限30000字');
            if(settings.structurePrompt!==undefined&&(typeof settings.structurePrompt!=='string'||settings.structurePrompt.length>30000))throw new Error('结构提示词限30000字');
            engine.config.corePrompt=settings.corePrompt===undefined?CORE_WORLD_RULES:settings.corePrompt;
            engine.config.macroPrompt=settings.macroPrompt===undefined?DEFAULT_MACRO_PROMPT:settings.macroPrompt;
            engine.config.stabilityPromptTemplate=settings.stabilityPromptTemplate===undefined?DEFAULT_STABILITY_PROMPT_TEMPLATE:settings.stabilityPromptTemplate;
            engine.config.npcAuditPrompt=settings.npcAuditPrompt===undefined?NPC_BUILD_AUDIT_RULES:settings.npcAuditPrompt;
            engine.config.structurePrompt=settings.structurePrompt===undefined?WORLD_RESULT_CONTRACT.instruction():settings.structurePrompt;
            engine.config.preset=normalizeEditablePreset(settings.preset);
            engine.config.presetEditorVersion=2;
            engine.config.contextTurns=Math.max(1,Math.min(100,Number(settings.contextTurns)||6));
            engine.config.activationMode=settings.activationMode==='force_selected'?'force_selected':'respect_activation';
            if(Array.isArray(settings.selectedEntries))engine.config.selectedEntries=settings.selectedEntries.filter(x=>typeof x==='string');
            else delete engine.config.selectedEntries;
            engine.saveConfig();
            return engine.config;
        }
        list(){
            const config=this.engine.config;
            if(!Array.isArray(config.promptDocuments))config.promptDocuments=[];
            return config.promptDocuments;
        }
        save(name,settings,activate=true){
            const engine=this.engine,clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请先填写预设文档名称');
            if(clean===BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)throw new Error('“默认设置”是内置文档，请换一个名称保存自定义版本');
            const docs=this.list(),now=new Date().toISOString();
            let doc=docs.find(item=>!item.builtin&&item.id===engine.config.activePromptDocumentId&&item.name===clean)||docs.find(item=>!item.builtin&&item.name===clean);
            if(doc){doc.name=clean;doc.updatedAt=now;doc.settings=copy(settings);}
            else{
                doc={id:'prompt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:clean,createdAt:now,updatedAt:now,settings:copy(settings)};
                docs.unshift(doc);
            }
            engine.config.promptDocuments=docs.slice(0,60);
            if(activate)engine.config.activePromptDocumentId=doc.id;
            engine.saveConfig();
            return doc;
        }
        remove(id){
            const engine=this.engine;
            if(id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)return false;
            const before=this.list().length;
            engine.config.promptDocuments=this.list().filter(doc=>doc.id!==id);
            if(engine.config.activePromptDocumentId===id)delete engine.config.activePromptDocumentId;
            engine.saveConfig();
            return before!==engine.config.promptDocuments.length;
        }
        import(raw){
            const engine=this.engine;
            let parsed;try{parsed=JSON.parse(String(raw||''));}catch(_){throw new Error('导入文件不是有效 JSON');}
            const settings=plain(parsed.settings)?parsed.settings:parsed;
            if(typeof settings.preset!=='string')throw new Error('导入文件缺少 preset');
            if(settings.preset.length>30000)throw new Error('导入预设超过30000字');
            const name=String(parsed.name||settings.name||'导入预设').trim().slice(0,80)||'导入预设';
            const normalized={
                corePrompt:typeof settings.corePrompt==='string'?settings.corePrompt:CORE_WORLD_RULES,
                macroPrompt:typeof settings.macroPrompt==='string'?settings.macroPrompt:DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:typeof settings.stabilityPromptTemplate==='string'?settings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                npcAuditPrompt:typeof settings.npcAuditPrompt==='string'?settings.npcAuditPrompt:undefined,
                structurePrompt:typeof settings.structurePrompt==='string'?settings.structurePrompt:undefined,
                preset:normalizeEditablePreset(settings.preset),
                contextTurns:Math.max(1,Math.min(100,Number(settings.contextTurns)||6)),
                activationMode:settings.activationMode==='force_selected'?'force_selected':'respect_activation',
                selectedEntries:Array.isArray(settings.selectedEntries)?settings.selectedEntries.filter(x=>typeof x==='string'):null
            };
            if(plain(settings.promptRegistry))normalized.promptRegistry=copy(settings.promptRegistry);
            if(plain(settings.modulePrompts))normalized.modulePrompts=copy(settings.modulePrompts);
            const prepared=engine.services?.prompts?.prepareSettings?.(normalized)||normalized;
            return this.save(name,prepared,false);
        }
        export(id){
            const engine=this.engine,doc=this.list().find(item=>item.id===id);
            if(!doc)throw new Error('预设文档不存在');
            const BlobCtor=engine.host.Blob||(typeof Blob!=='undefined'?Blob:null);
            const URLApi=engine.host.URL||(typeof URL!=='undefined'?URL:null);
            if(!BlobCtor||!URLApi?.createObjectURL)throw new Error('当前环境不支持文件导出');
            const defaults={corePrompt:CORE_WORLD_RULES,macroPrompt:DEFAULT_MACRO_PROMPT,stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,npcAuditPrompt:NPC_BUILD_AUDIT_RULES,structurePrompt:WORLD_RESULT_CONTRACT.instruction()};
            const exportedSettings=Object.assign(defaults,copy(doc.settings));
            if(engine.services?.prompts)exportedSettings.promptRegistry=engine.services.prompts.normalize(exportedSettings.promptRegistry||engine.services.prompts.values());
            const payload={type:'samsara-world-prompt-document',version:3,name:doc.name,exportedAt:new Date().toISOString(),settings:exportedSettings};
            const blob=new BlobCtor([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
            const href=URLApi.createObjectURL(blob),a=engine.host.document.createElement('a');
            a.href=href;a.download=doc.name.replace(/[\\/:*?"<>|]+/g,'_')+'.world-prompt.json';a.style.display='none';
            engine.host.document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URLApi.revokeObjectURL(href),1000);
            return payload;
        }
    }
    class WorldRunOrchestrator {
        constructor(engine){this.engine=engine;}
        resetInspection(){
            const e=this.engine;
            e.lastRequest=null;e.previewRequest=null;e.lastReply='';e.lastFailure='';
            e.lastRetryLog=[];e.lastAttemptCount=0;e.lastAttemptTelemetry=[];e.lastTransportInfo=null;e.lastWorldResult=null;e.lastCompiledPatches=[];e.lastCompileWarnings=[];
        }
        notifyFailure(message){
            const e=this.engine,raw=String(message||'世界推进失败').trim();
            if(!raw||/^(?:请求已取消|上下文已经切换|已切换上下文)/.test(raw))return false;
            const shown=raw.length>900?raw.slice(0,897)+'…':raw;
            const toast=(e.host&&e.host.toastr)||(e.env&&e.env.toastr)||(e.host&&e.host.parent&&e.host.parent.toastr);
            if(toast&&typeof toast.error==='function'){
                try{toast.error(shown,'世界推进失败');return true;}catch(_){}
            }
            try{console.error('[世界推进] '+shown);}catch(_){}
            return false;
        }
        async execute(options={}) {
            const engine=this.engine;
            return await (async function() {
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
                    const recoveryTimeline=this.services.timelinePolicy.timelineState(recoveryStat);
                    const needsMacroRepair=this.config.requireMacroBackbone!==false&&(recoveryTimeline.需要补充远期||recoveryTimeline.因果轨道需重建);
                    const needsScheduleRepair=unscheduledEvents(recoveryStat).length>0;
                    const needsLifecycleRepair=staleActiveEvents(recoveryStat).length>0||temporalAnomalies(recoveryStat).length>0;
                    const needsAlienRepair=activeAlienActivityRequirements(recoveryStat).some(item=>{
                        const personName=stableNameIn(recoveryStat.世界?.[PATH]?.人物||{},item.名称),person=personName?recoveryStat.世界[PATH].人物[personName]:null;
                        return !person||!String(person.地点||'').trim()||!String(person.目标||'').trim()||!String(person.行动||'').trim()||String(person.更新时间||'').trim()!==String(recoveryStat.世界?.时间||'').trim();
                    });
                    const needsRumorRepair=this.services.rumor.maintenanceNeeded(recoveryStat);
                    const needsWorldActivityRepair=typeof worldActivityRepairRequired==='function'&&worldActivityRepairRequired(recoveryStat);
                    if(!needsMacroRepair&&!needsScheduleRepair&&!needsLifecycleRepair&&!needsAlienRepair&&!needsWorldActivityRepair&&!needsRumorRepair){this.status='本楼层已处理，不重复结算';return false;}
                    this.status=needsWorldActivityRepair?'检测到世界活动骨架缺失 · 修复本楼层':needsMacroRepair?'检测到宏观骨架不完整 · 修复本楼层':needsScheduleRepair?'检测到事件时间锚点缺失 · 修复本楼层':needsAlienRepair?'检测到异端活动缺失 · 修复本楼层':needsRumorRepair?'检测到传闻或传播需要维护 · 修复本楼层':'检测到生命周期或时间异常 · 修复本楼层';
                }
                if (!this.isAvailable()) throw new Error(this.usesDedicatedApi()?'请在世界推进「设置」中完成专属 API 地址与模型配置':'请在主神终端设置中启用额外模型并选择模型');
                const validate = this.host.Samsara && this.host.Samsara.validateWorldState;
                if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');

                this.resetInspection();
                this.status = '正在读取世界资料'; this.render();
                const request=await this.buildRequest(base);
                if(token!==this.generation)throw new Error('请求已取消');

                const configuredAttempts=Number(this.config.retryAttempts),perModelAttempts=Math.max(1,Math.min(5,Number.isFinite(configuredAttempts)?configuredAttempts:5));
                const configuredFallback=String(this.config.fallbackModel||'').trim();
                const primaryModel=this.usesDedicatedApi()
                    ?String(this.normalizeDedicatedApi(this.config.dedicatedApi)?.model||'').trim()
                    :String(this.host.Samsara?.terminal?.currentModel?.()||'').trim();
                const fallbackModel=configuredFallback&&configuredFallback!==primaryModel?configuredFallback:'';
                const maxAttempts=perModelAttempts*(fallbackModel?2:1);
                const temperature=Math.max(0,Math.min(2,Number.isFinite(Number(this.config.temperature))?Number(this.config.temperature):0.3));
                let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];

                while(attempt<maxAttempts){
                    if(token!==this.generation)throw new Error('请求已取消');
                    this.controller=new AbortController();
                    timedOut=false;
                    clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;this.controller.abort();},300000);
                    const usingFallback=!!fallbackModel&&attempt>=perModelAttempts;
                    const phaseAttempt=usingFallback?attempt-perModelAttempts:attempt;
                    const attemptInput=attempt===0?request.input:(this.services?.requests?.retryInput?this.services.requests.retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan):retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan));
                    const actualRequest=copy(request);
                    actualRequest.input=attemptInput;
                    actualRequest.manifest=Object.assign({},copy(request.manifest),{
                        观测:requestTokenTelemetry(request.system,attemptInput,request.schema),
                        尝试序号:attempt+1,
                        最大尝试次数:maxAttempts,
                        每模型最大尝试次数:perModelAttempts,
                        模型阶段:usingFallback?'备用模型':'主模型',
                        失败记录:copy(this.lastRetryLog)
                    });
                    actualRequest.manifest.观测.请求类型=attempt===0?'首次请求':usingFallback?'备用模型纠错':'纠错重试';
                    this.lastAttemptCount=attempt+1;
                    this.lastRequest=actualRequest;
                    this.status=attempt===0?'六模块联合推演中':usingFallback?'备用模型重试 '+(phaseAttempt+1)+'/'+perModelAttempts:'纠错重试 '+(phaseAttempt+1)+'/'+perModelAttempts;
                    this.render();

                    let received='',attemptTelemetry=null;
                    const attemptStarted=Date.now();this.lastTransportInfo=null;
                    try{
                        received=String(await this.requestAI(request.system,attemptInput,{signal:this.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature,model:usingFallback?fallbackModel:undefined}));
                        clearTimeout(timeout);
                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');
                        this.lastReply=received;this.lastFailure='';
                        const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},usage=transport.usage||null,observation=actualRequest.manifest.观测;
                        Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未知',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed,输出估算Tokens:estimateTokens(received)});
                        if(usage){observation.实际输入Tokens=usage.inputTokens;observation.实际输出Tokens=usage.outputTokens;observation.实际总Tokens=usage.totalTokens;}
                        attemptTelemetry={尝试:attempt+1,结果:'待验收',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:observation.输出估算Tokens,API输入Tokens:usage?.inputTokens??null,API输出Tokens:usage?.outputTokens??null,API总Tokens:usage?.totalTokens??null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed};
                        this.lastAttemptTelemetry.push(attemptTelemetry);

                        let reply=this.services?.resultParser?.parse(received)??parseReply(received);
                        let legacyPatches=[],rejectedSlices=[];
                        if(reply.kind==='world_result'){
                            const staged=this.services?.compiler?.stage(base.stat,acceptedWorldResult,reply.worldResult,validate)??stageWorldResult(base.stat,acceptedWorldResult,reply.worldResult,validate);
                            acceptedWorldResult=staged.accepted;
                            rejectedSlices=staged.rejected;
                            if(staged.softRejected?.length)actualRequest.manifest.软失败片段=copy(staged.softRejected);
                            reply.summary=acceptedWorldResult.摘要||reply.summary;
                        } else {
                            legacyPatches=this.services?.compiler?.sanitizeLegacy(reply.patches)??sanitizeModelPatches(normalizeModelPatches(reply.patches));
                        }
                        const compileFor=sourceStat=>{
                            const patches=[],warnings=[];
                            if(acceptedWorldResult){
                                const compiled=this.services?.compiler?.compile(sourceStat,acceptedWorldResult)??compileWorldResult(sourceStat,acceptedWorldResult);
                                patches.push(...compiled.patches);warnings.push(...compiled.warnings);
                            }
                            if(legacyPatches.length)patches.push(...legacyPatches);
                            return {patches,warnings};
                        };
                        let sourceStat=base.stat,compiled=compileFor(sourceStat),modelPatches=compiled.patches;
                        this.lastWorldResult=acceptedWorldResult?copy(acceptedWorldResult):null;
                        this.lastCompiledPatches=copy(modelPatches);
                        this.lastCompileWarnings=copy(compiled.warnings);
                        let built=this.services?.compiler?.materialize(sourceStat,request.seedPatches,modelPatches)??materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                        let next=built.next;
                        let globalError=null;
                        try{
                            if(this.services?.validation)this.services.validation.validate(next,request,acceptedWorldResult,base.stat);
                            else{
                                ensureDueHandled(next,request.due,base.stat.世界.时间);
                                ensureEventTimeAnchors(next,request.unscheduled);
                                ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                ensureNpcBuildAuditProgress(next,request.npcAudit,acceptedWorldResult);
                                ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                            }
                        }catch(error){globalError=error;}
                        if(globalError||(rejectedSlices.length&&attempt+1<maxAttempts))throw makeRetryFailure(rejectedSlices,globalError);
                        if(rejectedSlices.length){
                            const partialFailure=makeRetryFailure(rejectedSlices,null);
                            const partialPlan=Array.isArray(partialFailure.retryPlan)?copy(partialFailure.retryPlan):[];
                            this.lastRetryLog.push({尝试:attempt+1,类型:'局部片段已丢弃',错误:String(partialFailure.message||partialFailure),片段:copy(rejectedSlices),补充清单:partialPlan});
                            actualRequest.manifest.最终丢弃片段=copy(rejectedSlices);
                            this.lastCompileWarnings.push('重试耗尽后丢弃 '+rejectedSlices.length+' 个未通过业务片段；已通过片段继续提交');
                        }

                        const current=this.snapshot();
                        if(token!==this.generation||this.controller.signal.aborted||current.fingerprint!==base.fingerprint||this.blocked(current))throw new Error('上下文已经切换，本次结果已丢弃');
                        if(this.services?.validation?.progressionAnchorChanged(base.stat,current.stat)??progressionAnchorChanged(base.stat,current.stat))throw new Error('推演期间世界时间或副本锚点发生变化，请重新运行');

                        if(!same(current.stat,base.stat)){
                            sourceStat=current.stat;
                            compiled=compileFor(sourceStat);modelPatches=compiled.patches;
                            this.lastCompiledPatches=copy(modelPatches);
                            this.lastCompileWarnings=copy(compiled.warnings);
                            built=this.services?.compiler?.materialize(sourceStat,request.seedPatches,modelPatches)??materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                            next=built.next;
                            let currentGlobalError=null;
                            try{
                                if(this.services?.validation)this.services.validation.validate(next,request,acceptedWorldResult,base.stat,{includeNpcAudit:false});
                                else{
                                    ensureDueHandled(next,request.due,base.stat.世界.时间);
                                    ensureEventTimeAnchors(next,request.unscheduled);
                                    ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                    ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                    ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                    ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                                }
                            }catch(error){currentGlobalError=error;}
                            if(currentGlobalError)throw makeRetryFailure([],currentGlobalError);
                        }
                        const committedPatches=built.appliedSeeds.concat(modelPatches,built.repairPatches);
                        if(this.services?.commit){
                            const finalized=this.services.commit.prepare({
                                next,committedPatches,base,acceptedWorldResult,reply,validate
                            });
                            next=finalized.next;reply=finalized.reply;
                        }else{
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
                            if(typeof this.beforeWorldCommit==='function')this.beforeWorldCommit(next,{
                                messageId:base.id,fingerprint:base.fingerprint,worldResult:acceptedWorldResult,reply:copy(reply),baseStat:base.stat
                            });
                            const checked=validate(next);
                            for(const patch of committedPatches){
                                if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                            }
                            reply.patches=committedPatches;
                        }
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
                        lastRejectedReply=received||'';
                        lastRetryPlan=Array.isArray(error?.retryPlan)?copy(error.retryPlan):retryPlanForFailure(error,[]);
                        const retryableFailure=timedOut===true?true:(this.services?.requests?.retryableModelFailure?this.services.requests.retryableModelFailure(error):retryableModelFailure(error));
                        if(retryableFailure)this.lastRetryLog.push({尝试:attempt+1,类型:received?'模型回复被拒绝':'请求失败',错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                        const canRetry=retryableFailure&&attempt+1<maxAttempts;
                        if(!canRetry)throw error;
                        attempt++;
                        const nextUsesFallback=!!fallbackModel&&attempt>=perModelAttempts;
                        const nextPhaseAttempt=nextUsesFallback?attempt-perModelAttempts:attempt;
                        this.status=nextUsesFallback?'主模型连续失败 · 切换备用模型 '+(nextPhaseAttempt+1)+'/'+perModelAttempts:'回复未通过 · 自动纠错 '+(nextPhaseAttempt+1)+'/'+perModelAttempts;
                        this.render();
                    }
                }

                if(!prepared)throw lastError||new Error('世界推演未生成可写入结果');
                this.committing=true;
                if(this.services?.commit)await this.services.commit.persist(prepared,base);
                else{
                    const result=prepared.current.raw;
                    result.stat_data=prepared.next;
                    const replay=typeof this.buildWorldReplayPackage==='function'
                        ?this.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint):null;
                    if(replay)result.__samsaraWorldReplay=replay;
                    await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                }
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
        
            }).call(engine);
        }
    }
    class WorldRequestFeature {
        constructor(engine){this.engine=engine;}
        async afterBuildRequest(request,_base){return request;}
    }
    class WorldManualAdvanceFeature extends WorldRequestFeature {
        constructor(engine){super(engine);this.engine=engine;}
        normalizeInstruction(value){return String(value||'').trim().slice(0,4000);}
        rerunInfo(){
            const e=this.engine;
            try{
                const snapshot=e.snapshot(),handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
                const replay=snapshot?.raw?.__samsaraWorldReplay;
                return {
                    processed:!!snapshot?.fingerprint&&handled===String(snapshot.fingerprint),
                    baseline:!!(plain(replay)&&String(replay.fingerprint||'')===String(snapshot?.fingerprint||'')&&Array.isArray(replay.rerunBaseline)&&replay.rerunBaseline.length)
                };
            }catch(_){return {processed:false,baseline:false};}
        }
        requestInstruction(){
            const e=this.engine,panel=e.panel,doc=e.host?.document;
            if(!panel||!doc||typeof doc.createElement!=='function')return Promise.resolve('');
            const existing=panel.querySelector('[data-manual-advance-dialog]');
            if(existing)existing.remove();
            const info=this.rerunInfo();
            return new Promise(resolve=>{
                const mask=doc.createElement('div');
                mask.className='we-manual-advance-mask';mask.dataset.manualAdvanceDialog='';
                const note=info.processed&&info.baseline
                    ?'<div class="we-manual-advance-rerun">当前楼层已有推进结果。本次会从这轮推进前的世界状态重新推演，并用新结果替换原结果。</div>'
                    :'';
                mask.innerHTML='<div class="we-manual-advance-dialog" role="dialog" aria-modal="true" aria-labelledby="we-manual-advance-title">'
                    +'<div class="we-manual-advance-head"><div><b id="we-manual-advance-title">本次推进指导</b><small>可选 · 仅本轮有效</small></div></div>'
                    +'<p>可以告诉世界 AI 这一次重点推进、暂缓或重新处理什么。留空则按正常规则推进。</p>'
                    +note
                    +'<textarea data-manual-advance-input rows="7" maxlength="4000" placeholder="例如：暂时不要推进第一层 Boss，重点维护攻略组准备和其他角色的场外行动。"></textarea>'
                    +'<div class="we-manual-advance-actions"><button type="button" class="we-btn" data-manual-advance-cancel>取消</button><button type="button" class="we-btn we-primary" data-manual-advance-submit>推进世界</button></div>'
                    +'</div>';
                panel.appendChild(mask);
                const input=mask.querySelector('[data-manual-advance-input]');
                let settled=false;
                const finish=value=>{
                    if(settled)return;settled=true;
                    mask.remove();
                    resolve(value);
                };
                mask.querySelector('[data-manual-advance-cancel]')?.addEventListener('click',()=>finish(null));
                mask.querySelector('[data-manual-advance-submit]')?.addEventListener('click',()=>finish(this.normalizeInstruction(input?.value)));
                mask.addEventListener('click',event=>{if(event.target===mask)finish(null);});
                mask.addEventListener('keydown',event=>{
                    if(event.key==='Escape'){event.preventDefault();finish(null);return;}
                    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();finish(this.normalizeInstruction(input?.value));}
                });
                try{input?.focus();}catch(_){}
            });
        }
        async trigger(){
            const e=this.engine;if(e.busy)return false;
            const instruction=await this.requestInstruction();
            if(instruction===null)return false;
            return e.run({automatic:false,instruction});
        }
        async aroundRun(next,options={}){
            const e=this.engine,previous=e.manualAdvanceInstruction;
            const automatic=plain(options)&&options.automatic===true;
            e.manualAdvanceInstruction=automatic?'':this.normalizeInstruction(options?.instruction);
            try{return await next();}
            finally{e.manualAdvanceInstruction=previous;}
        }
        async afterBuildRequest(request,base){
            const instruction=this.normalizeInstruction(this.engine.manualAdvanceInstruction);
            if(!instruction)return request;
            let payload;try{payload=JSON.parse(String(request.input||''));}catch(_){return request;}
            const registry=this.engine.services?.prompts;
            const fallback=typeof WORLD_PROMPT_MANUAL_ADVANCE_GUIDANCE==='string'?WORLD_PROMPT_MANUAL_ADVANCE_GUIDANCE:'';
            payload.本轮人工指导={
                来源:'玩家手动推进',
                模式:base?.manualRerun?.restored===true?'重新推演当前楼层':'正常手动推进',
                要求:instruction,
                执行规则:String(registry?.value?.('manualAdvanceGuidance')||fallback)
            };
            request.input=JSON.stringify(payload,null,2);
            request.manifest=Object.assign({},request.manifest,{人工指导:{启用:true,模式:payload.本轮人工指导.模式,字符数:instruction.length}});
            return request;
        }
    }
    class WorldAutoProgressController {
        constructor(engine){this.engine=engine;}
        initialize(){
            const e=this.engine;let dirty=false;
            if(!Object.hasOwn(e.config,'autoProgress')){e.config.autoProgress=true;dirty=true;}
            else e.config.autoProgress=e.config.autoProgress!==false;
            const hadInterval=Object.hasOwn(e.config,'autoProgressInterval'),value=Number(e.config.autoProgressInterval);
            e.config.autoProgressInterval=Math.max(1,Math.min(20,Number.isFinite(value)?Math.round(value):2));
            if(!hadInterval)dirty=true;
            this.resetCycle();
            if(dirty)e.saveConfig();
        }
        interval(){
            const value=Number(this.engine.config.autoProgressInterval);
            return Math.max(1,Math.min(20,Number.isFinite(value)?Math.round(value):2));
        }
        contextKey(snapshot){
            let chat='';try{chat=String(JSON.parse(String(snapshot?.fingerprint||''))?.[0]??'');}catch(_){}
            return chat+'\u0000'+String(snapshot?.stat?.世界?.名称||'');
        }
        fingerprintChat(fingerprint){
            try{return String(JSON.parse(String(fingerprint||''))?.[0]??'');}catch(_){return '';}
        }
        backendHasContent(snapshot){
            const backend=snapshot?.stat?.世界?.[PATH];if(!plain(backend))return false;
            const maps=['事件','人物','势力地区','历史','历史总结','传播'];
            if(maps.some(key=>plain(backend[key])&&Object.keys(backend[key]).length>0))return true;
            return Array.isArray(backend.最近变化)&&backend.最近变化.length>0;
        }
        initializeCycle(snapshot){
            const e=this.engine,key=this.contextKey(snapshot);
            if(e.autoProgressCycleKey===key)return;
            e.autoProgressCycleKey=key;e.autoProgressRoundsSinceRun=0;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            const currentChat=this.fingerprintChat(snapshot?.fingerprint),handledChat=this.fingerprintChat(handled);
            const sameContext=!!handled&&(!currentChat||!handledChat||currentChat===handledChat);
            const restoredRun=sameContext&&this.backendHasContent(snapshot);
            e.autoProgressHasRun=restoredRun;e.autoProgressLastSeenFingerprint=restoredRun?handled:'';e.autoProgressDueFingerprint=restoredRun?handled:'';
        }
        fingerprintParts(fingerprint){
            try{const parsed=JSON.parse(String(fingerprint||''));return {chat:String(parsed?.[0]??''),id:Number(parsed?.[1]),swipe:Number(parsed?.[2]||0),digest:String(parsed?.[3]??'')};}
            catch(_){return {chat:'',id:NaN,swipe:0,digest:''};}
        }
        sameFloor(left,right){
            const a=this.fingerprintParts(left),b=this.fingerprintParts(right);
            return !!a.chat&&a.chat===b.chat&&Number.isFinite(a.id)&&a.id===b.id;
        }
        duringExtraAnalysis(){
            const e=this.engine,mvu=e.env.Mvu||e.host.Mvu;
            try{return mvu?.isDuringExtraAnalysis?.()===true;}catch(_){return false;}
        }
        shouldSchedule(snapshot){
            const e=this.engine;this.initializeCycle(snapshot);
            const fingerprint=String(snapshot?.fingerprint||'');if(!fingerprint)return false;
            const handled=String(snapshot?.stat?.世界?.[PATH]?.已处理楼层||'');
            if(e.autoProgressLastSeenFingerprint===fingerprint)return e.autoProgressDueFingerprint===fingerprint&&handled!==fingerprint;
            const previous=e.autoProgressLastSeenFingerprint;
            if(previous&&this.sameFloor(previous,fingerprint)){
                const wasDue=e.autoProgressDueFingerprint===previous;
                e.autoProgressLastSeenFingerprint=fingerprint;
                if(wasDue)e.autoProgressDueFingerprint=fingerprint;
                return wasDue;
            }
            e.autoProgressLastSeenFingerprint=fingerprint;
            if(e.autoProgressHasRun)e.autoProgressRoundsSinceRun++;
            const due=!e.autoProgressHasRun||e.autoProgressRoundsSinceRun>=this.interval();
            if(due)e.autoProgressDueFingerprint=fingerprint;
            return due;
        }
        markRun(snapshot){
            const e=this.engine;if(snapshot)this.initializeCycle(snapshot);
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;
            if(snapshot?.fingerprint){e.autoProgressLastSeenFingerprint=String(snapshot.fingerprint);e.autoProgressDueFingerprint=String(snapshot.fingerprint);}
        }
        resetCycle(){
            const e=this.engine;
            e.autoProgressCycleKey='';e.autoProgressLastSeenFingerprint='';e.autoProgressDueFingerprint='';e.autoProgressRoundsSinceRun=0;e.autoProgressHasRun=false;e.autoProgressWaitingForVariable=false;
        }
        blocked(snapshot,baseReason=''){
            if(snapshot?.stat?.系统状态?.是否战斗中===true)return '战斗中，世界推进暂停';
            return baseReason;
        }
        schedule(source='variable-update',attempt=0){
            const e=this.engine;
            if(e.config.autoProgress!==true){if(e.timer){clearTimeout(e.timer);e.timer=null;}return;}
            if(e.disposed||e.committing||!e.isEnabled())return;
            if(e.busy){e.pending=true;return;}
            const trigger=String(source||'variable-update'),proseTrigger=trigger==='generation-ended'||trigger==='message-received';
            const tries=Math.max(0,Number(attempt)||0);
            if(proseTrigger&&this.duringExtraAnalysis()){
                e.autoProgressWaitingForVariable=true;clearTimeout(e.timer);
                if(tries<120)e.timer=setTimeout(()=>{e.timer=null;this.schedule(trigger,tries+1);},1000);
                return;
            }
            e.autoProgressWaitingForVariable=false;clearTimeout(e.timer);
            const delay=proseTrigger?(tries>0?250:800):900;
            e.timer=setTimeout(()=>{
                e.timer=null;
                if(e.config.autoProgress!==true||e.disposed||e.committing||!e.isEnabled())return;
                if(e.busy){e.pending=true;return;}
                if(proseTrigger&&this.duringExtraAnalysis()){
                    e.autoProgressWaitingForVariable=true;
                    if(tries<120)e.timer=setTimeout(()=>{e.timer=null;this.schedule(trigger,tries+1);},1000);
                    return;
                }
                let snapshot;
                try{snapshot=e.snapshot();}
                catch(_){
                    if(proseTrigger&&tries<4)e.timer=setTimeout(()=>{e.timer=null;this.schedule(trigger,tries+1);},250);
                    return;
                }
                e.autoProgressWaitingForVariable=false;
                const reason=e.blocked(snapshot);
                if(reason){e.status=reason;e.render();return;}
                if(!this.shouldSchedule(snapshot))return;
                e.run({automatic:true}).catch(()=>{});
            },delay);
        }
        async aroundRun(next,_options={}){
            let snapshot=null;try{snapshot=this.engine.snapshot();}catch(_){}
            const result=await next();
            if(result===true)this.markRun(snapshot);
            return result;
        }
        toggle(){
            const e=this.engine;e.config.autoProgress=!e.config.autoProgress;
            if(!e.config.autoProgress){
                if(e.timer){clearTimeout(e.timer);e.timer=null;}e.pending=false;e.status='自动推进已关闭 · 可手动推进';
            }else{this.resetCycle();e.status='自动推进已开启';}
            e.saveConfig();e.render(true);return e.config.autoProgress;
        }
        mountTopControl(){
            const e=this.engine;if(!e.panel)return;
            const header=e.panel.querySelector('header'),run=header?.querySelector('[data-action="run"]');if(!header||!run)return;
            let button=header.querySelector('[data-auto-progress-toggle-top]');
            if(!button){
                button=e.host.document.createElement('button');button.type='button';button.className='we-btn we-switch';button.dataset.autoProgressToggleTop='';
                run.insertAdjacentElement('beforebegin',button);
                button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();this.toggle();});
            }
            button.classList.toggle('on',e.config.autoProgress===true);button.setAttribute('aria-pressed',String(e.config.autoProgress===true));
            button.title=e.config.autoProgress?'自动推进已开启':'自动推进已关闭';
            button.innerHTML='<span>自动推进</span><span class="we-switch-track"><i></i></span>';
        }
        mountIntervalSetting(){
            const e=this.engine;if(e.tab!=='请求检查'||!e.panel)return;
            const main=e.panel.querySelector('main');if(!main)return;
            let section=main.querySelector('[data-auto-progress-interval-setting]');
            if(!section){
                section=e.host.document.createElement('section');section.className='we-section';section.dataset.autoProgressIntervalSetting='';
                const retry=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='失败自动重试');
                if(retry)main.insertBefore(section,retry);else main.prepend(section);
            }
            const enabled=e.config.autoProgress===true,interval=this.interval();
            section.innerHTML='<div class="we-section-head"><h2>自动推进频率</h2><small>正文轮次</small></div>'
                +'<div class="we-config-row"><label>推进间隔 <input data-auto-progress-interval type="number" min="1" max="20" value="'+interval+'" '+(enabled?'':'disabled')+'> 轮</label><span class="we-muted">'
                +(enabled?'首次符合条件、或检测到世界后台尚未建立时立即推进；之后按正文回复轮次触发。2 = 第1、3、5…次正文后推进；1 = 每轮推进。战斗中不计轮数。':'自动推进已关闭，此设置不参与调度。')+'</span></div>';
            const input=section.querySelector('[data-auto-progress-interval]');
            input?.addEventListener('change',()=>{
                const value=Math.max(1,Math.min(20,Number(input.value)||2));
                e.config.autoProgressInterval=Math.round(value);input.value=String(e.config.autoProgressInterval);
                this.resetCycle();e.saveConfig();e.status='自动推进间隔已设为 '+e.config.autoProgressInterval+' 轮';e.render(true);
            });
        }
        afterRender(){
            this.engine.panel?.querySelector('[data-auto-progress-setting]')?.remove();
            this.mountTopControl();this.mountIntervalSetting();
        }
    }
    const WORLD_REPLAY_VERSION=1;
    const WORLD_REPLAY_SCOPES=[
        ['世界','时间'],['世界','货币'],['世界','历法'],['世界',PATH],['世界','因果轨道'],['世界','势力'],['世界','探索'],
        ['世界','异端雷达','名单'],['世界','稳定'],['传闻'],['资产'],['关系列表']
    ];

    class WorldReplayService {
        constructor(engine){this.engine=engine;}
        initialize(){
            const e=this.engine;
            e.autoProgressTriggerEventsBound=false;e.autoProgressWaitingForVariable=false;e.worldReplayEventBound=false;
            e.worldReplayPendingFingerprint='';e.worldReplayManualForce=false;e.worldReplayImmediateRetrying=false;e.worldReplayIdleWaiters=[];
        }
        fingerprintParts(fingerprint){
            try{const parsed=JSON.parse(String(fingerprint||''));return {chat:String(parsed?.[0]??''),id:Number(parsed?.[1]),swipe:Number(parsed?.[2]||0),digest:String(parsed?.[3]??'')};}
            catch(_){return {chat:'',id:NaN,swipe:0,digest:''};}
        }
        sameFloor(left,right){
            const a=this.fingerprintParts(left),b=this.fingerprintParts(right);
            return !!a.chat&&a.chat===b.chat&&Number.isFinite(a.id)&&a.id===b.id;
        }
        currentMessage(){
            const e=this.engine,getMessages=e.fn('getChatMessages');if(!getMessages)return null;
            let message;try{message=getMessages(-1)?.[0];}catch(_){return null;}
            if(!message)return null;
            const id=Number(message.message_id!=null?message.message_id:message.id);
            if(!Number.isInteger(id)||id<0)return null;
            const role=String(message.role||'').toLowerCase();if(role==='user'||message.is_user===true)return null;
            const text=String(message.message!=null?message.message:message.mes||'');if(!text.trim())return null;
            const chatFn=e.fn('getCurrentChatId');let chat='';
            try{chat=String(chatFn?chatFn():(e.host.SillyTavern?.getContext?.()?.chatId??''));}catch(_){}
            if(!chat)return null;
            return {id,message,text,fingerprint:JSON.stringify([chat,id,message.swipe_id||0,digest(text)])};
        }
        pathAllowed(path){
            if(!Array.isArray(path)||!path.length||path.some(key=>forbidden.has(String(key))))return false;
            return WORLD_REPLAY_SCOPES.some(scope=>scope.every((key,index)=>path[index]===key));
        }
        atomicPath(path){
            if(path[0]==='世界'&&path[1]===PATH&&path.length>=4)return true;
            if(path[0]==='世界'&&['势力','探索'].includes(path[1])&&path.length>=3)return true;
            if(path[0]==='世界'&&path[1]==='因果轨道'&&path[2]==='偏移记录'&&path.length>=4)return true;
            if(path[0]==='传闻'&&path.length>=3)return true;
            if(path[0]==='资产'&&path.length>=2)return true;
            if(path[0]==='关系列表'&&path.length>=3)return true;
            return false;
        }
        collect(before,after,path,operations){
            if(same(before,after))return;
            if(after===undefined){operations.push({op:'remove',path:copy(path)});return;}
            if(before===undefined||this.atomicPath(path)||!plain(before)||!plain(after)){operations.push({op:'set',path:copy(path),value:copy(after)});return;}
            const keys=new Set([...Object.keys(before),...Object.keys(after)]);
            for(const key of keys){if(!forbidden.has(key))this.collect(before[key],after[key],path.concat(key),operations);}
        }
        collectRerunBaseline(before,after,path,records){
            if(same(before,after))return;
            if(before===undefined||after===undefined||this.atomicPath(path)||!plain(before)||!plain(after)){
                records.push({
                    path:copy(path),
                    before:before===undefined?{exists:false}:{exists:true,value:copy(before)},
                    after:after===undefined?{exists:false}:{exists:true,value:copy(after)}
                });
                return;
            }
            const keys=new Set([...Object.keys(before),...Object.keys(after)]);
            for(const key of keys){if(!forbidden.has(key))this.collectRerunBaseline(before[key],after[key],path.concat(key),records);}
        }
        buildPackage(beforeStat,afterStat,fingerprint){
            if(!plain(beforeStat)||!plain(afterStat)||!fingerprint)return null;
            const operations=[],rerunBaseline=[];
            for(const scope of WORLD_REPLAY_SCOPES){
                this.collect(get(beforeStat,scope),get(afterStat,scope),scope,operations);
                this.collectRerunBaseline(get(beforeStat,scope),get(afterStat,scope),scope,rerunBaseline);
            }
            return operations.length?{version:WORLD_REPLAY_VERSION,fingerprint:String(fingerprint),operations,rerunBaseline}:null;
        }
        readPath(stat,path){
            let cursor=stat;
            for(const key of path){
                if(!plain(cursor)||!Object.prototype.hasOwnProperty.call(cursor,key))return {exists:false,value:undefined};
                cursor=cursor[key];
            }
            return {exists:true,value:cursor};
        }
        restoreManualBaseline(stat,packageValue){
            const records=packageValue?.rerunBaseline;
            if(!plain(stat)||!plain(packageValue)||packageValue.version!==WORLD_REPLAY_VERSION||!Array.isArray(records))return 0;
            for(const record of records){
                const path=Array.isArray(record?.path)?record.path.map(String):[];
                if(!this.pathAllowed(path)||!plain(record?.before)||!plain(record?.after))return 0;
            }
            let restored=0;
            for(const record of records){
                const path=record.path.map(String),current=this.readPath(stat,path),after=record.after;
                const matchesAfter=after.exists===true
                    ?current.exists===true&&same(current.value,after.value)
                    :current.exists===false;
                if(!matchesAfter)continue;
                let parent=stat;
                for(const key of path.slice(0,-1)){
                    if(!plain(parent[key]))parent[key]={};
                    parent=parent[key];
                }
                const key=path.at(-1),before=record.before;
                if(before.exists===true)parent[key]=copy(before.value);
                else delete parent[key];
                restored++;
            }
            return restored;
        }
        applyPackage(stat,packageValue){
            if(!plain(stat)||!plain(packageValue)||packageValue.version!==WORLD_REPLAY_VERSION||!Array.isArray(packageValue.operations))return false;
            for(const operation of packageValue.operations){
                const path=Array.isArray(operation?.path)?operation.path.map(String):[];
                if(!this.pathAllowed(path)||!['set','remove'].includes(operation?.op))return false;
            }
            for(const operation of packageValue.operations){
                const path=operation.path.map(String);let parent=stat;
                for(const key of path.slice(0,-1)){if(!plain(parent[key]))parent[key]={};parent=parent[key];}
                const key=path.at(-1);if(operation.op==='remove')delete parent[key];else parent[key]=copy(operation.value);
            }
            return true;
        }
        markEventInternal(){
            const target=this.engine.host;if(!target)return;
            const had=Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target.__samsaraUIMutation;
            target.__samsaraUIMutation=true;
            setTimeout(()=>{try{if(had)target.__samsaraUIMutation=previous;else delete target.__samsaraUIMutation;}catch(_){}},0);
        }
        reprocessContext(variables,before){
            const e=this.engine;if(!plain(variables?.stat_data))return null;
            const current=this.currentMessage();if(!current)return null;
            const mvu=e.env.Mvu||e.host.Mvu;let raw;
            try{raw=mvu?.getMvuData?.({type:'message',message_id:current.id});}catch(_){return null;}
            if(!plain(raw)||plain(raw.stat_data))return null;
            const beforeStat=plain(before?.stat_data)?before.stat_data:null,replay=raw.__samsaraWorldReplay;
            const replayMatches=plain(replay)&&String(replay.fingerprint||'')===current.fingerprint;
            const beforeHandled=String(beforeStat?.世界?.[PATH]?.已处理楼层||'');
            if(!replayMatches&&beforeHandled!==current.fingerprint)return null;
            return {current,raw,mvu,beforeStat};
        }
        setCycleRecovered(fingerprint,stat){
            const e=this.engine,auto=e.services?.autoProgress;
            e.autoProgressCycleKey=auto?.contextKey({fingerprint,stat})||'';
            e.autoProgressHasRun=true;e.autoProgressRoundsSinceRun=0;e.autoProgressLastSeenFingerprint=fingerprint;e.autoProgressDueFingerprint=fingerprint;
        }
        clearHandledForRetry(stat,fingerprint){
            const state=stat?.世界?.[PATH];if(!plain(state))return;
            if(!fingerprint||String(state.已处理楼层||'')===String(fingerprint)){state.已处理楼层='';state.已处理时间='';}
        }
        legacyPackage(context,variables){
            const beforeStat=context?.beforeStat;
            if(!plain(beforeStat)||!plain(variables?.stat_data))return null;
            if(String(beforeStat?.世界?.[PATH]?.已处理楼层||'')!==context.current.fingerprint)return null;
            return this.buildPackage(variables.stat_data,beforeStat,context.current.fingerprint);
        }
        waitForIdle(){
            const e=this.engine;if(!e.busy)return Promise.resolve();
            if(!Array.isArray(e.worldReplayIdleWaiters))e.worldReplayIdleWaiters=[];
            return new Promise(resolve=>e.worldReplayIdleWaiters.push(resolve));
        }
        resolveIdleWaiters(){
            const e=this.engine,waiters=Array.isArray(e.worldReplayIdleWaiters)?e.worldReplayIdleWaiters.splice(0):[];
            for(const resolve of waiters){try{resolve();}catch(_){}}
        }
        async immediateRetry(context,variables){
            const e=this.engine;
            if(!context?.mvu?.replaceMvuData||!plain(variables?.stat_data))return false;
            if(e.busy){e.cancel();await this.waitForIdle();}
            if(e.disposed||e.config.autoProgress!==true||!e.isEnabled())return false;
            const seed=Object.assign({},copy(context.raw),copy(variables));
            this.clearHandledForRetry(seed.stat_data,context.current.fingerprint);delete seed.__samsaraWorldReplay;this.markEventInternal();
            const previous=e.worldReplayImmediateRetrying===true;e.worldReplayImmediateRetrying=true;
            try{await context.mvu.replaceMvuData(seed,{type:'message',message_id:context.current.id});}
            finally{e.worldReplayImmediateRetrying=previous;}
            const result=await e.run({automatic:true});if(result!==true)return false;
            let finalRaw;try{finalRaw=context.mvu.getMvuData({type:'message',message_id:context.current.id});}catch(_){finalRaw=null;}
            if(plain(finalRaw?.stat_data))variables.stat_data=copy(finalRaw.stat_data);
            if(finalRaw&&Object.prototype.hasOwnProperty.call(finalRaw,'__samsaraWorldReplay'))variables.__samsaraWorldReplay=copy(finalRaw.__samsaraWorldReplay);
            return true;
        }
        async handleVariableEvent(variables,before){
            const e=this.engine;
            if(e.worldReplayImmediateRetrying===true)return false;
            const context=this.reprocessContext(variables,before);
            if(context){
                const stored=context.raw.__samsaraWorldReplay,valid=plain(stored)&&String(stored.fingerprint||'')===context.current.fingerprint;
                const legacy=!valid?this.legacyPackage(context,variables):null,replay=valid?stored:legacy;
                if(replay&&this.applyPackage(variables.stat_data,replay)){
                    this.markEventInternal();variables.__samsaraWorldReplay=copy(replay);this.setCycleRecovered(context.current.fingerprint,variables.stat_data);
                    e.status=legacy?'已从旧楼状态重建并恢复世界推进结果 · 未重新调用 AI':'已恢复本楼世界推进结果 · 未重新调用 AI';e.render();return true;
                }
                this.clearHandledForRetry(variables.stat_data,context.current.fingerprint);delete variables.__samsaraWorldReplay;this.setCycleRecovered(context.current.fingerprint,variables.stat_data);
                if(e.config.autoProgress===true&&e.isEnabled()){
                    e.status='变量已重处理 · 正在重新推进本楼';e.render();
                    return await this.immediateRetry(context,variables);
                }
                e.status=e.config.autoProgress!==true?'变量已重处理 · 旧楼缺少恢复快照；自动推进已关闭，请手动推进':'变量已重处理 · 世界推进已关闭，未自动重建';
                e.render();return false;
            }
            if(!plain(variables))return false;
            const pending=String(e.worldReplayPendingFingerprint||''),handled=String(variables?.stat_data?.世界?.[PATH]?.已处理楼层||'');
            if(pending&&handled===pending&&plain(before?.stat_data)&&plain(variables.stat_data)){
                // 主世界提交已经按本轮真正的推演基线生成 replay。尤其手动重推时，
                // 当前 MVU before 仍是“不满意的旧结果”，不能在变量事件里用 B→C 覆盖掉 A→C。
                // 只有调用方没有随主提交带来有效 replay 时，才退回事件 before 现场重建。
                const supplied=variables.__samsaraWorldReplay;
                const suppliedValid=plain(supplied)&&String(supplied.fingerprint||'')===pending&&Array.isArray(supplied.operations);
                const replay=suppliedValid?supplied:this.buildPackage(before.stat_data,variables.stat_data,pending);
                if(replay&&!suppliedValid)variables.__samsaraWorldReplay=replay;
                if(e.worldReplayManualForce)this.markEventInternal();
                return !!replay;
            }
            const timeHandled=await e.services?.timeOwnership?.afterReplayVariableEvent?.(variables,before,false);
            return timeHandled===true;
        }
        adjustSnapshot(snapshot){
            const e=this.engine;
            if(e.worldReplayManualForce&&snapshot?.fingerprint&&snapshot?.stat?.世界?.[PATH]?.已处理楼层===snapshot.fingerprint){
                const replay=snapshot?.raw?.__samsaraWorldReplay;
                const restored=plain(replay)&&String(replay.fingerprint||'')===String(snapshot.fingerprint)
                    ?this.restoreManualBaseline(snapshot.stat,replay):0;
                if(restored>0)snapshot.manualRerun={restored:true,count:restored};
                snapshot.stat.世界[PATH]=Object.assign(emptyState(),snapshot.stat.世界[PATH]||{});
                snapshot.stat.世界[PATH].已处理楼层='';snapshot.stat.世界[PATH].已处理时间='';
            }
            return snapshot;
        }
        async aroundRun(next,options={}){
            const e=this.engine;let current=null;
            try{current=e.snapshot();}catch(_){}
            const fingerprint=String(current?.fingerprint||''),automatic=plain(options)&&options.automatic===true;
            const previousPending=e.worldReplayPendingFingerprint,previousManual=e.worldReplayManualForce;
            e.worldReplayPendingFingerprint=fingerprint;e.worldReplayManualForce=!automatic;
            try{return await next();}
            finally{e.worldReplayPendingFingerprint=previousPending;e.worldReplayManualForce=previousManual;this.resolveIdleWaiters();}
        }
        afterInit(){this.bindEvents();}
        bindEvents(){
            const e=this.engine,on=e.fn('eventOn'),events=e.env.tavern_events||e.host.tavern_events||{};
            if(!e.autoProgressTriggerEventsBound&&on&&events){
                const bindAuto=(event,source)=>{
                    if(!event)return false;
                    const off=on(event,()=>e.schedule(source));
                    if(typeof off==='function')e.unsub.push(off);else if(off&&off.stop)e.unsub.push(()=>off.stop());
                    return true;
                };
                let bound=false;bound=bindAuto(events.GENERATION_ENDED,'generation-ended')||bound;bound=bindAuto(events.MESSAGE_RECEIVED,'message-received')||bound;
                if(bound)e.autoProgressTriggerEventsBound=true;
            }
            if(!e.worldReplayEventBound){
                const mvu=e.env.Mvu||e.host.Mvu,first=e.fn('eventMakeFirst')||on,event=mvu?.events?.VARIABLE_UPDATE_ENDED;
                if(first&&event){
                    const off=first(event,(variables,before)=>Promise.resolve(this.handleVariableEvent(variables,before)).catch(error=>{try{console.error('[世界推进 replay]',error);}catch(_){}throw error;}));
                    if(typeof off==='function')e.unsub.push(off);else if(off&&off.stop)e.unsub.push(()=>off.stop());
                    e.worldReplayEventBound=true;
                }
            }
        }
    }
    class WorldTimeOwnershipFeature extends WorldRequestFeature {
        constructor(engine,policy=DEFAULT_WORLD_TIME_POLICY){super(engine);this.policy=policy||DEFAULT_WORLD_TIME_POLICY;}
        async afterBuildRequest(request,base){
            try{
                const payload=JSON.parse(request.input),needsInitialization=this.policy.unset(base?.stat?.世界?.时间);
                payload.世界时间维护={
                    当前时间:String(base?.stat?.世界?.时间||''),
                    是否需要初始化:needsInitialization,
                    所有权:'世界推进独占写入；变量 AI 只读',
                    初始化锚定:needsInitialization?{
                        任务世界:String(base?.stat?.世界?.名称||''),
                        当前阶段:String(base?.stat?.世界?.因果轨道?.当前阶段||''),
                        当前地点:String(base?.stat?.世界?.地点||''),
                        依据顺序:['最新已确认正文','当前阶段与当前地点','已读取时间线/年表/章节资料','模型已有原著知识','谨慎推断'],
                        禁止:'不得把下一宏观节点、任务期限或未来事件的日期直接当成当前世界时间；无法唯一定位时保持较粗时间精度。'
                    }:undefined,
                    正文时间职责:'若最新正文明确发生过夜、数小时后、次日、跨日旅行或新的日期/时段，必须输出顶层“时间”同步世界时钟；不能保留旧时钟再提交已经发生于新时点的事实。',
                    精确日期格式:'顶层时间及所有事件/历史/传播等日期，只要精确到月日就使用 {yyy}年-{mm}月-{dd}日-{时间段}。月份必须是数字；不要用自定义月份名称替代数字月。',
                    时间段候选:['凌晨','黎明','清晨','早晨','上午','中午','午后','下午','傍晚','入夜','晚上','深夜'],
                    推进原则:'时间段是粗粒度锚点，不是每轮计数器；没有足够时间流逝跨过当前时段就保持原值，只有正文或明确时间资料表明确实经过合理时长才推进。'
                };
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            request.schema=copy(WORLD_RESULT_SCHEMA);
            if(request.manifest)request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema);
            return request;
        }
        afterReplayVariableEvent(variables,before,handled){
            const e=this.engine;
            if(handled||e.committing||!e.isEnabled()||!plain(variables?.stat_data)||!plain(before?.stat_data))return handled;
            const previous=String(before?.stat_data?.世界?.时间??''),incoming=String(variables?.stat_data?.世界?.时间??'');
            if(previous===incoming)return handled;
            const wasSpace=before?.stat_data?.系统状态?.是否在主神空间===true,isSpace=variables?.stat_data?.系统状态?.是否在主神空间===true;
            if(wasSpace!==isSpace){
                const enteringWorld=wasSpace&&!isSpace,returningToSpace=!wasSpace&&isSpace;
                const mainSpaceTime=/^轮回历\d+年-\d{2}月-\d{2}日-(?:凌晨|黎明|清晨|早晨|上午|中午|午后|下午|傍晚|入夜|晚上|深夜)$/.test(incoming);
                if((enteringWorld&&this.policy.unset(incoming))||(returningToSpace&&mainSpaceTime))return handled;
            }
            if(!plain(variables.stat_data.世界))variables.stat_data.世界={};
            variables.stat_data.世界.时间=previous;
            return true;
        }
    }
    class WorldNpcAuditPolicy {
        constructor(engine,selection=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY){this.engine=engine;this.selection=selection||DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;this.boundPanel=null;}
        initialize(){
            const e=this.engine,had=Object.hasOwn(e.config,'npcBuildAuditEnabled');
            e.config.npcBuildAuditEnabled=e.config.npcBuildAuditEnabled===true;
            this.sync();if(!had)e.saveConfig();
        }
        sync(){
            const e=this.engine;
            NPC_BUILD_AUDIT_FEATURE_ENABLED=e.config.npcBuildAuditEnabled===true;
            this.syncWorldbookSelection();
            return NPC_BUILD_AUDIT_FEATURE_ENABLED;
        }
        enabled(){return this.engine.config.npcBuildAuditEnabled===true;}
        isWorldbook(entry){return ['实体生成规则','NPC生成规则','状态协议'].includes(this.selection.normalizeTitle(entry.title));}
        syncWorldbookSelection(catalogue=this.engine.bookCatalogue||[]){
            const e=this.engine,matches=catalogue.filter(entry=>this.isWorldbook(entry));if(!matches.length)return;
            const sync=settings=>{
                if(!settings)return;
                const previous=settings.selectedEntries;
                let selected=Array.isArray(previous)?copy(previous):catalogue.filter(entry=>!entry.technical&&this.selection.matches(entry,previous)).map(entry=>JSON.stringify([entry.book,entry.id]));
                selected=selected.filter(raw=>!matches.some(entry=>this.selection.matches(entry,[raw])));
                if(this.enabled())for(const entry of matches)if(!entry.technical)selected.push(JSON.stringify([entry.book,entry.id]));
                if(JSON.stringify(previous)!==JSON.stringify(selected))settings.selectedEntries=selected;
            };
            sync(e.config);sync(e.promptDraft);sync(e.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)?.settings);
        }
        async afterCatalogue(result){
            const e=this.engine;e.bookCatalogue=result;this.syncWorldbookSelection(result);e.saveConfig();return result;
        }
        afterPromptSettings(){this.syncWorldbookSelection();this.engine.saveConfig();}
        setEnabled(value){
            const e=this.engine,wasBusy=!!e.busy;if(wasBusy)e.cancel();
            e.config.npcBuildAuditEnabled=value===true;this.sync();e.saveConfig();
            e.status=(e.config.npcBuildAuditEnabled?'NPC构筑审计已启用':'NPC构筑审计已关闭')+(wasBusy?' · 已停止当前推演':'');
            e.render(true);return e.config.npcBuildAuditEnabled;
        }
        async afterBuildRequest(request){this.sync();return request;}
        syncDerivedSchemaFields(target,checked) {
            const derived=new Set(['真属性','最终属性','强化']);
            if(Array.isArray(target)&&Array.isArray(checked)){
                const count=Math.min(target.length,checked.length);
                for(let i=0;i<count;i++)this.syncDerivedSchemaFields(target[i],checked[i]);
                return;
            }
            if(!plain(target)||!plain(checked))return;
            for(const key of derived){
                if(Object.hasOwn(checked,key))target[key]=checked[key]===undefined?undefined:copy(checked[key]);
                else if(Object.hasOwn(target,key))delete target[key];
            }
            for(const key of Object.keys(checked)){
                if(derived.has(key)||!Object.hasOwn(target,key))continue;
                this.syncDerivedSchemaFields(target[key],checked[key]);
            }
        }
        alignSchemaOrder(checked,target) {
            if(Array.isArray(checked))return checked.map((value,index)=>this.alignSchemaOrder(value,Array.isArray(target)?target[index]:undefined));
            if(plain(checked)&&plain(target)){
                const out={};
                for(const key of Object.keys(target))if(Object.hasOwn(checked,key))out[key]=this.alignSchemaOrder(checked[key],target[key]);
                for(const key of Object.keys(checked))if(!Object.hasOwn(out,key))out[key]=this.alignSchemaOrder(checked[key],target[key]);
                return out;
            }
            return checked;
        }
        async aroundRun(next){
            const e=this.engine;this.sync();
            const samsara=e.host&&e.host.Samsara,validate=samsara&&samsara.validateWorldState;
            if(typeof validate!=='function')return next();
            const policy=this;
            const wrapped=function(stat){
                const checked=validate.call(samsara,stat);
                policy.syncDerivedSchemaFields(stat,checked);
                return policy.alignSchemaOrder(checked,stat);
            };
            samsara.validateWorldState=wrapped;
            try{return await next();}
            finally{if(samsara.validateWorldState===wrapped)samsara.validateWorldState=validate;}
        }
        compactFooter(){
            const e=this.engine;if(!e.panel)return;
            const footer=e.panel.querySelector('footer');if(!footer)return;
            if(e.style&&!e.style.textContent.includes('.we-footer-status{')){
                e.style.textContent+='\n#sam-world-engine footer{align-items:center;min-width:0;overflow:hidden}\n'
                    +'#sam-world-engine footer .we-footer-status{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n'
                    +'#sam-world-engine footer .we-footer-meta{flex:0 0 auto;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}\n'
                    +'@media(max-width:760px){#sam-world-engine footer .we-footer-meta{max-width:42%}}\n';
            }
            let status=footer.querySelector('.we-footer-status'),meta=footer.querySelector('.we-footer-meta');
            if(!status){
                const legacyStatus=footer.querySelector('span'),legacyMeta=footer.querySelector('small');
                const rawStatus=String(legacyStatus?.textContent||e.status||'').trim(),rawMeta=String(legacyMeta?.textContent||'').trim();
                status=e.host.document.createElement('span');status.className='we-footer-status';status.textContent=rawStatus;status.title=rawStatus;
                meta=e.host.document.createElement('span');meta.className='we-footer-meta';
                const version=rawMeta.match(/build\s*v?[\d.]+/i)||rawMeta.match(/\bv?\d+(?:\.\d+){1,3}\b/i);
                meta.textContent=version?version[0]:'世界推进';meta.title=rawMeta;footer.replaceChildren(status,meta);
            }else{
                status.title=String(status.textContent||e.status||'').trim();
                if(meta&&!meta.title)meta.title=String(meta.textContent||'').trim();
            }
        }
        renderSetting(){
            const e=this.engine;if(!e.panel)return;
            const enabled=this.enabled(),main=e.panel.querySelector('main');if(!main)return;
            main.querySelector('[data-npc-audit-setting]')?.remove();
            if(e.tab==='设置'){
                const block=e.host.document.createElement('section');block.className='we-section';block.setAttribute('data-npc-audit-setting','');
                block.innerHTML='<div class="we-section-head"><h2>NPC构筑审计 <span class="we-pill future">实验性功能</span></h2><small>备选功能 · 默认关闭</small></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>自动补全热 NPC 构筑</b><small>关闭时不扫描或补写职业、血统、装备、技能、形态；关系仍按实际剧情正常稀疏同步。开启后才对热 NPC 执行构筑缺口审计。实体生成规则、NPC生成规则、状态协议的资料勾选随此开关同步。</small></div>'
                    +'<div class="we-setting-actions"><button class="we-setting-btn we-switch '+(enabled?'on':'')+'" data-action="npc-audit-toggle" aria-pressed="'+enabled+'"><span>'+(enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>';
                const sections=Array.from(main.children),modelSection=sections.find(section=>section.querySelector?.('h2')?.textContent?.trim()==='模型接口');
                main.insertBefore(block,modelSection||null);
            }else if(e.tab==='角色管理'&&!enabled){
                for(const note of main.querySelectorAll('.we-muted'))if(note.textContent.includes('进入世界推进请求的热人物会由后台优先补齐缺口'))note.textContent='自动构筑审计当前关闭；此处只显示诊断，可在“设置”中临时启用自动补全。';
            }
        }
        bindPanel(){
            const e=this.engine,panel=e.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;this.compactFooter();
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="npc-audit-toggle"]');
                if(!button||!panel.contains(button))return;
                this.setEnabled(!this.enabled());
            });
        }
        afterRender(){this.renderSetting();this.compactFooter();}
        dispose(){this.boundPanel=null;}
    }
    class WorldHistoryLifecycle {
        constructor(engine,policy=DEFAULT_WORLD_HISTORY_MEMORY_POLICY){this.engine=engine;this.policy=policy||DEFAULT_WORLD_HISTORY_MEMORY_POLICY;this.boundPanel=null;}
        initialize(){
            const e=this.engine;let dirty=false;
            if(!Object.hasOwn(e.config,'sendHistoryToProse')){e.config.sendHistoryToProse=false;dirty=true;}
            else e.config.sendHistoryToProse=e.config.sendHistoryToProse===true;
            e.historyMaintenanceBusy=false;e.lastHistoryMaintenance='';
            if(dirty)e.saveConfig();
        }
        setSendToProse(value){
            const e=this.engine;e.config.sendHistoryToProse=value===true;e.saveConfig();e.render();return e.config.sendHistoryToProse;
        }
        proseMemory(stat){return this.policy.project(stat?.世界?.[PATH]||{});}
        async requestSummary(world,batch,outputLevel){
            const e=this.engine,saved=e.lastTransportInfo;
            try{
                const system=e.promptRegistry?.historySystem?.()||HISTORY_MEMORY_SYSTEM;
                const prompt=this.policy.prompt(world,batch,outputLevel);
                const input=e.promptRegistry?.historyInput?.(prompt)||prompt;
                const raw=await e.requestAI(system,input,{schema:HISTORY_MEMORY_SCHEMA,schemaName:'samsara_world_history_summary_v1',structured:'auto',temperature:0.2});
                return this.policy.parseReply(raw);
            }finally{e.lastTransportInfo=saved;}
        }
        beforeWorldCommit(next,context={}){
            const e=this.engine,summary=String(context.worldResult?.摘要||context.reply?.summary||e.lastWorldResult?.摘要||'').trim();
            const messageId=Number(context.messageId),backend=next?.世界?.[PATH];
            if(!summary||!Number.isInteger(messageId)||!plain(backend))return false;
            if(!plain(backend.历史))backend.历史={};if(!plain(backend.历史总结))backend.历史总结={};
            const key=this.policy.leafKey(messageId),record={时间:String(next.世界?.时间||backend.已处理时间||context.baseStat?.世界?.时间||''),事实:summary,关联事件:[]};
            const previous=backend.历史[key];
            if(plain(previous)&&String(previous.时间||'')===record.时间&&String(previous.事实||'')===record.事实)return false;
            backend.历史[key]=record;
            const invalidated=this.policy.invalidateAncestors(backend,'历史:'+key);
            e.lastHistoryMaintenance='近期历史已更新'+(invalidated.length?' · 旧总结失效 '+invalidated.length+' 个':'');
            return true;
        }
        async maintain(){
            const e=this.engine;if(e.historyMaintenanceBusy)return 0;
            e.historyMaintenanceBusy=true;
            const previousStatus=e.status;let made=0,failed='';
            try{
                const snapshot=e.snapshot(),stat=copy(snapshot.stat),backend=stat?.世界?.[PATH];
                if(!plain(backend))return 0;
                if(!plain(backend.历史总结))backend.历史总结={};
                const startDigest=this.policy.digest(backend);
                for(let level=0;level<32;level++){
                    const batch=this.policy.batchForLevel(backend,level);if(!batch.length)continue;
                    const outputLevel=level+1;e.status='整理长期历史记忆 · L'+outputLevel;e.render();
                    let summary='';
                    try{summary=await this.requestSummary(stat.世界,batch,outputLevel);}
                    catch(error){failed=String(error?.message||error);break;}
                    const key=this.policy.nextKey(backend,outputLevel);
                    backend.历史总结[key]={
                        层级:outputLevel,摘要:summary,子项:batch.map(node=>node.id),
                        起始时间:String(batch.find(node=>node.timeStart)?.timeStart||''),
                        结束时间:String([...batch].reverse().find(node=>node.timeEnd)?.timeEnd||''),
                        起始序位:Math.min(...batch.map(node=>Number(node.lo)||0).filter(n=>n>0)),
                        结束序位:Math.max(...batch.map(node=>Number(node.hi)||0).filter(n=>n>0)),
                        创建时间:String(stat.世界?.时间||'')
                    };made++;
                }
                if(!made)return 0;
                const current=e.snapshot(),currentBackend=current.stat?.世界?.[PATH];
                if(this.policy.digest(currentBackend)!==startDigest){e.lastHistoryMaintenance='历史在总结期间已变化，本次总结结果丢弃，下轮重试';return 0;}
                const validate=e.host.Samsara&&e.host.Samsara.validateWorldState,next=validate?validate(stat):stat,result=current.raw;
                result.stat_data=next;e.committing=true;
                await current.mvu.replaceMvuData(result,{type:'message',message_id:current.id});
                e.lastHistoryMaintenance='新增 '+made+' 个历史总结节点';return made;
            }finally{
                e.committing=false;if(failed)e.lastHistoryMaintenance='历史总结稍后重试：'+failed;
                e.status=previousStatus+(made?' · 历史总结+'+made:(failed?' · 历史总结待重试':''));
                e.render();e.historyMaintenanceBusy=false;
            }
        }
        async aroundRun(next){
            const e=this.engine,result=await next();
            if(result===true){
                try{await this.maintain();}
                catch(error){e.lastHistoryMaintenance='历史总结稍后重试：'+String(error?.message||error);try{console.warn('[世界推进] '+e.lastHistoryMaintenance);}catch(_){}}
            }
            return result;
        }
        bindPanel(){
            const e=this.engine,panel=e.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="history-prose-toggle"]');
                if(!button||!panel.contains(button))return;
                event.preventDefault();this.setSendToProse(e.config.sendHistoryToProse!==true);
            });
        }
        dispose(){this.boundPanel=null;}
    }
    class WorldSoftMaintenanceFeature extends WorldRequestFeature {
        async afterBuildRequest(request,_base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            if(plain(payload?.传闻维护?.公开传闻)){
                for(const category of RUMOR_PUBLIC_CATEGORIES){
                    const item=payload.传闻维护.公开传闻[category];
                    if(item&&Number(item.当前数量)===0)item.为空补足=1;
                }
            }
            payload.验收策略={
                模式:'分级验收',
                硬错误:'Schema、非法状态、因果引用损坏、明确时间轴冲突',
                软维护:'事件排期补全、传闻补齐、传播复核；可跨轮渐进完成，不得拖死整轮'
            };
            request.input=JSON.stringify(payload,null,2);
            request.manifest=Object.assign({},request.manifest,{
                验收策略:{模式:'分级验收',事件因果锚点可接受:true,传闻补齐:'软维护'}
            });
            return request;
        }
    }
    class WorldIntegrityRequestFeature extends WorldRequestFeature {
        async afterBuildRequest(request,_base){
            request.manifest=request.manifest||{};
            request.manifest.因果与时间约束={
                启用:true,
                因果偏移处理:'仅重大世界级变化时维护；无变化则省略',
                单条建议范围:'-12~-1 / +1~+15',
                宏观事实时间:'同一自然日允许；跨日未来拒绝',
                人物精确时间:'仅双方均为 HH:mm 时精确比较'
            };
            return request;
        }
    }
    class WorldActivityRequestFeature extends WorldRequestFeature {
        constructor(engine,policy=DEFAULT_WORLD_ACTIVITY_POLICY){super(engine);this.policy=policy||DEFAULT_WORLD_ACTIVITY_POLICY;}
        async afterBuildRequest(request,base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            const requirement=this.policy.requirement(base?.stat||{});
            payload.本轮世界活动交付={
                当前数量:copy(requirement.当前数量),
                初始化缺口:copy(requirement.初始化缺口),
                硬要求:[
                    '异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。',
                    '若地区为空：建立至少1个与当前地点/阶段相关的地区。',
                    '若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。',
                    '只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'
                ],
                软目标:['__PROMPT_REGISTRY_WORLD_ACTIVITY_SOFT__']
            };
            request.input=JSON.stringify(payload,null,2);
            request.timeline=Object.assign({},request.timeline,{世界活动要求:requirement});
            request.manifest=Object.assign({},request.manifest,{
                世界活动交付:{当前数量:copy(requirement.当前数量),初始化缺口:copy(requirement.初始化缺口)}
            });
            return request;
        }
    }
    class WorldDueEventFeature extends WorldRequestFeature {
        constructor(engine,policy=DEFAULT_WORLD_DUE_EVENT_POLICY){super(engine);this.policy=policy||DEFAULT_WORLD_DUE_EVENT_POLICY;}
        async afterBuildRequest(request,base){
            const due=this.policy.review(base?.stat||{});
            request.due=due;
            try{
                const payload=JSON.parse(request.input);
                payload.本轮必须复核的到期事件=due;
                request.input=JSON.stringify(payload,null,2);
            }catch(_){}
            return request;
        }
    }
    class WorldTaskAwarenessFeature extends WorldRequestFeature {
        constructor(engine,taskLedger=DEFAULT_WORLD_TASK_AWARENESS_SERVICE,selection=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY){super(engine);this.taskLedger=taskLedger||DEFAULT_WORLD_TASK_AWARENESS_SERVICE;this.selection=selection||DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;}
        restoreWorldbookSelection(catalogue){
            const engine=this.engine;
            if(engine.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id||!Array.isArray(catalogue))return false;
            const matches=catalogue.filter(entry=>this.selection.normalizeTitle(entry.title)===TASK_WORLD_BOOK_TITLE&&!entry.technical);
            let changed=false;
            if(matches.length){
                const selected=Array.isArray(engine.config.selectedEntries)?copy(engine.config.selectedEntries):[];
                for(const entry of matches){
                    const raw=JSON.stringify([entry.book,entry.id]);
                    if(!selected.includes(raw)){selected.push(raw);changed=true;}
                }
                engine.config.selectedEntries=selected;
            }
            const applied=Array.isArray(engine.config.builtinDefaultWorldbookExclusionsApplied)?engine.config.builtinDefaultWorldbookExclusionsApplied:[];
            const cleaned=applied.filter(title=>title!==TASK_WORLD_BOOK_TITLE);
            if(cleaned.length!==applied.length){engine.config.builtinDefaultWorldbookExclusionsApplied=cleaned;changed=true;}
            if(changed){
                const builtin=engine.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id);
                if(builtin?.settings)builtin.settings.selectedEntries=copy(engine.config.selectedEntries||[]);
                engine.saveConfig();
            }
            return changed;
        }
        async afterCatalogue(catalogue){
            this.restoreWorldbookSelection(catalogue);
            return catalogue;
        }
        async afterBuildRequest(request,_base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            request.manifest=Object.assign({},request.manifest,{
                任务感知:{任务数量:Object.keys(payload?.当前变量?.任务?.列表||{}).length,只读:true,副本成就:false}
            });
            return request;
        }
    }
    class WorldChronologyFeature extends WorldRequestFeature {
        constructor(engine,policy=DEFAULT_WORLD_CHRONOLOGY_POLICY,selection=DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY){super(engine);this.policy=policy||DEFAULT_WORLD_CHRONOLOGY_POLICY;this.selection=selection||DEFAULT_WORLD_KNOWLEDGE_SELECTION_POLICY;}
        initialize(){
            const engine=this.engine;
            if(!engine.config.activePromptDocumentId||engine.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                const upgraded=upgradeChronologyPreset(engine.config.preset);
                if(upgraded!==engine.config.preset){engine.config.preset=upgraded;engine.saveConfig();}
            }
        }
        async afterBuildRequest(request,base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            const state=base?.stat||{};
            const chronologyScan=[state?.世界?.名称,'原著','时间线','时间轴','年表','校历','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' ');
            const chronologyBooks=await this.engine.worldbook(chronologyScan,{timelineBackbone:true});
            const chronologyOnly=(chronologyBooks||[]).filter(book=>this.selection.isTimelineBackbone(book?.名称));
            const existing=Array.isArray(payload.世界书)?payload.世界书.map(String):[],merged=existing.slice(),seen=new Set(existing);
            for(const book of chronologyOnly){
                const content=String(book?.内容||'');
                if(content&&!seen.has(content)){seen.add(content);merged.push(content);}
            }
            payload.世界书=merged;
            this.policy.setGuard(state?.世界?.时间,merged);
            const next=payload?.时间线调度?.下一宏观节点||null;
            payload.时间线基准={
                当前世界时间:String(state?.世界?.时间||''),
                下一宏观节点:next?{名称:String(next.名称||''),当前排期:String(next.时间||'')}:null,
                原著时间资料:chronologyOnly.length?'已读取 '+chronologyOnly.length+' 条明确时间线/年表资料':'__PROMPT_REGISTRY_NO_EVIDENCE__',
                规划原则:{},
                要求:''
            };
            request.input=JSON.stringify(payload,null,2);
            const manifest=request.manifest||(request.manifest={});
            const rows=Array.isArray(manifest.世界书条目)?manifest.世界书条目:[];
            const rowKeys=new Set(rows.map(row=>String(row?.世界书||'')+'\u0000'+String(row?.条目ID||'')));
            for(const book of chronologyOnly){
                const key=String(book?.世界书||'')+'\u0000'+String(book?.条目ID||'');
                if(rowKeys.has(key))continue;
                rowKeys.add(key);
                rows.push({世界书:book?.世界书,条目ID:book?.条目ID,名称:book?.名称,估算Tokens:estimateTokens(book?.内容)});
            }
            manifest.世界书条目=rows;
            if(plain(manifest.世界书读取))manifest.世界书读取.实际读取=merged.length;
            manifest.原著时间轴={
                强制校准:true,
                校验模式:'已发生事实锁定；明确到日资料硬校验；月份、时段、顺序、条件与趋势软引导；已确认偏移只重构受影响节点',
                剧情原则:'原著是未受干预时的默认未来，不做强制命运修正',
                当前世界时间:String(state?.世界?.时间||''),
                时间线资料:chronologyOnly.map(book=>String(book?.名称||'')).filter(Boolean),
                下一宏观节点:next?String(next.名称||''):''
            };
            return request;
        }
    }
    class WorldRumorRequestFeature extends WorldRequestFeature {
        constructor(engine,rumor){super(engine);this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;}
        initialize(){
            const engine=this.engine;
            if(engine.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)return;
            const upgraded=this.rumor.upgradePreset(engine.config.preset);
            if(upgraded!==engine.config.preset){engine.config.preset=upgraded;engine.saveConfig();}
        }
        async afterBuildRequest(request,base){
            const maintenance=this.rumor.requirements(base?.stat||{});
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            if(Array.isArray(request.timeAnomalies))request.timeAnomalies=request.timeAnomalies.filter(item=>item?.类型!=='传闻维护');
            if(Array.isArray(payload.本轮必须修复的时间越界记录))payload.本轮必须修复的时间越界记录=payload.本轮必须修复的时间越界记录.filter(item=>item?.类型!=='传闻维护');
            payload.传闻维护={
                话题:copy(maintenance.话题||[]),
                公开传闻:copy(maintenance.公开传闻||{}),
                本轮必须复核的传播链:copy(maintenance.本轮必须复核的传播链||[]),
                取材边界:'__PROMPT_REGISTRY_RUMOR_SOURCE__',
                本轮公开传闻动作:maintenance.本轮公开传闻动作,
                刷新原因:copy(maintenance.刷新原因||[]),
                世界侧可传播事实:copy(maintenance.世界侧可传播事实||[]),
                本轮新公开事实:copy(maintenance.本轮新公开事实||[])
            };
            request.input=JSON.stringify(payload,null,2);
            request.rumorMaintenance=copy(maintenance);
            request.manifest=Object.assign({},request.manifest,{
                传闻维护:{
                    空分类:RUMOR_PUBLIC_CATEGORIES.filter(category=>maintenance.公开传闻?.[category]?.当前数量===0),
                    待复核传播:(maintenance.本轮必须复核的传播链||[]).map(item=>item.名称),
                    可传播候选:(maintenance.本轮新公开事实||[]).map(item=>item.名称)
                },
                传闻节流:{
                    模式:'世界侧事实驱动',
                    本轮动作:maintenance.本轮公开传闻动作,
                    刷新原因:copy(maintenance.刷新原因||[]),
                    正文直接取材:false,
                    软失败不重试:true
                }
            });
            return request;
        }
        hideHostOnlyDetails(root) {
            const sections=Array.from(root?.querySelectorAll?.('.we-section')||[]);
            const trade=sections.find(section=>section.querySelector('.we-section-head h2')?.textContent?.trim()==='情报交易');
            if(!trade)return 0;
            let removed=0;
            for(const detail of trade.querySelectorAll('details')){
                const summary=detail.querySelector('summary')?.textContent?.trim();
                if(summary==='主持人档案'){
                    detail.remove();
                    removed++;
                }
            }
            return removed;
        }

        afterRender(){
            if(this.engine.tab==='传闻')this.hideHostOnlyDetails(this.engine.panel?.querySelector?.('main'));
        }
    }
    class WorldNpcAuditPromptFeature {
        constructor(engine){this.engine=engine;}
        initialize(){
            const engine=this.engine,current=String(engine.config.npcAuditPrompt||'');
            const previousNarrativeDefault=current.includes('【角色管理 · NPC构筑审计】')
                &&current.includes('最低构筑：杂兵=血统1/装备2/技能1')
                &&(current.includes('审计级别只依据既有身份、职业、背景故事、态度体现的剧情份量判断')
                    ||current.includes('审计新增装备统一写状态=1'));
            if(!current.trim()||current===NPC_BUILD_AUDIT_RULES||previousNarrativeDefault){
                engine.config.npcAuditPrompt=NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT;
                if(plain(engine.config.promptRegistry))engine.config.promptRegistry.npcAudit=NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT;
            }
        }
    }
    const WORLD_PROMPT_RETRY_ACCEPTED_PLAN='严格按“补充清单”只补充或修正未通过的业务片段。已接受业务结果已经通过本地验收，默认全部保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。';
    const WORLD_PROMPT_RETRY_ACCEPTED='只补充或修正导致拒绝的业务片段。已接受业务结果默认保留，不要整份重写；同名实体只提交需要覆盖的字段。若某个本轮提案应撤回，用 操作=撤销本轮。仍只输出一个 WorldResult JSON。';
    const WORLD_PROMPT_RETRY_FRESH='修正格式或业务错误后重新输出一个 WorldResult JSON；不要解释错误，不要输出存储路径。';
    const WORLD_PROMPT_PROJECTION_GUIDANCE='非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。';
    const WORLD_PROMPT_REQUEST_SUMMARY='当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。';
    const WORLD_PROMPT_MANUAL_ADVANCE_GUIDANCE='这是玩家对本次手动世界推进的临时指导，只对本轮有效。优先满足玩家明确提出的推进、暂缓与修正要求；最新已确认正文事实高于本指导，不得为迎合要求篡改正文已经发生的事实。未涉及部分继续按既有规则正常推演；仍须遵守世界推进的数据所有权、WorldResult Schema、时间与引用约束、任务只读等程序契约。';
    const WORLD_PROMPT_MACRO_PLANNING='本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。';
    const WORLD_PROMPT_MACRO_ACCEPTANCE='按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。';
    const WORLD_PROMPT_DUE_REVIEW='软提醒：该事件已到计划/复核时间。条件与前因满足则转为进行中；若暂不发生，可保持待发生并优先填写新的“下次检查”。“条件”只表示事件触发条件，不要改写成延期阻碍。未处理不会导致本轮世界推进被驳回。';
    const WORLD_PROMPT_CHRONOLOGY_INPUT='先判断未受干预时的原著/权威默认走向，再定宏观节点日期、粒度与跨度。已发生事实不可覆盖；明确到日的日期硬校验。月份、时段、顺序、条件与趋势按软约束保守规划。若已确认因果偏移足以改变节点，只重构受影响部分，不为了回归原著强行修正。';
    const WORLD_PROMPT_CHRONOLOGY_NO_EVIDENCE='未命中明确时间线条目；优先使用模型已有原著/作品知识维持主线惯性，未知处保守留白，不用自创危机替代作品剧情，也不得为推进剧情压缩跨度';
    const WORLD_PROMPT_RUMOR_SOURCE_BOUNDARY='只使用世界侧可传播事实、已有传播链与既有公开传闻；正文不是直接传播源';
    const WORLD_PROMPT_CHRONOLOGY_PRINCIPLES=JSON.stringify({
        剧情主轴:'原著/权威剧情是未受干预时的默认未来；没有足够已确认因果改变时优先推进作品本身正在发生的故事，再扩展新世界事件。',
        证据分级:'已发生事实锁定；明确到日的资料进入硬校验；月份、时段、顺序、条件剧情、趋势与大致间隔保持同级精度并作为软约束。',
        偏移处理:'已确认偏移只重构真正受影响的节点，未受影响原著节点继续存在；禁止为“回归原著”强行制造等价死亡、替代事故、无因复活或其它命运修正。',
        滚动窗口:'3~5个宏观节点只是当前规划视野，不要求覆盖完整篇章；宁可规划得近，也不要把远期大事件打包。',
        节点粒度:'一个宏观节点只表达一个阶段转折；远行、集结、连续战役或多个独立剧情阶段应拆分或拉开跨度。',
        间隔自检:'排期前先判断从上一节点到本节点现实上必须经历什么，为旅行、准备、组织动员与因果发展留足时间。',
        时间精度:'资料只到月份/时段/顺序时保持同级精度并保守留白，不为方便排序强造日级日期。'
    },null,2);
    const WORLD_PROMPT_ALIEN_REVIEW='仅因本轮触发复核才需要在 WorldResult.人物 中提交该活跃异端的新活动；至少给出非空地点、目标、行动。人物更新时间无需抄写，由程序使用本轮最终世界时间统一记录。未获得新情报时沿用既有目标/行动，不得因为模型看见<user>行为就自动追踪或改策；若因<user>行为改变目标/行动，必须已有认知或同轮写入可追溯的认知/认知来源。若本轮已确认死亡，则只把异端状态更新为死亡。';
    const WORLD_PROMPT_WORLD_ACTIVITY_INPUT=[
        '异端不能作为本轮唯一变化；至少推进事件、势力地区或普通人物中的一项非异端实质变化。',
        '若地区为空：建立至少1个与当前地点/阶段相关的地区。',
        '若没有进行中的非宏观事件：建立至少1个正在发生的当前事件/近期节点。',
        '只改更新时间/下次检查、重复原值或只新增待发生宏观节点不算实质变化。'
    ].join('\n');
    const WORLD_PROMPT_WORLD_ACTIVITY_SOFT_INPUT='若势力为空，优先补充1个当前真正参与局势的真实势力/组织；建立时同名提交 WorldResult.势力 与 WorldResult.势力地区（类型=势力）。若没有可靠资料或势力片段因声望、Schema等规则验收失败，不要为了补档案编造或反复重交，也不要影响其它已通过片段。';
    const WORLD_PROMPT_HISTORY_INPUT='按给定顺序压缩；时间字段是权威锚点，不得改写或补造。';
    const WORLD_PROMPT_WORLD_TIME_INPUT=JSON.stringify({
        所有权:'世界推进独占写入；变量 AI 只读',
        初始化锚定:{
            依据顺序:['最新已确认正文','当前阶段与当前地点','已读取时间线/年表/章节资料','模型已有原著知识','谨慎推断'],
            禁止:'不得把下一宏观节点、任务期限或未来事件的日期直接当成当前世界时间；无法唯一定位时保持较粗时间精度。'
        },
        正文时间职责:'若最新正文明确发生过夜、数小时后、次日、跨日旅行或新的日期/时段，必须输出顶层“时间”同步世界时钟；不能保留旧时钟再提交已经发生于新时点的事实。',
        精确日期格式:'顶层时间及所有事件/历史/传播等日期，只要精确到月日就使用 {yyy}年-{mm}月-{dd}日-{时间段}。月份必须是数字；不要用自定义月份名称替代数字月。',
        时间段候选:['凌晨','黎明','清晨','早晨','上午','中午','午后','下午','傍晚','入夜','晚上','深夜'],
        推进原则:'时间段是粗粒度锚点，不是每轮计数器；没有足够时间流逝跨过当前时段就保持原值，只有正文或明确时间资料表明确实经过合理时长才推进。'
    },null,2);
    const WORLD_PROMPT_INPUT_SEMANTICS=JSON.stringify({
        世界书:'可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。',
        当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',
        正文楼层:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。',
        程序结构修复:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。',
        时间线调度:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。',
        WorldResult:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。',
        角色管理:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。',
        任务列表:'只读因果账本。事件可通过关联任务引用已存在任务；不得创建、删除、改状态、交付或结算任务。'
    },null,2);

    function worldPromptModuleDefault(key,fallback=''){
        try{
            const item=Array.isArray(WORLD_PROMPT_MODULE_DEFS)?WORLD_PROMPT_MODULE_DEFS.find(row=>row?.key===key):null;
            if(item&&typeof item.fallback==='string')return item.fallback;
        }catch(_){}
        return String(fallback||'');
    }

    class WorldPromptRegistry {
        constructor(engine){
            this.engine=engine;
            const def=(value)=>Object.freeze(value);
            this._definitions=Object.freeze([
                def({key:'preset',title:'执行流程 / 主预设',group:'主流程',source:'COMPACT_DEFAULT_PRESET / config.preset',scope:'system',condition:'每次主世界推进请求',native:true,defaultValue:()=>typeof COMPACT_DEFAULT_PRESET==='string'?COMPACT_DEFAULT_PRESET:DEFAULT_PRESET}),
                def({key:'core',title:'世界引擎核心约束',group:'主流程',source:'CORE_WORLD_RULES',scope:'system',condition:'每次主世界推进请求',native:true,defaultValue:()=>typeof COMPACT_CORE_WORLD_RULES==='string'?COMPACT_CORE_WORLD_RULES:CORE_WORLD_RULES}),
                def({key:'macro',title:'宏观骨架',group:'主流程',source:'DEFAULT_MACRO_PROMPT',scope:'system',condition:'本轮需要建立或补足宏观骨架时',native:true,defaultValue:()=>typeof COMPACT_MACRO_PROMPT==='string'?COMPACT_MACRO_PROMPT:DEFAULT_MACRO_PROMPT}),
                def({key:'stability',title:'世界自救',group:'主流程',source:'DEFAULT_STABILITY_PROMPT_TEMPLATE',scope:'system',condition:'稳定值低于100且未开启世界超稳时',native:true,defaultValue:()=>typeof COMPACT_STABILITY_PROMPT_TEMPLATE==='string'?COMPACT_STABILITY_PROMPT_TEMPLATE:DEFAULT_STABILITY_PROMPT_TEMPLATE}),
                def({key:'npcAudit',title:'NPC构筑审计',group:'主流程',source:'NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT',scope:'system',condition:'启用NPC构筑审计且本轮存在审计对象时',native:true,defaultValue:()=>typeof NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT==='string'?NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT:NPC_BUILD_AUDIT_RULES}),
                def({key:'outputProtocol',title:'WorldResult 输出协议说明',group:'主流程',source:'WorldResultContract.instruction()',scope:'system',condition:'每次主世界推进请求；程序 JSON Schema 仍固定只读',native:true,defaultValue:()=>WORLD_RESULT_CONTRACT.instruction()}),
                def({key:'task',title:'任务只读',group:'运行模块',source:'TASK_AWARENESS_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>worldPromptModuleDefault('task',typeof TASK_AWARENESS_RULES==='string'?TASK_AWARENESS_RULES:'')}),
                def({key:'chronology',title:'原著 / 数据库时间轴',group:'运行模块',source:'CHRONOLOGY_GUARD_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>worldPromptModuleDefault('chronology',typeof CHRONOLOGY_GUARD_RULES==='string'?CHRONOLOGY_GUARD_RULES:'')}),
                def({key:'maintenance',title:'分级维护',group:'运行模块',source:'SOFT_MAINTENANCE_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>worldPromptModuleDefault('maintenance',typeof SOFT_MAINTENANCE_RULES==='string'?SOFT_MAINTENANCE_RULES:'')}),
                def({key:'exploration',title:'探索台账',group:'运行模块',source:'EXPLORATION_PROJECTION_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>worldPromptModuleDefault('exploration',typeof EXPLORATION_PROJECTION_RULES==='string'?EXPLORATION_PROJECTION_RULES:'')}),
                def({key:'integrity',title:'因果与事实时间',group:'运行模块',source:'WORLD_INTEGRITY_GUARD_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>worldPromptModuleDefault('integrity',typeof WORLD_INTEGRITY_GUARD_RULES==='string'?WORLD_INTEGRITY_GUARD_RULES:'')}),
                def({key:'worldTime',title:'世界时间所有权',group:'运行模块',source:'WORLD_TIME_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>worldPromptModuleDefault('worldTime',typeof WORLD_TIME_RULES==='string'?WORLD_TIME_RULES:'')}),
                def({key:'rumor',title:'传闻与传播',group:'运行模块',source:'RUMOR_WORLD_SOURCE_RULES',scope:'system',condition:'每次主世界推进请求；无触发时要求保持既有传播',defaultValue:()=>worldPromptModuleDefault('rumor',typeof RUMOR_WORLD_SOURCE_RULES==='string'?RUMOR_WORLD_SOURCE_RULES:(typeof RUMOR_THROTTLE_RULES==='string'?RUMOR_THROTTLE_RULES:''))}),
                def({key:'worldActivity',title:'世界活动交付',group:'运行模块',source:'WorldActivityPolicy / WORLD_ACTIVITY_DELIVERY_RULES',scope:'system',condition:'每次主世界推进请求',defaultValue:()=>typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:''}),
                def({key:'historyMemory',title:'世界长期历史压缩',group:'辅助模型',source:'HISTORY_MEMORY_SYSTEM',scope:'system',condition:'历史记忆达到自动压缩阈值时单独调用模型',defaultValue:()=>typeof HISTORY_MEMORY_SYSTEM==='string'?HISTORY_MEMORY_SYSTEM:''}),
                def({key:'inputSemantics',title:'输入语义说明',group:'请求内指令',source:'40-engine-runtime.part.js / 输入语义',scope:'user payload',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_INPUT_SEMANTICS}),
                def({key:'macroPlanningGuidance',title:'宏观骨架 · 规划与发生',group:'请求内指令',source:'40-engine-runtime.part.js / 本轮必须完成的宏观骨架',scope:'user payload',condition:'本轮要求补足宏观骨架时',defaultValue:()=>WORLD_PROMPT_MACRO_PLANNING}),
                def({key:'macroAcceptanceGuidance',title:'宏观骨架 · 验收',group:'请求内指令',source:'40-engine-runtime.part.js / 本轮必须完成的宏观骨架',scope:'user payload',condition:'本轮要求补足宏观骨架时',defaultValue:()=>WORLD_PROMPT_MACRO_ACCEPTANCE}),
                def({key:'projectionGuidance',title:'正文可见投影规则',group:'请求内指令',source:'40-engine-runtime.part.js / 正文可见投影规则',scope:'user payload',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_PROJECTION_GUIDANCE}),
                def({key:'requestSummaryGuidance',title:'本轮输入总说明',group:'请求内指令',source:'40-engine-runtime.part.js / 说明',scope:'user payload',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_REQUEST_SUMMARY}),
                def({key:'manualAdvanceGuidance',title:'手动推进 · 本轮人工指导',group:'请求内指令',source:'WorldManualAdvanceFeature / 本轮人工指导',scope:'user payload',condition:'玩家手动推进且填写指导时',defaultValue:()=>WORLD_PROMPT_MANUAL_ADVANCE_GUIDANCE}),
                def({key:'dueReviewGuidance',title:'到期事件复核说明',group:'请求内指令',source:'59-due-event-relaxation.part.js',scope:'user payload',condition:'本轮存在到期事件时',defaultValue:()=>WORLD_PROMPT_DUE_REVIEW}),
                def({key:'chronologyInputGuidance',title:'时间线基准 · 要求',group:'请求内指令',source:'58-chronology-guard.part.js / 时间线基准',scope:'user payload',condition:'时间轴保护层运行时',defaultValue:()=>WORLD_PROMPT_CHRONOLOGY_INPUT}),
                def({key:'chronologyPrinciples',title:'时间线基准 · 规划原则',group:'请求内指令',source:'58-chronology-guard.part.js / 规划原则',scope:'user payload JSON',condition:'时间轴保护层运行时',defaultValue:()=>WORLD_PROMPT_CHRONOLOGY_PRINCIPLES}),
                def({key:'chronologyNoEvidenceGuidance',title:'时间线基准 · 未命中资料说明',group:'请求内指令',source:'58-chronology-guard.part.js / 原著时间资料',scope:'user payload',condition:'未读取到明确时间线/年表资料时',defaultValue:()=>WORLD_PROMPT_CHRONOLOGY_NO_EVIDENCE}),
                def({key:'rumorSourceBoundary',title:'传闻取材边界',group:'请求内指令',source:'59-rumor-world-request.part.js / 取材边界',scope:'user payload',condition:'每次传闻维护请求',defaultValue:()=>WORLD_PROMPT_RUMOR_SOURCE_BOUNDARY}),
                def({key:'alienReviewGuidance',title:'活跃异端复核要求',group:'请求内指令',source:'59-alien-activity-normalization.part.js',scope:'user payload',condition:'活跃异端命中复核触发器时',defaultValue:()=>WORLD_PROMPT_ALIEN_REVIEW}),
                def({key:'worldActivityInputGuidance',title:'世界活动交付 · 硬要求',group:'请求内指令',source:'WorldActivityRequestFeature / 硬要求',scope:'user payload lines',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_WORLD_ACTIVITY_INPUT}),
                def({key:'worldActivitySoftGuidance',title:'世界活动交付 · 势力软目标',group:'请求内指令',source:'WorldActivityRequestFeature / 软目标',scope:'user payload lines',condition:'势力档案为空时作为非阻塞建议',defaultValue:()=>WORLD_PROMPT_WORLD_ACTIVITY_SOFT_INPUT}),
                def({key:'worldTimeInputGuidance',title:'世界时间维护 · 请求内指令',group:'请求内指令',source:'WorldTimeOwnershipFeature / 世界时间维护',scope:'user payload JSON',condition:'每次主世界推进请求',defaultValue:()=>WORLD_PROMPT_WORLD_TIME_INPUT}),
                def({key:'historyInputGuidance',title:'历史压缩输入说明',group:'辅助模型',source:'historyMemoryPrompt()',scope:'user payload',condition:'历史记忆达到自动压缩阈值时',defaultValue:()=>WORLD_PROMPT_HISTORY_INPUT}),
                def({key:'retryGuideMacroBackbone',title:'纠错动作 · 宏观骨架数量',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'宏观事件不足时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideMacroBackbone}),
                def({key:'retryGuideEventDelivery',title:'纠错动作 · 宏观事件交付',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'宏观事件不足时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideEventDelivery}),
                def({key:'retryGuideMacroSchedule',title:'纠错动作 · 宏观排期',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'宏观事件不足时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideMacroSchedule}),
                def({key:'retryGuideCausalProjection',title:'纠错动作 · 宏观骨架因果投影',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'宏观事件不足时随骨架补充清单发送',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideCausalProjection}),
                def({key:'retryGuideCausalProjectionRepair',title:'纠错动作 · 因果轨道投影修复',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'因果轨道宏观投影无效时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideCausalProjectionRepair}),
                def({key:'retryGuideDueEvent',title:'纠错动作 · 到期事件',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'到期事件未处理时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideDueEvent}),
                def({key:'retryGuideEventTime',title:'纠错动作 · 事件时间',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'事件时间锚点缺失时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideEventTime}),
                def({key:'retryGuideStaleEvent',title:'纠错动作 · 超期活动事件',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'活动事件长期未复核时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideStaleEvent}),
                def({key:'retryGuideTemporalRepair',title:'纠错动作 · 时间越界修复',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'时间越界记录未修复时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideTemporalRepair}),
                def({key:'retryGuideAlienActivity',title:'纠错动作 · 异端活动',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'异端活动未复核时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideAlienActivity}),
                def({key:'retryGuideNpcAudit',title:'纠错动作 · NPC 构筑审计',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'NPC 构筑未推进时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideNpcAudit}),
                def({key:'retryGuideChronology',title:'纠错动作 · 原著时间轴',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'明确日期与原著/数据库冲突时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideChronology}),
                def({key:'retryGuidePredecessor',title:'纠错动作 · 事件前因',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'事件前因缺失或自引用时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuidePredecessor}),
                def({key:'retryGuideSchemaMismatch',title:'纠错动作 · Schema 差异',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'完整 Schema 校验失败时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideSchemaMismatch}),
                def({key:'retryGuideRumorEmpty',title:'纠错动作 · 传闻补齐',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'传闻分类为空时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideRumorEmpty}),
                def({key:'retryGuidePropagationReview',title:'纠错动作 · 传播复核',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'传播链未复核时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuidePropagationReview}),
                def({key:'retryGuideTemporalIntegrity',title:'纠错动作 · 时间一致性',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'时间事实越界时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideTemporalIntegrity}),
                def({key:'retryGuideWorldActivity',title:'纠错动作 · 世界活动',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'世界活动不足时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideWorldActivity}),
                def({key:'retryGuideWorldScene',title:'纠错动作 · 世界现场',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'世界活动不足且缺现场时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideWorldScene}),
                def({key:'retryGuideCurrentReality',title:'纠错动作 · 当前现实',group:'纠错重试',source:'WorldRetryGuidanceService',scope:'user payload / 补充清单',condition:'世界活动不足且缺进行中现实时',defaultValue:()=>WORLD_RETRY_GUIDANCE_DEFAULTS.retryGuideCurrentReality}),
                def({key:'retryAcceptedWithPlan',title:'纠错重试 · 已接受结果 + 补充清单',group:'纠错重试',source:'retryInput()',scope:'user payload',condition:'重试且已有部分业务结果通过，并存在补充清单时',defaultValue:()=>WORLD_PROMPT_RETRY_ACCEPTED_PLAN}),
                def({key:'retryAccepted',title:'纠错重试 · 已接受结果',group:'纠错重试',source:'retryInput()',scope:'user payload',condition:'重试且已有部分业务结果通过，但没有补充清单时',defaultValue:()=>WORLD_PROMPT_RETRY_ACCEPTED}),
                def({key:'retryFresh',title:'纠错重试 · 首次整体纠错',group:'纠错重试',source:'retryInput()',scope:'user payload',condition:'重试且没有已接受业务结果时',defaultValue:()=>WORLD_PROMPT_RETRY_FRESH})
            ]);
        }
        definitions(){return this._definitions.slice();}
        defaults(){return Object.fromEntries(this._definitions.map(item=>[item.key,String(item.defaultValue?.()??'')]));}
        legacyValues(){
            const config=this.engine.config||{},modules=plain(config.modulePrompts)?config.modulePrompts:{},fallback=this.defaults(),registry=plain(config.promptRegistry)?config.promptRegistry:{};
            return {
                ...fallback,
                ...registry,
                preset:String(config.preset??registry.preset??fallback.preset),
                core:String(config.corePrompt??registry.core??fallback.core),
                macro:String(config.macroPrompt??registry.macro??fallback.macro),
                stability:String(config.stabilityPromptTemplate??registry.stability??fallback.stability),
                npcAudit:String(config.npcAuditPrompt??registry.npcAudit??fallback.npcAudit),
                outputProtocol:String(config.structurePrompt??registry.outputProtocol??fallback.outputProtocol),
                task:String(modules.task??registry.task??fallback.task),
                chronology:String(modules.chronology??registry.chronology??fallback.chronology),
                maintenance:String(modules.maintenance??registry.maintenance??fallback.maintenance),
                exploration:String(modules.exploration??registry.exploration??fallback.exploration),
                integrity:String(modules.integrity??registry.integrity??fallback.integrity),
                worldTime:String(modules.worldTime??registry.worldTime??fallback.worldTime),
                rumor:String(modules.rumor??registry.rumor??fallback.rumor)
            };
        }
        normalize(value){
            const fallback=this.legacyValues(),source=plain(value)?value:{},out={};
            for(const item of this._definitions){
                const raw=Object.hasOwn(source,item.key)?source[item.key]:fallback[item.key];
                out[item.key]=typeof raw==='string'?raw:String(raw??'');
            }
            return out;
        }
        initialize(){
            const config=this.engine.config||(this.engine.config={}),previousVersion=Number(config.worldModulePromptVersion||0);
            if(typeof WORLD_MODULE_PROMPT_VERSION==='number'&&previousVersion<WORLD_MODULE_PROMPT_VERSION&&(!config.activePromptDocumentId||config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)){
                const defaults=this.defaults(),registry=plain(config.promptRegistry)?{...config.promptRegistry}:{};
                for(const key of ['chronology','chronologyInputGuidance','chronologyNoEvidenceGuidance','chronologyPrinciples','worldActivity','worldActivityInputGuidance','worldActivitySoftGuidance','retryGuideWorldScene'])registry[key]=defaults[key];
                config.promptRegistry=registry;
                config.modulePrompts=Object.assign({},plain(config.modulePrompts)?config.modulePrompts:{},{chronology:defaults.chronology});
            }
            const normalized=this.normalize(config.promptRegistry);
            config.promptRegistry=normalized;
            this.syncLegacy(normalized);
            if(typeof WORLD_MODULE_PROMPT_VERSION==='number')config.worldModulePromptVersion=WORLD_MODULE_PROMPT_VERSION;
            return normalized;
        }
        syncLegacy(values){
            const config=this.engine.config||(this.engine.config={}),source=values===undefined?this.absorbLegacyOverrides():values,v=this.normalize(source);
            config.preset=normalizeEditablePreset(v.preset);
            config.corePrompt=v.core;config.macroPrompt=v.macro;config.stabilityPromptTemplate=v.stability;config.npcAuditPrompt=v.npcAudit;config.structurePrompt=v.outputProtocol;
            config.modulePrompts=Object.assign({},plain(config.modulePrompts)?config.modulePrompts:{},{
                task:v.task,chronology:v.chronology,maintenance:v.maintenance,exploration:v.exploration,integrity:v.integrity,worldTime:v.worldTime,rumor:v.rumor
            });
            config.promptRegistry=v;return v;
        }
        values(){return this.normalize(this.engine.config?.promptRegistry);}
        absorbLegacyOverrides(){
            const config=this.engine.config||{},current=this.values(),next={...current};
            for(const [key,legacyKey] of [['preset','preset'],['core','corePrompt'],['macro','macroPrompt'],['stability','stabilityPromptTemplate'],['npcAudit','npcAuditPrompt'],['outputProtocol','structurePrompt']]){
                if(typeof config[legacyKey]==='string'&&config[legacyKey]!==current[key])next[key]=config[legacyKey];
            }
            const modules=plain(config.modulePrompts)?config.modulePrompts:{};
            for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor']){
                if(typeof modules[key]==='string'&&modules[key]!==current[key])next[key]=modules[key];
            }
            config.promptRegistry=this.normalize(next);return config.promptRegistry;
        }
        value(key){return this.values()[key]??'';}
        list(){const values=this.values();return this._definitions.map(item=>({...item,value:values[item.key]??''}));}
        apply(value,{save=true}={}){
            const normalized=this.normalize(value);
            for(const item of this._definitions)if(normalized[item.key].length>30000)throw new Error(item.title+'限30000字');
            for(const key of ['inputSemantics','chronologyPrinciples','worldTimeInputGuidance']){
                let parsed=null;try{parsed=JSON.parse(normalized[key]);}catch(_){throw new Error(this._definitions.find(x=>x.key===key)?.title+'必须是合法 JSON 对象');}
                if(!plain(parsed))throw new Error(this._definitions.find(x=>x.key===key)?.title+'必须是 JSON 对象');
            }
            this.syncLegacy(normalized);
            if(save)this.engine.saveConfig?.();
            return normalized;
        }
        prepareSettings(settings){
            const input=plain(settings)?copy(settings):{},registry=this.normalize(input.promptRegistry??this.engine.config?.promptRegistry);
            if(typeof input.preset==='string')registry.preset=input.preset;
            if(typeof input.corePrompt==='string')registry.core=input.corePrompt;
            if(typeof input.macroPrompt==='string')registry.macro=input.macroPrompt;
            if(typeof input.stabilityPromptTemplate==='string')registry.stability=input.stabilityPromptTemplate;
            if(typeof input.npcAuditPrompt==='string')registry.npcAudit=input.npcAuditPrompt;
            if(typeof input.structurePrompt==='string')registry.outputProtocol=input.structurePrompt;
            if(plain(input.modulePrompts))for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor'])if(typeof input.modulePrompts[key]==='string')registry[key]=input.modulePrompts[key];
            input.promptRegistry=registry;
            input.preset=registry.preset;input.corePrompt=registry.core;input.macroPrompt=registry.macro;input.stabilityPromptTemplate=registry.stability;input.npcAuditPrompt=registry.npcAudit;input.structurePrompt=registry.outputProtocol;
            input.modulePrompts=Object.assign({},plain(input.modulePrompts)?input.modulePrompts:{},{
                task:registry.task,chronology:registry.chronology,maintenance:registry.maintenance,exploration:registry.exploration,integrity:registry.integrity,worldTime:registry.worldTime,rumor:registry.rumor
            });
            return input;
        }
        rewriteSystem(system){
            let output=String(system||'');
            const mounted=new Set();
            const rewriteOne=(legacy,key)=>{
                const configured=String(this.value(key)||'').trim();
                const block=typeof legacy==='string'?legacy:'';
                if(block&&output.includes(block)){
                    output=output.split(block).join(configured);
                    if(configured)mounted.add(key);
                }
            };

            rewriteOne(typeof TASK_AWARENESS_RULES==='string'?TASK_AWARENESS_RULES:'','task');
            rewriteOne(typeof CHRONOLOGY_GUARD_RULES==='string'?CHRONOLOGY_GUARD_RULES:'','chronology');
            rewriteOne(typeof SOFT_MAINTENANCE_RULES==='string'?SOFT_MAINTENANCE_RULES:'','maintenance');
            rewriteOne(typeof EXPLORATION_PROJECTION_RULES==='string'?EXPLORATION_PROJECTION_RULES:'','exploration');
            rewriteOne(typeof WORLD_INTEGRITY_GUARD_RULES==='string'?WORLD_INTEGRITY_GUARD_RULES:'','integrity');
            rewriteOne(typeof WORLD_TIME_RULES==='string'?WORLD_TIME_RULES:'','worldTime');
            rewriteOne(typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:'','worldActivity');

            // 历史传闻管线可能同时注入三段旧文本。最终只允许 registry.rumor 出现一次。
            const rumorConfigured=String(this.value('rumor')||'').trim();
            const rumorBlocks=[
                typeof RUMOR_LIVELINESS_RULES==='string'?RUMOR_LIVELINESS_RULES:'',
                typeof RUMOR_THROTTLE_RULES==='string'?RUMOR_THROTTLE_RULES:'',
                typeof RUMOR_WORLD_SOURCE_RULES==='string'?RUMOR_WORLD_SOURCE_RULES:''
            ].filter(Boolean);
            let rumorReplaced=false;
            for(const block of rumorBlocks){
                if(!output.includes(block))continue;
                output=output.split(block).join(!rumorReplaced?rumorConfigured:'');
                rumorReplaced=true;
            }
            if(rumorReplaced&&rumorConfigured)mounted.add('rumor');

            // Registry 是最终 system 装配器：前序 feature 即使没有再注入旧常量，
            // 当前非空配置也必须在真实请求中恰好出现一次。
            for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor','worldActivity']){
                const configured=String(this.value(key)||'').trim();
                if(!configured||mounted.has(key))continue;
                // 用户可能把配置改成与其它块相同；按完整块文本去重，避免重复 system。
                if(output.includes(configured)){mounted.add(key);continue;}
                output+=(output?'\n\n':'')+configured;
                mounted.add(key);
            }
            return output.replace(/\n{3,}/g,'\n\n').trim();
        }
        rewriteInput(input){
            let payload;try{payload=JSON.parse(String(input||''));}catch(_){return input;}
            try{payload.输入语义=JSON.parse(this.value('inputSemantics'));}catch(_){}
            if(plain(payload.本轮必须完成的宏观骨架)){
                payload.本轮必须完成的宏观骨架.规划与发生=this.value('macroPlanningGuidance');
                payload.本轮必须完成的宏观骨架.验收=this.value('macroAcceptanceGuidance');
            }
            if(plain(payload.正文可见投影规则))payload.正文可见投影规则.要求=this.value('projectionGuidance');
            if(Object.hasOwn(payload,'说明'))payload.说明=this.value('requestSummaryGuidance');
            if(Array.isArray(payload.本轮必须复核的到期事件))for(const item of payload.本轮必须复核的到期事件)if(plain(item))item.说明=this.value('dueReviewGuidance');
            if(plain(payload.时间线基准)){
                payload.时间线基准.要求=this.value('chronologyInputGuidance');
                try{payload.时间线基准.规划原则=JSON.parse(this.value('chronologyPrinciples'));}catch(_){}
                if(payload.时间线基准.原著时间资料==='__PROMPT_REGISTRY_NO_EVIDENCE__')payload.时间线基准.原著时间资料=this.value('chronologyNoEvidenceGuidance');
            }
            if(plain(payload.传闻维护)&&Object.hasOwn(payload.传闻维护,'取材边界'))payload.传闻维护.取材边界=this.value('rumorSourceBoundary');
            if(Array.isArray(payload.本轮必须维持的异端活动))for(const item of payload.本轮必须维持的异端活动)if(plain(item))item.要求=this.value('alienReviewGuidance');
            if(plain(payload.本轮世界活动交付)){
                payload.本轮世界活动交付.硬要求=this.value('worldActivityInputGuidance').split(/\n+/).map(x=>x.trim()).filter(Boolean);
                payload.本轮世界活动交付.软目标=this.value('worldActivitySoftGuidance').split(/\n+/).map(x=>x.trim()).filter(Boolean);
            }
            if(plain(payload.世界时间维护)){
                try{
                    const configured=JSON.parse(this.value('worldTimeInputGuidance'));
                    if(plain(configured)){
                        if(Object.hasOwn(configured,'所有权'))payload.世界时间维护.所有权=configured.所有权;
                        if(plain(configured.初始化锚定)&&plain(payload.世界时间维护.初始化锚定)){
                            if(Array.isArray(configured.初始化锚定.依据顺序))payload.世界时间维护.初始化锚定.依据顺序=configured.初始化锚定.依据顺序;
                            if(Object.hasOwn(configured.初始化锚定,'禁止'))payload.世界时间维护.初始化锚定.禁止=configured.初始化锚定.禁止;
                        }
                        for(const key of ['正文时间职责','精确日期格式','时间段候选','推进原则'])if(Object.hasOwn(configured,key))payload.世界时间维护[key]=copy(configured[key]);
                    }
                }catch(_){}
            }
            return JSON.stringify(payload,null,2);
        }
        historySystem(){return this.value('historyMemory');}
        historyInput(input){
            let payload;try{payload=JSON.parse(String(input||''));}catch(_){return input;}
            if(plain(payload))payload.说明=this.value('historyInputGuidance');
            return JSON.stringify(payload,null,2);
        }
        retryRequirement(acceptedResult,retryPlan=[]){
            if(acceptedResult)return Array.isArray(retryPlan)&&retryPlan.length?this.value('retryAcceptedWithPlan'):this.value('retryAccepted');
            return this.value('retryFresh');
        }
    }
    class WorldPromptIntegrationService {
        constructor(engine,registry,telemetry){
            this.engine=engine;
            this.registry=registry;
            this.telemetry=telemetry||DEFAULT_WORLD_TOKEN_TELEMETRY;
            this.workspace=null;
        }
        attachWorkspace(workspace){this.workspace=workspace||null;return this.workspace;}
        initializeDefaults(){
            if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)&&this.registry){
                BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.promptRegistry=this.registry.defaults();
            }
            this.engine.saveConfig();
        }
        readEditor(settings){
            if(!this.registry)return settings;
            let values=this.registry.values();
            values.preset=String(settings.preset??values.preset);
            values.core=String(settings.corePrompt??values.core);
            values.macro=String(settings.macroPrompt??values.macro);
            values.stability=String(settings.stabilityPromptTemplate??values.stability);
            values.npcAudit=String(settings.npcAuditPrompt??values.npcAudit);
            values.outputProtocol=String(settings.structurePrompt??values.outputProtocol);
            if(plain(settings.modulePrompts)){
                for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumor']){
                    if(typeof settings.modulePrompts[key]==='string')values[key]=settings.modulePrompts[key];
                }
            }
            values=this.workspace?.read(values)||values;
            settings.promptRegistry=values;
            settings.modulePrompts=Object.assign({},plain(settings.modulePrompts)?settings.modulePrompts:{},{
                task:values.task,chronology:values.chronology,maintenance:values.maintenance,
                exploration:values.exploration,integrity:values.integrity,worldTime:values.worldTime,rumor:values.rumor
            });
            return settings;
        }
        prepareApply(settings){return this.registry?this.registry.prepareSettings(settings):settings;}
        afterApply(prepared,result){
            if(!this.registry)return result;
            this.registry.apply(prepared.promptRegistry,{save:false});
            this.engine.services?.npcAuditPolicy?.afterPromptSettings?.();
            this.engine.saveConfig();
            return result;
        }
        prepareDocument(settings){
            if(!this.registry)return settings;
            const prepared=this.registry.prepareSettings(settings);
            prepared.promptRegistry=this.registry.normalize(prepared.promptRegistry);
            return prepared;
        }
        importDocument(doc,raw){
            if(!doc?.settings||!this.registry)return doc;
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const source=plain(parsed?.settings)?parsed.settings:parsed;
            doc.settings=this.registry.prepareSettings(Object.assign({},doc.settings,plain(source)?source:{}));
            this.engine.saveConfig();
            return doc;
        }
        beforeBuildRequest(){this.registry?.syncLegacy();}
        decorateRequest(request){
            if(!this.registry)return request;
            request.system=this.registry.rewriteSystem(request.system);
            request.input=this.registry.rewriteInput(request.input);
            request.manifest=request.manifest||{};
            request.manifest.提示词注册表=this.registry.list().map(item=>({
                key:item.key,标题:item.title,分组:item.group,来源:item.source,作用范围:item.scope,发送条件:item.condition,
                估算Tokens:this.telemetry.estimate(item.value),启用:String(item.value||'').trim()!==''
            }));
            request.manifest.提示词模块=this.registry.list()
                .filter(item=>item.group==='运行模块'&&item.scope==='system'&&String(item.value||'').trim())
                .map(item=>({key:item.key,title:item.title,source:item.source,估算Tokens:this.telemetry.estimate(item.value)}));
            request.manifest.观测=this.telemetry.request(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
        bindPanel(panel){
            if(!panel||panel.__classPromptRegistryBound)return;
            Object.defineProperty(panel,'__classPromptRegistryBound',{value:true,configurable:true});
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="prompt-edit"]');
                if(!button||!panel.contains(button))return;
                queueMicrotask(()=>this.workspace?.syncEditableState());
            });
        }
        afterRender(){
            this.workspace?.mount();
            this.workspace?.syncEditableState();
        }
    }
    class WorldOverviewView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {
                        engine,s,w,orbit,events,active,future,people,calendarCandidates,snapshot,
                        entries,text,empty,section,stabilityDescription,parseDate,calendar,tools,
                        timelineCards,exists,fields,prose,compactPerson
                    }=ctx;
                    let html='';
                    const offsets=entries(orbit.偏移记录);
                    const stable=w.稳定!==null&&w.稳定!==''&&Number.isFinite(Number(w.稳定))?Number(w.稳定):null;
                    const signed=n=>(n>0?'+':'')+n;
                    const offsetCard=([name,r])=>{
                        const impact=r?.影响程度!==null&&r?.影响程度!==''&&Number.isFinite(Number(r?.影响程度))?Number(r.影响程度):null;
                        return '<article class="we-offset"><div class="we-offset-head"><b>'+text(name)+'</b><span>'+text(impact===null?'影响未记录':signed(impact))+'</span></div><p>'+text(r?.描述||'暂无偏移描述')+'</p><small>引发者 · '+text(r?.引发者||'未记录')+' · '+(impact===null?'待确认':impact<0?'因果破坏':impact>0?'因果修复 / 强化':'无数值变化')+'</small></article>';
                    };
                    const causalHtml='<div class="we-causal"><div class="we-stability"><div><small>世界稳定值</small><strong data-world-stability>'+text(stable===null?'未记录':stable)+'</strong></div><span>'+((s.设置||{}).世界超稳?'世界超稳 · 禁止新增偏移':'基准 100 · 失稳将强化世界排异')+'</span></div>'
                        +(stable===null?'':'<meter min="0" max="120" value="'+Math.max(0,Math.min(120,stable))+'" aria-label="世界稳定值">'+stable+'</meter>')
                        +stabilityDescription(stable)
                        +'<div class="we-offset-heading">偏移记录 <span>'+offsets.length+' 条</span></div>'
                        +(offsets.length?offsets.slice(0,3).map(offsetCard).join('')+(offsets.length>3?'<details class="we-offset-more"><summary>展开其余 '+(offsets.length-3)+' 条偏移</summary>'+offsets.slice(3).map(offsetCard).join('')+'</details>':''):empty('暂无因果偏移','关键人物命运、重大事件或势力格局实质改变后记录。'))+'</div>';
                    const shown=calendarCandidates.filter(([,e])=>engine.calendarMode==='undated'?!parseDate(e.时间||e.开始时间):!engine.selectedDate||parseDate(e.时间||e.开始时间)?.key===engine.selectedDate);
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
                        +'<section class="we-section we-timeline-board" data-detail="world-calendar"><div class="we-section-head"><h2>事件时间线</h2><small>'+events.length+' 事件 · '+future.length+' 未来 · '+macroCount+' 宏观</small></div><div class="we-calendar-layout"><div class="we-calendar-slot">'+calendar()+'</div><div class="we-timeline-slot">'+tools(['全部','进行中','待发生','已完成','已取消'])+'<div class="we-tools"><span>'+text(engine.calendarMode==='undated'?'未定日 / 作品内时间':engine.selectedDate||'全部日期')+'</span><button data-action="today">回到今天</button><button data-action="clear-date">全部日期</button><button data-action="undated">未定日事件</button></div>'+'<div class="we-timeline">'+(timelineCards(shown.slice(0,engine.eventLimit||12))||empty('没有符合条件的事件'))+'</div>'+(shown.length>(engine.eventLimit||12)?'<button class="we-btn" data-action="more-events">显示更多（共 '+shown.length+' 项）</button>':'')+'</div></div></section>'
                        +'</div><aside class="we-command-side">'
                        +section('因果状态',causalHtml,'稳定与轨道偏移')
                        +section('货币与经济',exists(w.货币)?fields({货币体系:w.货币?.体系,购买力基准:w.货币?.购买力基准,经济波动:w.货币?.经济波动}):empty('尚无货币资料','世界推进会在设定或经济局势明确时维护。'),'世界推进维护')
                        +(exists(w.法则)?section('世界法则',prose(w.法则),'当前生效规则 · '+(Array.isArray(w.法则)?w.法则.length:1)+' 条'):'')
                        +section('人物动向',(compactPeople.length?'<div class="we-people-strip">'+compactPeople.map(([n,p])=>compactPerson(n,p)).join('')+'</div><button class="we-link-btn" data-tab="角色管理">查看人物名册 →</button>':empty('暂无人物动态')),'重点 NPC')
                        +'</aside></div>';
                    return html;
                
        }
    }
    class WorldPeopleView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {
                        engine,s,radar,showRadar,alienAlive,entries,formalPeople,backstagePeople,
                        relationRoster,matched,userName,section,text,pill,fields,contextRows,
                        sceneContextBody,empty,tools,person,exists,value
                    }=ctx;
                    let html='';
                    if(showRadar&&alienAlive>0)html+='<div class="we-meta we-alien-count">异端存活数量 <b>'+alienAlive+'</b></div>';
            
                    const alienByKey=new Map(entries(radar.名单).map(([name,record])=>[nameKey(name),{名称:name,记录:record}]));
                    const rolePeople=[
                        ...Array.from(formalPeople).map(([n,p])=>[n,p,{正式:true,异端:alienByKey.has(nameKey(n))}]),
                        ...backstagePeople.map(([n,p])=>[n,p,{正式:false,异端:alienByKey.has(nameKey(n))}])
                    ];
                    const list=rolePeople.filter(([n,p,meta])=>{
                        const searchable=meta.正式?Object.assign({},p,relationRoster[n]||{}):p;
                        if(!matched(n,searchable))return false;
                        if((engine.filter||'全部')==='全部')return true;
                        const present=meta.正式&&!!relationRoster[n]?.在场;
                        return engine.filter==='在场'?present:!present;
                    });
                    const chosen=list.find(([n])=>n===engine.selectedPerson)||list[0];
                    const chosenMeta=chosen?.[2]||{};
                    const chosenContext=chosen?derivePersonWorldContext(s,chosen[0],userName):null;
                    const chosenRelation=chosenMeta.正式&&plain(relationRoster[chosen?.[0]])?relationRoster[chosen[0]]:null;
                    const chosenAudit=engine.isNpcBuildAuditEnabled()&&chosenRelation?npcBuildAssessment(s,chosen[0],chosenRelation):null;
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
                    return html;
                
        }
    }
    class WorldExplorationView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {
                        engine,state,w,events,entries,text,fields,areaSceneBody,exists,details,
                        empty,section,eventCard
                    }=ctx;
                    let html='';
                    const regionRecords=state.势力地区||{};
                    const exploration=entries(w.探索).map(([name,ledger])=>[name,{...(regionRecords[name]||{}),...ledger,类型:'探索'}]);
                    const factionList=entries(w.势力).map(([name,ledger])=>[name,{...(regionRecords[name]||{}),...ledger,类型:'势力'}]);
                    const projectedNames=new Set([...exploration.map(([n])=>n),...factionList.map(([n])=>n)]);
                    const backstageAreas=entries(regionRecords).filter(([name,r])=>r.类型!=='势力'&&!projectedNames.has(name));
                    const dir=engine.directoryTab||'探索';
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
                    const chosenArea=exploration.find(([n])=>n===engine.selectedArea)||exploration[0];
                    const chosenFaction=factionList.find(([n])=>n===engine.selectedFaction)||factionList[0];
            
                    html+='<div class="we-notice">这里显示的是结算台账，不是地图数据库：只有 <b>世界.探索</b> 中的整体地标才计探索收益；后台尚未投影的地区不会出现在探索名录中。势力声望同样只记录势力对玩家的真实关系结算。</div>';
                    html+='<div class="we-tools">'+['探索','热点','势力'].map(t=>'<button data-directory="'+t+'" class="'+(dir===t?'active':'')+'">'+t+'</button>').join('')+'</div>';
            
                    if(dir==='探索'){
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
                        html+=section('探索结算名录','<div class="we-explore-grid we-explore-index">'+(cards||empty('暂无探索地标','等待玩家实际发现整体区域。'))+'</div>');
                        html+=section('区域档案',areaDetail,'地区现场与后台档案 · 点击上方地标切换');
                        if(backstageAreas.length){
                            html+=section('后台未投影地区','<details><summary>'+backstageAreas.length+' 个世界地区尚未计入玩家探索奖励</summary>'+backstageAreas.map(([n,r])=>'<div class="we-brief-row"><b>'+text(n)+'</b><span>'+text(r.进展||r.公开动态||r.描述||'后台运行中')+'</span></div>').join('')+'</details>','仅主持人参考 · 不计探索收益');
                        }
                    }else if(dir==='热点'){
                        const hotspots=events.filter(([,e])=>e.状态==='进行中');
                        html+=section('当前热点',hotspots.map(([n,e])=>eventCard(n,e)).join('')||empty('暂无进行中的热点','世界当前没有进行中的事件。'));
                    }else{
                        const factionCards=factionList.map(([n,r])=>{
                            const rep=Number(r.声望)||0,stage=repStage(rep),width=Math.min(100,Math.max(0,rep)/100);
                            return '<button class="we-faction-card '+(chosenFaction?.[0]===n?'active':'')+'" data-faction="'+text(n)+'"><div class="we-card-top"><h3>'+text(n)+'</h3><span class="we-risk-badge">实力 '+text(r.实力||'F')+'</span></div>'
                                +'<div class="we-rep"><span>声望 '+rep+'</span><b>'+text(stage)+'</b></div><div class="we-explore-bar"><i style="width:'+width+'%"></i></div>'
                                +'<p>'+text(r.描述||r.目标||'暂无势力描述')+'</p><small>'+text(r.领地||'领地未记录')+'</small></button>';
                        }).join('');
                        const factionDetail=chosenFaction?'<h3>'+text(chosenFaction[0])+'</h3>'+fields({实力:chosenFaction[1].实力,声望:chosenFaction[1].声望,关系阶段:repStage(chosenFaction[1].声望),领地:chosenFaction[1].领地,目标:chosenFaction[1].目标,描述:chosenFaction[1].描述,当前进展:chosenFaction[1].进展}):empty('暂无势力记录');
                        html+=section('势力结算名录','<div class="we-explore-layout"><div class="we-faction-grid">'+(factionCards||empty('暂无已知势力'))+'</div><aside class="we-area-side">'+section('势力档案',factionDetail,'点击左侧势力切换')+'</aside></div>','声望只反映势力对玩家的真实关系');
                    }
                    return html;
                
        }
    }
    class WorldAssetView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const {s,w,people,userName,relationNamesByKey,entries,matched,tools,section,text,pill,fields,details,empty}=context;
            const ownersOf=asset=>Array.from(new Set((Object.hasOwn(asset,'所属对象')?(Array.isArray(asset.所属对象)?asset.所属对象:[asset.所属对象]):['<user>']).map(x=>String(x??'').trim()).filter(x=>x&&x!=='无主')));
            const assets=entries(s.资产).filter(([,asset])=>plain(asset));
            const list=assets.filter(([name,asset])=>{
                const owners=ownersOf(asset),category=this.engine.filter||'全部';
                return (category==='全部'||category==='玩家相关'&&owners.includes('<user>')||category==='共同持有'&&owners.length>1||category==='无主'&&!owners.length)&&matched(name,{...asset,归属:owners.join(' ')});
            });
            let html=tools(['全部','玩家相关','共同持有','无主']);
            html+=section('资产与归属',list.map(([name,asset])=>{
                const owners=ownersOf(asset);
                const ownerLinks=owners.length?owners.map(owner=>{
                    const label=owner==='<user>'?(userName||'玩家'):owner;
                    if(owner!=='<user>'&&(relationNamesByKey.has(nameKey(owner))||people.has(owner)))return '<button data-jump-person="'+text(relationNamesByKey.get(nameKey(owner))||owner)+'">'+text(label)+' ↗</button>';
                    if(Object.hasOwn(w.势力||{},owner))return '<button data-faction="'+text(owner)+'" data-asset-owner>'+text(label)+' ↗</button>';
                    return pill(label,'dim');
                }).join(''):pill('无主','dim');
                return '<article class="we-card" data-asset-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(asset.类型||'类型未记录','dim')+'</div><div class="we-tools"><b>所属对象</b>'+ownerLinks+(owners.length>1?pill('共同持有','future'):'')+'</div><p>'+text(asset.状态||'状态未记录')+'</p>'+fields({主体规模:asset.主体规模,完整度:asset.完整度==null?undefined:asset.完整度+'%'})+details('asset-'+name,{能源:asset.能源,建设序列:asset.建设序列,驻扎人员:asset.驻扎人员,待办事件:asset.待办事件},'运转详情 · 建设 / 驻扎 / 待办')+'</article>';
            }).join('')||empty('暂无符合条件的资产'),'共 '+assets.length+' 项 · 可按名称、所属对象或状态搜索');
            return html;
        }
    }
    class WorldEventArchiveView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {engine,events,matched,tools,section,timelineCards,empty}=ctx;
                    const list=events.filter(([n,e])=>matched(n,e)&&((engine.filter||'全部')==='全部'||e.状态===engine.filter));
                    return tools(['全部','进行中','待发生','已完成','已取消'])
                        +section('世界事件','<div class="we-timeline">'+(timelineCards(list)||empty('没有符合条件的世界事件','按当前事件、近期节点和宏观节点组织。'))+'</div>','按状态层级与因果顺序排列');
                
        }
    }
    class WorldRumorView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const {s,state,tools,section,entries,matched,text,fields,details,empty,pill}=context;
            let html=tools();
            for(const category of ['街头巷议','情报交易','布告与檄文']){
                html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
            }
            html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            return html;
        }
    }
    class WorldHistoryView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {state,radar,showRadar,exists,section,text,entries,fields,empty,pill}=ctx;
                    let html='';
                    if(showRadar&&exists(radar.当前模式))html+=section('干涉模式','<article class="we-card"><p>'+text(radar.当前模式)+'</p></article>');
                    const historyMemory=projectWorldHistoryMemory(state);
                    html+=section('近期历史锚点',entries(historyMemory.近期锚点).reverse().map(([n,r])=>'<article class="we-card"><div class="we-meta">'+text(r.时间)+'</div><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无未收纳的近期历史锚点'),(historyMemory.统计?.原始锚点总数||0)+' 条原始历史 · 仅展示当前热根节点');
                    html+=section('长期历史总结',(historyMemory.长期总结||[]).slice().reverse().map(r=>'<article class="we-card"><div class="we-card-top"><h3>'+text(r.名称)+'</h3>'+pill('L'+text(r.层级),'dim')+'</div><div class="we-meta">'+text([r.起始时间,r.结束时间].filter(Boolean).join(' → '))+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚无长期历史总结','历史锚点积累后会自动分层压缩；底层事实仍保留在MVU。'),(historyMemory.统计?.总结节点总数||0)+' 个总结节点 · 原始历史不删除');
                    return html;
                
        }
    }
    class WorldSettingsView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {engine,section,text}=ctx;
                    let html='';
                    const api=engine.normalizeDedicatedApi(engine.config.dedicatedApi);
                    const fontButtons=Object.entries(WORLD_FONT_SCALES).map(([key,item])=>'<button class="we-setting-btn '+(engine.config.fontScale===key?'active':'')+'" data-font-option="'+key+'">'+text(item.name)+' · '+text(item.size)+'</button>').join('');
                    const presets=api.apiPresets.map(p=>'<option value="'+text(p.name)+'">'+text(p.name)+'</option>').join('');
                    const terminalModels=Array.isArray(engine.host.Samsara?.terminal?.models?.())?engine.host.Samsara.terminal.models():[];
                    const terminalModel=String(engine.host.Samsara?.terminal?.currentModel?.()||'');
                    const modelOptions=Array.from(new Set([api.model,...api.fetchedModels,terminalModel,...terminalModels].filter(Boolean))).map(model=>'<option value="'+text(model)+'"></option>').join('');
                    const temperature=Math.max(0,Math.min(2,Number.isFinite(Number(engine.config.temperature))?Number(engine.config.temperature):0.3));
                    const fallbackModel=String(engine.config.fallbackModel||'');
                    const terminalReady=!!(engine.host.Samsara?.terminal?.apiReady?.());
                    const sourceState=engine.usesDedicatedApi()
                        ?(engine.dedicatedApiReady()?'专属 API 已就绪':'专属 API 已接管，但配置尚不完整')
                        :(terminalReady?'使用主神终端额外模型':'主神终端额外模型尚未准备好');
                    html+=section('界面字号','<div class="we-setting-row"><div class="we-setting-copy"><b>界面字号</b><small>色调跟随主神终端；这里仅调整世界推进自己的文字大小。</small></div><div class="we-setting-actions">'+fontButtons+'</div></div>','色调跟随主神终端 · 默认标准 16px');
                    const historyToProse=engine.config.sendHistoryToProse===true;
                    html+=section('历史记忆','<div class="we-setting-row"><div class="we-setting-copy"><b>向正文提供历史记忆</b><small>开启后，正文AI额外读取“近期原始锚点 + 更早长期总结”；关闭只影响正文，世界推进自身仍始终使用完整的分层历史脉络。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(historyToProse?'on':'')+'" data-action="history-prose-toggle"><span>'+text(historyToProse?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>','默认关闭 · 原始历史事实不会因关闭而删除');
                    html+=section('模型接口',
                        '<div class="we-setting-row"><div class="we-setting-copy"><b>当前调用来源</b><small>'+text(sourceState)+'</small></div><div class="we-setting-actions"><span class="we-source-badge">'+text(engine.apiSourceLabel())+'</span></div></div>'
                        +'<div class="we-api-grid"><label>推演温度<input class="we-setting-input" data-world-temperature type="number" min="0" max="2" step="0.05" value="'+text(temperature)+'"></label><label>Fallback 模型（可选）<input class="we-setting-input" data-fallback-model list="we-world-fallback-models" value="'+text(fallbackModel)+'" placeholder="主模型连续失败后切换"><datalist id="we-world-fallback-models">'+modelOptions+'</datalist></label></div><p class="we-muted">温度默认 0.3。Fallback 留空即关闭；填写后，主模型用尽“每个模型最大尝试次数”仍失败才切换备用模型继续。专属 API 与新版主神终端额外模型都支持模型覆盖。</p>'
                        +'<div class="we-setting-row"><div class="we-setting-copy"><b>世界推进专属 API</b><small>开启后世界推进只走这里，不再调用状态栏 / 主神终端的 API；即使配置不完整也不会偷偷回退。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(api.enabled?'on':'')+'" data-action="dedicated-toggle"><span>'+text(api.enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>'
                        +(api.enabled
                            ?'<div class="we-api-toolbar"><select class="we-setting-input" data-dedicated-preset><option value="">— 选择已保存 API 预设 —</option>'+presets+'</select><input class="we-setting-input" data-dedicated-preset-name maxlength="80" placeholder="预设名称"><button class="we-setting-btn" data-action="dedicated-preset-save">保存预设</button><button class="we-setting-btn" data-action="dedicated-preset-delete">删除预设</button></div>'
                             +'<div class="we-api-grid"><label class="wide">API 地址<input class="we-setting-input" data-dedicated-field="apiUrl" value="'+text(api.apiUrl)+'" placeholder="https://example.com/v1"></label><label class="wide">API Key<input class="we-setting-input" data-dedicated-field="apiKey" type="password" value="'+text(api.apiKey)+'" autocomplete="off" placeholder="sk-..."></label><label>模型<input class="we-setting-input" data-dedicated-field="model" list="we-dedicated-models" value="'+text(api.model)+'" placeholder="输入或加载模型名"><datalist id="we-dedicated-models">'+modelOptions+'</datalist></label><label>模型目录<span class="we-setting-actions"><button class="we-setting-btn" data-action="dedicated-models">加载模型 / 测试连接</button></span></label></div>'
                             +'<p class="we-muted">接口按 OpenAI-compatible /v1/chat/completions 与 /v1/models 方式连接，并保留 JSON Schema → JSON Object → 普通文本的结构化兼容降级。</p>'
                            :'<div class="we-notice">当前关闭专属 API。世界推进继续使用主神终端「额外模型配置」；这里不会复制或读取状态栏里的 API Key。</div>')
                        ,'接口配置只存本地 localStorage，不写入 MVU');
                    const snapshots=engine.services?.snapshots?.list?.()||[];
                    html+=section('世界快照',
                        '<div class="we-doc-create"><input class="we-setting-input" data-world-snapshot-name maxlength="80" placeholder="快照名称，例如：司法岛决战前"><button class="we-btn we-primary" data-action="world-snapshot-save">保存世界快照</button></div>'
                        +(snapshots.length?'<div class="we-doc-list">'+snapshots.map(item=>'<div class="we-doc-row"><div><b>'+text(item.name)+'</b><small>'+text(item.worldTime||'时间未记录')+' · '+text(item.createdAt?new Date(item.createdAt).toLocaleString():'未记录时间')+'</small></div><span class="we-doc-actions"><button data-action="world-snapshot-restore" data-snapshot-id="'+text(item.id)+'">恢复</button><button data-action="world-snapshot-delete" data-snapshot-id="'+text(item.id)+'">删除</button></span></div>').join('')+'</div>':'<div class="we-empty"><b>暂无世界快照</b><small>只保存世界推进负责的数据，不回滚玩家角色数值与任务状态。</small></div>')
                        +'<p class="we-muted">快照保存 世界、资产、关系列表与传闻；恢复时不会回滚角色属性、背包、任务或成就。恢复后会清除当前楼层的世界推进处理锚点，允许重新建立后续世界状态。</p>',
                        '最多保留当前聊天最近 12 份 · 仅存本地');
                    return html;
                
        }
    }
    class WorldPromptView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {engine,text,section,empty}=ctx;
                    let html='';
                    const promptView=engine.promptDraft||{
                        preset:engine.config.preset,
                        corePrompt:engine.config.corePrompt??CORE_WORLD_RULES,
                        macroPrompt:engine.config.macroPrompt??DEFAULT_MACRO_PROMPT,
                        stabilityPromptTemplate:engine.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,
                        structurePrompt:engine.config.structurePrompt,
                        npcAuditPrompt:engine.config.npcAuditPrompt,
                        contextTurns:engine.config.contextTurns||6,
                        activationMode:engine.config.activationMode||'respect_activation',
                        selectedEntries:Array.isArray(engine.config.selectedEntries)?copy(engine.config.selectedEntries):null
                    };
                    const docs=engine.getPromptDocuments(),activeDoc=docs.find(doc=>doc.id===engine.config.activePromptDocumentId);
                    html+='<div class="we-preset-toolbar"><div><b>提示词工作台</b><small>主要操作固定在顶部，不需要再滚到页面底部寻找保存。</small></div><div><button class="we-btn we-primary" data-action="save">保存当前设置</button><button class="we-btn" data-action="save-default">保存为个人默认</button><button class="we-btn" data-action="preview">预览下一次请求</button></div></div>';
                    html+=section('预设文档','<div class="we-doc-create"><input data-doc-name maxlength="80" placeholder="文档名称，例如：原著推进·标准" value="'+text(activeDoc?.builtin?'':activeDoc?.name||'')+'"><button class="we-btn we-primary" data-action="doc-save">保存为文档</button><button class="we-btn" data-action="doc-import">导入文档</button><input data-doc-import type="file" accept=".json,application/json" hidden></div>'+
                        (docs.length?'<div class="we-doc-list">'+docs.map(doc=>'<div class="we-doc-row"><div><b>'+text(doc.name)+(doc.builtin?' <span class="we-doc-badge">内置默认</span>':'')+'</b><small>'+text(doc.updatedAt?new Date(doc.updatedAt).toLocaleString():'未记录时间')+(doc.id===engine.config.activePromptDocumentId?' · 当前应用':'')+'</small></div><span class="we-doc-actions"><button data-action="doc-apply" data-doc-id="'+text(doc.id)+'">应用</button><button data-action="doc-export" data-doc-id="'+text(doc.id)+'">导出</button>'+(doc.builtin?'':'<button data-action="doc-delete" data-doc-id="'+text(doc.id)+'">删除</button>')+'</span></div>').join('')+'</div>':empty('还没有预设文档','保存当前设置后，可以在这里应用、导出或删除。')),'内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存全部可编辑提示词、正文窗口与资料范围，不会覆盖内置模板');
                    html+='<div class="we-notice">世界书目录会读取角色主书、角色附加书、当前聊天绑定书和酒馆全局启用书。蓝绿灯表示条目触发方式；“实际读取”仍以请求检查中的本次清单为准。</div>';
                    const groups=new Map();
                    for(const e of engine.bookCatalogue||[]){if(!groups.has(e.book))groups.set(e.book,[]);groups.get(e.book).push(e);}
                    const selectedEntries=Array.isArray(promptView.selectedEntries)?promptView.selectedEntries:null;
                    const selected=e=>!e.technical&&(engine.isNpcAuditWorldbook(e)?engine.isNpcBuildAuditEnabled():selectedEntryMatches(e,selectedEntries));
                    html+=section('资料读取范围','<div class="we-config-row"><label>正文窗口 <input data-floors type="number" min="1" max="100" value="'+text(promptView.contextTurns||6)+'"> 层</label><label>读取方式 <select data-activation><option value="respect_activation" '+(promptView.activationMode!=='force_selected'?'selected':'')+'>遵循蓝绿灯</option><option value="force_selected" '+(promptView.activationMode==='force_selected'?'selected':'')+'>强制读取勾选项</option></select></label></div><p class="we-muted">遵循蓝绿灯：蓝灯常驻，绿灯扫描上述正文窗口关键词；禁用项不读。强制模式可纳入普通禁用项，但 [variables]、[mvu_update]、正文额外思考及任务/输出技术条目始终隔离。未绑定且未全局启用的世界书不会被自动读取。</p><div class="we-tools"><button data-action="books">加载 / 刷新目录</button><button data-action="book-all">全选</button><button data-action="book-none">全不选</button></div>'+
                        (groups.size?Array.from(groups).map(([book,list])=>'<details class="we-book" open><summary>'+text(book)+' <small>'+text((list[0]?.sources||[]).join(' · ')||'已绑定')+' · '+list.filter(selected).length+' / '+list.length+' 项已勾选</small></summary><div class="we-book-list">'+list.map(e=>{
                            const report=(engine.readReport||[]).find(r=>r.世界书===e.book&&r.条目ID===e.id);
                            return '<label class="we-book-row"><input type="checkbox" data-book value="'+text(JSON.stringify([e.book,e.id]))+'" '+(selected(e)?'checked':'')+' '+(e.technical?'disabled':'')+'><span class="we-lamp '+(e.technical?'gray':e.mode==='constant'?'blue':e.mode==='selective'?'green':'gray')+'" title="'+text(e.technical?'技术条目 · 已隔离':e.mode==='constant'?'蓝灯 · 常驻':e.mode==='selective'?'绿灯 · 关键词触发':'其他激活方式')+'"></span><span class="we-book-title"><b>'+text(e.title)+'</b><small>'+text(e.technical?'技术条目 · 世界引擎不读取':(e.mode==='constant'?'常驻':e.mode==='selective'?'关键词：'+(Array.isArray(e.keys)?e.keys.map(k=>typeof k==='string'?k:'正则条件').join('、'):e.keys):e.mode)+(e.enabled?'':' · 已禁用'))+'</small></span><small class="we-read-state">'+text(report?'上次检查：'+report.原因:e.technical?'固定隔离':'尚未检查')+'</small></label>';
                        }).join('')+'</div></details>').join(''):empty('尚未加载目录','点击“加载 / 刷新目录”读取当前绑定和全局启用的世界书。')));
                    const segments=splitPresetSegments(promptView.preset);
                    html+=section('分段提示词','<div class="we-segment-toolbar"><span>默认只读，展开查看；开启编辑后可修改。</span><button class="we-btn" data-action="prompt-edit" aria-pressed="'+!!engine.promptEditing+'">'+(engine.promptEditing?'锁定编辑':'开启编辑')+'</button><button class="we-btn" data-action="segment-add" '+(engine.promptEditing?'':'disabled')+'>＋ 新增分段</button></div><div class="we-segment-list" data-segment-list>'+segments.map((part,i)=>'<details class="we-segment" data-segment-row><summary>'+text(part.title||'未命名分段')+' <small>'+formatTokenCount(estimateTokens(part.body),true)+'</small></summary><div class="we-segment-head"><input '+(engine.promptEditing?'':'readonly')+' data-segment-title aria-label="分段标题 '+i+'" placeholder="分段标题（可留空）" value="'+text(part.title)+'"><small>'+formatTokenCount(estimateTokens(part.body),true)+'</small><span class="we-segment-actions"><button type="button" '+(engine.promptEditing?'':'disabled')+' data-action="segment-up" title="上移">↑</button><button type="button" '+(engine.promptEditing?'':'disabled')+' data-action="segment-down" title="下移">↓</button><button type="button" '+(engine.promptEditing?'':'disabled')+' data-action="segment-delete" title="删除">删除</button></span></div><textarea '+(engine.promptEditing?'':'readonly')+' data-segment="'+i+'" data-title="'+text(part.title)+'" aria-label="预设分段 '+i+'">'+text(part.body)+'</textarea></details>').join('')+'</div><p class="we-muted">这些分段属于主要工作层，可以新增、删除或调整顺序。核心约束与条件提示词在下方单独编辑，并与同一预设文档一起保存。</p>');
                    html+=section('系统提示词','<div class="we-notice">这里展示的文本都会直接参与实际 system 请求，并随预设文档保存、应用、导入和导出。条件提示词只在对应条件成立时发送；只有程序字段 Schema 保持固定。</div>'
                        +'<details class="we-segment"><summary>世界引擎核心约束 · '+(engine.promptEditing?'编辑中':'点击展开')+'</summary><textarea data-core-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.corePrompt??CORE_WORLD_RULES)+'</textarea><p class="we-muted">始终发送。可修改或留空；留空即不额外注入核心约束。</p></details>'
                        +'<details class="we-segment"><summary>宏观骨架交付 · 条件提示词</summary><textarea data-macro-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.macroPrompt??DEFAULT_MACRO_PROMPT)+'</textarea><p class="we-muted">仅在本轮需要建立/补足宏观骨架时发送。</p></details>'
                        +'<details class="we-segment"><summary>世界自救 · 条件提示词模板</summary><textarea data-stability-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)+'</textarea><p class="we-muted">世界稳定值低于100且未开启世界超稳时发送。可使用 {{阶段}}、{{稳定值}}、{{规则}} 占位符。</p></details>'
                        +'<details class="we-segment"><summary>角色管理 · NPC构筑审计 · '+(engine.isNpcBuildAuditEnabled()?'当前启用':'当前关闭')+'</summary><textarea data-npc-audit-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)+'</textarea><p class="we-muted">无论开关状态都可编辑并保存；只有开启审计且本轮存在审计对象时才发送。</p></details>','核心与条件提示词均可编辑');
                    html+=section('WorldResult 输出协议','<details class="we-segment"><summary>WorldResult 协议说明 · 点击展开</summary><textarea data-structure-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'</textarea></details><details class="we-segment"><summary>程序字段 Schema · 只读</summary><textarea readonly>'+text(JSON.stringify(WORLD_RESULT_SCHEMA,null,2))+'</textarea></details><p class="we-muted">协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，修改任何文字提示词都不会改变程序变量结构。</p>');
                    return html;
                
        }
    }
    class WorldRequestInspectorView {
        constructor(engine){this.engine=engine;}
        render(context={}){
            const ctx={...context,engine:this.engine};
            
                    const {engine,text,section,empty,fields,pill}=ctx;
                    let html='';
                    const fold=(title,body)=>'<details class="we-inspect"><summary>'+text(title)+'</summary><div class="we-inspect-body">'+body+'</div></details>';
                    const raw=(label,v)=>fold(label,'<textarea class="we-raw" readonly>'+text(v)+'</textarea>');
                    const readable=(name,v)=>Array.isArray(v)?v.map((item,i)=>fold((item.名称||item.楼层!==undefined&&(item.角色+' · 第 '+item.楼层+' 层')||name+' '+(i+1)),fields(item))).join(''):fields(plain(v)?v:{内容:v});
                    const retryLog=(engine.lastRetryLog||[]).map(item=>{
                        const feedback=retryFeedback(item.错误,Array.isArray(item.片段)?item.片段:[],Array.isArray(item.补充清单)?item.补充清单:[]);
                        const details=feedback.issues.length?'<p><b>具体问题</b><br>'+feedback.issues.map(text).join('<br>')+'</p>':'';
                        const guidance=feedback.actions.length?'<p><b>修复要求</b><br>'+feedback.actions.map(text).join('<br>')+'</p>':'';
                        return '<div class="we-change"><time>#'+text(item.尝试)+'</time><div><b>'+text(item.类型||'模型回复被拒绝')+'</b><p>'+text(feedback.summary)+'</p>'+details+guidance+'</div></div>';
                    }).join('');
                    const tokenLabel=(value,estimated=true)=>Number.isFinite(Number(value))?formatTokenCount(Number(value),estimated):'—';
                    html+=section('失败自动重试','<div class="we-config-row"><label>每个模型最大尝试次数 <input data-retries type="number" min="1" max="5" value="'+text(engine.config.retryAttempts??5)+'"> 次</label><span class="we-muted">包含首次请求。1 = 只请求一次；5 = 每个模型最多尝试 5 次。HTTP/网络错误、空回、解析失败和业务验收失败都会重试；危险越权、上下文变化和写入未确认仍直接终止。配置备用模型后，主模型达到本次数上限才切换备用模型，并再使用同样的尝试次数。</span></div>'+(engine.lastAttemptCount?'<p class="we-muted">最近一次共尝试 '+text(engine.lastAttemptCount)+' 次；请求失败和模型业务拒绝都会在下方保留。业务分片验收会累计已通过片段，纠错只要求补失败部分。</p>':'')+(retryLog||''));
                    html+='<div class="we-tools"><button data-action="preview">生成下一次请求预览（不调用 API）</button></div>';
                    for(const [label,r] of [['最近实际发送',engine.lastRequest],['下一次请求预览',engine.previewRequest]]){
                        if(!r){html+=section(label,empty('暂无'+label));continue;}
                        const m=r.manifest||{},books=m.世界书条目||[],floors=m.正文楼层||[],obs=m.观测||requestTokenTelemetry(r.system,r.input,r.schema||WORLD_RESULT_SCHEMA);
                        const readChecks=(m.读取判定||[]).filter(item=>item.读取===true);
                        const exactInput=obs.实际输入Tokens!=null,exactOutput=obs.实际输出Tokens!=null;
                        let body='<div class="we-request-summary">'+pill(m.输出协议||'WorldResult v1','dim')+pill('结构化 '+(obs.结构化实际模式||m.结构化输出||'auto'),'dim')+pill(obs.接口来源||m.接口来源||engine.apiSourceLabel(),'dim')+pill(books.length+' 条世界书','dim')+pill(floors.length+' 层正文','dim')+pill((exactInput?tokenLabel(obs.实际输入Tokens,false):tokenLabel(obs.请求估算Tokens,true))+' 输入','dim')+(obs.输出估算Tokens!=null?pill((exactOutput?tokenLabel(obs.实际输出Tokens,false):tokenLabel(obs.输出估算Tokens,true))+' 输出','dim'):'')+(m.尝试序号?pill('尝试 '+m.尝试序号,'dim'):'')+(m.最大尝试次数!==undefined?pill('最多尝试 '+m.最大尝试次数,'dim'):'')+'</div>';
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
                    if(engine.lastWorldResult)html+=section('最近 WorldResult · 业务层',raw('模型已接受并累计的业务结果',JSON.stringify(engine.lastWorldResult,null,2)));
                    if((engine.lastCompiledPatches||[]).length)html+=section('程序编译补丁 · 存储层',raw('由 WorldResult Compiler 生成，模型不直接控制这些路径',JSON.stringify(engine.lastCompiledPatches,null,2)));
                    if((engine.lastCompileWarnings||[]).length)html+=section('编译警告',(engine.lastCompileWarnings||[]).map(w=>'<div class="we-notice">'+text(w)+'</div>').join(''));
                    if(engine.lastFailure)html+='<div class="we-notice">'+text(engine.lastFailure)+'</div>';
                    if(engine.lastReply){
                        const lastAttempt=(engine.lastAttemptTelemetry||[]).at(-1),replyTk=lastAttempt?.API输出Tokens!=null?formatTokenCount(lastAttempt.API输出Tokens,false):formatTokenCount(estimateTokens(engine.lastReply),true);
                        html+=section('副 API 原始回复 · '+replyTk,raw('查看模型返回原文（用于定位格式问题）',engine.lastReply));
                    }
                    return html;
                
        }
    }
    class WorldEngineViewRegistry {
        constructor(engine){
            this.engine=engine;
            this.views=new Map([
                ['world',new WorldOverviewView(engine)],
                ['people',new WorldPeopleView(engine)],
                ['exploration',new WorldExplorationView(engine)],
                ['assets',new WorldAssetView(engine)],
                ['events',new WorldEventArchiveView(engine)],
                ['rumors',new WorldRumorView(engine)],
                ['history',new WorldHistoryView(engine)],
                ['settings',new WorldSettingsView(engine)],
                ['prompts',new WorldPromptView(engine)],
                ['requestInspector',new WorldRequestInspectorView(engine)]
            ]);
        }
        get(key){return this.views.get(key)||null;}
        register(key,view){
            if(!key||!view||typeof view.render!=='function')throw new Error('世界推进 View 注册无效');
            this.views.set(String(key),view);return view;
        }
        render(key,context){
            const view=this.get(key);if(!view)throw new Error('世界推进 View 不存在：'+key);
            return view.render(context);
        }
        keys(){return Array.from(this.views.keys());}
        describe(){return this.keys().map(key=>({key,className:this.get(key)?.constructor?.name||''}));}
    }
    class WorldPanelController {
        constructor(engine){this.engine=engine;}
        createPanel() {
            const engine=this.engine;

            if (engine.panel && engine.panel.isConnected) return;
            const doc=engine.host.document;
            engine.style=doc.createElement('style');
            engine.style.textContent = worldEngineBaseStyleText();
            engine.mount=doc.createElement('div');
            engine.mount.id='sam-world-engine-host';
            engine.mount.style.setProperty('all','initial','important');
            const isolated=engine.mount.attachShadow({mode:'open'});
            isolated.appendChild(engine.style);
            engine.panel=doc.createElement('section');engine.panel.id='sam-world-engine';engine.panel.hidden=true;
            engine.panel.dataset.tone=engine.statusTone();engine.panel.dataset.fontScale=engine.config.fontScale||'standard';
            engine.panel.setAttribute('role','dialog');engine.panel.setAttribute('aria-label','世界引擎');
            engine.panel.innerHTML='<header><div class="we-brand"><i>◈</i>世界引擎<small>WORLD CHRONICLE</small></div><button class="we-btn we-primary" data-action="run">推进世界</button><button class="we-btn" data-action="close" aria-label="返回主神终端">返回 ↗</button></header><div class="we-layout"><nav></nav><main></main></div><footer><span></span><small>剧情时间驱动 · 由主神终端「世界推进」总开关控制</small></footer>';
            engine.panel.addEventListener('click',event=>{
                const button=event.target.closest('button');if(!button)return;
                const a=button.dataset.action;
                if(button.dataset.directory){engine.directoryTab=button.dataset.directory;engine.render();return;}
                if(button.dataset.area){engine.selectedArea=button.dataset.area;engine.directoryTab='探索';engine.render();return;}
                if(button.dataset.faction){if(button.hasAttribute('data-asset-owner'))engine.tab='探索与势力';engine.selectedFaction=button.dataset.faction;engine.directoryTab='势力';engine.render();return;}
                if(button.dataset.jumpPerson){engine.selectedPerson=button.dataset.jumpPerson;engine.tab='角色管理';engine.filter='全部';engine.query='';engine.selectedDate='';engine.render(true);return;}
                if(button.dataset.jumpEvent){
                    engine.jumpEvent=button.dataset.jumpEvent;engine.tab='世界推进';engine.filter='全部';engine.query='';
                    const world=engine.snapshot().stat.世界,event=world[PATH]?.事件?.[engine.jumpEvent],calendar=world.历法;
                    const date=calendarDate(event?.时间||event?.开始时间,calendar),today=calendarDate(world.时间,calendar);
                    const monthsPerYear=Array.isArray(calendar?.月份天数)&&calendar.月份天数.length?calendar.月份天数.length:12;
                    engine.selectedDate=date?.key||'';engine.calendarMode=date?'date':'undated';
                    engine.monthOffset=date&&today?(date.y-today.y)*monthsPerYear+date.m-today.m:0;
                    engine.eventLimit=Number.MAX_SAFE_INTEGER;engine.render(true);return;
                }
                if(button.dataset.person){engine.selectedPerson=button.dataset.person;engine.render();return;}
                if(a==='close')engine.close();
                else if(a==='run'){
                    if(engine.busy){if(!engine.committing){engine.cancel();engine.status='已请求停止';engine.render();}}
                    else (engine.services?.manualAdvance?.trigger?.()||engine.run()).catch(()=>{});
                }
                else if(a==='cancel'){engine.cancel();engine.status='已请求停止';engine.render();}
                else if(a==='save'){
                    const settings=engine.readPromptEditor();
                    engine.applyPromptSettings(settings);
                    engine.promptDraft=null;
                    engine.status='提示词与资料范围已保存';
                    engine.panel.querySelector('footer span').textContent=engine.status;
                }
                else if(a==='prompt-edit'){
                    engine.promptEditing=!engine.promptEditing;
                    button.textContent=engine.promptEditing?'锁定编辑':'开启编辑';button.setAttribute('aria-pressed',String(engine.promptEditing));
                    engine.panel.querySelectorAll('[data-segment-title],[data-segment],[data-structure-prompt],[data-npc-audit-prompt]').forEach(el=>el.readOnly=!engine.promptEditing);
                    engine.panel.querySelectorAll('[data-action^="segment-"]').forEach(el=>el.disabled=!engine.promptEditing);
                }
                else if(a==='save-default'){
                    const settings=engine.readPromptEditor();engine.applyPromptSettings(settings);
                    engine.config.userDefaultPromptSettings=copy(settings);
                    const docs=engine.getPromptDocuments();
                    let doc=docs.find(d=>d.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                    const now=new Date().toISOString();
                    if(doc){doc.settings=copy(settings);doc.updatedAt=now;}
                    else docs.push({id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,name:'个人默认设置',createdAt:now,updatedAt:now,settings:copy(settings)});
                    engine.config.activePromptDocumentId=USER_DEFAULT_PROMPT_DOCUMENT_ID;
                    engine.saveConfig();engine.status='已保存为个人默认设置';engine.panel.querySelector('footer span').textContent=engine.status;
                }
                else if(a==='segment-add'){
                    if(!engine.promptEditing)return;
                    const list=engine.panel.querySelector('[data-segment-list]');if(!list)return;
                    const row=engine.host.document.createElement('details');row.open=true;row.className='we-segment';row.setAttribute('data-segment-row','');
                    row.innerHTML='<summary>新分段</summary><div class="we-segment-head"><input data-segment-title aria-label="分段标题" placeholder="分段标题（可留空）"><small>新分段</small><span class="we-segment-actions"><button type="button" data-action="segment-up" title="上移">↑</button><button type="button" data-action="segment-down" title="下移">↓</button><button type="button" data-action="segment-delete" title="删除">删除</button></span></div><textarea data-segment data-title="" aria-label="新分段正文" placeholder="输入这一段的提示词正文…"></textarea>';
                    list.appendChild(row);row.querySelector('[data-segment-title]').focus();
                }
                else if(a==='segment-up'||a==='segment-down'){
                    if(!engine.promptEditing)return;
                    const row=button.closest('[data-segment-row]'),parent=row?.parentElement;if(!row||!parent)return;
                    if(a==='segment-up'&&row.previousElementSibling)parent.insertBefore(row,row.previousElementSibling);
                    if(a==='segment-down'&&row.nextElementSibling)parent.insertBefore(row.nextElementSibling,row);
                }
                else if(a==='segment-delete'){if(!engine.promptEditing)return;button.closest('[data-segment-row]')?.remove();}
                else if(a==='doc-save'){
                    try{
                        const settings=engine.readPromptEditor(),name=engine.panel.querySelector('[data-doc-name]')?.value||'';
                        engine.applyPromptSettings(settings);
                        const doc=engine.savePromptDocument(name,settings);engine.promptDraft=null;
                        engine.status='已保存预设文档：'+doc.name;engine.render(true);
                    }catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='doc-apply'){
                    const doc=engine.getPromptDocuments().find(item=>item.id===button.dataset.docId);if(!doc)return;
                    engine.applyPromptSettings(doc.settings);engine.config.activePromptDocumentId=doc.id;
                    if(doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                        engine.config.builtinDefaultWorldbookExclusionsApplied=[];
                        engine.applyBuiltinDefaultWorldbookExclusions(engine.bookCatalogue||[]);
                    }
                    engine.saveConfig();engine.promptDraft=null;
                    engine.status='已应用预设文档：'+doc.name+(Array.isArray(doc.settings?.selectedEntries)&&!(engine.bookCatalogue||[]).length?' · 世界书勾选将在加载目录后显示':'');
                    engine.render(true);
                }
                else if(a==='doc-export'){
                    try{engine.exportPromptDocument(button.dataset.docId);engine.status='预设文档已导出';engine.panel.querySelector('footer span').textContent=engine.status;}
                    catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='doc-delete'){
                    engine.promptDraft=engine.readPromptEditor();
                    const doc=engine.getPromptDocuments().find(item=>item.id===button.dataset.docId);
                    if(engine.deletePromptDocument(button.dataset.docId)){engine.status='已删除预设文档'+(doc?'：'+doc.name:'');engine.render(true);}
                }
                else if(a==='doc-import'){
                    engine.promptDraft=engine.readPromptEditor();
                    const input=engine.panel.querySelector('[data-doc-import]');if(input){input.value='';input.click();}
                }
                else if(a==='books'){
                    engine.promptDraft=engine.readPromptEditor();
                    engine.catalogue().then(list=>{engine.bookCatalogue=list;engine.render(true);}).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(a==='book-all'||a==='book-none'){engine.panel.querySelectorAll('[data-book]').forEach(e=>{e.checked=a==='book-all'&&!e.disabled;});}
                else if(a==='preview'){
                    const settings=engine.tab==='提示词预设'?engine.readPromptEditor():null;
                    if(settings)engine.applyPromptSettings(settings);
                    engine.promptDraft=null;
                    engine.buildRequest(engine.snapshot()).then(r=>{engine.previewRequest=r;engine.tab='请求检查';engine.render(true);}).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(button.dataset.fontOption){
                    const scale=button.dataset.fontOption;
                    if(WORLD_FONT_SCALES[scale]){engine.config.fontScale=scale;engine.panel.dataset.fontScale=scale;engine.saveConfig();engine.status='界面字号已切换为 '+WORLD_FONT_SCALES[scale].name;engine.render(true);}
                }
                else if(a==='world-snapshot-save'){
                    try{
                        const name=engine.panel.querySelector('[data-world-snapshot-name]')?.value||'';
                        const item=engine.services?.snapshots?.create?.(name);
                        if(!item)throw new Error('世界快照服务未初始化');
                        engine.status='已保存世界快照：'+item.name;engine.render(true);
                    }catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='world-snapshot-restore'){
                    const id=button.dataset.snapshotId||'';
                    engine.cancel();
                    Promise.resolve(engine.services?.snapshots?.restore?.(id)).then(ok=>{
                        if(ok){engine.status='世界快照已恢复';engine.render(true);}
                    }).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(a==='world-snapshot-delete'){
                    const id=button.dataset.snapshotId||'';
                    if(engine.services?.snapshots?.remove?.(id)){engine.status='世界快照已删除';engine.render(true);}
                }
                else if(a==='dedicated-toggle'){
                    engine.cancel();
                    const api=engine.normalizeDedicatedApi(engine.config.dedicatedApi);
                    api.enabled=!api.enabled;engine.config.dedicatedApi=api;
                    if(!api.enabled&&engine.isConfigured()){
                        const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
                        if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
                    }
                    engine.saveConfig();
                    engine.status=api.enabled?'已启用世界推进专属 API · 不再使用主神终端 API':'已关闭专属 API · 回退使用主神终端 API';
                    engine.render(true);
                }
                else if(a==='dedicated-models'){
                    engine.status='正在加载专属 API 模型列表';engine.panel.querySelector('footer span').textContent=engine.status;
                    engine.fetchDedicatedModels().then(list=>{engine.status='已加载 '+list.length+' 个模型';engine.render(true);}).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(a==='dedicated-preset-save'){
                    try{
                        const name=engine.panel.querySelector('[data-dedicated-preset-name]')?.value||'';
                        const entry=engine.saveDedicatedApiPreset(name);
                        engine.status='已保存 API 预设：'+entry.name;engine.render(true);
                    }catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='dedicated-preset-delete'){
                    const name=engine.panel.querySelector('[data-dedicated-preset]')?.value||'';
                    if(!name){engine.status='请先选择要删除的 API 预设';engine.panel.querySelector('footer span').textContent=engine.status;}
                    else if(engine.deleteDedicatedApiPreset(name)){engine.status='已删除 API 预设：'+name;engine.render(true);}
                }
                else if(a==='month'){
                    engine.monthOffset=(engine.monthOffset||0)+Number(button.dataset.step);
                    const world=engine.snapshot().stat.世界,calendar=world.历法,today=calendarDate(world.时间,calendar);
                    if(today){
                        const custom=Array.isArray(calendar?.月份天数)?calendar.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                        if(custom.length){
                            let y=today.y,m=today.m+engine.monthOffset;
                            while(m<1){m+=custom.length;y--;}
                            while(m>custom.length){m-=custom.length;y++;}
                            engine.selectedDate=y+'-'+m+'-1';
                        }else{
                            const date=new Date(0);date.setFullYear(today.y,today.m-1+engine.monthOffset,1);
                            engine.selectedDate=date.getFullYear()+'-'+(date.getMonth()+1)+'-1';
                        }
                    }
                    engine.calendarMode='date';engine.eventLimit=12;engine.render();
                }
                else if(a==='date'){engine.selectedDate=button.dataset.date;engine.calendarMode='date';engine.eventLimit=12;engine.render();}
                else if(a==='clear-date'){engine.selectedDate='';engine.calendarMode='all';engine.eventLimit=12;engine.render();}
                else if(a==='today'){engine.selectedDate=undefined;engine.calendarMode='today';engine.monthOffset=0;engine.eventLimit=12;engine.render();}
                else if(a==='undated'){engine.selectedDate='';engine.calendarMode='undated';engine.eventLimit=12;engine.render();}
                else if(a==='more-events'){engine.eventLimit=(engine.eventLimit||12)+12;engine.render();}
                else if(button.dataset.filter){engine.filter=button.dataset.filter;engine.render();}
                else if(button.dataset.tab){engine.tab=button.dataset.tab;engine.filter='全部';engine.query='';engine.selectedDate=undefined;engine.calendarMode='today';engine.monthOffset=0;engine.eventLimit=12;engine.render(true);}
            });
            engine.panel.addEventListener('input',event=>{
                if(event.target.matches('[data-search]')){
                    const caret=event.target.selectionStart;engine.query=event.target.value;engine.render();
                    const input=engine.panel.querySelector('[data-search]');input.focus();input.setSelectionRange(caret,caret);
                }else if(event.target.matches('[data-segment-title]')){
                    const row=event.target.closest('[data-segment-row]'),body=row?.querySelector('[data-segment]');
                    if(body)body.dataset.title=cleanSegmentTitle(event.target.value);
                }
            });
            engine.panel.addEventListener('change',event=>{
                if(event.target.matches('[data-retries]')){
                    const value=Math.max(1,Math.min(5,Number(event.target.value)||1));
                    engine.config.retryAttempts=value;event.target.value=value;engine.saveConfig();
                    engine.status='每个模型最大尝试次数已设为 '+value+' 次';
                    engine.panel.querySelector('footer span').textContent=engine.status;
                }else if(event.target.matches('[data-world-temperature]')){
                    const value=Math.max(0,Math.min(2,Number(event.target.value)||0));
                    engine.config.temperature=value;event.target.value=String(value);engine.saveConfig();
                    engine.status='世界推演温度已设为 '+value;engine.panel.querySelector('footer span').textContent=engine.status;
                }else if(event.target.matches('[data-fallback-model]')){
                    engine.config.fallbackModel=String(event.target.value||'').trim().slice(0,160);engine.saveConfig();
                    engine.status=engine.config.fallbackModel?'Fallback 模型已保存：'+engine.config.fallbackModel:'Fallback 模型已关闭';
                    engine.panel.querySelector('footer span').textContent=engine.status;
                }else if(event.target.matches('[data-doc-import]')){
                    const input=event.target,file=input.files&&input.files[0];if(!file)return;
                    Promise.resolve(file.text()).then(raw=>{
                        const doc=engine.importPromptDocument(raw);
                        engine.status='已导入预设文档：'+doc.name;engine.render(true);
                    }).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}).finally(()=>{input.value='';});
                }
                else if(event.target.matches('[data-dedicated-field]')){
                    const field=event.target.dataset.dedicatedField,value=event.target.value||'';
                    if(['apiUrl','apiKey','model'].includes(field)){
                        engine.setDedicatedApi({[field]:value});
                        engine.status='专属 API 配置已保存';engine.panel.querySelector('footer span').textContent=engine.status;
                    }
                }
                else if(event.target.matches('[data-dedicated-preset]')){
                    const name=event.target.value||'';
                    if(name){
                        try{engine.applyDedicatedApiPreset(name);engine.status='已应用 API 预设：'+name;engine.render(true);}
                        catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                    }
                }
            });
            isolated.appendChild(engine.panel);
            doc.body.appendChild(engine.mount);
                }
    }
    class WorldPanelRenderer {
        constructor(engine){this.engine=engine;}
        statusTone(){
            const engine=this.engine;
            try{
                const tone=engine.host.localStorage.getItem(STATUS_THEME_CONFIG);
                if(WORLD_TONE_KEYS.has(tone))return tone;
            }catch(_){}
            return 'night';
        }
        syncStatusTone(){
            const tone=this.statusTone(),engine=this.engine;
            if(engine.panel)engine.panel.dataset.tone=tone;
            return tone;
        }
        render(force=false) {
            const engine=this.engine;

            if(!engine.isOpen())return;
            let snapshot,state=emptyState(),reason='';
            try{
                snapshot=engine.snapshot();
                snapshot.stat.世界[PATH]=Object.assign(emptyState(),snapshot.stat.世界[PATH]||{});
                normalizeBackendState(snapshot.stat);normalizeEventLayers(snapshot.stat);repairCausalProjection(snapshot.stat);
                state=Object.assign(state,snapshot.stat.世界[PATH]||{});
                reason=engine.blocked(snapshot);
            }catch(e){reason=e.message;}
            const s=snapshot?snapshot.stat:{},w=s.世界||{},orbit=w.因果轨道||{};
            this.syncStatusTone();
            engine.panel.dataset.fontScale=engine.config.fontScale||'standard';
            if(engine.tab==='总览')engine.tab='世界推进';
            const main=engine.panel.querySelector('main'),scroll=main.scrollTop;
            const opened=new Set(Array.from(main.querySelectorAll('details[open]')).map(d=>d.dataset.detail));
            engine.panel.querySelector('footer span').textContent=engine.status;
            const availabilityReason=engine.isConfigured()&&!engine.isAvailable()
                ?(engine.usesDedicatedApi()?'专属 API 未准备好：请在「设置」中填写 API 地址并选择模型':'主神终端额外模型未准备好：请在主神终端设置中配置 API 地址并选择模型')
                :'';
            const runButton=engine.panel.querySelector('[data-action=run]');
            const stopping=engine.busy&&!!engine.controller?.signal.aborted;
            // 空闲时不要把运行器的业务阻塞条件复制成 disabled。
            // 手动入口需要可点击，真正不能推进时由 RunOrchestrator 给出明确状态/错误。
            runButton.disabled=engine.busy?(engine.committing||stopping):false;
            runButton.textContent=engine.busy?(engine.committing?'保存中…':stopping?'停止中…':'停止推进'):'推进世界';
            const runHint=!engine.busy?(availabilityReason||reason||'手动推进世界；可填写本轮一次性指导'):'';
            runButton.title=runHint;
            runButton.setAttribute('aria-label',runButton.textContent+(runHint?' · '+runHint:''));

            const tabs=[['世界推进','◈'],['角色管理','♙'],['探索与势力','⌖'],['世界事件','▤'],['资产','▣'],['传闻','◎'],['提示词预设','✎'],['请求检查','⌕'],['运行记录','≋','历史记忆'],['设置','⚙']];
            engine.panel.querySelector('nav').innerHTML='<div class="we-navtitle">世界档案</div>'+tabs.map(([t,i,label])=>'<button data-tab="'+t+'" aria-selected="'+(engine.tab===t)+'"><span class="we-tab-icon" aria-hidden="true">'+i+'</span>'+(label||t)+'</button>').join('');
            if(engine.tab==='提示词预设'&&main.querySelector('textarea')&&!force)return;
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
            if(engine.calendarContext!==contextKey){engine.calendarContext=contextKey;engine.selectedDate=undefined;engine.calendarMode="today";engine.monthOffset=0;}
            if(engine.selectedDate===undefined||engine.calendarMode==="today")engine.selectedDate=parseDate(w.时间)?.key||"";
            if(engine.calendarMode==='date'){
                const anchor=parseDate(w.时间),selected=parseDate(engine.selectedDate);
                const monthsPerYear=Array.isArray(w.历法?.月份天数)&&w.历法.月份天数.length?w.历法.月份天数.length:12;
                if(anchor&&selected)engine.monthOffset=(selected.y-anchor.y)*monthsPerYear+selected.m-anchor.m;
            }
            const dateLabel=str=>{const d=parseDate(str);return d?d.m+'月'+d.d+'日':str||'时间待补';};
            // 稳定阶段与防御强度取自 ⚙️世界因果与法则协议；这里只展示当前阶段。
            const stabilityStages=[
                {min:111,max:120,title:'黄金祝福 | 稳定强化',effects:['世界基本消化外来干涉，原生因果处于高强度收束状态','轮回者没有主动围剿压力，但外来力量仍受完整原生法则约束']},
                {min:101,max:110,title:'世界青睐 | 稳定强化',effects:['因果结构优于原始基准，秩序与资源循环趋于健康','世界对轮回者的主动排异很低']},
                {min:100,max:100,title:'原著时间线 | 稳定',effects:['世界按既定轨迹运行，不主动针对轮回者，也不提供额外庇护']},
                {min:90,max:99,title:'因果警觉 | 稳定',effects:['世界开始识别异常源','目击、调查、误会与敌意沿合理因果链向轮回者汇聚']},
                {min:80,max:89,title:'定向排异 | 稳定',effects:['藏身处、计划、联系人与资源链持续受压','压力优先集中到轮回者本人及其直接关系网']},
                {min:70,max:79,title:'因果追猎 | 松动',effects:['原生强者、组织与主线冲突逐步被因果收束引向轮回者','据点、盟友、补给与撤退路线开始被系统性破坏']},
                {min:60,max:69,title:'全面围剿 | 松动',effects:['多个原生势力可从各自合理动机同时追捕、封锁或攻击轮回者','普通安全生活基本结束，逃离一处不代表摆脱追猎']},
                {min:50,max:59,title:'世界武器化 | 松动',effects:['战争、灾害、怪物潮与原生顶级强者可被因果链引向轮回者活动区','世界开始接受区域毁灭与大规模误伤作为清除代价']},
                {min:40,max:49,title:'猎杀现实 | 崩坏',effects:['环境、空间、时间与残存原生规则都可成为猎杀轮回者的载体','世界接受永久区域毁灭，只求把入侵源一并埋葬']},
                {min:30,max:39,title:'献祭式清除 | 崩坏',effects:['世界进入免疫风暴，围剿不再优先保护自身秩序','可牺牲主线人物、城市、国家乃至文明结构换取清除轮回者']},
                {min:10,max:29,title:'终焉围猎 | 混乱',effects:['毁灭性事件持续向轮回者及其停留区域收束','长期停留会把灾难引向当前位置，必须修复因果或持续撤离']},
                {min:1,max:9,title:'同归于尽 | 混乱',effects:['世界放弃自保，主动牺牲法则、时间线与现实结构清除轮回者','只剩修复异常根源或在世界死亡前撤离']},
                {min:0,max:0,title:'世界毁灭',effects:['因果链、世界法则、时间线与现实结构全部终止','所有未撤离实体的生命、意识与灵魂一并被彻底抹除']}
            ];
            const stabilityDescription=stable=>{
                if(s.设置?.世界超稳===true)return '<p class="we-muted">世界超稳 · 稳定值固定100<br>禁止新增因果偏移与主动排异升级</p>';
                if(stable===null)return '<p class="we-muted">世界稳定值未记录</p>';
                const normalized=Math.max(0,Math.min(120,Number(stable)));
                const stage=stabilityStages.find(item=>normalized>=item.min&&normalized<=item.max);
                return stage?'<div class="we-stability-description"><p><b>'+text(stage.title)+'</b></p><ul>'+stage.effects.map(effect=>'<li>'+text(effect)+'</li>').join('')+'</ul></div>':'<p class="we-muted">稳定值超出协议范围</p>';
            };
            const events=sortWorldEvents(state.事件,orbit);
            const active=events.filter(([,e])=>e.状态==='进行中'),future=events.filter(([,e])=>e.状态==='待发生');
            const relationRoster=s.关系列表||{};
            const relationNamesByKey=new Map(entries(relationRoster).map(([name])=>[nameKey(name),name]));
            const peopleAll=new Map(entries(state.人物));entries(relationRoster).forEach(([n,p])=>{if(!peopleAll.has(n))peopleAll.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const userName=String(engine.host.SillyTavern?.name1||engine.env.SillyTavern?.name1||engine.host.SillyTavern?.getContext?.()?.name1||engine.host.name1||'').trim();
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
            const eventTasks=(eventName,event)=>{
                const names=Array.from(new Set((Array.isArray(event.关联任务)?event.关联任务:[]).filter(name=>typeof name==='string'&&name.trim())));
                if(!names.length)return '';
                const roster=s.任务?.列表||{};
                return '<div class="we-event-tasks"><div class="we-meta"><b>关联任务</b><span>'+names.length+' 项</span></div>'+names.map(name=>{
                    const task=Object.hasOwn(roster,name)&&plain(roster[name])?roster[name]:null;
                    const id='event-task-'+JSON.stringify([eventName,name]);
                    return '<details class="we-event-task" data-detail="'+text(id)+'"'+(opened.has(id)?' open':'')+'><summary><span class="we-task-name">'+text(name)+'</span>'+pill(task?.状态|| (task?'状态未记录':'任务记录缺失'),'dim')+'</summary>'
                        +(task?'<p>'+text(task.目标||'目标尚未记录')+'</p>'+fields({委托方:task.委托方,难度:task.难度,交付:task.交付}):'<p class="we-muted">当前任务列表中未找到该任务，保留事件中的关联名称。</p>')+'</details>';
                }).join('')+'</div>';
            };
            const eventCard=(name,e)=>'<article class="we-card" data-event-card="'+text(name)+'"><div class="we-card-top"><h3>'+text(name)+'</h3><div class="we-card-tags">'+pill(e.分类||'近期节点',e.分类==='宏观节点'?'future':'dim')+pill(e.状态,e.状态==='待发生'?'future':e.状态==='进行中'?'':'dim')+'</div></div><div class="we-meta"><span>◷ '+text(eventScheduleLabel(e))+'</span><span>⌖ '+text(e.地点||'地点未明')+'</span></div><p>'+text(e.公开征兆||e.描述||'等待明确事件内容')+'</p>'+eventTasks(name,e)+details('event-'+name,{事件描述:e.描述,分类:e.分类,前因:e.前因,触发条件:e.条件,参与者:e.参与者,预计结束:e.预计结束,下次检查:e.下次检查,可见影响:e.可见影响,默认走向:e.默认走向,已确认结果:e.结果,更新时间:e.更新时间},'因果关联与事件详情')+'</article>';
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
            const matched=(name,obj)=>!engine.query||(name+' '+Object.values(obj).filter(v=>typeof v==='string').join(' ')).toLowerCase().includes(engine.query.toLowerCase());
            const calendarCandidates=events.filter(([n,e])=>matched(n,e)&&((engine.filter||'全部')==='全部'||e.状态===engine.filter));
            const tools=(filters=[])=>'<div class="we-tools"><input data-search aria-label="搜索档案" placeholder="搜索名称、地点或内容…" value="'+text(engine.query||'')+'">'+filters.map(f=>'<button data-filter="'+f+'" class="'+((engine.filter||'全部')===f?'active':'')+'">'+f+'</button>').join('')+'</div>';
            const calendar=()=>{
                const today=parseDate(w.时间);
                if(!today){const semantic=events.filter(([,e])=>!parseDate(e.时间||e.开始时间)&&String(e.时间||e.开始时间||'').trim()).slice(0,12);return '<div class="we-calendar"><h3>作品内时间轴</h3><p class="we-muted">当前锚点 · '+text(w.时间||'尚无副本时间')+'</p>'+(semantic.length?'<div class="we-timeline">'+semantic.map(([n,e])=>'<p><b>'+text(e.时间||e.开始时间)+'</b><br>'+text(n)+'</p>').join('')+'</div>':'<p class="we-muted">暂无带作品内时间标记的事件</p>')+'</div>';}
                const customMonths=Array.isArray(w.历法?.月份天数)?w.历法.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                let y=today.y,m=today.m+(engine.monthOffset||0),first=0,count=0;
                if(customMonths.length){
                    while(m<1){m+=customMonths.length;y--;}
                    while(m>customMonths.length){m-=customMonths.length;y++;}
                    count=customMonths[m-1];
                }else{
                    const month=new Date(0);month.setFullYear(today.y,today.m-1+(engine.monthOffset||0),1);month.setHours(0,0,0,0);
                    y=month.getFullYear();m=month.getMonth()+1;first=(month.getDay()+6)%7;
                    const last=new Date(month);last.setMonth(last.getMonth()+1,0);count=last.getDate();
                }
                const marked=new Map();
                calendarCandidates.forEach(([,e])=>{const key=parseDate(e.时间||e.开始时间)?.key;if(key)marked.set(key,(marked.get(key)||0)+1);});
                let cells=['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'<span></span>'.repeat(first);
                for(let d=1;d<=count;d++){const key=y+'-'+m+'-'+d;cells+='<button data-action="date" data-date="'+key+'" aria-label="'+key+'" aria-pressed="'+(engine.selectedDate===key)+'" title="'+key+' · '+(marked.get(key)||0)+' 个匹配事件" class="'+(today.key===key?'today ':'')+(marked.has(key)?'has-event ':'')+(engine.selectedDate===key?'selected':'')+'">'+d+'</button>';}
                return '<div class="we-calendar"><div class="we-calhead"><button class="we-btn" data-action="month" data-step="-1" aria-label="上月">‹</button><strong>'+y+' 年 '+m+' 月</strong><button class="we-btn" data-action="month" data-step="1" aria-label="下月">›</button></div><div class="we-days">'+cells+'</div><div class="we-meta"><span>'+text(customMonths.length?(w.历法?.名称||'作品历法')+' · 本月 '+count+' 天':'公历显示 · 本月 '+count+' 天')+'</span><span>金框 · 当前日期</span><span>绿点 · 已排定事件</span></div></div>';
            };
            const radar=w.异端雷达||{};
            const alienAlive=entries(radar.名单).filter(([,a])=>a&&a.状态!=='死亡').length;
            const showRadar=!(s.设置||{}).单一世界&&!(s.系统状态||{}).是否在主神空间;
            const prose=v=>'<div class="we-reading we-world-laws">'+(Array.isArray(v)?v:[v]).map(paragraph=>'<article><p>'+text(paragraph)+'</p></article>').join('')+'</div>';
            const hero='<div class="we-hero"><div><div class="we-eyebrow">SAMSARA / WORLD ARCHIVE</div><h1>'+text(w.名称&&w.名称!=='待初始化'?w.名称:'世界尚未建立')+'</h1><div class="we-world-ranks"><span>位格 <b>'+text(w.位格||'未记录')+'</b></span><span>难度 <b>'+text(w.难度||'未记录')+'</b></span></div><div class="we-muted">'+text(w.地点||'地点待确认')+' · '+text(orbit.当前阶段&&orbit.当前阶段!=='待初始化'?orbit.当前阶段:'等待篇章开启')+'</div></div><div class="we-date">'+text(w.时间||'副本日期待确认')+'<small>累计游玩 '+text((s.系统状态||{}).游玩天数||0)+' 天 · '+(reason?'推进暂停':'副本进行中')+'</small></div></div>';
            let html=hero+(reason?'<div class="we-notice">'+text(reason)+'</div>':'')+(availabilityReason?'<div class="we-notice">'+text(availabilityReason)+'</div>':'');
            if(engine.tab==='世界推进'){
                html+=engine.services.views.render('world',{
                    s,w,orbit,events,active,future,people,calendarCandidates,snapshot,
                    entries,text,empty,section,stabilityDescription,parseDate,calendar,tools,
                    timelineCards,exists,fields,prose,compactPerson
                });
            }else if(engine.tab==='角色管理'){
                html+=engine.services.views.render('people',{
                    s,radar,showRadar,alienAlive,entries,formalPeople,backstagePeople,
                    relationRoster,matched,userName,section,text,pill,fields,contextRows,
                    sceneContextBody,empty,tools,person,exists,value
                });
            }else if(engine.tab==='探索与势力'){
                html+=engine.services.views.render('exploration',{
                    state,w,events,entries,text,fields,areaSceneBody,exists,details,
                    empty,section,eventCard
                });
            }else if(engine.tab==='资产'){
                html+=engine.services.views.render('assets',{
                    s,w,people,userName,relationNamesByKey,entries,matched,tools,section,text,pill,fields,details,empty
                });
            }else if(engine.tab==='世界事件'){
                html+=engine.services.views.render('events',{
                    events,matched,tools,section,timelineCards,empty
                });
            }else if(engine.tab==='传闻'){
                html+=engine.services.views.render('rumors',{
                    s,state,tools,section,entries,matched,text,fields,details,empty,pill
                });
            }else if(engine.tab==='运行记录'){
                html+=engine.services.views.render('history',{
                    state,radar,showRadar,exists,section,text,entries,fields,empty,pill
                });
            }else if(engine.tab==='设置'){
                html+=engine.services.views.render('settings',{section,text});
            }else if(engine.tab==='提示词预设'){
                html+=engine.services.views.render('prompts',{text,section,empty});
            }else if(engine.tab==='请求检查'){
                html+=engine.services.views.render('requestInspector',{text,section,empty,fields,pill});
            }
            main.innerHTML=html;main.scrollTop=force?0:scroll;
            if(engine.jumpEvent){
                const jumpName=engine.jumpEvent;
                const target=Array.from(main.querySelectorAll('[data-event-card]')).find(el=>el.dataset.eventCard===jumpName);
                if(target){
                    target.classList.add('is-jump');
                    target.scrollIntoView({behavior:'smooth',block:'center'});
                    setTimeout(()=>target.classList.remove('is-jump'),1200);
                }
                engine.jumpEvent='';
            }
                }
    }
    class WorldEditorController {
        constructor(engine){
            this.engine=engine;
            this.editMode=false;
            this.boundPanel=null;
        }
        modeEnabled(){return this.editMode===true;}
        setMode(value){this.editMode=value===true;this.engine.render(true);return this.editMode;}
        toggleMode(){return this.setMode(!this.modeEnabled());}
        section(title){
            const panel=this.engine.panel;if(!panel)return null;
            return Array.from(panel.querySelectorAll('.we-section')).find(section=>String(section.querySelector('.we-section-head h2')?.textContent||'').trim()===String(title||''))||null;
        }
        reportError(error,title='世界推进编辑'){
            const message=String(error?.message||error||'世界推进资料编辑失败');
            const toast=this.engine.host?.toastr||this.engine.env?.toastr;
            if(toast?.error)toast.error(message,title);else try{console.error('['+title+']',error);}catch(_){}
        }
        escape(value){
            return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        }
        textList(value){
            if(Array.isArray(value))return [...new Set(value.map(item=>String(item||'').trim()).filter(Boolean))];
            return [...new Set(String(value||'').split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
        }
        jsonList(value,label='列表'){
            if(Array.isArray(value))return copy(value);
            const raw=String(value||'').trim();
            if(!raw)return [];
            let parsed;
            try{parsed=JSON.parse(raw);}catch(_){throw new Error(label+'必须是合法 JSON 数组');}
            if(!Array.isArray(parsed))throw new Error(label+'必须是 JSON 数组');
            return parsed;
        }
        eventSelect(value,options,field){
            return '<select data-world-event-field="'+field+'">'+options.map(option=>'<option value="'+this.escape(option)+'"'+(String(value)===option?' selected':'')+'>'+this.escape(option)+'</option>').join('')+'</select>';
        }

        // ---- 共用编辑模式 ----
        mountModeToggle(){
            const engine=this.engine;
            if(!engine.panel||!['世界推进','角色管理','探索与势力'].includes(engine.tab))return;
            let title='';
            if(engine.tab==='世界推进')title='事件时间线';
            else if(engine.tab==='角色管理')title='人物名册';
            else{
                const dir=engine.directoryTab||'探索';
                if(dir==='热点')return;
                title=dir==='势力'?'势力结算名录':'探索结算名录';
            }
            const section=this.section(title),head=section?.querySelector('.we-section-head');
            if(!head||head.querySelector('[data-action="world-edit-mode"]'))return;
            const button=engine.host.document.createElement('button');
            button.type='button';button.className='we-btn we-world-edit-toggle';button.dataset.action='world-edit-mode';
            button.textContent=this.modeEnabled()?'退出编辑':'编辑模式';
            button.setAttribute('aria-pressed',String(this.modeEnabled()));
            head.appendChild(button);
        }

        // ---- 事件 ----
        eventInlineHtml(name,record){
            const esc=value=>this.escape(value),list=value=>Array.isArray(value)?value.join('\n'):'',json=value=>JSON.stringify(Array.isArray(value)?value:[],null,2);
            return '<div class="we-world-editor" data-world-event-edit data-world-event-name="'+esc(name)+'"><div class="we-world-editor-grid">'
                +'<label><span>事件名称</span><input data-world-event-field="name" value="'+esc(name)+'"></label>'
                +'<label><span>分类</span>'+this.eventSelect(record?.分类||'近期节点',['当前事件','近期节点','宏观节点'],'category')+'</label>'
                +'<label><span>状态</span>'+this.eventSelect(record?.状态||'待发生',['待发生','进行中','已完成','已取消'],'status')+'</label>'
                +'<label><span>地点</span><input data-world-event-field="location" value="'+esc(record?.地点||'')+'"></label>'
                +'<label><span>时间</span><input data-world-event-field="time" value="'+esc(record?.时间||'')+'"></label>'
                +'<label><span>开始时间</span><input data-world-event-field="start" value="'+esc(record?.开始时间||'')+'"></label>'
                +'<label><span>预计结束</span><input data-world-event-field="end" value="'+esc(record?.预计结束||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-event-field="nextCheck" value="'+esc(record?.下次检查||'')+'"></label>'
                +'<label><span>更新时间</span><input data-world-event-field="updated" value="'+esc(record?.更新时间||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>事件描述</span><textarea data-world-event-field="description">'+esc(record?.描述||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开征兆</span><textarea data-world-event-field="sign">'+esc(record?.公开征兆||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>触发条件</span><textarea data-world-event-field="condition">'+esc(record?.条件||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>默认走向</span><textarea data-world-event-field="default">'+esc(record?.默认走向||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>已确认结果</span><textarea data-world-event-field="result">'+esc(record?.结果||'')+'</textarea></label>'
                +'<label><span>前因（每行一个）</span><textarea data-world-event-field="causes">'+esc(list(record?.前因))+'</textarea></label>'
                +'<label><span>参与者（每行一个）</span><textarea data-world-event-field="participants">'+esc(list(record?.参与者))+'</textarea></label>'
                +'<label><span>关联任务（每行一个）</span><textarea data-world-event-field="tasks">'+esc(list(record?.关联任务))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>可见影响（JSON 数组）</span><textarea data-world-event-field="impacts">'+esc(json(record?.可见影响))+'</textarea></label>'
                +'</div><div class="we-world-editor-actions"><button type="button" class="we-world-editor-save" data-action="world-event-save" data-event-name="'+esc(name)+'">保存修正</button><button type="button" data-action="world-event-cancel">取消</button></div></div>';
        }
        beginEvent(name,card){
            const record=this.engine.services.events.get(name);if(!record||!card)return false;
            card.innerHTML=this.eventInlineHtml(name,record);card.classList.add('we-world-editing');
            try{card.querySelector('[data-world-event-field="name"]')?.focus?.();}catch(_){}
            return true;
        }
        saveEvent(card,oldName){
            if(!card)return false;
            const value=key=>card.querySelector('[data-world-event-field="'+key+'"]')?.value,current=this.engine.services.events.get(oldName)||{};
            return this.engine.services.events.save(oldName,String(value('name')||'').trim(),{
                ...copy(current),分类:String(value('category')||'').trim(),状态:String(value('status')||'').trim(),
                地点:String(value('location')||'').trim(),时间:String(value('time')||'').trim(),开始时间:String(value('start')||'').trim(),
                预计结束:String(value('end')||'').trim(),下次检查:String(value('nextCheck')||'').trim(),更新时间:String(value('updated')||'').trim(),
                描述:String(value('description')||'').trim(),公开征兆:String(value('sign')||'').trim(),条件:String(value('condition')||'').trim(),
                默认走向:String(value('default')||'').trim(),结果:String(value('result')||'').trim(),
                前因:this.textList(value('causes')),参与者:this.textList(value('participants')),
                关联任务:this.textList(value('tasks')),可见影响:this.jsonList(value('impacts'),'可见影响')
            });
        }
        mountEventControls(){
            const engine=this.engine;
            if(!engine.panel||engine.tab!=='世界推进'||!this.modeEnabled())return;
            for(const card of engine.panel.querySelectorAll('[data-event-card]')){
                if(card.querySelector('.we-world-event-actions')||card.matches('.we-world-editing'))continue;
                const name=String(card.dataset.eventCard||'');if(!name)continue;
                const actions=engine.host.document.createElement('div');actions.className='we-world-event-actions';
                actions.innerHTML='<button type="button" data-action="world-event-edit" data-event-name="'+this.escape(name)+'">编辑</button><button type="button" data-action="world-event-delete" data-event-name="'+this.escape(name)+'">删除</button>';
                card.appendChild(actions);
            }
        }
        armEventDelete(button,name){
            const actions=button?.closest?.('.we-world-event-actions');if(!actions)return false;
            button.dataset.action='world-event-delete-confirm';button.textContent='确认删除';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-event-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-event-delete-cancel';cancel.dataset.eventName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelEventDelete(button){
            const actions=button?.closest?.('.we-world-event-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-event-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-event-delete';confirm.textContent='删除';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-event-delete-cancel"]')?.remove();return true;
        }

        // ---- 世界人物活动 ----
        personInlineHtml(name,record){
            const esc=value=>this.escape(value),list=value=>Array.isArray(value)?value.join('\n'):'',json=value=>JSON.stringify(Array.isArray(value)?value:[],null,2);
            return '<div class="we-world-editor we-world-person-editor" data-world-person-edit data-world-person-name="'+esc(name)+'">'
                +'<div class="we-world-editor-note"><b>'+esc(name)+'</b><span>只编辑世界活动记录；人物正式资料由状态栏维护。</span></div><div class="we-world-editor-grid">'
                +'<label><span>所属世界</span><input data-world-person-field="world" value="'+esc(record?.所属世界||'')+'"></label>'
                +'<label><span>状态</span><input data-world-person-field="status" value="'+esc(record?.状态||'')+'"></label>'
                +'<label><span>地点</span><input data-world-person-field="location" value="'+esc(record?.地点||'')+'"></label>'
                +'<label><span>目标</span><input data-world-person-field="goal" value="'+esc(record?.目标||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>当前行动</span><textarea data-world-person-field="action">'+esc(record?.行动||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开动态</span><textarea data-world-person-field="public">'+esc(record?.公开动态||'')+'</textarea></label>'
                +'<label><span>开始时间</span><input data-world-person-field="start" value="'+esc(record?.开始时间||'')+'"></label>'
                +'<label><span>预计结束</span><input data-world-person-field="end" value="'+esc(record?.预计结束||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-person-field="nextCheck" value="'+esc(record?.下次检查||'')+'"></label>'
                +'<label><span>更新时间</span><input data-world-person-field="updated" value="'+esc(record?.更新时间||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>登场条件</span><textarea data-world-person-field="appearance">'+esc(record?.登场条件||'')+'</textarea></label>'
                +'<label><span>认知（每行一条）</span><textarea data-world-person-field="knowledge">'+esc(list(record?.认知))+'</textarea></label>'
                +'<label><span>关联事件（每行一个）</span><textarea data-world-person-field="events">'+esc(list(record?.关联事件))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>行程（JSON 数组）</span><textarea data-world-person-field="schedule">'+esc(json(record?.行程))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>认知来源（JSON 数组）</span><textarea data-world-person-field="knowledgeSources">'+esc(json(record?.认知来源))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>背景关联（JSON 数组）</span><textarea data-world-person-field="links">'+esc(json(record?.背景关联))+'</textarea></label>'
                +'</div><div class="we-world-editor-actions"><button type="button" class="we-world-editor-save" data-action="world-person-save" data-person-name="'+esc(name)+'">保存修正</button><button type="button" data-action="world-person-cancel">取消</button></div></div>';
        }
        selectedPersonName(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='角色管理')return '';
            return String(engine.panel.querySelector('.we-roster-person.active')?.dataset?.person||engine.selectedPerson||'').trim();
        }
        beginPerson(name,section){
            const found=this.engine.services.people.get(name);if(!found||!section)return false;
            const head=section.querySelector('.we-section-head');
            Array.from(section.children).forEach(child=>{if(child!==head)child.hidden=true;});
            const holder=this.engine.host.document.createElement('div');holder.innerHTML=this.personInlineHtml(found.name,found.record);
            const node=holder.firstElementChild;section.appendChild(node);
            try{node?.querySelector('[data-world-person-field="location"]')?.focus?.();}catch(_){}
            return true;
        }
        savePerson(section,name){
            const editor=section?.querySelector('[data-world-person-edit]');if(!editor)return false;
            const value=key=>editor.querySelector('[data-world-person-field="'+key+'"]')?.value,found=this.engine.services.people.get(name);if(!found)return false;
            return this.engine.services.people.save(found.name,{
                ...copy(found.record),所属世界:String(value('world')||'').trim(),状态:String(value('status')||'').trim(),
                地点:String(value('location')||'').trim(),目标:String(value('goal')||'').trim(),行动:String(value('action')||'').trim(),
                公开动态:String(value('public')||'').trim(),开始时间:String(value('start')||'').trim(),预计结束:String(value('end')||'').trim(),
                下次检查:String(value('nextCheck')||'').trim(),更新时间:String(value('updated')||'').trim(),登场条件:String(value('appearance')||'').trim(),
                认知:this.textList(value('knowledge')),关联事件:this.textList(value('events')),行程:this.jsonList(value('schedule'),'行程'),
                认知来源:this.jsonList(value('knowledgeSources'),'认知来源'),背景关联:this.jsonList(value('links'),'背景关联')
            });
        }
        mountPersonControls(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='角色管理'||!this.modeEnabled())return;
            const found=this.engine.services.people.get(this.selectedPersonName());if(!found)return;
            const section=this.section('身份与当前行动'),head=section?.querySelector('.we-section-head');
            if(!section||!head||head.querySelector('.we-world-person-actions'))return;
            const actions=engine.host.document.createElement('span');actions.className='we-world-person-actions';
            actions.innerHTML='<button type="button" data-action="world-person-edit" data-person-name="'+this.escape(found.name)+'">编辑世界活动</button><button type="button" data-action="world-person-delete" data-person-name="'+this.escape(found.name)+'">删除世界活动记录</button>';
            head.appendChild(actions);
        }
        armPersonDelete(button,name){
            const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;
            button.dataset.action='world-person-delete-confirm';button.textContent='确认仅删除世界活动';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-person-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-person-delete-cancel';cancel.dataset.personName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelPersonDelete(button){
            const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-person-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-person-delete';confirm.textContent='删除世界活动记录';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-person-delete-cancel"]')?.remove();return true;
        }

        // ---- 探索与势力 ----
        directoryInlineHtml(kind,name,found){
            const esc=value=>this.escape(value),ledger=found?.ledger||{},backend=found?.backend||{};
            const rank=(value,field)=>'<select data-world-directory-field="'+field+'">'+QUALITY_RANKS.map(option=>'<option value="'+option+'"'+(String(value||'F').toUpperCase()===option?' selected':'')+'>'+option+'</option>').join('')+'</select>';
            const lines=value=>Array.isArray(value)?value.join('\n'):String(value||'');
            if(kind==='faction'){
                return '<div class="we-world-editor" data-world-directory-edit data-directory-kind="faction" data-directory-name="'+esc(name)+'"><div class="we-world-editor-grid">'
                    +'<label><span>势力名称</span><input data-world-directory-field="name" value="'+esc(name)+'"></label>'
                    +'<label><span>实力</span>'+rank(ledger.实力,'rank')+'</label>'
                    +'<label><span>声望</span><input type="number" min="-5000" max="10000" data-world-directory-field="reputation" value="'+esc(Number(ledger.声望)||0)+'"></label>'
                    +'<label><span>领地</span><input data-world-directory-field="territory" value="'+esc(ledger.领地||'')+'"></label>'
                    +'<label class="we-world-editor-wide"><span>势力描述</span><textarea data-world-directory-field="description">'+esc(ledger.描述||backend.描述||'')+'</textarea></label>'
                    +'<label><span>当前目标</span><input data-world-directory-field="goal" value="'+esc(backend.目标||'')+'"></label>'
                    +'<label><span>下次检查</span><input data-world-directory-field="nextCheck" value="'+esc(backend.下次检查||'')+'"></label>'
                    +'<label class="we-world-editor-wide"><span>世界进展</span><textarea data-world-directory-field="progress">'+esc(backend.进展||'')+'</textarea></label>'
                    +'<label class="we-world-editor-wide"><span>公开动态</span><textarea data-world-directory-field="public">'+esc(backend.公开动态||'')+'</textarea></label>'
                    +'</div><div class="we-world-editor-actions"><button type="button" class="we-world-editor-save" data-action="world-directory-save" data-directory-kind="faction" data-directory-name="'+esc(name)+'">保存修正</button><button type="button" data-action="world-directory-cancel">取消</button></div></div>';
            }
            return '<div class="we-world-editor" data-world-directory-edit data-directory-kind="exploration" data-directory-name="'+esc(name)+'"><div class="we-world-editor-grid">'
                +'<label><span>探索地标名称</span><input data-world-directory-field="name" value="'+esc(name)+'"></label>'
                +'<label><span>风险</span>'+rank(ledger.风险,'risk')+'</label>'
                +'<label><span>探索度</span><input type="number" min="0" max="100" data-world-directory-field="exploration" value="'+esc(Number(ledger.探索度)||0)+'"></label>'
                +'<label><span>控制方</span><input data-world-directory-field="control" value="'+esc(backend.控制方||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>探索描述</span><textarea data-world-directory-field="description">'+esc(ledger.描述||backend.描述||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>隐藏真相</span><textarea data-world-directory-field="truth">'+esc(ledger.隐藏真相||'')+'</textarea></label>'
                +'<label><span>争夺方（每行一个）</span><textarea data-world-directory-field="contenders">'+esc(lines(backend.争夺方))+'</textarea></label>'
                +'<label><span>环境状态（每行一个）</span><textarea data-world-directory-field="environment">'+esc(lines(backend.环境状态))+'</textarea></label>'
                +'<label><span>当前目标</span><input data-world-directory-field="goal" value="'+esc(backend.目标||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-directory-field="nextCheck" value="'+esc(backend.下次检查||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>世界进展</span><textarea data-world-directory-field="progress">'+esc(backend.进展||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开动态</span><textarea data-world-directory-field="public">'+esc(backend.公开动态||'')+'</textarea></label>'
                +'</div><div class="we-world-editor-actions"><button type="button" class="we-world-editor-save" data-action="world-directory-save" data-directory-kind="exploration" data-directory-name="'+esc(name)+'">保存修正</button><button type="button" data-action="world-directory-cancel">取消</button></div></div>';
        }
        selectedDirectoryName(kind){
            const panel=this.engine.panel;if(!panel||this.engine.tab!=='探索与势力')return '';
            if(kind==='faction')return String(panel.querySelector('.we-faction-card.active')?.dataset?.faction||this.engine.selectedFaction||'').trim();
            return String(panel.querySelector('.we-explore-card.active')?.dataset?.area||this.engine.selectedArea||'').trim();
        }
        directorySection(kind){return this.section(kind==='faction'?'势力档案':'区域档案');}
        beginDirectory(kind,name,section){
            const found=this.engine.services.exploration.record(kind,name);if(!found||!section)return false;
            const head=section.querySelector('.we-section-head');
            Array.from(section.children).forEach(child=>{if(child!==head)child.hidden=true;});
            const holder=this.engine.host.document.createElement('div');holder.innerHTML=this.directoryInlineHtml(kind,found.name,found);
            const node=holder.firstElementChild;section.appendChild(node);
            try{node?.querySelector('[data-world-directory-field="name"]')?.focus?.();}catch(_){}
            return true;
        }
        saveDirectory(section,kind,oldName){
            const editor=section?.querySelector('[data-world-directory-edit]');if(!editor)return false;
            const value=key=>editor.querySelector('[data-world-directory-field="'+key+'"]')?.value;
            const nextName=String(value('name')||'').trim();
            if(kind==='faction'){
                return this.engine.services.exploration.saveRecord(kind,oldName,nextName,{
                    ledger:{实力:value('rank'),声望:Number(value('reputation')),领地:String(value('territory')||'').trim(),描述:String(value('description')||'').trim()},
                    backend:{描述:String(value('description')||'').trim(),目标:String(value('goal')||'').trim(),下次检查:String(value('nextCheck')||'').trim(),进展:String(value('progress')||'').trim(),公开动态:String(value('public')||'').trim()}
                });
            }
            return this.engine.services.exploration.saveRecord(kind,oldName,nextName,{
                ledger:{风险:value('risk'),探索度:Number(value('exploration')),描述:String(value('description')||'').trim(),隐藏真相:String(value('truth')||'').trim()},
                backend:{描述:String(value('description')||'').trim(),控制方:String(value('control')||'').trim(),争夺方:this.textList(value('contenders')),环境状态:this.textList(value('environment')),目标:String(value('goal')||'').trim(),下次检查:String(value('nextCheck')||'').trim(),进展:String(value('progress')||'').trim(),公开动态:String(value('public')||'').trim()}
            });
        }
        mountDirectoryControls(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='探索与势力'||!this.modeEnabled())return;
            const dir=engine.directoryTab||'探索';if(dir==='热点')return;
            const kind=dir==='势力'?'faction':'exploration',name=this.selectedDirectoryName(kind),found=engine.services.exploration.record(kind,name);
            if(!found)return;
            const section=this.directorySection(kind),head=section?.querySelector('.we-section-head');
            if(!section||!head||head.querySelector('.we-world-directory-actions'))return;
            const actions=engine.host.document.createElement('span');actions.className='we-world-directory-actions';
            const label=kind==='faction'?'势力':'探索';
            actions.innerHTML='<button type="button" data-action="world-directory-edit" data-directory-kind="'+kind+'" data-directory-name="'+this.escape(found.name)+'">编辑'+label+'</button><button type="button" data-action="world-directory-delete" data-directory-kind="'+kind+'" data-directory-name="'+this.escape(found.name)+'">删除'+label+'</button>';
            head.appendChild(actions);
        }
        armDirectoryDelete(button,kind,name){
            const actions=button?.closest?.('.we-world-directory-actions');if(!actions)return false;
            button.dataset.action='world-directory-delete-confirm';button.textContent='确认删除';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-directory-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-directory-delete-cancel';cancel.dataset.directoryKind=kind;cancel.dataset.directoryName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelDirectoryDelete(button){
            const actions=button?.closest?.('.we-world-directory-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-directory-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-directory-delete';confirm.textContent=confirm.dataset.directoryKind==='faction'?'删除势力':'删除探索';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-directory-delete-cancel"]')?.remove();return true;
        }

        // ---- 因果偏移 ----
        causalInlineHtml(name,record){
            const impact=Number(record?.影响程度),esc=value=>this.escape(value);
            return '<div class="we-offset-inline-editor" data-offset-editor data-offset-original-name="'+esc(name)+'"><div class="we-offset-edit-grid">'
                +'<label class="we-offset-edit-field"><span>偏移名称</span><input type="text" data-offset-field="name" value="'+esc(name)+'"></label>'
                +'<label class="we-offset-edit-field"><span>影响程度</span><input type="number" min="-12" max="15" step="1" data-offset-field="impact" value="'+esc(Number.isFinite(impact)?impact:'')+'"><small>-12~-1 或 +1~+15</small></label>'
                +'<label class="we-offset-edit-field we-offset-edit-wide"><span>偏移描述</span><textarea rows="4" data-offset-field="description" placeholder="只写已经实现的世界级长期改变">'+esc(record?.描述||'')+'</textarea></label>'
                +'<label class="we-offset-edit-field we-offset-edit-wide"><span>引发者</span><input type="text" data-offset-field="actor" value="'+esc(record?.引发者||'')+'"></label>'
                +'</div><div class="we-offset-actions we-offset-edit-actions"><button type="button" class="we-offset-save" data-action="causal-offset-save" data-offset-name="'+esc(name)+'">保存</button><button type="button" data-action="causal-offset-cancel">取消</button></div></div>';
        }
        beginCausal(name,card){
            const record=this.engine.services.causal.get(name);if(!plain(record)||!card)return false;
            card.innerHTML=this.causalInlineHtml(name,record);card.classList.add('we-offset-editing');
            try{const first=card.querySelector('[data-offset-field="name"]');first?.focus?.();first?.select?.();}catch(_){}
            return true;
        }
        saveCausal(card,oldName){
            const value=key=>card?.querySelector('[data-offset-field="'+key+'"]')?.value;
            return this.engine.services.causal.save(oldName,String(value('name')||'').trim(),{
                描述:String(value('description')||'').trim(),引发者:String(value('actor')||'').trim(),影响程度:Number(value('impact'))
            });
        }
        mountCausalControls(){
            const engine=this.engine;if(engine.tab!=='因果档案'||!engine.panel)return;
            const entries=engine.services.causalOverview.offsetEntries(engine.snapshot().stat);
            Array.from(engine.panel.querySelectorAll('.we-offset')).forEach((card,index)=>{
                const name=entries[index]?.[0];if(!name||card.querySelector('.we-offset-actions'))return;
                card.dataset.offsetName=name;
                const actions=engine.host.document.createElement('div');actions.className='we-offset-actions';
                actions.innerHTML='<button type="button" data-action="causal-offset-edit" data-offset-name="'+this.escape(name)+'">编辑</button><button type="button" data-action="causal-offset-delete" data-offset-name="'+this.escape(name)+'">删除</button>';
                card.appendChild(actions);
            });
        }
        armCausalDelete(button,name){
            const actions=button?.closest?.('.we-offset-actions');if(!actions)return false;
            button.dataset.action='causal-offset-delete-confirm';button.textContent='确认删除';button.classList.add('we-offset-delete-confirm');
            if(!actions.querySelector('[data-action="causal-offset-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='causal-offset-delete-cancel';cancel.dataset.offsetName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelCausalDelete(button){
            const actions=button?.closest?.('.we-offset-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="causal-offset-delete-confirm"]');
            if(confirm){confirm.dataset.action='causal-offset-delete';confirm.textContent='删除';confirm.classList.remove('we-offset-delete-confirm');}
            actions.querySelector('[data-action="causal-offset-delete-cancel"]')?.remove();return true;
        }

        // ---- 历史记忆 ----
        historyInlineHtml(kind,name,record){
            const esc=value=>this.escape(value);
            if(kind==='summary')return '<div class="we-history-inline-editor" data-history-editor="summary" data-history-name="'+esc(name)+'">'
                +'<div class="we-history-edit-title"><b>'+esc(name)+'</b><span>L'+esc(Number(record?.层级)||1)+' · 树结构锁定</span></div><div class="we-history-edit-grid">'
                +'<label class="we-history-edit-field"><span>起始时间</span><input type="text" data-history-field="start" value="'+esc(record?.起始时间||'')+'"></label>'
                +'<label class="we-history-edit-field"><span>结束时间</span><input type="text" data-history-field="end" value="'+esc(record?.结束时间||'')+'"></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>长期历史摘要</span><textarea rows="5" data-history-field="summary">'+esc(record?.摘要||'')+'</textarea></label>'
                +'</div><div class="we-history-actions"><button type="button" class="we-history-save" data-action="history-summary-save" data-history-name="'+esc(name)+'">保存</button><button type="button" data-action="history-summary-cancel">取消</button></div></div>';
            return '<div class="we-history-inline-editor" data-history-editor="anchor" data-history-name="'+esc(name)+'">'
                +'<div class="we-history-edit-title"><b>'+esc(name)+'</b><span>近期历史锚点</span></div><div class="we-history-edit-grid">'
                +'<label class="we-history-edit-field"><span>时间</span><input type="text" data-history-field="time" value="'+esc(record?.时间||'')+'"></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>已确认事实</span><textarea rows="4" data-history-field="fact">'+esc(record?.事实||'')+'</textarea></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>关联事件</span><input type="text" data-history-field="related" value="'+esc((Array.isArray(record?.关联事件)?record.关联事件:[]).join('、'))+'"><small>多个事件可用 、 或逗号分隔</small></label>'
                +'</div><div class="we-history-actions"><button type="button" class="we-history-save" data-action="history-anchor-save" data-history-name="'+esc(name)+'">保存</button><button type="button" data-action="history-anchor-cancel">取消</button></div></div>';
        }
        beginHistory(kind,name,card){
            const backend=this.engine.services.history.backend(),record=kind==='summary'?backend?.历史总结?.[name]:backend?.历史?.[name];
            if(!plain(record)||!card)return false;
            card.innerHTML=this.historyInlineHtml(kind,name,record);card.classList.add('we-history-editing');
            try{card.querySelector('textarea,input')?.focus?.();}catch(_){}
            return true;
        }
        saveHistory(kind,card,name){
            const value=key=>card?.querySelector('[data-history-field="'+key+'"]')?.value;
            if(kind==='summary')return this.engine.services.history.saveSummary(name,{起始时间:String(value('start')||'').trim(),结束时间:String(value('end')||'').trim(),摘要:String(value('summary')||'').trim()});
            return this.engine.services.history.saveAnchor(name,{时间:String(value('time')||'').trim(),事实:String(value('fact')||'').trim(),关联事件:value('related')});
        }
        mountHistoryControls(){
            const engine=this.engine;if(engine.tab!=='运行记录'||!engine.panel)return;
            const backend=engine.services.history.backend(),memory=projectWorldHistoryMemory(backend);
            const recentNames=Object.entries(memory.近期锚点||{}).reverse().map(([name])=>name),recentSection=this.section('近期历史锚点');
            Array.from(recentSection?.querySelectorAll('.we-card')||[]).forEach((card,index)=>{
                const name=recentNames[index];if(!name||card.querySelector('.we-history-actions'))return;
                card.dataset.historyName=name;card.dataset.historyKind='anchor';
                const actions=engine.host.document.createElement('div');actions.className='we-history-actions';
                actions.innerHTML='<button type="button" data-action="history-anchor-edit" data-history-name="'+this.escape(name)+'">编辑</button>';card.appendChild(actions);
            });
            const summaryNames=(memory.长期总结||[]).slice().reverse().map(item=>item.名称),summarySection=this.section('长期历史总结');
            Array.from(summarySection?.querySelectorAll('.we-card')||[]).forEach((card,index)=>{
                const name=summaryNames[index];if(!name||card.querySelector('.we-history-actions'))return;
                card.dataset.historyName=name;card.dataset.historyKind='summary';
                const actions=engine.host.document.createElement('div');actions.className='we-history-actions';
                actions.innerHTML='<button type="button" data-action="history-summary-edit" data-history-name="'+this.escape(name)+'">编辑</button>';card.appendChild(actions);
            });
        }

        ensureStyles(){
            const engine=this.engine;if(!engine.style||engine.style.textContent.includes('.we-world-editor-actions{'))return;
            engine.style.textContent+='\n'
                +'#sam-world-engine .we-world-edit-toggle{margin-left:auto}'
                +'#sam-world-engine .we-world-event-actions,#sam-world-engine .we-world-editor-actions,#sam-world-engine .we-world-directory-actions,#sam-world-engine .we-history-actions,#sam-world-engine .we-offset-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;margin-top:9px}'
                +'#sam-world-engine .we-world-event-actions button,#sam-world-engine .we-world-editor-actions button,#sam-world-engine .we-world-directory-actions button,#sam-world-engine .we-history-actions button,#sam-world-engine .we-offset-actions button,#sam-world-engine .we-world-person-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:5px 10px;cursor:pointer}'
                +'#sam-world-engine .we-world-editor-danger,#sam-world-engine .we-offset-delete-confirm{color:#ff8c8c!important;border-color:#b85c5c!important}'
                +'#sam-world-engine .we-world-editor-save,#sam-world-engine .we-history-save,#sam-world-engine .we-offset-save{color:var(--we-accent,var(--gold))!important}'
                +'#sam-world-engine .we-world-editor,#sam-world-engine .we-history-inline-editor,#sam-world-engine .we-offset-inline-editor{display:grid;gap:9px}'
                +'#sam-world-engine .we-world-editor-grid,#sam-world-engine .we-history-edit-grid,#sam-world-engine .we-offset-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}'
                +'#sam-world-engine .we-world-editor-grid label,#sam-world-engine .we-history-edit-field,#sam-world-engine .we-offset-edit-field{display:grid;gap:4px;min-width:0}'
                +'#sam-world-engine .we-world-editor-grid input,#sam-world-engine .we-world-editor-grid select,#sam-world-engine .we-world-editor-grid textarea,#sam-world-engine .we-history-edit-field input,#sam-world-engine .we-history-edit-field textarea,#sam-world-engine .we-offset-edit-field input,#sam-world-engine .we-offset-edit-field textarea{width:100%;border:1px solid var(--we-line,var(--line));border-radius:7px;background:var(--we-surface,#111923);color:var(--we-ink,var(--ink));padding:7px 9px}'
                +'#sam-world-engine .we-offset-edit-field textarea{height:92px!important;min-height:80px!important;max-height:180px!important;resize:vertical;line-height:1.55}'
                +'#sam-world-engine .we-history-edit-field textarea,#sam-world-engine .we-world-editor-grid textarea{min-height:78px!important;max-height:240px!important;resize:vertical;line-height:1.5}'
                +'#sam-world-engine .we-world-editor-wide,#sam-world-engine .we-history-edit-wide,#sam-world-engine .we-offset-edit-wide{grid-column:1/-1}'
                +'#sam-world-engine .we-world-person-actions,#sam-world-engine .we-world-directory-actions{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}'
                +'#sam-world-engine .we-world-editor-note,#sam-world-engine .we-history-edit-title{display:flex;justify-content:space-between;gap:10px;align-items:center}'
                +'@media(max-width:680px){#sam-world-engine .we-world-editor-grid,#sam-world-engine .we-history-edit-grid,#sam-world-engine .we-offset-edit-grid{grid-template-columns:1fr}#sam-world-engine .we-world-editor-wide,#sam-world-engine .we-history-edit-wide,#sam-world-engine .we-offset-edit-wide{grid-column:auto}}';
        }

        bindPanel(){
            const panel=this.engine.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="world-edit-mode"],[data-action^="world-event-"],[data-action^="world-person-"],[data-action^="world-directory-"],[data-action^="causal-offset-"],[data-action^="history-anchor-"],[data-action^="history-summary-"]');
                if(!button||!panel.contains(button))return;
                const action=String(button.dataset.action||'');
                if(action==='world-edit-mode'){event.preventDefault();event.stopPropagation();this.toggleMode();return;}
                let task=null;
                if(action.startsWith('world-event-')){
                    event.preventDefault();event.stopPropagation();
                    const card=button.closest('[data-event-card]'),name=String(button.dataset.eventName||card?.dataset?.eventCard||card?.querySelector?.('[data-world-event-edit]')?.dataset?.worldEventName||'');
                    if(action==='world-event-edit')this.beginEvent(name,card);
                    else if(action==='world-event-save')task=this.saveEvent(card,name);
                    else if(action==='world-event-cancel')this.engine.render(true);
                    else if(action==='world-event-delete')this.armEventDelete(button,name);
                    else if(action==='world-event-delete-confirm')task=this.engine.services.events.remove(name);
                    else if(action==='world-event-delete-cancel')this.cancelEventDelete(button);
                }else if(action.startsWith('world-person-')){
                    event.preventDefault();event.stopPropagation();
                    const section=this.section('身份与当前行动'),name=String(button.dataset.personName||section?.querySelector?.('[data-world-person-edit]')?.dataset?.worldPersonName||'');
                    if(action==='world-person-edit')this.beginPerson(name,section);
                    else if(action==='world-person-save')task=this.savePerson(section,name);
                    else if(action==='world-person-cancel')this.engine.render(true);
                    else if(action==='world-person-delete')this.armPersonDelete(button,name);
                    else if(action==='world-person-delete-confirm')task=this.engine.services.people.remove(name);
                    else if(action==='world-person-delete-cancel')this.cancelPersonDelete(button);
                }else if(action.startsWith('world-directory-')){
                    event.preventDefault();event.stopPropagation();
                    const kind=String(button.dataset.directoryKind||button.closest('[data-world-directory-edit]')?.dataset?.directoryKind||'exploration');
                    const section=this.directorySection(kind),name=String(button.dataset.directoryName||section?.querySelector?.('[data-world-directory-edit]')?.dataset?.directoryName||this.selectedDirectoryName(kind)||'');
                    if(action==='world-directory-edit')this.beginDirectory(kind,name,section);
                    else if(action==='world-directory-save')task=this.saveDirectory(section,kind,name);
                    else if(action==='world-directory-cancel')this.engine.render(true);
                    else if(action==='world-directory-delete')this.armDirectoryDelete(button,kind,name);
                    else if(action==='world-directory-delete-confirm')task=this.engine.services.exploration.removeRecord(kind,name);
                    else if(action==='world-directory-delete-cancel')this.cancelDirectoryDelete(button);
                }else if(action.startsWith('causal-offset-')){
                    event.preventDefault();event.stopPropagation();
                    const card=button.closest('.we-offset'),name=String(button.dataset.offsetName||card?.dataset?.offsetName||card?.querySelector?.('[data-offset-editor]')?.dataset?.offsetOriginalName||'');
                    if(action==='causal-offset-edit')this.beginCausal(name,card);
                    else if(action==='causal-offset-save')task=this.saveCausal(card,name);
                    else if(action==='causal-offset-cancel')this.engine.render(true);
                    else if(action==='causal-offset-delete')this.armCausalDelete(button,name);
                    else if(action==='causal-offset-delete-confirm')task=this.engine.services.causal.remove(name);
                    else if(action==='causal-offset-delete-cancel')this.cancelCausalDelete(button);
                }else if(action.startsWith('history-anchor-')||action.startsWith('history-summary-')){
                    event.preventDefault();event.stopPropagation();
                    const card=button.closest('.we-card'),name=String(button.dataset.historyName||card?.dataset?.historyName||card?.querySelector?.('[data-history-editor]')?.dataset?.historyName||'');
                    if(action==='history-anchor-edit')this.beginHistory('anchor',name,card);
                    else if(action==='history-summary-edit')this.beginHistory('summary',name,card);
                    else if(action==='history-anchor-save')task=this.saveHistory('anchor',card,name);
                    else if(action==='history-summary-save')task=this.saveHistory('summary',card,name);
                    else if(action.endsWith('-cancel'))this.engine.render(true);
                }
                if(task)Promise.resolve(task).catch(error=>this.reportError(error,action.startsWith('history-')?'历史记忆':action.startsWith('causal-')?'因果偏移':action.startsWith('world-directory-')?'探索与势力':action.startsWith('world-person-')?'世界人物':'世界事件'));
            });
        }
        afterRender(){
            this.ensureStyles();this.mountModeToggle();this.mountEventControls();this.mountPersonControls();this.mountDirectoryControls();this.mountCausalControls();this.mountHistoryControls();
        }
        dispose(){this.boundPanel=null;}
    }
    class WorldApiPresetController {
        constructor(engine){
            this.engine=engine;
            this.selection='';
            this.boundPanel=null;
        }
        afterApply(name,result){
            this.selection=String(name||'').trim();
            return result;
        }
        afterSave(entry){
            this.selection=String(entry?.name||'');
            return entry;
        }
        afterDelete(name,deleted){
            const selected=String(name||'').trim();
            if(deleted&&this.selection===selected)this.selection='';
            return deleted;
        }
        bindPanel(){
            const panel=this.engine.panel;
            if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('change',event=>{
                const select=event.target?.closest?.('[data-dedicated-preset]');
                if(!select||!panel.contains(select))return;
                this.selection=String(select.value||'');
                const remove=panel.querySelector?.('[data-action="dedicated-preset-delete"]');
                if(remove)remove.disabled=!this.selection;
            },true);
        }
        sync(){
            const engine=this.engine;
            if(engine.tab!=='设置'||!engine.panel)return;
            const select=engine.panel.querySelector?.('[data-dedicated-preset]');
            const remove=engine.panel.querySelector?.('[data-action="dedicated-preset-delete"]');
            if(!select)return;
            const wanted=String(this.selection||''),options=Array.from(select.options||[]);
            if(wanted&&options.some(option=>String(option.value)===wanted))select.value=wanted;
            else{
                select.value='';
                if(wanted)this.selection='';
            }
            if(remove)remove.disabled=!String(select.value||'');
        }
        afterRender(){this.sync();}
        dispose(){this.boundPanel=null;}
    }
    const CAUSAL_OVERVIEW_LIMIT=3;
    const WORLD_ENGINE_HIDDEN_PLAYER_TABS=new Set(['资产','传闻']);

    class WorldCausalOverviewController {
        constructor(engine){this.engine=engine;}
        static isPlayerTabHidden(tab){return WORLD_ENGINE_HIDDEN_PLAYER_TABS.has(String(tab||''));}
        static offsetEntries(stat){
            const bucket=stat?.世界?.因果轨道?.偏移记录;
            return Object.entries(plain(bucket)?bucket:{}).slice().reverse();
        }
        static latestOffsets(stat,limit=CAUSAL_OVERVIEW_LIMIT){
            return this.offsetEntries(stat).slice(0,Math.max(0,Number(limit)||0));
        }
        static impactLabel(value){
            const n=Number(value);
            return Number.isFinite(n)?(n>0?'+':'')+n:'影响未记录';
        }
        static escape(value){
            return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        }
        static interferenceMode(stat){return String(stat?.世界?.异端雷达?.当前模式||'').trim();}
        static compactHtml(stat){
            const world=stat?.世界||{},offsets=this.offsetEntries(stat),latest=offsets.slice(0,CAUSAL_OVERVIEW_LIMIT);
            const stable=world.稳定!==null&&world.稳定!==''&&Number.isFinite(Number(world.稳定))?Number(world.稳定):null;
            const rows=latest.map(([name,record])=>'<button class="we-causal-jump" data-tab="因果档案"><span><b>'+this.escape(name)+'</b><small>'+this.escape(record?.引发者||'引发者未记录')+'</small></span><strong>'+this.escape(this.impactLabel(record?.影响程度))+'</strong><p>'+this.escape(record?.描述||'暂无偏移描述')+'</p></button>').join('');
            return '<div class="we-causal-summary"><button class="we-stability-compact" data-tab="因果档案"><span><small>世界稳定值</small><strong>'+this.escape(stable===null?'未记录':stable)+'</strong></span><em>查看因果档案 →</em></button>'
                +(rows?'<div class="we-causal-latest">'+rows+'</div>':'<div class="we-empty"><b>暂无因果偏移</b><small>重大且已确认的因果改变会记录在这里。</small></div>')
                +'<button class="we-link-btn" data-tab="因果档案">查看全部 '+offsets.length+' 条偏移、故事线与世界法则 →</button></div>';
        }
        static archiveHtml(stat){
            const world=stat?.世界||{},orbit=world.因果轨道||{},offsets=this.offsetEntries(stat),stable=world.稳定!==null&&world.稳定!==''&&Number.isFinite(Number(world.稳定))?Number(world.稳定):null;
            const offsetCard=([name,record])=>'<article class="we-offset"><div class="we-offset-head"><b>'+this.escape(name)+'</b><span>'+this.escape(this.impactLabel(record?.影响程度))+'</span></div><p>'+this.escape(record?.描述||'暂无偏移描述')+'</p><small>引发者 · '+this.escape(record?.引发者||'未记录')+'</small></article>';
            const recent=offsets.slice(0,12),older=offsets.slice(12);
            const laws=Array.isArray(world.法则)?world.法则:(world.法则?[world.法则]:[]);
            const money=world.货币||{},interference=this.interferenceMode(stat);
            const story='<article class="we-card we-causal-track"><dl><dt>当前阶段</dt><dd>'+this.escape(orbit.当前阶段||'待初始化')+'</dd><dt>故事线</dt><dd>'+this.escape(orbit.故事线||'未记录')+'</dd><dt>下一节点</dt><dd>'+this.escape(orbit.下一节点||'未记录')+'</dd></dl></article>';
            const stability='<div class="we-causal"><div class="we-stability"><div><small>世界稳定值</small><strong data-world-stability>'+this.escape(stable===null?'未记录':stable)+'</strong></div><span>完整偏移保留为因果记忆；主面板仅显示最新 '+CAUSAL_OVERVIEW_LIMIT+' 条</span></div>'
                +(stable===null?'':'<meter min="0" max="120" value="'+Math.max(0,Math.min(120,stable))+'" aria-label="世界稳定值">'+stable+'</meter>')
                +'</div>';
            const offsetList=recent.length?recent.map(offsetCard).join(''):'<div class="we-empty"><b>暂无因果偏移</b><small>只有已发生的重大不可逆结果才会建立记录。</small></div>';
            const olderHtml=older.length?'<details class="we-offset-more"><summary>查看更早 '+older.length+' 条偏移</summary>'+older.map(offsetCard).join('')+'</details>':'';
            const interferenceHtml=interference?'<section class="we-section we-causal-interference"><div class="we-section-head"><h2>干涉模式</h2><small>副本干涉态势</small></div><article class="we-card"><p>'+this.escape(interference)+'</p></article></section>':'';
            const moneyHtml='<article class="we-card"><dl><dt>货币体系</dt><dd>'+this.escape(money.体系||'未记录')+'</dd><dt>购买力基准</dt><dd>'+this.escape(money.购买力基准||'未记录')+'</dd><dt>经济波动</dt><dd>'+this.escape(money.经济波动||'未记录')+'</dd></dl></article>';
            const lawHtml=laws.length?'<div class="we-reading we-world-laws">'+laws.map(item=>'<article><p>'+this.escape(item)+'</p></article>').join('')+'</div>':'<div class="we-empty"><b>尚无世界法则</b><small>明确生效的法则会在这里维护。</small></div>';
            return '<div class="we-causal-archive-grid"><div><section class="we-section"><div class="we-section-head"><h2>因果偏移档案</h2><small>'+offsets.length+' 条 · 最新在前</small></div>'+stability+offsetList+olderHtml+'</section></div><aside><section class="we-section"><div class="we-section-head"><h2>因果轨道</h2><small>长期方向</small></div>'+story+'</section>'+interferenceHtml+'<section class="we-section"><div class="we-section-head"><h2>货币与经济</h2><small>世界推进维护</small></div>'+moneyHtml+'</section><section class="we-section"><div class="we-section-head"><h2>世界法则</h2><small>'+laws.length+' 条</small></div>'+lawHtml+'</section></aside></div>';
        }
        static sectionByTitle(root,title){
            return Array.from(root?.querySelectorAll?.('.we-section')||[]).find(section=>section.querySelector('.we-section-head h2')?.textContent?.trim()===title)||null;
        }
        isPlayerTabHidden(tab){return this.constructor.isPlayerTabHidden(tab);}
        offsetEntries(stat){return this.constructor.offsetEntries(stat);}
        latestOffsets(stat,limit=CAUSAL_OVERVIEW_LIMIT){return this.constructor.latestOffsets(stat,limit);}
        interferenceMode(stat){return this.constructor.interferenceMode(stat);}
        compactHtml(stat){return this.constructor.compactHtml(stat);}
        archiveHtml(stat){return this.constructor.archiveHtml(stat);}
        sectionByTitle(root,title){return this.constructor.sectionByTitle(root,title);}
        beforeRender(){
            if(this.isPlayerTabHidden(this.engine.tab))this.engine.tab='世界推进';
        }
        ensureStyles(){
            const engine=this.engine;
            if(!engine.style||engine.style.textContent.includes('.we-causal-summary{'))return;
            engine.style.textContent+='\n#sam-world-engine .we-causal-summary{display:grid;gap:9px}#sam-world-engine .we-stability-compact,#sam-world-engine .we-causal-jump{width:100%;border:1px solid var(--we-line,var(--line));border-radius:10px;background:var(--we-card,#18222f);color:var(--we-ink,var(--ink));text-align:left}#sam-world-engine .we-stability-compact{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px}#sam-world-engine .we-stability-compact span{display:flex;align-items:baseline;gap:9px}#sam-world-engine .we-stability-compact small{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-stability-compact strong{font-size:22px}#sam-world-engine .we-stability-compact em{font-style:normal;color:var(--we-gold,var(--gold));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-causal-latest{display:grid;gap:6px}#sam-world-engine .we-causal-jump{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 9px;padding:9px 10px}#sam-world-engine .we-causal-jump:hover,#sam-world-engine .we-stability-compact:hover{background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-causal-jump span{min-width:0}#sam-world-engine .we-causal-jump b,#sam-world-engine .we-causal-jump small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#sam-world-engine .we-causal-jump small{margin-top:1px;color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-causal-jump strong{color:var(--we-gold,var(--gold));font-size:12px}#sam-world-engine .we-causal-jump p{grid-column:1/-1;margin:2px 0 0!important;color:var(--we-sub,var(--sub))!important;font-size:var(--we-fs-small,12px)!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}#sam-world-engine .we-causal-archive-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(260px,1fr);gap:23px;align-items:start;margin-top:22px}#sam-world-engine .we-causal-track dl{grid-template-columns:76px minmax(0,1fr)}@media(max-width:900px){#sam-world-engine .we-causal-archive-grid{grid-template-columns:1fr}}';
        }
        ensureArchiveTab(){
            const engine=this.engine,nav=engine.panel?.querySelector?.('nav');if(!nav)return;
            let button=nav.querySelector('[data-tab="因果档案"]');
            if(!button){
                button=engine.host.document.createElement('button');button.dataset.tab='因果档案';button.innerHTML='<span class="we-tab-icon" aria-hidden="true">◇</span>因果档案';
                const worldButton=nav.querySelector('[data-tab="世界推进"]');
                if(worldButton)worldButton.insertAdjacentElement('afterend',button);else nav.appendChild(button);
            }
            for(const item of nav.querySelectorAll('[data-tab]'))item.setAttribute('aria-selected',String(item.dataset.tab===engine.tab));
        }
        hideRedundantPlayerModules(){
            const nav=this.engine.panel?.querySelector?.('nav');if(!nav)return;
            for(const tab of WORLD_ENGINE_HIDDEN_PLAYER_TABS)nav.querySelector('[data-tab="'+tab+'"]')?.remove();
        }
        compactWorldOverview(){
            const engine=this.engine,main=engine.panel?.querySelector?.('main');if(!main)return;
            const stat=engine.snapshot().stat,causal=this.sectionByTitle(main,'因果状态');
            main.querySelector('.we-kpi-grid.we-kpi-compact')?.remove();
            if(causal){
                const head=causal.querySelector('.we-section-head');
                if(head){
                    const h=head.querySelector('h2'),small=head.querySelector('small');
                    if(h)h.textContent='因果摘要';
                    if(small)small.textContent='最新 '+Math.min(CAUSAL_OVERVIEW_LIMIT,this.offsetEntries(stat).length)+' 条 · 点击进入档案';
                }
                Array.from(causal.children).filter(child=>child!==head).forEach(child=>child.remove());
                causal.insertAdjacentHTML('beforeend',this.compactHtml(stat));
            }
            for(const title of ['货币与经济','世界法则'])this.sectionByTitle(main,title)?.remove();
        }
        removeRunRecordInterference(){
            const main=this.engine.panel?.querySelector?.('main');if(!main)return;
            this.sectionByTitle(main,'干涉模式')?.remove();
        }
        renderArchive(){
            const engine=this.engine,main=engine.panel?.querySelector?.('main');if(!main)return;
            main.insertAdjacentHTML('beforeend',this.archiveHtml(engine.snapshot().stat));
        }
        afterRender(){
            const engine=this.engine;
            if(!engine.panel)return;
            this.ensureStyles();
            this.ensureArchiveTab();
            this.hideRedundantPlayerModules();
            if(engine.tab==='世界推进')this.compactWorldOverview();
            else if(engine.tab==='因果档案')this.renderArchive();
            else if(engine.tab==='运行记录')this.removeRunRecordInterference();
        }
    }


    function isWorldEnginePlayerTabHidden(tab){return WorldCausalOverviewController.isPlayerTabHidden(tab);}
    function causalOffsetEntries(stat){return WorldCausalOverviewController.offsetEntries(stat);}
    function latestCausalOffsets(stat,limit=CAUSAL_OVERVIEW_LIMIT){return WorldCausalOverviewController.latestOffsets(stat,limit);}
    function causalImpactLabel(value){return WorldCausalOverviewController.impactLabel(value);}
    function causalOverviewEscape(value){return WorldCausalOverviewController.escape(value);}
    function causalInterferenceMode(stat){return WorldCausalOverviewController.interferenceMode(stat);}
    function causalCompactHtml(stat){return WorldCausalOverviewController.compactHtml(stat);}
    function causalArchiveHtml(stat){return WorldCausalOverviewController.archiveHtml(stat);}
    function causalSectionByTitle(root,title){return WorldCausalOverviewController.sectionByTitle(root,title);}
    class WorldEngineFeatureRegistry {
        constructor(engine){
            this.engine=engine;
            this.items=new Map();
        }
        register(key,feature){
            if(!key||!feature)throw new Error('世界推进 Feature 注册无效');
            this.items.set(String(key),feature);
            return feature;
        }
        get(key){return this.items.get(String(key))||null;}
        initialize(){
            for(const feature of this.items.values())feature.initialize?.();
            return this;
        }
        afterInit(result){
            for(const feature of this.items.values())feature.afterInit?.(result);
            return result;
        }
        bindPanel(){
            for(const feature of this.items.values())feature.bindPanel?.();
        }
        beforeRender(force){
            for(const feature of this.items.values())feature.beforeRender?.(force);
        }
        afterRender(force,result){
            for(const feature of this.items.values())feature.afterRender?.(force,result);
        }
        async afterBuildRequest(request,base){
            let current=request;
            for(const feature of this.items.values()){
                if(typeof feature.afterBuildRequest!=='function')continue;
                current=await feature.afterBuildRequest(current,base)||current;
            }
            return current;
        }
        async afterCatalogue(catalogue){
            let current=catalogue;
            for(const feature of this.items.values()){
                if(typeof feature.afterCatalogue!=='function')continue;
                current=await feature.afterCatalogue(current)||current;
            }
            return current;
        }
        async run(next,options={}){
            let runner=next;
            for(const feature of Array.from(this.items.values()).reverse()){
                if(typeof feature.aroundRun!=='function')continue;
                const downstream=runner;
                runner=()=>feature.aroundRun(downstream,options);
            }
            return runner();
        }
        dispose(){
            for(const feature of this.items.values())feature.dispose?.();
            this.items.clear();
        }
        describe(){
            return Array.from(this.items,([key,feature])=>({key,className:feature.constructor?.name||'UnknownFeature'}));
        }
    }
    class WorldEngineServiceContainer {
        constructor(engine){
            this.engine=engine;
            this.hostAdapter=engine.hostAdapter;
            this.configuration=engine.configService;
            this.runScheduler=engine._runScheduler||new WorldRunScheduler(engine);
            engine._runScheduler=this.runScheduler;
            this.applicationLifecycle=new WorldEngineLifecycleController(engine);
            this.context=new WorldRuntimeContextService(engine);
            this.knowledgeSelection=new WorldKnowledgeSelectionPolicy();
            ACTIVE_WORLD_KNOWLEDGE_SELECTION_POLICY=this.knowledgeSelection;
            this.knowledge=new WorldKnowledgeService(engine,this.knowledgeSelection);
            this.tokenTelemetry=new WorldTokenTelemetry();
            ACTIVE_WORLD_TOKEN_TELEMETRY=this.tokenTelemetry;
            this.proseExtractor=new WorldProseExtractor();
            ACTIVE_WORLD_PROSE_EXTRACTOR=this.proseExtractor;
            this.requestBuilder=new WorldRequestBuilder(engine,this.proseExtractor,this.tokenTelemetry);
            this.stateFactory=new WorldStateFactory();
            this.taskLedger=new WorldTaskAwarenessService();
            this.historyMemory=new WorldHistoryMemoryPolicy();
            ACTIVE_WORLD_HISTORY_MEMORY_POLICY=this.historyMemory;
            this.history=new WorldHistoryService(engine,this.historyMemory);
            this.stateProjector=new WorldStateProjector(engine,this.taskLedger,this.history);
            ACTIVE_WORLD_STATE_PROJECTOR=this.stateProjector;
            this.patchPolicy=new WorldPatchPolicy();
            ACTIVE_WORLD_PATCH_POLICY=this.patchPolicy;
            this.timePolicy=new WorldTimePolicy();
            ACTIVE_WORLD_TIME_POLICY=this.timePolicy;
            this.dueEventPolicy=new WorldDueEventPolicy(this.timePolicy);
            this.activityPolicy=new WorldActivityPolicy();
            this.timelinePolicy=new WorldTimelinePolicy(this.timePolicy);
            ACTIVE_WORLD_TIMELINE_POLICY=this.timelinePolicy;
            this.softMaintenancePolicy=new WorldSoftMaintenancePolicy(this.timelinePolicy);
            ACTIVE_WORLD_SOFT_MAINTENANCE_POLICY=this.softMaintenancePolicy;
            this.chronologyPolicy=new WorldChronologyPolicy();
            this.lifecycle=new WorldLifecycleService();
            ACTIVE_WORLD_LIFECYCLE_SERVICE=this.lifecycle;
            this.people=new WorldPersonActivityService(engine,this.timePolicy);
            ACTIVE_WORLD_PERSON_ACTIVITY_SERVICE=this.people;
            this.npcAudit=new WorldNpcAuditService();
            ACTIVE_WORLD_NPC_AUDIT_SERVICE=this.npcAudit;
            this.stateNormalizer=new WorldStateNormalizer();
            ACTIVE_WORLD_STATE_NORMALIZER=this.stateNormalizer;
            this.causal=new WorldCausalService(engine,this.patchPolicy);
            ACTIVE_WORLD_CAUSAL_SERVICE=this.causal;
            this.resultContract=WORLD_RESULT_CONTRACT;
            this.resultNormalizer=new WorldResultNormalizer();
            this.relationSync=new WorldRelationSyncPolicy();
            this.assetMaterialization=new WorldAssetMaterializationPolicy();
            this.exploration=new WorldExplorationService(engine);
            ACTIVE_WORLD_EXPLORATION_SERVICE=this.exploration;
            this.rumor=new WorldRumorService(engine);
            this.resultPatchCompilation=new WorldResultPatchCompilationService(
                this.resultNormalizer,
                this.exploration,
                this.causal,
                this.patchPolicy,
                this.npcAudit,
                this.people,
                this.taskLedger,
                this.chronologyPolicy,
                this.timePolicy,
                this.relationSync,
                this.assetMaterialization
            );
            this.stateIntegrity=new WorldStateIntegrityPolicy(this.patchPolicy,this.timePolicy,this.rumor);
            this.patchApplication=new WorldPatchApplicationService(this.patchPolicy,this.stateNormalizer,this.timelinePolicy,this.stateIntegrity,this.relationSync,this.rumor);
            this.stateMaterialization=new WorldStateMaterializationService(
                this.stateFactory,
                this.stateNormalizer,
                this.lifecycle,
                this.patchPolicy,
                this.patchApplication,
                this.exploration,
                this.causal,
                this.stateIntegrity
            );
            this.resultMaterializer=new WorldResultMaterializer(this.resultPatchCompilation,this.stateMaterialization);
            ACTIVE_WORLD_RESULT_MATERIALIZER=this.resultMaterializer;
            this.retryGuidance=new WorldRetryGuidanceService(engine);
            this.resultStaging=new WorldResultStagingService(this.resultNormalizer,this.resultMaterializer,this.chronologyPolicy,this.retryGuidance,this.rumor);
            ACTIVE_WORLD_RESULT_STAGING=this.resultStaging;
            this.resultParser=new WorldResultReplyParser();
            ACTIVE_WORLD_RESULT_REPLY_PARSER=this.resultParser;
            this.compiler=new WorldResultCompiler(engine,this.resultNormalizer,this.resultMaterializer,this.resultStaging,this.patchPolicy);
            this.validationPolicy=new WorldValidationPolicy(this.timelinePolicy,this.dueEventPolicy,this.activityPolicy,this.softMaintenancePolicy);
            ACTIVE_WORLD_VALIDATION_POLICY=this.validationPolicy;
            this.validation=new WorldValidationService(engine,this.validationPolicy,this.npcAudit);
            this.commit=new WorldCommitService(engine);
            this.mutations=new WorldMutationService(engine);
            this.snapshots=new WorldSnapshotService(engine,this.mutations);
            this.events=new WorldEventService(engine);
            this.requests=new WorldRequestService(engine);
            ACTIVE_WORLD_REQUEST_SERVICE=this.requests;
            this.transport=engine._apiTransport||new WorldApiTransportService(engine,this.tokenTelemetry);
            this.transport.telemetry=this.tokenTelemetry;
            engine._apiTransport=this.transport;
            this.promptDocuments=engine._promptDocuments||new WorldPromptDocumentService(engine);
            engine._promptDocuments=this.promptDocuments;
            this.run=engine._runOrchestrator||new WorldRunOrchestrator(engine);
            engine._runOrchestrator=this.run;
            this.autoProgress=new WorldAutoProgressController(engine);
            this.replay=new WorldReplayService(engine);
            this.manualAdvance=new WorldManualAdvanceFeature(engine);
            this.timeOwnership=new WorldTimeOwnershipFeature(engine,this.timePolicy);
            this.npcAuditPolicy=new WorldNpcAuditPolicy(engine,this.knowledgeSelection);
            this.historyLifecycle=new WorldHistoryLifecycle(engine,this.historyMemory);
            this.views=new WorldEngineViewRegistry(engine);
            this.prompts=new WorldPromptRegistry(engine);
            this.promptIntegration=new WorldPromptIntegrationService(engine,this.prompts,this.tokenTelemetry);
            this.panelController=new WorldPanelController(engine);
            this.panelRenderer=new WorldPanelRenderer(engine);
            this.editorController=new WorldEditorController(engine);
            this.features=new WorldEngineFeatureRegistry(engine);
            this.apiPreset=new WorldApiPresetController(engine);
            this.causalOverview=new WorldCausalOverviewController(engine);
            this.npcAuditPrompt=new WorldNpcAuditPromptFeature(engine);
            this.softMaintenance=new WorldSoftMaintenanceFeature(engine);
            this.integrityRequest=new WorldIntegrityRequestFeature(engine);
            this.worldActivityRequest=new WorldActivityRequestFeature(engine,this.activityPolicy);
            this.dueEvent=new WorldDueEventFeature(engine,this.dueEventPolicy);
            this.taskAwareness=new WorldTaskAwarenessFeature(engine,this.taskLedger,this.knowledgeSelection);
            this.chronology=new WorldChronologyFeature(engine,this.chronologyPolicy,this.knowledgeSelection);
            this.rumorRequest=new WorldRumorRequestFeature(engine,this.rumor);
            // Stateful wrappers are registered first so run composition preserves the former
            // history > replay > auto-progress > policy nesting without inheritance.
            this.features.register('historyLifecycle',this.historyLifecycle);
            this.features.register('replay',this.replay);
            this.features.register('manualAdvance',this.manualAdvance);
            this.features.register('autoProgress',this.autoProgress);
            this.features.register('npcAuditPolicy',this.npcAuditPolicy);
            this.features.register('timeOwnership',this.timeOwnership);
            this.features.register('npcAuditPrompt',this.npcAuditPrompt);
            this.features.register('apiPreset',this.apiPreset);
            this.features.register('causalOverview',this.causalOverview);
            this.features.register('softMaintenance',this.softMaintenance);
            this.features.register('integrityRequest',this.integrityRequest);
            this.features.register('worldActivityRequest',this.worldActivityRequest);
            this.features.register('dueEvent',this.dueEvent);
            this.features.register('taskAwareness',this.taskAwareness);
            this.features.register('chronology',this.chronology);
            this.features.register('rumorRequest',this.rumorRequest);
        }
        initialize(){
            this.prompts.initialize();
            this.features.initialize();
            return this;
        }
    }
    class WorldPromptWorkspaceController {
        constructor(engine,registry){this.engine=engine;this.registry=registry;}
        escape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
        editable(){return this.engine.promptEditing===true;}
        readSettings(){
            const engine=this.engine,panel=engine.panel;
            const list=panel&&panel.querySelector('[data-segment-list]');
            const rows=list?Array.from(list.querySelectorAll('[data-segment-row]')):[];
            const preset=list?rows.map(row=>segmentText({
                title:row.querySelector('[data-segment-title]')?.value||'',
                body:row.querySelector('[data-segment]')?.value||''
            })).filter(Boolean).join('\n'):engine.config.preset;
            const floors=panel&&panel.querySelector('[data-floors]');
            const activation=panel&&panel.querySelector('[data-activation]');
            const books=panel?Array.from(panel.querySelectorAll('[data-book]')):[];
            return {
                preset,
                corePrompt:panel?.querySelector('[data-core-prompt]')?.value??engine.config.corePrompt??CORE_WORLD_RULES,
                macroPrompt:panel?.querySelector('[data-macro-prompt]')?.value??engine.config.macroPrompt??DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:panel?.querySelector('[data-stability-prompt]')?.value??engine.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,
                npcAuditPrompt:panel?.querySelector('[data-npc-audit-prompt]')?.value??engine.config.npcAuditPrompt,
                structurePrompt:panel?.querySelector('[data-structure-prompt]')?.value??engine.config.structurePrompt??WORLD_RESULT_CONTRACT.instruction(),
                contextTurns:Math.max(1,Math.min(100,Number(floors?.value??engine.config.contextTurns)||6)),
                activationMode:activation?.value||engine.config.activationMode||'respect_activation',
                selectedEntries:books.length
                    ?books.filter(item=>item.checked&&!item.disabled).map(item=>item.value)
                    :(Array.isArray(engine.config.selectedEntries)?copy(engine.config.selectedEntries):null)
            };
        }
        read(values){
            const next=this.registry.normalize(values),panel=this.engine.panel;
            if(!panel)return next;
            for(const field of panel.querySelectorAll('[data-prompt-registry]')){
                const key=String(field.dataset.promptRegistry||'');
                if(key&&Object.hasOwn(next,key))next[key]=String(field.value??'');
            }
            return next;
        }
        mount(){
            if(this.engine.tab!=='提示词预设'||!this.engine.panel)return;
            const main=this.engine.panel.querySelector('main');if(!main)return;
            main.querySelector('[data-world-module-prompts]')?.remove();
            let section=main.querySelector('[data-prompt-registry-section]');
            if(!section){
                section=this.engine.host.document.createElement('section');
                section.className='we-section';section.dataset.promptRegistrySection='';
                const output=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='WorldResult 输出协议');
                if(output)output.insertAdjacentElement('beforebegin',section);else main.appendChild(section);
            }
            const groups=new Map();
            for(const item of this.registry.list()){
                if(!groups.has(item.group))groups.set(item.group,[]);
                groups.get(item.group).push(item);
            }
            const editable=this.editable();
            const rows=[];
            for(const [group,items] of groups){
                rows.push('<div class="we-prompt-registry-group"><h3>'+this.escape(group)+'</h3>');
                for(const item of items){
                    const tokens=formatTokenCount(estimateTokens(item.value),true);
                    const meta='<div class="we-prompt-registry-meta"><small><b>作用范围</b> · '+this.escape(item.scope||'system')+'</small><small><b>发送条件</b> · '+this.escape(item.condition||'按运行时条件')+'</small></div>';
                    const editor='<textarea data-prompt-registry="'+this.escape(item.key)+'" '+(editable?'':'readonly')+'>'+this.escape(item.value)+'</textarea>';
                    const nativeNote=item.native?'<div class="we-notice">此项也会与上方专用编辑器同步保存；若两处同时修改，以“全部实际提示词”中的值为准。</div>':'';
                    rows.push('<details class="we-segment we-prompt-registry-item"><summary>'+this.escape(item.title)+' <small>'+this.escape(item.source)+' · '+tokens+'</small></summary>'+meta+nativeNote+editor+'</details>');
                }
                rows.push('</div>');
            }
            section.innerHTML='<div class="we-section-head"><h2>全部实际提示词</h2><small>'+this.registry.list().length+' 项 · 唯一 Prompt Registry</small></div>'
                +'<div class="we-notice">这里列出世界推进实际发送给 AI 的全部静态指令：system、user payload、历史压缩与纠错重试。开启编辑后，每一项都可以在这里直接修改；程序 JSON Schema、字段白名单、动态校验错误与运行时事实不是提示词，因此不会开放编辑。</div>'
                +rows.join('');
        }
        syncEditableState(){
            if(!this.engine.panel)return;
            for(const field of this.engine.panel.querySelectorAll('[data-prompt-registry]'))field.readOnly=!this.editable();
        }
    }
    SamsaraWorldEngine=class SamsaraWorldEngineWithServices extends SamsaraWorldEngine {
        constructor(host,env){
            super(host,env);
            this.services=new WorldEngineServiceContainer(this).initialize();
            this.promptRegistry=this.services.prompts;
            this.promptWorkspace=new WorldPromptWorkspaceController(this,this.promptRegistry);
            this.services.promptIntegration.attachWorkspace(this.promptWorkspace);
            this.services.promptIntegration.initializeDefaults();
        }
        readPromptEditor(){
            const settings=super.readPromptEditor();
            return this.services?.promptIntegration?.readEditor(settings)||settings;
        }
        applyPromptSettings(settings){
            const integration=this.services?.promptIntegration;
            if(!integration)return super.applyPromptSettings(settings);
            const prepared=integration.prepareApply(settings);
            return integration.afterApply(prepared,super.applyPromptSettings(prepared));
        }
        savePromptDocument(name,settings,activate=true){
            const integration=this.services?.promptIntegration;
            return super.savePromptDocument(name,integration?integration.prepareDocument(settings):settings,activate);
        }
        importPromptDocument(raw){
            const doc=super.importPromptDocument(raw);
            return this.services?.promptIntegration?.importDocument(doc,raw)||doc;
        }
        init(){
            const result=super.init();
            this.services?.features?.afterInit?.(result);
            return result;
        }
        snapshot(){
            const snapshot=super.snapshot();
            return this.services?.replay?.adjustSnapshot?.(snapshot)||snapshot;
        }
        blocked(snapshot){
            const base=super.blocked(snapshot);
            return this.services?.autoProgress?.blocked?.(snapshot,base)??base;
        }
        schedule(source='variable-update',attempt=0){
            if(this.services?.autoProgress)return this.services.autoProgress.schedule(source,attempt);
            return super.schedule();
        }
        toggleAutoProgress(){return this.services?.autoProgress?.toggle?.();}
        autoProgressIntervalValue(){return this.services?.autoProgress?.interval?.()??2;}
        autoProgressContextKey(snapshot){return this.services?.autoProgress?.contextKey?.(snapshot)||'';}
        autoProgressShouldSchedule(snapshot){return this.services?.autoProgress?.shouldSchedule?.(snapshot)===true;}
        initializeAutoProgressCycle(snapshot){return this.services?.autoProgress?.initializeCycle?.(snapshot);}
        markAutoProgressRun(snapshot){return this.services?.autoProgress?.markRun?.(snapshot);}
        resetAutoProgressCycle(){return this.services?.autoProgress?.resetCycle?.();}
        autoProgressDuringExtraAnalysis(){return this.services?.autoProgress?.duringExtraAnalysis?.()===true;}
        autoProgressSameFloor(left,right){return this.services?.autoProgress?.sameFloor?.(left,right)===true;}
        worldReplayCurrentMessage(){return this.services?.replay?.currentMessage?.()||null;}
        worldReplayPathAllowed(path){return this.services?.replay?.pathAllowed?.(path)===true;}
        worldReplayAtomicPath(path){return this.services?.replay?.atomicPath?.(path)===true;}
        worldReplayCollect(before,after,path,operations){return this.services?.replay?.collect?.(before,after,path,operations);}
        buildWorldReplayPackage(before,after,fingerprint){return this.services?.replay?.buildPackage?.(before,after,fingerprint)||null;}
        applyWorldReplayPackage(stat,packageValue){return this.services?.replay?.applyPackage?.(stat,packageValue)===true;}
        worldReplayMarkEventInternal(){return this.services?.replay?.markEventInternal?.();}
        worldReplayReprocessContext(variables,before){return this.services?.replay?.reprocessContext?.(variables,before)||null;}
        worldReplaySetCycleRecovered(fingerprint,stat){return this.services?.replay?.setCycleRecovered?.(fingerprint,stat);}
        worldReplayClearHandledForRetry(stat,fingerprint){return this.services?.replay?.clearHandledForRetry?.(stat,fingerprint);}
        worldReplayLegacyPackage(context,variables){return this.services?.replay?.legacyPackage?.(context,variables)||null;}
        worldReplayWaitForIdle(){return this.services?.replay?.waitForIdle?.()||Promise.resolve();}
        worldReplayResolveIdleWaiters(){return this.services?.replay?.resolveIdleWaiters?.();}
        worldReplayImmediateRetry(context,variables){return this.services?.replay?.immediateRetry?.(context,variables)||Promise.resolve(false);}
        handleWorldReplayVariableEvent(variables,before){return this.services?.replay?.handleVariableEvent?.(variables,before)||false;}
        syncNpcBuildAuditFeature(){return this.services?.npcAuditPolicy?.sync?.()===true;}
        isNpcBuildAuditEnabled(){return this.services?.npcAuditPolicy?.enabled?.()===true;}
        isNpcAuditWorldbook(entry){return this.services?.npcAuditPolicy?.isWorldbook?.(entry)===true;}
        syncNpcAuditWorldbookSelection(catalogue){return this.services?.npcAuditPolicy?.syncWorldbookSelection?.(catalogue);}
        setNpcBuildAuditEnabled(value){return this.services?.npcAuditPolicy?.setEnabled?.(value);}
        setSendHistoryToProse(value){return this.services?.historyLifecycle?.setSendToProse?.(value);}
        proseHistoryMemory(stat){return this.services?.historyLifecycle?.proseMemory?.(stat)||{};}
        beforeWorldCommit(next,context={}){return this.services?.historyLifecycle?.beforeWorldCommit?.(next,context)===true;}
        maintainHistoryMemory(){return this.services?.historyLifecycle?.maintain?.()||Promise.resolve(0);}
        async catalogue(){
            const result=await super.catalogue();
            return this.services?.features?.afterCatalogue?.(result)||result;
        }
        async run(options={}){
            if(!this.services?.features)return super.run(options);
            return this.services.features.run(()=>super.run(options),options);
        }
        async buildRequest(base){
            this.services?.promptIntegration?.beforeBuildRequest();
            let request=await super.buildRequest(base);
            request=await this.services?.features?.afterBuildRequest?.(request,base)||request;
            return this.services?.promptIntegration?.decorateRequest(request)||request;
        }
        async requestHistoryMemorySummary(world,batch,outputLevel){
            if(this.services?.historyLifecycle)return this.services.historyLifecycle.requestSummary(world,batch,outputLevel);
            throw new Error('历史记忆服务尚未初始化');
        }
        get dedicatedApiPresetSelection(){return this.services?.apiPreset?.selection||'';}
        set dedicatedApiPresetSelection(value){if(this.services?.apiPreset)this.services.apiPreset.selection=String(value||'');}
        syncDedicatedApiPresetSelection(){return this.services?.apiPreset?.sync();}
        applyDedicatedApiPreset(name){
            const selected=String(name||'').trim(),result=super.applyDedicatedApiPreset(selected);
            return this.services?.apiPreset?.afterApply(selected,result)??result;
        }
        saveDedicatedApiPreset(name){
            const entry=super.saveDedicatedApiPreset(name);
            this.services?.apiPreset?.afterSave(entry);
            return entry;
        }
        deleteDedicatedApiPreset(name){
            const selected=String(name||'').trim(),deleted=super.deleteDedicatedApiPreset(selected);
            return this.services?.apiPreset?.afterDelete(selected,deleted)??deleted;
        }
        persistWorldEditorMutation(mutator,status){return this.services.mutations.commit(mutator,status);}
        worldEditorModeEnabled(){return this.services.editorController.modeEnabled();}
        setWorldEditorMode(value){return this.services.editorController.setMode(value);}
        toggleWorldEditorMode(){return this.services.editorController.toggleMode();}
        worldEditorSection(title){return this.services.editorController.section(title);}
        worldEditorReportError(error,title){return this.services.editorController.reportError(error,title);}
        worldEventRecord(name){return this.services.events.get(name);}
        setWorldEventRecord(oldName,newName,record){return this.services.events.save(oldName,newName,record);}
        removeWorldEventRecord(name){return this.services.events.remove(name);}
        worldPersonRecord(name){return this.services.people.get(name);}
        setWorldPersonRecord(name,record){return this.services.people.save(name,record);}
        removeWorldPersonRecord(name){return this.services.people.remove(name);}
        worldDirectoryRecord(kind,name){return this.services.exploration.record(kind,name);}
        setWorldDirectoryRecord(kind,oldName,newName,payload){return this.services.exploration.saveRecord(kind,oldName,newName,payload);}
        removeWorldDirectoryRecord(kind,name){return this.services.exploration.removeRecord(kind,name);}
        persistCausalOffsetMutation(mutator,status){return this.services.causal.commit(mutator,status);}
        causalOffsetRecord(name){return this.services.causal.get(name);}
        setCausalOffsetRecord(oldName,newName,record){return this.services.causal.save(oldName,newName,record);}
        removeCausalOffsetRecord(name){return this.services.causal.remove(name);}
        persistHistoryMemoryEdit(kind,name,build,status){return this.services.history.commitEdit(kind,name,build,status);}
        setHistoryAnchorRecord(name,record){return this.services.history.saveAnchor(name,record);}
        setHistorySummaryRecord(name,record){return this.services.history.saveSummary(name,record);}
        createPanel(){
            super.createPanel();
            this.services?.editorController?.bindPanel();
            this.services?.features?.bindPanel();
            this.services?.promptIntegration?.bindPanel(this.panel);
        }
        render(force=false){
            this.services?.features?.beforeRender(force);
            const result=super.render(force);
            this.services?.promptIntegration?.afterRender();
            this.services?.editorController?.afterRender();
            this.services?.features?.afterRender(force,result);
            return result;
        }
        dispose(){
            this.services?.features?.dispose?.();
            return super.dispose();
        }
    };
    // CommonJS 入口仅供离线测试，浏览器脚本不依赖打包器。
    if (typeof module !== 'undefined' && module.exports) { module.exports = {WORLD_ENGINE_VERSION,SamsaraWorldEngine,applyPatches,parseReply,emptyState,RECORDS,compileWorldResult,normalizeWorldResult,mergeWorldResults,WORLD_RESULT_SCHEMA,projectWorldContext,compactWorldLifecycle,calendarDate,repairExplorationGranularity,sortWorldEvents,eventScheduleLabel,staleActiveEvents,temporalAnomalies,activeAlienActivityRequirements,pruneDeadAlienPeople,extractWorldProse,derivePersonWorldContext,projectHotWorldPeople,WORLD_UI_THEMES,WORLD_FONT_SCALES,estimateTokens,formatTokenCount,normalizeTokenUsage,requestTokenTelemetry}; return; }
    const host = root.parent && root.parent !== root ? root.parent : root;
    // 酒馆脚本沙箱中的助手接口可能是词法全局，不一定挂在 iframe.window 上。
    const runtime = {
        get Mvu() { return typeof Mvu !== 'undefined' ? Mvu : root.Mvu || host.Mvu; },
        get tavern_events() { return typeof tavern_events !== 'undefined' ? tavern_events : root.tavern_events || host.tavern_events; }
    };
    if (typeof eventOn === 'function') runtime.eventOn = (...args) => eventOn(...args);
    if (typeof eventMakeFirst === 'function') runtime.eventMakeFirst = (...args) => eventMakeFirst(...args);
    if (typeof getChatMessages === 'function') runtime.getChatMessages = (...args) => getChatMessages(...args);
    if (typeof getCurrentChatId === 'function') runtime.getCurrentChatId = (...args) => getCurrentChatId(...args);
    if (typeof getCharWorldbookNames === 'function') runtime.getCharWorldbookNames = (...args) => getCharWorldbookNames(...args);
    if (typeof getChatWorldbookName === 'function') runtime.getChatWorldbookName = (...args) => getChatWorldbookName(...args);
    if (typeof getGlobalWorldbookNames === 'function') runtime.getGlobalWorldbookNames = (...args) => getGlobalWorldbookNames(...args);
    if (typeof getWorldbook === 'function') runtime.getWorldbook = (...args) => getWorldbook(...args);
    host.Samsara = host.Samsara || {};
    const loaderInfo=plain(host.SamsaraWorldEngineLoader)?host.SamsaraWorldEngineLoader:{};
    host.Samsara.WorldEngineInfo={version:WORLD_ENGINE_VERSION,sha:String(loaderInfo.sha||''),repository:String(loaderInfo.repository||'Unspoken-MomoTea/Battlefield-of-Reincarnation'),entryPath:'/script/世界推进系统.js'};
    if (host.Samsara.worldEngine) host.Samsara.worldEngine.dispose();
    const engine = new SamsaraWorldEngine(host,runtime);
    host.Samsara.WorldEngine = SamsaraWorldEngine;
    host.Samsara.worldEngine = engine; engine.init();
    root.addEventListener('unload', () => engine.dispose(), {once:true});
})(typeof window !== 'undefined' ? window : globalThis);