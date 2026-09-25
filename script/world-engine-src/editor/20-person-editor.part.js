    // 角色管理只编辑世界推进自己的 世界.后台.人物 活动记录；正式人物档案仍由状态栏负责。
    function worldPersonValidateRecord(stat,name,record) {
        if(!plain(record))throw new Error('世界活动记录无效：'+name);
        const backend=worldEditorBackend(stat),events=backend.事件||{};
        for(const eventName of record.关联事件||[])if(!Object.hasOwn(events,eventName))throw new Error('关联事件不存在：'+eventName);
    }

    const SamsaraWorldEngineBeforeWorldPersonEditor=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeWorldPersonEditor {
        worldPersonRecord(name) {
            const people=this.snapshot().stat?.世界?.[PATH]?.人物||{};
            const stable=stableNameIn(people,String(name||'').trim());
            return stable&&plain(people[stable])?{name:stable,record:people[stable]}:null;
        }
        async setWorldPersonRecord(name,record) {
            name=String(name||'').trim();if(!name)throw new Error('人物名称不能为空');
            return this.persistWorldEditorMutation(stat=>{
                const backend=worldEditorBackend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))throw new Error('世界活动记录不存在：'+name);
                const current=people[stable];
                const next=normalizeBackendRecord('人物',record,current);
                next.认知=worldEditorTextList(next.认知);
                next.关联事件=worldEditorTextList(next.关联事件);
                next.行程=worldEditorJsonList(next.行程,'行程');
                next.认知来源=worldEditorJsonList(next.认知来源,'认知来源');
                next.背景关联=worldEditorJsonList(next.背景关联,'背景关联');
                worldPersonValidateRecord(stat,stable,next);
                people[stable]=next;
                return {name:stable};
            },'已修正世界活动记录：'+name);
        }
        async removeWorldPersonRecord(name) {
            name=String(name||'').trim();if(!name)return false;
            return this.persistWorldEditorMutation(stat=>{
                const backend=worldEditorBackend(stat),people=backend.人物||{},stable=stableNameIn(people,name);
                if(!stable||!plain(people[stable]))return null;
                delete people[stable];
                return {deleted:stable};
            },'已删除世界活动记录：'+name);
        }
        worldPersonInlineEditorHtml(name,record) {
            const list=value=>Array.isArray(value)?value.join('\n'):'';
            const json=value=>JSON.stringify(Array.isArray(value)?value:[],null,2);
            return '<div class="we-world-editor we-world-person-editor" data-world-person-edit data-world-person-name="'+worldEditorEscape(name)+'">'
                +'<div class="we-world-editor-note"><b>'+worldEditorEscape(name)+'</b><span>只编辑世界活动记录；人物正式资料由状态栏维护。</span></div>'
                +'<div class="we-world-editor-grid">'
                +'<label><span>所属世界</span><input data-world-person-field="world" value="'+worldEditorEscape(record?.所属世界||'')+'"></label>'
                +'<label><span>状态</span><input data-world-person-field="status" value="'+worldEditorEscape(record?.状态||'')+'"></label>'
                +'<label><span>地点</span><input data-world-person-field="location" value="'+worldEditorEscape(record?.地点||'')+'"></label>'
                +'<label><span>目标</span><input data-world-person-field="goal" value="'+worldEditorEscape(record?.目标||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>当前行动</span><textarea data-world-person-field="action">'+worldEditorEscape(record?.行动||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开动态</span><textarea data-world-person-field="public">'+worldEditorEscape(record?.公开动态||'')+'</textarea></label>'
                +'<label><span>开始时间</span><input data-world-person-field="start" value="'+worldEditorEscape(record?.开始时间||'')+'"></label>'
                +'<label><span>预计结束</span><input data-world-person-field="end" value="'+worldEditorEscape(record?.预计结束||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-person-field="nextCheck" value="'+worldEditorEscape(record?.下次检查||'')+'"></label>'
                +'<label><span>更新时间</span><input data-world-person-field="updated" value="'+worldEditorEscape(record?.更新时间||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>登场条件</span><textarea data-world-person-field="appearance">'+worldEditorEscape(record?.登场条件||'')+'</textarea></label>'
                +'<label><span>认知（每行一条）</span><textarea data-world-person-field="knowledge">'+worldEditorEscape(list(record?.认知))+'</textarea></label>'
                +'<label><span>关联事件（每行一个）</span><textarea data-world-person-field="events">'+worldEditorEscape(list(record?.关联事件))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>行程（JSON 数组）</span><textarea data-world-person-field="schedule">'+worldEditorEscape(json(record?.行程))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>认知来源（JSON 数组）</span><textarea data-world-person-field="knowledgeSources">'+worldEditorEscape(json(record?.认知来源))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>背景关联（JSON 数组）</span><textarea data-world-person-field="links">'+worldEditorEscape(json(record?.背景关联))+'</textarea></label>'
                +'</div><div class="we-world-editor-actions">'
                +'<button type="button" class="we-world-editor-save" data-action="world-person-save" data-person-name="'+worldEditorEscape(name)+'">保存修正</button>'
                +'<button type="button" data-action="world-person-cancel">取消</button>'
                +'</div></div>';
        }
        beginWorldPersonEdit(name,section) {
            const found=this.worldPersonRecord(name);if(!found||!section)return false;
            const head=section.querySelector('.we-section-head');
            Array.from(section.children).forEach(child=>{if(child!==head)child.hidden=true;});
            const editor=this.host.document.createElement('div');
            editor.innerHTML=this.worldPersonInlineEditorHtml(found.name,found.record);
            const node=editor.firstElementChild;section.appendChild(node);
            try{node?.querySelector('[data-world-person-field="location"]')?.focus?.();}catch(_){}
            return true;
        }
        async saveWorldPersonInlineEdit(section,name) {
            if(!section)return false;
            const editor=section.querySelector('[data-world-person-edit]');if(!editor)return false;
            const value=key=>editor.querySelector('[data-world-person-field="'+key+'"]')?.value;
            const found=this.worldPersonRecord(name);if(!found)return false;
            return this.setWorldPersonRecord(found.name,{
                ...copy(found.record),
                所属世界:String(value('world')||'').trim(),
                状态:String(value('status')||'').trim(),
                地点:String(value('location')||'').trim(),
                目标:String(value('goal')||'').trim(),
                行动:String(value('action')||'').trim(),
                公开动态:String(value('public')||'').trim(),
                开始时间:String(value('start')||'').trim(),
                预计结束:String(value('end')||'').trim(),
                下次检查:String(value('nextCheck')||'').trim(),
                更新时间:String(value('updated')||'').trim(),
                登场条件:String(value('appearance')||'').trim(),
                认知:worldEditorTextList(value('knowledge')),
                关联事件:worldEditorTextList(value('events')),
                行程:worldEditorJsonList(value('schedule'),'行程'),
                认知来源:worldEditorJsonList(value('knowledgeSources'),'认知来源'),
                背景关联:worldEditorJsonList(value('links'),'背景关联')
            });
        }
        selectedWorldPersonName() {
            if(!this.panel||this.tab!=='角色管理')return '';
            const active=this.panel.querySelector('.we-roster-person.active');
            return String(active?.dataset?.person||this.selectedPerson||'').trim();
        }
        mountWorldPersonEditorControls() {
            if(!this.panel||this.tab!=='角色管理'||!this.worldEditorModeEnabled())return;
            const selected=this.selectedWorldPersonName(),found=this.worldPersonRecord(selected);
            if(!found)return;
            const section=this.worldEditorSection('身份与当前行动'),head=section?.querySelector('.we-section-head');
            if(!section||!head||head.querySelector('.we-world-person-actions'))return;
            const actions=this.host.document.createElement('span');actions.className='we-world-person-actions';
            actions.innerHTML='<button type="button" data-action="world-person-edit" data-person-name="'+worldEditorEscape(found.name)+'">编辑世界活动</button><button type="button" data-action="world-person-delete" data-person-name="'+worldEditorEscape(found.name)+'">删除世界活动记录</button>';
            head.appendChild(actions);
        }
        armWorldPersonDelete(button,name) {
            const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;
            button.dataset.action='world-person-delete-confirm';button.textContent='确认仅删除世界活动';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-person-delete-cancel"]')){
                const cancel=this.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-person-delete-cancel';cancel.dataset.personName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelWorldPersonDelete(button) {
            const actions=button?.closest?.('.we-world-person-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-person-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-person-delete';confirm.textContent='删除世界活动记录';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-person-delete-cancel"]')?.remove();return true;
        }
        ensureWorldPersonEditorStyles() {
            if(!this.style||this.style.textContent.includes('.we-world-person-actions{'))return;
            this.style.textContent+='\n#sam-world-engine .we-world-person-actions{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}#sam-world-engine .we-world-person-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:5px 9px;cursor:pointer}#sam-world-engine .we-world-editor-note{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--we-line,var(--line));border-radius:8px;background:var(--we-surface,#111923)}#sam-world-engine .we-world-editor-note span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}';
        }
        createPanel() {
            super.createPanel();
            if(!this.panel||this.panel.__worldPersonEditorBound)return;
            Object.defineProperty(this.panel,'__worldPersonEditorBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action^="world-person-"]');
                if(!button||!this.panel.contains(button))return;
                const action=String(button.dataset.action||'');if(!action.startsWith('world-person-'))return;
                event.preventDefault();event.stopPropagation();
                const section=this.worldEditorSection('身份与当前行动');
                const name=String(button.dataset.personName||section?.querySelector?.('[data-world-person-edit]')?.dataset?.worldPersonName||'');
                let task=null;
                if(action==='world-person-edit')this.beginWorldPersonEdit(name,section);
                else if(action==='world-person-save')task=this.saveWorldPersonInlineEdit(section,name);
                else if(action==='world-person-cancel')this.render(true);
                else if(action==='world-person-delete')this.armWorldPersonDelete(button,name);
                else if(action==='world-person-delete-confirm')task=this.removeWorldPersonRecord(name);
                else if(action==='world-person-delete-cancel')this.cancelWorldPersonDelete(button);
                if(task)Promise.resolve(task).catch(error=>this.worldEditorReportError(error,'世界人物'));
            });
        }
        render(force) {
            const result=super.render(force);
            this.ensureWorldPersonEditorStyles();
            this.mountWorldEditModeToggle();
            this.mountWorldPersonEditorControls();
            return result;
        }
    };
