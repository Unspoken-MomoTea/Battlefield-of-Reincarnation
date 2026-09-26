    class WorldResultCompiler {
        constructor(engine,normalizer,materializer,staging){
            this.engine=engine;
            this.normalizer=normalizer||new WorldResultNormalizer();
            this.materializer=materializer||new WorldResultMaterializer(this.normalizer);
            this.staging=staging||new WorldResultStagingService(this.normalizer,this.materializer);
        }
        normalize(value){return this.normalizer.normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return this.staging.stage(stat,accepted,incoming,validate);}
        // Legacy compile decorators still wrap the global seam; keep routing through it until those features are class-migrated.
        compile(stat,value){return compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return this.materializer.materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return sanitizeModelPatches(normalizeModelPatches(patches));}
    }
