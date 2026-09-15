    // 历史记忆手动维护：近期原始锚点可修正事实；长期总结可修正摘要/时间，但树层级与子项引用始终由程序托管。
    function historyMemoryEditorEscape(value) {
        if(typeof causalOverviewEscape==='function')return causalOverviewEscape(value);
        return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    function historyMemoryEditorSamePath(left,right) {
        return Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((item,index)=>String(item)===String(right[index]));
    }
    function historyMemoryEditorSyncReplay(raw,fingerprint,path,value) {
        const replay=raw?.__samsaraWorldReplay;
        if(!plain(replay)||String(replay.fingerprint||'')!==String(fingerprint||'')||!Array.isArray(replay.operations))return;
        replay.operations=replay.operations.filter(operation=>!historyMemoryEditorSamePath(operation?.path,path));
        replay.operations.push({op:'set',path:copy(path),value:copy(value)});
    }
    function historyMemoryEditorRelated(value) {
        const source=Array.isArray(value)?value.join('\n'):String(value||'');
        return [...new Set(source.split(/[\n,，、;；]+/).map(item=>item.trim()).filter(Boolean))];
    }

    const SamsaraWorldEngineBeforeHistoryMemoryEditor=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeHistoryMemoryEditor {
        async persistHistoryMemoryEdit(kind,name,build,status) {
            name=String(name||'').trim();
            if(!name)throw new Error('历史记录名称不能为空');
            const snapshot=this.snapshot(),next=copy(snapshot.raw),stat=next.stat_data,backend=stat?.世界?.[PATH];
            if(!plain(backend))throw new Error('世界后台不存在');
            const bucketName=kind==='summary'?'历史总结':'历史';
            const bucket=backend[bucketName];
            if(!plain(bucket)||!plain(bucket[name]))throw new Error((kind==='summary'?'长期历史总结':'近期历史锚点')+'不存在：'+name);
            const updated=build(copy(bucket[name]));
            if(!plain(updated))throw new Error('历史编辑结果无效');
            bucket[name]=updated;
            historyMemoryEditorSyncReplay(next,snapshot.fingerprint,['世界',PATH,bucketName,name],updated);
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
            this.lastHistoryMaintenance=status||'历史记忆已手动修正';
            this.status=status||'历史记忆已手动修正';
            this.render(true);
            return true;
        }
        async setHistoryAnchorRecord(name,record) {
            const time=String(record?.时间||'').trim(),fact=String(record?.事实||'').trim();
            if(!fact)throw new Error('历史事实不能为空');
            const related=historyMemoryEditorRelated(record?.关联事件);
            return this.persistHistoryMemoryEdit('anchor',name,current=>({
                ...current,
                时间:time,
                事实:fact,
                关联事件:related
            }),'已修正近期历史锚点');
        }
        async setHistorySummaryRecord(name,record) {
            const summary=String(record?.摘要||'').trim();
            if(!summary)throw new Error('长期历史摘要不能为空');
            const start=String(record?.起始时间||'').trim(),end=String(record?.结束时间||'').trim();
            return this.persistHistoryMemoryEdit('summary',name,current=>({
                ...current,
                // 层级、子项、序位、创建时间全部保留，避免破坏可追溯总结树。
                摘要:summary,
                起始时间:start,
                结束时间:end
            }),'已修正长期历史总结');
        }
        historyMemoryEditorBackend() {
            return this.snapshot().stat?.世界?.[PATH]||{};
        }
        historyMemoryEditorSection(title) {
            if(!this.panel)return null;
            return Array.from(this.panel.querySelectorAll('.we-section')).find(section=>String(section.querySelector('.we-section-head h2')?.textContent||'').trim()===title)||null;
        }
        historyAnchorInlineEditorHtml(name,record) {
            return '<div class="we-history-inline-editor" data-history-editor="anchor" data-history-name="'+historyMemoryEditorEscape(name)+'">'
                +'<div class="we-history-edit-title"><b>'+historyMemoryEditorEscape(name)+'</b><span>近期历史锚点</span></div>'
                +'<div class="we-history-edit-grid">'
                +'<label class="we-history-edit-field"><span>时间</span><input type="text" data-history-field="time" value="'+historyMemoryEditorEscape(record?.时间||'')+'"></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>已确认事实</span><textarea rows="4" data-history-field="fact" placeholder="只写已经确认发生的历史事实">'+historyMemoryEditorEscape(record?.事实||'')+'</textarea></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>关联事件</span><input type="text" data-history-field="related" value="'+historyMemoryEditorEscape((Array.isArray(record?.关联事件)?record.关联事件:[]).join('、'))+'"><small>多个事件可用 、 或逗号分隔</small></label>'
                +'</div><div class="we-history-actions">'
                +'<button type="button" class="we-history-save" data-action="history-anchor-save" data-history-name="'+historyMemoryEditorEscape(name)+'">保存</button>'
                +'<button type="button" data-action="history-anchor-cancel">取消</button>'
                +'</div></div>';
        }
        historySummaryInlineEditorHtml(name,record) {
            return '<div class="we-history-inline-editor" data-history-editor="summary" data-history-name="'+historyMemoryEditorEscape(name)+'">'
                +'<div class="we-history-edit-title"><b>'+historyMemoryEditorEscape(name)+'</b><span>L'+historyMemoryEditorEscape(Number(record?.层级)||1)+' · 树结构锁定</span></div>'
                +'<div class="we-history-edit-grid">'
                +'<label class="we-history-edit-field"><span>起始时间</span><input type="text" data-history-field="start" value="'+historyMemoryEditorEscape(record?.起始时间||'')+'"></label>'
                +'<label class="we-history-edit-field"><span>结束时间</span><input type="text" data-history-field="end" value="'+historyMemoryEditorEscape(record?.结束时间||'')+'"></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>长期历史摘要</span><textarea rows="5" data-history-field="summary" placeholder="修正这段长期历史的已确认事实概括">'+historyMemoryEditorEscape(record?.摘要||'')+'</textarea></label>'
                +'</div><div class="we-history-actions">'
                +'<button type="button" class="we-history-save" data-action="history-summary-save" data-history-name="'+historyMemoryEditorEscape(name)+'">保存</button>'
                +'<button type="button" data-action="history-summary-cancel">取消</button>'
                +'</div></div>';
        }
        beginHistoryMemoryEdit(kind,name,card) {
            const backend=this.historyMemoryEditorBackend();
            const record=kind==='summary'?backend?.历史总结?.[name]:backend?.历史?.[name];
            if(!plain(record)||!card)return false;
            card.innerHTML=kind==='summary'?this.historySummaryInlineEditorHtml(name,record):this.historyAnchorInlineEditorHtml(name,record);
            card.classList.add('we-history-editing');
            const first=card.querySelector('textarea,input');
            try{first?.focus?.();}catch(_){}
            return true;
        }
        async saveHistoryAnchorInlineEdit(card,name) {
            if(!card)return false;
            const value=key=>card.querySelector('[data-history-field="'+key+'"]')?.value;
            return this.setHistoryAnchorRecord(name,{
                时间:String(value('time')||'').trim(),
                事实:String(value('fact')||'').trim(),
                关联事件:historyMemoryEditorRelated(value('related'))
            });
        }
        async saveHistorySummaryInlineEdit(card,name) {
            if(!card)return false;
            const value=key=>card.querySelector('[data-history-field="'+key+'"]')?.value;
            return this.setHistorySummaryRecord(name,{
                起始时间:String(value('start')||'').trim(),
                结束时间:String(value('end')||'').trim(),
                摘要:String(value('summary')||'').trim()
            });
        }
        ensureHistoryMemoryEditorStyles() {
            if(!this.style||this.style.textContent.includes('.we-history-actions{'))return;
            this.style.textContent+='\n#sam-world-engine .we-history-actions{display:flex;gap:7px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap}#sam-world-engine .we-history-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:5px 10px;font-size:var(--we-fs-tiny,11px);cursor:pointer}#sam-world-engine .we-history-actions button:hover{color:var(--we-ink,var(--ink));background:var(--we-card-hover,#1d2a39)}#sam-world-engine .we-history-save{color:var(--we-accent,var(--gold))!important;border-color:color-mix(in srgb,var(--we-accent,var(--gold)) 45%,transparent)!important}#sam-world-engine .we-history-inline-editor{display:grid;gap:9px}#sam-world-engine .we-history-edit-title{display:flex;justify-content:space-between;gap:10px;align-items:center}#sam-world-engine .we-history-edit-title span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-history-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}#sam-world-engine .we-history-edit-field{display:grid;gap:4px;min-width:0}#sam-world-engine .we-history-edit-field>span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-history-edit-field>small{color:var(--we-sub,var(--sub));font-size:10px}#sam-world-engine .we-history-edit-field input,#sam-world-engine .we-history-edit-field textarea{width:100%;border:1px solid var(--we-line,var(--line));border-radius:7px;background:var(--we-surface,#111923);color:var(--we-ink,var(--ink));padding:7px 9px}#sam-world-engine .we-history-edit-field textarea{min-height:86px!important;max-height:220px!important;resize:vertical;line-height:1.55}#sam-world-engine .we-history-edit-field input:focus,#sam-world-engine .we-history-edit-field textarea:focus{outline:1px solid var(--we-accent,var(--gold));border-color:var(--we-accent,var(--gold))}#sam-world-engine .we-history-edit-wide{grid-column:1/-1}#sam-world-engine .we-history-editing{overflow:visible}@media(max-width:680px){#sam-world-engine .we-history-edit-grid{grid-template-columns:1fr}#sam-world-engine .we-history-edit-wide{grid-column:auto}}';
        }
        mountHistoryMemoryEditorControls() {
            if(this.tab!=='运行记录'||!this.panel)return;
            const backend=this.historyMemoryEditorBackend(),memory=projectWorldHistoryMemory(backend);
            const recentNames=Object.entries(memory.近期锚点||{}).reverse().map(([name])=>name);
            const recentSection=this.historyMemoryEditorSection('近期历史锚点');
            Array.from(recentSection?.querySelectorAll('.we-card')||[]).forEach((card,index)=>{
                const name=recentNames[index];if(!name||card.querySelector('.we-history-actions'))return;
                card.dataset.historyName=name;card.dataset.historyKind='anchor';
                const actions=this.host.document.createElement('div');actions.className='we-history-actions';
                actions.innerHTML='<button type="button" data-action="history-anchor-edit" data-history-name="'+historyMemoryEditorEscape(name)+'">编辑</button>';
                card.appendChild(actions);
            });
            const summaryNames=(memory.长期总结||[]).slice().reverse().map(item=>item.名称);
            const summarySection=this.historyMemoryEditorSection('长期历史总结');
            Array.from(summarySection?.querySelectorAll('.we-card')||[]).forEach((card,index)=>{
                const name=summaryNames[index];if(!name||card.querySelector('.we-history-actions'))return;
                card.dataset.historyName=name;card.dataset.historyKind='summary';
                const actions=this.host.document.createElement('div');actions.className='we-history-actions';
                actions.innerHTML='<button type="button" data-action="history-summary-edit" data-history-name="'+historyMemoryEditorEscape(name)+'">编辑</button>';
                card.appendChild(actions);
            });
        }
        createPanel() {
            super.createPanel();
            if(!this.panel||this.panel.__historyMemoryEditorBound)return;
            Object.defineProperty(this.panel,'__historyMemoryEditorBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action^="history-anchor-"],[data-action^="history-summary-"]');
                if(!button||!this.panel.contains(button))return;
                const action=String(button.dataset.action||'');
                if(!['history-anchor-edit','history-anchor-save','history-anchor-cancel','history-summary-edit','history-summary-save','history-summary-cancel'].includes(action))return;
                event.preventDefault();event.stopPropagation();
                const card=button.closest('.we-card'),name=String(button.dataset.historyName||card?.dataset?.historyName||card?.querySelector?.('[data-history-editor]')?.dataset?.historyName||'');
                let task=null;
                if(action==='history-anchor-edit')this.beginHistoryMemoryEdit('anchor',name,card);
                else if(action==='history-summary-edit')this.beginHistoryMemoryEdit('summary',name,card);
                else if(action==='history-anchor-save')task=this.saveHistoryAnchorInlineEdit(card,name);
                else if(action==='history-summary-save')task=this.saveHistorySummaryInlineEdit(card,name);
                else if(action.endsWith('-cancel'))this.render(true);
                if(task)Promise.resolve(task).catch(error=>{
                    const message=String(error?.message||error||'历史记忆编辑失败');
                    const toast=this.host?.toastr||this.env?.toastr;
                    if(toast?.error)toast.error(message,'历史记忆');else try{console.error('[历史记忆编辑]',error);}catch(_){}
                });
            });
        }
        render(force) {
            const result=super.render(force);
            this.ensureHistoryMemoryEditorStyles();
            this.mountHistoryMemoryEditorControls();
            return result;
        }
    };
