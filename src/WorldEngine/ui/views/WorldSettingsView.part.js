    // 设置页纯渲染：交互事件仍由主 UI 类统一处理。
    class WorldSettingsView {
        constructor(engine){this.engine=engine;}
        render(context={}) {
            const ctx={...context,engine:this.engine};
        const {engine,section,text}=ctx;
        let html='';
        const api=engine.normalizeDedicatedApi(engine.config.dedicatedApi);
        const fontButtons=Object.entries(WORLD_FONT_SCALES).map(([key,item])=>'<button class="we-setting-btn '+(engine.config.fontScale===key?'active':'')+'" data-font-option="'+key+'">'+text(item.name)+' · '+text(item.size)+'</button>').join('');
        const presets=api.apiPresets.map(p=>'<option value="'+text(p.name)+'">'+text(p.name)+'</option>').join('');
        const modelOptions=Array.from(new Set([api.model,...api.fetchedModels].filter(Boolean))).map(model=>'<option value="'+text(model)+'"></option>').join('');
        const terminalReady=!!(engine.host.Samsara?.terminal?.apiReady?.());
        const sourceState=engine.usesDedicatedApi()
            ?(engine.dedicatedApiReady()?'专属 API 已就绪':'专属 API 已接管，但配置尚不完整')
            :(terminalReady?'使用主神终端额外模型':'主神终端额外模型尚未准备好');
        html+=section('界面字号','<div class="we-setting-row"><div class="we-setting-copy"><b>界面字号</b><small>色调跟随主神终端；这里仅调整世界推进自己的文字大小。</small></div><div class="we-setting-actions">'+fontButtons+'</div></div>','色调跟随主神终端 · 默认标准 16px');
        const historyToProse=engine.config.sendHistoryToProse===true;
        html+=section('历史记忆','<div class="we-setting-row"><div class="we-setting-copy"><b>向正文提供历史记忆</b><small>开启后，正文AI额外读取“近期原始锚点 + 更早长期总结”；关闭只影响正文，世界推进自身仍始终使用完整的分层历史脉络。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(historyToProse?'on':'')+'" data-action="history-prose-toggle"><span>'+text(historyToProse?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>','默认关闭 · 原始历史事实不会因关闭而删除');
        html+=section('模型接口',
            '<div class="we-setting-row"><div class="we-setting-copy"><b>当前调用来源</b><small>'+text(sourceState)+'</small></div><div class="we-setting-actions"><span class="we-source-badge">'+text(engine.apiSourceLabel())+'</span></div></div>'
            +'<div class="we-setting-row"><div class="we-setting-copy"><b>世界推进专属 API</b><small>开启后世界推进只走这里，不再调用状态栏 / 主神终端的 API；即使配置不完整也不会偷偷回退。</small></div><div class="we-setting-actions"><button class="we-setting-btn we-switch '+(api.enabled?'on':'')+'" data-action="dedicated-toggle"><span>'+text(api.enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>'
            +(api.enabled
                ?'<div class="we-api-toolbar"><select class="we-setting-input" data-dedicated-preset><option value="">— 选择已保存 API 预设 —</option>'+presets+'</select><input class="we-setting-input" data-dedicated-preset-name maxlength="80" placeholder="预设名称"><button class="we-setting-btn" data-action="dedicated-preset-save">保存预设</button><button class="we-setting-btn" data-action="dedicated-preset-delete">删除预设</button></div>'
                 +'<div class="we-api-grid"><label class="wide">API 地址<input class="we-setting-input" data-dedicated-field="apiUrl" value="'+text(api.apiUrl)+'" placeholder="https://example.com/v1"></label><label class="wide">API Key<input class="we-setting-input" data-dedicated-field="apiKey" type="password" value="'+text(api.apiKey)+'" autocomplete="off" placeholder="sk-..."></label><label>模型<input class="we-setting-input" data-dedicated-field="model" list="we-dedicated-models" value="'+text(api.model)+'" placeholder="输入或加载模型名"><datalist id="we-dedicated-models">'+modelOptions+'</datalist></label><label>模型目录<span class="we-setting-actions"><button class="we-setting-btn" data-action="dedicated-models">加载模型 / 测试连接</button></span></label></div>'
                 +'<p class="we-muted">接口按 OpenAI-compatible /v1/chat/completions 与 /v1/models 方式连接，并保留 JSON Schema → JSON Object → 普通文本的结构化兼容降级。</p>'
                :'<div class="we-notice">当前关闭专属 API。世界推进继续使用主神终端「额外模型配置」；这里不会复制或读取状态栏里的 API Key。</div>')
            ,'接口配置只存本地 localStorage，不写入 MVU');
        return html;
    }
    }
