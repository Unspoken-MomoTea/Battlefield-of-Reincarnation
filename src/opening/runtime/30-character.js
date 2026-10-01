    // ===== 阵营身份说明 =====
    function updateFactionDesc() {
        const id = $('f-identity').value;
        const info = DB.factionInfo[id];
        const el = $('faction-desc');
        if (!info || !el) { if (el) el.innerHTML = ''; return; }
        const rowsHtml = info.rows.map(r => `<div class="fac-row"><span class="fac-label">${esc(r.label)}：</span>${esc(r.val)}</div>`).join('');
        el.innerHTML = `
            <div class="fac-title">◈ ${esc(info.title)}</div>
            ${rowsHtml}
            <div class="fac-ability">${esc(info.ability)}</div>`;
        renderPlots(); // 刷新背景页的任务分配
    }

    // ===== 重构的属性分配逻辑 ======
    function renderAttributes() {
        // 新机制：单维默认 F (0 点)，每 +1 升一级品质 (F→E→D→C→B→A→S→SS→SSS)
        // 组件结构：[−] [品质字母] [+] —— 不再显示数字点数，仅展示品质字母
        const html = DB.attributes.map((attr, idx) => `
            <div class="attribute-item">
                <span class="attr-label">${attr}</span>
                <div class="attr-controls">
                    <button class="attr-step btn-minus" type="button" onclick="stepAttr(${idx},-1)" id="btn-minus-${idx}">−</button>
                    <input type="hidden" value="${DB.attrMin}" class="attr-input" data-idx="${idx}" id="attr-input-${idx}">
                    <span class="tier-badge t-F attr-tier" id="attr-tier-${idx}" style="min-width:42px; padding:3px 12px; border-radius:var(--radius-sm); font-weight:700; font-size:0.92rem;">F</span>
                    <button class="attr-step btn-plus" type="button" onclick="stepAttr(${idx},1)" id="btn-plus-${idx}">+</button>
                </div>
            </div>`).join('');
        $('attr-grid').innerHTML = html;
        calcTier();
        syncOpeningAttributePanel();
    }
    
    function stepAttr(idx, dir) {
        if (openingAttributePanelLocked()) return;
        const input = document.querySelector(`.attr-input[data-idx="${idx}"]`);
        if (!input) return;
        let v = parseInt(input.value || 0);
        v += dir;
        input.value = v;
        calcTier();
    }

    // 新机制：单维点数 0..8 直接对应品质字母 F..SSS
    function calcSingleTier(v) {
        const idx = parseInt(v) || 0;
        if (idx < 0) return 'F';
        return DB.rarityList[idx] || 'SSS';
    }

    function calcTier() {
        let total = 0, maxV = 0;

        // 第一遍：约束单项极值并累计
        document.querySelectorAll('.attr-input').forEach((input) => {
            let v = parseInt(input.value || 0);
            if (isNaN(v)) v = 0;
            if (v < DB.attrMin) v = DB.attrMin;
            if (v > DB.attrSingleMax) v = DB.attrSingleMax;
            input.value = v;
            total += v;
            if (v > maxV) maxV = v;
        });

        // 剩余点数（仍由 panel-header 的剩余点数badge显示，用于约束加点上限）
        const remaining = DB.attrBasePoints - total;
        const remEl = $('attr-remaining');
        if (remEl) {
            remEl.innerText = remaining;
            remEl.classList.toggle('error', remaining < 0);
        }

        // 第二遍：按钮禁用 + 单维字母展示
        document.querySelectorAll('.attr-input').forEach((input, idx) => {
            const v = parseInt(input.value || 0);
            const btnMinus = $('btn-minus-' + idx);
            const btnPlus = $('btn-plus-' + idx);
            const locked = openingAttributePanelLocked();
            if (btnMinus) btnMinus.disabled = locked || (v <= DB.attrMin);
            if (btnPlus) btnPlus.disabled = locked || (v >= DB.attrSingleMax || remaining <= 0);

            const tier = calcSingleTier(v);
            const tierBadge = $('attr-tier-' + idx);
            if (tierBadge) {
                tierBadge.innerText = tier;
                tierBadge.className = 'tier-badge t-' + tier + ' attr-tier';
            }
        });

    }

    /** 综合层级 = 五维中最高单维品质（替代已删除的 attr-tier 元素） */
    function overallTier() {
        let maxV = 0;
        document.querySelectorAll('.attr-input').forEach((input) => {
            const v = parseInt(input.value || 0);
            if (v > maxV) maxV = v;
        });
        return calcSingleTier(maxV);
    }

