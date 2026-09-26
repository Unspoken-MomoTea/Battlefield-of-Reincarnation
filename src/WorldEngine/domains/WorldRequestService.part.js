    class WorldRequestService {
        constructor(engine){this.engine=engine;}
        build(base){return this.engine.buildRequest(base||this.engine.snapshot());}
        preview(){return this.engine.preview?.();}
        request(system,input,options){return this.engine.requestAI(system,input,options);}
    }
