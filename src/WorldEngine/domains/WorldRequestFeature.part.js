    class WorldRequestFeature {
        constructor(engine){this.engine=engine;}
        async afterBuildRequest(request,_base){return request;}
    }
