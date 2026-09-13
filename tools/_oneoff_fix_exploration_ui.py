from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8', newline='\n')

def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 match, got {count}: {old[:80]!r}')
    write(path, text.replace(old, new, 1))

# 1) 单一世界结算：探索档案持久保留；用后台基线记录已结算进度，避免下一阶段重复奖励。
path = 'Regular/结算任务美化.html'
text = read(path)
old = """            setValue(tasks, '击杀', {Ⅰ:0, Ⅱ:0, Ⅲ:0, Ⅳ:0, Ⅴ:0, Ⅵ:0, Ⅶ:0, Ⅷ:0, Ⅸ:0});
            setValue(world, '探索', {});

            if (!isSingleWorld) {
"""
new = """            setValue(tasks, '击杀', {Ⅰ:0, Ⅱ:0, Ⅲ:0, Ⅳ:0, Ⅴ:0, Ⅵ:0, Ⅶ:0, Ⅷ:0, Ⅸ:0});

            if (!isSingleWorld) {
              setValue(world, '探索', {});
"""
if old not in text:
    raise SystemExit('settlement exploration reset anchor not found')
text = text.replace(old, new, 1)
old = """            } else {
              // 单一世界没有副本成就；结算时同步清理旧副本/旧版本残留，但不影响当前世界与未结算任务。
              setValue(tasks, '副本成就', {});
"""
new = """            } else {
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
              setValue(tasks, '副本成就', {});
"""
if old not in text:
    raise SystemExit('single-world settlement branch anchor not found')
text = text.replace(old, new, 1)
write(path, text)

# 2) 后台内部字段：探索结算基线。仅程序结算使用，不进入世界模型投影。
replace_once(
    'script/world-engine-src/10-world-state.part.js',
    "return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{} };",
    "return { 版本:4, 已处理楼层:'', 已处理时间:'', 事件:{}, 人物:{}, 势力地区:{}, 历史:{}, 传播:{}, 最近变化:[], 运行记录:[], 资产墓碑:{}, 探索结算基线:{} };"
)
replace_once(
    'script/ZOD脚本.js',
    "            资产墓碑: z.record(z.string(), safeStr('')).prefault({})",
    "            资产墓碑: z.record(z.string(), safeStr('')).prefault({}),\n            // 单一世界阶段结算的探索奖励基线；只供程序防重复结算，不发送给正文/世界模型。\n            探索结算基线: z.record(z.string(), clampNum(0, 0, 100)).prefault({})"
)

# 3) 结算提示：普通副本仍按当前总探索结算；单一世界只结算相对上次基线的新增探索度。
path = 'World Book/【结算任务】[mvu_plot].txt'
text = read(path)
anchor = """  const reputationCap = reputationBase * 3;
  const reputationReward = Math.min(reputationTotal,reputationCap);


  // 仓库物品不在 stat_data.仓库 下；真实路径是 角色.装备/道具 中 状态===2
"""
insert = """  const reputationCap = reputationBase * 3;
  const reputationReward = Math.min(reputationTotal,reputationCap);

  // 探索是当前世界的长期档案。普通副本离场时一次性结算全部；单一世界只结算上次阶段结算后的新增进度。
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


  // 仓库物品不在 stat_data.仓库 下；真实路径是 角色.装备/道具 中 状态===2
"""
if anchor not in text:
    raise SystemExit('settlement prompt top anchor not found')
text = text.replace(anchor, insert, 1)
old = """    - 世界探索附加收益 = 【奖励基准评级对应基础奖励】 × 【总探索度%】。总额上限: 【奖励基准评级对应基础奖励】 × 300%。
<%_ if (!isSingleWorld) { _%>
"""
new = """<%_ if (isSingleWorld) { _%>
    - 世界探索附加收益只计算自上次阶段结算后新增的探索度；当前新增探索权重已由程序锁定为 <%= explorationSettlementWeight %>%（<%= explorationSettlementSummary %>）。总额上限: 【奖励基准评级对应基础奖励】 × 300%。禁止把已结算探索度再次计奖。
<%_ } else { _%>
    - 世界探索附加收益 = 【奖励基准评级对应基础奖励】 × 【总探索度%】。当前可结算探索权重为 <%= explorationSettlementWeight %>%（<%= explorationSettlementSummary %>）。总额上限: 【奖励基准评级对应基础奖励】 × 300%。
<%_ } _%>
<%_ if (!isSingleWorld) { _%>
"""
if old not in text:
    raise SystemExit('settlement exploration formula anchor not found')
text = text.replace(old, new, 1)
pattern = re.compile(r"\* \*\*世界探索附加收益明细\*\*:\n(?:    .*\n)+?    \* \*\*探索实际计入收益\*\*: \*\*\{取上述二者中的较小值\}\*\* 空间币\n")
match = pattern.search(text)
if not match:
    raise SystemExit('settlement exploration display block not found')
replacement = """* **世界探索附加收益明细**:
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
"""
text = text[:match.start()] + replacement + text[match.end():]
write(path, text)

# 4) 探索/热点/势力三页删除顶部四格统计条及对应无用计算/CSS。
path = 'script/world-engine-src/50-engine-ui.part.js'
text = read(path)
text = re.sub(r"\n\s*#sam-world-engine \.we-ledger-strip\{[^\n]*\}\n\s*#sam-world-engine \.we-ledger-stat\{[^\n]*\}\n\s*#sam-world-engine \.we-ledger-stat small\{[^\n]*\}\n\s*#sam-world-engine \.we-ledger-stat strong\{[^\n]*\}\n\s*#sam-world-engine \.we-ledger-stat span\{[^\n]*\}", "", text, count=1)
text = text.replace("\n                    #sam-world-engine .we-ledger-strip{grid-template-columns:repeat(2,minmax(0,1fr))}", "", 1)
text = text.replace("\n                #sam-world-engine[data-tone] .we-ledger-stat,", "", 1)
calc_pattern = re.compile(r"\n\s*const riskRank=value=>[^\n]+\n\s*const totalProgress=[^\n]+\n\s*const deepCount=[^\n]+\n\s*const highRiskCount=[^\n]+\n\s*const contestedCount=[^\n]+")
text, count = calc_pattern.subn('', text, count=1)
if count != 1:
    raise SystemExit('exploration ledger calculation block not found')
for line in [
    "                const factionWeight=factionList.reduce((sum,[,r])=>sum+Math.max(0,Number(r.声望)||0)/100,0);\n",
    "                const friendlyCount=factionList.filter(([,r])=>(Number(r.声望)||0)>=2000).length;\n",
    "                const hostileCount=factionList.filter(([,r])=>(Number(r.声望)||0)<=-1000).length;\n",
]:
    if line not in text:
        raise SystemExit('missing faction ledger calculation: ' + line.strip())
    text = text.replace(line, '', 1)
# 三个四卡条整块删除。
for start_marker, end_marker in [
    ("                    html+='<div class=\"we-ledger-strip\">'\n                        +'<div class=\"we-ledger-stat\"><small>已记录地标</small>", "                        +'</div>';\n"),
    ("                    html+='<div class=\"we-ledger-strip\">'\n                        +'<div class=\"we-ledger-stat\"><small>进行中热点</small>", "                        +'</div>';\n"),
    ("                    html+='<div class=\"we-ledger-strip\">'\n                        +'<div class=\"we-ledger-stat\"><small>已知势力</small>", "                        +'</div>';\n"),
]:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit('ledger strip start not found: ' + start_marker[-30:])
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit('ledger strip end not found')
    text = text[:start] + text[end + len(end_marker):]
if 'we-ledger-strip' in text or 'we-ledger-stat' in text:
    raise SystemExit('ledger strip leftovers remain in UI source')
write(path, text)

# 5) 现有 UI 回归测试改成三页都明确没有四格统计条。
path = 'tests/world-engine-ui.cjs'
text = read(path)
text = text.replace(" assert.equal(await page.locator('.we-ledger-strip .we-ledger-stat').count(),4,'探索首屏要有四项一眼可读指标');\n assert.equal(await page.getByText('115%',{exact:true}).count()>=1,true,'探索总权重直接展示');\n", " assert.equal(await page.locator('.we-ledger-strip,.we-ledger-stat').count(),0,'探索页不再显示容易误导的四格汇总统计');\n", 1)
# 若热点/势力测试段存在，在切换后补零统计断言。
text = text.replace(" await page.getByRole('button',{name:'热点',exact:true}).click();\n", " await page.getByRole('button',{name:'热点',exact:true}).click();\n assert.equal(await page.locator('.we-ledger-strip,.we-ledger-stat').count(),0,'热点页不再显示四格汇总统计');\n", 1)
text = text.replace(" await page.getByRole('button',{name:'势力',exact:true}).click();\n", " await page.getByRole('button',{name:'势力',exact:true}).click();\n assert.equal(await page.locator('.we-ledger-strip,.we-ledger-stat').count(),0,'势力页不再显示四格汇总统计');\n", 1)
write(path, text)

# 6) 模块检查加入静态防回归；同时检查单一世界探索不再被结算清空。
path = 'tests/world-engine-modules.cjs'
text = read(path)
anchor = "assert.match(texts['50-engine-ui.part.js'], /        dispose\\(\\) \\{/);\n"
extra = """assert.match(texts['50-engine-ui.part.js'], /        dispose\\(\\) \\{/);
assert.doesNotMatch(texts['50-engine-ui.part.js'], /we-ledger-strip|we-ledger-stat|已记录地标|探索结算权重|进行中热点|已知势力/, '探索/热点/势力页不应恢复四格汇总统计条');
const settlementHtml = fs.readFileSync(path.join(root, 'Regular', '结算任务美化.html'), 'utf8');
assert.match(settlementHtml, /if \\(!isSingleWorld\\) \\{[\\s\\S]{0,180}setValue\\(world, '探索', \\{\\}\\)/, '普通副本结算仍需清空探索台账');
assert.match(settlementHtml, /单一世界继续使用同一世界[\\s\\S]{0,700}探索结算基线/, '单一世界结算必须保留探索档案并刷新结算基线');
const settlementPrompt = fs.readFileSync(path.join(root, 'World Book', '【结算任务】[mvu_plot].txt'), 'utf8');
assert.match(settlementPrompt, /世界\\.后台\\.探索结算基线/);
assert.match(settlementPrompt, /只计算自上次阶段结算后新增的探索度/);
"""
if anchor not in text:
    raise SystemExit('module test anchor not found')
text = text.replace(anchor, extra, 1)
write(path, text)

print('one-off exploration/UI fix applied')
