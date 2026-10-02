    /** * ==========================================
     * ⚙️ 核心引擎
     * ========================================== */
    let currentStep = 1;
    let currentCoins = DB.initSpaceCoins;
    let selectedItems = new Set();
    let selectedPlot = null;
    let selectedPartner = null;
    let selectedOpeningCharacter = null;
    let selectedOpeningPartner = null;
    let characterMode = 'custom';
    let customOpeningAttributePoints = null;
    let partnerMode = 'custom';
    let openingAssetDefaultsApplied = false;
    let openingAssets = [];
    let customItems = [];
    let activeItemTab = 'equipment';
    let activeSubCategory = null; 
    let activeRarity = 'all';
    let activePlotCat = 'multi';
    let expandedCards = new Set();
    let useCustomPartnerFlag = false;
    let partnerCostPaid = 0;        // 已为自定义伙伴建档扣除的空间币(改层级重算/删除退回)
    let singleWorldEnabled = false;
    // 单一世界身份覆盖：进入单一世界时强制身份为「穿越者」，离开则还原角色第一页原始选择
    let originalIdentity = null;                  // 角色在第一页手动选定的原始身份
    let singleWorldIdentityOverridden = false;    // 当前是否处于「单一世界身份覆盖」状态
    // 单一世界模式下 f-identity 下拉的禁用锁定标记
    let singleWorldIdentityLocked = false;

    const tierColor = t => getComputedStyle(document.documentElement).getPropertyValue('--t-' + t).trim() || '#66fcf1';
    const $ = id => document.getElementById(id);
    function esc(value) {
        const text = String(value == null ? '' : value);
        const amp = String.fromCharCode(38);
        return text.replace(/[&<>"']/g, function(char) {
            switch (char.charCodeAt(0)) {
                case 38: return amp + 'amp;';
                case 60: return amp + 'lt;';
                case 62: return amp + 'gt;';
                case 34: return amp + 'quot;';
                case 39: return amp + '#39;';
                default: return char;
            }
        });
    }

    const OPENING_DATA_REQUEST = 'reincarnation:opening-data-request';
    const OPENING_DATA_RESPONSE = 'reincarnation:opening-data-response';
    const OPENING_DATA_CHANGED = 'reincarnation:opening-data-changed';
    let openingHostDataCache = null;
    let openingHostDataPromise = null;

    function openingHostTargets() {
        const targets = [];
        for (const target of [
            (() => { try { return window.parent; } catch(e) { return null; } })(),
            (() => { try { return window.top; } catch(e) { return null; } })()
        ]) {
            if (!target || target === window || targets.includes(target) || typeof target.postMessage !== 'function') continue;
            targets.push(target);
        }
        return targets;
    }

    function normalizeOpeningHostData(data) {
        if (!data || typeof data !== 'object') return null;
        return {
            assets: Array.isArray(data.assets) ? structuredClone(data.assets) : [],
            storeCatalogs: Array.isArray(data.storeCatalogs) ? structuredClone(data.storeCatalogs) : []
        };
    }

    function loadHostOpeningData(force = false) {
        if (!force && openingHostDataCache) return Promise.resolve(openingHostDataCache);
        if (openingHostDataPromise) return openingHostDataPromise;
        const targets = openingHostTargets();
        if (!targets.length) return Promise.resolve(null);

        const requestId = 'opening-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        openingHostDataPromise = new Promise(resolve => {
            let settled = false;
            let timer = null;
            const finish = value => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                if (value) openingHostDataCache = value;
                resolve(value);
            };
            const onMessage = event => {
                if (!targets.includes(event.source)) return;
                const data = event.data || {};
                if (data.type !== OPENING_DATA_RESPONSE || data.requestId !== requestId) return;
                finish(normalizeOpeningHostData(data));
            };
            window.addEventListener('message', onMessage);
            timer = setTimeout(() => finish(null), 900);
            for (const target of targets) {
                try { target.postMessage({ type: OPENING_DATA_REQUEST, requestId }, '*'); } catch(e) {}
            }
        }).finally(() => { openingHostDataPromise = null; });
        return openingHostDataPromise;
    }

    function openingDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('reincarnation-workshop', 4);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth', { keyPath:'key' });
                if (!db.objectStoreNames.contains('installed_projects')) db.createObjectStore('installed_projects', { keyPath:'id' });
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath:'key' });
                if (!db.objectStoreNames.contains('opening_assets')) db.createObjectStore('opening_assets', { keyPath:'id' });
                if (!db.objectStoreNames.contains('opening_store_catalogs')) db.createObjectStore('opening_store_catalogs', { keyPath:'id' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async function loadOpeningStoreCatalogs(changedProjectId = '', hostData = undefined) {
        try {
            const bridged = hostData === undefined ? await loadHostOpeningData() : hostData;
            let rows;
            if (bridged) {
                rows = Array.isArray(bridged.storeCatalogs) ? structuredClone(bridged.storeCatalogs) : [];
            } else {
                const db = await openingDb();
                rows = await new Promise((resolve,reject) => {
                    const req = db.transaction('opening_store_catalogs','readonly').objectStore('opening_store_catalogs').getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
                db.close();
            }

            const groups = ['equipments','items','skills'];
            if (changedProjectId) {
                for (const group of groups) {
                    for (const item of DB[group]) {
                        if (item._sourceProjectId !== changedProjectId || !selectedItems.has(item.id)) continue;
                        selectedItems.delete(item.id);
                        currentCoins += Number(item.cost || 0);
                    }
                }
                if ($('val-coins')) $('val-coins').innerText = currentCoins;
            }

            for (const group of groups) {
                DB[group] = DB[group].filter(item => !item._sourceProjectId);
            }

            for (const row of rows) for (const group of groups) {
                const target = DB[group];
                const existing = new Set(target.map(item => item.id));
                for (const item of (row.catalog && row.catalog[group]) || []) {
                    const sourceId = String(item.id || '').trim();
                    if (!sourceId) continue;
                    const id = 'workshop:' + row.sourceProjectId + ':' + sourceId;
                    if (existing.has(id)) continue;
                    target.push({
                        ...structuredClone(item),
                        id,
                        source: item.source || row.sourceProjectName || '创意工坊',
                        _sourceProjectId:row.sourceProjectId,
                        _sourceProjectName:row.sourceProjectName || '创意工坊'
                    });
                    existing.add(id);
                }
            }
        } catch(error) {
            console.warn('[轮回战场开局] 读取工坊商店目录失败', error);
        }
    }
    async function loadOpeningAssets(hostData = undefined) {
        const selectedCharacterId = selectedOpeningCharacter && selectedOpeningCharacter.id;
        const selectedPartnerId = selectedOpeningPartner && selectedOpeningPartner.id;
        try {
            const bridged = hostData === undefined ? await loadHostOpeningData() : hostData;
            if (bridged) {
                openingAssets = Array.isArray(bridged.assets) ? structuredClone(bridged.assets) : [];
            } else {
                const db = await openingDb();
                openingAssets = await new Promise((resolve,reject) => {
                    const req = db.transaction('opening_assets','readonly').objectStore('opening_assets').getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
                db.close();
            }
        } catch(e) { openingAssets = []; }
        if (selectedCharacterId) {
            selectedOpeningCharacter = openingAssets.find(asset => asset.id === selectedCharacterId && asset.kind === 'opening_character') || null;
        }
        if (selectedPartnerId) {
            selectedOpeningPartner = openingAssets.find(asset => asset.id === selectedPartnerId && asset.kind === 'opening_partner') || null;
        }

        if (!openingAssetDefaultsApplied) {
            openingAssetDefaultsApplied = true;
            characterMode = openingAssets.some(asset => asset.kind === 'opening_character') ? 'library' : 'custom';
            partnerMode = openingAssets.some(asset => asset.kind === 'opening_partner') ? 'library' : 'custom';
        }

        if ($('character-mode-custom')) $('character-mode-custom').classList.toggle('active', characterMode === 'custom');
        if ($('character-mode-library')) $('character-mode-library').classList.toggle('active', characterMode === 'library');
        if ($('opening-character-library')) $('opening-character-library').style.display = characterMode === 'library' ? '' : 'none';
        if ($('partner-mode-custom')) $('partner-mode-custom').classList.toggle('active', partnerMode === 'custom');
        if ($('partner-mode-library')) $('partner-mode-library').classList.toggle('active', partnerMode === 'library');
        if ($('custom-partner-form')) $('custom-partner-form').style.display = partnerMode === 'custom' ? '' : 'none';
        if ($('opening-partner-library')) $('opening-partner-library').style.display = partnerMode === 'library' ? '' : 'none';

        renderOpeningCharacterLibrary();
        renderOpeningPartnerLibrary();
        syncOpeningAttributePanel();
        if (partnerMode === 'custom') updatePartnerBuildBtnState();
    }
    function assetBuild(asset) {
        return asset && (asset.build || asset.character) || {};
    }
    function assetSummary(asset) {
        const build = assetBuild(asset);
        return [build.种族, build.层级, ...(Array.isArray(build.身份)?build.身份.slice(0,2):[])].filter(Boolean);
    }
    function assetBloodline(asset) {
        const build = assetBuild(asset);
        const names = Object.keys(build.血统 || {});
        const name = names.length ? names[0] : '';
        return { name, data: name ? (build.血统[name] || {}) : {} };
    }
    function renderAssetCards(kind, selectedId, onClickName) {
        const list = openingAssets.filter(a => a.kind === kind);
        if (!list.length) return '<div class="asset-library-empty">◇ 暂无已安装档案<br><small>之后可从创意工坊安装到这里。</small></div>';
        return list.map(asset => {
            const avatar = String(asset.avatarUrl || '').trim();
            const avatarHtml = avatar
                ? `<img class="asset-library-avatar" src="${esc(avatar)}" alt="${esc(asset.name || '角色')}">`
                : '<span class="asset-library-avatar-placeholder">◇</span>';
            return `<div class="asset-library-card ${selectedId===asset.id?'selected':''}" onclick="${onClickName}('${esc(asset.id)}')">
                <div class="asset-library-card-main">
                    ${avatarHtml}
                    <div class="asset-library-copy">
                        <span class="asset-library-source">${esc(asset.sourceProjectName || '本地档案')}</span>
                        <strong>${esc(asset.name || '未命名角色')}</strong>
                        <div class="asset-library-tags">${assetSummary(asset).map(v=>`<span>${esc(v)}</span>`).join('')}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    function renderSelectedAssetPanel(asset, kind) {
        if (!asset) return '';
        const build = assetBuild(asset);
        const blood = assetBloodline(asset);
        const attrs = blood.data.原始属性 || {};
        const skills = Object.entries(build.技能 || {});
        const equipments = Object.entries(build.装备 || {});
        const profile = asset.profile || {};
        const identities = Array.isArray(build.身份) ? build.身份 : [];
        const attrHtml = DB.attributes.map(attr => `<div class="asset-selected-attr"><b>${esc(attr)}</b><span>${esc(attrs[attr] || 'F')}</span></div>`).join('');
        const skillHtml = skills.length
            ? skills.map(([name,value]) => `<span>${esc(name)} · ${esc((value && value.品质) || 'F')}</span>`).join('')
            : '<span>无技能</span>';
        const equipmentHtml = equipments.length
            ? equipments.map(([name,value]) => `<span>${esc(name)} · ${esc((value && value.品质) || 'F')}</span>`).join('')
            : '<span>无装备</span>';
        const bloodEffects = Object.entries(blood.data.效果 || {});
        const bloodlineHtml = blood.name
            ? `<div class="asset-selected-bloodline">
                <div class="asset-selected-bloodline-head"><b>${esc(blood.name)}</b><span>${esc(blood.data.品质 || 'F')}</span></div>
                ${blood.data.描述 ? `<div class="asset-selected-bloodline-desc">${esc(blood.data.描述)}</div>` : ''}
                <div class="asset-selected-effects">
                    ${bloodEffects.length
                      ? bloodEffects.map(([effectName,effectText]) => `<div class="asset-selected-effect"><b>${esc(effectName)}：</b>${esc(effectText)}</div>`).join('')
                      : '<div class="asset-selected-effect">无额外血统效果</div>'}
                </div>
              </div>`
            : '<div class="asset-selected-bloodline"><div class="asset-selected-effect">未配置血统</div></div>';
        const profileHtml = kind === 'partner'
            ? `<div class="asset-selected-section"><strong>人物资料</strong><div class="asset-selected-profile">
                ${profile.性格 ? `<div><b>性格：</b>${esc(profile.性格)}</div>` : ''}
                ${profile.喜爱 ? `<div><b>喜爱：</b>${esc(profile.喜爱)}</div>` : ''}
                ${profile.外貌 ? `<div><b>外貌：</b>${esc(profile.外貌)}</div>` : ''}
                ${profile.背景故事 ? `<div><b>背景：</b>${esc(profile.背景故事)}</div>` : ''}
              </div></div>`
            : '';
        const equipmentSection = kind === 'partner'
            ? `<div class="asset-selected-section"><strong>装备</strong><div class="asset-selected-list">${equipmentHtml}</div></div>`
            : '';
        return `<div class="asset-selected-panel">
            <div class="asset-selected-head">
                <small>当前选中 · ${esc(asset.sourceProjectName || '本地档案')}</small>
                <h4>${esc(asset.name || '未命名角色')}</h4>
                <div class="asset-selected-meta">
                    <span>种族 ${esc(build.种族 || '未知')}</span>
                    <span>层级 ${esc(build.层级 || 'Ⅰ')}</span>
                    ${identities.map(v=>`<span>${esc(v)}</span>`).join('')}
                </div>
            </div>
            <div class="asset-selected-section"><strong>血统</strong>${bloodlineHtml}</div>
            <div class="asset-selected-section"><strong>血统原始属性</strong><div class="asset-selected-attrs">${attrHtml}</div></div>
            <div class="asset-selected-section"><strong>技能</strong><div class="asset-selected-list">${skillHtml}</div></div>
            ${equipmentSection}
            ${profileHtml}
        </div>`;
    }
    function renderOpeningCharacterLibrary() {
        const el=$('opening-character-library'); if(!el)return;
        el.innerHTML='<div class="asset-library-head"><div><h3>开局角色档案</h3><small>选择后将直接采用其原始构筑，派生属性由当前版本重新计算。</small></div></div><div class="asset-library-grid">'+renderAssetCards('opening_character',(selectedOpeningCharacter ? selectedOpeningCharacter.id : ''),'selectOpeningCharacter')+'</div>'+renderSelectedAssetPanel(selectedOpeningCharacter,'character');
    }
    function renderOpeningPartnerLibrary() {
        const el=$('opening-partner-library'); if(!el)return;
        el.innerHTML='<div class="asset-library-head"><div><h3>开局伙伴档案</h3><small>完整伙伴无需 AI 再随机补全战术模块；按层级支付空间币（Ⅰ=70 / Ⅱ=350 / Ⅲ=1000）。</small></div></div><div class="asset-library-grid">'+renderAssetCards('opening_partner',(selectedOpeningPartner ? selectedOpeningPartner.id : ''),'selectOpeningPartner')+'</div>'+renderSelectedAssetPanel(selectedOpeningPartner,'partner');
    }
    function currentOpeningAttributePoints() {
        return DB.attributes.map((attr, idx) => {
            const input = document.querySelector('.attr-input[data-idx="' + idx + '"]');
            return input ? Math.max(0, Math.min(8, parseInt(input.value || 0) || 0)) : 0;
        });
    }
    function openingQualityPoint(value) {
        const index = DB.rarityList.indexOf(String(value || 'F').toUpperCase());
        return index < 0 ? 0 : index;
    }
    function selectedOpeningAttributePoints(asset) {
        const blood = assetBloodline(asset);
        const attrs = blood.data.原始属性 || {};
        return DB.attributes.map(attr => openingQualityPoint(attrs[attr] || 'F'));
    }
    function applyOpeningAttributePoints(points) {
        DB.attributes.forEach((attr, idx) => {
            const input = document.querySelector('.attr-input[data-idx="' + idx + '"]');
            if (input) input.value = String(Math.max(0, Math.min(8, Number(points && points[idx]) || 0)));
        });
        calcTier();
    }
    function openingAttributePanelLocked() {
        return characterMode==='library' && !!selectedOpeningCharacter;
    }
    function syncOpeningAttributePanel() {
        const panel=$('opening-attributes-panel');
        if (!panel) return;
        const locked=openingAttributePanelLocked();
        panel.classList.toggle('is-library-locked', locked);
        panel.setAttribute('aria-disabled', locked ? 'true' : 'false');
        if (locked) {
            applyOpeningAttributePoints(selectedOpeningAttributePoints(selectedOpeningCharacter));
        } else {
            calcTier();
        }
    }
    function setCharacterMode(mode) {
        const nextMode=mode==='library'?'library':'custom';
        if(nextMode==='library' && characterMode==='custom' && !customOpeningAttributePoints){
            customOpeningAttributePoints=currentOpeningAttributePoints();
        }
        characterMode=nextMode;
        if(characterMode==='custom'){
            selectedOpeningCharacter=null;
            if(customOpeningAttributePoints){
                const restore=customOpeningAttributePoints.slice();
                customOpeningAttributePoints=null;
                applyOpeningAttributePoints(restore);
            }
        }
        if ($('character-mode-custom')) $('character-mode-custom').classList.toggle('active',characterMode==='custom');
        if ($('character-mode-library')) $('character-mode-library').classList.toggle('active',characterMode==='library');
        if($('opening-character-library')) $('opening-character-library').style.display=characterMode==='library'?'':'none';
        renderOpeningCharacterLibrary();
        syncOpeningAttributePanel();
    }
    function setPartnerMode(mode) {
        const nextMode=mode==='custom'?'custom':'library';
        if(nextMode!==partnerMode && partnerCostPaid>0){
            currentCoins+=partnerCostPaid;
            partnerCostPaid=0;
            $('val-coins').innerText=currentCoins;
            renderSelectedPanel();
        }
        if(nextMode!==partnerMode){
            selectedPartner=null;
            selectedOpeningPartner=null;
            useCustomPartnerFlag=false;
        }
        partnerMode=nextMode;
        if ($('partner-mode-custom')) $('partner-mode-custom').classList.toggle('active',partnerMode==='custom');
        if ($('partner-mode-library')) $('partner-mode-library').classList.toggle('active',partnerMode==='library');
        if($('custom-partner-form')) $('custom-partner-form').style.display=partnerMode==='custom'?'':'none';
        if($('opening-partner-library')) $('opening-partner-library').style.display=partnerMode==='library'?'':'none';
        if(partnerMode==='custom') updatePartnerBuildBtnState();
        renderOpeningPartnerLibrary(); updateBgSummary();
    }
    function selectOpeningCharacter(id) {
        const asset=openingAssets.find(a=>a.id===id&&a.kind==='opening_character'); if(!asset)return;
        if(characterMode==='custom' && !customOpeningAttributePoints){
            customOpeningAttributePoints=currentOpeningAttributePoints();
        }
        selectedOpeningCharacter=asset; characterMode='library';
        const build=assetBuild(asset);
        if(asset.name) $('f-name').value=asset.name;
        if(build.种族) $('f-race').value=build.种族;
        applyOpeningAttributePoints(selectedOpeningAttributePoints(asset));
        renderOpeningCharacterLibrary(); syncOpeningAttributePanel(); showToast('已载入开局角色：'+(asset.name||'未命名'));
    }
    function selectOpeningPartner(id) {
        const asset=openingAssets.find(a=>a.id===id&&a.kind==='opening_partner'); if(!asset)return;
        const rank=(asset.build||asset.character||{}).层级||'Ⅰ';
        const cost=PARTNER_COST[rank]||0;
        const available=currentCoins+partnerCostPaid;
        if(available<cost){
            showToast('空间币不足，'+rank+'级开局伙伴需 '+cost+'（当前可用 '+available+'）','error');
            return;
        }
        currentCoins=available-cost;
        partnerCostPaid=cost;
        $('val-coins').innerText=currentCoins;
        selectedOpeningPartner=asset; selectedPartner='library'; useCustomPartnerFlag=false; partnerMode='library';
        renderSelectedPanel(); renderOpeningPartnerLibrary(); updateBgSummary();
        showToast('已选择开局伙伴：'+(asset.name||'未命名')+'（-'+cost+' 空间币）');
    }

    const openingDataReady = Promise.all([loadOpeningAssets(), loadOpeningStoreCatalogs()]).then(() => {
        renderSubCategories(); renderRarityFilter(); renderItems();
    });

    function bindOpeningLiveRefresh() {
        window.addEventListener('message', event => {
            if (!openingHostTargets().includes(event.source)) return;
            const data = event.data || {};
            if (data.type !== OPENING_DATA_CHANGED) return;
            const bridged = normalizeOpeningHostData(data);
            if (!bridged) return;
            openingHostDataCache = bridged;
            const projectId = String(data.detail && data.detail.projectId || '');
            void Promise.all([
                loadOpeningAssets(bridged),
                loadOpeningStoreCatalogs(projectId, bridged)
            ]).then(() => {
                renderSubCategories(); renderRarityFilter(); renderItems();
                renderSelectedPanel();
                updateBgSummary();
            }).catch(error => {
                console.warn('[轮回战场开局] 跨域刷新创意工坊开局资产失败', error);
            });
        });

        const roots = [];
        for (const root of [
            window,
            (() => { try { return window.parent; } catch(e) { return null; } })(),
            (() => { try { return window.top; } catch(e) { return null; } })()
        ]) {
            if (!root || roots.includes(root) || typeof root.addEventListener !== 'function') continue;
            roots.push(root);
            root.addEventListener('reincarnation:opening-assets-changed', () => {
                void loadOpeningAssets().then(() => {
                    renderSelectedPanel();
                    updateBgSummary();
                }).catch(error => {
                    console.warn('[轮回战场开局] 实时刷新创意工坊角色/伙伴失败', error);
                });
            });
            root.addEventListener('reincarnation:opening-store-changed', event => {
                const projectId = String(event && event.detail && event.detail.projectId || '');
                void loadOpeningStoreCatalogs(projectId).then(() => {
                    renderSubCategories();
                    renderRarityFilter();
                    renderItems();
                    renderSelectedPanel();
                    updateBgSummary();
                }).catch(error => {
                    console.warn('[轮回战场开局] 实时刷新创意工坊商店失败', error);
                });
            });
        }
    }
    bindOpeningLiveRefresh();

    function getCurrentSource() {
        const cat = DB.itemCategories.find(c => c.key === activeItemTab);
        return { cat, list: DB[cat.source].concat(customItems.filter(i => i._cat === activeItemTab)) };
    }

    // 位格→配色类 (Ⅰ~Ⅸ): 直接复用 .t-Ⅰ~.t-Ⅸ 已有 CSS 类, 与装备/技能层级徽章同源
    // badge 仅显示罗马数字, 通过 .t-* 背景色区分位格高低
    function rankCls(r) {
        return 't-' + (r || 'Ⅰ');
    }
    // 位格→hex色 (用于确认弹窗 inline style, 必须与 --t-Ⅰ~--t-Ⅸ CSS 变量保持一致)
    function rankColor(r) {
        return getComputedStyle(document.documentElement).getPropertyValue('--t-' + (r || 'Ⅰ')).trim() || '#66fcf1';
    }

