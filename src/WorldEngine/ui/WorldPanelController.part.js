    class WorldPanelController {
        constructor(engine){this.engine=engine;}
        createPanel() {
            const engine=this.engine;

            if (engine.panel && engine.panel.isConnected) return;
            const doc=engine.host.document;
            engine.style=doc.createElement('style');
            engine.style.textContent = worldEngineBaseStyleText();
            engine.mount=doc.createElement('div');
            engine.mount.id='sam-world-engine-host';
            engine.mount.style.setProperty('all','initial','important');
            const isolated=engine.mount.attachShadow({mode:'open'});
            isolated.appendChild(engine.style);
            engine.panel=doc.createElement('section');engine.panel.id='sam-world-engine';engine.panel.hidden=true;
            engine.panel.dataset.tone=engine.statusTone();engine.panel.dataset.fontScale=engine.config.fontScale||'standard';
            engine.panel.setAttribute('role','dialog');engine.panel.setAttribute('aria-label','世界引擎');
            engine.panel.innerHTML='<header><div class="we-brand"><i>◈</i>世界引擎<small>WORLD CHRONICLE</small></div><button class="we-btn we-primary" data-action="run">推进世界</button><button class="we-btn" data-action="close" aria-label="返回主神终端">返回 ↗</button></header><div class="we-layout"><nav></nav><main></main></div><footer><span></span><small>剧情时间驱动 · 由主神终端「世界推进」总开关控制</small></footer>';
            engine.panel.addEventListener('click',event=>{
                const button=event.target.closest('button');if(!button)return;
                const a=button.dataset.action;
                if(button.dataset.directory){engine.directoryTab=button.dataset.directory;engine.render();return;}
                if(button.dataset.area){engine.selectedArea=button.dataset.area;engine.directoryTab='探索';engine.render();return;}
                if(button.dataset.faction){if(button.hasAttribute('data-asset-owner'))engine.tab='探索与势力';engine.selectedFaction=button.dataset.faction;engine.directoryTab='势力';engine.render();return;}
                if(button.dataset.jumpPerson){engine.selectedPerson=button.dataset.jumpPerson;engine.tab='角色管理';engine.filter='全部';engine.query='';engine.selectedDate='';engine.render(true);return;}
                if(button.dataset.jumpEvent){
                    engine.jumpEvent=button.dataset.jumpEvent;engine.tab='世界推进';engine.filter='全部';engine.query='';
                    const world=engine.snapshot().stat.世界,event=world[PATH]?.事件?.[engine.jumpEvent],calendar=world.历法;
                    const date=calendarDate(event?.时间||event?.开始时间,calendar),today=calendarDate(world.时间,calendar);
                    const monthsPerYear=Array.isArray(calendar?.月份天数)&&calendar.月份天数.length?calendar.月份天数.length:12;
                    engine.selectedDate=date?.key||'';engine.calendarMode=date?'date':'undated';
                    engine.monthOffset=date&&today?(date.y-today.y)*monthsPerYear+date.m-today.m:0;
                    engine.eventLimit=Number.MAX_SAFE_INTEGER;engine.render(true);return;
                }
                if(button.dataset.person){engine.selectedPerson=button.dataset.person;engine.render();return;}
                if(a==='close')engine.close();
                else if(a==='run'){
                    if(engine.busy){if(!engine.committing){engine.cancel();engine.status='已请求停止';engine.render();}}
                    else (engine.services?.manualAdvance?.trigger?.()||engine.run()).catch(()=>{});
                }
                else if(a==='cancel'){engine.cancel();engine.status='已请求停止';engine.render();}
                else if(a==='save'){
                    const settings=engine.readPromptEditor();
                    engine.applyPromptSettings(settings);
                    engine.promptDraft=null;
                    engine.status='提示词与资料范围已保存';
                    engine.panel.querySelector('footer span').textContent=engine.status;
                }
                else if(a==='prompt-edit'){
                    engine.promptEditing=!engine.promptEditing;
                    button.textContent=engine.promptEditing?'锁定编辑':'开启编辑';button.setAttribute('aria-pressed',String(engine.promptEditing));
                    engine.panel.querySelectorAll('[data-segment-title],[data-segment],[data-structure-prompt],[data-npc-audit-prompt]').forEach(el=>el.readOnly=!engine.promptEditing);
                    engine.panel.querySelectorAll('[data-action^="segment-"]').forEach(el=>el.disabled=!engine.promptEditing);
                }
                else if(a==='save-default'){
                    const settings=engine.readPromptEditor();engine.applyPromptSettings(settings);
                    engine.config.userDefaultPromptSettings=copy(settings);
                    const docs=engine.getPromptDocuments();
                    let doc=docs.find(d=>d.id===USER_DEFAULT_PROMPT_DOCUMENT_ID);
                    const now=new Date().toISOString();
                    if(doc){doc.settings=copy(settings);doc.updatedAt=now;}
                    else docs.push({id:USER_DEFAULT_PROMPT_DOCUMENT_ID,type:'samsara-world-prompt-document',version:1,builtin:false,name:'个人默认设置',createdAt:now,updatedAt:now,settings:copy(settings)});
                    engine.config.activePromptDocumentId=USER_DEFAULT_PROMPT_DOCUMENT_ID;
                    engine.saveConfig();engine.status='已保存为个人默认设置';engine.panel.querySelector('footer span').textContent=engine.status;
                }
                else if(a==='segment-add'){
                    if(!engine.promptEditing)return;
                    const list=engine.panel.querySelector('[data-segment-list]');if(!list)return;
                    const row=engine.host.document.createElement('details');row.open=true;row.className='we-segment';row.setAttribute('data-segment-row','');
                    row.innerHTML='<summary>新分段</summary><div class="we-segment-head"><input data-segment-title aria-label="分段标题" placeholder="分段标题（可留空）"><small>新分段</small><span class="we-segment-actions"><button type="button" data-action="segment-up" title="上移">↑</button><button type="button" data-action="segment-down" title="下移">↓</button><button type="button" data-action="segment-delete" title="删除">删除</button></span></div><textarea data-segment data-title="" aria-label="新分段正文" placeholder="输入这一段的提示词正文…"></textarea>';
                    list.appendChild(row);row.querySelector('[data-segment-title]').focus();
                }
                else if(a==='segment-up'||a==='segment-down'){
                    if(!engine.promptEditing)return;
                    const row=button.closest('[data-segment-row]'),parent=row?.parentElement;if(!row||!parent)return;
                    if(a==='segment-up'&&row.previousElementSibling)parent.insertBefore(row,row.previousElementSibling);
                    if(a==='segment-down'&&row.nextElementSibling)parent.insertBefore(row.nextElementSibling,row);
                }
                else if(a==='segment-delete'){if(!engine.promptEditing)return;button.closest('[data-segment-row]')?.remove();}
                else if(a==='doc-save'){
                    try{
                        const settings=engine.readPromptEditor(),name=engine.panel.querySelector('[data-doc-name]')?.value||'';
                        engine.applyPromptSettings(settings);
                        const doc=engine.savePromptDocument(name,settings);engine.promptDraft=null;
                        engine.status='已保存预设文档：'+doc.name;engine.render(true);
                    }catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='doc-apply'){
                    const doc=engine.getPromptDocuments().find(item=>item.id===button.dataset.docId);if(!doc)return;
                    engine.applyPromptSettings(doc.settings);engine.config.activePromptDocumentId=doc.id;
                    if(doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                        engine.config.builtinDefaultWorldbookExclusionsApplied=[];
                        engine.applyBuiltinDefaultWorldbookExclusions(engine.bookCatalogue||[]);
                    }
                    engine.saveConfig();engine.promptDraft=null;
                    engine.status='已应用预设文档：'+doc.name+(Array.isArray(doc.settings?.selectedEntries)&&!(engine.bookCatalogue||[]).length?' · 世界书勾选将在加载目录后显示':'');
                    engine.render(true);
                }
                else if(a==='doc-export'){
                    try{engine.exportPromptDocument(button.dataset.docId);engine.status='预设文档已导出';engine.panel.querySelector('footer span').textContent=engine.status;}
                    catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='doc-delete'){
                    engine.promptDraft=engine.readPromptEditor();
                    const doc=engine.getPromptDocuments().find(item=>item.id===button.dataset.docId);
                    if(engine.deletePromptDocument(button.dataset.docId)){engine.status='已删除预设文档'+(doc?'：'+doc.name:'');engine.render(true);}
                }
                else if(a==='doc-import'){
                    engine.promptDraft=engine.readPromptEditor();
                    const input=engine.panel.querySelector('[data-doc-import]');if(input){input.value='';input.click();}
                }
                else if(a==='books'){
                    engine.promptDraft=engine.readPromptEditor();
                    engine.catalogue().then(list=>{engine.bookCatalogue=list;engine.render(true);}).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(a==='book-all'||a==='book-none'){engine.panel.querySelectorAll('[data-book]').forEach(e=>{e.checked=a==='book-all'&&!e.disabled;});}
                else if(a==='preview'){
                    const settings=engine.tab==='提示词预设'?engine.readPromptEditor():null;
                    if(settings)engine.applyPromptSettings(settings);
                    engine.promptDraft=null;
                    engine.buildRequest(engine.snapshot()).then(r=>{engine.previewRequest=r;engine.tab='请求检查';engine.render(true);}).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(button.dataset.fontOption){
                    const scale=button.dataset.fontOption;
                    if(WORLD_FONT_SCALES[scale]){engine.config.fontScale=scale;engine.panel.dataset.fontScale=scale;engine.saveConfig();engine.status='界面字号已切换为 '+WORLD_FONT_SCALES[scale].name;engine.render(true);}
                }
                else if(a==='world-snapshot-save'){
                    try{
                        const name=engine.panel.querySelector('[data-world-snapshot-name]')?.value||'';
                        const item=engine.services?.snapshots?.create?.(name);
                        if(!item)throw new Error('世界快照服务未初始化');
                        engine.status='已保存世界快照：'+item.name;engine.render(true);
                    }catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='world-snapshot-restore'){
                    const id=button.dataset.snapshotId||'';
                    engine.cancel();
                    Promise.resolve(engine.services?.snapshots?.restore?.(id)).then(ok=>{
                        if(ok){engine.status='世界快照已恢复';engine.render(true);}
                    }).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(a==='world-snapshot-delete'){
                    const id=button.dataset.snapshotId||'';
                    if(engine.services?.snapshots?.remove?.(id)){engine.status='世界快照已删除';engine.render(true);}
                }
                else if(a==='dedicated-toggle'){
                    engine.cancel();
                    const api=engine.normalizeDedicatedApi(engine.config.dedicatedApi);
                    api.enabled=!api.enabled;engine.config.dedicatedApi=api;
                    if(!api.enabled&&engine.isConfigured()){
                        const terminal=engine.host.Samsara&&engine.host.Samsara.terminal;
                        if(terminal&&typeof terminal.enableApi==='function')terminal.enableApi();
                    }
                    engine.saveConfig();
                    engine.status=api.enabled?'已启用世界推进专属 API · 不再使用主神终端 API':'已关闭专属 API · 回退使用主神终端 API';
                    engine.render(true);
                }
                else if(a==='dedicated-models'){
                    engine.status='正在加载专属 API 模型列表';engine.panel.querySelector('footer span').textContent=engine.status;
                    engine.fetchDedicatedModels().then(list=>{engine.status='已加载 '+list.length+' 个模型';engine.render(true);}).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;});
                }
                else if(a==='dedicated-preset-save'){
                    try{
                        const name=engine.panel.querySelector('[data-dedicated-preset-name]')?.value||'';
                        const entry=engine.saveDedicatedApiPreset(name);
                        engine.status='已保存 API 预设：'+entry.name;engine.render(true);
                    }catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                }
                else if(a==='dedicated-preset-delete'){
                    const name=engine.panel.querySelector('[data-dedicated-preset]')?.value||'';
                    if(!name){engine.status='请先选择要删除的 API 预设';engine.panel.querySelector('footer span').textContent=engine.status;}
                    else if(engine.deleteDedicatedApiPreset(name)){engine.status='已删除 API 预设：'+name;engine.render(true);}
                }
                else if(a==='month'){
                    engine.monthOffset=(engine.monthOffset||0)+Number(button.dataset.step);
                    const world=engine.snapshot().stat.世界,calendar=world.历法,today=calendarDate(world.时间,calendar);
                    if(today){
                        const custom=Array.isArray(calendar?.月份天数)?calendar.月份天数.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=99).slice(0,24):[];
                        if(custom.length){
                            let y=today.y,m=today.m+engine.monthOffset;
                            while(m<1){m+=custom.length;y--;}
                            while(m>custom.length){m-=custom.length;y++;}
                            engine.selectedDate=y+'-'+m+'-1';
                        }else{
                            const date=new Date(0);date.setFullYear(today.y,today.m-1+engine.monthOffset,1);
                            engine.selectedDate=date.getFullYear()+'-'+(date.getMonth()+1)+'-1';
                        }
                    }
                    engine.calendarMode='date';engine.eventLimit=12;engine.render();
                }
                else if(a==='date'){engine.selectedDate=button.dataset.date;engine.calendarMode='date';engine.eventLimit=12;engine.render();}
                else if(a==='clear-date'){engine.selectedDate='';engine.calendarMode='all';engine.eventLimit=12;engine.render();}
                else if(a==='today'){engine.selectedDate=undefined;engine.calendarMode='today';engine.monthOffset=0;engine.eventLimit=12;engine.render();}
                else if(a==='undated'){engine.selectedDate='';engine.calendarMode='undated';engine.eventLimit=12;engine.render();}
                else if(a==='more-events'){engine.eventLimit=(engine.eventLimit||12)+12;engine.render();}
                else if(button.dataset.filter){engine.filter=button.dataset.filter;engine.render();}
                else if(button.dataset.tab){engine.tab=button.dataset.tab;engine.filter='全部';engine.query='';engine.selectedDate=undefined;engine.calendarMode='today';engine.monthOffset=0;engine.eventLimit=12;engine.render(true);}
            });
            engine.panel.addEventListener('input',event=>{
                if(event.target.matches('[data-search]')){
                    const caret=event.target.selectionStart;engine.query=event.target.value;engine.render();
                    const input=engine.panel.querySelector('[data-search]');input.focus();input.setSelectionRange(caret,caret);
                }else if(event.target.matches('[data-segment-title]')){
                    const row=event.target.closest('[data-segment-row]'),body=row?.querySelector('[data-segment]');
                    if(body)body.dataset.title=cleanSegmentTitle(event.target.value);
                }
            });
            engine.panel.addEventListener('change',event=>{
                if(event.target.matches('[data-retries]')){
                    const value=Math.max(1,Math.min(5,Number(event.target.value)||1));
                    engine.config.retryAttempts=value;event.target.value=value;engine.saveConfig();
                    engine.status='每个模型最大尝试次数已设为 '+value+' 次';
                    engine.panel.querySelector('footer span').textContent=engine.status;
                }else if(event.target.matches('[data-world-temperature]')){
                    const value=Math.max(0,Math.min(2,Number(event.target.value)||0));
                    engine.config.temperature=value;event.target.value=String(value);engine.saveConfig();
                    engine.status='世界推演温度已设为 '+value;engine.panel.querySelector('footer span').textContent=engine.status;
                }else if(event.target.matches('[data-fallback-model]')){
                    engine.config.fallbackModel=String(event.target.value||'').trim().slice(0,160);engine.saveConfig();
                    engine.status=engine.config.fallbackModel?'Fallback 模型已保存：'+engine.config.fallbackModel:'Fallback 模型已关闭';
                    engine.panel.querySelector('footer span').textContent=engine.status;
                }else if(event.target.matches('[data-doc-import]')){
                    const input=event.target,file=input.files&&input.files[0];if(!file)return;
                    Promise.resolve(file.text()).then(raw=>{
                        const doc=engine.importPromptDocument(raw);
                        engine.status='已导入预设文档：'+doc.name;engine.render(true);
                    }).catch(e=>{engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}).finally(()=>{input.value='';});
                }
                else if(event.target.matches('[data-dedicated-field]')){
                    const field=event.target.dataset.dedicatedField,value=event.target.value||'';
                    if(['apiUrl','apiKey','model'].includes(field)){
                        engine.setDedicatedApi({[field]:value});
                        engine.status='专属 API 配置已保存';engine.panel.querySelector('footer span').textContent=engine.status;
                    }
                }
                else if(event.target.matches('[data-dedicated-preset]')){
                    const name=event.target.value||'';
                    if(name){
                        try{engine.applyDedicatedApiPreset(name);engine.status='已应用 API 预设：'+name;engine.render(true);}
                        catch(e){engine.status=e.message;engine.panel.querySelector('footer span').textContent=engine.status;}
                    }
                }
            });
            isolated.appendChild(engine.panel);
            doc.body.appendChild(engine.mount);
                }
    }
