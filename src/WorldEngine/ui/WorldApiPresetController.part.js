    class WorldApiPresetController {
        constructor(engine){this.engine=engine;this.selected='';this.boundPanel=null;}
        afterApply(name,result){this.selected=String(name||'').trim();return result;}
        afterSave(entry){this.selected=String(entry?.name||'');return entry;}
        afterDelete(name,deleted){
            const selected=String(name||'').trim();
            if(deleted&&this.selected===selected)this.selected='';
            return deleted;
        }
        sync(){
            const engine=this.engine;
            if(engine.tab!=='设置'||!engine.panel)return;
            const select=engine.panel.querySelector?.('[data-dedicated-preset]');
            const remove=engine.panel.querySelector?.('[data-action="dedicated-preset-delete"]');
            if(!select)return;
            const wanted=String(this.selected||''),options=Array.from(select.options||[]);
            if(wanted&&options.some(option=>String(option.value)===wanted))select.value=wanted;
            else{
                select.value='';
                if(wanted)this.selected='';
            }
            if(remove)remove.disabled=!String(select.value||'');
        }
        bindPanel(){
            const panel=this.engine.panel;if(!panel||this.boundPanel===panel)return;
            this.boundPanel=panel;
            panel.addEventListener('change',event=>{
                const select=event.target?.closest?.('[data-dedicated-preset]');
                if(!select||!panel.contains(select))return;
                this.selected=String(select.value||'');
                const remove=panel.querySelector?.('[data-action="dedicated-preset-delete"]');
                if(remove)remove.disabled=!this.selected;
            },true);
        }
        dispose(){this.boundPanel=null;}
    }
