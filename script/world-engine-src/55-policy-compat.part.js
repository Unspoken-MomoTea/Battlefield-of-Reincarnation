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
            .replace('新增宏观事件必须给出可执行的时间/条件/前因。','新增宏观事件必须给出明确时间锚点；条件按需填写。前因只能引用已存在，或本轮同时提交且成功建立的事件名称；无明确前因使用 []，不得用当前阶段或自然语言原因代替事件名。')
            .replace('因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序，使用最终3~5个仍可推进的宏观节点名称形成顺序。','因果轨道：在保留已接受宏观节点的基础上，补写 因果.宏观顺序；只使用最终3~5个仍可推进且 分类=宏观节点 的事件名称，不要写当前阶段、当前事件或近期节点。')
            .replace('且每个名称都必须对应已建立且未取消的宏观节点。','且每个名称都必须对应已建立且未取消的宏观节点；不要写当前阶段、当前事件或近期节点。'));
        if(/事件前因(?:不存在|非法自引用)/.test(messages))plan.push('事件前因：按报错中的“事件 <- 非法前因”定点修正；前因数组只放事件名称，同轮链式节点必须先建立前置节点，无明确前因写 []。');
        if(/字段未通过完整 Schema 校验/.test(messages))plan.push('Schema纠错：只修报错路径中的业务字段；真属性/最终属性/强化属于后台派生缓存，模型不得补写，这类派生差异由程序吸收。');
        return Array.from(new Set(plan.filter(Boolean)));
    };

    const makeRetryFailureBeforeConcreteReasons=makeRetryFailure;
    makeRetryFailure=function(rejected,globalError) {
        const error=makeRetryFailureBeforeConcreteReasons(rejected,globalError);
        const details=(rejected||[]).map(item=>item?.片段&&item?.原因?item.片段+'：'+item.原因:'').filter(Boolean);
        if(details.length){
            const summary=String(error.message||'WorldResult 未通过业务校验').split('\n\n具体原因\n')[0];
            error.message=summary+'\n\n具体原因\n'+details.join('\n');
        }
        return error;
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
            return NPC_BUILD_AUDIT_FEATURE_ENABLED;
        }
        isNpcBuildAuditEnabled() { return this.config.npcBuildAuditEnabled===true; }
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
        createPanel() {
            super.createPanel();
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
                block.innerHTML='<div class="we-section-head"><h2>NPC构筑审计</h2><small>备选功能 · 默认关闭</small></div>'
                    +'<div class="we-setting-row"><div class="we-setting-copy"><b>自动补全热 NPC 构筑</b><small>关闭时不扫描或补写职业、血统、装备、技能、形态；关系仍按实际剧情正常稀疏同步。开启后才对热 NPC 执行构筑缺口审计。</small></div>'
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
