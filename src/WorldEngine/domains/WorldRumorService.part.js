    class WorldRumorService {
        constructor(engine){this.engine=engine;}
        requirements(stat){
            return typeof rumorMaintenanceRequirements==='function'?rumorMaintenanceRequirements(stat||this.engine.snapshot().stat):{};
        }
        publicFacts(stat){
            return typeof worldPublicRumorFacts==='function'?worldPublicRumorFacts(stat||this.engine.snapshot().stat):[];
        }
    }
