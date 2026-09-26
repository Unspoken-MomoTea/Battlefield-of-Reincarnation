    class WorldTaskAwarenessFeature extends WorldRequestFeature {
        restoreWorldbookSelection(catalogue){
            const engine=this.engine;
            if(engine.config.activePromptDocumentId!==BUILTIN_DEFAULT_PROMPT_DOCUMENT.id||!Array.isArray(catalogue))return false;
            const matches=catalogue.filter(entry=>normalizeWorldbookEntryTitle(entry.title)===TASK_WORLD_BOOK_TITLE&&!entry.technical);
            let changed=false;
            if(matches.length){
                const selected=Array.isArray(engine.config.selectedEntries)?copy(engine.config.selectedEntries):[];
                for(const entry of matches){
                    const raw=JSON.stringify([entry.book,entry.id]);
                    if(!selected.includes(raw)){selected.push(raw);changed=true;}
                }
                engine.config.selectedEntries=selected;
            }
            const applied=Array.isArray(engine.config.builtinDefaultWorldbookExclusionsApplied)?engine.config.builtinDefaultWorldbookExclusionsApplied:[];
            const cleaned=applied.filter(title=>title!==TASK_WORLD_BOOK_TITLE);
            if(cleaned.length!==applied.length){engine.config.builtinDefaultWorldbookExclusionsApplied=cleaned;changed=true;}
            if(changed){
                const builtin=engine.getPromptDocuments().find(doc=>doc.id===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id);
                if(builtin?.settings)builtin.settings.selectedEntries=copy(engine.config.selectedEntries||[]);
                engine.saveConfig();
            }
            return changed;
        }
        async afterCatalogue(catalogue){
            this.restoreWorldbookSelection(catalogue);
            return catalogue;
        }
        async afterBuildRequest(request,_base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            request.manifest=Object.assign({},request.manifest,{
                任务感知:{任务数量:Object.keys(payload?.当前变量?.任务?.列表||{}).length,只读:true,副本成就:false}
            });
            return request;
        }
    }
