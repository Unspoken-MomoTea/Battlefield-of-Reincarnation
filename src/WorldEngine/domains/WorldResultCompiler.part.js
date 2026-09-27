    class WorldResultCompiler {
        constructor(engine,normalizer,materializer,staging,patchPolicy){
            this.engine=engine;
            this.normalizer=normalizer||new WorldResultNormalizer();
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.materializer=materializer||new WorldResultMaterializer(this.normalizer,undefined,undefined,undefined,this.patchPolicy);
            this.staging=staging||new WorldResultStagingService(this.normalizer,this.materializer);
        }
        normalize(value){return this.normalizer.normalizeWorldResult(value);}
        stage(stat,accepted,incoming,validate){return this.staging.stage(stat,accepted,incoming,validate);}
        // All compile preprocessing is now canonical; the global compileWorldResult name is compatibility-only.
        compile(stat,value){return this.materializer.compileWorldResult(stat,value);}
        materialize(stat,seedPatches,modelPatches){return this.materializer.materializeWorldUpdate(stat,seedPatches,modelPatches);}
        sanitizeLegacy(patches){return this.patchPolicy.sanitizeModelPatches(this.patchPolicy.normalizeModelPatches(patches));}
    }
