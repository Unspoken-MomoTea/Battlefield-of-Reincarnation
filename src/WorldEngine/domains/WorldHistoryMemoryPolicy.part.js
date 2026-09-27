    // 世界长期历史记忆：每次推进写 L0 叶子，旧叶子逐层压缩；正文读取由独立设置控制。
    const HISTORY_MEMORY_L0_BATCH=12;
    const HISTORY_MEMORY_L0_KEEP=6;
    const HISTORY_MEMORY_L1_BATCH=6;
    const HISTORY_MEMORY_HIGHER_BATCH=3;
    const HISTORY_MEMORY_LEGACY_RAW_CONTEXT=24;
    const HISTORY_MEMORY_LEAF_PREFIX='推进·';
    const HISTORY_MEMORY_SCHEMA={
        type:'object',additionalProperties:false,required:['摘要'],
        properties:{摘要:{type:'string',minLength:1}}
    };
    const HISTORY_MEMORY_SYSTEM=`【世界长期历史压缩】
只总结已确认历史事实。你收到的是按真实先后顺序排列的既有历史节点；任务是把它们融合成一条更高层的世界史记忆，不是续写剧情。
必须保留：时间顺序、主要参与者、原因、关键转折、最终结果，以及仍会影响后续局势的长期后果与重要因果偏移。
可以删除：重复描述、已经失去后续意义的过程细节、UI/调试信息。
禁止：补写未发生剧情、猜测隐藏真相、修改既有结局、制造输入中不存在的日期/人物/关系、把历史事实写成未来计划。
如果输入时间粒度不完整，就保持原有粒度，不自行补全。
只输出 JSON：{"摘要":"..."}`;

    class WorldHistoryMemoryPolicy {
        leafKey(messageId) {
            return HISTORY_MEMORY_LEAF_PREFIX+String(messageId);
        }
        leafEntries(backend) {
            return Object.entries(backend?.历史||{}).filter(([name,item])=>
                String(name||'').startsWith(HISTORY_MEMORY_LEAF_PREFIX)&&plain(item)&&String(item.事实||'').trim()
            );
        }
        leafOrder(name,fallback=0) {
            const raw=String(name||'').slice(HISTORY_MEMORY_LEAF_PREFIX.length),n=Number(raw);
            return Number.isFinite(n)&&n>=0?n:fallback;
        }
        collectedIds(backend) {
            const collected=new Set();
            for(const item of Object.values(backend?.历史总结||{})){
                if(!plain(item)||!Array.isArray(item.子项))continue;
                for(const id of item.子项){const key=String(id||'').trim();if(key)collected.add(key);}
            }
            return collected;
        }
        invalidateAncestors(backend,childId) {
            if(!plain(backend?.历史总结))return [];
            const affected=new Set([String(childId||'')]),removed=[];
            let changed=true;
            while(changed){
                changed=false;
                for(const [name,item] of Object.entries(backend.历史总结||{})){
                    if(!plain(item)||!Array.isArray(item.子项))continue;
                    if(!item.子项.some(id=>affected.has(String(id||''))))continue;
                    delete backend.历史总结[name];
                    affected.add('总结:'+name);
                    removed.push(name);
                    changed=true;
                }
            }
            return removed;
        }
        summaryOrder(item,fallback=0) {
            const n=Number(item?.起始序位);
            return Number.isFinite(n)&&n>0?n:fallback;
        }
        rootsAtLevel(backend,level) {
            const source=plain(backend)?backend:{},collected=this.collectedIds(source);
            if(level===0){
                return this.leafEntries(source).map(([name,item],index)=>({
                    id:'历史:'+name,name,level:0,text:String(item?.事实||'').trim(),
                    timeStart:String(item?.时间||'').trim(),timeEnd:String(item?.时间||'').trim(),
                    lo:this.leafOrder(name,index+1),hi:this.leafOrder(name,index+1)
                })).filter(node=>node.text&&!collected.has(node.id))
                    .sort((a,b)=>a.lo-b.lo||a.name.localeCompare(b.name,'zh-CN'));
            }
            return Object.entries(source.历史总结||{}).filter(([,item])=>plain(item)&&Number(item.层级)===level)
                .map(([name,item],index)=>({
                    id:'总结:'+name,name,level,text:String(item.摘要||'').trim(),
                    timeStart:String(item.起始时间||'').trim(),timeEnd:String(item.结束时间||'').trim(),
                    lo:this.summaryOrder(item,index+1),
                    hi:Number.isFinite(Number(item.结束序位))?Number(item.结束序位):this.summaryOrder(item,index+1)
                })).filter(node=>node.text&&!collected.has(node.id))
                .sort((a,b)=>a.lo-b.lo||a.hi-b.hi||a.name.localeCompare(b.name,'zh-CN'));
        }
        batchForLevel(backend,level) {
            const roots=this.rootsAtLevel(backend,level);
            if(level===0){
                if(roots.length<HISTORY_MEMORY_L0_BATCH+HISTORY_MEMORY_L0_KEEP)return [];
                return roots.slice(0,HISTORY_MEMORY_L0_BATCH);
            }
            const threshold=level===1?HISTORY_MEMORY_L1_BATCH:HISTORY_MEMORY_HIGHER_BATCH;
            if(roots.length<threshold)return [];
            return roots.slice(0,threshold);
        }
        nextKey(backend,level) {
            const prefix='H'+level+'-',used=new Set(Object.keys(backend?.历史总结||{}));
            let max=0;
            for(const name of used){
                if(!String(name).startsWith(prefix))continue;
                const n=Number(String(name).slice(prefix.length));if(Number.isFinite(n))max=Math.max(max,n);
            }
            let seq=max+1,key='';
            do{key=prefix+String(seq++).padStart(6,'0');}while(used.has(key));
            return key;
        }
        parseReply(raw) {
            let source=String(raw||'').trim();
            const fenced=source.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);if(fenced)source=fenced[1].trim();
            let value=null;
            try{value=JSON.parse(source);}catch(_){
                const start=source.indexOf('{'),end=source.lastIndexOf('}');
                if(start>=0&&end>start){try{value=JSON.parse(source.slice(start,end+1));}catch(__){}}
            }
            const summary=String(value?.摘要||value?.summary||'').trim();
            if(!summary)throw new Error(source?'历史总结失败：返回缺少摘要 JSON':'历史总结失败：模型空回');
            return summary;
        }
        prompt(world,batch,outputLevel) {
            const nodes=batch.map((node,index)=>({
                序号:index+1,
                时间:node.timeStart&&node.timeEnd&&node.timeStart!==node.timeEnd?node.timeStart+' → '+node.timeEnd:(node.timeStart||node.timeEnd||''),
                事实:node.text
            }));
            return JSON.stringify({
                世界:String(world?.名称||''),
                输出层级:'L'+outputLevel,
                说明:'按给定顺序压缩；时间字段是权威锚点，不得改写或补造。',
                历史节点:nodes
            },null,2);
        }
        project(backend) {
            const state=plain(backend)?backend:{},raw=state.历史||{},summaries=state.历史总结||{};
            const collected=this.collectedIds(state);
            const allLeaves=this.leafEntries(state);
            const rawRoots=this.rootsAtLevel(state,0);
            const recent=rawRoots.slice(-HISTORY_MEMORY_LEGACY_RAW_CONTEXT);
            const recentMap=Object.fromEntries(recent.map(node=>{
                const key=node.id.slice(3),record=raw[key]||{};
                return [key,{时间:String(record.时间||''),事实:String(record.事实||''),关联事件:Array.isArray(record.关联事件)?copy(record.关联事件):[]}];
            }));
            const rootSummaries=Object.entries(summaries).filter(([name,item])=>plain(item)&&!collected.has('总结:'+name))
                .map(([name,item],index)=>({
                    名称:name,层级:Math.max(1,Number(item.层级)||1),
                    起始时间:String(item.起始时间||''),结束时间:String(item.结束时间||''),摘要:String(item.摘要||''),
                    __order:this.summaryOrder(item,index+1)
                })).filter(item=>item.摘要)
                .sort((a,b)=>a.__order-b.__order||a.层级-b.层级||a.名称.localeCompare(b.名称,'zh-CN'))
                .map(item=>{const out={...item};delete out.__order;return out;});
            return {
                说明:'世界长期叙事与因果记忆；用于保持跨章连续性，不自动等于任何角色已经获知的情报。',
                近期锚点:recentMap,
                长期总结:rootSummaries,
                统计:{
                    原始锚点总数:allLeaves.length,
                    总结节点总数:Object.keys(summaries).length,
                    未收纳锚点数:rawRoots.length,
                    隐藏未压缩锚点数:Math.max(0,rawRoots.length-recent.length),
                    冷归档事实数:Math.max(0,Object.keys(raw).length-allLeaves.length)
                }
            };
        }
        digest(backend) {
            try{return JSON.stringify([backend?.历史||{},backend?.历史总结||{}]);}catch(_){return '';}
        }
    }

    const DEFAULT_WORLD_HISTORY_MEMORY_POLICY=new WorldHistoryMemoryPolicy();
    let ACTIVE_WORLD_HISTORY_MEMORY_POLICY=DEFAULT_WORLD_HISTORY_MEMORY_POLICY;
    function historyMemoryLeafKey(messageId){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.leafKey(messageId);}
    function historyMemoryLeafEntries(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.leafEntries(backend);}
    function historyMemoryLeafOrder(name,fallback=0){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.leafOrder(name,fallback);}
    function historyMemoryCollectedIds(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.collectedIds(backend);}
    function historyMemoryInvalidateAncestors(backend,childId){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.invalidateAncestors(backend,childId);}
    function historyMemorySummaryOrder(item,fallback=0){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.summaryOrder(item,fallback);}
    function historyMemoryRootsAtLevel(backend,level){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.rootsAtLevel(backend,level);}
    function historyMemoryBatchForLevel(backend,level){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.batchForLevel(backend,level);}
    function historyMemoryNextKey(backend,level){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.nextKey(backend,level);}
    function historyMemoryParseReply(raw){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.parseReply(raw);}
    function historyMemoryPrompt(world,batch,outputLevel){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.prompt(world,batch,outputLevel);}
    function projectWorldHistoryMemory(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.project(backend);}
    function historyMemoryDigest(backend){return ACTIVE_WORLD_HISTORY_MEMORY_POLICY.digest(backend);}
