from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
SETTLEMENT = ROOT / 'Regular' / '结算任务美化.html'
WORLD_TEST = ROOT / 'tests' / 'world-engine.cjs'

HTML_OLD = """              setValue(world, '后台', {});
              setValue(world, '势力', {});"""
HTML_NEW = """              setValue(world, '后台', {});

              // 普通副本离开当前世界时，关系人物也必须遵循世界生命周期。
              // 只有明确建立组队关系的正式队友可跨世界保留；高好感、仍在场或普通关系都不是保留条件。
              const relations = ensureObject(stat, '关系列表');
              Object.keys(relations).forEach(function(name) {
                const npc = relations[name];
                if (!npc || npc.是否队友 !== true) delete relations[name];
              });

              setValue(world, '势力', {});"""

html = SETTLEMENT.read_text(encoding='utf-8')
if HTML_NEW not in html:
    if HTML_OLD not in html:
        raise SystemExit('ordinary settlement world-cleanup anchor not found')
    html = html.replace(HTML_OLD, HTML_NEW, 1)
    SETTLEMENT.write_text(html, encoding='utf-8')
    print('patched ordinary settlement character lifecycle')
else:
    print('ordinary settlement character lifecycle already synchronized')

text = WORLD_TEST.read_text(encoding='utf-8')
replacements = [
    (
        "await test('actual settlement function clears ordinary world only, keeps relationships and both clocks', () => {",
        "await test('actual settlement clears old-world non-team characters while preserving formal teammates and single-world relationships', () => {"
    ),
    (
        "stat.关系列表.旅伴={好感度:10}; stat.世界.因果轨道.当前阶段='当前世界仍在持续推进。';",
        "stat.关系列表.旅伴={好感度:10,是否队友:false}; stat.关系列表.正式队友={好感度:50,是否队友:true}; stat.世界.因果轨道.当前阶段='当前世界仍在持续推进。';"
    ),
    (
        "assert.equal(stat.关系列表.旅伴.好感度,10);",
        "assert.equal(stat.关系列表.正式队友.好感度,50); if(single) assert.equal(stat.关系列表.旅伴.好感度,10); else assert.equal(stat.关系列表.旅伴,undefined);"
    ),
]
changed = False
for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit('world-engine settlement regression anchor not found: ' + old[:72])
    text = text.replace(old, new, 1)
    changed = True
if changed:
    WORLD_TEST.write_text(text, encoding='utf-8')
    print('migrated legacy settlement relationship regression')
else:
    print('legacy settlement relationship regression already synchronized')

# 同步资产归属身份语义：先归一旧投影代码，再由正式 patch 统一结算/收菜/正文投影/回归测试。
runpy.run_path(str(ROOT / 'tools' / 'patch-player-asset-owner-projection-compat.py'), run_name='__main__')
runpy.run_path(str(ROOT / 'tools' / 'patch-player-asset-owner.py'), run_name='__main__')
