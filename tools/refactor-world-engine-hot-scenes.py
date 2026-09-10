from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)

# 1) 正文只读投影：从“人物数组/人物聚合”升级为真正的热场景投影。
path = 'World Book/[variables]当前变量.txt'
text = read(path)
start_marker = '    // 场外人物动态：按地区聚合真正热人物。共享现场只在地区层出现一次，人物条目只保留自身地点/目标/行动等事实。'
end_marker = '    if (groupedScenes.length) readonly.世界.场外人物动态 = groupedScenes;'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('hot scene projection anchors not found')
end += len(end_marker)
new_block = r'''    // 场外场景：正文只读取当前真正“热”的世界现场。地区共享事实只出现一次，人物与事件挂在场景下面。
    // 热度来源：当前地点对应地区、公开进行中事件、本轮刚更新地区、真正热人物，以及活跃异端所在场景。
    // 这只是只读规划上下文，不代表当前角色自动知道场外事实；可感知性仍服从地点、观察与传播来源。
    const rawPeople = _.get(data, '世界.后台.人物', {}) || {};
    const rawAreas = _.get(data, '世界.后台.势力地区', {}) || {};
    const alienRoster = isOneWorld ? {} : (_.get(data, '世界.异端雷达.名单', {}) || {});
    const relationRoster = _.get(data, '关系列表', {}) || {};
    const personNameKey = value => String(value || '').toLowerCase().replace(/[\\/／·・._\-\s]+/g, '');
    const alienByKey = new Map(Object.entries(alienRoster).map(([name, alien]) => [personNameKey(name), { name, alien }]));
    const relationByKey = new Map(Object.entries(relationRoster).map(([name, person]) => [personNameKey(name), { name, person }]));
    const playerName = (() => {
      const dataName = String(_.get(data, '角色.名称', '') || '').trim();
      if (dataName) return dataName;
      try {
        const host = (typeof window !== 'undefined' && window.parent && window.parent !== window) ? window.parent : (typeof window !== 'undefined' ? window : null);
        return String(host?.SillyTavern?.name1 || host?.SillyTavern?.getContext?.()?.name1 || host?.name1 || '').trim();
      } catch (_) { return ''; }
    })();
    const playerKeys = new Set([playerName, '{{user}}', '<user>', '玩家'].filter(Boolean).map(personNameKey));
    const activeCurrentEventNames = new Set(
      Object.entries(rawEvents)
        .filter(([, event]) => event && event.分类 === '当前事件' && event.状态 === '进行中')
        .map(([name]) => name)
    );
    const worldTime = String(_.get(data, '世界.时间', '') || '').trim();
    const sameTimeAnchor = (a, b) => {
      const x = String(a || '').trim(), y = String(b || '').trim();
      if (!x || !y) return false;
      if (x === y) return true;
      const shorter = x.length <= y.length ? x : y;
      const longer = x.length <= y.length ? y : x;
      return shorter.length >= 8 && longer.includes(shorter);
    };
    const areaEntries = Object.entries(rawAreas)
      .filter(([, area]) => area && typeof area === 'object' && area.类型 !== '势力');
    const sceneAreaFor = location => {
      const matches = areaEntries
        .filter(([name]) => locationRelated(name, location))
        .sort((a, b) => String(b[0]).length - String(a[0]).length || String(a[0]).localeCompare(String(b[0]), 'zh-CN'));
      return matches.length ? { 名称: matches[0][0], 记录: matches[0][1] } : null;
    };
    const compactSceneList = (value, fields, limit = 4) => (Array.isArray(value) ? value : [])
      .filter(item => item && typeof item === 'object')
      .map(item => compactProjection(Object.fromEntries(fields.map(field => [field, item[field]]))))
      .filter(item => item.名称)
      .slice(0, limit);
    const projectedPeople = Object.entries(rawPeople).map(([name, person]) => {
      if (!person || typeof person !== 'object') return null;
      const key = personNameKey(name);
      if (playerKeys.has(key)) return null;
      const relationRef = relationByKey.get(key)?.person;
      // 已在正文现场的人物由正文直接维护，不再作为场外人物重复发送。
      if (relationRef?.在场 === true) return null;

      const alienRef = alienByKey.get(key);
      if (alienRef?.alien?.状态 === '死亡') return null;
      const isAlien = !!(alienRef && alienRef.alien?.状态 !== '死亡');
      const links = (Array.isArray(person.关联事件) ? person.关联事件 : [])
        .filter(eventName => activeCurrentEventNames.has(eventName))
        .slice(0, 6);
      const atCurrentLocation = locationRelated(person.地点, currentLocation);
      const linkedCurrentEvent = links.length > 0;
      const updatedNow = sameTimeAnchor(person.更新时间, worldTime);

      // 活跃异端永远是热人物；普通人物只保留当前地点、当前事件或本轮刚更新者。
      if (!isAlien && !atCurrentLocation && !linkedCurrentEvent && !updatedNow) return null;

      const backgroundLinks = compactSceneList(person.背景关联, ['类型', '名称', '关系'], 6);
      return {
        ...compactProjection({
          名称: String(name),
          地点: String(person.地点 || ''),
          目标: String(person.目标 || ''),
          行动: String(person.行动 || ''),
          状态: String(person.状态 || ''),
          更新时间: String(person.更新时间 || ''),
          公开动态: String(person.公开动态 || ''),
          背景关联: backgroundLinks,
          关联事件: links
        }),
        __异端: isAlien,
        __优先级: isAlien ? -20 : atCurrentLocation ? 0 : linkedCurrentEvent ? 1 : 2
      };
    }).filter(Boolean);

    const alienPeople = projectedPeople.filter(person => person.__异端)
      .sort((a, b) => a.名称.localeCompare(b.名称, 'zh-CN'));
    const ordinaryPeople = projectedPeople.filter(person => !person.__异端)
      .sort((a, b) => a.__优先级 - b.__优先级 || a.名称.localeCompare(b.名称, 'zh-CN'))
      .slice(0, 8);
    const hotPeople = [...alienPeople, ...ordinaryPeople];

    const hasSceneFacts = record => !!(record && typeof record === 'object' && (
      String(record.公开动态 || record.进展 || '').trim() ||
      (Array.isArray(record.环境状态) && record.环境状态.length) ||
      (Array.isArray(record.现场群体) && record.现场群体.length) ||
      (Array.isArray(record.资源点) && record.资源点.length)
    ));
    const sceneCandidates = new Map();
    const ensureScene = (location, priority = 9) => {
      const matchedArea = sceneAreaFor(location);
      const name = String(matchedArea?.名称 || location || '').trim();
      if (!name) return null;
      let scene = sceneCandidates.get(name);
      if (!scene) {
        scene = { 地区: name, 记录: matchedArea?.记录 || {}, 优先级: priority, 人物: [], 关联事件: [], 异端场景: false };
        sceneCandidates.set(name, scene);
      } else {
        scene.优先级 = Math.min(scene.优先级, priority);
        if (!Object.keys(scene.记录 || {}).length && matchedArea?.记录) scene.记录 = matchedArea.记录;
      }
      return scene;
    };

    // 人物只贡献自己的行动；共享场景事实永远从势力地区读取一次。
    for (const person of hotPeople) {
      const scene = ensureScene(person.地点, person.__异端 ? -20 : person.__优先级 + 2);
      if (!scene) continue;
      const clean = { ...person };
      delete clean.__异端;
      delete clean.__优先级;
      scene.人物.push(compactProjection(clean));
      if (person.__异端) scene.异端场景 = true;
    }

    // 有公开进行中事件的地区即使没有人物，也属于正在运行的热场景；这里只挂事件名，详细公开事实仍由世界.当前事件唯一承载。
    for (const event of publicEvents) {
      const scene = ensureScene(event.地点, 0);
      if (scene && !scene.关联事件.includes(event.名称)) scene.关联事件.push(event.名称);
    }

    // 当前地区与本轮刚更新的地区可以独立成为热场景，支持大型世界的多地并行演进。
    const currentArea = sceneAreaFor(currentLocation);
    if (currentArea && hasSceneFacts(currentArea.记录)) ensureScene(currentArea.名称, 1);
    for (const [name, area] of areaEntries) {
      if (sameTimeAnchor(area.更新时间, worldTime) && hasSceneFacts(area)) ensureScene(name, 2);
    }

    // 下一宏观节点只用于决定哪些“当前地区事实”值得保留，不在场景中重复未来事件详情。
    const nextMacroName = String(_.get(data, '世界.因果轨道.下一节点', '') || '').trim();
    const nextMacroEvent = nextMacroName ? rawEvents[nextMacroName] : null;
    if (nextMacroEvent?.地点) {
      const nextArea = sceneAreaFor(nextMacroEvent.地点);
      if (nextArea && hasSceneFacts(nextArea.记录)) ensureScene(nextArea.名称, 4);
    }

    const candidates = Array.from(sceneCandidates.values())
      .filter(scene => scene.人物.length || scene.关联事件.length || hasSceneFacts(scene.记录));
    const forcedScenes = candidates.filter(scene => scene.异端场景)
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'));
    const ordinaryScenes = candidates.filter(scene => !scene.异端场景)
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'))
      .slice(0, Math.max(0, 6 - forcedScenes.length));
    const hotScenes = [...forcedScenes, ...ordinaryScenes]
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'))
      .map(scene => {
        const record = scene.记录 || {};
        return compactProjection({
          地区: scene.地区,
          地区动态: String(record.公开动态 || record.进展 || ''),
          控制方: String(record.控制方 || ''),
          争夺方: (Array.isArray(record.争夺方) ? record.争夺方 : []).filter(Boolean).slice(0, 6),
          环境状态: (Array.isArray(record.环境状态) ? record.环境状态 : []).filter(Boolean).slice(0, 6),
          现场群体: compactSceneList(record.现场群体, ['名称', '规模', '身份', '动态'], 6),
          资源点: compactSceneList(record.资源点, ['名称', '类型', '状态', '控制方', '动态'], 6),
          关联事件: scene.关联事件.slice(0, 6),
          人物: scene.人物
        });
      });
    if (hotScenes.length) readonly.世界.场外场景 = hotScenes;'''
text = text[:start] + new_block + text[end:]
write(path, text)

# 2) 正文思考与 MVU 只读边界同步新字段名与语义。
path = 'World Book/⚙️额外思考.txt'
text = read(path)
old = '''      - 读取【世界.因果轨道】【世界.当前事件】【世界.场外人物动态】。当前阶段=已确认局势；故事线/下一节点=长期叙事方向；偏移记录=因果记忆。以上均不等于角色知识，角色知情必须有实际信息来源
      - 【世界.当前事件】只在与当前场景存在地点、人物或可见影响关联时体现其公开征兆/可见影响；无关事件不强行入镜
      - 【世界.场外人物动态】按地区分组：地区级现场只出现一次，人物子项只记录各自行动。它只用于保持人物行动连续性，不得替其推进下一步；目标/行动不是公开知识，公开动态也需满足观察、距离或传播渠道
      - 活跃异端持续按场外人物处理；雷达状态为【死亡】后禁止再作为活人行动或生成计划，仅可作为尸体、遗留物或历史事实出现'''
new = '''      - 读取【世界.因果轨道】【世界.当前事件】【世界.场外场景】。当前阶段=已确认局势；故事线/下一节点=长期叙事方向；偏移记录=因果记忆。以上均不等于角色知识，角色知情必须有实际信息来源
      - 【世界.当前事件】只在与当前场景存在地点、人物或可见影响关联时体现其公开征兆/可见影响；无关事件不强行入镜
      - 【世界.场外场景】按地区聚合热现场：环境/群体/资源只出现一次，人物只是场景成员，关联事件只作连续性索引。不得替场外人物推进下一步；目标/行动不是公开知识
      - 活跃异端持续保留在其所在热场景；雷达状态为【死亡】后禁止再作为活人行动或生成计划，仅可作为尸体、遗留物或历史事实出现'''
text = replace_once(text, old, new, 'extra-thinking hot scene wording')
write(path, text)

path = 'World Book/[mvu_update]变量更新规则.txt'
text = read(path)
text = replace_once(text, '/世界/场外人物动态', '/世界/场外场景', 'mvu readonly path')
write(path, text)

# 3) 世界引擎只需知道正文会看到“热场景”，不再描述旧人物数组。
path = 'script/world-engine-src/40-engine-runtime.part.js'
text = read(path)
old = "正文还会读取进行中当前事件的名称/状态/时间/地点/公开征兆/可见影响，以及程序筛选的场外人物动态（地点/目标/行动/状态/更新时间/公开动态/关联事件）；活跃异端始终进入人物动态。人物目标/行动用于保持叙事连续性，不代表角色已知。"
new = "正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体/资源点，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。"
text = replace_once(text, old, new, 'runtime prose projection wording')
write(path, text)

# 4) 永久验收：静态契约改为场外场景，明确事件型/地区型场景也能独立存在。
path = 'tests/world-engine-context-ui-redesign.cjs'
text = read(path)
text = text.replace('// 正文可见的场外人物动态必须按地区聚合，共享现场只出现一次。', '// 正文可见投影必须以热场景为一级单位，共享现场只出现一次。')
text = text.replace("assert.match(prose, /const sceneGroups = new Map\\(\\)/, '场外人物动态应先按场地聚合');", "assert.match(prose, /const sceneCandidates = new Map\\(\\)/, '场外场景应由热场景候选统一聚合');")
text = text.replace("assert.match(prose, /人物: group\\.人物/, '地区投影应包含该地区活动人物列表');", "assert.match(prose, /关联事件: scene\\.关联事件/, '地区投影应挂当前事件索引');\nassert.match(prose, /人物: scene\\.人物/, '地区投影应包含该地区活动人物列表');")
text = text.replace("assert.match(prose, /readonly\\.世界\\.场外人物动态 = groupedScenes/, '正文投影应输出地区级动态');", "assert.match(prose, /readonly\\.世界\\.场外场景 = hotScenes/, '正文投影应输出热场景数组');\nassert.doesNotMatch(prose, /readonly\\.世界\\.场外人物动态\\s*=/, '旧场外人物动态字段不得继续输出');")
text = text.replace("assert.match(guide, /场外人物动态.*按地区聚合/s, '接入说明应记录新的正文投影结构');", "assert.match(guide, /场外场景.*热场景/s, '接入说明应记录多场景热投影结构');")
write(path, text)

path = 'tests/world-engine-scene-context.cjs'
text = read(path)
text = text.replace("  'sceneGroups',", "  'sceneCandidates',")
text = text.replace("  '人物: group.人物',", "  '关联事件: scene.关联事件',\n  '人物: scene.人物',")
text = text.replace("assert.match(variableProjection, /readonly\\.世界\\.场外人物动态 = groupedScenes/, '正文场外人物动态必须按地区聚合输出');", "assert.match(variableProjection, /readonly\\.世界\\.场外场景 = hotScenes/, '正文必须输出地区级热场景');")
write(path, text)

# 5) 老总测中的投影断言同步新只读结构；不处理其既有 calendarDate 基线债。
path = 'tests/world-engine.cjs'
text = read(path)
old = """                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='异端甲'&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文人物动态');
                    assert.ok(readonly.世界.场外人物动态.some(x=>x.名称==='守备官'),'相关普通后台人物应进入正文人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>Object.hasOwn(x,'异端')),false,'异端身份已有雷达名单，人物动态不再重复映射布尔字段');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='测试玩家'),false,'玩家本人不得进入场外人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='在场NPC'),false,'已在正文现场的 NPC 不得重复进入场外人物动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='旧关系NPC'),false,'仅存在于关系列表的多年旧行动不得继续污染正文');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='同日远端NPC'),true,'同一日期但精度较低的本轮场外更新仍应视为热人物');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='异端亡者'),false,'死亡异端不得进入正文动态');
                    assert.equal(readonly.世界.场外人物动态.some(x=>x.名称==='纯冷NPC'),false,'无当前地点、当前事件或本轮更新的冷人物不占正文Token');
                    const compactPerson=readonly.世界.场外人物动态.find(x=>x.名称==='空字段使者');
                    assert.ok(compactPerson&&compactPerson.行动==='递送当前事件公文');"""
new = """                    const offstageScenes=readonly.世界.场外场景||[];
                    const offstagePeople=offstageScenes.flatMap(scene=>scene.人物||[]);
                    assert.ok(offstagePeople.some(x=>x.名称==='异端甲'&&/跟踪/.test(x.行动)),'活跃异端必须始终进入正文热场景');
                    assert.ok(offstagePeople.some(x=>x.名称==='守备官'),'相关普通后台人物应进入正文热场景');
                    assert.equal(offstagePeople.some(x=>Object.hasOwn(x,'异端')),false,'异端身份已有雷达名单，人物条目不再重复映射布尔字段');
                    assert.equal(offstagePeople.some(x=>x.名称==='测试玩家'),false,'玩家本人不得进入场外场景人物列表');
                    assert.equal(offstagePeople.some(x=>x.名称==='在场NPC'),false,'已在正文现场的 NPC 不得重复进入场外场景');
                    assert.equal(offstagePeople.some(x=>x.名称==='旧关系NPC'),false,'仅存在于关系列表的多年旧行动不得继续污染正文');
                    assert.equal(offstagePeople.some(x=>x.名称==='同日远端NPC'),true,'同一日期但精度较低的本轮场外更新仍应视为热人物');
                    assert.equal(offstagePeople.some(x=>x.名称==='异端亡者'),false,'死亡异端不得进入正文热场景');
                    assert.equal(offstagePeople.some(x=>x.名称==='纯冷NPC'),false,'无当前地点、当前事件或本轮更新的冷人物不占正文Token');
                    assert.equal(offstagePeople.some(x=>Object.hasOwn(x,'身边发展')||Object.hasOwn(x,'现场群体')||Object.hasOwn(x,'资源点')||Object.hasOwn(x,'环境状态')),false,'人物子项不得复制地区共享现场');
                    const compactPerson=offstagePeople.find(x=>x.名称==='空字段使者');
                    assert.ok(compactPerson&&compactPerson.行动==='递送当前事件公文');"""
text = replace_once(text, old, new, 'legacy projection assertions')
text = text.replace("                    for(const key of ['目标','状态','公开动态','关联事件'])assert.equal(Object.hasOwn(compactPerson,key),false,'空字段必须从人物投影省略：'+key);", "                    for(const key of ['目标','状态','公开动态','关联事件'])assert.equal(Object.hasOwn(compactPerson,key),false,'空字段必须从人物投影省略：'+key);\n                    assert.equal(readonly.世界.场外人物动态,undefined,'旧场外人物动态字段不得继续投影');")
text = text.replace("                    assert.equal(readonly.世界.场外人物动态,undefined);", "                    assert.equal(readonly.世界.场外场景,undefined);")
text = text.replace("        assert.match(engine.config.preset,/场外人物动态/);", "        assert.match(engine.config.preset,/场外人物/);")
write(path, text)

# 6) 接入说明去掉旧人物数组定义，只保留一套多场景契约。
path = 'script/世界引擎接入说明.md'
text = read(path)
text = text.replace('`身边发展` 与 `身边人物` 不属于 WorldResult Schema，也不持久化。角色管理 UI 仍按人物地点即时派生它们。正文只读的 `世界.场外人物动态` 则按地区聚合：地区动态、现场群体、资源点、环境状态只输出一次，人物子项只保留各自地点、目标、行动、状态、公开动态与关联事件；同地区三个人不会再复制三份相同现场。', '`身边发展` 与 `身边人物` 不属于 WorldResult Schema，也不持久化，只供角色管理 UI 按人物地点即时派生。正文只读改为 `世界.场外场景`：地区是一级单位，共享环境/群体/资源只出现一次，人物与公开当前事件挂在对应地区下面；事件型或本轮刚变化的地区即使暂时没有人物，也可以独立成为热场景。')
start = text.find('- 世界推进实际启用时，原模型只处理当前场景事实；')
end = text.find('- 后台提交携带楼层标记', start)
if start < 0 or end < 0:
    raise SystemExit('guide projection paragraph anchor not found')
replacement = '''- 世界推进实际启用时，后台完整 `势力地区 / 人物 / 事件` 可以长期保存大量世界事实；正文不读取完整后台，只接收程序筛出的热投影。`世界.当前事件` 是进行中事件的公开字段；`世界.场外场景` 是按地区聚合的热场景，热度来自当前地区、公开进行中事件、本轮刚更新地区、真正热人物与活跃异端。普通场景只保留优先级最高的少量记录，活跃异端所在场景不受普通场景名额挤出。场景内部共享 `环境状态 / 现场群体 / 资源点` 只出现一次，`人物` 只保存各自地点/目标/行动等事实，`关联事件` 只保存名称索引，避免重复事件详情。\n'''
text = text[:start] + replacement + text[end:]
start = text.find('- 正文通过当前变量读取完整 `世界.因果轨道`')
end = text.find('- 世界书目录合并四类当前有效来源', start)
if start < 0 or end < 0:
    raise SystemExit('guide prose paragraph anchor not found')
replacement = '''- 正文通过当前变量读取完整 `世界.因果轨道`、只读 `世界.当前事件` 与只读 `世界.场外场景`。这些都是叙事规划上下文，不等于玩家或角色自动知情；真正可见内容仍服从地点、观察与传播。`场外场景` 以地区为一级单位，最多保留少量普通热场景，并额外保留所有活跃异端所在场景；后台冷地区、冷人物不会进入正文 Token。\n'''
text = text[:start] + replacement + text[end:]
write(path, text)

# 7) 审计矩阵同步为“热场景”单一语义，避免文档继续保留旧人物数组定义。
path = 'docs/世界引擎V2审计.md'
text = read(path)
text = text.replace('目标：保留轮回战场现有 MVU、事件生命周期、场外人物投影与结构化输出优势，吸收参考实现的工作流式 Prompt、世界现场推演与 UI 信息层级；优先减少 AI 不需要知道的程序细节与重复结构说明。', '目标：保留轮回战场现有 MVU、事件生命周期、热场景投影与结构化输出优势，吸收参考实现的工作流式 Prompt、世界现场推演与 UI 信息层级；优先减少 AI 不需要知道的程序细节与重复结构说明。')
text = text.replace('| 场外人物动态 | 热人物投影，活跃异端强制热 | 项目专用优势 | 正文按地区聚合热人物，共享现场只投影一次 | P1-A / 后续修正 | 活跃异端持续活动；死亡后不诈尸；同地区现场不按人物重复输出 |', '| 场外场景 | 后台可保存大量地区/人物/事件，正文只需要少量热现场 | 大世界必须以场景而非人物为投影单位 | 当前地区、公开进行中事件、本轮变化、热人物与活跃异端共同选出热场景；共享现场只投影一次 | P1-A / 信息架构修正 | 魔兽式多地区并行时，冷地区不占正文 Token；事件型场景无需依赖人物存在 |')
text = text.replace('| 正文只读投影 | 仅投影热人物自身字段 | 世界感不足 | 热人物追加精简 `背景关联/身边发展` 派生视图 | P1-A | 控制长度；隐藏信息仍不自动成为角色知识 |', '| 正文只读投影 | 旧版以人物为一级单位，容易复制周边事实 | 多人物/多地区时会迅速膨胀 | `当前事件` 保留公开事件流；`场外场景` 按地区携带共享现场、人物列表与事件名称索引 | P1-A / 信息架构修正 | 同一地区只出现一次；人物子项不含现场副本；角色知识边界不变 |')
write(path, text)

print('hot scene projection refactor applied')
