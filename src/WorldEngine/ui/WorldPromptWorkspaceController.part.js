    class WorldPromptWorkspaceController {
        constructor(engine,registry){this.engine=engine;this.registry=registry;}
        escape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
        editable(){return this.engine.promptEditing===true;}
        read(values){
            const next=this.registry.normalize(values),panel=this.engine.panel;
            if(!panel)return next;
            for(const field of panel.querySelectorAll('[data-prompt-registry]')){
                const key=String(field.dataset.promptRegistry||'');
                if(key&&Object.hasOwn(next,key))next[key]=String(field.value??'');
            }
            return next;
        }
        mount(){
            if(this.engine.tab!=='提示词预设'||!this.engine.panel)return;
            const main=this.engine.panel.querySelector('main');if(!main)return;
            main.querySelector('[data-world-module-prompts]')?.remove();
            let section=main.querySelector('[data-prompt-registry-section]');
            if(!section){
                section=this.engine.host.document.createElement('section');
                section.className='we-section';section.dataset.promptRegistrySection='';
                const output=[...main.querySelectorAll('.we-section')].find(item=>item.querySelector('.we-section-head h2')?.textContent?.trim()==='WorldResult 输出协议');
                if(output)output.insertAdjacentElement('beforebegin',section);else main.appendChild(section);
            }
            const groups=new Map();
            for(const item of this.registry.list()){
                if(!groups.has(item.group))groups.set(item.group,[]);
                groups.get(item.group).push(item);
            }
            const editable=this.editable();
            const rows=[];
            for(const [group,items] of groups){
                rows.push('<div class="we-prompt-registry-group"><h3>'+this.escape(group)+'</h3>');
                for(const item of items){
                    const tokens=formatTokenCount(estimateTokens(item.value),true);
                    const meta='<div class="we-prompt-registry-meta"><small><b>作用范围</b> · '+this.escape(item.scope||'system')+'</small><small><b>发送条件</b> · '+this.escape(item.condition||'按运行时条件')+'</small></div>';
                    const native=item.native
                        ?'<div class="we-notice">此提示词已在本页上方专用编辑器中直接可编辑；这里同步展示最终实际值，保存预设时与注册表一起持久化。</div><pre class="we-prose we-prompt-registry-preview">'+this.escape(item.value)+'</pre>'
                        :'<textarea data-prompt-registry="'+this.escape(item.key)+'" '+(editable?'':'readonly')+'>'+this.escape(item.value)+'</textarea>';
                    rows.push('<details class="we-segment we-prompt-registry-item"><summary>'+this.escape(item.title)+' <small>'+this.escape(item.source)+' · '+tokens+'</small></summary>'+meta+native+'</details>');
                }
                rows.push('</div>');
            }
            section.innerHTML='<div class="we-section-head"><h2>全部实际提示词</h2><small>'+this.registry.list().length+' 项 · 唯一 Prompt Registry</small></div>'
                +'<div class="we-notice">这里列出世界推进实际发送给 AI 的全部静态指令：system、user payload、历史压缩与纠错重试。带专用编辑器的主流程提示词在本页上方修改；其余在这里直接修改。程序 JSON Schema、字段白名单、动态校验错误与运行时事实不是提示词，因此不会开放编辑。</div>'
                +rows.join('');
        }
        syncEditableState(){
            if(!this.engine.panel)return;
            for(const field of this.engine.panel.querySelectorAll('[data-prompt-registry]'))field.readOnly=!this.editable();
        }
    }
