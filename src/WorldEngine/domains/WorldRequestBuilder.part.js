    class WorldRequestBuilder {
        constructor(engine){this.engine=engine;}
        async build(base){
            const engine=this.engine;
            return await (async function(base){
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
                            const count=Math.max(1,Math.min(100,Number(this.config.contextTurns)||6));
                            const id=Number(base.message.message_id??base.message.id);
                            // 先清洗所有历史候选，再取最近 N 条非空正文；技术楼层再多也不会挤掉正文名额。
                            const messages=await this.fn('getChatMessages')('0-'+id);
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
                            const macroRequirement=this.config.requireMacroBackbone!==false&&timeline.需要补充远期?{
                                已有可推进宏观节点:openMacro.map(([名称,event])=>({名称,状态:event.状态})),
                                至少补充节点数:Math.max(0,3-openMacro.length),
                                交付要求:macroBackbonePlan(openMacro.length,activeMacroCount,openMacro.length-activeMacroCount),
                                规划与发生:'本轮必须补齐骨架，不能以时间未推进、正文没有宏观变化或无业务变化为由省略。建立待发生节点属于未来规划，可排在下一宏观边界之后，不表示事件现在发生；近期细节与已发生事实仍受本轮时间容量和下一宏观边界限制。不得为凑数提前原著日期，或预先结算未来事件的结果；更新时间使用当前世界时间。',
                                验收:'按已有状态与本轮结果合并后计数；若本轮结束或取消已有宏观节点，须补足被移出窗口的数量。重试时以已接受业务结果和最新补充清单为准，不重复创建已接受节点。'
                            }:undefined;
                            const proseScan=floors.map(f=>f.正文).join('\n');
                            const chronologyScan=needBackbone?[state.世界.名称,'原著','时间线','时间轴','年表','大事记','大事件','剧情大纲','剧情章节','章节','未来','后续'].filter(Boolean).join(' '):'';
                            const books=await this.worldbook([proseScan,chronologyScan].filter(Boolean).join('\n'),{timelineBackbone:needBackbone});
                            const now=worldDateKey(state.世界.时间);
                            const due=Object.entries(state.世界[PATH].事件).filter(([,e])=>e.状态==='待发生'&&now!==null&&worldDateKey(e.时间||e.开始时间)!==null&&worldDateKey(e.时间||e.开始时间)<=now).map(([名称,e])=>({名称,时间:e.时间||e.开始时间,条件:e.条件,前因:e.前因,说明:'时间已到；逐项核验条件与前因，符合则转进行中；未符合必须更新下次检查并解释阻碍，不得无声跳过。'}));
                            const unscheduled=unscheduledEvents(state);
                            const staleActive=staleActiveEvents(state);
                            const timeAnomalies=temporalAnomalies(state);
                            const capacity=worldTimeCapacity(state.世界[PATH].已处理时间,state.世界.时间);
                            const npcAudit=npcBuildAudit(state);
                            const input=JSON.stringify({
                                输入语义:{
                                    世界书:'可选设定/原著差异/时间资料；不是已发生事实，没有世界书也必须正常推演。',
                                    当前变量:'世界推进专用热数据投影；含世界、人物能力、完整资产账簿、活跃传播、近期因果偏移，以及“近期原始锚点 + 更早根总结”组成的分层长期历史记忆。原始历史永久留在MVU，已被上层总结收纳的旧节点不再重复进入热上下文。资产通过WorldResult.资产与同一顶层账簿双向同步；未提供的任务/商城/纯结算数据不属于本引擎职责。',
                                    正文楼层:'已经演出的剧情；用于确认当前事实与时间跨度，不复述成后台日常。',
                                    程序结构修复:'引擎已做的确定性纠正；不得在输出中恢复被程序降级/修正的旧错误。',
                                    时间线调度:'程序计算出的宏观边界与到期复核要求；模型负责语义推演，不重定义调度协议。',
                                    WorldResult:'唯一业务交付物；不包含 JSON Pointer、add/replace 路径或程序日志。',
                                    角色管理:'若提供NPC构筑审计，只处理列出的既有NPC缺口；完整构筑资料只在审计对象中提供，避免全量NPC重复占用上下文。'
                                },
                                本轮必须完成的宏观骨架:macroRequirement,
                                世界书:books.map(b=>String(b.内容||'')).filter(Boolean),
                                当前变量:(this.services?.stateProjector?.world(state)??projectWorldContext(state)),
                                角色管理:npcAudit.length?{NPC构筑审计:npcAudit}:undefined,
                                正文楼层:floors,
                                程序结构修复:structuralFixes,
                                本轮时间容量:capacity,
                                时间线调度:timeline,
                                推演阶段:{宏观优先:true,宏观骨架状态:needBackbone?'需要建立或补足':'已具备可用宏观骨架',近期细节边界:timeline.下一宏观节点?.名称||'先建立下一宏观节点',知识来源:'当前确认事实 > 明确世界书设定（若有） > 模型已有原著/世界知识 > 谨慎推断'},
                                正文可见投影规则:{
                                    当前时间:state.世界.时间,
                                    当前地点:state.世界.地点,
                                    要求:'非战斗正文会读取完整因果轨道：当前阶段用于当前局势，故事线/下一节点用于长期叙事方向，偏移记录用于跨章因果记忆；这些是规划依据，不等于角色预知或自动知晓幕后信息。正文还会读取进行中当前事件的公开字段，以及程序筛选的场外场景：每个热地区只出现一次共享环境/现场群体，人物列表只携带各自行动事实，关联事件只作索引；活跃异端始终保留在其所在热场景。以上均用于叙事连续性，不代表角色已知。可能影响当前场景的当前事件应维护公开征兆和可见影响；不要把隐藏条件、默认走向或未来宏观事件详情塞进公开字段。'
                                },
                                可选宏观资料补充:needBackbone,
                                本轮必须复核的到期事件:due,
                                本轮必须补全的事件时间锚点:unscheduled,
                                本轮必须复核的超期活动事件:staleActive,
                                本轮必须修复的时间越界记录:timeAnomalies,
                                本轮必须维持的异端活动:alienActivity,
                                生命周期整理:lifecycle,
                                说明:'当前变量为已确认热事实，不重复结算；已归档旧事件和已回收传播不要重新创建；世界书为空不构成阻塞；只提交业务事实，存储路径由程序编译。'
                            },null,2);
                            const stabilityPrompt=worldStabilityPrompt(state,this.config.stabilityPromptTemplate??DEFAULT_STABILITY_PROMPT_TEMPLATE);
                            const macroPrompt=macroRequirement?(this.config.macroPrompt??DEFAULT_MACRO_PROMPT):'';
                            const corePrompt=this.config.corePrompt??CORE_WORLD_RULES;
                            const system=this.config.preset+(corePrompt?'\n\n'+corePrompt:'')+(macroPrompt?'\n\n'+macroPrompt:'')+(stabilityPrompt?'\n\n'+stabilityPrompt:'')+(npcAudit.length?'\n\n'+(this.config.npcAuditPrompt??NPC_BUILD_AUDIT_RULES):'')+'\n\n【WorldResult 业务输出协议】\n'+((this.config.structurePrompt??protocol().split('【Canonical WorldResult JSON Schema】')[0].trim())+'\n\n【Canonical WorldResult JSON Schema】\n程序实际字段定义（不可由文字说明改变）：\n'+JSON.stringify(WORLD_RESULT_SCHEMA,null,2));
                            return {system,input,schema:copy(WORLD_RESULT_SCHEMA),seedPatches,due,unscheduled,staleActive,timeAnomalies,alienActivity,npcAudit:copy(npcAudit),timeline:copy(timeline),manifest:{输出协议:'WorldResult v1',结构化输出:'auto',接口来源:this.apiSourceLabel(),读取判定:copy(books.report||[]),世界书读取:{实际读取:books.length,检查条目:(books.report||[]).length,跳过:Math.max(0,(books.report||[]).length-books.length)},世界书条目:books.map(b=>({世界书:b.世界书,条目ID:b.条目ID,名称:b.名称,估算Tokens:estimateTokens(b.内容)})),正文楼层:floors.map(f=>({楼层:f.楼层,角色:f.角色,估算Tokens:estimateTokens(f.正文)})),导入节点:seedPatches.map(p=>tokens(p.path).at(-1)),到期节点:due.map(e=>e.名称),待补时间锚点:unscheduled.map(e=>e.名称),超期活动事件:staleActive.map(e=>e.名称),时间越界记录:timeAnomalies.map(e=>e.类型+'/'+e.名称),程序结构修复:copy(structuralFixes),生命周期整理:copy(lifecycle),NPC构筑审计:npcAudit.map(x=>({名称:x.名称,审计级别:x.审计级别,缺口:copy(x.缺口)})),本轮时间容量:copy(capacity),可选宏观资料补充:needBackbone,观测:requestTokenTelemetry(system,input,WORLD_RESULT_SCHEMA)}};
            }).call(engine,base);
        }
    }
