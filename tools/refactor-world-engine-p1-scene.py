from pathlib import Path

SCRIPT = Path('script/世界推进系统.js')
VARIABLES = Path('World Book/[variables]当前变量.txt')

source = SCRIPT.read_text(encoding='utf-8')
variables = VARIABLES.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


old_step4 = "Step 4 · 推演场外实体：场外人物、势力与地区按自身职责、利益、资源、路程、能力和认知行动，不围绕<user>空转。人物只有通过在场、既有认知或传播链获得信息后才能据此行动；同场人物以正文为准，即将与<user>相遇时停在交互前一步。活跃异端始终视为热人物并复核地点、目标、行动与更新时间；死亡异端不可恢复活动。"
new_step4 = "Step 4 · 推演世界现场与场外实体：先更新当前区间内确实变化的地区现场，再决定人物行动。现场群体、资源点和环境事实写在势力地区；人物只维护自身地点、目标、行动、认知与持续背景关联，不复制地点现场。场外人物、势力与地区按职责、利益、资源、路程、能力和认知运行，不围绕<user>空转；同场人物以正文为准，即将与<user>相遇时停在交互前一步。活跃异端始终复核地点、目标、行动与更新时间；死亡异端不可恢复活动。"
source = replace_once(source, old_step4, new_step4, 'DEFAULT_PRESET Step 4')

old_core5 = "5. 人物连续性：活跃异端始终保持场外活动并按当前世界时间复核地点、目标、行动与更新时间；死亡异端不可恢复。普通人物只维护与当前地点、事件、关系或近期活动有关的热记录。"
new_core5 = "5. 现场与人物：现场群体/资源点属于势力地区，人物背景关联只记录持续的团体、组织、社交圈或阵营关系；同一现场事实不得复制进人物。先推进地区现场，再决定人物行动。活跃异端始终按当前世界时间复核地点、目标、行动与更新时间，死亡不可恢复；普通人物只维护真正热记录。"
source = replace_once(source, old_core5, new_core5, 'CORE rule 5')

old_protocol = "人物、势力地区、传播只用事件名称建立关联；不得为玩家建立后台人物记录。关系只更新关系列表中已经存在的对象；HP=0 只用于剧情已确认或场外已确认的死亡，不替正文进行常规战斗结算。"
new_protocol = "人物背景关联只记录持续的团体/组织/社交关系，不复制地点或事件；现场群体、资源点与环境变化写在势力地区，由地点关系形成身边发展。人物、势力地区、传播仍只用事件名称建立关联；不得为玩家建立后台人物记录。关系只更新关系列表中已经存在的对象；HP=0 只用于剧情已确认或场外已确认的死亡，不替正文进行常规战斗结算。"
source = replace_once(source, old_protocol, new_protocol, 'protocol scene ownership')

old_person_detail = "认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:''}"
new_person_detail = "认知来源:[{事实:'',来源:'',获知时间:'',状态:''}],登场条件:'',背景关联:[{类型:'',名称:'',关系:''}]}"
source = replace_once(source, old_person_detail, new_person_detail, 'person background links')

old_area_detail = "近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[]}"
new_area_detail = "近期变化:[{时间:'',事实:'',关联事件:''}],环境状态:[],现场群体:[{名称:'',规模:'',身份:'',动态:''}],资源点:[{名称:'',类型:'',状态:'',控制方:'',动态:''}]}"
source = replace_once(source, old_area_detail, new_area_detail, 'area shared scene fields')

old_version = "        version:9,\n        builtin:true,\n        name:'默认设置',"
new_version = "        version:10,\n        builtin:true,\n        name:'默认设置',"
source = replace_once(source, old_version, new_version, 'built-in prompt version')

old_raw_people = "    const rawPeople = _.get(data, '世界.后台.人物', {}) || {};\n    const alienRoster = isOneWorld ? {} : (_.get(data, '世界.异端雷达.名单', {}) || {});"
new_raw_people = "    const rawPeople = _.get(data, '世界.后台.人物', {}) || {};\n    const rawAreas = _.get(data, '世界.后台.势力地区', {}) || {};\n    const alienRoster = isOneWorld ? {} : (_.get(data, '世界.异端雷达.名单', {}) || {});"
variables = replace_once(variables, old_raw_people, new_raw_people, 'variables raw areas')

old_anchor = """    const sameTimeAnchor = (a, b) => {
      const x = String(a || '').trim(), y = String(b || '').trim();
      if (!x || !y) return false;
      if (x === y) return true;
      const shorter = x.length <= y.length ? x : y;
      const longer = x.length <= y.length ? y : x;
      return shorter.length >= 8 && longer.includes(shorter);
    };

    const projectedPeople = Object.entries(rawPeople).map(([name, person]) => {"""
new_anchor = """    const sameTimeAnchor = (a, b) => {
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
    const nearbyPeopleFor = (selfName, self, sceneArea) => {
      const selfLocation = String(self?.地点 || '').trim();
      const areaName = String(sceneArea?.名称 || '').trim();
      if (!selfLocation && !areaName) return [];
      return Object.entries(rawPeople)
        .filter(([otherName, other]) => {
          if (!other || typeof other !== 'object' || personNameKey(otherName) === personNameKey(selfName)) return false;
          const key = personNameKey(otherName);
          if (playerKeys.has(key)) return false;
          if (alienByKey.get(key)?.alien?.状态 === '死亡') return false;
          if (relationByKey.get(key)?.person?.在场 === true) return false;
          const otherLocation = String(other.地点 || '').trim();
          if (!otherLocation) return false;
          return areaName ? locationRelated(otherLocation, areaName) : locationRelated(otherLocation, selfLocation);
        })
        .map(([otherName, other]) => {
          const relation = relationByKey.get(personNameKey(otherName))?.person;
          const identity = Array.isArray(relation?.身份) ? relation.身份[0] : String(relation?.身份 || '');
          const exact = personNameKey(other.地点) === personNameKey(selfLocation);
          return compactProjection({
            名称: String(otherName),
            关系: exact ? '贴身' : '同地区',
            身份: identity,
            行动: String(other.行动 || other.公开动态 || '')
          });
        })
        .slice(0, 4);
    };

    const projectedPeople = Object.entries(rawPeople).map(([name, person]) => {"""
variables = replace_once(variables, old_anchor, new_anchor, 'variables scene helpers')

old_projection = """      return {
        ...compactProjection({
          名称: String(name),
          地点: String(person.地点 || ''),
          目标: String(person.目标 || ''),
          行动: String(person.行动 || ''),
          状态: String(person.状态 || ''),
          更新时间: String(person.更新时间 || ''),
          公开动态: String(person.公开动态 || ''),
          关联事件: links
        }),
        __异端: isAlien,
        __优先级: isAlien ? -10 : atCurrentLocation ? 0 : linkedCurrentEvent ? 1 : 2
      };"""
new_projection = """      const sceneArea = sceneAreaFor(person.地点);
      const sceneRecord = sceneArea?.记录 || {};
      const backgroundLinks = compactSceneList(person.背景关联, ['类型', '名称', '关系'], 6);
      const surroundings = compactProjection({
        地区: String(sceneArea?.名称 || ''),
        地区动态: String(sceneRecord.公开动态 || sceneRecord.进展 || ''),
        身边人物: nearbyPeopleFor(name, person, sceneArea),
        现场群体: compactSceneList(sceneRecord.现场群体, ['名称', '规模', '身份', '动态'], 4),
        资源点: compactSceneList(sceneRecord.资源点, ['名称', '类型', '状态', '控制方', '动态'], 4),
        环境状态: (Array.isArray(sceneRecord.环境状态) ? sceneRecord.环境状态 : []).filter(Boolean).slice(0, 4)
      });
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
          身边发展: Object.keys(surroundings).length ? surroundings : undefined,
          关联事件: links
        }),
        __异端: isAlien,
        __优先级: isAlien ? -10 : atCurrentLocation ? 0 : linkedCurrentEvent ? 1 : 2
      };"""
variables = replace_once(variables, old_projection, new_projection, 'variables projected surroundings')

old_comment = "    // 目标/行动供正文维持叙事连续性，不代表角色自动知情；真正可被角色观察的内容优先看“公开动态”。"
new_comment = "    // 目标/行动、背景关联与身边发展供正文维持叙事连续性，不代表角色自动知情；真正可被角色观察的内容仍需服从地点、观察与传播来源。"
variables = replace_once(variables, old_comment, new_comment, 'variables projection comment')

# Acceptance assertions before writing.
for marker in [
    "背景关联:[{类型:'',名称:'',关系:''}]",
    "现场群体:[{名称:'',规模:'',身份:'',动态:''}]",
    "资源点:[{名称:'',类型:'',状态:'',控制方:'',动态:''}]",
    '先更新当前区间内确实变化的地区现场',
    '同一现场事实不得复制进人物',
    'version:10',
]:
    if marker not in source:
        raise SystemExit(f'missing source marker after refactor: {marker}')

for marker in [
    "const rawAreas = _.get(data, '世界.后台.势力地区', {}) || {};",
    'sceneAreaFor',
    'nearbyPeopleFor',
    '背景关联: backgroundLinks',
    '身边发展: Object.keys(surroundings).length ? surroundings : undefined',
]:
    if marker not in variables:
        raise SystemExit(f'missing projection marker after refactor: {marker}')

SCRIPT.write_text(source, encoding='utf-8')
VARIABLES.write_text(variables, encoding='utf-8')

print('P1 scene refactor staged')
