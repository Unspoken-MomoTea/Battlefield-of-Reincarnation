from pathlib import Path
import re
import subprocess

STATUS = Path('script/悬浮球状态栏.js')
SETTLE = Path('Regular/结算任务美化.html')


def read_keep_newline(path):
    raw = path.read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl


def write_keep_newline(path, text, nl):
    text = text.replace('\r\n', '\n')
    if nl == '\r\n':
        text = text.replace('\n', '\r\n')
    path.write_bytes(text.encode('utf-8'))


status, status_nl = read_keep_newline(STATUS)
settle, settle_nl = read_keep_newline(SETTLE)

# 1) 升阶费用常量
anchor = "    var TRIAL_SCORE_THRESHOLD = 24;\n"
assert status.count(anchor) == 1, 'TRIAL_SCORE_THRESHOLD anchor mismatch'
status = status.replace(anchor, """    var TRIAL_SCORE_THRESHOLD = 24;
    /* 源力灌注普升费用：仅允许当前层级 → 下一层级，且必须消耗对应下一阶权限凭证×1。 */
    var SOURCE_INFUSION_COSTS = {
        'E': 2000,
        'D': 10000,
        'C': 50000,
        'B': 200000,
        'A': 800000,
        'S': 3200000,
        'SS': 12800000,
        'SSS': 51200000
    };
""", 1)

# 2) 源力灌注统一计划/扣费/执行；只认自身层级，严格逐级
anchor = "    /* 取层级显示文本(罗马数字); 兼容旧数据中存的品质字母→转对应罗马数字; 非法值回落 Ⅰ */\n"
assert status.count(anchor) == 1, 'tier helper anchor mismatch'
helpers = r'''    /* 权限凭证持有数：新格式读取道具数量；兼容旧存档中同名状态凭证。 */
    function sourceInfusionCredentialQty(hero, credentialName) {
        if (!hero || !credentialName) return 0;
        var total = 0;
        var items = hero.道具 || {};
        var item = items[credentialName];
        if (item && typeof item === 'object') {
            var q = Object.prototype.hasOwnProperty.call(item, '数量') ? safeNum(item.数量, 0) : 1;
            total += Math.max(0, q);
        }
        var states = hero.状态 || {};
        if (states && Object.prototype.hasOwnProperty.call(states, credentialName)) total += 1;
        return total;
    }

    /* 消耗恰好1枚指定凭证；优先消耗道具堆叠，旧状态凭证仅作兼容兜底。 */
    function sourceInfusionConsumeCredential(hero, credentialName) {
        if (!hero || !credentialName) return false;
        hero.道具 = hero.道具 || {};
        var item = hero.道具[credentialName];
        if (item && typeof item === 'object') {
            var q = Object.prototype.hasOwnProperty.call(item, '数量') ? safeNum(item.数量, 0) : 1;
            if (q > 0) {
                q -= 1;
                if (q <= 0) delete hero.道具[credentialName];
                else item.数量 = q;
                return true;
            }
        }
        hero.状态 = hero.状态 || {};
        if (Object.prototype.hasOwnProperty.call(hero.状态, credentialName)) {
            delete hero.状态[credentialName];
            return true;
        }
        return false;
    }

    /* 统一生成一次“当前层级→下一层级”的源力灌注计划；绝不按凭证品质跳级。 */
    function sourceInfusionPlan(sd, targetName) {
        if (!sd || !sd.主角) return { error:'数据未就绪' };
        var isHero = (targetName === '主角');
        var target = isHero ? sd.主角 : (sd.关系列表 && sd.关系列表[targetName]);
        if (!target) return { error:'未找到目标角色' };
        if (!isHero && target.是否队友 !== true) return { error:'仅队友可使用源力灌注' };
        if (sd.系统状态 && sd.系统状态.是否战斗中 === true) return { error:'请在安全区域内再重新尝试' };
        if (isHero && sd.系统状态 && sd.系统状态.试炼已完成 === true) return { error:'晋升试炼已完成，请直接使用「开始进阶」' };

        var currentTier = normalizeLifeTier(target.层级);
        var idx = TIER_ROMAN.indexOf(currentTier);
        if (idx < 0) idx = 0;
        if (idx >= TIER_ROMAN.length - 1) return { error:'当前已是最高层级' };
        var score = calcTrialScore(target.最终属性 || {}, currentTier);
        if (score < TRIAL_SCORE_THRESHOLD) return { error:'段位累计尚未满足普升要求' };

        var nextTier = TIER_ROMAN[idx + 1];
        var nextGrade = TIER_QUALITY[idx + 1];
        var credentialName = nextGrade + '级权限凭证';
        return {
            isHero: isHero,
            targetName: targetName,
            currentTier: currentTier,
            nextTier: nextTier,
            nextGrade: nextGrade,
            score: score,
            cost: safeNum(SOURCE_INFUSION_COSTS[nextGrade], 0),
            credentialName: credentialName,
            coin: safeNum(sd.主角.空间币, 0),
            credentialQty: sourceInfusionCredentialQty(sd.主角, credentialName)
        };
    }

    function sourceInfusionFmtNum(v) {
        var n = Math.max(0, Math.floor(safeNum(v, 0)));
        return n.toLocaleString ? n.toLocaleString() : String(n);
    }

    function openSourceInfusion(targetName) {
        targetName = targetName || '主角';
        var first = sourceInfusionPlan(getStatData(), targetName);
        if (first.error) { samToast('warning', first.error); return; }
        var label = first.isHero ? '主角' : first.targetName;
        var body = '目标: '+label+' '+first.currentTier+' → '+first.nextTier+'（'+first.nextGrade+'）'
            +' ｜ 空间币: '+sourceInfusionFmtNum(first.cost)+'（持有 '+sourceInfusionFmtNum(first.coin)+'）'
            +' ｜ 凭证: '+first.credentialName+' ×1（持有 ×'+first.credentialQty+'）'
            +' ｜ 确认后由主角账户支付，并直接完成本次普升。';
        samConfirm('源力灌注 · '+first.currentTier+' → '+first.nextTier, body, function() {
            var latest = sourceInfusionPlan(getStatData(), targetName);
            if (latest.error) { samToast('warning', latest.error); return; }
            if (latest.coin < latest.cost) {
                samToast('warning', '空间币不足：需要 '+sourceInfusionFmtNum(latest.cost));
                return;
            }
            if (latest.credentialQty < 1) {
                samToast('warning', '缺少 '+latest.credentialName+' ×1');
                return;
            }

            var applied = false;
            var opts = latest.isHero ? { tierPermit: latest.nextTier } : undefined;
            var ok = writeBackMvu(function(statData) {
                var check = sourceInfusionPlan(statData, targetName);
                if (check.error || check.nextTier !== latest.nextTier || check.nextGrade !== latest.nextGrade) return;
                if (check.coin < check.cost || check.credentialQty < 1) return;
                var payer = statData.主角;
                var target = check.isHero ? payer : (statData.关系列表 && statData.关系列表[check.targetName]);
                if (!target || (!check.isHero && target.是否队友 !== true)) return;
                if (!sourceInfusionConsumeCredential(payer, check.credentialName)) return;
                payer.空间币 = Math.max(0, safeNum(payer.空间币, 0) - check.cost);
                target.层级 = check.nextTier;
                if (check.isHero && statData.系统状态) statData.系统状态.试炼已完成 = false;
                applied = true;
            }, opts);
            if (ok && applied) {
                samToast('success', label+' 已通过源力灌注提升至 '+latest.nextTier+' 级');
                renderAll();
            } else {
                samToast('error', '源力灌注失败，资源或角色状态已发生变化');
            }
        });
    }

'''
status = status.replace(anchor, helpers + anchor, 1)

# 3) 样式：申请进阶 + 源力灌注并列，NPC复用进度条
old_css = """        /* 进阶按钮: 仅在属性总点达下一层级下限时渲染; 两态色调 */
        .sam-tier-adv-btn { margin-top:4px; padding:5px 14px; font-size:12px; font-weight:900; border:1px solid; border-radius:6px; cursor:pointer; align-self:flex-start; transition:all 0.18s; letter-spacing:1px; }
        .sam-tier-adv-btn.apply { border-color:#7a1f1f; color:#e04848; background:rgba(122,31,31,0.18); text-shadow:0 0 4px rgba(224,72,72,0.5); }
        .sam-tier-adv-btn.apply:hover { background:#7a1f1f; color:#fff; box-shadow:0 0 10px rgba(224,72,72,0.7); }
        .sam-tier-adv-btn.start { border-color:#d4af37; color:#fff7d6; background:linear-gradient(135deg, rgba(212,175,55,0.25), rgba(255,247,214,0.12)); text-shadow:0 0 5px rgba(255,247,214,0.8); box-shadow:0 0 8px rgba(212,175,55,0.5); }
        .sam-tier-adv-btn.start:hover { background:linear-gradient(135deg, #d4af37, #fff7d6); color:#2a2300; box-shadow:0 0 14px rgba(255,247,214,0.9); }
"""
assert status.count(old_css) == 1, 'tier button css anchor mismatch'
new_css = """        /* 进阶按钮: 段位累计达标后显示；源力灌注与申请进阶并列。 */
        .sam-tier-actions { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:4px; }
        .sam-tier-adv-btn, .sam-tier-infuse-btn { padding:5px 14px; font-size:12px; font-weight:900; border:1px solid; border-radius:6px; cursor:pointer; transition:all 0.18s; letter-spacing:1px; }
        .sam-tier-adv-btn.apply { border-color:#7a1f1f; color:#e04848; background:rgba(122,31,31,0.18); text-shadow:0 0 4px rgba(224,72,72,0.5); }
        .sam-tier-adv-btn.apply:hover { background:#7a1f1f; color:#fff; box-shadow:0 0 10px rgba(224,72,72,0.7); }
        .sam-tier-adv-btn.start { margin-top:4px; align-self:flex-start; border-color:#d4af37; color:#fff7d6; background:linear-gradient(135deg, rgba(212,175,55,0.25), rgba(255,247,214,0.12)); text-shadow:0 0 5px rgba(255,247,214,0.8); box-shadow:0 0 8px rgba(212,175,55,0.5); }
        .sam-tier-adv-btn.start:hover { background:linear-gradient(135deg, #d4af37, #fff7d6); color:#2a2300; box-shadow:0 0 14px rgba(255,247,214,0.9); }
        .sam-tier-infuse-btn { border-color:#7c5cff; color:#c9c0ff; background:rgba(124,92,255,0.14); text-shadow:0 0 5px rgba(124,92,255,0.55); }
        .sam-tier-infuse-btn:hover { background:#7c5cff; color:#fff; box-shadow:0 0 12px rgba(124,92,255,0.75); }
        .sam-tier-prog.npc { margin:7px 0 3px; padding:6px 8px; }
        .sam-tier-prog.npc .sam-tier-side { font-size:15px; min-width:28px; }
        .sam-tier-prog.npc .sam-tier-bar { height:11px; }
"""
status = status.replace(old_css, new_css, 1)

# 4) 主角段位条与NPC段位条：进阶必须按自身层级逐步执行
pat = re.compile(r"    /\* 层级进度条:.*?\n    function renderTierProgressBar\(p, fa, sys\) \{.*?\n    \}\n\n    /\* ===== 24\. Tab: 信息\(主角详情\) ===== \*/", re.S)
m = pat.search(status)
assert m, 'renderTierProgressBar block not found'
replacement = r'''    /* 层级进度条: 普升只读取角色自身层级；段位累计≥24后可走试炼或源力灌注两条路径。 */
    function renderTierProgressBar(p, fa, sys) {
        var lifeTier = normalizeLifeTier(p && p.层级);
        var curTier = tierQOfClass(lifeTier);
        var attrs = fa || p.最终属性 || {};
        var score = calcTrialScore(attrs, lifeTier);
        var idx = TIER_ROMAN.indexOf(lifeTier);
        if (idx < 0) idx = 0;
        var isMax = (idx >= TIER_ROMAN.length - 1);
        var pct = isMax ? 100 : Math.max(0, Math.min(100, Math.floor((score / TRIAL_SCORE_THRESHOLD) * 100)));
        var advBtnHtml = '';
        var st = sys || {};
        var canTrial = (st.是否可试炼 === true);
        var trialDone = (st.试炼已完成 === true);
        if (!isMax && canTrial && trialDone) {
            advBtnHtml = '<button type="button" class="sam-tier-adv-btn start" data-tier-act="start" data-tier-next="'+esc(TIER_ROMAN[idx+1])+'">✦ 开始进阶</button>';
        } else if (!isMax && canTrial) {
            advBtnHtml = '<div class="sam-tier-actions">'
                + '<button type="button" class="sam-tier-adv-btn apply" data-tier-act="apply" data-tier-next="'+esc(TIER_ROMAN[idx+1])+'">☠ 申请进阶</button>'
                + '<button type="button" class="sam-tier-infuse-btn" data-tier-target="主角">✧ 源力灌注</button>'
                + '</div>';
        }
        var leftHtml = '<div class="sam-tier-side q-'+curTier+'">'+esc(TIER_ROMAN[idx])+'</div>';
        var rightHtml = isMax
            ? '<div class="sam-tier-side max">MAX</div>'
            : '<div class="sam-tier-side next q-'+TIER_QUALITY[idx+1]+'">'+esc(TIER_ROMAN[idx+1])+'</div>';
        var midHtml = '<div class="sam-tier-mid">'
            + '<div class="sam-tier-sum"><span>段位累计</span><span class="v">'+score+' / '+TRIAL_SCORE_THRESHOLD+'</span></div>'
            + '<div class="sam-tier-bar"><div class="bar-fill" style="width:'+pct+'%;"></div></div>'
            + advBtnHtml
            + '</div>';
        return '<div class="sam-tier-prog">'+leftHtml+midHtml+rightHtml+'</div>';
    }

    /* 队友段位累计：满24点时提供源力灌注，不建立NPC专属试炼状态。 */
    function renderNpcTierProgressBar(n, name) {
        if (!n || n.是否队友 !== true) return '';
        var lifeTier = normalizeLifeTier(n.层级);
        var idx = TIER_ROMAN.indexOf(lifeTier);
        if (idx < 0) idx = 0;
        var isMax = (idx >= TIER_ROMAN.length - 1);
        var score = calcTrialScore(n.最终属性 || {}, lifeTier);
        var pct = isMax ? 100 : Math.max(0, Math.min(100, Math.floor((score / TRIAL_SCORE_THRESHOLD) * 100)));
        var btn = (!isMax && score >= TRIAL_SCORE_THRESHOLD)
            ? '<button type="button" class="sam-tier-infuse-btn" data-tier-target="'+esc(name)+'">✧ 源力灌注</button>'
            : '';
        var left = '<div class="sam-tier-side q-'+TIER_QUALITY[idx]+'">'+esc(lifeTier)+'</div>';
        var right = isMax
            ? '<div class="sam-tier-side max">MAX</div>'
            : '<div class="sam-tier-side next q-'+TIER_QUALITY[idx+1]+'">'+esc(TIER_ROMAN[idx+1])+'</div>';
        var mid = '<div class="sam-tier-mid">'
            + '<div class="sam-tier-sum"><span>段位累计</span><span class="v">'+score+' / '+TRIAL_SCORE_THRESHOLD+'</span></div>'
            + '<div class="sam-tier-bar"><div class="bar-fill" style="width:'+pct+'%;"></div></div>'
            + (btn ? '<div class="sam-tier-actions">'+btn+'</div>' : '')
            + '</div>';
        return '<div class="sam-tier-prog npc">'+left+mid+right+'</div>';
    }

    /* ===== 24. Tab: 信息(主角详情) ===== */'''
status = status[:m.start()] + replacement + status[m.end():]

# 5) 队友卡片挂进度条
anchor = "                card += '<div class=\"sam-npc-grid\">'+grid+'</div>';\n                // 进度条 HP/EP/THP\n"
assert status.count(anchor) == 1, 'npc progress insertion anchor mismatch'
status = status.replace(anchor, "                card += '<div class=\"sam-npc-grid\">'+grid+'</div>';\n                if (n.是否队友 === true) card += renderNpcTierProgressBar(n, it.key);\n                // 进度条 HP/EP/THP\n", 1)

# 6) 按钮点击不能触发NPC详情卡
anchor = "        $panel.off('click.samCard').on('click.samCard', '.sam-card', function(e) {\n            var path = $(this).data('path');\n"
assert status.count(anchor) == 1, 'samCard anchor mismatch'
status = status.replace(anchor, "        $panel.off('click.samCard').on('click.samCard', '.sam-card', function(e) {\n            if ($(e.target).closest('.sam-tier-infuse-btn').length) return;\n            var path = $(this).data('path');\n", 1)

# 7) 按钮事件
anchor = "        // ★ 进阶按钮(层级进度条中部): 属性总点达下层级下限才显示; 战斗中拦截\n"
assert status.count(anchor) == 1, 'tier event anchor mismatch'
status = status.replace(anchor, r'''        // ★ 源力灌注：主角/队友共用同一执行器；只允许当前层级→下一层级。
        $panel.off('click.samSourceInfusion').on('click.samSourceInfusion', '.sam-tier-infuse-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openSourceInfusion($(this).attr('data-tier-target') || '主角');
        });
''' + anchor, 1)

# 8) 结算凭证：难度达到下一阶即可；无论更高多少都只发下一阶凭证
pat = re.compile(r"          function resolveCredentialGrant\(data\) \{.*?\n          \}\n\n          function renderCredentialPanel\(grant\) \{.*?\n          \}\n", re.S)
m = pat.search(settle)
assert m, 'credential resolver/render block not found'
replacement = r'''          function resolveCredentialGrant(data) {
            const stat = data && (data.stat_data || data);
            if (!stat || !stat.主角) return null;
            const LIFE_TIERS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
            const tierRaw = String(stat.主角.层级 || 'Ⅰ').trim();
            let heroIndex = LIFE_TIERS.indexOf(tierRaw);
            if (heroIndex < 0) heroIndex = GRADES.indexOf(gradeTier(tierRaw));
            if (heroIndex < 0) heroIndex = 0;
            if (heroIndex >= GRADES.length - 1) return null;

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
            const targetIndex = heroIndex + 1;
            if (gradeIndex < targetIndex) return null;
            const grantGrade = GRADES[targetIndex];
            return { grade:grantGrade, name:grantGrade + '级权限凭证', heroTier:tierRaw, sourceGrade:baseGrade };
          }

          function renderCredentialPanel(grant) {
            if (!grant) return '';
            return '<div class="st-cert">' +
              '<div class="st-cert-title">◆ 主神权限凭证</div>' +
              '<div class="st-kv"><span class="k">凭证等级</span><span class="v">' + gradeBadge(grant.grade, false) + '</span></div>' +
              '<div class="st-cert-desc">系统核录完毕，本次获得【' + escapeHtml(grant.name) + '】×1。凭证可累计持有，源力灌注普升时每次消耗1枚。</div>' +
              '</div>';
          }
'''
settle = settle[:m.start()] + replacement + settle[m.end():]

# 9) 结算凭证改为可堆叠；按上一楼层基线补足“本次+1”，防普通重复渲染双发
pat = re.compile(r"              if \(credentialGrant\) \{\n                const key = 'stat_data\.主角\.道具\.' \+ credentialGrant\.name;.*?\n              \}\n\n              function parseEffectLines", re.S)
m = pat.search(settle)
assert m, 'credential write block not found'
replacement = r'''              if (credentialGrant) {
                const key = 'stat_data.主角.道具.' + credentialGrant.name;
                const old = win._.get(c, key) || {};
                const currentQty = (old && typeof old === 'object' && Object.keys(old).length)
                  ? (Object.prototype.hasOwnProperty.call(old, '数量') ? (Number(old.数量) || 0) : 1)
                  : 0;
                const baselineOld = settlementBaselineData ? (win._.get(settlementBaselineData, key) || {}) : {};
                const baselineQty = (baselineOld && typeof baselineOld === 'object' && Object.keys(baselineOld).length)
                  ? (Object.prototype.hasOwnProperty.call(baselineOld, '数量') ? (Number(baselineOld.数量) || 0) : 1)
                  : 0;
                const requiredQty = baselineQty + 1;
                const missing = Math.max(0, requiredQty - currentQty);
                if (missing > 0) {
                  const tags = Array.isArray(old.标签) ? old.标签.slice() : [];
                  ['主神空间','权限凭证'].forEach(function(t) { if (tags.indexOf(t) < 0) tags.push(t); });
                  win._.set(c, key + '.品质', credentialGrant.grade);
                  win._.set(c, key + '.类型', '权限凭证');
                  win._.set(c, key + '.数量', currentQty + missing);
                  win._.set(c, key + '.标签', tags);
                  win._.set(c, key + '.效果', old.效果 && typeof old.效果 === 'object' ? old.效果 : { 商城权限:'永久解锁主神商城' + credentialGrant.grade + '级跨阶购买与升级权限。' });
                  win._.set(c, key + '.描述', old.描述 || '主神结算授予的永久权限凭证，可累计持有；源力灌注普升时消耗1枚。');
                  win._.set(c, key + '.状态', [0,1,2].includes(Number(old.状态)) ? Number(old.状态) : 0);
                  changed = true;
                }
              }

              function parseEffectLines'''
settle = settle[:m.start()] + replacement + settle[m.end():]

write_keep_newline(STATUS, status, status_nl)
write_keep_newline(SETTLE, settle, settle_nl)

# 10) 语义断言
s = STATUS.read_text(encoding='utf-8')
h = SETTLE.read_text(encoding='utf-8')
for token in [
    "'E': 2000", "'D': 10000", "'C': 50000", "'B': 200000",
    "'A': 800000", "'S': 3200000", "'SS': 12800000", "'SSS': 51200000",
    'function sourceInfusionPlan(sd, targetName)',
    'function sourceInfusionConsumeCredential(hero, credentialName)',
    'function openSourceInfusion(targetName)',
    'renderNpcTierProgressBar(n, it.key)',
    'data-tier-target="主角"',
    'var currentTier = normalizeLifeTier(target.层级);',
    'var nextTier = TIER_ROMAN[idx + 1];',
    "var credentialName = nextGrade + '级权限凭证';",
    'sourceInfusionConsumeCredential(payer, check.credentialName)',
]:
    assert token in s, token

tier_fn = s[s.index('function renderTierProgressBar'):s.index('/* ===== 24. Tab: 信息')]
assert 'normalizeLifeTier(p && p.层级)' in tier_fn
assert 'displayTierRaw(p)' not in tier_fn

for token in [
    'const targetIndex = heroIndex + 1;',
    'if (gradeIndex < targetIndex) return null;',
    'const grantGrade = GRADES[targetIndex];',
    'const requiredQty = baselineQty + 1;',
    "win._.set(c, key + '.数量', currentQty + missing);",
    '凭证可累计持有，源力灌注普升时每次消耗1枚',
]:
    assert token in h, token
resolver = h[h.index('function resolveCredentialGrant'):h.index('function renderCredentialPanel')]
assert 'gradeIndex <= normalViewIndex' not in resolver
assert 'hasOwnProperty.call(items, name)' not in resolver

# 11) JS语法检查
subprocess.run(['node', '--check', str(STATUS)], check=True)
scripts = re.findall(r'<script>([\s\S]*?)</script>', h)
assert scripts, 'no settlement script block found'
tmp = Path('/tmp/settlement-renderer.js')
tmp.write_text('\n'.join(scripts), encoding='utf-8')
subprocess.run(['node', '--check', str(tmp)], check=True)
print('source infusion patch validated')
