from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative, old, new):
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    if new in text:
        print(f'[trial-legacy] already patched: {relative}')
        return False
    if old not in text:
        raise RuntimeError(f'[trial-legacy] anchor not found: {relative}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'[trial-legacy] patched: {relative}')
    return True


# Active hidden identity is authoritative when starting a trial too. This prevents
# duplicate trial generation if a later AI update corrupts all commissioners.
replace_once(
    'Regular/试炼任务美化.html',
    """          const hasActive = Object.keys(tasks).some(function(name){
            const t = tasks[name] || {};
            return String(t.委托方 || '').trim() === '晋升试炼' && ['进行中','可交付','可结算','失败'].includes(String(t.状态 || '').trim());
          });""",
    """          const hasActive = sys.是否试炼任务 === true || Object.keys(tasks).some(function(name){
            const t = tasks[name] || {};
            return String(t.委托方 || '').trim() === '晋升试炼' && ['进行中','可交付','可结算','失败'].includes(String(t.状态 || '').trim());
          });""",
)


# Saves that entered a trial before the hidden marker existed need one narrow rescue path.
# Commissioner keywords alone are never enough: require the exact program-written delivery
# signature or the old 【晋升试炼·N】 database-key format.
replace_once(
    'Regular/结算任务美化.html',
    """            } else {
              // 旧存档没有隐藏标记时只接受原标准值，避免普通任务被关键词误判。
              keys = Object.keys(list).filter(function(key) {
                const task = list[key];
                return task && String(task.委托方 || '').trim() === '晋升试炼';
              });
            }""",
    """            } else {
              // 旧存档优先沿用标准值；若委托方已被AI改坏，只在同时命中程序级试炼签名时救援。
              const canonical = Object.keys(list).filter(function(key) {
                const task = list[key];
                return task && String(task.委托方 || '').trim() === '晋升试炼';
              });
              if (canonical.length) {
                keys = canonical;
              } else {
                keys = Object.keys(list).filter(function(key) {
                  const task = list[key];
                  if (!task || typeof task !== 'object') return false;
                  const commissioner = String(task.委托方 || '').trim();
                  if (!/(主神|系统|空间|普升|晋升|试炼)/.test(commissioner)) return false;
                  const delivery = String(task.交付 || '').trim();
                  const legacyKey = String(key || '').trim();
                  return delivery === '全部试炼主任务完成后统一结算' || /晋升试炼[·.]\s*\d+/.test(legacyKey);
                });
              }
            }""",
)


# Keep space-coin settlement aligned with the same legacy rescue rule. The coin core is
# intentionally self-contained because its regression test extracts it in isolation.
replace_once(
    'Regular/结算任务美化.html',
    """            const recognizedTaskKeys = new Set(Object.keys(taskList).filter(function(name) {
              const commissioner = String(taskList[name] && taskList[name].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            }));
            const trialSys = stat.系统状态 && typeof stat.系统状态 === 'object' ? stat.系统状态 : {};""",
    """            const recognizedTaskKeys = new Set(Object.keys(taskList).filter(function(name) {
              const commissioner = String(taskList[name] && taskList[name].委托方 || '').trim();
              return commissioner === '主神任务' || commissioner === '晋升试炼';
            }));
            Object.keys(taskList).forEach(function(name) {
              const task = taskList[name] || {};
              const commissioner = String(task.委托方 || '').trim();
              if (!/(主神|系统|空间|普升|晋升|试炼)/.test(commissioner)) return;
              const delivery = String(task.交付 || '').trim();
              if (delivery === '全部试炼主任务完成后统一结算' || /晋升试炼[·.]\s*\d+/.test(String(name || '').trim())) {
                recognizedTaskKeys.add(name);
              }
            });
            const trialSys = stat.系统状态 && typeof stat.系统状态 === 'object' ? stat.系统状态 : {};""",
)

print('[trial-legacy] done')
