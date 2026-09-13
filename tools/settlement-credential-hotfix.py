from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / 'Regular' / '结算任务美化.html'
WORLD_BOOK = ROOT / 'World Book' / '【结算任务】[mvu_plot].txt'
TEST = ROOT / 'tests' / 'settlement-status-aliases.cjs'
TEST_MARKER = '// SETTLEMENT_CREDENTIAL_BASELINE_REGRESSION'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one old block, found {count}')
    return text.replace(old, new, 1)


def add_tests() -> None:
    text = TEST.read_text(encoding='utf-8')
    if TEST_MARKER in text:
        return
    addition = r'''

// SETTLEMENT_CREDENTIAL_BASELINE_REGRESSION
const worldBook=fs.readFileSync('World Book/【结算任务】[mvu_plot].txt','utf8');
assert.match(worldBook,/const SETTLEMENT_SUCCESS_STATUSES\s*=\s*new Set\(\['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成'\]\)/,'结算世界书必须与美化器共享完成态别名');
assert.match(worldBook,/success:\s*SETTLEMENT_SUCCESS_STATUSES\.has\(status\)/,'结算世界书必须用完成态集合判定成功');
assert.match(worldBook,/failed:\s*SETTLEMENT_FAILURE_STATUSES\.has\(status\)/,'结算世界书必须只把明确失败态判为失败');
assert.doesNotMatch(worldBook,/仅`状态=可结算`视为成功/,'结算世界书不得继续只认可结算');

const baselineBlock=html.match(/const SETTLEMENT_BASELINE_LOOKBACK\s*=\s*\d+;[\s\S]*?function readSettlementBaselineData\(\) \{[\s\S]*?\n          \}(?=\n\n          function readReincarnatorTier)/);
assert.ok(baselineBlock,'结算美化必须包含按任务快照择优的 baseline 读取器');
const snapshots={
  9:{stat_data:{角色:{层级:'Ⅰ'},任务:{列表:{}}}},
  8:{stat_data:{角色:{层级:'Ⅰ'},任务:{列表:{主线:{委托方:'主神任务',状态:'可交付',难度:'D'}}}}},
};
const baselineContext={Object,String,Number};
baselineContext.getMvuContext=()=>({win:{Mvu:{getMvuData:({message_id})=>snapshots[message_id]||null}},data:snapshots[9]});
baselineContext.getPanelMessageId=()=>10;
vm.createContext(baselineContext);
vm.runInContext(baselineBlock[0]+'\nthis.pickSettlementBaseline=readSettlementBaselineData;',baselineContext);
const pickedBaseline=baselineContext.pickSettlementBaseline();
assert.equal(pickedBaseline.stat_data.任务.列表.主线.状态,'可交付','凭证基线必须跳过仅有角色但任务已空的近楼层，继续找到最近任务快照');
'''
    TEST.write_text(text.rstrip() + addition + '\n', encoding='utf-8')


def implement() -> None:
    html = HTML.read_text(encoding='utf-8')
    old_baseline = '''          function readSettlementBaselineData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);
            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              for (let step = 1; step <= 3; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const data = mvu.getMvuData({ type: 'message', message_id: id });
                  const stat = data && (data.stat_data || data);
                  if (stat && stat.角色) return data;
                } catch (e) {}
              }
            }
            return ctx && ctx.data;
          }'''
    new_baseline = '''          const SETTLEMENT_BASELINE_LOOKBACK = 8;
          function settlementSnapshotTaskCount(data) {
            const stat = data && (data.stat_data || data);
            const list = stat && stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            return Object.keys(list).filter(function(key) {
              const commissioner = String(list[key] && list[key].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            }).length;
          }

          function readSettlementBaselineData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);
            let fallback = null;
            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              for (let step = 1; step <= SETTLEMENT_BASELINE_LOOKBACK; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const data = mvu.getMvuData({ type: 'message', message_id: id });
                  const stat = data && (data.stat_data || data);
                  if (!fallback && stat && stat.角色) fallback = data;
                  if (settlementSnapshotTaskCount(data) > 0) return data;
                } catch (e) {}
              }
            }
            return fallback || (ctx && ctx.data);
          }'''
    html = replace_once(html, old_baseline, new_baseline, 'settlement baseline')
    HTML.write_text(html, encoding='utf-8')

    world = WORLD_BOOK.read_text(encoding='utf-8')
    world = replace_once(
        world,
        "  const settlementTaskList = _.get(rule_data, '任务.列表', {}) || {};",
        "  const SETTLEMENT_SUCCESS_STATUSES = new Set(['可结算','可交付','待结算','结算','已结算','完成','已完成','结算完成']);\n  const SETTLEMENT_FAILURE_STATUSES = new Set(['失败','已失败','任务失败']);\n  const settlementTaskList = _.get(rule_data, '任务.列表', {}) || {};",
        'world book status sets',
    )
    world = replace_once(
        world,
        "        success: status === '可结算',\n        nonCoinReward: stripSpaceCoinText(task?.奖励),",
        "        success: SETTLEMENT_SUCCESS_STATUSES.has(status),\n        failed: SETTLEMENT_FAILURE_STATUSES.has(status),\n        nonCoinReward: stripSpaceCoinText(task?.奖励),",
        'world book task status mapping',
    )
    world = replace_once(
        world,
        "  const settlementUnsuccessfulTasks = settlementTasks.filter(item => !item.success);",
        "  const settlementFailedTasks = settlementTasks.filter(item => item.failed);",
        'world book failed task list',
    )
    world = replace_once(
        world,
        "  - 任务对象: 本次所有【主神任务/晋升试炼】；仅`状态=可结算`视为成功，其余按失败或未完成处理。",
        "  - 任务对象: 本次所有【主神任务/晋升试炼】；状态属于【可结算/可交付/待结算/结算/已结算/完成/已完成/结算完成】均视为成功；仅【失败/已失败/任务失败】视为明确失败，其余状态仅视为未完成，不得自动判失败。",
        'world book responsibility status rule',
    )
    world = replace_once(
        world,
        "  - 成功任务仅处理预设奖励中的非空间币部分；失败/未完成任务仅处理惩罚中的非空间币部分。所有含“空间币”的片段忽略。",
        "  - 成功任务仅处理预设奖励中的非空间币部分；只有明确失败任务处理惩罚中的非空间币部分，未完成/未知状态不得执行失败惩罚。所有含“空间币”的片段忽略。",
        'world book reward penalty rule',
    )
    world = replace_once(
        world,
        "  - 核对任务状态，只执行非空间币奖励与非空间币惩罚；不进行任何空间币运算。",
        "  - 核对任务状态，只执行成功任务的非空间币奖励与明确失败任务的非空间币惩罚；未完成/未知状态不执行失败惩罚；不进行任何空间币运算。",
        'world book dm status rule',
    )
    world = replace_once(
        world,
        "    * [<%- item.name %>]: <%- item.success ? '完成' : (item.status === '失败' ? '失败' : '未完成') %>",
        "    * [<%- item.name %>]: <%- item.success ? '完成' : (item.failed ? '失败' : '未完成') %>",
        'world book result rendering',
    )
    world = replace_once(world, "* **失败/未完成惩罚**:", "* **明确失败惩罚**:", 'world book penalty heading')
    world = replace_once(
        world,
        "<%_ if (settlementUnsuccessfulTasks.length) { _%>\n<%_ settlementUnsuccessfulTasks.forEach(item => { _%>",
        "<%_ if (settlementFailedTasks.length) { _%>\n<%_ settlementFailedTasks.forEach(item => { _%>",
        'world book failed task loop',
    )
    world = replace_once(world, "    * 本次无失败或未完成任务", "    * 本次无明确失败任务", 'world book no failure text')
    WORLD_BOOK.write_text(world, encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', choices=['tests', 'implementation'], required=True)
    args = parser.parse_args()
    if args.phase == 'tests':
        add_tests()
    else:
        implement()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
