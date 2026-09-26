    class WorldResultCompiler {
        constructor(engine){this.engine=engine;}
        normalize(value){return normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return stageWorldResult(stat,accepted,incoming,validate);}
        compile(stat,value){return compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return sanitizeModelPatches(normalizeModelPatches(patches));}
    }
