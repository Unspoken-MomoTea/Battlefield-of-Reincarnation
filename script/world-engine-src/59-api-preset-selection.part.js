    // 专属 API 预设选择态：选择预设后即使面板重渲染，也必须保持选中并允许删除。
    class WorldApiPresetSelectionFeature {
        constructor(engine){this.engine=engine;this.selection='';this.boundPanel=null;}
        initialize(){
            const engine=this.engine;
            const apply=engine.applyDedicatedApiPreset?.bind(engine),save=engine.saveDedicatedApiPreset?.bind(engine),remove=engine.deleteDedicatedApiPreset?.bind(engine);
            if(apply)engine.applyDedicatedApiPreset=name=>{const selected=String(name||'').trim(),result=apply(selected);this.selection=selected;return result;};
            if(save)engine.saveDedicatedApiPreset=name=>{const entry=save(name);this.selection=String(entry?.name||'');return entry;};
            if(remove)engine.deleteDedicatedApiPreset=name=>{const selected=String(name||'').trim(),deleted=remove(selected);if(deleted&&this.selection===selected)this.selection='';return deleted;};
        }
        syncSelection(){
            const engine=this.engine;if(engine.tab!=='设置'||!engine.panel)return;
            const select=engine.panel.querySelector?.('[data-dedicated-preset]'),remove=engine.panel.querySelector?.('[data-action="dedicated-preset-delete"]');
            if(!select)return;
            const wanted=String(this.selection||''),options=Array.from(select.options||[]);
            if(wanted&&options.some(option=>String(option.value)===wanted))select.value=wanted;
            else{select.value='';if(wanted)this.selection='';}
            if(remove)remove.disabled=!String(select.value||'');
        }
        bindPanel(){
            const panel=this.engine.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('change',event=>{
                const select=event.target?.closest?.('[data-dedicated-preset]');
                if(!select||!panel.contains(select))return;
                this.selection=String(select.value||'');
                const remove=panel.querySelector?.('[data-action="dedicated-preset-delete"]');
                if(remove)remove.disabled=!this.selection;
            },true);
        }
        afterRender(){this.syncSelection();}
        dispose(){this.boundPanel=null;}
    }
    registerWorldEngineFeature('api-preset-selection',engine=>new WorldApiPresetSelectionFeature(engine));
