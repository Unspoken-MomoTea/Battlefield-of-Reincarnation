    class WorldEditorController {
        constructor(engine){
            this.engine=engine;
            this.editMode=false;
            this.boundPanel=null;
        }
        modeEnabled(){return this.editMode===true;}
        setMode(value){this.editMode=value===true;this.engine.render(true);return this.editMode;}
        toggleMode(){return this.setMode(!this.modeEnabled());}
        section(title){
            const panel=this.engine.panel;if(!panel)return null;
            return Array.from(panel.querySelectorAll('.we-section')).find(section=>String(section.querySelector('.we-section-head h2')?.textContent||'').trim()===String(title||''))||null;
        }
        reportError(error,title='世界推进编辑'){
            const message=String(error?.message||error||'世界推进资料编辑失败');
            const toast=this.engine.host?.toastr||this.engine.env?.toastr;
            if(toast?.error)toast.error(message,title);else try{console.error('['+title+']',error);}catch(_){}
        }

        // ---- 共用编辑模式 ----
        mountModeToggle(){
            const engine=this.engine;
            if(!engine.panel||!['世界推进','角色管理'].includes(engine.tab))return;
            const title=engine.tab==='世界推进'?'事件时间线':'人物名册',section=this.section(title),head=section?.querySelector('.we-section-head');
            if(!head||head.querySelector('[data-action="world-edit-mode"]'))return;
            const button=engine.host.document.createElement('button');
            button.type='button';button.className='we-btn we-world-edit-toggle';button.dataset.action='world-edit-mode';
            button.textContent=this.modeEnabled()?'退出编辑':'编辑模式';
            button.setAttribute('aria-pressed',String(this.modeEnabled()));
            head.appendChild(button);
        }

        // ---- 事件 ----
        eventInlineHtml(name,record){
            const esc=worldEditorEscape,list=value=>Array.isArray(value)?value.join('\n'):'',json=value=>JSON.stringify(Array.isArray(value)?value:[],null,2);
            return '<div class="we-world-editor" data-world-event-edit data-world-event-name="'+esc(name)+'"><div class="we-world-editor-grid">'
                +'<label><span>事件名称</span><input data-world-event-field="name" value="'+esc(name)+'"></label>'
                +'<label><span>分类</span>'+worldEventSelect(record?.分类||'近期节点',['当前事件','近期节点','宏观节点'],'category')+'</label>'
                +'<label><span>状态</span>'+worldEventSelect(record?.状态||'待发生',['待发生','进行中','已完成','已取消'],'status')+'</label>'
                +'<label><span>地点</span><input data-world-event-field="location" value="'+esc(record?.地点||'')+'"></label>'
                +'<label><span>时间</span><input data-world-event-field="time" value="'+esc(record?.时间||'')+'"></label>'
                +'<label><span>开始时间</span><input data-world-event-field="start" value="'+esc(record?.开始时间||'')+'"></label>'
                +'<label><span>预计结束</span><input data-world-event-field="end" value="'+esc(record?.预计结束||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-event-field="nextCheck" value="'+esc(record?.下次检查||'')+'"></label>'
                +'<label><span>更新时间</span><input data-world-event-field="updated" value="'+esc(record?.更新时间||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>事件描述</span><textarea data-world-event-field="description">'+esc(record?.描述||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开征兆</span><textarea data-world-event-field="sign">'+esc(record?.公开征兆||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>触发条件</span><textarea data-world-event-field="condition">'+esc(record?.条件||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>默认走向</span><textarea data-world-event-field="default">'+esc(record?.默认走向||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>已确认结果</span><textarea data-world-event-field="result">'+esc(record?.结果||'')+'</textarea></label>'
                +'<label><span>前因（每行一个）</span><textarea data-world-event-field="causes">'+esc(list(record?.前因))+'</textarea></label>'
                +'<label><span>参与者（每行一个）</span><textarea data-world-event-field="participants">'+esc(list(record?.参与者))+'</textarea></label>'
                +'<label><span>关联任务（每行一个）</span><textarea data-world-event-field="tasks">'+esc(list(record?.关联任务))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>可见影响（JSON 数组）</span><textarea data-world-event-field="impacts">'+esc(json(record?.可见影响))+'</textarea></label>'
                +'</div><div class="we-world-editor-actions"><button type="button" class="we-world-editor-save" data-action="world-event-save" data-event-name="'+esc(name)+'">保存修正</button><button type="button" data-action="world-event-cancel">取消</button></div></div>';
        }
        beginEvent(name,card){
            const record=this.engine.services.events.get(name);if(!record||!card)return false;
            card.innerHTML=this.eventInlineHtml(name,record);card.classList.add('we-world-editing');
            try{card.querySelector('[data-world-event-field="name"]')?.focus?.();}catch(_){}
            return true;
        }
        saveEvent(card,oldName){
            if(!card)return false;
            const value=key=>card.querySelector('[data-world-event-field="'+key+'"]')?.value,current=this.engine.services.events.get(oldName)||{};
            return this.engine.services.events.save(oldName,String(value('name')||'').trim(),{
                ...copy(current),分类:String(value('category')||'').trim(),状态:String(value('status')||'').trim(),
                地点:String(value('location')||'').trim(),时间:String(value('time')||'').trim(),开始时间:String(value('start')||'').trim(),
                预计结束:String(value('end')||'').trim(),下次检查:String(value('nextCheck')||'').trim(),更新时间:String(value('updated')||'').trim(),
                描述:String(value('description')||'').trim(),公开征兆:String(value('sign')||'').trim(),条件:String(value('condition')||'').trim(),
                默认走向:String(value('default')||'').trim(),结果:String(value('result')||'').trim(),
                前因:worldEditorTextList(value('causes')),参与者:worldEditorTextList(value('participants')),
                关联任务:worldEditorTextList(value('tasks')),可见影响:worldEditorJsonList(value('impacts'),'可见影响')
            });
        }
        mountEventControls(){
            const engine=this.engine;
            if(!engine.panel||engine.tab!=='世界推进'||!this.modeEnabled())return;
            for(const card of engine.panel.querySelectorAll('[data-event-card]')){
                if(card.querySelector('.we-world-event-actions')||card.matches('.we-world-editing'))continue;
                const name=String(card.dataset.eventCard||'');if(!name)continue;
                const actions=engine.host.document.createElement('div');actions.className='we-world-event-actions';
                actions.innerHTML='<button type="button" data-action="world-event-edit" data-event-name="'+worldEditorEscape(name)+'">编辑</button><button type="button" data-action="world-event-delete" data-event-name="'+worldEditorEscape(name)+'">删除</button>';
                card.appendChild(actions);
            }
        }
        armEventDelete(button,name){
            const actions=button?.closest?.('.we-world-event-actions');if(!actions)return false;
            button.dataset.action='world-event-delete-confirm';button.textContent='确认删除';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-event-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-event-delete-cancel';cancel.dataset.eventName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelEventDelete(button){
            const actions=button?.closest?.('.we-world-event-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-event-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-event-delete';confirm.textContent='删除';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-event-delete-cancel"]')?.remove();return true;
        }

        // ---- 世界人物活动 ----
        personInlineHtml(name,record){
            const esc=worldEditorEscape,list=value=>Array.isArray(value)?value.join('\n'):'',json=value=>JSON.stringify(Array.isArray(value)?value:[],null,2);
            return '<div class="we-world-editor we-world-person-editor" data-world-person-edit data-world-person-name="'+esc(name)+'">'
                +'<div class="we-world-editor-note"><b>'+esc(name)+'</b><span>只编辑世界活动记录；人物正式资料由状态栏维护。</span></div><div class="we-world-editor-grid">'
                +'<label><span>所属世界</span><input data-world-person-field="world" value="'+esc(record?.所属世界||'')+'"></label>'
                +'<label><span>状态</span><input data-world-person-field="status" value="'+esc(record?.状态||'')+'"></label>'
                +'<label><span>地点</span><input data-world-person-field="location" value="'+esc(record?.地点||'')+'"></label>'
                +'<label><span>目标</span><input data-world-person-field="goal" value="'+esc(record?.目标||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>当前行动</span><textarea data-world-person-field="action">'+esc(record?.行动||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开动态</span><textarea data-world-person-field="public">'+esc(record?.公开动态||'')+'</textarea></label>'
                +'<label><span>开始时间</span><input data-world-person-field="start" value="'+esc(record?.开始时间||'')+'"></label>'
                +'<label><span>预计结束</span><input data-world-person-field="end" value="'+esc(record?.预计结束||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-person-field="nextCheck" value="'+esc(record?.下次检查||'')+'"></label>'
                +'<label><span>更新时间</span><input data-world-person-field="updated" value="'+esc(record?.更新时间||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>登场条件</span><textarea data-world-person-field="appearance">'+esc(record?.登场条件||'')+'</textarea></label>'
                +'<label><span>认知（每行一条）</span><textarea data-world-person-field="knowledge">'+esc(list(record?.认知))+'</textarea></label>'
                +'<label><span>关联事件（每行一个）</span><textarea data-world-person-field="events">'+esc(list(record?.关联事件))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>行程（JSON 数组）</span><textarea data-world-person-field="schedule">'+esc(json(record?.行程))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>认知来源（JSON 数组）</span><textarea data-world-person-field="knowledgeSources">'+esc(json(record?.认知来源))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>背景关联（JSON 数组）</span><textarea data-world-person-field="links">'+esc(json(record?.背景关联))+'</textarea></label>'
                +'</div><div class="we-world-editor-actions"><button type="button" class="we-world-editor-save" data-action="world-person-save" data-person-name="'+esc(name)+'">保存修正</button><button type="button" data-action="world-person-cancel">取消</button></div></div>';
        }
        selectedPersonName(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='角色管理')return '';
            return String(engine.panel.querySelector('.we-roster-person.active')?.dataset?.person||engine.selectedPerson||'').trim();
        }
        beginPerson(name,section){
            const found=this.engine.services.people.get(name);if(!found||!section)return false;
            const head=section.querySelector('.we-section-head');
            Array.from(section.children).forEach(child=>{if(child!==head)child.hidden=true;});
            const holder=this.engine.host.document.createElement('div');holder.innerHTML=this.personInlineHtml(found.name,found.record);
            const node=holder.firstElementChild;section.appendChild(node);
            try{node?.querySelector('[data-world-person-field="location"]')?.focus?.();}catch(_){}
            return true;
        }
        savePerson(section,name){
            const editor=section?.querySelector('[data-world-person-edit]');if(!editor)return false;
            const value=key=>editor.querySelector('[data-world-person-field="'+key+'"]')?.value,found=this.engine.services.people.get(name);if(!found)return false;
            return this.engine.services.people.save(found.name,{
                ...copy(found.record),所属世界:String(value('world')||'').trim(),状态:String(value('status')||'').trim(),
                地点:String(value('location')||'').trim(),目标:String(value('goal')||'').trim(),行动:String(value('action')||'').trim(),
                公开动态:String(value('public')||'').trim(),开始时间:String(value('start')||'').trim(),预计结束:String(value('end')||'').trim(),
                下次检查:String(value('nextCheck')||'').trim(),更新时间:String(value('updated')||'').trim(),登场条件:String(value('appearance')||'').trim(),
                认知:worldEditorTextList(value('knowledge')),关联事件:worldEditorTextList(value('events')),行程:worldEditorJsonList(value('schedule'),'行程'),
                认知来源:worldEditorJsonList(value('knowledgeSources'),'认知来源'),背景关联:worldEditorJsonList(value('links'),'背景关联')
            });
        }
        mountPersonControls(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='角色管理'||!this.modeEnabled())return;
            const found=this.engine.services.people.get(this.selectedPersonName());if(!found)return;
            const section=this.section('身份与当前行动'),head=section?.querySelector('.we-section-head');
            if(!section||!head||head.querySelector('.we-world-person-actions'))return;
            const actions=engine.host.document.createElement('span');actions.className='we-world-person-actions';
            actions.innerHTML='<button type="button" data-action="world-person-edit" data-person-name="'+worldEditorEscape(found.name)+'">编辑世界活动</button><button type="button" data-action="world-person-delete" data-person-name="'+worldEditorEscape(found.name)+'">删除世界活动记录</button>';
            head.appendChild(actions);
        }
        armPersonDelete(button,name){
            const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;
            button.dataset.action='world-person-delete-confirm';button.textContent='确认仅删除世界活动';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-person-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-person-delete-cancel';cancel.dataset.personName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelPersonDelete(button){
            const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-person-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-person-delete';confirm.textContent='删除世界活动记录';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-person-delete-cancel"]')?.remove();return true;
        }

        // ---- 因果偏移 ----
        causalInlineHtml(name,record){
            const impact=Number(record?.影响程度),esc=causalOverviewEscape;
            return '<div class="we-offset-inline-editor" data-offset-editor data-offset-original-name="'+esc(name)+'"><div class="we-offset-edit-grid">'
                +'<label class="we-offset-edit-field"><span>偏移名称</span><input type="text" data-offset-field="name" value="'+esc(name)+'"></label>'
                +'<label class="we-offset-edit-field"><span>影响程度</span><input type="number" min="-12" max="15" step="1" data-offset-field="impact" value="'+esc(Number.isFinite(impact)?impact:'')+'"><small>-12~-1 或 +1~+15</small></label>'
                +'<label class="we-offset-edit-field we-offset-edit-wide"><span>偏移描述</span><textarea rows="4" data-offset-field="description" placeholder="只写已经实现的世界级长期改变">'+esc(record?.描述||'')+'</textarea></label>'
                +'<label class="we-offset-edit-field we-offset-edit-wide"><span>引发者</span><input type="text" data-offset-field="actor" value="'+esc(record?.引发者||'')+'"></label>'
                +'</div><div class="we-offset-actions we-offset-edit-actions"><button type="button" class="we-offset-save" data-action="causal-offset-save" data-offset-name="'+esc(name)+'">保存</button><button type="button" data-action="causal-offset-cancel">取消</button></div></div>';
        }
        beginCausal(name,card){
            const record=this.engine.services.causal.get(name);if(!plain(record)||!card)return false;
            card.innerHTML=this.causalInlineHtml(name,record);card.classList.add('we-offset-editing');
            try{const first=card.querySelector('[data-offset-field="name"]');first?.focus?.();first?.select?.();}catch(_){}
            return true;
        }
        saveCausal(card,oldName){
            const value=key=>card?.querySelector('[data-offset-field="'+key+'"]')?.value;
            return this.engine.services.causal.save(oldName,String(value('name')||'').trim(),{
                描述:String(value('description')||'').trim(),引发者:String(value('actor')||'').trim(),影响程度:Number(value('impact'))
            });
        }
        mountCausalControls(){
            const engine=this.engine;if(engine.tab!=='因果档案'||!engine.panel)return;
            const entries=causalOffsetEntries(engine.snapshot().stat);
            Array.from(engine.panel.querySelectorAll('.we-offset')).forEach((card,index)=>{
                const name=entries[index]?.[0];if(!name||card.querySelector('.we-offset-actions'))return;
                card.dataset.offsetName=name;
                const actions=engine.host.document.createElement('div');actions.className='we-offset-actions';
                actions.innerHTML='<button type="button" data-action="causal-offset-edit" data-offset-name="'+causalOverviewEscape(name)+'">编辑</button><button type="button" data-action="causal-offset-delete" data-offset-name="'+causalOverviewEscape(name)+'">删除</button>';
                card.appendChild(actions);
            });
        }
        armCausalDelete(button,name){
            const actions=button?.closest?.('.we-offset-actions');if(!actions)return false;
            button.dataset.action='causal-offset-delete-confirm';button.textContent='确认删除';button.classList.add('we-offset-delete-confirm');
            if(!actions.querySelector('[data-action="causal-offset-delete-cancel"]')){
                const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='causal-offset-delete-cancel';cancel.dataset.offsetName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelCausalDelete(button){
            const actions=button?.closest?.('.we-offset-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="causal-offset-delete-confirm"]');
            if(confirm){confirm.dataset.action='causal-offset-delete';confirm.textContent='删除';confirm.classList.remove('we-offset-delete-confirm');}
            actions.querySelector('[data-action="causal-offset-delete-cancel"]')?.remove();return true;
        }

        // ---- 历史记忆 ----
        historyInlineHtml(kind,name,record){
            const esc=historyMemoryEditorEscape;
            if(kind==='summary')return '<div class="we-history-inline-editor" data-history-editor="summary" data-history-name="'+esc(name)+'">'
                +'<div class="we-history-edit-title"><b>'+esc(name)+'</b><span>L'+esc(Number(record?.层级)||1)+' · 树结构锁定</span></div><div class="we-history-edit-grid">'
                +'<label class="we-history-edit-field"><span>起始时间</span><input type="text" data-history-field="start" value="'+esc(record?.起始时间||'')+'"></label>'
                +'<label class="we-history-edit-field"><span>结束时间</span><input type="text" data-history-field="end" value="'+esc(record?.结束时间||'')+'"></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>长期历史摘要</span><textarea rows="5" data-history-field="summary">'+esc(record?.摘要||'')+'</textarea></label>'
                +'</div><div class="we-history-actions"><button type="button" class="we-history-save" data-action="history-summary-save" data-history-name="'+esc(name)+'">保存</button><button type="button" data-action="history-summary-cancel">取消</button></div></div>';
            return '<div class="we-history-inline-editor" data-history-editor="anchor" data-history-name="'+esc(name)+'">'
                +'<div class="we-history-edit-title"><b>'+esc(name)+'</b><span>近期历史锚点</span></div><div class="we-history-edit-grid">'
                +'<label class="we-history-edit-field"><span>时间</span><input type="text" data-history-field="time" value="'+esc(record?.时间||'')+'"></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>已确认事实</span><textarea rows="4" data-history-field="fact">'+esc(record?.事实||'')+'</textarea></label>'
                +'<label class="we-history-edit-field we-history-edit-wide"><span>关联事件</span><input type="text" data-history-field="related" value="'+esc((Array.isArray(record?.关联事件)?record.关联事件:[]).join('、'))+'"><small>多个事件可用 、 或逗号分隔</small></label>'
                +'</div><div class="we-history-actions"><button type="button" class="we-history-save" data-action="history-anchor-save" data-history-name="'+esc(name)+'">保存</button><button type="button" data-action="history-anchor-cancel">取消</button></div></div>';
        }
        beginHistory(kind,name,card){
            const backend=this.engine.services.history.backend(),record=kind==='summary'?backend?.历史总结?.[name]:backend?.历史?.[name];
            if(!plain(record)||!card)return false;
            card.innerHTML=this.historyInlineHtml(kind,name,record);card.classList.add('we-history-editing');
            try{card.querySelector('textarea,input')?.focus?.();}catch(_){}
            return true;
        }
        saveHistory(kind,card,name){
            const value=key=>card?.querySelector('[data-history-field="'+key+'"]')?.value;
            if(kind==='summary')return this.engine.services.history.saveSummary(name,{起始时间:String(value('start')||'').trim(),结束时间:String(value('end')||'').trim(),摘要:String(value('summary')||'').trim()});
            return this.engine.services.history.saveAnchor(name,{时间:String(value('time')||'').trim(),事实:String(value('fact')||'').trim(),关联事件:historyMemoryEditorRelated(value('related'))});
        }
        mountHistoryControls(){
            const engine=this.engine;if(engine.tab!=='运行记录'||!engine.panel)return;
            const backend=engine.services.history.backend(),memory=projectWorldHistoryMemory(backend);
            const recentNames=Object.entries(memory.近期锚点||{}).reverse().map(([name])=>name),recentSection=this.section('近期历史锚点');
            Array.from(recentSection?.querySelectorAll('.we-card')||[]).forEach((card,index)=>{
                const name=recentNames[index];if(!name||card.querySelector('.we-history-actions'))return;
                card.dataset.historyName=name;card.dataset.historyKind='anchor';
                const actions=engine.host.document.createElement('div');actions.className='we-history-actions';
                actions.innerHTML='<button type="button" data-action="history-anchor-edit" data-history-name="'+historyMemoryEditorEscape(name)+'">编辑</button>';card.appendChild(actions);
            });
            const summaryNames=(memory.长期总结||[]).slice().reverse().map(item=>item.名称),summarySection=this.section('长期历史总结');
            Array.from(summarySection?.querySelectorAll('.we-card')||[]).forEach((card,index)=>{
                const name=summaryNames[index];if(!name||card.querySelector('.we-history-actions'))return;
                card.dataset.historyName=name;card.dataset.historyKind='summary';
                const actions=engine.host.document.createElement('div');actions.className='we-history-actions';
                actions.innerHTML='<button type="button" data-action="history-summary-edit" data-history-name="'+historyMemoryEditorEscape(name)+'">编辑</button>';card.appendChild(actions);
            });
        }

        ensureStyles(){
            const engine=this.engine;if(!engine.style||engine.style.textContent.includes('.we-world-editor-actions{'))return;
            engine.style.textContent+='\n'
                +'#sam-world-engine .we-world-edit-toggle{margin-left:auto}'
                +'#sam-world-engine .we-world-event-actions,#sam-world-engine .we-world-editor-actions,#sam-world-engine .we-history-actions,#sam-world-engine .we-offset-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;margin-top:9px}'
                +'#sam-world-engine .we-world-event-actions button,#sam-world-engine .we-world-editor-actions button,#sam-world-engine .we-history-actions button,#sam-world-engine .we-offset-actions button,#sam-world-engine .we-world-person-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:5px 10px;cursor:pointer}'
                +'#sam-world-engine .we-world-editor-danger,#sam-world-engine .we-offset-delete-confirm{color:#ff8c8c!important;border-color:#b85c5c!important}'
                +'#sam-world-engine .we-world-editor-save,#sam-world-engine .we-history-save,#sam-world-engine .we-offset-save{color:var(--we-accent,var(--gold))!important}'
                +'#sam-world-engine .we-world-editor,#sam-world-engine .we-history-inline-editor,#sam-world-engine .we-offset-inline-editor{display:grid;gap:9px}'
                +'#sam-world-engine .we-world-editor-grid,#sam-world-engine .we-history-edit-grid,#sam-world-engine .we-offset-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}'
                +'#sam-world-engine .we-world-editor-grid label,#sam-world-engine .we-history-edit-field,#sam-world-engine .we-offset-edit-field{display:grid;gap:4px;min-width:0}'
                +'#sam-world-engine .we-world-editor-grid input,#sam-world-engine .we-world-editor-grid select,#sam-world-engine .we-world-editor-grid textarea,#sam-world-engine .we-history-edit-field input,#sam-world-engine .we-history-edit-field textarea,#sam-world-engine .we-offset-edit-field input,#sam-world-engine .we-offset-edit-field textarea{width:100%;border:1px solid var(--we-line,var(--line));border-radius:7px;background:var(--we-surface,#111923);color:var(--we-ink,var(--ink));padding:7px 9px}'
                +'#sam-world-engine .we-offset-edit-field textarea{height:92px!important;min-height:80px!important;max-height:180px!important;resize:vertical;line-height:1.55}'
                +'#sam-world-engine .we-history-edit-field textarea,#sam-world-engine .we-world-editor-grid textarea{min-height:78px!important;max-height:240px!important;resize:vertical;line-height:1.5}'
                +'#sam-world-engine .we-world-editor-wide,#sam-world-engine .we-history-edit-wide,#sam-world-engine .we-offset-edit-wide{grid-column:1/-1}'
                +'#sam-world-engine .we-world-person-actions{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}'
                +'#sam-world-engine .we-world-editor-note,#sam-world-engine .we-history-edit-title{display:flex;justify-content:space-between;gap:10px;align-items:center}'
                +'@media(max-width:680px){#sam-world-engine .we-world-editor-grid,#sam-world-engine .we-history-edit-grid,#sam-world-engine .we-offset-edit-grid{grid-template-columns:1fr}#sam-world-engine .we-world-editor-wide,#sam-world-engine .we-history-edit-wide,#sam-world-engine .we-offset-edit-wide{grid-column:auto}}';
        }

        bindPanel(){
            const panel=this.engine.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="world-edit-mode"],[data-action^="world-event-"],[data-action^="world-person-"],[data-action^="causal-offset-"],[data-action^="history-anchor-"],[data-action^="history-summary-"]');
                if(!button||!panel.contains(button))return;
                const action=String(button.dataset.action||'');
                if(action==='world-edit-mode'){event.preventDefault();event.stopPropagation();this.toggleMode();return;}
                let task=null;
                if(action.startsWith('world-event-')){
                    event.preventDefault();event.stopPropagation();
                    const card=button.closest('[data-event-card]'),name=String(button.dataset.eventName||card?.dataset?.eventCard||card?.querySelector?.('[data-world-event-edit]')?.dataset?.worldEventName||'');
                    if(action==='world-event-edit')this.beginEvent(name,card);
                    else if(action==='world-event-save')task=this.saveEvent(card,name);
                    else if(action==='world-event-cancel')this.engine.render(true);
                    else if(action==='world-event-delete')this.armEventDelete(button,name);
                    else if(action==='world-event-delete-confirm')task=this.engine.services.events.remove(name);
                    else if(action==='world-event-delete-cancel')this.cancelEventDelete(button);
                }else if(action.startsWith('world-person-')){
                    event.preventDefault();event.stopPropagation();
                    const section=this.section('身份与当前行动'),name=String(button.dataset.personName||section?.querySelector?.('[data-world-person-edit]')?.dataset?.worldPersonName||'');
                    if(action==='world-person-edit')this.beginPerson(name,section);
                    else if(action==='world-person-save')task=this.savePerson(section,name);
                    else if(action==='world-person-cancel')this.engine.render(true);
                    else if(action==='world-person-delete')this.armPersonDelete(button,name);
                    else if(action==='world-person-delete-confirm')task=this.engine.services.people.remove(name);
                    else if(action==='world-person-delete-cancel')this.cancelPersonDelete(button);
                }else if(action.startsWith('causal-offset-')){
                    event.preventDefault();event.stopPropagation();
                    const card=button.closest('.we-offset'),name=String(button.dataset.offsetName||card?.dataset?.offsetName||card?.querySelector?.('[data-offset-editor]')?.dataset?.offsetOriginalName||'');
                    if(action==='causal-offset-edit')this.beginCausal(name,card);
                    else if(action==='causal-offset-save')task=this.saveCausal(card,name);
                    else if(action==='causal-offset-cancel')this.engine.render(true);
                    else if(action==='causal-offset-delete')this.armCausalDelete(button,name);
                    else if(action==='causal-offset-delete-confirm')task=this.engine.services.causal.remove(name);
                    else if(action==='causal-offset-delete-cancel')this.cancelCausalDelete(button);
                }else if(action.startsWith('history-anchor-')||action.startsWith('history-summary-')){
                    event.preventDefault();event.stopPropagation();
                    const card=button.closest('.we-card'),name=String(button.dataset.historyName||card?.dataset?.historyName||card?.querySelector?.('[data-history-editor]')?.dataset?.historyName||'');
                    if(action==='history-anchor-edit')this.beginHistory('anchor',name,card);
                    else if(action==='history-summary-edit')this.beginHistory('summary',name,card);
                    else if(action==='history-anchor-save')task=this.saveHistory('anchor',card,name);
                    else if(action==='history-summary-save')task=this.saveHistory('summary',card,name);
                    else if(action.endsWith('-cancel'))this.engine.render(true);
                }
                if(task)Promise.resolve(task).catch(error=>this.reportError(error,action.startsWith('history-')?'历史记忆':action.startsWith('causal-')?'因果偏移':action.startsWith('world-person-')?'世界人物':'世界事件'));
            });
        }
        afterRender(){
            this.ensureStyles();this.mountModeToggle();this.mountEventControls();this.mountPersonControls();this.mountCausalControls();this.mountHistoryControls();
        }
        dispose(){this.boundPanel=null;}
    }
