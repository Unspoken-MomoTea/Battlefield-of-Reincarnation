from pathlib import Path

# one-off renderer migration; removed after CI applies and verifies it
path = Path('Regular/结算任务美化.html')
text = path.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    text = text.replace(old, new, 1)

replace_once(
    "const subtotal = base * progress / 100;",
    "const subtotal = base * progress / 1000;",
    'exploration scale'
)
replace_once(
    "const explorationCap = base * 3;",
    "const explorationCap = base;",
    'exploration cap'
)
replace_once(
    "const subtotal = base * reputation / 100;",
    "const subtotal = base * reputation / 10000;",
    'reputation scale'
)
replace_once(
    "const reputationCap = base * 3;",
    "const reputationCap = base;",
    'reputation cap'
)
replace_once(
    "formula:fmtNum(result.base) + ' × ' + x.progress + '%'",
    "formula:fmtNum(result.base) + ' × (' + x.progress + ' ÷ 1000)'",
    'exploration display formula'
)
replace_once(
    "formula:fmtNum(result.base) + ' × (' + x.reputation + ' ÷ 100)'",
    "formula:fmtNum(result.base) + ' × (' + x.reputation + ' ÷ 10000)'",
    'reputation display formula'
)

old_credential = '''          function resolveCredentialGrant(data) {
            const stat = data && (data.stat_data || data);
            if (!stat || !stat.角色) return null;
            const LIFE_TIERS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
            const tierRaw = String(stat.角色.层级 || 'Ⅰ').trim();
            let reincarnatorIndex = LIFE_TIERS.indexOf(tierRaw);
            if (reincarnatorIndex < 0) reincarnatorIndex = GRADES.indexOf(gradeTier(tierRaw));
            if (reincarnatorIndex < 0) reincarnatorIndex = 0;
            if (reincarnatorIndex >= GRADES.length - 1) return null;

            let baseGrade = '';
            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);
            if (isSingleWorld) {
              const list = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
              let bestIndex = -1;
              Object.keys(list).forEach(function(key) {
                const task = list[key] || {};
                if (String(task.委托方 || '').trim() !== '主神任务') return;
                if (String(task.状态 || '').trim() !== '可结算') return;
                const idx = GRADES.indexOf(gradeTier(task.难度 || ''));
                if (idx > bestIndex) bestIndex = idx;
              });
              if (bestIndex >= 0) baseGrade = GRADES[bestIndex];
            } else {
              baseGrade = gradeFloor(stat.世界 && stat.世界.难度);
            }

            const gradeIndex = GRADES.indexOf(baseGrade);
            const targetIndex = reincarnatorIndex + 1;
            if (gradeIndex < targetIndex) return null;
            const grantGrade = baseGrade;
            return { grade:grantGrade, name:grantGrade + '级权限凭证', reincarnatorTier:tierRaw, sourceGrade:baseGrade };
          }
'''
new_credential = '''          // SETTLEMENT_CREDENTIAL_CORE_START
          function resolveCredentialGrant(data) {
            const stat = data && (data.stat_data || data);
            if (!stat || !stat.角色) return null;
            const LIFE_TIERS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
            const tierRaw = String(stat.角色.层级 || 'Ⅰ').trim();
            let reincarnatorIndex = LIFE_TIERS.indexOf(tierRaw);
            if (reincarnatorIndex < 0) reincarnatorIndex = GRADES.indexOf(gradeTier(tierRaw));
            if (reincarnatorIndex < 0) reincarnatorIndex = 0;
            if (reincarnatorIndex >= GRADES.length - 1) return null;

            const list = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            let bestIndex = -1;
            Object.keys(list).forEach(function(key) {
              const task = list[key] || {};
              if (String(task.委托方 || '').trim() !== '主神任务') return;
              if (String(task.状态 || '').trim() !== '可结算') return;
              const idx = GRADES.indexOf(gradeTier(task.难度 || ''));
              if (idx > bestIndex) bestIndex = idx;
            });
            if (bestIndex < 0) return null;

            const targetIndex = reincarnatorIndex + 1;
            if (bestIndex < targetIndex) return null;
            const grantGrade = GRADES[bestIndex];
            return { grade:grantGrade, name:grantGrade + '级权限凭证', reincarnatorTier:tierRaw, sourceGrade:grantGrade };
          }
          // SETTLEMENT_CREDENTIAL_CORE_END
'''
replace_once(old_credential, new_credential, 'credential eligibility')

path.write_text(text, encoding='utf-8')
print('settlement side rewards rebalanced')
