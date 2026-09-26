    class WorldStateProjector {
        constructor(engine){this.engine=engine;}
        world(stat){return projectWorldContext(stat);}
        assets(value){return projectAssetsForWorld(value);}
        character(value){return projectCharacterForWorld(value);}
        causalOrbit(value,currentStability){return projectCausalOrbitForWorld(value,currentStability);}
    }
