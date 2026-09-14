from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'script' / 'world-engine-src' / '00-foundation-prompt.part.js'

text = TARGET.read_text(encoding='utf-8')

replacements = [
    (
        "Step 4 · 现场到人物：先更新当前区间内确实变化的地区现场，再决定人物行动。人物受地点、路程、能力、认知、职责、资产与地区条件约束；同场正文未决时停在交互前。活跃异端每轮复核。",
        "Step 4 · 现场到人物：先更新当前区间内确实变化的地区现场，再决定人物行动。人物受地点、路程、能力、认知、职责、资产与地区条件约束。模型看到正文楼层/当前变量不等于人物知情；场外人物若因<user>新行为改变目标或行动，必须已有相应认知，或本轮经观察、目击、通讯、传播获得并同步人物.认知/认知来源；没有来源则维持原目标/行动，只推进其自身事务。同场正文未决时停在交互前。活跃异端每轮复核。"
    ),
    (
        "Step 5 · 结算玩家影响：只按<user>已确认行为结算探索、势力与重大因果偏移；必要时重构宏观骨架。",
        "Step 5 · 结算玩家影响：只按<user>已确认行为结算探索、势力与重大因果偏移；这是客观世界结算，不得据此让未获知情报的场外人物自动追踪、伏击或改策。必要时重构宏观骨架。"
    ),
    (
        "3. 现场与认知：现场群体与环境事实属于势力地区，同一现场事实不得复制进人物。先更新地区现场再决定人物行动；人物只能依据在场、既有认知或传播链行动，不得全知反应。",
        "3. 现场与认知：现场群体与环境事实属于势力地区，同一现场事实不得复制进人物。先更新地区现场再决定人物行动；模型看到正文楼层、当前变量和<user>已确认行为，只代表世界事实，不等于任何场外人物知情。人物只能依据在场观察、既有认知、可信通讯/传播链行动；若因<user>新行为改变目标或行动，必须有可追溯的认知来源（已有或本轮写入人物.认知/认知来源），没有来源不得针对<user>即时反应。"
    ),
    ("version:17,\n        builtin:true,", "version:18,\n        builtin:true,"),
    ("exportedAt:'2026-09-11T12:30:00.000Z'", "exportedAt:'2026-09-14T12:30:00.000Z'"),
    ("updatedAt:'2026-09-11T12:30:00.000Z'", "updatedAt:'2026-09-14T12:30:00.000Z'")
]

changed = False
for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit(f'world prompt anchor not found: {old[:60]}')
    text = text.replace(old, new, 1)
    changed = True

if changed:
    TARGET.write_text(text, encoding='utf-8')
    print('patched offstage NPC knowledge provenance and bumped built-in prompt to v18')
else:
    print('offstage NPC knowledge provenance already synchronized')
