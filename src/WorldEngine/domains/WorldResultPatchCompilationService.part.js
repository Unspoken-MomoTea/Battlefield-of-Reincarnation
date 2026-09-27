    class WorldResultPatchCompilationService {
        constructor(normalizer,exploration,causal,patchPolicy,npcAudit,people,taskLedger,chronology,timePolicy,relationSync,assetPolicy){
            this.normalizer=normalizer||DEFAULT_WORLD_RESULT_NORMALIZER;
            this.exploration=exploration||DEFAULT_WORLD_EXPLORATION_SERVICE;
            this.causal=causal||DEFAULT_WORLD_CAUSAL_SERVICE;
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.npcAudit=npcAudit||DEFAULT_WORLD_NPC_AUDIT_SERVICE;
            this.people=people||DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE;
            this.taskLedger=taskLedger||DEFAULT_WORLD_TASK_AWARENESS_SERVICE;
            this.chronology=chronology||DEFAULT_WORLD_CHRONOLOGY_POLICY;
            this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;
            this.relationSync=relationSync||DEFAULT_WORLD_RELATION_SYNC_POLICY;
            this.assetPolicy=assetPolicy||DEFAULT_WORLD_ASSET_MATERIALIZATION_POLICY;
        }
        resultFields(item,sample) {
            const out={};
            for(const key of Object.keys(sample||{}))if(Object.hasOwn(item,key))out[key]=copy(item[key]);
            return out;
        }
        compile(stat,value) {
            const originalStat=stat,initial=this.normalizer.normalizeWorldResult(value),timing=this.timePolicy.prepareCompile(originalStat,initial);
            stat=timing.validationStat;
            const prepared=this.people.normalizeAlienActivityTimestamps(stat,timing.result);
            const result=this.normalizer.normalizeWorldResult(prepared),patches=[],warnings=[];
            this.npcAudit.normalizeNewEquipment(stat,result);
            const droppedCausalOffsets=this.causal.prepareResult(stat,result);
            this.chronology.validate(stat,result);
            this.taskLedger.validateReferences(stat,result);
            this.exploration.prepareResult(stat,result);
            const exists=parts=>this.patchPolicy.get(stat,this.patchPolicy.canonicalizeParts(parts,stat));
            const addEntity=(parts,item,sample,options={})=>{
                if(item.操作==='撤销本轮')return;
                let actual=this.patchPolicy.canonicalizeParts(parts,stat),old=this.patchPolicy.get(stat,actual);
                if(item.操作==='移除'){
                    if(old!==undefined&&options.removable)patches.push({op:'remove',path:this.patchPolicy.pointer(actual)});
                    return;
                }
                const record=this.resultFields(item,sample);
                if(options.person&&!old&&!Object.hasOwn(record,'所属世界'))record.所属世界=stat.世界?.名称||'';
                if(options.event&&!Object.hasOwn(record,'描述'))record.描述=item.名称;
                if(options.event){
                    const mergedEvent=Object.assign(copy(RECORDS.事件),plain(old)?old:{},record);
                    if(['待发生','进行中'].includes(mergedEvent.状态)){
                        const anchor=eventTimeAnchor(mergedEvent);
                        if(!anchor||VAGUE_EVENT_TIME.test(anchor))throw new Error('事件时间锚点缺失或过于模糊：'+item.名称+'；请填写具体世界时间/时段，或明确相对/因果时间（如“爆发后数日”“前置节点完成后当日傍晚”），禁止空值和“近期/稍后/未来/待定/未知”');
                    }
                }
                if(!Object.keys(record).length){warnings.push('忽略空业务记录：'+item.名称);return;}
                patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(actual),value:record});
            };
            for(const [key,value] of Object.entries(result.货币||{})){
                const parts=['世界','货币',key],old=this.patchPolicy.get(stat,parts);
                if(old!==value)patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value});
            }
            for(const [key,value] of Object.entries(result.历法||{})){
                const parts=['世界','历法',key],old=this.patchPolicy.get(stat,parts);
                if(!same(old,value))patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value:copy(value)});
            }
            for(const item of result.事件)addEntity(['世界',PATH,'事件',item.名称],item,{...RECORDS.事件,...MODEL_DETAILS.事件},{event:true});
            const plannedDead=new Set((result.异端||[]).filter(item=>item.操作!=='撤销本轮'&&item.状态==='死亡').map(item=>nameKey(item.名称)));
            for(const item of result.人物){
                const alien=alienRosterMatch(stat,item.名称);
                if((alien&&alien.记录?.状态==='死亡')||plannedDead.has(nameKey(item.名称))){warnings.push('异端已死亡，禁止恢复后台人物：'+item.名称);continue;}
                addEntity(['世界',PATH,'人物',item.名称],item,{...RECORDS.人物,...MODEL_DETAILS.人物},{person:true});
            }
            for(const item of result.势力地区)addEntity(['世界',PATH,'势力地区',item.名称],item,{...RECORDS.势力地区,...MODEL_DETAILS.势力地区});
            for(const item of result.传播)addEntity(['世界',PATH,'传播',item.名称],item,{...RECORDS.传播,...MODEL_DETAILS.传播},{removable:true});
            for(const item of result.历史){
                if(item.操作==='撤销本轮')continue;
                let name=item.名称,parts=['世界',PATH,'历史',name],record=this.resultFields(item,RECORDS.历史);
                if(!Object.keys(record).length){warnings.push('忽略空历史记录：'+name);continue;}
                if(this.patchPolicy.get(stat,parts)!==undefined){
                    const old=this.patchPolicy.get(stat,parts);
                    if(same(this.patchPolicy.normalizeBackendRecord('历史',record,old),old))continue;
                    let n=2;while(this.patchPolicy.get(stat,['世界',PATH,'历史',name+'#'+n])!==undefined)n++;
                    name=name+'#'+n;parts=['世界',PATH,'历史',name];
                }
                patches.push({op:'add',path:this.patchPolicy.pointer(parts),value:record});
            }
            const causal=result.因果||{};
            if(Object.hasOwn(causal,'当前阶段')){
                const parts=['世界','因果轨道','当前阶段'],old=this.patchPolicy.get(stat,parts);
                patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value:causal.当前阶段});
            }
            if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length>=3&&causal.宏观顺序.length<=5){
                const parts=['世界','因果轨道','故事线'],story=causal.宏观顺序.join(' -> '),old=this.patchPolicy.get(stat,parts);
                patches.push({op:old===undefined?'add':'replace',path:this.patchPolicy.pointer(parts),value:story});
            } else if(Array.isArray(causal.宏观顺序)&&causal.宏观顺序.length)warnings.push('宏观顺序不足3个，等待补齐后再投影因果轨道');
            for(const item of causal.偏移记录||[]){
                if((stat.设置||{}).世界超稳){warnings.push('世界超稳：忽略偏移 '+item.名称);continue;}
                addEntity(['世界','因果轨道','偏移记录',item.名称],item,EXISTING.偏移记录);
            }
            for(const item of result.势力)addEntity(['世界','势力',item.名称],item,EXISTING.势力);
            for(const item of result.资产||[]){
                if(item.操作==='撤销本轮')continue;
                const target=stableNameIn(stat.资产||{},item.名称),existing=target?(stat.资产||{})[target]:undefined;
                if(!target&&item.操作!=='移除')this.assetPolicy.validateScope(item,true);
                const tombstoneName=stableNameIn(stat?.世界?.[PATH]?.资产墓碑||{},item.名称);
                if(!target&&item.操作!=='移除'&&tombstoneName)throw new Error('资产已被用户或MVU删除，受删除保护，世界引擎不得重建：'+item.名称);
                if(item.操作==='移除'){
                    if(target)patches.push({op:'remove',path:this.patchPolicy.pointer(['资产',target])});
                    else warnings.push('资产对象不存在，忽略移除：'+item.名称);
                    continue;
                }
                const finalName=target||item.名称;
                const record=this.assetPolicy.materializeRecord(existing,item,!target);
                if(existing&&same(existing,record))continue;
                patches.push({op:target?'replace':'add',path:this.patchPolicy.pointer(['资产',finalName]),value:record});
            }
            for(const item of result.探索){
                this.exploration.validateItem(stat,item);
                addEntity(['世界','探索',item.名称],item,EXISTING.探索);
            }
            if(!(stat.设置||{}).单一世界)for(const item of result.异端){
                if(item.操作==='撤销本轮')continue;
                const roster=stat.世界?.异端雷达?.名单||{},target=stableNameIn(roster,item.名称);
                if(!target){warnings.push('异端名单对象不存在，禁止世界引擎新增：'+item.名称);continue;}
                const oldStatus=roster[target]?.状态;
                if(oldStatus==='死亡'&&item.状态!=='死亡'){warnings.push('死亡异端状态不可逆：'+target);continue;}
                if(oldStatus===item.状态)continue;
                patches.push({op:'replace',path:this.patchPolicy.pointer(['世界','异端雷达','名单',target,'状态']),value:item.状态});
            } else if(result.异端.length)warnings.push('单一世界：忽略异端雷达更新');
            for(const key of WORLD_RESULT_RUMORS)for(const item of result.传闻[key])addEntity(['传闻',key,item.名称],item,EXISTING[key],{removable:true});
            const auditNames=new Set(this.npcAudit.audit(stat).map(item=>nameKey(item.名称)));
            for(const item of result.关系||[]){
                if(item.操作==='撤销本轮')continue;
                const target=stableNameIn(stat.关系列表||{},item.名称);
                if(!target){warnings.push('关系对象不存在，禁止世界引擎新建：'+item.名称);continue;}
                const npc=stat.关系列表[target],fields=this.resultFields(item,RELATION_SYNC_FIELDS);
                if(!Object.keys(fields).length){warnings.push('忽略空关系更新：'+target);continue;}
                for(const [field,value] of Object.entries(fields)){
                    if(RELATION_AUDIT_ONLY_FIELDS.has(field)&&!auditNames.has(nameKey(target))){
                        warnings.push('NPC当前不在构筑审计名单，忽略构筑字段：'+target+'/'+field);
                        continue;
                    }
                    this.relationSync.validateRelationSyncValue(field,value,npc,target);
                    const nextValue=RELATION_COMPONENT_FIELDS.has(field)?this.relationSync.mergeRelationComponent(field,npc?.[field],value):this.relationSync.materializeRelationComponent(field,value);
                    this.relationSync.assertComponentLimit(field,nextValue,target);
                    if(same(npc?.[field],nextValue))continue;
                    patches.push({op:npc?.[field]===undefined?'add':'replace',path:this.patchPolicy.pointer(['关系列表',target,field]),value:copy(nextValue)});
                }
            }
            const causalRepairs=this.causal.staleLocalOffsetRepairs(stat,result);
            const occupiedCausalPaths=new Set(patches.map(patch=>patch.path));
            for(const patch of causalRepairs.patches)if(!occupiedCausalPaths.has(patch.path))patches.push(patch);
            if(droppedCausalOffsets.length)warnings.push('忽略非世界尺度因果偏移：'+droppedCausalOffsets.join('、'));
            if(causalRepairs.names.length)warnings.push('清理局部稳定偏移：'+causalRepairs.names.join('、'));
            return this.timePolicy.finalizeCompile(originalStat,timing.proposal,{result,patches,warnings});
        }


    }
    const DEFAULT_WORLD_RESULT_PATCH_COMPILATION_SERVICE=new WorldResultPatchCompilationService(
        DEFAULT_WORLD_RESULT_NORMALIZER,
        DEFAULT_WORLD_EXPLORATION_SERVICE,
        DEFAULT_WORLD_CAUSAL_SERVICE,
        DEFAULT_WORLD_PATCH_POLICY,
        DEFAULT_WORLD_NPC_AUDIT_SERVICE,
        DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE,
        DEFAULT_WORLD_TASK_AWARENESS_SERVICE,
        DEFAULT_WORLD_CHRONOLOGY_POLICY,
        DEFAULT_WORLD_TIME_POLICY,
        DEFAULT_WORLD_RELATION_SYNC_POLICY,
        DEFAULT_WORLD_ASSET_MATERIALIZATION_POLICY
    );
