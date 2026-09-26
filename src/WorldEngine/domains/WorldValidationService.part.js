    class WorldValidationService {
        constructor(engine){this.engine=engine;}
        validate(next,request,acceptedWorldResult,baseStat,options={}){
            const base=baseStat||{};
            ensureDueHandled(next,request?.due||[],base?.世界?.时间);
            ensureEventTimeAnchors(next,request?.unscheduled||[]);
            ensureStaleActiveHandled(next,request?.staleActive||[],base?.世界?.时间);
            ensureTemporalAnomaliesResolved(next,request?.timeAnomalies||[]);
            ensureActiveAlienActivity(next,request?.alienActivity||[],acceptedWorldResult,base?.世界?.时间);
            if(options.includeNpcAudit!==false&&Array.isArray(request?.npcAudit))ensureNpcBuildAuditProgress(next,request.npcAudit,acceptedWorldResult);
            ensureMacroBackbone(next,request?.timeline||{},this.engine.config.requireMacroBackbone!==false);
            return true;
        }
        progressionAnchorChanged(before,current){
            return progressionAnchorChanged(before,current);
        }
    }
