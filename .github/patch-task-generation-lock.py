from pathlib import Path

FILES = {
    'main': Path('Regular/主神任务美化.html'),
    'trial': Path('Regular/试炼任务美化.html'),
    'aux': Path('script/辅助计算脚本.js'),
}

def read_preserve(path):
    raw = path.read_bytes()
    return raw.decode('utf-8').replace('\r\n', '\n'), b'\r\n' in raw

def write_preserve(path, text, crlf):
    if crlf:
        text = text.replace('\n', '\r\n')
    path.write_bytes(text.encode('utf-8'))

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old, new, 1)

MAIN_HELPERS = r'''          // ===== 任务生成当层整块锁 =====
          // 美化器完成任务写入后，把 任务.列表 + 任务.副本成就 作为当前消息的权威快照。
          // 同一消息随后发生的额外变量更新，由辅助计算脚本强制恢复这两个节点；进入下一消息后自动解锁。
          function getTaskLockMessageId(win) {
            const getters = [];
            try { if (typeof getCurrentMessageId === 'function') getters.push(function() { return getCurrentMessageId(); }); } catch (e) {}
            try { if (win && typeof win.getCurrentMessageId === 'function') getters.push(function() { return win.getCurrentMessageId(); }); } catch (e) {}
            try {
              if (window.parent && window.parent !== window && typeof window.parent.getCurrentMessageId === 'function') {
                getters.push(function() { return window.parent.getCurrentMessageId(); });
              }
            } catch (e) {}
            for (const getter of getters) {
              try {
                const id = Number(getter());
                if (Number.isInteger(id) && id >= 0) return id;
              } catch (e) {}
            }
            try {
              const getMsgs = (typeof getChatMessages === 'function')
                ? getChatMessages
                : (win && typeof win.getChatMessages === 'function' ? win.getChatMessages.bind(win) : null);
              const latest = getMsgs ? getMsgs(-1)[0] : null;
              const id = Number(latest && (latest.message_id != null ? latest.message_id : latest.id));
              if (Number.isInteger(id) && id >= 0) return id;
            } catch (e) {}
            return null;
          }

          function cloneTaskLockValue(win, value) {
            if (win && win._ && typeof win._.cloneDeep === 'function') return win._.cloneDeep(value);
            return JSON.parse(JSON.stringify(value == null ? {} : value));
          }

          function installTaskGenerationLock(win, mvuData, source) {
            try {
              const messageId = getTaskLockMessageId(win);
              if (messageId === null || !mvuData) {
                console.warn('[任务生成锁] 无法取得当前消息ID，未建立生成锁');
                return;
              }
              const stat = mvuData.stat_data || mvuData;
              const taskRoot = stat && stat.任务 && typeof stat.任务 === 'object' ? stat.任务 : {};
              const lock = {
                messageId: messageId,
                source: source || '任务美化器',
                taskList: cloneTaskLockValue(win, taskRoot.列表 || {}),
                achievements: cloneTaskLockValue(win, taskRoot.副本成就 || {})
              };
              const targets = [];
              function addTarget(target) { if (target && targets.indexOf(target) < 0) targets.push(target); }
              addTarget(win);
              addTarget(window);
              try { addTarget(window.parent); } catch (e) {}
              try { addTarget(window.top); } catch (e) {}
              try { if (typeof GS_PARENT !== 'undefined') addTarget(GS_PARENT); } catch (e) {}
              targets.forEach(function(target) {
                try { target.__samsaraTaskGenerationLock = lock; } catch (e) {}
              });
              console.log('[任务生成锁] 已锁定当前楼层任务数据:', messageId, lock.source);
            } catch (e) {
              console.warn('[任务生成锁] 建立失败:', e);
            }
          }

'''

TRIAL_HELPERS = MAIN_HELPERS.replace('          ', '        ')

# 主神任务美化
text, crlf = read_preserve(FILES['main'])
anchor = "          // ===== 自动写入 MVU 数据库: 任务 + 成就 + 因果轨道 + 异端名单 =====\n"
text = replace_once(text, anchor, MAIN_HELPERS + anchor, 'main helpers')
old = """              if (!changed) return;
              win.Mvu.replaceMvuData(c, {type:'message', message_id:'latest'});
              try { win.Mvu.replaceMvuData(c, {type:'chat'}); } catch(e2){}
"""
new = """              if (!changed) return;
              if (q.tasks.length || q.achievements.length) {
                // 快照取自美化器已经完成全部赋值的 c；同层AI新增/删除/改名/覆盖任务都会被整块恢复。
                installTaskGenerationLock(win, c, '主神任务美化');
              }
              win.Mvu.replaceMvuData(c, {type:'message', message_id:'latest'});
              try { win.Mvu.replaceMvuData(c, {type:'chat'}); } catch(e2){}
"""
text = replace_once(text, old, new, 'main lock install')
write_preserve(FILES['main'], text, crlf)

# 试炼任务美化
text, crlf = read_preserve(FILES['trial'])
anchor = "        function activate(q) {\n"
text = replace_once(text, anchor, TRIAL_HELPERS + anchor, 'trial helpers')
old = """          win.Mvu.replaceMvuData(c,{type:'message',message_id:'latest'});
          try { win.Mvu.replaceMvuData(c,{type:'chat'}); } catch(e) {}

          return true;
"""
new = """          // 快照取自试炼美化器已经完成全部赋值的 c；同层额外AI变量更新无法复制或改写任务。
          installTaskGenerationLock(win, c, '晋升试炼美化');
          win.Mvu.replaceMvuData(c,{type:'message',message_id:'latest'});
          try { win.Mvu.replaceMvuData(c,{type:'chat'}); } catch(e) {}

          return true;
"""
text = replace_once(text, old, new, 'trial lock install')
write_preserve(FILES['trial'], text, crlf)

# 辅助计算脚本
text, crlf = read_preserve(FILES['aux'])
old = """            if (!statData) return;

            const users = statData.主角;
"""
new = """            if (!statData) return;

            // ★ 任务生成当层整块锁：任何后续计算前先恢复美化器权威快照。
            //   只影响 任务.列表 / 任务.副本成就，不影响 任务.击杀 与其他变量。
            guardTaskGenerationLock(statData);

            const users = statData.主角;
"""
text = replace_once(text, old, new, 'aux guard call')

anchor = """    /**
     * 是否处于\"悬浮球UI操作\"窗口期
"""
guard = r'''    /**
     * 任务生成当层整块镜像锁。
     * 主神任务/试炼任务美化器在当前消息完成任务赋值后，把完整的
     * 任务.列表 与 任务.副本成就 快照保存在 __samsaraTaskGenerationLock。
     * 同一 message_id 的额外变量更新无论修改字段、删除、改名或新增近似任务，
     * 都直接以该快照整块覆盖；进入下一条消息时锁自动清除。
     */
    function taskLockWindows() {
        const wins = [];
        const add = (w) => { if (w && !wins.includes(w)) wins.push(w); };
        try { if (typeof GS_PARENT !== 'undefined') add(GS_PARENT); } catch(e){}
        try { add(window.parent); } catch(e){}
        try { add(window.top); } catch(e){}
        try { add(window); } catch(e){}
        return wins;
    }

    function latestMessageIdForTaskLock() {
        const wins = taskLockWindows();
        for (const w of wins) {
            try {
                if (w && typeof w.getChatMessages === 'function') {
                    const latest = w.getChatMessages(-1)?.[0];
                    const id = Number(latest && (latest.message_id != null ? latest.message_id : latest.id));
                    if (Number.isInteger(id) && id >= 0) return id;
                }
            } catch(e){}
        }
        try {
            if (typeof getChatMessages === 'function') {
                const latest = getChatMessages(-1)?.[0];
                const id = Number(latest && (latest.message_id != null ? latest.message_id : latest.id));
                if (Number.isInteger(id) && id >= 0) return id;
            }
        } catch(e){}
        try {
            if (typeof getCurrentMessageId === 'function') {
                const id = Number(getCurrentMessageId());
                if (Number.isInteger(id) && id >= 0) return id;
            }
        } catch(e){}
        return null;
    }

    function clearTaskGenerationLock(lock) {
        taskLockWindows().forEach((w) => {
            try {
                const cur = w.__samsaraTaskGenerationLock;
                if (!cur) return;
                if (cur === lock || Number(cur.messageId) === Number(lock?.messageId)) {
                    w.__samsaraTaskGenerationLock = null;
                }
            } catch(e){}
        });
    }

    function guardTaskGenerationLock(statData) {
        if (!statData || typeof statData !== 'object') return false;

        let lock = null;
        for (const w of taskLockWindows()) {
            try {
                const candidate = w.__samsaraTaskGenerationLock;
                if (candidate && candidate.messageId != null && candidate.taskList && candidate.achievements) {
                    lock = candidate;
                    break;
                }
            } catch(e){}
        }
        if (!lock) return false;

        const currentMessageId = latestMessageIdForTaskLock();
        // 取不到楼层号时宁可暂时保留锁，也不做可能跨层的恢复。
        if (currentMessageId === null) return false;

        if (Number(lock.messageId) !== Number(currentMessageId)) {
            clearTaskGenerationLock(lock);
            return false;
        }

        if (!statData.任务 || typeof statData.任务 !== 'object') statData.任务 = {};

        const oldList = statData.任务.列表 || {};
        const oldAchievements = statData.任务.副本成就 || {};
        const listChanged = hasChanged(oldList, lock.taskList);
        const achievementsChanged = hasChanged(oldAchievements, lock.achievements);

        // 整块恢复而非逐字段修补：任务名只改一两个字后新增的近似任务，也会被直接清掉。
        statData.任务.列表 = clonePlainValue(lock.taskList) || {};
        statData.任务.副本成就 = clonePlainValue(lock.achievements) || {};

        if (listChanged || achievementsChanged) {
            console.warn(
                `[任务生成锁] ⚠️ 检测到同层额外变量更新修改任务数据，已整块恢复 ` +
                `(message_id=${currentMessageId}, source=${lock.source || '任务美化器'})`
            );
        }
        return true;
    }

'''
text = replace_once(text, anchor, guard + anchor, 'aux guard functions')
write_preserve(FILES['aux'], text, crlf)

checks = {
    FILES['main']: ['installTaskGenerationLock', '__samsaraTaskGenerationLock', "'主神任务美化'"],
    FILES['trial']: ['installTaskGenerationLock', '__samsaraTaskGenerationLock', "'晋升试炼美化'"],
    FILES['aux']: ['guardTaskGenerationLock(statData)', 'function guardTaskGenerationLock', 'statData.任务.列表 = clonePlainValue(lock.taskList)', 'statData.任务.副本成就 = clonePlainValue(lock.achievements)'],
}
for path, needles in checks.items():
    content = path.read_bytes().decode('utf-8')
    for needle in needles:
        if needle not in content:
            raise SystemExit(f'{path}: missing expected token: {needle}')
