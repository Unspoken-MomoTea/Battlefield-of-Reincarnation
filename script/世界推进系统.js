/* 轮回战场 · 世界引擎
 * 从参考异步助手迁移：旧状态回读、增量补丁、分层投影、楼层隔离、后台调度。
 * 专用实现：四个业务模块共用一次推演；MVU 是唯一持久状态；复用主神终端 API。
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
    const DEFAULT_PRESET = `你是轮回战场的世界演进主持者。以当前世界的旧状态、世界书设定及本轮实际剧情为依据，统一处理四个模块：
【世界推进】维护近期事件与远期宏观节点。记录原因、条件、时间、默认走向及玩家干预后的改变。过去已经成立的事实约束未来。未来计划不得记成已发生事实。即使玩家不参与，场外事件也能在时间及条件满足后发生。
【角色管理】维护人物所在世界、地点、目标、行动、已知信息及下次检查条件。场外行动受路程、资源、能力及认知限制。在场人物以正文为准，不能替玩家行动或裁决未结束战斗。人物记录与关系列表按名字关联，不编造整套人物属性。
【势力与地区】处理势力目标、资源、冲突、地区变化、探索线索。声望变化必须有真实行为依据，不能因为经过时间自动涨落。未知探索点保留在内部地区记录，发现后才投影到世界.探索。
【任务与剧本】维护剧情节点、任务依赖和失败条件；实际条件满足才更新已有任务或成就状态。主神任务、晋升试炼的创建、奖励定义与发奖由原系统负责。
【信息传播】事件产生街头巷议、付费情报或公告。区分事实、猜测、谣言；记录传播来源、范围、时间和关联事件。人物只有获得信息后才能据此行动。传闻可产生新事件，禁止无因果地每轮刷新。
只使用世界.时间计算本世界进展；系统状态.游玩天数仅作只读参考。时间未变也可记录本轮新事实，但不得虚构耗时进度。跨多个日期需按依赖顺序补算，先处理到期事件再生成后果。
事件分待发生、进行中、已完成、已取消；受玩家当前互动影响而尚无结果时保持进行中。宏观远期节点允许时间未定，禁止捏造精确日期。
世界超稳时保持默认宏观轨道，不新增偏移。单一世界的局部结算不能重置世界。普通副本返回主神空间后停止本世界推演。
初始化时依据当前设定建立必要的近远期节点；无依据的记录保持空。没有变化就返回空补丁。公开摘要只包含当前可观察的事实、征兆和已知线索，隐藏真相和未来结局留在后台。`;
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
    function emptyState() {
        return { 版本:2, 已处理楼层:'', 已处理时间:'', 公开摘要:'', 事件:{}, 人物:{}, 势力地区:{}, 剧本:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[] };
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
    function checkRecord(value, template, optional = {}) {
        if (!plain(value) || Object.keys(template).some(k => !Object.hasOwn(value,k)) || Object.keys(value).some(k => !Object.hasOwn(template,k) && !Object.hasOwn(optional,k))) throw new Error('记录字段必须完整且不能添加未知字段');
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
    // 仅允许世界叙事字段；数值属性、货币、奖励发放和时钟不在写入名单内。
    function allowed(parts, stat) {
        const [a,b,c,d] = parts;
        if (a === '世界' && b === PATH) {
            if (parts.length === 3 && c === '公开摘要') return true;
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
        for (const category of ['人物','势力地区','剧本','历史','传播']) {
            for (const record of Object.values(state[category])) if (record.关联事件.some(id => !Object.hasOwn(state.事件,id))) throw new Error('关联事件不存在');
        }
    }
    function applyPatches(stat, patches) {
        if (!Array.isArray(patches) || patches.length > 100) throw new Error('每轮最多 100 条补丁');
        const next = copy(stat);
        next.世界[PATH] = Object.assign(emptyState(), next.世界[PATH] || {});
        for (const patch of patches) {
            if (!plain(patch) || !['add','replace','remove'].includes(patch.op)) throw new Error('不支持的补丁操作');
            const p = tokens(patch.path);
            if (!allowed(p,next)) throw new Error('禁止写入：' + patch.path);
            const old = get(next,p);
            if (p[1] === PATH && p[2] === '历史' && (patch.op !== 'add' || old !== undefined)) throw new Error('历史只允许新增');
            if (patch.op === 'add' && old !== undefined) throw new Error('新增记录已存在：' + patch.path);
            if (patch.op !== 'add' && old === undefined) throw new Error('目标不存在：' + patch.path);
            if (patch.op === 'remove' && !(p[0] === '传闻' || (p[1] === PATH && p[2] === '传播'))) throw new Error('仅可移除过期传播与传闻，其他记录使用状态结束');
            if (patch.op !== 'remove') {
                if (patch.value === undefined) throw new Error('缺少补丁值');
                const category = p.length === 3 ? p[1] : p.length === 4 ? p[2] : '';
                if (EXISTING[category]) checkRecord(patch.value, EXISTING[category]);
                else if (old !== undefined && (typeof old !== typeof patch.value || Array.isArray(old) !== Array.isArray(patch.value))) throw new Error('字段类型发生改变');
                if (typeof patch.value === 'number' && !Number.isFinite(patch.value)) throw new Error('数值无效');
                if (p[0] === '世界' && p[1] === '因果轨道' && p.length === 3 && typeof patch.value !== 'string') throw new Error('因果摘要必须是文本');
                if (p[0] === '任务' && p[1] === '副本成就' && old === '已达成' && patch.value !== old) throw new Error('不能回退已达成成就');
                if (p[p.length-1] === '好感度' && Math.abs(patch.value - old) > 20) throw new Error('单轮好感变动超过20');
            }
            let parent = next;
            for (const key of p.slice(0,-1)) {
                if (parent[key] === undefined) parent[key] = {};
                if (!plain(parent[key])) throw new Error('父路径不是对象');
                parent = parent[key];
            }
            if (patch.op === 'remove') delete parent[p.at(-1)]; else parent[p.at(-1)] = copy(patch.value);
        }
        validateState(next);
        for (const [name,item] of Object.entries(next.世界.势力 || {})) {
            const old = (stat.世界.势力 || {})[name];
            if (Math.abs(item.声望 - (old ? old.声望 : 0)) > 1000) throw new Error('单轮声望变动超过1000');
        }
        return next;
    }
    function parseReply(text) {
        let source = String(text).trim();
        const block = source.match(/<world_update>([\s\S]*?)<\/world_update>/);
        if (block) source = block[1].trim();
        source = source.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        const result = JSON.parse(source);
        if (!plain(result) || !Array.isArray(result.patches) || typeof result.summary !== 'string') throw new Error('回复需包含 summary 和 patches');
        return result;
    }
    function protocol() {
        return `返回 <world_update>{"summary":"简短说明本轮已确认变化与待确认事项","patches":[]}</world_update>，不得输出推理过程。
补丁只用 add/replace/remove，路径为相对 stat_data 的 JSON Pointer，实例名中的 / 写成 ~1，~ 写成 ~0。add 仅新建，replace 仅已有；空输入或条件不成立可返回空数组。
后台根：/世界/后台/{事件|人物|势力地区|剧本|历史|传播}/{稳定名称}。新记录一次给全字段，字段模板：${JSON.stringify(RECORDS)}。
历史只增不改不删；事件通过状态结束，不删除。关联事件和前因必须指向实际存在的事件，前因不能循环。人物所属世界必须明确。
公开摘要写 /世界/后台/公开摘要，限5000字，仅包含已发生的公开影响与可见征兆，不能泄露隐藏计划。
兼容投影允许：/世界/因果轨道/{当前阶段|故事线|下一节点}、/世界/因果轨道/偏移记录/{名}；/世界/{势力|探索}/{名}；/世界/异端雷达/名单/{名}；/传闻/{街头巷议|情报交易|布告与檄文}/{名}。记录完整字段模板：${JSON.stringify(EXISTING)}。
已有势力/探索可修改单个字段。声望范围 -5000~10000，单次至多1000；探索度0~100，品质 F/E/D/C/B/A/S/SS/SSS。街头可信度仅酒话/可疑/或许可信。三类传闻各最多3条。异端层级Ⅰ~Ⅸ，状态遵循旧变量及世界书。
关系仅允许修改既有 /关系列表/{名}/好感度，范围-100~100，单轮至多20。人物目标行动认知写后台.人物，不改人物战斗属性。
任务仅允许修改既有 /任务/列表/{名}/状态 或 /任务/副本成就/{名}/状态；任务状态进行中/可交付/可结算/失败，成就未达成/已达成。禁止回退已达成成就。不得创建主神任务、晋升试炼或发放奖励。
禁止修改世界时间、世界身份、系统状态、玩家属性、击杀计数、装备、货币、奖励。正文和现有变量已经确认的变化不要重复加算，尤其好感与声望。未来走向写后台事件，不能当作当前事实投影。`;
    }
    class SamsaraWorldEngine {
        constructor(host, env) {
            this.host = host; this.env = env || host; this.unsub = []; this.generation = 0;
            this.busy = false; this.committing = false; this.disposed = false; this.tab = '总览'; this.status = '待命';
            this.config = { enabled:false, preset:DEFAULT_PRESET };
            try { Object.assign(this.config, JSON.parse(host.localStorage.getItem(CONFIG) || '{}')); } catch (_) {}
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
            this.config.preset = text; this.saveConfig();
        }
        setEnabled(value) { this.config.enabled = !!value; this.saveConfig(); if (!value) this.cancel(); this.render(); }
        cancel() { ++this.generation; this.pending = false; clearTimeout(this.timer); if (this.controller) this.controller.abort(); }
        async worldbook() {
            const namesFn = this.fn('getCharWorldbookNames'), bookFn = this.fn('getWorldbook');
            if (!namesFn || !bookFn) throw new Error('缺少世界书读取接口');
            const names = await namesFn('current');
            const books = [...new Set([names.primary].concat(names.additional || []).filter(Boolean))];
            if (!books.length) throw new Error('当前角色未绑定世界书');
            const output = [];
            for (const name of books) {
                const entries = await bookFn(name);
                for (const entry of entries) {
                    if (entry.enabled === false || entry.disable === true || entry.disabled === true) continue;
                    const title = entry.name || entry.comment || '';
                    if (!/世界|因果|人物|NPC|势力|地区|任务|成就|异端|传闻|阵营|组织/.test(title)) continue;
                    let content = entry.content || '';
                    if (content.includes('<%')) {
                        const ejs = this.host.EjsTemplate;
                        if (!ejs || !ejs.evalTemplate || !ejs.prepareContext) throw new Error('世界书含动态模板，需要 EJS 扩展');
                        content = await ejs.evalTemplate(content, await ejs.prepareContext({}));
                    }
                    output.push({名称:title,内容:content});
                }
            }
            return output;
        }
        schedule() {
            if (this.disposed || this.committing || !this.config.enabled) return;
            if (this.busy) { this.pending = true; return; }
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.run().catch(() => {}), 900);
        }
        async run() {
            if (this.disposed || this.busy) return false;
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            this.busy = true; const token = this.generation; let timeout;
            try {
                const base = this.snapshot(), reason = this.blocked(base);
                if (reason) { this.status = reason; return false; }
                const old = Object.assign(emptyState(),base.stat.世界[PATH] || {});
                if (old.已处理楼层 === base.fingerprint) { this.status = '本楼层已处理，不重复结算'; return false; }
                if (!terminal || !terminal.apiReady()) throw new Error('请在主神终端设置中启用额外模型并选择模型');
                const validate = this.host.Samsara && this.host.Samsara.validateWorldState;
                if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');
                this.controller = new AbortController();
                timeout = setTimeout(() => this.controller.abort(),120000);
                this.status = '正在读取世界资料'; this.render();
                const books = await this.worldbook();
                const state = copy(base.stat); state.世界[PATH] = old;
                // 接口凭据与商城缓存不属于世界推演资料。
                if (state.设置) delete state.设置.API;
                delete state.商城;
                const input = JSON.stringify({世界书:books,当前变量:state,本轮正文:base.text,说明:'以当前变量为已确认事实；不要重复结算正文变量已记录的数值变化。'});
                if (input.length > 240000) throw new Error('世界资料超过24万字，请精简绑定世界书或历史记录后再运行');
                if (token !== this.generation || this.controller.signal.aborted) throw new Error('请求已取消');
                this.status = '四模块联合推演中'; this.render();
                const detailRules = '\n可选明细字段（有事实依据才填写；旧记录可用 add 添加明细字段，列表整体 replace）：'+JSON.stringify(DETAILS)+'\n每个人物维护当前行动、开始与预计结束、下次检查；有后续计划时记录行程，承诺、待决事项及认知来源按实际补充。势力记录资源约束和内部派系，地区记录控制权与近期变化，剧本记录阶段、期限、阻碍和完成失败条件。事件给出参与者、关联任务及带时间地点的可见影响。日期一律使用绝对剧情日期，未知就留空。不要用新的事实替换旧事实掩盖因果过程。';
                const text = await terminal.request(this.config.preset + '\n\n' + protocol()+detailRules,input,{signal:this.controller.signal});
                const reply = parseReply(text);
                let next = applyPatches(base.stat,reply.patches);
                // 沿用辅助计算脚本公式；后台提交不能额外消耗战斗轮次或状态持续时间。
                if (!(next.设置 || {}).世界超稳) {
                    const offsets = (next.世界.因果轨道 || {}).偏移记录 || {};
                    const total = Object.values(offsets).reduce((n,r) => n + (Number(r.影响程度) || 0),0);
                    next.世界.稳定 = Math.max(0,Math.min(120,100+total));
                }
                next.世界[PATH].已处理楼层 = base.fingerprint;
                next.世界[PATH].已处理时间 = base.stat.世界.时间;
                const changes = reply.patches.filter(p=>p.path !== '/世界/后台/公开摘要').map(p=>{
                    const parts=tokens(p.path), back=parts[1]===PATH;
                    return {时间:base.stat.世界.时间,类别:back?parts[2]:parts[1],名称:back?parts[3]:parts[2],字段:parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.内容||'记录已更新'):''};
                });
                next.世界[PATH].最近变化 = (old.最近变化 || []).concat(changes).slice(-100);
                next.世界[PATH].运行记录 = old.运行记录.concat([{时间:base.stat.世界.时间,摘要:reply.summary,补丁数:reply.patches.length}]).slice(-20);
                const checked = validate(next);
                // 校验器可能补默认值或重算其他字段，只取此次允许写入的路径。
                for (const patch of reply.patches) {
                    if (patch.op !== 'remove' && !same(get(checked,tokens(patch.path)),get(next,tokens(patch.path)))) throw new Error('字段未通过完整 Schema 校验：'+patch.path);
                }
                const current = this.snapshot();
                if (token !== this.generation || this.controller.signal.aborted || current.fingerprint !== base.fingerprint || this.blocked(current)) throw new Error('上下文已经切换，本次结果已丢弃');
                // 整轮校验后再提交。任何并行变量变化都让本轮失效，避免覆盖原系统结果。
                if (!same(current.stat,base.stat)) throw new Error('推演期间变量发生变化，请重新运行');
                this.committing = true;
                const result = current.raw; result.stat_data = next;
                result.__samsaraWorldCommit = base.fingerprint;
                await current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                this.status = '已更新 · ' + reply.summary;
                return true;
            } catch (error) {
                this.status = (this.committing ? '写入未确认 · ' : '未写入 · ') + (error.name === 'AbortError' ? '请求已取消或超时' : error.message);
                throw error;
            } finally {
                clearTimeout(timeout); this.controller = null; this.committing = false; this.busy = false; this.render();
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
                '#sam-world-engine .we-change{display:grid;grid-template-columns:62px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:12px}#sam-world-engine .we-change time{color:var(--gold);font-size:10px}#sam-world-engine .we-change p{margin:2px 0;color:var(--sub)}#sam-world-engine .we-progress{height:4px;background:#ffffff0a;border-radius:4px;margin:10px 0 6px;overflow:hidden}#sam-world-engine .we-progress>i{display:block;height:100%;background:var(--mint);border-radius:4px}#sam-world-engine .we-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px}#sam-world-engine dl{margin:12px 0;display:grid;grid-template-columns:85px minmax(0,1fr);gap:8px 14px;font-size:12px}#sam-world-engine dt{color:var(--sub)}#sam-world-engine dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}#sam-world-engine details{border-top:1px solid var(--line);margin-top:12px;padding-top:8px}#sam-world-engine summary{cursor:pointer;color:var(--gold);font-size:11px;list-style:none}#sam-world-engine summary:before{content:"＋ ";}#sam-world-engine details[open]>summary:before{content:"− ";}',
                '#sam-world-engine .we-calendar{background:#18222f;border:1px solid var(--line);border-radius:8px;padding:16px;margin-bottom:20px}#sam-world-engine .we-calhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}#sam-world-engine .we-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}#sam-world-engine .we-days span{color:var(--sub);font-size:10px;padding:4px}#sam-world-engine .we-days button{position:relative;padding:7px 0;border:1px solid transparent;border-radius:5px;background:none;font-size:11px;min-width:0}#sam-world-engine .we-days button.today{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-days button.selected{background:#d9b97824}#sam-world-engine .we-days button.has-event:after{content:"";position:absolute;bottom:2px;left:calc(50% - 2px);width:4px;height:4px;background:var(--mint);border-radius:50%}#sam-world-engine .we-days button:hover{background:#ffffff0b}',
                '#sam-world-engine .we-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:18px 0}#sam-world-engine .we-tools input{min-width:150px;flex:1;background:#17212d;border:1px solid var(--line);border-radius:6px;color:var(--ink);padding:8px 12px;font-size:12px}#sam-world-engine .we-tools button{border:1px solid var(--line);background:none;border-radius:5px;padding:6px 10px;font-size:11px}#sam-world-engine .we-tools button.active{border-color:var(--gold);color:var(--gold)}#sam-world-engine .we-empty{padding:24px 15px;text-align:center;border:1px dashed #ffffff19;border-radius:8px;color:var(--sub);font-size:12px}#sam-world-engine .we-empty b{display:block;color:#bec9d6;margin-bottom:5px;font-weight:500}#sam-world-engine .we-notice{padding:12px 16px;border-left:2px solid var(--gold);background:#d9b97808;margin:15px 0;color:#d4c4a6;font-size:12px}#sam-world-engine textarea{width:100%;min-height:48vh;background:#121b26;color:var(--ink);border:1px solid #ffffff24;border-radius:8px;padding:18px;line-height:1.9;resize:vertical}#sam-world-engine footer{padding:8px 24px;border-top:1px solid var(--line);font-size:10px;color:var(--sub);display:flex;justify-content:space-between;gap:15px}#sam-world-engine footer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
                '@media(max-width:1000px){#sam-world-engine .we-columns{grid-template-columns:1fr}#sam-world-engine nav{width:145px}#sam-world-engine main{padding:20px}#sam-world-engine .we-calendar{max-width:400px}}@media(max-width:640px){#sam-world-engine{inset:0;border-radius:0}#sam-world-engine header{padding:0 12px;height:58px;gap:6px}#sam-world-engine .we-brand{font-size:13px;letter-spacing:1px}#sam-world-engine .we-brand small{display:none}#sam-world-engine .we-layout{flex-direction:column}#sam-world-engine nav{width:100%;flex-direction:row;overflow-x:auto;padding:8px;gap:3px;border-right:0;border-bottom:1px solid var(--line)}#sam-world-engine nav .we-navtitle{display:none}#sam-world-engine nav button{white-space:nowrap;padding:7px 10px;font-size:11px}#sam-world-engine nav button span{display:none}#sam-world-engine main{padding:18px 14px}#sam-world-engine .we-hero{gap:12px;align-items:flex-start}#sam-world-engine h1{font-size:23px}#sam-world-engine .we-hero .we-date{min-width:110px;font-size:12px}#sam-world-engine .we-metric{padding:10px}#sam-world-engine .we-metric strong{font-size:20px}#sam-world-engine .we-grid{grid-template-columns:1fr}#sam-world-engine footer{padding:8px 12px}#sam-world-engine footer small{display:none}}'
            ].join('\n');
            doc.head.appendChild(this.style);
            this.panel=doc.createElement('section');this.panel.id='sam-world-engine';this.panel.hidden=true;
            this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-label','世界引擎');
            this.panel.innerHTML='<header><div class="we-brand"><i>◈</i>世界引擎<small>WORLD CHRONICLE</small></div><button class="we-btn" data-action="enabled"></button><button class="we-btn we-primary" data-action="run">推进世界</button><button class="we-btn" data-action="close" aria-label="返回主神终端">返回 ↗</button></header><div class="we-layout"><nav></nav><main></main></div><footer><span></span><small>剧情时间驱动 · 关闭面板后仍可自动运行</small></footer>';
            this.panel.addEventListener('click',event=>{
                const button=event.target.closest('button');if(!button)return;
                const a=button.dataset.action;
                if(a==='close')this.close();
                else if(a==='run')this.run().catch(()=>{});
                else if(a==='enabled')this.setEnabled(!this.config.enabled);
                else if(a==='cancel'){this.cancel();this.status='已请求停止';this.render();}
                else if(a==='save'){this.setPreset(this.panel.querySelector('textarea').value);this.status='预设已保存';this.render();}
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
            doc.body.appendChild(this.panel);
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
            this.panel.querySelector('[data-action=run]').disabled=this.busy||!!reason;
            this.panel.querySelector('[data-action=run]').textContent=this.busy?'推演中…':'推进世界';
            this.panel.querySelector('[data-action=enabled]').textContent=this.config.enabled?'自动 · 开启':'自动 · 关闭';
            const tabs=[['世界推进','◈'],['角色管理','♙'],['势力与地区','⚑'],['任务与剧本','▤'],['传闻','◌'],['提示词预设','✎'],['运行记录','≋']];
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
            const people=new Map(entries(state.人物));entries(s.关系列表).forEach(([n,p])=>{if(!people.has(n))people.set(n,{状态:p.在场?'在场':'场外',公开动态:p.态度||'',地点:'',目标:'',行动:''});});
            const person=(name,p,full=false)=>{
                const rel=(s.关系列表||{})[name]||{};
                return '<article class="'+(full?'we-card':'we-person')+'">'+(!full?'<div class="we-avatar">'+text(name.slice(0,1))+'</div>':'')+'<div><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(p.状态||(rel.在场?'在场':'场外'),'dim')+'</div><p>'+text(p.行动||p.公开动态||rel.态度||'尚无行动记录')+'</p><div class="we-meta"><span>⌖ '+text(p.地点||'地点未明')+'</span>'+(p.预计结束?'<span>至 '+text(dateLabel(p.预计结束))+'</span>':'')+'</div>'+(full?fields({目标:p.目标,当前时间段:[p.开始时间,p.预计结束].filter(Boolean).join(' → '),下次检查:p.下次检查,所属世界:p.所属世界,好感度:rel.好感度})+details('person-'+name,{行程:p.行程,承诺:p.承诺,待决事项:p.待决事项,认知:p.认知,认知来源:p.认知来源,关系变化:p.关系变化,登场条件:p.登场条件,关联事件:p.关联事件,更新时间:p.更新时间,人物背景:rel.背景故事},'行程 · 承诺 · 认知 · 关系'):'')+'</div></article>';
            };
            const eventCard=(name,e)=>'<article class="we-card"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(e.状态,e.状态==='待发生'?'future':e.状态==='进行中'?'':'dim')+'</div><div class="we-meta"><span>◷ '+text(e.时间||e.开始时间||'日期未定')+'</span><span>⌖ '+text(e.地点||'地点未明')+'</span></div><p>'+text(e.公开征兆||e.描述||'等待明确事件内容')+'</p>'+details('event-'+name,{事件描述:e.描述,分类:e.分类,前因:e.前因,触发条件:e.条件,参与者:e.参与者,关联任务:e.关联任务,预计结束:e.预计结束,下次检查:e.下次检查,可见影响:e.可见影响,默认走向:e.默认走向,已确认结果:e.结果,更新时间:e.更新时间},'因果关联与事件详情')+'</article>';
            const taskCard=(name,t)=>{
                const script=entries(state.剧本).find(([,r])=>(r.关联任务||[]).includes(name));
                const r=script?script[1]:{},stages=r.阶段||[],done=stages.filter(x=>['已完成','完成','可结算'].includes(x.状态)).length;
                const completed=['可结算','已达成'].includes(t.状态),pct=stages.length?Math.round(done/stages.length*100):completed?100:null;
                return '<article class="we-card"><div class="we-card-top"><h3>'+text(name)+'</h3>'+pill(t.状态||r.状态||'进行中',completed?'':'future')+'</div><p>'+text(t.目标||t.说明||r.描述||'等待目标记录')+'</p>'+(pct!==null?'<div class="we-progress"><i style="width:'+pct+'%"></i></div>':'')+'<div class="we-meta"><span>'+text(stages.length?done+'/'+stages.length+' 阶段完成':completed?'完成条件已满足':'进度依据实际剧情确认')+'</span>'+(r.期限?'<span>期限 '+text(r.期限)+'</span>':'')+'</div>'+details('task-'+name,{来源:t.委托方||r.来源,难度:t.难度,阶段:stages,完成条件:r.完成条件,失败条件:r.失败条件,阻碍:r.阻碍,下一节点:r.下一节点,关联事件:r.关联事件,奖励:t.奖励,惩罚:t.惩罚,交付:t.交付},'任务阶段与条件')+'</article>';
            };
            const matched=(name,obj)=>!this.query||(name+' '+Object.values(obj).filter(v=>typeof v==='string').join(' ')).toLowerCase().includes(this.query.toLowerCase());
            const tools=(filters=[])=>'<div class="we-tools"><input data-search aria-label="搜索档案" placeholder="搜索名称、地点或内容…" value="'+text(this.query||'')+'">'+filters.map(f=>'<button data-filter="'+f+'" class="'+((this.filter||'全部')===f?'active':'')+'">'+f+'</button>').join('')+'</div>';
            const calendar=()=>{
                const today=parseDate(w.时间);
                if(!today)return '<div class="we-calendar"><h3>世界日期待初始化</h3><p class="we-muted">'+text(w.时间||'尚无副本时间')+'</p></div>';
                const month=new Date(0);month.setFullYear(today.y,today.m-1+(this.monthOffset||0),1);month.setHours(0,0,0,0);
                const y=month.getFullYear(),m=month.getMonth()+1,first=(month.getDay()+6)%7;
                const last=new Date(month);last.setMonth(last.getMonth()+1,0);const count=last.getDate();
                const marked=new Set(events.map(([,e])=>parseDate(e.时间||e.开始时间)?.key).filter(Boolean));
                let cells=['一','二','三','四','五','六','日'].map(x=>'<span>'+x+'</span>').join('')+'<span></span>'.repeat(first);
                for(let d=1;d<=count;d++){const key=y+'-'+m+'-'+d;cells+='<button data-action="date" data-date="'+key+'" aria-label="'+key+'" class="'+(today.key===key?'today ':'')+(marked.has(key)?'has-event ':'')+(this.selectedDate===key?'selected':'')+'">'+d+'</button>';}
                return '<div class="we-calendar"><div class="we-calhead"><button class="we-btn" data-action="month" data-step="-1" aria-label="上月">‹</button><strong>'+y+' 年 '+m+' 月</strong><button class="we-btn" data-action="month" data-step="1" aria-label="下月">›</button></div><div class="we-days">'+cells+'</div><div class="we-meta"><span>金框 · 当前日期</span><span>绿点 · 已排定事件</span></div></div>';
            };
            const hero='<div class="we-hero"><div><div class="we-eyebrow">SAMSARA / WORLD ARCHIVE</div><h1>'+text(w.名称&&w.名称!=='待初始化'?w.名称:'世界尚未建立')+'</h1><div class="we-muted">'+text(w.地点||'地点待确认')+' · '+text(orbit.当前阶段&&orbit.当前阶段!=='待初始化'?orbit.当前阶段:'等待篇章开启')+'</div></div><div class="we-date">'+text(w.时间||'副本日期待确认')+'<small>累计游玩 '+text((s.系统状态||{}).游玩天数||0)+' 天 · '+(reason?'推进暂停':'副本进行中')+'</small></div></div>';
            let html=hero+(reason?'<div class="we-notice">'+text(reason)+'</div>':'');
            if(this.tab==='世界推进'){
                html+='<div class="we-metrics">'+[[active.length,'活跃事件'],[people.size,'人物档案'],[tasks.filter(([,t])=>t.状态==='进行中'||t.状态==='可交付').length,'进行中任务'],[future.length,'未来节点']].map(([n,l])=>'<div class="we-metric"><strong>'+n+'</strong><small>'+l+'</small></div>').join('')+'</div>';
                const shown=events.filter(([n,e])=>matched(n,e)&&((this.filter||'全部')==='全部'||e.状态===this.filter)&&(!this.selectedDate||parseDate(e.时间||e.开始时间)?.key===this.selectedDate));
                const changes=(state.最近变化||[]).slice(-7).reverse();
                const changeHtml=changes.map(c=>'<div class="we-change"><time>'+text(dateLabel(c.时间))+'</time><div><b>'+text(c.名称||c.类别)+' · '+text(c.操作)+'</b><p>'+text(c.内容||c.字段)+'</p></div></div>').join('');
                html+='<div class="we-columns"><div>'+section('世界动向',state.公开摘要?'<div class="we-notice">'+text(state.公开摘要)+'</div>':empty('世界还没有新的消息','可先查看已有任务与人物，推进后生成世界动向。'),'正文可见')+section('事件时间线',tools(['全部','进行中','待发生','已完成','已取消'])+(this.selectedDate?'<p class="we-muted">筛选日期：'+text(this.selectedDate)+' <button class="we-btn" data-action="clear-date">显示全部</button></p>':'')+(shown.length?'<div class="we-timeline">'+shown.map(([n,e])=>eventCard(n,e)).join('')+'</div>':empty('没有符合条件的事件','日期点选与状态筛选只影响展示，不改变世界时间。')),events.length+' 个节点')+section('任务进展',tasks.length?tasks.slice(0,5).map(([n,t])=>taskCard(n,t)).join(''):empty('当前没有任务','主神任务沿用原来的创建与结算流程。'))+'</div><aside>'+calendar()+section('人物动态',people.size?Array.from(people).slice(0,6).map(([n,p])=>person(n,p)).join(''):empty('暂无人物动态'),people.size+' 人')+section('近期变化',changeHtml||empty('尚未产生变化记录','每次成功推演后自动记录变化对象与日期。'))+section('因果轨道',fields({当前阶段:orbit.当前阶段,故事线:orbit.故事线,下一节点:orbit.下一节点,稳定度:w.稳定})+details('world-laws',{世界法则:w.法则,货币:w.货币,偏移记录:orbit.偏移记录},'世界法则与因果偏移'))+'</aside></div>';
            }else if(this.tab==='角色管理'){
                const list=Array.from(people).filter(([n,p])=>matched(n,p)&&((this.filter||'全部')==='全部'||(this.filter==='在场'?!!(s.关系列表||{})[n]?.在场:!(s.关系列表||{})[n]?.在场)));
                html+=tools(['全部','在场','场外'])+'<div class="we-grid">'+list.map(([n,p])=>person(n,p,true)).join('')+'</div>'+(list.length?'':empty('没有符合条件的人物'));
                html+=section('异端档案',entries((w.异端雷达||{}).名单).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态||'状态未明','future')+'</div>'+fields(r)+'</article>').join('')||empty('当前没有异端记录'));
            }else if(this.tab==='势力与地区'){
                html+=tools();
                html+=section('势力与地区动态','<div class="we-grid">'+entries(state.势力地区).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.类型,'dim')+'</div><p>'+text(r.进展||r.公开动态||r.描述)+'</p>'+fields({控制方:r.控制方,目标:r.目标,下次检查:r.下次检查})+details('area-'+n,{争夺方:r.争夺方,资源:r.资源,内部派系:r.内部派系,近期变化:r.近期变化,环境状态:r.环境状态,关联事件:r.关联事件,更新时间:r.更新时间},'资源 · 派系 · 地区变化')+'</article>').join('')+'</div>');
                html+='<div class="we-columns"><div>'+section('势力声望',entries(w.势力).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill('声望 '+r.声望)+'</div><p>'+text(r.描述)+'</p>'+fields({实力:r.实力,领地:r.领地})+'</article>').join('')||empty('尚未接触势力'))+'</div><div>'+section('探索地点',entries(w.探索).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill('风险 '+r.风险,'future')+'</div><p>'+text(r.描述)+'</p><div class="we-progress"><i style="width:'+Math.max(0,Math.min(100,Number(r.探索度)||0))+'%"></i></div><div class="we-muted">探索度 '+text(r.探索度)+'%</div>'+details('explore-'+n,{隐藏真相:r.隐藏真相},'主持人档案')+'</article>').join('')||empty('尚未发现探索地点'))+'</div></div>';
            }else if(this.tab==='任务与剧本'){
                html+=tools(['全部','进行中','可交付','可结算','失败'])+section('当前任务','<div class="we-grid">'+tasks.filter(([n,t])=>matched(n,t)&&((this.filter||'全部')==='全部'||t.状态===this.filter)).map(([n,t])=>taskCard(n,t)).join('')+'</div>');
                html+=section('剧本与阶段',entries(state.剧本).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.描述)+'</p>'+fields({状态:r.状态,期限:r.期限,下一节点:r.下一节点,关联任务:r.关联任务})+details('script-'+n,{阶段:r.阶段,前置条件:r.前置条件,完成条件:r.完成条件,失败条件:r.失败条件,阻碍:r.阻碍,参与者:r.参与者,地点:r.地点,结果:r.结果,关联事件:r.关联事件},'阶段路线与条件')+'</article>').join('')||empty('剧本节点尚未建立'));
                html+=section('副本成就','<div class="we-grid">'+achievements.filter(([n,t])=>matched(n,t)).map(([n,t])=>taskCard(n,t)).join('')+'</div>',achievements.filter(([,t])=>t.状态==='已达成').length+'/'+achievements.length+' 已达成');
            }else if(this.tab==='传闻'){
                html+=tools();
                for(const category of ['街头巷议','情报交易','布告与檄文'])html+=section(category,entries((s.传闻||{})[category]).filter(([n,r])=>matched(n,r)).map(([n,r])=>'<article class="we-card"><h3>'+text(n)+'</h3><p>'+text(r.内容||r.摘要)+'</p>'+fields({来源:r.来源||r.卖家||r.发布者,可信度:r.可信度,要价:r.要价,位置:r.张贴位置})+details('rumor-'+n,{真实内幕:r.真实内幕},'主持人档案')+'</article>').join('')||empty('暂无'+category,'传闻来自已发生事件与传播渠道。'));
                html+=section('传播链',entries(state.传播).map(([n,r])=>'<article class="we-card"><div class="we-card-top"><h3>'+text(n)+'</h3>'+pill(r.状态,'dim')+'</div><p>'+text(r.内容)+'</p>'+fields({时间:r.时间,来源:r.来源,范围:r.范围,受众:r.受众,到期时间:r.到期时间})+details('spread-'+n,{关联事件:r.关联事件,引发行动:r.引发行动,真相:r.真相},'因果与传播详情')+'</article>').join('')||empty('尚无传播链'));
            }else if(this.tab==='运行记录'){
                html+='<div class="we-tools"><button data-action="cancel">停止当前请求</button></div>'+section('推演记录',(state.运行记录||[]).slice().reverse().map(r=>'<article class="we-card"><div class="we-card-top"><h3>'+text(r.时间)+'</h3>'+pill(r.补丁数+' 项变化','dim')+'</div><p>'+text(r.摘要)+'</p></article>').join('')||empty('尚未执行推演'));
                html+=section('历史锚点',entries(state.历史).reverse().map(([n,r])=>'<article class="we-card"><div class="we-meta">'+text(r.时间)+'</div><h3>'+text(n)+'</h3><p>'+text(r.事实)+'</p>'+fields({关联事件:r.关联事件})+'</article>').join('')||empty('尚无已确认的历史锚点'));
            }else if(this.tab==='提示词预设'){
                html+='<div class="we-notice">调整世界如何演进、人物如何行动。连接与模型沿用主神终端设置。</div><textarea aria-label="世界推进提示词">'+text(this.config.preset)+'</textarea><div class="we-tools"><button class="we-btn we-primary" data-action="save">保存预设</button></div>';
            }
            main.innerHTML=html;main.scrollTop=force?0:scroll;
        }
        dispose() {
            this.close(); this.disposed = true; this.cancel(); clearTimeout(this.initTimer);
            this.unsub.forEach(off => off()); this.unsub = [];
            if (this.keyHandler) this.host.document.removeEventListener('keydown',this.keyHandler,true);
            if (this.panel) this.panel.remove(); if (this.style) this.style.remove();
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
