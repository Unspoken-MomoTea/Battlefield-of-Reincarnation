    class WorldPersonActivityService {
        constructor(engine,mutations){ this.engine=engine;this.mutations=mutations;this.bound=false; }
        record(name){
            const people=this.engine.snapshot().stat?.世界?.[PATH]?.人物||{},stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }
        validate(stat,name,record){
            if(!plain(record))throw new Error('世界活动记录无效：'+name);
            const backend=this.mutations.backend(stat),events=backend.事件||{};
            for(const eventName of record.关联事件||[])if(!Object.hasOwn(events,eventName))throw new Error('关联事件不存在：'+eventName);
        }
        async set(name,record){
            name=String(name||'').trim();if(!name)throw new Error('人物名称不能为空');
            return this.mutations.persist(stat=>{
                const backend=this.mutations.backend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))throw new Error('世界活动记录不存在：'+name);
                const current=people[stable],next=normalizeBackendRecord('人物',record,current);
                next.认知=this.mutations.textList(next.认知);
                next.关联事件=this.mutations.textList(next.关联事件);
                next.行程=this.mutations.jsonList(next.行程,'行程');
                next.认知来源=this.mutations.jsonList(next.认知来源,'认知来源');
                next.背景关联=this.mutations.jsonList(next.背景关联,'背景关联');
                this.validate(stat,stable,next);people[stable]=next;return true;
            },'已修正世界活动记录：'+name);
        }
        async remove(name){
            name=String(name||'').trim();if(!name)return false;
            return this.mutations.persist(stat=>{
                const backend=this.mutations.backend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))return null;
                delete people[stable];return true;
            },'已删除世界活动记录：'+name);
        }
        editorHtml(name,record){
            const esc=v=>this.mutations.escape(v),list=v=>Array.isArray(v)?v.join('\n'):'',json=v=>JSON.stringify(Array.isArray(v)?v:[],null,2);
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
        selectedName(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='角色管理')return '';
            const active=engine.panel.querySelector('.we-roster-person.active');
            return String(active?.dataset?.person||engine.selectedPerson||'').trim();
        }
        beginEdit(name,section){
            const found=this.record(name);if(!found||!section)return false;
            const head=section.querySelector('.we-section-head');
            Array.from(section.children).forEach(child=>{if(child!==head)child.hidden=true;});
            const editor=this.engine.host.document.createElement('div');editor.innerHTML=this.editorHtml(found.name,found.record);
            section.appendChild(editor.firstElementChild);return true;
        }
        async saveInline(section,name){
            const editor=section?.querySelector('[data-world-person-edit]');if(!editor)return false;
            const value=key=>editor.querySelector('[data-world-person-field="'+key+'"]')?.value,found=this.record(name);if(!found)return false;
            return this.set(found.name,{...copy(found.record),所属世界:String(value('world')||'').trim(),状态:String(value('status')||'').trim(),地点:String(value('location')||'').trim(),目标:String(value('goal')||'').trim(),行动:String(value('action')||'').trim(),公开动态:String(value('public')||'').trim(),开始时间:String(value('start')||'').trim(),预计结束:String(value('end')||'').trim(),下次检查:String(value('nextCheck')||'').trim(),更新时间:String(value('updated')||'').trim(),登场条件:String(value('appearance')||'').trim(),认知:this.mutations.textList(value('knowledge')),关联事件:this.mutations.textList(value('events')),行程:this.mutations.jsonList(value('schedule'),'行程'),认知来源:this.mutations.jsonList(value('knowledgeSources'),'认知来源'),背景关联:this.mutations.jsonList(value('links'),'背景关联')});
        }
        bind(panel){
            if(!panel||this.bound)return;this.bound=true;
            panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action^="world-person-"]');if(!button||!panel.contains(button))return;
                const action=String(button.dataset.action||'');if(!action.startsWith('world-person-'))return;
                event.preventDefault();event.stopPropagation();
                const section=this.mutations.section('身份与当前行动'),name=String(button.dataset.personName||section?.querySelector?.('[data-world-person-edit]')?.dataset?.worldPersonName||'');
                let task=null;
                if(action==='world-person-edit')this.beginEdit(name,section);
                else if(action==='world-person-save')task=this.saveInline(section,name);
                else if(action==='world-person-cancel')this.engine.render(true);
                else if(action==='world-person-delete')this.armDelete(button,name);
                else if(action==='world-person-delete-confirm')task=this.remove(name);
                else if(action==='world-person-delete-cancel')this.cancelDelete(button);
                if(task)Promise.resolve(task).catch(error=>this.report(error));
            });
        }
        armDelete(button,name){const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;button.dataset.action='world-person-delete-confirm';button.textContent='确认仅删除世界活动';button.classList.add('we-world-editor-danger');if(!actions.querySelector('[data-action="world-person-delete-cancel"]')){const cancel=this.engine.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-person-delete-cancel';cancel.dataset.personName=name;cancel.textContent='取消';actions.appendChild(cancel);}return true;}
        cancelDelete(button){const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;const confirm=actions.querySelector('[data-action="world-person-delete-confirm"]');if(confirm){confirm.dataset.action='world-person-delete';confirm.textContent='删除世界活动记录';confirm.classList.remove('we-world-editor-danger');}actions.querySelector('[data-action="world-person-delete-cancel"]')?.remove();return true;}
        report(error){const message=String(error?.message||error||'世界人物编辑失败'),toast=this.engine.host?.toastr||this.engine.env?.toastr;if(toast?.error)toast.error(message,'世界人物');}
        renderControls(){
            const engine=this.engine;if(!engine.panel||engine.tab!=='角色管理'||!this.mutations.enabled())return;
            const selected=this.selectedName(),found=this.record(selected);if(!found)return;
            const section=this.mutations.section('身份与当前行动'),head=section?.querySelector('.we-section-head');
            if(!section||!head||head.querySelector('.we-world-person-actions'))return;
            const actions=engine.host.document.createElement('span');actions.className='we-world-person-actions';
            actions.innerHTML='<button type="button" data-action="world-person-edit" data-person-name="'+this.mutations.escape(found.name)+'">编辑世界活动</button><button type="button" data-action="world-person-delete" data-person-name="'+this.mutations.escape(found.name)+'">删除世界活动记录</button>';
            head.appendChild(actions);
        }
    }
