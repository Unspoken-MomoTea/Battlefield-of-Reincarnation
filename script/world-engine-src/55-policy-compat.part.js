    // 可选策略层：NPC 构筑审计默认关闭；同时吸收主变量 Schema 的派生缓存，并提供可执行的事件纠错信息。
    let NPC_BUILD_AUDIT_FEATURE_ENABLED=false;
    const npcBuildAuditBeforeFeatureSwitch=npcBuildAudit;
    npcBuildAudit=function(stat,limit=NPC_BUILD_AUDIT_LIMIT) {
        if(!NPC_BUILD_AUDIT_FEATURE_ENABLED)return [];
        return npcBuildAuditBeforeFeatureSwitch(stat,limit);
    };

    const validateStateBeforeActionableEventRefs=validateState;
    validateState=function(stat) {
        const events=stat?.世界?.[PATH]?.事件||{};
        if(plain(events)){
            for(const [name,event] of Object.entries(events)){
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(events,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
        }
        return validateStateBeforeActionableEventRefs(stat);
    };

    const retryPlanBeforeActionableEventRefs=retryPlanForFailure;
    retryPlanForFailure=function(error,rejected=[]) {
        const messages=[String(error?.message||error||''),...(rejected||[]).map(item=>String(item?.原因||''))].join('\n');
        const plan=retryPlanBeforeActionableEventRefs(error,rejected).map(line=>String(line)
            .replace('且每个名称都必须对应已建立且未取消的宏观节点。','且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。'));
        if(/事件前因(?:不存在|非法自引用)/.test(messages))plan.push(worldEditablePromptText('retry.eventPredecessor','事件前因：先修复链首缺失或自引用，再重新提交受影响的后继节点。前因数组只放事件名称，且须已存在或同轮成功建立；当前阶段/自然语言原因不算事件，无明确前因写 []。不得为消除报错凭空补造事件。'));
        if(/字段未通过完整 Schema 校验/.test(messages))plan.push(worldEditablePromptText('retry.schema','Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。'));
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const makeRetryFailureBeforeConcreteReasons=makeRetryFailure;
    makeRetryFailure=function(rejected,globalError) {
        const error=makeRetryFailureBeforeConcreteReasons(rejected,globalError);
        const feedback=retryFeedback(error,rejected,error.retryPlan);
        error.retryPlan=feedback.actions;
        if(feedback.issues.length)error.message=feedback.summary+'\n\n具体原因\n'+feedback.issues.join('\n');
        return error;
    };

    // NPC 构筑审计本身已经计算了精确缺口；这里仅增强失败反馈，不改变原有通过/驳回判定。
    const ensureNpcBuildAuditProgressBeforeConcreteFeedback=ensureNpcBuildAuditProgress;
    ensureNpcBuildAuditProgress=function(next,required=[],acceptedResult) {
        try{return ensureNpcBuildAuditProgressBeforeConcreteFeedback(next,required,acceptedResult);}
        catch(error){
            if(!/NPC构筑审计未推进/.test(String(error?.message||error||'')))throw error;
            const proposals=Array.isArray(acceptedResult?.关系)?acceptedResult.关系:[];
            const details=[];
            for(const before of required||[]){
                const target=stableNameIn(next?.关系列表||{},before.名称);
                if(!target)continue;
                const after=npcBuildAssessment(next,target,next.关系列表[target]);
                if(!after)continue;
                const proposal=proposals.find(item=>nameKey(item?.名称)===nameKey(before.名称));
                const touched=proposal&&(before.建议字段||[]).some(field=>Object.hasOwn(proposal,field));
                if(touched&&after.缺口.length<before.缺口.length)continue;
                const submitted=proposal?Object.keys(proposal).filter(field=>!['名称','操作'].includes(field)):[];
                const unresolved=(after.缺口||[]).length?after.缺口:before.缺口||[];
                const suggested=(after.建议字段||before.建议字段||[]).filter(Boolean);
                details.push(
                    before.名称+'：未解决缺口：'+(unresolved.length?unresolved.join('、'):'未识别')
                    +'；建议修复字段：'+(suggested.length?suggested.join('、'):'无')
                    +'；本轮实际提交：'+(submitted.length?submitted.join('、'):'无')
                );
            }
            if(!details.length)throw error;
            throw new Error('NPC构筑审计未推进：\n'+details.map(item=>' - '+item).join('\n')+'\n修复要求：每个列出的审计对象本轮至少补齐一个真实缺口；禁止只改好感、HP或无关字段。');
        }
    };

    const WORLD_STATE_DERIVED_SCHEMA_KEYS=new Set(['真属性','最终属性','强化']);
    function syncWorldStateDerivedSchemaFields(target,checked) {
        if(Array.isArray(target)&&Array.isArray(checked)){
            const count=Math.min(target.length,checked.length);
            for(let i=0;i<count;i++)syncWorldStateDerivedSchemaFields(target[i],checked[i]);
            return;
        }
        if(!plain(target)||!plain(checked))return;
        for(const key of WORLD_STATE_DERIVED_SCHEMA_KEYS){
            if(Object.hasOwn(checked,key))target[key]=checked[key]===undefined?undefined:copy(checked[key]);
            else if(Object.hasOwn(target,key))delete target[key];
        }
        for(const key of Object.keys(checked)){
            if(WORLD_STATE_DERIVED_SCHEMA_KEYS.has(key)||!Object.hasOwn(target,key))continue;
            syncWorldStateDerivedSchemaFields(target[key],checked[key]);
        }
    }
    function alignWorldStateSchemaOrder(checked,target) {
        if(Array.isArray(checked))return checked.map((value,index)=>alignWorldStateSchemaOrder(value,Array.isArray(target)?target[index]:undefined));
        if(plain(checked)&&plain(target)){
            const out={};
            for(const key of Object.keys(target))if(Object.hasOwn(checked,key))out[key]=alignWorldStateSchemaOrder(checked[key],target[key]);
            for(const key of Object.keys(checked))if(!Object.hasOwn(out,key))out[key]=alignWorldStateSchemaOrder(checked[key],target[key]);
            return out;
        }
        return checked;
    }

    const SamsaraWorldEngineBeforeNpcAuditSwitch=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeNpcAuditSwitch {
        constructor(host,env) {
            super(host,env);
            const hadSetting=Object.hasOwn(this.config,'npcBuildAuditEnabled');
            this.config.npcBuildAuditEnabled=this.config.npcBuildAuditEnabled===true;
            this.syncNpcBuildAuditFeature();
            if(!hadSetting)this.saveConfig();
        }
        syncNpcBuildAuditFeature() {
            NPC_BUILD_AUDIT_FEATURE_ENABLED=this.config.npcBuildAuditEnabled===true;
            this.syncNpcAuditWorldbookSelection();
            return NPC_BUILD_AUDIT_FEATURE_ENABLED;
        }
        isNpcBuildAuditEnabled() { return this.config.npcBuildAuditEnabled===true; }
        isNpcAuditWorldbook(entry) {
            return ['实体生成规则','NPC生成规则','状态协议'].includes(normalizeWorldbookEntryTitle(entry.title));
        }
        syncNpcAuditWorldbookSelection(catalogue=this.bookCatalogue||[]) {
            const matches=catalogue.filter(entry=>this.isNpcAuditWorldbook(entry));
            if(!matches.length)return;
            const sync=settings=>{
                if(!settings)return;
                const previous=settings.selectedEntries;
                let selected=Array.isArray(previous)?copy(previous):catalogue.filter(entry=>!entry.technical&&selectedEntryMatches(entry,previous)).map(entry=>JSON.stringify([entry.book,entry.id]));
                selected=selected.filter(raw=>!matches.some(entry=>selectedEntryMatches(entry,[raw])));
                if(this.isNpcBuildAuditEnabled())for(const entry of matches){
                    if(!entry.technical)selected.push(JSON.stringify([entry.book,entry.id]));
                }
                if(JSON.stringify(previous)!==JSON.stringify(selected))settings.selectedEntries=selected;
            };
            sync(this.config);
            sync(this.promptDraft);
            sync(this.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)?.settings);
        }
        async catalogue() {
            const result=await super.catalogue();
            this.bookCatalogue=result;
            this.syncNpcAuditWorldbookSelection(result);
            this.saveConfig();
            return result;
        }
        applyPromptSettings(settings) {
            super.applyPromptSettings(settings);
            this.syncNpcAuditWorldbookSelection();
            this.saveConfig();
            return this.config;
        }

        setNpcBuildAuditEnabled(value) {
            const wasBusy=!!this.busy;
            if(wasBusy)this.cancel();
            this.config.npcBuildAuditEnabled=value===true;
            this.syncNpcBuildAuditFeature();
            this.saveConfig();
            this.status=(this.config.npcBuildAuditEnabled?'NPC构筑审计已启用':'NPC构筑审计已关闭')+(wasBusy?' · 已停止当前推演':'');
            this.render(true);
            return this.config.npcBuildAuditEnabled;
        }
        async buildRequest(base) {
            this.syncNpcBuildAuditFeature();
            return super.buildRequest(base);
        }
        async run() {
            this.syncNpcBuildAuditFeature();
            const samsara=this.host&&this.host.Samsara,validate=samsara&&samsara.validateWorldState;
            if(typeof validate!=='function')return super.run();
            const wrapped=function(stat){
                const checked=validate.call(samsara,stat);
                syncWorldStateDerivedSchemaFields(stat,checked);
                return alignWorldStateSchemaOrder(checked,stat);
            };
            samsara.validateWorldState=wrapped;
            try{return await super.run();}
            finally{if(samsara.validateWorldState===wrapped)samsara.validateWorldState=validate;}
        }
        compactFooterChrome() {
            if(!this.panel)return;
            const footer=this.panel.querySelector('footer');
            if(!footer)return;
            if(this.style&&!this.style.textContent.includes('.we-footer-status{')){
                this.style.textContent+='\n#sam-world-engine footer{align-items:center;min-width:0;overflow:hidden}\n'
                    +'#sam-world-engine footer .we-footer-status{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n'
                    +'#sam-world-engine footer .we-footer-meta{flex:0 0 auto;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}\n'
                    +'@media(max-width:760px){#sam-world-engine footer .we-footer-meta{max-width:42%}}\n';
            }
            let status=footer.querySelector('.we-footer-status'),meta=footer.querySelector('.we-footer-meta');
            if(!status){
                const legacyStatus=footer.querySelector('span'),legacyMeta=footer.querySelector('small');
                const rawStatus=String(legacyStatus?.textContent||this.status||'').trim();
                const rawMeta=String(legacyMeta?.textContent||'').trim();
                status=this.host.document.createElement('span');
                status.className='we-footer-status';status.textContent=rawStatus;status.title=rawStatus;
                meta=this.host.document.createElement('span');
                meta.className='we-footer-meta';
                const version=rawMeta.match(/build\s*v?[\d.]+/i)||rawMeta.match(/\bv?\d+(?:\.\d+){1,3}\b/i);
                meta.textContent=version?version[0]:'世界推进';
                meta.title=rawMeta;
                footer.replaceChildren(status,meta);
            }else{
                status.title=String(status.textContent||this.status||'').trim();
                if(meta&&!meta.title)meta.title=String(meta.textContent||'').trim();
            }
        }
        createPanel() {
            super.createPanel();
            this.compactFooterChrome();
            if(!this.panel||this.panel.__npcAuditToggleBound)return;
            Object.defineProperty(this.panel,'__npcAuditToggleBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="npc-audit-toggle"]');
                if(!button||!this.panel.contains(button))return;
                this.setNpcBuildAuditEnabled(!this.isNpcBuildAuditEnabled());
            });
        }
        render(force) {
            const result=super.render(force);
            this.renderNpcBuildAuditSetting();
            this.compactFooterChrome();
            return result;
        }
        renderNpcBuildAuditSetting() {
            if(!this.panel)return;
            const enabled=this.isNpcBuildAuditEnabled(),main=this.panel.querySelector('main');
            if(!main)return;
            const old=main.querySelector('[data-npc-audit-setting]');
            if(old)old.remove();
            if(this.tab==='设置'){
                const block=this.host.document.createElement('section');
                block.className='we-section';block.setAttribute('data-npc-audit-setting','');
                block.innerHTML='<div class="we-section-head"><h2>NPC构筑审计 <span class="we-pill future">实验性功能</span></h2><small>备选功能 · 默认关闭</small></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>自动补全热 NPC 构筑</b><small>关闭时不扫描或补写职业、血统、装备、技能、形态；关系仍按实际剧情正常稀疏同步。开启后才对热 NPC 执行构筑缺口审计。实体生成规则、NPC生成规则、状态协议的资料勾选随此开关同步。</small></div>'
                    +'<div class="we-setting-actions"><button class="we-setting-btn we-switch '+(enabled?'on':'')+'" data-action="npc-audit-toggle" aria-pressed="'+enabled+'"><span>'+(enabled?'已启用':'未启用')+'</span><span class="we-switch-track"><i></i></span></button></div></div>';
                const sections=Array.from(main.children),modelSection=sections.find(section=>section.querySelector?.('h2')?.textContent?.trim()==='模型接口');
                main.insertBefore(block,modelSection||null);
            }else if(this.tab==='角色管理'&&!enabled){
                for(const note of main.querySelectorAll('.we-muted')){
                    if(note.textContent.includes('进入世界推进请求的热人物会由后台优先补齐缺口'))note.textContent='自动构筑审计当前关闭；此处只显示诊断，可在“设置”中临时启用自动补全。';
                }
            }
        }
    };
