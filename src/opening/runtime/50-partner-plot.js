    // ===== 伙伴 =====
    function renderPartners() {
        // 旧版 grid-partner 已由“开局伙伴库 / 自定义伙伴”双模式替代。
        // 保留兼容入口给初始化与预设恢复流程调用，避免访问已经删除的 DOM。
        renderOpeningPartnerLibrary();
    }
    function selectPartner(id) {
        selectedPartner = (selectedPartner === id) ? null : id;
        if (selectedPartner) useCustomPartnerFlag = false;
        renderPartners(); updateBgSummary();
    }
    // 伙伴建档按钮状态: 按所选层级费用与可用余额(含已扣可退回)判定, 不足时灰度禁用
    //   ★ 下方常驻费用提示 #cp-cost-tip：充足时显示消耗与余额，不足时变红加⚠️并改按钮文案
    const PARTNER_COST = { Ⅰ: 70, Ⅱ: 350, Ⅲ: 1000 };
    // 伙伴建档表单字段锁：已建档后禁用全部录入项，仅「删除档案」可点；删除后恢复可编辑
    const PARTNER_FIELD_IDS = ['cp-name','cp-tier','cp-race','cp-gender','cp-app','cp-like','cp-bg'];
    function setPartnerFieldsLocked(locked) {
        PARTNER_FIELD_IDS.forEach(id => {
            const el = $(id);
            if (el) el.disabled = locked;
        });
    }
    function updatePartnerBuildBtnState() {
        const tierEl = $('cp-tier');
        if (!tierEl) return;
        const tier = tierEl.value;
        const cost = PARTNER_COST[tier] || 0;
        const available = currentCoins + partnerCostPaid;
        const btn = $('cp-build-btn');
        const tip = $('cp-cost-tip');
        const built = useCustomPartnerFlag && partnerCostPaid > 0; // 已建档：只留删除档案
        const insufficient = available < cost;
        if (btn) {
            // 已建档后隐藏确认建档按钮与费用提示
            btn.style.display = built ? 'none' : '';
            if (built) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.title = ''; }
            else {
                btn.disabled = insufficient;
                btn.style.opacity = insufficient ? '0.45' : '';
                btn.style.cursor = insufficient ? 'not-allowed' : '';
                btn.title = insufficient ? ('空间币不足，创建'+tier+'级伙伴需 '+cost+'（当前可用 '+available+'）') : '';
                btn.textContent = insufficient ? '空间币不足' : '确认建档';
            }
        }
        // 已建档锁定全部字段，未建档解锁（提前执行，避免下方 built 分支 return 跳过）
        setPartnerFieldsLocked(built);
        if (tip) {
            if (built) {
                // 已建档：改为只读锁定提示，不再显示费用
                tip.className = 'cp-cost-tip';
                tip.style.display = '';
                tip.textContent = '🔒 档案已锁定（层级/资料不可再改）。如需调整，先「✕ 删除档案」再重建。';
                return;
            }
            tip.style.display = '';
            if (insufficient) {
                tip.className = 'cp-cost-tip insufficient';
                tip.textContent = '⚠️ 需 ' + cost + '，仅剩 ' + available + '（空间币不足）';
            } else {
                tip.className = 'cp-cost-tip';
                tip.textContent = '消耗 -' + cost + '　余额 ' + available + '　（Ⅰ=70 / Ⅱ=350 / Ⅲ=1000）';
            }
        }
    }
    function useCustomPartner() {
        const name = $('cp-name').value.trim();
        if (!name) { showToast('请填写伙伴姓名', 'warning'); return; }
        const tier = $('cp-tier').value;
        const cost = PARTNER_COST[tier] || 0;
        // 先退回上次扣的, 再按新层级扣(支持改层级重新建档)
        const available = currentCoins + partnerCostPaid;
        if (available < cost) { showToast('空间币不足，创建'+tier+'级伙伴需 '+cost+'（当前可用 '+available+'）', 'error'); return; }
        currentCoins = available - cost;
        partnerCostPaid = cost;
        $('val-coins').innerText = currentCoins;
        renderSelectedPanel();
        useCustomPartnerFlag = true; selectedPartner = 'custom';
        renderPartners(); updateBgSummary();
        const clearBtn = $('cp-clear-btn');
        if (clearBtn) clearBtn.style.display = '';
        updatePartnerBuildBtnState();
    }
    function clearCustomPartner() {
        const refund = partnerCostPaid;
        if (refund > 0) {
            currentCoins += refund;
            partnerCostPaid = 0;
            $('val-coins').innerText = currentCoins;
            renderSelectedPanel();
        }
        useCustomPartnerFlag = false; selectedPartner = null;
        ['cp-name','cp-race','cp-app','cp-like','cp-bg'].forEach(id => { const el=$(id); if(el) el.value=''; });
        const tierEl = $('cp-tier'); if (tierEl) tierEl.selectedIndex = 0;
        const gEl = $('cp-gender'); if (gEl) gEl.selectedIndex = 0;
        const clearBtn = $('cp-clear-btn');
        if (clearBtn) clearBtn.style.display = 'none';
        renderPartners(); updateBgSummary();
        updatePartnerBuildBtnState();
    }

    // ===== 剧情 =====
    function renderPlotTabs() {
        $('plot-tabs').innerHTML = DB.plotCategories.map(c => `
            <button class="tab-button ${c.key===activePlotCat?'active':''}" onclick="switchPlotCat('${c.key}')">${c.label}</button>`).join('');
    }
    // 单一世界身份覆盖：进入单一世界把身份强切为「穿越者」并锁住下拉；离开则还原角色原始选择并解锁
    const IDENTITY_SINGLE_WORLD = '穿越者';
    function applySingleWorldIdentityOverride() {
        const idEl = $('f-identity');
        if (!idEl) return;
        // 记录原始身份（仅在尚未覆盖时记录，避免重复覆盖丢失原始值）
        if (!singleWorldIdentityOverridden) {
            originalIdentity = idEl.value;
        }
        idEl.value = IDENTITY_SINGLE_WORLD;
        idEl.disabled = true;
        singleWorldIdentityLocked = true;
        singleWorldIdentityOverridden = true;
        updateFactionDesc();
    }
    function restoreOriginalIdentity() {
        const idEl = $('f-identity');
        if (!idEl) return;
        idEl.disabled = false;
        singleWorldIdentityLocked = false;
        if (originalIdentity !== null) {
            idEl.value = originalIdentity;
        }
        singleWorldIdentityOverridden = false;
        updateFactionDesc();
    }
    function switchPlotCat(key) {
        activePlotCat = key;
        const swForm = $('single-world-form');
        if (key === 'single') {
            singleWorldEnabled = true;
            selectedPlot = null;
            if (swForm) { swForm.style.display = ''; swForm.classList.add('expanded'); }
            applySingleWorldIdentityOverride();
        } else {
            singleWorldEnabled = false;
            if (swForm) { swForm.classList.remove('expanded'); }
            restoreOriginalIdentity();
        }
        renderPlotTabs(); renderPlots(); updateBgSummary();
    }
    function renderPlots() {
        if (activePlotCat === 'single') {
            $('grid-plot').innerHTML = `<div class="empty-message" style="grid-column:1/-1;text-align:center;padding:32px 18px;">已切换至「单一世界」模式，请在下方「🌐 单一世界模式」表单中填写你想去的世界。提交后系统将跳过多元世界抽取并直接投放。</div>`;
            return;
        }
        let list = DB.plots.filter(p => p.cat === activePlotCat);
        if (list.length === 0) { $('grid-plot').innerHTML = `<div class="empty-message" style="grid-column:1/-1;">该分类下暂无世界</div>`; return; }
        
        // 生态着色: solo(无异端/青) death(死斗局/红) chaos(混沌局/紫)
        const ecoCls = e => e==='solo'?'wd-mode-solo':(e==='death'?'wd-mode-competitive':(e==='chaos'?'wd-mode-neutral':'wd-mode-solo'));
        
        $('grid-plot').innerHTML = list.map(p => {
            const sel = selectedPlot === p.id ? 'selected' : '';
            const exp = expandedCards.has('plot-'+p.id) ? 'expanded' : '';
            const cleanName = (p.name.match(/【(.*?)】/)||[])[1] || p.name;
            const rank = p.rank || 'Ⅰ';
            // 综合难度评级(字母范围如 F~E), 规范化为 F-E 用于 badge 配色与显示
            const tierRaw = (p.tier || 'F~E').replace(/\s+/g,'').replace('~','-');
            const tierHigh = tierRaw.split('-').pop().trim().toUpperCase();
            const aliens = (p.aliens!=null) ? p.aliens : 0;
            
            return `
            <div class="destined-one-card ${sel} ${exp}" onclick="selectPlot('${p.id}')">
                <div class="card-header">
                    <h3 class="item-name">【${esc(cleanName)}】</h3>
                    <div class="header-actions">
                        <span class="rating-badge ${rankCls(rank)}" title="世界位格">${esc(rank)}</span>
                        <span class="rating-badge rbadge-${tierHigh}" title="综合难度">${esc(tierRaw)}级</span>
                        <button class="expand-btn" onclick="event.stopPropagation();toggleCardExpand('plot-${p.id}')">${exp?'收起':'详情'}</button>
                    </div>
                </div>
                <span class="plot-type-tag">${esc(p.type)}</span>
                <div class="card-detail">
                    <div class="wd-row"><span class="wd-label">时间锚点</span><span class="wd-value">${esc(p.time)}</span></div>
                    <div class="wd-row"><span class="wd-label">干涉模式</span><span class="wd-value">${esc(p.ecology)} <span class="wd-part-dim ${ecoCls(p.eco)}">(预计异端: ${aliens}人)</span></span></div>
                    <div class="wd-row"><span class="wd-label">主线状态</span><span class="wd-value">${esc(p.deviation)}</span></div>
                    <div class="wd-row"><span class="wd-label">世界法则</span><span class="wd-value">${esc(p.law)}<span class="wd-part-dim"> ${esc(p.risk)}</span></span></div>
                    <div class="wd-row"><span class="wd-label">切入身份</span><span class="wd-value">${esc(p.identity)}</span></div>
                </div>
            </div>`;
        }).join('');
    }
    function selectPlot(id) {
        selectedPlot = (selectedPlot === id) ? null : id;
        if (selectedPlot) singleWorldEnabled = false;
        renderPlots(); updateBgSummary();
    }
    function toggleSingleWorld() { $('single-world-form').classList.toggle('expanded'); }
    function toggleCardExpand(key) { if (expandedCards.has(key)) expandedCards.delete(key); else expandedCards.add(key); if (key.startsWith('plot')) renderPlots(); else renderPartners(); }

    // ===== 背景预览 =====
    function updateBgSummary() {
        const coinEl = $('bg-coins');
        coinEl.innerText = currentCoins;
        coinEl.classList.toggle('negative', currentCoins < 0);
        let partnerText = '未选定';
        if (selectedPartner === 'custom' && useCustomPartnerFlag) {
            const n = $('cp-name').value.trim() || '自定义伙伴';
            partnerText = `${n} (${$('cp-tier').value}级 / ${$('cp-gender').value})`;
        }
        let plotText = '未选定';
        if (singleWorldEnabled) {
            plotText = '单一世界模式：' + ($('sw-name').value.trim() || '未填写');
        } else if (selectedPlot) {
            const p = DB.plots.find(x => x.id === selectedPlot);
            if (p) plotText = p.name;
        }
        const chosen = getAllItems().filter(i => selectedItems.has(i.id));
        const eq = chosen.filter(i => i._cat==='equipment' || DB.equipments.some(e=>e.id===i.id)).length;
        const it = chosen.filter(i => i._cat==='item' || DB.items.some(e=>e.id===i.id)).length;
        const sk = chosen.filter(i => i._cat==='skill' || DB.skills.some(e=>e.id===i.id)).length;
        $('bg-summary').innerHTML = `
            <div class="row"><span class="row-label">协同实体：</span><span>${esc(partnerText)}</span></div>
            <div class="row"><span class="row-label">初始剧情：</span><span>${esc(plotText)}</span></div>
            <div class="row"><span class="row-label">物资结算：</span><span>装备 ${eq}件 / 道具 ${it}件 / 技能 ${sk}个</span></div>`;
        // ★ 余额变化(增删物品/选退/删档等)同步刷新伙伴建档费用提示与按钮状态
        updatePartnerBuildBtnState();
    }

