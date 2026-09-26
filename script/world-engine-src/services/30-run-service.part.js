    // 推进运行服务：负责一次完整的请求、纠错重试、验收、提交与失败处理事务。
    class WorldEngineRunService {
        constructor(engine){this.engine=engine;}
            async run() {
                const engine=this.engine;
                if (engine.disposed || engine.busy) return false;
                if (!engine.isConfigured()) { engine.status='世界推进已关闭'; engine.render(); return false; }
                const terminal = engine.host.Samsara && engine.host.Samsara.terminal;
                engine.busy = true; const token = engine.generation; let timeout, timedOut=false;
                try {
                    const base = engine.snapshot(), reason = engine.blocked(base);
                    if (reason) { engine.status = reason; return false; }
                    const old = Object.assign(emptyState(),base.stat.世界[PATH] || {});
                    if (old.已处理楼层 === base.fingerprint) {
                        const recoveryStat=copy(base.stat);
                        recoveryStat.世界[PATH]=Object.assign(emptyState(),recoveryStat.世界[PATH]||{});
                        normalizeBackendState(recoveryStat);
                        const recoveryTimeline=timelineState(recoveryStat);
                        const needsMacroRepair=engine.config.requireMacroBackbone!==false&&(recoveryTimeline.需要补充远期||recoveryTimeline.因果轨道需重建);
                        const needsScheduleRepair=unscheduledEvents(recoveryStat).length>0;
                        const needsLifecycleRepair=staleActiveEvents(recoveryStat).length>0||temporalAnomalies(recoveryStat).length>0;
                        const needsAlienRepair=activeAlienActivityRequirements(recoveryStat).some(item=>{
                            const personName=stableNameIn(recoveryStat.世界?.[PATH]?.人物||{},item.名称),person=personName?recoveryStat.世界[PATH].人物[personName]:null;
                            return !person||!String(person.地点||'').trim()||!String(person.目标||'').trim()||!String(person.行动||'').trim()||String(person.更新时间||'').trim()!==String(recoveryStat.世界?.时间||'').trim();
                        });
                        const needsWorldActivityRepair=typeof worldActivityRepairRequired==='function'&&worldActivityRepairRequired(recoveryStat);
                        if(!needsMacroRepair&&!needsScheduleRepair&&!needsLifecycleRepair&&!needsAlienRepair&&!needsWorldActivityRepair){engine.status='本楼层已处理，不重复结算';return false;}
                        engine.status=needsWorldActivityRepair?'检测到世界活动骨架缺失 · 修复本楼层':needsMacroRepair?'检测到宏观骨架不完整 · 修复本楼层':needsScheduleRepair?'检测到事件时间锚点缺失 · 修复本楼层':needsAlienRepair?'检测到异端活动缺失 · 修复本楼层':'检测到生命周期或时间异常 · 修复本楼层';
                    }
                    if (!engine.isAvailable()) throw new Error(engine.usesDedicatedApi()?'请在世界推进「设置」中完成专属 API 地址与模型配置':'请在主神终端设置中启用额外模型并选择模型');
                    const validate = engine.host.Samsara && engine.host.Samsara.validateWorldState;
                    if (!validate) throw new Error('请加载更新后的 ZOD脚本.js');
    
                    engine.resetInspection();
                    engine.status = '正在读取世界资料'; engine.render();
                    const request=await engine.buildRequest(base);
                    if(token!==engine.generation)throw new Error('请求已取消');
    
                    const configuredAttempts=Number(engine.config.retryAttempts),maxAttempts=Math.max(1,Math.min(5,Number.isFinite(configuredAttempts)?configuredAttempts:5));
                    let attempt=0,lastError=null,lastRejectedReply='',prepared=null,acceptedWorldResult=null,lastRetryPlan=[];
    
                    while(attempt<maxAttempts){
                        if(token!==engine.generation)throw new Error('请求已取消');
                        engine.controller=new AbortController();
                        timedOut=false;
                        clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;engine.controller.abort();},300000);
                        const attemptInput=attempt===0?request.input:engine.buildRetryInput(request.input,lastError,lastRejectedReply,attempt,maxAttempts,acceptedWorldResult,lastRetryPlan);
                        const actualRequest=copy(request);
                        actualRequest.input=attemptInput;
                        actualRequest.manifest=Object.assign({},copy(request.manifest),{
                            观测:requestTokenTelemetry(request.system,attemptInput,request.schema),
                            尝试序号:attempt+1,
                            最大尝试次数:maxAttempts,
                            失败记录:copy(engine.lastRetryLog)
                        });
                        actualRequest.manifest.观测.请求类型=attempt===0?'首次请求':'纠错重试';
                        engine.lastAttemptCount=attempt+1;
                        engine.lastRequest=actualRequest;
                        engine.status=attempt===0?'六模块联合推演中':'纠错重试 '+(attempt+1)+'/'+maxAttempts;
                        engine.render();
    
                        let received='',attemptTelemetry=null;
                        const attemptStarted=Date.now();engine.lastTransportInfo=null;
                        try{
                            received=String(await engine.requestAI(request.system,attemptInput,{signal:engine.controller.signal,schema:request.schema,schemaName:'samsara_world_result_v1',structured:'auto',temperature:0.3}));
                            clearTimeout(timeout);
                            if(token!==engine.generation||engine.controller.signal.aborted)throw new Error('请求已取消');
                            engine.lastReply=received;engine.lastFailure='';
                            const elapsed=Math.max(0,Date.now()-attemptStarted),transport=engine.lastTransportInfo||{},usage=transport.usage||null,observation=actualRequest.manifest.观测;
                            Object.assign(observation,{接口来源:transport.接口||engine.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未知',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed,输出估算Tokens:estimateTokens(received)});
                            if(usage){observation.实际输入Tokens=usage.inputTokens;observation.实际输出Tokens=usage.outputTokens;observation.实际总Tokens=usage.totalTokens;}
                            attemptTelemetry={尝试:attempt+1,结果:'待验收',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:observation.输出估算Tokens,API输入Tokens:usage?.inputTokens??null,API输出Tokens:usage?.outputTokens??null,API总Tokens:usage?.totalTokens??null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed};
                            engine.lastAttemptTelemetry.push(attemptTelemetry);
    
                            const reply=parseReply(received);
                            let legacyPatches=[],rejectedSlices=[];
                            if(reply.kind==='world_result'){
                                const staged=stageWorldResult(base.stat,acceptedWorldResult,reply.worldResult,validate);
                                acceptedWorldResult=staged.accepted;
                                rejectedSlices=staged.rejected;
                                reply.summary=acceptedWorldResult.摘要||reply.summary;
                            } else {
                                legacyPatches=sanitizeModelPatches(normalizeModelPatches(reply.patches));
                            }
                            const compileFor=sourceStat=>{
                                const patches=[],warnings=[];
                                if(acceptedWorldResult){
                                    const compiled=compileWorldResult(sourceStat,acceptedWorldResult);
                                    patches.push(...compiled.patches);warnings.push(...compiled.warnings);
                                }
                                if(legacyPatches.length)patches.push(...legacyPatches);
                                return {patches,warnings};
                            };
                            let sourceStat=base.stat,compiled=compileFor(sourceStat),modelPatches=compiled.patches;
                            engine.lastWorldResult=acceptedWorldResult?copy(acceptedWorldResult):null;
                            engine.lastCompiledPatches=copy(modelPatches);
                            engine.lastCompileWarnings=copy(compiled.warnings);
                            let built=materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                            let next=built.next;
                            let globalError=null;
                            try{
                                ensureDueHandled(next,request.due,base.stat.世界.时间);
                                ensureEventTimeAnchors(next,request.unscheduled);
                                ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                ensureNpcBuildAuditProgress(next,request.npcAudit,acceptedWorldResult);
                                ensureMacroBackbone(next,request.timeline,engine.config.requireMacroBackbone!==false);
                            }catch(error){globalError=error;}
                            if(rejectedSlices.length||globalError)throw makeRetryFailure(rejectedSlices,globalError);
    
                            const current=engine.snapshot();
                            if(token!==engine.generation||engine.controller.signal.aborted||current.fingerprint!==base.fingerprint||engine.blocked(current))throw new Error('上下文已经切换，本次结果已丢弃');
                            if(progressionAnchorChanged(base.stat,current.stat))throw new Error('推演期间世界时间或副本锚点发生变化，请重新运行');
    
                            if(!same(current.stat,base.stat)){
                                sourceStat=current.stat;
                                compiled=compileFor(sourceStat);modelPatches=compiled.patches;
                                engine.lastCompiledPatches=copy(modelPatches);
                                engine.lastCompileWarnings=copy(compiled.warnings);
                                built=materializeWorldUpdate(sourceStat,request.seedPatches,modelPatches);
                                next=built.next;
                                let currentGlobalError=null;
                                try{
                                    ensureDueHandled(next,request.due,base.stat.世界.时间);
                                    ensureEventTimeAnchors(next,request.unscheduled);
                                    ensureStaleActiveHandled(next,request.staleActive,base.stat.世界.时间);
                                    ensureTemporalAnomaliesResolved(next,request.timeAnomalies);
                                    ensureActiveAlienActivity(next,request.alienActivity,acceptedWorldResult,base.stat.世界.时间);
                                    ensureMacroBackbone(next,request.timeline,engine.config.requireMacroBackbone!==false);
                                }catch(error){currentGlobalError=error;}
                                if(currentGlobalError)throw makeRetryFailure([],currentGlobalError);
                            }
                            const committedPatches=built.appliedSeeds.concat(modelPatches,built.repairPatches);
    
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
                            // 推演记录已由历史锚点取代，不再持久化。
                            // 可选提交装饰钩子：用于把本轮派生元数据与主世界结果原子落库，避免额外 MVU 写回。
                            if(typeof engine.beforeWorldCommit==='function')engine.beforeWorldCommit(next,{
                                messageId:base.id,fingerprint:base.fingerprint,worldResult:acceptedWorldResult,reply:copy(reply),baseStat:base.stat
                            });
    
                            const checked=validate(next);
                            for(const patch of committedPatches){
                                if(patch.op!=='remove'&&!same(get(checked,tokens(patch.path)),get(next,tokens(patch.path))))throw schemaMismatchError(next,checked,patch.path);
                            }
                            reply.patches=committedPatches;
                            prepared={reply,next,current};
                            if(attemptTelemetry)attemptTelemetry.结果='接受';
                            break;
                        }catch(error){
                            clearTimeout(timeout);
                            if(attemptTelemetry){attemptTelemetry.结果='拒绝';attemptTelemetry.原因=String(error.message||error);}
                            else{
                                const elapsed=Math.max(0,Date.now()-attemptStarted),transport=engine.lastTransportInfo||{},observation=actualRequest.manifest.观测;
                                Object.assign(observation,{接口来源:transport.接口||engine.apiSourceLabel(),模型:transport.模型||'',结构化实际模式:transport.结构化模式||'未返回',模式尝试:copy(transport.尝试模式||[]),耗时毫秒:elapsed});
                                engine.lastAttemptTelemetry.push({尝试:attempt+1,结果:'请求失败',输入估算Tokens:observation.请求估算Tokens,输出估算Tokens:0,API输入Tokens:null,API输出Tokens:null,API总Tokens:null,接口:observation.接口来源,模型:observation.模型,结构化模式:observation.结构化实际模式,模式尝试:copy(observation.模式尝试||[]),耗时毫秒:elapsed,原因:String(error.message||error)});
                            }
                            lastError=error;
                            lastRejectedReply=received||engine.lastReply||'';
                            lastRetryPlan=Array.isArray(error?.retryPlan)?copy(error.retryPlan):retryPlanForFailure(error,[]);
                            const rejectedByModel=!!received&&retryableModelFailure(error);
                            if(rejectedByModel)engine.lastRetryLog.push({尝试:attempt+1,错误:String(error.message||error),片段:Array.isArray(error?.rejectedSlices)?copy(error.rejectedSlices):[],补充清单:copy(lastRetryPlan)});
                            const canRetry=rejectedByModel&&attempt+1<maxAttempts;
                            if(!canRetry)throw error;
                            attempt++;
                            engine.status='回复未通过 · 自动纠错 '+(attempt+1)+'/'+maxAttempts;
                            engine.render();
                        }
                    }
    
                    if(!prepared)throw lastError||new Error('世界推演未生成可写入结果');
                    engine.committing=true;
                    const result=prepared.current.raw;
                    result.stat_data=prepared.next;
                    const replay=typeof engine.buildWorldReplayPackage==='function'
                        ?engine.buildWorldReplayPackage(base.stat,prepared.next,base.fingerprint):null;
                    if(replay)result.__samsaraWorldReplay=replay;
                    await prepared.current.mvu.replaceMvuData(result,{type:'message',message_id:base.id});
                    engine.status='已更新 · '+prepared.reply.summary+(engine.lastRetryLog.length?' · 前序失败'+engine.lastRetryLog.length+'次':'');
                    return true;
                } catch (error) {
                    const failureMessage=error.name==='AbortError'?(timedOut?'请求超时（300秒）':'请求已取消'):String(error.message||error);
                    engine.lastFailure=failureMessage;
                    const retryNote=engine.lastRetryLog?.length?' · 已记录失败'+engine.lastRetryLog.length+'次':'';
                    engine.status=(engine.committing?'写入未确认 · ':'未写入 · ')+failureMessage+retryNote;
                    if(!(error.name==='AbortError'&&!timedOut))engine.notifyFailure(engine.status);
                    throw error;
                } finally {
                    clearTimeout(timeout); if(engine.controller)engine.controller=null; engine.committing=false; engine.busy=false; engine.render();
                    if (engine.pending) { engine.pending = false; engine.schedule(); }
                }
            }
    }
