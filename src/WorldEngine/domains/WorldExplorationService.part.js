    const EXPLORATION_PROJECTION_RULES='【玩家探索投影硬约束】实际到达整体区域时至少记录10%探索；远方后台地区不自动投影；离开区域后仍保留探索台账。';
    const MICRO_EXPLORATION_ROOT=/^(?:房间|房室|大厅|走廊|通道|楼梯|楼层|入口|出口|出入口|屋顶|平台|仓库|餐厅|卫生间|浴室|车厢|甲板|舱室)$/;
    const MICRO_EXPLORATION_CHILD=/(?:室|房|厅|间|廊|梯|层|入口|出口|门|口|台|舱|仓|库|堂|巷|通道|甲板|屋顶)$/;
    function isMicroExplorationSegment(segment,nested=false) {
        const value=String(segment||'').trim();if(!value)return false;
        if(MICRO_EXPLORATION_ROOT.test(value))return true;
        return nested&&value.length<=16&&MICRO_EXPLORATION_CHILD.test(value);
    }
    class WorldExplorationService {
        constructor(engine=null){this.engine=engine;}
        snapshot(){
            const stat=this.engine?.snapshot?.().stat||{},world=stat.世界||{},backend=world?.[PATH]||{};
            return {探索:copy(world.探索||{}),势力:copy(world.势力||{}),势力地区:copy(backend.势力地区||{})};
        }
        granularity(name) {
            const raw=String(name||'').trim();
            if(!raw)return {invalid:true,parent:''};
            if(isMicroExplorationSegment(raw,false))return {invalid:true,parent:''};
            const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
            if(parts.length>1&&isMicroExplorationSegment(parts.at(-1),true))return {invalid:true,parent:parts.slice(0,-1).join('-')};
            return {invalid:false,parent:''};
        }
        validateItem(stat,item) {
            const granularity=this.granularity(item?.名称);
            if(granularity.invalid)throw new Error('探索粒度过细：'+item.名称+'。世界.探索只记录整体地标/区域'+(granularity.parent?'，请改为“'+granularity.parent+'”并把微观进展累加到主区域':'，禁止把建筑内部、单个房室、楼层、出入口等微观子区域作为独立探索项'));
            const old=(stat?.世界?.探索||{})[item.名称];
            if(old&&Object.hasOwn(item,'探索度')&&Number(item.探索度)<Number(old.探索度||0))throw new Error('探索度不能无因回退：'+item.名称+' '+old.探索度+' -> '+item.探索度);
            return granularity;
        }
        repairGranularity(stat) {
            const bucket=stat?.世界?.探索;if(!plain(bucket))return [];
            const patches=[];
            for(const name of Object.keys(bucket)){
                const info=this.granularity(name);if(!info.invalid||!info.parent)continue;
                const child=bucket[name],parent=bucket[info.parent];
                const merged=plain(parent)
                    ? Object.assign(copy(EXISTING.探索),copy(parent),{探索度:Math.max(Number(parent.探索度)||0,Number(child?.探索度)||0)})
                    : Object.assign(copy(EXISTING.探索),{
                        风险:String(child?.风险||'F'),
                        探索度:Number(child?.探索度)||0,
                        描述:'由旧版子区域探索记录合并，待补充整体地标描述',
                        隐藏真相:''
                    });
                bucket[info.parent]=merged;delete bucket[name];
                patches.push({op:parent?'replace':'add',path:pointer(['世界','探索',info.parent]),value:copy(merged)});
                patches.push({op:'remove',path:pointer(['世界','探索',name])});
            }
            return patches;
        }
        locationContainsArea(location,areaName) {
            const locationKey=nameKey(location),areaKey=nameKey(areaName);
            return !!locationKey&&!!areaKey&&(locationKey===areaKey||locationKey.includes(areaKey));
        }
        ensureCurrentProjection(stat,result) {
            if(stat?.系统状态?.是否在主神空间)return result;
            const location=String(stat?.世界?.地点||'').trim();if(!location)return result;
            const areas=new Map(Object.entries(stat?.世界?.[PATH]?.势力地区||{}).map(([name,record])=>[nameKey(name),{名称:name,记录:record}]));
            for(const item of result?.势力地区||[]){
                if(!plain(item)||item.操作==='撤销本轮')continue;
                const id=nameKey(item.名称),old=areas.get(id);
                areas.set(id,{名称:old?.名称||item.名称,记录:Object.assign({},old?.记录||{},item)});
            }
            const current=Array.from(areas.values())
                .filter(item=>plain(item.记录)&&String(item.记录.类型||'地区')!=='势力'&&this.locationContainsArea(location,item.名称))
                .sort((a,b)=>nameKey(b.名称).length-nameKey(a.名称).length)[0];
            if(!current||this.granularity(current.名称).invalid)return result;
            const bucket=stat?.世界?.探索||{},existingName=stableNameIn(bucket,current.名称),existing=existingName?bucket[existingName]:null;
            const list=Array.isArray(result.探索)?result.探索:(result.探索=[]);
            const index=list.findIndex(item=>plain(item)&&nameKey(item.名称)===nameKey(current.名称));
            const explicit=index>=0?list[index]:null,progress=Math.max(10,Number(existing?.探索度)||0,Number(explicit?.探索度)||0);
            if(existing&&progress===Number(existing.探索度||0)&&!explicit)return result;
            const item={
                名称:current.名称,操作:'更新',
                风险:String(explicit?.风险||existing?.风险||'F'),
                探索度:Math.min(100,progress),
                描述:String(explicit?.描述||existing?.描述||current.记录.描述||current.记录.公开动态||current.记录.进展||('已实际到达'+current.名称+'。')),
                隐藏真相:String(explicit?.隐藏真相||existing?.隐藏真相||'')
            };
            if(index>=0)list.splice(index,1,item);else list.push(item);
            return result;
        }
        record(kind,name){
            const source=this.snapshot(),bucket=kind==='faction'?source.势力:source.探索;
            const actual=stableNameIn(bucket,String(name||'').trim());if(!actual)return null;
            const backendName=stableNameIn(source.势力地区,actual),backend=backendName?source.势力地区[backendName]:null;
            return {kind,name:actual,ledger:copy(bucket[actual]),backendName,backend:plain(backend)?copy(backend):null};
        }
        normalizeRank(value,label){
            const rank=String(value||'').trim().toUpperCase();
            if(!QUALITY_RANKS.includes(rank))throw new Error(label+'必须是 '+QUALITY_RANKS.join(' / '));
            return rank;
        }
        async saveRecord(kind,oldName,newName,payload){
            if(!['exploration','faction'].includes(kind))throw new Error('未知探索/势力编辑类型');
            const engine=this.engine,oldKey=String(oldName||'').trim(),nextName=String(newName||'').trim();
            if(!nextName)throw new Error(kind==='faction'?'势力名称不能为空':'探索地标名称不能为空');
            if(kind==='exploration'){
                const granularity=this.granularity(nextName);
                if(granularity.invalid)throw new Error('探索粒度过细：'+nextName+(granularity.parent?'；请改为“'+granularity.parent+'”':''));
            }
            const input=plain(payload)?payload:{},ledgerInput=plain(input.ledger)?input.ledger:{},backendInput=plain(input.backend)?input.backend:{};
            const ok=await engine.services.mutations.commit(stat=>{
                const world=stat.世界||(stat.世界={}),backend=engine.services.mutations.backend(stat),bucket=kind==='faction'?(world.势力||(world.势力={})):(world.探索||(world.探索={}));
                const actual=stableNameIn(bucket,oldKey);if(!actual)throw new Error(kind==='faction'?'势力记录不存在：'+oldKey:'探索记录不存在：'+oldKey);
                const conflict=stableNameIn(bucket,nextName);
                if(conflict&&conflict!==actual)throw new Error('名称已存在：'+nextName);
                const current=plain(bucket[actual])?copy(bucket[actual]):{};
                let nextLedger;
                if(kind==='faction'){
                    nextLedger=Object.assign(copy(EXISTING.势力),current,{
                        实力:this.normalizeRank(ledgerInput.实力??current.实力??'F','势力实力'),
                        声望:Math.max(-5000,Math.min(10000,Number(ledgerInput.声望??current.声望)||0)),
                        领地:String(ledgerInput.领地??current.领地??'').trim(),
                        描述:String(ledgerInput.描述??current.描述??'').trim()
                    });
                }else{
                    nextLedger=Object.assign(copy(EXISTING.探索),current,{
                        风险:this.normalizeRank(ledgerInput.风险??current.风险??'F','探索风险'),
                        探索度:Math.max(0,Math.min(100,Number(ledgerInput.探索度??current.探索度)||0)),
                        描述:String(ledgerInput.描述??current.描述??'').trim(),
                        隐藏真相:String(ledgerInput.隐藏真相??current.隐藏真相??'').trim()
                    });
                }
                if(actual!==nextName)delete bucket[actual];
                bucket[nextName]=nextLedger;

                const areas=backend.势力地区||(backend.势力地区={}),areaName=stableNameIn(areas,actual)||stableNameIn(areas,nextName);
                const expectedFaction=kind==='faction';
                const existingArea=areaName&&plain(areas[areaName])?copy(areas[areaName]):null;
                const sameType=existingArea?(String(existingArea.类型||'地区')==='势力')===expectedFaction:true;
                if(sameType){
                    const area=Object.assign(copy(RECORDS.势力地区),existingArea||{},copy(backendInput),{类型:expectedFaction?'势力':'地区'});
                    area.描述=String(backendInput.描述??area.描述??nextLedger.描述??'').trim();
                    area.目标=String(backendInput.目标??area.目标??'').trim();
                    area.进展=String(backendInput.进展??area.进展??'').trim();
                    area.下次检查=String(backendInput.下次检查??area.下次检查??'').trim();
                    area.公开动态=String(backendInput.公开动态??area.公开动态??'').trim();
                    if(Object.hasOwn(backendInput,'控制方'))area.控制方=String(backendInput.控制方||'').trim();
                    if(Object.hasOwn(backendInput,'争夺方'))area.争夺方=engine.services.mutations.textList(backendInput.争夺方);
                    if(Object.hasOwn(backendInput,'环境状态'))area.环境状态=engine.services.mutations.textList(backendInput.环境状态);
                    if(areaName&&areaName!==nextName)delete areas[areaName];
                    areas[nextName]=area;
                }
                return true;
            },kind==='faction'?'势力档案已手动修正':'探索档案已手动修正');
            if(ok){
                if(kind==='faction')engine.selectedFaction=nextName;else engine.selectedArea=nextName;
                engine.render(true);
            }
            return ok;
        }
        async removeRecord(kind,name){
            if(!['exploration','faction'].includes(kind))throw new Error('未知探索/势力编辑类型');
            const engine=this.engine,key=String(name||'').trim();
            const ok=await engine.services.mutations.commit(stat=>{
                const world=stat.世界||(stat.世界={}),backend=engine.services.mutations.backend(stat),bucket=kind==='faction'?(world.势力||(world.势力={})):(world.探索||(world.探索={}));
                const actual=stableNameIn(bucket,key);if(!actual)return false;
                delete bucket[actual];
                const areas=backend.势力地区||(backend.势力地区={}),areaName=stableNameIn(areas,actual);
                if(areaName&&plain(areas[areaName])){
                    const isFaction=String(areas[areaName].类型||'地区')==='势力';
                    if(isFaction===(kind==='faction'))delete areas[areaName];
                }
                return true;
            },kind==='faction'?'势力档案已删除':'探索档案已删除');
            if(ok){
                if(kind==='faction')engine.selectedFaction='';else engine.selectedArea='';
                engine.render(true);
            }
            return ok;
        }
        prepareResult(stat,result){return this.ensureCurrentProjection(stat,result);}
    }
    const DEFAULT_WORLD_EXPLORATION_SERVICE=new WorldExplorationService();
    let ACTIVE_WORLD_EXPLORATION_SERVICE=DEFAULT_WORLD_EXPLORATION_SERVICE;
    function explorationGranularity(name){return ACTIVE_WORLD_EXPLORATION_SERVICE.granularity(name);}
    function repairExplorationGranularity(stat){return ACTIVE_WORLD_EXPLORATION_SERVICE.repairGranularity(stat);}
