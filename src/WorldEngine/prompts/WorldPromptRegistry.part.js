    class WorldPromptRegistry {
        constructor(engine){
            this.engine=engine;
            this._definitions=Object.freeze([
                Object.freeze({key:'preset',title:'执行流程 / 主预设',group:'主流程',source:'COMPACT_DEFAULT_PRESET / config.preset',native:true,defaultValue:()=>typeof COMPACT_DEFAULT_PRESET==='string'?COMPACT_DEFAULT_PRESET:DEFAULT_PRESET}),
                Object.freeze({key:'core',title:'世界引擎核心约束',group:'主流程',source:'CORE_WORLD_RULES',native:true,defaultValue:()=>typeof COMPACT_CORE_WORLD_RULES==='string'?COMPACT_CORE_WORLD_RULES:CORE_WORLD_RULES}),
                Object.freeze({key:'macro',title:'宏观骨架',group:'主流程',source:'DEFAULT_MACRO_PROMPT',native:true,defaultValue:()=>typeof COMPACT_MACRO_PROMPT==='string'?COMPACT_MACRO_PROMPT:DEFAULT_MACRO_PROMPT}),
                Object.freeze({key:'stability',title:'世界自救',group:'主流程',source:'DEFAULT_STABILITY_PROMPT_TEMPLATE',native:true,defaultValue:()=>typeof COMPACT_STABILITY_PROMPT_TEMPLATE==='string'?COMPACT_STABILITY_PROMPT_TEMPLATE:DEFAULT_STABILITY_PROMPT_TEMPLATE}),
                Object.freeze({key:'npcAudit',title:'NPC构筑审计',group:'主流程',source:'NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT',native:true,defaultValue:()=>typeof NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT==='string'?NPC_BUILD_AUDIT_RULES_NARRATIVE_WEIGHT:NPC_BUILD_AUDIT_RULES}),
                Object.freeze({key:'outputProtocol',title:'WorldResult 输出协议说明',group:'主流程',source:'protocol()',native:true,defaultValue:()=>protocol().split('【Canonical WorldResult JSON Schema】')[0].trim()}),
                Object.freeze({key:'task',title:'任务只读',group:'运行模块',source:'TASK_AWARENESS_RULES',defaultValue:()=>typeof TASK_AWARENESS_RULES==='string'?TASK_AWARENESS_RULES:''}),
                Object.freeze({key:'chronology',title:'原著 / 数据库时间轴',group:'运行模块',source:'CHRONOLOGY_GUARD_RULES',defaultValue:()=>typeof CHRONOLOGY_GUARD_RULES==='string'?CHRONOLOGY_GUARD_RULES:''}),
                Object.freeze({key:'maintenance',title:'分级维护',group:'运行模块',source:'SOFT_MAINTENANCE_RULES',defaultValue:()=>typeof SOFT_MAINTENANCE_RULES==='string'?SOFT_MAINTENANCE_RULES:''}),
                Object.freeze({key:'exploration',title:'探索台账',group:'运行模块',source:'EXPLORATION_PROJECTION_RULES',defaultValue:()=>typeof EXPLORATION_PROJECTION_RULES==='string'?EXPLORATION_PROJECTION_RULES:''}),
                Object.freeze({key:'integrity',title:'因果与事实时间',group:'运行模块',source:'WORLD_INTEGRITY_GUARD_RULES',defaultValue:()=>typeof WORLD_INTEGRITY_GUARD_RULES==='string'?WORLD_INTEGRITY_GUARD_RULES:''}),
                Object.freeze({key:'worldTime',title:'世界时间所有权',group:'运行模块',source:'WORLD_TIME_RULES',defaultValue:()=>typeof WORLD_TIME_RULES==='string'?WORLD_TIME_RULES:''}),
                Object.freeze({key:'rumorLiveliness',title:'传闻活跃性',group:'传闻与传播',source:'RUMOR_LIVELINESS_RULES',defaultValue:()=>typeof worldModulePromptDefaults==='function'?String(worldModulePromptDefaults().rumorLiveliness||''):''}),
                Object.freeze({key:'rumorThrottle',title:'传闻刷新节流',group:'传闻与传播',source:'RUMOR_THROTTLE_RULES',defaultValue:()=>typeof worldModulePromptDefaults==='function'?String(worldModulePromptDefaults().rumorThrottle||''):''}),
                Object.freeze({key:'rumorSource',title:'传闻世界侧来源',group:'传闻与传播',source:'RUMOR_WORLD_SOURCE_RULES',defaultValue:()=>typeof worldModulePromptDefaults==='function'?String(worldModulePromptDefaults().rumorSource||''):''}),
                Object.freeze({key:'worldActivity',title:'世界活动交付',group:'运行模块',source:'WORLD_ACTIVITY_DELIVERY_RULES',defaultValue:()=>typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:''}),
                Object.freeze({key:'historyMemory',title:'世界长期历史压缩',group:'辅助模型',source:'HISTORY_MEMORY_SYSTEM',defaultValue:()=>typeof HISTORY_MEMORY_SYSTEM==='string'?HISTORY_MEMORY_SYSTEM:''})
            ]);
        }
        definitions(){return this._definitions.slice();}
        defaults(){return Object.fromEntries(this._definitions.map(item=>[item.key,String(item.defaultValue?.()??'')]));}
        legacyValues(){
            const config=this.engine.config||{},modules=plain(config.modulePrompts)?config.modulePrompts:{},fallback=this.defaults();
            return {
                preset:String(config.preset??fallback.preset),
                core:String(config.corePrompt??fallback.core),
                macro:String(config.macroPrompt??fallback.macro),
                stability:String(config.stabilityPromptTemplate??fallback.stability),
                npcAudit:String(config.npcAuditPrompt??fallback.npcAudit),
                outputProtocol:String(config.structurePrompt??fallback.outputProtocol),
                task:String(modules.task??fallback.task),
                chronology:String(modules.chronology??fallback.chronology),
                maintenance:String(modules.maintenance??fallback.maintenance),
                exploration:String(modules.exploration??fallback.exploration),
                integrity:String(modules.integrity??fallback.integrity),
                worldTime:String(modules.worldTime??fallback.worldTime),
                rumorLiveliness:String(modules.rumorLiveliness??(typeof modules.rumor==='string'?'':fallback.rumorLiveliness)),
                rumorThrottle:String(modules.rumorThrottle??(typeof modules.rumor==='string'?'':fallback.rumorThrottle)),
                rumorSource:String(modules.rumorSource??modules.rumor??fallback.rumorSource),
                worldActivity:String(config.promptRegistry?.worldActivity??fallback.worldActivity),
                historyMemory:String(config.promptRegistry?.historyMemory??fallback.historyMemory)
            };
        }
        normalize(value){
            const fallback=this.legacyValues(),source=plain(value)?value:{},out={};
            for(const item of this._definitions){
                const raw=Object.hasOwn(source,item.key)?source[item.key]:fallback[item.key];
                out[item.key]=typeof raw==='string'?raw:String(raw??'');
            }
            return out;
        }
        initialize(){
            const normalized=this.normalize(this.engine.config?.promptRegistry);
            this.engine.config.promptRegistry=normalized;
            this.syncLegacy(normalized);
            return normalized;
        }
        syncLegacy(values){
            const config=this.engine.config||(this.engine.config={});
            const source=values===undefined?this.absorbLegacyOverrides():values;
            const v=this.normalize(source);
            config.preset=normalizeEditablePreset(v.preset);
            config.corePrompt=v.core;
            config.macroPrompt=v.macro;
            config.stabilityPromptTemplate=v.stability;
            config.npcAuditPrompt=v.npcAudit;
            config.structurePrompt=v.outputProtocol;
            config.modulePrompts=Object.assign({},plain(config.modulePrompts)?config.modulePrompts:{},{
                task:v.task,chronology:v.chronology,maintenance:v.maintenance,exploration:v.exploration,
                integrity:v.integrity,worldTime:v.worldTime,
                rumorLiveliness:v.rumorLiveliness,rumorThrottle:v.rumorThrottle,rumorSource:v.rumorSource,
                rumor:v.rumorSource
            });
            config.promptRegistry=v;
            return v;
        }
        values(){return this.normalize(this.engine.config?.promptRegistry);}
        absorbLegacyOverrides(){
            const config=this.engine.config||{},current=this.values(),next={...current};
            const native=[
                ['preset','preset'],['core','corePrompt'],['macro','macroPrompt'],
                ['stability','stabilityPromptTemplate'],['npcAudit','npcAuditPrompt'],['outputProtocol','structurePrompt']
            ];
            for(const [key,legacyKey] of native){
                if(typeof config[legacyKey]==='string'&&config[legacyKey]!==current[key])next[key]=config[legacyKey];
            }
            const modules=plain(config.modulePrompts)?config.modulePrompts:{};
            for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumorLiveliness','rumorThrottle','rumorSource']){
                if(typeof modules[key]==='string'&&modules[key]!==current[key])next[key]=modules[key];
            }
            if(typeof modules.rumor==='string'&&!Object.hasOwn(modules,'rumorSource')&&modules.rumor!==current.rumorSource)next.rumorSource=modules.rumor;
            config.promptRegistry=this.normalize(next);
            return config.promptRegistry;
        }
        value(key){return this.values()[key]??'';}
        list(){const values=this.values();return this._definitions.map(item=>({...item,value:values[item.key]??''}));}
        apply(value,{save=true}={}){
            const normalized=this.normalize(value);
            for(const item of this._definitions){
                if(normalized[item.key].length>30000)throw new Error(item.title+'限30000字');
            }
            this.syncLegacy(normalized);
            if(save)this.engine.saveConfig?.();
            return normalized;
        }
        prepareSettings(settings){
            const input=plain(settings)?copy(settings):{},registry=this.normalize(input.promptRegistry??this.engine.config?.promptRegistry);
            if(typeof input.preset==='string')registry.preset=input.preset;
            if(typeof input.corePrompt==='string')registry.core=input.corePrompt;
            if(typeof input.macroPrompt==='string')registry.macro=input.macroPrompt;
            if(typeof input.stabilityPromptTemplate==='string')registry.stability=input.stabilityPromptTemplate;
            if(typeof input.npcAuditPrompt==='string')registry.npcAudit=input.npcAuditPrompt;
            if(typeof input.structurePrompt==='string')registry.outputProtocol=input.structurePrompt;
            if(plain(input.modulePrompts)){
                for(const key of ['task','chronology','maintenance','exploration','integrity','worldTime','rumorLiveliness','rumorThrottle','rumorSource'])if(typeof input.modulePrompts[key]==='string')registry[key]=input.modulePrompts[key];
                if(typeof input.modulePrompts.rumor==='string'&&!Object.hasOwn(input.modulePrompts,'rumorSource'))registry.rumorSource=input.modulePrompts.rumor;
            }
            input.promptRegistry=registry;
            input.preset=registry.preset;
            input.corePrompt=registry.core;
            input.macroPrompt=registry.macro;
            input.stabilityPromptTemplate=registry.stability;
            input.npcAuditPrompt=registry.npcAudit;
            input.structurePrompt=registry.outputProtocol;
            input.modulePrompts=Object.assign({},plain(input.modulePrompts)?input.modulePrompts:{},{
                task:registry.task,chronology:registry.chronology,maintenance:registry.maintenance,
                exploration:registry.exploration,integrity:registry.integrity,worldTime:registry.worldTime,rumor:registry.rumor
            });
            return input;
        }
        rewriteSystem(system){
            let output=String(system||''),activityDefault=typeof WORLD_ACTIVITY_DELIVERY_RULES==='string'?WORLD_ACTIVITY_DELIVERY_RULES:'';
            if(activityDefault){
                const replacement=this.value('worldActivity').trim();
                output=output.split(activityDefault).join(replacement);
            }
            return output.replace(/\n{3,}/g,'\n\n').trim();
        }
        headings(value){
            const out=[],source=String(value||''),re=/【([^】]+)】/g;let match;
            while((match=re.exec(source)))out.push(match[1]);
            return out;
        }
        headingMatches(pattern,title){
            if(pattern===title)return true;
            if(!pattern.includes('{{'))return false;
            const parts=pattern.split(/\{\{[^}]+\}\}/g).map(part=>part.replace(/[.*+?^$()|[\]\\]/g,'\\        historySystem(){return this.value('historyMemory');}
'));
            try{return new RegExp('^'+parts.join('.+?')+'    }
).test(title);}catch(_){return false;}
        }
        auditSystem(system){
            const values=this.list().filter(item=>item.key!=='historyMemory'&&String(item.value||'').trim());
            const patterns=values.flatMap(item=>this.headings(item.value));
            const actual=this.headings(system);
            const unregistered=actual.filter(title=>!patterns.some(pattern=>this.headingMatches(pattern,title)));
            const source=String(system||''),firstHeader=source.indexOf('【'),prefix=(firstHeader<0?source:source.slice(0,firstHeader)).trim();
            if(prefix){
                const known=values.some(item=>{
                    const value=String(item.value||'').trim(),header=value.indexOf('【');
                    return (header<0?value:value.slice(0,header)).trim()===prefix;
                });
                if(!known)unregistered.unshift('(无标题前缀)');
            }
            return {registered:actual.filter(title=>!unregistered.includes(title)),unregistered:Array.from(new Set(unregistered))};
        }
        historySystem(){return this.value('historyMemory');}
    }
