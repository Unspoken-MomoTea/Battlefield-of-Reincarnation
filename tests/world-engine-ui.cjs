const {chromium}=require('C:/Users/MLT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
const {emptyState,RECORDS}=require('../script/世界推进系统.js');
const b=emptyState();
b.公开摘要='北境的补给线已经中断。晨雾中的灰港依旧平静，但巡逻队开始检查离城的商队。粮价上涨的消息，正在酒馆与码头间流传。';
b.事件={
 '灰港封锁':{...RECORDS.事件,分类:'当前事件',描述:'守备队封锁北门，调查失踪的补给车队。',时间:'2026年9月7日清晨',地点:'灰港 · 北门',状态:'进行中',前因:[],公开征兆:'巡逻队增派人手，通行审查趋于严格。',参与者:['守备官艾琳','灰港卫队'],关联任务:['追查失踪车队'],条件:'补给中断后调查启动',预计结束:'2026年9月8日傍晚'},
 '商会紧急议事':{...RECORDS.事件,分类:'近期节点',描述:'商会将商议备用粮路，决定是否雇佣护卫。',时间:'2026年9月8日下午',地点:'旧城 · 商会大厅',状态:'待发生',前因:['灰港封锁'],公开征兆:'商会向各家粮商发出紧急邀请。',参与者:['商人莱昂'],默认走向:'若商路仍不通，发布护送委托。'},
 '北境援军抵达':{...RECORDS.事件,分类:'宏观节点',描述:'北境援军沿旧驿道南下，可能改变地区格局。',时间:'2026年9月12日清晨',地点:'灰港外城',状态:'待发生',前因:['灰港封锁'],公开征兆:'北方驿站传来军队集结的消息。',条件:'旧驿道保持畅通'}
};
b.人物={
 '测试玩家':{...RECORDS.人物,所属世界:'灰港纪事',地点:'银鸥酒馆',目标:'',行动:'玩家当前行动不应出现在后台人物名册',状态:'在场'},
 '守备官艾琳':{...RECORDS.人物,所属世界:'灰港纪事',地点:'北门哨所',目标:'查明补给线失踪原因',行动:'正在审问最后一名返回的车夫。',状态:'场外',下次检查:'2026年9月7日午后',关联事件:['灰港封锁'],认知:['补给队未按期抵达'],开始时间:'2026年9月7日清晨',预计结束:'2026年9月7日午后',行程:[{开始:'2026年9月7日午后',结束:'2026年9月7日傍晚',地点:'北境旧驿道',行动:'派遣斥候调查',状态:'计划中',结果:''}],承诺:[{对象:'灰港议会',内容:'日落前提交第一份报告',期限:'2026年9月7日傍晚',解除条件:'调查确认无法继续'}],认知来源:[{事实:'补给队未抵达',来源:'北门登记簿',获知时间:'2026年9月7日清晨',状态:'已确认'}]},
 '商人莱昂':{...RECORDS.人物,所属世界:'灰港纪事',地点:'银鸥酒馆',目标:'寻找安全的新商路',行动:'向旅人打听南侧河道的通航情况。',关联事件:['商会紧急议事'],状态:'在场',认知:[],下次检查:'2026年9月8日下午'}
};
b.势力地区={'灰港商会':{...RECORDS.势力地区,类型:'势力',描述:'控制灰港大部分粮食贸易。',目标:'恢复粮食供应',进展:'正在寻找替代运输线路。',关联事件:['商会紧急议事'],资源:[{名称:'储粮',数量:'可维持七日',用途:'稳定城内供应',限制:'无法支援远方驻军'}],内部派系:[{名称:'河运派',立场:'开辟南侧河道',行动:'募集船只',影响:'与旧商路派存在分歧'}]},'北门地区':{...RECORDS.势力地区,类型:'地区',描述:'通往北境的唯一陆路出口。',目标:'维持秩序',进展:'旅客队伍拥堵，商队滞留。',控制方:'灰港卫队',关联事件:['灰港封锁'],近期变化:[{时间:'2026年9月7日清晨',事实:'临时检查站启用',关联事件:'灰港封锁'}]}};
b.剧本={'补给危机':{...RECORDS.剧本,描述:'一条中断的商路，让灰港的旧秩序开始松动。',关联任务:['追查失踪车队'],关联事件:['灰港封锁'],状态:'进行中',期限:'2026年9月10日傍晚',下一节点:'找到被遗弃的货车',完成条件:'确认补给队下落',失败条件:'粮食储备耗尽',阶段:[{名称:'询问车夫',状态:'已完成',时间:'2026年9月7日清晨',说明:'获知车队在旧桥附近失去联系',前置阶段:''},{名称:'调查旧桥',状态:'进行中',时间:'2026年9月7日下午',说明:'寻找车轮与战斗痕迹',前置阶段:'询问车夫'},{名称:'找到失踪车队',状态:'待发生',时间:'',说明:'尚待调查结果',前置阶段:'调查旧桥'}]}};
b.最近变化=[{时间:'2026年9月7日清晨',类别:'事件',名称:'灰港封锁',操作:'新增',字段:'状态',内容:'北门进入临时管制。'},{时间:'2026年9月7日清晨',类别:'人物',名称:'守备官艾琳',操作:'更新',字段:'行动',内容:'开始审问返回的车夫。'},{时间:'2026年9月7日清晨',类别:'任务',名称:'追查失踪车队',操作:'更新',字段:'阶段',内容:'已完成询问，下一步前往旧桥。'}];
b.运行记录=[{时间:'2026年9月7日清晨',摘要:'确认补给中断，建立调查与商会议事的因果联系。',补丁数:8}];
const stat={世界:{名称:'灰港纪事',地点:'灰港 · 银鸥酒馆',时间:'2026年9月7日清晨',稳定:96,后台:b,因果轨道:{当前阶段:'第一幕 · 北境来信',故事线:'北境援军抵达 → 商路争夺 → 灰港改组',下一节点:'北境援军抵达',偏移记录:{}},法则:['低魔世界','契约具有约束力'],货币:{体系:'银冠',经济波动:'粮价小幅上涨'},势力:{灰港商会:{实力:'C',声望:320,领地:'灰港集市',描述:'希望尽快恢复北方商路。'}},探索:{废弃旧桥:{风险:'D',探索度:35,描述:'桥头留有车轮与拖拽痕迹。',隐藏真相:'桥下存在一条隐蔽通道。'}},异端雷达:{名单:{}}},系统状态:{游玩天数:23,是否在主神空间:false},设置:{},关系列表:{商人莱昂:{在场:true,好感度:25,态度:'愿意交换消息'},守备官艾琳:{在场:false,好感度:10}},任务:{列表:{追查失踪车队:{状态:'进行中',目标:'沿北境旧驿道寻找失踪的补给车队。',委托方:'灰港卫队',难度:'D',奖励:'200银冠'}},副本成就:{迷雾中的足迹:{状态:'未达成',说明:'在补给危机结束前找到旧桥的秘密。',难度:'D',奖励:'D级盲盒'}}},传闻:{街头巷议:{粮仓里的低语:{来源:'酒馆常客',内容:'听说北门外又停了两支商队，面包恐怕还要涨价。',可信度:'或许可信'}}}};
// 故意打乱写入顺序：UI 必须按“进行中 → 近期 → 宏观”而不是对象插入顺序显示。
b.事件={'北境援军抵达':b.事件['北境援军抵达'],'商会紧急议事':b.事件['商会紧急议事'],'灰港封锁':b.事件['灰港封锁']};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://world-engine.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body style="margin:0;background:#080e17"></body></html>'}));await page.goto('https://world-engine.test/');
 await page.evaluate(stat=>{window.SillyTavern={name1:'测试玩家'};window.getCurrentChatId=()=> 'preview';window.getChatMessages=()=>[{message_id:1,message:'车夫递来一封信。',role:'assistant'}];window.Mvu={events:{VARIABLE_UPDATE_ENDED:'updated'},getMvuData:()=>({stat_data:stat})};window.eventOn=()=>()=>{};window.Samsara={terminal:{suspend:()=>({open:true}),restore:()=>{window.restored=true;},apiReady:()=>false}};},stat);
 await page.addScriptTag({path:path.join(__dirname,'../script/世界推进系统.js')});await page.evaluate(()=>{Samsara.worldEngine.setEnabled(true);Samsara.worldEngine.open();});
 const out=path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
 await page.screenshot({path:path.join(out,'world-desktop.png')});
 assert.equal(await page.locator('#sam-world-engine pre').count(),0);
 assert.equal(await page.locator('[data-action="enabled"]').count(),0);
 assert.equal(await page.locator('[data-action="run"]').isDisabled(),true);
 assert.equal(await page.getByText(/额外模型未准备好/).count(),1);
 assert.equal(await page.getByRole('heading',{name:'任务进展',exact:true}).count(),1);
 assert.equal(await page.locator('.we-dashboard').count(),1,'世界推进采用独立仪表盘布局');
 assert.equal(await page.locator('.we-people-strip .we-person-compact').count()<=4,true,'人物动态保持紧凑摘要');
 assert.equal(await page.getByRole('heading',{name:'世界动向',exact:true}).count(),1,'世界推进只保留一处世界动向');
 const timelineNames=await page.locator('.we-timeline [data-event-card] h3').allTextContents();
 assert.deepEqual(timelineNames,['灰港封锁'],'首次打开只显示副本当天');
 assert.equal(await page.locator('[data-date="2026-9-7"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-action="clear-date"]').click();
 assert.deepEqual((await page.locator('.we-timeline [data-event-card] h3').allTextContents()).slice(0,3),['灰港封锁','商会紧急议事','北境援军抵达']);
 assert.equal(await page.locator('[data-event-card="灰港封锁"] .we-card-tags').getByText('当前事件',{exact:true}).count(),1);
 assert.equal(await page.locator('[data-event-card="商会紧急议事"] .we-card-tags').getByText('近期节点',{exact:true}).count(),1);
 assert.equal(await page.locator('[data-event-card="北境援军抵达"] .we-card-tags').getByText('宏观节点',{exact:true}).count(),1);
 assert.equal(await page.locator('.we-timeline-group-title').filter({hasText:'当前进行'}).count(),1);
 assert.equal(await page.locator('.we-timeline-group-title').filter({hasText:'近期桥接'}).count(),1);
 assert.equal(await page.locator('.we-timeline-group-title').filter({hasText:'宏观锚点'}).count(),1);
 assert.equal(await page.getByRole('heading',{name:'下一宏观节点',exact:true}).count(),1);
 assert.equal(await page.locator('[data-jump-event="北境援军抵达"]').count(),1,'下一关键节点应可点击');
 assert.equal(await page.locator('button[data-jump-event="北境援军抵达"]').count(),1,'下一关键节点必须是按钮');
 await page.locator('[data-jump-event="北境援军抵达"]').click();
 assert.equal(await page.locator('[data-search]').inputValue(),'','跳转不得遗留名称搜索');
 assert.equal(await page.locator('[data-date="2026-9-12"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-event-card="北境援军抵达"]').count(),1,'点击关键节点后应定位对应事件');
 await page.locator('[data-search]').fill('');
 assert.equal(await page.locator('[data-detail="world-calendar"] .we-calendar').isVisible(),true,'日历默认可见');
 await page.locator('[data-action="date"][data-date="2026-9-8"]').click();
 assert.equal(await page.locator('.we-timeline .we-card').count(),1);
 assert.equal(await page.locator('[data-event-card="商会紧急议事"]').count(),1,'宏观跳转后仍可查看近期事件');
 await page.locator('[data-action="date"][data-date="2026-9-8"]').click();
 assert.equal(await page.locator('.we-timeline [data-event-card]').count(),1,'重复点击日期不会取消筛选');
 await page.locator('[data-filter="进行中"]').click();
 assert.equal(await page.locator('[data-date="2026-9-8"]').evaluate(e=>e.classList.contains('has-event')),false,'绿点必须遵循状态筛选');
 assert.equal(await page.locator('.we-timeline [data-event-card]').count(),0);
 await page.locator('[data-filter="全部"]').click();
 await page.locator('[data-action="date"][data-date="2026-9-9"]').click();
 assert.equal(await page.locator('.we-timeline [data-event-card]').count(),0,'无事件日期显示空状态');
 await page.locator('[data-search]').fill('灰港封锁');
 assert.equal(await page.locator('[data-date="2026-9-12"]').evaluate(e=>e.classList.contains('has-event')),false,'绿点必须遵循名称搜索');
 await page.locator('[data-search]').fill('');
 await page.locator('[data-action="today"]').click();
 assert.equal(await page.locator('[data-date="2026-9-7"]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>{
   const events=Mvu.getMvuData().stat_data.世界.后台.事件;
   events['北境援军抵达'].时间='2026-10-12';
   events['同日撤离']={...events['商会紧急议事'],时间:'2026年10月12日下午'};
   events['旧版记录']={...events['商会紧急议事'],分类:'主线节点',时间:'2026年10月12日'};
   events['未定日计划']={...events['商会紧急议事'],时间:'撤离后三日'};
   events['非法日期']={...events['商会紧急议事'],时间:'2026-02-30'};
   Samsara.worldEngine.render();
 });
 await page.locator('[data-jump-event="北境援军抵达"]').click();
 assert.equal(await page.locator('[data-date="2026-10-12"]').getAttribute('aria-pressed'),'true','跨月跳转需同步月份和选中日期');
 assert.equal(await page.locator('[data-event-card="同日撤离"]').count(),1,'宏观跳转不隐藏同日近期事件');
 assert.equal(await page.locator('[data-event-card="旧版记录"]').count(),1,'旧分类不能产生有绿点无卡片');
 await page.locator('[data-action="undated"]').click();
 assert.equal(await page.locator('[data-event-card="未定日计划"]').count(),1);
 assert.equal(await page.locator('[data-event-card="非法日期"]').count(),1,'非法公历日期不虚构日期绿点');
 await page.locator('[data-action="today"]').click();
 await page.evaluate(()=>{
   const events=Mvu.getMvuData().stat_data.世界.后台.事件;
   for(let i=0;i<14;i++)events['同日事项'+i]={...events['商会紧急议事'],时间:'2026年9月7日'};
   Samsara.worldEngine.render();
 });
 assert.equal(await page.locator('.we-timeline [data-event-card]').count(),12);
 await page.locator('[data-action="more-events"]').click();
 assert.equal(await page.locator('.we-timeline [data-event-card]').count(),15,'日期事件超过12条时仍可访问全部');
 await page.evaluate(()=>{
   const events=Mvu.getMvuData().stat_data.世界.后台.事件;
   for(let i=0;i<14;i++)delete events['同日事项'+i];
   for(const name of ['同日撤离','旧版记录','未定日计划','非法日期'])delete events[name];
   events['北境援军抵达'].时间='2026年9月12日清晨';Samsara.worldEngine.render();
 });
 await page.locator('[data-action="clear-date"]').click();
 await page.locator('nav [data-tab="角色管理"]').click();await page.locator('summary').first().click();
 assert.equal(await page.getByRole('button',{name:'测试玩家',exact:true}).count(),0,'人物名册不能包含当前玩家');
 assert.equal(await page.getByRole('heading',{name:'异端档案',exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'承诺',exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'抉择',exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'交际圈',exact:true}).count(),0);
 assert.equal(await page.getByText('日落前提交第一份报告',{exact:true}).count(),0);
 await page.screenshot({path:path.join(out,'world-people.png')});
 for(const tab of ['探索与势力','任务与事件','传闻','运行记录','提示词预设']){await page.locator('[data-tab="'+tab+'"]').click();assert.equal(await page.locator('main pre').count(),0);}
 await page.locator('[data-tab="请求检查"]').click();
 assert.equal(await page.locator('[data-retries]').inputValue(),'3','失败重试次数默认3');
 await page.locator('[data-retries]').fill('2');
 await page.locator('[data-retries]').dispatchEvent('change');
 assert.equal(await page.evaluate(()=>Samsara.worldEngine.config.retryAttempts),2,'请求检查可修改失败重试次数');
 await page.locator('[data-tab="探索与势力"]').click();
 assert.equal(await page.getByRole('heading',{name:'世界动向',exact:true}).count(),0,'探索与势力不重复世界动向');
 assert.equal(await page.locator('[data-tab="势力与地区"]').count(),0,'旧页签名称应移除');
 await page.locator('[data-tab="任务与事件"]').click();
 assert.equal(await page.getByRole('heading',{name:'剧本与阶段',exact:true}).count(),0);
 await page.locator('[data-tab="世界推进"]').click();await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'world-mobile.png')});
 assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 for(const viewport of [{width:320,height:568},{width:800,height:300},{width:390,height:240}]){
   await page.setViewportSize(viewport);
   assert.equal(await page.locator('#sam-world-engine main').evaluate(el=>el.clientHeight>60&&el.scrollWidth<=el.clientWidth+1),true,'正文在窄屏和短屏不能塌缩');
 }
 await page.addStyleTag({content:'main,section,nav,header{height:0!important;max-height:1px!important;display:none!important}'});
 assert.equal(await page.locator('#sam-world-engine main').evaluate(el=>el.clientHeight>60),true,'宿主全局样式不能压扁独立面板');
 await page.evaluate(()=>{
   window.getCharWorldbookNames=()=>({primary:'测试世界书',additional:[]});
   window.getWorldbook=()=>[{uid:1,name:'无关键词条目',content:'这是一条普通设定',enabled:true},{uid:2,name:'禁用条目',content:'不得默认读取',enabled:false},{uid:3,name:'[variables]当前变量',content:'技术投影',enabled:true}];
 });
 await page.locator('[data-tab="提示词预设"]').click();
 assert.equal(await page.locator('[data-segment][data-title="世界推进"]').count(),1);
 assert.equal(await page.locator('[data-segment][data-title="世界演进准则"]').count(),1);
 assert.equal(await page.locator('[data-segment][data-title="因果轨道与偏移"]').count(),1);
 assert.equal(await page.locator('[data-segment][data-title="探索与势力"]').count(),1);
 assert.equal(await page.locator('[data-segment][data-title="势力与地区"]').count(),0);
 assert.equal((await page.locator('[data-segment][data-title="世界推进"]').inputValue()).includes('【世界推进】'),false);

 await page.locator('[data-action="books"]').click();
 await page.locator('[data-book]').first().waitFor();
 assert.equal(await page.locator('[data-book]:checked').count(),1);
 assert.equal(await page.locator('[data-book]:disabled').count(),1);
 await page.locator('[data-floors]').fill('3');
 await page.setViewportSize({width:1440,height:1080});
 await page.screenshot({path:path.join(out,'world-settings.png')});
 await page.locator('[data-action="save"]').click();
 await page.locator('[data-action="preview"]').click();
 await page.getByText('下一次请求预览',{exact:true}).waitFor();
 await page.screenshot({path:path.join(out,'world-request.png')});
 assert.equal(await page.locator('.we-inspect[open]').count(),0,'请求条目与原文默认折叠');
 await page.getByText('user · 分段阅读',{exact:true}).click();
 await page.getByText('正文楼层',{exact:true}).click();
 await page.getByText('assistant · 第 1 层',{exact:true}).click();
 await page.getByText('车夫递来一封信。',{exact:true}).waitFor();
 const request=await page.evaluate(()=>Samsara.worldEngine.previewRequest);
 assert.equal(JSON.parse(request.input).世界书[0].名称,'无关键词条目');
 assert.equal(JSON.parse(request.input).世界书.length,1);
 assert.equal(request.manifest.正文楼层.length,1);
 await page.setViewportSize({width:390,height:844});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.restored),true);
 await page.evaluate(()=>{const e=Samsara.worldEngine;e.snapshot=()=>({stat:{世界:{名称:'待初始化',后台:{},因果轨道:{}},系统状态:{}}});e.open();});
 await page.screenshot({path:path.join(out,'world-empty.png')});
 assert.deepEqual(errors,[]);console.log('Desktop/mobile, calendar filtering, detail expansion, tabs, empty state and return: PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
