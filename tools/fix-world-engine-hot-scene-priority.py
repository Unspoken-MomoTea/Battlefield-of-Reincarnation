from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
vars_path = ROOT / 'World Book/[variables]当前变量.txt'
guide_path = ROOT / 'script/世界引擎接入说明.md'
audit_path = ROOT / 'docs/世界引擎V2审计.md'

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)

text = vars_path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "scene = { 地区: name, 记录: matchedArea?.记录 || {}, 优先级: priority, 人物: [], 关联事件: [], 异端场景: false };",
    "scene = { 地区: name, 记录: matchedArea?.记录 || {}, 优先级: priority, 人物: [], 关联事件: [], 强制保留: false };",
    'scene metadata',
)
text = replace_once(
    text,
    "      if (person.__异端) scene.异端场景 = true;",
    "      if (person.__异端) scene.强制保留 = true;",
    'alien critical scene',
)
text = replace_once(
    text,
    "      if (scene && !scene.关联事件.includes(event.名称)) scene.关联事件.push(event.名称);",
    "      if (scene) {\n        scene.强制保留 = true;\n        if (!scene.关联事件.includes(event.名称)) scene.关联事件.push(event.名称);\n      }",
    'public event critical scene',
)
text = replace_once(
    text,
    "    const currentArea = sceneAreaFor(currentLocation);\n    if (currentArea && hasSceneFacts(currentArea.记录)) ensureScene(currentArea.名称, 1);",
    "    const currentArea = sceneAreaFor(currentLocation);\n    if (currentArea && hasSceneFacts(currentArea.记录)) {\n      const scene = ensureScene(currentArea.名称, 1);\n      if (scene) scene.强制保留 = true;\n    }",
    'current area critical scene',
)
old_select = """    const candidates = Array.from(sceneCandidates.values())
      .filter(scene => scene.人物.length || scene.关联事件.length || hasSceneFacts(scene.记录));
    const forcedScenes = candidates.filter(scene => scene.异端场景)
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'));
    const ordinaryScenes = candidates.filter(scene => !scene.异端场景)
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'))
      .slice(0, Math.max(0, 6 - forcedScenes.length));
    const hotScenes = [...forcedScenes, ...ordinaryScenes]
"""
new_select = """    const candidates = Array.from(sceneCandidates.values())
      .filter(scene => scene.人物.length || scene.关联事件.length || hasSceneFacts(scene.记录));
    // 当前地区、公开进行中事件、活跃异端是剧情连续性的硬边界，不能互相争抢固定名额。
    // 本轮刚更新地区、普通热人物、下一宏观地区仅作为补充场景竞争有限名额。
    const criticalScenes = candidates.filter(scene => scene.强制保留)
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'));
    const supplementalScenes = candidates.filter(scene => !scene.强制保留)
      .sort((a, b) => a.优先级 - b.优先级 || a.地区.localeCompare(b.地区, 'zh-CN'))
      .slice(0, 4);
    const hotScenes = [...criticalScenes, ...supplementalScenes]
"""
text = replace_once(text, old_select, new_select, 'scene selection priority')
vars_path.write_text(text, encoding='utf-8')

guide = guide_path.read_text(encoding='utf-8')
guide = guide.replace(
    '普通场景只保留优先级最高的少量记录，活跃异端所在场景不受普通场景名额挤出。',
    '当前地区、公开进行中事件与活跃异端所在场景均强制保留，彼此不争抢固定名额；本轮刚更新地区、普通热人物与下一宏观地区只补充少量高优先级场景。',
)
guide = guide.replace(
    '`场外场景` 以地区为一级单位，最多保留少量普通热场景，并额外保留所有活跃异端所在场景；后台冷地区、冷人物不会进入正文 Token。',
    '`场外场景` 以地区为一级单位：当前地区、公开进行中事件与所有活跃异端所在地区是强制场景，另外只补充少量本轮变化/普通热人物/下一宏观地区；后台冷地区、冷人物不会进入正文 Token。',
)
guide_path.write_text(guide, encoding='utf-8')

audit = audit_path.read_text(encoding='utf-8')
audit = audit.replace(
    '当前地区、公开进行中事件、本轮变化、热人物与活跃异端共同选出热场景；共享现场只投影一次',
    '当前地区、公开进行中事件、活跃异端强制保留；本轮变化、普通热人物与下一宏观地区补充热场景；共享现场只投影一次',
)
audit_path.write_text(audit, encoding='utf-8')

print('hot scene priority fixed')
