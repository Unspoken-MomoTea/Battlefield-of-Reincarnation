    class WorldNpcAuditPolicyFeature {
        constructor(engine){this.engine=engine;this.validateOriginal=null;this.validateWrapped=null;this.boundPanel=null;}
        initialize(){
            const engine=this.engine,hadSetting=Object.hasOwn(engine.config,'npcBuildAuditEnabled');
            engine.config.npcBuildAuditEnabled=engine.config.npcBuildAuditEnabled===true;
            engine.isNpcBuildAuditEnabled=()=>this.isEnabled();
            engine.setNpcBuildAuditEnabled=value=>this.setEnabled(value);
            engine.isNpcAuditWorldbook=entry=>this.isAuditWorldbook(entry);
            engine.syncNpcAuditWorldbookSelection=catalogue=>this.syncSelection(catalogue);
            engine.syncNpcBuildAuditFeature=()=>this.syncFeature();
            this.syncFeature();
            if(!hadSetting)engine.saveConfig();
        }
        isEnabled(){return this.engine.config.npcBuildAuditEnabled===true;}
        isAuditWorldbook(entry){return ['实体生成规则','NPC生成规则','状态协议'].includes(normalizeWorldbookEntryTitle(entry.title));}
        syncSelection(catalogue=this.engine.bookCatalogue||[]) {
            const engine=this.engine,matches=catalogue.filter(entry=>this.isAuditWorldbook(entry));
            if(!matches.length)return;
            const sync=settings=>{
                if(!settings)return;
                const previous=settings.selectedEntries;
                let selected=Array.isArray(previous)?copy(previous):catalogue.filter(entry=>!entry.technical&&selectedEntryMatches(entry,previous)).map(entry=>JSON.stringify([entry.book,entry.id]));
                selected=selected.filter(raw=>!matches.some(entry=>selectedEntryMatches(entry,[raw])));
                if(this.isEnabled())for(const entry of matches)if(!entry.technical)selected.push(JSON.stringify([entry.book,entry.id]));
                if(JSON.stringify(previous)!==JSON.stringify(selected))settings.selectedEntries=selected;
            };
            sync(engine.config);sync(engine.promptDraft);sync(engine.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)?.settings);
        }
        syncFeature(){NPC_BUILD_AUDIT_FEATURE_ENABLED=this.isEnabled();this.syncSelection();return NPC_BUILD_AUDIT_FEATURE_ENABLED;}
        setEnabled(value){
            const engine=this.engine,wasBusy=!!engine.busy;
            if(wasBusy)engine.cancel();
            engine.config.npcBuildAuditEnabled=value===true;this.syncFeature();engine.saveConfig();
            engine.status=(this.isEnabled()?'NPC构筑审计已启用':'NPC构筑审计已关闭')+(wasBusy?' · 已停止当前推演':'');
            engine.render(true);return this.isEnabled();
        }
        async afterCatalogue(result){this.engine.bookCatalogue=result;this.syncSelection(result);this.engine.saveConfig();return result;}
        async afterBuildRequest(request){this.syncFeature();return request;}
        async aroundRun(next){
            this.syncFeature();
            const engine=this.engine,samsara=engine.host&&engine.host.Samsara,validate=samsara&&samsara.validateWorldState;
            if(typeof validate==='function'){
                this.validateOriginal=validate;
                this.validateWrapped=function(stat){
                    const checked=validate.call(samsara,stat);
                    syncWorldStateDerivedSchemaFields(stat,checked);
                    return alignWorldStateSchemaOrder(checked,stat);
                };
                samsara.validateWorldState=this.validateWrapped;
            }
            try{return await next();}
            finally{
                if(samsara&&this.validateOriginal&&samsara.validateWorldState===this.validateWrapped)samsara.validateWorldState=this.validateOriginal;
                this.validateOriginal=null;this.validateWrapped=null;
            }
        }
        compactFooterChrome(){
            const engine=this.engine,panel=engine.panel;if(!panel)return;
            const footer=panel.querySelector('footer');if(!footer)return;
            if(engine.style&&!engine.style.textContent.includes('.we-footer-status{')){
                engine.style.textContent+='\n#sam-world-engine footer{align-items:center;min-width:0;overflow:hidden}\n#sam-world-engine footer .we-footer-status{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#sam-world-engine footer .we-footer-meta{flex:0 0 auto;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}\n@media(max-width:760px){#sam-world-engine footer .we-footer-meta{max-width:42%}}\n';
            }
            let status=footer.querySelector('.we-footer-status'),meta=footer.querySelector('.we-footer-meta');
            if(!status){
                const legacyStatus=footer.querySelector('span'),legacyMeta=footer.querySelector('small');
                const rawStatus=String(legacyStatus?.textContent||engine.status||'').trim(),rawMeta=String(legacyMeta?.textContent||'').trim();
                status=engine.host.document.createElement('span');status.className='we-footer-status';status.textContent=rawStatus;status.title=rawStatus;
                meta=engine.host.document.createElement('span');meta.className='we-footer-meta';
                const version=rawMeta.match(/build\s*v?[\d.]+/i)||rawMeta.match(/\bv?\d+(?:\.\d+){1,3}\b/i);
                meta.textContent=version?version[0]:'世界推进';meta.title=rawMeta;footer.replaceChildren(status,meta);
            }else{status.title=String(status.textContent||engine.status||'').trim();if(meta&&!meta.title)meta.title=String(meta.textContent||'').trim();}
        }
        renderSetting(){
            const engine=this.engine;if(!engine.panel)return;
            const enabled=this.isEnabled(),main=engine.panel.querySelector('main');if(!main)return;
            main.querySelector('[data-npc-audit-setting]')?.remove();
            if(engine.tab==='设置'){
                const block=engine.host.document.createElement('section');
                block.className='we-section';block.setAttribute('data-npc-audit-setting','');
                block.innerHTML='<div class="we-section-head"><h2>NPC构筑审计 <span class="we-pill future">实验性功能</span></h2><small>备选功能 · 默认关闭</small></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>自动补全热 NPC 构筑</b><small>关闭时不扫描或补写职业、血统、装备、技能、形态；关系仍按实际剧情正常稀疏同步。开启后才对热 NPC 执行构筑缺口审计。实体生成规则、NPC生成规则、状态协议的资料勾选随此开关同步。</small></div>'
                    +'<div class="we-setting-actions"><button class="we-setting-btn we-switch '+(enabled?'on':'')+'" data-action="npc-audit-toggle" aria-pressed="'+enabled+'"><span>'+(enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>';
                const sections=Array.from(main.children),modelSection=sections.find(section=>section.querySelector?.('h2')?.textContent?.trim()==='模型接口');
                main.insertBefore(block,modelSection||null);
            }else if(engine.tab==='角色管理'&&!enabled){
                for(const note of main.querySelectorAll('.we-muted'))if(note.textContent.includes('进入世界推进请求的热人物会由后台优先补齐缺口'))note.textContent='自动构筑审计当前关闭；此处只显示诊断，可在“设置”中临时启用自动补全。';
            }
        }
        bindPanel(){
            const panel=this.engine.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;this.compactFooterChrome();
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="npc-audit-toggle"]');
                if(button&&panel.contains(button))this.setEnabled(!this.isEnabled());
            });
        }
        afterRender(){this.renderSetting();this.compactFooterChrome();}
        dispose(){this.boundPanel=null;}
    }
