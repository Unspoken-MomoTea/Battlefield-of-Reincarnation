from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
test=ROOT/'tests/world-engine.cjs'
text=test.read_text(encoding='utf-8')
old="""                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='异端甲'&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文人物动态');
                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='守备官'),'相关普通后台人物应进入正文人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>Object.hasOwn(x,'异端')),false,'异端身份已有雷达名单，人物动态不再重复映射布尔字段');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='测试玩家'),false,'玩家本人不得进入场外人物动态');"""
new="""                    const offstageScenes=readonly.世界.场外人物动态||[];
                    const offstagePeople=offstageScenes.flatMap(scene=>scene.人物||[]);
                    assert.ok(offstagePeople.some(x=>x.名称==='异端甲'&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文人物动态');
                    assert.ok(offstagePeople.some(x=>x.名称==='守备官'),'相关普通后台人物应进入正文人物动态');
                    assert.equal(offstagePeople.some(x=>Object.hasOwn(x,'异端')),false,'异端身份已有雷达名单，人物动态不再重复映射布尔字段');
                    assert.equal(offstagePeople.some(x=>x.名称==='测试玩家'),false,'玩家本人不得进入场外人物动态');
                    assert.equal(offstagePeople.some(x=>Object.hasOwn(x,'身边发展')||Object.hasOwn(x,'现场群体')||Object.hasOwn(x,'资源点')||Object.hasOwn(x,'环境状态')),false,'人物子项不得复制地区共享现场');
                    assert.ok(offstageScenes.every(scene=>Array.isArray(scene.人物)&&scene.人物.length>0),'场外人物动态必须按地区分组并包含人物子项');
                    const testArea=offstageScenes.find(scene=>scene.地区==='测试地点');
                    assert.ok(testArea,'同一测试地点的热人物应归入一个地区组');
                    assert.equal(offstageScenes.filter(scene=>scene.地区==='测试地点').length,1,'同一地区只能输出一次共享现场');"""
if text.count(old)!=1:
    raise SystemExit(f'grouped projection assertion anchor mismatch: {text.count(old)}')
test.write_text(text.replace(old,new,1),encoding='utf-8')
print('grouped projection regression updated')
