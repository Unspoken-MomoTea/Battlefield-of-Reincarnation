    // ===== 装备/技能 tab =====
    function renderItemTabs() {
        $('item-tabs').innerHTML = DB.itemCategories.map(c => `
            <button class="tab-button ${c.key===activeItemTab?'active':''}" onclick="switchItemTab('${c.key}')">${c.label}</button>`).join('');
    }
    function switchItemTab(key) { activeItemTab=key; activeSubCategory=null; activeRarity='all'; renderItemTabs(); renderSubCategories(); renderRarityFilter(); renderItems(); }

    function currentSubTypes() {
        const { cat, list } = getCurrentSource();
        const types = [...cat.subTypes];
        if (list.some(item => item._sourceProjectId)) {
            types.push({ v:'__workshop__', label:'创意工坊' });
        }
        return types;
    }
    function renderSubCategories() {
        const types = currentSubTypes();
        if (!types.some(t => String(t.v) === String(activeSubCategory))) activeSubCategory = String(types[0] ? types[0].v : '');
        $('sub-category-list').innerHTML = types.map(t => `
            <button class="category-item ${String(t.v)===String(activeSubCategory)?'active':''}" onclick="switchSubCategory('${t.v}')">${t.label}</button>`).join('');
    }
    function switchSubCategory(v) {
        activeSubCategory=v;
        activeRarity='all';
        renderSubCategories();
        renderRarityFilter();
        renderItems();
    }

    function availableRarities() {
        const { list } = getCurrentSource();
        const present = new Set(list.filter(matchType).map(item => item.tier).filter(Boolean));
        return DB.rarityList.filter(r => present.has(r));
    }
    function renderRarityFilter() {
        const rarities = availableRarities();
        if (activeRarity !== 'all' && !rarities.includes(activeRarity)) activeRarity = 'all';
        if (rarities.length === 1) activeRarity = rarities[0];
        let html = '<span class="filter-label">层级：</span>';
        if (rarities.length > 1) {
            html += `<button class="filter-btn ${activeRarity==='all'?'active':''}" onclick="switchRarity('all')">全部</button>`;
        }
        html += rarities.map(r => `<button class="filter-btn ${activeRarity===r?'active':''}" onclick="switchRarity('${r}')">${r}</button>`).join('');
        $('rarity-filter').innerHTML = html;
    }
    function switchRarity(r) { activeRarity=r; renderRarityFilter(); renderItems(); }

    function matchType(item) {
        if (activeSubCategory === '__workshop__') return Boolean(item._sourceProjectId);
        return String(item.type) === String(activeSubCategory);
    }

    function renderItems() {
        const { list } = getCurrentSource();
        let filtered = list.filter(matchType);
        if (activeRarity !== 'all') filtered = filtered.filter(i => i.tier === activeRarity);
        if (filtered.length === 0) { $('item-grid').innerHTML = `<div class="empty-message">该分类下暂无物资</div>`; return; }
        $('item-grid').innerHTML = filtered.map(item => renderItemCard(item)).join('');
    }

    function renderItemCard(item) {
        const isSelected = selectedItems.has(item.id);
        const sel = isSelected ? 'is-selected' : '';
        const disabled = (!isSelected && currentCoins < item.cost) ? 'is-disabled' : '';
        const srcClass = item.source === '主神空间' ? 'source-main' : (item.source && item.source !== '手工造物' ? 'source-world' : '');
        const tagHtml = (item.tags||[]).map(t => `<span class="tag-text">${esc(t)}</span>`).join('');
        const srcTag = item.source ? `<span class="tag-text ${srcClass}">[${esc(item.source)}]</span>` : '';
        const attrsStr = item.attrs ? Object.entries(item.attrs).map(([k,v]) => `${k} ${v}${typeof v==='number'&&k==='AP'?'%':''}`).join(' · ') : '';
        const attrsHtml = attrsStr ? `<div class="attrs-box">${esc(attrsStr)}</div>` : '';
        const effectHtml = item.effects ? Object.entries(item.effects).map(([k,v]) => `<div class="item-info"><span class="info-label">${esc(k)}</span><span class="info-value">${esc(v)}</span></div>`).join('') : '';
        const typeLabel = item._cat ? item.type : (DB.itemCategories.find(c=>c.key===activeItemTab).subTypes.find(t=>String(t.v)===String(item.type))||{}).label || item.type;
        const consumeHtml = item.consume ? `<span class="cost-meta">消耗:${esc(item.consume)}</span>` : '';
        const cdHtml = (item.cd && item.cd !== '0/0' && item.cd !== '0') ? `<span class="cost-meta">CD:${esc(item.cd)}</span>` : '';
        return `
        <div class="item-card ${sel} ${disabled}" style="--rarity-color:${tierColor(item.tier)}" onclick="toggleSelect('${item.id}', ${item.cost}, event)">
            <div class="card-header">
                <span class="item-name">${esc(item.name)}</span>
                <span class="item-rarity tier-badge t-${item.tier}">${item.tier}</span>
            </div>
            <div class="card-body">
                ${srcTag||tagHtml ? `<div class="tag-list">${srcTag}${tagHtml}</div>` : ''}
                ${attrsHtml}
                <div class="item-info"><span class="info-label">分类</span><span class="info-value">${esc(typeLabel)}</span></div>
                ${effectHtml}
                <div class="item-info"><span class="info-label">描述</span><span class="info-value">${esc(item.desc)}</span></div>
            </div>
            <div class="cost-row">
                <span class="cost ${item.cost===0?'free':''}">${item.cost>0?'-'+item.cost+' 空间币':'免费接入'}</span>
                ${consumeHtml}${cdHtml}
            </div>
            <span class="selected-corner">✔ 已选择</span>
        </div>`;
    }

    function toggleSelect(id, cost, ev) {
        const card = ev.currentTarget;
        if (selectedItems.has(id)) { selectedItems.delete(id); currentCoins += cost; card.classList.remove('is-selected'); }
        else {
            if (currentCoins < cost) { return; } 
            selectedItems.add(id); currentCoins -= cost; card.classList.add('is-selected');
        }
        $('val-coins').innerText = currentCoins;
        renderSelectedPanel();
        renderItems(); 
        updateBgSummary();
    }

    function renderSelectedPanel() {
        const all = getAllItems();
        const chosen = all.filter(i => selectedItems.has(i.id));
        $('selected-count').innerText = chosen.length;
        const coinEl = $('selected-coins');
        coinEl.innerText = currentCoins;
        coinEl.classList.toggle('negative', currentCoins < 0);
        if (chosen.length === 0) { $('selected-body').innerHTML = `<span class="empty-message" style="display:block;text-align:center;padding:8px;color:var(--text-sub);font-style:italic;">尚未授权任何物资</span>`; return; }
        $('selected-body').innerHTML = chosen.map(i => `
            <span class="selected-chip"><span class="tier-badge t-${i.tier}">${i.tier}</span>${esc(i.name)}<span class="chip-remove" onclick="event.stopPropagation();removeSelected('${i.id}', ${i.cost})">✕</span></span>`).join('');
    }
    function removeSelected(id, cost) { selectedItems.delete(id); currentCoins += cost; $('val-coins').innerText = currentCoins; renderItems(); renderSelectedPanel(); updateBgSummary(); }

    function getAllItems() { return DB.equipments.concat(DB.items).concat(DB.skills).concat(customItems); }

    // ===== 自定义表单 =====
    function toggleCustomItem() { $('custom-item-form').classList.toggle('expanded'); }
    function renderCustomForms() {
        $('custom-item-body').innerHTML = `
            <div class="grid-2">
                <div class="form-group"><label>名称</label><input type="text" id="ci-name" class="form-control" placeholder="物资名称"></div>
                <div class="form-group"><label>品质层级</label><select id="ci-tier" class="form-control">${DB.rarityList.map(r=>`<option>${r}</option>`).join('')}</select></div>
                <div class="form-group"><label>子分类</label><select id="ci-type" class="form-control"></select></div>
                <div class="form-group"><label>来源标签</label><select id="ci-source" class="form-control"><option value="">无</option>${DB.sourceTags.map(s=>`<option>${s}</option>`).join('')}</select></div>
                <div class="form-group"><label>消耗空间币</label><input type="number" id="ci-cost" class="form-control" value="100" min="0"></div>
                <div class="form-group"><label>消耗 (EP/HP/特殊资源)</label><input type="text" id="ci-consume" class="form-control" placeholder="如：EP 15 / HP 30" ></div>
            </div>
            <div class="form-group"><label>标签 (逗号分隔)</label><input type="text" id="ci-tags" class="form-control" placeholder="如：武器,伤害,物理"></div>
            <div class="form-group"><label>属性数值 (键值对，如 ATK 28)</label><div class="kv-pairs" id="ci-attrs"></div><button class="add-kv-btn" onclick="addKV('ci-attrs','属性名','数值')">+ 添加属性</button></div>
            <div class="form-group"><label>效果 (键值对，如 破甲 / 眩晕)</label><div class="kv-pairs" id="ci-effects"></div><button class="add-kv-btn" onclick="addKV('ci-effects','效果名','效果描述')">+ 添加效果</button></div>
            <div class="form-group"><label>描述</label><textarea id="ci-desc" class="form-control" rows="2" placeholder="简短描述..."></textarea></div>
            <button class="btn primary" onclick="addCustomItem()">提交录入</button>
        `;
        $('custom-partner-body').innerHTML = `
            <div class="grid-2">
                <div class="form-group"><label>伙伴姓名</label><input type="text" id="cp-name" class="form-control" placeholder="伙伴名字"></div>
                <div class="form-group"><label>生命层级</label><select id="cp-tier" class="form-control" onchange="updatePartnerBuildBtnState()">${['Ⅰ','Ⅱ','Ⅲ'].map(r=>`<option>${r}</option>`).join('')}</select></div>
                <div class="form-group"><label>种族</label><input type="text" id="cp-race" class="form-control" placeholder="如：精灵"></div>
                <div class="form-group"><label>性别</label><select id="cp-gender" class="form-control"><option>男</option><option>女</option><option>扶她</option><option>男娘</option><option>药娘</option><option>太监</option><option>无性别</option></select></div>
            </div>
            <div class="form-group"><label>外貌特征</label><input type="text" id="cp-app" class="form-control" placeholder="简短描写外貌..."></div>
            <div class="form-group"><label>喜爱</label><input type="text" id="cp-like" class="form-control" placeholder="例如：喜欢与角色贴贴，喜欢甜食..."></div>
            <div class="form-group"><label>背景故事</label><textarea id="cp-bg" class="form-control" rows="3" placeholder="一段简短的背景来历..."></textarea></div>
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <button class="btn primary" id="cp-build-btn" onclick="useCustomPartner()">确认建档</button>
                <button class="btn danger" id="cp-clear-btn" onclick="clearCustomPartner()" style="display:none;">✕ 删除档案</button>
                <span id="cp-cost-tip" class="cp-cost-tip"></span>
            </div>
        `;
        $('single-world-body').innerHTML = `
            <div class="single-world-banner">
                <span class="sw-banner-icon">🎯</span>
                <span class="sw-banner-text"><strong>单一世界模式已启用</strong> —— 点击此选项卡即自动开启。系统将把你直接投放至下方指定的世界，跳过多元世界抽取。</span>
            </div>
            <div class="grid-2">
                <div class="form-group"><label>世界名称 (穿越作品名)</label><input type="text" id="sw-name" class="form-control" placeholder="如：斩赤瞳世界"></div>
                <div class="form-group"><label>时间锚点</label><input type="text" id="sw-time" class="form-control" placeholder="如：第四次圣杯战争中期"></div>
            </div>
            <div class="form-group"><label>切入身份</label><input type="text" id="sw-identity" class="form-control" placeholder="系统为你安排的合法切入身份"></div>
            <div class="form-group"><label>主线状态</label><textarea id="sw-mainstate" class="form-control" rows="3" placeholder="描述当前剧情时间锚点的主线状态，如：剧情正常推行，局部冲突爆发；中层/精英威胁大量登场"></textarea></div>
            <div class="form-group"><label>主神任务</label><textarea id="sw-goal" class="form-control" rows="3" placeholder="根据阵营与时间锚点生成 2-4 个平等层级关键任务"></textarea></div>
        `;
        refreshCustomTypeOptions();
    }
    function refreshCustomTypeOptions() {
        const cat = DB.itemCategories.find(c => c.key === activeItemTab);
        const sel = $('ci-type');
        if (sel) sel.innerHTML = cat.subTypes.map(t => `<option value="${t.v}">${t.label}</option>`).join('');
    }
    function addKV(containerId, ph1, ph2) {
        const c = $(containerId);
        const row = document.createElement('div');
        row.className = 'kv-row';
        row.innerHTML = `<input type="text" class="form-control kv-key" placeholder="${ph1}"><input type="text" class="form-control kv-val" placeholder="${ph2}"><button class="kv-del" onclick="this.parentElement.remove()">✕</button>`;
        c.appendChild(row);
    }
    function collectKV(containerId) {
        const obj = {};
        $(containerId).querySelectorAll('.kv-row').forEach(r => {
            const k = r.querySelector('.kv-key').value.trim();
            const v = r.querySelector('.kv-val').value.trim();
            if (k) obj[k] = v;
        });
        return obj;
    }
    function addCustomItem() {
        const name = $('ci-name').value.trim();
        if (!name) { alert('请填写物资名称'); return; }
        const cat = activeItemTab;
        const attrsRaw = collectKV('ci-attrs');
        const attrs = {};
        Object.entries(attrsRaw).forEach(([k,v]) => { const n = parseFloat(v); attrs[k] = isNaN(n) ? v : n; });
        const typeVal = cat === 'item' ? $('ci-type').value : parseInt($('ci-type').value);
        const item = {
            id: 'custom-' + Date.now(),
            name: '【自定】' + name,
            tier: $('ci-tier').value,
            cost: parseInt($('ci-cost').value || 0),
            type: typeVal,
            source: $('ci-source').value || '',
            tags: $('ci-tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),
            attrs: attrs,
            effects: collectKV('ci-effects'),
            desc: $('ci-desc').value.trim() || '自定义物资。',
            consume: $('ci-consume').value.trim(),
            _cat: cat
        };
        customItems.push(item);
        activeSubCategory = null; activeRarity = 'all'; 
        renderSubCategories(); renderRarityFilter(); renderItems();
        $('custom-item-form').classList.remove('expanded');
        ['ci-name','ci-tags','ci-desc','ci-consume','ci-cd'].forEach(id => $(id).value = '');
        $('ci-cost').value = '100';
        $('ci-attrs').innerHTML = ''; $('ci-effects').innerHTML = '';
        alert('已录入自定义物资：' + item.name);
    }

