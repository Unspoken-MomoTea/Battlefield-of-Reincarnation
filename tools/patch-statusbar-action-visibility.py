from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUSBAR = ROOT / 'script' / '悬浮球状态栏.js'
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


text, nl = read_preserve(STATUSBAR)

# 1) 结算入口只判断“是否在副本且非战斗”，不再读取任务委托方/状态/完成度。
old_settlement_policy = block("""    function isSettlementReadyTask(task) {
        if (!task || typeof task !== 'object') return false;
        var issuer = String(task.委托方 || '').replace(/\\s+/g, '');
        var status = String(task.状态 || '').replace(/\\s+/g, '');
        var isSettlementQuest = issuer === '主神任务' || issuer === '晋升试炼' || issuer === '试炼任务';
        var isReady = status === '可结算' || status === '可交付' || status === '已完成' || status === '完成';
        return isSettlementQuest && isReady;
    }
    function shouldShowSettlementButton(sd) {
        var sys = (sd && sd.系统状态) || {};
        if (sys.是否在主神空间 !== false || sys.是否战斗中 === true) return false;
        var list = (sd && sd.任务 && sd.任务.列表) || {};
        return Object.keys(list).some(function(key) { return isSettlementReadyTask(list[key]); });
    }
""", nl)
new_settlement_policy = block("""    function shouldShowSettlementButton(sd) {
        var sys = (sd && sd.系统状态) || {};
        return sys.是否在主神空间 === false && sys.是否战斗中 !== true;
    }
""", nl)
text = replace_once_or_accept(text, old_settlement_policy, new_settlement_policy, 'settlement visibility policy')

old_topbar_comment = '        // 主神空间显示“选择世界”；副本/单一世界出现可结算的主神任务或试炼任务时，同一位置显示“结算任务”。'
new_topbar_comment = '        // 主神空间显示“选择世界”；副本内非战斗时常驻显示“结算任务”，不判断任务是否完成。'
text = text.replace(old_topbar_comment, new_topbar_comment, 1)

old_handler_comment = '        // ★ 结算任务按钮: 顶栏入口；主神任务或晋升试炼达到可结算状态时显示，点击发送【结算任务】到输入框'
new_handler_comment = '        // ★ 结算任务按钮: 顶栏入口；副本内非战斗时常驻显示，点击发送【结算任务】到输入框'
text = text.replace(old_handler_comment, new_handler_comment, 1)

# 2) 晋升按钮显示以状态栏已经算出的实时段位累计为准，不依赖可能滞后的“是否可试炼”缓存。
old_can_trial = '        var canTrial = (st.是否可试炼 === true);'
new_can_trial = '        var canTrial = (score >= TRIAL_SCORE_THRESHOLD);'
text = replace_once_or_accept(text, old_can_trial, new_can_trial, 'promotion render eligibility')

old_css_comment = '        /* 进阶按钮: 段位累计达标后显示；源力灌注与申请进阶并列。 */'
new_css_comment = '        /* 进阶按钮: 实时段位累计达标后显示；源力灌注与申请进阶并列。 */'
text = text.replace(old_css_comment, new_css_comment, 1)

# 3) 点击申请时同样按实时属性复核；若后台派生标记滞后，顺手修复后再把申请文案放入输入框。
old_apply = block("""            if (act === 'apply') {
                if (sys.是否可试炼 !== true || sys.试炼已完成 === true) { samToast('warning', '晋升条件已变化，请刷新后重试'); renderAll(); return; }
                // 申请进阶: 写入一句话到输入框(同情报交易可购买按钮, 不自动发送)
                var text = '当前进阶条件已满足，申请【晋升试炼任务】';
""", nl)
new_apply = block("""            if (act === 'apply') {
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
                var text = '当前进阶条件已满足，申请【晋升试炼任务】';
""", nl)
text = replace_once_or_accept(text, old_apply, new_apply, 'promotion click eligibility')

STATUSBAR.write_bytes(text.encode('utf-8'))

# 4) 回归测试锁定两个公开行为：副本结算入口常驻；实时段位达标时晋升/灌注按钮不受缓存影响。
TEST.write_text("""const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','script','悬浮球状态栏.js'),'utf8');
new vm.Script(source);

function part(text,start,end){
  const a=text.indexOf(start), b=text.indexOf(end,a);
  assert.ok(a>=0 && b>a, `missing source slice: ${start}`);
  return text.slice(a,b);
}

// 结算按钮：副本内非战斗常驻，不再依赖任务委托方、状态或完成度。
assert.doesNotMatch(source,/function isSettlementReadyTask\\(task\\)/,'settlement button must not inspect task completion');
const settlementPolicy=part(source,'    function shouldShowSettlementButton(sd) {','    /* ===== 18. 顶栏 ===== */');
assert.doesNotMatch(settlementPolicy,/任务|委托方|状态|可结算|可交付|已完成|完成/,'settlement visibility must be independent from task data');
assert.match(settlementPolicy,/return sys\\.是否在主神空间 === false && sys\\.是否战斗中 !== true;/,'settlement visibility only follows dungeon/combat context');
const shouldShow=new Function(settlementPolicy+';return shouldShowSettlementButton;')();
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{}}}),true,'dungeon must show settlement even with no completed task');
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:false},任务:{列表:{主线:{委托方:'主神任务',状态:'进行中'}}}}),true,'in-progress task must not hide settlement');
assert.equal(shouldShow({系统状态:{是否在主神空间:true,是否战斗中:false}}),false,'main-god space uses choose-world instead');
assert.equal(shouldShow({系统状态:{是否在主神空间:false,是否战斗中:true}}),false,'combat keeps settlement hidden');
assert.match(source,/function renderTopbar\\(world, sys, editMode, sd\\)/,'topbar must accept full state');
assert.match(source,/html \\+= renderTopbar\\(world, sys, editMode, statData\\);/,'renderAll must pass actual statData');
assert.match(source,/class="sam-icon-btn choose-world mission-settle"[^>]*data-mission-settle>📋结算任务/,'settlement entry must stay in the topbar');
assert.doesNotMatch(source,/sam-mission-settle-wrap|sam-mission-settle-btn|sam-mission-settle-hint/,'old task-tab settlement UI must stay removed');

// 晋升按钮：实时段位累计达标即显示，即使“是否可试炼”缓存仍是 false。
assert.match(source,/var canTrial = \\(score >= TRIAL_SCORE_THRESHOLD\\);/,'promotion visibility must use live score');
assert.doesNotMatch(source,/var canTrial = \\(st\\.是否可试炼 === true\\);/,'stale trial cache must not hide promotion actions');
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
const promotionHtml=renderTier({层级:'Ⅰ',最终属性:{}},{},{是否可试炼:false,试炼已完成:false});
assert.match(promotionHtml,/data-tier-act="apply"/,'live score 45\/24 must show apply-promotion action');
assert.match(promotionHtml,/sam-tier-infuse-btn/,'live score 45\/24 must show source-infusion action');
assert.doesNotMatch(source,/if \\(sys\\.是否可试炼 !== true \\|\\| sys\\.试炼已完成 === true\\)/,'apply click must not reject only because the cache is stale');
assert.match(source,/liveScore < TRIAL_SCORE_THRESHOLD/,'apply click must revalidate the live score');
assert.match(source,/stat\\.系统状态\\.是否可试炼 = true/,'apply click must repair a stale derived trial cache');

console.log('PASS statusbar keeps dungeon settlement visible and derives promotion actions from live score');
""", encoding='utf-8')

print('patched statusbar action visibility and regression')
