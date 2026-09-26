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
            modulePrompts:engine.services?.prompts?.moduleValues?.()||{},
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
        const promptDescriptors=engine.services?.prompts?.describe?.()||[];
        const promptGroups=new Map();
        for(const item of promptDescriptors){
            if(!promptGroups.has(item.category))promptGroups.set(item.category,[]);
            promptGroups.get(item.category).push(item);
        }
        const promptValue=item=>{
            if(Object.hasOwn(promptView,item.key)&&typeof promptView[item.key]==='string')return promptView[item.key];
            if(plain(promptView.modulePrompts)&&typeof promptView.modulePrompts[item.key]==='string')return promptView.modulePrompts[item.key];
            return item.value||'';
        };
        const legacyAttr=key=>({
            corePrompt:' data-core-prompt',
            macroPrompt:' data-macro-prompt',
            stabilityPromptTemplate:' data-stability-prompt',
            npcAuditPrompt:' data-npc-audit-prompt',
            structurePrompt:' data-structure-prompt'
        }[key]||'');
        const promptRows=Array.from(promptGroups).map(([category,items])=>
            '<details class="we-book" open><summary>'+text(category)+' <small>'+items.length+' 项</small></summary><div class="we-segment-list">'
            +items.map(item=>{
                const value=promptValue(item),enabled=!!String(value).trim();
                return '<details class="we-segment" data-prompt-row="'+text(item.key)+'"><summary>'+text(item.title)+' <small>'+text(item.source)+' · '+formatTokenCount(estimateTokens(value),true)+'</small></summary>'
                    +'<div class="we-prompt-meta"><b>发送条件</b><span>'+text(item.condition)+'</span><em>'+(enabled?'当前有内容':'当前留空 / 不注入')+'</em></div>'
                    +'<textarea data-prompt-key="'+text(item.key)+'"'+legacyAttr(item.key)+' '+(engine.promptEditing?'':'readonly')+'>'+text(value)+'</textarea>'
                    +'</details>';
            }).join('')+'</div></details>'
        ).join('');
        html+=section('系统提示词 · 全部',
            '<div class="we-notice">这里列出世界推进代码中所有会发送给 AI 的可编辑指令：主流程、条件提示、运行模块、历史压缩与纠错重试都在这里。留空某项表示停止注入该项文字规则；程序 Schema、变量白名单和引用校验仍固定。</div>'
            +(promptRows||empty('提示词注册表为空','请检查 WorldPromptRegistry。')),
            promptDescriptors.length+' 项已登记 · 全部可编辑');
        html+=section('程序字段 Schema · 只读','<details class="we-segment" open><summary>Canonical WorldResult JSON Schema</summary><textarea readonly>'+text(JSON.stringify(WORLD_RESULT_SCHEMA,null,2))+'</textarea></details><p class="we-muted">Schema 是程序契约，不属于可编辑提示词；修改上方所有提示词都不会改变允许写入的变量结构。</p>');
        return html;
    }
