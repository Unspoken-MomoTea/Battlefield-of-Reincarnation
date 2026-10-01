    function shopPreserveScroll(fn) {
        var $list = $('#samsara-panel .sam-shop-list');
        var saved = $list.length ? ($list[0].scrollTop || 0) : 0;
        if (typeof fn === 'function') fn();
        if (saved > 0) {
            var $newList = $('#samsara-panel .sam-shop-list');
            if ($newList.length) {
                try { $newList[0].scrollTop = saved; } catch(e){}
                var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
                if (raf) raf(function(){ try { $newList[0].scrollTop = saved; } catch(e){} });
            }
        }
    }
    // 局部刷新商城市场区(tabs+content+footer), 不重建入口栏目的需求输入框, 避免AutoComplete绑定已移除输入框报错
    function shopRefreshMarket() {
        shopPreserveScroll(function() {
            var $market = $('#samsara-panel .sam-shop-market');
            if ($market.length) { var sd = getStatData(); var coin = sd && sd.角色 ? safeNum(sd.角色.空间币, 0) : 0; $market.html(shopRenderTabs() + shopRenderContent(coin) + shopRenderFooter(coin)); }
            else renderAll();
        });
    }
    function shopCartCost() {
        var sum = 0;
        for (var i = 0; i < shopCart.length; i++) {
            sum += Number(shopCart[i].price || 0) * Number(shopCart[i].quantity || 1);
        }
        return sum;
    }
    // 剩余余额 = 原始余额 - 购物车已选合计(用于禁用判定/预检/购物车条展示)
    function shopRemain(coin) { return coin - shopCartCost(); }
    function shopIsSelected(name, cat, slot) {
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name !== name || shopCart[i]._cat !== cat) continue;
            // 道具区: 卡片按类型(恢复/战术/特殊)分组渲染(slot非空), 但数量控件写入购物车的 _slot 恒为空,
            // 若仍按 slot 精确匹配会导致"已选/已选×N"角标永远不显示(选中态丢失)。
            // 故道具区选中身份仅按 name+cat 判定(与 shopGetQty 一致), 忽略 slot。
            if (cat === '道具区') return true;
            if (shopCart[i]._slot === (slot||'')) return true;
        }
        return false;
    }
    // 读取道具区数量(用于回填输入框, 避免全量 renderAll 后归零)
    function shopGetQty(name, cat) {
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name === name && shopCart[i]._cat === cat) return shopCart[i].quantity || 0;
        }
        return 0;
    }
    function shopToggleSelect(item, cat, slot) {
        var idx = -1;
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name === item.name && shopCart[i]._cat === cat && shopCart[i]._slot === (slot||'')) { idx = i; break; }
        }
        if (idx > -1) {
            shopCart.splice(idx, 1);
        } else {
            var permissionSd = getStatData() || {};
            var permissionCtx = shopResolveCharacter(permissionSd, shopCurrentActor);
            var permission = shopPermissionDecision(permissionCtx.character || {}, item, permissionSd.角色 && permissionSd.角色.权限凭证);
            if (!permission.allowed) { samToast('warning', shopPermissionMessage(permission, item)); return; }
            // ★ 血统区单选: 选中新血统前, 先剔除购物车里已有的其他血统条目(避免多血统混入),
            //   保证入口只有 1 条血统被选中, 后续 shopHandleExec 不必再额外收敛
            if (cat === '血统区') {
                for (var j = shopCart.length - 1; j >= 0; j--) {
                    if (shopCart[j]._cat === '血统区') shopCart.splice(j, 1);
                }
            }
            var copy = {};
            for (var k2 in item) { if (item.hasOwnProperty(k2)) copy[k2] = item[k2]; }
            copy._cat = cat; copy._slot = slot || ''; copy.quantity = 1;
            shopCart.push(copy);
        }
        shopRefreshMarket();
    }
    function shopSetQty(name, cat, qty) {
        var s = null, idx = -1;
        for (var i = 0; i < shopCart.length; i++) {
            if (shopCart[i].name === name && shopCart[i]._cat === cat) { s = shopCart[i]; idx = i; break; }
        }
        if (qty <= 0) { if (idx > -1) shopCart.splice(idx, 1); }
        else if (s) { s.quantity = qty; }
        else {
            // 道具区已改为分组对象, 需遍历全部分组查找
            var found = shopFindItems('道具区', '', name);
            found = found.length ? found[0] : null;
            if (found) {
                var c2 = {}; for (var k3 in found) { if (found.hasOwnProperty(k3)) c2[k3] = found[k3]; }
                c2._cat = cat; c2._slot = ''; c2.quantity = qty;
                shopCart.push(c2);
            }
        }
        shopRefreshMarket();
    }
    // ---- 渲染层 ----
    function shopRatingClass(r) {
        if (!r) return '';
        if (String(r).indexOf('SS') === 0) return 'r-SS';
        if (r === 'S') return 'r-S';
        return 'r-' + r;
    }
    function shopChip(label, value) {
        return '<span class="sam-shop-chip"><b>'+esc(label)+':</b> '+esc(value)+'</span>';
    }
    // 对象展开成 chip 列表(如 原始属性 {力量:1, 体质:2} → [力量:1][体质:2])
    function shopObjChips(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
        var html = '';
        for (var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            var v = obj[k];
            if (v === undefined || v === null || v === '') continue;
            // 数值0不展示(装备/技能属性加成仅写非0项)
            if (typeof v === 'number' && v === 0) continue;
            if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) && Number(v) === 0) continue;
            html += shopChip(k, v);
        }
        return html;
    }
    // 效果按独立卡片逐条展示；其他对象详情仍保留紧凑文本模式
    function shopObjDetails(label, obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
        var parts = [];
        for (var k2 in obj) {
            if (!obj.hasOwnProperty(k2)) continue;
            var v2 = obj[k2];
            if (v2 === undefined || v2 === null || v2 === '') continue;
            if (label === '效果') {
                parts.push('<div class="sam-shop-effect-card"><div class="sam-shop-effect-card-name">'+esc(k2)+'</div><div class="sam-shop-effect-card-text">'+esc(String(v2))+'</div></div>');
            } else {
                parts.push(esc(k2)+'：'+esc(String(v2)));
            }
        }
        if (!parts.length) return '';
        if (label === '效果') {
            return '<section class="sam-shop-section sam-shop-effects-block"><div class="sam-shop-section-title">效果</div><div class="sam-shop-effect-list">'+parts.join('')+'</div></section>';
        }
        return '<div class="sam-shop-item-detail"><b>'+esc(label)+':</b> '+parts.join('；')+'</div>';
    }
    function shopSigned(v) {
        var n = Number(v);
        if (Number.isFinite(n)) return n > 0 ? '+'+n : String(n);
        return String(v);
    }
    var SHOP_STAT_LABELS = { hp_bonus:'HP', mp_bonus:'MP', atk_bonus:'ATK', def_bonus:'DEF', spell_atk_bonus:'法术ATK', spell_power_bonus:'法术强度', mdef_bonus:'MDEF', saving_throw_bonus:'豁免' };
    function shopStatChips(stats) {
        var html = '';
        for (var key in SHOP_STAT_LABELS) {
            if (!SHOP_STAT_LABELS.hasOwnProperty(key)) continue;
            if (stats && stats[key] !== undefined && stats[key] !== null) {
                // 数值0不展示
                if (safeNum(stats[key], 0) === 0) continue;
                html += shopChip(SHOP_STAT_LABELS[key], shopSigned(stats[key]));
            }
        }
        return html;
    }
    function shopTagChips(tags) {
        if (!tags || !tags.length) return '';
        var html = '';
        for (var i = 0; i < tags.length; i++) html += shopChip('标签', tags[i]);
        return html;
    }
    function shopSpecialSummary(benefits, drawbacks) {
        var bt = (benefits && benefits.length) ? benefits.join('；') : '无';
        var dt = (drawbacks && drawbacks.length) ? drawbacks.join('；') : '无';
        return '增益：'+bt+'；副作用：'+dt;
    }
    function shopDetail(label, value) {
        if (value === undefined || value === null || value === '') return '';
        return '<div class="sam-shop-item-detail"><b>'+esc(label)+':</b> '+esc(String(value))+'</div>';
    }
    function shopAttrsBlock(attrs) {
        if (!attrs) return '';
        return '<section class="sam-shop-section sam-shop-basic-block"><div class="sam-shop-section-title">基础信息</div><div class="sam-shop-item-attrs">'+attrs+'</div></section>';
    }
    function shopDescription(value) {
        if (value === undefined || value === null || value === '') return '';
        return '<section class="sam-shop-section sam-shop-description-block"><div class="sam-shop-section-title">描述</div><div class="sam-shop-description-text">'+esc(String(value))+'</div></section>';
    }
    // 卡片头部(name + 品质徽章, 共同品质色)
    function shopCardHead(item, tier) {
        var qc = parseRarity(item.rating);
        var hasTier = (tier != null && tier !== '');
        // 有层级徽章时(形态商品/形态升级): 隐藏品质字母框, 由层级徽章替代(右上角唯一标识)
        var metaHtml = hasTier ? '' : '<div class="sam-shop-item-meta q-'+qc+'">'+esc(item.rating || '')+'</div>';
        // 层级徽章: 复用品质徽章样式(.sam-shop-item-meta + .q-{品质字母}), 仅显示罗马数字, 配同品质色调
        var tierQc = parseRarity(tierQOfClass(tier));
        var tierBadge = hasTier ? '<div class="sam-shop-item-meta q-'+tierQc+'">'+esc(String(tier))+'</div>' : '';
        return '<div class="sam-shop-item-head"><div class="sam-shop-item-name">'+esc(item.name)+'</div>'
            + '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">'+tierBadge+metaHtml+'</div></div>';
    }
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
        var costHtml = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0">'
            + '<div class="sam-shop-price">所需空间币：'+priceText+'</div>'
            + shopCredentialCostHtml(item)
            + '</div>';
        return '<div class="sam-shop-item-foot">'+costHtml+qtyHtml+'</div>';
    }
    // attrs: 仅保留 原始属性/消耗(技能)/标签; 类型与效果已在上方Tab条和details区展示, 不重复
    function shopBuildSkillCard(item) {
        var attrs = '';
        if (item.cost) attrs += shopChip('消耗', item.cost);
        attrs += shopObjChips(item.raw_attrs);    // 技能可能带原始属性加成
        attrs += shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDescription(item.description);
        return shopCardHead(item) + shopAttrsBlock(attrs) + details + shopCardFoot(item, false);
    }
    function shopBuildBloodlineCard(item) {
        var attrs = shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDescription(item.description);
        return shopCardHead(item) + shopAttrsBlock(attrs) + details + shopCardFoot(item, false);
    }
    function shopBuildEquipCard(item) {
        var attrs = '';
        if (item.cost) attrs += shopChip('消耗', item.cost);
        attrs += shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDescription(item['描述']);
        return shopCardHead(item) + shopAttrsBlock(attrs) + details + shopCardFoot(item, false);
    }
    function shopBuildUpgradeCard(item) {
        var attrs = '';
        if (item.replace_target) attrs += shopChip('替换', item.replace_target);
        if (item.category) attrs += shopChip('大类', item.category);
        attrs += shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDescription(item.description);
        // 形态升级: 右上角显示 层级(罗马数字) 替代 品质字母; 渲染技能子列表(与形态商品卡一致)
        var headTier = null;
        var formExtra = '';
        if (item.category === '形态' && item.tier) {
            headTier = item.tier;
            if (Array.isArray(item.skills) && item.skills.length) formExtra = shopBuildFormSkillsBlock(item.skills);
        }
        return shopCardHead(item, headTier) + shopAttrsBlock(attrs) + details + formExtra + shopCardFoot(item, false);
    }
    // 形态卡片技能子列表块(形态商品/形态升级共用): 详情式展开, 与 效果/描述 风格一致;
    // 每个技能以"(技能名)"标题 + 品质/类型/消耗/标签/效果/描述 各字段行, 空字段省略
    function shopBuildFormSkillsBlock(skills) {
        var rows = '';
        for (var i = 0; i < skills.length; i++) {
            var sk = skills[i] || {};
            var skName = shopPick(sk, 'name','名称','技能名','技能名称') || ('技能' + (i + 1));
            var fields = '';
            if (sk.品质) fields += shopDetail('品质', sk.品质);
            fields += shopDetail('类型', shopSkillTypeLabel(sk.类型 != null ? sk.类型 : 0));
            if (sk.消耗 && sk.消耗 !== '无') fields += shopDetail('消耗', sk.消耗);
            var skTags = (sk.标签 && sk.标签.length) ? sk.标签.join('、') : '';
            if (skTags) fields += shopDetail('标签', skTags);
            var skEf = sk.效果;
            if (skEf && typeof skEf === 'object' && Object.keys(skEf).length) {
                var efParts = [];
                for (var ek in skEf) { if (skEf.hasOwnProperty(ek)) efParts.push(ek + ':' + String(skEf[ek])); }
                fields += shopDetail('效果', efParts.join('；'));
            }
            if (sk.描述) fields += shopDetail('描述', sk.描述);
            // 每个技能单独为可折叠块(<details>), 标题即技能名, 默认收起
            rows += fcBodyCollapsible(skName, fields, 'sam-shop-sk-item', false);
        }
        // 外层整体折叠块: "技能 (N)", 默认收起; 内部各技能子折叠
        return fcBodyCollapsible('技能 (' + skills.length + ')', rows, 'sam-shop-sk-list', false);
    }
    // 形态卡片: 层级徽章(右上角) + 消耗/状态/属性/标签 + 效果 + 技能子列表 + 描述
    function shopBuildFormCard(item) {
        var attrs = '';
        if (item.cost) attrs += shopChip('消耗', item.cost);
        if (item.status) attrs += shopChip('状态', item.status);
        attrs += shopObjChips(item.raw_attrs) + shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDescription(item.description);
        var skillsBlock = (Array.isArray(item.skills) && item.skills.length) ? shopBuildFormSkillsBlock(item.skills) : '';
        return shopCardHead(item, item.tier) + shopAttrsBlock(attrs) + details + skillsBlock + shopCardFoot(item, false);
    }
    function shopBuildConsumeCard(item) {
        var attrs = shopTagChips(item.tags);
        var details = shopObjDetails('效果', item.effects) + shopDescription(item.description);
        return shopCardHead(item) + shopAttrsBlock(attrs) + details + shopCardFoot(item, true);
    }
    // 区域Tab条
    function shopRenderTabs() {
        var cats = [
            { key:'装备区', label:'装备', data: shopMarketData ? shopMarketData['装备区'] : null },
            { key:'道具区', label:'道具', data: shopMarketData ? shopMarketData['道具区'] : null },
            { key:'技能区', label:'技能', data: shopMarketData ? shopMarketData['技能区'] : null },
            { key:'血统区', label:'血统', data: shopMarketData ? shopMarketData['血统区'] : null },
            { key:'形态区', label:'形态', data: shopMarketData ? shopMarketData['形态区'] : null },
            { key:'升级区', label:'升级服务', data: shopMarketData ? shopMarketData['升级区'] : null }
        ];
        var html = '<div class="sam-shop-tabs">';
        for (var i = 0; i < cats.length; i++) {
            var c = cats[i];
            var cnt = 0;
            if ((c.key === '装备区' || c.key === '技能区' || c.key === '道具区') && c.data) { for (var s in c.data) { if (c.data.hasOwnProperty(s) && c.data[s].length) cnt += c.data[s].length; } }
            else if (Array.isArray(c.data)) cnt = c.data.length;
            // 空列表: 不渲染该Tab按钮(例如道具列表为[]时, 道具按钮隐藏)
            if (!cnt) continue;
            var active = (shopActiveTab === c.key) || (!shopActiveTab && i === 0);
            html += '<button type="button" class="sam-shop-tab'+(active?' active':'')+'" data-shop-tab="'+esc(c.key)+'">'+esc(c.label)
                + '<span class="sam-shop-tab-cnt">'+cnt+'</span></button>';
        }
        html += '</div>';
        return html;
    }
    // 渲染当前区域内容(顶部nav + 中部list, 已无外层market容器——由 renderShopTab 统一包裹)
    // coin 用于卡片禁用判定(余额不足时灰调)
    function shopRenderContent(coin) {
        if (!shopMarketData) return '<div class="sam-shop-list"><div class="sam-shop-empty">尚未刷新商品, 请在上方商城入口写入需求后点击「刷新商品」</div></div>';
        var permissionCharacter = shopResolveCharacter(getStatData() || {}, shopCurrentActor).character || {};
        var cat = shopActiveTab || '装备区';
        // 装备区/技能区/道具区: 顶部nav(类型) + 中部list(按类型分组)
        if (cat === '装备区' || cat === '技能区' || cat === '道具区') {
            var groups = shopMarketData[cat] || {};
            var groupKeys = [];
            for (var g in groups) { if (groups.hasOwnProperty(g) && groups[g].length) groupKeys.push(g); }
            if (!groupKeys.length) return '<div class="sam-shop-nav"></div><div class="sam-shop-list"><div class="sam-shop-empty">'+esc(cat.replace('区',''))+'区暂无商品</div></div>';
            var activeSlot = shopActiveSlot && groups[shopActiveSlot] ? shopActiveSlot : groupKeys[0];
            if (shopActiveSlot !== activeSlot) shopActiveSlot = activeSlot;
            var navHtml = '';
            for (var i = 0; i < groupKeys.length; i++) {
                var sk = groupKeys[i];
                var cnt = groups[sk].length;
                navHtml += '<button type="button" class="sam-shop-nav-btn'+(sk === activeSlot ? ' active' : '')+'" data-shop-slot="'+esc(sk)+'">'+esc(sk)+'<span class="sam-shop-nav-cnt">'+cnt+'</span></button>';
            }
            var listHtml = shopRenderGroupList(groups[activeSlot] || [], cat, activeSlot, coin, permissionCharacter);
            return '<div class="sam-shop-nav">'+navHtml+'</div><div class="sam-shop-list">'+listHtml+'</div>';
        }
        // 血统区: 纯list(无nav, 单列布局)
        var items = shopMarketData[cat] || [];
        if (!items.length) return '<div class="sam-shop-list"><div class="sam-shop-empty">'+esc(cat.replace('区',''))+'区暂无商品</div></div>';
        var listHtml3 = '';
        for (var j = 0; j < items.length; j++) {
            listHtml3 += shopRenderItemCard(items[j], cat, '', coin, permissionCharacter);
        }
        return '<div class="sam-shop-list">'+listHtml3+'</div>';
    }
    // 分组列表渲染(装备区/技能区/道具区通用: 按类型分组后的单组列表)
    function shopRenderGroupList(items, cat, slot, coin, permissionCharacter) {
        if (!items || !items.length) return '<div class="sam-shop-empty">此分类暂无商品</div>';
        var html = '';
        for (var i = 0; i < items.length; i++) {
            html += shopRenderItemCard(items[i], cat, slot, coin, permissionCharacter);
        }
        return html;
    }
    // 单卡片渲染(含选中态/禁用态/数量回填/已选角标)
    function shopRenderItemCard(item, cat, slot, coin, permissionCharacter) {
        var inner = '';
        var isConsume = (cat === '道具区');
        if (cat === '技能区') inner = shopBuildSkillCard(item);
        else if (cat === '血统区') inner = shopBuildBloodlineCard(item);
        else if (cat === '装备区') inner = shopBuildEquipCard(item);
        else if (cat === '升级区') inner = shopBuildUpgradeCard(item);
        else if (cat === '形态区') inner = shopBuildFormCard(item);
        else if (isConsume) inner = shopBuildConsumeCard(item);
        else inner = shopBuildSkillCard(item);
        var isSelected = shopIsSelected(item.name, cat, slot);
        var sel = isSelected ? ' selected' : '';
        var permissionSd = getStatData() || {};
        var permission = shopPermissionDecision(permissionCharacter || {}, item, permissionSd.角色 && permissionSd.角色.权限凭证);
        // 已选中的越权旧条目仍允许点击取消；未选中的越权商品直接锁死。
        var permissionLocked = (!isSelected && !permission.allowed);
        // 禁用判定: 已选中的不灰(允许调整数量/取消); 未选中且单件价格>余额 → 灰调禁用
        // 道具区按"1件价格"判定(可后续加数量); 其他区按单件价格
        var unitPrice = Number(item.price || 0);
        // 禁用判定基于"剩余余额"(原始余额-已选合计), 避免叠加选中后仍可继续点
        var remain = shopRemain(coin);
        var unaffordable = (!isSelected && remain < unitPrice);
        // ★ 血统区上限: 血统已满时【不禁用】商品卡片(融合会替换一条旧血统, 总数不变),
        //   仅追加"已满·需融合"提示条引导; "直接购买"的满额灰度在融合弹窗内处理
        var bloodFullHint = (cat === '血统区' && !isSelected && shopBloodCount >= shopBloodLimit);
        // ★ 血统区在融合进行中(bloodFusionBusy): 未选中的血统商品灰显(血统相关操作被屏蔽);
        //   已选中的仍允许取消; 其他区域(装备/道具/技能/升级)不受融合影响, 正常可购买
        var bloodFusionLock = (cat === '血统区' && !isSelected && bloodFusionBusy);
        // ★ 升级区在融合进行中: 若该升级卡片"replace_target = 本次正在被融合的某条血统" → 灰锁
        //   (原血统正在被消耗, 在融合结果出来之前先暂停其对应升级服务的购买)
        if (cat === '升级区' && !isSelected && bloodFusionBusy && item.category === '血统'
            && bloodFusionConsumedNames.length && bloodFusionConsumedNames.indexOf(item.replace_target || '') >= 0) {
            bloodFusionLock = true;
        }
        var disReason = permissionLocked ? 'permission' : (unaffordable ? 'unaffordable' : (bloodFusionLock ? 'fusionbusy' : ''));
        var dis = disReason ? ' disabled' : '';
        var dataAttrs = ' data-name="'+esc(item.name)+'" data-cat="'+esc(cat)+'" data-slot="'+esc(slot||'')+'" data-dis-reason="'+disReason+'"';
        // 已选角标(选中时显示); 道具区角标文案带数量
        var cornerLabel = isSelected ? (isConsume ? ('已选 ×'+(shopGetQty(item.name, cat)||0)) : '已选') : '';
        var cornerHtml = '<span class="sam-shop-sel-corner">'+esc(cornerLabel)+'</span>';
        // 血统已满提示条(不禁用卡片, 引导用户走融合替换流程)
        var hintHtml = bloodFullHint ? '<div class="sam-shop-blood-full-hint" style="margin-top:6px;padding:4px 8px;font-size:11px;color:var(--sam-hp);background:rgba(255,107,107,0.1);border-radius:6px;text-align:center;line-height:1.4">血统已满 · 购买将进入融合替换</div>' : '';
        var permissionHint = (!permission.allowed) ? '<div class="sam-shop-permission-hint" style="margin-top:6px;padding:5px 8px;font-size:11px;color:var(--sam-warning);background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25);border-radius:6px;text-align:center;line-height:1.4">🔒 权限不足 · 当前上限 '+esc(permission.capGrade)+' · 商品 '+esc(permission.requiredGrade)+'</div>' : '';
        return '<div class="sam-shop-item'+sel+dis+'"'+dataAttrs+'>'+inner+cornerHtml+hintHtml+permissionHint+'</div>';
    }
    // 底部购物车条
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
    // ---- 执行层: 提交交易(/send 文本|/trigger + 写回MVU) ----
