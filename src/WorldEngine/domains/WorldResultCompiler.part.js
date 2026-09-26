    class WorldResultCompiler {
        constructor(engine,normalizer,materializer){this.engine=engine;this.normalizer=normalizer||new WorldResultNormalizer();this.materializer=materializer||new WorldResultMaterializer(this.normalizer);}
        normalize(value){return this.normalizer.normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return stageWorldResult(stat,accepted,incoming,validate);}
        compile(stat,value){return this.materializer.compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return this.materializer.materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return sanitizeModelPatches(normalizeModelPatches(patches));}
    }
