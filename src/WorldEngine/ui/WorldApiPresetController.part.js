    class WorldApiPresetController {
        constructor(engine){
            this.engine=engine;
            this.selection='';
            this.boundPanel=null;
        }
        afterApply(name,result){
            this.selection=String(name||'').trim();
            return result;
        }
        afterSave(entry){
            this.selection=String(entry?.name||'');
            return entry;
        }
        afterDelete(name,deleted){
            const selected=String(name||'').trim();
            if(deleted&&this.selection===selected)this.selection='';
            return deleted;
        }
        bindPanel(){
            const panel=this.engine.panel;
            if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('change',event=>{
                const select=event.target?.closest?.('[data-dedicated-preset]');
                if(!select||!panel.contains(select))return;
                this.selection=String(select.value||'');
                const remove=panel.querySelector?.('[data-action="dedicated-preset-delete"]');
                if(remove)remove.disabled=!this.selection;
            },true);
        }
        sync(){
            const engine=this.engine;
            if(engine.tab!=='设置'||!engine.panel)return;
            const select=engine.panel.querySelector?.('[data-dedicated-preset]');
            const remove=engine.panel.querySelector?.('[data-action="dedicated-preset-delete"]');
            if(!select)return;
            const wanted=String(this.selection||''),options=Array.from(select.options||[]);
            if(wanted&&options.some(option=>String(option.value)===wanted))select.value=wanted;
            else{
                select.value='';
                if(wanted)this.selection='';
            }
            if(remove)remove.disabled=!String(select.value||'');
        }
        afterRender(){this.sync();}
        dispose(){this.boundPanel=null;}
    }
