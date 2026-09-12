from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read_text(path):
    data = (ROOT / path).read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in data else '\n'
    return data, nl


def write_text(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(text.encode('utf-8'))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 regex match, got {count}')
    return out


def nl_block(s, nl):
    return s.strip('\n').replace('\n', nl)


# ---------------------------------------------------------------------------
# 1) 主神终端：C级起的越阶购买/升级消耗同品质权限凭证
# ---------------------------------------------------------------------------
path = 'script/悬浮球状态栏.js'
text, nl = read_text(path)

permission_guard = nl_block(r'''
// SHOP_PERMISSION_GUARD_START
var SHOP_PERMISSION_QUALITY_ORDER = ['F','E','D','C','B','A','S','SS','SSS'];
var SHOP_PERMISSION_TIER_ORDER = ['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ'];
var SHOP_CREDENTIAL_SPEND_MIN_RANK = 3; // C级起才执行越阶购买/升级凭证消耗
function shopPermissionRank(value) {
    var raw = String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '').replace(/级$/, '');
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
function shopPermissionCredentialRank(credentials) {
    var best = -1;
    var ledger = credentials && typeof credentials === 'object' ? credentials : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        if (Number(ledger[grade] || 0) > 0) best = i;
    }
    return best;
}
function shopPermissionCapRank(character, credentials) {
    var tierRank = shopPermissionRank(character && character.层级);
    if (tierRank < 0) tierRank = 0;
    var baseRank = Math.min(SHOP_PERMISSION_QUALITY_ORDER.length - 1, tierRank + 1);
    var credentialRank = shopPermissionCredentialRank(credentials || {});
    return Math.max(baseRank, credentialRank);
}
function shopPermissionItemRank(item) {
    if (!item || typeof item !== 'object') return -1;
    var tierRank = shopPermissionRank(item.tier);
    if (tierRank >= 0) return tierRank;
    return shopPermissionRank(item.rating);
}
function shopPermissionDecision(character, item, credentials) {
    var capRank = shopPermissionCapRank(character || {}, credentials || {});
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
/*
 * 商城凭证消耗：只负责“实际购买/升级”的资源成本，不改变既有商城可见权限。
 * - F~D级：永不因本规则消耗凭证。
 * - C级及以上：目标品质高于购买对象当前生命层级对应品质时，消耗目标品质凭证×1。
 * - 跨多级也只看最终目标品质；血统融合结果本身不经过此函数。
 */
function shopCredentialRequirement(character, item) {
    var actorRank = shopPermissionRank(character && character.层级);
    if (actorRank < 0) actorRank = 0;
    var targetRank = shopPermissionItemRank(item);
    var required = targetRank >= SHOP_CREDENTIAL_SPEND_MIN_RANK && targetRank > actorRank;
    return {
        required: required,
        actorRank: actorRank,
        targetRank: targetRank,
        grade: required ? shopPermissionGrade(targetRank) : '',
        quantity: required ? 1 : 0
    };
}
function shopCredentialQty(credentials, grade) {
    var ledger = credentials && typeof credentials === 'object' ? credentials : {};
    return Math.max(0, Math.floor(Number(ledger[grade] || 0) || 0));
}
function shopCredentialUnits(item) {
    if (!item || item._cat !== '道具区') return 1;
    return Math.max(1, Math.floor(Number(item.quantity || 1) || 1));
}
function shopCredentialCartRequirements(character, cart) {
    var result = {};
    var list = Array.isArray(cart) ? cart : [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i] || {};
        var req = shopCredentialRequirement(character || {}, item);
        if (!req.required) continue;
        var units = shopCredentialUnits(item);
        result[req.grade] = (result[req.grade] || 0) + units;
    }
    return result;
}
function shopCredentialShortages(credentials, requirements) {
    var missing = [];
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var need = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (!need) continue;
        var have = shopCredentialQty(credentials, grade);
        if (have < need) missing.push({ grade: grade, need: need, have: have });
    }
    return missing;
}
function shopCredentialRequirementText(requirements) {
    var parts = [];
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var need = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (need > 0) parts.push(grade + '×' + need);
    }
    return parts.join(' / ');
}
function shopCredentialShortageText(shortages) {
    var list = Array.isArray(shortages) ? shortages : [];
    return list.map(function(x) { return x.grade + '级×' + x.need + '（持有' + x.have + '）'; }).join(' / ');
}
function shopCredentialConsume(credentials, requirements) {
    if (!credentials || typeof credentials !== 'object') return Object.keys(requirements || {}).length === 0;
    if (shopCredentialShortages(credentials, requirements).length) return false;
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var need = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (need > 0) credentials[grade] = shopCredentialQty(credentials, grade) - need;
    }
    return true;
}
function shopCredentialRefund(credentials, requirements) {
    if (!credentials || typeof credentials !== 'object') return;
    var reqs = requirements && typeof requirements === 'object' ? requirements : {};
    for (var i = 0; i < SHOP_PERMISSION_QUALITY_ORDER.length; i++) {
        var grade = SHOP_PERMISSION_QUALITY_ORDER[i];
        var qty = Math.max(0, Math.floor(Number(reqs[grade] || 0) || 0));
        if (qty > 0) credentials[grade] = shopCredentialQty(credentials, grade) + qty;
    }
}
// SHOP_PERMISSION_GUARD_END
''', nl)
text = regex_once(
    text,
    r'// SHOP_PERMISSION_GUARD_START.*?// SHOP_PERMISSION_GUARD_END',
    permission_guard,
    'permission + spend guard block'
)

# 卡片价格区：仅触发规则时多显示一行“所需凭证”。
card_foot = nl_block(r'''
    function shopCredentialCostHtml(item) {
        var sd = getStatData() || {};
        var ctx = shopResolveCharacter(sd, shopCurrentActor);
        var req = shopCredentialRequirement(ctx.character || {}, item);
        if (!req.required) return '';
        return '<div class="sam-shop-credential-cost" style="font-size:11px;line-height:1.35;color:var(--sam-warning);font-weight:700">所需凭证：'+esc(req.grade)+'级权限凭证 ×1</div>';
    }
    function shopCardFoot(item, isConsume) {
        var curQty = isConsume ? shopGetQty(item.name, '道具区') : 0;
        var qtyHtml = isConsume ? '<div class="sam-shop-qty">'
            + '<button type="button" class="sam-shop-qty-btn" data-shop-qty-btn="minus" data-name="'+esc(item.name)+'">−</button>'
            + '<input type="number" class="sam-shop-qty-inp" min="0" value="'+curQty+'" data-name="'+esc(item.name)+'">'
            + '<button type="button" class="sam-shop-qty-btn" data-shop-qty-btn="plus" data-name="'+esc(item.name)+'">+</button></div>' : '';
        var priceText = item.price ? item.price.toLocaleString() : '0';
        var costHtml = '<div style="display:flex;flex-direction:column;gap:2px;min-width:0">'
            + '<div class="sam-shop-price">所需空间币：'+priceText+'</div>'
            + shopCredentialCostHtml(item)
            + '</div>';
        return '<div class="sam-shop-item-foot">'+costHtml+qtyHtml+'</div>';
    }
''', nl)
text = regex_once(
    text,
    r'    function shopCardFoot\(item, isConsume\) \{.*?\n    \}\r?\n(?=    // attrs:)',
    card_foot + nl,
    'shop card credential cost row'
)

# 购物车底栏：汇总凭证需求；不足时直接禁用最终交易按钮。
footer = nl_block(r'''
    function shopRenderFooter(coin) {
        var cartCount = shopCart.length;
        var cost = shopCartCost();
        var remain = coin - cost;
        var insufficient = (remain < 0);
        var sd = getStatData() || {};
        var actorCtx = shopResolveCharacter(sd, shopCurrentActor);
        var credentialRequirements = shopCredentialCartRequirements(actorCtx.character || {}, shopCart);
        var credentialShortages = shopCredentialShortages(sd.角色 && sd.角色.权限凭证, credentialRequirements);
        var credentialInsufficient = credentialShortages.length > 0;
        var credentialText = shopCredentialRequirementText(credentialRequirements);
        var remainCls = insufficient ? ' insufficient' : '';
        var infoHtml = '';
        if (!cartCount) {
            infoHtml = '已选 <b>0</b> 项 · 合计 <b>0</b> · 剩余 <b>'+(coin ? coin.toLocaleString() : '0')+'</b>';
        } else if (insufficient || credentialInsufficient) {
            var warnings = [];
            if (insufficient) warnings.push('空间币不足');
            if (credentialInsufficient) warnings.push('权限凭证不足：'+shopCredentialShortageText(credentialShortages));
            infoHtml = '<span class="sam-shop-foot-warn">⚠️ '+warnings.join(' · ')+' · 已选 '+cartCount+' 项 · 合计 '+cost.toLocaleString()+' · 剩余 <span class="sam-shop-foot-remain'+remainCls+'">'+remain.toLocaleString()+'</span>'
                + (credentialText ? ' · 所需凭证 '+esc(credentialText) : '') + '</span>';
        } else {
            infoHtml = '已选 <b>'+cartCount+'</b> 项 · 合计 <b>'+cost.toLocaleString()+'</b> · 剩余 <span class="sam-shop-foot-remain'+remainCls+'"><b>'+remain.toLocaleString()+'</b></span>'
                + (credentialText ? ' · 所需凭证 <b>'+esc(credentialText)+'</b>' : '');
        }
        var disabled = (!cartCount || insufficient || credentialInsufficient) ? ' disabled' : '';
        var btnText = cartCount ? '授权执行交易' : '请先选择商品';
        return '<div class="sam-shop-foot"><div class="sam-shop-foot-info">'+infoHtml+'</div>'
            + '<button type="button" class="sam-shop-exec-btn" data-shop-exec'+disabled+'>'+btnText+'</button></div>';
    }
''', nl)
text = regex_once(
    text,
    r'    function shopRenderFooter\(coin\) \{.*?\n    \}\r?\n(?=    // ---- 执行层:)',
    footer + nl,
    'shop cart credential summary'
)

# 普通购物车结算：二次硬校验并与空间币同一份交易快照扣除。
old = nl_block('''
        var total = shopCartCost();
        var startCoin = Number(coinOwner.空间币 || 0);
        if (startCoin < total) throw new Error('角色空间币不足');
        coinOwner.空间币 = startCoin - total;
''', nl)
new = nl_block('''
        var credentialRequirements = shopCredentialCartRequirements(character, shopCart);
        var credentialShortages = shopCredentialShortages(coinOwner.权限凭证, credentialRequirements);
        if (credentialShortages.length) throw new Error('权限凭证不足：' + shopCredentialShortageText(credentialShortages));
        var total = shopCartCost();
        var startCoin = Number(coinOwner.空间币 || 0);
        if (startCoin < total) throw new Error('角色空间币不足');
        coinOwner.权限凭证 = coinOwner.权限凭证 || {};
        if (!shopCredentialConsume(coinOwner.权限凭证, credentialRequirements)) throw new Error('权限凭证扣除失败');
        coinOwner.空间币 = startCoin - total;
''', nl)
text = replace_once(text, old, new, 'shop transaction credential spend')

# 商城交易规则说明：明确C级分界与血统融合豁免。
text = replace_once(
    text,
    '<div class="sam-row"><span class="k">权限锁</span><span class="v">跨越自身大段位的高阶商品需权限凭证</span></div>',
    '<div class="sam-row"><span class="k">权限锁</span><span class="v">C级起，购买/升级高于购买对象当前层级的商品额外消耗同品质权限凭证×1；同级及以下不消耗，血统融合结果不消耗</span></div>',
    'shop rules credential explanation'
)

# 商城血统融合：购买“商店血统材料”的时点扣凭证；融合随机升品本身不再扣。
fusion_purchase_block = nl_block(r'''
            var prePrice = safeNum(bloodFusionShopItem.price, 0);
            var preSd = getStatData();
            var preCoin = preSd && preSd.角色 ? safeNum(preSd.角色.空间币, 0) : 0;
            if (preCoin < prePrice) { samToast('warning', '空间币不足，无法购买此血统进行融合'); return; }
            // ★ 多角色: 货币/凭证仍从 角色 账户扣除; 血统商品从 当次融合目标角色 的 商城库 删除
            var preActor = bloodFusionActionActor || SHOP_ACTOR_REINCARNATOR;
            var preActorCtx = shopResolveCharacter(preSd, preActor);
            var preCredentialRequirements = {};
            var preCredentialRequirement = shopCredentialRequirement(preActorCtx.character || {}, bloodFusionShopItem);
            if (preCredentialRequirement.required) preCredentialRequirements[preCredentialRequirement.grade] = 1;
            var preCredentialShortages = shopCredentialShortages(preSd && preSd.角色 && preSd.角色.权限凭证, preCredentialRequirements);
            if (preCredentialShortages.length) { samToast('warning', '权限凭证不足：'+shopCredentialShortageText(preCredentialShortages)); return; }
            var preActorLib = shopGetActorLibRaw(preSd && preSd.商城, preActor);
            var preBloodArr = (preActorLib && Array.isArray(preActorLib.血统列表)) ? preActorLib.血统列表.slice() : null;
            // 备份扣币/扣凭证/删除商品前的快照, 供失败/停止回滚
            bloodFusionSnap = {
                price: prePrice,
                preCoin: preCoin,
                preActor: preActor,
                preBloodLib: preBloodArr,
                credentialRequirements: preCredentialRequirements
            };
            var preOk = writeBackMvu(function(statData) {
                statData.角色 = statData.角色 || {};
                statData.角色.权限凭证 = statData.角色.权限凭证 || {};
                if (!shopCredentialConsume(statData.角色.权限凭证, preCredentialRequirements)) throw new Error('权限凭证扣除失败');
                statData.角色.空间币 = Math.max(0, safeNum(statData.角色.空间币, 0) - prePrice);
                var _lib = shopGetActorLibRaw(statData.商城, preActor);
''', nl)
text = regex_once(
    text,
    r'            var prePrice = safeNum\(bloodFusionShopItem\.price, 0\);.*?                var _lib = shopGetActorLibRaw\(statData\.商城, preActor\);\r?\n',
    fusion_purchase_block + nl,
    'blood fusion shop-material credential spend'
)

# 所有商城融合“已扣资源”的失败/停止回滚都补回凭证（当前共3处）。
rollback_anchor = '                        statData.角色.空间币 = safeNum(statData.角色.空间币, 0) + bloodFusionSnap.price;' + nl
rollback_new = rollback_anchor + '                        statData.角色.权限凭证 = statData.角色.权限凭证 || {};' + nl + '                        shopCredentialRefund(statData.角色.权限凭证, bloodFusionSnap.credentialRequirements || {});' + nl
rollback_count = text.count(rollback_anchor)
if rollback_count != 3:
    raise RuntimeError(f'blood fusion credential rollback: expected 3 matches, got {rollback_count}')
text = text.replace(rollback_anchor, rollback_new)

# 未满血统栏的“直接购买”也属于商城购买：执行同一凭证成本。
direct_purchase = nl_block(r'''
    function bloodFusionDirectPurchase() {
        var item = bloodFusionShopItem, sd = getStatData();
        if (!item || !sd || !sd.角色) return;
        var dpActor = bloodFusionActionActor || SHOP_ACTOR_REINCARNATOR;
        var dpCtx = shopResolveCharacter(sd, dpActor);
        var dpCh = dpCtx.character;
        if (!dpCh) { samToast('error', '目标角色数据不存在, 无法购买'); return; }
        if (safeNum(sd.角色.空间币, 0) < safeNum(item.price, 0)) { samToast('warning', '空间币不足，无法购买'); return; }
        var dpCredentialRequirements = {};
        var dpCredentialRequirement = shopCredentialRequirement(dpCh, item);
        if (dpCredentialRequirement.required) dpCredentialRequirements[dpCredentialRequirement.grade] = 1;
        var dpCredentialShortages = shopCredentialShortages(sd.角色.权限凭证, dpCredentialRequirements);
        if (dpCredentialShortages.length) { samToast('warning', '权限凭证不足：'+shopCredentialShortageText(dpCredentialShortages)); return; }
        // 血统已满时前端已改走"融合/替换"双选项, 此处仅作兜底静默拦截, 不弹窗
        var cap = BLOODLINE_CAP, count = Object.keys(dpCh.血统 || {}).length;
        if (count >= cap) return;
        var blood = shopToBloodlineVar(item);
        var ok = writeBackMvu(function(statData) {
            var _dctx = shopResolveCharacter(statData, dpActor);
            var _dch = _dctx.character || {};
            _dch.血统 = _dch.血统 || {}; _dch.血统[item.name] = blood;
            statData.角色.权限凭证 = statData.角色.权限凭证 || {};
            if (!shopCredentialConsume(statData.角色.权限凭证, dpCredentialRequirements)) throw new Error('权限凭证扣除失败');
            statData.角色.空间币 = Math.max(0, safeNum(statData.角色.空间币, 0) - safeNum(item.price, 0));
            var _dlib = shopGetActorLibRaw(statData.商城, dpActor);
            if (_dlib && Array.isArray(_dlib.血统列表)) _dlib.血统列表 = _dlib.血统列表.filter(function(x){ return safeStr(x.名称) !== item.name; });
            shopAppendReceipt(statData, shopReceiptLine('购买血统', item.name, item.price, statData.角色.空间币, (dpActor === SHOP_ACTOR_REINCARNATOR ? '角色' : dpActor)));
        });
        if (ok) { closeModal(); bloodFusionShopItem = null; shopCart = []; renderAll(); samToast('success', '已购入血统：'+item.name); }
    }
''', nl)
text = regex_once(
    text,
    r'    function bloodFusionDirectPurchase\(\) \{.*?\n    \}\r?\n(?=    /\* ★ 商城血统替换:)',
    direct_purchase + nl,
    'bloodline direct purchase credential spend'
)

# 血统栏已满时的“直接替换购买”同样先买后替换，因此也要扣购买凭证。
replace_pre_old = nl_block('''
        if (!(rpCh.血统 && rpCh.血统[targetName])) { samToast('error', '未找到待替换的血统'); return; }
        if (safeNum(sd.角色.空间币, 0) < safeNum(item.price, 0)) { samToast('warning', '空间币不足，无法购买'); return; }
        var blood = shopToBloodlineVar(item);
''', nl)
replace_pre_new = nl_block('''
        if (!(rpCh.血统 && rpCh.血统[targetName])) { samToast('error', '未找到待替换的血统'); return; }
        if (safeNum(sd.角色.空间币, 0) < safeNum(item.price, 0)) { samToast('warning', '空间币不足，无法购买'); return; }
        var rpCredentialRequirements = {};
        var rpCredentialRequirement = shopCredentialRequirement(rpCh, item);
        if (rpCredentialRequirement.required) rpCredentialRequirements[rpCredentialRequirement.grade] = 1;
        var rpCredentialShortages = shopCredentialShortages(sd.角色.权限凭证, rpCredentialRequirements);
        if (rpCredentialShortages.length) { samToast('warning', '权限凭证不足：'+shopCredentialShortageText(rpCredentialShortages)); return; }
        var blood = shopToBloodlineVar(item);
''', nl)
text = replace_once(text, replace_pre_old, replace_pre_new, 'bloodline replace precheck')

replace_spend_old = nl_block('''
            _rch.血统 = _rch.血统 || {};
            delete _rch.血统[targetName];              // 移除被替换的旧血统
''', nl)
replace_spend_new = nl_block('''
            _rch.血统 = _rch.血统 || {};
            statData.角色.权限凭证 = statData.角色.权限凭证 || {};
            if (!shopCredentialConsume(statData.角色.权限凭证, rpCredentialRequirements)) throw new Error('权限凭证扣除失败');
            delete _rch.血统[targetName];              // 移除被替换的旧血统
''', nl)
text = replace_once(text, replace_spend_old, replace_spend_new, 'bloodline replace spend')

write_text(path, text)


# ---------------------------------------------------------------------------
# 2) 品质效果数值规则：把原先模糊的“高阶通常需凭证”写成确定规则
# ---------------------------------------------------------------------------
path = 'World Book/⚙️品质效果数值规则.txt'
text, nl = read_text(path)
old = '    - 购买权限锁: 主神空间的商品不仅需要【空间币】，跨越自身大段位的高阶商品通常需要强制性的【权限凭证】（如：S级权限凭证/高阶评级徽章）。纯靠低级世界苟活攒钱，无法直接购买高阶商品'
new = nl_block('''
    - 购买权限锁:
        - 商城可见/可兑换上限仍由购买对象当前生命层级与角色账户持有的最高权限凭证决定
        - 凭证消耗仅从C级开始：购买或升级的最终目标品质达到C级及以上，且高于购买对象当前生命层级对应品质时，除空间币外额外消耗【目标品质权限凭证×1】
        - F~D级商品/升级不执行该消耗；同级及以下不消耗；跨越多级也只检查并消耗最终目标品质凭证×1，不逐级叠加
        - 血统融合产生的品质变化不消耗权限凭证；但若先从商城购入高于自身层级的C级及以上血统作为融合材料，购买行为本身仍按上述规则消耗凭证
        - 权限凭证是稀缺兑换资格，空间币充足不能替代所需凭证
''', nl)
text = replace_once(text, old, new, 'quality rules shop credential detail')
write_text(path, text)


# ---------------------------------------------------------------------------
# 3) 新增回归测试：纯函数边界 + 关键集成锚点
# ---------------------------------------------------------------------------
test = r'''const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'script', '悬浮球状态栏.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'World Book', '⚙️品质效果数值规则.txt'), 'utf8');
const match = source.match(/\/\/ SHOP_PERMISSION_GUARD_START([\s\S]*?)\/\/ SHOP_PERMISSION_GUARD_END/);
assert(match, 'permission guard block must exist');

const sandbox = {};
vm.runInNewContext(`${match[0]}\nthis.guard = { shopCredentialRequirement, shopCredentialCartRequirements, shopCredentialShortages, shopCredentialConsume, shopCredentialRefund };`, sandbox);
const {
  shopCredentialRequirement,
  shopCredentialCartRequirements,
  shopCredentialShortages,
  shopCredentialConsume,
  shopCredentialRefund,
} = sandbox.guard;

const D = { 层级: 'Ⅲ' };
const C = { 层级: 'Ⅳ' };
const B = { 层级: 'Ⅴ' };
const F = { 层级: 'Ⅰ' };

assert.equal(shopCredentialRequirement(F, { rating: 'D' }).required, false, 'F~D must not spend credentials');
assert.deepEqual(JSON.parse(JSON.stringify(shopCredentialRequirement(D, { rating: 'C' }))), {
  required: true, actorRank: 2, targetRank: 3, grade: 'C', quantity: 1,
});
assert.equal(shopCredentialRequirement(C, { rating: 'C' }).required, false, 'same grade must not spend');
assert.equal(shopCredentialRequirement(B, { rating: 'B' }).required, false, 'same B grade must not spend');
assert.equal(shopCredentialRequirement(B, { rating: 'A' }).grade, 'A', 'B -> A spends A credential');
assert.equal(shopCredentialRequirement(D, { rating: 'B' }).grade, 'B', 'crossing multiple grades only uses final target grade');
assert.equal(shopCredentialRequirement(D, { tier: 'Ⅳ' }).grade, 'C', 'form tier must map to C credential');

const cart = [
  { rating: 'C', _cat: '装备区', quantity: 1 },
  { rating: 'B', _cat: '升级区', quantity: 1 },
  { rating: 'C', _cat: '道具区', quantity: 3 },
];
const reqs = shopCredentialCartRequirements(D, cart);
assert.deepEqual(JSON.parse(JSON.stringify(reqs)), { C: 4, B: 1 });
assert.deepEqual(JSON.parse(JSON.stringify(shopCredentialShortages({ C: 3, B: 1 }, reqs))), [{ grade: 'C', need: 4, have: 3 }]);
const ledger = { C: 4, B: 2 };
assert.equal(shopCredentialConsume(ledger, reqs), true);
assert.deepEqual(ledger, { C: 0, B: 1 });
shopCredentialRefund(ledger, reqs);
assert.deepEqual(ledger, { C: 4, B: 2 });

assert(source.includes('所需凭证：'+"'+esc(req.grade)+'"+'级权限凭证 ×1'));
assert(source.includes('var credentialRequirements = shopCredentialCartRequirements(character, shopCart);'));
assert(source.includes('shopCredentialConsume(coinOwner.权限凭证, credentialRequirements)'));
assert(source.includes('credentialRequirements: preCredentialRequirements'));
assert(source.includes('shopCredentialRefund(statData.角色.权限凭证, bloodFusionSnap.credentialRequirements || {})'));
assert(source.includes('shopCredentialConsume(statData.角色.权限凭证, dpCredentialRequirements)'));
assert(source.includes('shopCredentialConsume(statData.角色.权限凭证, rpCredentialRequirements)'));
assert(rules.includes('凭证消耗仅从C级开始'));
assert(rules.includes('血统融合产生的品质变化不消耗权限凭证'));
assert(rules.includes('购买行为本身仍按上述规则消耗凭证'));

console.log('shop credential spend regression passed');
'''
write_text('tests/shop-credential-spend.cjs', test)

print('shop credential spend patch applied')
