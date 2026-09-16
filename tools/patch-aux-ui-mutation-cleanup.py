from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATHS = [
    ROOT / 'script' / '辅助计算脚本.js',
    ROOT / 'dist' / 'V20260916' / '辅助计算脚本.js',
]

for path in PATHS:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')

    # 正文 message_id 已成为消费型回合的唯一防重依据；辅助脚本不再需要识别 UI 写回来源。
    fn = text.find('    function isUIMutationActive() {')
    if fn >= 0:
        comment = text.rfind('    /**', 0, fn)
        next_doc = text.find('    /**\n     * 角色层级"普升通行证"校验', fn)
        if comment < 0 or next_doc < 0:
            raise RuntimeError(f'[ui-turn-cleanup] cannot isolate obsolete helper in {path}')
        text = text[:comment] + text[next_doc:]

    # 防止历史版本只残留 processCombatAndCooldowns 内的来源守卫。
    combat = text.find('    function processCombatAndCooldowns(statData, statDataBefore) {')
    if combat >= 0:
        guard = text.find('        // ★ UI 来源守卫:', combat)
        if guard >= 0:
            call = text.find('        if (isUIMutationActive()) {', guard)
            if call < 0:
                raise RuntimeError(f'[ui-turn-cleanup] UI guard call missing in {path}')
            end = text.find('        }\n', call)
            if end < 0:
                raise RuntimeError(f'[ui-turn-cleanup] UI guard end missing in {path}')
            text = text[:guard] + text[end + len('        }\n'):]

    if 'function isUIMutationActive()' in text or 'if (isUIMutationActive())' in text:
        raise RuntimeError(f'[ui-turn-cleanup] obsolete helper UI turn guard still present in {path}')

    # 旧注释可能仍提到函数名；函数/调用已删除后这些说明也一并清掉，避免误导后续维护。
    text = text.replace('isUIMutationActive()(主窗口多级 fallback)', '旧UI来源守卫')
    text = text.replace('isUIMutationActive()', '旧UI来源守卫')

    path.write_text(text, encoding='utf-8')

print('removed obsolete helper UI mutation turn guard')
