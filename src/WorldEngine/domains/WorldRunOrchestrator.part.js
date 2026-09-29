    class WorldRunOrchestrator {
        constructor(engine){this.engine=engine;}
        resetInspection(){
            const e=this.engine;
            e.lastRequest=null;e.previewRequest=null;e.lastReply='';e.lastFailure='';
            e.lastRetryLog=[];e.lastAttemptCount=0;e.lastAttemptTelemetry=[];e.lastTransportInfo=null;e.lastWorldResult=null;e.lastCompiledPatches=[];e.lastCompileWarnings=[];
        }
        notifyFailure(message){
            const e=this.engine,raw=String(message||'世界推进失败').trim();
            if(!raw||/^(?:请求已取消|上下文已经切换|已切换上下文)/.test(raw))return false;
            const shown=raw.length>900?raw.slice(0,897)+'…':raw;
            const toast=(e.host&&e.host.toastr)||(e.env&&e.env.toastr)||(e.host&&e.host.parent&&e.host.parent.toastr);
            if(toast&&typeof toast.error==='function'){
                try{toast.error(shown,'世界推进失败');return true;}catch(_){}
            }
            try{console.error('[世界推进] '+shown);}catch(_){}
            return false;
        }
        async execute(options={}) {
            const engine=this.engine;
            return await (async function() {
            if (this.disposed || this.busy) return false;
            if (!this.isConfigured()) { this.status='世界推进已关闭'; this.render(); return false; }
            const terminal = this.host.Samsara && this.host.Samsara.terminal;
            this.busy = true; const token = this.generation; let timeout, timedOut=false;
            try {
                const base = this.snapshot(), reason = this.blocked(base);
                if (reason) { this.status = reason; return false; }
                const old = Object.assign(emptyState(),base.stat.世界[PATH] || {});
                if (old.已处理楼层 === base.fingerprint) {
                    const recoveryStat=copy(base.stat);
                    recoveryStat.世界[PATH]=Object.assign(emptyState(),recoveryStat.世界[PATH]||{});
                    normalizeBackendState(recoveryStat);
                    const recoveryTimeline=this.services.timelinePolicy.timelineState(recoveryStat);
                    const needsMacroRepair=this.config.requireMacroBackbone!==false&&(recoveryTimeline.需要补充远期||recoveryTimeline.因果轨道需重建);
                    const needsScheduleRepair=unscheduledEvents(recoveryStat).length>0;
                    const needsLifecycleRepair=staleActiveEvents(recoveryStat).length>0||temporalAnomalies(recoveryStat).length>0;
                    const needsAlienRepair=activeAlienActivityRequirements(recoveryStat).some(item=>{
                        const personName=stableNameIn(recoveryStat.世界?.[PATH]?.人物||{},item.名称),person=personName?recoveryStat.世界[PATH].人物[personName]:null;
                        return !person||!String(person.地点||'').trim()||!String(person.目标||'').trim()||!String(person.行动||'').trim()||String(person.更新时间||'').trim()!==String(recoveryStat.世界?.时间||'').trim();
                    });
                    const needsRumorRepair=this.services.rumor.maintenanceNeeded(recoveryStat);
                    const needsWorldActivityRepair=typeof worldActivityRepairRequired==='function'&&worldActivityRepairRequired(recoveryStat);
                    if(!needsMacroRepair&&!needsScheduleRepair&&!needsLifecycleRepair&&!needsAlienRepair&&!needsWorldActivityRepair&&!needsRumorRepair){this.status='本楼层已处理，不重复结算';return false;}
                    this.status=needsWorldActivityRepair?'检测到世界活动骨架缺失 · 修复本楼层':needsMacroRepair?'检测到宏观骨架不完整 · 修复本楼层':needsScheduleRepair?'检测到事件时间锚点缺失 · 修复本楼层':needsAlienRepair?'检测到异端活动缺失 · 修复本楼层':needsRumorRepair?'检测到传闻或传播需要维护 · 修复本楼层':'检测到生命周期或时间异常 · 修复本楼层';
                }
                if (!this.isAvailable()) throw new Error(this.usesDedicatedApi()?'请在世界推进「设置」中完成专属 API 地址与模型配置':'请在主神终端设置中启用额外模型并选择模型');
                const validate = this.host.Samsara && this.host.Samsara.validateWorldState;
                if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');

                this.resetInspection();
                this.status = '正在读取世界资料'; this.render();
                const request=await this.buildRequest(base);
                if(token!==this.generation)throw new Error('请求已取消');

                const configuredAttempts=Number(this.config.retryAttempts),perModelAttempts=Math.max(1,Math.min(5,Number.isFinite(configuredAttempts)?configuredAttempts:5));
                const configuredFallback=String(this.config.fallbackModel||'').trim();
                const primaryDedicatedModel=this.usesDedicatedApi()?String(this.normalizeDedicatedApi(this.config.dedicatedApi)?.model||'').trim():'';
                const fallbackModel=configuredFallback&&configuredFallback!==primaryDedicatedModel?configuredFallback:'';
                const maxAttempts=perModelAttempts*(fallbackModel?2:1);
                const temperature=Math.max(0,Math.min(2,Number.isFinite(Number(this.config.temperature))?Number(this.config.temperature):0.3));
                let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];

                while(attempt<maxAttempts){
                    if(token!==this.generation)throw new Error('请求已取消');
                    this.controller=new AbortController();
                    timedOut=false;
                    clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;this.controller.abort();},300000);
                    const usingFallback=!!fallbackModel&&attempt>=perModelAttempts;
                    const phaseAttempt=usingFallback?attempt-perModelAttempts:attempt;
                    const attemptInput=attempt===0?request.input:(this.services?.requests?.retryInput?this.services.requests.retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan):retryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan));
                    const actualRequest=copy(request);
                    actualRequest.input=attemptInput;
                    actualRequest.manifest=Object.assign({},copy(request.manifest),{
                        观测:requestTokenTelemetry(request.system,attemptInput,request.schema),
                        尝试序号:attempt+1,
                        最大尝试次数:maxAttempts,
                        每模型最大尝试次数:perModelAttempts,
                        模型阶段:usingFallback?'备用模型':'主模型',
                        失败记录:copy(this.lastRetryLog)
                    });
                    actualRequest.manifest.观测.请求类型=attempt===0?'首次请求':usingFallback?'备用模型纠错':'纠错重试';
                    this.lastAttemptCount=attempt+1;
                    this.lastRequest=actualRequest;
                    this.status=attempt===0?'六模块联合推演中':usingFallback?'备用模型重试 '+(phaseAttempt+1)+'/'+perModelAttempts:'纠错重试 '+(phaseAttempt+1)+'/'+perModelAttempts;
                    this.render();

                    let received='',attemptTelemetry=null;
                    const attemptStarted=Date.now();this.lastTransportInfo=null;
                    try{
                        received=String(await this.requestAI(request.system,attemptInput,{signal:this.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature,model:usingFallback?fallbackModel:undefined}));
                        clearTimeout(timeout);
                        if(token!==this.generation||this.controller.signal.aborted)throw new Error('请求已取消');
                        this.lastReply=received;this.lastFailure='';
                        const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},usage=transport.usage||null,observation=actualRequest.manifest.观测;
                        Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未知',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed,输出估算Tokens:estimateTokens(received)});
                        if(usage){observation.实际输入Tokens=usage.inputTokens;observation.实际输出Tokens=usage.outputTokens;observation.实际总Tokens=usage.totalTokens;}
                        attemptTelemetry={尝试:attempt+1,结果:'待验收',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:observation.输出估算Tokens,API输入Tokens:usage?.inputTokens??null,API输出Tokens:usage?.outputTokens??null,API总Tokens:usage?.totalTokens??null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed};
                        this.lastAttemptTelemetry.push(attemptTelemetry);

                        let reply=this.services?.resultParser?.parse(received)??parseReply(received);
                        let legacyPatches=[],rejectedSlices=[];
                        if(reply.kind==='world_result'){
                            const staged=this.services?.compiler?.stage(base.stat,acceptedWorldResult,reply.worldResult,validate)??stageWorldResult(base.stat,acceptedWorldResult,reply.worldResult,validate);
                            acceptedWorldResult=staged.accepted;
                            rejectedSlices=staged.rejected;
                            if(staged.softRejected?.length)actualRequest.manifest.软失败片段=copy(staged.softRejected);
                            reply.summary=acceptedWorldResult.摘要||reply.summary;
                        } else {
                            legacyPatches=this.services?.compiler?.sanitizeLegacy(reply.patches)??sanitizeModelPatches(normalizeModelPatches(reply.patches));
                        }
                        const compileFor=sourceStat=>{
                            const patches=[],warnings=[];
                            if(acceptedWorldResult){
                                const compiled=this.services?.compiler?.compile(sourceStat,acceptedWorldResult)??compileWorldResult(sourceStat,acceptedWorldResult);
                                patches.push(...compiled.patches);warnings.push(...compiled.warnings);
                            }
                            if(legacyPatches.length)patches.push(...legacyPatches);
                            return {patches,warnings};
                        };
                        let sourceStat=base.stat,compiled=compileFor(sourceStat),modelPatches=compiled.patches;
                        this.lastWorldResult=acceptedWorldResult?copy(acceptedWorldResult):null;
                        this.lastCompiledPatches=copy(modelPatches);
                        this.lastCompileWarnings=copy(compiled.warnings);
                        let built=this.services?.compiler?.materialize(sourceStat,request.seedPatches,modelPatches)??materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                        let next=built.next;
                        let globalError=null;
                        try{
                            if(this.services?.validation)this.services.validation.validate(next,request,acceptedWorldResult,base.stat);
                            else{
                                ensureDueHandled(next,request.due,base.stat.世界.时间);
                                ensureEventTimeAnchors(next,request.unscheduled);
                                ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                ensureNpcBuildAuditProgress(next,request.npcAudit,acceptedWorldResult);
                                ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                            }
                        }catch(error){globalError=error;}
                        if(globalError||(rejectedSlices.length&&attempt+1<maxAttempts))throw makeRetryFailure(rejectedSlices,globalError);
                        if(rejectedSlices.length){
                            const partialFailure=makeRetryFailure(rejectedSlices,null);
                            const partialPlan=Array.isArray(partialFailure.retryPlan)?copy(partialFailure.retryPlan):[];
                            this.lastRetryLog.push({尝试:attempt+1,类型:'局部片段已丢弃',错误:String(partialFailure.message||partialFailure),片段:copy(rejectedSlices),补充清单:partialPlan});
                            actualRequest.manifest.最终丢弃片段=copy(rejectedSlices);
                            this.lastCompileWarnings.push('重试耗尽后丢弃 '+rejectedSlices.length+' 个未通过业务片段；已通过片段继续提交');
                        }

                        const current=this.snapshot();
                        if(token!==this.generation||this.controller.signal.aborted||current.fingerprint!==base.fingerprint||this.blocked(current))throw new Error('上下文已经切换，本次结果已丢弃');
                        if(this.services?.validation?.progressionAnchorChanged(base.stat,current.stat)??progressionAnchorChanged(base.stat,current.stat))throw new Error('推演期间世界时间或副本锚点发生变化，请重新运行');

                        if(!same(current.stat,base.stat)){
                            sourceStat=current.stat;
                            compiled=compileFor(sourceStat);modelPatches=compiled.patches;
                            this.lastCompiledPatches=copy(modelPatches);
                            this.lastCompileWarnings=copy(compiled.warnings);
                            built=this.services?.compiler?.materialize(sourceStat,request.seedPatches,modelPatches)??materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                            next=built.next;
                            let currentGlobalError=null;
                            try{
                                if(this.services?.validation)this.services.validation.validate(next,request,acceptedWorldResult,base.stat,{includeNpcAudit:false});
                                else{
                                    ensureDueHandled(next,request.due,base.stat.世界.时间);
                                    ensureEventTimeAnchors(next,request.unscheduled);
                                    ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                    ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                    ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                    ensureMacroBackbone(next,request.timeline,this.config.requireMacroBackbone!==false);
                                }
                            }catch(error){currentGlobalError=error;}
                            if(currentGlobalError)throw makeRetryFailure([],currentGlobalError);
                        }
                        const committedPatches=built.appliedSeeds.concat(modelPatches,built.repairPatches);
                        if(this.services?.commit){
                            const finalized=this.services.commit.prepare({
                                next,committedPatches,base,acceptedWorldResult,reply,validate
                            });
                            next=finalized.next;reply=finalized.reply;
                        }else{
                            if (!(next.设置 || {}).世界超稳) {
                                const offsets=(next.世界.因果轨道||{}).偏移记录||{};
                                const total=Object.values(offsets).reduce((n,r)=>n+(Number(r.影响程度)||0),0);
                                next.世界.稳定=Math.max(0,Math.min(120,100+total));
                            }
                            next.世界[PATH].已处理楼层=base.fingerprint;
                            next.世界[PATH].已处理时间=base.stat.世界.时间;
                            const changes=committedPatches.map(p=>{
                                const parts=tokens(p.path),back=parts[1]===PATH,asset=parts[0]==='资产';
                                return {时间:base.stat.世界.时间,类别:asset?'资产':back?parts[2]:parts[1],名称:asset?parts[1]:back?parts[3]:parts[2],字段:asset?'资产':parts.at(-1),操作:p.op==='add'?'新增':p.op==='remove'?'移除':'更新',内容:typeof p.value==='string'?p.value:plain(p.value)?(p.value.描述||p.value.行动||p.value.事实||p.value.目标||p.value.状态||p.value.内容||'记录已更新'):''};
                            });
                            next.世界[PATH].最近变化=changes.slice(-100);
                            if(typeof this.beforeWorldCommit==='function')this.beforeWorldCommit(next,{
                                messageId:base.id,fingerprint:base.fingerprint,worldResult:acceptedWorldResult,reply:copy(reply),baseStat:base.stat
                            });
                            const checked=validate(next);
                            for(const patch of committedPatches){
                                if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                            }
                            reply.patches=committedPatches;
                        }
                        prepared={reply,next,current};
                        if(attemptTelemetry)attemptTelemetry.结果='接受';
                        break;
                    }catch(error){
                        clearTimeout(timeout);
                        if(attemptTelemetry){attemptTelemetry.结果='拒绝';attemptTelemetry.原因=String(error.message||error);}
                        else{
                            const elapsed=Math.max(0,Date.now()-attemptStarted),transport=this.lastTransportInfo||{},observation=actualRequest.manifest.观测;
                            Object.assign(observation,{接口来源:transport.接口||this.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未返回',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed});
                            this.lastAttemptTelemetry.push({尝试:attempt+1,结果:'请求失败',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:0,API输入Tokens:null,API输出Tokens:null,API总Tokens:null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed,原因:String(error.message||error)});
                        }
                        lastError=error;
                        lastRejectedReply=received||'';
                        lastRetryPlan=Array.isArray(error?.retryPlan)?copy(error.retryPlan):retryPlanForFailure(error,[]);
                        const retryableFailure=timedOut===true?true:(this.services?.requests?.retryableModelFailure?this.services.requests.retryableModelFailure(error):retryableModelFailure(error));
                        if(retryableFailure)this.lastRetryLog.push({尝试:attempt+1,类型:received?'模型回复被拒绝':'请求失败',错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                        const canRetry=retryableFailure&&attempt+1<maxAttempts;
                        if(!canRetry)throw error;
                        attempt++;
                        const nextUsesFallback=!!fallbackModel&&attempt>=perModelAttempts;
                        const nextPhaseAttempt=nextUsesFallback?attempt-perModelAttempts:attempt;
                        this.status=nextUsesFallback?'主模型连续失败 · 切换备用模型 '+(nextPhaseAttempt+1)+'/'+perModelAttempts:'回复未通过 · 自动纠错 '+(nextPhaseAttempt+1)+'/'+perModelAttempts;
                        this.render();
                    }
                }

                if(!prepared)throw lastError||new Error('世界推演未生成可写入结果');
                this.committing=true;
                if(this.services?.commit)await this.services.commit.persist(prepared,base);
                else{
                    const result=prepared.current.raw;
                    result.stat_data=prepared.next;
                    const replay=typeof this.buildWorldReplayPackage==='function'
                        ?this.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint):null;
                    if(replay)result.__samsaraWorldReplay=replay;
                    await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                }
                this.status='已更新 · '+prepared.reply.summary+(this.lastRetryLog.length?' · 前序失败'+this.lastRetryLog.length+'次':'');
                return true;
            } catch (error) {
                const failureMessage=error.name==='AbortError'?(timedOut?'请求超时（300秒）':'请求已取消'):String(error.message||error);
                this.lastFailure=failureMessage;
                const retryNote=this.lastRetryLog?.length?' · 已记录失败'+this.lastRetryLog.length+'次':'';
                this.status=(this.committing?'写入未确认 · ':'未写入 · ')+failureMessage+retryNote;
                if(!(error.name==='AbortError'&&!timedOut))this.notifyFailure(this.status);
                throw error;
            } finally {
                clearTimeout(timeout); if(this.controller)this.controller=null; this.committing=false; this.busy=false; this.render();
                if (this.pending) { this.pending = false; this.schedule(); }
            }
        
            }).call(engine);
        }
    }
