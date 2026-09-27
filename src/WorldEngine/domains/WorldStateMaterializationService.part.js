    class WorldStateMaterializationService {
        constructor(stateFactory,stateNormalizer,lifecycle,patchPolicy,patchApplication,exploration,causal,stateIntegrity){
            this.stateFactory=stateFactory||DEFAULT_WORLD_STATE_FACTORY;
            this.stateNormalizer=stateNormalizer||DEFAULT_WORLD_STATE_NORMALIZER;
            this.lifecycle=lifecycle||DEFAULT_WORLD_LIFECYCLE_SERVICE;
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.patchApplication=patchApplication||DEFAULT_WORLD_PATCH_APPLICATION_SERVICE;
            this.exploration=exploration||DEFAULT_WORLD_EXPLORATION_SERVICE;
            this.causal=causal||DEFAULT_WORLD_CAUSAL_SERVICE;
            this.stateIntegrity=stateIntegrity||DEFAULT_WORLD_STATE_INTEGRITY_POLICY;
        }
        validate(stat){return this.stateIntegrity.validate(stat);}
        apply(stat,patches){return this.patchApplication.apply(stat,patches);}
        materialize(stat,seedPatches,modelPatches) {
            const work=copy(stat);
            work.世界[PATH]=Object.assign(this.stateFactory.emptyBackend(),work.世界[PATH]||{});
            this.stateNormalizer.normalizeBackendState(work);
            this.lifecycle.compact(work);
            const appliedSeeds=(seedPatches||[]).filter(p=>this.patchPolicy.get(work,this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(p.path),work))===undefined);
            let next=this.apply(work,appliedSeeds);
            next=this.apply(next,modelPatches||[]);
            const explorationPatches=this.exploration.repairGranularity(next);
            const layerPatches=this.stateNormalizer.normalizeEventLayers(next);
            const causalPatches=this.causal.repairProjection(next);
            const predecessorPatches=this.stateNormalizer.repairMacroPredecessors(next);
            const linkPatches=this.stateNormalizer.repairExplicitEventLinks(next);
            this.lifecycle.compact(next);
            this.validate(next);
            const repairPatches=[...explorationPatches,...layerPatches,...causalPatches,...predecessorPatches,...linkPatches];
            return {next,appliedSeeds,repairPatches};
        }
    }
    const DEFAULT_WORLD_STATE_MATERIALIZATION_SERVICE=new WorldStateMaterializationService(
        DEFAULT_WORLD_STATE_FACTORY,
        DEFAULT_WORLD_STATE_NORMALIZER,
        DEFAULT_WORLD_LIFECYCLE_SERVICE,
        DEFAULT_WORLD_PATCH_POLICY,
        DEFAULT_WORLD_PATCH_APPLICATION_SERVICE,
        DEFAULT_WORLD_EXPLORATION_SERVICE,
        DEFAULT_WORLD_CAUSAL_SERVICE,
        DEFAULT_WORLD_STATE_INTEGRITY_POLICY
    );
