    class WorldNpcAuditPolicy {
        constructor(engine){this.engine=engine;this.boundPanel=null;}
        initialize(){
            const e=this.engine,had=Object.hasOwn(e.config,'npcBuildAuditEnabled');
            e.config.npcBuildAuditEnabled=e.config.npcBuildAuditEnabled===true;
            this.sync();if(!had)e.saveConfig();
        }
        sync(){
            const e=this.engine;
            NPC_BUILD_AUDIT_FEATURE_ENABLED=e.config.npcBuildAuditEnabled===true;
            this.syncWorldbookSelection();
            return NPC_BUILD_AUDIT_FEATURE_ENABLED;
        }
        enabled(){return this.engine.config.npcBuildAuditEnabled===true;}
        isWorldbook(entry){return ['实体生成规则','NPC生成规则','状态协议'].includes(normalizeWorldbookEntryTitle(entry.title));}
        syncWorldbookSelection(catalogue=this.engine.bookCatalogue||[]){
            const e=this.engine,matches=catalogue.filter(entry=>this.isWorldbook(entry));if(!matches.length)return;
            const sync=settings=>{
                if(!settings)return;
                const previous=settings.selectedEntries;
                let selected=Array.isArray(previous)?copy(previous):catalogue.filter(entry=>!entry.technical&&selectedEntryMatches(entry,previous)).map(entry=>JSON.stringify([entry.book,entry.id]));
                selected=selected.filter(raw=>!matches.some(entry=>selectedEntryMatches(entry,[raw])));
                if(this.enabled())for(const entry of matches)if(!entry.technical)selected.push(JSON.stringify([entry.book,entry.id]));
                if(JSON.stringify(previous)!==JSON.stringify(selected))settings.selectedEntries=selected;
            };
            sync(e.config);sync(e.promptDraft);sync(e.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)?.settings);
        }
        async afterCatalogue(result){
            const e=this.engine;e.bookCatalogue=result;this.syncWorldbookSelection(result);e.saveConfig();return result;
        }
        afterPromptSettings(){this.syncWorldbookSelection();this.engine.saveConfig();}
        setEnabled(value){
            const e=this.engine,wasBusy=!!e.busy;if(wasBusy)e.cancel();
            e.config.npcBuildAuditEnabled=value===true;this.sync();e.saveConfig();
            e.status=(e.config.npcBuildAuditEnabled?'NPC构筑审计已启用':'NPC构筑审计已关闭')+(wasBusy?' · 已停止当前推演':'');
            e.render(true);return e.config.npcBuildAuditEnabled;
        }
        async afterBuildRequest(request){this.sync();return request;}
        async aroundRun(next){
            const e=this.engine;this.sync();
            const samsara=e.host&&e.host.Samsara,validate=samsara&&samsara.validateWorldState;
            if(typeof validate!=='function')return next();
            const wrapped=function(stat){
                const checked=validate.call(samsara,stat);
                syncWorldStateDerivedSchemaFields(stat,checked);
                return alignWorldStateSchemaOrder(checked,stat);
            };
            samsara.validateWorldState=wrapped;
            try{return await next();}
            finally{if(samsara.validateWorldState===wrapped)samsara.validateWorldState=validate;}
        }
        compactFooter(){
            const e=this.engine;if(!e.panel)return;
            const footer=e.panel.querySelector('footer');if(!footer)return;
            if(e.style&&!e.style.textContent.includes('.we-footer-status{')){
                e.style.textContent+='\n#sam-world-engine footer{align-items:center;min-width:0;overflow:hidden}\n'
                    +'#sam-world-engine footer .we-footer-status{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n'
                    +'#sam-world-engine footer .we-footer-meta{flex:0 0 auto;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}\n'
                    +'@media(max-width:760px){#sam-world-engine footer .we-footer-meta{max-width:42%}}\n';
            }
            let status=footer.querySelector('.we-footer-status'),meta=footer.querySelector('.we-footer-meta');
            if(!status){
                const legacyStatus=footer.querySelector('span'),legacyMeta=footer.querySelector('small');
                const rawStatus=String(legacyStatus?.textContent||e.status||'').trim(),rawMeta=String(legacyMeta?.textContent||'').trim();
                status=e.host.document.createElement('span');status.className='we-footer-status';status.textContent=rawStatus;status.title=rawStatus;
                meta=e.host.document.createElement('span');meta.className='we-footer-meta';
                const version=rawMeta.match(/build\s*v?[\d.]+/i)||rawMeta.match(/\bv?\d+(?:\.\d+){1,3}\b/i);
                meta.textContent=version?version[0]:'世界推进';meta.title=rawMeta;footer.replaceChildren(status,meta);
            }else{
                status.title=String(status.textContent||e.status||'').trim();
                if(meta&&!meta.title)meta.title=String(meta.textContent||'').trim();
            }
        }
        renderSetting(){
            const e=this.engine;if(!e.panel)return;
            const enabled=this.enabled(),main=e.panel.querySelector('main');if(!main)return;
            main.querySelector('[data-npc-audit-setting]')?.remove();
            if(e.tab==='设置'){
                const block=e.host.document.createElement('section');block.className='we-section';block.setAttribute('data-npc-audit-setting','');
                block.innerHTML='<div class="we-section-head"><h2>NPC构筑审计 <span class="we-pill future">实验性功能</span></h2><small>备选功能 · 默认关闭</small></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>自动补全热 NPC 构筑</b><small>关闭时不扫描或补写职业、血统、装备、技能、形态；关系仍按实际剧情正常稀疏同步。开启后才对热 NPC 执行构筑缺口审计。实体生成规则、NPC生成规则、状态协议的资料勾选随此开关同步。</small></div>'
                    +'<div class="we-setting-actions"><button class="we-setting-btn we-switch '+(enabled?'on':'')+'" data-action="npc-audit-toggle" aria-pressed="'+enabled+'"><span>'+(enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>';
                const sections=Array.from(main.children),modelSection=sections.find(section=>section.querySelector?.('h2')?.textContent?.trim()==='模型接口');
                main.insertBefore(block,modelSection||null);
            }else if(e.tab==='角色管理'&&!enabled){
                for(const note of main.querySelectorAll('.we-muted'))if(note.textContent.includes('进入世界推进请求的热人物会由后台优先补齐缺口'))note.textContent='自动构筑审计当前关闭；此处只显示诊断，可在“设置”中临时启用自动补全。';
            }
        }
        bindPanel(){
            const e=this.engine,panel=e.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;this.compactFooter();
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="npc-audit-toggle"]');
                if(!button||!panel.contains(button))return;
                this.setEnabled(!this.enabled());
            });
        }
        afterRender(){this.renderSetting();this.compactFooter();}
        dispose(){this.boundPanel=null;}
    }
