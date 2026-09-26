    // 请求构建服务：负责读取正文/世界书/热状态并组装首次 WorldResult 请求。
    class WorldEngineRequestBuilderService {
        constructor(engine,prompts){this.engine=engine;this.prompts=prompts;}
        async build(base) {
            const engine=this.engine,get=(key,vars={})=>this.prompts.get(key,vars);
            ACTIVE_WORLD_PROMPT_SERVICE=this.prompts;
                const state=copy(base.stat);
                state.世界[PATH]=Object.assign(emptyState(),state.世界[PATH]||{});
                normalizeBackendState(state);
                const structuralFixes=normalizeEventLayers(state);
                const lifecycle=compactWorldLifecycle(state);
                const alienActivity=activeAlienActivityRequirements(state);
                const seedPatches=importStory(state);
                // 缺少后台人物的活跃异端只在本次请求副本中放一个空壳，帮助模型明确这是待补活动；
                // 不把空壳作为正式 seed patch，避免与本轮模型真正创建的人物记录发生 add/add 冲突。
                seedMissingAlienPeople(state,alienActivity);
                for(const patch of seedPatches){const parts=tokens(patch.path);if(parts[2]==='事件')state.世界[PATH].事件[parts.at(-1)]=patch.value;}
                structuralFixes.push(...normalizeEventLayers(state));
                structuralFixes.push(...repairCausalProjection(state));
                structuralFixes.push(...repairMacroPredecessors(state));
                structuralFixes.push(...repairExplicitEventLinks(state));
                if(state.设置)delete state.设置.API;
                if(state.设置?.世界超稳===true)state.世界.稳定=100;
                delete state.商城;
                const count=Math.max(1,Math.min(100,Number(engine.config.contextTurns)||6));
                const id=Number(base.message.message_id??base.message.id);
                // 先清洗所有历史候选，再取最近 N 条非空正文；技术楼层再多也不会挤掉正文名额。
                const messages=await engine.fn('getChatMessages')('0-'+id);
                const isAssistant=m=>{
                    const role=String(m?.role||'').toLowerCase();
                    if(!m||m.is_hidden||m.is_user===true||role==='user'||role==='system')return false;
                    return role==='assistant'||!role;
                };
                const floors=messages.filter(m=>Number(m.message_id??m.id)<=id&&isAssistant(m))
                    .sort((a,b)=>Number(a.message_id??a.id)-Number(b.message_id??b.id))
                    .map(m=>({楼层:m.message_id??m.id,角色:'assistant',正文:extractWorldProse(m.message??m.mes??'')}))
                    .filter(f=>f.正文).slice(-count);
                if(!floors.length)throw new Error('未读到可用AI正文：楼层为空或仅含思考、变量更新与面板，请检查聊天内容');
                const timeline=timelineState(state);
                const needBackbone=timeline.需要初始化||timeline.需要补充远期;
                const openMacro=Object.entries(state.世界[PATH].事件).filter(([,event])=>event.分类==='宏观节点'&&['进行中','待发生'].includes(event.状态));
                const activeMacroCount=openMacro.filter(([,event])=>event.状态==='进行中').length;
                const macroRequirement=engine.config.requireMacroBackbone!==false&&timeline.需要补充远期?{
                    已有可推进宏观节点:openMacro.map(([名称,event])=>({名称,状态:event.状态})),
                    至少补充节点数:Math.max(0,3-openMacro.length),
                    交付要求:macroBackbonePlan(openMacro.length,activeMacroCount,openMacro.length-activeMacroCount),
                    规划与发生:get('macro.planning'),
                    验收:get('macro.acceptance')
                }:undefined;
                const proseScan=floors.map(f=>f.正文).join('\n');
                const chronologyScan=needBackbone?[state.世界.名称,'原著','时间线','时间轴','年表','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' '):'';
                const books=await engine.worldbook([proseScan,chronologyScan].filter(Boolean).join('\n'),{timelineBackbone:needBackbone});
                const now=worldDateKey(state.世界.时间);
                const due=Object.entries(state.世界[PATH].事件).filter(([,e])=>e.状态==='待发生'&&now!==null&&worldDateKey(e.时间||e.开始时间)!==null&&worldDateKey(e.时间||e.开始时间)<=now).map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因,说明:get('due.review')}));
                const unscheduled=unscheduledEvents(state);
                const staleActive=staleActiveEvents(state);
                const timeAnomalies=temporalAnomalies(state);
                const capacity=worldTimeCapacity(state.世界[PATH].已处理时间,state.世界.时间);
                const npcAudit=npcBuildAudit(state);
                const input=JSON.stringify({
                    输入语义:{
                        世界书:get('input.worldbook'),
                        当前变量:get('input.currentState'),
                        正文楼层:get('input.prose'),
                        程序结构修复:get('input.structuralFix'),
                        时间线调度:get('input.timeline'),
                        WorldResult:get('input.worldResult'),
                        角色管理:get('input.personAudit'),
                        任务列表:get('input.taskList')
                    },
                    本轮必须完成的宏观骨架:macroRequirement,
                    世界书:books.map(b=>String(b.内容||'')).filter(Boolean),
                    当前变量:projectWorldContext(state),
                    角色管理:npcAudit.length?{NPC构筑审计:npcAudit}:undefined,
                    正文楼层:floors,
                    程序结构修复:structuralFixes,
                    本轮时间容量:capacity,
                    时间线调度:timeline,
                    推演阶段:{宏观优先:true,宏观骨架状态:needBackbone?'需要建立或补足':'已具备可用宏观骨架',近期细节边界:timeline.下一宏观节点?.名称||'先建立下一宏观节点',知识来源:get('stage.knowledgePriority')},
                    正文可见投影规则:{
                        当前时间:state.世界.时间,
                        当前地点:state.世界.地点,
                        要求:get('proseProjection.requirement')
                    },
                    可选宏观资料补充:needBackbone,
                    本轮必须复核的到期事件:due,
                    本轮必须补全的事件时间锚点:unscheduled,
                    本轮必须复核的超期活动事件:staleActive,
                    本轮必须修复的时间越界记录:timeAnomalies,
                    本轮必须维持的异端活动:alienActivity,
                    生命周期整理:lifecycle,
                    说明:get('request.finalNote')
                },null,2);
                const stabilityPrompt=worldStabilityPrompt(state,engine.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE);
                const macroPrompt=macroRequirement?(engine.config.macroPrompt??DEFAULT_MACRO_PROMPT):'';
                const corePrompt=engine.config.corePrompt??CORE_WORLD_RULES;
                const system=engine.config.preset+(corePrompt?'\n\n'+corePrompt:'')+(macroPrompt?'\n\n'+macroPrompt:'')+(stabilityPrompt?'\n\n'+stabilityPrompt:'')+(npcAudit.length?'\n\n'+(engine.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\n\n'+get('system.worldResultHeading')+'\n'+((engine.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\n\n'+get('system.schemaHeading')+'\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));
                return {system,input,schema:copy(WORLD_RESULT_SCHEMA),seedPatches,due,unscheduled,staleActive,timeAnomalies,alienActivity,npcAudit:copy(npcAudit),timeline:copy(timeline),manifest:{输出协议:'WorldResult v1',结构化输出:'auto',接口来源:engine.apiSourceLabel(),读取判定:copy(books.report||[]),世界书读取:{实际读取:books.length,检查条目:(books.report||[]).length,跳过:Math.max(0,(books.report||[]).length-books.length)},世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,估算Tokens:estimateTokens(b.内容)})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,估算Tokens:estimateTokens(f.正文)})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),待补时间锚点:unscheduled.map(e=>e.名称),超期活动事件:staleActive.map(e=>e.名称),时间越界记录:timeAnomalies.map(e=>e.类型+'/'+e.名称),程序结构修复:copy(structuralFixes),生命周期整理:copy(lifecycle),NPC构筑审计:npcAudit.map(x=>({名称:x.名称,审计级别:x.审计级别,缺口:copy(x.缺口)})),本轮时间容量:copy(capacity),可选宏观资料补充:needBackbone,观测:requestTokenTelemetry(system,input,WORLD_RESULT_SCHEMA)}};
        }
    }
