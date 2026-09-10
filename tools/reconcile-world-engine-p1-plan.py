from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

source_path = Path('script/世界推进系统.js')
source = source_path.read_text(encoding='utf-8')
source = replace_once(
    source,
    '                /* ===== 世界引擎独立外观：默认暗夜，可在设置中切换 ===== */',
    '                /* ===== 世界引擎独立外观：跟随主神终端六色调；未设置时回退暗夜 ===== */',
    'source theme ownership comment',
)
source_path.write_text(source, encoding='utf-8')

audit_path = Path('docs/世界引擎V2审计.md')
audit = audit_path.read_text(encoding='utf-8')
replacements = [
    (
        '| UI semantic tokens | 已有语义变量与六主题 | 基础比初看成熟 | 保留 | P1-B | 六主题对比度检查 |',
        '| UI semantic tokens | 六主题已存在，但色值曾直接散在 CSS | 语义方向正确，值源需要唯一化 | `WORLD_UI_THEMES` 成为唯一主题色值源，CSS 由其生成 | P1-B（已完成） | 六主题正文/辅助字/强调色/按钮对比度自动检查 |',
        'matrix semantic tokens',
    ),
    (
        '| UI 主题局部例外 | 仍存在局部补丁 | 长期易漏色 | 统一 token | P1-B | 羊皮/樱白重点检查 |',
        '| UI 主题局部例外 | 羊皮/樱白/抹茶曾各自补 header/nav | 会形成第二套主题规则 | 删除逐主题 header/nav 补丁，统一 chrome/action token | P1-B（已完成） | 羊皮/樱白/抹茶不再有专属 selector |',
        'matrix theme exceptions',
    ),
    (
        '| UI 字号 | standard/large/xlarge | 比参考 10~12px 更适合主面板 | 保留 | P1-B | 高 DPI/移动端 |',
        '| UI 字号 | standard/large/xlarge 已有，但旧 9/10/12px 覆盖块仍与新字号系统重叠 | 设置看似生效但部分文字仍偏小 | 删除旧固定字号补丁，统一 `--we-fs-*`，标准正文约15px且辅助字不低于13px | P1-B（已完成） | 三档同时覆盖正文、标题、导航、按钮、品牌、日期和设置页 |',
        'matrix font scale',
    ),
    (
        '| 参考折叠卡/层级 | 动效与层级优秀 | 可借结构，不抄尺寸色值 | 选择性吸收 | P1-B | 可读性不下降 |',
        '| 参考折叠卡/层级 | 已吸收卡片、折叠、主从布局等层级 | 结构可借，尺寸色值不照搬 | 保留当前世界引擎层级，不继续叠视觉框架 | P1-B（已完成） | 不新增第二套正文美化层 |',
        'matrix reference hierarchy',
    ),
    (
        '| 角色管理 UI | 当前偏“目标/行动表” | 世界关系表达不足 | P1-A 数据稳定后增加“背景关联/身边发展”区块 | P1-B | 不造第二份数据，仅显示投影 |',
        '| 角色管理 UI | 已有正式名册、背景关联、身边发展、后台活动人物 | 世界关系展示边界已明确 | 保持只读派生与正式档案分离 | P1-B（已完成） | 不造第二份数据；现场标签不自动晋升 NPC |',
        'matrix person UI',
    ),
]
for old, new, label in replacements:
    audit = replace_once(audit, old, new, label)

old_p1b = '''## P1-B：角色管理世界关系 UI（已完成）

- 角色管理的正式人物名册只取 `关系列表`；世界后台中没有关系列表档案的人物单列为“后台活动人物”，只表示当前推演需要，不进入 NPC 构筑审计。
- `身边人物` 是按地点派生的剧情推演标签。只有已经存在 `关系列表` 档案的人物才显示可跳转入口；纯后台人物只显示现场标签，不因被点击或被推演而自动晋升。
- 世界推进首页的重点人物遵循同一边界：正式人物可进入角色管理，纯后台活动者只展示动态。
- `背景故事` 继续由 MVU 维护；`背景关联 / 身边发展 / 现场群体 / 资源点` 仍按 P1-A 的数据归属工作。
- UI 改动全部位于 `script/世界推进系统.js` 的 Shadow DOM 面板，不新增正文美化正则。
- 专项验收由 `tests/world-engine-person-scene-ui.cjs` 覆盖正式档案、现场标签、临时后台人物和地区资源展示。
- 纯后台人物不会无限进入副 API 上下文：只投影活跃异端、活跃/未来事件关联者、当前地点相关者、到期检查者与近72小时活动者，普通热人物最多24名；关系列表仍单独提供正式档案。
- 程序回收没有正式档案、不是活跃异端、没有活跃/未来事件引用且不在当前地点的冷临时人物：明确结束可直接回收，可比较世界时间下超过30天未活动会回收；无法比较的作品内时间不凭字符串盲删，但完全冷的临时记录最多保留32名。

## 后续顺序

P1-A 世界现场数据语义（已完成） → P1-B 角色管理/UI 世界关系展示（已完成） → P1-C Prompt 可观测性 → P2 单文件拆分。'''
new_p1b = '''## P1-B：角色关系 UI 与视觉系统（已完成）

### 角色展示边界

- 角色管理的正式人物名册只取 `关系列表`；世界后台中没有关系列表档案的人物单列为“后台活动人物”，只表示当前推演需要，不进入 NPC 构筑审计。
- `身边人物` 是按地点派生的剧情推演标签。只有已经存在 `关系列表` 档案的人物才显示可跳转入口；纯后台人物只显示现场标签，不因被点击或被推演而自动晋升。
- 世界推进首页的重点人物遵循同一边界：正式人物可进入角色管理，纯后台活动者只展示动态。
- `背景故事` 继续由 MVU 维护；`背景关联 / 身边发展 / 现场群体 / 资源点` 仍按 P1-A 的数据归属工作。
- 纯后台人物不会无限进入副 API 上下文：只投影活跃异端、活跃/未来事件关联者、当前地点相关者、到期检查者与近72小时活动者，普通热人物最多24名；关系列表仍单独提供正式档案。
- 程序回收没有正式档案、不是活跃异端、没有活跃/未来事件引用且不在当前地点的冷临时人物：明确结束可直接回收，可比较世界时间下超过30天未活动会回收；无法比较的作品内时间不凭字符串盲删，但完全冷的临时记录最多保留32名。

### 视觉单一来源

- 六主题色值只维护在 `WORLD_UI_THEMES`；`WORLD_TONE_KEYS` 从该对象派生，主题 CSS 由 `WORLD_UI_THEME_CSS` 生成，不再同时维护主题名单、色值和局部 selector 三份定义。
- 面板色调继续读取主神终端共享的 `samsara_theme_v2`；没有共享设置时回退暗夜。世界引擎设置页不再维护第二份色调状态，只维护自己的字号与专属 API。
- header/nav 统一使用 `chrome/action` token。羊皮、樱白、抹茶不再有独立 header/nav 补丁，避免以后改按钮时漏掉某个浅色主题。
- 标准/大字/特大统一使用 `--we-fs-*`；删除旧 9/10px 可读性补丁。标准正文约15px，辅助信息不低于13px；品牌、日期、导航、按钮、表单和设置页一起缩放。
- `区域档案` 说明卡、输入框、卡片、空状态继续只消费语义 token；浅色/暗色主题不再靠白框特例修补。
- 修复设置页响应式作用域：桌面保持双列，`max-width:760px` 时才切单列；避免移动规则泄漏到桌面。
- UI 仍全部位于 `script/世界推进系统.js` Shadow DOM，不新增正文美化正则。

### P1-B 验收

- `tests/world-engine-person-scene-ui.cjs`：正式档案、现场标签、后台活动人物、地区资源展示。
- `tests/world-engine-temporary-people.cjs`：后台临时人物热投影与冷回收边界。
- `tests/world-engine-ui-theme.cjs`：六主题 token 完整性、正文/辅助字/强调色/按钮 WCAG 4.5 对比度、三档字号覆盖、区域档案主题化、移动设置页作用域。
- `tests/world-engine-scene-context.cjs` 与 `tests/world-engine-prompt-pipeline.cjs` 继续通过；旧 lifecycle/prose/world-engine 测试与 main 基线保持同结果。

## 后续顺序

P1-A 世界现场数据语义（已完成） → P1-B 角色关系 UI 与视觉系统（已完成） → P1-C Prompt 可观测性 → P2 单文件拆分。'''
audit = replace_once(audit, old_p1b, new_p1b, 'P1-B section and next-order table')
audit_path.write_text(audit, encoding='utf-8')

guide_path = Path('script/世界引擎接入说明.md')
guide = guide_path.read_text(encoding='utf-8')
old_guide = '- 世界引擎新增独立设置页：默认暗夜色调，并可切换与主神终端一致的六种色调；基础字号提高到15px并提供16/17px两档。新增世界推进专属 API，支持独立地址、Key、模型、模型列表加载及 API 预设；一旦启用专属 API，世界推进不再调用或自动启用状态栏 API。'
new_guide = '- 世界引擎设置页保留独立字号与专属 API：面板色调读取主神终端共享的六色调配置，未设置时回退暗夜，不再维护第二份色调选择状态；字号为标准16 / 大字18 / 特大20根级，正文约15 / 17 / 19px。专属 API 支持独立地址、Key、模型、模型列表加载及 API 预设；一旦启用，世界推进不再调用或自动启用状态栏 API。六主题色值统一维护在 `WORLD_UI_THEMES`，header/nav 使用公共 chrome/action token，羊皮/樱白/抹茶不再各写一套按钮补丁。'
guide = replace_once(guide, old_guide, new_guide, 'integration guide theme behavior')
guide_path.write_text(guide, encoding='utf-8')

print('P1 plan/source documentation reconciliation staged')
