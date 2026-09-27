    class WorldResultMaterializer {
        constructor(patchCompilation,exploration,stateNormalizer,causal,patchPolicy,stateIntegrity,patchApplication){this.patchCompilation=patchCompilation||DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE;this.exploration=exploration||DEFAULT_WORLD_EXPLORATION_SERVICE;this.stateNormalizer=stateNormalizer||DEFAULT_WORLD_STATE_NORMALIZER;this.causal=causal||DEFAULT_WORLD_CAUSAL_SERVICE;this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;this.stateIntegrity=stateIntegrity||DEFAULT_WORLD_STATE_INTEGRITY_POLICY;this.patchApplication=patchApplication||DEFAULT_WORLD_PATCH_APPLICATION_SERVICE;}
        compileWorldResult(stat,value) { return this.patchCompilation.compile(stat,value); }

        validateBaseState(stat) { return this.stateIntegrity.validate(stat); }
        applyPatches(stat,patches) { return this.patchApplication.apply(stat,patches); }
        materializeWorldUpdate(stat,seedPatches,modelPatches) {
            const work=copy(stat);
            work.世界[PATH]=Object.assign(emptyState(),work.世界[PATH]||{});
            this.stateNormalizer.normalizeBackendState(work);compactWorldLifecycle(work);
            const appliedSeeds=(seedPatches||[]).filter(p=>this.patchPolicy.get(work,this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(p.path),work))===undefined);
            let next=this.applyPatches(work,appliedSeeds);
            next=this.applyPatches(next,modelPatches||[]);
            const explorationPatches=this.exploration.repairGranularity(next);
            const layerPatches=this.stateNormalizer.normalizeEventLayers(next);
            const causalPatches=this.causal.repairProjection(next);
            const predecessorPatches=this.stateNormalizer.repairMacroPredecessors(next);
            const linkPatches=this.stateNormalizer.repairExplicitEventLinks(next);
            compactWorldLifecycle(next);
            this.validateBaseState(next);
            const repairPatches=[...explorationPatches,...layerPatches,...causalPatches,...predecessorPatches,...linkPatches];
            return {next,appliedSeeds,repairPatches};
        }
    }
    const DEFAULT_WORLD_RESULT_MATERIALIZER=new WorldResultMaterializer(DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE,DEFAULT_WORLD_EXPLORATION_SERVICE,DEFAULT_WORLD_STATE_NORMALIZER,DEFAULT_WORLD_CAUSAL_SERVICE,DEFAULT_WORLD_PATCH_POLICY,DEFAULT_WORLD_STATE_INTEGRITY_POLICY,DEFAULT_WORLD_PATCH_APPLICATION_SERVICE);
    let ACTIVE_WORLD_RESULT_MATERIALIZER=DEFAULT_WORLD_RESULT_MATERIALIZER;
    function compileWorldResult(stat,value){return ACTIVE_WORLD_RESULT_MATERIALIZER.compileWorldResult(stat,value);}
    function validateState(stat){return ACTIVE_WORLD_RESULT_MATERIALIZER.validateBaseState(stat);}
    function applyPatches(stat,patches){return ACTIVE_WORLD_RESULT_MATERIALIZER.applyPatches(stat,patches);}
    function materializeWorldUpdate(stat,seedPatches,modelPatches){return ACTIVE_WORLD_RESULT_MATERIALIZER.materializeWorldUpdate(stat,seedPatches,modelPatches);}
