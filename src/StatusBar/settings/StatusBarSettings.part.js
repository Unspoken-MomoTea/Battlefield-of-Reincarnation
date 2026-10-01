/* ===== 15. 设置弹窗 ===== */
    /* ===== 15a. MVU变量更新方式（额外API / 随主AI） ===== */
    var VARIABLE_API_MODE_KEY = 'samsara_variable_api_mode';
    var VARIABLE_API_WORLD_BOOK_RULES = {
        'output_format (随AI输出开，主API)': { '随主API': true, '额外API': false },
        '[mvu_update]output_format (使用额外模型更新变量开)': { '随主API': false, '额外API': true }
    };
    function normalizeVariableApiMode(mode) { return mode === '随主API' ? '随主API' : '额外API'; }
    function variableApiStorage() {
        try { if (GS_PARENT && GS_PARENT.localStorage) return GS_PARENT.localStorage; } catch(e) {}
        try { return window.localStorage; } catch(e2) { return null; }
    }
    function getVariableApiMode() {
        try {
  var storage = variableApiStorage();
  return normalizeVariableApiMode(storage ? storage.getItem(VARIABLE_API_MODE_KEY) : '额外API');
        } catch(e) { return '额外API'; }
    }
    function saveVariableApiMode(mode) {
        try {
  var storage = variableApiStorage();
  if (storage) storage.setItem(VARIABLE_API_MODE_KEY, normalizeVariableApiMode(mode));
        } catch(e) {}
    }
    function resolveVariableApiHostFunction(name) {
        var roots = [GS_PARENT, window];
        try { if (window.parent && roots.indexOf(window.parent) < 0) roots.push(window.parent); } catch(e) {}
        try { if (window.top && roots.indexOf(window.top) < 0) roots.push(window.top); } catch(e2) {}
        for (var i = 0; i < roots.length; i++) {
  var root = roots[i];
  try {
      if (root && typeof root[name] === 'function') return root[name].bind(root);
      if (root && root.TavernHelper && typeof root.TavernHelper[name] === 'function') return root.TavernHelper[name].bind(root.TavernHelper);
  } catch(e3) {}
        }
        return null;
    }
    function normalizeVariableApiEntryName(name) { return String(name || '').trim().replace(/\.(txt|ya?ml)$/i, ''); }
    function variableApiRuleForEntry(name) { return VARIABLE_API_WORLD_BOOK_RULES[normalizeVariableApiEntryName(name)] || null; }
    function normalizeVariableApiWorldbookEntries(wb) {
        if (Array.isArray(wb)) return wb;
        if (wb && Array.isArray(wb.entries)) return wb.entries;
        return [];
    }
    function variableApiPresetDesired(name, mode) {
        var text = String(name || '');
        if (text.indexOf('变量额外API') >= 0) return mode === '额外API';
        if (text.indexOf('变量主API') >= 0) return mode === '随主API';
        return null;
    }
    async function applyVariableApiMode(mode) {
        mode = normalizeVariableApiMode(mode);
        var getNames = resolveVariableApiHostFunction('getCharWorldbookNames');
        var getWorldbookFn = resolveVariableApiHostFunction('getWorldbook');
        var updateWorldbookFn = resolveVariableApiHostFunction('updateWorldbookWith');
        if (!getNames || !getWorldbookFn || !updateWorldbookFn) return { ok:false, error:'未检测到世界书切换接口，请确认酒馆助手脚本已启用。' };

        var namesInfo;
        try { namesInfo = await Promise.resolve(getNames('current')); }
        catch(e) { return { ok:false, error:'读取当前角色世界书失败: ' + (e && e.message ? e.message : e) }; }
        namesInfo = namesInfo || {};
        var worldbookNames = [];
        [namesInfo.primary].concat(Array.isArray(namesInfo.additional) ? namesInfo.additional : []).forEach(function(name) {
  if (name && worldbookNames.indexOf(name) < 0) worldbookNames.push(name);
        });
        if (!worldbookNames.length) return { ok:false, error:'当前角色没有可切换的世界书。' };

        var worldbookMatched = 0, worldbookChanged = 0, presetMatched = 0, presetChanged = 0;
        try {
  for (var wi = 0; wi < worldbookNames.length; wi++) {
      var wbName = worldbookNames[wi], wb;
      try { wb = await Promise.resolve(getWorldbookFn(wbName)); } catch(e2) { continue; }
      var entries = normalizeVariableApiWorldbookEntries(wb);
      var localMatched = 0, localChanged = 0;
      entries.forEach(function(entry) {
          var rule = entry && variableApiRuleForEntry(entry.name);
          if (!rule) return;
          localMatched++;
          if (entry.enabled !== rule[mode]) localChanged++;
      });
      if (!localMatched) continue;
      worldbookMatched += localMatched;
      if (localChanged) {
          await Promise.resolve(updateWorldbookFn(wbName, function(nextWb) {
              normalizeVariableApiWorldbookEntries(nextWb).forEach(function(entry) {
                  var rule = entry && variableApiRuleForEntry(entry.name);
                  if (rule) entry.enabled = rule[mode];
              });
              return nextWb;
          }));
          worldbookChanged += localChanged;
      }
  }
  var getPresetFn = resolveVariableApiHostFunction('getPreset');
  var updatePresetFn = resolveVariableApiHostFunction('updatePresetWith');
  if (getPresetFn && updatePresetFn) {
      var preset = null;
      try { preset = await Promise.resolve(getPresetFn('in_use')); } catch(e3) {}
      var prompts = preset && Array.isArray(preset.prompts) ? preset.prompts : [];
      prompts.forEach(function(prompt) {
          var desired = variableApiPresetDesired(prompt && (prompt.name || prompt.id), mode);
          if (desired === null) return;
          presetMatched++;
          if (prompt.enabled !== desired) presetChanged++;
      });
      if (presetChanged) {
          await Promise.resolve(updatePresetFn('in_use', function(nextPreset) {
              var list = nextPreset && Array.isArray(nextPreset.prompts) ? nextPreset.prompts : [];
              list.forEach(function(prompt) {
                  var desired = variableApiPresetDesired(prompt && (prompt.name || prompt.id), mode);
                  if (desired !== null) prompt.enabled = desired;
              });
              return nextPreset;
          }));
      }
  }
        } catch(e4) {
  return { ok:false, error:'切换变量更新方式失败: ' + (e4 && e4.message ? e4.message : e4), worldbookMatched:worldbookMatched, worldbookChanged:worldbookChanged, presetMatched:presetMatched, presetChanged:presetChanged };
        }
        if (!worldbookMatched) return { ok:false, error:'未在当前角色世界书中找到变量更新模式条目，请检查条目名称。', worldbookMatched:0, worldbookChanged:0, presetMatched:presetMatched, presetChanged:presetChanged };
        saveVariableApiMode(mode);
        return { ok:true, mode:mode, worldbookMatched:worldbookMatched, worldbookChanged:worldbookChanged, presetMatched:presetMatched, presetChanged:presetChanged };
    }

    /* ===== 15a. 额外模型配置(移植自 Zsd网游论坛_本地内联版) =====
       存储位置: localStorage['samsara_api_config'] = {
         enabled:      是否启用额外模型配置(开 → 商城/血统融合走自托管API, 关 → 走 generateRaw 正文AI)
         apiUrl:       自定义 API 地址
         apiKey:       API Key
         model:        当前使用模型
         apiPresets:   [{name, apiUrl, apiKey, model}] 用户保存的多套预设
         fetchedModels:[] 从 /models 接口加载到的模型列表
       }
       说明: 配置存 localStorage(脱离 MVU, 避免被剧情/辅助脚本覆盖; 不广播 VARIABLE_UPDATE_ENDED, 零重渲染副作用)。
             首次读取时若 localStorage 为空, 自动从旧 MVU stat_data.设置.API 迁移一次。
             此配置为统一"额外模型"通道: 商城刷新与血统融合的 AI 请求都在 shopCallAI 处统一分发,
             开关开启 → 走自托管API, 关闭 → 继续 generateRaw 正文AI */
    var API_DEFAULT_MODELS = {
        openai:  ['gpt-4o','gpt-4o-mini','gpt-4-turbo','o1','o3-mini','o1-mini'],
        claude:  ['claude-3-5-sonnet','claude-3-opus','claude-3-haiku','claude-3-5-sonnet-20241022'],
        deepseek:['deepseek-chat','deepseek-reasoner','deepseek-v4-pro','deepseek-v4-flash'],
        gemini:  ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash'],
        azure:   ['gpt-4o','gpt-4o-mini','gpt-4']
    };
    /* ★ API 配置存 localStorage(脱离 MVU, 避免被剧情辅助脚本/变量更新覆盖; 不广播事件, 杜绝重渲染副作用) */
    var API_CFG_KEY = 'samsara_api_config';
    /* 读取当前 API 配置(返回安全深拷贝; 首次若有旧 MVU 数据则自动迁移一次) */
    function getApiConfig() {
        try {
            var raw = localStorage.getItem(API_CFG_KEY);
            if (!raw) {
                // 兼容旧 MVU 数据: 尝试从 stat_data.设置.API 迁移一次
                var sd = getStatData();
                var old = sd && sd.设置 && sd.设置.API;
                if (old && typeof old === 'object' && (old.apiUrl || old.apiPresets && old.apiPresets.length || old.enabled)) {
                    var migrated = {
                        enabled:    (old.enabled === true),
                        apiUrl:     safeStr(old.apiUrl),
                        apiKey:     safeStr(old.apiKey),
                        model:      safeStr(old.model),
                        apiPresets: (Array.isArray(old.apiPresets) ? old.apiPresets : []).map(function(p){ return {
                            name:safeStr(p.name), apiUrl:safeStr(p.apiUrl), apiKey:safeStr(p.apiKey), model:safeStr(p.model)
                        }; }),
                        fetchedModels: Array.isArray(old.fetchedModels) ? old.fetchedModels.slice() : []
                    };
                    localStorage.setItem(API_CFG_KEY, JSON.stringify(migrated));
                    return migrated;
                }
                return { enabled:false, apiUrl:'', apiKey:'', model:'', apiPresets:[], fetchedModels:[] };
            }
            var cfg = JSON.parse(raw);
            return {
                enabled:    (cfg.enabled === true),
                apiUrl:     safeStr(cfg.apiUrl),
                apiKey:     safeStr(cfg.apiKey),
                model:      safeStr(cfg.model),
                apiPresets: (Array.isArray(cfg.apiPresets) ? cfg.apiPresets : []).map(function(p){ return {
                    name:safeStr(p.name), apiUrl:safeStr(p.apiUrl), apiKey:safeStr(p.apiKey), model:safeStr(p.model)
                }; }),
                fetchedModels: Array.isArray(cfg.fetchedModels) ? cfg.fetchedModels.slice() : []
            };
        } catch(e) { console.warn('[主神终端] 读取API配置失败:', e.message); }
        return { enabled:false, apiUrl:'', apiKey:'', model:'', apiPresets:[], fetchedModels:[] };
    }
    /* 写回 API 配置(localStorage, 不经过 MVU/广播事件, 零副作用) */
    function saveApiConfig(mutator) {
        try {
            var cfg = getApiConfig();
            if (typeof mutator === 'function') mutator(cfg);
            localStorage.setItem(API_CFG_KEY, JSON.stringify(cfg));
            return true;
        } catch(e) { console.warn('[主神终端] 保存API配置失败:', e.message); return false; }
    }
    /* 额外模型聊天补全：世界引擎可请求结构化 JSON。
       structured=auto 时依次尝试 json_schema → json_object → plain，并按 endpoint+model 缓存可用模式。 */
    var API_STRUCTURED_MODE_CACHE = {};
    function structuredFormatUnsupported(status, text) {
        var code=Number(status),body=String(text||'');
        var explicit=[400,404,415,422].indexOf(code) >= 0 &&
            /response[_ -]?format|json[_ -]?schema|json[_ -]?object|unknown (?:field|parameter)|unrecognized|unsupported|not supported|invalid.*schema/i.test(body);
        var genericInvalidArgument=code===400 &&
            /INVALID_ARGUMENT|invalid[_ -]?argument|Request contains an invalid argument/i.test(body);
        return explicit||genericInvalidArgument;
    }
    async function apiChat(systemPrompt, userMsg, options) {
        options = options || {};
        var cfg = getApiConfig();
        var url = (cfg.apiUrl || '').trim();
        if (!url || !cfg.enabled) throw new Error('额外模型配置未启用或 API 地址为空');
        var endpoint = url;
        if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
        if (endpoint.endsWith('/chat/completions')) {
            // 已是完整端点
        } else if (endpoint.endsWith('/v1')) {
            endpoint += '/chat/completions';
        } else if (endpoint.indexOf('/v1/') >= 0) {
            endpoint = endpoint.replace(/\/v1\/.*$/, '') + '/v1/chat/completions';
        } else {
            endpoint += endpoint.indexOf('/v') >= 0 ? '/chat/completions' : '/v1/chat/completions';
        }
        var headers = { 'Content-Type': 'application/json' };
        if (cfg.apiKey && cfg.apiKey.trim()) headers.Authorization = 'Bearer ' + cfg.apiKey.trim();
        var model = safeStr(options.model).trim() || cfg.model || 'gpt-4o-mini';
        var cacheKey = endpoint + '|' + model;
        var wantsStructured = options.structured === 'auto' && options.schema;
        var cached = wantsStructured ? API_STRUCTURED_MODE_CACHE[cacheKey] : '';
        var modes = ['plain'];
        if (wantsStructured) {
            if (cached === 'json_schema') modes=['json_schema','json_object','plain'];
            else if (cached === 'json_object') modes=['json_object','plain'];
            else if (cached === 'plain') modes=['plain'];
            else modes=['json_schema','json_object','plain'];
        }
        var lastError = '';

        for (var mi=0; mi<modes.length; mi++) {
            var mode=modes[mi];
            var body = {
                model: model,
                messages: [
                    { role: 'system', content: String(systemPrompt || '') },
                    { role: 'user',   content: String(userMsg || '') }
                ],
                stream: false,
                temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.7
            };
            if (mode === 'json_schema') {
                body.response_format = {
                    type:'json_schema',
                    json_schema:{
                        name:String(options.schemaName || 'samsara_structured_result').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64),
                        strict:false,
                        schema:options.schema
                    }
                };
            } else if (mode === 'json_object') {
                body.response_format = {type:'json_object'};
            }

            var resp;
            try {
                resp = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: options.signal });
            } catch(fetchError) {
                throw fetchError;
            }
            if (!resp.ok) {
                var errTxt = '';
                try { errTxt = await resp.text(); } catch(_e){}
                lastError='HTTP ' + resp.status + ': ' + resp.statusText + (errTxt ? (' / ' + errTxt.slice(0, 300)) : '');
                if (mode !== 'plain' && structuredFormatUnsupported(resp.status,errTxt)) {
                    if (cached) delete API_STRUCTURED_MODE_CACHE[cacheKey];
                    continue;
                }
                throw new Error(lastError);
            }
            var data = await resp.json();
            var message = data && data.choices && data.choices[0] && data.choices[0].message;
            var raw = message && message.content;
            var content = typeof raw === 'string' ? raw : (raw && typeof raw === 'object' ? JSON.stringify(raw) : '');
            if (!content && message && message.parsed) content=JSON.stringify(message.parsed);
            if (!content) throw new Error('API 返回的回复内容为空');
            if (wantsStructured) API_STRUCTURED_MODE_CACHE[cacheKey]=mode;
            return content;
        }
        throw new Error(lastError || 'API 不支持当前结构化输出模式');
    }
    /* 是否启用额外模型通道(供 shopCallAI 统一分发判断) */
    function isApiConfigEnabled() {
        var c = getApiConfig();
        return (c.enabled === true) && !!(c.apiUrl && c.apiUrl.trim());
    }
    /* 计算当前可用模型列表: 优先 fetchedModels, 其次按 apiUrl 关键词推断默认列表 */
    function apiAvailableModels(cfg) {
        if (cfg.fetchedModels && cfg.fetchedModels.length > 0) return cfg.fetchedModels.slice();
        var url = (cfg.apiUrl || '').toLowerCase();
        if (url.indexOf('deepseek') >= 0) return API_DEFAULT_MODELS.deepseek.slice();
        if (url.indexOf('openai') >= 0 || url.indexOf('chatgpt') >= 0) return API_DEFAULT_MODELS.openai.slice();
        if (url.indexOf('anthropic') >= 0 || url.indexOf('claude') >= 0) return API_DEFAULT_MODELS.claude.slice();
        if (url.indexOf('gemini') >= 0 || url.indexOf('google') >= 0) return API_DEFAULT_MODELS.gemini.slice();
        if (url.indexOf('azure') >= 0) return API_DEFAULT_MODELS.azure.slice();
        return [];
    }
    /* 加载模型列表: 拼接 /v1/models 并带 Authorization 头请求; 成功写入 fetchedModels */
    async function apiFetchModels() {
        var cfg = getApiConfig();
        var url = (cfg.apiUrl || '').trim();
        if (!url) throw new Error('请先填写自定义 API 地址');
        var endpoint = url;
        if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
        if (!endpoint.endsWith('/models')) {
            endpoint += (endpoint.indexOf('/v') >= 0) ? '/models' : '/v1/models';
        }
        var headers = {};
        if (cfg.apiKey && cfg.apiKey.trim()) headers.Authorization = 'Bearer ' + cfg.apiKey.trim();
        var resp = await fetch(endpoint, { headers: headers });
        if (!resp.ok) {
            var errTxt = '';
            try { errTxt = await resp.text(); } catch(_e){}
            throw new Error('HTTP ' + resp.status + ': ' + resp.statusText + (errTxt ? (' / ' + errTxt.slice(0, 300)) : ''));
        }
        var body = await resp.json();
        var models = ((body && body.data) || []).map(function(m){ return m.id || m.model || m.name || ''; }).filter(Boolean);
        if (!models.length) throw new Error('API 返回的模型列表为空');
        return models;
    }
    function openSettings() {
        var cur = getTheme();
        var editOn = isEditMode();
        var stat = getStatData() || {};
        var cfg = stat.设置 || {};
        var superStable = (cfg.世界超稳 === true);
        var singleWorld = (cfg.单一世界 === true);
        var worldEngine = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
        var worldAdvanceOn = !!(worldEngine && typeof worldEngine.isConfigured === 'function' && worldEngine.isConfigured());
        var worldAdvanceReady = !!(worldEngine && typeof worldEngine.isEnabled === 'function' && worldEngine.isEnabled());
        var worldUsesDedicatedApi = !!(worldEngine && typeof worldEngine.usesDedicatedApi === 'function' && worldEngine.usesDedicatedApi());
        var worldAdvanceWaitingText = worldUsesDedicatedApi ? '已开启 · 等待世界推进专属 API 配置' : '已开启 · 等待额外模型配置';
        var themeHtml = '';
        THEME_ORDER.forEach(function(key) {
            var th = THEMES[key];
            themeHtml += '<div class="sam-theme-card '+(key===cur?'active':'')+'" data-theme="'+key+'">'
                + '<div class="swatch" style="background:linear-gradient(90deg,'+th.dark+','+th.accent+','+th.hp+');"></div>'
                + '<div class="name" style="color:'+th.text+';background:'+th.bg+';">'+th.name+'</div></div>';
        });
        var html = secBlock('🎨 换肤',
              '<div class="sam-settings-grid">'+themeHtml+'</div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">✏️ 修改数据</div><div style="font-size:11px;color:var(--sam-sub);">开启后点击任意数值即可就地编辑(不变形),保存写回MVU</div></div>'
            + '<div class="sam-toggle-switch '+(editOn?'on':'')+'" data-toggle="edit"><div class="knob"></div></div></div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">🌐 世界超稳</div><div style="font-size:11px;color:var(--sam-sub);">开启后世界稳定性锁定,因果轨道不再偏移</div></div>'
            + '<div class="sam-toggle-switch '+(superStable?'on':'')+'" data-toggle="世界超稳"><div class="knob"></div></div></div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">🪐 单一世界</div><div style="font-size:11px;color:var(--sam-sub);">开启后仅存在单一世界,关闭后可在多世界间选择</div></div>'
            + '<div class="sam-toggle-switch '+(singleWorld?'on':'')+'" data-toggle="单一世界"><div class="knob"></div></div></div>'
            + '<div class="sam-toggle-row"><div><div style="font-weight:bold;">🌍 世界推进</div><div id="sam-world-engine-state" style="font-size:11px;color:var(--sam-sub);">'+(worldAdvanceOn?(worldAdvanceReady?'已开启 · 独立世界引擎接管':worldAdvanceWaitingText):'已关闭 · 使用原世界面板与原推演规则')+'</div></div>'
            + '<div class="sam-toggle-switch '+(worldAdvanceOn?'on':'')+'" data-toggle="world-engine"><div class="knob"></div></div></div>');

        var difficulty = ['体验', '正常', '困难', '挑战'].indexOf(cfg.难度) >= 0 ? cfg.难度 : '体验';
        var difficultyNotes = {
            '体验': '血统、技能、装备、状态和形态至少与人物生命层级齐平，原始属性不额外提升；不生成“额外强化”状态。',
            '正常': '体验基础上，原始属性品质提升 2 阶；额外获得与人物生命层级同级品质的“额外强化”，仅衍生属性（ATK/DEF/MATK/MDEF/AP）为 E。',
            '困难': '原始属性品质提升 4 阶，体质保底 S；血统、技能至少与人物生命层级齐平，装备、状态、形态至少高于人物生命层级 1 阶；“额外强化”状态品质与人物生命层级同级，五维与衍生属性均为 C。',
            '挑战': '原始属性品质提升 6 阶，体质 SSS；血统、装备、状态、形态至少高于人物生命层级 1 阶，技能至少与人物生命层级齐平；“额外强化”状态品质比人物生命层级高 1 阶，五维与衍生属性均为 B。'
        };
        html += secBlock('⚔️ 难度 (实验功能)', '<div id="sam-difficulty-note" aria-live="polite" style="margin-bottom:10px;min-height:3em;font-size:12px;line-height:1.5;color:var(--sam-sub);">'+difficultyNotes[difficulty]+'</div><div role="group" aria-label="难度选择" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;">' + ['体验', '正常', '困难', '挑战'].map(function(mode) {
            return '<button type="button" class="sam-varmode-btn '+(difficulty===mode?'active':'')+'" data-difficulty="'+mode+'" aria-pressed="'+(difficulty===mode?'true':'false')+'" style="text-align:center;padding:9px 4px;">'+mode+'</button>';
        }).join('') + '</div><div style="margin-top:8px;color:var(--sam-sub);font-size:11px;">仅影响后续新建且好感度为负的非队友 NPC。各组件仅补足所选标准，已有更高品质不降低；原始属性仍独立提升，困难/挑战的体质按固定档位补足。“额外强化”仅在正常/困难/挑战生成，状态品质最高 SSS；生命层级最高 Ⅸ。</div>');
        var variableMode = getVariableApiMode();
        var variableModeHtml = '<div class="sam-varmode-grid">'
  + '<button type="button" class="sam-varmode-btn '+(variableMode==='额外API'?'active':'')+'" data-variable-api-mode="额外API">'
    + '<div class="ttl">额外API输出 <span class="tag">推荐</span></div>'
    + '<div class="desc">独立模型单独更新变量，正文更干净；需在 MVU 扩展中配置额外模型。</div></button>'
  + '<button type="button" class="sam-varmode-btn '+(variableMode==='随主API'?'active':'')+'" data-variable-api-mode="随主API">'
    + '<div class="ttl">随主AI输出 <span class="tag">开箱即用</span></div>'
    + '<div class="desc">正文模型同轮输出变量更新，无需额外模型；长文本更容易出现格式错误。</div></button>'
  + '</div>'
  + '<div class="sam-varmode-status" id="sam-varmode-status"></div>'
  + '<div style="margin-top:5px;font-size:10px;line-height:1.5;color:var(--sam-sub);">此项只切换 MVU 世界书/预设。下方「额外模型配置」供商城刷新、血统融合使用；世界推进未启用专属 API 时也会复用该通道。若世界推进启用专属 API，则两套接口完全分离。</div>';
        html += secBlock('🧭 变量更新方式', variableModeHtml);

        /* ----- 🔌 API 配置区块(移植自 Zsd网游论坛_本地内联版) ----- */
        var apiCfg = getApiConfig();
        // 预设下拉框: 完全在 DOM 插入后由 apiRefreshFields() 用 jQuery text() 填值(避免转义/注入问题)
        var presetOpts = '<option value="">— 选择已保存预设 —</option>';
        apiCfg.apiPresets.forEach(function(p) {
            presetOpts += '<option value=""></option>';
        });

        var modelList = apiAvailableModels(apiCfg);
        var modelOpts = '<option value="">(未选择模型)</option>';
        modelList.forEach(function(m){
            modelOpts += '<option value="'+esc(m)+'"'+(m===apiCfg.model?' selected':'')+'>'+esc(m)+'</option>';
        });
        if (apiCfg.model && modelList.indexOf(apiCfg.model) < 0) {
            modelOpts = '<option value="'+esc(apiCfg.model)+'" selected>'+esc(apiCfg.model)+'</option>' + modelOpts;
        }

        var fetchedTag = apiCfg.fetchedModels && apiCfg.fetchedModels.length
            ? '<span class="sam-api-status ok">已加载 '+apiCfg.fetchedModels.length+' 个模型</span>'
            : '<span class="sam-api-status warn">未加载(使用默认列表)</span>';

        // 启用开关提示语
        var apiEnableHint = apiCfg.enabled
            ? '<span class="sam-api-status ok">已启用: 商城刷新 / 血统融合可使用自托管 API'+(worldUsesDedicatedApi?'；世界推进使用专属 API':'；世界推进可复用此通道')+'</span>'
            : '<span class="sam-api-status warn">未启用: 商城刷新 / 血统融合将走正文 API'+(worldUsesDedicatedApi?'；世界推进继续使用专属 API':'；世界推进等待额外模型配置')+'</span>';
        var apiHtml = '<div class="sam-api-section">'
            // 启用开关
            + '<div class="sam-toggle-row" style="margin-bottom:8px;">'
              + '<div><div style="font-weight:bold;">🔌 启用额外模型配置</div>'
              + '<div id="sam-api-enable-state" style="margin-top:2px;">'+apiEnableHint+'</div>'
              + '</div>'
              + '<div class="sam-toggle-switch '+(apiCfg.enabled?'on':'')+'" data-toggle="api-enabled"><div class="knob"></div></div>'
            + '</div>'
            // 下方配置(开关关时隐藏)
            + '<div id="sam-api-fields" style="'+(apiCfg.enabled?'':'display:none;')+'">'
            // 预设管理
            + '<div class="sam-api-block-label">📜 API 预设(多套配置存档)</div>'
            + '<div class="sam-api-row">'
              + '<select class="sam-api-select" id="sam-api-preset-sel" style="flex:1;">'+presetOpts+'</select>'
              + '<button class="sam-api-btn danger" data-act="delete-preset">删除</button>'
            + '</div>'
            + '<div class="sam-api-row" style="margin-top:4px;">'
              + '<input class="sam-api-input" id="sam-api-preset-name" placeholder="预设名称(保存当前配置为新预设/覆盖同名)" style="flex:1;">'
              + '<button class="sam-api-btn save" data-act="save-preset">保存预设</button>'
            + '</div>'
            // 字段
            + '<div class="sam-api-field"><label>自定义 API 地址</label>'
              + '<input class="sam-api-input" data-field="apiUrl" value="'+esc(apiCfg.apiUrl)+'" placeholder="http://127.0.0.1:8808/v1"></div>'
            + '<div class="sam-api-field"><label>API Key</label>'
              + '<input class="sam-api-input" data-field="apiKey" type="password" value="'+esc(apiCfg.apiKey)+'" placeholder="sk-..."></div>'
            + '<div class="sam-api-field"><label>模型</label>'
              + '<select class="sam-api-select" data-field="model">'+modelOpts+'</select></div>'
            // 加载模型
            + '<div class="sam-api-row" style="margin-top:6px;">'
              + '<button class="sam-api-btn" data-act="load-models">📡 加载模型列表</button>'
              + '<button class="sam-api-btn" data-act="clear-models">清除</button>'
              + '<span id="sam-api-models-status" style="margin-left:auto;align-self:center;">'+fetchedTag+'</span>'
            + '</div>'
            + '</div>'
            + '</div>';

        html += '<div class="sam-api-section" style="margin-top:12px;">' + apiHtml + '</div>';
        showModal('⚙️ 设置', html, true);   // 第三参 true = 设置弹窗禁止点击框外自动关闭(避免误触丢失表单输入)
        /* ===== API 配置: 声明(必须在 apiRefreshFields 调用前就位, 否则 $apiModal 为 undefined, 虽 jQuery 回退到 document 仍能命中但属脆弱路径) ===== */
        var $apiModal = $('#samsara-modal');
        var apiFieldTimer = null;   // 字段实时保存防抖计时器(载入/保存预设前需 clearTimeout 防止旧值回写覆盖)
        // 主题选择
        // 初始用 jQuery 安全填值: 预设下拉框名字/模型下拉框等(避免 HTML 转义/注入问题)
        try { apiRefreshFields(); } catch(_e){ console.warn('[主神终端] apiRefreshFields 初始刷新异常:', _e && _e.message); }
        $('#samsara-modal').off('click.samTheme').on('click.samTheme', '.sam-theme-card', function() {
            var tk = $(this).data('theme');
            setTheme(tk);
            $(this).siblings().removeClass('active');
            $(this).addClass('active');
            // 重渲染(变量变更需重建style + 重新渲染面板)
            renderAll();
        });
        // 编辑开关
        $('#samsara-modal').off('click.samToggle').on('click.samToggle', '.sam-toggle-switch[data-toggle="edit"]', function() {
            var on = !$(this).hasClass('on');
            $(this).toggleClass('on', on);
            setEditMode(on);
            closeModal();
            renderAll();
        });
        $('#samsara-modal').off('change.samDifficulty').off('click.samDifficulty').on('click.samDifficulty', 'button[data-difficulty]', function() {
            var mode = $(this).attr('data-difficulty');
            if (['体验', '正常', '困难', '挑战'].indexOf(mode) < 0) return;
            var ok = writeBackMvu(function(statData) {
                if (!statData.设置) statData.设置 = {};
                statData.设置.难度 = mode;
            });
            if (!ok) { samToast('error', '难度保存失败'); openSettings(); return; }
            $('#samsara-modal button[data-difficulty]').removeClass('active').attr('aria-pressed', 'false');
            $(this).addClass('active').attr('aria-pressed', 'true');
            $('#sam-difficulty-note').text(difficultyNotes[mode]);
            samToast('success', '难度已设为'+mode+'，对后续新敌对 NPC 生效');
            renderAll();
        });
        // 世界超稳 / 单一世界 开关(写回 MVU 设置节点)
        $('#samsara-modal').off('click.samCfgToggle').on('click.samCfgToggle', '.sam-toggle-switch[data-toggle="世界超稳"], .sam-toggle-switch[data-toggle="单一世界"]', function() {
            var key = $(this).data('toggle');
            var on = !$(this).hasClass('on');
            $(this).toggleClass('on', on);
            writeBackMvu(function(statData) {
                if (!statData.设置) statData.设置 = {};
                statData.设置[key] = on;
            });
            renderAll();
        });
        // 世界推进总开关：专属 API 优先；只有未启用专属 API 时才复用/启用主神终端额外模型。
        $('#samsara-modal').off('click.samWorldEngine').on('click.samWorldEngine', '.sam-toggle-switch[data-toggle="world-engine"]', function() {
            var engine = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
            if (!engine || typeof engine.setEnabled !== 'function') { samToast('error', '请先加载独立脚本：世界推进系统.js'); return; }
            var on = !$(this).hasClass('on');
            engine.setEnabled(on);
            $(this).toggleClass('on', on);
            var ready = !!(typeof engine.isEnabled === 'function' && engine.isEnabled());
            var dedicated = !!(typeof engine.usesDedicatedApi === 'function' && engine.usesDedicatedApi());
            $('#sam-world-engine-state', $apiModal).text(on ? (ready ? '已开启 · 独立世界引擎接管' : (dedicated ? '已开启 · 等待世界推进专属 API 配置' : '已开启 · 等待额外模型配置')) : '已关闭 · 使用原世界面板与原推演规则');
            if (on) {
                apiRefreshFields();
                if (ready) samToast('success', dedicated ? '世界推进已开启 · 使用专属 API' : '世界推进已开启 · 使用主神终端额外模型');
                else if (dedicated) samToast('warning', '世界推进已开启，请在世界推进「设置」中完成专属 API 配置');
                else samToast('warning', '世界推进已开启，主神终端额外模型尚未配置完整');
            } else samToast('success', '世界推进已关闭，已恢复原世界面板与推演规则');
        });

        // MVU变量更新方式：同开局页共享 localStorage，并立即同步世界书/当前预设
        function refreshVariableModeFields(message, state) {
  var mode = getVariableApiMode();
  $('[data-variable-api-mode]', $apiModal).each(function() {
      $(this).toggleClass('active', $(this).attr('data-variable-api-mode') === mode);
  });
  var $st = $('#sam-varmode-status', $apiModal);
  if (!$st.length) return;
  $st.removeClass('ok err').addClass(state || '');
  $st.text(message || (mode === '额外API' ? '当前：额外API输出' : '当前：随主AI输出'));
        }
        refreshVariableModeFields();
        $apiModal.off('click.samVariableMode').on('click.samVariableMode', '[data-variable-api-mode]', async function() {
  var mode = normalizeVariableApiMode($(this).attr('data-variable-api-mode'));
  var $buttons = $('[data-variable-api-mode]', $apiModal).prop('disabled', true);
  refreshVariableModeFields('正在切换世界书与预设条目…', '');
  var result = await applyVariableApiMode(mode);
  $buttons.prop('disabled', false);
  if (result.ok) {
      refreshVariableModeFields('已切换 · 世界书变更 '+result.worldbookChanged+' 项 · 预设变更 '+result.presetChanged+' 项', 'ok');
      samToast('success', '变量更新方式已切换为' + (mode === '额外API' ? '额外API输出' : '随主AI输出'));
  } else {
      refreshVariableModeFields(result.error || '切换失败', 'err');
      samToast('error', result.error || '变量更新方式切换失败');
  }
        });

        /* ===== API 配置: 事件绑定 ===== */
        // ($apiModal / apiFieldTimer 已在上方 showModal 后声明)
        // 局部辅助: 依据 stat 重建模型下拉
        function apiRenderModelSelect(c) {
            var list = apiAvailableModels(c);
            var $m = $('[data-field="model"]', $apiModal);
            $m.empty().append('<option value="">(未选择模型)</option>');
            list.forEach(function(m) {
                var $o = $('<option></option>').val(m).text(m);
                if (m === c.model) $o.prop('selected', true);
                $m.append($o);
            });
            if (c.model && list.indexOf(c.model) < 0) {
                $m.prepend($('<option></option>').val(c.model).text(c.model).prop('selected', true));
            }
        }
        // 局部辅助: 依据 stat 刷新 API 区块所有字段(不重开弹窗)
        function apiRefreshFields() {
            var c = getApiConfig();
            // 同步启用开关
            $('.sam-toggle-switch[data-toggle="api-enabled"]', $apiModal).toggleClass('on', c.enabled === true);
            $('#sam-api-fields', $apiModal).toggle(c.enabled === true);
            // 启用状态提示
            var $hint = $('#sam-api-enable-state', $apiModal);
            if (c.enabled === true) {
                var _engineForApiHint = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
                var _dedicatedForApiHint = !!(_engineForApiHint && typeof _engineForApiHint.usesDedicatedApi === 'function' && _engineForApiHint.usesDedicatedApi());
                $hint.html('<span class="sam-api-status ok">已启用: 商城刷新 / 血统融合可使用自托管 API'+(_dedicatedForApiHint?'；世界推进使用专属 API':'；世界推进可复用此通道')+'</span>');
            } else {
                var _engineForApiHint = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
                var _dedicatedForApiHint = !!(_engineForApiHint && typeof _engineForApiHint.usesDedicatedApi === 'function' && _engineForApiHint.usesDedicatedApi());
                $hint.html('<span class="sam-api-status warn">未启用: 商城刷新 / 血统融合将走正文 API'+(_dedicatedForApiHint?'；世界推进继续使用专属 API':'；世界推进等待额外模型配置')+'</span>');
            }
            var $ps = $('#sam-api-preset-sel').empty().append('<option value="">— 选择已保存预设 —</option>');
            c.apiPresets.forEach(function(p) { $ps.append($('<option></option>').val(p.name).text(p.name)); });
            $('[data-field="apiUrl"]', $apiModal).val(c.apiUrl);
            $('[data-field="apiKey"]', $apiModal).val(c.apiKey);
            apiRenderModelSelect(c);
            if (c.fetchedModels && c.fetchedModels.length) {
                $('#sam-api-models-status').html('<span class="sam-api-status ok">已加载 '+c.fetchedModels.length+' 个模型</span>');
            } else {
                $('#sam-api-models-status').html('<span class="sam-api-status warn">未加载(使用默认列表)</span>');
            }
            var engine = GS_PARENT.Samsara && GS_PARENT.Samsara.worldEngine;
            if (engine && typeof engine.isConfigured === 'function') {
                var engineOn = engine.isConfigured();
                var engineReady = typeof engine.isEnabled === 'function' && engine.isEnabled();
                $('.sam-toggle-switch[data-toggle="world-engine"]', $apiModal).toggleClass('on', engineOn);
                var engineDedicated = typeof engine.usesDedicatedApi === 'function' && engine.usesDedicatedApi();
                $('#sam-world-engine-state', $apiModal).text(engineOn ? (engineReady ? '已开启 · 独立世界引擎接管' : (engineDedicated ? '已开启 · 等待世界推进专属 API 配置' : '已开启 · 等待额外模型配置')) : '已关闭 · 使用原世界面板与原推演规则');
                if (typeof engine.render === 'function') engine.render();
            }
        }
        // 启用开关: 切换 enabled, 同步显隐下方字段
        $apiModal.off('click.samApiEnable').on('click.samApiEnable', '.sam-toggle-switch[data-toggle="api-enabled"]', function() {
            var on = !$(this).hasClass('on');
            saveApiConfig(function(cfg) { cfg.enabled = on; });
            apiRefreshFields();
        });
        // 选中预设即载入: 把预设里的地址/Key/来源/代理直接贴到输入框, 模型下拉清空到只剩预设中的模型, 预设名同步到下方输入框
        $apiModal.off('change.samApiPreset').on('change.samApiPreset', '#sam-api-preset-sel', function() {
            clearTimeout(apiFieldTimer);
            var $sel = $(this);
            var name = ($sel.val() || '').trim();
            if (!name) { $('#sam-api-preset-name').val(''); return; }   // 选回"选择已保存预设"占位项则只清空名称
            var snap = null, curCfg = getApiConfig();
            for (var i = 0; i < curCfg.apiPresets.length; i++) {
                if (curCfg.apiPresets[i].name === name) { snap = curCfg.apiPresets[i]; break; }
            }
            if (!snap) { samToast('err', '预设不存在: ' + name); return; }
            // 写回 localStorage(切换到新 API 地址,旧的已加载模型列表失效,一并清空以初始化)
            saveApiConfig(function(cfg) {
                cfg.apiUrl = snap.apiUrl; cfg.apiKey = snap.apiKey; cfg.model = snap.model;
                cfg.fetchedModels = [];
            });
            // 直接贴到输入框
            $('[data-field="apiUrl"]', $apiModal).val(snap.apiUrl || '');
            $('[data-field="apiKey"]', $apiModal).val(snap.apiKey || '');
            // 模型下拉: 清空, 只放预设中的模型(若有则选中, 否则置空)
            var $m = $('[data-field="model"]', $apiModal).empty().append('<option value="">(未选择模型)</option>');
            if (snap.model) $m.append($('<option></option>').val(snap.model).text(snap.model));
            $m.val(snap.model || '');
            // 预设名同步到下方输入框(便于直接覆盖保存) —— 切换即载入, 无额外提示(字段刷新即为反馈)
            $('#sam-api-preset-name').val(name);
            // 初始化已加载模型状态提示(切换到新 API 后旧模型列表已失效)
            $('#sam-api-models-status').html('<span class="sam-api-status warn">未加载(使用默认列表)</span>');
        });
        // 删除预设
        $apiModal.off('click.samApiDel').on('click.samApiDel', '.sam-api-btn[data-act="delete-preset"]', function() {
            var name = ($('#sam-api-preset-sel option:selected').text() || '').trim();
            if (!name) { samToast('warn', '请先选择要删除的预设'); return; }
            samConfirm('删除预设', '确认删除预设「' + name + '」?此操作不可撤销。', function() {
                saveApiConfig(function(cfg) {
                    var idx = (cfg.apiPresets || []).findIndex(function(p){ return p.name === name; });
                    if (idx >= 0) cfg.apiPresets.splice(idx, 1);
                    cfg.fetchedModels = [];   // 删除预设同时初始化已加载模型状态
                });
                apiRefreshFields();
                samToast('ok', '已删除预设: ' + name);
            });
        });
        // 保存预设(以弹窗内当前字段值为快照, 写入预设列表, 同名覆盖)
        $apiModal.off('click.samApiSave').on('click.samApiSave', '.sam-api-btn[data-act="save-preset"]', function() {
            clearTimeout(apiFieldTimer);   // 取消待写回计时器, 确保快照读到的就是当前屏幕值并随后不被旧值回写覆盖
            var name = ($('#sam-api-preset-name').val() || '').trim();
            if (!name) { samToast('warn', '请输入预设名称'); return; }
            var snap = {
                apiUrl: $('[data-field="apiUrl"]', $apiModal).val() || '',
                apiKey: $('[data-field="apiKey"]', $apiModal).val() || '',
                model: $('[data-field="model"]', $apiModal).val() || ''
            };
            saveApiConfig(function(cfg) {
                var idx = (cfg.apiPresets || []).findIndex(function(p){ return p.name === name; });
                var entry = { name: name, apiUrl: snap.apiUrl, apiKey: snap.apiKey, model: snap.model };
                if (idx >= 0) cfg.apiPresets[idx] = entry; else cfg.apiPresets.push(entry);
            });
            apiRefreshFields();
            $('#sam-api-preset-name').val('');
            samToast('ok', '已保存预设: ' + name);
        });
        // 字段实时保存(防抖 + apiUrl 变更时刷新模型下拉; apiFieldTimer 已在前面声明)
        $apiModal.off('input.samApiField change.samApiField').on('input.samApiField change.samApiField', '[data-field]', function() {
            var field = $(this).data('field');
            var val = $(this).val() || '';
            clearTimeout(apiFieldTimer);
            apiFieldTimer = setTimeout(function() {
                saveApiConfig(function(cfg) { cfg[field] = val; });
                if (field === 'apiUrl') apiRenderModelSelect(getApiConfig());
            }, 400);
        });
        // 加载模型列表(异步 fetch /v1/models, 成功写入 fetchedModels)
        $apiModal.off('click.samApiLoad').on('click.samApiLoad', '.sam-api-btn[data-act="load-models"]', function() {
            var $btn = $(this); var $st = $('#sam-api-models-status');
            $btn.prop('disabled', true).text('加载中…');
            $st.html('<span class="sam-api-status">正在请求模型列表…</span>');
            var url = ($('[data-field="apiUrl"]', $apiModal).val() || '').trim();
            var key = ($('[data-field="apiKey"]', $apiModal).val() || '').trim();
            saveApiConfig(function(cfg) { cfg.apiUrl = url; cfg.apiKey = key; });
            apiFetchModels().then(function(models) {
                // 成功: 清理旧模型 + 旧选择, 列表仅保留本次 API 返回的模型, 跳到"未选择"
                saveApiConfig(function(cfg) { cfg.fetchedModels = models; cfg.model = ''; });
                var fresh = getApiConfig();
                apiRenderModelSelect(fresh);
                $('[data-field="model"]', $apiModal).val('');
                $st.html('<span class="sam-api-status ok">已加载 ' + models.length + ' 个模型(已重置选择)</span>');
                samToast('ok', '已加载 ' + models.length + ' 个模型, 已重置为"未选择模型"');
            }).catch(function(err) {
                $st.html('<span class="sam-api-status err">失败: ' + esc(err && err.message || String(err)) + '</span>');
                samToast('err', '加载失败: ' + (err && err.message || err));
            }).then(function() {
                $btn.prop('disabled', false).text('📡 加载模型列表');
            });
        });
        // 清除已加载模型列表(回退到默认模型推荐, 并重置选择)
        $apiModal.off('click.samApiClear').on('click.samApiClear', '.sam-api-btn[data-act="clear-models"]', function() {
            saveApiConfig(function(cfg) { cfg.fetchedModels = []; cfg.model = ''; });
            apiRenderModelSelect(getApiConfig());
            $('[data-field="model"]', $apiModal).val('');
            $('#sam-api-models-status').html('<span class="sam-api-status warn">未加载(使用默认列表)</span>');
            samToast('ok', '已清除已加载模型列表, 已重置为"未选择模型"');
        });
    }

    