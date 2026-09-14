    // 因果偏移手动维护：玩家可直接修正/删除偏移；写回后立即重算稳定值并同步同楼 replay。
    function causalOffsetRecalculateStability(stat) {
        if(!plain(stat?.世界))return null;
        if(stat.设置?.世界超稳===true){stat.世界.稳定=100;return 100;}
        const bucket=stat.世界?.因果轨道?.偏移记录||{};
        const total=Object.values(plain(bucket)?bucket:{}).reduce((sum,item)=>sum+(Number(item?.影响程度)||0),0);
        const stable=Math.max(0,Math.min(120,100+total));
        stat.世界.稳定=stable;
        return stable;
    }
    function causalOffsetReplaySamePath(left,right) {
        return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>String(item)===String(right[index]));
    }
    function causalOffsetSyncReplay(raw,fingerprint,oldName,newName,record,deleted,stable) {
        const replay=raw?.__samsaraWorldReplay;
        if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return;
        const oldPath=['世界','因果轨道','偏移记录',String(oldName||'')];
        const newPath=['世界','因果轨道','偏移记录',String(newName||'')];
        const stabilityPath=['世界','稳定'];
        replay.operations=replay.operations.filter(operation=>{
            const path=operation?.path;
            return !causalOffsetReplaySamePath(path,oldPath)&&!causalOffsetReplaySamePath(path,newPath)&&!causalOffsetReplaySamePath(path,stabilityPath);
        });
        if(deleted){
            replay.operations.push({op:'remove',path:oldPath});
        }else{
            if(String(oldName)!==String(newName))replay.operations.push({op:'remove',path:oldPath});
            replay.operations.push({op:'set',path:newPath,value:copy(record)});
        }
        replay.operations.push({op:'set',path:stabilityPath,value:stable});
    }

    const SamsaraWorldEngineBeforeCausalOffsetEditor=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeCausalOffsetEditor {
        async persistCausalOffsetMutation(mutator,status) {
            const snapshot=this.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            if(!plain(stat?.世界?.因果轨道))stat.世界.因果轨道={};
            if(!plain(stat.世界.因果轨道.偏移记录))stat.世界.因果轨道.偏移记录={};
            const outcome=mutator(stat.世界.因果轨道.偏移记录);
            if(!outcome)return false;
            const stable=causalOffsetRecalculateStability(stat);
            causalOffsetSyncReplay(next,snapshot.fingerprint,outcome.oldName,outcome.newName,outcome.record,outcome.deleted,stable);
            const target=this.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            this.status=status||'因果偏移已更新';
            this.render(true);
            return true;
        }
        async setCausalOffsetRecord(oldName,newName,record) {
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName||!plain(record))throw new Error('偏移名称和记录不能为空');
            const impact=Number(record.影响程度);
            if(!Number.isFinite(impact)||impact===0||impact<-12||impact>15)throw new Error('影响程度必须为 -12~-1 或 +1~+15');
            return this.persistCausalOffsetMutation(bucket=>{
                if(!Object.hasOwn(bucket,oldName))throw new Error('偏移记录不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(bucket,newName))throw new Error('偏移名称已存在：'+newName);
                const next={描述:String(record.描述||'').trim(),引发者:String(record.引发者||'').trim(),影响程度:impact};
                if(newName!==oldName)delete bucket[oldName];
                bucket[newName]=next;
                return {oldName,newName,record:next,deleted:false};
            },'已编辑因果偏移 · 稳定值已重算');
        }
        async removeCausalOffsetRecord(name) {
            name=String(name||'').trim();if(!name)return false;
            return this.persistCausalOffsetMutation(bucket=>{
                if(!Object.hasOwn(bucket,name))return null;
                delete bucket[name];
                return {oldName:name,newName:name,record:null,deleted:true};
            },'已删除因果偏移 · 稳定值已重算');
        }
        causalOffsetPromptFunction() {
            const candidates=[this.host?.prompt,this.env?.prompt,typeof globalThis!=='undefined'?globalThis.prompt:null];
            const fn=candidates.find(item=>typeof item==='function');
            return fn?fn.bind(this.host):null;
        }
        causalOffsetConfirmFunction() {
            const candidates=[this.host?.confirm,this.env?.confirm,typeof globalThis!=='undefined'?globalThis.confirm:null];
            const fn=candidates.find(item=>typeof item==='function');
            return fn?fn.bind(this.host):null;
        }
        async editCausalOffsetFromUI(name) {
            const ask=this.causalOffsetPromptFunction();if(!ask)throw new Error('当前环境不支持编辑对话框');
            const record=this.snapshot().stat?.世界?.因果轨道?.偏移记录?.[name];if(!plain(record))return false;
            const nextName=ask('偏移名称',name);if(nextName===null)return false;
            const description=ask('偏移描述（只写已经实现的世界尺度长期改变）',String(record.描述||''));if(description===null)return false;
            const actor=ask('引发者',String(record.引发者||''));if(actor===null)return false;
            const impactRaw=ask('影响程度（-12~-1 或 +1~+15；0 请直接删除记录）',String(record.影响程度??''));if(impactRaw===null)return false;
            return this.setCausalOffsetRecord(name,nextName,{描述:description,引发者:actor,影响程度:Number(impactRaw)});
        }
        async deleteCausalOffsetFromUI(name) {
            const confirmDelete=this.causalOffsetConfirmFunction();
            if(confirmDelete&&!confirmDelete('删除因果偏移「'+name+'」？\n删除后世界稳定值会立即按剩余偏移重新计算。'))return false;
            return this.removeCausalOffsetRecord(name);
        }
        ensureCausalOffsetEditorStyles() {
            if(!this.style||this.style.textContent.includes('.we-offset-actions{'))return;
            this.style.textContent+='\n#sam-world-engine .we-offset-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:9px}#sam-world-engine .we-offset-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:4px 9px;font-size:var(--we-fs-tiny,11px);cursor:pointer}#sam-world-engine .we-offset-actions button:hover{color:var(--we-ink,var(--ink));background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-offset-actions [data-action="causal-offset-delete"]:hover{color:#ff8c8c;border-color:#b85c5c}';
        }
        mountCausalOffsetEditorControls() {
            if(this.tab!=='因果档案'||!this.panel)return;
            const cards=Array.from(this.panel.querySelectorAll('.we-offset'));
            const entries=causalOffsetEntries(this.snapshot().stat);
            cards.forEach((card,index)=>{
                const name=entries[index]?.[0];if(!name||card.querySelector('.we-offset-actions'))return;
                const actions=this.host.document.createElement('div');actions.className='we-offset-actions';
                actions.innerHTML='<button type="button" data-action="causal-offset-edit" data-offset-name="'+causalOverviewEscape(name)+'">编辑</button><button type="button" data-action="causal-offset-delete" data-offset-name="'+causalOverviewEscape(name)+'">删除</button>';
                card.appendChild(actions);
            });
        }
        createPanel() {
            super.createPanel();
            if(!this.panel||this.panel.__causalOffsetEditorBound)return;
            Object.defineProperty(this.panel,'__causalOffsetEditorBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="causal-offset-edit"],[data-action="causal-offset-delete"]');
                if(!button||!this.panel.contains(button))return;
                event.preventDefault();event.stopPropagation();
                const name=String(button.dataset.offsetName||'');
                const task=button.dataset.action==='causal-offset-delete'?this.deleteCausalOffsetFromUI(name):this.editCausalOffsetFromUI(name);
                Promise.resolve(task).catch(error=>{
                    const message=String(error?.message||error||'因果偏移操作失败');
                    const toast=this.host?.toastr||this.env?.toastr;
                    if(toast?.error)toast.error(message,'因果偏移');else try{console.error('[因果偏移]',error);}catch(_){}
                });
            });
        }
        render(force) {
            const result=super.render(force);
            this.ensureCausalOffsetEditorStyles();
            this.mountCausalOffsetEditorControls();
            return result;
        }
    };
