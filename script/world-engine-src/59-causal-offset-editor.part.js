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

    class WorldCausalOffsetEditor {
        constructor(engine){this.engine=engine;this.boundPanel=null;}
        async persistCausalOffsetMutation(mutator,status) {
            const snapshot=this.engine.snapshot(),next=copy(snapshot.raw),stat=next.stat_data;
            if(!plain(stat?.世界?.因果轨道))stat.世界.因果轨道={};
            if(!plain(stat.世界.因果轨道.偏移记录))stat.世界.因果轨道.偏移记录={};
            const outcome=mutator(stat.世界.因果轨道.偏移记录);
            if(!outcome)return false;
            const stable=causalOffsetRecalculateStability(stat);
            causalOffsetSyncReplay(next,snapshot.fingerprint,outcome.oldName,outcome.newName,outcome.record,outcome.deleted,stable);
            const target=this.engine.host,had=!!target&&Object.prototype.hasOwnProperty.call(target,'__samsaraUIMutation'),previous=target?.__samsaraUIMutation;
            if(target)target.__samsaraUIMutation=true;
            try{
                await snapshot.mvu.replaceMvuData(next,{type:'message',message_id:snapshot.id});
            }finally{
                if(target){
                    if(had)target.__samsaraUIMutation=previous;
                    else delete target.__samsaraUIMutation;
                }
            }
            this.engine.status=status||'因果偏移已更新';
            this.engine.render(true);
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
        causalOffsetRecord(name) {
            return this.engine.snapshot().stat?.世界?.因果轨道?.偏移记录?.[name]||null;
        }
        causalOffsetInlineEditorHtml(name,record) {
            const impact=Number(record?.影响程度);
            return '<div class="we-offset-inline-editor" data-offset-editor data-offset-original-name="'+causalOverviewEscape(name)+'">'
                +'<div class="we-offset-edit-grid">'
                +'<label class="we-offset-edit-field"><span>偏移名称</span><input type="text" data-offset-field="name" value="'+causalOverviewEscape(name)+'"></label>'
                +'<label class="we-offset-edit-field"><span>影响程度</span><input type="number" min="-12" max="15" step="1" data-offset-field="impact" value="'+causalOverviewEscape(Number.isFinite(impact)?impact:'')+'"><small>-12~-1 或 +1~+15</small></label>'
                +'<label class="we-offset-edit-field we-offset-edit-wide"><span>偏移描述</span><textarea rows="4" data-offset-field="description" placeholder="只写已经实现的世界级长期改变">'+causalOverviewEscape(record?.描述||'')+'</textarea></label>'
                +'<label class="we-offset-edit-field we-offset-edit-wide"><span>引发者</span><input type="text" data-offset-field="actor" value="'+causalOverviewEscape(record?.引发者||'')+'"></label>'
                +'</div><div class="we-offset-actions we-offset-edit-actions">'
                +'<button type="button" class="we-offset-save" data-action="causal-offset-save" data-offset-name="'+causalOverviewEscape(name)+'">保存</button>'
                +'<button type="button" data-action="causal-offset-cancel">取消</button>'
                +'</div></div>';
        }
        beginCausalOffsetInlineEdit(name,card) {
            const record=this.causalOffsetRecord(name);if(!plain(record)||!card)return false;
            card.innerHTML=this.causalOffsetInlineEditorHtml(name,record);
            card.classList.add('we-offset-editing');
            const first=card.querySelector('[data-offset-field="name"]');
            try{first?.focus?.();first?.select?.();}catch(_){}
            return true;
        }
        async saveCausalOffsetInlineEdit(card,oldName) {
            if(!card)return false;
            const value=key=>card.querySelector('[data-offset-field="'+key+'"]')?.value;
            return this.setCausalOffsetRecord(oldName,String(value('name')||'').trim(),{
                描述:String(value('description')||'').trim(),
                引发者:String(value('actor')||'').trim(),
                影响程度:Number(value('impact'))
            });
        }
        armCausalOffsetDelete(button,name) {
            if(!button)return false;
            const actions=button.closest('.we-offset-actions');if(!actions)return false;
            button.dataset.action='causal-offset-delete-confirm';
            button.textContent='确认删除';
            button.classList.add('we-offset-delete-confirm');
            if(!actions.querySelector('[data-action="causal-offset-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');
                cancel.type='button';cancel.dataset.action='causal-offset-delete-cancel';cancel.textContent='取消';
                cancel.dataset.offsetName=String(name||'');
                actions.appendChild(cancel);
            }
            return true;
        }
        cancelCausalOffsetDelete(button) {
            const actions=button?.closest?.('.we-offset-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="causal-offset-delete-confirm"]');
            if(confirm){confirm.dataset.action='causal-offset-delete';confirm.textContent='删除';confirm.classList.remove('we-offset-delete-confirm');}
            actions.querySelector('[data-action="causal-offset-delete-cancel"]')?.remove();
            return true;
        }
        ensureCausalOffsetEditorStyles() {
            if(!this.engine.style||this.engine.style.textContent.includes('.we-offset-actions{'))return;
            this.engine.style.textContent+='\n#sam-world-engine .we-offset-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:9px;flex-wrap:wrap}#sam-world-engine .we-offset-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:5px 10px;font-size:var(--we-fs-tiny,11px);cursor:pointer}#sam-world-engine .we-offset-actions button:hover{color:var(--we-ink,var(--ink));background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-offset-actions [data-action="causal-offset-delete"]:hover,#sam-world-engine .we-offset-delete-confirm{color:#ff8c8c!important;border-color:#b85c5c!important}#sam-world-engine .we-offset-save{color:var(--we-accent,var(--gold))!important;border-color:color-mix(in srgb,var(--we-accent,var(--gold)) 45%,transparent)!important}#sam-world-engine .we-offset-editing{overflow:visible}#sam-world-engine .we-offset-inline-editor{display:grid;gap:8px}#sam-world-engine .we-offset-edit-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(140px,.6fr);gap:8px 12px;align-items:start}#sam-world-engine .we-offset-edit-field{display:grid;gap:4px;align-content:start}#sam-world-engine .we-offset-edit-field>span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-offset-edit-field>small{color:var(--we-sub,var(--sub));font-size:10px}#sam-world-engine .we-offset-edit-field input,#sam-world-engine .we-offset-edit-field textarea{width:100%;border:1px solid var(--we-line,var(--line));border-radius:7px;background:var(--we-surface,#111923);color:var(--we-ink,var(--ink));padding:7px 9px}#sam-world-engine .we-offset-edit-field textarea{height:92px!important;min-height:80px!important;max-height:180px!important;resize:vertical;line-height:1.55}#sam-world-engine .we-offset-edit-field input:focus,#sam-world-engine .we-offset-edit-field textarea:focus{outline:1px solid var(--we-accent,var(--gold));border-color:var(--we-accent,var(--gold))}#sam-world-engine .we-offset-edit-wide{grid-column:1/-1}#sam-world-engine .we-offset-edit-actions{margin-top:2px}@media(max-width:680px){#sam-world-engine .we-offset-edit-grid{grid-template-columns:1fr}}';
        }
        mountCausalOffsetEditorControls() {
            if(this.engine.tab!=='因果档案'||!this.engine.panel)return;
            const cards=Array.from(this.engine.panel.querySelectorAll('.we-offset'));
            const entries=causalOffsetEntries(this.engine.snapshot().stat);
            cards.forEach((card,index)=>{
                const name=entries[index]?.[0];if(!name||card.querySelector('.we-offset-actions'))return;
                card.dataset.offsetName=name;
                const actions=this.engine.host.document.createElement('div');actions.className='we-offset-actions';
                actions.innerHTML='<button type="button" data-action="causal-offset-edit" data-offset-name="'+causalOverviewEscape(name)+'">编辑</button><button type="button" data-action="causal-offset-delete" data-offset-name="'+causalOverviewEscape(name)+'">删除</button>';
                card.appendChild(actions);
            });
        }
        bindPanel() {
            if(!this.engine.panel||this.boundPanel===this.engine.panel)return;
            this.boundPanel=this.engine.panel;
            this.engine.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action^="causal-offset-"]');
                if(!button||!this.engine.panel.contains(button))return;
                const action=String(button.dataset.action||'');
                if(!['causal-offset-edit','causal-offset-save','causal-offset-cancel','causal-offset-delete','causal-offset-delete-confirm','causal-offset-delete-cancel'].includes(action))return;
                event.preventDefault();event.stopPropagation();
                const card=button.closest('.we-offset');
                const name=String(button.dataset.offsetName||card?.dataset?.offsetName||card?.querySelector?.('[data-offset-editor]')?.dataset?.offsetOriginalName||'');
                let task=null;
                if(action==='causal-offset-edit')this.beginCausalOffsetInlineEdit(name,card);
                else if(action==='causal-offset-save')task=this.saveCausalOffsetInlineEdit(card,name);
                else if(action==='causal-offset-cancel')this.engine.render(true);
                else if(action==='causal-offset-delete')this.armCausalOffsetDelete(button,name);
                else if(action==='causal-offset-delete-confirm')task=this.removeCausalOffsetRecord(name);
                else if(action==='causal-offset-delete-cancel')this.cancelCausalOffsetDelete(button);
                if(task)Promise.resolve(task).catch(error=>{
                    const message=String(error?.message||error||'因果偏移操作失败');
                    const toast=this.engine.host?.toastr||this.engine.env?.toastr;
                    if(toast?.error)toast.error(message,'因果偏移');else try{console.error('[因果偏移]',error);}catch(_){}
                });
            });
        }
        afterRender() {
            this.ensureCausalOffsetEditorStyles();
            this.mountCausalOffsetEditorControls();
        }
        dispose(){this.boundPanel=null;}
    }
    registerWorldEngineFeature('causal-offset-editor',engine=>new WorldCausalOffsetEditor(engine));
