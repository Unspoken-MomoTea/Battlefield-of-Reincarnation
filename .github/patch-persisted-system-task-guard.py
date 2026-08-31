from pathlib import Path

path = Path('script/辅助计算脚本.js')
raw = path.read_bytes()
crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')

old_call = """            // ★ 任务生成当层整块锁：任何后续计算前先恢复美化器权威快照。\n            //   只影响 任务.列表 / 任务.副本成就，不影响 任务.击杀 与其他变量。\n            guardTaskGenerationLock(statData);\n\n            const users = statData.主角;\n"""
new_call = """            // ★ 任务生成当层整块锁：任何后续计算前先恢复美化器权威快照。\n            //   只影响 任务.列表 / 任务.副本成就，不影响 任务.击杀 与其他变量。\n            guardTaskGenerationLock(statData);\n\n            // ★ 后续楼层任务委托方守卫：只保护主神任务 / 晋升试炼的委托方。\n            guardPersistedSystemTaskOwner(statData, statDataBefore);\n\n            const users = statData.主角;\n"""
if text.count(old_call) != 1:
    raise SystemExit(f'call anchor expected 1 match, got {text.count(old_call)}')
text = text.replace(old_call, new_call, 1)

anchor = """    /**\n     * 任务生成当层整块镜像锁。\n"""
helper = """    /**\n     * 后续楼层任务委托方守卫。\n     * 只认上一轮快照中已经属于 主神任务 / 晋升试炼 的任务。\n     * AI可以修改任务的其它字段和状态，但不能把 委托方 改成别的值。\n     */\n    function guardPersistedSystemTaskOwner(statData, statDataBefore) {\n        if (!statData || !statDataBefore) return false;\n\n        const previousList = statDataBefore?.任务?.列表;\n        const currentList = statData?.任务?.列表;\n        if (!previousList || typeof previousList !== 'object') return false;\n        if (!currentList || typeof currentList !== 'object') return false;\n\n        let repaired = false;\n        Object.entries(previousList).forEach(([taskName, oldTask]) => {\n            if (!oldTask || typeof oldTask !== 'object') return;\n            const oldOwner = String(oldTask.委托方 || '').trim();\n            if (oldOwner !== '主神任务' && oldOwner !== '晋升试炼') return;\n\n            const currentTask = currentList[taskName];\n            if (!currentTask || typeof currentTask !== 'object') return;\n\n            const newOwner = String(currentTask.委托方 || '').trim();\n            if (newOwner === oldOwner) return;\n\n            currentTask.委托方 = oldTask.委托方;\n            repaired = true;\n            console.warn(`[任务委托方守卫] ${taskName}.委托方 被修改为 ${newOwner || '(空)'}, 已恢复为 ${oldOwner}`);\n        });\n\n        return repaired;\n    }\n\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'helper anchor expected 1 match, got {text.count(anchor)}')
text = text.replace(anchor, helper + anchor, 1)

if crlf:
    text = text.replace('\n', '\r\n')
path.write_bytes(text.encode('utf-8'))

check = path.read_bytes().decode('utf-8')
for needle in [
    'guardPersistedSystemTaskOwner(statData, statDataBefore);',
    'function guardPersistedSystemTaskOwner(statData, statDataBefore)',
    "oldOwner !== '主神任务' && oldOwner !== '晋升试炼'",
    'currentTask.委托方 = oldTask.委托方;',
]:
    if needle not in check:
        raise SystemExit(f'missing expected token: {needle}')
for forbidden in [
    "const LOCKED_FIELDS =",
    "currentList[taskName] = clonePlainValue(oldTask)",
]:
    if forbidden in check:
        raise SystemExit(f'unexpected broad task guard remains: {forbidden}')
