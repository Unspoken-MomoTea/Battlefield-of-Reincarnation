    class WorldRunScheduler {
        constructor(engine){this.engine=engine;}
        cancel(){
            const e=this.engine;
            ++e.generation;
            e.pending=false;
            clearTimeout(e.timer);
            if(e.controller)e.controller.abort();
        }
        schedule(){
            const e=this.engine;
            if(e.disposed||e.committing||!e.isEnabled())return;
            if(e.busy){e.pending=true;return;}
            clearTimeout(e.timer);
            e.timer=setTimeout(()=>e.run().catch(()=>{}),900);
        }
    }
