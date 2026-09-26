    const MICRO_EXPLORATION_SEGMENT=/^(?:天台|教室|走廊|楼梯|楼层|办公室|医务室|校医室|房间|寝室|宿舍房间|洗手间|浴室|食堂|门厅|入口|出口|校门|桥头|街口|小巷)$/;
    class WorldExplorationService {
        constructor(engine=null){this.engine=engine;}
        snapshot(){
            const stat=this.engine?.snapshot?.().stat||{},world=stat.世界||{},backend=world?.[PATH]||{};
            return {探索:copy(world.探索||{}),势力:copy(world.势力||{}),势力地区:copy(backend.势力地区||{})};
        }
        granularity(name) {
            const raw=String(name||'').trim();
            if(!raw)return {invalid:true,parent:''};
            if(MICRO_EXPLORATION_SEGMENT.test(raw))return {invalid:true,parent:''};
            const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
            if(parts.length>1&&MICRO_EXPLORATION_SEGMENT.test(parts.at(-1)))return {invalid:true,parent:parts.slice(0,-1).join('-')};
            return {invalid:false,parent:''};
        }
        validateItem(stat,item) {
            const granularity=this.granularity(item?.名称);
            if(granularity.invalid)throw new Error('探索粒度过细：'+item.名称+'。世界.探索只记录整体地标/区域'+(granularity.parent?'，请改为“'+granularity.parent+'”并把微观进展累加到主区域':'，禁止把天台、教室、走廊、房间等子区域作为独立探索项'));
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
        prepareResult(stat,result){return this.ensureCurrentProjection(stat,result);}
    }
    const DEFAULT_WORLD_EXPLORATION_SERVICE=new WorldExplorationService();
    let ACTIVE_WORLD_EXPLORATION_SERVICE=DEFAULT_WORLD_EXPLORATION_SERVICE;
    function explorationGranularity(name){return ACTIVE_WORLD_EXPLORATION_SERVICE.granularity(name);}
    function repairExplorationGranularity(stat){return ACTIVE_WORLD_EXPLORATION_SERVICE.repairGranularity(stat);}
