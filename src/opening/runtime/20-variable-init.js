    // ===== 变量更新方式（额外API / 随主AI） =====
    const VARIABLE_API_MODE_KEY = 'samsara_variable_api_mode';
    const VARIABLE_API_WORLD_BOOK_RULES = {
        'output_format (随AI输出开，主API)': { '随主API': true, '额外API': false },
        '[mvu_update]output_format (使用额外模型更新变量开)': { '随主API': false, '额外API': true }
    };

    function normalizeVariableApiMode(mode) {
        return mode === '随主API' ? '随主API' : '额外API';
    }
    function variableApiStorage() {
        const roots = [window, (() => { try { return window.parent; } catch(e) { return null; } })(), (() => { try { return window.top; } catch(e) { return null; } })()];
        for (const root of roots) {
  try { if (root && root.localStorage) return root.localStorage; } catch(e) {}
        }
        return null;
    }
    function getVariableApiMode() {
        try {
  const storage = variableApiStorage();
  return normalizeVariableApiMode(storage ? storage.getItem(VARIABLE_API_MODE_KEY) : '额外API');
        } catch(e) { return '额外API'; }
    }
    function saveVariableApiMode(mode) {
        try {
  const storage = variableApiStorage();
  if (storage) storage.setItem(VARIABLE_API_MODE_KEY, normalizeVariableApiMode(mode));
        } catch(e) {}
    }
    function resolveVariableApiHostFunction(name) {
        const roots = [window, (() => { try { return window.parent; } catch(e) { return null; } })(), (() => { try { return window.top; } catch(e) { return null; } })()];
        for (const root of roots) {
  try {
      if (root && typeof root[name] === 'function') return root[name].bind(root);
      if (root && root.TavernHelper && typeof root.TavernHelper[name] === 'function') return root.TavernHelper[name].bind(root.TavernHelper);
  } catch(e) {}
        }
        return null;
    }
    function normalizeVariableApiEntryName(name) {
        return String(name || '').trim().replace(/\.(txt|ya?ml)$/i, '');
    }
    function variableApiRuleForEntry(name) {
        return VARIABLE_API_WORLD_BOOK_RULES[normalizeVariableApiEntryName(name)] || null;
    }
    function normalizeVariableApiWorldbookEntries(wb) {
        if (Array.isArray(wb)) return wb;
        if (wb && Array.isArray(wb.entries)) return wb.entries;
        return [];
    }
    function variableApiPresetDesired(name, mode) {
        const text = String(name || '');
        if (text.indexOf('变量额外API') >= 0) return mode === '额外API';
        if (text.indexOf('变量主API') >= 0) return mode === '随主API';
        return null;
    }
    async function applyVariableApiMode(mode) {
        mode = normalizeVariableApiMode(mode);
        const getNames = resolveVariableApiHostFunction('getCharWorldbookNames');
        const getWorldbookFn = resolveVariableApiHostFunction('getWorldbook');
        const updateWorldbookFn = resolveVariableApiHostFunction('updateWorldbookWith');
        if (!getNames || !getWorldbookFn || !updateWorldbookFn) {
  return { ok:false, error:'未检测到世界书切换接口，请确认酒馆助手脚本已启用。' };
        }

        let namesInfo;
        try { namesInfo = await Promise.resolve(getNames('current')); }
        catch(e) { return { ok:false, error:'读取当前角色世界书失败：' + (e && e.message ? e.message : e) }; }
        namesInfo = namesInfo || {};
        const worldbookNames = [];
        [namesInfo.primary].concat(Array.isArray(namesInfo.additional) ? namesInfo.additional : []).forEach(name => {
  if (name && worldbookNames.indexOf(name) < 0) worldbookNames.push(name);
        });
        if (!worldbookNames.length) return { ok:false, error:'当前角色没有可切换的世界书。' };

        let worldbookMatched = 0, worldbookChanged = 0, presetMatched = 0, presetChanged = 0;
        try {
  for (const wbName of worldbookNames) {
      let wb;
      try { wb = await Promise.resolve(getWorldbookFn(wbName)); } catch(e) { continue; }
      const entries = normalizeVariableApiWorldbookEntries(wb);
      let localMatched = 0, localChanged = 0;
      entries.forEach(entry => {
          const rule = entry && variableApiRuleForEntry(entry.name);
          if (!rule) return;
          localMatched++;
          if (entry.enabled !== rule[mode]) localChanged++;
      });
      if (!localMatched) continue;
      worldbookMatched += localMatched;
      if (localChanged) {
          await Promise.resolve(updateWorldbookFn(wbName, function(nextWb) {
              normalizeVariableApiWorldbookEntries(nextWb).forEach(entry => {
                  const rule = entry && variableApiRuleForEntry(entry.name);
                  if (rule) entry.enabled = rule[mode];
              });
              return nextWb;
          }));
          worldbookChanged += localChanged;
      }
  }

  const getPresetFn = resolveVariableApiHostFunction('getPreset');
  const updatePresetFn = resolveVariableApiHostFunction('updatePresetWith');
  if (getPresetFn && updatePresetFn) {
      let preset = null;
      try { preset = await Promise.resolve(getPresetFn('in_use')); } catch(e) {}
      const prompts = preset && Array.isArray(preset.prompts) ? preset.prompts : [];
      prompts.forEach(prompt => {
          const desired = variableApiPresetDesired(prompt && (prompt.name || prompt.id), mode);
          if (desired === null) return;
          presetMatched++;
          if (prompt.enabled !== desired) presetChanged++;
      });
      if (presetChanged) {
          await Promise.resolve(updatePresetFn('in_use', function(nextPreset) {
              const list = nextPreset && Array.isArray(nextPreset.prompts) ? nextPreset.prompts : [];
              list.forEach(prompt => {
                  const desired = variableApiPresetDesired(prompt && (prompt.name || prompt.id), mode);
                  if (desired !== null) prompt.enabled = desired;
              });
              return nextPreset;
          }));
      }
  }
        } catch(e) {
  return { ok:false, error:'切换变量更新方式失败：' + (e && e.message ? e.message : e), worldbookMatched, worldbookChanged, presetMatched, presetChanged };
        }

        if (!worldbookMatched) {
  return { ok:false, error:'未在当前角色世界书中找到变量更新模式条目，请检查条目名称。', worldbookMatched, worldbookChanged, presetMatched, presetChanged };
        }
        saveVariableApiMode(mode);
        return { ok:true, mode, worldbookMatched, worldbookChanged, presetMatched, presetChanged };
    }
    function renderVariableApiMode(message, state) {
        const mode = getVariableApiMode();
        document.querySelectorAll('[data-variable-api-mode]').forEach(card => {
  card.classList.toggle('active', card.getAttribute('data-variable-api-mode') === mode);
        });
        const el = $('variable-api-mode-status');
        if (!el) return;
        el.className = 'variable-api-mode-status' + (state ? ' ' + state : '');
        el.textContent = message || (mode === '额外API'
  ? '当前：额外API输出。正文与变量更新分轮执行。'
  : '当前：随主AI输出。正文模型同轮输出变量更新。');
    }
    async function chooseVariableApiMode(mode, options) {
        mode = normalizeVariableApiMode(mode);
        const buttons = Array.from(document.querySelectorAll('[data-variable-api-mode]'));
        buttons.forEach(btn => btn.disabled = true);
        renderVariableApiMode('正在切换世界书与预设条目…', '');
        const result = await applyVariableApiMode(mode);
        buttons.forEach(btn => btn.disabled = false);
        if (result.ok) {
  renderVariableApiMode('已切换为' + (mode === '额外API' ? '额外API输出' : '随主AI输出') + ' · 世界书变更 ' + result.worldbookChanged + ' 项 · 预设变更 ' + result.presetChanged + ' 项', 'ok');
  if (!(options && options.silent)) showToast('变量更新方式已切换');
        } else {
  renderVariableApiMode(result.error || '切换失败', 'err');
  if (!(options && options.silent)) showToast(result.error || '变量更新方式切换失败', 'error');
        }
        return result;
    }

    // ===== 初始化 =====
    function init() {
        $('val-coins').innerText = currentCoins;
        $('attr-total-base').innerText = DB.attrBasePoints;
        renderAttributes();
        updateFactionDesc();
        renderItemTabs();
        renderSubCategories();
        renderRarityFilter();
        renderItems();
        renderSelectedPanel();
        renderPlotTabs();
        renderPlots();
        renderPartners();
        renderCustomForms();
        updateBgSummary();
        renderVariableApiMode();

        // 🌟 新增：页面加载完毕后，检测并弹出预设引导框
        openWelcomeLoadModal();
    }

    // ==========================================
    // 🚀 开局引导加载预设弹窗逻辑
    // ==========================================
    let welcomeSelectedPreset = null;

    function openWelcomeLoadModal() {
        const p = getPresets();
        const keys = Object.keys(p).sort((a, b) => (p[b].ts || 0) - (p[a].ts || 0));
        
        // 如果没有预设，直接不弹窗
        if (keys.length === 0) return;

        // 默认选中最新保存的那一个
        welcomeSelectedPreset = keys[0];

        // 渲染单选列表
        $('welcome-preset-list').innerHTML = keys.map(k => {
            const pre = p[k].state;
            const dateStr = new Date(p[k].ts||0).toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
            const isSelected = welcomeSelectedPreset === k;
            
            return `
            <div class="preset-item" style="padding: 10px 15px; display: flex; align-items: center; gap: 15px; cursor: pointer; border-color: ${isSelected ? 'var(--accent)' : 'var(--border)'}; background: ${isSelected ? 'rgba(102,252,241,0.05)' : 'rgba(0,0,0,0.3)'}; margin-bottom: 8px;" onclick="selectWelcomePreset('${escape(k)}')">
                <input type="radio" name="welcome-preset-radio" style="accent-color: var(--accent); transform: scale(1.2);" ${isSelected ? 'checked' : ''}>
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #fff; font-size: 1rem; margin-bottom: 4px;">${esc(k)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-sub); display: flex; gap: 10px;">
                        <span><i class="fa-solid fa-user"></i> ${esc(pre.name || '未命名')}</span>
                        <span><i class="fa-solid fa-clock"></i> ${dateStr}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        $('welcome-load-modal').style.display = 'flex';
    }

    function selectWelcomePreset(escapedKey) {
        welcomeSelectedPreset = unescape(escapedKey);
        // 重新渲染列表以更新选中状态
        openWelcomeLoadModal(); 
    }

    function closeWelcomeLoadModal() {
        $('welcome-load-modal').style.display = 'none';
        welcomeSelectedPreset = null;
    }

    function confirmWelcomeLoad() {
        if (!welcomeSelectedPreset) {
            showToast('请先选择一个预设', 'warning');
            return;
        }
        const p = getPresets();
        if (p[welcomeSelectedPreset]) {
            applyState(p[welcomeSelectedPreset].state || {});
            showToast(`已成功加载 [${welcomeSelectedPreset}]`);
        }
        closeWelcomeLoadModal();
    }

