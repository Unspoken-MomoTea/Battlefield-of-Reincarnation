from pathlib import Path

prompt_path = Path('World Book/【结算任务】[mvu_plot].txt')
html_path = Path('Regular/结算任务美化.html')

prompt = prompt_path.read_text(encoding='utf-8')
prompt = prompt.replace(
    '区间上限(E)仅用于危险提示、战利品位格参考及剧情威胁描述，绝对禁止参与空间币及凭证收益计算',
    '区间上限(E)仅用于危险提示、战利品位格参考及剧情威胁描述，绝对禁止参与空间币收益计算'
)

cert_rule = '''  权限凭证判定铁律:\n    - 凭证等级唯一读取【奖励基准评级】\n    - 核心公式: 凭证等级 = 奖励基准评级 (禁止使用表现评级替代)\n    触发条件:\n      - 当【奖励基准评级】大于【当前层级+1】时，才允许发放凭证\n\n'''
if prompt.count(cert_rule) != 1:
    raise SystemExit('credential rule block anchor mismatch')
prompt = prompt.replace(cert_rule, '', 1)

cert_panel = '''$(若检测到玩家满足发放条件，且未持有该等级凭证，则强制输出以下面板，否则隐藏)\n* **【主神权限凭证】**:\n    * **凭证等级**: {已锁定的奖励基准评级}\n      系统核录完毕，获得 **[{奖励基准评级}级权限凭证]**。凭此信物，已永久解锁主神商城对应阶位的跨阶购买与升级权限。\n\n'''
if prompt.count(cert_panel) != 1:
    raise SystemExit('credential panel block anchor mismatch')
prompt = prompt.replace(cert_panel, '', 1)
prompt_path.write_text(prompt, encoding='utf-8')

html = html_path.read_text(encoding='utf-8')

anchor = "          function trialScore(tasks) {\n"
if html.count(anchor) != 1:
    raise SystemExit('trialScore anchor mismatch')

credential_helpers = '''          function readSettlementBaselineData() {
            const ctx = getMvuContext();
            const win = ctx && ctx.win;
            const mvu = win && win.Mvu;
            const currentId = getPanelMessageId(win);
            if (mvu && typeof mvu.getMvuData === 'function' && currentId !== null) {
              for (let step = 1; step <= 3; step++) {
                const id = currentId - step;
                if (id < 0) break;
                try {
                  const data = mvu.getMvuData({ type: 'message', message_id: id });
                  const stat = data && (data.stat_data || data);
                  if (stat && stat.主角) return data;
                } catch (e) {}
              }
            }
            return ctx && ctx.data;
          }

          function resolveCredentialGrant(data) {
            const stat = data && (data.stat_data || data);
            if (!stat || !stat.主角) return null;

            const LIFE_TIERS = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
            const tierRaw = String(stat.主角.层级 || 'Ⅰ').trim();
            let heroIndex = LIFE_TIERS.indexOf(tierRaw);
            if (heroIndex < 0) heroIndex = GRADES.indexOf(gradeTier(tierRaw));
            if (heroIndex < 0) heroIndex = 0;

            let baseGrade = '';
            const isSingleWorld = !!(stat.设置 && stat.设置.单一世界 === true);
            if (isSingleWorld) {
              const list = stat.任务 && stat.任务.列表 && typeof stat.任务.列表 === 'object' ? stat.任务.列表 : {};
              let bestIndex = -1;
              Object.keys(list).forEach(function(key) {
                const task = list[key] || {};
                if (String(task.委托方 || '').trim() !== '主神任务') return;
                if (String(task.状态 || '').trim() !== '可结算') return;
                const grade = gradeTier(task.难度 || '');
                const idx = GRADES.indexOf(grade);
                if (idx > bestIndex) bestIndex = idx;
              });
              if (bestIndex >= 0) baseGrade = GRADES[bestIndex];
            } else {
              baseGrade = gradeFloor(stat.世界 && stat.世界.难度);
            }

            const gradeIndex = GRADES.indexOf(baseGrade);
            if (gradeIndex < 0) return null;
            const normalViewIndex = Math.min(GRADES.length - 1, heroIndex + 1);
            if (gradeIndex <= normalViewIndex) return null;

            const name = baseGrade + '级权限凭证';
            const items = stat.主角.道具 && typeof stat.主角.道具 === 'object' ? stat.主角.道具 : {};
            const statuses = stat.主角.状态 && typeof stat.主角.状态 === 'object' ? stat.主角.状态 : {};
            if (Object.prototype.hasOwnProperty.call(items, name) || Object.prototype.hasOwnProperty.call(statuses, name)) return null;

            return { grade: baseGrade, name: name, heroTier: tierRaw };
          }

          function renderCredentialPanel(grant) {
            if (!grant) return '';
            return '<div class="st-cert">' +
              '<div class="st-cert-title">◆ 主神权限凭证</div>' +
              '<div class="st-kv"><span class="k">凭证等级</span><span class="v">' + gradeBadge(grant.grade, false) + '</span></div>' +
              '<div class="st-cert-desc">系统核录完毕，获得【' + escapeHtml(grant.name) + '】。已永久解锁主神商城对应阶位的跨阶购买与升级权限。</div>' +
              '</div>';
          }

'''
html = html.replace(anchor, credential_helpers + anchor, 1)

vars_anchor = "          const achievementTasks = readAchievementTasks();\n"
if html.count(vars_anchor) != 1:
    raise SystemExit('achievementTasks anchor mismatch')
html = html.replace(
    vars_anchor,
    vars_anchor + "          const settlementBaselineData = readSettlementBaselineData();\n          const credentialGrant = resolveCredentialGrant(settlementBaselineData);\n",
    1
)

render_anchor = "          function renderSettlement(d) {\n            let html = '';\n            let achievementInserted = false;\n"
if html.count(render_anchor) != 1:
    raise SystemExit('renderSettlement anchor mismatch')
html = html.replace(
    render_anchor,
    "          function renderSettlement(d) {\n            let html = '';\n            let achievementInserted = false;\n            let credentialInserted = false;\n            const hasLegacyCredentialPanel = d.stages.some(function(stage) {\n              return stage.items.some(function(item) { return item.kind === 'cert'; });\n            });\n",
    1
)

insert_anchor = '''              if (!achievementInserted && st.type === 'income' && achievementTasks.length) {
                inner += '<div class="st-achievement-host">' + renderAchievementPanel() + '</div>';
                achievementInserted = true;
              }

              html += '<div class="st-stage t-' + st.type + '"><div class="st-stage-head"><span class="st-stage-no">' + (idx + 1) + '</span><span class="st-stage-name">' + escapeHtml(st.name || '结算阶段') + '</span><span class="st-stage-line"></span></div>' + inner + '</div>';
'''
if html.count(insert_anchor) != 1:
    raise SystemExit('income insertion anchor mismatch')
html = html.replace(
    insert_anchor,
    '''              if (!achievementInserted && st.type === 'income' && achievementTasks.length) {
                inner += '<div class="st-achievement-host">' + renderAchievementPanel() + '</div>';
                achievementInserted = true;
              }

              if (!credentialInserted && !hasLegacyCredentialPanel && st.type === 'income' && credentialGrant) {
                inner += '<div class="st-cert-host">' + renderCredentialPanel(credentialGrant) + '</div>';
                credentialInserted = true;
              }

              html += '<div class="st-stage t-' + st.type + '"><div class="st-stage-head"><span class="st-stage-no">' + (idx + 1) + '</span><span class="st-stage-name">' + escapeHtml(st.name || '结算阶段') + '</span><span class="st-stage-line"></span></div>' + inner + '</div>';
''',
    1
)

write_anchor = "              function parseEffectLines(txt) {\n"
if html.count(write_anchor) != 1:
    raise SystemExit('parseEffectLines anchor mismatch')
credential_write = '''              if (credentialGrant) {
                const key = 'stat_data.主角.道具.' + credentialGrant.name;
                const stateKey = 'stat_data.主角.状态.' + credentialGrant.name;
                if (!exists(key) && !exists(stateKey)) {
                  win._.set(c, key + '.品质', credentialGrant.grade);
                  win._.set(c, key + '.类型', '权限凭证');
                  win._.set(c, key + '.数量', 1);
                  win._.set(c, key + '.标签', ['主神空间', '权限凭证']);
                  win._.set(c, key + '.效果', { 商城权限:'永久解锁主神商城' + credentialGrant.grade + '级跨阶购买与升级权限。' });
                  win._.set(c, key + '.描述', '主神结算授予的永久权限凭证。');
                  win._.set(c, key + '.状态', 0);
                  changed = true;
                }
              }

'''
html = html.replace(write_anchor, credential_write + write_anchor, 1)
html_path.write_text(html, encoding='utf-8')

# semantic validation
prompt = prompt_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')
for token in [
    '权限凭证判定铁律',
    '若检测到玩家满足发放条件，且未持有该等级凭证',
    '* **【主神权限凭证】**:',
    '凭证收益计算',
]:
    if token in prompt:
        raise SystemExit('prompt residue: ' + token)
for token in [
    'function resolveCredentialGrant(data)',
    'function renderCredentialPanel(grant)',
    'const credentialGrant = resolveCredentialGrant(settlementBaselineData);',
    "const name = baseGrade + '级权限凭证';",
    'if (gradeIndex <= normalViewIndex) return null;',
    "win._.set(c, key + '.类型', '权限凭证');",
    "win._.set(c, key + '.数量', 1);",
]:
    if token not in html:
        raise SystemExit('missing html token: ' + token)
