    // 事件管理编辑器：编辑/重命名/删除世界后台事件，并维护引用与同楼 replay。
    function worldEventRetargetReferences(stat,oldName,newName,deleted=false) {
        const backend=worldEditorBackend(stat);
        const retarget=list=>{
            if(!Array.isArray(list))return [];
            const out=[];
            for(const item of list){
                const value=String(item||'');
                if(value!==oldName){if(value&&!out.includes(value))out.push(value);continue;}
                if(!deleted&&newName&&!out.includes(newName))out.push(newName);
            }
            return out;
        };
        for(const [name,event] of Object.entries(backend.事件||{})){
            if(name===newName&&!deleted)continue;
            if(Array.isArray(event?.前因))event.前因=retarget(event.前因);
        }
        for(const category of ['人物','势力地区','传播','历史']){
            for(const record of Object.values(backend[category]||{})){
                if(Array.isArray(record?.关联事件))record.关联事件=retarget(record.关联事件);
            }
        }
        const orbit=stat?.世界?.因果轨道;
        if(plain(orbit)&&String(orbit.下一节点||'')===oldName)orbit.下一节点=deleted?'':newName;
    }
    function worldEventValidateGraph(stat) {
        const backend=worldEditorBackend(stat),events=backend.事件||{};
        for(const [name,event] of Object.entries(events)){
            if(!plain(event))throw new Error('事件记录无效：'+name);
            if(!['待发生','进行中','已完成','已取消'].includes(String(event.状态||'')))throw new Error('事件状态只允许：待发生 / 进行中 / 已完成 / 已取消');
            if(!EVENT_CATEGORIES.has(String(event.分类||'')))throw new Error('事件分类只允许：当前事件 / 近期节点 / 宏观节点');
            if(!Array.isArray(event.前因))throw new Error('事件前因必须是列表');
            if(event.前因.includes(name))throw new Error('事件不能把自己设为前因：'+name);
            for(const cause of event.前因)if(!Object.hasOwn(events,cause))throw new Error('事件前因不存在：'+cause);
        }
        const visiting=new Set(),visited=new Set();
        const visit=name=>{
            if(visiting.has(name))throw new Error('事件前因形成循环');
            if(visited.has(name))return;
            visiting.add(name);
            for(const cause of events[name]?.前因||[])visit(cause);
            visiting.delete(name);visited.add(name);
        };
        Object.keys(events).forEach(visit);
        for(const category of ['人物','势力地区','传播','历史']){
            for(const record of Object.values(backend[category]||{})){
                if(!Array.isArray(record?.关联事件))continue;
                for(const eventName of record.关联事件)if(!Object.hasOwn(events,eventName))throw new Error(category+'关联了不存在的事件：'+eventName);
            }
        }
    }
    function worldEventSelect(value,options,field) {
        return '<select data-world-event-field="'+field+'">'+options.map(option=>'<option value="'+worldEditorEscape(option)+'"'+(String(value)===option?' selected':'')+'>'+worldEditorEscape(option)+'</option>').join('')+'</select>';
    }

    const SamsaraWorldEngineBeforeEventEditor=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeEventEditor {
        worldEventRecord(name) {
            const events=this.snapshot().stat?.世界?.[PATH]?.事件||{};
            return plain(events?.[name])?events[name]:null;
        }
        async setWorldEventRecord(oldName,newName,record) {
            oldName=String(oldName||'').trim();newName=String(newName||'').trim();
            if(!oldName||!newName)throw new Error('事件名称不能为空');
            if(forbidden.has(newName))throw new Error('事件名称包含非法键');
            return this.persistWorldEditorMutation(stat=>{
                const backend=worldEditorBackend(stat),events=backend.事件||{};
                const current=events[oldName];
                if(!plain(current))throw new Error('事件不存在：'+oldName);
                if(newName!==oldName&&Object.hasOwn(events,newName))throw new Error('事件名称已存在：'+newName);
                const next=normalizeBackendRecord('事件',record,current);
                next.前因=worldEditorTextList(next.前因);
                next.参与者=worldEditorTextList(next.参与者);
                next.关联任务=worldEditorTextList(next.关联任务);
                next.可见影响=worldEditorJsonList(next.可见影响,'可见影响');
                if(next.前因.includes(oldName)||next.前因.includes(newName))throw new Error('事件不能把自己设为前因');
                if(newName!==oldName)delete events[oldName];
                events[newName]=next;
                if(newName!==oldName)worldEventRetargetReferences(stat,oldName,newName,false);
                worldEventValidateGraph(stat);
                return {oldName,newName};
            },newName===oldName?'已修正世界事件：'+newName:'已重命名并修正世界事件：'+oldName+' → '+newName);
        }
        async removeWorldEventRecord(name) {
            name=String(name||'').trim();if(!name)return false;
            return this.persistWorldEditorMutation(stat=>{
                const backend=worldEditorBackend(stat),events=backend.事件||{};
                if(!plain(events[name]))return null;
                delete events[name];
                worldEventRetargetReferences(stat,name,'',true);
                worldEventValidateGraph(stat);
                return {deleted:name};
            },'已删除错误世界事件：'+name);
        }
        worldEventInlineEditorHtml(name,record) {
            const list=value=>Array.isArray(value)?value.join('\n'):'';
            const json=value=>JSON.stringify(Array.isArray(value)?value:[],null,2);
            return '<div class="we-world-editor" data-world-event-edit data-world-event-name="'+worldEditorEscape(name)+'">'
                +'<div class="we-world-editor-grid">'
                +'<label><span>事件名称</span><input data-world-event-field="name" value="'+worldEditorEscape(name)+'"></label>'
                +'<label><span>分类</span>'+worldEventSelect(record?.分类||'近期节点',['当前事件','近期节点','宏观节点'],'category')+'</label>'
                +'<label><span>状态</span>'+worldEventSelect(record?.状态||'待发生',['待发生','进行中','已完成','已取消'],'status')+'</label>'
                +'<label><span>地点</span><input data-world-event-field="location" value="'+worldEditorEscape(record?.地点||'')+'"></label>'
                +'<label><span>时间</span><input data-world-event-field="time" value="'+worldEditorEscape(record?.时间||'')+'"></label>'
                +'<label><span>开始时间</span><input data-world-event-field="start" value="'+worldEditorEscape(record?.开始时间||'')+'"></label>'
                +'<label><span>预计结束</span><input data-world-event-field="end" value="'+worldEditorEscape(record?.预计结束||'')+'"></label>'
                +'<label><span>下次检查</span><input data-world-event-field="nextCheck" value="'+worldEditorEscape(record?.下次检查||'')+'"></label>'
                +'<label><span>更新时间</span><input data-world-event-field="updated" value="'+worldEditorEscape(record?.更新时间||'')+'"></label>'
                +'<label class="we-world-editor-wide"><span>事件描述</span><textarea data-world-event-field="description">'+worldEditorEscape(record?.描述||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>公开征兆</span><textarea data-world-event-field="sign">'+worldEditorEscape(record?.公开征兆||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>触发条件</span><textarea data-world-event-field="condition">'+worldEditorEscape(record?.条件||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>默认走向</span><textarea data-world-event-field="default">'+worldEditorEscape(record?.默认走向||'')+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>已确认结果</span><textarea data-world-event-field="result">'+worldEditorEscape(record?.结果||'')+'</textarea></label>'
                +'<label><span>前因（每行一个）</span><textarea data-world-event-field="causes">'+worldEditorEscape(list(record?.前因))+'</textarea></label>'
                +'<label><span>参与者（每行一个）</span><textarea data-world-event-field="participants">'+worldEditorEscape(list(record?.参与者))+'</textarea></label>'
                +'<label><span>关联任务（每行一个）</span><textarea data-world-event-field="tasks">'+worldEditorEscape(list(record?.关联任务))+'</textarea></label>'
                +'<label class="we-world-editor-wide"><span>可见影响（JSON 数组）</span><textarea data-world-event-field="impacts">'+worldEditorEscape(json(record?.可见影响))+'</textarea></label>'
                +'</div><div class="we-world-editor-actions">'
                +'<button type="button" class="we-world-editor-save" data-action="world-event-save" data-event-name="'+worldEditorEscape(name)+'">保存修正</button>'
                +'<button type="button" data-action="world-event-cancel">取消</button>'
                +'</div></div>';
        }
        beginWorldEventEdit(name,card) {
            const record=this.worldEventRecord(name);if(!record||!card)return false;
            card.innerHTML=this.worldEventInlineEditorHtml(name,record);
            card.classList.add('we-world-editing');
            try{card.querySelector('[data-world-event-field="name"]')?.focus?.();}catch(_){}
            return true;
        }
        async saveWorldEventInlineEdit(card,oldName) {
            if(!card)return false;
            const value=key=>card.querySelector('[data-world-event-field="'+key+'"]')?.value;
            const current=this.worldEventRecord(oldName)||{};
            return this.setWorldEventRecord(oldName,String(value('name')||'').trim(),{
                ...copy(current),
                分类:String(value('category')||'').trim(),
                状态:String(value('status')||'').trim(),
                地点:String(value('location')||'').trim(),
                时间:String(value('time')||'').trim(),
                开始时间:String(value('start')||'').trim(),
                预计结束:String(value('end')||'').trim(),
                下次检查:String(value('nextCheck')||'').trim(),
                更新时间:String(value('updated')||'').trim(),
                描述:String(value('description')||'').trim(),
                公开征兆:String(value('sign')||'').trim(),
                条件:String(value('condition')||'').trim(),
                默认走向:String(value('default')||'').trim(),
                结果:String(value('result')||'').trim(),
                前因:worldEditorTextList(value('causes')),
                参与者:worldEditorTextList(value('participants')),
                关联任务:worldEditorTextList(value('tasks')),
                可见影响:worldEditorJsonList(value('impacts'),'可见影响')
            });
        }
        mountWorldEditModeToggle() {
            if(!this.panel||!['世界推进','角色管理'].includes(this.tab))return;
            const title=this.tab==='世界推进'?'事件时间线':'人物名册';
            const section=this.worldEditorSection(title),head=section?.querySelector('.we-section-head');
            if(!head||head.querySelector('[data-action="world-edit-mode"]'))return;
            const button=this.host.document.createElement('button');
            button.type='button';button.className='we-btn we-world-edit-toggle';button.dataset.action='world-edit-mode';
            button.textContent=this.worldEditorModeEnabled()?'退出编辑':'编辑模式';
            button.setAttribute('aria-pressed',String(this.worldEditorModeEnabled()));
            head.appendChild(button);
        }
        mountWorldEventEditorControls() {
            if(!this.panel||this.tab!=='世界推进'||!this.worldEditorModeEnabled())return;
            for(const card of this.panel.querySelectorAll('[data-event-card]')){
                if(card.querySelector('.we-world-event-actions')||card.matches('.we-world-editing'))continue;
                const name=String(card.dataset.eventCard||'');if(!name)continue;
                const actions=this.host.document.createElement('div');actions.className='we-world-event-actions';
                actions.innerHTML='<button type="button" data-action="world-event-edit" data-event-name="'+worldEditorEscape(name)+'">编辑</button><button type="button" data-action="world-event-delete" data-event-name="'+worldEditorEscape(name)+'">删除</button>';
                card.appendChild(actions);
            }
        }
        armWorldEventDelete(button,name) {
            const actions=button?.closest?.('.we-world-event-actions');if(!actions)return false;
            button.dataset.action='world-event-delete-confirm';button.textContent='确认删除';button.classList.add('we-world-editor-danger');
            if(!actions.querySelector('[data-action="world-event-delete-cancel"]')){
                const cancel=this.host.document.createElement('button');cancel.type='button';cancel.dataset.action='world-event-delete-cancel';cancel.dataset.eventName=name;cancel.textContent='取消';actions.appendChild(cancel);
            }
            return true;
        }
        cancelWorldEventDelete(button) {
            const actions=button?.closest?.('.we-world-event-actions');if(!actions)return false;
            const confirm=actions.querySelector('[data-action="world-event-delete-confirm"]');
            if(confirm){confirm.dataset.action='world-event-delete';confirm.textContent='删除';confirm.classList.remove('we-world-editor-danger');}
            actions.querySelector('[data-action="world-event-delete-cancel"]')?.remove();return true;
        }
        ensureWorldEventEditorStyles() {
            if(!this.style||this.style.textContent.includes('.we-world-editor-actions{'))return;
            this.style.textContent+='\n#sam-world-engine .we-world-edit-toggle{margin-left:auto}#sam-world-engine .we-world-event-actions,#sam-world-engine .we-world-editor-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;margin-top:9px}#sam-world-engine .we-world-event-actions button,#sam-world-engine .we-world-editor-actions button{border:1px solid var(--we-line,var(--line));border-radius:7px;background:transparent;color:var(--we-sub,var(--sub));padding:5px 10px;cursor:pointer}#sam-world-engine .we-world-editor-danger{color:#ff8c8c!important;border-color:#b85c5c!important}#sam-world-engine .we-world-editor-save{color:var(--we-accent,var(--gold))!important}#sam-world-engine .we-world-editor{display:grid;gap:10px}#sam-world-engine .we-world-editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}#sam-world-engine .we-world-editor-grid label{display:grid;gap:4px;min-width:0}#sam-world-engine .we-world-editor-grid label>span{color:var(--we-sub,var(--sub));font-size:var(--we-fs-tiny,11px)}#sam-world-engine .we-world-editor-grid input,#sam-world-engine .we-world-editor-grid select,#sam-world-engine .we-world-editor-grid textarea{width:100%;border:1px solid var(--we-line,var(--line));border-radius:7px;background:var(--we-surface,#111923);color:var(--we-ink,var(--ink));padding:7px 9px}#sam-world-engine .we-world-editor-grid textarea{min-height:78px!important;max-height:240px!important;resize:vertical;line-height:1.5}#sam-world-engine .we-world-editor-wide{grid-column:1/-1}#sam-world-engine .we-world-editing{overflow:visible}@media(max-width:680px){#sam-world-engine .we-world-editor-grid{grid-template-columns:1fr}#sam-world-engine .we-world-editor-wide{grid-column:auto}}';
        }
        worldEditorReportError(error,title='世界事件') {
            const message=String(error?.message||error||'世界推进资料编辑失败');
            const toast=this.host?.toastr||this.env?.toastr;
            if(toast?.error)toast.error(message,title);else try{console.error('['+title+']',error);}catch(_){}
        }
        createPanel() {
            super.createPanel();
            if(!this.panel||this.panel.__worldEventEditorBound)return;
            Object.defineProperty(this.panel,'__worldEventEditorBound',{value:true,configurable:true});
            this.panel.addEventListener('click',event=>{
                const button=event.target?.closest?.('[data-action="world-edit-mode"],[data-action^="world-event-"]');
                if(!button||!this.panel.contains(button))return;
                const action=String(button.dataset.action||'');
                if(action==='world-edit-mode'){
                    event.preventDefault();event.stopPropagation();this.toggleWorldEditorMode();return;
                }
                if(!action.startsWith('world-event-'))return;
                event.preventDefault();event.stopPropagation();
                const card=button.closest('[data-event-card]'),name=String(button.dataset.eventName||card?.dataset?.eventCard||card?.querySelector?.('[data-world-event-edit]')?.dataset?.worldEventName||'');
                let task=null;
                if(action==='world-event-edit')this.beginWorldEventEdit(name,card);
                else if(action==='world-event-save')task=this.saveWorldEventInlineEdit(card,name);
                else if(action==='world-event-cancel')this.render(true);
                else if(action==='world-event-delete')this.armWorldEventDelete(button,name);
                else if(action==='world-event-delete-confirm')task=this.removeWorldEventRecord(name);
                else if(action==='world-event-delete-cancel')this.cancelWorldEventDelete(button);
                if(task)Promise.resolve(task).catch(error=>this.worldEditorReportError(error,'世界事件'));
            });
        }
        render(force) {
            const result=super.render(force);
            this.ensureWorldEventEditorStyles();
            this.mountWorldEditModeToggle();
            this.mountWorldEventEditorControls();
            return result;
        }
    };
