    class WorldPatchApplicationService {
        constructor(patchPolicy,stateNormalizer,timeline,stateIntegrity,relationSync,rumor){
            this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;
            this.stateNormalizer=stateNormalizer||DEFAULT_WORLD_STATE_NORMALIZER;
            this.timeline=timeline||DEFAULT_WORLD_TIMELINE_POLICY;
            this.stateIntegrity=stateIntegrity||DEFAULT_WORLD_STATE_INTEGRITY_POLICY;
            this.relationSync=relationSync||DEFAULT_WORLD_RELATION_SYNC_POLICY;
            this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;
        }

        apply(stat,patches) {
            if(!Array.isArray(patches)||patches.length>100)throw new Error('每轮最多 100 条补丁');
            const next=copy(stat);
            next.世界[PATH]=Object.assign(emptyState(),next.世界[PATH]||{});
            this.stateNormalizer.normalizeBackendState(next);

            for(const patch of patches){
                if(!plain(patch)||!['add','replace','remove'].includes(patch.op))throw new Error('不支持的补丁操作');
                const parts=this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(patch.path),next);
                patch.path=this.patchPolicy.pointer(parts);
                if(!this.patchPolicy.allowed(parts,next,patch.op))throw new Error('禁止写入：'+patch.path);
                this.patchPolicy.bootstrapBackendParent(next,parts);
                const old=this.patchPolicy.get(next,parts);

                if(parts[1]===PATH&&parts[2]==='历史'&&(patch.op!=='add'||old!==undefined))throw new Error('历史只允许新增');
                if(patch.op!=='add'&&old===undefined&&!this.patchPolicy.canUpsertMissing(parts,next))throw new Error('目标不存在：'+patch.path);
                if(patch.op==='remove'&&!this.patchPolicy.removable(parts))throw new Error('仅可移除过期传播、传闻、已彻底消失的资产与程序确认的因果脏记录，其他记录使用状态结束');

                let value=patch.value;
                if(patch.op!=='remove'){
                    if(value===undefined)throw new Error('缺少补丁值');
                    const category=parts.length===3?parts[1]:parts.length===4?parts[2]:'';
                    if(parts[0]==='世界'&&parts[1]===PATH&&parts.length===4&&Object.hasOwn(RECORDS,category)){
                        value=this.patchPolicy.normalizeBackendRecord(category,value,old);
                        this.patchPolicy.checkRecord(value,RECORDS[category],DETAILS[category]);
                        this.patchPolicy.checkDetails(value,DETAILS[category]);
                    }else if(EXISTING[category]){
                        const schema=EXISTING[category];
                        if(plain(value)){
                            const merged=Object.assign(copy(schema),plain(old)?copy(old):{});
                            for(const key of Object.keys(schema))if(Object.hasOwn(value,key))merged[key]=copy(value[key]);
                            value=merged;
                        }
                        this.patchPolicy.checkRecord(value,schema);
                        if(parts[0]==='传闻'&&parts[1]==='情报交易'&&!(next.系统状态||{}).是否在主神空间&&next.世界?.名称!=='主神空间'&&/空间币/.test(String(value.要价||'')))throw new Error('任务世界情报交易必须使用本地货币，不能使用空间币');
                    }else if(old!==undefined&&(typeof old!==typeof value||Array.isArray(old)!==Array.isArray(value))){
                        throw new Error('字段类型发生改变');
                    }

                    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('数值无效');
                    if(parts[0]==='世界'&&parts[1]==='因果轨道'&&parts.length===3&&typeof value!=='string')throw new Error('因果摘要必须是文本');
                    if(parts[0]==='任务'&&parts[1]==='副本成就'&&old==='已达成'&&value!==old)throw new Error('不能回退已达成成就');
                    if(parts[0]==='关系列表'&&parts.length===3)this.relationSync.validateRelationSyncValue(parts[2],value,next.关系列表?.[parts[1]],parts[1]);
                    if(parts[parts.length-1]==='好感度'&&Math.abs(value-old)>20)throw new Error('单轮好感变动超过20');
                }

                let parent=next;
                for(const key of parts.slice(0,-1)){
                    if(parent[key]===undefined)parent[key]={};
                    if(!plain(parent[key]))throw new Error('父路径不是对象');
                    parent=parent[key];
                }
                if(patch.op==='remove')delete parent[parts.at(-1)];
                else parent[parts.at(-1)]=copy(value);
            }

            this.stateNormalizer.normalizeBackendState(next);
            this.stateNormalizer.normalizeEventLayers(next);
            this.timeline.validateTemporalWrites(stat,next,patches);
            this.stateIntegrity.validate(next);
            for(const [name,item] of Object.entries(next.世界.势力||{})){
                const old=(stat.世界.势力||{})[name];
                if(Math.abs(item.声望-(old?old.声望:0))>1000)throw new Error('单轮声望变动超过1000');
            }
            return this.rumor.finishPatches(next,patches);
        }
    }

    const DEFAULT_WORLD_PATCH_APPLICATION_SERVICE=new WorldPatchApplicationService(
        DEFAULT_WORLD_PATCH_POLICY,
        DEFAULT_WORLD_STATE_NORMALIZER,
        DEFAULT_WORLD_TIMELINE_POLICY,
        DEFAULT_WORLD_STATE_INTEGRITY_POLICY,
        DEFAULT_WORLD_RELATION_SYNC_POLICY,
        DEFAULT_WORLD_RUMOR_SERVICE
    );
