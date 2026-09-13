from pathlib import Path
import re
import sys

mode = sys.argv[1] if len(sys.argv) > 1 else ''
if mode not in {'test', 'impl'}:
    raise SystemExit('usage: patch-credential-explanation.py test|impl')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


if mode == 'test':
    path = Path('tests/task-settlement-simplified.cjs')
    text = path.read_text(encoding='utf-8')

    text = replace_once(
        text,
        "assert.match(settleUi, /SETTLEMENT_CREDENTIAL_CORE_START/);\n",
        "assert.match(settleUi, /SETTLEMENT_CREDENTIAL_CORE_START/);\n"
        "assert.match(settleUi, /function resolveCredentialDecision\\s*\\(/);\n"
        "assert.match(settleUi, /const credentialDecision = resolveCredentialDecision\\(settlementBaselineData\\)/);\n"
        "assert.match(settleUi, /renderCredentialPanel\\(credentialDecision\\)/);\n",
        'credential explanation structure assertions'
    )

    text = replace_once(
        text,
        "const resolveCredentialGrant = new Function(`\n",
        "const credentialResolvers = new Function(`\n",
        'credential resolver harness start'
    )
    text = replace_once(
        text,
        "  return resolveCredentialGrant;\n`)();\n",
        "  return { resolveCredentialGrant, resolveCredentialDecision };\n`)();\n"
        "const { resolveCredentialGrant, resolveCredentialDecision } = credentialResolvers;\n",
        'credential resolver harness return'
    )

    text = replace_once(
        text,
        "assert.equal(failedCredential, null, 'no successful main task means no permission credential');\n",
        "assert.equal(failedCredential, null, 'no successful main task means no permission credential');\n\n"
        "const failedDecision = resolveCredentialDecision({\n"
        "  stat_data: {\n"
        "    设置: { 单一世界: false },\n"
        "    角色: { 层级: 'Ⅰ' },\n"
        "    世界: { 难度: 'D~A' },\n"
        "    任务: { 列表: {\n"
        "      任务一: { 委托方: '主神任务', 状态: '失败', 难度: 'D' },\n"
        "      任务二: { 委托方: '主神任务', 状态: '进行中', 难度: 'A' },\n"
        "    } },\n"
        "  },\n"
        "});\n"
        "assert.equal(failedDecision.granted, false);\n"
        "assert.equal(failedDecision.reasonCode, 'no_success_task');\n",
        'failed decision regression'
    )

    text = replace_once(
        text,
        "assert.equal(ordinaryCredential && ordinaryCredential.grade, 'D', 'ordinary reincarnation worlds grant by world minimum difficulty once any main task succeeds');\n",
        "assert.equal(ordinaryCredential && ordinaryCredential.grade, 'D', 'ordinary reincarnation worlds grant by world minimum difficulty once any main task succeeds');\n"
        "assert.equal(ordinaryCredential && ordinaryCredential.basis, '世界最低难度');\n"
        "assert.equal(ordinaryCredential && ordinaryCredential.playerGrade, 'F');\n"
        "assert.equal(ordinaryCredential && ordinaryCredential.requiredGrade, 'E');\n",
        'ordinary credential explanation metadata'
    )

    text = replace_once(
        text,
        "assert.equal(singleWorldCredential && singleWorldCredential.grade, 'B', 'single-world credential grade comes from the highest successful main-task difficulty');\n",
        "assert.equal(singleWorldCredential && singleWorldCredential.grade, 'B', 'single-world credential grade comes from the highest successful main-task difficulty');\n"
        "assert.equal(singleWorldCredential && singleWorldCredential.basis, '成功主神任务最高难度');\n\n"
        "const sameGradeDecision = resolveCredentialDecision({\n"
        "  stat_data: {\n"
        "    设置: { 单一世界: false },\n"
        "    角色: { 层级: 'Ⅲ' },\n"
        "    世界: { 难度: 'D~A' },\n"
        "    任务: { 列表: {\n"
        "      任务一: { 委托方: '主神任务', 状态: '可结算', 难度: 'A' },\n"
        "    } },\n"
        "  },\n"
        "});\n"
        "assert.equal(sameGradeDecision.granted, false);\n"
        "assert.equal(sameGradeDecision.reasonCode, 'grade_not_high_enough');\n"
        "assert.equal(sameGradeDecision.sourceGrade, 'D');\n"
        "assert.equal(sameGradeDecision.playerGrade, 'D');\n"
        "assert.equal(sameGradeDecision.requiredGrade, 'C');\n\n"
        "const maxTierDecision = resolveCredentialDecision({\n"
        "  stat_data: {\n"
        "    设置: { 单一世界: false },\n"
        "    角色: { 层级: 'Ⅸ' },\n"
        "    世界: { 难度: 'SSS' },\n"
        "    任务: { 列表: {\n"
        "      任务一: { 委托方: '主神任务', 状态: '可结算', 难度: 'SSS' },\n"
        "    } },\n"
        "  },\n"
        "});\n"
        "assert.equal(maxTierDecision.granted, false);\n"
        "assert.equal(maxTierDecision.reasonCode, 'max_tier');\n\n"
        "const credentialPanelMatch = settleUi.match(/          function renderCredentialPanel\\(decision\\) \\{([\\s\\S]*?)\\n          \\}\\n\\n          function trialScore/);\n"
        "assert(credentialPanelMatch, 'credential explanation panel should be extractable');\n"
        "const renderCredentialPanel = new Function('escapeHtml', 'gradeBadge', `\n"
        "  return function renderCredentialPanel(decision) {${credentialPanelMatch[1]}\n  };\n"
        "`)(value => String(value == null ? '' : value), grade => '<span>' + grade + '</span>');\n"
        "const failedPanelHtml = renderCredentialPanel(failedDecision);\n"
        "assert.match(failedPanelHtml, /本次未获得权限凭证/);\n"
        "assert.match(failedPanelHtml, /没有已完成主神任务/);\n"
        "const sameGradePanelHtml = renderCredentialPanel(sameGradeDecision);\n"
        "assert.match(sameGradePanelHtml, /最低需C级/);\n"
        "assert.match(sameGradePanelHtml, /D级未达到门槛/);\n"
        "const grantedPanelHtml = renderCredentialPanel(ordinaryCredential);\n"
        "assert.match(grantedPanelHtml, /本次获得【D级权限凭证】×1/);\n"
        "assert.match(grantedPanelHtml, /世界最低难度 D/);\n"
        "assert.match(grantedPanelHtml, /当前先驱层级Ⅰ/);\n",
        'credential panel behavior regression'
    )

    path.write_text(text, encoding='utf-8')
    print('credential explanation regression staged')

else:
    path = Path('Regular/结算任务美化.html')
    text = path.read_text(encoding='utf-8')

    core = '''          // SETTLEMENT_CREDENTIAL_CORE_START
          function resolveCredentialDecision(data) {
            const stat = data && (data.stat_data || data);
            if (!stat || !stat.角色) {
              return { granted:false, reasonCode:'missing_data', grade:'', name:'', playerTier:'', playerGrade:'', requiredGrade:'', sourceGrade:'', basis:'', successfulTaskCount:0 };
            }
            const LIFE_TIERS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
            const tierRaw = String(stat.角色.层级 || 'Ⅰ').trim();
            let reincarnatorIndex = LIFE_TIERS.indexOf(tierRaw);
            if (reincarnatorIndex < 0) reincarnatorIndex = GRADES.indexOf(gradeTier(tierRaw));
            if (reincarnatorIndex < 0) reincarnatorIndex = 0;
            const playerGrade = GRADES[reincarnatorIndex] || GRADES[0];
            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);
            const basis = isSingleWorld ? '成功主神任务最高难度' : '世界最低难度';

            if (reincarnatorIndex >= GRADES.length - 1) {
              return { granted:false, reasonCode:'max_tier', grade:'', name:'', playerTier:tierRaw, playerGrade:playerGrade, requiredGrade:'', sourceGrade:'', basis:basis, successfulTaskCount:0 };
            }

            const list = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
            let successfulTaskCount = 0;
            let bestIndex = -1;
            Object.keys(list).forEach(function(key) {
              const task = list[key] || {};
              if (String(task.委托方 || '').trim() !== '主神任务') return;
              if (String(task.状态 || '').trim() !== '可结算') return;
              successfulTaskCount += 1;
              if (!isSingleWorld) return;
              const idx = GRADES.indexOf(gradeTier(task.难度 || ''));
              if (idx > bestIndex) bestIndex = idx;
            });

            if (!successfulTaskCount) {
              return { granted:false, reasonCode:'no_success_task', grade:'', name:'', playerTier:tierRaw, playerGrade:playerGrade, requiredGrade:GRADES[reincarnatorIndex + 1] || '', sourceGrade:'', basis:basis, successfulTaskCount:0 };
            }

            let baseGrade = '';
            if (isSingleWorld) {
              if (bestIndex >= 0) baseGrade = GRADES[bestIndex];
            } else {
              baseGrade = gradeFloor(stat.世界 && stat.世界.难度);
            }

            const gradeIndex = GRADES.indexOf(baseGrade);
            const targetIndex = reincarnatorIndex + 1;
            const requiredGrade = GRADES[targetIndex] || '';
            if (gradeIndex < 0) {
              return { granted:false, reasonCode:'invalid_source_grade', grade:'', name:'', playerTier:tierRaw, playerGrade:playerGrade, requiredGrade:requiredGrade, sourceGrade:'', basis:basis, successfulTaskCount:successfulTaskCount };
            }
            if (gradeIndex < targetIndex) {
              return { granted:false, reasonCode:'grade_not_high_enough', grade:'', name:'', playerTier:tierRaw, playerGrade:playerGrade, requiredGrade:requiredGrade, sourceGrade:baseGrade, basis:basis, successfulTaskCount:successfulTaskCount };
            }

            return {
              granted:true,
              reasonCode:'granted',
              grade:baseGrade,
              name:baseGrade + '级权限凭证',
              playerTier:tierRaw,
              playerGrade:playerGrade,
              requiredGrade:requiredGrade,
              sourceGrade:baseGrade,
              basis:basis,
              successfulTaskCount:successfulTaskCount
            };
          }

          function resolveCredentialGrant(data) {
            const decision = resolveCredentialDecision(data);
            return decision && decision.granted ? decision : null;
          }
          // SETTLEMENT_CREDENTIAL_CORE_END'''

    text, count = re.subn(
        r'          // SETTLEMENT_CREDENTIAL_CORE_START[\s\S]*?          // SETTLEMENT_CREDENTIAL_CORE_END',
        core,
        text,
        count=1
    )
    if count != 1:
        raise SystemExit(f'credential core: expected exactly one replacement, got {count}')

    old_panel = '''          function renderCredentialPanel(grant) {
            if (!grant) return '';
            return '<div class="st-cert">' +
              '<div class="st-cert-title">◆ 主神权限凭证</div>' +
              '<div class="st-kv"><span class="k">凭证等级</span><span class="v">' + gradeBadge(grant.grade, false) + '</span></div>' +
              '<div class="st-cert-desc">系统核录完毕，本次获得【' + escapeHtml(grant.name) + '】×1。凭证可累计持有，源力灌注普升时每次消耗1枚。</div>' +
              '</div>';
          }
'''
    new_panel = '''          function renderCredentialPanel(decision) {
            decision = decision || { granted:false, reasonCode:'missing_data' };
            const reasons = [];
            if (decision.granted) {
              reasons.push('判定依据：' + decision.basis + ' ' + decision.sourceGrade + '；本次检测到' + decision.successfulTaskCount + '个已完成主神任务。');
              reasons.push('层级门槛：当前先驱层级' + decision.playerTier + '（同阶' + decision.playerGrade + '），凭证必须高于当前层级，最低需' + decision.requiredGrade + '级。');
              reasons.push(decision.sourceGrade + '级达到门槛，因此发放' + decision.grade + '级权限凭证。');
            } else if (decision.reasonCode === 'no_success_task') {
              reasons.push('本次没有已完成主神任务，未触发权限凭证发放。');
            } else if (decision.reasonCode === 'grade_not_high_enough') {
              reasons.push('判定依据：' + decision.basis + ' ' + decision.sourceGrade + '。');
              reasons.push('层级门槛：当前先驱层级' + decision.playerTier + '（同阶' + decision.playerGrade + '），凭证必须高于当前层级，最低需' + decision.requiredGrade + '级；' + decision.sourceGrade + '级未达到门槛。');
            } else if (decision.reasonCode === 'max_tier') {
              reasons.push('当前先驱层级已达Ⅸ，已无更高等级权限凭证可发放。');
            } else if (decision.reasonCode === 'invalid_source_grade') {
              reasons.push('未取得有效的凭证判定难度，无法发放权限凭证。');
            } else {
              reasons.push('结算数据不完整，无法进行权限凭证判定。');
            }

            const reasonHtml = reasons.map(function(reason) {
              return '<div class="st-cert-reason">' + escapeHtml(reason) + '</div>';
            }).join('');
            const gradeHtml = decision.granted
              ? '<div class="st-kv"><span class="k">凭证等级</span><span class="v">' + gradeBadge(decision.grade, false) + '</span></div>'
              : '<div class="st-cert-status">本次未获得权限凭证</div>';
            const resultHtml = decision.granted
              ? '<div class="st-cert-desc">系统核录完毕，本次获得【' + escapeHtml(decision.name) + '】×1。凭证可累计持有，源力灌注普升时每次消耗1枚。</div>'
              : '';
            return '<div class="st-cert' + (decision.granted ? '' : ' no-grant') + '">' +
              '<div class="st-cert-title">◆ 主神权限凭证</div>' +
              gradeHtml + resultHtml +
              '<div class="st-cert-reasons">' + reasonHtml + '</div>' +
              '</div>';
          }
'''
    text = replace_once(text, old_panel, new_panel, 'credential panel renderer')

    old_style = "      .st-cert-desc { font-size: 0.8em; color: #d6c791; line-height: 1.7; padding: 2px 0; }\n"
    new_style = old_style + (
        "      .st-cert.no-grant { border-color: rgba(148,163,184,0.28); background: linear-gradient(135deg, rgba(148,163,184,0.07), rgba(148,163,184,0.02)); }\n"
        "      .st-cert.no-grant .st-cert-title { color: #cbd5e1; text-shadow: none; }\n"
        "      .st-cert-status { font-size: 0.84em; font-weight: 700; color: #cbd5e1; padding: 2px 0 5px; }\n"
        "      .st-cert-reasons { margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(245,215,110,0.18); }\n"
        "      .st-cert.no-grant .st-cert-reasons { border-top-color: rgba(148,163,184,0.16); }\n"
        "      .st-cert-reason { position: relative; padding: 2px 0 2px 14px; font-size: 0.78em; line-height: 1.65; color: #c9bd95; }\n"
        "      .st-cert.no-grant .st-cert-reason { color: #aeb8c6; }\n"
        "      .st-cert-reason::before { content: '•'; position: absolute; left: 2px; color: currentColor; opacity: 0.72; }\n"
    )
    text = replace_once(text, old_style, new_style, 'credential explanation styles')

    text = replace_once(
        text,
        "          const credentialGrant = resolveCredentialGrant(settlementBaselineData);\n",
        "          const credentialDecision = resolveCredentialDecision(settlementBaselineData);\n"
        "          const credentialGrant = credentialDecision && credentialDecision.granted ? credentialDecision : null;\n",
        'credential decision baseline'
    )

    text = replace_once(
        text,
        "              if (!credentialInserted && !hasLegacyCredentialPanel && st.type === 'income' && credentialGrant) {\n"
        "                inner += '<div class=\"st-cert-host\">' + renderCredentialPanel(credentialGrant) + '</div>';\n"
        "                credentialInserted = true;\n"
        "              }\n",
        "              if (!credentialInserted && !hasLegacyCredentialPanel && st.type === 'income') {\n"
        "                inner += '<div class=\"st-cert-host\">' + renderCredentialPanel(credentialDecision) + '</div>';\n"
        "                credentialInserted = true;\n"
        "              }\n",
        'always render credential explanation panel'
    )

    path.write_text(text, encoding='utf-8')
    print('credential explanation implementation patched')
