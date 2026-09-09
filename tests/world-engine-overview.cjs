const {chromium}=require('C:/Users/MLT/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
const {emptyState,RECORDS}=require('../script/世界推进系统.js');
const b=emptyState();
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
b.势力地区={'灰港商会':{...RECORDS.势力地区,类型:'势力',描述:'控制灰港大部分粮食贸易。',目标:'恢复粮食供应',进展:'正在寻找替代运输线路。',关联事件:['商会紧急议事'],资源:[{名称:'储粮',数量:'可维持七日',用途:'稳定城内供应',限制:'无法支援远方驻军'}],内部派系:[{名称:'河运派',立场:'开辟南侧河道',行动:'募集船只',影响:'与旧商路派存在分歧'}]},'北门地区':{...RECORDS.势力地区,类型:'地区',描述:'通往北境的唯一陆路出口。',目标:'维持秩序',进展:'旅客队伍拥堵，商队滞留。',控制方:'灰港卫队',关联事件:['灰港封锁'],近期变化:[{时间:'2026年9月7日清晨',事实:'临时检查站启用',关联事件:'灰港封锁'}]},'灰港外港':{...RECORDS.势力地区,类型:'地区',描述:'旧货栈和近海泊位组成的外港区。',进展:'夜间巡逻缩减，走私船开始靠岸。',控制方:'灰港卫队',争夺方:['河运派'],环境状态:['雾重','潮湿'],资源:[{名称:'废弃货栈',数量:'3座',用途:'临时藏匿',限制:'结构老化'}]}};
b.剧本={'补给危机':{...RECORDS.剧本,描述:'一条中断的商路，让灰港的旧秩序开始松动。',关联任务:['追查失踪车队'],关联事件:['灰港封锁'],状态:'进行中',期限:'2026年9月10日傍晚',下一节点:'找到被遗弃的货车',完成条件:'确认补给队下落',失败条件:'粮食储备耗尽',阶段:[{名称:'询问车夫',状态:'已完成',时间:'2026年9月7日清晨',说明:'获知车队在旧桥附近失去联系',前置阶段:''},{名称:'调查旧桥',状态:'进行中',时间:'2026年9月7日下午',说明:'寻找车轮与战斗痕迹',前置阶段:'询问车夫'},{名称:'找到失踪车队',状态:'待发生',时间:'',说明:'尚待调查结果',前置阶段:'调查旧桥'}]}};
b.最近变化=[{时间:'2026年9月7日清晨',类别:'事件',名称:'灰港封锁',操作:'新增',字段:'状态',内容:'北门进入临时管制。'},{时间:'2026年9月7日清晨',类别:'人物',名称:'守备官艾琳',操作:'更新',字段:'行动',内容:'开始审问返回的车夫。'},{时间:'2026年9月7日清晨',类别:'任务',名称:'追查失踪车队',操作:'更新',字段:'阶段',内容:'已完成询问，下一步前往旧桥。'}];
b.运行记录=[{时间:'2026年9月7日清晨',摘要:'确认补给中断，建立调查与商会议事的因果联系。',补丁数:8}];
const stat={世界:{名称:'灰港纪事',地点:'灰港 · 银鸥酒馆',时间:'2026年9月7日清晨',稳定:96,后台:b,因果轨道:{当前阶段:'北境的补给线已经中断。晨雾中的灰港依旧平静，但巡逻队开始检查离城的商队。粮价上涨的消息，正在酒馆与码头间流传。',故事线:'北境援军抵达 → 商路争夺 → 灰港改组',下一节点:'北境援军抵达',偏移记录:{}},法则:['低魔世界','契约具有约束力'],货币:{体系:'银冠',购买力基准:'普通餐食约3银冠',经济波动:'粮价小幅上涨'},历法:{名称:'灰港历',月份天数:[31,28,31,30,31,30,31,31,28,31,30,31],闰年规则:''},势力:{灰港商会:{实力:'C',声望:320,领地:'灰港集市',描述:'希望尽快恢复北方商路。'}},探索:{废弃旧桥:{风险:'D',探索度:35,描述:'桥头留有车轮与拖拽痕迹。',隐藏真相:'桥下存在一条隐蔽通道。'},灰港外港:{风险:'B',探索度:65,描述:'已摸清外港主路、货栈与两处可用泊位。',隐藏真相:'夜间有不明船只使用废弃泊位。'},旧驿道:{风险:'C',探索度:15,描述:'只确认了离城后的前两处分岔口。',隐藏真相:''}},异端雷达:{名单:{}}},系统状态:{游玩天数:23,是否在主神空间:false},设置:{},关系列表:{商人莱昂:{在场:true,好感度:25,态度:'愿意交换消息'},守备官艾琳:{在场:false,好感度:10}},任务:{列表:{追查失踪车队:{状态:'进行中',目标:'沿北境旧驿道寻找失踪的补给车队。',委托方:'灰港卫队',难度:'D',奖励:'200银冠'}},副本成就:{迷雾中的足迹:{状态:'未达成',说明:'在补给危机结束前找到旧桥的秘密。',难度:'D',奖励:'D级盲盒'}}},传闻:{街头巷议:{粮仓里的低语:{来源:'酒馆常客',内容:'听说北门外又停了两支商队，面包恐怕还要涨价。',可信度:'或许可信'}}}};
stat.世界.因果轨道.偏移记录={补给线截断:{描述:'商路受阻改变援军部署。',引发者:'河运派',影响程度:-10},恢复渡口:{描述:'修复了原定运输路线。',引发者:'测试玩家',影响程度:2},议会调停:{描述:'议会介入冲突。',引发者:'议会',影响程度:1},隐藏偏移:{描述:'其余记录可展开阅读。',引发者:'商会',影响程度:-1}};
// 故意打乱写入顺序：UI 必须按“进行中 → 近期 → 宏观”而不是对象插入顺序显示。
b.事件={'北境援军抵达':b.事件['北境援军抵达'],'商会紧急议事':b.事件['商会紧急议事'],'灰港封锁':b.事件['灰港封锁']};

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 await page.route('https://overview.test/**',r=>r.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
 await page.goto('https://overview.test/');
 stat.世界.位格='Ⅳ';stat.世界.难度='C-B';
 stat.世界.法则=['法则长文。'.repeat(100)+'\n第二段保持换行。','第二条法则。'.repeat(80)];
 stat.世界.异端雷达={当前模式:'干涉模式长文。'.repeat(100)+'\n这是下一段。',名单:{甲:{状态:'活跃'},乙:{状态:'死亡'}}};
 stat.世界.势力={敌人:{声望:-5000,实力:'C'},中立:{声望:0,实力:'D'},朋友:{声望:500,实力:'B'}};
 await page.evaluate(stat=>{
 window.getCurrentChatId=()=> 'overview';window.getChatMessages=()=>[{message_id:1,message:'测试',role:'assistant'}];
 window.Mvu={events:{VARIABLE_UPDATE_ENDED:'updated'},getMvuData:()=>({stat_data:stat})};window.eventOn=()=>()=>{};
 window.Samsara={terminal:{suspend:()=>({open:true}),restore:()=>{},apiReady:()=>false}};
 },stat);
 await page.addScriptTag({path:path.join(__dirname,'../script/世界推进系统.js')});
 await page.evaluate(()=>Samsara.worldEngine.open());
 for(const label of ['C-B','Ⅳ']) assert.ok(await page.locator('.we-hero').getByText(label,{exact:true}).count(),label);
 assert.equal(await page.getByText('世界概况',{exact:true}).count(),0);
 assert.equal(await page.getByText('异端存活数量',{exact:true}).count(),0);
 const laws=page.locator('.we-reading-section').filter({hasText:'世界法则'});
 assert.equal(await laws.getAttribute('open'),null);
 await laws.locator('summary').click();
 assert.equal(await laws.locator('.we-reading article').count(),2);
 assert.equal(await laws.locator('.we-pill').count(),0);
 assert.equal(await laws.locator('p').first().evaluate(e=>getComputedStyle(e).whiteSpace),'pre-wrap');
 for(const width of [1440,390]) {
 await page.setViewportSize({width,height:1080});
 assert.equal(await laws.locator('.we-reading').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 }
 await page.setViewportSize({width:1440,height:1080});
 await laws.locator('summary').click();
 await page.locator('main').evaluate(e=>e.scrollTop=0);
 await page.screenshot({path:path.join(__dirname,'artifacts/world-overview-fixed.png')});
 await page.locator('[data-tab="角色管理"]').first().click();
 assert.ok((await page.locator('.we-alien-count').innerText()).includes('1'));
 await page.locator('[data-tab="运行记录"]').first().click();
 const mode=page.locator('.we-section').filter({has:page.getByRole('heading',{name:'干涉模式',exact:true})});
 assert.equal(await mode.locator('.we-card').count(),1);
 assert.equal(await mode.locator('summary').count(),0);
 assert.equal(await page.locator('[data-action="cancel"]').count(),0);
 assert.ok((await mode.locator('p').innerText()).includes('这是下一段。'));
 await page.screenshot({path:path.join(__dirname,'artifacts/world-interference-reading.png')});
 await page.evaluate(()=>{const e=Samsara.worldEngine;e.busy=true;e.controller=new AbortController();e.render();});
 const runButton=page.locator('header [data-action="run"]');
 assert.equal(await runButton.innerText(),'停止推进');
 assert.equal(await runButton.isEnabled(),true);
 await runButton.click();
 assert.equal(await page.evaluate(()=>Samsara.worldEngine.controller.signal.aborted),true);
 assert.equal(await runButton.innerText(),'停止中…');
 assert.equal(await runButton.isDisabled(),true);
 await page.evaluate(()=>{const e=Samsara.worldEngine;e.busy=false;e.controller=null;e.render();});
 assert.equal(await runButton.innerText(),'推进世界');

 await page.locator('[data-tab="探索与势力"]').first().click();
 await page.locator('[data-directory="势力"]').click();
 assert.equal(await page.getByText('3.0×',{exact:true}).count(),1);
 for(const name of ['敌人','中立']) {
 const card=page.locator('[data-faction="'+name+'"]');
 assert.ok((await card.innerText()).includes('空间币奖励：0'));
 assert.equal(await card.locator('.we-explore-bar i').evaluate(e=>e.style.width),'0%');
 }
 await page.evaluate(()=>{const stat=Mvu.getMvuData().stat_data;stat.世界.势力.朋友.声望=-20;Samsara.worldEngine.render(true);});
 assert.equal(await page.getByText('0.0×',{exact:true}).count(),1);
 await page.evaluate(()=>{const stat=Mvu.getMvuData().stat_data;stat.世界.异端雷达={名单:{}};Samsara.worldEngine.tab='世界推进';Samsara.worldEngine.render(true);});
 assert.equal(await page.getByText('异端存活数量',{exact:true}).count(),0);
 assert.equal(await page.getByText('干涉模式',{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS: header ranks, character alien count, long-form laws/interference, mobile wrapping and reward cards');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
