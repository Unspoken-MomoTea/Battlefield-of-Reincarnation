from pathlib import Path

source_path = Path('script/世界推进系统.js')
source = source_path.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

source = replace_once(
    source,
    '#sam-world-engine .we-world-ranks b{color:var(--text);font-weight:600;margin-left:6px}',
    '#sam-world-engine .we-world-ranks b{color:var(--we-ink,var(--ink));font-weight:600;margin-left:6px}',
    'undefined world-ranks text token',
)
source = replace_once(
    source,
    '#sam-world-engine[data-tone] footer{background:var(--we-nav)!important;color:var(--we-sub)!important}',
    '#sam-world-engine[data-tone] footer{background:var(--we-nav)!important;color:var(--we-chrome-sub)!important}',
    'footer chrome contrast',
)
anchor = '''                #sam-world-engine[data-tone] .we-next-node>span{background:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] button.we-next-node:hover{background:var(--we-card-hover)!important}
'''
replacement = '''                #sam-world-engine[data-tone] .we-next-node>span{background:var(--we-action)!important;color:var(--we-action-ink)!important}
                #sam-world-engine[data-tone] button.we-next-node:hover{background:var(--we-card-hover)!important}
                #sam-world-engine[data-tone] .we-next-node small,
                #sam-world-engine[data-tone] .we-person-copy small,
                #sam-world-engine[data-tone] .we-link-btn,
                #sam-world-engine[data-tone] .we-explore-score span,
                #sam-world-engine[data-tone] .we-area-progress em,
                #sam-world-engine[data-tone] .we-rep b{color:var(--we-gold)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title,
                #sam-world-engine[data-tone] .we-timeline-group-title small,
                #sam-world-engine[data-tone] .we-brief-row>span:last-child,
                #sam-world-engine[data-tone] .we-person-copy em,
                #sam-world-engine[data-tone] .we-area-progress>div>span{color:var(--we-sub)!important}
                #sam-world-engine[data-tone] .we-timeline-group-title small{background:var(--we-card)!important}
                #sam-world-engine[data-tone] .we-preset-toolbar b{color:var(--we-ink)!important}
                #sam-world-engine[data-tone] summary:hover{color:var(--we-accent)!important}
                #sam-world-engine[data-tone] .we-card.is-jump{outline-color:var(--we-action)!important;background:var(--we-accent-soft)!important}
'''
source = replace_once(source, anchor, replacement, 'semantic secondary text block')
source_path.write_text(source, encoding='utf-8')

guide_path = Path('script/世界引擎接入说明.md')
guide = guide_path.read_text(encoding='utf-8')
guide = replace_once(
    guide,
    '- 对象字段的 add 采用 JSON Patch 设置语义，允许更新已存在的公开摘要。历史依然不可覆盖；时间、奖励与数值边界保护不变。',
    '- 对象字段的 add 采用 JSON Patch 设置语义；世界动向只维护 `世界.因果轨道.当前阶段`，旧 `公开摘要 / 正文承接` 仅在存档归一时迁移后删除。历史依然不可覆盖；时间、奖励与数值边界保护不变。',
    'obsolete public-summary guide text',
)
guide_path.write_text(guide, encoding='utf-8')
print('P1 visual hardcoded-color and guide cleanup staged')
