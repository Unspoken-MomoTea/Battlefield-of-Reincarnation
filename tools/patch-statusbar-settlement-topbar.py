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


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    if text.count(old) != 1:
        raise SystemExit(f'{label} anchor count != 1: {text.count(old)}')
    return text.replace(old, new, 1)


text, nl = read_preserve(STATUSBAR)

old_css = block("""        /* 结算任务按钮区: 任务面板所有栏目下方, 与上方栏目分隔; 按钮居中, 提示在下 */
        .sam-mission-settle-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--sam-border); }
        /* 按钮使用主题无关的稳重配色(深绿), 与整体UI协调且在任意主题清晰可见 */
        .sam-mission-settle-btn { margin-top:4px; padding:7px 26px; font-size:12px; font-weight:900; letter-spacing:1px; cursor:pointer; border-radius:6px; transition:all 0.18s;
            color:#fff; background:#2e9e6b; border:1px solid #2e9e6b; box-shadow:0 0 8px rgba(46,158,107,0.4); }
        .sam-mission-settle-btn:hover { background:#36b67c; border-color:#36b67c; box-shadow:0 0 12px rgba(46,158,107,0.65); }
        .sam-mission-settle-btn:active { transform:translateY(1px); }
        .sam-mission-settle-hint { font-size:11px; color:var(--sam-sub); line-height:1.2; text-align:center; }
""", nl)
text = replace_once(text, old_css, '', 'old settlement task-tab css')

anchor = block("""    /* ===== 18. 顶栏 ===== */
    function renderTopbar(world, sys, editMode) {
""", nl)
replacement = block("""    function isSettlementReadyTask(task) {
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

    /* ===== 18. 顶栏 ===== */
    function renderTopbar(world, sys, editMode, sd) {
""", nl)
text = replace_once(text, anchor, replacement, 'topbar helper insertion')

old_world = block("""        // 选择世界按钮: 仅当在主神空间且非战斗时显示(编辑模式下也保持可点以便快速测试)
        var worldBtn = '';
        if (sys && sys.是否在主神空间 === true && sys.是否战斗中 !== true) {
            worldBtn = '<div class=\"sam-icon-btn choose-world\" title=\"选择世界\" data-choose-world>🌐选择世界</div>';
        }
        return '<div class=\"sam-topbar\">'
""", nl)
new_world = block("""        // 主神空间显示“选择世界”；副本/单一世界出现可结算的主神任务或试炼任务时，同一位置显示“结算任务”。
        var worldBtn = '';
        if (sys && sys.是否在主神空间 === true && sys.是否战斗中 !== true) {
            worldBtn = '<div class=\"sam-icon-btn choose-world\" title=\"选择世界\" data-choose-world>🌐选择世界</div>';
        }
        var settlementBtn = '';
        if (shouldShowSettlementButton(sd)) {
            settlementBtn = '<div class=\"sam-icon-btn choose-world mission-settle\" title=\"结算任务\" data-mission-settle>📋结算任务</div>';
        }
        return '<div class=\"sam-topbar\">'
""", nl)
text = replace_once(text, old_world, new_world, 'topbar button policy')
text = replace_once(text, block("""            + worldBtn
            + '<div class=\"sam-icon-btn refresh\" title=\"刷新\">🔄</div>'
""", nl), block("""            + worldBtn
            + settlementBtn
            + '<div class=\"sam-icon-btn refresh\" title=\"刷新\">🔄</div>'
""", nl), 'topbar settlement button slot')

text = replace_once(text, 'renderTopbar(world, sys, editMode)', 'renderTopbar(world, sys, editMode, sd)', 'renderTopbar call')

old_task_block = block("""        // 结算任务: 置于任务面板所有栏目下方; 仅对主神任务起效(提示说明), 点击发送【结算任务】到输入框
        if (sd.系统状态.是否在主神空间 == false && sd.系统状态.是否战斗中 == false) {
            html += '<div class=\"sam-mission-settle-wrap\">'
                + '<button type=\"button\" class=\"sam-mission-settle-btn\" data-mission-settle>📋 结算任务</button>'
                + '<div class=\"sam-mission-settle-hint\">⚠️ 仅对主神任务起效, 一旦确认不可重ROLL ❗</div>'
                + '</div>';
        }
""", nl)
text = replace_once(text, old_task_block, '', 'old task-tab settlement entry')

text = text.replace(
    '// ★ 结算任务按钮: 任务面板所有栏目下方, 点击发送【结算任务】到输入框(仅对主神任务起效, 由提示文案说明)',
    '// ★ 结算任务按钮: 顶栏入口；主神任务或晋升试炼达到可结算状态时显示，点击发送【结算任务】到输入框',
    1,
)

STATUSBAR.write_bytes(text.encode('utf-8'))

TEST.write_text(r"""const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','script','悬浮球状态栏.js'),'utf8');

assert.match(source,/function isSettlementReadyTask\(task\)/,'statusbar must expose settlement-ready task policy');
assert.match(source,/issuer === '主神任务' \|\| issuer === '晋升试炼' \|\| issuer === '试炼任务'/,'both main-god and trial tasks must qualify');
assert.match(source,/status === '可结算' \|\| status === '可交付' \|\| status === '已完成' \|\| status === '完成'/,'settlement entry must tolerate current and legacy completion aliases');
assert.match(source,/sys\.是否在主神空间 !== false \|\| sys\.是否战斗中 === true/,'entry must only appear outside the main-god space and outside combat');
assert.doesNotMatch(source,/shouldShowSettlementButton[\s\S]{0,500}单一世界/,'single-world mode must not suppress the settlement entry');
assert.match(source,/renderTopbar\(world, sys, editMode, sd\)/,'topbar must receive full state for settlement policy');
assert.match(source,/class="sam-icon-btn choose-world mission-settle"[^>]*data-mission-settle>📋结算任务/,'settlement entry must reuse the choose-world topbar button shape');
assert.doesNotMatch(source,/sam-mission-settle-wrap|sam-mission-settle-btn|sam-mission-settle-hint/,'old task-tab settlement UI must be removed');

console.log('PASS statusbar surfaces settlement in the topbar for main/trial completion, including single-world mode');
""", encoding='utf-8')

print('patched statusbar settlement entry into topbar and added regression coverage')
