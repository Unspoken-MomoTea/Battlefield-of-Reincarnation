    // 提示词工作台纯渲染：文档/世界书/分段操作仍由主 UI 类处理。
    function worldEngineRenderPromptTab(ctx) {
        const {engine,text,section,empty}=ctx;
        let html='';
        const promptView=engine.promptDraft||{
            preset:engine.config.preset,
            corePrompt:engine.config.corePrompt??CORE_WORLD_RULES,
            macroPrompt:engine.config.macroPrompt??DEFAULT_MACRO_PROMPT,
            stabilityPromptTemplate:engine.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE,
            structurePrompt:engine.config.structurePrompt,
            npcAuditPrompt:engine.config.npcAuditPrompt,
            contextTurns:engine.config.contextTurns||6,
            activationMode:engine.config.activationMode||'respect_activation',
            selectedEntries:Array.isArray(engine.config.selectedEntries)?copy(engine.config.selectedEntries):null
        };
        const docs=engine.getPromptDocuments(),activeDoc=docs.find(doc=>doc.id===engine.config.activePromptDocumentId);
        html+='<div class="we-preset-toolbar"><div><b>提示词工作台</b><small>主要操作固定在顶部，不需要再滚到页面底部寻找保存。</small></div><div><button class="we-btn we-primary" data-action="save">保存当前设置</button><button class="we-btn" data-action="save-default">保存为个人默认</button><button class="we-btn" data-action="preview">预览下一次请求</button></div></div>';
        html+=section('预设文档','<div class="we-doc-create"><input data-doc-name maxlength="80" placeholder="文档名称，例如：原著推进·标准" value="'+text(activeDoc?.builtin?'':activeDoc?.name||'')+'"><button class="we-btn we-primary" data-action="doc-save">保存为文档</button><button class="we-btn" data-action="doc-import">导入文档</button><input data-doc-import type="file" accept=".json,application/json" hidden></div>'+
            (docs.length?'<div class="we-doc-list">'+docs.map(doc=>'<div class="we-doc-row"><div><b>'+text(doc.name)+(doc.builtin?' <span class="we-doc-badge">内置默认</span>':'')+'</b><small>'+text(doc.updatedAt?new Date(doc.updatedAt).toLocaleString():'未记录时间')+(doc.id===engine.config.activePromptDocumentId?' · 当前应用':'')+'</small></div><span class="we-doc-actions"><button data-action="doc-apply" data-doc-id="'+text(doc.id)+'">应用</button><button data-action="doc-export" data-doc-id="'+text(doc.id)+'">导出</button>'+(doc.builtin?'':'<button data-action="doc-delete" data-doc-id="'+text(doc.id)+'">删除</button>')+'</span></div>').join('')+'</div>':empty('还没有预设文档','保存当前设置后，可以在这里应用、导出或删除。')),'内置“默认设置”始终跟随代码版本；“保存为个人默认”会另存全部可编辑提示词、正文窗口与资料范围，不会覆盖内置模板');
        html+='<div class="we-notice">世界书目录会读取角色主书、角色附加书、当前聊天绑定书和酒馆全局启用书。蓝绿灯表示条目触发方式；“实际读取”仍以请求检查中的本次清单为准。</div>';
        const groups=new Map();
        for(const e of engine.bookCatalogue||[]){if(!groups.has(e.book))groups.set(e.book,[]);groups.get(e.book).push(e);}
        const selectedEntries=Array.isArray(promptView.selectedEntries)?promptView.selectedEntries:null;
        const selected=e=>!e.technical&&(engine.isNpcAuditWorldbook(e)?engine.isNpcBuildAuditEnabled():selectedEntryMatches(e,selectedEntries));
        html+=section('资料读取范围','<div class="we-config-row"><label>正文窗口 <input data-floors type="number" min="1" max="100" value="'+text(promptView.contextTurns||6)+'"> 层</label><label>读取方式 <select data-activation><option value="respect_activation" '+(promptView.activationMode!=='force_selected'?'selected':'')+'>遵循蓝绿灯</option><option value="force_selected" '+(promptView.activationMode==='force_selected'?'selected':'')+'>强制读取勾选项</option></select></label></div><p class="we-muted">遵循蓝绿灯：蓝灯常驻，绿灯扫描上述正文窗口关键词；禁用项不读。强制模式可纳入普通禁用项，但 [variables]、[mvu_update]、正文额外思考及任务/输出技术条目始终隔离。未绑定且未全局启用的世界书不会被自动读取。</p><div class="we-tools"><button data-action="books">加载 / 刷新目录</button><button data-action="book-all">全选</button><button data-action="book-none">全不选</button></div>'+
            (groups.size?Array.from(groups).map(([book,list])=>'<details class="we-book" open><summary>'+text(book)+' <small>'+text((list[0]?.sources||[]).join(' · ')||'已绑定')+' · '+list.filter(selected).length+' / '+list.length+' 项已勾选</small></summary><div class="we-book-list">'+list.map(e=>{
                const report=(engine.readReport||[]).find(r=>r.世界书===e.book&&r.条目ID===e.id);
                return '<label class="we-book-row"><input type="checkbox" data-book value="'+text(JSON.stringify([e.book,e.id]))+'" '+(selected(e)?'checked':'')+' '+(e.technical?'disabled':'')+'><span class="we-lamp '+(e.technical?'gray':e.mode==='constant'?'blue':e.mode==='selective'?'green':'gray')+'" title="'+text(e.technical?'技术条目 · 已隔离':e.mode==='constant'?'蓝灯 · 常驻':e.mode==='selective'?'绿灯 · 关键词触发':'其他激活方式')+'"></span><span class="we-book-title"><b>'+text(e.title)+'</b><small>'+text(e.technical?'技术条目 · 世界引擎不读取':(e.mode==='constant'?'常驻':e.mode==='selective'?'关键词：'+(Array.isArray(e.keys)?e.keys.map(k=>typeof k==='string'?k:'正则条件').join('、'):e.keys):e.mode)+(e.enabled?'':' · 已禁用'))+'</small></span><small class="we-read-state">'+text(report?'上次检查：'+report.原因:e.technical?'固定隔离':'尚未检查')+'</small></label>';
            }).join('')+'</div></details>').join(''):empty('尚未加载目录','点击“加载 / 刷新目录”读取当前绑定和全局启用的世界书。')));
        const segments=splitPresetSegments(promptView.preset);
        html+=section('分段提示词','<div class="we-segment-toolbar"><span>默认只读，展开查看；开启编辑后可修改。</span><button class="we-btn" data-action="prompt-edit" aria-pressed="'+!!engine.promptEditing+'">'+(engine.promptEditing?'锁定编辑':'开启编辑')+'</button><button class="we-btn" data-action="segment-add" '+(engine.promptEditing?'':'disabled')+'>＋ 新增分段</button></div><div class="we-segment-list" data-segment-list>'+segments.map((part,i)=>'<details class="we-segment" data-segment-row><summary>'+text(part.title||'未命名分段')+' <small>'+formatTokenCount(estimateTokens(part.body),true)+'</small></summary><div class="we-segment-head"><input '+(engine.promptEditing?'':'readonly')+' data-segment-title aria-label="分段标题 '+i+'" placeholder="分段标题（可留空）" value="'+text(part.title)+'"><small>'+formatTokenCount(estimateTokens(part.body),true)+'</small><span class="we-segment-actions"><button type="button" '+(engine.promptEditing?'':'disabled')+' data-action="segment-up" title="上移">↑</button><button type="button" '+(engine.promptEditing?'':'disabled')+' data-action="segment-down" title="下移">↓</button><button type="button" '+(engine.promptEditing?'':'disabled')+' data-action="segment-delete" title="删除">删除</button></span></div><textarea '+(engine.promptEditing?'':'readonly')+' data-segment="'+i+'" data-title="'+text(part.title)+'" aria-label="预设分段 '+i+'">'+text(part.body)+'</textarea></details>').join('')+'</div><p class="we-muted">这些分段属于主要工作层，可以新增、删除或调整顺序。核心约束与条件提示词在下方单独编辑，并与同一预设文档一起保存。</p>');
        html+=section('系统提示词','<div class="we-notice">这里展示的文本都会直接参与实际 system 请求，并随预设文档保存、应用、导入和导出。条件提示词只在对应条件成立时发送；只有程序字段 Schema 保持固定。</div>'
            +'<details class="we-segment"><summary>世界引擎核心约束 · '+(engine.promptEditing?'编辑中':'点击展开')+'</summary><textarea data-core-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.corePrompt??CORE_WORLD_RULES)+'</textarea><p class="we-muted">始终发送。可修改或留空；留空即不额外注入核心约束。</p></details>'
            +'<details class="we-segment"><summary>宏观骨架交付 · 条件提示词</summary><textarea data-macro-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.macroPrompt??DEFAULT_MACRO_PROMPT)+'</textarea><p class="we-muted">仅在本轮需要建立/补足宏观骨架时发送。</p></details>'
            +'<details class="we-segment"><summary>世界自救 · 条件提示词模板</summary><textarea data-stability-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)+'</textarea><p class="we-muted">世界稳定值低于100且未开启世界超稳时发送。可使用 {{阶段}}、{{稳定值}}、{{规则}} 占位符。</p></details>'
            +'<details class="we-segment"><summary>角色管理 · NPC构筑审计 · '+(engine.isNpcBuildAuditEnabled()?'当前启用':'当前关闭')+'</summary><textarea data-npc-audit-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)+'</textarea><p class="we-muted">无论开关状态都可编辑并保存；只有开启审计且本轮存在审计对象时才发送。</p></details>','核心与条件提示词均可编辑');
        html+=section('WorldResult 输出协议','<details class="we-segment"><summary>WorldResult 协议说明 · 点击展开</summary><textarea data-structure-prompt '+(engine.promptEditing?'':'readonly')+'>'+text(promptView.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'</textarea></details><details class="we-segment"><summary>程序字段 Schema · 只读</summary><textarea readonly>'+text(JSON.stringify(WORLD_RESULT_SCHEMA,null,2))+'</textarea></details><p class="we-muted">协议说明使用上方编辑开关。保存后用于实际 system 请求；Schema 固定只读，修改任何文字提示词都不会改变程序变量结构。</p>');
        return html;
    }

    class PromptTabView {
        constructor(engine){ this.engine=engine; }
        render(context={}) { return worldEngineRenderPromptTab({...context,engine:context.engine||this.engine}); }
    }
