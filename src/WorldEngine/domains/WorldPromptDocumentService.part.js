    class WorldPromptDocumentService {
        constructor(engine){this.engine=engine;}
        list(){
            const config=this.engine.config;
            if(!Array.isArray(config.promptDocuments))config.promptDocuments=[];
            return config.promptDocuments;
        }
        save(name,settings,activate=true){
            const engine=this.engine,clean=String(name||'').trim().slice(0,80);
            if(!clean)throw new Error('请先填写预设文档名称');
            if(clean===BUILTIN_DEFAULT_PROMPT_DOCUMENT.name)throw new Error('“默认设置”是内置文档，请换一个名称保存自定义版本');
            const docs=this.list(),now=new Date().toISOString();
            let doc=docs.find(item=>!item.builtin&&item.id===engine.config.activePromptDocumentId&&item.name===clean)||docs.find(item=>!item.builtin&&item.name===clean);
            if(doc){doc.name=clean;doc.updatedAt=now;doc.settings=copy(settings);}
            else{
                doc={id:'prompt-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:clean,createdAt:now,updatedAt:now,settings:copy(settings)};
                docs.unshift(doc);
            }
            engine.config.promptDocuments=docs.slice(0,60);
            if(activate)engine.config.activePromptDocumentId=doc.id;
            engine.saveConfig();
            return doc;
        }
        remove(id){
            const engine=this.engine;
            if(id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id)return false;
            const before=this.list().length;
            engine.config.promptDocuments=this.list().filter(doc=>doc.id!==id);
            if(engine.config.activePromptDocumentId===id)delete engine.config.activePromptDocumentId;
            engine.saveConfig();
            return before!==engine.config.promptDocuments.length;
        }
        import(raw){
            const engine=this.engine;
            let parsed;try{parsed=JSON.parse(String(raw||''));}catch(_){throw new Error('导入文件不是有效 JSON');}
            const settings=plain(parsed.settings)?parsed.settings:parsed;
            if(typeof settings.preset!=='string')throw new Error('导入文件缺少 preset');
            if(settings.preset.length>30000)throw new Error('导入预设超过30000字');
            const name=String(parsed.name||settings.name||'导入预设').trim().slice(0,80)||'导入预设';
            const normalized={
                corePrompt:typeof settings.corePrompt==='string'?settings.corePrompt:CORE_WORLD_RULES,
                macroPrompt:typeof settings.macroPrompt==='string'?settings.macroPrompt:DEFAULT_MACRO_PROMPT,
                stabilityPromptTemplate:typeof settings.stabilityPromptTemplate==='string'?settings.stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,
                npcAuditPrompt:typeof settings.npcAuditPrompt==='string'?settings.npcAuditPrompt:undefined,
                structurePrompt:typeof settings.structurePrompt==='string'?settings.structurePrompt:undefined,
                preset:normalizeEditablePreset(settings.preset),
                contextTurns:Math.max(1,Math.min(100,Number(settings.contextTurns)||6)),
                activationMode:settings.activationMode==='force_selected'?'force_selected':'respect_activation',
                selectedEntries:Array.isArray(settings.selectedEntries)?settings.selectedEntries.filter(x=>typeof x==='string'):null
            };
            if(plain(settings.promptRegistry))normalized.promptRegistry=copy(settings.promptRegistry);
            if(plain(settings.modulePrompts))normalized.modulePrompts=copy(settings.modulePrompts);
            const prepared=engine.services?.prompts?.prepareSettings?.(normalized)||normalized;
            return this.save(name,prepared,false);
        }
        export(id){
            const engine=this.engine,doc=this.list().find(item=>item.id===id);
            if(!doc)throw new Error('预设文档不存在');
            const BlobCtor=engine.host.Blob||(typeof Blob!=='undefined'?Blob:null);
            const URLApi=engine.host.URL||(typeof URL!=='undefined'?URL:null);
            if(!BlobCtor||!URLApi?.createObjectURL)throw new Error('当前环境不支持文件导出');
            const defaults={corePrompt:CORE_WORLD_RULES,macroPrompt:DEFAULT_MACRO_PROMPT,stabilityPromptTemplate:DEFAULT_STABILITY_PROMPT_TEMPLATE,npcAuditPrompt:NPC_BUILD_AUDIT_RULES,structurePrompt:protocol().split('【Canonical WorldResult JSON Schema】')[0].trim()};
            const exportedSettings=Object.assign(defaults,copy(doc.settings));
            if(engine.services?.prompts)exportedSettings.promptRegistry=engine.services.prompts.normalize(exportedSettings.promptRegistry||engine.services.prompts.values());
            const payload={type:'samsara-world-prompt-document',version:3,name:doc.name,exportedAt:new Date().toISOString(),settings:exportedSettings};
            const blob=new BlobCtor([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
            const href=URLApi.createObjectURL(blob),a=engine.host.document.createElement('a');
            a.href=href;a.download=doc.name.replace(/[\\/:*?"<>|]+/g,'_')+'.world-prompt.json';a.style.display='none';
            engine.host.document.body.appendChild(a);a.click();a.remove();
            setTimeout(()=>URLApi.revokeObjectURL(href),1000);
            return payload;
        }
    }
