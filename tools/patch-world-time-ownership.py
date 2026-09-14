from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'World Book' / '[mvu_update]变量更新规则.txt'

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


def main() -> int:
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
        print('patched variable update rules: world engine owns 世界.时间')
    else:
        print('variable update rules already use world-engine time ownership')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
