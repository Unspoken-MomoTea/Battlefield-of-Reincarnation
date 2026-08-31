from pathlib import Path

FILES = {
    'main_html': Path('Regular/主神任务美化.html'),
    'trial_html': Path('Regular/试炼任务美化.html'),
    'main_prompt': Path('World Book/【主神任务】[mvu_plot].txt'),
}

def read_preserve(path):
    raw = path.read_bytes()
    return raw.decode('utf-8').replace('\r\n', '\n'), b'\r\n' in raw

def write_preserve(path, text, crlf):
    if crlf:
        text = text.replace('\n', '\r\n')
    path.write_bytes(text.encode('utf-8'))

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

MAIN_HELPERS = r'''          // ===== 上一楼层任务基线 =====
          // 不假定“美化器”和“额外变量更新”谁先执行：写入任务前先从前一楼层恢复
          // 任务.列表 + 任务.副本成就，清掉当前楼层可能由AI抢先写入的新增/改名/删除结果。
          function readPreviousTaskSnapshot(win, currentMessageId) {
            try {
              const currentId = Number(currentMessageId);
              if (!win || !win.Mvu || !Number.isInteger(currentId) || currentId <= 0) return null;
              const minId = Math.max(0, currentId - 4);
              for (let id = currentId - 1; id >= minId; id--) {
                try {
                  const data = win.Mvu.getMvuData({type:'message', message_id:id});
                  if (!data) continue;
                  const stat = data.stat_data || data;
                  if (!stat || typeof stat !== 'object') continue;
                  const taskRoot = stat.任务 && typeof stat.任务 === 'object' ? stat.任务 : {};
                  return {
                    messageId: id,
                    taskList: cloneTaskLockValue(win, taskRoot.列表 || {}),
                    achievements: cloneTaskLockValue(win, taskRoot.副本成就 || {})
                  };
                } catch (e) {}
              }
            } catch (e) {}
            return null;
          }

          function restorePreviousTaskBaseline(win, mvuData, source, snapshot) {
            try {
              const currentId = getTaskLockMessageId(win);
              const baseline = snapshot || readPreviousTaskSnapshot(win, currentId);
              if (!baseline || !mvuData || !win._ || !win._.set) {
                console.warn('[任务基线] 无法读取上一楼层任务快照，继续使用当前数据:', source || '任务美化器');
                return null;
              }
              win._.set(mvuData, 'stat_data.任务.列表', cloneTaskLockValue(win, baseline.taskList || {}));
              win._.set(mvuData, 'stat_data.任务.副本成就', cloneTaskLockValue(win, baseline.achievements || {}));
              console.log('[任务基线] 已从上一楼层恢复任务块:', baseline.messageId, '→', currentId, source || '任务美化器');
              return baseline;
            } catch (e) {
              console.warn('[任务基线] 恢复失败:', e);
              return null;
            }
          }

'''
TRIAL_HELPERS = MAIN_HELPERS.replace('          ', '        ')

# 1) 主神任务美化：加入上一楼层读取/恢复，并在任何任务/成就赋值前执行。
text, crlf = read_preserve(FILES['main_html'])
anchor = "          function installTaskGenerationLock(win, mvuData, source) {\n"
text = replace_once(text, anchor, MAIN_HELPERS + anchor, 'main baseline helpers')
old = """              if (!c) return;
              if (!win._ || !win._.set) return;

              let changed = false;
"""
new = """              if (!c) return;
              if (!win._ || !win._.set) return;

              // 若AI的额外变量更新先于美化器执行，当前 latest 可能已经混入重复/改名任务。
              // 先回到上一楼层的干净任务块，再叠加本次正文解析结果。
              if (q.tasks.length || q.achievements.length) {
                restorePreviousTaskBaseline(win, c, '主神任务美化');
              }

              let changed = false;
"""
text = replace_once(text, old, new, 'main baseline call')
write_preserve(FILES['main_html'], text, crlf)

# 2) 试炼任务美化：资格检查也以“上一楼层任务列表”为准，避免AI抢先新增假试炼导致误判；
#    真正赋值前再把两块任务数据恢复为该基线。
text, crlf = read_preserve(FILES['trial_html'])
anchor = "        function installTaskGenerationLock(win, mvuData, source) {\n"
text = replace_once(text, anchor, TRIAL_HELPERS + anchor, 'trial baseline helpers')
old = """          const tasks = get(c,'stat_data.任务.列表',{}) || {};
          const hasActive = Object.keys(tasks).some(function(name){
"""
new = """          const taskBaseline = readPreviousTaskSnapshot(win, getTaskLockMessageId(win));
          const tasks = taskBaseline ? (taskBaseline.taskList || {}) : (get(c,'stat_data.任务.列表',{}) || {});
          const hasActive = Object.keys(tasks).some(function(name){
"""
text = replace_once(text, old, new, 'trial baseline active check')
old = """          if (hasActive) return fail('已有尚未结算的晋升试炼。');

          const ex = expectedData(q);
"""
new = """          if (hasActive) return fail('已有尚未结算的晋升试炼。');

          // 无论额外变量更新先还是后：赋值前先以上一楼层任务块为唯一基线。
          restorePreviousTaskBaseline(win, c, '晋升试炼美化', taskBaseline);

          const ex = expectedData(q);
"""
text = replace_once(text, old, new, 'trial baseline restore')
write_preserve(FILES['trial_html'], text, crlf)

# 3) 主神任务世界书：取消“生态=固定任务数”，改为AI按世界内容选择2~5项；
#    同时补齐4项方案，仍确保难度/空间币有对应的程序预计算方案。
text, crlf = read_preserve(FILES['main_prompt'])
text = replace_once(text, "  [2, 3, 5].forEach(count => {\n", "  [2, 3, 4, 5].forEach(count => {\n", 'main prompt plan counts')
old = """## 任务数量锁定协议（强制执行）
- 【无异端】固定生成2个任务
- 【死斗局】固定生成3个任务
- 【混沌局】固定生成5个任务
- 禁止根据副模块、剧情规模或AI判断增减任务数量

## 任务难度与空间币锁定方案（强制照抄）
- 当前副本任务等级范围：<%- achievementGrades[difficultyLowerIndex] %>~<%- achievementGrades[difficultyUpperIndex] %>
- 根据生态只选择下方对应的一套方案；任务难度与奖励必须逐字复制，禁止重算、调换或修改
<%_ [2, 3, 5].forEach(count => { _%>
"""
new = """## 任务数量选择协议
- 根据当前世界局势、任务内容与副模块实际需要，自主生成2~5个主神任务
- 【无异端/死斗局/混沌局】只约束任务内容与冲突结构，不再硬绑定任务数量
- 任务必须彼此具有独立目标与价值，禁止为了凑数量拆分同一目标

## 任务难度与空间币锁定方案（强制照抄）
- 当前副本任务等级范围：<%- achievementGrades[difficultyLowerIndex] %>~<%- achievementGrades[difficultyUpperIndex] %>
- 先根据世界内容确定本次任务数量，再选择下方对应数量的方案；任务难度与奖励必须逐字复制，禁止重算、调换或修改
<%_ [2, 3, 4, 5].forEach(count => { _%>
"""
text = replace_once(text, old, new, 'main prompt count protocol')
text = replace_once(
    text,
    "主神任务根据世界局势与玩家阵营，按生态生成2、3或5个【主神任务】\n",
    "主神任务根据世界局势与玩家阵营，自主生成2~5个【主神任务】\n",
    'main prompt task intro'
)
text = replace_once(
    text,
    "  - 只输出所选方案包含的任务数量，禁止补充计划外任务\n",
    "  - 先确定2~5项中的实际任务数量，再严格输出对应方案包含的任务数量\n",
    'main prompt output note'
)
write_preserve(FILES['main_prompt'], text, crlf)

checks = {
    FILES['main_html']: [
        'function readPreviousTaskSnapshot(win, currentMessageId)',
        "restorePreviousTaskBaseline(win, c, '主神任务美化')",
        "installTaskGenerationLock(win, c, '主神任务美化')",
    ],
    FILES['trial_html']: [
        'const taskBaseline = readPreviousTaskSnapshot(win, getTaskLockMessageId(win));',
        "restorePreviousTaskBaseline(win, c, '晋升试炼美化', taskBaseline);",
        "installTaskGenerationLock(win, c, '晋升试炼美化')",
    ],
    FILES['main_prompt']: [
        '[2, 3, 4, 5].forEach(count => {',
        '自主生成2~5个主神任务',
        '不再硬绑定任务数量',
    ],
}
for path, needles in checks.items():
    content = path.read_bytes().decode('utf-8')
    for needle in needles:
        if needle not in content:
            raise SystemExit(f'{path}: missing expected token: {needle}')
