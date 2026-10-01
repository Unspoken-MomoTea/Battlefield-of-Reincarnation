/* ===== 血统融合：结果完全由正文 API 返回，前端只负责选择、等待与写回 ===== */
    /* bloodFusionBusy 仅锁定"血统相关"操作(打开融合舱/执行融合/购买商城血统),
       其他商城操作(切换区域Tab/选装备/道具/技能/刷新商品)不受影响 */
    var bloodFusionBusy = false;
    var bloodFusionShopItem = null;
    var bloodFusionActionActor = '角色'; // 本次融合的写入目标(面板入口=角色, 商店入口跟随 shopCurrentActor)
    var bloodFusionLastVals = { a: null, b: null }; // A/B 联动: 记录各方上次选中值, 用于撞值时交换
    var BLOODLINE_RANK = { F:1, E:2, D:3, C:4, B:5, A:6, S:7, SS:8, SSS:9 };
    function bloodFusionEntries(extra) {
        var sd = getStatData(), ctx = shopResolveCharacter(sd, shopCurrentActor);
        var ch = ctx.character || {};
        var blood = ch && ch.血统 || {};
        var list = [];
        Object.keys(blood).forEach(function(name) { list.push({ name:name, data:blood[name] || {}, owned:true }); });
        if (extra) list.push({ name:extra.name, data:extra, owned:false });
        return list;
    }
    function bloodFusionOption(entry, selected, hidden) {
        return '<option value="'+esc(entry.name)+'"'+(selected ? ' selected' : '')+(hidden ? ' hidden' : '')+'>'+esc(entry.name)+' · '+esc(entry.data.品质 || 'F')+'</option>';
    }
    /* 血统融合规则库: 同级 / 高低级 两套结果公式, 用于融合舱规则面板展示 + 前端概率算法 */
    var BLOOD_FUSION_RULES = {
        same: [ // 同级血统融合
            { name:'完美升阶', weight:20, cls:'r-good', list:['品质+1阶','五维补全至目标品质正常区间','A/B 双优质词条融合','若双方血统均具有形态倾向，可生成1个融合形态，形态层级与属性独立判定'] },
            { name:'瑕疵升阶', weight:35, cls:'r-mid', list:['品质+1阶','五维补全至目标品质最低区间','A/B 双普通词条融合','附加高危负面代价词条 1 条'] },
            { name:'变异觉醒', weight:30, cls:'r-mid', list:['品质不变','属性变化随融合度','清空双方所有词条','随机生成变异词条','根据融合结果判定是否觉醒新形态，形态层级与属性独立判定'] },
            { name:'基因崩溃', weight:15, cls:'r-bad', list:['A 保持原状','B 永久消耗','不产生收益'] }
        ],
        diff: [ // 高低级
            { name:'稳定强化', weight:35, cls:'r-good', list:['品质不变','五维增加 B 的 20%','融合 B 一条适配被动','若A/B血统存在形态，根据融合结果决定继承、改造，形态层级与属性独立判定'] },
            { name:'词条变异', weight:35, cls:'r-mid', list:['品质不变','属性保持 A 不变','词条能力重构'] },
            { name:'基因排斥', weight:20, cls:'r-bad', list:['品质不变','属性保持 A 不变','生成负面基因杂质词条'] },
            { name:'崩坏消散', weight:10, cls:'r-bad', list:['A 保持原状','B 永久消耗','不产生收益'] }
        ]
    };
    /* 前端概率算法: 按 weight 权重 roll 出一个确定结果(同步 '脚本/脚本测试.js' 算法)
       输入 mode='same'|'diff', 返回 BLOOD_FUSION_RULES[mode] 中的某个规则对象 {name, weight, list, cls} */
    function bloodFusionRoll(mode) {
        var t = BLOOD_FUSION_RULES[mode] || BLOOD_FUSION_RULES.same;
        var total = 0;
        for (var i = 0; i < t.length; i++) total += t[i].weight;
        var r = Math.random() * total;
        for (var j = 0; j < t.length; j++) {
            r -= t[j].weight;
            if (r < 0) return t[j];
        }
        return t[t.length - 1];
    }
    /* 上一次前端 roll 出的结果(供 bloodFusionStart → bloodFusionBuildPrompt 传给 AI;
       AI 仅按此结果渲染血统数据, 禁止自行选择) */
    var bloodFusionResult = null;
    /* 本次融合正在消耗的血统名(A 与 B), 用于:
       1) 融合进行中: 升级区里"替换目标 = 这些血统"的升级卡片灰显锁定;
       2) 融合成功: 升级区里"替换目标 = 被删血统"的升级条目一并从商城升级列表删除
       (原血统已被融合消耗, 对应的旧升级服务失去意义) */
    var bloodFusionConsumedNames = [];
    /* 融合回合计数: 每次 bloodFusionStart +1, 旧 Promise 回调回合不匹配时丢弃结果(支持"停止融合"打断卡死请求);
       bloodFusionSnap 保存开始时已扣除的空间币与商品库快照, 供 bloodFusionStop / 失败时回滚 */
    var bloodFusionEpoch = 0;
    var bloodFusionSnap = null;
    /* 血统卡片预览(复用 fullCard, 只读): 质量/标签/原始属性/效果/描述 */
    function bloodFusionPreviewCardHtml(entry) {
        if (!entry) return '<div class="sam-fusion-preview-empty">— 无可用血统 —</div>';
        var b = entry.data || {}, q = parseRarity(b.品质);
        var rows = '', body = '<div class="sam-fc-body">';
        body += fcBody('标签', formatTags(b.标签 || [], '', false), 'sam-fc-tags');
        if (b.原始属性 && typeof b.原始属性 === 'object' && Object.keys(b.原始属性).length > 0) {
            body += fcBodyCollapsible('原始属性', formatStatGrid(b.原始属性, 3), 'sam-fc-stats', false);
        }
        body += fcBody('效果', formatEffects(b.效果 || {}, '', false), 'sam-fc-effects');
        body += fcBody('描述', esc(safeStr(b.描述)));
        body += '</div>';
        var badge = entry.owned ? '<span class="sam-fusion-owned-pill" style="font-size:10px;padding:2px 6px;border-radius:8px;background:rgba(143,159,255,0.18);color:var(--sam-sub)">已持有</span>' : '<span class="sam-fusion-shop-pill" style="font-size:10px;padding:2px 6px;border-radius:8px;background:var(--sam-hp);color:#fff">商城商品</span>';
        return '<div class="sam-fusion-preview">'+fullCard(q, entry.name, rows, body, badge)+'</div>';
    }
    /* 规则面板: 按 mode=same/diff 渲染对应结果公式卡片网格 */
    function bloodFusionRulePanelHtml(mode) {
        var list = BLOOD_FUSION_RULES[mode] || [];
        var title = (mode === 'same') ? '同级融合 · 概率分布' : '高低级融合 · 概率分布';
        var cards = list.map(function(r) {
            var lis = r.list.map(function(t){ return '<li>'+esc(t)+'</li>'; }).join('');
            return '<div class="sam-fusion-rule-card '+r.cls+'">'
                + '<div class="rhead"><span class="rname">'+esc(r.name)+'</span><span class="rw">'+r.weight+'%</span></div>'
                + '<ul class="rlist">'+lis+'</ul>'
                + '</div>';
        }).join('');
        return '<div class="sam-fusion-rule">'
            + '<div class="sam-fusion-rule-title"><span class="name">'+esc(title)+'</span><span class="pill">前端按权重 roll · AI 仅渲染数据</span></div>'
            + '<div class="sam-fusion-rule-grid">'+cards+'</div></div>';
    }
    /* 取 entry 品质数值 */
    function bloodFusionRankOf(entry) {
        if (!entry || !entry.data) return 1;
        return BLOODLINE_RANK[String(entry.data.品质 || 'F').toUpperCase()] || 1;
    }
    /* 渲染融合舱内 A/B 下拉框(撞值交换 + 过滤规则, A/B 双向对称):
       - 本方当前选中项: selected + hidden(展开列表隐藏, select 仍显示当前值)
       - B 列 maxRank 约束: 品质 > maxRank(A 品质) 的项直接跳过(B 不得高于 A)
       - excludeName 对方当前同名项: 双方都仅当 A 与 B 当前同品质(同级)时显示 '(= 对方, 点击交换)',
         否则隐藏(同级才允许交换, 不同级时交换会让 B>A 违反 B≤A)
       规则总结: B 选项必须 ≤ A 品质; 同名同条血统不可同时被选 A 与 B;
                 A 与 B 同品质(同级)时, A/B 双方下拉都显示对方当前项作为撞值交换入口 */
    function bloodFusionSelectHtml(entries, role, selName, maxRank, excludeName) {
        var selRank = null, exclRank = null;
        for (var k = 0; k < entries.length; k++) {
            if (entries[k].name === selName) selRank = bloodFusionRankOf(entries[k]);
            if (excludeName && entries[k].name === excludeName) exclRank = bloodFusionRankOf(entries[k]);
        }
        var sameRank = (selRank !== null && exclRank !== null && selRank === exclRank);
        var html = '<select class="sam-fusion-select" data-fusion-role="'+role+'" style="width:100%;margin-top:4px">';
        entries.forEach(function(x) {
            if (x.name === selName) { html += bloodFusionOption(x, true, true); return; }
            if (excludeName && x.name === excludeName) {
                // 双方都仅当 A 与 B 同品质(同级)时才显示 '(= 对方, 点击交换)', 否则隐藏
                if (sameRank) {
                    var peer = (role === 'a') ? 'B' : 'A';
                    html += '<option value="'+esc(x.name)+'">'+esc(x.name)+' · '+esc(x.data.品质 || 'F')+' (点击交换)</option>';
                }
                return;
            }
            if (role === 'b' && maxRank != null && bloodFusionRankOf(x) > maxRank) return;
            html += bloodFusionOption(x, false, false);
        });
        html += '</select>';
        return html;
    }
    /* 重建 A/B 两个下拉框:
       - A 列: B 当前同名项仅当 A、B 同品质时显示为 '(= B, 点击交换)', 否则隐藏; 其他项可见可选
       - B 列: A 当前同名项仅当 A、B 同品质时显示为 '(= A, 点击交换)', 否则隐藏; 品质>A 的项跳过 */
    function bloodFusionRebuildSelects(entries, aVal, bVal) {
        var aEntry = null;
        for (var i = 0; i < entries.length; i++) { if (entries[i].name === aVal) { aEntry = entries[i]; break; } }
        var maxRank = aEntry ? bloodFusionRankOf(aEntry) : 9;
        $('.sam-fusion-select[data-fusion-role="a"]').replaceWith(bloodFusionSelectHtml(entries, 'a', aVal, null, bVal));
        $('.sam-fusion-select[data-fusion-role="b"]').replaceWith(bloodFusionSelectHtml(entries, 'b', bVal, maxRank, aVal));
    }
    /* 计算直接购买按钮状态: 血统数已满 → 灰度+左侧提示文案(不弹窗); 否则正常可点 */
    function bloodFusionDirectBtnState() {
        if (!bloodFusionShopItem) return { show: false };
        var sd = getStatData();
        var bctx = shopResolveCharacter(sd, bloodFusionActionActor);
        var bch = bctx.character || {};
        var cap = BLOODLINE_CAP, count = Object.keys(bch.血统 || {}).length;
        var full = (count >= cap);
        return { show: true, full: full, count: count, cap: cap };
    }
    /* 智能 A/B 初始选值:
       - 无 shopItem(从血统面板进入): entries 全部为自身血统, 按品质降序, A=最高, B=次高(A≥B)
       - 有 shopItem(从血统商店进入): B 默认 = 商店血统; A = 自身最高品质血统
         (除非商店血统品质 > 自身最高品质 → A=商店血统, B=自身最高品质血统) */
    function bloodFusionPickInitialAB(entries, shopItem) {
        if (entries.length < 2) return { aName: null, bName: null };
        var owned = entries.filter(function(e){ return e.owned; }).sort(function(p,q){ return bloodFusionRankOf(q) - bloodFusionRankOf(p); });
        var shopEntry = shopItem ? entries.filter(function(e){ return !e.owned; })[0] : null;
        if (!shopEntry) {
            // 面板入口: A=最高, B=次高
            return { aName: owned[0].name, bName: owned[1].name };
        }
        if (owned.length === 0) return { aName: shopEntry.name, bName: null };
        var topOwned = owned[0];
        if (bloodFusionRankOf(shopEntry) > bloodFusionRankOf(topOwned)) {
            // 商店血统更高级 → A=商店, B=自身最高(同级或更低)
            return { aName: shopEntry.name, bName: topOwned.name };
        }
        // 商店血统 ≤ 自身最高 → A=自身最高, B=商店血统
        return { aName: topOwned.name, bName: shopEntry.name };
    }
    /* 在 entries 中按品质降序, 找到第一个 ≠ excludeName 且 rank ≤ maxRank 的可用项(用于 B 回退) */
    function bloodFusionPickBUnderA(entries, excludeName, maxRank) {
        var sorted = entries.slice().sort(function(p,q){ return bloodFusionRankOf(q) - bloodFusionRankOf(p); });
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i].name === excludeName) continue;
            if (bloodFusionRankOf(sorted[i]) > maxRank) continue;
            return sorted[i].name;
        }
        return null;
    }
    /* 判定融合类型: A/B 品质同级 → 'same'(同级融合); 否则 → 'diff'(高低级融合) */
    function bloodFusionJudgeMode(aName, bName, entries) {
        var find = function(n) {
            for (var i = 0; i < entries.length; i++) { if (entries[i].name === n) return entries[i]; }
            return null;
        };
        var a = find(aName), b = find(bName);
        if (!a || !b) return 'same';
        var ar = BLOODLINE_RANK[String(a.data.品质 || 'F').toUpperCase()] || 1;
        var br = BLOODLINE_RANK[String(b.data.品质 || 'F').toUpperCase()] || 1;
        return (ar === br) ? 'same' : 'diff';
    }
    /* 同步刷新舱内 A/B 预览卡片 + 规则面板(不重建下拉框, 由调用方负责 selects) */
    function bloodFusionRefreshPreview(entries, aName, bName) {
        var find = function(n) {
            for (var i = 0; i < entries.length; i++) { if (entries[i].name === n) return entries[i]; }
            return null;
        };
        $('.sam-fusion-col[data-role="a"] .sam-fusion-preview-wrap').html(bloodFusionPreviewCardHtml(find(aName)));
        $('.sam-fusion-col[data-role="b"] .sam-fusion-preview-wrap').html(bloodFusionPreviewCardHtml(find(bName)));
        var mode = bloodFusionJudgeMode(aName, bName, entries);
        $('.sam-fusion-rule-host').html(bloodFusionRulePanelHtml(mode));
    }
    /* 渲染融合舱头部行动条(商城入口: 已满→[替换当前血统|融合当前血统]二选一, 未满→直接购买; 面板入口: 取消/开始融合) */
    function bloodFusionActionsHtml(shopItem) {
        var html = '<div class="sam-fusion-actions" style="display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap">';
        if (shopItem) {
            var st = bloodFusionDirectBtnState();
            if (st.full) {
                // ★ 血统栏已满(CAP=1时为常态): 不再灰度卡死, 提供两种处置 —— 融合当前血统 / 替换当前血统
                html += '<span class="sam-fusion-direct-hint" style="flex:1;min-width:160px;font-size:11px;color:var(--sam-hp);line-height:1.4">⚠ 血统栏已满 ('+st.count+'/'+st.cap+')。可将新血统与当前血统融合，或直接替换掉当前血统。</span>'
                    + '<button type="button" class="sam-confirm-btn cancel sam-fusion-replace-open">替换当前血统</button>';
            } else {
                html += '<span class="sam-fusion-direct-hint" style="flex:1;min-width:160px;font-size:11px;color:var(--sam-sub);line-height:1.4">血统栏余位 '+st.count+'/'+st.cap+'，可直接购入。</span>'
                    + '<button type="button" class="sam-confirm-btn cancel sam-fusion-direct">直接购买</button>';
            }
        } else {
            html += '<button type="button" class="sam-confirm-btn cancel sam-fusion-direct">取消</button>';
        }
        html += '<button type="button" class="sam-confirm-btn ok sam-fusion-start">'+(shopItem ? '融合当前血统' : '开始融合')+'</button></div>';
        return html;
    }
    function openBloodFusionModal(shopItem) {
        // ★ 融合进行中: 仍允许打开舱门查看进度, 但只显示等待提示(不可再次发起融合)
        if (bloodFusionBusy) {
            showModal('血统融合进行中', '<div class="sam-shop-refreshing"><div class="sam-fusion-pulse">🧬</div><div>主神正在校验血统相性并执行融合算法…<br>请等待当前融合完成后再发起下一次。</div><button type="button" class="sam-shop-stop-btn" data-sam-act="blood-fusion-stop">⏹ 停止融合(卡住时点此恢复)</button></div>');
            return;
        }
        bloodFusionShopItem = shopItem || null;
        // ★ 融合写入目标: 血统面板入口(无商店血统) → 角色; 商店入口(有 shopItem) → 跟随当前商城选中角色
        bloodFusionActionActor = shopItem ? (shopCurrentActor || SHOP_ACTOR_REINCARNATOR) : SHOP_ACTOR_REINCARNATOR;
        var extra = shopItem ? { name:shopItem.name, 品质:shopItem.rating, 标签:shopItem.tags || [], 原始属性:shopItem.raw_attrs || {}, 效果:shopItem.effects || {}, 描述:shopItem.description || '' } : null;
        var entries = bloodFusionEntries(extra);
        var title = shopItem ? '血统购入与融合确认' : '血统融合舱';
        var head = '<div class="sam-fusion-head">'
            + '<span class="ico" style="font-size:22px">🧬</span>'
            + '<span class="ttl" style="font-size:15px;font-weight:600;color:var(--sam-fg)">血统融合舱</span>'
            + '<span class="sub" style="font-size:11px;color:var(--sam-sub);line-height:1.5">主血统 <b style="color:var(--sam-accent)">A</b> 决定核心方向 · 外貌与主要能力<br>副素材 <b style="color:var(--sam-hp)">B</b> 融合后永久消耗 · 结果不可撤销</span>'
            + '</div>';
        // ★ 血统不足2条: 仍打开弹窗, A/B 下拉框为空+灰度不可点, 预览显示空态, 不再弹 toast 拦截
        if (entries.length < 2) {
            var emptySelHtml = '<select class="sam-fusion-select" data-fusion-role="" disabled style="opacity:0.5;cursor:not-allowed;filter:grayscale(1)"><option value="" selected disabled>— 无可用血统 —</option></select>';
            bloodFusionLastVals = { a: null, b: null };
            var emptyCard = bloodFusionPreviewCardHtml(null);
            var html2 = '<div class="sam-fusion-wrap">'
                + head
                + '<div class="sam-fusion-pair">'
                + '<div class="sam-fusion-col" data-role="a"><div class="sam-fusion-col-label"><span class="tag a">A</span><span class="role">主血统</span><span class="note">决定核心方向</span></div>'+emptySelHtml+'<div class="sam-fusion-preview-wrap">'+emptyCard+'</div></div>'
                + '<div class="sam-fusion-arrow">⇌</div>'
                + '<div class="sam-fusion-col" data-role="b"><div class="sam-fusion-col-label"><span class="tag b">B</span><span class="role">副素材</span><span class="note">永久消耗</span></div>'+emptySelHtml+'<div class="sam-fusion-preview-wrap">'+emptyCard+'</div></div>'
                + '</div>'
                + '<div class="sam-shop-warn" style="margin-top:2px">'+(shopItem ? '当前角色暂无可用于融合的现有血统，可直接购入该血统。' : '至少需要两条血统才能进行融合。当前血统栏不足。')+'</div>'
                + (shopItem ? bloodFusionActionsHtml(shopItem).replace('class="sam-confirm-btn ok sam-fusion-start"', 'class="sam-confirm-btn ok sam-fusion-start" disabled style="opacity:0.5;cursor:not-allowed;filter:grayscale(1)"').replace('>融合当前血统<', '>开始融合<') : '<div style="display:flex;justify-content:flex-end;margin-top:2px"><button type="button" class="sam-confirm-btn cancel sam-fusion-direct">取消</button></div>')
                + '</div>';
            showModal(title, html2);
            return;
        }
        // ★ 智能 A/B 初始选值: 面板入口(无 shopItem) → A=自身最高, B=次高; 商店入口 → A=高级方, B=低级方/商店血统
        var pick = bloodFusionPickInitialAB(entries, shopItem);
        var aEntry = null, bEntry = null;
        for (var pi = 0; pi < entries.length; pi++) {
            if (entries[pi].name === pick.aName) aEntry = entries[pi];
            if (entries[pi].name === pick.bName) bEntry = entries[pi];
        }
        bloodFusionLastVals = { a: pick.aName, b: pick.bName }; // 记录初始值, 供联动交换使用
        var maxRank0 = aEntry ? bloodFusionRankOf(aEntry) : 9;
        var mode = bloodFusionJudgeMode(pick.aName, pick.bName, entries);
        var html = '<div class="sam-fusion-wrap">'
            + head
            + '<div class="sam-fusion-pair">'
            + '<div class="sam-fusion-col" data-role="a"><div class="sam-fusion-col-label"><span class="tag a">A</span><span class="role">主血统</span><span class="note">决定核心方向</span></div>'+bloodFusionSelectHtml(entries, 'a', pick.aName, null, pick.bName)+'<div class="sam-fusion-preview-wrap">'+bloodFusionPreviewCardHtml(aEntry)+'</div></div>'
            + '<div class="sam-fusion-arrow">⇌</div>'
            + '<div class="sam-fusion-col" data-role="b"><div class="sam-fusion-col-label"><span class="tag b">B</span><span class="role">副素材</span><span class="note">永久消耗</span></div>'+bloodFusionSelectHtml(entries, 'b', pick.bName, maxRank0, pick.aName)+'<div class="sam-fusion-preview-wrap">'+bloodFusionPreviewCardHtml(bEntry)+'</div></div>'
            + '</div>'
            + '<div class="sam-fusion-rule-host">'+bloodFusionRulePanelHtml(mode)+'</div>'
            + '<div class="sam-shop-warn" style="margin-top:2px">A 须为主血统(品质 ≥ B); B 选项不可高于 A。品质不同时以较高品质血统作为主血统 A。融合结果由主神算法接口返回，无法撤销、不可回档。</div>'
            + bloodFusionActionsHtml(shopItem)
            + '</div>';
        showModal(title, html);
    }
    /* A/B 联动(撞值交换 + B≤A 约束):
       - 撞值交换: 一方切到对方当前同名项 → 对方自动切回本方旧值
         例: A=D1, B=D2, 在 B 下拉点 'D1 (= A, 点击交换)' → B=D1, A 自动变 D2
       - A 切换后若 B 失效(品质>A 或与新 A 同名) → B 回退到品质 ≤ A 的最高可用项(≠A 同名)
       - B 切换后: 已被下拉过滤保证 ≤A; 若 B 新品质 > A 品质(理论不会发生)则兜底回退 */
    function bloodFusionSyncSelect(role) {
        var $a = $('.sam-fusion-select[data-fusion-role="a"]');
        var $b = $('.sam-fusion-select[data-fusion-role="b"]');
        if (!$a.length || !$b.length) return;
        var entries = bloodFusionEntries(bloodFusionShopItem ? { name:bloodFusionShopItem.name, 品质:bloodFusionShopItem.rating, 标签:bloodFusionShopItem.tags || [], 原始属性:bloodFusionShopItem.raw_attrs || {}, 效果:bloodFusionShopItem.effects || {}, 描述:bloodFusionShopItem.description || '' } : null);
        var oldA = bloodFusionLastVals.a, oldB = bloodFusionLastVals.b;
        var newVal = (role === 'a') ? $a.val() : $b.val();
        var otherVal = (role === 'a') ? $b.val() : $a.val();
        var aVal = (role === 'a') ? newVal : otherVal;
        var bVal = (role === 'b') ? newVal : otherVal;
        // 撞值交换: 本方新值 = 对方当前值 → 对方切回本方旧值
        //   例: role='a', A 由 D1 改为 D2(=B 当前), 此时 A 接 B 的旧位 D2, B 应自动接 A 的旧位 D1 → bVal = oldA
        //   例: role='b', B 由 D2 改为 D1(=A 当前), 此时 B 接 A 的旧位 D1, A 应自动接 B 的旧位 D2 → aVal = oldB
        if (newVal === otherVal && oldA && oldB && oldA !== oldB) {
            if (role === 'a') { bVal = oldA; }
            else { aVal = oldB; }
        }
        // B≤A 约束: 若 B 品质 > A 品质 → B 回退到品质 ≤ A 的最高可用项(≠A 同名)
        var aEntryFinal = null;
        for (var af = 0; af < entries.length; af++) { if (entries[af].name === aVal) { aEntryFinal = entries[af]; break; } }
        if (aEntryFinal) {
            var maxRankF = bloodFusionRankOf(aEntryFinal);
            var bEntryFinal = null;
            for (var bf = 0; bf < entries.length; bf++) { if (entries[bf].name === bVal) { bEntryFinal = entries[bf]; break; } }
            if (!bEntryFinal || bVal === aVal || bloodFusionRankOf(bEntryFinal) > maxRankF) {
                var pickB = bloodFusionPickBUnderA(entries, aVal, maxRankF);
                if (pickB) bVal = pickB;
            }
        }
        bloodFusionLastVals = { a:aVal, b:bVal };
        bloodFusionRebuildSelects(entries, aVal, bVal);
        bloodFusionRefreshPreview(entries, aVal, bVal);
    }
    async function bloodFusionStart(aName, bName) {
        if (!aName || !bName || aName === bName) { samToast('warning', '请为 A 与 B 选择两条不同的血统'); return; }
        var entries = bloodFusionEntries(bloodFusionShopItem ? { name:bloodFusionShopItem.name, 品质:bloodFusionShopItem.rating, 标签:bloodFusionShopItem.tags || [], 原始属性:bloodFusionShopItem.raw_attrs || {}, 效果:bloodFusionShopItem.effects || {}, 描述:bloodFusionShopItem.description || '' } : null);
        var a = entries.filter(function(x){return x.name === aName;})[0], b = entries.filter(function(x){return x.name === bName;})[0];
        if (!a || !b) { samToast('error', '血统数据已变化，请重新打开融合舱'); return; }
        if (bloodFusionShopItem && a.name !== bloodFusionShopItem.name && b.name !== bloodFusionShopItem.name) {
            samToast('warning', '商城血统必须作为本次融合的 A 或 B'); return;
        }
        var ar = BLOODLINE_RANK[String(a.data.品质 || 'F').toUpperCase()] || 1, br = BLOODLINE_RANK[String(b.data.品质 || 'F').toUpperCase()] || 1;
        if (ar < br) { var swap = a; a = b; b = swap; }
        // AI 接口检查推迟到 roll 之后: 基因崩溃/崩坏消散 不调用 AI(纯本地写回), 无需接口; 其他结果仍要求接口
        var _mode0 = (ar === br) ? 'same' : 'diff';
        var _roll0 = bloodFusionRoll(_mode0);
        var _isNoAIResult = _roll0 && (_roll0.name === '基因崩溃' || _roll0.name === '崩坏消散');
        // 启用额外模型配置时走自托管API, 否则需 generateRaw 做融合结果生成
        if (!_isNoAIResult && !isApiConfigEnabled() && !shopGetAI()) { samToast('error', '未检测到融合算法接口(或在设置里启用额外模型配置)'); return; }
        if (!_isNoAIResult && isApiConfigEnabled() && !getApiConfig().model) { samToast('error', '额外模型配置已启用但未选择模型, 请先在设置面板选择模型'); return; }
        // ★ 商城血统融合: 开始融合时立即扣币 + 从商店删除血统商品(不等融合结束)
        //   融合失败/被用户停止则回滚(还原空间币+商品库), 保证原子性; 成功后不再重复扣币/删商品库
        bloodFusionSnap = null;
        if (bloodFusionShopItem) {
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
                if (_lib && Array.isArray(_lib.血统列表)) {
                    _lib.血统列表 = _lib.血统列表.filter(function(item) { return safeStr(item.名称) !== bloodFusionShopItem.name; });
                }
            });
            if (!preOk) { samToast('error', '扣除空间币失败，无法开始融合'); return; }
            // 立即同步本地缓存, 商店列表中该血统即刻消失
            try {
                var freshSd = getStatData();
                var freshLib0 = shopGetActorLibRaw(freshSd && freshSd.商城, preActor);
                if (freshLib0) {
                    shopMarketData = shopNormalizeMarketData(freshLib0);
                    if (!shopTabHasData(shopActiveTab)) shopActiveTab = shopPickFirstAvailableTab();
                }
            } catch(eSnap) {}
            shopCart = [];
        }
        // ★ 前端按权重 roll 出确定性结果(同步脚本测试.js 算法), AI 仅渲染该结果对应血统数据
        //   复用 line ~1685 处已 roll 的 _roll0(避免重复随机导致前后不一致)
        bloodFusionResult = _roll0;
        bloodFusionBusy = true;
        // ★ 推进回合号: 用户点"停止融合"或重发起一次新融合时 epoch 已变, 旧 Promise 回调回合不匹配即丢弃结果
        bloodFusionEpoch += 1;
        var myEpoch = bloodFusionEpoch;
        // 记录本次融合将消耗的角色侧原血统名(A、B 中所有 owned:true 的条目),
        // 用于:1) 融合进行中升级区"replace_target=这些血统"的升级卡片灰锁;
        //       2) 融合成功后从商城升级列表删除已无对应血统的升级条目
        bloodFusionConsumedNames = [];
        if (a && a.owned) bloodFusionConsumedNames.push(a.name);
        if (b && b.owned) bloodFusionConsumedNames.push(b.name);

        // ★ 短路径: roll 出【基因崩溃 / 崩坏消散】时无需调用 AI 渲染,
        //   规则为 "A 保持原状 / B 永久消耗 / 不产生收益" — 直接弹融合进行中 → 10s 倒计时后写回(仅删除 B, 不增新血统, 不增形态)
        var rollName0 = bloodFusionResult ? bloodFusionResult.name : '';
        if (rollName0 === '基因崩溃' || rollName0 === '崩坏消散') {
            closeModal();
            renderAll();
            showModal('血统融合进行中', '<div class="sam-shop-refreshing"><div class="sam-fusion-pulse">🧬</div><br>主神正在按法则融合血统数据…<br>你可以关闭窗口，结果会在返回后自动写入。<button type="button" class="sam-shop-stop-btn" data-sam-act="blood-fusion-stop">⏹ 停止融合(卡住时点此恢复)</button></div></div>');
            var delayMs = 10000;
            // 使用 Promise 化的 setTimeout 以兼容 epoch 守卫(若用户点停止, epoch 变化即丢弃迟到回写)
            await new Promise(function(resolve){ setTimeout(resolve, delayMs); });
            if (myEpoch !== bloodFusionEpoch || !bloodFusionBusy) return;  // 期间被"停止融合"打断 → 不写回
            // 写回: 只删除角色侧的 B 血统(b.owned 才删除), 不增新血统, 不写形态库; A 保持原状;
            //   升级列表的清理逻辑沿用成功路径(replace_target 命中已删 B 的升级条目一并剔除)
            var consumedNames0 = bloodFusionConsumedNames.slice();
            var _actor0 = bloodFusionActionActor || SHOP_ACTOR_REINCARNATOR;
            var ok0 = writeBackMvu(function(statData) {
                var _ctx0 = shopResolveCharacter(statData, _actor0);
                var _ch0 = _ctx0.character || {};
                _ch0.血统 = _ch0.血统 || {};
                if (b.owned) delete _ch0.血统[b.name];
                if (bloodFusionSnap && bloodFusionShopItem) {
                    shopAppendReceipt(statData, shopReceiptLine('血统融合', bloodFusionShopItem.name+' → '+rollName0, bloodFusionSnap.price, statData.角色.空间币, (bloodFusionActionActor === SHOP_ACTOR_REINCARNATOR ? '角色' : bloodFusionActionActor)));
                }
                var _ulib0 = shopGetActorLibRaw(statData.商城, _actor0);
                if (_ulib0 && Array.isArray(_ulib0.升级列表) && consumedNames0.length) {
                    _ulib0.升级列表 = _ulib0.升级列表.filter(function(u) {
                        var upCat = String(shopPick(u, 'category','所属大类','类型','type') || '');
                        var tgt = String(shopPick(u, 'replace_target','替换目标') || '');
                        if (upCat === '血统' && tgt && consumedNames0.indexOf(tgt) >= 0) return false;
                        return true;
                    });
                }
            });
            if (!ok0) {  // 极少见: MVU 写回失败 → 按现有失败回滚处理(回补空间币+商品库)
                if (bloodFusionSnap) {
                    try {
                        writeBackMvu(function(statData) {
                            statData.角色 = statData.角色 || {};
                            statData.角色.空间币 = safeNum(statData.角色.空间币, 0) + bloodFusionSnap.price;
                            statData.角色.权限凭证 = statData.角色.权限凭证 || {};
                            shopCredentialRefund(statData.角色.权限凭证, bloodFusionSnap.credentialRequirements || {});
                            if (bloodFusionSnap.preBloodLib !== null && statData.商城) {
                                var _rlib0 = shopGetActorLibRaw(statData.商城, bloodFusionSnap.preActor);
                                if (_rlib0) _rlib0.血统列表 = bloodFusionSnap.preBloodLib.slice();
                            }
                        });
                    } catch(eRoll0) { try { console.warn('[主神终端] '+rollName0+' 写回失败回滚异常:', eRoll0.message); } catch(e2){} }
                }
                bloodFusionBusy = false; bloodFusionShopItem = null; bloodFusionResult = null; bloodFusionConsumedNames = []; bloodFusionSnap = null; closeModal();
                renderAll();
                samToast('error', rollName0+' 写回失败，已回滚');
                return;
            }
            // 升级区本地缓存同步
            try {
                var freshSd0 = getStatData();
                var freshLib0a = shopGetActorLibRaw(freshSd0 && freshSd0.商城, bloodFusionActionActor);
                if (freshLib0a) {
                    shopMarketData = shopNormalizeMarketData(freshLib0a);
                    if (!shopTabHasData(shopActiveTab)) shopActiveTab = shopPickFirstAvailableTab();
                }
            } catch(eFresh0) {}
            // 写回成功, 回滚快照不再需要
            bloodFusionSnap = null;
            var rollResult0 = bloodFusionResult;
            var rollWeight0 = rollResult0 ? rollResult0.weight : '';
            closeModal(); bloodFusionBusy = false; bloodFusionShopItem = null; bloodFusionResult = null; bloodFusionConsumedNames = [];
            renderAll();
            showModal('融合结果 · '+rollName0, '<div class="sam-shop-warn">融合结果：'+esc(rollName0)+'</div>'
                + '<div class="sam-full-card">'+esc(a.name)+' 保持原状；'+esc(b.name)+' 已永久消散，不再产生任何收益。</div>'
                + '<div class="sam-full-card" style="opacity:0.85">规则: '+(rollResult0 && rollResult0.list ? rollResult0.list.join(' / ') : 'A 保持原状 / B 永久消耗 / 不产生收益')+'</div>');
            return;  // 短路径结束, 不走后续 AI 流程
        }

        closeModal();
        renderAll();
        showModal('血统融合进行中', '<div class="sam-shop-refreshing"><div class="sam-fusion-pulse">🧬</div><br>主神正在按法则融合血统数据…<br>你可以关闭窗口，结果会在返回后自动写入。<button type="button" class="sam-shop-stop-btn" data-sam-act="blood-fusion-stop">⏹ 停止融合(卡住时点此恢复)</button></div></div>');
        
        var content = ''
            + '属性系统 (底层定义):\n'
            + '  基础五维 (判定依据):\n'
            + '    力量: 近战/负重/破坏\n'
            + '    敏捷: 平衡/潜行/瞄准\n'
            + '    体质: 生命/耐性/恢复\n'
            + '    精神: 施法/察觉/意志\n'
            + '    魅力: 社交/欺骗/威吓\n'
            + '  资源属性:\n'
            + '    HP: 生命值，HP≤0即判定死亡\n'
            + '    HP_MAX: 生命值上限\n'
            + '    THP: 临时生命值/护盾，受到伤害时优先扣减，不叠加，脱战归零\n'
            + '    EP: 能量值，用于技能消耗\n'
            + '    EP_MAX: 能量值上限\n'
            + '  衍生属性:\n'
            + '    ATK: 物理攻击\n'
            + '    DEF: 物理防御\n'
            + '    MATK: 法术攻击\n'
            + '    MDEF: 法术防御\n'
            + '    AP: 法术强度乘区\n'
            + '  行动属性 (全局禁止添加):\n'
            + '    先攻DC: 行动顺序\n'
            + '    防御DC: 被命中难度\n';
        // 获取世界书内容的调用
        content += await getWorldBookContent('⚙️生命层级与社会生态'); 
        content += await getWorldBookContent('⚙️品质效果数值规则'); 
        content += await getWorldBookContent('⚙️实体生成规则'); 
        content += await getWorldBookContent('⚙️状态协议'); 
        content += await getWorldBookContent('⚙️行为判定[mvu_plot]'); 

        // 构造系统提示词: 融合渲染端定位 + 属性系统底层定义 + 世界书规则内容
        var sysPrompt = ''
            + '你是主神血统融合算法的渲染端。融合结果已由前端系统按权重 roll 出, 你【不得】自行选择结果、改写概率或拒绝执行。\n'
            + '只能按用户给出的已定结果与规则生成具体血统数据, 并返回规定 YAML。\n'
            + '【系统设定】\n'
            + content + '\n'
            + '【严格输出格式】\n'
            + '仅输出 YAML 文本, 不要解释、不要 markdown 代码围栏。\n'
            + '字段类型必须严格遵守:\n'
            + '  - 品质: 字符串, 仅可选 F / E / D / C / B / A / S / SS / SSS\n'
            + '  - 标签: 行内数组 [\'标签1\', \'标签2\'...]\n'
            + '  - 原始属性: 行内对象，定档遵循《品质效果数值规则》；血统必须完整包含五维（力量、敏捷、体质、精神、魅力），装备仅写有效非0项\n'
            + '  - 效果: 行内对象 {效果名: \'描述\'}, 键为字符串, 值为字符串描述\n'
            + '  - 价格: 数字(空间币)\n'
            + '  - 描述/消耗: 字符串\n'
            + '  - 类型:\n'
            + '      技能列表.类型 = 数字 0(主动) / 1(被动) / 2(特殊)\n'
            + '  - 替换目标: 字符串 (仅【形态列表】内必填，必须与玩家当前拥有的原物品名称一字不差！)\n'
            + '  - 道具列表.数量 = 数字(该商品可购入的库存份数, ≥1)\n'
            + '对象键禁止使用英文句点，口径类X.Ymm统一写作X·Y（例：5.56mm弹药→5·56弹药）;\n'

        // 构造融合渲染 prompt: 前端已用 bloodFusionRoll 按权重 roll 出【确定结果】,
        // AI 仅作为"渲染端"按结果对应的规则生成具体血统数据(名称/品质/属性/效果/描述),
        // 严禁自行选择结果或改写概率。result = {name, weight, list, cls}
        function bloodFusionBuildPrompt(a, b, mode, result) {
            var modeText = (mode === 'same') ? '同级融合' : '高低级融合';
            var rulesText = (result.list || []).map(function(s, idx){ return '  ' + (idx + 1) + '. ' + s; }).join('\n');
            return '血统融合渲染引擎。融合结果已由系统按权重 roll 出, 你【不得】自行选择结果或改写概率, 只能按给定结果渲染血统数据。\n'
                + 'A 为主血统, B 为副素材; 品质不同时以高品质为 A。\n'
                + '本次融合类型: ' + modeText + '\n'
                + '本次融合结果(系统已确定): ' + result.name + '\n'
                + '该结果对应的规则如下, 必须严格按此规则生成格式数据:\n' + rulesText + '\n\n'
                + '  - 【组件替换规则】:\n'
                + '     * 当融合结果产生新形态替换旧形态时，必须填写替换目标。\n'
                + '     * 替换目标必须从下方【已有形态】实际名单中逐字选取; 不得使用名单外、已删除或不存在的形态名。\n'
                + '     * 替换目标对应组件将在后台删除，不允许通过描述形式继续保留。\n'
                + '     * 若融合规则要求清空词条，则允许重新构筑，不继承旧词条。\n'
                + '     * 若融合规则要求强化继承，则必须完整迁移有效词条。\n'
                + '     * 若融合结果未产生形态能力，形态列表输出为空，不得强行创造变身体系, 替换目标填"无"。\n'
                + '     * 描述中禁止出现"已删除形态"、"删除 XX 形态"等任何对已不存在的形态的引用, 仅依据【已有形态】名单客观陈述。\n'
                + '  - 【形态生成规则】:\n'
                + '     * 形态属于独立战斗模式，不继承主血统的层级判定。\n'
                + '     * 形态层级独立于血统品质与角色当前生命层级，按形态自身战斗位格生成。\n'
                + '     * 形态原始属性按自身特征和战斗定位生成，不得复制、继承或微调主血统属性。\n'
                + '请仅输出 YAML 格式, 字段如下:\n'
                + '融合结果: ' + result.name + '\n'
                + '血统列表:\n'
                + '  - 名称: 最终血统名称\n'
                + '    品质: F\n'
                + '    标签: [标签]\n'
                + '    原始属性: {力量: C, 敏捷: E, 体质: D, 精神: F, 魅力: E}\n'
                + '    效果: {词条: 描述}\n'
                + '    描述: 结果说明\n\n'
                + '形态列表:\n'
                + '  - 名称: 形态名称\n'
                + '    替换目标: 原有形态确切名称 (例: 狼人形态)\n'
                + '    层级: {按形态自身战斗位格生成，Ⅰ－Ⅸ}\n'
                + '    消耗: HP/EP/特殊资源\n'
                + '    状态: 完好\n'
                + '    标签: ["主神空间", 依赖的道具/血统/来源等]\n'
                + '    原始属性: {基础属性/衍生属性: 品质}\n'
                + '    效果: { [词条]: 描述 }\n'
                + '    技能: {\n'
                + '     - 名称: 技能名\n'
                + '       品质: F\n'
                + '       类型: 0\n'
                + '       标签: ["主神空间", "被动"]\n'
                + '       效果: {射击校准: 射击检定+5}\n'
                + '       描述: 简短描述\n'
                + '       消耗: 无}\n'
                + '    描述: 简短描述\n'
                + '注意: "基因崩溃" 与 "崩坏消散" 不产生新血统, 但仍需返回 A 原血统作为结果(描述中说明 B 永久消耗)。\n\n'
                + 'A=' + JSON.stringify(a)
                + '\nB=' + JSON.stringify(b);
        }

        // —— 用户提示: 玩家上下文 + 需求 + 输出模板示例 ——
        var sd = getStatData();
        var _pctx = shopResolveCharacter(sd, bloodFusionActionActor);
        var p = _pctx.character || {};
        var parts = [];
        // ★ 核心辅助函数：提取物品的所有关键信息，拼接成紧凑的单行文本，既全面又省 Token
        function formatDict(dict) {
            var keys = Object.keys(dict || {});
            if (keys.length === 0) return '无';
            
            return keys.map(function(k) {
                var v = dict[k] || {};
                var info = [];

                if (v.品质) info.push(v.品质 + '级');
                if (v.数量 != null) info.push('数量:' + v.数量);
                if (v.消耗) info.push('消耗:' + v.消耗);
                if (Array.isArray(v.标签) && v.标签.length > 0) info.push('标签:' + v.标签.join('、'));
                // 属性和效果是对象，用 JSON.stringify 拍平显示
                if (v.原始属性 && Object.keys(v.原始属性).length > 0) info.push('属性:' + JSON.stringify(v.原始属性));
                if (v.效果 && Object.keys(v.效果).length > 0) info.push('效果:' + JSON.stringify(v.效果));
                if (v.技能) info.push('技能:' + JSON.stringify(v.技能));
                if (v.描述) info.push('描述:' + v.描述);
                
                // 输出格式例: "  - 御剑术 [F级 | 消耗:8MP | 效果:{"主动":"..."} | 描述:...]"
                return '  - ' + k + ' [' + info.join(' | ') + ']';
            }).join('\n');
        }
        // 已有形态名称(帮助AI避免重复+贴合构筑)
        var formData = p.形态库 || {};
        if (Object.keys(formData).length) parts.push('已有形态:\n' + formatDict(formData));
        
        var playerCtx = parts.join('\n');
        var userPrompt = '\n【当前玩家数据】\n' + (playerCtx || '(无)') + '\n';
        userPrompt += bloodFusionBuildPrompt(a, b, _mode0, bloodFusionResult);
        // console.log(sysPrompt, userPrompt);
        // 用 try/await 替代原 then/catch, 失败回滚空间币+商品库
        try {
            var out = await shopCallAI(sysPrompt, userPrompt);
            // 回合校验: 用户点"停止融合"或重发起一次新融合时 epoch 已变, 丢弃这次迟到结果
            if (myEpoch !== bloodFusionEpoch || !bloodFusionBusy) return;
            var parsed = shopParseMarketText(out), result = parsed.血统列表 && parsed.血统列表[0];
            if (!result || !result.名称) throw new Error('融合结果格式无效');
            var resultName = result.名称;
            // AI 可能返回 形态列表(融合出新形态), 同升级列表的 replace_target 处理方式:
            // 先删"替换目标"对应旧形态, 再写入新形态到 形态库
            var formList = Array.isArray(parsed.形态列表) ? parsed.形态列表 : [];
            // 归一化单条原始形态(对齐 32e 的 形态库 数据结构)
            // 归一化单条原始形态 → 形态库 数据结构
            // 注意: ZOD form_item 的 技能 是 z.record(z.string(), skill_item) 对象图(key=技能名, 技能值中文键 品质/类型/标签/效果/描述/消耗)
            //   form_item 顶层无 名称/替换目标(由 形态库 record 的 key 承担, 替换目标仅作删除逻辑用)
            //   故 normalizeForm 仅留 ZOD schema 中的顶层字段, 名称/替换目标 放 _name/_replace 由写入代码消费(ZOD strip)
            function normalizeForm(raw) {
                if (!raw || typeof raw !== 'object') return null;
                var name = shopPick(raw, 'name','名称');
                if (!name) return null;
                var rawSkills = shopPick(raw, '技能','skills') || {};
                var sArr;
                if (Array.isArray(rawSkills)) sArr = rawSkills;
                else if (rawSkills && typeof rawSkills === 'object') sArr = Object.keys(rawSkills).map(function(k) { var v = rawSkills[k]; if (v && typeof v === 'object' && !v.名称 && !v.name) v.名称 = k; return v; });
                else sArr = [];
                var skillsMap = {};
                sArr.forEach(function(s) {
                    if (!s || typeof s !== 'object') return;
                    var sn = shopPick(s, 'name','名称');
                    if (!sn) return;
                    var stn = shopPick(s, 'type','类型');
                    var stNum = (typeof stn === 'number') ? stn
                        : (typeof stn === 'string' && /^\d+$/.test(String(stn))) ? parseInt(String(stn), 10) : 0;
                    skillsMap[sn] = {
                        品质:  shopPick(s, 'rating','品质','品级','评级') || 'F',
                        类型:  stNum,
                        标签:  shopEnsureSourceTag(shopPick(s, 'tags','标签')),
                        效果:  shopPick(s, 'effects','效果') || {},
                        描述:  shopPick(s, 'description','描述','说明') || '',
                        消耗:  shopPick(s, '消费','消耗','cost') || '无'
                    };
                });
                var tagsVal = shopPick(raw, 'tags','标签');
                if (typeof tagsVal === 'string') tagsVal = [tagsVal];
                return {
                    _name:      name,                                                   // 写入 形态库 时的 key (ZOD strip, 不入库)
                    _replace:   shopPick(raw, 'replace_target','替换目标') || '',         // 写入前删除旧形态用 (ZOD strip, 不入库)
                    // 形态字段已由"品质"改为"层级"(生命层级 Ⅰ~Ⅸ); 优先取 层级/tier, 兼容 AI 仍输出 品质 字段
                    层级:       tierRomanOf(shopPick(raw, 'tier','层级','rating','品质','品级','评级') || 'Ⅰ'),
                    消耗:       shopPick(raw, 'cost','消耗') || '',
                    冷却:       shopPick(raw, 'cooldown','冷却') || '0回合',
                    状态:       shopPick(raw, 'status','状态') || '完好',
                    标签:       shopEnsureSourceTag(Array.isArray(tagsVal) ? tagsVal : []),
                    原始属性:   shopPick(raw, '原始属性','基础属性','属性') || {},
                    效果:       shopPick(raw, 'effects','效果','特效','特殊效果') || {},
                    技能:       skillsMap,
                    描述:       shopPick(raw, 'description','描述','说明') || ''
                };
            }
            var forms = [];
            for (var fi = 0; fi < formList.length; fi++) {
                var nf = normalizeForm(formList[fi]);
                if (nf) forms.push(nf);
            }
            // 被本次融合消耗的角色侧原血统名(命中即从升级列表清除其对应升级条目)
            var consumedNames = bloodFusionConsumedNames.slice();
            // 融合成功: 写回血统变更(删旧增新) + 清理升级列表里 replace_target 命中已删血统的升级服务
            //   + 写入新形态(删替换目标旧形态→写新形态, 同升级列表处理);
            //   空间币与血统商品库已在开始时处理, 不再重复扣币/删商品
            var _fActor = bloodFusionActionActor || SHOP_ACTOR_REINCARNATOR;
            var ok = writeBackMvu(function(statData) {
                var _fctx = shopResolveCharacter(statData, _fActor);
                var _fch = _fctx.character || {};
                _fch.血统 = _fch.血统 || {};
                delete _fch.血统[a.name];
                if (b.owned) delete _fch.血统[b.name];
                _fch.血统[resultName] = result;
                if (bloodFusionSnap && bloodFusionShopItem) {
                    shopAppendReceipt(statData, shopReceiptLine('血统融合', bloodFusionShopItem.name+' → '+resultName, bloodFusionSnap.price, statData.角色.空间币, (bloodFusionActionActor === SHOP_ACTOR_REINCARNATOR ? '角色' : bloodFusionActionActor)));
                }
                // 清理升级列表: "类型=血统 的升级条目" 且 replace_target 命中本次被消耗的原血统名 → 删除
                var _fulib = shopGetActorLibRaw(statData.商城, _fActor);
                if (_fulib && Array.isArray(_fulib.升级列表) && consumedNames.length) {
                    _fulib.升级列表 = _fulib.升级列表.filter(function(u) {
                        var upCat = String(shopPick(u, 'category','所属大类','类型','type') || '');
                        var tgt = String(shopPick(u, 'replace_target','替换目标') || '');
                        if (upCat === '血统' && tgt && consumedNames.indexOf(tgt) >= 0) return false;
                        return true;
                    });
                }
                // 写入新形态: 先删替换目标对应旧形态(若有), 再写新形态, 模型同 升级列表 replace_target
                //   normalizeForm 出的 spec 含 _name/_replace(被 ZOD form_item strip, 仅作定位用),
                //   故严格克隆仅保留 form_item schema 字段写入 形态库, 不携带 _name/_replace
                if (forms.length) {
                    _fch.形态库 = _fch.形态库 || {};
                    for (var fk = 0; fk < forms.length; fk++) {
                        var f = forms[fk];
                        // 防御: AI 填的"替换目标"若不在当前形态库(已删除/编造), 强制改成"无"避免对孤儿形态的引用溢出到结果文案
                        if (f._replace && f._replace !== '无' && !_fch.形态库[f._replace]) {
                            f._replace = '无';
                        }
                        if (f._replace && f._replace !== '无' && _fch.形态库[f._replace]) {
                            delete _fch.形态库[f._replace];
                        }
                        // 衍生项(ATK/DEF/MATK/MDEF/AP)值为0的剔除，不写入数据库
                        var _fDerived = ['ATK','DEF','MATK','MDEF','AP'];
                        var _fAttrs = (f.原始属性 && typeof f.原始属性 === 'object') ? Object.assign({}, f.原始属性) : {};
                        for (var _dk = 0; _dk < _fDerived.length; _dk++) {
                            if (String(_fAttrs[_fDerived[_dk]]).trim() === '0') delete _fAttrs[_fDerived[_dk]];
                        }
                        // 形态字段已由"品质"改为"层级"(生命层级 Ⅰ~Ⅸ); 兼容 AI 仍输出 品质 字段做兜底归正
                        var _fTier = f.层级 != null ? f.层级 : f.品质;
                        _fch.形态库[f._name] = {
                            层级:     tierRomanOf(_fTier || 'Ⅰ'),
                            消耗:     f.消耗,
                            冷却:     f.冷却,
                            状态:     f.状态,
                            标签:     f.标签,
                            原始属性: _fAttrs,
                            效果:     f.效果,
                            技能:     f.技能,
                            描述:     f.描述
                        };
                    }
                }
            });
            if (!ok) throw new Error('MVU 写回失败');
            // 升级区本地缓存同步: 立即从 shopMarketData.升级区 移除已被清理的升级条目
            try {
                var freshSd2 = getStatData();
                var freshLib2 = shopGetActorLibRaw(freshSd2 && freshSd2.商城, bloodFusionActionActor);
                if (freshLib2) {
                    shopMarketData = shopNormalizeMarketData(freshLib2);
                    if (!shopTabHasData(shopActiveTab)) shopActiveTab = shopPickFirstAvailableTab();
                }
            } catch(eFresh2) {}
            // 融合已成功写入, 回滚快照不再需要
            bloodFusionSnap = null;
            // 先取出前端 roll 出的结果(供结果弹窗显示), 再清理本轮状态
            var rollResult = bloodFusionResult;
            var rollName = rollResult ? rollResult.name : '结果已生成';
            var rollWeight = rollResult ? rollResult.weight : '';
            closeModal(); bloodFusionBusy = false; bloodFusionShopItem = null; bloodFusionResult = null; bloodFusionConsumedNames = [];
            renderAll();
            // 清理结果描述中可能残留的"已删除形态/删除 XX 形态"误导文案(AI 偶发对不存在形态的引用)
            var descRaw = String(result.描述 || '主神融合算法已完成本次血统重构。');
            var descClean = descRaw.replace(/已删除(的)?\s*[^，。、;；\n]*形态/g, '已重置形态槽').replace(/删除\s*[^，。、;；\n]*形态/g, '重置形态槽');
            showModal('融合结果 · '+rollName, '<div class="sam-shop-ok">融合完成：'+esc(rollName)+'</div><div class="sam-full-card">'+esc(descClean)+'</div>'
                + (forms.length ? '<div class="sam-shop-ok" style="margin-top:8px">本次融合获得新形态：'+forms.map(function(f){return esc(f._name);}).join('、')+'</div>' : ''));
        } catch(err) {
            bloodFusionResult = null;
            // 回合校验: 已被"停止融合"打断则不再处理失败回滚/弹提示
            if (myEpoch !== bloodFusionEpoch) return;
            // 融合失败: 回滚开始时已扣除的空间币与已删除的商品库
            if (bloodFusionSnap) {
                try {
                    writeBackMvu(function(statData) {
                        statData.角色 = statData.角色 || {};
                        statData.角色.空间币 = safeNum(statData.角色.空间币, 0) + bloodFusionSnap.price;
                        statData.角色.权限凭证 = statData.角色.权限凭证 || {};
                        shopCredentialRefund(statData.角色.权限凭证, bloodFusionSnap.credentialRequirements || {});
                        if (bloodFusionSnap.preBloodLib !== null && statData.商城) {
                            var _rlibF = shopGetActorLibRaw(statData.商城, bloodFusionSnap.preActor);
                            if (_rlibF) _rlibF.血统列表 = bloodFusionSnap.preBloodLib.slice();
                        }
                    });
                } catch(eRoll) { try { console.warn('[主神终端] 融合失败回滚异常:', eRoll.message); } catch(e2){} }
            }
            bloodFusionBusy = false; bloodFusionShopItem = null; bloodFusionResult = null; bloodFusionConsumedNames = []; bloodFusionSnap = null; closeModal();
            renderAll();
            samToast('error', '融合未完成：'+(err && err.message ? err.message : err));
        }
    }
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
    /* ★ 商城血统替换: 选择一条现有血统, 用商店购入的新血统直接顶替(不走融合算法, 无随机结果) */
    function openBloodReplaceModal() {
        var item = bloodFusionShopItem;
        if (!item) return;
        var sd = getStatData();
        var rctx = shopResolveCharacter(sd, bloodFusionActionActor || SHOP_ACTOR_REINCARNATOR);
        var rch = rctx.character || {};
        var rblood = rch.血统 || {};
        var rkeys = Object.keys(rblood);
        if (rkeys.length === 0) { samToast('warning', '当前没有可被替换的血统'); return; }
        // 候选按品质降序展示, 默认选中最后一项(通常为品质最低、最适合被替换的)
        var sorted = rkeys.slice().sort(function(p,q){ return bloodFusionRankOf({data:rblood[q]||{}}) - bloodFusionRankOf({data:rblood[p]||{}}); });
        var opts = '';
        for (var i = 0; i < sorted.length; i++) {
            opts += '<option value="'+esc(sorted[i])+'"'+(i === sorted.length-1 ? ' selected' : '')+'>'+esc(sorted[i])+' · '+esc((rblood[sorted[i]]||{}).品质 || 'F')+'</option>';
        }
        var html = '<div style="font-size:12px;color:var(--sam-sub);line-height:1.7;margin-bottom:10px">'
            + '购入 <b style="color:var(--sam-accent)">'+esc(item.name)+' · '+esc(item.rating || 'F')+'</b>(价格 '+safeNum(item.price,0)+' 空间币)后，选中的现有血统将被<b style="color:var(--sam-hp)">永久移除</b>，其关联的升级服务商品同步删除。该操作不可撤销。</div>'
            + '<div style="font-size:11px;color:var(--sam-sub);margin-bottom:4px">选择要被替换的现有血统：</div>'
            + '<select id="sam-replace-target" style="width:100%;padding:6px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:var(--sam-fg);font-size:12px">'+opts+'</select>'
            + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">'
            + '<button type="button" class="sam-confirm-btn cancel sam-fusion-replace-cancel">取消</button>'
            + '<button type="button" class="sam-confirm-btn ok sam-fusion-replace-confirm">确认替换</button>'
            + '</div>';
        showModal('替换血统 · '+item.name, html, true);
    }
    function bloodFusionReplacePurchase(targetName) {
        var item = bloodFusionShopItem, sd = getStatData();
        if (!item || !sd || !sd.角色 || !targetName) return;
        var rpActor = bloodFusionActionActor || SHOP_ACTOR_REINCARNATOR;
        var rpCtx = shopResolveCharacter(sd, rpActor);
        var rpCh = rpCtx.character;
        if (!rpCh) { samToast('error', '目标角色数据不存在, 无法购买'); return; }
        if (!(rpCh.血统 && rpCh.血统[targetName])) { samToast('error', '未找到待替换的血统'); return; }
        if (safeNum(sd.角色.空间币, 0) < safeNum(item.price, 0)) { samToast('warning', '空间币不足，无法购买'); return; }
        var rpCredentialRequirements = {};
        var rpCredentialRequirement = shopCredentialRequirement(rpCh, item);
        if (rpCredentialRequirement.required) rpCredentialRequirements[rpCredentialRequirement.grade] = 1;
        var rpCredentialShortages = shopCredentialShortages(sd.角色.权限凭证, rpCredentialRequirements);
        if (rpCredentialShortages.length) { samToast('warning', '权限凭证不足：'+shopCredentialShortageText(rpCredentialShortages)); return; }
        var blood = shopToBloodlineVar(item);
        var ok = writeBackMvu(function(statData) {
            var _rctx = shopResolveCharacter(statData, rpActor);
            var _rch = _rctx.character || {};
            _rch.血统 = _rch.血统 || {};
            statData.角色.权限凭证 = statData.角色.权限凭证 || {};
            if (!shopCredentialConsume(statData.角色.权限凭证, rpCredentialRequirements)) throw new Error('权限凭证扣除失败');
            delete _rch.血统[targetName];              // 移除被替换的旧血统
            _rch.血统[item.name] = blood;              // 写入商店购入的新血统
            statData.角色.空间币 = Math.max(0, safeNum(statData.角色.空间币, 0) - safeNum(item.price, 0));
            var _rlib = shopGetActorLibRaw(statData.商城, rpActor);
            if (_rlib && Array.isArray(_rlib.血统列表)) _rlib.血统列表 = _rlib.血统列表.filter(function(x){ return safeStr(x.名称) !== item.name; });
            // ★ 同步删除升级服务中针对被替换血统的商品(所属大类=血统 且 replace_target 指向该血统)
            if (_rlib && Array.isArray(_rlib.升级列表)) {
                _rlib.升级列表 = _rlib.升级列表.filter(function(u) {
                    var upCat = String(shopPick(u, 'category','所属大类','类型','type') || '');
                    var tgt = String(shopPick(u, 'replace_target','替换目标') || '');
                    if (upCat === '血统' && tgt && tgt === targetName) return false;
                    return true;
                });
            }
            shopAppendReceipt(statData, shopReceiptLine('替换血统', targetName+' → '+item.name, item.price, statData.角色.空间币, (rpActor === SHOP_ACTOR_REINCARNATOR ? '角色' : rpActor)));
        });
        if (ok) { closeModal(); bloodFusionShopItem = null; shopCart = []; renderAll(); samToast('success', '已替换血统：'+targetName+' → '+item.name); }
    }

    