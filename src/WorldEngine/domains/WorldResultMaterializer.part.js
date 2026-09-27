    class WorldResultMaterializer {
        constructor(patchCompilation,stateMaterialization){this.patchCompilation=patchCompilation||DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE;this.stateMaterialization=stateMaterialization||DEFAULT_WORLD_STATE_MATERIALIZATION_SERVICE;}
        compileWorldResult(stat,value) { return this.patchCompilation.compile(stat,value); }

        validateBaseState(stat) { return this.stateMaterialization.validate(stat); }
        applyPatches(stat,patches) { return this.stateMaterialization.apply(stat,patches); }
        materializeWorldUpdate(stat,seedPatches,modelPatches) { return this.stateMaterialization.materialize(stat,seedPatches,modelPatches); }
    }
    const DEFAULT_WORLD_RESULT_MATERIALIZER=new WorldResultMaterializer(DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE,DEFAULT_WORLD_STATE_MATERIALIZATION_SERVICE);
    let ACTIVE_WORLD_RESULT_MATERIALIZER=DEFAULT_WORLD_RESULT_MATERIALIZER;
    function compileWorldResult(stat,value){return ACTIVE_WORLD_RESULT_MATERIALIZER.compileWorldResult(stat,value);}
    function validateState(stat){return ACTIVE_WORLD_RESULT_MATERIALIZER.validateBaseState(stat);}
    function applyPatches(stat,patches){return ACTIVE_WORLD_RESULT_MATERIALIZER.applyPatches(stat,patches);}
    function materializeWorldUpdate(stat,seedPatches,modelPatches){return ACTIVE_WORLD_RESULT_MATERIALIZER.materializeWorldUpdate(stat,seedPatches,modelPatches);}
