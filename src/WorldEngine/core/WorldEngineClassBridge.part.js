    SamsaraWorldEngine=class SamsaraWorldEngineWithServices extends SamsaraWorldEngine {
        constructor(host,env){
            super(host,env);
            this.services=new WorldEngineServiceContainer(this).initialize();
            this.promptRegistry=this.services.prompts;
            this.promptWorkspace=new WorldPromptWorkspaceController(this,this.promptRegistry);
            this.services.promptIntegration.attachWorkspace(this.promptWorkspace);
            this.services.promptIntegration.initializeDefaults();
        }
        readPromptEditor(){
            const settings=super.readPromptEditor();
            return this.services?.promptIntegration?.readEditor(settings)||settings;
        }
        applyPromptSettings(settings){
            const integration=this.services?.promptIntegration;
            if(!integration)return super.applyPromptSettings(settings);
            const prepared=integration.prepareApply(settings);
            return integration.afterApply(prepared,super.applyPromptSettings(prepared));
        }
        savePromptDocument(name,settings,activate=true){
            const integration=this.services?.promptIntegration;
            return super.savePromptDocument(name,integration?integration.prepareDocument(settings):settings,activate);
        }
        importPromptDocument(raw){
            const doc=super.importPromptDocument(raw);
            return this.services?.promptIntegration?.importDocument(doc,raw)||doc;
        }
        init(){
            const result=super.init();
            this.services?.features?.afterInit?.(result);
            return result;
        }
        snapshot(){
            const snapshot=super.snapshot();
            return this.services?.replay?.adjustSnapshot?.(snapshot)||snapshot;
        }
        blocked(snapshot){
            const base=super.blocked(snapshot);
            return this.services?.autoProgress?.blocked?.(snapshot,base)??base;
        }
        schedule(source='variable-update',attempt=0){
            if(this.services?.autoProgress)return this.services.autoProgress.schedule(source,attempt);
            return super.schedule();
        }
        toggleAutoProgress(){return this.services?.autoProgress?.toggle?.();}
        autoProgressIntervalValue(){return this.services?.autoProgress?.interval?.()??2;}
        autoProgressContextKey(snapshot){return this.services?.autoProgress?.contextKey?.(snapshot)||'';}
        autoProgressShouldSchedule(snapshot){return this.services?.autoProgress?.shouldSchedule?.(snapshot)===true;}
        initializeAutoProgressCycle(snapshot){return this.services?.autoProgress?.initializeCycle?.(snapshot);}
        markAutoProgressRun(snapshot){return this.services?.autoProgress?.markRun?.(snapshot);}
        resetAutoProgressCycle(){return this.services?.autoProgress?.resetCycle?.();}
        autoProgressDuringExtraAnalysis(){return this.services?.autoProgress?.duringExtraAnalysis?.()===true;}
        autoProgressSameFloor(left,right){return this.services?.autoProgress?.sameFloor?.(left,right)===true;}
        worldReplayCurrentMessage(){return this.services?.replay?.currentMessage?.()||null;}
        worldReplayPathAllowed(path){return this.services?.replay?.pathAllowed?.(path)===true;}
        worldReplayAtomicPath(path){return this.services?.replay?.atomicPath?.(path)===true;}
        worldReplayCollect(before,after,path,operations){return this.services?.replay?.collect?.(before,after,path,operations);}
        buildWorldReplayPackage(before,after,fingerprint){return this.services?.replay?.buildPackage?.(before,after,fingerprint)||null;}
        applyWorldReplayPackage(stat,packageValue){return this.services?.replay?.applyPackage?.(stat,packageValue)===true;}
        worldReplayMarkEventInternal(){return this.services?.replay?.markEventInternal?.();}
        worldReplayReprocessContext(variables,before){return this.services?.replay?.reprocessContext?.(variables,before)||null;}
        worldReplaySetCycleRecovered(fingerprint,stat){return this.services?.replay?.setCycleRecovered?.(fingerprint,stat);}
        worldReplayClearHandledForRetry(stat,fingerprint){return this.services?.replay?.clearHandledForRetry?.(stat,fingerprint);}
        worldReplayLegacyPackage(context,variables){return this.services?.replay?.legacyPackage?.(context,variables)||null;}
        worldReplayWaitForIdle(){return this.services?.replay?.waitForIdle?.()||Promise.resolve();}
        worldReplayResolveIdleWaiters(){return this.services?.replay?.resolveIdleWaiters?.();}
        worldReplayImmediateRetry(context,variables){return this.services?.replay?.immediateRetry?.(context,variables)||Promise.resolve(false);}
        handleWorldReplayVariableEvent(variables,before){return this.services?.replay?.handleVariableEvent?.(variables,before)||false;}
        syncNpcBuildAuditFeature(){return this.services?.npcAuditPolicy?.sync?.()===true;}
        isNpcBuildAuditEnabled(){return this.services?.npcAuditPolicy?.enabled?.()===true;}
        isNpcAuditWorldbook(entry){return this.services?.npcAuditPolicy?.isWorldbook?.(entry)===true;}
        syncNpcAuditWorldbookSelection(catalogue){return this.services?.npcAuditPolicy?.syncWorldbookSelection?.(catalogue);}
        setNpcBuildAuditEnabled(value){return this.services?.npcAuditPolicy?.setEnabled?.(value);}
        setSendHistoryToProse(value){return this.services?.historyLifecycle?.setSendToProse?.(value);}
        proseHistoryMemory(stat){return this.services?.historyLifecycle?.proseMemory?.(stat)||{};}
        beforeWorldCommit(next,context={}){return this.services?.historyLifecycle?.beforeWorldCommit?.(next,context)===true;}
        maintainHistoryMemory(){return this.services?.historyLifecycle?.maintain?.()||Promise.resolve(0);}
        async catalogue(){
            const result=await super.catalogue();
            return this.services?.features?.afterCatalogue?.(result)||result;
        }
        async run(options={}){
            if(!this.services?.features)return super.run(options);
            return this.services.features.run(()=>super.run(options),options);
        }
        async buildRequest(base){
            this.services?.promptIntegration?.beforeBuildRequest();
            let request=await super.buildRequest(base);
            request=await this.services?.features?.afterBuildRequest?.(request,base)||request;
            return this.services?.promptIntegration?.decorateRequest(request)||request;
        }
        async requestHistoryMemorySummary(world,batch,outputLevel){
            if(this.services?.historyLifecycle)return this.services.historyLifecycle.requestSummary(world,batch,outputLevel);
            throw new Error('历史记忆服务尚未初始化');
        }
        get dedicatedApiPresetSelection(){return this.services?.apiPreset?.selection||'';}
        set dedicatedApiPresetSelection(value){if(this.services?.apiPreset)this.services.apiPreset.selection=String(value||'');}
        syncDedicatedApiPresetSelection(){return this.services?.apiPreset?.sync();}
        applyDedicatedApiPreset(name){
            const selected=String(name||'').trim(),result=super.applyDedicatedApiPreset(selected);
            return this.services?.apiPreset?.afterApply(selected,result)??result;
        }
        saveDedicatedApiPreset(name){
            const entry=super.saveDedicatedApiPreset(name);
            this.services?.apiPreset?.afterSave(entry);
            return entry;
        }
        deleteDedicatedApiPreset(name){
            const selected=String(name||'').trim(),deleted=super.deleteDedicatedApiPreset(selected);
            return this.services?.apiPreset?.afterDelete(selected,deleted)??deleted;
        }
        persistWorldEditorMutation(mutator,status){return this.services.mutations.commit(mutator,status);}
        worldEditorModeEnabled(){return this.services.editorController.modeEnabled();}
        setWorldEditorMode(value){return this.services.editorController.setMode(value);}
        toggleWorldEditorMode(){return this.services.editorController.toggleMode();}
        worldEditorSection(title){return this.services.editorController.section(title);}
        worldEditorReportError(error,title){return this.services.editorController.reportError(error,title);}
        worldEventRecord(name){return this.services.events.get(name);}
        setWorldEventRecord(oldName,newName,record){return this.services.events.save(oldName,newName,record);}
        removeWorldEventRecord(name){return this.services.events.remove(name);}
        worldPersonRecord(name){return this.services.people.get(name);}
        setWorldPersonRecord(name,record){return this.services.people.save(name,record);}
        removeWorldPersonRecord(name){return this.services.people.remove(name);}
        worldDirectoryRecord(kind,name){return this.services.exploration.record(kind,name);}
        setWorldDirectoryRecord(kind,oldName,newName,payload){return this.services.exploration.saveRecord(kind,oldName,newName,payload);}
        removeWorldDirectoryRecord(kind,name){return this.services.exploration.removeRecord(kind,name);}
        persistCausalOffsetMutation(mutator,status){return this.services.causal.commit(mutator,status);}
        causalOffsetRecord(name){return this.services.causal.get(name);}
        setCausalOffsetRecord(oldName,newName,record){return this.services.causal.save(oldName,newName,record);}
        removeCausalOffsetRecord(name){return this.services.causal.remove(name);}
        persistHistoryMemoryEdit(kind,name,build,status){return this.services.history.commitEdit(kind,name,build,status);}
        setHistoryAnchorRecord(name,record){return this.services.history.saveAnchor(name,record);}
        setHistorySummaryRecord(name,record){return this.services.history.saveSummary(name,record);}
        createPanel(){
            super.createPanel();
            this.services?.editorController?.bindPanel();
            this.services?.features?.bindPanel();
            this.services?.promptIntegration?.bindPanel(this.panel);
        }
        render(force=false){
            this.services?.features?.beforeRender(force);
            const result=super.render(force);
            this.services?.promptIntegration?.afterRender();
            this.services?.editorController?.afterRender();
            this.services?.features?.afterRender(force,result);
            return result;
        }
        dispose(){
            this.services?.features?.dispose?.();
            return super.dispose();
        }
    };
