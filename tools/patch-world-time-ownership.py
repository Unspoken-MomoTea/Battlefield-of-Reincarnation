from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'World Book' / '[mvu_update]变量更新规则.txt'
SETTLEMENT = ROOT / 'Regular' / '结算任务美化.html'
WORLD_SELECTION = ROOT / 'Regular' / '选择世界美化.txt'

OLD_READONLY = "    只读字段: [/角色/最终属性, /NPC/最终属性, /世界/后台, /世界/因果轨道, /世界/当前事件, /世界/场外场景, /世界/货币, /世界/探索, /世界/势力, /传闻/街头巷议, /传闻/布告与檄文]"
NEW_READONLY = "    只读字段: [/角色/最终属性, /NPC/最终属性, /世界/时间, /世界/后台, /世界/因果轨道, /世界/当前事件, /世界/场外场景, /世界/货币, /世界/探索, /世界/势力, /传闻/街头巷议, /传闻/布告与檄文]"

OLD_TIME = """    时间:
      format: ${yyy}年-${mm}月-${dd}日-${时间段}
      check:
        - 时间段为[清晨, 上午, 中午, 下午, 傍晚, 入夜, 深夜, 凌晨, 黎明]
        - *P_状态同步
          - 经过时间同步写入世界.时间；跨24小时递增日期；长期事件按实际经过时间推进，禁止时间跳跃后保留旧日期
"""
NEW_TIME = """<%_ if (isWorldEngineEnabled) { _%>
    时间:
      check:
        - 世界推进引擎独占维护；变量AI只读，禁止对/世界/时间生成patch
        - 直接读取当前值作为时间锚点，不自行推算、补全或推进
<%_ } else { _%>
    时间:
      format: ${yyy}年-${mm}月-${dd}日-${时间段}
      check:
        - 时间段为[清晨, 上午, 中午, 下午, 傍晚, 入夜, 深夜, 凌晨, 黎明]
        - *P_状态同步
          - 经过时间同步写入世界.时间；跨24小时递增日期；长期事件按实际经过时间推进，禁止时间跳跃后保留旧日期
<%_ } _%>
"""

OLD_SETTLEMENT_SPACE = """              setValue(world, '名称', '主神空间');
              setValue(world, '位格', 'Ⅸ');
              setValue(world, '难度', 'F~SSS');
              const sys = ensureObject(stat, '系统状态');
              setValue(sys, '是否在主神空间', true);"""
NEW_SETTLEMENT_SPACE = """              const sys = ensureObject(stat, '系统状态');
              // 主神空间使用独立轮回历：第1个游玩日从轮回历1年-04月-04日开始，
              // 之后只按系统状态.游玩天数映射，不继承任何副本世界的年代。
              const playDays = Math.max(1, Math.floor(Number(sys.游玩天数) || 1));
              const samsaraDayIndex = ((4 - 1) * 30 + (4 - 1)) + (playDays - 1);
              const samsaraYear = Math.floor(samsaraDayIndex / 360) + 1;
              const samsaraDayOfYear = samsaraDayIndex % 360;
              const samsaraMonth = Math.floor(samsaraDayOfYear / 30) + 1;
              const samsaraDay = (samsaraDayOfYear % 30) + 1;
              const settlementPad2 = function(value) { return String(value).padStart(2, '0'); };
              const samsaraTime = '轮回历' + samsaraYear + '年-' + settlementPad2(samsaraMonth) + '月-' + settlementPad2(samsaraDay) + '日-清晨';

              setValue(world, '名称', '主神空间');
              setValue(world, '位格', 'Ⅸ');
              setValue(world, '难度', 'F~SSS');
              setValue(world, '时间', samsaraTime);
              // 历法属于副本世界生命周期；主神空间不保留上一副本历法。
              setValue(world, '历法', {});
              // 与轮回历展示值同步锚点，避免辅助计算把“回主神空间”误算成额外跨日。
              setValue(sys, '上次世界日期', samsaraYear + '-' + samsaraMonth + '-' + samsaraDay);
              setValue(sys, '是否在主神空间', true);"""

OLD_SELECTION_ENTRY = """                    _set(c, 'stat_data.系统状态.是否在主神空间', false);
                    _set(c, 'stat_data.世界.名称', worldTitle);"""
NEW_SELECTION_ENTRY = """                    _set(c, 'stat_data.系统状态.是否在主神空间', false);
                    // 每个副本拥有独立世界时钟；进入新世界时必须先清空，让世界推进重新建立时间锚点。
                    _set(c, 'stat_data.世界.时间', '');
                    _set(c, 'stat_data.世界.历法', {});
                    _set(c, 'stat_data.世界.名称', worldTitle);"""


def patch_variable_rules() -> bool:
    text = TARGET.read_text(encoding='utf-8')
    changed = False

    if NEW_READONLY not in text:
        if OLD_READONLY not in text:
            raise SystemExit('world-time ownership patch: engine read-only list anchor not found')
        text = text.replace(OLD_READONLY, NEW_READONLY, 1)
        changed = True

    if '世界推进引擎独占维护；变量AI只读' not in text:
        if OLD_TIME not in text:
            raise SystemExit('world-time ownership patch: time-rule anchor not found')
        text = text.replace(OLD_TIME, NEW_TIME, 1)
        changed = True

    if changed:
        TARGET.write_text(text, encoding='utf-8')
    return changed


def patch_settlement_lifecycle() -> bool:
    text = SETTLEMENT.read_text(encoding='utf-8')
    if "const samsaraTime = '轮回历'" in text and "setValue(world, '时间', samsaraTime)" in text:
        return False
    if OLD_SETTLEMENT_SPACE not in text:
        raise SystemExit('world-time ownership patch: settlement main-space anchor not found')
    SETTLEMENT.write_text(text.replace(OLD_SETTLEMENT_SPACE, NEW_SETTLEMENT_SPACE, 1), encoding='utf-8')
    return True


def patch_world_selection_lifecycle() -> bool:
    text = WORLD_SELECTION.read_text(encoding='utf-8')
    if "_set(c, 'stat_data.世界.时间', '');" in text and "_set(c, 'stat_data.世界.历法', {});" in text:
        return False
    if OLD_SELECTION_ENTRY not in text:
        raise SystemExit('world-time ownership patch: world-selection entry anchor not found')
    WORLD_SELECTION.write_text(text.replace(OLD_SELECTION_ENTRY, NEW_SELECTION_ENTRY, 1), encoding='utf-8')
    return True


def main() -> int:
    variable_changed = patch_variable_rules()
    settlement_changed = patch_settlement_lifecycle()
    selection_changed = patch_world_selection_lifecycle()

    if variable_changed:
        print('patched variable update rules: world engine owns 世界.时间')
    else:
        print('variable update rules already use world-engine time ownership')

    if settlement_changed:
        print('patched settlement lifecycle: main space now uses play-day-based 轮回历')
    else:
        print('settlement lifecycle already uses play-day-based 轮回历')

    if selection_changed:
        print('patched world selection lifecycle: clear 世界.时间/历法 before entering a new world')
    else:
        print('world selection lifecycle already resets 世界.时间/历法')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())