from pathlib import Path
import textwrap

SOURCE = Path('script/悬浮球状态栏.js')
TEST = Path('tests/shop-permission-guard.cjs')

raw = SOURCE.read_bytes()
text = raw.decode('utf-8')
nl = '\r\n' if '\r\n' in text else '\n'


def n(s: str) -> str:
    return s.replace('\n', nl)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    old = n(old)
    new = n(new)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    text = text.replace(old, new, 1)


# 1) Deterministic permission model. This is intentionally pure so the regression
#    test can execute it without booting the full SillyTavern UI.
anchor = n("""    // 校正 shopCurrentActor: 若当前选中的NPC不在候选列表里(已离场/非队友), 退回角色
""")
if text.count(anchor) != 1:
    raise RuntimeError('permission helper anchor not found uniquely')

helper = n(textwrap.dedent("""
    // SHOP_PERMISSION_GUARD_START
    var SHOP_PERMISSION_QUALITY_ORDER = ['F','E','D','C','B','A','S','SS','SSS'];
    var SHOP_PERMISSION_TIER_ORDER = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
    function shopPermissionRank(value) {
        var raw = String(value == null ? '' : value).trim().toUpperCase().replace(/\\s+/g, '').replace(/级$/, '');
        var qualityIndex = SHOP_PERMISSION_QUALITY_ORDER.indexOf(raw);
        if (qualityIndex >= 0) return qualityIndex;
        var tierIndex = SHOP_PERMISSION_TIER_ORDER.indexOf(raw);
        if (tierIndex >= 0) return tierIndex;
        if (/^[1-9]$/.test(raw)) return Number(raw) - 1;
        return -1;
    }
    function shopPermissionGrade(rank) {
        rank = Number(rank);
        if (!Number.isFinite(rank)) return '?';
        rank = Math.max(0, Math.min(SHOP_PERMISSION_QUALITY_ORDER.length - 1, Math.floor(rank)));
        return SHOP_PERMISSION_QUALITY_ORDER[rank];
    }
    function shopPermissionCredentialRank(character) {
        var best = -1;
        function scan(dict, checkQuantity) {
            if (!dict || typeof dict !== 'object') return;
            for (var key in dict) {
                if (!Object.prototype.hasOwnProperty.call(dict, key)) continue;
                var entry = dict[key];
                if (checkQuantity && entry && typeof entry === 'object' && entry.数量 != null && Number(entry.数量) <= 0) continue;
                var names = [String(key || '')];
                if (entry && typeof entry === 'object' && entry.名称) names.push(String(entry.名称));
                var rank = -1;
                for (var i = 0; i < names.length; i++) {
                    var match = names[i].match(/(SSS|SS|S|A|B|C|D|E|F)级(?:权限)?凭证/i);
                    if (match) { rank = shopPermissionRank(match[1]); break; }
                }
                if (rank < 0 && entry && typeof entry === 'object') {
                    var tagText = Array.isArray(entry.标签) ? entry.标签.join('/') : String(entry.标签 || '');
                    var credentialLike = String(entry.类型 || '').indexOf('权限凭证') >= 0
                        || tagText.indexOf('权限凭证') >= 0
                        || String(key || '').indexOf('权限凭证') >= 0;
                    if (credentialLike) rank = shopPermissionRank(entry.品质 || entry.品级 || entry.评级);
                }
                if (rank > best) best = rank;
            }
        }
        scan(character && character.道具, true);
        scan(character && character.状态, false);
        return best;
    }
    function shopPermissionCapRank(character) {
        var tierRank = shopPermissionRank(character && character.层级);
        if (tierRank < 0) tierRank = 0;
        var baseRank = Math.min(SHOP_PERMISSION_QUALITY_ORDER.length - 1, tierRank + 1);
        var credentialRank = shopPermissionCredentialRank(character || {});
        return Math.max(baseRank, credentialRank);
    }
    function shopPermissionItemRank(item) {
        if (!item || typeof item !== 'object') return -1;
        var tierRank = shopPermissionRank(item.tier);
        if (tierRank >= 0) return tierRank;
        return shopPermissionRank(item.rating);
    }
    function shopPermissionDecision(character, item) {
        var capRank = shopPermissionCapRank(character || {});
        var requiredRank = shopPermissionItemRank(item);
        return {
            allowed: requiredRank >= 0 && requiredRank <= capRank,
            capRank: capRank,
            requiredRank: requiredRank,
            capGrade: shopPermissionGrade(capRank),
            requiredGrade: requiredRank >= 0 ? shopPermissionGrade(requiredRank) : '?'
        };
    }
    function shopPermissionMessage(decision, item) {
        var name = item && item.name ? item.name : '该商品';
        if (!decision || decision.requiredRank < 0) return '商城权限校验失败: ' + name + ' 的品质/层级无效';
        return '权限不足: 当前商城上限为' + decision.capGrade + '级，' + name + '为' + decision.requiredGrade + '级';
    }
    // SHOP_PERMISSION_GUARD_END
""").strip('\n')) + nl
text = text.replace(anchor, helper + anchor, 1)

# 2) Selection guard: UI state cannot be bypassed by a stale or hand-crafted click.
replace_once(
"""        if (idx > -1) {
            shopCart.splice(idx, 1);
        } else {
            // ★ 血统区单选: 选中新血统前, 先剔除购物车里已有的其他血统条目(避免多血统混入),
""",
"""        if (idx > -1) {
            shopCart.splice(idx, 1);
        } else {
            var permissionCtx = shopResolveCharacter(getStatData() || {}, shopCurrentActor);
            var permission = shopPermissionDecision(permissionCtx.character || {}, item);
            if (!permission.allowed) { samToast('warning', shopPermissionMessage(permission, item)); return; }
            // ★ 血统区单选: 选中新血统前, 先剔除购物车里已有的其他血统条目(避免多血统混入),
""",
'selection permission guard')

# 3) Render over-cap goods as locked, with the exact current cap shown to the user.
replace_once(
"""    function shopRenderContent(coin) {
        if (!shopMarketData) return '<div class=\"sam-shop-list\"><div class=\"sam-shop-empty\">尚未刷新商品, 请在上方商城入口写入需求后点击「刷新商品」</div></div>';
        var cat = shopActiveTab || '装备区';
""",
"""    function shopRenderContent(coin) {
        if (!shopMarketData) return '<div class=\"sam-shop-list\"><div class=\"sam-shop-empty\">尚未刷新商品, 请在上方商城入口写入需求后点击「刷新商品」</div></div>';
        var permissionCharacter = shopResolveCharacter(getStatData() || {}, shopCurrentActor).character || {};
        var cat = shopActiveTab || '装备区';
""",
'render permission character')
replace_once("shopRenderGroupList(groups[activeSlot] || [], cat, activeSlot, coin)", "shopRenderGroupList(groups[activeSlot] || [], cat, activeSlot, coin, permissionCharacter)", 'group list call')
replace_once("shopRenderItemCard(items[j], cat, '', coin)", "shopRenderItemCard(items[j], cat, '', coin, permissionCharacter)", 'flat item call')
replace_once("function shopRenderGroupList(items, cat, slot, coin) {", "function shopRenderGroupList(items, cat, slot, coin, permissionCharacter) {", 'group list signature')
replace_once("shopRenderItemCard(items[i], cat, slot, coin)", "shopRenderItemCard(items[i], cat, slot, coin, permissionCharacter)", 'group item call')
replace_once("function shopRenderItemCard(item, cat, slot, coin) {", "function shopRenderItemCard(item, cat, slot, coin, permissionCharacter) {", 'item card signature')
replace_once(
"""        var isSelected = shopIsSelected(item.name, cat, slot);
        var sel = isSelected ? ' selected' : '';
        // 禁用判定: 已选中的不灰(允许调整数量/取消); 未选中且单件价格>余额 → 灰调禁用
""",
"""        var isSelected = shopIsSelected(item.name, cat, slot);
        var sel = isSelected ? ' selected' : '';
        var permission = shopPermissionDecision(permissionCharacter || {}, item);
        // 已选中的越权旧条目仍允许点击取消；未选中的越权商品直接锁死。
        var permissionLocked = (!isSelected && !permission.allowed);
        // 禁用判定: 已选中的不灰(允许调整数量/取消); 未选中且单件价格>余额 → 灰调禁用
""",
'card permission decision')
replace_once(
"var disReason = unaffordable ? 'unaffordable' : (bloodFusionLock ? 'fusionbusy' : '');",
"var disReason = permissionLocked ? 'permission' : (unaffordable ? 'unaffordable' : (bloodFusionLock ? 'fusionbusy' : ''));",
'card disable reason')
replace_once(
"""        var hintHtml = bloodFullHint ? '<div class=\"sam-shop-blood-full-hint\" style=\"margin-top:6px;padding:4px 8px;font-size:11px;color:var(--sam-hp);background:rgba(255,107,107,0.1);border-radius:6px;text-align:center;line-height:1.4\">血统已满 · 购买将进入融合替换</div>' : '';
        return '<div class=\"sam-shop-item'+sel+dis+'\"'+dataAttrs+'>'+inner+cornerHtml+hintHtml+'</div>';
""",
"""        var hintHtml = bloodFullHint ? '<div class=\"sam-shop-blood-full-hint\" style=\"margin-top:6px;padding:4px 8px;font-size:11px;color:var(--sam-hp);background:rgba(255,107,107,0.1);border-radius:6px;text-align:center;line-height:1.4\">血统已满 · 购买将进入融合替换</div>' : '';
        var permissionHint = (!permission.allowed) ? '<div class=\"sam-shop-permission-hint\" style=\"margin-top:6px;padding:5px 8px;font-size:11px;color:var(--sam-warning);background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25);border-radius:6px;text-align:center;line-height:1.4\">🔒 权限不足 · 当前上限 '+esc(permission.capGrade)+' · 商品 '+esc(permission.requiredGrade)+'</div>' : '';
        return '<div class=\"sam-shop-item'+sel+dis+'\"'+dataAttrs+'>'+inner+cornerHtml+hintHtml+permissionHint+'</div>';
""",
'card permission hint')

# 4) Disabled-card feedback understands permission locks instead of misreporting "insufficient coins".
replace_once(
"""                if (reason === 'fusionbusy') { samToast('warning', '血统融合进行中, 请等待融合完成后再购买血统'); return; }
                samToast('warning', '空间币不足, 无法购买'); return;
""",
"""                if (reason === 'fusionbusy') { samToast('warning', '血统融合进行中, 请等待融合完成后再购买血统'); return; }
                if (reason === 'permission') { samToast('warning', '权限不足, 当前层级/权限凭证无法购买该档位商品'); return; }
                samToast('warning', '空间币不足, 无法购买'); return;
""",
'disabled card feedback')

# 5) Final transaction guard. This is the authoritative check and runs before coins are deducted.
replace_once(
"""        var character = (actorName === SHOP_ACTOR_REINCARNATOR) ? coinOwner : (statData.关系列表 && statData.关系列表[actorName]);
        if (!character) throw new Error('角色数据不存在: ' + actorName);
        var total = shopCartCost();
""",
"""        var character = (actorName === SHOP_ACTOR_REINCARNATOR) ? coinOwner : (statData.关系列表 && statData.关系列表[actorName]);
        if (!character) throw new Error('角色数据不存在: ' + actorName);
        for (var gateI = 0; gateI < shopCart.length; gateI++) {
            var gateItem = shopCart[gateI] || {};
            var gate = shopPermissionDecision(character, gateItem);
            if (!gate.allowed) throw new Error(shopPermissionMessage(gate, gateItem));
        }
        var total = shopCartCost();
""",
'transaction permission guard')

# 6) Fix the prompt regression introduced by multi-character shopping: the system prompt
#    told the model to scan a section named 【当前玩家数据】, while the actual payload was renamed
#    to 【当前购买对象数据】. Keep the model constraint as defense-in-depth, not as authority.
replace_once('【当前玩家数据】中的道具/状态', '【当前购买对象数据】中的道具/状态', 'prompt player-data section')
replace_once('仔细检阅【当前玩家数据】，挑选玩家现有的低阶血统', '仔细检阅【当前购买对象数据】，挑选玩家现有的低阶血统', 'prompt upgrade section')
replace_once(
'权限凭证仅用于决定商城视野。商品一旦生成即可直接购买，禁止在商品描述或购买条件中再次要求权限凭证。',
'权限凭证仅用于决定商城视野；选购与结算仍由程序按同一上限硬校验。合法视野内商品无需再次写权限条件，超出商城视野的商品不得生成。',
'prompt hard-check wording')

SOURCE.write_bytes(text.encode('utf-8'))

TEST.write_text(r'''const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const match = source.match(/\/\/ SHOP_PERMISSION_GUARD_START([\s\S]*?)\/\/ SHOP_PERMISSION_GUARD_END/);
assert(match, 'permission guard block must exist');

const sandbox = {};
vm.runInNewContext(`${match[0]}\nthis.guard = { shopPermissionCapRank, shopPermissionDecision };`, sandbox);
const { shopPermissionCapRank, shopPermissionDecision } = sandbox.guard;
const grade = rank => ['F','E','D','C','B','A','S','SS','SSS'][rank];

// Reported regression: III-tier character + E credential must NOT unlock SSS.
const reported = { 层级: 'Ⅲ', 道具: { 'E级权限凭证': { 数量: 1 } }, 状态: {} };
assert.equal(grade(shopPermissionCapRank(reported)), 'C');
assert.equal(shopPermissionDecision(reported, { name: 'SSS升级', rating: 'SSS' }).allowed, false);
assert.equal(shopPermissionDecision(reported, { name: 'C升级', rating: 'C' }).allowed, true);

// A credential only raises the cap when it is higher than the natural tier+1 view.
const withS = { 层级: 'Ⅲ', 道具: { 'S级权限凭证': { 数量: 1 } } };
assert.equal(grade(shopPermissionCapRank(withS)), 'S');
assert.equal(shopPermissionDecision(withS, { rating: 'S' }).allowed, true);
assert.equal(shopPermissionDecision(withS, { rating: 'SS' }).allowed, false);

// Zero-count credentials cannot grant access.
const emptyCredential = { 层级: 'Ⅲ', 道具: { 'SSS级权限凭证': { 数量: 0 } } };
assert.equal(grade(shopPermissionCapRank(emptyCredential)), 'C');

// Roman form tiers use the same F→SSS ladder.
assert.equal(shopPermissionDecision(reported, { tier: 'Ⅳ' }).allowed, true);
assert.equal(shopPermissionDecision(reported, { tier: 'Ⅸ' }).allowed, false);

// Top-tier characters naturally cap at SSS without overflow.
const topTier = { 层级: 'Ⅸ', 道具: {} };
assert.equal(grade(shopPermissionCapRank(topTier)), 'SSS');
assert.equal(shopPermissionDecision(topTier, { rating: 'SSS' }).allowed, true);

// Defense-in-depth seams: locked UI + authoritative pre-deduction transaction guard + prompt section alignment.
assert(source.includes("var permissionLocked = (!isSelected && !permission.allowed);"));
assert(source.includes("if (!gate.allowed) throw new Error(shopPermissionMessage(gate, gateItem));"));
assert(source.includes("if (reason === 'permission')"));
assert(source.includes('【当前购买对象数据】中的道具/状态'));
assert(!source.includes('商品一旦生成即可直接购买'));

console.log('shop permission guard regression passed');
''', encoding='utf-8')

print('shop permission hotfix applied')
