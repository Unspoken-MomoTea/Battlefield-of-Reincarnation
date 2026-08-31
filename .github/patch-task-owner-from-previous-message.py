from pathlib import Path

path = Path('script/辅助计算脚本.js')
raw = path.read_bytes()
crlf = b'\r\n' in raw
text = raw.decode('utf-8').replace('\r\n', '\n')

old = '''    /**
     * 后续楼层任务委托方守卫。
     * 只认上一轮快照中已经属于 主神任务 / 晋升试炼 的任务。
     * AI可以修改任务的其它字段和状态，但不能把 委托方 改成别的值。
     */
    function guardPersistedSystemTaskOwner(statData, statDataBefore) {
        if (!statData || !statDataBefore) return false;

        const previousList = statDataBefore?.任务?.列表;
        const currentList = statData?.任务?.列表;
        if (!previousList || typeof previousList !== 'object') return false;
        if (!currentList || typeof currentList !== 'object') return false;

        let repaired = false;
        Object.entries(previousList).forEach(([taskName, oldTask]) => {
            if (!oldTask || typeof oldTask !== 'object') return;
            const oldOwner = String(oldTask.委托方 || '').trim();
            if (oldOwner !== '主神任务' && oldOwner !== '晋升试炼') return;

            const currentTask = currentList[taskName];
            if (!currentTask || typeof currentTask !== 'object') return;

            const newOwner = String(currentTask.委托方 || '').trim();
            if (newOwner === oldOwner) return;

            currentTask.委托方 = oldTask.委托方;
            repaired = true;
            console.warn(`[任务委托方守卫] ${taskName}.委托方 被修改为 ${newOwner || '(空)'}, 已恢复为 ${oldOwner}`);
        });

        return repaired;
    }
'''

new = '''    /**
     * 读取当前楼层之前最近一份真正包含 任务.列表 的 MVU 消息快照。
     * 不依赖 VARIABLE_UPDATE_ENDED 的 rawVariablesBefore：酒馆在部分额外变量更新时，
     * before 参数未必等价于“上一楼层已经落库的数据”。
     */
    function readPreviousMessageTaskList() {
        try {
            const win = getMvuGlobal();
            const currentId = latestMessageIdForTaskLock();
            if (!win || !win.Mvu || typeof win.Mvu.getMvuData !== 'function') return null;
            if (!Number.isInteger(currentId) || currentId <= 0) return null;

            const minId = Math.max(0, currentId - 4);
            for (let id = currentId - 1; id >= minId; id--) {
                try {
                    const data = win.Mvu.getMvuData({ type: 'message', message_id: id });
                    if (!data) continue;
                    const stat = data.stat_data || data;
                    const list = stat?.任务?.列表;
                    if (!list || typeof list !== 'object') continue;
                    return list;
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[任务委托方守卫] 读取上一楼层任务快照失败:', e);
        }
        return null;
    }

    /**
     * 后续楼层任务委托方守卫。
     * 唯一保护字段：委托方。
     * 上一楼层真实 MVU 快照中属于 主神任务 / 晋升试炼 的同名任务，
     * 当前楼层无论 AI 把委托方改成什么，都恢复原委托方；其它字段完全不干预。
     */
    function guardPersistedSystemTaskOwner(statData, statDataBefore) {
        if (!statData) return false;

        // 优先使用上一楼层真正落库的 MVU；仅在无法取得时回退事件 before 参数。
        const previousList = readPreviousMessageTaskList() || statDataBefore?.任务?.列表;
        const currentList = statData?.任务?.列表;
        if (!previousList || typeof previousList !== 'object') return false;
        if (!currentList || typeof currentList !== 'object') return false;

        let repaired = false;
        Object.entries(previousList).forEach(([taskName, oldTask]) => {
            if (!oldTask || typeof oldTask !== 'object') return;
            const oldOwner = String(oldTask.委托方 || '').trim();
            if (oldOwner !== '主神任务' && oldOwner !== '晋升试炼') return;

            const currentTask = currentList[taskName];
            if (!currentTask || typeof currentTask !== 'object') return;

            const newOwner = String(currentTask.委托方 || '').trim();
            if (newOwner === oldOwner) return;

            // 只恢复委托方；状态、目标、奖励、难度、惩罚等全部保留 AI 当前更新结果。
            currentTask.委托方 = oldTask.委托方;
            repaired = true;
            console.warn(`[任务委托方守卫] ${taskName}.委托方 被修改为 ${newOwner || '(空)'}, 已按上一楼层MVU恢复为 ${oldOwner}`);
        });

        return repaired;
    }
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f'owner guard block: expected 1 match, got {count}')
text = text.replace(old, new, 1)

if crlf:
    text = text.replace('\n', '\r\n')
path.write_bytes(text.encode('utf-8'))

check = path.read_bytes().decode('utf-8')
for needle in [
    'function readPreviousMessageTaskList()',
    'const previousList = readPreviousMessageTaskList() || statDataBefore?.任务?.列表;',
    "if (oldOwner !== '主神任务' && oldOwner !== '晋升试炼') return;",
    'currentTask.委托方 = oldTask.委托方;',
]:
    if needle not in check:
        raise SystemExit(f'missing expected token: {needle}')
