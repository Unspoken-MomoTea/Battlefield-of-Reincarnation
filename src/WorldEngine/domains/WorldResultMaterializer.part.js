    const ASSET_DEFAULTS={所属对象:[],类型:'',主体规模:1,完整度:100,状态:'',建设序列:{},驻扎人员:{},待办事件:[]};
    const ASSET_ENERGY_DEFAULTS={类型:'',当前:0,上限:0,描述:''};
    const ASSET_UNIT_DEFAULTS={余量:0,上限:0,加成:[]};
    const ASSET_BUILD_DEFAULTS={阶段:'基础',功能:'',加成:[],产出:'',下次产出日期:'',下次产出游天:0};
    class WorldResultMaterializer {
        constructor(normalizer,exploration,stateNormalizer,causal,patchPolicy,npcAudit,people,taskLedger,chronology,timePolicy,relationSync,rumor){this.normalizer=normalizer||DEFAULT_WORLD_RESULT_NORMALIZER;this.exploration=exploration||DEFAULT_WORLD_EXPLORATION_SERVICE;this.stateNormalizer=stateNormalizer||DEFAULT_WORLD_STATE_NORMALIZER;this.causal=causal||DEFAULT_WORLD_CAUSAL_SERVICE;this.patchPolicy=patchPolicy||DEFAULT_WORLD_PATCH_POLICY;this.npcAudit=npcAudit||DEFAULT_WORLD_NPC_AUDIT_SERVICE;this.people=people||DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE;this.taskLedger=taskLedger||DEFAULT_WORLD_TASK_AWARENESS_SERVICE;this.chronology=chronology||DEFAULT_WORLD_CHRONOLOGY_POLICY;this.timePolicy=timePolicy||DEFAULT_WORLD_TIME_POLICY;this.relationSync=relationSync||DEFAULT_WORLD_RELATION_SYNC_POLICY;this.rumor=rumor||DEFAULT_WORLD_RUMOR_SERVICE;}
        resultFields(item,sample) {
            const out={};
            for(const key of Object.keys(sample||{}))if(Object.hasOwn(item,key))out[key]=copy(item[key]);
            return out;
        }
        assertWorldAssetScope(item,isNew=false) {
            if(!isNew)return;
            const type=String(item?.类型||'').trim(),name=String(item?.名称||'').trim();
            if(!WORLD_ASSET_TYPE_SET.has(type))throw new Error('新资产类型非法：'+(name||'未命名')+'；资产只允许固定地产、大型载具或要塞，普通道具/材料/消耗品不得进入资产账簿');
            if(ITEMLIKE_ASSET_NAME.test(name))throw new Error('疑似道具被误写为资产：'+name+'；请写入角色道具/装备/形态等对应字段，不得写入资产');
        }
        materializeAssetRecord(oldValue,item,isNew=false) {
            const oldAsset=plain(oldValue)?copy(oldValue):{},asset=Object.assign(copy(ASSET_DEFAULTS),oldAsset);
            const normalizeOwners=value=>{const source=Array.isArray(value)?value:(value===undefined?[]:[value]),out=[];for(const raw of source){const owner=String(raw??'').trim();if(!owner||owner==='无主'||out.includes(owner))continue;out.push(owner);}return out.slice(0,12);};
            // 旧资产没有所属对象时兼容为玩家资产；显式空数组则表示无主。
            asset.所属对象=Object.hasOwn(oldAsset,'所属对象')?normalizeOwners(oldAsset.所属对象):['<user>'];
            if(isNew){
                if(!Object.hasOwn(item,'所属对象'))throw new Error('新资产必须明确所属对象数组；无主资产请使用空数组：'+item.名称);
                if(!Object.hasOwn(item,'类型')||!String(item.类型||'').trim())throw new Error('新资产必须明确类型：'+item.名称);
            }
            if(Object.hasOwn(item,'所属对象'))asset.所属对象=normalizeOwners(item.所属对象);
            for(const field of ['类型','主体规模','完整度','状态'])if(Object.hasOwn(item,field))asset[field]=copy(item[field]);
            if(Object.hasOwn(item,'能源')){
                if(item.能源===null)delete asset.能源;
                else asset.能源=Object.assign(copy(ASSET_ENERGY_DEFAULTS),plain(oldAsset.能源)?copy(oldAsset.能源):{},plain(item.能源)?copy(item.能源):{});
            }
            const mergeNamedMap=(field,defaults)=>{
                if(!Object.hasOwn(item,field))return;
                const merged=plain(oldAsset[field])?copy(oldAsset[field]):{};
                for(const [name,value] of Object.entries(item[field]||{})){
                    if(forbidden.has(name))continue;
                    if(value===null){delete merged[name];continue;}
                    const previous=plain(merged[name])?copy(merged[name]):{};
                    merged[name]=Object.assign(copy(defaults),previous,copy(value));
                }
                if(Object.keys(merged).length)asset[field]=merged;else delete asset[field];
            };
            mergeNamedMap('消耗单元',ASSET_UNIT_DEFAULTS);
            mergeNamedMap('建设序列',ASSET_BUILD_DEFAULTS);
            if(Object.hasOwn(item,'驻扎人员')){
                const merged=plain(oldAsset.驻扎人员)?copy(oldAsset.驻扎人员):{};
                for(const [name,value] of Object.entries(item.驻扎人员||{})){
                    if(forbidden.has(name))continue;
                    if(value===null)delete merged[name];else merged[name]=String(value??'');
                }
                asset.驻扎人员=merged;
            }
            if(Object.hasOwn(item,'待办事件'))asset.待办事件=copy(item.待办事件||[]);
            if(!plain(asset.建设序列))asset.建设序列={};
            if(!plain(asset.驻扎人员))asset.驻扎人员={};
            if(!Array.isArray(asset.待办事件))asset.待办事件=[];
            return asset;
        }

        compileWorldResult(stat,value) {
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
                if(!target&&item.操作!=='移除')this.assertWorldAssetScope(item,true);
                const tombstoneName=stableNameIn(stat?.世界?.[PATH]?.资产墓碑||{},item.名称);
                if(!target&&item.操作!=='移除'&&tombstoneName)throw new Error('资产已被用户或MVU删除，受删除保护，世界引擎不得重建：'+item.名称);
                if(item.操作==='移除'){
                    if(target)patches.push({op:'remove',path:this.patchPolicy.pointer(['资产',target])});
                    else warnings.push('资产对象不存在，忽略移除：'+item.名称);
                    continue;
                }
                const finalName=target||item.名称;
                const record=this.materializeAssetRecord(existing,item,!target);
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

        validateBaseState(stat) {
            const state = stat.世界[PATH];
            for (const [category, template] of Object.entries(RECORDS)) {
                if (!plain(state[category]) || Object.keys(state[category]).length > 300) throw new Error(category + '记录过多或结构错误');
                for (const [name,value] of Object.entries(state[category])) {
                    if (forbidden.has(name)) throw new Error('非法记录名');
                    this.patchPolicy.checkRecord(value,template,DETAILS[category]);
                    this.patchPolicy.checkDetails(value,DETAILS[category]);
                }
            }
            for (const [name,event] of Object.entries(state.事件)) {
                if (!['待发生','进行中','已完成','已取消'].includes(event.状态)) throw new Error('非法事件状态：'+name+' = '+String(event.状态||'空')+'；只允许 待发生/进行中/已完成/已取消');
                if (!EVENT_CATEGORIES.has(event.分类)) throw new Error('非法事件分类：'+name+' = '+String(event.分类||'空'));
                const parents=Array.isArray(event?.前因)?event.前因.filter(Boolean):[];
                if(parents.includes(name))throw new Error('事件前因非法自引用：'+name+'；前因不能引用事件自身，无明确前因请使用 []');
                const missing=parents.filter(id=>!Object.hasOwn(state.事件,id));
                if(missing.length)throw new Error('事件前因不存在：'+name+' <- '+missing.join('、')+'；前因只能引用已经存在，或本轮同时提交且成功建立的事件名称；当前阶段/自然语言原因不能作为前因，无明确前因请使用 []');
            }
            const calendar=plain(stat.世界?.历法)?stat.世界.历法:{};
            const monthDays=Array.isArray(calendar.月份天数)?calendar.月份天数:[];
            if(monthDays.length>24||monthDays.some(n=>!Number.isInteger(Number(n))||Number(n)<1||Number(n)>99))throw new Error('世界历法月份天数无效');
            const hasMonthDay=value=>/\d{1,2}\s*月\s*-?\s*\d{1,2}\s*日/.test(String(value||''));
            if(monthDays.length&&hasMonthDay(stat.世界.时间)&&!calendarDate(stat.世界.时间,calendar))throw new Error('世界时间违反历法月长：'+stat.世界.时间);
            if(monthDays.length){
                for(const [name,event] of Object.entries(state.事件)){
                    for(const value of [event.时间,event.开始时间,event.结束时间]){
                        if(hasMonthDay(value)&&!calendarDate(value,calendar))throw new Error('事件日期违反世界历法：'+name+' = '+value);
                    }
                }
            }
            const range = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
            for (const [name,item] of Object.entries(stat.世界.势力 || {})) if (!QUALITY_RANKS.includes(item.实力) || !range(item.声望,-5000,10000)) throw new Error('势力品质或声望越界：'+name+'，实力='+String(item.实力)+'，声望='+String(item.声望)+'；实力只允许 '+QUALITY_RANKS.join('/')+'，声望范围 -5000~10000');
            for (const [name,item] of Object.entries(stat.世界.探索 || {})) if (!QUALITY_RANKS.includes(item.风险) || !range(item.探索度,0,100)) throw new Error('探索品质或进度越界：'+name+'，风险='+String(item.风险)+'，探索度='+String(item.探索度)+'；风险只允许 '+QUALITY_RANKS.join('/')+'，探索度范围 0~100');
            for (const item of Object.values((stat.世界.因果轨道 || {}).偏移记录 || {})) if (!range(item.影响程度,-100,120)) throw new Error('因果偏移越界');
            for (const item of Object.values(stat.关系列表 || {})) if (!range(item.好感度,-100,100)) throw new Error('人物好感越界');
            for (const item of Object.values((stat.任务 || {}).列表 || {})) if (!['进行中','可交付','可结算','失败'].includes(item.状态)) throw new Error('任务状态无效');
            for (const item of Object.values((stat.任务 || {}).副本成就 || {})) if (!['未达成','已达成'].includes(item.状态)) throw new Error('成就状态无效');
            this.rumor.validatePublicState(stat);
            const visiting = new Set(), visited = new Set();
            function visit(name) {
                if (visiting.has(name)) throw new Error('事件前因形成循环');
                if (visited.has(name)) return;
                visiting.add(name); state.事件[name].前因.forEach(visit); visiting.delete(name); visited.add(name);
            }
            Object.keys(state.事件).forEach(visit);
            for (const category of ['人物','势力地区','传播']) {
                for (const record of Object.values(state[category])) if (record.关联事件.some(id => !Object.hasOwn(state.事件,id))) throw new Error('关联事件不存在');
            }
        }
        applyPatches(stat, patches) {
            if (!Array.isArray(patches) || patches.length > 100) throw new Error('每轮最多 100 条补丁');
            const next = copy(stat);
            next.世界[PATH] = Object.assign(emptyState(), next.世界[PATH] || {});
            this.stateNormalizer.normalizeBackendState(next);
            for (const patch of patches) {
                if (!plain(patch) || !['add','replace','remove'].includes(patch.op)) throw new Error('不支持的补丁操作');
                let p = this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(patch.path),next);
                patch.path=this.patchPolicy.pointer(p);
                if (!this.patchPolicy.allowed(p,next,patch.op)) throw new Error('禁止写入：' + patch.path);
                this.patchPolicy.bootstrapBackendParent(next,p);
                const old = this.patchPolicy.get(next,p);
                if (p[1] === PATH && p[2] === '历史' && (patch.op !== 'add' || old !== undefined)) throw new Error('历史只允许新增');
                // 世界模型经常把“首次设置”写成 replace；对允许创建的世界记录按 upsert 处理。
                if (patch.op !== 'add' && old === undefined && !this.patchPolicy.canUpsertMissing(p,next)) throw new Error('目标不存在：' + patch.path);
                if (patch.op === 'remove' && !this.patchPolicy.removable(p)) throw new Error('仅可移除过期传播、传闻、已彻底消失的资产与程序确认的因果脏记录，其他记录使用状态结束');
                let value=patch.value;
                if (patch.op !== 'remove') {
                    if (value === undefined) throw new Error('缺少补丁值');
                    const category = p.length === 3 ? p[1] : p.length === 4 ? p[2] : '';
                    if(p[0]==='世界'&&p[1]===PATH&&p.length===4&&Object.hasOwn(RECORDS,category)){
                        value=this.patchPolicy.normalizeBackendRecord(category,value,old);
                        this.patchPolicy.checkRecord(value,RECORDS[category],DETAILS[category]);
                        this.patchPolicy.checkDetails(value,DETAILS[category]);
                    } else if (EXISTING[category]) {
                        const schema=EXISTING[category];
                        if(plain(value)){
                            const merged=Object.assign(copy(schema),plain(old)?copy(old):{});
                            for(const key of Object.keys(schema))if(Object.hasOwn(value,key))merged[key]=copy(value[key]);
                            value=merged;
                        }
                        this.patchPolicy.checkRecord(value,schema);
                        if(p[0]==='传闻'&&p[1]==='情报交易'&&!(next.系统状态||{}).是否在主神空间&&next.世界?.名称!=='主神空间'&&/空间币/.test(String(value.要价||'')))throw new Error('任务世界情报交易必须使用本地货币，不能使用空间币');
                    }
                    else if (old !== undefined && (typeof old !== typeof value || Array.isArray(old) !== Array.isArray(value))) throw new Error('字段类型发生改变');
                    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('数值无效');
                    if (p[0] === '世界' && p[1] === '因果轨道' && p.length === 3 && typeof value !== 'string') throw new Error('因果摘要必须是文本');
                    if (p[0] === '任务' && p[1] === '副本成就' && old === '已达成' && value !== old) throw new Error('不能回退已达成成就');
                    if(p[0]==='关系列表'&&p.length===3)this.relationSync.validateRelationSyncValue(p[2],value,next.关系列表?.[p[1]],p[1]);
                    if (p[p.length-1] === '好感度' && Math.abs(value - old) > 20) throw new Error('单轮好感变动超过20');
                }
                let parent = next;
                for (const key of p.slice(0,-1)) {
                    if (parent[key] === undefined) parent[key] = {};
                    if (!plain(parent[key])) throw new Error('父路径不是对象');
                    parent = parent[key];
                }
                if (patch.op === 'remove') delete parent[p.at(-1)]; else parent[p.at(-1)] = copy(value);
            }
            this.stateNormalizer.normalizeBackendState(next);
            this.stateNormalizer.normalizeEventLayers(next);
            validateTemporalWrites(stat,next,patches);
            validateState(next);
            for (const [name,item] of Object.entries(next.世界.势力 || {})) {
                const old = (stat.世界.势力 || {})[name];
                if (Math.abs(item.声望 - (old ? old.声望 : 0)) > 1000) throw new Error('单轮声望变动超过1000');
            }
            return this.rumor.finishPatches(next,patches);
        }
        materializeWorldUpdate(stat,seedPatches,modelPatches) {
            const work=copy(stat);
            work.世界[PATH]=Object.assign(emptyState(),work.世界[PATH]||{});
            this.stateNormalizer.normalizeBackendState(work);compactWorldLifecycle(work);
            const appliedSeeds=(seedPatches||[]).filter(p=>this.patchPolicy.get(work,this.patchPolicy.canonicalizeParts(this.patchPolicy.tokens(p.path),work))===undefined);
            let next=this.applyPatches(work,appliedSeeds);
            next=this.applyPatches(next,modelPatches||[]);
            const explorationPatches=this.exploration.repairGranularity(next);
            const layerPatches=this.stateNormalizer.normalizeEventLayers(next);
            const causalPatches=this.causal.repairProjection(next);
            const predecessorPatches=this.stateNormalizer.repairMacroPredecessors(next);
            const linkPatches=this.stateNormalizer.repairExplicitEventLinks(next);
            compactWorldLifecycle(next);
            validateState(next);
            const repairPatches=[...explorationPatches,...layerPatches,...causalPatches,...predecessorPatches,...linkPatches];
            return {next,appliedSeeds,repairPatches};
        }
    }
    const DEFAULT_WORLD_RESULT_MATERIALIZER=new WorldResultMaterializer(DEFAULT_WORLD_RESULT_NORMALIZER,DEFAULT_WORLD_EXPLORATION_SERVICE,DEFAULT_WORLD_STATE_NORMALIZER,DEFAULT_WORLD_CAUSAL_SERVICE,DEFAULT_WORLD_PATCH_POLICY,DEFAULT_WORLD_NPC_AUDIT_SERVICE,DEFAULT_WORLD_PERSON_ACTIVITY_SERVICE,DEFAULT_WORLD_TASK_AWARENESS_SERVICE,DEFAULT_WORLD_CHRONOLOGY_POLICY,DEFAULT_WORLD_TIME_POLICY,DEFAULT_WORLD_RELATION_SYNC_POLICY);
    let ACTIVE_WORLD_RESULT_MATERIALIZER=DEFAULT_WORLD_RESULT_MATERIALIZER;
    function compileWorldResult(stat,value){return ACTIVE_WORLD_RESULT_MATERIALIZER.compileWorldResult(stat,value);}
    function validateState(stat){return ACTIVE_WORLD_RESULT_MATERIALIZER.validateBaseState(stat);}
    function applyPatches(stat,patches){return ACTIVE_WORLD_RESULT_MATERIALIZER.applyPatches(stat,patches);}
    function materializeWorldUpdate(stat,seedPatches,modelPatches){return ACTIVE_WORLD_RESULT_MATERIALIZER.materializeWorldUpdate(stat,seedPatches,modelPatches);}
