const assert = require('node:assert/strict');
const {SamsaraWorldEngine: Engine, emptyState, extractWorldProse} = require('../script/世界推进系统.js');
const clone = x => JSON.parse(JSON.stringify(x));
const fresh = () => ({世界:{名称:'测试世界',时间:'2026年9月7日清晨',地点:'测试地点',后台:emptyState(),势力:{},探索:{},因果轨道:{偏移记录:{}}},系统状态:{是否在主神空间:false},设置:{},任务:{列表:{},副本成就:{}},关系列表:{},传闻:{}});
let tests = 0;
async function test(name, fn) { await fn(); tests++; console.log('PASS '+name); }
(async () => {
    function setup(request, validateWorldState=clone) {
        let stat = fresh(), text = '玩家调查了城门。', chat = 'chat-1', toasts = [];
        const host = {localStorage:{getItem:()=>null,setItem:()=>{}},toastr:{error:(message,title)=>toasts.push({message:String(message),title:String(title||'')})},Samsara:{validateWorldState,terminal:{apiReady:()=>true,request}},getCurrentChatId:()=>chat,getChatMessages:()=>[{message_id:3,message:text,role:'assistant'}]};
        let writes = 0;
        host.Mvu = {getMvuData:()=>({stat_data:clone(stat)}),replaceMvuData:async data => {writes++; stat = clone(data.stat_data);}};
        const engine = new Engine(host); engine.config.enabled = true; engine.config.requireMacroBackbone = false; engine.config.retryAttempts = 0; engine.worldbook = async () => [];
        return {engine,host,get:()=>stat,writes:()=>writes,toasts:()=>clone(toasts),change:fn=>fn(stat),chat:()=>{chat='chat-2';},text:v=>{text=v;}};
    }
    await test('prose extraction removes reasoning, updates and interleaved panels without removing narration', () => {
        const raw='<THINK mode="long">秘密计划<analysis>内层思考</analysis>仍是思考</THINK>\n<dm_think>幕后安排</dm_think>\n城门关闭。\n<CombatResult>伤害计算</CombatResult>\n卫兵撤退。\n<CraftResult>制作计算</CraftResult><CheckResult>掷骰</CheckResult>\n<UpdateVariable><Analysis>更新分析</Analysis><JSONPatch>[{"op":"replace","path":"/秘密","value":1}]</JSONPatch></UpdateVariable>\n<options>尚未选择的行动</options><StatusPlaceHolder/>';
        assert.equal(extractWorldProse(raw),'城门关闭。\n\n卫兵撤退。');
        assert.equal(extractWorldProse('她称呼你为<user>，说：“别走。”'),'她称呼你为<user>，说：“别走。”');
    });
    await test('whole-floor mode keeps narration outside any body wrapper', () => {
        assert.equal(extractWorldProse('钟声响起。<正文>城门关闭。</正文>人群散去。<now_plot>卫兵撤退。</now_plot>街道安静下来。'),'钟声响起。城门关闭。人群散去。卫兵撤退。街道安静下来。');
        assert.equal(extractWorldProse('<maintext>他站起身。<dm_think>计划</dm_think>她推开门。</maintext>两人离开。'),'他站起身。\n她推开门。两人离开。');
        assert.equal(extractWorldProse('<scene_time>时间栏</scene_time><DiceCombat>面板</DiceCombat><update>更新</update><action>选项</action><ash-review id="1">审核</ash-review><p>风声停了。</p>'),'风声停了。');
    });
    await test('technical-only and truncated messages never fall back to raw content', () => {
        assert.equal(extractWorldProse('<thinking>未结束的思考'),'');
        assert.equal(extractWorldProse('钟声响起。<UpdateVariable><JSONPatch>未闭合的更新'),'钟声响起。');
        assert.equal(extractWorldProse('<!--备注--><details><summary>变量更新中</summary>技术日志</details>\n```json\n[{"op":"replace"}]\n```'),'');
        assert.equal(extractWorldProse('[{"op":"replace","path":"/任务","value":1}]'),'');
        assert.equal(extractWorldProse('```\n普通叙事。\n```'),'普通叙事。');
    });
    await test('request and keyword activation use cleaned prose and skip technical-only floors', async () => {
        const x=setup(async()=>''),e=x.engine;
        e.config.contextTurns=2;
        x.host.getChatMessages=()=>[
            {message_id:0,role:'assistant',message:'旧正文。'},
            {message_id:1,role:'assistant',message:'<think>海港隐藏计划</think><dm_think>海港后台推演</dm_think>城门已经关闭。<UpdateVariable><Analysis>海港更新</Analysis></UpdateVariable>'},
            {message_id:2,role:'user',message:'我要去海港。'},
            {message_id:3,role:'assistant',message:'<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'}
        ];
        e.worldbook=Engine.prototype.worldbook;
        e.config.selectedEntries=['1','2'].map(id=>JSON.stringify(['设定',id]));
        e.host.getCharWorldbookNames=()=>({primary:'设定'});
        e.host.getWorldbook=()=>[
            {uid:1,name:'城门设定',content:'已封闭',strategy:{type:'selective',keys:['城门']}},
            {uid:2,name:'海港设定',content:'不该触发',strategy:{type:'selective',keys:['海港']}}
        ];
        const snapshot=e.snapshot();snapshot.message={message_id:3,role:'assistant'};
        const r=await e.buildRequest(snapshot),p=JSON.parse(r.input);
        assert.deepEqual(p.正文楼层.map(f=>f.正文),['旧正文。','城门已经关闭。']);
        assert.deepEqual(p.世界书.map(b=>b.名称),['城门设定']);
        assert.doesNotMatch(r.input,/海港|JSONPatch|隐藏计划|后台推演/);
        assert.deepEqual(r.manifest.正文楼层.map(f=>f.字符数),[4,7]);
        x.host.getChatMessages=()=>[{message_id:3,role:'assistant',message:'<thinking>未闭合思考'}];
        await assert.rejects(()=>e.buildRequest(e.snapshot()),/未读到可用AI正文/);
    });
    await test('nonempty prose quota scans past many technical and hidden floors in chronological order', async () => {
        const {engine:e,host}=setup(async()=>''),ranges=[];
        e.config.contextTurns=3;
        const records=Array.from({length:41},(_,id)=>({message_id:id,role:'assistant',message:'<update>更新</update>'}));
        records[1].message='最旧正文。';records[4].message='中间正文。';records[35].message='最新正文。';
        records[39]={message_id:39,role:'assistant',is_hidden:true,message:'隐藏消息'};
        records[40]={message_id:40,role:'user',message:'用户意图'};
        host.getChatMessages=range=>{ranges.push(range);const [lo,hi]=range.split('-').map(Number);return records.filter(m=>m.message_id>=lo&&m.message_id<=hi).reverse();};
        const result=await e.buildRequest({stat:fresh(),message:{message_id:40}});
        assert.deepEqual(ranges,['0-40']);
        assert.deepEqual(JSON.parse(result.input).正文楼层.map(f=>f.楼层),[1,4,35]);
        e.config.contextTurns=10;
        assert.equal(JSON.parse((await e.buildRequest({stat:fresh(),message:{message_id:40}})).input).正文楼层.length,3);
    });
    console.log('Passed '+tests+' prose tests.');
})().catch(error=>{console.error(error);process.exitCode=1;});
