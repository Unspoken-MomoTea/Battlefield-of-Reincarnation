    // 世界推进手动编辑公共写回层：只修改世界引擎拥有的变量，并把修正合并回同楼 replay。
    function worldEditorEscape(value) {
        if(typeof causalOverviewEscape==='function')return causalOverviewEscape(value);
        return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function worldEditorTextList(value) {
        if(Array.isArray(value))return [...new Set(value.map(item=>String(item||'').trim()).filter(Boolean))];
        return [...new Set(String(value||'').split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
    }
    function worldEditorJsonList(value,label='列表') {
        if(Array.isArray(value))return copy(value);
        const raw=String(value||'').trim();
        if(!raw)return [];
        let parsed;
        try{parsed=JSON.parse(raw);}catch(_){throw new Error(label+'必须是合法 JSON 数组');}
        if(!Array.isArray(parsed))throw new Error(label+'必须是 JSON 数组');
        return parsed;
    }
    function worldEditorPathConflict(left,right) {
        if(!Array.isArray(left)||!Array.isArray(right))return false;
        const limit=Math.min(left.length,right.length);
        for(let index=0;index<limit;index++)if(String(left[index])!==String(right[index]))return false;
        return true;
    }
    function worldEditorMergeReplay(raw,fingerprint,beforeStat,afterStat,engine) {
        const replay=raw?.__samsaraWorldReplay;
        if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return false;
        if(!engine||typeof engine.buildWorldReplayPackage!=='function')return false;
        const delta=engine.buildWorldReplayPackage(beforeStat,afterStat,fingerprint);
        if(!plain(delta)||!Array.isArray(delta.operations)||!delta.operations.length)return false;
        for(const incoming of delta.operations){
            replay.operations=replay.operations.filter(existing=>!worldEditorPathConflict(existing?.path,incoming?.path));
            replay.operations.push(copy(incoming));
        }
        return true;
    }
    function worldEditorSection(panel,title) {
        if(!panel)return null;
        return Array.from(panel.querySelectorAll('.we-section')).find(section=>String(section.querySelector('.we-section-head h2')?.textContent||'').trim()===String(title||''))||null;
    }
    function worldEditorBackend(stat) {
        const backend=stat?.世界?.[PATH];
        if(!plain(backend))throw new Error('世界后台不存在');
        return backend;
    }

    class WorldMutationService {
        constructor(engine){this.engine=engine;this.editMode=false;}
        async persist(mutator,status) {
            if(typeof mutator!=='function')return false;
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            worldEditorBackend(stat);
            const outcome=mutator(stat);
            if(!outcome)return false;
            worldEditorMergeReplay(next,snapshot.fingerprint,snapshot.stat,stat,engine);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            engine.status=status||'世界推进资料已手动修正';
            engine.render(true);
            return true;
        }
        modeEnabled(){return this.editMode===true;}
        setMode(value){this.editMode=value===true;this.engine.render(true);return this.editMode;}
        toggleMode(){return this.setMode(!this.modeEnabled());}
        section(title){return worldEditorSection(this.engine.panel,title);}
    }
