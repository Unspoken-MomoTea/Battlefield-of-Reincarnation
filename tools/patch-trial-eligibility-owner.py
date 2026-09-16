from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUSBAR = ROOT / 'script' / '悬浮球状态栏.js'
AUXILIARY = ROOT / 'script' / '辅助计算脚本.js'
VARIABLES = ROOT / 'World Book' / '[variables]当前变量.txt'
TEST = ROOT / 'tests' / 'statusbar-settlement-topbar.cjs'


def read_preserve(path: Path):
    raw = path.read_bytes()
    text = raw.decode('utf-8')
    newline = '\r\n' if '\r\n' in text else '\n'
    return text, newline


def block(text: str, newline: str) -> str:
    return text.replace('\n', newline)


def replace_once_or_accept(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor count != 1: {count}')
    return text.replace(old, new, 1)


def remove_once_or_accept(text: str, old: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        return text
    if count != 1:
        raise SystemExit(f'{label} anchor count != 1: {count}')
    return text.replace(old, '', 1)


# 1) 状态栏只消费“系统状态.是否可试炼”，不自行越权重算资格。
text, nl = read_preserve(STATUSBAR)
text = replace_once_or_accept(
    text,
    '        var canTrial = (score >= TRIAL_SCORE_THRESHOLD);',
    '        var canTrial = (st.是否可试炼 === true);',
    'promotion render ownership',
)

old_apply = block("""            if (act === 'apply') {
                var liveTier = normalizeLifeTier(sd.角色.层级);
                var liveScore = calcTrialScore(sd.角色.最终属性 || {}, liveTier);
                if (sys.试炼已完成 === true || liveScore < TRIAL_SCORE_THRESHOLD) { samToast('warning', '晋升条件已变化，请刷新后重试'); renderAll(); return; }
                // 是否可试炼是程序派生缓存；显示与点击均以实时属性为准，并修复可能滞后的缓存。
                if (sys.是否可试炼 !== true) {
                    writeBackMvu(function(stat) {
                        if (!stat.系统状态 || typeof stat.系统状态 !== 'object') stat.系统状态 = {};
                        stat.系统状态.是否可试炼 = true;
                    });
                }
                // 申请进阶: 写入一句话到输入框(同情报交易可购买按钮, 不自动发送)
""", nl)
new_apply = block("""            if (act === 'apply') {
                if (sys.是否可试炼 !== true || sys.试炼已完成 === true) { samToast('warning', '晋升条件已变化，请刷新后重试'); renderAll(); return; }
                // 申请进阶: 写入一句话到输入框(同情报交易可购买按钮, 不自动发送)
""", nl)
text = replace_once_or_accept(text, old_apply, new_apply, 'promotion click ownership')
text = text.replace(
    '        /* 进阶按钮: 实时段位累计达标后显示；源力灌注与申请进阶并列。 */',
    '        /* 进阶按钮: 由辅助计算脚本维护的“是否可试炼”控制；源力灌注与申请进阶并列。 */',
    1,
)
STATUSBAR.write_bytes(text.encode('utf-8'))


# 2) 是否可试炼只在统一 VARIABLE_UPDATE_ENDED 辅助计算链路维护。
# worldCommit 已不再提前 return，因此无需额外的“加载态校准”旁路；刷新变量即可自然重算。
aux, anl = read_preserve(AUXILIARY)
reconcile_block = block("""

    /**
     * 脚本加载时校准一次程序派生资格。
     * VARIABLE_UPDATE_ENDED 只覆盖“之后发生的更新”；已有存档若带着旧的 false，
     * 单纯重载状态栏不会再次触发计算，所以这里通过正式 MVU 写回纠正陈旧值。
     */
    function reconcileTrialEligibilityState() {
        const statData = getStatData();
        if (!statData || !statData.角色 || !statData.系统状态) return false;
        const probe = { 是否可试炼: statData.系统状态.是否可试炼 };
        checkTrialEligibility(statData.角色, probe);
        const expected = probe.是否可试炼 === true;
        if (statData.系统状态.是否可试炼 === expected) return false;
        return writeBackMvu(function(latest) {
            if (!latest || !latest.角色) return;
            if (!latest.系统状态 || typeof latest.系统状态 !== 'object') latest.系统状态 = {};
            checkTrialEligibility(latest.角色, latest.系统状态);
        });
    }
""", anl)
aux = remove_once_or_accept(aux, reconcile_block, 'remove trial eligibility load reconciliation')
bootstrap = block("""        // 修复“属性已达标但旧存档的 是否可试炼 仍为 false”的加载态，不等下一次正文变量更新。
        reconcileTrialEligibilityState();
""", anl)
aux = remove_once_or_accept(aux, bootstrap, 'remove trial eligibility bootstrap')
if 'function checkTrialEligibility(reincarnator, sys)' not in aux:
    raise SystemExit('trial eligibility function missing')
if 'recalcAllCharacters(statData, statDataBefore);' not in aux:
    raise SystemExit('recalcAllCharacters anchor missing')
if 'checkTrialEligibility(statData.角色, statData.系统状态);' not in aux:
    raise SystemExit('trial eligibility update call missing')
AUXILIARY.write_bytes(aux.encode('utf-8'))


# 3) 是否可试炼是程序托管派生字段，不再发给正文/普通变量 AI，避免被模型覆盖。
vars_text, vnl = read_preserve(VARIABLES)
old_omit = block("""current.系统状态 = _.omit(data.系统状态 || {}, [
  '游玩天数', '上次世界日期', '试炼已完成', '是否试炼任务', '试炼任务名单'
]);
""", vnl)
new_omit = block("""current.系统状态 = _.omit(data.系统状态 || {}, [
  '游玩天数', '上次世界日期', '是否可试炼', '试炼已完成', '是否试炼任务', '试炼任务名单'
]);
""", vnl)
vars_text = replace_once_or_accept(vars_text, old_omit, new_omit, 'hide program-owned trial eligibility')
VARIABLES.write_bytes(vars_text.encode('utf-8'))


# 4) 回归：结算入口仍只看副本/战斗；晋升入口只看程序资格；资格只有统一变量更新入口。
TEST.write_text("""const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'script','悬浮球状态栏.js'),'utf8');
const auxiliary=fs.readFileSync(path.join(root,'script','辅助计算脚本.js'),'utf8').replace(/\\r\\n/g,'\\n');
const variables=fs.readFileSync(path.join(root,'World Book','[variables]当前变量.txt'),'utf8');
new vm.Script(source);
new vm.Script(auxiliary);

function part(text,start,end){
  const a=text.indexOf(start), b=text.indexOf(end,a);
  assert.ok(a>=0 && b>a, `missing source slice: ${start}`);
  return text.slice(a,b);
}

// 用户可见 seam 1：副本内、非战斗时结算入口常驻，与任务完成度无关。
const settlementPolicy=part(source,'    function shouldShowSettlementButton(sd) {','    /* ===== 18. 顶栏 ===== */');
const shouldShow=new Function(settlementPolicy+';return shouldShowSettlementButton;')();
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{}}}),true);
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{主线:{状态:'进行中'}}}}),true);
assert.equal(shouldShow({系统状态:{是否在主神空间:true,是否战斗中:false}}),false);
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:true}}),false);

// 用户可见 seam 2：晋升/源力灌注只消费 系统状态.是否可试炼；45/24 本身不能越权打开按钮。
assert.match(source,/var canTrial = \\(st\\.是否可试炼 === true\\);/);
assert.doesNotMatch(source,/var canTrial = \\(score >= TRIAL_SCORE_THRESHOLD\\);/);
const renderTier=new Function(
  'normalizeLifeTier','TIER_ROMAN','TIER_QUALITY','tierQOfClass','calcTrialScore','TRIAL_SCORE_THRESHOLD','esc',
  part(source,'    function renderTierProgressBar(', '    /* 队友段位累计')+';return renderTierProgressBar;'
)(
  value=>['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'].includes(value)?value:'Ⅰ',
  ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'],
  ['F','E','D','C','B','A','S','SS','SSS'],
  ()=> 'F',
  ()=>45,
  24,
  String
);
const stale=renderTier({层级:'Ⅰ',最终属性:{}},{},{是否可试炼:false,试炼已完成:false});
assert.doesNotMatch(stale,/data-tier-act="apply"|sam-tier-infuse-btn/,'canonical false stays authoritative until the next variable refresh');
const eligible=renderTier({层级:'Ⅰ',最终属性:{}},{},{是否可试炼:true,试炼已完成:false});
assert.match(eligible,/data-tier-act="apply"/);
assert.match(eligible,/sam-tier-infuse-btn/);
assert.match(source,/if \\(sys\\.是否可试炼 !== true \\|\\| sys\\.试炼已完成 === true\\)/,'apply click must honor canonical flag');
assert.doesNotMatch(source,/liveScore < TRIAL_SCORE_THRESHOLD/,'statusbar must not duplicate helper eligibility calculation');

// 程序状态 seam：资格只在统一变量更新链路中维护；不允许再建立加载态旁路。
assert.match(auxiliary,/recalcAllCharacters\\(statData, statDataBefore\\);[\\s\\S]{0,420}checkTrialEligibility\\(statData\\.角色, statData\\.系统状态\\);/);
assert.match(auxiliary,/eventOn\\(Mvu\\.events\\.VARIABLE_UPDATE_ENDED, onUpdateData\\);/);
assert.doesNotMatch(auxiliary,/function reconcileTrialEligibilityState\\(/);
assert.doesNotMatch(auxiliary,/reconcileTrialEligibilityState\\(\\);/);

// 所有权 seam：普通变量 AI 不再看到、也就不能覆盖程序派生的 是否可试炼。
const systemProjection=part(variables,'current.系统状态 = _.omit(data.系统状态 || {}, [',']);');
assert.match(systemProjection,/'是否可试炼'/);

console.log('PASS helper owns trial eligibility through the unified variable-update path; dungeon settlement remains task-independent');
""", encoding='utf-8')

print('patched helper-owned trial eligibility without load reconciliation')
