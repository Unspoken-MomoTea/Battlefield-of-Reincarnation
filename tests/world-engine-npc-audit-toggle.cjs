const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {SamsaraWorldEngine:Engine,emptyState,RECORDS}=require('../script/世界推进系统.js');
const clone=value=>JSON.parse(JSON.stringify(value));

function freshState(){
  const backend=emptyState();
  backend.事件['天台入口攻防']={
    ...clone(RECORDS.事件),
    分类:'当前事件',描述:'死体群正在冲击天台入口。',时间:'2010年-04月-13日-上午',条件:'',前因:[],状态:'进行中',
    默认走向:'',结果:'',公开征兆:'铁门持续变形。',地点:'藤美学园-主教学楼-天台',参与者:['玛雅'],更新时间:'2010年-04月-13日-上午'
  };
  backend.人物.玛雅={
    ...clone(RECORDS.人物),所属世界:'学园默示录',地点:'藤美学园-主教学楼-天台',目标:'保护同行者',行动:'守住天台入口',
    更新时间:'2010年-04月-13日-上午',关联事件:['天台入口攻防']
  };
  return {
    世界:{
      名称:'学园默示录',时间:'2010年-04月-13日-上午',地点:'藤美学园-主教学楼-天台',稳定:100,后台:backend,
      因果轨道:{当前阶段:'爆发初期',故事线:'',下一节点:'',偏移记录:{}},异端雷达:{名单:{}},势力:{},探索:{},法则:[],货币:{},历法:{}
    },
    设置:{单一世界:true},系统状态:{是否在主神空间:false},资产:{},
    传闻:{
      街头巷议:{基线巷议:{来源:'学生',内容:'校内秩序正在恶化。',可信度:'可疑'}},
      情报交易:{基线情报:{卖家:'学生',情报评级:'F',摘要:'有人出售校内通道消息。',要价:'100日元',真实内幕:'路线尚未完全确认。'}},
      布告与檄文:{基线公告:{发布者:'校方',内容:'请学生留在安全区域。',张贴位置:'主教学楼'}}
    },
    关系列表:{
      玛雅:{
        在场:true,种族:'森精灵',身份:['从者'],职业:{},层级:'Ⅰ',HP_MAX:10,HP:10,THP:0,EP_MAX:10,EP:10,
        状态:{},血统:{},装备:{},技能:{},形态库:{},当前形态:{激活:false,名称:''},性格:'冷静',喜爱:'森林',外貌:'银发少女',
        着装:'轻便旅行装',是否队友:true,好感度:20,态度:'信任',背景故事:'来自异世界的森精灵。'
      }
    }
  };
}

function setup({reply='',validate,storedConfig}={}){
  let state=freshState(),stored=storedConfig?JSON.stringify(storedConfig):null;
  const message={message_id:1,role:'assistant',message:'天台入口的铁门在撞击中持续变形。'};
  const host={
    localStorage:{
      getItem:key=>key==='samsara_world_engine_v1'?stored:null,
      setItem:(key,value)=>{if(key==='samsara_world_engine_v1')stored=String(value);}
    },
    getCurrentChatId:()=> 'npc-audit-toggle-test',
    getChatMessages:()=>[message],
    Mvu:{
      getMvuData:()=>({stat_data:clone(state)}),
      replaceMvuData:async raw=>{state=clone(raw.stat_data);}
    },
    Samsara:{
      terminal:{apiReady:()=>true,request:async()=>reply},
      validateWorldState:validate||((stat)=>clone(stat))
    },
    document:{addEventListener:()=>{},removeEventListener:()=>{}},
    toastr:{error:()=>{}}
  };
  const engine=new Engine(host);
  engine.worldbook=async()=>[];
  engine.config.contextTurns=1;
  engine.config.requireMacroBackbone=false;
  engine.config.retryAttempts=1;
  return {
    engine,host,getState:()=>clone(state),getStored:()=>stored,
    change:mutator=>{const next=clone(state);mutator(next);state=next;}
  };
}

(async()=>{
  {
    const x=setup();
    assert.equal(x.engine.config.npcBuildAuditEnabled,false,'NPC构筑审计必须默认关闭');
    const off=await x.engine.buildRequest(x.engine.snapshot()),offPayload=JSON.parse(off.input);
    assert.equal(Object.hasOwn(offPayload,'角色管理'),false,'关闭时不得把NPC构筑审计注入请求');
    assert.doesNotMatch(off.system,/【角色管理 · NPC构筑审计】/,'关闭时不得注入NPC构筑审计系统规则');

    assert.equal(x.engine.setNpcBuildAuditEnabled(true),true);
    const on=await x.engine.buildRequest(x.engine.snapshot()),onPayload=JSON.parse(on.input);
    assert.equal(onPayload.角色管理.NPC构筑审计[0].名称,'玛雅','开启后热NPC才进入构筑审计');
    assert.equal(onPayload.角色管理.NPC构筑审计[0].审计级别,'杂兵级','Ⅰ阶不应因层级之外的推断自动升级份量');
    assert.ok(onPayload.角色管理.NPC构筑审计[0].缺口.some(x=>/装备不足 0\/2/.test(x)),'杂兵装备最低应为2');
    assert.ok(onPayload.角色管理.NPC构筑审计[0].缺口.some(x=>/技能不足 0\/1/.test(x)),'杂兵技能最低应为1');
    assert.match(on.system,/【角色管理 · NPC构筑审计】/);
    assert.match(on.system,/杂兵=血统1\/装备2\/技能1/);
    assert.match(on.system,/与人物层级独立/);
    assert.equal(JSON.parse(x.getStored()).npcBuildAuditEnabled,true,'开关必须持久化到世界推进配置');

    x.engine.config.npcAuditPrompt='自定义审计规则标记';
    const custom=await x.engine.buildRequest(x.engine.snapshot());
    assert.match(custom.system,/自定义审计规则标记/);
    assert.doesNotMatch(custom.system,/【角色管理 · NPC构筑审计】/);
    assert.equal(x.engine.setNpcBuildAuditEnabled(false),false);
    const disabledCustom=await x.engine.buildRequest(x.engine.snapshot());
    assert.doesNotMatch(disabledCustom.system,/自定义审计规则标记/);
    assert.equal(JSON.parse(x.getStored()).npcBuildAuditEnabled,false);
  }

  {
    const x=setup();
    x.change(s=>{
      const base={
        在场:true,种族:'人类',职业:{守卫:{类型:'战斗',特性:['近战'],来源:'测试'}},HP_MAX:100,HP:100,THP:0,EP_MAX:50,EP:50,
        状态:{},血统:{},装备:{},技能:{},形态库:{},当前形态:{激活:false,名称:''},性格:'谨慎',喜爱:'秩序',外貌:'普通',着装:'制服',
        是否队友:false,好感度:-10,态度:'警戒',背景故事:'负责当前区域警戒。'
      };
      s.关系列表.高阶普通守卫={...clone(base),身份:['普通守卫'],层级:'Ⅷ'};
      s.关系列表.低阶隐藏首领={...clone(base),身份:['隐藏Boss'],层级:'Ⅰ',背景故事:'表面普通，实际是本次遭遇的隐藏Boss。'};
    });
    x.engine.setNpcBuildAuditEnabled(true);
    const request=await x.engine.buildRequest(x.engine.snapshot()),audit=JSON.parse(request.input).角色管理.NPC构筑审计;
    const high=audit.find(item=>item.名称==='高阶普通守卫');
    const boss=audit.find(item=>item.名称==='低阶隐藏首领');
    assert.equal(high?.审计级别,'杂兵级','高层级不得自动升级为精英或Boss');
    assert.ok(high?.缺口.some(x=>/装备不足 0\/2/.test(x)));
    assert.ok(high?.缺口.some(x=>/技能不足 0\/1/.test(x)));
    assert.equal(boss?.审计级别,'首领/Boss级','低层级角色应能按剧情身份成为Boss');
    assert.ok(boss?.缺口.some(x=>/装备不足 0\/6/.test(x)));
    assert.ok(boss?.缺口.some(x=>/技能不足 0\/4/.test(x)));
  }

  {
    const reply=JSON.stringify({
      摘要:'补全玛雅的既有森精灵血统构筑。',
      关系:[{
        名称:'玛雅',操作:'更新',
        血统:{
          森精灵血统:{
            品质:'F',标签:['精灵'],原始属性:{力量:'F',敏捷:'E',体质:'F',精神:'F',魅力:'E'},
            效果:{自然感应:'对附近敌意目标获得基础感知加成'},描述:'森精灵的基础血统。'
          }
        }
      }]
    });
    const x=setup({
      reply,
      validate:stat=>{
        const checked=clone(stat),bloodline=checked.关系列表?.玛雅?.血统?.森精灵血统;
        if(bloodline)bloodline.真属性={...(bloodline.真属性||{}),__tier:'F'};
        return checked;
      }
    });
    x.engine.config.enabled=true;
    x.engine.setNpcBuildAuditEnabled(true);
    assert.equal(await x.engine.run(),true,'ZOD只补派生缓存时不应把合法关系更新判成Schema错误');
    assert.equal(x.getState().关系列表.玛雅.血统.森精灵血统.真属性.__tier,'F','校验器生成的派生缓存应进入最终写入状态');
    assert.equal(x.engine.lastRetryLog.length,0,'派生缓存差异不应触发无意义纠错重试');
  }

  {
    const reply=JSON.stringify({
      摘要:'玛雅更加信任同行者。',
      关系:[{名称:'玛雅',操作:'更新',态度:'更加信任'}]
    });
    const x=setup({reply});
    x.engine.config.enabled=true;
    x.engine.setNpcBuildAuditEnabled(true);
    let failure='';
    try{await x.engine.run();}catch(error){failure=String(error.message||error);}
    assert.match(failure,/NPC构筑审计未推进/,'未补构筑时仍应明确驳回');
    assert.match(failure,/玛雅：/,'错误必须按NPC列出具体审计结果');
    assert.match(failure,/资料缺失\/职业/,'错误必须指出缺的是职业而不是只报“审计未推进”');
    assert.match(failure,/血统不足 0\/1/,'错误必须指出血统数量缺口');
    assert.match(failure,/装备不足 0\/2/,'错误必须指出装备数量缺口');
    assert.match(failure,/技能不足 0\/1/,'错误必须指出技能数量缺口');
  }

  {
    const source=fs.readFileSync(path.join(__dirname,'../script/世界推进系统.js'),'utf8');
    assert.match(source,/compactFooterChrome\(/,'世界推进面板应有独立 footer 收口逻辑');
    assert.match(source,/\.we-footer-status\{[^}]*min-width:0[^}]*text-overflow:ellipsis/s,'左侧运行状态必须可收缩并省略，不能挤压右侧');
    assert.match(source,/\.we-footer-meta\{[^}]*flex:0 0 auto[^}]*white-space:nowrap/s,'右侧版本信息必须保持紧凑单行，不得竖向堆字');
    assert.match(source,/title=rawMeta|\.title=rawMeta/,'被收起的 footer 详细说明仍应通过 title 保留');
  }

  {
    const reply=JSON.stringify({
      摘要:'建立后续宏观节点。',
      事件:[{
        名称:'床主市大逃杀',操作:'更新',描述:'幸存者进入市区后，各方势力围绕资源与安全区全面冲突。',
        时间:'2010年-04月-14日-上午',条件:'幸存者离开藤美学园并进入床主市',前因:['爆发初期'],状态:'待发生',
        默认走向:'城市秩序进一步崩溃。',结果:'',公开征兆:'',地点:'床主市',分类:'宏观节点'
      }]
    });
    const x=setup({reply});
    x.engine.config.enabled=true;
    let failure='';
    try{await x.engine.run();}catch(error){failure=String(error.message||error);}
    assert.match(failure,/事件前因不存在：床主市大逃杀 <- 爆发初期/,'前因错误必须直接指出哪一个引用不存在');
    const correction=(x.engine.lastRetryLog[0]?.补充清单||[]).join('\n');
    assert.match(correction,/前因数组只放事件名称/,'纠错提示必须告诉模型如何修复前因');
    assert.match(correction,/当前阶段|自然语言原因/,'纠错提示必须明确当前阶段不是事件前因');
  }

  console.log('world-engine NPC audit toggle, narrative weight, feedback and footer UI regression tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
