    // 提示词工作台最终层：只暴露真正发送给世界 AI 的文字模块；程序 Schema/校验仍由代码负责。
    const WORLD_MODULE_PROMPT_VERSION=1;
    const COMPACT_DEFAULT_PRESET=`你是轮回战场的世界引擎。推进正文之外仍在运行的世界，只提交已经发生或需要规划的世界变化。
【执行流程】
1. 取事实：当前变量/已确认剧情 > 明确世界书 > 模型常识。
2. 定边界：确认当前阶段、世界时间与下一宏观节点。
3. 推世界：按可用时间推进事件、地区、人物与势力；世界不会因<user>停下而暂停。
4. 结算影响：记录<user>已经造成的客观后果，但不替<user>行动。
5. 做维护：只处理本轮需要的传播、经济、历法与台账。
6. 输出差分：只写新增/变化的 WorldResult；无业务变化只写摘要。`;
    const COMPACT_CORE_WORLD_RULES=`【核心边界】
- 事实优先级：当前变量/已确认剧情 > 明确世界书 > 常识；计划不是事实。
- 模型知道≠场外人物知道。人物只能依据在场观察、既有认知或可信传播行动；因<user>新行为改策必须有认知来源。
- 时间与路程必须可实现；同一人物同一时段只在一处；不替<user>行动，不复述已演出琐事。
- 资产只记录固定地产、大型载具或要塞；单兵物品不写资产。探索只记录<user>实际到达、调查或可靠获知的区域。
- 因果偏移只记已实现的主线级长期变化；当前事件公开字段只写现实中可感知的信息。
- 任务结算、奖励、成就、击杀等由对应系统负责。`;
    const COMPACT_MACRO_PROMPT=`【宏观骨架】
需要补骨架时保持3~5个滚动阶段节点；先定顺序与时间边界，再填近期细节。未来规划可跨边界，实际推进不可越过下一节点；不要把多个独立阶段硬并成一个节点。`;
    const COMPACT_STABILITY_PROMPT_TEMPLATE=`【世界自救 · {{阶段}}】
稳定={{稳定值}}。{{规则}}
排异必须通过世界内合理因果发生；NPC仍受自身认知与传播链限制。`;

    const WORLD_PROMPT_MODULE_DEFS=Object.freeze([
        Object.freeze({key:'task',title:'任务只读',source:'TASK_AWARENESS_RULES',legacy:()=>[TASK_AWARENESS_RULES],fallback:`【任务只读】
任务.列表只作世界因果输入；事件可用“关联任务”引用已存在任务。不得创建、删除、改状态、交付或结算任务。情报购买与扣款由MVU处理；成就、击杀、奖励、惩罚不参与世界推进。`}),
        Object.freeze({key:'chronology',title:'原著 / 数据库时间轴',source:'CHRONOLOGY_GUARD_RULES',legacy:()=>[CHRONOLOGY_GUARD_RULES],fallback:`【时间轴】
宏观排期：已确认事实 > 明确世界书/数据库日期 > 常识。明确日期必须沿用；只有已确认且记录的因果偏移可改期。资料只到月份/时段/顺序时保持同级精度。先定“当前时间→下一节点”边界再推进区间细节；3~5个节点只是滚动窗口，不合并独立阶段。`}),
        Object.freeze({key:'maintenance',title:'分级维护',source:'SOFT_MAINTENANCE_RULES',legacy:()=>[SOFT_MAINTENANCE_RULES],fallback:`【维护优先级】
Schema、非法状态、因果引用、明确日期冲突是硬错误；排期补全、传闻补齐、传播复核可跨轮维护。事件有时间、条件或前因任一即可作为锚点。纠错只改被拒片段，不重写已通过内容。`}),
        Object.freeze({key:'exploration',title:'探索台账',source:'EXPLORATION_PROJECTION_RULES',legacy:()=>[EXPLORATION_PROJECTION_RULES],fallback:`【探索台账】
<user>实际到达整体区域时探索度至少10%；远方后台地区不自动记入；离开后保留已有探索。`}),
        Object.freeze({key:'integrity',title:'因果与事实时间',source:'WORLD_INTEGRITY_GUARD_RULES',legacy:()=>[WORLD_INTEGRITY_GUARD_RULES],fallback:`【因果与事实时间】
当前事实不得落在世界时间之后；未来计划写预计结束、下次检查或待发生事件。因果偏移只记录已实现且改变关键人物命运、重大事件结果、关键势力格局或主线可行性的长期变化；计划、风险、能力上限不记。同根因优先更新同一条，普通变化不记；稳定值由程序汇总。`}),
        Object.freeze({key:'worldTime',title:'世界时间',source:'WORLD_TIME_RULES',legacy:()=>[WORLD_TIME_RULES],fallback:`【世界时间】
世界.时间由世界推进维护：为空时据已确认资料初始化；正文没有实际时间流逝就不改。精确到月日必须用数字月日（如“帝历1024年-09月-12日-下午”）；不确定则保留粗粒度，不编造。不得回退，也不得把未来事件时间当当前时间。人物/地区更新时间由程序统一盖章。`}),
        Object.freeze({key:'rumor',title:'传闻与传播',source:'RUMOR_THROTTLE_RULES / RUMOR_WORLD_SOURCE_RULES',legacy:()=>[RUMOR_LIVELINESS_RULES,RUMOR_THROTTLE_RULES,RUMOR_WORLD_SOURCE_RULES],fallback:`【信息传播】
传闻只来自“世界侧可传播事实”、已有传播链和既有公开传闻；正文不是直接传播源。私密事实必须先形成目击、公开后果、调查、公告或泄露。公开内容不得超过来源/受众认知，传播按时间与空间扩散。无触发保持原样；空分类、传播复核或新公开事实时按需更新，每个触发每类最多1条。普通行动/战斗本身不触发；传闻失败不重跑整轮。购买、扣款与消费性删除由MVU处理。`})
    ]);
    function worldModulePromptDefaults(){
        return Object.fromEntries(WORLD_PROMPT_MODULE_DEFS.map(item=>[item.key,item.fallback]));
    }
    function normalizeWorldModulePrompts(value){
        const source=plain(value)?value:{};
        const out={};
        for(const item of WORLD_PROMPT_MODULE_DEFS)out[item.key]=typeof source[item.key]==='string'?source[item.key]:item.fallback;
        return out;
    }
    function stripLegacyWorldModulePrompts(system){
        let text=String(system||'');
        for(const item of WORLD_PROMPT_MODULE_DEFS){
            for(const legacy of item.legacy()){
                const block=String(legacy||'');
                if(block)text=text.split(block).join('');
            }
        }
        return text.replace(/\n{3,}/g,'\n\n').trim();
    }
    function appendConfiguredWorldModulePrompts(system,modulePrompts){
        let text=stripLegacyWorldModulePrompts(system);
        const prompts=normalizeWorldModulePrompts(modulePrompts),used=[];
        for(const item of WORLD_PROMPT_MODULE_DEFS){
            const block=String(prompts[item.key]||'').trim();
            if(!block)continue;
            text+=(text?'\n\n':'')+block;
            used.push({key:item.key,title:item.title,source:item.source,估算Tokens:estimateTokens(block)});
        }
        return {system:text,used};
    }

    // 内置默认直接展示精简版；旧用户只在仍使用内置默认时迁移一次，自定义文档不强制覆盖。
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.corePrompt=COMPACT_CORE_WORLD_RULES;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.macroPrompt=COMPACT_MACRO_PROMPT;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.modulePrompts=worldModulePromptDefaults();
    }

    const SamsaraWorldEngineBeforeEditableModulePrompts=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeEditableModulePrompts{
        constructor(host,env){
            super(host,env);
            let dirty=false;
            const version=Number(this.config.worldModulePromptVersion)||0;
            if(version<WORLD_MODULE_PROMPT_VERSION){
                if(this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                    this.config.preset=normalizeEditablePreset(COMPACT_DEFAULT_PRESET);
                    this.config.corePrompt=COMPACT_CORE_WORLD_RULES;
                    this.config.macroPrompt=COMPACT_MACRO_PROMPT;
                    this.config.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
                    this.config.modulePrompts=worldModulePromptDefaults();
                }else this.config.modulePrompts=normalizeWorldModulePrompts(this.config.modulePrompts);
                this.config.worldModulePromptVersion=WORLD_MODULE_PROMPT_VERSION;
                dirty=true;
            }else{
                const normalized=normalizeWorldModulePrompts(this.config.modulePrompts);
                if(!same(normalized,this.config.modulePrompts)){this.config.modulePrompts=normalized;dirty=true;}
            }
            if(dirty)this.saveConfig();
        }
        readPromptEditor(){
            const settings=super.readPromptEditor();
            const prompts=normalizeWorldModulePrompts(this.config.modulePrompts);
            for(const item of WORLD_PROMPT_MODULE_DEFS){
                const field=this.panel?.querySelector?.('[data-module-prompt="'+item.key+'"]');
                if(field)prompts[item.key]=String(field.value??'');
            }
            settings.modulePrompts=prompts;
            return settings;
        }
        applyPromptSettings(settings){
            const next=Object.assign({},settings||{});
            if(next.corePrompt===undefined)next.corePrompt=COMPACT_CORE_WORLD_RULES;
            if(next.macroPrompt===undefined)next.macroPrompt=COMPACT_MACRO_PROMPT;
            if(next.stabilityPromptTemplate===undefined)next.stabilityPromptTemplate=COMPACT_STABILITY_PROMPT_TEMPLATE;
            const modules=normalizeWorldModulePrompts(next.modulePrompts);
            const result=super.applyPromptSettings(next);
            this.config.modulePrompts=modules;
            this.config.worldModulePromptVersion=WORLD_MODULE_PROMPT_VERSION;
            this.saveConfig();
            return result;
        }
        importPromptDocument(raw){
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const settings=plain(parsed?.settings)?parsed.settings:parsed;
            const importedModules=plain(settings?.modulePrompts)?normalizeWorldModulePrompts(settings.modulePrompts):worldModulePromptDefaults();
            const doc=super.importPromptDocument(raw);
            if(doc?.settings){doc.settings.modulePrompts=importedModules;this.saveConfig();}
            return doc;
        }
        async buildRequest(base){
            const request=await super.buildRequest(base);
            const rebuilt=appendConfiguredWorldModulePrompts(request.system,this.config.modulePrompts);
            request.system=rebuilt.system;
            request.manifest=request.manifest||{};
            request.manifest.提示词模块=rebuilt.used;
            request.manifest.观测=requestTokenTelemetry(request.system,request.input,request.schema||WORLD_RESULT_SCHEMA);
            return request;
        }
        mountEditableModulePrompts(){
            if(this.tab!=='提示词预设'||!this.panel)return;
            const main=this.panel.querySelector('main');if(!main)return;
            const audit=main.querySelector('[data-npc-audit-prompt]');
            if(!this.isNpcBuildAuditEnabled())audit?.closest('details')?.remove();
            let section=main.querySelector('[data-world-module-prompts]');
            if(!section){
                section=this.host.document.createElement('section');
                section.className='we-section';section.dataset.worldModulePrompts='';
                const systemSection=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='系统提示词');
                if(systemSection)systemSection.insertAdjacentElement('afterend',section);else main.appendChild(section);
            }
            const prompts=normalizeWorldModulePrompts(this.config.modulePrompts),editable=!!this.promptEditing;
            const rows=WORLD_PROMPT_MODULE_DEFS.map(item=>{
                const value=prompts[item.key]||'';
                return '<details class="we-segment"><summary>'+escape(item.title)+' · <small>'+escape(item.source)+' · '+formatTokenCount(estimateTokens(value),true)+'</small></summary>'+
                    '<textarea data-module-prompt="'+escape(item.key)+'" '+(editable?'':'readonly')+'>'+escape(value)+'</textarea></details>';
            }).join('');
            section.innerHTML='<div class="we-section-head"><h2>运行模块提示词</h2><small>实际 system 注入 · 可编辑</small></div>'+
                '<div class="we-notice">这里只显示最终会发给世界 AI 的模块规则。旧传闻活跃/节流/世界侧三层已在发送前合并为一个“传闻与传播”模块；留空某块即可停止额外注入该文字规则。程序 Schema 与写入校验不受这里修改。</div>'+rows;
        }
        render(force=false){
            const result=super.render(force);
            this.mountEditableModulePrompts();
            return result;
        }
    };
