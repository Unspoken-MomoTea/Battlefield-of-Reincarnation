    const MICRO_EXPLORATION_SEGMENT=/^(?:天台|教室|走廊|楼梯|楼层|办公室|医务室|校医室|房间|寝室|宿舍房间|洗手间|浴室|食堂|门厅|入口|出口|校门|桥头|街口|小巷)$/;
    class WorldExplorationService {
        constructor(engine){this.engine=engine||null;}
        granularity(name){
            const raw=String(name||'').trim();
            if(!raw)return {invalid:true,parent:''};
            if(MICRO_EXPLORATION_SEGMENT.test(raw))return {invalid:true,parent:''};
            const parts=raw.split(/\s*(?:-|—|–|→|>|\/|／|·|・)\s*/).filter(Boolean);
            if(parts.length>1&&MICRO_EXPLORATION_SEGMENT.test(parts.at(-1)))return {invalid:true,parent:parts.slice(0,-1).join('-')};
            return {invalid:false,parent:''};
        }
        repairGranularity(stat){
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
        snapshot(){
            if(!this.engine)return {探索:{},势力:{},势力地区:{}};
            const stat=this.engine.snapshot().stat||{},world=stat.世界||{},backend=world?.[PATH]||{};
            return {探索:copy(world.探索||{}),势力:copy(world.势力||{}),势力地区:copy(backend.势力地区||{})};
        }
    }
    const DEFAULT_WORLD_EXPLORATION_SERVICE=new WorldExplorationService(null);
    let ACTIVE_WORLD_EXPLORATION_SERVICE=DEFAULT_WORLD_EXPLORATION_SERVICE;
    function explorationGranularity(name){return ACTIVE_WORLD_EXPLORATION_SERVICE.granularity(name);}
    function repairExplorationGranularity(stat){return ACTIVE_WORLD_EXPLORATION_SERVICE.repairGranularity(stat);}
