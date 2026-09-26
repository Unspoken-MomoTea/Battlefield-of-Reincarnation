    class WorldResultCompiler {
        constructor(engine,normalizer){this.engine=engine;this.normalizer=normalizer||new WorldResultNormalizer();}
        normalize(value){return this.normalizer.normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return stageWorldResult(stat,accepted,incoming,validate);}
        compile(stat,value){return compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return sanitizeModelPatches(normalizeModelPatches(patches));}
    }
