from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
test=ROOT/'tests/world-engine.cjs'
text=test.read_text(encoding='utf-8')
old="""                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='异端甲'&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文人物动态');
                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='守备官'),'相关普通后台人物应进入正文人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>Object.hasOwn(x,'异端')),false,'异端身份已有雷达名单，人物动态不再重复映射布尔字段');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='测试玩家'),false,'玩家本人不得进入场外人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='在场NPC'),false,'已在正文现场的 NPC 不得重复进入场外人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='旧关系NPC'),false,'仅存在于关系列表的多年旧行动不得继续污染正文');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='同日远端NPC'),true,'同一日期但精度较低的本轮场外更新仍应视为热人物');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='异端亡者'),false,'死亡异端不得进入正文动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='纯冷NPC'),false,'无当前地点、当前事件或本轮更新的冷人物不占正文Token');
                    const compactPerson=readonly.世界.场外人物动态.find(x=>x.名称==='空字段使者');
                    assert.ok(compactPerson&&compactPerson.行动==='递送当前事件公文');
                    for(const key of ['目标','状态','公开动态','关联事件'])assert.equal(Object.hasOwn(compactPerson,key),false,'空字段必须从人物投影省略：'+key);"""
new="""                    const offstageScenes=readonly.世界.场外人物动态||[];
                    const offstagePeople=offstageScenes.flatMap(scene=>scene.人物||[]);
                    assert.ok(offstagePeople.some(x=>x.名称==='异端甲'&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文人物动态');
                    assert.ok(offstagePeople.some(x=>x.名称==='守备官'),'相关普通后台人物应进入正文人物动态');
                    assert.equal(offstagePeople.some(x=>Object.hasOwn(x,'异端')),false,'异端身份已有雷达名单，人物动态不再重复映射布尔字段');
                    assert.equal(offstagePeople.some(x=>x.名称==='测试玩家'),false,'玩家本人不得进入场外人物动态');
                    assert.equal(offstagePeople.some(x=>x.名称==='在场NPC'),false,'已在正文现场的 NPC 不得重复进入场外人物动态');
                    assert.equal(offstagePeople.some(x=>x.名称==='旧关系NPC'),false,'仅存在于关系列表的多年旧行动不得继续污染正文');
                    assert.equal(offstagePeople.some(x=>x.名称==='同日远端NPC'),true,'同一日期但精度较低的本轮场外更新仍应视为热人物');
                    assert.equal(offstagePeople.some(x=>x.名称==='异端亡者'),false,'死亡异端不得进入正文动态');
                    assert.equal(offstagePeople.some(x=>x.名称==='纯冷NPC'),false,'无当前地点、当前事件或本轮更新的冷人物不占正文Token');
                    assert.equal(offstagePeople.some(x=>Object.hasOwn(x,'身边发展')||Object.hasOwn(x,'现场群体')||Object.hasOwn(x,'资源点')||Object.hasOwn(x,'环境状态')),false,'人物子项不得复制地区共享现场');
                    assert.ok(offstageScenes.every(scene=>Array.isArray(scene.人物)&&scene.人物.length>0),'场外人物动态必须按地区分组并包含人物子项');
                    const testArea=offstageScenes.find(scene=>scene.地区==='测试地点');
                    assert.ok(testArea,'同一测试地点的热人物应归入一个地区组');
                    assert.equal(offstageScenes.filter(scene=>scene.地区==='测试地点').length,1,'同一地区只能输出一次共享现场');
                    const compactPerson=offstagePeople.find(x=>x.名称==='空字段使者');
                    assert.ok(compactPerson&&compactPerson.行动==='递送当前事件公文');
                    for(const key of ['目标','状态','公开动态','关联事件'])assert.equal(Object.hasOwn(compactPerson,key),false,'空字段必须从人物投影省略：'+key);"""
if text.count(old)!=1:
    raise SystemExit(f'grouped projection assertion anchor mismatch: {text.count(old)}')
test.write_text(text.replace(old,new,1),encoding='utf-8')
print('grouped projection regression updated')
