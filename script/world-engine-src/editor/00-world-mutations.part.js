    class WorldMutationService {
        constructor(engine){ this.engine=engine; this.editMode=false; }
        escape(value){
            if(typeof causalOverviewEscape==='function')return causalOverviewEscape(value);
            return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        }
        textList(value){
            if(Array.isArray(value))return [...new Set(value.map(item=>String(item||'').trim()).filter(Boolean))];
            return [...new Set(String(value||'').split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
        }
        jsonList(value,label='列表'){
            if(Array.isArray(value))return copy(value);
            const raw=String(value||'').trim();if(!raw)return [];
            let parsed;try{parsed=JSON.parse(raw);}catch(_){throw new Error(label+'必须是合法 JSON 数组');}
            if(!Array.isArray(parsed))throw new Error(label+'必须是 JSON 数组');
            return parsed;
        }
        pathConflict(left,right){
            if(!Array.isArray(left)||!Array.isArray(right))return false;
            const limit=Math.min(left.length,right.length);
            for(let index=0;index<limit;index++)if(String(left[index])!==String(right[index]))return false;
            return true;
        }
        mergeReplay(raw,fingerprint,beforeStat,afterStat){
            const replay=raw?.__samsaraWorldReplay,engine=this.engine;
            if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return false;
            if(typeof engine.buildWorldReplayPackage!=='function')return false;
            const delta=engine.buildWorldReplayPackage(beforeStat,afterStat,fingerprint);
            if(!plain(delta)||!Array.isArray(delta.operations)||!delta.operations.length)return false;
            for(const incoming of delta.operations){
                replay.operations=replay.operations.filter(existing=>!this.pathConflict(existing?.path,incoming?.path));
                replay.operations.push(copy(incoming));
            }
            return true;
        }
        backend(stat){
            const backend=stat?.世界?.[PATH];
            if(!plain(backend))throw new Error('世界后台不存在');
            return backend;
        }
        section(title){
            const panel=this.engine.panel;if(!panel)return null;
            return Array.from(panel.querySelectorAll('.we-section')).find(section=>String(section.querySelector('.we-section-head h2')?.textContent||'').trim()===String(title||''))||null;
        }
        enabled(){ return this.editMode===true; }
        setMode(value){ this.editMode=value===true;this.engine.render(true);return this.editMode; }
        toggle(){ return this.setMode(!this.enabled()); }
        async persist(mutator,status){
            if(typeof mutator!=='function')return false;
            const engine=this.engine,snapshot=engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            this.backend(stat);
            const outcome=mutator(stat);if(!outcome)return false;
            this.mergeReplay(next,snapshot.fingerprint,snapshot.stat,stat);
            const target=engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});}
            finally{
                if(target){if(had)target.__samsaraUIMutation=previous;else delete target.__samsaraUIMutation;}
            }
            engine.status=status||'世界推进资料已手动修正';
            engine.render(true);
            return true;
        }
    }
