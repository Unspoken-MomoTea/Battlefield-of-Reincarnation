    // ===== 步骤 =====
    async function ensureVariableApiModeBeforeStepChange(targetStep) {
        if (currentStep !== 1 || targetStep <= 1) return true;
        const result = await chooseVariableApiMode(getVariableApiMode(), { silent:true });
        if (result.ok) return true;
        showToast(result.error || '变量更新方式尚未成功应用，请检查酒馆助手与世界书配置。', 'error');
        return false;
    }
    async function jumpStep(n) {
        if (!(await ensureVariableApiModeBeforeStepChange(n))) return;
        currentStep = n;
        applyStepUI();
    }
    
    async function goStep(dir) {
        let targetStep = currentStep;
        if (dir === 1 && currentStep < 4) targetStep = currentStep + 1;
        else if (dir === -1 && currentStep > 1) targetStep = currentStep - 1;
        if (!(await ensureVariableApiModeBeforeStepChange(targetStep))) return;
        currentStep = targetStep;
        applyStepUI();
    }
    
    // 核心 UI 刷新函数 (统一接管所有按钮与面板)
    function applyStepUI() {
        for (let i = 1; i <= 4; i++) {
            const nav = $('nav-' + i);
            nav.classList.toggle('active', i === currentStep);
            nav.classList.toggle('pass', i < currentStep); // 走过的步骤变深色
            $('pane-' + i).classList.toggle('active', i === currentStep);
        }
        
        $('btn-prev').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
        
        const btnNext = $('btn-next');
        if (currentStep === 4) {
            btnNext.innerText = '确认链接';
            btnNext.onclick = showSaveConfirm; // 彻底统一为弹出询问框
            updateSummary(); // 渲染可视化面板
        } else {
            btnNext.innerText = '前往下一步';
            btnNext.onclick = () => goStep(1);
        }
        
        if (currentStep === 3) updateBgSummary();
    }

    function updateSummary() {
        // --- 1. 获取基础数据 ---
        const name = $('f-name').value.trim() || '';
        const identity = $('f-identity').value;
        const race = $('f-race').value.trim() || '人类';
        const gender = $('f-gender').value;
        const age = $('f-age').value;
        const openingSummaryBuild = characterMode === 'library' && selectedOpeningCharacter
            ? (selectedOpeningCharacter.build || selectedOpeningCharacter.character || {})
            : null;
        const openingBloodName = openingSummaryBuild ? (Object.keys(openingSummaryBuild.血统 || {})[0] || '') : '';
        const openingBlood = openingBloodName ? ((openingSummaryBuild.血统 && openingSummaryBuild.血统[openingBloodName]) || {}) : null;
        const tierKey = (openingSummaryBuild && openingSummaryBuild.层级) || 'Ⅰ';
        const tier = tierKey + ' 级';
        const bloodTierKey = (openingBlood && openingBlood.品质) || 'F';
        const bloodTier = bloodTierKey + ' 级';
        
        let attrHtml = '';
        if (openingBlood) {
            DB.attributes.forEach(attr => {
                const attrTier = (openingBlood.原始属性 && openingBlood.原始属性[attr]) || 'F';
                attrHtml += `<div class="cf-attr-box"><strong>${esc(attr)}:</strong> <span>${esc(attrTier)}级</span></div>`;
            });
        } else {
            document.querySelectorAll('.attr-input').forEach((input, idx) => {
                const attrTier = calcSingleTier(input.value);
                attrHtml += `<div class="cf-attr-box"><strong>${DB.attributes[idx]}:</strong> <span>${attrTier}级</span></div>`;
            });
        }
        const bloodName = openingBloodName || (race + '血统');
        const bloodDesc = (openingBlood && openingBlood.描述) || '最初的基础，却有无限可能';
        const bloodTags = ((openingBlood && openingBlood.标签) || ['初始血统', race]).join('、');
        const bloodEffects = Object.entries((openingBlood && openingBlood.效果) || {});
        const bloodEffectHtml = bloodEffects.length
            ? bloodEffects.map(([effectName,effectText]) => `<p style="color:var(--accent); margin-top:6px;"><strong>${esc(effectName)}：</strong>${esc(effectText)}</p>`).join('')
            : openingBlood
                ? `<p style="color:var(--text-sub); margin-top:6px;"><i class="fa-solid fa-lock"></i> 该角色档案未填写额外血统效果；开局不会自动生成或覆盖。</p>`
                : `<p style="color:var(--accent); margin-top:6px; font-weight:bold;"><i class="fa-solid fa-bolt"></i> 核心天赋效果暂缺，降临后将由主神 (AI) 根据种族特性当场演算并赋予。</p>`;

        const consumed = DB.initSpaceCoins - currentCoins;
        
        // --- 2. 获取分类物资 ---
        const chosen = getAllItems().filter(i => selectedItems.has(i.id));
        const equips = chosen.filter(i => i._cat==='equipment' || DB.equipments.some(e=>e.id===i.id));
        const items = chosen.filter(i => i._cat==='item' || DB.items.some(e=>e.id===i.id));
        const skills = chosen.filter(i => i._cat==='skill' || DB.skills.some(e=>e.id===i.id));

        const renderList = (title, icon, list) => {
            if(!list || list.length === 0) return `
                <div class="cf-section">
                    <h3 class="cf-title"><i class="${icon}"></i> ${title} (0)</h3>
                    <div class="cf-text" style="color:var(--text-sub); font-style:italic;">未选择${title}</div>
                </div>`;
            const html = list.map((item, idx) => {
                const attrs = item.attrs ? Object.entries(item.attrs).map(([k,v])=>`${k}:${v}`).join(' | ') : '';
                const effects = item.effects ? Object.entries(item.effects).map(([k,v])=>`<strong style="color:var(--accent)">${k}:</strong> ${v}`).join('<br>') : '';
                
                // 智能获取子类型标签
                let typeLabel = item.type;
                if(item._cat === 'equipment' || (!item._cat && DB.equipments.some(e=>e.id===item.id))) {
                    typeLabel = (DB.equipTypes.find(t=>String(t.v)===String(item.type)) || {}).label || item.type;
                }
                
                return `
                <div class="cf-item">
                    <div class="cf-item-head">
                        <span style="color:var(--text-sub)">${idx+1}.</span>
                        <span class="cf-item-name" style="color:${tierColor(item.tier)}">${item.name}</span>
                        <span class="tier-badge t-${item.tier}">${item.tier}</span>
                        <span class="cf-item-cost">[${item.cost} 币]</span>
                    </div>
                    <div class="cf-item-props">
                        <p><strong>类型:</strong> ${typeLabel} ${item.tags ? `| <strong>标签:</strong> ${item.tags.join('、')}` : ''} ${item.consume ? `| <strong>消耗:</strong> ${item.consume}` : ''}</p>
                        ${attrs ? `<p><strong>加成:</strong> ${attrs}</p>` : ''}
                        ${effects ? `<p>${effects}</p>` : ''}
                    </div>
                    <div class="cf-item-desc">${item.desc || ''}</div>
                </div>`;
            }).join('');
            return `<div class="cf-section"><h3 class="cf-title"><i class="${icon}"></i> ${title} (${list.length})</h3>${html}</div>`;
        };

        // --- 3. 获取伙伴与剧情 ---
        let partnerHtml = `<div class="cf-text" style="color:var(--text-sub); font-style:italic;">未选择协同实体</div>`;
        let partnerCount = 0;
        if (selectedPartner === 'custom' && useCustomPartnerFlag) {
            partnerCount = 1;
            partnerHtml = `
                <div class="cf-item">
                    <div class="cf-item-head"><span style="color:var(--text-sub)">1.</span><span class="cf-item-name" style="color:#fff">${$('cp-name').value.trim()||'自定义伙伴'}</span><span class="tier-badge t-${$('cp-tier').value}">${$('cp-tier').value}</span></div>
                    <div class="cf-text"><strong>种族:</strong> ${$('cp-race').value.trim()||'未知'} | <strong>性别:</strong> ${$('cp-gender').value}</div>
                    <div class="cf-text"><strong>外貌:</strong> ${$('cp-app').value.trim() || '无'}</div>
                    <div class="cf-text"><strong>喜爱:</strong> ${$('cp-like').value.trim() || '无'}</div>
                    <div class="cf-item-props"><p>${$('cp-bg').value.trim()||'暂无背景故事...'}</p></div>
                </div>`;
        } else if (selectedPartner === 'library' && selectedOpeningPartner) {
            partnerCount = 1;
            const pb = assetBuild(selectedOpeningPartner);
            const pp = selectedOpeningPartner.profile || {};
            const partnerBlood = assetBloodline(selectedOpeningPartner);
            const partnerAttrs = partnerBlood.data.原始属性 || {};
            const partnerAttrText = DB.attributes.map(attr => esc(attr) + ':' + esc(partnerAttrs[attr] || 'F')).join(' · ');
            partnerHtml = `
                <div class="cf-item">
                    <div class="cf-item-head"><span style="color:var(--text-sub)">1.</span><span class="cf-item-name" style="color:#fff">${esc(selectedOpeningPartner.name || '未命名伙伴')}</span><span class="tier-badge t-${esc(pb.层级 || 'Ⅰ')}">${esc(pb.层级 || 'Ⅰ')}</span></div>
                    <div class="cf-text"><strong>种族:</strong> ${esc(pb.种族 || '未知')} | <strong>身份:</strong> ${esc(Array.isArray(pb.身份) ? pb.身份.join(' / ') : (pb.身份 || '无'))}</div>
                    <div class="cf-text"><strong>血统:</strong> ${esc(partnerBlood.name || '无')} ${partnerBlood.name ? '(' + esc(partnerBlood.data.品质 || 'F') + ')' : ''}</div>
                    <div class="cf-text"><strong>原始属性:</strong> ${partnerAttrText}</div>
                    <div class="cf-text"><strong>外貌:</strong> ${esc(pp.外貌 || pb.外貌 || '无')}</div>
                    <div class="cf-text"><strong>喜爱:</strong> ${esc(pp.喜爱 || pb.喜爱 || '无')}</div>
                    <div class="cf-item-props"><p>${esc(pp.背景故事 || pb.背景故事 || '暂无背景故事')}</p></div>
                </div>`;
        } 

        let plotHtml = `<div class="cf-text" style="color:var(--text-sub); font-style:italic;">未选择初始开局剧情</div>`;
        if (singleWorldEnabled) {
            plotHtml = `
                <div class="cf-item">
                    <div class="cf-item-head"><span class="cf-item-name" style="color:#fff">【单一世界】${$('sw-name').value.trim()||'未命名'}</span></div>
                    <div class="cf-text"><strong>时间锚点:</strong> ${$('sw-time').value.trim() || '未填写'}</div>
                    <div class="cf-text"><strong>切入身份:</strong> ${$('sw-identity').value.trim() || '未填写'}</div>
                    <div class="cf-item-props"><p><strong>主线状态:</strong><br>${$('sw-mainstate').value.trim().replace(/\n/g, '<br>') || '未填写'}</p></div>
                    <div class="cf-item-props"><p><strong>主神任务:</strong><br>${$('sw-goal').value.trim().replace(/\n/g, '<br>') || '未填写'}</p></div>
                </div>`;
        } else if (selectedPlot) {
            const p = DB.plots.find(x => x.id === selectedPlot);
            if (p) {
                plotHtml = `
                <div class="cf-item">
                    <div class="cf-item-head"><span class="cf-item-name" style="color:${rankColor(p.rank||'Ⅰ')}">${p.name}</span></div>
                    <div class="cf-text"><strong>类型:</strong> ${p.type}</div>
                    <div class="cf-text"><strong>时间锚点:</strong> ${p.time}</div>
                    <div class="cf-text"><strong>切入身份:</strong> ${p.identity}</div>
                </div>`;
            }
        }

        // --- 4. 底部动态横幅 ---
        let bannerHtml = '';
        if (currentCoins < 0) {
            bannerHtml = `<div class="cf-banner warning"><i class="fa-solid fa-triangle-exclamation"></i> 警告：空间币已透支 ${Math.abs(currentCoins)} 点，无法完成建档，请返回调整！</div>`;
        } else if (currentCoins > 0) {
            bannerHtml = `<div class="cf-banner info"><i class="fa-solid fa-circle-info"></i> 提示：还有 ${currentCoins} 点空间币未使用。</div>`;
        } else {
            bannerHtml = `<div class="cf-banner success"><i class="fa-solid fa-check"></i> 完美：空间币已精准分配完毕。</div>`;
        }

        // --- 5. 渲染可视化面板 ---
        $('visual-summary').innerHTML = `
            <div class="confirm-wrapper">
                <div class="confirm-header">
                    <h2>档案确认</h2>
                    <p>预设参数将直接写入系统核心变量，精准重构底层逻辑</p>
                </div>
                
                <div class="points-grid">
                    <div class="point-box"><span class="p-label">初始空间币</span><span class="p-value gold">${DB.initSpaceCoins}</span></div>
                    <div class="point-box"><span class="p-label">已消耗</span><span class="p-value">${consumed}</span></div>
                    <div class="point-box"><span class="p-label">剩余</span><span class="p-value ${currentCoins<0?'red':'green'}">${currentCoins}</span></div>
                </div>

                <div class="cf-section">
                    <h3 class="cf-title"><i class="fa-solid fa-id-card"></i> 基本信息</h3>
                    <div class="grid-2">
                        <div class="cf-text"><strong>姓名:</strong> ${name}</div>
                        <div class="cf-text"><strong>性别:</strong> ${gender}</div>
                        <div class="cf-text"><strong>年龄:</strong> ${age} 岁</div>
                        <div class="cf-text"><strong>种族:</strong> ${race}</div>
                        <div class="cf-text" style="grid-column: 1 / -1;"><strong>身份:</strong> ${identity}</div>
                        <div class="cf-text" style="grid-column: 1 / -1;"><strong>综合层级:</strong> <span class="tier-badge t-${tierKey}">${tier}</span></div>
                    </div>
                </div>

                <div class="cf-section">
                    <h3 class="cf-title"><i class="fa-solid fa-dna"></i> 初始血统：${esc(bloodName)}</h3>
                    <div class="cf-item-props">
                        <p><strong>品质层级:</strong> <span class="tier-badge t-${bloodTierKey}">${bloodTier}</span> | <strong>体系标签:</strong> ${esc(bloodTags)}</p>
                        <p><strong>底层描述:</strong> ${esc(bloodDesc)}</p>
                        ${bloodEffectHtml}
                    </div>
                    <div class="cf-attr-grid">${attrHtml}</div>
                </div>

                ${renderList('装备', 'fa-solid fa-shield-halved', equips)}
                ${renderList('道具', 'fa-solid fa-box-open', items)}
                ${renderList('技能', 'fa-solid fa-wand-magic-sparkles', skills)}

                <div class="cf-section">
                    <h3 class="cf-title"><i class="fa-solid fa-user-group"></i> 协同实体 (${partnerCount})</h3>
                    ${partnerHtml}
                </div>

                <div class="cf-section">
                    <h3 class="cf-title"><i class="fa-solid fa-earth-asia"></i> 初始开局剧情</h3>
                    ${plotHtml}
                </div>

                ${bannerHtml}
            </div>
        `;
    }

    // ==========================================
    // 🚀 吐司提示条系统 (完美模拟酒馆外观)
    // ==========================================
    function showToast(msg, type='success') {
        // 优先尝试调用酒馆自带的 toastr
        try {
            if (window.parent && window.parent.toastr) {
                if(type === 'success') window.parent.toastr.success(msg);
                else if(type === 'warning') window.parent.toastr.warning(msg);
                else window.parent.toastr.error(msg);
                return;
            }
        } catch(e) {}
        
        // 自带回退吐司提示框
        let c = document.getElementById('sys-toast-container');
        if(!c) {
            c = document.createElement('div');
            c.id = 'sys-toast-container';
            c.style.cssText = 'position:fixed; top:30px; left:50%; z-index:99999; display:flex; flex-direction:column; gap:10px; pointer-events:none;';
            document.body.appendChild(c);
        }
        const t = document.createElement('div');
        const color = type==='success' ? '#51a351' : (type==='warning' ? '#f89406' : '#bd362f');
        const icon = type==='success' ? '✔' : '⚠';
        t.style.cssText = `background-color:${color}; color:#fff; padding:12px 24px; border-radius:4px; box-shadow:0 4px 15px rgba(0,0,0,0.5); font-size:0.95rem; font-weight:bold; letter-spacing:1px; animation:toastFadeIn 0.3s ease forwards; text-align:center;`;
        t.innerHTML = `<span>${icon}</span>&nbsp;&nbsp;${msg}`;
        c.appendChild(t);
        setTimeout(() => {
            t.style.animation = 'toastFadeOut 0.3s ease forwards';
            setTimeout(() => t.remove(), 300);
        }, 2500);
    }

    // ==========================================
    // 🚀 流程与预设联动
    // ==========================================
    let isJourneyContext = false; 
    
    function showSaveConfirm() { $('save-confirm-modal').style.display = 'flex'; }
    function hideSaveConfirm() { $('save-confirm-modal').style.display = 'none'; }
    
    function skipAndStart() { hideSaveConfirm(); executeJourney(); }
    function goToSavePreset() { hideSaveConfirm(); isJourneyContext = true; openPresetModal(); }

    const PRESET_KEY = 'lunhui_presets_v1';
    function getPresets() { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); } catch(e) { return {}; } }
    function setPresets(p) { localStorage.setItem(PRESET_KEY, JSON.stringify(p)); }

    function collectState() {
        const attrs = {}; document.querySelectorAll('.attr-input').forEach((input, idx) => { attrs[DB.attributes[idx]] = parseInt(input.value||0); });
        return { name:$('f-name').value, gender:$('f-gender').value, age:$('f-age').value, race:$('f-race').value, identity:$('f-identity').value, attrs:attrs, coins:currentCoins, selectedItems:[...selectedItems], selectedPlot, selectedPartner, useCustomPartnerFlag, selectedOpeningCharacterId:(selectedOpeningCharacter ? selectedOpeningCharacter.id : '')||'', selectedOpeningPartnerId:(selectedOpeningPartner ? selectedOpeningPartner.id : '')||'', characterMode, partnerMode, singleWorldEnabled, customItems, customPartner:{name:$('cp-name').value,tier:$('cp-tier').value,race:$('cp-race').value,gender:$('cp-gender').value,app:$('cp-app').value,like:$('cp-like').value,bg:$('cp-bg').value}, singleWorld:{name:$('sw-name').value,time:$('sw-time').value,identity:$('sw-identity').value,mainstate:$('sw-mainstate').value,goal:$('sw-goal').value}, stabilityLocked: $('ws-lock') ? $('ws-lock').checked : false, partnerCostPaid, activePlotCat, originalIdentity, singleWorldIdentityOverridden };
    }
    
    function applyState(st) {
        $('f-name').value = st.name||''; $('f-gender').value = st.gender||'男'; $('f-age').value = st.age||20; $('f-race').value = st.race||'人类'; $('f-identity').value = st.identity||'守护者'; currentCoins = (st.coins !== undefined && st.coins !== null ? st.coins : DB.initSpaceCoins); partnerCostPaid = st.partnerCostPaid || 0; $('val-coins').innerText = currentCoins; selectedItems = new Set(st.selectedItems||[]); selectedPlot = st.selectedPlot||null; selectedPartner = st.selectedPartner||null; useCustomPartnerFlag = !!st.useCustomPartnerFlag; characterMode=st.characterMode||'custom'; partnerMode=st.partnerMode||'library'; selectedOpeningCharacter=openingAssets.find(a=>a.id===st.selectedOpeningCharacterId)||null; selectedOpeningPartner=openingAssets.find(a=>a.id===st.selectedOpeningPartnerId)||null; singleWorldEnabled = !!st.singleWorldEnabled; customItems = st.customItems||[]; if (st.activePlotCat) activePlotCat = st.activePlotCat; else activePlotCat = 'multi'; originalIdentity = (st.originalIdentity !== undefined ? st.originalIdentity : null); singleWorldIdentityOverridden = !!st.singleWorldIdentityOverridden; document.querySelectorAll('.attr-input').forEach((input, idx) => { const savedAttr = st.attrs && st.attrs[DB.attributes[idx]]; input.value = (savedAttr !== undefined && savedAttr !== null) ? savedAttr : DB.attrMin; }); updateFactionDesc(); if (st.customPartner) { $('cp-name').value=st.customPartner.name||''; $('cp-tier').value=st.customPartner.tier||'F'; $('cp-race').value=st.customPartner.race||''; $('cp-gender').value=st.customPartner.gender||'男'; $('cp-app').value=st.customPartner.app||''; $('cp-like').value=st.customPartner.like||''; $('cp-bg').value=st.customPartner.bg||''; } if (st.singleWorld) { ['name','time','identity','mainstate','goal'].forEach(k => { const el=$('sw-'+k); if(el) el.value = st.singleWorld[k]||''; }); } const lockEl = $('ws-lock'); if (lockEl) lockEl.checked = !!st.stabilityLocked; const swForm = $('single-world-form'); if (swForm) { if (activePlotCat === 'single') { swForm.style.display=''; swForm.classList.add('expanded'); } else { swForm.classList.remove('expanded'); } } const idEl = $('f-identity'); if (idEl) { if (activePlotCat === 'single' || singleWorldIdentityOverridden) { if (!singleWorldIdentityOverridden) { originalIdentity = idEl.value; singleWorldIdentityOverridden = true; } idEl.value = IDENTITY_SINGLE_WORLD; idEl.disabled = true; singleWorldIdentityLocked = true; updateFactionDesc(); } else { idEl.disabled = false; singleWorldIdentityLocked = false; } } setCharacterMode(characterMode); setPartnerMode(partnerMode); renderOpeningCharacterLibrary(); renderOpeningPartnerLibrary(); calcTier(); renderItems(); renderSelectedPanel(); renderPlotTabs(); renderPlots(); renderPartners(); updateBgSummary(); const cpClearBtn = $('cp-clear-btn'); if (cpClearBtn) cpClearBtn.style.display = (useCustomPartnerFlag && selectedPartner === 'custom') ? '' : 'none';
    }
    
    function openPresetModal() { renderPresetList(); $('preset-modal').style.display = 'flex'; }
    function closePresetModal() { $('preset-modal').style.display = 'none'; isJourneyContext = false; }
    
    // 渲染无弹窗的高级列表UI
    let pendingDeletePreset = null; // 用于追踪当前正在确认删除的预设

    // 渲染极度还原的卡片列表
    function renderPresetList() {
        const p = getPresets(); 
        // 按时间倒序排列（最新的在最上面）
        const keys = Object.keys(p).sort((a, b) => (p[b].ts || 0) - (p[a].ts || 0)); 
        $('preset-count').innerText = keys.length;
        
        if (keys.length === 0) { 
            $('preset-list').innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub); border: 1px dashed var(--border); border-radius: 6px;">暂无保存的预设</div>`; 
            return; 
        }
        
        $('preset-list').innerHTML = keys.map(k => {
            const b64 = btoa(unescape(encodeURIComponent(k)));
            const pre = p[k].state;
            const isDel = pendingDeletePreset === k;
            const dateStr = new Date(p[k].ts||0).toLocaleString('zh-CN', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
            
            // 操作按钮状态判定
            let actionsHtml = '';
            if (isDel) {
                actionsHtml = `
                    <button class="btn-p confirm-del" onclick="confirmDeleteB64('${b64}')"><i class="fa-solid fa-check"></i> 确认删除</button>
                    <button class="btn-p cancel" onclick="cancelDelete()"><i class="fa-solid fa-xmark"></i> 取消</button>
                `;
            } else {
                actionsHtml = `
                    <button class="btn-p load" onclick="loadPresetB64('${b64}')"><i class="fa-solid fa-download"></i> 加载</button>
                    <button class="btn-p export" onclick="exportSingleB64('${b64}')"><i class="fa-solid fa-file-export"></i> 导出</button>
                    <button class="btn-p del" onclick="reqDeleteB64('${b64}')"><i class="fa-solid fa-trash-can"></i> 删除</button>
                `;
            }

            return `
            <div class="preset-item ${isDel ? 'del-pending' : ''}">
                <div class="p-item-header">
                    <span class="p-item-name">${esc(k)}</span>
                    <span class="p-item-time">${dateStr}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px;">
                    <div class="p-item-info">
                        <span><i class="fa-solid fa-user"></i> <span class="val">${esc(pre.name || '未命名')}</span></span>
                        <span><i class="fa-solid fa-layer-group"></i> <span class="val">${esc(pre.identity || '无')}</span></span>
                        <span><i class="fa-solid fa-coins"></i> <span class="val">${pre.coins || 0}</span></span>
                    </div>
                    <div class="p-item-actions">
                        ${actionsHtml}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function decodeB64(b64) { try { return decodeURIComponent(escape(atob(b64))); } catch(e) { return ''; } }

    function saveNewPreset() {
        const name = $('preset-name-input').value.trim();
        if (!name) { showToast('请输入配置名称', 'warning'); return; }
        const p = getPresets(); 
        
        // 覆盖判定：如果名字已存在，直接覆盖，无需再写覆盖按钮
        const isOverwrite = !!p[name];
        
        p[name] = { ts:Date.now(), state:collectState() }; 
        setPresets(p);
        $('preset-name-input').value = ''; 
        pendingDeletePreset = null;
        renderPresetList(); 
        
        showToast(isOverwrite ? `配置 [${name}] 已更新覆盖` : `保存配置 [${name}] 成功`);
        if(isJourneyContext) { setTimeout(() => { closePresetModal(); executeJourney(); }, 800); }
    }

    // ==== 内联删除流程 ====
    function reqDeleteB64(b64) {
        pendingDeletePreset = decodeB64(b64);
        renderPresetList();
    }
    function cancelDelete() {
        pendingDeletePreset = null;
        renderPresetList();
    }
    function confirmDeleteB64(b64) {
        const name = decodeB64(b64);
        const p = getPresets(); 
        delete p[name]; 
        setPresets(p);
        pendingDeletePreset = null;
        renderPresetList();
        showToast(`已删除配置 [${name}]`);
    }

    function loadPresetB64(b64) {
        const name = decodeB64(b64);
        const p = getPresets(); if (!p[name]) return;
        applyState(p[name].state || {});
        pendingDeletePreset = null;
        renderPresetList();
        showToast(`加载配置 [${name}] 成功`);
    }

    // 单个导出
    function exportSingleB64(b64) {
        const name = decodeB64(b64);
        const p = getPresets();
        if(!p[name]) return;
        const exportData = { [name]: p[name] };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'}); 
        const a = document.createElement('a'); 
        a.href = URL.createObjectURL(blob); 
        a.download = `建档预设_${name}.json`; 
        a.click(); 
        showToast(`导出 [${name}] 成功`);
    }

    // 全部导出
    function exportAllPresets() { 
        const p = getPresets(); 
        if(Object.keys(p).length === 0) { showToast('没有可导出的预设', 'warning'); return; }
        const blob = new Blob([JSON.stringify(p,null,2)], {type:'application/json'}); 
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); 
        a.download = '轮回建档_全部预设_'+Date.now()+'.json'; a.click(); 
        showToast('全部预设导出成功');
    }

    function importPreset(ev) { 
        const file = ev.target.files[0]; if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = e => { 
            try { 
                const obj = JSON.parse(e.target.result); 
                const cur = getPresets(); 
                Object.assign(cur, obj); 
                setPresets(cur); 
                pendingDeletePreset = null;
                renderPresetList(); 
                showToast('导入成功'); 
            } catch(err) { showToast('导入失败：文件格式错误', 'error'); } 
        }; 
        reader.readAsText(file); ev.target.value = ''; 
    }

