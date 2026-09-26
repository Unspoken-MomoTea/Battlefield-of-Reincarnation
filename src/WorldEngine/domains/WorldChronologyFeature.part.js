    class WorldChronologyFeature extends WorldRequestFeature {
        initialize(){
            const engine=this.engine;
            if(!engine.config.activePromptDocumentId||engine.config.activePromptDocumentId===BUILTIN_DEFAULT_PROMPT_DOCUMENT.id){
                const upgraded=upgradeChronologyPreset(engine.config.preset);
                if(upgraded!==engine.config.preset){engine.config.preset=upgraded;engine.saveConfig();}
            }
        }
        async afterBuildRequest(request,base){
            let payload;
            try{payload=JSON.parse(request.input);}catch(_){return request;}
            const state=base?.stat||{};
            const chronologyScan=[state?.世界?.名称,'原著','时间线','时间轴','年表','校历','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' ');
            const chronologyBooks=await this.engine.worldbook(chronologyScan,{timelineBackbone:true});
            const chronologyOnly=(chronologyBooks||[]).filter(book=>isTimelineBackboneEntry(book?.名称));
            const existing=Array.isArray(payload.世界书)?payload.世界书.map(String):[],merged=existing.slice(),seen=new Set(existing);
            for(const book of chronologyOnly){
                const content=String(book?.内容||'');
                if(content&&!seen.has(content)){seen.add(content);merged.push(content);}
            }
            payload.世界书=merged;
            ACTIVE_CHRONOLOGY_GUARD={worldTime:String(state?.世界?.时间||''),books:merged.slice()};
            const next=payload?.时间线调度?.下一宏观节点||null;
            payload.时间线基准={
                当前世界时间:String(state?.世界?.时间||''),
                下一宏观节点:next?{名称:String(next.名称||''),当前排期:String(next.时间||'')}:null,
                原著时间资料:chronologyOnly.length?'已读取 '+chronologyOnly.length+' 条明确时间线/年表资料':'__PROMPT_REGISTRY_NO_EVIDENCE__',
                规划原则:{},
                要求:''
            };
            request.input=JSON.stringify(payload,null,2);
            const manifest=request.manifest||(request.manifest={});
            const rows=Array.isArray(manifest.世界书条目)?manifest.世界书条目:[];
            const rowKeys=new Set(rows.map(row=>String(row?.世界书||'')+'\u0000'+String(row?.条目ID||'')));
            for(const book of chronologyOnly){
                const key=String(book?.世界书||'')+'\u0000'+String(book?.条目ID||'');
                if(rowKeys.has(key))continue;
                rowKeys.add(key);
                rows.push({世界书:book?.世界书,条目ID:book?.条目ID,名称:book?.名称,估算Tokens:estimateTokens(book?.内容)});
            }
            manifest.世界书条目=rows;
            if(plain(manifest.世界书读取))manifest.世界书读取.实际读取=merged.length;
            manifest.原著时间轴={
                强制校准:true,
                校验模式:'明确到日的资料硬校验；月份、时段、顺序与节点粒度软引导',
                当前世界时间:String(state?.世界?.时间||''),
                时间线资料:chronologyOnly.map(book=>String(book?.名称||'')).filter(Boolean),
                下一宏观节点:next?String(next.名称||''):''
            };
            return request;
        }
    }
