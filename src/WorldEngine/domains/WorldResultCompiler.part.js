    class WorldResultCompiler {
        constructor(engine,normalizer,materializer){this.engine=engine;this.normalizer=normalizer||new WorldResultNormalizer();this.materializer=materializer||new WorldResultMaterializer(this.normalizer);}
        normalize(value){return this.normalizer.normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return stageWorldResult(stat,accepted,incoming,validate);}
        // Legacy compile decorators still wrap the global seam; keep routing through it until those features are class-migrated.
        compile(stat,value){return compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return this.materializer.materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return sanitizeModelPatches(normalizeModelPatches(patches));}
    }
