from pathlib import Path

path = Path('script/辅助计算脚本.js')
raw = path.read_bytes()
crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')

old_call = """            // ★ 任务生成当层整块锁：任何后续计算前先恢复美化器权威快照。\n            //   只影响 任务.列表 / 任务.副本成就，不影响 任务.击杀 与其他变量。\n            guardTaskGenerationLock(statData);\n\n            const users = statData.主角;\n"""
new_call = """            // ★ 任务生成当层整块锁：任何后续计算前先恢复美化器权威快照。\n            //   只影响 任务.列表 / 任务.副本成就，不影响 任务.击杀 与其他变量。\n            guardTaskGenerationLock(statData);\n\n            // ★ 后续楼层系统任务字段守卫：\n            //   主神任务 / 晋升试炼 的定义字段由程序拥有，AI只允许推进 状态。\n            guardPersistedSystemTaskFields(statData, statDataBefore);\n\n            const users = statData.主角;\n"""
if text.count(old_call) != 1:
    raise SystemExit(f'call anchor expected 1 match, got {text.count(old_call)}')
text = text.replace(old_call, new_call, 1)

anchor = """    /**\n     * 任务生成当层整块镜像锁。\n"""
helper = """    /**\n     * 后续楼层系统任务字段守卫。\n     * 只认上一轮快照中的 委托方=主神任务 / 晋升试炼，避免AI先篡改委托方后逃逸。\n     * 固定字段全部恢复上一轮值；状态字段刻意不处理，允许剧情正常推进。\n     * 若AI删除原系统任务，则整项恢复。\n     */\n    function guardPersistedSystemTaskFields(statData, statDataBefore) {\n        if (!statData || !statDataBefore) return false;\n\n        const previousList = statDataBefore?.任务?.列表;\n        if (!previousList || typeof previousList !== 'object') return false;\n\n        if (!statData.任务 || typeof statData.任务 !== 'object') statData.任务 = {};\n        if (!statData.任务.列表 || typeof statData.任务.列表 !== 'object') statData.任务.列表 = {};\n        const currentList = statData.任务.列表;\n        const LOCKED_FIELDS = ['委托方', '目标', '难度', '奖励', '交付', '惩罚'];\n        let repaired = false;\n\n        Object.entries(previousList).forEach(([taskName, oldTask]) => {\n            if (!oldTask || typeof oldTask !== 'object') return;\n            const oldOwner = String(oldTask.委托方 || '').trim();\n            if (oldOwner !== '主神任务' && oldOwner !== '晋升试炼') return;\n\n            const currentTask = currentList[taskName];\n            if (!currentTask || typeof currentTask !== 'object') {\n                currentList[taskName] = clonePlainValue(oldTask);\n                repaired = true;\n                console.warn(`[任务守卫] ${taskName} 被非法删除，已从上一轮恢复`);\n                return;\n            }\n\n            LOCKED_FIELDS.forEach((field) => {\n                const oldVal = oldTask[field];\n                const newVal = currentTask[field];\n                if (!hasChanged(oldVal, newVal)) return;\n\n                if (oldVal === undefined) delete currentTask[field];\n                else currentTask[field] = clonePlainValue(oldVal);\n                repaired = true;\n                console.warn(`[任务守卫] ${taskName}.${field} 被额外变量更新修改，已恢复`);\n            });\n        });\n\n        return repaired;\n    }\n\n"""
if text.count(anchor) != 1:
    raise SystemExit(f'helper anchor expected 1 match, got {text.count(anchor)}')
text = text.replace(anchor, helper + anchor, 1)

if crlf:
    text = text.replace('\n', '\r\n')
path.write_bytes(text.encode('utf-8'))

check = path.read_bytes().decode('utf-8')
for needle in [
    'guardPersistedSystemTaskFields(statData, statDataBefore);',
    'function guardPersistedSystemTaskFields(statData, statDataBefore)',
    "const LOCKED_FIELDS = ['委托方', '目标', '难度', '奖励', '交付', '惩罚'];",
    "oldOwner !== '主神任务' && oldOwner !== '晋升试炼'",
]:
    if needle not in check:
        raise SystemExit(f'missing expected token: {needle}')
