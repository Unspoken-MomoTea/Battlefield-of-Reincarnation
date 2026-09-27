    class WorldHostAdapter {
        constructor(engine){this.engine=engine;}
        resolve(name){
            const engine=this.engine;
            for(const obj of [engine.env,engine.host,engine.host?.TavernHelper]){
                if(obj&&typeof obj[name]==='function')return obj[name].bind(obj);
            }
            return null;
        }
    }
