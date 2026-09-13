from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 match, got {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


# 1) 单一世界结算：保留探索档案，但不再维护“探索结算基线”。
replace_once(
    'Regular/结算任务美化.html',
    """            } else {
              // 单一世界继续使用同一世界：探索档案必须持久保留；只记录本次已结算到的探索进度作为下次增量基线。
              const backend = ensureObject(world, '后台');
              const exploration = ensureObject(world, '探索');
              const explorationBaseline = {};
              Object.keys(exploration).forEach(function(areaName) {
                const progress = Math.max(0, Math.min(100, Number(exploration[areaName] && exploration[areaName].探索度) || 0));
                if (progress > 0) explorationBaseline[areaName] = progress;
              });
              setValue(backend, '探索结算基线', explorationBaseline);
              // 单一世界没有副本成就；结算时同步清理旧副本/旧版本残留，但不影响当前世界与未结算任务。
""",
    """            } else {
              // 单一世界继续使用同一世界：探索档案长期保留，但不参与空间币结算。
              // 单一世界没有副本成就；结算时同步清理旧副本/旧版本残留，但不影响当前世界与未结算任务。
"""
)

# 2) 删除已经不再需要的后台探索结算基线字段。
replace_once(
    'script/world-engine-src/10-world-state.part.js',
    "return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{}, 探索结算基线:{} };",
    "return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };"
)
replace_once(
    'script/ZOD脚本.js',
    """            // 程序生命周期墓碑：只记用户/MVU明确删除的资产名，防止世界引擎因旧剧情记忆重新创建。
            资产墓碑: z.record(z.string(), safeStr('')).prefault({}),
            // 单一世界阶段结算的探索奖励基线；只供程序防重复结算，不发送给正文/世界模型。
            探索结算基线: z.record(z.string(), clampNum(0, 0, 100)).prefault({})
""",
    """            // 程序生命周期墓碑：只记用户/MVU明确删除的资产名，防止世界引擎因旧剧情记忆重新创建。
            资产墓碑: z.record(z.string(), safeStr('')).prefault({})
"""
)

# 3) 结算提示：单一世界与势力一样，不结算探索空间币；普通副本保持原探索奖励。
path = 'World Book/【结算任务】[mvu_plot].txt'
text = read(path)
old = """  // 探索是当前世界的长期档案。普通副本离场时一次性结算全部；单一世界只结算上次阶段结算后的新增进度。
  const explorationLedger = _.get(rule_data, '世界.探索', {}) || {};
  const explorationBaseline = _.get(rule_data, '世界.后台.探索结算基线', {}) || {};
  const explorationSettlementRows = Object.entries(explorationLedger).map(([name, area]) => {
    const current = Math.max(0, Math.min(100, Number(area && area.探索度) || 0));
    const settled = isSingleWorld ? Math.max(0, Math.min(current, Number(explorationBaseline[name]) || 0)) : 0;
    return { name, current, settled, delta: isSingleWorld ? Math.max(0, current - settled) : current };
  }).filter(row => row.delta > 0);
  const explorationSettlementWeight = explorationSettlementRows.reduce((sum, row) => sum + row.delta, 0);
  const explorationSettlementSummary = explorationSettlementRows.length
    ? explorationSettlementRows.map(row => `${row.name}: ${isSingleWorld ? '新增' : ''}${row.delta}%`).join('；')
    : (isSingleWorld ? '本阶段无新增探索进度' : '无可结算探索进度');


"""
if old not in text:
    raise SystemExit('settlement prompt exploration precompute block not found')
text = text.replace(old, '', 1)
old = """<%_ if (isSingleWorld) { _%>
    - 世界探索附加收益只计算自上次阶段结算后新增的探索度；当前新增探索权重已由程序锁定为 <%= explorationSettlementWeight %>%（<%= explorationSettlementSummary %>）。总额上限: 【奖励基准评级对应基础奖励】 × 300%。禁止把已结算探索度再次计奖。
<%_ } else { _%>
    - 世界探索附加收益 = 【奖励基准评级对应基础奖励】 × 【总探索度%】。当前可结算探索权重为 <%= explorationSettlementWeight %>%（<%= explorationSettlementSummary %>）。总额上限: 【奖励基准评级对应基础奖励】 × 300%。
<%_ } _%>
<%_ if (!isSingleWorld) { _%>
    - 势力羁绊附加收益只计声望>0的势力，声望≤0一律为0，禁止取绝对值。程序已按当前世界难度最低评级算出：基础奖励 <%= reputationBase %>，正声望总权重 <%= reputationWeight %>，封顶后实际收益 <%= reputationReward %> 空间币。面板、个人最终总收益和空间币变量增量必须使用此金额，不得由AI重算或追加负声望奖励。
<%_ } _%>
"""
new = """<%_ if (!isSingleWorld) { _%>
    - 世界探索附加收益 = 【奖励基准评级对应基础奖励】 × 【总探索度%】。总额上限: 【奖励基准评级对应基础奖励】 × 300%。
    - 势力羁绊附加收益只计声望>0的势力，声望≤0一律为0，禁止取绝对值。程序已按当前世界难度最低评级算出：基础奖励 <%= reputationBase %>，正声望总权重 <%= reputationWeight %>，封顶后实际收益 <%= reputationReward %> 空间币。面板、个人最终总收益和空间币变量增量必须使用此金额，不得由AI重算或追加负声望奖励。
<%_ } else { _%>
    - 单一世界不结算世界探索与势力羁绊附加收益；两者只作为当前世界的长期资料继续保留。
<%_ } _%>
"""
if old not in text:
    raise SystemExit('settlement prompt exploration formula block not found')
text = text.replace(old, new, 1)
old = """* **世界探索附加收益明细**:
<%_ if (explorationSettlementRows.length) { _%>
<%_ explorationSettlementRows.forEach(row => { _%>
    * {基础奖励数值} × [<%= row.name %>] (<%= isSingleWorld ? '本阶段新增 ' : '' %><%= row.delta %>%) = {总额}
<%_ }); _%>
<%_ } else { _%>
    * <%= isSingleWorld ? '本阶段没有新增探索进度，探索收益为 0。' : '当前没有可结算探索进度，探索收益为 0。' %>
<%_ } _%>
    * **探索结算权重**: **<%= explorationSettlementWeight %>%**
    * **探索奖励合计**: **{按上述明细求和}** 空间币
    * **探索奖励上限**: **{基础奖励数值 × 300%}** 空间币
    * **探索实际计入收益**: **{取奖励合计与奖励上限中的较小值}** 空间币
<%_ if (!isSingleWorld) { _%>
* **势力羁绊附加收益明细**:
"""
new = """<%_ if (!isSingleWorld) { _%>
* **世界探索附加收益明细**:
    $(若 stat_data.世界.探索.地点名.探索度 > 0 则输出: * {基础奖励数值} × [地点名] ({{get_message_variable::stat_data.世界.探索.地点名.探索度}}%) = {总额})
    * **探索奖励合计**: **{所有探索总额}** 空间币
    * **探索奖励上限**: **{基础奖励数值 × 300%}** 空间币
    * **探索实际计入收益**: **{取上述二者中的较小值}** 空间币
* **势力羁绊附加收益明细**:
"""
if old not in text:
    raise SystemExit('settlement prompt exploration display block not found')
text = text.replace(old, new, 1)
write(path, text)

# 4) 回归测试：单一世界探索长期保留、没有基线、没有探索收益。
path = 'tests/world-engine-modules.cjs'
text = read(path)
old = """assert.match(settlementHtml, /if \\(!isSingleWorld\\) \\{[\\s\\S]{0,180}setValue\\(world, '探索', \\{\\}\\)/, '普通副本结算仍需清空探索台账');
assert.match(settlementHtml, /单一世界继续使用同一世界[\\s\\S]{0,700}探索结算基线/, '单一世界结算必须保留探索档案并刷新结算基线');
const settlementPrompt = fs.readFileSync(path.join(root, 'World Book', '【结算任务】[mvu_plot].txt'), 'utf8');
assert.match(settlementPrompt, /世界\\.后台\\.探索结算基线/);
assert.match(settlementPrompt, /只计算自上次阶段结算后新增的探索度/);
"""
new = """assert.match(settlementHtml, /if \\(!isSingleWorld\\) \\{[\\s\\S]{0,180}setValue\\(world, '探索', \\{\\}\\)/, '普通副本结算仍需清空探索台账');
assert.match(settlementHtml, /单一世界继续使用同一世界：探索档案长期保留，但不参与空间币结算/, '单一世界结算必须保留探索档案');
assert.doesNotMatch(settlementHtml, /探索结算基线/, '单一世界不再维护探索结算基线');
const settlementPrompt = fs.readFileSync(path.join(root, 'World Book', '【结算任务】[mvu_plot].txt'), 'utf8');
assert.doesNotMatch(settlementPrompt, /探索结算基线|只计算自上次阶段结算后新增的探索度/);
assert.match(settlementPrompt, /单一世界不结算世界探索与势力羁绊附加收益/, '单一世界探索与势力都不应奖励空间币');
"""
if old not in text:
    raise SystemExit('world-engine module exploration regression block not found')
text = text.replace(old, new, 1)
write(path, text)

print('single-world exploration settlement simplified')
