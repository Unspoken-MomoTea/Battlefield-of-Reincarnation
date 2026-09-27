    class WorldEngineLifecycleController {
        constructor(engine){this.engine=engine;}
        init() {
            const e=this.engine,on=e.fn('eventOn');
            const mvu=e.env.Mvu||e.host.Mvu;
            if(!on||!mvu||!mvu.events){
                e.initTimer=setTimeout(()=>{if(!e.disposed)e.init();},500);
                return;
            }
            const bind=(event,callback)=>{
                if(!event)return;
                const off=on(event,callback);
                if(typeof off==='function')e.unsub.push(off);
                else if(off&&off.stop)e.unsub.push(()=>off.stop());
            };
            bind(mvu.events.VARIABLE_UPDATE_ENDED,(variables,before)=>{
                if(e.committing||e.host.__samsaraUIMutation||e.env.__samsaraUIMutation||e.host.parent?.__samsaraUIMutation)return;
                try{
                    const snapshot=e.snapshot();
                    if(plain(variables?.stat_data))snapshot.stat=variables.stat_data;
                    if(e.blocked(snapshot))e.cancel();
                }catch(_){}
                e.render();
                e.schedule();
            });
            const events=e.env.tavern_events||e.host.tavern_events||{};
            for(const key of ['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_DELETED']){
                bind(events[key],()=>{
                    e.cancel();
                    e.resetInspection();
                    e.status='已切换上下文';
                    e.render();
                });
            }
            e.keyHandler=event=>{
                if(event.key==='Escape'&&this.isOpen()){
                    event.stopImmediatePropagation();
                    this.close();
                }
            };
            e.host.document.addEventListener('keydown',e.keyHandler,true);
        }
        isOpen(){const e=this.engine;return !!e.panel&&!e.panel.hidden;}
        open(){
            const e=this.engine;
            if(this.isOpen())return;
            e.createPanel();
            const terminal=e.host.Samsara&&e.host.Samsara.terminal;
            if(terminal)e.returnState=terminal.suspend();
            e.panel.hidden=false;
            e.render();
        }
        close(){
            const e=this.engine;
            e.promptEditing=false;
            if(!this.isOpen())return;
            e.panel.hidden=true;
            const terminal=e.host.Samsara&&e.host.Samsara.terminal;
            if(terminal)terminal.restore(e.returnState);
            e.returnState=null;
        }
        toggle(){return this.isOpen()?this.close():this.open();}
        dispose(){
            const e=this.engine;
            this.close();
            e.disposed=true;
            e.cancel();
            clearTimeout(e.initTimer);
            e.unsub.forEach(off=>off());
            e.unsub=[];
            if(e.keyHandler)e.host.document.removeEventListener('keydown',e.keyHandler,true);
            if(e.panel)e.panel.remove();
            if(e.style)e.style.remove();
            if(e.mount)e.mount.remove();
        }
    }
