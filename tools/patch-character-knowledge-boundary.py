from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'World Book' / '[variables]当前变量.txt'
OLD = "    if (hotScenes.length) readonly.世界.场外场景 = hotScenes;"
NEW = """    if (hotScenes.length) {
      readonly.世界.场外场景使用规则 = '场外场景仅供叙事规划，不等于<user>或任何NPC已经知情；角色只能依据在场观察、既有认知、可靠传播或明确调查获得的信息行动，不得因这里的地点、目标或行动产生全知反应。';
      readonly.世界.场外场景 = hotScenes;
    }"""

text = TARGET.read_text(encoding='utf-8')
if OLD in text and NEW not in text:
    print('original offstage prose projection already restored')
elif NEW in text:
    TARGET.write_text(text.replace(NEW, OLD, 1), encoding='utf-8')
    print('restored original offstage prose projection')
else:
    raise SystemExit('offstage scene projection anchor not found')
