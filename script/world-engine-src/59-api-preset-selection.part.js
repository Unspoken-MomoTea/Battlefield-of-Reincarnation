    // 专属 API 预设选择态：选择预设后即使面板重渲染，也必须保持选中并允许删除。
    const SamsaraWorldEngineBeforeApiPresetSelection=SamsaraWorldEngine;
    SamsaraWorldEngine=class SamsaraWorldEngine extends SamsaraWorldEngineBeforeApiPresetSelection {
        constructor(host,env){
            super(host,env);
            this.dedicatedApiPresetSelection='';
        }
        applyDedicatedApiPreset(name){
            const selected=String(name||'').trim();
            const result=super.applyDedicatedApiPreset(selected);
            this.dedicatedApiPresetSelection=selected;
            return result;
        }
        saveDedicatedApiPreset(name){
            const entry=super.saveDedicatedApiPreset(name);
            this.dedicatedApiPresetSelection=String(entry?.name||'');
            return entry;
        }
        deleteDedicatedApiPreset(name){
            const selected=String(name||'').trim();
            const deleted=super.deleteDedicatedApiPreset(selected);
            if(deleted&&this.dedicatedApiPresetSelection===selected)this.dedicatedApiPresetSelection='';
            return deleted;
        }
        syncDedicatedApiPresetSelection(){
            if(this.tab!=='设置'||!this.panel)return;
            const select=this.panel.querySelector?.('[data-dedicated-preset]');
            const remove=this.panel.querySelector?.('[data-action="dedicated-preset-delete"]');
            if(!select)return;
            const wanted=String(this.dedicatedApiPresetSelection||'');
            const options=Array.from(select.options||[]);
            if(wanted&&options.some(option=>String(option.value)===wanted))select.value=wanted;
            else{
                select.value='';
                if(wanted)this.dedicatedApiPresetSelection='';
            }
            if(remove)remove.disabled=!String(select.value||'');
        }
        createPanel(){
            super.createPanel();
            if(!this.panel||this.panel.__dedicatedApiPresetSelectionBound)return;
            Object.defineProperty(this.panel,'__dedicatedApiPresetSelectionBound',{value:true,configurable:true});
            this.panel.addEventListener('change',event=>{
                const select=event.target?.closest?.('[data-dedicated-preset]');
                if(!select||!this.panel.contains(select))return;
                this.dedicatedApiPresetSelection=String(select.value||'');
                const remove=this.panel.querySelector?.('[data-action="dedicated-preset-delete"]');
                if(remove)remove.disabled=!this.dedicatedApiPresetSelection;
            },true);
        }
        render(force){
            const result=super.render(force);
            this.syncDedicatedApiPresetSelection();
            return result;
        }
    };
