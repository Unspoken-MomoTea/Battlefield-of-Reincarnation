    // 最终提示词层：把所有实际发送给 AI 的可变文字收口到统一注册表和提示词预设。
    const WORLD_ALL_PROMPT_VERSION=1;
    if(plain(BUILTIN_DEFAULT_PROMPT_DOCUMENT?.settings)){
        BUILTIN_DEFAULT_PROMPT_DOCUMENT.settings.requestPrompts=worldEditablePromptDefaults();
    }

    const SamsaraWorldEngineBeforeAllEditablePrompts=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeAllEditablePrompts {
        constructor(host,env){
            super(host,env);
            ACTIVE_WORLD_PROMPT_SERVICE=this.services?.prompts||null;
            let dirty=false;
            const normalized=this.services.prompts.normalize(this.config.requestPrompts);
            if(!same(normalized,this.config.requestPrompts)){this.config.requestPrompts=normalized;dirty=true;}
            if(Number(this.config.worldAllPromptVersion||0)<WORLD_ALL_PROMPT_VERSION){
                if(this.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)this.config.requestPrompts=worldEditablePromptDefaults();
                this.config.worldAllPromptVersion=WORLD_ALL_PROMPT_VERSION;dirty=true;
            }
            if(dirty)this.saveConfig();
        }
        promptCatalog(){
            const rows=[
                {key:'main.preset',category:'主工作流',title:'分段提示词',value:String(this.config.preset||'')},
                {key:'system.core',category:'主 system',title:'世界引擎核心约束',value:String(this.config.corePrompt??CORE_WORLD_RULES)},
                {key:'system.macro',category:'主 system',title:'宏观骨架',value:String(this.config.macroPrompt??DEFAULT_MACRO_PROMPT)},
                {key:'system.stability',category:'主 system',title:'世界自救模板',value:String(this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE)},
                {key:'system.npcAudit',category:'主 system',title:'NPC构筑审计',value:String(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES)},
                {key:'system.structure',category:'主 system',title:'WorldResult 协议说明',value:String(this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())}
            ];
            if(typeof WORLD_PROMPT_MODULE_DEFS!=='undefined'){
                const modules=normalizeWorldModulePrompts(this.config.modulePrompts);
                for(const item of WORLD_PROMPT_MODULE_DEFS)rows.push({key:'module.'+item.key,category:'运行模块 system',title:item.title,value:String(modules[item.key]||'')});
            }
            rows.push(...this.services.prompts.catalog());
            return rows;
        }
        applyPromptTextSettings(value){
            this.config.requestPrompts=this.services.prompts.setAll(value);
            this.config.worldAllPromptVersion=WORLD_ALL_PROMPT_VERSION;
            ACTIVE_WORLD_PROMPT_SERVICE=this.services.prompts;
            this.saveConfig();
            return copy(this.config.requestPrompts);
        }
        readPromptEditor(){
            const settings=super.readPromptEditor(),values=this.services.prompts.values();
            this.panel?.querySelectorAll?.('[data-request-prompt]')?.forEach?.(field=>{
                values[String(field.dataset.requestPrompt||'')]=String(field.value??'');
            });
            settings.requestPrompts=this.services.prompts.normalize(values);
            return settings;
        }
        applyPromptSettings(settings){
            const next=Object.assign({},settings||{});
            const requestPrompts=this.services.prompts.normalize(next.requestPrompts??this.config.requestPrompts);
            const result=super.applyPromptSettings(next);
            this.applyPromptTextSettings(requestPrompts);
            return result;
        }
        savePromptDocument(name,settings,activate=true){
            const next=Object.assign({},settings||{});
            next.requestPrompts=this.services.prompts.normalize(next.requestPrompts??this.config.requestPrompts);
            return super.savePromptDocument(name,next,activate);
        }
        importPromptDocument(raw){
            let parsed=null;try{parsed=JSON.parse(String(raw||''));}catch(_){}
            const source=plain(parsed?.settings)?parsed.settings:parsed;
            const imported=this.services.prompts.normalize(source?.requestPrompts);
            const doc=super.importPromptDocument(raw);
            if(doc?.settings){doc.settings.requestPrompts=imported;this.saveConfig();}
            return doc;
        }
        async buildRequest(base){
            ACTIVE_WORLD_PROMPT_SERVICE=this.services.prompts;
            const request=await super.buildRequest(base);
            return this.services.requests.finalize(request,base);
        }
        async requestHistoryMemorySummary(world,batch,outputLevel){
            return this.services.history.requestSummary(world,batch,outputLevel);
        }
        mountAllEditablePrompts(){
            if(this.tab!=='提示词预设'||!this.panel)return;
            const main=this.panel.querySelector('main');if(!main)return;
            let block=main.querySelector('[data-all-request-prompts]');
            if(!block){
                block=this.host.document.createElement('section');
                block.className='we-section';block.dataset.allRequestPrompts='';
                const modules=main.querySelector('[data-world-module-prompts]');
                if(modules)modules.insertAdjacentElement('afterend',block);else main.appendChild(block);
            }
            const grouped=new Map();
            for(const item of this.services.prompts.catalog()){
                if(!grouped.has(item.category))grouped.set(item.category,[]);
                grouped.get(item.category).push(item);
            }
            const editable=!!this.promptEditing;
            block.innerHTML='<div class="we-section-head"><h2>请求 / 重试 / 历史提示词</h2><small>实际发送文字 · 全部可编辑</small></div>'
                +'<div class="we-notice">这里收口以前散落在 buildRequest、时间轴、传闻、世界活动、纠错重试和历史压缩代码里的指令文字。程序 Schema、枚举、字段路径与校验器仍由代码固定。</div>'
                +Array.from(grouped).map(([category,items])=>'<details class="we-book" open><summary>'+escape(category)+' <small>'+items.length+' 项</small></summary><div class="we-segment-list">'
                    +items.map(item=>'<details class="we-segment"><summary>'+escape(item.title)+' <small>'+escape(item.key)+' · '+formatTokenCount(estimateTokens(item.value),true)+'</small></summary><textarea data-request-prompt="'+escape(item.key)+'" '+(editable?'':'readonly')+'>'+escape(item.value)+'</textarea></details>').join('')
                    +'</div></details>').join('');
        }
        render(force=false){
            const result=super.render(force);
            this.mountAllEditablePrompts();
            return result;
        }
    };
