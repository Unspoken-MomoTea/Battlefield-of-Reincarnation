    class WorldStateFactory {
        emptyBackend() {
            return {版本:5,已处理楼层:'',已处理时间:'',事件:{},人物:{},势力地区:{},历史:{},历史总结:{},传播:{},最近变化:[],资产墓碑:{}};
        }
    }

    const DEFAULT_WORLD_STATE_FACTORY=new WorldStateFactory();
    function emptyState(){return DEFAULT_WORLD_STATE_FACTORY.emptyBackend();}

